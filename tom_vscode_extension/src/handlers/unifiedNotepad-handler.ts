/**
 * Unified Notepad Panel (T2)
 * 
 * A single webview containing multiple notepad sections with custom tab behavior:
 * - Accordion: opening one section collapses unpinned others
 * - Pin: pinned sections stay open regardless of accordion
 * - Rotate: collapsed sections show as vertical tabs
 * 
 * Sections:
 * - Local LLM
 * - AI Conversation  
 * - Copilot
 * - Tom AI Chat
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getConfigPath, SendToChatConfig, loadSendToChatConfig, saveSendToChatConfig, showTemplateEditorPanel, PLACEHOLDER_HELP, expandPlaceholders, showPreviewPanel, getWorkspaceRoot, updateChatResponseValues } from './handler_shared';
import { getPromptExpanderManager } from './expandPrompt-handler';
import { getAccordionStyles } from './accordionPanel';

// ============================================================================
// Answer File Utilities (for Copilot answer file feature)
// ============================================================================

/** Get a short window identifier: first 8 chars of sessionId + first 8 of machineId. */
function getWindowId(): string {
    const session = vscode.env.sessionId.substring(0, 8);
    const machine = vscode.env.machineId.substring(0, 8);
    return `${session}_${machine}`;
}

/** Get the answer file path for the current window. */
function getAnswerFilePath(): string {
    const homeDir = os.homedir();
    const folder = path.join(homeDir, '.tom', 'copilot-chat-answers');
    return path.join(folder, `${getWindowId()}_answer.json`);
}

