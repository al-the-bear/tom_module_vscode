/**
 * Shared functionality for VS Code command handlers.
 * 
 * This module provides common utilities used across multiple command handlers,
 * including logging, error handling, workspace utilities, and bridge management.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DartBridgeClient } from '../vscode-bridge';

// ============================================================================
// Global State
// ============================================================================

/**
 * Global bridge client instance - shared across all handlers
 */
let bridgeClient: DartBridgeClient | null = null;

/**
 * Get the global bridge client instance
 */
export function getBridgeClient(): DartBridgeClient | null {
    return bridgeClient;
}

/**
 * Set the global bridge client instance
 */
export function setBridgeClient(client: DartBridgeClient | null): void {
    bridgeClient = client;
}

// ============================================================================
// Logging
// ============================================================================

/**
 * Log a message to the DartScript output channel
 */
export function bridgeLog(message: string, level: 'INFO' | 'ERROR' = 'INFO'): void {
    if (!DartBridgeClient.outputChannel) {
        console.log(`[VS Code Extension] ${level} ${message}`);
        return;
    }
    DartBridgeClient.outputChannel.appendLine(`[VS Code Extension] ${level} ${message}`);
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle errors consistently across all handlers.
 * Extracts error IDs (e.g., [B01], [E01]) from the original error
 * and prepends them to the message for easier debugging.
 */
export function handleError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(message, error);
    
    // Extract error ID from the original error message (e.g., [B01], [E01])
    const errorIdMatch = errorMessage.match(/\[([A-Z]\d+)\]/);
    const errorId = errorIdMatch ? errorIdMatch[0] + ' ' : '';
    
    vscode.window.showErrorMessage(`${errorId}${message}: ${errorMessage}`);
}

// ============================================================================
// Workspace Utilities
// ============================================================================

/**
 * Get the workspace root path
 */
export function getWorkspaceRoot(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
}

/**
 * Get the resolved path to the extension config file.
 *
 * Reads the `dartscript.configPath` setting (default: `~/.tom/vscode/tom_vscode_extension.json`).
 * Supports `~` (home directory) and `${workspaceFolder}` placeholders.
 */
export function getConfigPath(): string | undefined {
    const configSetting = vscode.workspace
        .getConfiguration('dartscript')
        .get<string>('configPath');

    if (!configSetting) {
        // Fallback default
        return path.join(os.homedir(), '.tom', 'vscode', 'tom_vscode_extension.json');
    }

    let resolved = configSetting;

    // Resolve ~ to home directory
    if (resolved.startsWith('~/') || resolved === '~') {
        resolved = path.join(os.homedir(), resolved.slice(2));
    }

    // Resolve ${workspaceFolder}
    const wf = vscode.workspace.workspaceFolders;
    if (wf && wf.length > 0) {
        resolved = resolved.replace(/\$\{workspaceFolder\}/g, wf[0].uri.fsPath);
    }

    return resolved;
}

/**
 * Get VS Code language ID from filename extension
 */
export function getLanguageFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const languageMap: Record<string, string> = {
        '.dart': 'dart',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.ts': 'typescript',
        '.js': 'javascript',
        '.html': 'html',
        '.css': 'css',
        '.xml': 'xml',
        '.txt': 'plaintext'
    };
    return languageMap[ext] || 'plaintext';
}

/**
 * Get workspace structure as a string for display
 */
