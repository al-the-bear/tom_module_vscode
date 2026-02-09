/**
 * Handler for dartscript.expandPrompt command.
 *
 * Uses a local Ollama model to expand terse user prompts
 * into detailed, well-structured prompts suitable for Copilot Chat.
 *
 * Configuration is loaded from the promptExpander section of send_to_chat.json.
 * Supports multiple named profiles with customizable system prompts,
 * result templates, and temperature settings.
 *
 * The command works on:
 * 1. Selected text in the active editor (replaces selection)
 * 2. Full document content if nothing is selected (replaces all)
 *
 * The expansion happens in-place with a progress indicator.
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { handleError, bridgeLog } from './handler_shared';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface ExpanderProfile {
    label: string;
    systemPrompt: string | null;
    resultTemplate: string | null;
    temperature: number | null;
}

interface PromptExpanderConfig {
    ollamaUrl: string;
    model: string;
    temperature: number;
    stripThinkingTags: boolean;
    defaultProfile: string;
    systemPrompt: string;
    resultTemplate: string;
    profiles: { [key: string]: ExpanderProfile };
}

// ---------------------------------------------------------------------------
// Hardcoded defaults (used when config file is missing or incomplete)
// ---------------------------------------------------------------------------

const DEFAULTS: PromptExpanderConfig = {
    ollamaUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    temperature: 0.4,
    stripThinkingTags: true,
    defaultProfile: 'expand',
    systemPrompt: `You are a prompt expansion assistant. Your job is to take a short, terse user prompt and expand it into a detailed, well-structured prompt that will produce better results from an AI coding assistant (GitHub Copilot).

Rules:
- Keep the original intent exactly — do not add tasks the user did not ask for.
- Add structure: break vague requests into clear, numbered steps if appropriate.
- Add specificity: if the user mentions a file, technology, or pattern, reference it explicitly.
- Add quality cues: remind the assistant to handle edge cases, follow conventions, write tests if applicable.
- Keep it concise — expand, don't bloat. A good expansion is 2-5x the original length, not 20x.
- Output ONLY the expanded prompt text. No explanations, no markdown fences, no preamble.
- Do NOT wrap your output in thinking tags or chain-of-thought. Output the final prompt directly.
- Preserve any special syntax the user wrote (e.g., !prompt, $prompt, file paths, code snippets).
- Write in the same language/tone as the original prompt.`,
    resultTemplate: '${response}',
    profiles: {},
};

// ---------------------------------------------------------------------------
// Configuration loading
// ---------------------------------------------------------------------------

/**
 * Resolve the path to send_to_chat.json (same logic as SendToChatAdvancedManager).
 */
function getConfigPath(): string | undefined {
    const configSetting = vscode.workspace.getConfiguration('dartscript.sendToChat').get<string>('configPath');
    if (configSetting) {
        // Resolve ${workspaceFolder}
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return configSetting.replace(/\$\{workspaceFolder\}/g, workspaceFolders[0].uri.fsPath);
        }
        return configSetting;
    }

    // Default location
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return path.join(workspaceFolders[0].uri.fsPath, '_ai', 'send_to_chat', 'send_to_chat.json');
    }
    return undefined;
}

/**
 * Load the promptExpander section from the config file.
 * Falls back to VS Code settings for ollamaUrl and model, then to hardcoded defaults.
 */
