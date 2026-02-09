/**
 * Handler for the Prompt Expander feature (local Ollama LLM).
 *
 * Provides:
 *  - Multiple **model configurations** (with one marked as default)
 *  - Multiple **profiles** (system prompt + result template + temperature + model override),
 *    with one marked as default
 *  - Per-invocation config reload (always fresh from send_to_chat.json)
 *  - Placeholders in systemPrompt and resultTemplate, including ${rawResponse}
 *    and ${thinkTagInfo}
 *  - Bridge API so Dart/JS scripts can access profiles, models, and
 *    trigger prompt expansion programmatically
 *  - Context-menu commands mirroring Send to Chat (submenu lists profiles)
 *
 * Configuration lives in the `promptExpander` section of send_to_chat.json.
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { handleError, bridgeLog, getBridgeClient } from './handler_shared';

// ============================================================================
// Interfaces
// ============================================================================

/** A named model configuration. */
export interface ModelConfig {
    /** Ollama server URL */
    ollamaUrl: string;
    /** Model name as known by Ollama (e.g. qwen3:8b) */
    model: string;
    /** Sampling temperature.  0 = deterministic, 2 = very random. */
    temperature: number;
    /** Whether to strip `<think>…</think>` tags from the response. */
    stripThinkingTags: boolean;
    /** Human-readable description shown in model selection quick-pick. */
    description?: string;
    /** If true this is the default model when no model is specified. */
    isDefault?: boolean;
    /** Ollama keep_alive duration (e.g. "5m", "1h", "0", "-1"). Default: "5m". */
    keepAlive?: string;
}

/** A named expansion profile. */
export interface ExpanderProfile {
    /** Human-readable label shown in quick-pick / context menu. */
    label: string;
    /** Override system prompt (null → inherit top-level). */
    systemPrompt: string | null;
    /** Override result template (null → inherit top-level). */
    resultTemplate: string | null;
    /** Override temperature (null → inherit from model config). */
    temperature: number | null;
    /** Override model config key (null → use default model). */
    modelConfig: string | null;
    /** If true this is the default profile when no profile is specified. */
    isDefault?: boolean;
}

/** Full promptExpander section from send_to_chat.json. */
export interface PromptExpanderConfig {
    /** Default model settings (backward compat, used when models section is absent). */
    ollamaUrl: string;
    model: string;
    temperature: number;
    stripThinkingTags: boolean;
    /** Default system prompt. */
    systemPrompt: string;
    /** Default result template. */
    resultTemplate: string;
    /** Named model configurations. */
    models: { [key: string]: ModelConfig };
    /** Named profiles. */
    profiles: { [key: string]: ExpanderProfile };
}

/** Result returned by the process() bridge API. */
export interface ExpanderProcessResult {
    success: boolean;
    /** The final text after template expansion. */
    result: string;
    /** The raw LLM response before any processing. */
    rawResponse: string;
    /** The cleaned response (after think-tag stripping). */
    response: string;
    /** Extracted <think> tag content, if any. */
    thinkTagContent: string;
    /** Profile key used. */
    profile: string;
    /** Model config key used. */
    modelConfig: string;
    error?: string;
    /** Token usage statistics from Ollama. */
    tokenInfo?: {
        promptTokens: number;
        completionTokens: number;
        totalDurationMs: number;
        loadDurationMs: number;
    };
}

/** Stats returned by Ollama in the final streaming chunk. */
interface OllamaStats {
    promptTokens: number;
    completionTokens: number;
    totalDurationMs: number;
    loadDurationMs: number;
}

// ============================================================================
// Hardcoded defaults
// ============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are a prompt expansion assistant. Your job is to take a short, terse user prompt and expand it into a detailed, well-structured prompt that will produce better results from an AI coding assistant (GitHub Copilot).