export async function getWorkspaceStructure(workspaceRoot: string): Promise<string> {
    const structure: string[] = [];

    function scanDirectory(dir: string, indent: string = '', maxDepth: number = 3, currentDepth: number = 0): void {
        if (currentDepth >= maxDepth) {
            return;
        }

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                // Skip hidden files and common build directories
                if (entry.name.startsWith('.') ||
                    entry.name === 'node_modules' ||
                    entry.name === 'build' ||
                    entry.name === 'out') {
                    continue;
                }

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    structure.push(`${indent}📁 ${entry.name}/`);
                    scanDirectory(fullPath, indent + '  ', maxDepth, currentDepth + 1);
                } else {
                    structure.push(`${indent}📄 ${entry.name}`);
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dir}:`, error);
        }
    }

    scanDirectory(workspaceRoot);
    return structure.join('\n');
}

// ============================================================================
// Bridge Utilities
// ============================================================================

/**
 * Ensure the bridge client is available and running.
 * Creates a new client if needed and starts the bridge if not running.
 * 
 * @param context - Extension context for creating new bridge client
 * @param showMessages - Whether to show status messages to the user
 * @returns The bridge client, or null if it couldn't be started
 */
export async function ensureBridgeRunning(
    context: vscode.ExtensionContext,
    showMessages: boolean = false
): Promise<DartBridgeClient | null> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        if (showMessages) {
            vscode.window.showErrorMessage('No workspace folder open');
        }
        return null;
    }

    const bridgePath = path.join(workspaceRoot, 'xternal', 'tom_module_vscode', 'tom_vscode_bridge');
    if (!fs.existsSync(bridgePath)) {
        if (showMessages) {
            vscode.window.showErrorMessage('tom_vscode_bridge not found in workspace (expected at xternal/tom_module_vscode/tom_vscode_bridge)');
        }
        return null;
    }

    // Create bridge client if needed
    if (!bridgeClient) {
        bridgeClient = new DartBridgeClient(context);
    }

    // Start bridge if not already running
    if (!bridgeClient.isRunning()) {
        if (showMessages) {
            vscode.window.showInformationMessage('Starting Dart bridge...');
        }
        await bridgeClient.startWithAutoRestart(bridgePath);
    }

    return bridgeClient;
}

// ============================================================================
// Copilot Integration
// ============================================================================

/**
 * Get a Copilot chat model
 */
export async function getCopilotModel(): Promise<vscode.LanguageModelChat | undefined> {
    try {
        // Get configuration
        const config = vscode.workspace.getConfiguration('dartscript');
        const preferredModel = config.get<string>('copilotModel', 'gpt-4o');

        // Try to get the preferred model
        let models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: preferredModel
        });

        // Fallback to any Copilot model
        if (models.length === 0) {
            models = await vscode.lm.selectChatModels({
                vendor: 'copilot'
            });
        }

        if (models.length === 0) {
            vscode.window.showErrorMessage(
                'No Copilot models available. Please ensure GitHub Copilot is installed and activated.'
            );
            return undefined;
        }

        console.log(`Using Copilot model: ${models[0].name} (${models[0].vendor})`);
        return models[0];

    } catch (error) {
        console.error('Error getting Copilot model:', error);
        return undefined;
    }
}

/**
 * Send a request to Copilot and get the response
 */
export async function sendCopilotRequest(
    model: vscode.LanguageModelChat,
    prompt: string,
    token: vscode.CancellationToken
): Promise<string> {
    try {
        // Create chat messages
        const messages = [
            vscode.LanguageModelChatMessage.User(prompt)
        ];

        // Send request
        const response = await model.sendRequest(messages, {}, token);

        // Collect response text
        let fullResponse = '';
        for await (const chunk of response.text) {
            if (token.isCancellationRequested) {
                throw new Error('Request cancelled');
            }
            fullResponse += chunk;
        }

        return fullResponse;

    } catch (error) {
        if (error instanceof vscode.LanguageModelError) {
            console.error('Copilot error:', error.message, error.code);

            // Handle specific error cases
            if (error.cause instanceof Error) {
                if (error.cause.message.includes('off_topic')) {
                    throw new Error('The request was rejected as off-topic');
                }
                if (error.cause.message.includes('consent')) {
                    throw new Error('User consent required for Copilot');
                }
                if (error.cause.message.includes('quota')) {
                    throw new Error('Copilot quota limit exceeded');
                }
            }

            throw new Error(`Copilot error: ${error.message}`);
        }
        throw error;
    }
}

// ============================================================================
// File Utilities
// ============================================================================

/**
 * Validate that a file path is a Dart file and exists
 */
export function validateDartFile(filePath: string): { valid: boolean; error?: string } {
    if (!filePath.endsWith('.dart')) {
        return { valid: false, error: 'Selected file is not a Dart file' };
    }

    if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File does not exist' };
    }

    return { valid: true };
}

/**
 * Get the file path from a URI or active editor
 */
export function getFilePath(uri?: vscode.Uri): string | undefined {
    if (uri) {
        return uri.fsPath;
    }
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }
    
    return editor.document.uri.fsPath;
}

/**
 * Show analysis result in a new document
 */
export async function showAnalysisResult(analysis: string): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({
        content: `# Workspace Analysis\n\n${analysis}`,
        language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
}