function loadExpanderConfig(): PromptExpanderConfig {
    const config = { ...DEFAULTS };

    // Override with VS Code settings (backward compat)
    const vsConfig = vscode.workspace.getConfiguration('dartscript.ollama');
    const settingsUrl = vsConfig.get<string>('url');
    const settingsModel = vsConfig.get<string>('model');
    if (settingsUrl) { config.ollamaUrl = settingsUrl; }
    if (settingsModel) { config.model = settingsModel; }

    // Try to load from JSON config file
    const configPath = getConfigPath();
    if (configPath && fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(raw);
            const section = parsed?.promptExpander;
            if (section && typeof section === 'object') {
                if (typeof section.ollamaUrl === 'string') { config.ollamaUrl = section.ollamaUrl; }
                if (typeof section.model === 'string') { config.model = section.model; }
                if (typeof section.temperature === 'number') { config.temperature = section.temperature; }
                if (typeof section.stripThinkingTags === 'boolean') { config.stripThinkingTags = section.stripThinkingTags; }
                if (typeof section.defaultProfile === 'string') { config.defaultProfile = section.defaultProfile; }
                if (typeof section.systemPrompt === 'string') { config.systemPrompt = section.systemPrompt; }
                if (typeof section.resultTemplate === 'string') { config.resultTemplate = section.resultTemplate; }
                if (section.profiles && typeof section.profiles === 'object') {
                    config.profiles = {};
                    for (const [key, value] of Object.entries(section.profiles)) {
                        const p = value as any;
                        if (p && typeof p === 'object') {
                            config.profiles[key] = {
                                label: typeof p.label === 'string' ? p.label : key,
                                systemPrompt: typeof p.systemPrompt === 'string' ? p.systemPrompt : null,
                                resultTemplate: typeof p.resultTemplate === 'string' ? p.resultTemplate : null,
                                temperature: typeof p.temperature === 'number' ? p.temperature : null,
                            };
                        }
                    }
                }
            }
        } catch (err) {
            bridgeLog(`[Prompt Expander] Failed to parse config: ${err}`);
        }
    }

    return config;
}

// ---------------------------------------------------------------------------
// Placeholder resolution
// ---------------------------------------------------------------------------

/**
 * Resolve placeholders in a template string.
 *
 * Available placeholders:
 *   ${original}      - The original prompt text before expansion
 *   ${response}      - The raw LLM response
 *   ${filename}      - Basename of the active file (e.g., main.dart)
 *   ${filePath}      - Full path to the active file
 *   ${languageId}    - VS Code language ID (e.g., dart, typescript)
 *   ${workspaceName} - Name of the first workspace folder
 *   ${datetime}      - Current date/time as yyyymmdd_hhmmss
 *   ${model}         - The Ollama model used
 *   ${profile}       - The profile name used
 *   ${lineStart}     - Start line of the selection (1-based)
 *   ${lineEnd}       - End line of the selection (1-based)
 */
function resolvePlaceholders(
    template: string,
    values: { [key: string]: string },
): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
        result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return result;
}

/**
 * Build the placeholder values map from the current editor context.
 */
function buildPlaceholderValues(
    editor: vscode.TextEditor,
    original: string,
    response: string,
    model: string,
    profileName: string,
): { [key: string]: string } {
    const doc = editor.document;
    const selection = editor.selection;
    const now = new Date();
    const workspaceFolders = vscode.workspace.workspaceFolders;

    return {
        original,
        response,
        filename: path.basename(doc.fileName),
        filePath: doc.fileName,
        languageId: doc.languageId,
        workspaceName: workspaceFolders?.[0]?.name ?? '',
        datetime: formatDateTime(now),
        model,
        profile: profileName,
        lineStart: String(selection.start.line + 1),
        lineEnd: String(selection.end.line + 1),
    };
}