/** Generate a short timestamp ID for request identification. */
function generateRequestId(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

/** Check if answer file exists. */
function answerFileExists(): boolean {
    return fs.existsSync(getAnswerFilePath());
}

/** Delete the answer file. */
function deleteAnswerFile(): void {
    const filePath = getAnswerFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

/** Read and parse the answer file. Returns undefined if not found/invalid. */
function readAnswerFile(): { requestId: string; generatedMarkdown: string; comments?: string; references?: string[]; requestedAttachments?: string[]; responseValues?: Record<string, string> } | undefined {
    const filePath = getAnswerFilePath();
    if (!fs.existsSync(filePath)) return undefined;
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return undefined;
    }
}

/** Get the copilot answers markdown file path. */
function getCopilotAnswersMdPath(): string {
    const config = loadSendToChatConfig();
    const wsRoot = getWorkspaceRoot();
    const basePath = config?.copilotAnswerPath || '_ai/copilot';
    const fullBase = wsRoot ? path.join(wsRoot, basePath) : path.join(os.homedir(), '.tom', 'copilot-answers');
    return path.join(fullBase, getWindowId(), 'copilot-answer.md');
}

/** Get the copilot prompts markdown file path. */
function getCopilotPromptsPath(): string {
    const config = loadSendToChatConfig();
    const wsRoot = getWorkspaceRoot();
    const basePath = config?.copilotAnswerPath || '_ai/copilot';
    const fullBase = wsRoot ? path.join(wsRoot, basePath) : path.join(os.homedir(), '.tom', 'copilot-prompts');
    return path.join(fullBase, getWindowId(), 'copilot-prompts.md');
}

/** Log a prompt to the copilot-prompts.md file (prepended at top). */
function logCopilotPrompt(prompt: string, template: string): void {
    const promptsPath = getCopilotPromptsPath();
    const dir = path.dirname(promptsPath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Format the entry
    const timestamp = new Date().toISOString();
    const templateLabel = template || '(none)';
    const entry = `## ${timestamp}\n\n**Template:** ${templateLabel}\n\n${prompt}\n\n---\n\n`;
    
    // Read existing file or create new
    let existingContent = '';
    if (fs.existsSync(promptsPath)) {
        existingContent = fs.readFileSync(promptsPath, 'utf-8');
    }
    
    // Prepend to file (after header if exists)
    let newContent: string;
    if (existingContent.startsWith('# ')) {
        // Find end of first line (header)
        const headerEnd = existingContent.indexOf('\n');
        if (headerEnd > 0) {
            newContent = existingContent.substring(0, headerEnd + 1) + '\n' + entry + existingContent.substring(headerEnd + 1);
        } else {
            newContent = existingContent + '\n\n' + entry;
        }
    } else if (existingContent.trim()) {
        newContent = entry + existingContent;
    } else {
        newContent = '# Copilot Prompts\n\n' + entry;
    }
    
    fs.writeFileSync(promptsPath, newContent, 'utf-8');
}

/** Get the default answer file template suffix. */
function getDefaultAnswerFileSuffix(): string {
    const answerFileName = `${getWindowId()}_answer.json`;
    
    return `\n\n---\nIMPORTANT: When you have completed your response, write your answer to the file:\n~/.tom/copilot-chat-answers/${answerFileName}\n\nThe file must be valid JSON with this structure:\n{\n  "requestId": "{{requestId}}",\n  "generatedMarkdown": "<your response as a JSON-escaped string>",\n  "comments": "<optional comments>",\n  "references": ["<optional array of file paths that are relevant context for the response>"],\n  "requestedAttachments": ["<optional array of file paths the user explicitly requested>"],\n  "responseValues": {\n    "<key>": "<value>",\n    "<another_key>": "<another_value>"\n  }\n}\n\nField descriptions:\n- generatedMarkdown: Your main response text (required)\n- comments: Any additional notes or metadata (optional)\n- references: Files you referenced while forming your response (optional, include workspace-relative paths)\n- requestedAttachments: Files the user explicitly asked you to provide/attach (optional, include workspace-relative paths)\n- responseValues: Key-value pairs for data that should be available in subsequent prompts via \\\${dartscript.chat.<key>} (optional)\n\nRequest ID: {{requestId}}\n`;
}

/** Apply the answer file template to a prompt. */
function applyAnswerFileTemplate(text: string): string {
    const config = loadSendToChatConfig();
    const tpl = config?.templates?.['__answer_file__'];
    const prefix = tpl?.prefix || '';
    const suffix = tpl?.suffix || getDefaultAnswerFileSuffix();
    
    return prefix + (prefix ? '\n' : '') + text + (suffix ? '\n' : '') + suffix;
}

const VIEW_ID = 'dartscript.unifiedNotepad';

interface Section {
    id: string;
    label: string;
    icon: string;
    content: string;
}

class UnifiedNotepadViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;
    private _answerFileWatcher?: fs.FSWatcher;
    private _autoHideDelay: number = 0; // 0 = keep open, otherwise ms
    private _keepContentAfterSend: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._autoHideDelay = context.workspaceState.get('copilotAutoHideDelay', 0);
        this._keepContentAfterSend = context.workspaceState.get('copilotKeepContent', false);
        this._setupAnswerFileWatcher();
    }

    private _setupAnswerFileWatcher(): void {
        const answerDir = path.dirname(getAnswerFilePath());
        // Ensure directory exists
        if (!fs.existsSync(answerDir)) {
            fs.mkdirSync(answerDir, { recursive: true });
        }
        
        // Watch the directory for changes
        this._answerFileWatcher = fs.watch(answerDir, (eventType, filename) => {
            if (filename === path.basename(getAnswerFilePath())) {
                this._notifyAnswerFileStatus();
            }
        });
    }

    private _notifyAnswerFileStatus(): void {
        const exists = answerFileExists();
        const answer = exists ? readAnswerFile() : undefined;
        
        // Propagate responseValues to shared store for ${dartscript.chat.KEY} access
        if (answer?.responseValues && typeof answer.responseValues === 'object') {
            updateChatResponseValues(answer.responseValues);
        }
        
        this._view?.webview.postMessage({
            type: 'answerFileStatus',
            exists,
            hasAnswer: !!answer?.generatedMarkdown
        });
    }

    public dispose(): void {
        if (this._answerFileWatcher) {
            this._answerFileWatcher.close();
        }
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')
            ]
        };

        const codiconsUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
        );

        webviewView.webview.html = this._getHtmlContent(codiconsUri.toString());

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'togglePin':
                        // Pin state is handled client-side via localStorage
                        break;
                    case 'sendLocalLlm':
                        await this._handleSendLocalLlm(message.text, message.profile);
                        break;
                    case 'sendConversation':
                        await this._handleSendConversation(message.text, message.profile);
                        break;
                    case 'sendCopilot':
                        await this._handleSendCopilot(message.text, message.template);
                        break;
                    case 'sendTomAiChat':
                        await this._handleSendTomAiChat(message.text, message.template);
                        break;
                    case 'getProfiles':
                        this._sendProfiles();
                        break;
                    case 'showMessage':
                        vscode.window.showInformationMessage(message.message);
                        break;
                    case 'addProfile':
                        await this._handleAddProfile(message.section);
                        break;
                    case 'editProfile':
                        await this._handleEditProfile(message.section, message.name);
                        break;
                    case 'deleteProfile':
                        await this._handleDeleteProfile(message.section, message.name);
                        break;
                    case 'addTemplate':
                        await this._handleAddTemplate(message.section);
                        break;
                    case 'editTemplate':
                        await this._handleEditTemplate(message.section, message.name);
                        break;
                    case 'deleteTemplate':
                        await this._handleDeleteTemplate(message.section, message.name);
                        break;
                    case 'openChatFile':
                        await this._handleOpenChatFile();
                        break;
                    case 'insertToChatFile':
                        await this._handleInsertToChatFile(message.text, message.template);
                        break;
                    case 'preview':
                        await this._handlePreview(message.section, message.text, message.profile || message.template);
                        break;
                    case 'showTrail':
                        await this._showTrail();
                        break;
                    // Guidelines handlers
                    case 'getGuidelinesFiles':
                        this._sendGuidelinesFiles();
                        break;
                    case 'loadGuidelinesFile':
                        this._loadGuidelinesFile(message.file);
                        break;
                    case 'saveGuidelinesFile':
                        this._saveGuidelinesFile(message.file, message.content);
                        break;
                    case 'addGuidelinesFile':
                        await this._addGuidelinesFile();
                        break;
                    case 'deleteGuidelinesFile':
                        await this._deleteGuidelinesFile(message.file);
                        break;
                    case 'openGuidelinesInEditor':
                        await this._openGuidelinesInEditor(message.file);
                        break;
                    // Notes handlers
                    case 'getNotesFiles':
                        this._sendNotesFiles();
                        break;
                    case 'loadNotesFile':
                        this._loadNotesFile(message.file);
                        break;
                    case 'saveNotesFile':
                        this._saveNotesFile(message.file, message.content);
                        break;
                    case 'addNotesFile':
                        await this._addNotesFile();
                        break;
                    case 'deleteNotesFile':
                        await this._deleteNotesFile(message.file);
                        break;
                    case 'openNotesInEditor':
                        await this._openNotesInEditor(message.file);
                        break;
                    // Copilot answer file handlers
                    case 'setAutoHideDelay':
                        this._autoHideDelay = message.value;
                        this._context.workspaceState.update('copilotAutoHideDelay', message.value);
                        break;
                    case 'getAutoHideDelay':
                        this._view?.webview.postMessage({ type: 'autoHideDelay', value: this._autoHideDelay });
                        break;
                    case 'checkAnswerFile':
                        this._notifyAnswerFileStatus();
                        break;
                    case 'showAnswerViewer':
                        await this._showAnswerViewer();
                        break;
                    case 'extractAnswer':
                        await this._extractAnswerToMd();
                        break;
                    case 'setKeepContent':
                        this._keepContentAfterSend = message.value;
                        this._context.workspaceState.update('copilotKeepContent', message.value);
                        break;
                    case 'getKeepContent':
                        this._view?.webview.postMessage({ type: 'keepContent', value: this._keepContentAfterSend });
                        break;
                    case 'openPromptsFile':
                        await this._openPromptsFile();
                        break;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }

    private _sendProfiles(): void {
        const config = loadSendToChatConfig();
        this._view?.webview.postMessage({
            type: 'profiles',
            localLlm: config?.promptExpander?.profiles ? Object.keys(config.promptExpander.profiles) : [],
            conversation: config?.botConversation?.profiles ? Object.keys(config.botConversation.profiles) : [],
            copilot: config?.templates ? Object.keys(config.templates) : [],
            tomAiChat: config?.tomAiChat?.templates ? Object.keys(config.tomAiChat.templates) : [],
        });
    }

    private async _handleSendLocalLlm(text: string, profile: string): Promise<void> {
        const manager = getPromptExpanderManager();
        if (!manager) {
            vscode.window.showErrorMessage('Local LLM not available - extension not fully initialized');
            return;
        }
        
        const expanded = await expandPlaceholders(text);
        const profileKey = profile === '__none__' ? null : profile;
        const profileLabel = profile === '__none__' ? 'None' : profile;
        
        // Resolve model name for status messages
        const modelName = manager.getResolvedModelName();
        
        try {
            // Check if model needs loading
            const modelLoaded = await manager.checkModelLoaded();
            
            const result = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: modelLoaded ? `Sending to local ${modelName}...` : `Loading ${modelName}...`,
                    cancellable: true,
                },
                async (progress, token) => {
                    if (!modelLoaded) {
                        // Model is loading as part of generate — update status once process starts
                        // The loading happens at the start of the Ollama call
                        const checkInterval = setInterval(async () => {
                            const loaded = await manager.checkModelLoaded();
                            if (loaded) {
                                progress.report({ message: `Processing prompt with ${modelName}...` });
                                clearInterval(checkInterval);
                            }
                        }, 2000);
                        token.onCancellationRequested(() => clearInterval(checkInterval));
                    } else {
                        // Model already loaded, go straight to processing
                        progress.report({ message: `Processing prompt with ${modelName}...` });
                    }
                    return manager.process(expanded, profileKey, null, undefined, token);
                }
            );
            
            if (result.success) {
                await this._appendToTrail(expanded, result.result, profileLabel);
                await this._showTrail();
            } else {
                vscode.window.showErrorMessage(`Local LLM error: ${result.error || 'Unknown error'}`);
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Local LLM failed: ${e}`);
        }
    }

    private async _handleSendConversation(text: string, profile: string): Promise<void> {
        const expanded = await expandPlaceholders(text);
        const profileKey = profile === '__none__' ? null : profile;
        
        try {
            await vscode.commands.executeCommand('dartscript.startBotConversation', {
                goal: expanded,
                profileKey
            });
        } catch {
            vscode.window.showInformationMessage(`Start conversation (profile: ${profileKey || 'None'}): ${expanded.substring(0, 50)}...`);
        }
    }

    private async _handleSendCopilot(text: string, template: string): Promise<void> {
        const config = loadSendToChatConfig();
        const isAnswerFileTemplate = template === '__answer_file__';
        
        // Always log the prompt (before expansion)
        logCopilotPrompt(text, template);
        
        let expanded: string;
        if (isAnswerFileTemplate) {
            // Delete existing answer file before sending
            deleteAnswerFile();
            this._notifyAnswerFileStatus();
            // Apply answer file template
            expanded = await expandPlaceholders(applyAnswerFileTemplate(text));
        } else {
            const templateObj = template && template !== '__none__' ? config?.templates?.[template] : null;
            const prefix = templateObj?.prefix || '';
            const suffix = templateObj?.suffix || '';
            const full = prefix + (prefix ? '\n' : '') + text + (suffix ? '\n' : '') + suffix;
            expanded = await expandPlaceholders(full);
        }
        
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: expanded });
        
        // Clear the textarea if keepContent is false
        if (!this._keepContentAfterSend) {
            this._view?.webview.postMessage({ type: 'clearCopilotText' });
        }
        
        // Apply auto-hide if configured
        if (this._autoHideDelay > 0) {
            setTimeout(() => {
                vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
            }, this._autoHideDelay);
        }
    }

    private async _handleSendTomAiChat(text: string, template: string): Promise<void> {
        const config = loadSendToChatConfig();
        const templateObj = template && template !== '__none__' ? config?.tomAiChat?.templates?.[template] : null;
        let content = text;
        if (templateObj?.contextInstructions) {
            content = templateObj.contextInstructions + '\n\n' + content;
        }
        const expanded = await expandPlaceholders(content);
        await this._insertExpandedToChatFile(expanded);
    }

    private async _insertExpandedToChatFile(expanded: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.chat.md')) {
            vscode.window.showWarningMessage('Please open a .chat.md file first');
            return;
        }

        const doc = editor.document;
        const text = doc.getText();
        const chatHeaderMatch = text.match(/_{3,}\s*CHAT\s+\w+\s*_{3,}/);
        
        if (chatHeaderMatch) {
            const headerIndex = text.indexOf(chatHeaderMatch[0]);
            const headerEnd = headerIndex + chatHeaderMatch[0].length;
            const position = doc.positionAt(headerEnd);
            
            await editor.edit(editBuilder => {
                editBuilder.insert(position, '\n\n' + expanded);
            });
        } else {
            await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, expanded);
            });
        }
    }

    private _getTrailFilePath(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return null; }
        return path.join(workspaceFolder.uri.fsPath, '_ai', 'local', 'chat_trail.md');
    }

    private async _appendToTrail(prompt: string, response: string, profile: string): Promise<void> {
        const trailPath = this._getTrailFilePath();
        if (!trailPath) {
            vscode.window.showWarningMessage('No workspace folder - cannot save to trail file');
            return;
        }
        
        const dir = path.dirname(trailPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString();
        const entry = `\n---\n\n## ${timestamp} (${profile})\n\n### Prompt\n\n${prompt}\n\n### Response\n\n${response}\n`;
        
        fs.appendFileSync(trailPath, entry, 'utf-8');
    }

    private async _showTrail(): Promise<void> {
        const trailPath = this._getTrailFilePath();
        if (!trailPath) {
            vscode.window.showWarningMessage('No workspace folder');
            return;
        }
        
        if (!fs.existsSync(trailPath)) {
            const dir = path.dirname(trailPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(trailPath, '# Local LLM Chat Trail\n\nConversation history with local LLM.\n', 'utf-8');
        }
        
        const doc = await vscode.workspace.openTextDocument(trailPath);
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    // =========================================================================
    // Copilot Answer File Methods
    // =========================================================================

    private async _showAnswerViewer(): Promise<void> {
        const answer = readAnswerFile();
        
        const panel = vscode.window.createWebviewPanel(
            'copilotAnswerViewer',
            'Copilot Answer',
            vscode.ViewColumn.Active,
            { enableScripts: true }
        );
        
        const content = answer?.generatedMarkdown || 'No answer file found.';
        const requestId = answer?.requestId || 'N/A';
        const comments = answer?.comments || '';
        const references = answer?.references?.join(', ') || 'None';
        const responseValues = answer?.responseValues || {};
        const responseValuesHtml = Object.keys(responseValues).length > 0
            ? Object.entries(responseValues).map(([k, v]) => `<strong>${this._escapeHtml(k)}:</strong> ${this._escapeHtml(String(v))}`).join('<br>')
            : 'None';
        
        panel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
body { font-family: var(--vscode-font-family); padding: 16px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
.meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 16px; padding: 8px; background: var(--vscode-textBlockQuote-background); border-radius: 4px; }
.meta strong { color: var(--vscode-foreground); }
.content { white-space: pre-wrap; font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.5; }
h1 { font-size: 18px; margin-bottom: 16px; }
.response-values { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--vscode-editorWidget-border); }
</style></head>
<body>
<h1>Copilot Answer</h1>
<div class="meta">
<strong>Request ID:</strong> ${requestId}<br>
<strong>References:</strong> ${references}<br>
${comments ? `<strong>Comments:</strong> ${comments}<br>` : ''}
<div class="response-values"><strong>Response Values:</strong><br>${responseValuesHtml}</div>
</div>
<div class="content">${this._escapeHtml(content)}</div>
</body></html>`;
    }

    private async _extractAnswerToMd(): Promise<void> {
        const answer = readAnswerFile();
        if (!answer?.generatedMarkdown) {
            vscode.window.showWarningMessage('No answer to extract');
            return;
        }
        
        const mdPath = getCopilotAnswersMdPath();
        const dir = path.dirname(mdPath);
        
        // Ensure directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Create marker for this answer
        const marker = `<!-- answer-id: ${answer.requestId} -->`;
        
        // Read existing file or create new
        let existingContent = '';
        if (fs.existsSync(mdPath)) {
            existingContent = fs.readFileSync(mdPath, 'utf-8');
        }
        
        // Check if this answer is already in the file
        if (existingContent.includes(marker)) {
            // Just open the file
            const doc = await vscode.workspace.openTextDocument(mdPath);
            await vscode.window.showTextDocument(doc, { preview: false });
            return;
        }
        
        // Format the new entry
        const timestamp = new Date().toISOString();
        const entry = `${marker}\n## Answer ${timestamp}\n\n${answer.generatedMarkdown}\n\n---\n\n`;
        
        // Prepend to file (after header if exists)
        let newContent: string;
        if (existingContent.startsWith('# ')) {
            // Find end of first line (header)
            const headerEnd = existingContent.indexOf('\n');
            if (headerEnd > 0) {
                newContent = existingContent.substring(0, headerEnd + 1) + '\n' + entry + existingContent.substring(headerEnd + 1);
            } else {
                newContent = existingContent + '\n\n' + entry;
            }
        } else if (existingContent.trim()) {
            newContent = entry + existingContent;
        } else {
            newContent = '# Copilot Answers\n\n' + entry;
        }
        
        fs.writeFileSync(mdPath, newContent, 'utf-8');
        
        // Open the file
        const doc = await vscode.workspace.openTextDocument(mdPath);
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    private async _openPromptsFile(): Promise<void> {
        const promptsPath = getCopilotPromptsPath();
        const dir = path.dirname(promptsPath);
        
        // Ensure directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Create file if it doesn't exist
        if (!fs.existsSync(promptsPath)) {
            fs.writeFileSync(promptsPath, '# Copilot Prompts\n\n', 'utf-8');
        }
        
        // Open or focus the file
        const doc = await vscode.workspace.openTextDocument(promptsPath);
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private async _handlePreview(section: string, text: string, profileOrTemplate: string): Promise<void> {
        const config = loadSendToChatConfig();
        let title = section;
        let previewContent = text;
        let onSend: ((t: string) => Promise<void>) | undefined;
        
        switch (section) {
            case 'localLlm': {
                title = 'Local LLM';
                const profile = profileOrTemplate && profileOrTemplate !== '__none__' ? config?.promptExpander?.profiles?.[profileOrTemplate] : null;
                if (profile?.systemPrompt) {
                    previewContent = `=== SYSTEM PROMPT ===\n${profile.systemPrompt}\n\n=== USER PROMPT ===\n${text}`;
                }
                onSend = async (t) => await this._handleSendLocalLlm(t, profileOrTemplate);
                break;
            }
            case 'conversation': {
                title = 'AI Conversation';
                const profile = profileOrTemplate && profileOrTemplate !== '__none__' ? config?.botConversation?.profiles?.[profileOrTemplate] : null;
                if (profile?.initialPromptTemplate) {
                    previewContent = `=== INITIAL PROMPT TEMPLATE ===\n${profile.initialPromptTemplate.replace('${goal}', text)}\n\n=== GOAL ===\n${text}`;
                }
                onSend = async (t) => await this._handleSendConversation(t, profileOrTemplate);
                break;
            }
            case 'copilot': {
                title = 'Copilot';
                if (profileOrTemplate === '__answer_file__') {
                    // Use stored Answer File template or defaults
                    const tpl = config?.templates?.['__answer_file__'];
                    const prefix = tpl?.prefix || '';
                    const suffix = tpl?.suffix || getDefaultAnswerFileSuffix();
                    previewContent = prefix + (prefix ? '\n' : '') + text + (suffix ? '\n' : '') + suffix;
                } else {
                    const template = profileOrTemplate && profileOrTemplate !== '__none__' ? config?.templates?.[profileOrTemplate] : null;
                    const prefix = template?.prefix || '';
                    const suffix = template?.suffix || '';
                    if (prefix || suffix) {
                        previewContent = prefix + (prefix ? '\n' : '') + text + (suffix ? '\n' : '') + suffix;
                    }
                }
                onSend = async (t) => await this._handleSendCopilot(t, profileOrTemplate);
                break;
            }
            case 'tomAiChat': {
                title = 'Tom AI Chat';
                const template = profileOrTemplate && profileOrTemplate !== '__none__' ? config?.tomAiChat?.templates?.[profileOrTemplate] : null;
                if (template?.contextInstructions) {
                    previewContent = `=== CONTEXT INSTRUCTIONS ===\n${template.contextInstructions}\n\n=== YOUR INPUT ===\n${text}\n\n=== FULL PROMPT ===\n${template.contextInstructions}\n\n${text}`;
                }
                onSend = async (t) => await this._handleSendTomAiChat(t, profileOrTemplate);
                break;
            }
        }
        
        const expanded = await expandPlaceholders(previewContent);
        await showPreviewPanel(title, expanded, onSend);
    }

    // --- Profile CRUD (localLlm, conversation) ---

    private async _handleAddProfile(section: string): Promise<void> {
        if (section === 'localLlm') {
            await showTemplateEditorPanel({
                type: 'localLlm',
                title: 'New Local LLM Profile',
                fields: [
                    { name: 'name', label: 'Profile Key', type: 'text', placeholder: 'my_profile' },
                    { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Profile' },
                    { name: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful coding assistant...' },
                    { name: 'resultTemplate', label: 'Result Template', type: 'textarea', placeholder: '${response}', help: 'Use <code>${response}</code> for LLM output, <code>${original}</code> for original prompt.' },
                    { name: 'temperature', label: 'Temperature', type: 'text', placeholder: '0.4 (leave empty for global default)' },
                    { name: 'stripThinkingTags', label: 'Strip Thinking Tags', type: 'text', placeholder: 'true/false (leave empty for global default)' },
                    { name: 'toolsEnabled', label: 'Tools Enabled', type: 'text', placeholder: 'true/false', value: 'true' },
                    { name: 'isDefault', label: 'Is Default Profile', type: 'text', placeholder: 'true/false', value: 'false', help: PLACEHOLDER_HELP }
                ]
            }, async (values) => {
                if (!values.name) { vscode.window.showWarningMessage('Profile key is required'); return; }
                const config = loadSendToChatConfig();
                if (config) {
                    if (!config.promptExpander) { config.promptExpander = { profiles: {} }; }
                    config.promptExpander.profiles[values.name] = {
                        label: values.label || values.name,
                        systemPrompt: values.systemPrompt || null,
                        resultTemplate: values.resultTemplate || null,
                        temperature: values.temperature ? parseFloat(values.temperature) : null,
                        stripThinkingTags: values.stripThinkingTags === 'true' ? true : values.stripThinkingTags === 'false' ? false : null,
                        toolsEnabled: values.toolsEnabled !== 'false',
                        isDefault: values.isDefault === 'true'
                    };
                    if (saveSendToChatConfig(config)) {
                        this._sendProfiles();
                        vscode.window.showInformationMessage(`Profile "${values.label || values.name}" added`);
                    }
                }
            });
        } else if (section === 'conversation') {
            await showTemplateEditorPanel({
                type: 'conversation',
                title: 'New AI Conversation Profile',
                fields: [
                    { name: 'name', label: 'Profile Key', type: 'text', placeholder: 'my_conversation' },
                    { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Conversation' },
                    { name: 'description', label: 'Description', type: 'text', placeholder: 'What this conversation does...' },
                    { name: 'maxTurns', label: 'Max Turns', type: 'text', placeholder: '10' },
                    { name: 'temperature', label: 'Temperature', type: 'text', placeholder: '0.5 (leave empty for global default)' },
                    { name: 'initialPromptTemplate', label: 'Initial Prompt Template', type: 'textarea', placeholder: 'Goal: ${goal}\\n\\nPlease help me...' },
                    { name: 'followUpTemplate', label: 'Follow-Up Template', type: 'textarea', placeholder: 'Previous exchanges:\\n${history}\\n\\nGenerate next prompt...', help: `Use <code>\${goal}</code>, <code>\${turn}</code>, <code>\${maxTurns}</code>, <code>\${history}</code> placeholders.<br><br>${PLACEHOLDER_HELP}` }
                ]
            }, async (values) => {
                if (!values.name) { vscode.window.showWarningMessage('Profile key is required'); return; }
                const maxTurns = values.maxTurns ? parseInt(values.maxTurns, 10) : 10;
                const config = loadSendToChatConfig();
                if (config) {
                    if (!config.botConversation) { config.botConversation = { profiles: {} }; }
                    config.botConversation.profiles[values.name] = {
                        label: values.label || values.name,
                        description: values.description || '',
                        maxTurns,
                        temperature: values.temperature ? parseFloat(values.temperature) : undefined,
                        initialPromptTemplate: values.initialPromptTemplate || null,
                        followUpTemplate: values.followUpTemplate || null
                    };
                    if (saveSendToChatConfig(config)) {
                        this._sendProfiles();
                        vscode.window.showInformationMessage(`Profile "${values.label || values.name}" added`);
                    }
                }
            });
        }
    }

    private async _handleEditProfile(section: string, name?: string): Promise<void> {
        if (!name) { return; }
        const config = loadSendToChatConfig();
        if (!config) { return; }

        if (section === 'localLlm') {
            const fullProfile = config?.promptExpander?.profiles?.[name];
            if (!fullProfile) { return; }
            await showTemplateEditorPanel({
                type: 'localLlm',
                title: `Edit Local LLM Profile: ${fullProfile.label || name}`,
                fields: [
                    { name: 'name', label: 'Profile Key (read-only)', type: 'text', value: name, readonly: true },
                    { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Profile', value: fullProfile.label || '' },
                    { name: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful coding assistant...', value: fullProfile.systemPrompt || '' },
                    { name: 'resultTemplate', label: 'Result Template', type: 'textarea', placeholder: '${response}', value: fullProfile.resultTemplate || '', help: 'Use <code>${response}</code> for LLM output, <code>${original}</code> for original prompt.' },
                    { name: 'temperature', label: 'Temperature', type: 'text', placeholder: '0.4', value: fullProfile.temperature !== null && fullProfile.temperature !== undefined ? String(fullProfile.temperature) : '' },
                    { name: 'stripThinkingTags', label: 'Strip Thinking Tags', type: 'text', placeholder: 'true/false', value: fullProfile.stripThinkingTags !== null && fullProfile.stripThinkingTags !== undefined ? String(fullProfile.stripThinkingTags) : '' },
                    { name: 'toolsEnabled', label: 'Tools Enabled', type: 'text', placeholder: 'true/false', value: fullProfile.toolsEnabled !== null && fullProfile.toolsEnabled !== undefined ? String(fullProfile.toolsEnabled) : 'true' },
                    { name: 'isDefault', label: 'Is Default Profile', type: 'text', placeholder: 'true/false', value: fullProfile.isDefault ? 'true' : 'false', help: PLACEHOLDER_HELP }
                ]
            }, async (values) => {
                const cfg = loadSendToChatConfig();
                if (cfg) {
                    if (!cfg.promptExpander) { cfg.promptExpander = { profiles: {} }; }
                    cfg.promptExpander.profiles[name] = {
                        label: values.label || name,
                        systemPrompt: values.systemPrompt || null,
                        resultTemplate: values.resultTemplate || null,
                        temperature: values.temperature ? parseFloat(values.temperature) : null,
                        stripThinkingTags: values.stripThinkingTags === 'true' ? true : values.stripThinkingTags === 'false' ? false : null,
                        toolsEnabled: values.toolsEnabled !== 'false',
                        isDefault: values.isDefault === 'true'
                    };
                    if (saveSendToChatConfig(cfg)) {
                        this._sendProfiles();
                        vscode.window.showInformationMessage(`Profile "${values.label || name}" updated`);
                    }
                }
            });
        } else if (section === 'conversation') {
            const fullProfile = config?.botConversation?.profiles?.[name];
            if (!fullProfile) { return; }
            await showTemplateEditorPanel({
                type: 'conversation',
                title: `Edit AI Conversation Profile: ${fullProfile.label || name}`,
                fields: [
                    { name: 'name', label: 'Profile Key (read-only)', type: 'text', value: name, readonly: true },
                    { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Conversation', value: fullProfile.label || '' },
                    { name: 'description', label: 'Description', type: 'text', placeholder: 'What this conversation does...', value: fullProfile.description || '' },
                    { name: 'maxTurns', label: 'Max Turns', type: 'text', placeholder: '10', value: String(fullProfile.maxTurns || 10) },
                    { name: 'temperature', label: 'Temperature', type: 'text', placeholder: '0.5', value: fullProfile.temperature !== null && fullProfile.temperature !== undefined ? String(fullProfile.temperature) : '' },
                    { name: 'initialPromptTemplate', label: 'Initial Prompt Template', type: 'textarea', placeholder: 'Goal: ${goal}\\n\\nPlease help me...', value: fullProfile.initialPromptTemplate || '' },
                    { name: 'followUpTemplate', label: 'Follow-Up Template', type: 'textarea', placeholder: 'Previous exchanges:\\n${history}\\n\\nGenerate next prompt...', value: fullProfile.followUpTemplate || '', help: `Use <code>\${goal}</code>, <code>\${turn}</code>, <code>\${maxTurns}</code>, <code>\${history}</code> placeholders.<br><br>${PLACEHOLDER_HELP}` }
                ]
            }, async (values) => {
                const maxTurns = values.maxTurns ? parseInt(values.maxTurns, 10) : 10;
                const cfg = loadSendToChatConfig();
                if (cfg) {
                    if (!cfg.botConversation) { cfg.botConversation = { profiles: {} }; }
                    cfg.botConversation.profiles[name] = {
                        label: values.label || name,
                        description: values.description || '',
                        maxTurns,
                        temperature: values.temperature ? parseFloat(values.temperature) : undefined,
                        initialPromptTemplate: values.initialPromptTemplate || null,
                        followUpTemplate: values.followUpTemplate || null
                    };
                    if (saveSendToChatConfig(cfg)) {
                        this._sendProfiles();
                        vscode.window.showInformationMessage(`Profile "${values.label || name}" updated`);
                    }
                }
            });
        }
    }

    private async _handleDeleteProfile(section: string, name?: string): Promise<void> {
        if (!name) { return; }
        const confirm = await vscode.window.showWarningMessage(
            `Delete profile "${name}"?`, { modal: true }, 'Delete'
        );
        if (confirm !== 'Delete') { return; }

        const config = loadSendToChatConfig();
        if (!config) { return; }

        if (section === 'localLlm' && config.promptExpander?.profiles?.[name]) {
            delete config.promptExpander.profiles[name];
        } else if (section === 'conversation' && config.botConversation?.profiles?.[name]) {
            delete config.botConversation.profiles[name];
        } else { return; }

        if (saveSendToChatConfig(config)) {
            this._sendProfiles();
            vscode.window.showInformationMessage('Profile deleted');
        }
    }

    // --- Template CRUD (copilot, tomAiChat) ---

    private async _handleAddTemplate(section: string): Promise<void> {
        if (section === 'copilot') {
            await showTemplateEditorPanel({
                type: 'copilot',
                title: 'New Copilot Template',
                fields: [
                    { name: 'name', label: 'Template Name', type: 'text', placeholder: 'my_template' },
                    { name: 'prefix', label: 'Prefix (added before your prompt)', type: 'textarea', placeholder: 'Please help me with the following:\\n\\n' },
                    { name: 'suffix', label: 'Suffix (added after your prompt)', type: 'textarea', placeholder: '\\n\\nUse best practices.', help: PLACEHOLDER_HELP }
                ]
            }, async (values) => {
                if (!values.name) { vscode.window.showWarningMessage('Template name is required'); return; }
                const config = loadSendToChatConfig();
                if (config) {
                    config.templates[values.name] = { prefix: values.prefix || '', suffix: values.suffix || '', showInMenu: true };
                    if (saveSendToChatConfig(config)) {
                        this._sendProfiles();
                        vscode.window.showInformationMessage(`Template "${values.name}" added`);
                    }
                }
            });
        } else if (section === 'tomAiChat') {
            await showTemplateEditorPanel({
                type: 'tomAiChat',
                title: 'New Tom AI Chat Template',
                fields: [
                    { name: 'name', label: 'Template Key', type: 'text', placeholder: 'my_template' },
                    { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Template' },
                    { name: 'description', label: 'Description', type: 'text', placeholder: 'What this template is for...' },
                    { name: 'contextInstructions', label: 'Context Instructions (prepended to your prompt)', type: 'textarea', placeholder: 'Focus on implementation, testing, and documentation.\\n\\nPrioritize...', help: PLACEHOLDER_HELP }
                ]
            }, async (values) => {
                if (!values.name) { vscode.window.showWarningMessage('Template key is required'); return; }
                const config = loadSendToChatConfig();
                if (config) {
                    if (!config.tomAiChat) { config.tomAiChat = { templates: {} }; }
                    if (!config.tomAiChat.templates) { config.tomAiChat.templates = {}; }
                    config.tomAiChat.templates[values.name] = {
                        label: values.label || values.name,
                        description: values.description || '',
                        contextInstructions: values.contextInstructions || ''
                    };
                    if (saveSendToChatConfig(config)) {
                        this._sendProfiles();
                        vscode.window.showInformationMessage(`Template "${values.label || values.name}" added`);
                    }
                }
            });
        }
    }

    private async _handleEditTemplate(section: string, name?: string): Promise<void> {
        if (!name) { return; }
        const config = loadSendToChatConfig();
        if (!config) { return; }

        if (section === 'copilot') {
            // For Answer File template, use stored template or default
            const isAnswerFile = name === '__answer_file__';
            const tpl = isAnswerFile 
                ? (config.templates?.['__answer_file__'] || { prefix: '', suffix: getDefaultAnswerFileSuffix() })
                : config.templates?.[name];
            if (!tpl && !isAnswerFile) { return; }
            await showTemplateEditorPanel({
                type: 'copilot',
                title: isAnswerFile ? 'Edit Answer File Template' : `Edit Copilot Template: ${name}`,
                fields: [
                    ...(isAnswerFile ? [] : [{ name: 'name', label: 'Template Name', type: 'text' as const, placeholder: 'my_template', value: name }]),
                    { name: 'prefix', label: 'Prefix (added before your prompt)', type: 'textarea' as const, placeholder: 'Please help me with the following:\\n\\n', value: tpl?.prefix || '' },
                    { name: 'suffix', label: 'Suffix (added after your prompt)', type: 'textarea' as const, placeholder: '\\n\\nUse best practices.', value: tpl?.suffix || '', help: isAnswerFile ? PLACEHOLDER_HELP + '<br><br><em>Leave empty to reset to default Answer File suffix.</em>' : PLACEHOLDER_HELP }
                ]
            }, async (values) => {
                if (!isAnswerFile && !values.name) { vscode.window.showWarningMessage('Template name is required'); return; }
                const cfg = loadSendToChatConfig();
                if (cfg) {
                    const templateName = isAnswerFile ? '__answer_file__' : values.name;
                    if (!isAnswerFile && values.name !== name) { delete cfg.templates[name]; }
                    // For Answer File, if both prefix and suffix are empty, remove from config (use defaults)
                    if (isAnswerFile && !values.prefix?.trim() && !values.suffix?.trim()) {
                        delete cfg.templates['__answer_file__'];
                    } else {
                        cfg.templates[templateName] = { prefix: values.prefix || '', suffix: values.suffix || '', showInMenu: true };
                    }
                    if (saveSendToChatConfig(cfg)) {
                        this._sendProfiles();
                        vscode.window.showInformationMessage(isAnswerFile ? 'Answer File template updated' : `Template "${values.name}" updated`);
                    }
                }
            });
        } else if (section === 'tomAiChat') {
            const tpl = config.tomAiChat?.templates?.[name];
            if (!tpl) { return; }
            await showTemplateEditorPanel({
                type: 'tomAiChat',
                title: `Edit Tom AI Chat Template: ${tpl.label || name}`,
                fields: [
                    { name: 'name', label: 'Template Key', type: 'text', placeholder: 'my_template', value: name },
                    { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Template', value: tpl.label || '' },
                    { name: 'description', label: 'Description', type: 'text', placeholder: 'What this template is for...', value: tpl.description || '' },
                    { name: 'contextInstructions', label: 'Context Instructions (prepended to your prompt)', type: 'textarea', placeholder: 'Focus on implementation...', value: tpl.contextInstructions || '', help: PLACEHOLDER_HELP }
                ]
            }, async (values) => {
                if (!values.name) { vscode.window.showWarningMessage('Template key is required'); return; }
                const cfg = loadSendToChatConfig();
                if (cfg) {
                    if (!cfg.tomAiChat) { cfg.tomAiChat = { templates: {} }; }
                    if (!cfg.tomAiChat.templates) { cfg.tomAiChat.templates = {}; }
                    if (values.name !== name && cfg.tomAiChat.templates[name]) {
                        delete cfg.tomAiChat.templates[name];
                    }
                    cfg.tomAiChat.templates[values.name] = {
                        label: values.label || values.name,
                        description: values.description || '',
                        contextInstructions: values.contextInstructions || ''
                    };
                    if (saveSendToChatConfig(cfg)) {
                        this._sendProfiles();
                        vscode.window.showInformationMessage(`Template "${values.label || values.name}" updated`);
                    }
                }
            });
        }
    }

    private async _handleDeleteTemplate(section: string, name?: string): Promise<void> {
        if (!name) { return; }
        const confirm = await vscode.window.showWarningMessage(
            `Delete template "${name}"?`, { modal: true }, 'Delete'
        );
        if (confirm !== 'Delete') { return; }

        const config = loadSendToChatConfig();
        if (!config) { return; }

        if (section === 'copilot' && config.templates?.[name]) {
            delete config.templates[name];
        } else if (section === 'tomAiChat' && config.tomAiChat?.templates?.[name]) {
            delete config.tomAiChat.templates[name];
        } else { return; }

        if (saveSendToChatConfig(config)) {
            this._sendProfiles();
            vscode.window.showInformationMessage('Template deleted');
        }
    }

    // --- Tom AI Chat file operations ---

    private async _handleOpenChatFile(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const chatDir = path.join(workspaceFolder.uri.fsPath, '_ai', 'tom_ai_chat');
        if (!fs.existsSync(chatDir)) {
            fs.mkdirSync(chatDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const chatFile = path.join(chatDir, `chat_${timestamp}.chat.md`);

        if (!fs.existsSync(chatFile)) {
            const content = `toolInvocationToken:
modelId: claude-sonnet-4-20250514
tokenModelId: gpt-4.1-mini
preProcessingModelId: 
enablePromptOptimization: false
responsesTokenLimit: 16000
responseSummaryTokenLimit: 4000
maxIterations: 100
maxContextChars: 50000
maxToolResultChars: 50000
maxDraftChars: 8000
contextFilePath:

_________ CHAT chat_${timestamp} ____________

`;
            fs.writeFileSync(chatFile, content, 'utf-8');
        }

        const doc = await vscode.workspace.openTextDocument(chatFile);
        await vscode.window.showTextDocument(doc);
    }

    private async _handleInsertToChatFile(text: string, template: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor. Open a .chat.md file first.');
            return;
        }
        if (!editor.document.fileName.endsWith('.chat.md')) {
            vscode.window.showWarningMessage('Active file is not a .chat.md file.');
            return;
        }

        let expanded = text;
        // Prepend contextInstructions from template if available
        if (template) {
            const config = loadSendToChatConfig();
            const tpl = config?.tomAiChat?.templates?.[template];
            if (tpl?.contextInstructions) {
                expanded = tpl.contextInstructions + '\n\n' + expanded;
            }
        }

        // Look for the CHAT header to insert after
        const docText = editor.document.getText();
        const headerMatch = docText.match(/_{3,}\s*CHAT\s+\w+\s*_{3,}/);
        if (headerMatch && headerMatch.index !== undefined) {
            const headerEnd = headerMatch.index + headerMatch[0].length;
            const pos = editor.document.positionAt(headerEnd);
            await editor.edit(editBuilder => {
                editBuilder.insert(pos, '\n\n' + expanded);
            });
        } else {
            // Insert at cursor
            await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, expanded);
            });
        }
    }

    // --- Guidelines file operations ---

    private _getGuidelinesDir(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return null; }
        return path.join(workspaceFolder.uri.fsPath, '_copilot_guidelines');
    }

    private _sendGuidelinesFiles(): void {
        const dir = this._getGuidelinesDir();
        if (!dir || !fs.existsSync(dir)) {
            this._view?.webview.postMessage({ type: 'guidelinesFiles', files: [] });
            return;
        }
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
        this._view?.webview.postMessage({ type: 'guidelinesFiles', files });
    }

    private _loadGuidelinesFile(file: string): void {
        const dir = this._getGuidelinesDir();
        if (!dir) { return; }
        const filePath = path.join(dir, file);
        if (!fs.existsSync(filePath)) {
            this._view?.webview.postMessage({ type: 'guidelinesContent', content: '' });
            return;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        this._view?.webview.postMessage({ type: 'guidelinesContent', content });
    }

    private _saveGuidelinesFile(file: string, content: string): void {
        const dir = this._getGuidelinesDir();
        if (!dir) { return; }
        const filePath = path.join(dir, file);
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        fs.writeFileSync(filePath, content, 'utf-8');
    }

    private async _addGuidelinesFile(): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter filename (without .md extension)',
            placeHolder: 'my_guidelines'
        });
        if (!name) { return; }
        const dir = this._getGuidelinesDir();
        if (!dir) { return; }
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        const filename = name.endsWith('.md') ? name : name + '.md';
        const filePath = path.join(dir, filename);
        if (fs.existsSync(filePath)) {
            vscode.window.showWarningMessage(`File "${filename}" already exists`);
            return;
        }
        fs.writeFileSync(filePath, `# ${name}\n\n`, 'utf-8');
        this._view?.webview.postMessage({ type: 'guidelinesFiles', files: fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort(), selectedFile: filename });
        this._loadGuidelinesFile(filename);
    }

    private async _deleteGuidelinesFile(file: string): Promise<void> {
        const dir = this._getGuidelinesDir();
        if (!dir) { return; }
        const filePath = path.join(dir, file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            vscode.window.showInformationMessage(`Deleted "${file}"`);
            this._sendGuidelinesFiles();
        }
    }

    private async _openGuidelinesInEditor(file: string): Promise<void> {
        const dir = this._getGuidelinesDir();
        if (!dir) { return; }
        const filePath = path.join(dir, file);
        if (fs.existsSync(filePath)) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        }
    }

    // --- Notes file operations ---

    private _getNotesDir(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return null; }
        return path.join(workspaceFolder.uri.fsPath, '_ai', 'notes');
    }

    private _sendNotesFiles(): void {
        const dir = this._getNotesDir();
        if (!dir || !fs.existsSync(dir)) {
            this._view?.webview.postMessage({ type: 'notesFiles', files: [] });
            return;
        }
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
        this._view?.webview.postMessage({ type: 'notesFiles', files });
    }

    private _loadNotesFile(file: string): void {
        const dir = this._getNotesDir();
        if (!dir) { return; }
        const filePath = path.join(dir, file);
        if (!fs.existsSync(filePath)) {
            this._view?.webview.postMessage({ type: 'notesContent', content: '' });
            return;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        this._view?.webview.postMessage({ type: 'notesContent', content });
    }

    private _saveNotesFile(file: string, content: string): void {
        const dir = this._getNotesDir();
        if (!dir) { return; }
        const filePath = path.join(dir, file);
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        fs.writeFileSync(filePath, content, 'utf-8');
    }

    private async _addNotesFile(): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter note filename (without .md extension)',
            placeHolder: 'my_note'
        });
        if (!name) { return; }
        const dir = this._getNotesDir();
        if (!dir) { return; }
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        const filename = name.endsWith('.md') ? name : name + '.md';
        const filePath = path.join(dir, filename);
        if (fs.existsSync(filePath)) {
            vscode.window.showWarningMessage(`Note "${filename}" already exists`);
            return;
        }
        fs.writeFileSync(filePath, `# ${name}\n\n`, 'utf-8');
        this._view?.webview.postMessage({ type: 'notesFiles', files: fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort(), selectedFile: filename });
        this._loadNotesFile(filename);
    }

    private async _deleteNotesFile(file: string): Promise<void> {
        const dir = this._getNotesDir();
        if (!dir) { return; }
        const filePath = path.join(dir, file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            vscode.window.showInformationMessage(`Deleted "${file}"`);
            this._sendNotesFiles();
        }
    }

    private async _openNotesInEditor(file: string): Promise<void> {
        const dir = this._getNotesDir();
        if (!dir) { return; }
        const filePath = path.join(dir, file);
        if (fs.existsSync(filePath)) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        }
    }

    private _getHtmlContent(codiconsUri: string): string {
        const css = this._getStyles();
        const script = this._getScript();
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="${codiconsUri}" rel="stylesheet" />
<style>${css}</style></head>
<body>
<div class="accordion-container" id="container">Loading T2...</div>
<script>${script}</script>
</body></html>`;
    }

    private _getStyles(): string {
        // Use base accordion styles from shared component
        const baseStyles = getAccordionStyles();
        
        // Add custom styles specific to unified notepad
        const customStyles = `
.profile-info { font-size: 11px; color: var(--vscode-descriptionForeground); padding: 4px 8px; background: var(--vscode-textBlockQuote-background); border-radius: 4px; margin-top: 4px; max-height: 60px; overflow-y: auto; }
.placeholder-help { font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.4; }
.placeholder-help code { background: var(--vscode-textCodeBlock-background); padding: 1px 3px; border-radius: 2px; }
.toolbar-spacer { flex: 1; min-width: 16px; }
.answers-toolbar { background: rgba(200, 170, 0, 0.15); border: 1px solid rgba(200, 170, 0, 0.4); border-radius: 4px; padding: 4px 8px !important; }
.answer-indicator { font-size: 12px; font-weight: 600; color: var(--vscode-editorWarning-foreground, #cca700); margin-right: 8px; }
.checkbox-label { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; }
.checkbox-label input[type="checkbox"] { margin: 0; cursor: pointer; }
`;
        return baseStyles + customStyles;
    }

    private _getScript(): string {
        return `
var vscode = acquireVsCodeApi();
var sectionsConfig = [
    { id: 'guidelines', icon: '<span class="codicon codicon-book"></span>', title: 'Guidelines' },
    { id: 'notes', icon: '<span class="codicon codicon-note"></span>', title: 'Notes' },
    { id: 'localLlm', icon: '<span class="codicon codicon-robot"></span>', title: 'Local LLM' },
    { id: 'conversation', icon: '<span class="codicon codicon-comment-discussion"></span>', title: 'AI Conversation' },
    { id: 'copilot', icon: '<span class="codicon codicon-copilot"></span>', title: 'Copilot' },
    { id: 'tomAiChat', icon: '<span class="codicon codicon-comment-discussion-sparkle"></span>', title: 'Tom AI Chat' }
];
var state = { expanded: ['localLlm'], pinned: [] };
var profiles = { localLlm: [], conversation: [], copilot: [], tomAiChat: [] };
var guidelinesFiles = [];
var guidelinesSelectedFile = '';
var guidelinesContent = '';
var notesFiles = [];
var notesSelectedFile = '';
var notesContent = '';

function loadState() {
    try {
        var s = vscode.getState();
        if (s && s.expanded && Array.isArray(s.expanded)) state.expanded = s.expanded;
        if (s && s.pinned && Array.isArray(s.pinned)) state.pinned = s.pinned;
    } catch(e) {}
}

function saveState() { vscode.setState(state); }
function isExpanded(id) { return state.expanded && state.expanded.includes(id); }
function isPinned(id) { return state.pinned && state.pinned.includes(id); }

function toggleSection(id) {
    if (isExpanded(id)) {
        state.expanded = state.expanded.filter(function(s) { return s !== id; });
    } else {
        state.expanded.push(id);
        sectionsConfig.forEach(function(sec) {
            if (sec.id !== id && !isPinned(sec.id)) {
                state.expanded = state.expanded.filter(function(s) { return s !== sec.id; });
            }
        });
    }
    if (state.expanded.length === 0) state.expanded = [id];
    saveState();
    render();
}

function togglePin(id, e) {
    e.stopPropagation();
    var idx = state.pinned.indexOf(id);
    if (idx >= 0) { state.pinned.splice(idx, 1); }
    else { state.pinned.push(id); if (!isExpanded(id)) state.expanded.push(id); }
    saveState();
    render();
}

function getSectionContent(id) {
    var contents = {
        guidelines: '<div class="toolbar"><label>File:</label><select id="guidelines-file" onchange="selectGuidelinesFile(this.value)"></select><button class="icon-btn" data-action="reloadGuidelines" title="Reload"><span class="codicon codicon-refresh"></span></button><button class="icon-btn" data-action="addGuidelinesFile" title="Add File"><span class="codicon codicon-add"></span></button><button class="icon-btn danger" data-action="deleteGuidelinesFile" title="Delete File"><span class="codicon codicon-trash"></span></button><button class="icon-btn" data-action="openGuidelinesInEditor" title="Open in Editor"><span class="codicon codicon-go-to-file"></span></button></div><textarea id="guidelines-text" placeholder="Select a guidelines file to edit..." data-input="guidelines"></textarea><div class="status-bar"><span id="guidelines-charCount">0 chars</span></div>',
        notes: '<div class="toolbar"><label>Note:</label><select id="notes-file" onchange="selectNotesFile(this.value)"></select><button class="icon-btn" data-action="reloadNotes" title="Reload"><span class="codicon codicon-refresh"></span></button><button class="icon-btn" data-action="addNotesFile" title="Add Note"><span class="codicon codicon-add"></span></button><button class="icon-btn danger" data-action="deleteNotesFile" title="Delete Note"><span class="codicon codicon-trash"></span></button><button class="icon-btn" data-action="openNotesInEditor" title="Open in Editor"><span class="codicon codicon-go-to-file"></span></button></div><textarea id="notes-text" placeholder="Select a note to edit..." data-input="notes"></textarea><div class="status-bar"><span id="notes-charCount">0 chars</span></div>',
        localLlm: '<div class="toolbar"><label>Profile:</label><select id="localLlm-profile"><option value="">(None)</option></select><button class="icon-btn" data-action="addProfile" data-id="localLlm" title="Add Profile"><span class="codicon codicon-add"></span></button><button class="icon-btn" data-action="editProfile" data-id="localLlm" title="Edit Profile"><span class="codicon codicon-edit"></span></button><button class="icon-btn danger" data-action="deleteProfile" data-id="localLlm" title="Delete Profile"><span class="codicon codicon-trash"></span></button><button data-action="preview" data-id="localLlm" title="Preview expanded prompt">Preview</button><button class="primary" data-action="send" data-id="localLlm" title="Send prompt to Local LLM">Send to LLM</button><button class="icon-btn" data-action="trail" data-id="localLlm" title="Open Trail File"><span class="codicon codicon-list-flat"></span></button></div><div id="localLlm-profileInfo" class="profile-info" style="display:none;"></div><textarea id="localLlm-text" placeholder="Enter your prompt for the local LLM..." data-input="localLlm"></textarea><div class="status-bar"><span id="localLlm-charCount">0 chars</span></div><div class="placeholder-help"><strong>Placeholders:</strong> <code>{{selection}}</code>, <code>{{file}}</code>, <code>{{clipboard}}</code>, <code>{{date}}</code></div>',
        conversation: '<div class="toolbar"><label>Profile:</label><select id="conversation-profile"><option value="">(None)</option></select><button class="icon-btn" data-action="addProfile" data-id="conversation" title="Add Profile"><span class="codicon codicon-add"></span></button><button class="icon-btn" data-action="editProfile" data-id="conversation" title="Edit Profile"><span class="codicon codicon-edit"></span></button><button class="icon-btn danger" data-action="deleteProfile" data-id="conversation" title="Delete Profile"><span class="codicon codicon-trash"></span></button><button data-action="preview" data-id="conversation" title="Preview expanded prompt">Preview</button><button class="primary" data-action="send" data-id="conversation" title="Start AI Conversation">Start</button></div><div id="conversation-profileInfo" class="profile-info" style="display:none;"></div><textarea id="conversation-text" placeholder="Enter your goal/description for the conversation..." data-input="conversation"></textarea><div class="status-bar"><span id="conversation-charCount">0 chars</span></div><div class="placeholder-help"><strong>Tip:</strong> Describe the goal clearly. The bot will orchestrate a multi-turn conversation with Copilot.</div>',
        copilot: '<div class="toolbar"><label>Template:</label><select id="copilot-template"><option value="">(None)</option><option value="__answer_file__">Answer File</option></select><button class="icon-btn" data-action="addTemplate" data-id="copilot" title="Add Template"><span class="codicon codicon-add"></span></button><button class="icon-btn" data-action="editTemplate" data-id="copilot" title="Edit Template"><span class="codicon codicon-edit"></span></button><button class="icon-btn danger" data-action="deleteTemplate" data-id="copilot" title="Delete Template"><span class="codicon codicon-trash"></span></button><button data-action="preview" data-id="copilot" title="Preview expanded prompt">Preview</button><button class="primary" data-action="send" data-id="copilot" title="Send to GitHub Copilot">Send</button><span class="toolbar-spacer"></span><label>Auto-hide:</label><select id="copilot-autohide"><option value="0">Keep open</option><option value="1000">1s</option><option value="5000">5s</option><option value="10000">10s</option></select><button class="icon-btn" data-action="openPromptsFile" data-id="copilot" title="Open Prompts Log"><span class="codicon codicon-list-flat"></span></button><label class="checkbox-label"><input type="checkbox" id="copilot-keep-content"> Keep</label></div><div class="toolbar answers-toolbar" id="copilot-answers-toolbar" style="display:none;"><span id="copilot-answer-indicator" class="answer-indicator">Answer Ready</span><button class="icon-btn" data-action="showAnswerViewer" data-id="copilot" title="View Answer"><span class="codicon codicon-eye"></span></button><button class="icon-btn" data-action="extractAnswer" data-id="copilot" title="Extract to Markdown"><span class="codicon codicon-file-symlink-file"></span></button></div><div id="copilot-templateInfo" class="profile-info" style="display:none;"></div><textarea id="copilot-text" placeholder="Enter your prompt..." data-input="copilot"></textarea><div class="status-bar"><span id="copilot-charCount">0 chars</span></div><div class="placeholder-help"><strong>Placeholders:</strong> <code>{{selection}}</code>, <code>{{file}}</code>, <code>{{clipboard}}</code>, <code>{{date}}</code>, <code>{{requestId}}</code><br><strong>Template vars:</strong> <code>\${dartscript.datetime}</code>, <code>\${dartscript.windowId}</code>, <code>\${dartscript.chatAnswerFolder}</code>, <code>\${dartscript.chat.KEY}</code></div>',
        tomAiChat: '<div class="toolbar"><label>Template:</label><select id="tomAiChat-template"><option value="">(None)</option></select><button class="icon-btn" data-action="addTemplate" data-id="tomAiChat" title="Add Template"><span class="codicon codicon-add"></span></button><button class="icon-btn" data-action="editTemplate" data-id="tomAiChat" title="Edit Template"><span class="codicon codicon-edit"></span></button><button class="icon-btn danger" data-action="deleteTemplate" data-id="tomAiChat" title="Delete Template"><span class="codicon codicon-trash"></span></button><button data-action="openChatFile" data-id="tomAiChat" title="Open or create .chat.md file">Open</button><button data-action="preview" data-id="tomAiChat" title="Preview expanded prompt">Preview</button><button class="primary" data-action="insertToChatFile" data-id="tomAiChat" title="Insert into .chat.md file">Insert</button></div><div id="tomAiChat-templateInfo" class="profile-info" style="display:none;"></div><textarea id="tomAiChat-text" placeholder="Enter your prompt for Tom AI Chat..." data-input="tomAiChat"></textarea><div class="status-bar"><span id="tomAiChat-charCount">0 chars</span></div><div class="placeholder-help"><strong>Tip:</strong> Write your prompt, then click "Insert" to add it to an open .chat.md file.</div>'
    };
    return contents[id] || '<div>Unknown section</div>';
}

var _rendered = false;

function render() {
    var container = document.getElementById('container');
    if (!_rendered) {
        // --- Initial render: build full DOM ---
        var html = '';
        sectionsConfig.forEach(function(sec, idx) {
            var exp = isExpanded(sec.id);
            var pin = isPinned(sec.id);
            html += '<div class="accordion-section ' + (exp ? 'expanded' : 'collapsed') + '" data-section="' + sec.id + '">';
            html += '<div class="header-expanded" data-toggle="' + sec.id + '"><span class="arrow"><span class="codicon codicon-chevron-right"></span></span><span class="icon">' + sec.icon + '</span><span class="title">' + sec.title + '</span><button class="pin-btn ' + (pin ? 'pinned' : '') + '" data-pin="' + sec.id + '" title="' + (pin ? 'Unpin' : 'Pin') + '"><span class="codicon ' + (pin ? 'codicon-pinned' : 'codicon-pin') + '"></span></button></div>';
            html += '<div class="header-collapsed" data-toggle="' + sec.id + '"><span class="arrow"><span class="codicon codicon-chevron-down"></span></span><span class="icon">' + sec.icon + '</span><span class="title">' + sec.title + '</span></div>';
            html += '<div class="section-content">' + getSectionContent(sec.id) + '</div></div>';
        });
        container.innerHTML = html;
        _rendered = true;
        attachEventListeners();
        updateResizeHandles();
        populateDropdowns();
    } else {
        // --- Subsequent renders: preserve DOM, toggle classes only ---
        sectionsConfig.forEach(function(sec) {
            var el = container.querySelector('[data-section="' + sec.id + '"]');
            if (!el) return;
            var exp = isExpanded(sec.id);
            var pin = isPinned(sec.id);
            if (exp) { el.classList.remove('collapsed'); el.classList.add('expanded'); el.style.flex = ''; }
            else { el.classList.remove('expanded'); el.classList.add('collapsed'); el.style.flex = ''; }
            var pinBtn = el.querySelector('[data-pin="' + sec.id + '"]');
            if (pinBtn) {
                if (pin) { pinBtn.classList.add('pinned'); pinBtn.title = 'Unpin'; }
                else { pinBtn.classList.remove('pinned'); pinBtn.title = 'Pin'; }
                var pinIcon = pinBtn.querySelector('.codicon');
                if (pinIcon) {
                    pinIcon.classList.remove('codicon-pin', 'codicon-pinned');
                    pinIcon.classList.add(pin ? 'codicon-pinned' : 'codicon-pin');
                }
            }
        });
        updateResizeHandles();
    }
}

function updateResizeHandles() {
    var container = document.getElementById('container');
    container.querySelectorAll('.resize-handle').forEach(function(h) { h.remove(); });
    var expandedIds = [];
    sectionsConfig.forEach(function(sec) { if (isExpanded(sec.id)) expandedIds.push(sec.id); });
    for (var i = 1; i < expandedIds.length; i++) {
        var rightEl = container.querySelector('[data-section="' + expandedIds[i] + '"]');
        if (rightEl) {
            var handle = document.createElement('div');
            handle.className = 'resize-handle';
            handle.dataset.resizeLeft = expandedIds[i - 1];
            handle.dataset.resizeRight = expandedIds[i];
            container.insertBefore(handle, rightEl);
            handle.addEventListener('mousedown', function(e) { startResize(e, this); });
        }
    }
}

function attachEventListeners() {
    document.querySelectorAll('[data-toggle]').forEach(function(el) { el.addEventListener('click', function() { toggleSection(el.dataset.toggle); }); });
    document.querySelectorAll('[data-pin]').forEach(function(el) { el.addEventListener('click', function(e) { togglePin(el.dataset.pin, e); }); });
    document.querySelectorAll('[data-action]').forEach(function(el) { el.addEventListener('click', function() { handleAction(el.dataset.action, el.dataset.id); }); });
    document.querySelectorAll('[data-input]').forEach(function(el) { el.addEventListener('input', function() { updateCharCount(el.dataset.input); }); });
    var guidelinesText = document.getElementById('guidelines-text');
    if (guidelinesText) guidelinesText.addEventListener('input', onGuidelinesInput);
    var notesText = document.getElementById('notes-text');
    if (notesText) notesText.addEventListener('input', onNotesInput);
}

var resizing = null;
function startResize(e, handle) {
    e.preventDefault();
    var leftId = handle.dataset.resizeLeft;
    var rightId = handle.dataset.resizeRight;
    var leftEl = document.querySelector('[data-section="' + leftId + '"]');
    var rightEl = document.querySelector('[data-section="' + rightId + '"]');
    if (!leftEl || !rightEl) return;
    handle.classList.add('dragging');
    resizing = { handle: handle, leftEl: leftEl, rightEl: rightEl, startX: e.clientX, leftWidth: leftEl.offsetWidth, rightWidth: rightEl.offsetWidth };
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}
function doResize(e) { if (!resizing) return; var dx = e.clientX - resizing.startX; resizing.leftEl.style.flex = '0 0 ' + Math.max(120, resizing.leftWidth + dx) + 'px'; resizing.rightEl.style.flex = '0 0 ' + Math.max(120, resizing.rightWidth - dx) + 'px'; }
function stopResize() { if (resizing) { resizing.handle.classList.remove('dragging'); resizing = null; } document.removeEventListener('mousemove', doResize); document.removeEventListener('mouseup', stopResize); }

function handleAction(action, id) {
    switch(action) {
        case 'send': { var text = document.getElementById(id + '-text'); text = text ? text.value : ''; if (!text.trim()) return; var profile = document.getElementById(id + '-profile'); profile = profile ? profile.value : ''; var template = document.getElementById(id + '-template'); template = template ? template.value : ''; vscode.postMessage({ type: 'send' + id.charAt(0).toUpperCase() + id.slice(1), text: text, profile: profile, template: template }); break; }
        case 'preview': { var prvText = document.getElementById(id + '-text'); prvText = prvText ? prvText.value : ''; var prvTpl = document.getElementById(id + '-template'); prvTpl = prvTpl ? prvTpl.value : ''; vscode.postMessage({ type: 'preview', section: id, text: prvText, template: prvTpl }); break; }
        case 'trail': vscode.postMessage({ type: 'showTrail', section: id }); break;
        case 'reload': vscode.postMessage({ type: 'reload', section: id }); break;
        case 'open': vscode.postMessage({ type: 'openInEditor', section: id }); break;
        case 'addNote': vscode.postMessage({ type: 'addNote' }); break;
        case 'addProfile': vscode.postMessage({ type: 'addProfile', section: id }); break;
        case 'editProfile': { var epSel = document.getElementById(id + '-profile'); vscode.postMessage({ type: 'editProfile', section: id, name: epSel ? epSel.value : '' }); break; }
        case 'addTemplate': vscode.postMessage({ type: 'addTemplate', section: id }); break;
        case 'editTemplate': { var etSel = document.getElementById(id + '-template'); var etVal = etSel ? etSel.value : ''; vscode.postMessage({ type: 'editTemplate', section: id, name: etVal }); break; }
        case 'deleteProfile': confirmDelete('profile', id); break;
        case 'deleteTemplate': { var dtSel = document.getElementById(id + '-template'); var dtVal = dtSel ? dtSel.value : ''; if (dtVal === '__answer_file__') { vscode.postMessage({ type: 'showMessage', message: 'The Answer File template is built-in and cannot be deleted.' }); return; } confirmDelete('template', id); break; }
        case 'openChatFile': vscode.postMessage({ type: 'openChatFile' }); break;
        case 'insertToChatFile': { var insertText = document.getElementById(id + '-text'); insertText = insertText ? insertText.value : ''; if (!insertText.trim()) return; var insertTemplate = document.getElementById(id + '-template'); insertTemplate = insertTemplate ? insertTemplate.value : ''; vscode.postMessage({ type: 'insertToChatFile', text: insertText, template: insertTemplate }); break; }
        case 'reloadGuidelines': vscode.postMessage({ type: 'getGuidelinesFiles' }); break;
        case 'addGuidelinesFile': vscode.postMessage({ type: 'addGuidelinesFile' }); break;
        case 'deleteGuidelinesFile': { if (!guidelinesSelectedFile) return; if (confirm('Delete file "' + guidelinesSelectedFile + '"?')) vscode.postMessage({ type: 'deleteGuidelinesFile', file: guidelinesSelectedFile }); break; }
        case 'openGuidelinesInEditor': if (guidelinesSelectedFile) vscode.postMessage({ type: 'openGuidelinesInEditor', file: guidelinesSelectedFile }); break;
        case 'reloadNotes': vscode.postMessage({ type: 'getNotesFiles' }); break;
        case 'addNotesFile': vscode.postMessage({ type: 'addNotesFile' }); break;
        case 'deleteNotesFile': { if (!notesSelectedFile) return; if (confirm('Delete note "' + notesSelectedFile + '"?')) vscode.postMessage({ type: 'deleteNotesFile', file: notesSelectedFile }); break; }
        case 'openNotesInEditor': if (notesSelectedFile) vscode.postMessage({ type: 'openNotesInEditor', file: notesSelectedFile }); break;
        case 'showAnswerViewer': vscode.postMessage({ type: 'showAnswerViewer' }); break;
        case 'extractAnswer': vscode.postMessage({ type: 'extractAnswer' }); break;
        case 'openPromptsFile': vscode.postMessage({ type: 'openPromptsFile' }); break;
    }
}

function confirmDelete(itemType, sectionId) {
    var selectId = sectionId + '-' + itemType;
    var sel = document.getElementById(selectId);
    var selectedValue = sel ? sel.value : '';
    if (!selectedValue) { vscode.postMessage({ type: 'showMessage', message: 'Please select a ' + itemType + ' to delete.' }); return; }
    // Send directly to extension - VS Code will show its own confirmation dialog
    vscode.postMessage({ type: 'delete' + itemType.charAt(0).toUpperCase() + itemType.slice(1), section: sectionId, name: selectedValue });
}

function populateDropdowns() {
    populateSelect('localLlm-profile', profiles.localLlm);
    populateSelect('conversation-profile', profiles.conversation);
    populateSelect('copilot-template', profiles.copilot);
    populateSelect('tomAiChat-template', profiles.tomAiChat);
    updateGuidelinesUI();
    updateNotesUI();
}

function populateSelect(id, options) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var cur = sel.value;
    var baseOptions = '<option value="">(None)</option>';
    if (id === 'copilot-template') baseOptions += '<option value="__answer_file__">Answer File</option>';
    sel.innerHTML = baseOptions + (options || []).map(function(o) { return '<option value="' + o + '">' + o + '</option>'; }).join('');
    if (cur && (options && options.includes(cur) || cur === '__answer_file__')) sel.value = cur;
}

function updateCharCount(id) {
    var ta = document.getElementById(id + '-text');
    var cc = document.getElementById(id + '-charCount');
    if (ta && cc) cc.textContent = ta.value.length + ' chars';
}

var guidelinesSaveTimer = null;
var notesSaveTimer = null;

function selectGuidelinesFile(file) {
    guidelinesSelectedFile = file;
    if (file) vscode.postMessage({ type: 'loadGuidelinesFile', file: file });
    else { guidelinesContent = ''; updateGuidelinesUI(); }
}

function selectNotesFile(file) {
    notesSelectedFile = file;
    if (file) vscode.postMessage({ type: 'loadNotesFile', file: file });
    else { notesContent = ''; updateNotesUI(); }
}

function updateGuidelinesUI() {
    var sel = document.getElementById('guidelines-file');
    if (sel) {
        sel.innerHTML = '<option value="">(Select file)</option>' + guidelinesFiles.map(function(f) { return '<option value="' + f + '"' + (f === guidelinesSelectedFile ? ' selected' : '') + '>' + f + '</option>'; }).join('');
    }
    var ta = document.getElementById('guidelines-text');
    if (ta) { ta.value = guidelinesContent; }
    updateCharCount('guidelines');
}

function updateNotesUI() {
    var sel = document.getElementById('notes-file');
    if (sel) {
        sel.innerHTML = '<option value="">(Select note)</option>' + notesFiles.map(function(f) { return '<option value="' + f + '"' + (f === notesSelectedFile ? ' selected' : '') + '>' + f + '</option>'; }).join('');
    }
    var ta = document.getElementById('notes-text');
    if (ta) { ta.value = notesContent; }
    updateCharCount('notes');
}

function onGuidelinesInput() {
    var ta = document.getElementById('guidelines-text');
    if (!ta || !guidelinesSelectedFile) return;
    guidelinesContent = ta.value;
    updateCharCount('guidelines');
    if (guidelinesSaveTimer) clearTimeout(guidelinesSaveTimer);
    guidelinesSaveTimer = setTimeout(function() { vscode.postMessage({ type: 'saveGuidelinesFile', file: guidelinesSelectedFile, content: guidelinesContent }); }, 500);
}

function onNotesInput() {
    var ta = document.getElementById('notes-text');
    if (!ta || !notesSelectedFile) return;
    notesContent = ta.value;
    updateCharCount('notes');
    if (notesSaveTimer) clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(function() { vscode.postMessage({ type: 'saveNotesFile', file: notesSelectedFile, content: notesContent }); }, 500);
}

window.addEventListener('message', function(e) {
    var msg = e.data;
    if (msg.type === 'profiles') {
        profiles = { localLlm: msg.localLlm || [], conversation: msg.conversation || [], copilot: msg.copilot || [], tomAiChat: msg.tomAiChat || [] };
        populateDropdowns();
    } else if (msg.type === 'guidelinesFiles') {
        guidelinesFiles = msg.files || [];
        if (msg.selectedFile) guidelinesSelectedFile = msg.selectedFile;
        else if (guidelinesFiles.length > 0 && !guidelinesSelectedFile) guidelinesSelectedFile = guidelinesFiles[0];
        updateGuidelinesUI();
        if (guidelinesSelectedFile) vscode.postMessage({ type: 'loadGuidelinesFile', file: guidelinesSelectedFile });
    } else if (msg.type === 'guidelinesContent') {
        guidelinesContent = msg.content || '';
        updateGuidelinesUI();
    } else if (msg.type === 'notesFiles') {
        notesFiles = msg.files || [];
        if (msg.selectedFile) notesSelectedFile = msg.selectedFile;
        else if (notesFiles.length > 0 && !notesSelectedFile) notesSelectedFile = notesFiles[0];
        updateNotesUI();
        if (notesSelectedFile) vscode.postMessage({ type: 'loadNotesFile', file: notesSelectedFile });
    } else if (msg.type === 'notesContent') {
        notesContent = msg.content || '';
        updateNotesUI();
    } else if (msg.type === 'answerFileStatus') {
        var toolbar = document.getElementById('copilot-answers-toolbar');
        if (toolbar) toolbar.style.display = msg.exists ? 'flex' : 'none';
    } else if (msg.type === 'autoHideDelay') {
        var select = document.getElementById('copilot-autohide');
        if (select) select.value = String(msg.value || 0);
    } else if (msg.type === 'keepContent') {
        var cb = document.getElementById('copilot-keep-content');
        if (cb) cb.checked = msg.value;
    } else if (msg.type === 'clearCopilotText') {
        var ta = document.getElementById('copilot-text');
        if (ta) { ta.value = ''; updateCharCount('copilot'); }
    }
});

function initCopilotSection() {
    var autohideSelect = document.getElementById('copilot-autohide');
    if (autohideSelect) {
        autohideSelect.addEventListener('change', function() {
            vscode.postMessage({ type: 'setAutoHideDelay', value: parseInt(this.value, 10) });
        });
    }
    var keepContentCb = document.getElementById('copilot-keep-content');
    if (keepContentCb) {
        keepContentCb.addEventListener('change', function() {
            vscode.postMessage({ type: 'setKeepContent', value: this.checked });
        });
    }
}

loadState();
render();
initCopilotSection();
vscode.postMessage({ type: 'getProfiles' });
vscode.postMessage({ type: 'getGuidelinesFiles' });
vscode.postMessage({ type: 'getNotesFiles' });
vscode.postMessage({ type: 'getAutoHideDelay' });
vscode.postMessage({ type: 'getKeepContent' });
vscode.postMessage({ type: 'checkAnswerFile' });
`;
    }

    /* FULL_ORIGINAL_START
    private _getHtmlContent(): string {
        return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>T2 Unified Notepad</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-panel-background);
            height: 100vh;
            display: flex;
            flex-direction: row;
            overflow: hidden;
        }
        
        .accordion-container {
            display: flex;
            flex-direction: row;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        
        .accordion-section {
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--vscode-panel-border);
            overflow: hidden;
        }
        .accordion-section:last-child { border-right: none; }
        
        .accordion-section.collapsed {
            flex: 0 0 18px;
            width: 18px;
        }
        .accordion-section.collapsed .section-content { display: none; }
        .accordion-section.collapsed .header-expanded { display: none; }
        .accordion-section.collapsed .header-collapsed { display: flex; }
        
        .accordion-section.expanded {
            flex: 1 1 auto;
            min-width: 120px;
        }
        .accordion-section.expanded .section-content { display: flex; }
        .accordion-section.expanded .header-expanded { display: flex; }
        .accordion-section.expanded .header-collapsed { display: none; }
        
        .resize-handle {
            flex: 0 0 4px;
            width: 4px;
            background: transparent;
            cursor: col-resize;
            transition: background 0.1s;
        }
        .resize-handle:hover, .resize-handle.dragging {
            background: var(--vscode-focusBorder);
        }
        
        .header-expanded {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 2px 10px;
            background: var(--vscode-sideBarSectionHeader-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            white-space: nowrap;
        }
        .header-expanded:hover { background: var(--vscode-list-hoverBackground); }
        .header-expanded .arrow { font-size: 11px; }
        .header-expanded .icon { font-size: 16px; }
        .header-expanded .title { font-size: 13px; font-weight: 500; text-transform: uppercase; }
        .header-expanded .pin-btn {
            margin-left: auto;
            opacity: 0.3;
            cursor: pointer;
            background: none;
            border: none;
            font-size: 13px;
            color: var(--vscode-foreground);
            padding: 3px 5px;
        }
        .header-expanded .pin-btn:hover { opacity: 0.7; }
        .header-expanded .pin-btn.pinned { opacity: 1; }
        
        .header-collapsed {
            writing-mode: vertical-lr;
            display: none;
            align-items: center;
            padding: 8px 4px 8px 2px;
            background: var(--vscode-sideBarSectionHeader-background);
            cursor: pointer;
            white-space: nowrap;
            height: 100%;
        }
        .header-collapsed:hover { background: var(--vscode-list-hoverBackground); }
        .header-collapsed .arrow { font-size: 11px; margin-bottom: 6px; }
        .header-collapsed .icon { font-size: 16px; margin-bottom: 11px; }
        .header-collapsed .title { font-size: 13px; font-weight: 500; text-transform: uppercase; }
        
        .section-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 8px;
            gap: 6px;
            overflow: hidden;
        }
        
        .toolbar { display: flex; flex-direction: column; gap: 6px; }
        .toolbar-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .toolbar-row label { font-size: 13px; min-width: 55px; }
        .toolbar-row select {
            flex: 1;
            padding: 4px 6px;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            font-size: 13px;
            min-width: 80px;
            max-width: 150px;
        }
        .toolbar-row button {
            padding: 4px 10px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
        }
        .toolbar-row button:hover { background: var(--vscode-button-secondaryHoverBackground); }
        .toolbar-row button.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .toolbar-row button.primary:hover { background: var(--vscode-button-hoverBackground); }
        .icon-btn { padding: 4px 8px; font-size: 14px; }
        .icon-btn.danger { color: var(--vscode-errorForeground); }
        .answers-toolbar { background: rgba(200, 170, 0, 0.15); border: 1px solid rgba(200, 170, 0, 0.4); border-radius: 4px; padding: 4px 8px !important; }
        .answer-indicator { font-size: 12px; font-weight: 600; color: var(--vscode-editorWarning-foreground, #cca700); margin-right: 8px; }
        .profile-info {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            padding: 4px 8px;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
            margin-top: 4px;
            max-height: 60px;
            overflow-y: auto;
        }
        
        textarea {
            flex: 1;
            min-height: 50px;
            resize: none;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
        }
        textarea:focus { outline: none; border-color: var(--vscode-focusBorder); }
        
        .status-bar { font-size: 11px; color: var(--vscode-descriptionForeground); }
        .placeholder-help { font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.4; }
        .placeholder-help code { background: var(--vscode-textCodeBlock-background); padding: 1px 3px; border-radius: 2px; }
    </style>
</head>
<body>
    <div class="accordion-container" id="container">Loading T2...</div>
    
    <script>
        (function() { document.getElementById('container').textContent = 'Step 1: Script started'; })();
        window.onerror = function(msg, url, line, col, err) {
            var c = document.getElementById('container');
            if (c) c.innerHTML = '<div style="color:red;padding:10px;white-space:pre-wrap;">JS Error: ' + msg + '\\nLine: ' + line + ', Col: ' + col + '</div>';
        };
        (function() { document.getElementById('container').textContent = 'Step 2: After onerror'; })();
        const vscode = acquireVsCodeApi();
        (function() { document.getElementById('container').textContent = 'Step 3: After vscode'; })();
        const sectionsConfig = [
            { id: 'guidelines', icon: '📋', title: 'Guidelines' },
            { id: 'notes', icon: '📝', title: 'Notes' },
            { id: 'localLlm', icon: '🤖', title: 'Local LLM' },
            { id: 'conversation', icon: '💬', title: 'Conversation' },
            { id: 'copilot', icon: '✨', title: 'Copilot' },
            { id: 'tomAiChat', icon: '🗨️', title: 'Tom AI' }
        ];
        (function() { document.getElementById('container').textContent = 'Step 4: After sectionsConfig'; })();
        
        let state = { expanded: ['localLlm'], pinned: [] };
        let profiles = { localLlm: [], conversation: [], copilot: [], tomAiChat: [] };
        (function() { document.getElementById('container').textContent = 'Step 5: After state/profiles'; })();
        
        function loadState() {
            try {
                const s = vscode.getState();
                if (s && s.expanded && Array.isArray(s.expanded)) {
                    state.expanded = s.expanded;
                }
                if (s && s.pinned && Array.isArray(s.pinned)) {
                    state.pinned = s.pinned;
                }
            } catch(e) {}
        }
        
        function saveState() {
            vscode.setState(state);
        }
        
        function isExpanded(id) { return state.expanded && state.expanded.includes(id); }
        function isPinned(id) { return state.pinned && state.pinned.includes(id); }
        
        function toggleSection(id) {
            if (isExpanded(id)) {
                // Always allow manual close, even if pinned
                state.expanded = state.expanded.filter(s => s !== id);
            } else {
                state.expanded.push(id);
                // Auto-collapse only non-pinned sections
                sectionsConfig.forEach(sec => {
                    if (sec.id !== id && !isPinned(sec.id)) {
                        state.expanded = state.expanded.filter(s => s !== sec.id);
                    }
                });
            }
            if (state.expanded.length === 0) state.expanded = [id];
            saveState();
            render();
        }
        
        function togglePin(id, e) {
            e.stopPropagation();
            const idx = state.pinned.indexOf(id);
            if (idx >= 0) {
                state.pinned.splice(idx, 1);
            } else {
                state.pinned.push(id);
                if (!isExpanded(id)) state.expanded.push(id);
            }
            saveState();
            render();
        }
        
        function getSectionContent(id) {
            const contents = {
                guidelines: '<div class="toolbar"><div class="toolbar-row"><button data-action="reload" data-id="guidelines">Reload</button><button data-action="open" data-id="guidelines">Open</button></div></div><div style="flex:1;overflow:auto;font-size:11px;color:var(--vscode-descriptionForeground);">Guidelines panel - coming soon</div>',
                notes: '<div class="toolbar"><div class="toolbar-row"><button data-action="reload" data-id="notes">Reload</button><button data-action="addNote">Add</button><button data-action="open" data-id="notes">Open</button></div></div><textarea id="notes-text" placeholder="Notes..."></textarea>',
                localLlm: '<div class="toolbar"><div class="toolbar-row"><label>Profile:</label><select id="localLlm-profile"><option value="">(None)</option></select><button class="icon-btn" data-action="addProfile" data-id="localLlm" title="Add Profile">+</button><button class="icon-btn" data-action="editProfile" data-id="localLlm" title="Edit Profile">✏️</button><button class="icon-btn danger" data-action="deleteProfile" data-id="localLlm" title="Delete Profile">🗑️</button></div><div class="toolbar-row"><button data-action="preview" data-id="localLlm">Preview</button><button class="primary" data-action="send" data-id="localLlm">Send to LLM</button><button data-action="trail" data-id="localLlm">📜 Trail</button></div></div><div id="localLlm-profileInfo" class="profile-info" style="display:none;"></div><textarea id="localLlm-text" placeholder="Enter your prompt for the local LLM..." data-input="localLlm"></textarea><div class="status-bar"><span id="localLlm-charCount">0 chars</span></div><div class="placeholder-help"><strong>Placeholders:</strong> <code>{{selection}}</code>, <code>{{file}}</code>, <code>{{clipboard}}</code>, <code>{{date}}</code></div>',
                conversation: '<div class="toolbar"><div class="toolbar-row"><label>Profile:</label><select id="conversation-profile"><option value="">(None)</option></select><button class="icon-btn" data-action="addProfile" data-id="conversation" title="Add Profile">+</button><button class="icon-btn" data-action="editProfile" data-id="conversation" title="Edit Profile">✏️</button><button class="icon-btn danger" data-action="deleteProfile" data-id="conversation" title="Delete Profile">🗑️</button></div><div class="toolbar-row"><button data-action="preview" data-id="conversation">Preview</button><button class="primary" data-action="send" data-id="conversation">Start Conversation</button></div></div><div id="conversation-profileInfo" class="profile-info" style="display:none;"></div><textarea id="conversation-text" placeholder="Enter your goal/description for the conversation..." data-input="conversation"></textarea><div class="status-bar"><span id="conversation-charCount">0 chars</span></div><div class="placeholder-help"><strong>Tip:</strong> Describe the goal clearly. The bot will orchestrate a multi-turn conversation with Copilot.</div>',
                copilot: '<div class="toolbar"><div class="toolbar-row"><label>Template:</label><select id="copilot-template"><option value="">(None)</option><option value="__answer_file__">Answer File</option></select><button class="icon-btn" data-action="addTemplate" data-id="copilot" title="Add Template">+</button><button class="icon-btn" data-action="editTemplate" data-id="copilot" title="Edit Template">✏️</button><button class="icon-btn danger" data-action="deleteTemplate" data-id="copilot" title="Delete Template">🗑️</button></div><div class="toolbar-row"><button data-action="preview" data-id="copilot">Preview</button><button class="primary" data-action="send" data-id="copilot">Send to Copilot</button><label style="margin-left:8px;">Auto-hide:</label><select id="copilot-autohide"><option value="0">Keep</option><option value="1000">1s</option><option value="5000">5s</option><option value="10000">10s</option></select><button class="icon-btn" data-action="openPromptsFile" data-id="copilot" title="Open Prompts Log" style="margin-left:4px;">📋</button><label style="margin-left:4px;display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" id="copilot-keep-content"> Keep</label></div></div><div class="toolbar answers-toolbar" id="copilot-answers-toolbar" style="display:none;"><span id="copilot-answer-indicator" class="answer-indicator">Answer Ready</span><button class="icon-btn" data-action="showAnswerViewer" data-id="copilot" title="View Answer">👁️</button><button class="icon-btn" data-action="extractAnswer" data-id="copilot" title="Extract to Markdown">📄</button></div><div id="copilot-templateInfo" class="profile-info" style="display:none;"></div><textarea id="copilot-text" placeholder="Enter your prompt... The selected template\'s prefix/suffix will wrap this content." data-input="copilot"></textarea><div class="status-bar"><span id="copilot-charCount">0 chars</span></div><div class="placeholder-help"><strong>Placeholders:</strong> <code>{{selection}}</code>, <code>{{file}}</code>, <code>{{clipboard}}</code>, <code>{{date}}</code></div>',
                tomAiChat: '<div class="toolbar"><div class="toolbar-row"><label>Template:</label><select id="tomAiChat-template"><option value="">(None)</option></select><button class="icon-btn" data-action="addTemplate" data-id="tomAiChat" title="Add Template">+</button><button class="icon-btn" data-action="editTemplate" data-id="tomAiChat" title="Edit Template">✏️</button><button class="icon-btn danger" data-action="deleteTemplate" data-id="tomAiChat" title="Delete Template">🗑️</button></div><div class="toolbar-row"><button data-action="openChatFile" data-id="tomAiChat">Open Chat</button><button data-action="preview" data-id="tomAiChat">Preview</button><button class="primary" data-action="insertToChatFile" data-id="tomAiChat">Insert</button></div></div><div id="tomAiChat-templateInfo" class="profile-info" style="display:none;"></div><textarea id="tomAiChat-text" placeholder="Enter your prompt for Tom AI Chat..." data-input="tomAiChat"></textarea><div class="status-bar"><span id="tomAiChat-charCount">0 chars</span></div><div class="placeholder-help"><strong>Tip:</strong> Write your prompt, then click "Insert" to add it to an open .chat.md file.</div>'
            };
            return contents[id] || '<div>Unknown section</div>';
        }
        
        function render() {
            const container = document.getElementById('container');
            let html = '';
            
            // Find nearest expanded section to the left of index i
            function findExpandedLeft(i) {
                for (let j = i - 1; j >= 0; j--) {
                    if (isExpanded(sectionsConfig[j].id)) return sectionsConfig[j].id;
                }
                return null;
            }
            
            // Find nearest expanded section to the right of index i
            function findExpandedRight(i) {
                for (let j = i + 1; j < sectionsConfig.length; j++) {
                    if (isExpanded(sectionsConfig[j].id)) return sectionsConfig[j].id;
                }
                return null;
            }
            
            sectionsConfig.forEach((sec, idx) => {
                const exp = isExpanded(sec.id);
                const pin = isPinned(sec.id);
                // Add resize handle if this expanded section has an expanded one to its left
                if (exp) {
                    const leftExpanded = findExpandedLeft(idx);
                    if (leftExpanded) {
                        html += '<div class="resize-handle" data-resize-left="' + leftExpanded + '" data-resize-right="' + sec.id + '"></div>';
                    }
                } else {
                    // For collapsed sections, add handle on left side if there are expanded on both sides
                    const leftExpanded = findExpandedLeft(idx);
                    const rightExpanded = findExpandedRight(idx);
                    if (leftExpanded && rightExpanded) {
                        html += '<div class="resize-handle" data-resize-left="' + leftExpanded + '" data-resize-right="' + rightExpanded + '"></div>';
                    }
                }
                html += '<div class="accordion-section ' + (exp ? 'expanded' : 'collapsed') + '" data-section="' + sec.id + '">';
                html += '<div class="header-expanded" data-toggle="' + sec.id + '">';
                html += '<span class="arrow">' + (exp ? '▶' : '▼') + '</span>';
                html += '<span class="icon">' + sec.icon + '</span>';
                html += '<span class="title">' + sec.title + '</span>';
                html += '<button class="pin-btn ' + (pin ? 'pinned' : '') + '" data-pin="' + sec.id + '" title="' + (pin ? 'Unpin' : 'Pin') + '">📌</button>';
                html += '</div>';
                html += '<div class="header-collapsed" data-toggle="' + sec.id + '">';
                html += '<span class="arrow">▼</span>';
                html += '<span class="icon">' + sec.icon + '</span>';
                html += '<span class="title">' + sec.title + '</span>';
                html += '</div>';
                html += '<div class="section-content">' + getSectionContent(sec.id) + '</div>';
                html += '</div>';
            });
            container.innerHTML = html;
            attachEventListeners();
            populateDropdowns();
        }
        
        function attachEventListeners() {
            // Toggle sections
            document.querySelectorAll('[data-toggle]').forEach(el => {
                el.addEventListener('click', () => toggleSection(el.dataset.toggle));
            });
            // Pin buttons
            document.querySelectorAll('[data-pin]').forEach(el => {
                el.addEventListener('click', (e) => togglePin(el.dataset.pin, e));
            });
            // Action buttons
            document.querySelectorAll('[data-action]').forEach(el => {
                el.addEventListener('click', () => handleAction(el.dataset.action, el.dataset.id));
            });
            // Textarea input for char count
            document.querySelectorAll('[data-input]').forEach(el => {
                el.addEventListener('input', () => updateCharCount(el.dataset.input));
            });
            // Resize handles
            document.querySelectorAll('.resize-handle').forEach(handle => {
                handle.addEventListener('mousedown', (e) => startResize(e, handle));
            });
        }
        
        let resizing = null;
        
        function startResize(e, handle) {
            e.preventDefault();
            const leftId = handle.dataset.resizeLeft;
            const rightId = handle.dataset.resizeRight;
            const leftEl = document.querySelector('[data-section="' + leftId + '"]');
            const rightEl = document.querySelector('[data-section="' + rightId + '"]');
            if (!leftEl || !rightEl) return;
            
            handle.classList.add('dragging');
            resizing = {
                handle: handle,
                leftEl: leftEl,
                rightEl: rightEl,
                startX: e.clientX,
                leftWidth: leftEl.offsetWidth,
                rightWidth: rightEl.offsetWidth
            };
            
            document.addEventListener('mousemove', doResize);
            document.addEventListener('mouseup', stopResize);
        }
        
        function doResize(e) {
            if (!resizing) return;
            const dx = e.clientX - resizing.startX;
            const newLeftWidth = Math.max(120, resizing.leftWidth + dx);
            const newRightWidth = Math.max(120, resizing.rightWidth - dx);
            resizing.leftEl.style.flex = '0 0 ' + newLeftWidth + 'px';
            resizing.rightEl.style.flex = '0 0 ' + newRightWidth + 'px';
        }
        
        function stopResize() {
            if (resizing) {
                resizing.handle.classList.remove('dragging');
                resizing = null;
            }
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
        }
        
        function handleAction(action, id) {
            switch(action) {
                case 'send': {
                    const text = document.getElementById(id + '-text')?.value || '';
                    if (!text.trim()) return;
                    const profile = document.getElementById(id + '-profile')?.value || '';
                    const template = document.getElementById(id + '-template')?.value || '';
                    vscode.postMessage({ type: 'send' + id.charAt(0).toUpperCase() + id.slice(1), text, profile, template });
                    break;
                }
                case 'preview': {
                    const prvText = document.getElementById(id + '-text')?.value || '';
                    const prvTpl = document.getElementById(id + '-template')?.value || '';
                    vscode.postMessage({ type: 'preview', section: id, text: prvText, template: prvTpl });
                    break;
                }
                case 'trail':
                    vscode.postMessage({ type: 'showTrail', section: id });
                    break;
                case 'reload':
                    vscode.postMessage({ type: 'reload', section: id });
                    break;
                case 'open':
                    vscode.postMessage({ type: 'openInEditor', section: id });
                    break;
                case 'addNote':
                    vscode.postMessage({ type: 'addNote' });
                    break;
                case 'addProfile':
                    vscode.postMessage({ type: 'addProfile', section: id });
                    break;
                case 'editProfile': {
                    const epSel = document.getElementById(id + '-profile');
                    vscode.postMessage({ type: 'editProfile', section: id, name: epSel?.value || '' });
                    break;
                }
                case 'addTemplate':
                    vscode.postMessage({ type: 'addTemplate', section: id });
                    break;
                case 'editTemplate': {
                    const etSel = document.getElementById(id + '-template');
                    const etVal = etSel?.value || '';
                    vscode.postMessage({ type: 'editTemplate', section: id, name: etVal });
                    break;
                }
                case 'deleteProfile':
                    confirmDelete('profile', id);
                    break;
                case 'deleteTemplate': {
                    const dtSel = document.getElementById(id + '-template');
                    const dtVal = dtSel?.value || '';
                    if (dtVal === '__answer_file__') {
                        vscode.postMessage({ type: 'showMessage', message: 'The Answer File template is built-in and cannot be deleted.' });
                        return;
                    }
                    confirmDelete('template', id);
                    break;
                }
                case 'openChatFile':
                    vscode.postMessage({ type: 'openChatFile' });
                    break;
                case 'insertToChatFile': {
                    const insertText = document.getElementById(id + '-text')?.value || '';
                    if (!insertText.trim()) return;
                    const insertTemplate = document.getElementById(id + '-template')?.value || '';
                    vscode.postMessage({ type: 'insertToChatFile', text: insertText, template: insertTemplate });
                    break;
                }
                case 'showAnswerViewer':
                    vscode.postMessage({ type: 'showAnswerViewer' });
                    break;
                case 'extractAnswer':
                    vscode.postMessage({ type: 'extractAnswer' });
                    break;
                case 'openPromptsFile':
                    vscode.postMessage({ type: 'openPromptsFile' });
                    break;
            }
        }
        
        function confirmDelete(itemType, sectionId) {
            const selectId = sectionId + '-' + itemType;
            const sel = document.getElementById(selectId);
            const selectedValue = sel?.value;
            if (!selectedValue) {
                vscode.postMessage({ type: 'showMessage', message: 'Please select a ' + itemType + ' to delete.' });
                return;
            }
            // Send directly to extension - VS Code will show its own confirmation dialog
            vscode.postMessage({ type: 'delete' + itemType.charAt(0).toUpperCase() + itemType.slice(1), section: sectionId, name: selectedValue });
        }
        
        function populateDropdowns() {
            populateSelect('localLlm-profile', profiles.localLlm);
            populateSelect('conversation-profile', profiles.conversation);
            populateSelect('copilot-template', profiles.copilot);
            populateSelect('tomAiChat-template', profiles.tomAiChat);
        }
        
        function populateSelect(id, options) {
            const sel = document.getElementById(id);
            if (!sel) return;
            const cur = sel.value;
            let baseOptions = '<option value="">(None)</option>';
            if (id === 'copilot-template') baseOptions += '<option value="__answer_file__">Answer File</option>';
            sel.innerHTML = baseOptions + (options || []).map(o => '<option value="' + o + '">' + o + '</option>').join('');
            if (cur && (options && options.includes(cur) || cur === '__answer_file__')) sel.value = cur;
        }
        
        function updateCharCount(id) {
            const ta = document.getElementById(id + '-text');
            const cc = document.getElementById(id + '-charCount');
            if (ta && cc) cc.textContent = ta.value.length + ' chars';
        }
        
        window.addEventListener('message', e => {
            const msg = e.data;
            if (msg.type === 'profiles') {
                profiles = { localLlm: msg.localLlm || [], conversation: msg.conversation || [], copilot: msg.copilot || [], tomAiChat: msg.tomAiChat || [] };
                populateDropdowns();
            } else if (msg.type === 'answerFileStatus') {
                var toolbar = document.getElementById('copilot-answers-toolbar');
                if (toolbar) toolbar.style.display = msg.exists ? 'flex' : 'none';
            } else if (msg.type === 'autoHideDelay') {
                var select = document.getElementById('copilot-autohide');
                if (select) select.value = String(msg.value || 0);
            } else if (msg.type === 'keepContent') {
                var cb = document.getElementById('copilot-keep-content');
                if (cb) cb.checked = msg.value;
            } else if (msg.type === 'clearCopilotText') {
                var ta = document.getElementById('copilot-text');
                if (ta) { ta.value = ''; updateCharCount('copilot'); }
            }
        });
        
        function initCopilotSection() {
            var autohideSelect = document.getElementById('copilot-autohide');
            if (autohideSelect) {
                autohideSelect.addEventListener('change', function() {
                    vscode.postMessage({ type: 'setAutoHideDelay', value: parseInt(this.value, 10) });
                });
            }
            var keepContentCb = document.getElementById('copilot-keep-content');
            if (keepContentCb) {
                keepContentCb.addEventListener('change', function() {
                    vscode.postMessage({ type: 'setKeepContent', value: this.checked });
                });
            }
        }
        
        (function() { document.getElementById('container').textContent = 'Step 6: Before init try'; })();
        try {
            (function() { document.getElementById('container').textContent = 'Step 7: Inside try'; })();
            loadState();
            (function() { document.getElementById('container').textContent = 'Step 8: After loadState'; })();
            render();
            (function() { document.getElementById('container').textContent = 'Step 9: After render'; })();
            initCopilotSection();
            vscode.postMessage({ type: 'getProfiles' });
            vscode.postMessage({ type: 'getAutoHideDelay' });
            vscode.postMessage({ type: 'getKeepContent' });
            vscode.postMessage({ type: 'checkAnswerFile' });
        } catch(err) {
            var errMsg = (err && err.message) ? err.message : String(err);
            document.getElementById('container').innerHTML = '<div style="color:red;padding:10px;white-space:pre-wrap;">Init Error: ' + errMsg + '</div>';
        }
    </script>
</body>
</html>\`;
    }
    FULL_ORIGINAL_END */
}

let _provider: UnifiedNotepadViewProvider | undefined;

export function registerUnifiedNotepad(context: vscode.ExtensionContext): void {
    _provider = new UnifiedNotepadViewProvider(context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VIEW_ID, _provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );
}