// ============================================================================
// Shared Config Types & Functions (used by dsNotes-handler and unifiedNotepad-handler)
// ============================================================================

export interface SendToChatConfig {
    templates: { [key: string]: { prefix: string; suffix: string; showInMenu?: boolean } };
    promptExpander: {
        profiles: { [key: string]: {
            label: string;
            systemPrompt?: string | null;
            resultTemplate?: string | null;
            temperature?: number | null;
            modelConfig?: string | null;
            toolsEnabled?: boolean;
            stripThinkingTags?: boolean | null;
            isDefault?: boolean;
        } };
    };
    botConversation: {
        profiles: { [key: string]: {
            label: string;
            description?: string;
            goal?: string;
            maxTurns?: number;
            initialPromptTemplate?: string | null;
            followUpTemplate?: string | null;
            temperature?: number | null;
        } };
    };
    tomAiChat?: {
        defaultTemplate?: string;
        templates?: { [key: string]: {
            label: string;
            description?: string;
            contextInstructions?: string;
            systemPromptOverride?: string | null;
        } };
    };
    copilotAnswerPath?: string;  // Path for extracting Copilot answers, relative to workspace root
}

export function loadSendToChatConfig(): SendToChatConfig | null {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

export function saveSendToChatConfig(config: SendToChatConfig): boolean {
    const configPath = getConfigPath();
    if (!configPath) {
        return false;
    }
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch {
        return false;
    }
}

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================================
// Template Editor Panel
// ============================================================================

export interface TemplateEditorField {
    name: string;
    label: string;
    type: 'text' | 'textarea';
    placeholder?: string;
    value?: string;
    help?: string;
    readonly?: boolean;
}

export interface TemplateEditorConfig {
    type: 'copilot' | 'conversation' | 'tomAiChat' | 'localLlm';
    title: string;
    fields: TemplateEditorField[];
}

let templateEditorPanel: vscode.WebviewPanel | undefined;

export async function showTemplateEditorPanel(
    config: TemplateEditorConfig,
    onSave: (values: { [key: string]: string }) => Promise<void>
): Promise<void> {
    if (templateEditorPanel) {
        templateEditorPanel.dispose();
    }

    templateEditorPanel = vscode.window.createWebviewPanel(
        'dsNotesTemplateEditor',
        `${config.title}`,
        vscode.ViewColumn.Active,
        { enableScripts: true }
    );

    const fieldsHtml = config.fields.map(f => {
        const readonlyAttr = f.readonly ? 'readonly disabled style="opacity: 0.7; cursor: not-allowed;"' : '';
        const inputHtml = f.type === 'textarea'
            ? `<textarea id="${f.name}" placeholder="${escapeHtml(f.placeholder || '')}" rows="6" ${readonlyAttr}>${escapeHtml(f.value || '')}</textarea>`
            : `<input type="text" id="${f.name}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value || '')}" ${readonlyAttr}>`;
        const helpHtml = f.help ? `<div class="help">${f.help}</div>` : '';
        return `<div class="field">
            <label for="${f.name}">${f.label}</label>
            ${inputHtml}
            ${helpHtml}
        </div>`;
    }).join('');

    templateEditorPanel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        padding: 24px;
        height: 100vh;
        display: flex;
        flex-direction: column;
        font-family: var(--vscode-font-family);
        background-color: var(--vscode-editor-background);
        color: var(--vscode-foreground);
    }
    h2 { margin-bottom: 20px; }
    .fields { flex: 1; overflow-y: auto; }
    .field { margin-bottom: 20px; }
    .field label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
    }
    .field input, .field textarea {
        width: 100%;
        border: 1px solid var(--vscode-input-border);
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        padding: 8px 12px;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: var(--vscode-editor-font-size, 13px);
        border-radius: 4px;
    }
    .field textarea { min-height: 100px; resize: vertical; line-height: 1.5; }
    .field input:focus, .field textarea:focus { border-color: var(--vscode-focusBorder); outline: none; }
    .help {
        margin-top: 8px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        background: var(--vscode-textBlockQuote-background);
        padding: 10px;
        border-radius: 4px;
        line-height: 1.5;
    }
    .help code {
        background: var(--vscode-textCodeBlock-background);
        padding: 2px 5px;
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family, monospace);
    }
    .buttons {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        justify-content: flex-end;
        flex-shrink: 0;
    }
    button {
        padding: 8px 20px;
        border: 1px solid var(--vscode-input-border);
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        cursor: pointer;
        border-radius: 4px;
        font-size: 13px;
    }
    button:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
    button.primary {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
    }
    button.primary:hover { background-color: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
    <h2>${escapeHtml(config.title)}</h2>
    <div class="fields">
        ${fieldsHtml}
    </div>
    <div class="buttons">
        <button onclick="cancel()">Cancel</button>
        <button class="primary" onclick="save()">Save</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const fieldNames = ${JSON.stringify(config.fields.map(f => f.name))};

        function cancel() { vscode.postMessage({ type: 'cancel' }); }

        function save() {
            const values = {};
            fieldNames.forEach(name => {
                const el = document.getElementById(name);
                values[name] = el ? el.value : '';
            });
            vscode.postMessage({ type: 'save', values });
        }
    </script>
</body></html>`;

    templateEditorPanel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === 'cancel') {
            templateEditorPanel?.dispose();
        } else if (msg.type === 'save') {
            await onSave(msg.values);
            templateEditorPanel?.dispose();
        }
    });

    templateEditorPanel.onDidDispose(() => {
        templateEditorPanel = undefined;
    });
}

// ============================================================================
// Placeholder Expansion
// ============================================================================

/**
 * Expand placeholders like {{selection}}, {{file}}, {{clipboard}} in a template string
 */
export async function expandPlaceholders(template: string): Promise<string> {
    let result = template;
    const editor = vscode.window.activeTextEditor;
    
    // {{selection}} - Current editor selection
    if (editor) {
        const selection = editor.document.getText(editor.selection);
        result = result.replace(/\{\{selection\}\}/gi, selection || '(no selection)');
    } else {
        result = result.replace(/\{\{selection\}\}/gi, '(no editor)');
    }
    
    // {{file}} - Current file path (relative)
    if (editor) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const relativePath = workspaceFolder 
            ? path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath)
            : editor.document.uri.fsPath;
        result = result.replace(/\{\{file\}\}/gi, relativePath);
    } else {
        result = result.replace(/\{\{file\}\}/gi, '(no file)');
    }
    
    // {{filename}} - Current file name only
    if (editor) {
        result = result.replace(/\{\{filename\}\}/gi, path.basename(editor.document.uri.fsPath));
    } else {
        result = result.replace(/\{\{filename\}\}/gi, '(no file)');
    }
    
    // {{filecontent}} - Current file content
    if (editor) {
        result = result.replace(/\{\{filecontent\}\}/gi, editor.document.getText());
    } else {
        result = result.replace(/\{\{filecontent\}\}/gi, '(no file)');
    }
    
    // {{date}}, {{time}}, {{datetime}}
    const now = new Date();
    result = result.replace(/\{\{date\}\}/gi, now.toLocaleDateString());
    result = result.replace(/\{\{time\}\}/gi, now.toLocaleTimeString());
    result = result.replace(/\{\{datetime\}\}/gi, now.toLocaleString());
    
    // {{clipboard}}
    try {
        const clipboard = await vscode.env.clipboard.readText();
        result = result.replace(/\{\{clipboard\}\}/gi, clipboard || '(empty clipboard)');
    } catch {
        result = result.replace(/\{\{clipboard\}\}/gi, '(clipboard error)');
    }
    
    // {{workspace}}, {{workspacepath}}
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    result = result.replace(/\{\{workspace\}\}/gi, workspaceFolder?.name || '(no workspace)');
    result = result.replace(/\{\{workspacepath\}\}/gi, workspaceFolder?.uri.fsPath || '(no workspace)');
    
    // {{language}}
    if (editor) {
        result = result.replace(/\{\{language\}\}/gi, editor.document.languageId);
    } else {
        result = result.replace(/\{\{language\}\}/gi, '(no file)');
    }
    
    // {{line}}, {{column}}
    if (editor) {
        result = result.replace(/\{\{line\}\}/gi, String(editor.selection.active.line + 1));
        result = result.replace(/\{\{column\}\}/gi, String(editor.selection.active.character + 1));
    } else {
        result = result.replace(/\{\{line\}\}/gi, '(no editor)');
        result = result.replace(/\{\{column\}\}/gi, '(no editor)');
    }
    
    return result;
}

// ============================================================================
// Preview Panel
// ============================================================================

let previewPanel: vscode.WebviewPanel | undefined;

/**
 * Show a preview panel with expanded content and optional send button
 */
export async function showPreviewPanel(title: string, content: string, onSend?: (text: string) => Promise<void>): Promise<void> {
    if (previewPanel) {
        previewPanel.dispose();
    }
    
    previewPanel = vscode.window.createWebviewPanel(
        'dartscriptPreview',
        `Preview: ${title}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
    );
    
    const escapedContent = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    previewPanel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; margin: 0; }