Rules:
- Keep the original intent exactly — do not add tasks the user did not ask for.
- Add structure: break vague requests into clear, numbered steps if appropriate.
- Add specificity: if the user mentions a file, technology, or pattern, reference it explicitly.
- Add quality cues: remind the assistant to handle edge cases, follow conventions, write tests if applicable.
- Keep it concise — expand, don't bloat. A good expansion is 2-5x the original length, not 20x.
- Output ONLY the expanded prompt text. No explanations, no markdown fences, no preamble.
- Do NOT wrap your output in thinking tags or chain-of-thought. Output the final prompt directly.
- Preserve any special syntax the user wrote (e.g., !prompt, $prompt, file paths, code snippets).
- Write in the same language/tone as the original prompt.`;

const DEFAULTS: PromptExpanderConfig = {
    ollamaUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    temperature: 0.4,
    stripThinkingTags: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    resultTemplate: '${response}',
    models: {},
    profiles: {},
};

// ============================================================================
// PromptExpanderManager — singleton, created in extension.ts
// ============================================================================

export class PromptExpanderManager {
    private context: vscode.ExtensionContext;
    private registeredCommands: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    dispose(): void {
        for (const cmd of this.registeredCommands) {
            cmd.dispose();
        }
        this.registeredCommands = [];
    }

    // -----------------------------------------------------------------------
    // Config loading — always fresh on every invocation
    // -----------------------------------------------------------------------

    private getConfigPath(): string | undefined {
        const configSetting = vscode.workspace
            .getConfiguration('dartscript.sendToChat')
            .get<string>('configPath');
        if (configSetting) {
            const wf = vscode.workspace.workspaceFolders;
            if (wf && wf.length > 0) {
                return configSetting.replace(/\$\{workspaceFolder\}/g, wf[0].uri.fsPath);
            }
            return configSetting;
        }
        const wf = vscode.workspace.workspaceFolders;
        if (wf && wf.length > 0) {
            return path.join(wf[0].uri.fsPath, '_ai', 'send_to_chat', 'send_to_chat.json');
        }
        return undefined;
    }

    /** Load config fresh from disk + VS Code settings. Never cached. */
    loadConfig(): PromptExpanderConfig {
        const config: PromptExpanderConfig = { ...DEFAULTS, models: {}, profiles: {} };

        // VS Code settings fallback
        const vs = vscode.workspace.getConfiguration('dartscript.ollama');
        const vsUrl = vs.get<string>('url');
        const vsModel = vs.get<string>('model');
        if (vsUrl) { config.ollamaUrl = vsUrl; }
        if (vsModel) { config.model = vsModel; }

        const configPath = this.getConfigPath();
        if (!configPath || !fs.existsSync(configPath)) { return config; }

        try {
            const raw = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(raw);
            const sec = parsed?.promptExpander;
            if (!sec || typeof sec !== 'object') { return config; }

            // Top-level scalars
            if (typeof sec.ollamaUrl === 'string') { config.ollamaUrl = sec.ollamaUrl; }
            if (typeof sec.model === 'string') { config.model = sec.model; }
            if (typeof sec.temperature === 'number') { config.temperature = sec.temperature; }
            if (typeof sec.stripThinkingTags === 'boolean') { config.stripThinkingTags = sec.stripThinkingTags; }
            if (typeof sec.systemPrompt === 'string') { config.systemPrompt = sec.systemPrompt; }
            if (typeof sec.resultTemplate === 'string') { config.resultTemplate = sec.resultTemplate; }

            // Model configurations
            if (sec.models && typeof sec.models === 'object') {
                for (const [key, val] of Object.entries(sec.models)) {
                    const m = val as any;
                    if (m && typeof m === 'object') {
                        config.models[key] = {
                            ollamaUrl: typeof m.ollamaUrl === 'string' ? m.ollamaUrl : config.ollamaUrl,
                            model: typeof m.model === 'string' ? m.model : config.model,
                            temperature: typeof m.temperature === 'number' ? m.temperature : config.temperature,
                            stripThinkingTags: typeof m.stripThinkingTags === 'boolean' ? m.stripThinkingTags : config.stripThinkingTags,
                            description: typeof m.description === 'string' ? m.description : undefined,
                            isDefault: m.isDefault === true,
                            keepAlive: typeof m.keepAlive === 'string' ? m.keepAlive : undefined,
                        };
                    }
                }
            }

            // Profiles
            if (sec.profiles && typeof sec.profiles === 'object') {
                for (const [key, val] of Object.entries(sec.profiles)) {
                    const p = val as any;
                    if (p && typeof p === 'object') {
                        config.profiles[key] = {
                            label: typeof p.label === 'string' ? p.label : key,
                            systemPrompt: typeof p.systemPrompt === 'string' ? p.systemPrompt : null,
                            resultTemplate: typeof p.resultTemplate === 'string' ? p.resultTemplate : null,
                            temperature: typeof p.temperature === 'number' ? p.temperature : null,
                            modelConfig: typeof p.modelConfig === 'string' ? p.modelConfig : null,
                            isDefault: p.isDefault === true,
                        };
                    }
                }
            }

            // Backward compat: old "defaultProfile" field
            if (typeof sec.defaultProfile === 'string' && config.profiles[sec.defaultProfile]) {
                // If no profile is marked isDefault, mark the old defaultProfile
                const anyDefault = Object.values(config.profiles).some((p) => p.isDefault);
                if (!anyDefault) {
                    config.profiles[sec.defaultProfile].isDefault = true;
                }
            }
        } catch (err) {
            bridgeLog(`[Prompt Expander] Failed to parse config: ${err}`);
        }

        return config;
    }

    // -----------------------------------------------------------------------
    // Resolve helpers
    // -----------------------------------------------------------------------

    /** Find the default model config key, or undefined if none. */
    getDefaultModelKey(config: PromptExpanderConfig): string | undefined {
        for (const [key, m] of Object.entries(config.models)) {
            if (m.isDefault) { return key; }
        }
        // First model wins if none marked default
        const keys = Object.keys(config.models);
        return keys.length > 0 ? keys[0] : undefined;
    }

    /** Find the default profile key, or undefined if none. */
    getDefaultProfileKey(config: PromptExpanderConfig): string | undefined {
        for (const [key, p] of Object.entries(config.profiles)) {
            if (p.isDefault) { return key; }
        }
        const keys = Object.keys(config.profiles);
        return keys.length > 0 ? keys[0] : undefined;
    }

    /** Resolve model config: explicit key → profile override → default model → top-level values. */
    resolveModelConfig(config: PromptExpanderConfig, profile?: ExpanderProfile, explicitModelKey?: string): { key: string; mc: ModelConfig } {
        const modelKey = explicitModelKey ?? profile?.modelConfig ?? this.getDefaultModelKey(config);
        if (modelKey && config.models[modelKey]) {
            return { key: modelKey, mc: config.models[modelKey] };
        }
        // Synthesize from top-level values
        return {
            key: '_default',
            mc: {
                ollamaUrl: config.ollamaUrl,
                model: config.model,
                temperature: config.temperature,
                stripThinkingTags: config.stripThinkingTags,
                isDefault: true,
                keepAlive: '5m',
            },
        };
    }

    // -----------------------------------------------------------------------
    // Think-tag processing
    // -----------------------------------------------------------------------

    /** Extract <think>…</think> content and return cleaned text + extracted content. */
    private processThinkTags(text: string, strip: boolean): { cleaned: string; thinkContent: string } {
        const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/g);
        let thinkContent = '';
        if (thinkMatch) {
            thinkContent = thinkMatch
                .map((m) => m.replace(/<\/?think>/g, '').trim())
                .join('\n---\n');
        }
        const cleaned = strip
            ? text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
            : text;
        return { cleaned, thinkContent };
    }

    // -----------------------------------------------------------------------
    // Placeholder resolution
    // -----------------------------------------------------------------------

    /**
     * Available placeholders:
     *   ${original}      - The original prompt text before expansion
     *   ${response}      - The cleaned LLM response (after think-tag stripping if enabled)
     *   ${rawResponse}   - The raw LLM response exactly as received
     *   ${thinkTagInfo}  - Extracted content from <think> tags (empty if none)
     *   ${filename}      - Basename of the active file
     *   ${filePath}      - Full path to the active file
     *   ${languageId}    - VS Code language ID
     *   ${workspaceName} - Name of the first workspace folder
     *   ${datetime}      - Current date/time as yyyymmdd_hhmmss
     *   ${model}         - The Ollama model name used
     *   ${modelConfig}   - The model config key used
     *   ${profile}       - The profile key used
     *   ${lineStart}     - Start line of the selection (1-based)
     *   ${lineEnd}       - End line of the selection (1-based)
     */
    private resolvePlaceholders(template: string, values: { [key: string]: string }): string {
        let result = template;
        for (const [key, value] of Object.entries(values)) {
            result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
        }
        return result;
    }

    private buildPlaceholderValues(
        editor: vscode.TextEditor | undefined,
        original: string,
        rawResponse: string,
        cleanedResponse: string,
        thinkContent: string,
        modelName: string,
        modelConfigKey: string,
        profileName: string,
    ): { [key: string]: string } {
        const now = new Date();
        const wf = vscode.workspace.workspaceFolders;
        const doc = editor?.document;
        const sel = editor?.selection;

        return {
            original,
            response: cleanedResponse,
            rawResponse,
            thinkTagInfo: thinkContent,
            filename: doc ? path.basename(doc.fileName) : '',
            filePath: doc?.fileName ?? '',
            languageId: doc?.languageId ?? '',
            workspaceName: wf?.[0]?.name ?? '',
            datetime: this.formatDateTime(now),
            model: modelName,
            modelConfig: modelConfigKey,
            profile: profileName,
            lineStart: sel ? String(sel.start.line + 1) : '0',
            lineEnd: sel ? String(sel.end.line + 1) : '0',
        };
    }

    private formatDateTime(now: Date): string {
        const y = now.getFullYear();
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        return `${y}${mo}${d}_${h}${mi}${s}`;
    }

    // -----------------------------------------------------------------------
    // Ollama API
    // -----------------------------------------------------------------------

    private async isOllamaRunning(baseUrl: string): Promise<boolean> {
        return new Promise((resolve) => {
            const url = new URL(baseUrl);
            const req = http.request(
                { hostname: url.hostname, port: url.port, path: '/', method: 'GET', timeout: 3000 },
                (res) => { resolve(res.statusCode === 200); },
            );
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.end();
        });
    }

    /** Check if a specific model is currently loaded in Ollama via GET /api/ps. */
    private async isModelLoaded(baseUrl: string, modelName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const u = new URL('/api/ps', baseUrl);
            const req = http.request(
                { hostname: u.hostname, port: u.port, path: u.pathname, method: 'GET', timeout: 3000 },
                (res) => {
                    let body = '';
                    res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(body);
                            const loaded = (parsed.models ?? []).some(
                                (m: any) => (m.name ?? m.model ?? '') === modelName,
                            );
                            resolve(loaded);
                        } catch {
                            resolve(false);
                        }
                    });
                    res.on('error', () => resolve(false));
                },
            );
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.end();
        });
    }

    private async ollamaGenerate(
        baseUrl: string,
        model: string,
        systemPrompt: string,
        userPrompt: string,
        temperature: number,
        onToken?: (token: string) => void,
        cancellationToken?: vscode.CancellationToken,
        keepAlive?: string,
    ): Promise<{ text: string; stats?: OllamaStats }> {
        return new Promise((resolve, reject) => {
            const url = new URL('/api/chat', baseUrl);
            const body = JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                stream: true,
                options: { temperature },
                // eslint-disable-next-line @typescript-eslint/naming-convention
                ...(keepAlive !== undefined ? { keep_alive: keepAlive } : {}),
            });

            const req = http.request(
                {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname,
                    method: 'POST',
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    headers: { 'Content-Type': 'application/json' },
                },
                (res) => {
                    let fullResponse = '';
                    let buffer = '';
                    let stats: OllamaStats | undefined;

                    res.on('data', (chunk: Buffer) => {
                        buffer += chunk.toString();
                        const lines = buffer.split('\n');
                        buffer = lines.pop() ?? '';
                        for (const line of lines) {
                            if (!line.trim()) { continue; }
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.message?.content) {
                                    fullResponse += parsed.message.content;
                                    onToken?.(parsed.message.content);
                                }
                                if (parsed.done === true) {
                                    stats = {
                                        promptTokens: parsed.prompt_eval_count ?? 0,
                                        completionTokens: parsed.eval_count ?? 0,
                                        totalDurationMs: Math.round((parsed.total_duration ?? 0) / 1e6),
                                        loadDurationMs: Math.round((parsed.load_duration ?? 0) / 1e6),
                                    };
                                }
                            } catch { /* partial JSON */ }
                        }
                    });

                    res.on('end', () => {
                        if (buffer.trim()) {
                            try {
                                const parsed = JSON.parse(buffer);
                                if (parsed.message?.content) {
                                    fullResponse += parsed.message.content;
                                }
                                if (parsed.done === true && !stats) {
                                    stats = {
                                        promptTokens: parsed.prompt_eval_count ?? 0,
                                        completionTokens: parsed.eval_count ?? 0,
                                        totalDurationMs: Math.round((parsed.total_duration ?? 0) / 1e6),
                                        loadDurationMs: Math.round((parsed.load_duration ?? 0) / 1e6),
                                    };
                                }
                            } catch { /* ignore */ }
                        }
                        resolve({ text: fullResponse, stats });
                    });
                    res.on('error', reject);
                },
            );

            if (cancellationToken) {
                cancellationToken.onCancellationRequested(() => {
                    req.destroy();
                    reject(new Error('Cancelled'));
                });
            }

            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    // -----------------------------------------------------------------------
    // Core processing — used by both the command handler and the bridge API
    // -----------------------------------------------------------------------

    /**
     * Process a prompt through a model with a given profile.
     *
     * @param prompt        The text to expand
     * @param profileKey    Profile key (null → default profile)
     * @param modelConfigKey Model config key (null → profile's modelConfig or default model)
     * @param editor        Optional editor for placeholder context
     * @param cancellationToken Optional cancellation
     */
    async process(
        prompt: string,
        profileKey?: string | null,
        modelConfigKey?: string | null,
        editor?: vscode.TextEditor,
        cancellationToken?: vscode.CancellationToken,
    ): Promise<ExpanderProcessResult> {
        const config = this.loadConfig();

        // Resolve profile
        const effectiveProfileKey = profileKey ?? this.getDefaultProfileKey(config) ?? '_default';
        const profile = config.profiles[effectiveProfileKey];

        // Resolve model config
        const effectiveModelKey = modelConfigKey ?? profile?.modelConfig ?? this.getDefaultModelKey(config);
        const { key: resolvedModelKey, mc } = effectiveModelKey && config.models[effectiveModelKey]
            ? { key: effectiveModelKey, mc: config.models[effectiveModelKey] }
            : this.resolveModelConfig(config, profile);

        const effectiveSystemPrompt = profile?.systemPrompt ?? config.systemPrompt;
        const effectiveResultTemplate = profile?.resultTemplate ?? config.resultTemplate;
        const effectiveTemperature = profile?.temperature ?? mc.temperature;

        // Pre-values for system prompt placeholder resolution
        const preValues = this.buildPlaceholderValues(
            editor, prompt, '', '', '', mc.model, resolvedModelKey, effectiveProfileKey,
        );
        const resolvedSystemPrompt = this.resolvePlaceholders(effectiveSystemPrompt, preValues);

        try {
            // Check Ollama
            const running = await this.isOllamaRunning(mc.ollamaUrl);
            if (!running) {
                return {
                    success: false,
                    result: '',
                    rawResponse: '',
                    response: '',
                    thinkTagContent: '',
                    profile: effectiveProfileKey,
                    modelConfig: resolvedModelKey,
                    error: `Ollama is not running at ${mc.ollamaUrl}`,
                };
            }

            // Call LLM
            const { text: rawResponse, stats } = await this.ollamaGenerate(
                mc.ollamaUrl,
                mc.model,
                resolvedSystemPrompt,
                prompt,
                effectiveTemperature,
                undefined,
                cancellationToken,
                mc.keepAlive,
            );

            if (!rawResponse.trim()) {
                return {
                    success: false,
                    result: '',
                    rawResponse,
                    response: '',
                    thinkTagContent: '',
                    profile: effectiveProfileKey,
                    modelConfig: resolvedModelKey,
                    error: 'Ollama returned an empty response',
                };
            }

            // Process think tags
            const { cleaned, thinkContent } = this.processThinkTags(rawResponse, mc.stripThinkingTags);

            // Apply result template
            const postValues = this.buildPlaceholderValues(
                editor, prompt, rawResponse, cleaned, thinkContent,
                mc.model, resolvedModelKey, effectiveProfileKey,
            );
            const finalText = this.resolvePlaceholders(effectiveResultTemplate, postValues);

            return {
                success: true,
                result: finalText,
                rawResponse,
                response: cleaned,
                thinkTagContent: thinkContent,
                profile: effectiveProfileKey,
                modelConfig: resolvedModelKey,
                tokenInfo: stats,
            };
        } catch (err: any) {
            return {
                success: false,
                result: '',
                rawResponse: '',
                response: '',
                thinkTagContent: '',
                profile: effectiveProfileKey,
                modelConfig: resolvedModelKey,
                error: err.message ?? String(err),
            };
        }
    }

    // -----------------------------------------------------------------------
    // Bridge API
    // -----------------------------------------------------------------------

    /**
     * Handle bridge API calls (called from vscode-bridge.ts handleDartRequest).
     *
     * Methods:
     *   localLlm.getProfilesVce     → list configured profiles
     *   localLlm.getModelsVce       → list configured model configurations
     *   localLlm.updateProfileVce   → add/update a profile
     *   localLlm.removeProfileVce   → remove a profile
     *   localLlm.updateModelVce     → add/update a model configuration
     *   localLlm.removeModelVce     → remove a model configuration
     *   localLlm.processVce         → process a prompt through model + profile
     */
    async handleBridgeRequest(method: string, params: any): Promise<any> {
        switch (method) {
            case 'localLlm.getProfilesVce':
                return this.bridgeGetProfiles();
            case 'localLlm.getModelsVce':
                return this.bridgeGetModels();
            case 'localLlm.updateProfileVce':
                return this.bridgeUpdateProfile(params);
            case 'localLlm.removeProfileVce':
                return this.bridgeRemoveProfile(params);
            case 'localLlm.updateModelVce':
                return this.bridgeUpdateModel(params);
            case 'localLlm.removeModelVce':
                return this.bridgeRemoveModel(params);
            case 'localLlm.processVce':
                return this.bridgeProcess(params);
            default:
                throw new Error(`Unknown localLlm method: ${method}`);
        }
    }

    private bridgeGetProfiles(): any {
        const config = this.loadConfig();
        const defaultKey = this.getDefaultProfileKey(config);
        return {
            profiles: Object.entries(config.profiles).map(([key, p]) => ({
                key,
                label: p.label,
                isDefault: key === defaultKey,
                systemPrompt: p.systemPrompt,
                resultTemplate: p.resultTemplate,
                temperature: p.temperature,
                modelConfig: p.modelConfig,
            })),
        };
    }

    private bridgeGetModels(): any {
        const config = this.loadConfig();
        const defaultKey = this.getDefaultModelKey(config);
        return {
            models: Object.entries(config.models).map(([key, m]) => ({
                key,
                ollamaUrl: m.ollamaUrl,
                model: m.model,
                temperature: m.temperature,
                stripThinkingTags: m.stripThinkingTags,
                description: m.description ?? null,
                isDefault: key === defaultKey,
            })),
            // Include synthesized default if no models are configured
            effectiveDefault: {
                ollamaUrl: config.ollamaUrl,
                model: config.model,
                temperature: config.temperature,
                stripThinkingTags: config.stripThinkingTags,
            },
        };
    }

    private bridgeUpdateProfile(params: any): any {
        return this.updateConfigSection('profiles', params.key, params.profile);
    }

    private bridgeRemoveProfile(params: any): any {
        return this.removeConfigSection('profiles', params.key);
    }

    private bridgeUpdateModel(params: any): any {
        return this.updateConfigSection('models', params.key, params.model);
    }

    private bridgeRemoveModel(params: any): any {
        return this.removeConfigSection('models', params.key);
    }

    private async bridgeProcess(params: any): Promise<ExpanderProcessResult> {
        const prompt = params.prompt as string;
        if (!prompt) {
            return {
                success: false, result: '', rawResponse: '', response: '',
                thinkTagContent: '', profile: '', modelConfig: '',
                error: 'Missing required parameter: prompt',
            };
        }
        return this.process(
            prompt,
            params.profile ?? null,
            params.model ?? null,
            vscode.window.activeTextEditor,
        );
    }

    // -----------------------------------------------------------------------
    // Ollama model listing + switch
    // -----------------------------------------------------------------------

    /** Query Ollama /api/tags to list locally available models. */
    async listOllamaModels(baseUrl?: string): Promise<Array<{ name: string; size: number; modifiedAt: string }>> {
        const config = this.loadConfig();
        const url = baseUrl ?? config.ollamaUrl;

        return new Promise((resolve) => {
            const u = new URL('/api/tags', url);
            const req = http.request(
                { hostname: u.hostname, port: u.port, path: u.pathname, method: 'GET', timeout: 5000 },
                (res) => {
                    let body = '';
                    res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(body);
                            const models = (parsed.models ?? []).map((m: any) => ({
                                name: m.name ?? m.model ?? '',
                                size: m.size ?? 0,
                                modifiedAt: m.modified_at ?? '',
                            }));
                            resolve(models);
                        } catch {
                            resolve([]);
                        }
                    });
                    res.on('error', () => resolve([]));
                },
            );
            req.on('error', () => resolve([]));
            req.on('timeout', () => { req.destroy(); resolve([]); });
            req.end();
        });
    }

    /** Format bytes as human-readable size. */
    private formatSize(bytes: number): string {
        if (bytes < 1024) { return `${bytes} B`; }
        if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
        if (bytes < 1024 * 1024 * 1024) { return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    /**
     * Interactive command: switch the default Ollama model.
     * Queries the Ollama API for locally available models, shows a quick-pick,
     * and updates the default model config in send_to_chat.json.
     */
    async switchModelCommand(): Promise<void> {
        const config = this.loadConfig();

        // Query Ollama for available models
        const ollamaModels = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Querying Ollama for available models...' },
            async () => this.listOllamaModels(),
        );

        if (ollamaModels.length === 0) {
            vscode.window.showErrorMessage(
                `No models found. Is Ollama running at ${config.ollamaUrl}? Pull models with: ollama pull <model>`,
            );
            return;
        }

        // Find current default model
        const defaultModelKey = this.getDefaultModelKey(config);
        const currentDefault = defaultModelKey ? config.models[defaultModelKey] : undefined;
        const currentModelName = currentDefault?.model ?? config.model;

        // Build quick-pick items
        const items = ollamaModels.map((m) => {
            const isCurrent = m.name === currentModelName;
            return {
                label: `${isCurrent ? '$(check) ' : ''}${m.name}`,
                description: `${this.formatSize(m.size)}${isCurrent ? ' (current)' : ''}`,
                modelName: m.name,
            };
        });

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: `Current model: ${currentModelName} — select new default model`,
        });
        if (!picked) { return; }

        // Update the default model config
        const configPath = this.getConfigPath();
        if (!configPath) {
            vscode.window.showErrorMessage('No config file path found');
            return;
        }

        try {
            let data: any = {};
            if (fs.existsSync(configPath)) {
                data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }
            if (!data.promptExpander) { data.promptExpander = {}; }

            // Update the default model config entry, or create one
            if (defaultModelKey && data.promptExpander.models?.[defaultModelKey]) {
                data.promptExpander.models[defaultModelKey].model = picked.modelName;
            } else if (data.promptExpander.models && Object.keys(data.promptExpander.models).length > 0) {
                // Find the default one
                const key = Object.entries(data.promptExpander.models as Record<string, any>)
                    .find(([_, v]) => v.isDefault)?.[0]
                    ?? Object.keys(data.promptExpander.models)[0];
                data.promptExpander.models[key].model = picked.modelName;
            } else {
                // Also update top-level fallback
                data.promptExpander.model = picked.modelName;
            }

            fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');

            bridgeLog(`[Prompt Expander] Switched default model to: ${picked.modelName}`);

            // Pre-load the model by sending a minimal generation request.
            // Ollama loads models on demand — this ensures the model is warm
            // in memory so the first real expansion is fast.
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading ${picked.modelName} into memory...`,
                    cancellable: true,
                },
                async (_progress, token) => {
                    try {
                        await this.ollamaGenerate(
                            config.ollamaUrl,
                            picked.modelName,
                            'Respond with OK.',
                            'OK',
                            0,
                            undefined,
                            token,
                            '5m',
                        );
                        bridgeLog(`[Prompt Expander] Model ${picked.modelName} loaded successfully`);
                    } catch (err: any) {
                        if (err.message !== 'Cancelled') {
                            bridgeLog(`[Prompt Expander] Warning: pre-load failed: ${err.message}`);
                        }
                    }
                },
            );

            vscode.window.showInformationMessage(`Local LLM model switched to: ${picked.modelName}`);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to update config: ${err.message}`);
        }
    }

    /** Write a section update to the config file. */
    private updateConfigSection(section: 'profiles' | 'models', key: string, value: any): any {
        const configPath = this.getConfigPath();
        if (!configPath) { return { success: false, error: 'No config file path' }; }

        try {
            let data: any = {};
            if (fs.existsSync(configPath)) {
                data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }
            if (!data.promptExpander) { data.promptExpander = {}; }
            if (!data.promptExpander[section]) { data.promptExpander[section] = {}; }
            data.promptExpander[section][key] = value;
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /** Remove a key from a section in the config file. */
    private removeConfigSection(section: 'profiles' | 'models', key: string): any {
        const configPath = this.getConfigPath();
        if (!configPath) { return { success: false, error: 'No config file path' }; }

        try {
            if (!fs.existsSync(configPath)) {
                return { success: false, error: 'Config file does not exist' };
            }
            const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (data.promptExpander?.[section]?.[key]) {
                delete data.promptExpander[section][key];
                fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
                return { success: true };
            }
            return { success: false, error: `Key "${key}" not found in ${section}` };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    // -----------------------------------------------------------------------
    // VS Code command handler — interactive (with UI)
    // -----------------------------------------------------------------------

    /**
     * Interactive expand: shows model quick-pick (if multiple), then profile quick-pick, progress, replaces in editor.
     *
     * @param forceProfileKey  If set, skip the profile quick-pick and use this profile.
     * @param forceModelKey    If set, skip the model quick-pick and use this model.
     */
    async expandPromptCommand(forceProfileKey?: string, forceModelKey?: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const config = this.loadConfig();

        // Resolve model config — ask if multiple and not forced
        let selectedModelKey: string | null = forceModelKey ?? null;
        const modelKeys = Object.keys(config.models);
        if (!selectedModelKey && modelKeys.length > 1) {
            const defaultModelKey = this.getDefaultModelKey(config);
            const modelItems = modelKeys.map((key) => {
                const m = config.models[key];
                const isDefault = key === defaultModelKey;
                const desc = m.description
                    ? `${m.model} — ${m.description}${isDefault ? ' (default)' : ''}`
                    : `${m.model}${isDefault ? ' (default)' : ''}`;
                return { label: key, description: desc, key };
            });
            const pickedModel = await vscode.window.showQuickPick(modelItems, {
                placeHolder: 'Select model configuration',
            });
            if (!pickedModel) { return; }
            selectedModelKey = pickedModel.key;
        }

        // Resolve profile
        let profileKey: string;
        if (forceProfileKey && config.profiles[forceProfileKey]) {
            profileKey = forceProfileKey;
        } else {
            const profileKeys = Object.keys(config.profiles);
            if (profileKeys.length > 1) {
                const defaultKey = this.getDefaultProfileKey(config);
                const items = profileKeys.map((key) => {
                    const p = config.profiles[key];
                    const desc = key === defaultKey ? `${key} (default)` : key;
                    return { label: p.label, description: desc, key };
                });
                const picked = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select expansion profile',
                });
                if (!picked) { return; }
                profileKey = picked.key;
            } else if (profileKeys.length === 1) {
                profileKey = profileKeys[0];
            } else {
                profileKey = '_default';
            }
        }

        // Get text
        const selection = editor.selection;
        const hasSelection = !selection.isEmpty;
        const originalText = hasSelection
            ? editor.document.getText(selection)
            : editor.document.getText();

        if (!originalText.trim()) {
            vscode.window.showWarningMessage('Nothing to expand — editor or selection is empty.');
            return;
        }

        const profile = config.profiles[profileKey];
        const { mc } = this.resolveModelConfig(config, profile, selectedModelKey ?? undefined);

        try {
            // Check Ollama
            const running = await this.isOllamaRunning(mc.ollamaUrl);
            if (!running) {
                const action = await vscode.window.showErrorMessage(
                    `Ollama is not running at ${mc.ollamaUrl}. Start it with: brew services start ollama`,
                    'Copy Command',
                );
                if (action === 'Copy Command') {
                    await vscode.env.clipboard.writeText('brew services start ollama');
                }
                return;
            }

            // Check if model is loaded — if not, pre-load with distinct progress
            const modelLoaded = await this.isModelLoaded(mc.ollamaUrl, mc.model);
            if (!modelLoaded) {
                let preloadCancelled = false;
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Loading model ${mc.model}...`,
                        cancellable: true,
                    },
                    async (_progress, token) => {
                        try {
                            await this.ollamaGenerate(
                                mc.ollamaUrl, mc.model, 'Respond with OK.', 'OK', 0,
                                undefined, token, mc.keepAlive,
                            );
                        } catch (err: any) {
                            if (err.message === 'Cancelled') { preloadCancelled = true; }
                        }
                    },
                );
                if (preloadCancelled) {
                    vscode.window.showInformationMessage('Prompt expansion cancelled.');
                    return;
                }
            }

            // Process with progress
            const result = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Processing prompt with ${mc.model}...`,
                    cancellable: true,
                },
                async (_progress, cancellationToken) => {
                    return this.process(originalText, profileKey, selectedModelKey, editor, cancellationToken);
                },
            );

            if (!result.success) {
                if (result.error === 'Cancelled') {
                    vscode.window.showInformationMessage('Prompt expansion cancelled.');
                } else {
                    vscode.window.showErrorMessage(`Expansion failed: ${result.error}`);
                }
                return;
            }

            // Replace in editor
            const success = await editor.edit((editBuilder) => {
                if (hasSelection) {
                    editBuilder.replace(selection, result.result);
                } else {
                    const fullRange = new vscode.Range(
                        editor.document.positionAt(0),
                        editor.document.positionAt(editor.document.getText().length),
                    );
                    editBuilder.replace(fullRange, result.result);
                }
            });

            if (success) {
                const tokenStr = result.tokenInfo
                    ? ` | ${result.tokenInfo.promptTokens}+${result.tokenInfo.completionTokens} tokens, ${(result.tokenInfo.totalDurationMs / 1000).toFixed(1)}s`
                    : '';
                bridgeLog(`[Prompt Expander] ${originalText.length} → ${result.result.length} chars [${profileKey}/${result.modelConfig}]${tokenStr}`);
                vscode.window.showInformationMessage(
                    `Expanded (${originalText.length} → ${result.result.length} chars) [${profileKey}]${tokenStr}`,
                );
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'Cancelled') {
                vscode.window.showInformationMessage('Prompt expansion cancelled.');
                return;
            }
            handleError('Failed to expand prompt', error);
        }
    }
}

// ============================================================================
// Exported standalone handler (backward compat for extension.ts)
// ============================================================================

/** Global manager instance — set by extension.ts during activation. */
let _manager: PromptExpanderManager | undefined;

export function setPromptExpanderManager(mgr: PromptExpanderManager): void {
    _manager = mgr;
}

export function getPromptExpanderManager(): PromptExpanderManager | undefined {
    return _manager;
}

/**
 * Command handler for `dartscript.expandPrompt`.
 * Delegates to the global PromptExpanderManager.
 */
export async function expandPromptHandler(): Promise<void> {
    if (!_manager) {
        vscode.window.showErrorMessage('Prompt Expander not initialized');
        return;
    }
    await _manager.expandPromptCommand();
}

/**
 * Command handler for profile-specific context menu commands.
 * Used by `dartscript.sendToLocalLlm.<profileKey>`.
 */
export function createProfileHandler(profileKey: string): () => Promise<void> {
    return async () => {
        if (!_manager) {
            vscode.window.showErrorMessage('Prompt Expander not initialized');
            return;
        }
        await _manager.expandPromptCommand(profileKey);
    };
}

/**
 * Command handler for `dartscript.switchLocalModel`.
 * Shows available Ollama models and switches the default.
 */
export async function switchModelHandler(): Promise<void> {
    if (!_manager) {
        vscode.window.showErrorMessage('Prompt Expander not initialized');
        return;
    }
    await _manager.switchModelCommand();
}