function formatDateTime(now: Date): string {
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}${mo}${d}_${h}${mi}${s}`;
}

// ---------------------------------------------------------------------------
// Ollama API interaction
// ---------------------------------------------------------------------------

/**
 * Check if Ollama is reachable.
 */
async function isOllamaRunning(baseUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
        const url = new URL(baseUrl);
        const req = http.request(
            { hostname: url.hostname, port: url.port, path: '/', method: 'GET', timeout: 3000 },
            (res) => { resolve(res.statusCode === 200); }
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
}

/**
 * Send a prompt to Ollama and collect the full response.
 */
async function ollamaGenerate(
    baseUrl: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    onToken?: (token: string) => void,
    cancellationToken?: vscode.CancellationToken,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/chat', baseUrl);
        const body = JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            stream: true,
            options: {
                temperature,
            },
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

                res.on('data', (chunk: Buffer) => {
                    buffer += chunk.toString();
                    // Ollama streams newline-delimited JSON
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
                        } catch {
                            // Partial JSON, will be completed in next chunk
                        }
                    }
                });

                res.on('end', () => {
                    // Process any remaining buffer
                    if (buffer.trim()) {
                        try {
                            const parsed = JSON.parse(buffer);
                            if (parsed.message?.content) {
                                fullResponse += parsed.message.content;
                            }
                        } catch { /* ignore */ }
                    }
                    resolve(fullResponse);
                });

                res.on('error', reject);
            },
        );

        // Handle cancellation
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

// ---------------------------------------------------------------------------
// Strip thinking tags from Qwen 3 output
// ---------------------------------------------------------------------------

function stripThinkingTags(text: string): string {
    // Qwen 3 may wrap reasoning in <think>...</think> tags
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

/**
 * Expand the current selection (or full document) using a local Ollama model.
 * If multiple profiles exist, shows a quick pick to choose one.
 */
export async function expandPromptHandler(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const config = loadExpanderConfig();

    // Choose profile
    let profileName = config.defaultProfile;
    let profile: ExpanderProfile | undefined;

    const profileKeys = Object.keys(config.profiles);
    if (profileKeys.length > 1) {
        // Show quick pick for profile selection
        const items = profileKeys.map((key) => {
            const p = config.profiles[key];
            return { label: p.label, description: key, key };
        });
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select expansion profile',
        });
        if (!picked) { return; } // Cancelled
        profileName = picked.key;
        profile = config.profiles[picked.key];
    } else if (profileKeys.length === 1) {
        profileName = profileKeys[0];
        profile = config.profiles[profileKeys[0]];
    }
    // If no profiles defined, profile stays undefined — use top-level config values

    // Resolve effective values (profile overrides top-level)
    const effectiveSystemPrompt = profile?.systemPrompt ?? config.systemPrompt;
    const effectiveResultTemplate = profile?.resultTemplate ?? config.resultTemplate;
    const effectiveTemperature = profile?.temperature ?? config.temperature;
    const ollamaUrl = config.ollamaUrl;
    const model = config.model;

    // Get text to expand
    const selection = editor.selection;
    const hasSelection = !selection.isEmpty;
    const originalText = hasSelection
        ? editor.document.getText(selection)
        : editor.document.getText();

    if (!originalText.trim()) {
        vscode.window.showWarningMessage('Nothing to expand — editor or selection is empty.');
        return;
    }

    // Resolve placeholders in system prompt (before sending to LLM)
    const preValues = buildPlaceholderValues(editor, originalText, '', model, profileName);
    const resolvedSystemPrompt = resolvePlaceholders(effectiveSystemPrompt, preValues);

    try {
        // Check Ollama is reachable
        const running = await isOllamaRunning(ollamaUrl);
        if (!running) {
            const action = await vscode.window.showErrorMessage(
                `Ollama is not running at ${ollamaUrl}. Start it with: brew services start ollama`,
                'Copy Command'
            );
            if (action === 'Copy Command') {
                await vscode.env.clipboard.writeText('brew services start ollama');
            }
            return;
        }

        // Expand with progress
        const expandedText = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Expanding prompt with ${model} [${profileName}]...`,
                cancellable: true,
            },
            async (progress, cancellationToken) => {
                let tokenCount = 0;
                const result = await ollamaGenerate(
                    ollamaUrl,
                    model,
                    resolvedSystemPrompt,
                    originalText,
                    effectiveTemperature,
                    (_token) => {
                        tokenCount++;
                        if (tokenCount % 10 === 0) {
                            progress.report({ message: `${tokenCount} tokens generated...` });
                        }
                    },
                    cancellationToken,
                );
                return result;
            },
        );

        if (!expandedText.trim()) {
            vscode.window.showWarningMessage('Ollama returned an empty response.');
            return;
        }

        // Strip thinking tags if configured
        const cleanedResponse = config.stripThinkingTags
            ? stripThinkingTags(expandedText)
            : expandedText;

        // Apply result template
        const postValues = buildPlaceholderValues(editor, originalText, cleanedResponse, model, profileName);
        const finalText = resolvePlaceholders(effectiveResultTemplate, postValues);

        // Replace in editor
        const success = await editor.edit((editBuilder) => {
            if (hasSelection) {
                editBuilder.replace(selection, finalText);
            } else {
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length),
                );
                editBuilder.replace(fullRange, finalText);
            }
        });

        if (success) {
            bridgeLog(`[Prompt Expander] Expanded ${originalText.length} chars → ${finalText.length} chars using ${model} [${profileName}]`);
            vscode.window.showInformationMessage(
                `Prompt expanded (${originalText.length} → ${finalText.length} chars) [${profileName}]`
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