pre { white-space: pre-wrap; word-wrap: break-word; background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 4px; font-family: var(--vscode-editor-font-family); font-size: 13px; overflow: auto; max-height: calc(100vh - 100px); }
.buttons { margin-top: 16px; display: flex; gap: 8px; }
button { padding: 6px 14px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; cursor: pointer; font-size: 13px; }
button:hover { background: var(--vscode-button-hoverBackground); }
button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
</style>
</head><body>
<pre>${escapedContent}</pre>
<div class="buttons">
    <button class="secondary" onclick="copyToClipboard()">Copy to Clipboard</button>
    ${onSend ? '<button onclick="send()">Send</button>' : ''}
</div>
<script>
const vscode = acquireVsCodeApi();
function copyToClipboard() { vscode.postMessage({ type: 'copy' }); }
function send() { vscode.postMessage({ type: 'send' }); }
</script>
</body></html>`;

    previewPanel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === 'copy') {
            await vscode.env.clipboard.writeText(content);
            vscode.window.showInformationMessage('Copied to clipboard');
        } else if (msg.type === 'send' && onSend) {
            await onSend(content);
            previewPanel?.dispose();
        }
    });

    previewPanel.onDidDispose(() => {
        previewPanel = undefined;
    });
}

/** Placeholder help text for template editors */
export const PLACEHOLDER_HELP = `<strong>Available Placeholders:</strong><br>
<code>{{selection}}</code> - Current text selection<br>
<code>{{file}}</code> - Current file path (relative)<br>
<code>{{filename}}</code> - Current file name<br>
<code>{{filecontent}}</code> - Full file content<br>
<code>{{clipboard}}</code> - Clipboard contents<br>
<code>{{date}}</code> / <code>{{time}}</code> / <code>{{datetime}}</code> - Current date/time<br>
<code>{{workspace}}</code> - Workspace name<br>
<code>{{language}}</code> - File language ID<br>
<code>{{line}}</code> - Current line number`;
