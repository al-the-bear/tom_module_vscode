/**
 * DS Notes WebviewView Providers - Config-based Templates
 * 
 * Each notepad uses templates from its dedicated config section:
 * - Guidelines: File-based editor (no templates)
 * - Notes: Simple multi-note storage (no templates)
 * - Local LLM: Uses promptExpander.profiles
 * - Conversation: Uses botConversation.profiles
 * - Copilot: Uses templates section (prefix/suffix)
 * - Tom AI Chat: Uses tomAiChat.templates
 * 
 * Features:
 * - Config reload on focus-in, draft save on focus-out
 * - Placeholder expansion
 * - Preview modal before sending
 * - Add/Delete template management
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getPromptExpanderManager } from './expandPrompt-handler';
import * as fs from 'fs';
import { getConfigPath } from './handler_shared';
import {
    clearTrail, logPrompt, isTrailEnabled, loadTrailConfig,
} from './trailLogger-handler';

// View IDs
const VIEW_IDS = {
    guidelines: 'dartscript.guidelinesNotepad',
    notes: 'dartscript.notesNotepad',
    localLlm: 'dartscript.localLlmNotepad',
    conversation: 'dartscript.conversationNotepad',
    copilot: 'dartscript.copilotNotepad',
    tomAiChat: 'dartscript.tomAiChatNotepad',
    tomNotepad: 'dartscript.tomNotepad',
    workspaceNotepad: 'dartscript.workspaceNotepad'
};

// Storage keys for drafts
const STORAGE_KEYS = {
    localLlmDraft: 'dartscript.dsNotes.localLlmDraft',
    localLlmProfile: 'dartscript.dsNotes.localLlmProfile',
    conversationDraft: 'dartscript.dsNotes.conversationDraft',
    conversationProfile: 'dartscript.dsNotes.conversationProfile',
    copilotDraft: 'dartscript.dsNotes.copilotDraft',
    copilotTemplate: 'dartscript.dsNotes.copilotTemplate',
    tomAiChatDraft: 'dartscript.dsNotes.tomAiChatDraft',
    tomAiChatTemplate: 'dartscript.dsNotes.tomAiChatTemplate',
    notes: 'dartscript.dsNotes.notes',
    tomNotepad: 'dartscript.dsNotes.tomNotepad'
};

// ============================================================================
// Config Loading
// ============================================================================

interface SendToChatConfig {
    templates: { [key: string]: { prefix: string; suffix: string; showInMenu?: boolean } };
    promptExpander: {
        profiles: { [key: string]: {
            label: string;
            systemPrompt?: string | null;
            resultTemplate?: string | null;
            temperature?: number | null;
            modelConfig?: string | null;
            toolsEnabled?: boolean;
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
}

function loadSendToChatConfig(): SendToChatConfig | null {
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

function saveSendToChatConfig(config: SendToChatConfig): boolean {
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

// ============================================================================
// Placeholder Expansion
// ============================================================================

async function expandPlaceholders(template: string): Promise<string> {
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
    
    // {{language}}, {{line}}
    if (editor) {
        result = result.replace(/\{\{language\}\}/gi, editor.document.languageId);
        result = result.replace(/\{\{line\}\}/gi, String(editor.selection.active.line + 1));
    } else {
        result = result.replace(/\{\{language\}\}/gi, '(no file)');
        result = result.replace(/\{\{line\}\}/gi, '(no editor)');
    }
    
    return result;
}

// ============================================================================
// Shared Styles
// ============================================================================

function getBaseStyles(): string {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            padding: 8px;
            height: 100vh;
            display: flex;
            flex-direction: column;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-panel-background);
            color: var(--vscode-foreground);
        }
        .toolbar {
            display: flex;
            gap: 4px;
            margin-bottom: 8px;
            flex-shrink: 0;
            flex-wrap: wrap;
            align-items: center;
        }
        .toolbar-row {
            display: flex;
            gap: 4px;
            width: 100%;
            align-items: center;
            margin-bottom: 4px;
        }
        .toolbar-row label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
        }
        button, select {
            padding: 4px 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            border-radius: 2px;
            font-size: 12px;
        }
        button:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
        button.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        button.primary:hover { background-color: var(--vscode-button-hoverBackground); }
        button.danger { color: var(--vscode-errorForeground); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        button.icon-btn {
            padding: 4px 6px;
            min-width: 24px;
        }
        select {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            flex: 1;
            min-width: 80px;
        }
        textarea {
            flex: 1;
            width: 100%;
            resize: none;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            padding: 8px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: var(--vscode-editor-font-size, 13px);
            line-height: 1.4;
            outline: none;
        }
        textarea:focus { border-color: var(--vscode-focusBorder); }
        .status-bar {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
            display: flex;
            justify-content: space-between;
        }
        .empty-state {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 20px;
        }
        .profile-info {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            padding: 4px 8px;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
            margin-bottom: 8px;
            max-height: 60px;
            overflow-y: auto;
        }
        .placeholder-help {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 8px;
            padding: 8px;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
        }
        .placeholder-help code {
            background: var(--vscode-textCodeBlock-background);
            padding: 1px 4px;
            border-radius: 2px;
        }
    `;
}

// ============================================================================
// Preview Panel - Centered in VS Code
// ============================================================================

let previewPanel: vscode.WebviewPanel | undefined;

async function showPreviewPanel(title: string, content: string, onSend: (text: string) => Promise<void>): Promise<void> {
    if (previewPanel) {
        previewPanel.dispose();
    }
    
    previewPanel = vscode.window.createWebviewPanel(
        'dsNotesPreview',
        `Preview: ${title}`,
        vscode.ViewColumn.Active,
        { enableScripts: true }
    );
    
    previewPanel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        padding: 20px;
        height: 100vh;
        display: flex;
        flex-direction: column;
        font-family: var(--vscode-font-family);
        background-color: var(--vscode-editor-background);
        color: var(--vscode-foreground);
    }
    h2 { margin-bottom: 16px; }
    textarea {
        flex: 1;
        width: 100%;
        resize: none;
        border: 1px solid var(--vscode-input-border);
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        padding: 12px;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: var(--vscode-editor-font-size, 13px);
        line-height: 1.5;
        border-radius: 4px;
    }
    .buttons {
        display: flex;
        gap: 12px;
        margin-top: 16px;
        justify-content: flex-end;
    }
    button {
        padding: 8px 16px;
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
    .info { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
</style>
</head>
<body>
    <h2>Preview</h2>
    <p class="info">Review and edit the expanded content before sending:</p>
    <textarea id="content">${escapeHtml(content)}</textarea>
    <div class="buttons">
        <button onclick="cancel()">Cancel</button>
        <button class="primary" onclick="send()">Send</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function cancel() { vscode.postMessage({ type: 'cancel' }); }
        function send() { vscode.postMessage({ type: 'send', content: document.getElementById('content').value }); }
    </script>
</body></html>`;
    
    previewPanel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === 'cancel') {
            previewPanel?.dispose();
        } else if (msg.type === 'send') {
            await onSend(msg.content);
            previewPanel?.dispose();
        }
    });
    
    previewPanel.onDidDispose(() => {
        previewPanel = undefined;
    });
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================================
// Template Editor Panel - For creating/editing templates
// ============================================================================

interface TemplateEditorConfig {
    type: 'copilot' | 'conversation' | 'tomAiChat' | 'localLlm';
    title: string;
    fields: {
        name: string;
        label: string;
        type: 'text' | 'textarea';
        placeholder?: string;
        value?: string;
        help?: string;
    }[];
}

let templateEditorPanel: vscode.WebviewPanel | undefined;

async function showTemplateEditorPanel(
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
        const inputHtml = f.type === 'textarea' 
            ? `<textarea id="${f.name}" placeholder="${escapeHtml(f.placeholder || '')}" rows="6">${escapeHtml(f.value || '')}</textarea>`
            : `<input type="text" id="${f.name}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value || '')}">`;
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

// Placeholder help text for templates
const PLACEHOLDER_HELP = `<strong>Available Placeholders:</strong><br>
<code>{{selection}}</code> - Current text selection<br>
<code>{{file}}</code> - Current file path (relative)<br>
<code>{{filename}}</code> - Current file name<br>
<code>{{filecontent}}</code> - Full file content<br>
<code>{{clipboard}}</code> - Clipboard contents<br>
<code>{{date}}</code> / <code>{{time}}</code> / <code>{{datetime}}</code> - Current date/time<br>
<code>{{workspace}}</code> - Workspace name<br>
<code>{{language}}</code> - File language ID<br>
<code>{{line}}</code> - Current line number`;

// ============================================================================
// TOM NOTEPAD (Simple explorer notepad with send to copilot)
// Uses file at ~/.tom/notes/global_notes.md for cross-window persistence
// ============================================================================

// Default global notes path (configurable)
const GLOBAL_NOTES_PATH = path.join(process.env.HOME || process.env.USERPROFILE || '', '.tom', 'notes', 'global_notes.md');

class TomNotepadProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _content: string = '';
    private _notesFilePath: string;
    private _fileWatcher?: vscode.FileSystemWatcher;
    private _disposables: vscode.Disposable[] = [];
    private _ignoreNextFileChange: boolean = false;
    private _lastSaveTime: number = 0;

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._notesFilePath = GLOBAL_NOTES_PATH;
        this._ensureFileExists();
        this._loadContent();
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    private _ensureFileExists(): void {
        const dir = path.dirname(this._notesFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this._notesFilePath)) {
            fs.writeFileSync(this._notesFilePath, '', 'utf-8');
        }
    }

    private _loadContent(): void {
        try {
            if (fs.existsSync(this._notesFilePath)) {
                this._content = fs.readFileSync(this._notesFilePath, 'utf-8');
            }
        } catch {
            this._content = '';
        }
    }

    private _saveContent(): void {
        try {
            this._ensureFileExists();
            this._ignoreNextFileChange = true;
            this._lastSaveTime = Date.now();
            fs.writeFileSync(this._notesFilePath, this._content, 'utf-8');
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to save notes: ${e}`);
        }
    }

    private _setupFileWatcher(): void {
        const pattern = new vscode.RelativePattern(vscode.Uri.file(path.dirname(this._notesFilePath)), path.basename(this._notesFilePath));
        this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        const handleFileChange = () => {
            // Ignore if we just saved (within 1 second)
            if (this._ignoreNextFileChange || Date.now() - this._lastSaveTime < 1000) {
                this._ignoreNextFileChange = false;
                return;
            }
            this._loadContent();
            this._sendState();
        };

        this._disposables.push(
            this._fileWatcher.onDidChange(handleFileChange),
            this._fileWatcher.onDidCreate(handleFileChange),
            this._fileWatcher
        );
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtml();

        this._setupFileWatcher();

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._loadContent();
                this._sendState();
            }
        });

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'ready':
                    this._sendState();
                    break;
                case 'updateContent':
                    this._content = msg.content;
                    this._saveContent();
                    break;
                case 'sendToCopilot':
                    await this._sendToCopilot();
                    break;
                case 'copy':
                    await vscode.env.clipboard.writeText(this._content);
                    vscode.window.showInformationMessage('Copied to clipboard');
                    break;
                case 'clear':
                    this._content = '';
                    this._saveContent();
                    this._sendState();
                    break;
                case 'openInEditor':
                    await this._openInEditor();
                    break;
            }
        });
    }

    private async _openInEditor(): Promise<void> {
        this._ensureFileExists();
        const doc = await vscode.workspace.openTextDocument(this._notesFilePath);
        await vscode.window.showTextDocument(doc);
    }

    private async _sendToCopilot(): Promise<void> {
        if (!this._content.trim()) {
            vscode.window.showWarningMessage('Notepad is empty');
            return;
        }
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: this._content });
    }

    private _sendState(): void {
        if (!this._view) { return; }
        this._view.webview.postMessage({
            type: 'state',
            content: this._content
        });
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <button class="primary icon-btn" onclick="sendToCopilot()" title="Send to Copilot">➤</button>
            <button class="icon-btn" onclick="copy()" title="Copy to Clipboard">📋</button>
            <button class="icon-btn" onclick="openInEditor()" title="Open in Editor">📄</button>
            <button class="danger icon-btn" onclick="clear()" title="Clear">🗑️</button>
        </div>
    </div>
    <textarea id="content" placeholder="Write your notes here..." oninput="updateContent()"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
        <span style="font-size:10px; color:var(--vscode-descriptionForeground);">~/.tom/notes/global_notes.md</span>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let saveTimeout;
        
        function updateContent() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                vscode.postMessage({ type: 'updateContent', content: document.getElementById('content').value });
            }, 300);
            document.getElementById('charCount').textContent = document.getElementById('content').value.length + ' chars';
        }
        function sendToCopilot() { vscode.postMessage({ type: 'sendToCopilot' }); }
        function copy() { vscode.postMessage({ type: 'copy' }); }
        function openInEditor() { vscode.postMessage({ type: 'openInEditor' }); }
        function clear() { 
            if (confirm('Clear notepad?')) {
                vscode.postMessage({ type: 'clear' }); 
            }
        }
        
        window.addEventListener('message', e => {
            if (e.data.type === 'state') {
                document.getElementById('content').value = e.data.content;
                document.getElementById('charCount').textContent = e.data.content.length + ' chars';
            }
        });
        
        document.addEventListener('DOMContentLoaded', () => vscode.postMessage({ type: 'ready' }));
    </script>
</body></html>`;
    }
}

// ============================================================================
// Copilot Notepad (uses templates section)
// ============================================================================

class CopilotNotepadProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _templates: { key: string; label: string; prefix: string; suffix: string }[] = [];
    private _selectedTemplate: string = '';
    private _draft: string = '';

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._loadDraft();
    }

    private _loadDraft(): void {
        this._draft = this._context.workspaceState.get<string>(STORAGE_KEYS.copilotDraft) || '';
        this._selectedTemplate = this._context.workspaceState.get<string>(STORAGE_KEYS.copilotTemplate) || '';
    }

    private async _saveDraft(): Promise<void> {
        await this._context.workspaceState.update(STORAGE_KEYS.copilotDraft, this._draft);
        await this._context.workspaceState.update(STORAGE_KEYS.copilotTemplate, this._selectedTemplate);
    }

    private _loadTemplates(): void {
        const config = loadSendToChatConfig();
        this._templates = [];
        // Add "(None)" option for raw prompt
        this._templates.push({ key: '__none__', label: '(None)', prefix: '', suffix: '' });
        if (config?.templates) {
            for (const [key, value] of Object.entries(config.templates)) {
                this._templates.push({
                    key,
                    label: key,
                    prefix: value.prefix,
                    suffix: value.suffix
                });
            }
        }
        if (!this._selectedTemplate && this._templates.length > 0) {
            this._selectedTemplate = this._templates[0].key;
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        
        this._loadTemplates();
        webviewView.webview.html = this._getHtml();

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._loadTemplates();
                this._sendState();
            }
        });

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'ready':
                    this._sendState();
                    break;
                case 'selectTemplate':
                    this._selectedTemplate = msg.key;
                    await this._saveDraft();
                    this._sendState();
                    break;
                case 'updateDraft':
                    this._draft = msg.content;
                    await this._saveDraft();
                    break;
                case 'preview':
                    await this._preview();
                    break;
                case 'send':
                    await this._send();
                    break;
                case 'addTemplate':
                    await this._addTemplate();
                    break;
                case 'editTemplate':
                    await this._editTemplate();
                    break;
                case 'deleteTemplate':
                    await this._deleteTemplate();
                    break;
            }
        });
    }

    private _sendState(): void {
        if (!this._view) { return; }
        const template = this._templates.find(t => t.key === this._selectedTemplate);
        this._view.webview.postMessage({
            type: 'state',
            templates: this._templates,
            selectedTemplate: this._selectedTemplate,
            draft: this._draft,
            templateInfo: template ? `Prefix: ${template.prefix.substring(0, 50)}...` : ''
        });
    }

    private async _preview(): Promise<void> {
        const template = this._templates.find(t => t.key === this._selectedTemplate);
        const prefix = template?.prefix || '';
        const suffix = template?.suffix || '';
        
        // Build preview showing template structure + draft
        let previewContent = '';
        if (prefix || suffix) {
            previewContent = `=== TEMPLATE: ${template?.label || 'None'} ===\n\n[PREFIX]\n${prefix}\n\n[YOUR INPUT]\n${this._draft}\n\n[SUFFIX]\n${suffix}\n\n=== FULL EXPANDED PROMPT ===\n${prefix}${this._draft}${suffix}`;
        } else {
            previewContent = this._draft;
        }
        
        const expanded = await expandPlaceholders(previewContent);
        await showPreviewPanel('Copilot', expanded, async (text) => {
            // Send only the combined prompt part
            const fullExpanded = await expandPlaceholders(prefix + this._draft + suffix);
            await vscode.commands.executeCommand('workbench.action.chat.open', { query: fullExpanded });
        });
    }

    private async _send(): Promise<void> {
        const template = this._templates.find(t => t.key === this._selectedTemplate);
        const prefix = template?.prefix || '';
        const suffix = template?.suffix || '';
        const full = prefix + this._draft + suffix;
        const expanded = await expandPlaceholders(full);
        
        // Trail: Log prompt being sent to Copilot
        loadTrailConfig();
        clearTrail('copilot');
        logPrompt('copilot', 'github_copilot', expanded, undefined, {
            template: template?.label || '(None)',
            templateKey: this._selectedTemplate || null,
            draftLength: this._draft.length,
        });
        
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: expanded });
    }

    private async _addTemplate(): Promise<void> {
        await showTemplateEditorPanel({
            type: 'copilot',
            title: 'New Copilot Template',
            fields: [
                { name: 'name', label: 'Template Name', type: 'text', placeholder: 'my_template' },
                { name: 'prefix', label: 'Prefix (added before your prompt)', type: 'textarea', placeholder: 'Please help me with the following:\\n\\n', help: PLACEHOLDER_HELP },
                { name: 'suffix', label: 'Suffix (added after your prompt)', type: 'textarea', placeholder: '\\n\\nUse best practices.' }
            ]
        }, async (values) => {
            if (!values.name) {
                vscode.window.showWarningMessage('Template name is required');
                return;
            }
            const config = loadSendToChatConfig();
            if (config) {
                config.templates[values.name] = { 
                    prefix: values.prefix || '', 
                    suffix: values.suffix || '', 
                    showInMenu: true 
                };
                if (saveSendToChatConfig(config)) {
                    this._loadTemplates();
                    this._selectedTemplate = values.name;
                    await this._saveDraft();
                    this._sendState();
                    vscode.window.showInformationMessage(`Template "${values.name}" added`);
                }
            }
        });
    }

    private async _editTemplate(): Promise<void> {
        if (!this._selectedTemplate) { return; }
        const template = this._templates.find(t => t.key === this._selectedTemplate);
        if (!template) { return; }

        await showTemplateEditorPanel({
            type: 'copilot',
            title: `Edit Template: ${this._selectedTemplate}`,
            fields: [
                { name: 'name', label: 'Template Name', type: 'text', placeholder: 'my_template', value: this._selectedTemplate },
                { name: 'prefix', label: 'Prefix (added before your prompt)', type: 'textarea', placeholder: 'Please help me with the following:\\n\\n', value: template.prefix, help: PLACEHOLDER_HELP },
                { name: 'suffix', label: 'Suffix (added after your prompt)', type: 'textarea', placeholder: '\\n\\nUse best practices.', value: template.suffix }
            ]
        }, async (values) => {
            if (!values.name) {
                vscode.window.showWarningMessage('Template name is required');
                return;
            }
            const config = loadSendToChatConfig();
            if (config) {
                // If name changed, delete old and create new
                if (values.name !== this._selectedTemplate) {
                    delete config.templates[this._selectedTemplate];
                }
                config.templates[values.name] = { 
                    prefix: values.prefix || '', 
                    suffix: values.suffix || '', 
                    showInMenu: true 
                };
                if (saveSendToChatConfig(config)) {
                    this._loadTemplates();
                    this._selectedTemplate = values.name;
                    await this._saveDraft();
                    this._sendState();
                    vscode.window.showInformationMessage(`Template "${values.name}" updated`);
                }
            }
        });
    }

    private async _deleteTemplate(): Promise<void> {
        if (!this._selectedTemplate) { return; }
        const confirm = await vscode.window.showWarningMessage(
            `Delete template "${this._selectedTemplate}"?`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') { return; }

        const config = loadSendToChatConfig();
        if (config && config.templates[this._selectedTemplate]) {
            delete config.templates[this._selectedTemplate];
            if (saveSendToChatConfig(config)) {
                this._loadTemplates();
                this._selectedTemplate = this._templates[0]?.key || '';
                await this._saveDraft();
                this._sendState();
                vscode.window.showInformationMessage('Template deleted');
            }
        }
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <label>Template:</label>
            <select id="templateSelect" onchange="selectTemplate(this.value)"></select>
            <button class="icon-btn" onclick="addTemplate()" title="Add Template">+</button>
            <button class="icon-btn" onclick="editTemplate()" title="Edit Template">✏️</button>
            <button class="icon-btn danger" onclick="deleteTemplate()" title="Delete Template">🗑️</button>
        </div>
        <div class="toolbar-row">
            <button onclick="preview()">Preview</button>
            <button class="primary" onclick="send()">Send to Copilot</button>
        </div>
    </div>
    <div id="templateInfo" class="profile-info" style="display:none;"></div>
    <textarea id="content" placeholder="Enter your prompt... The selected template's prefix/suffix will wrap this content." oninput="updateDraft()"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
    </div>
    <div class="placeholder-help">
        <strong>Placeholders:</strong> <code>{{selection}}</code>, <code>{{file}}</code>, <code>{{clipboard}}</code>, <code>{{date}}</code>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let templates = [], selectedTemplate = '', draft = '';
        
        function selectTemplate(key) { vscode.postMessage({ type: 'selectTemplate', key }); }
        function updateDraft() {
            draft = document.getElementById('content').value;
            vscode.postMessage({ type: 'updateDraft', content: draft });
            document.getElementById('charCount').textContent = draft.length + ' chars';
        }
        function preview() { vscode.postMessage({ type: 'preview' }); }
        function send() { vscode.postMessage({ type: 'send' }); }
        function addTemplate() { vscode.postMessage({ type: 'addTemplate' }); }
        function editTemplate() { vscode.postMessage({ type: 'editTemplate' }); }
        function deleteTemplate() { vscode.postMessage({ type: 'deleteTemplate' }); }
        
        function updateUI() {
            const select = document.getElementById('templateSelect');
            select.innerHTML = templates.map(t => 
                '<option value="' + t.key + '"' + (t.key === selectedTemplate ? ' selected' : '') + '>' + t.label + '</option>'
            ).join('');
            document.getElementById('content').value = draft;
            document.getElementById('charCount').textContent = draft.length + ' chars';
        }
        
        window.addEventListener('message', e => {
            if (e.data.type === 'state') {
                templates = e.data.templates;
                selectedTemplate = e.data.selectedTemplate;
                draft = e.data.draft;
                updateUI();
                const info = document.getElementById('templateInfo');
                if (e.data.templateInfo) {
                    info.textContent = e.data.templateInfo;
                    info.style.display = 'block';
                } else {
                    info.style.display = 'none';
                }
            }
        });
        
        document.addEventListener('DOMContentLoaded', () => vscode.postMessage({ type: 'ready' }));
    </script>
</body></html>`;
    }
}

// ============================================================================
// Local LLM Notepad (uses promptExpander.profiles)
// ============================================================================

class LocalLlmNotepadProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _profiles: { key: string; label: string; description?: string; systemPrompt?: string }[] = [];
    private _selectedProfile: string = '';
    private _draft: string = '';

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._loadDraft();
    }

    private _loadDraft(): void {
        this._draft = this._context.workspaceState.get<string>(STORAGE_KEYS.localLlmDraft) || '';
        this._selectedProfile = this._context.workspaceState.get<string>(STORAGE_KEYS.localLlmProfile) || '';
    }

    private async _saveDraft(): Promise<void> {
        await this._context.workspaceState.update(STORAGE_KEYS.localLlmDraft, this._draft);
        await this._context.workspaceState.update(STORAGE_KEYS.localLlmProfile, this._selectedProfile);
    }

    private _loadProfiles(): void {
        const config = loadSendToChatConfig();
        this._profiles = [];
        // Add "(None)" option for raw prompt
        this._profiles.push({ key: '__none__', label: '(None)', description: 'Send prompt as-is', systemPrompt: undefined });
        if (config?.promptExpander?.profiles) {
            for (const [key, value] of Object.entries(config.promptExpander.profiles)) {
                this._profiles.push({
                    key,
                    label: value.label || key,
                    description: value.systemPrompt?.substring(0, 100) || '',
                    systemPrompt: value.systemPrompt || undefined
                });
            }
        }
        if (!this._selectedProfile && this._profiles.length > 0) {
            this._selectedProfile = this._profiles[0].key;
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        
        this._loadProfiles();
        webviewView.webview.html = this._getHtml();

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._loadProfiles();
                this._sendState();
            }
        });

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'ready':
                    this._sendState();
                    break;
                case 'selectProfile':
                    this._selectedProfile = msg.key;
                    await this._saveDraft();
                    this._sendState();
                    break;
                case 'updateDraft':
                    this._draft = msg.content;
                    await this._saveDraft();
                    break;
                case 'preview':
                    await this._preview();
                    break;
                case 'send':
                    await this._send();
                    break;
                case 'showTrail':
                    await this._showTrail();
                    break;
                case 'addProfile':
                    await this._addProfile();
                    break;
                case 'editProfile':
                    await this._editProfile();
                    break;
                case 'deleteProfile':
                    await this._deleteProfile();
                    break;
            }
        });
    }

    private _sendState(): void {
        if (!this._view) { return; }
        const profile = this._profiles.find(p => p.key === this._selectedProfile);
        this._view.webview.postMessage({
            type: 'state',
            profiles: this._profiles,
            selectedProfile: this._selectedProfile,
            draft: this._draft,
            profileInfo: profile?.description || ''
        });
    }

    private async _preview(): Promise<void> {
        const profile = this._profiles.find(p => p.key === this._selectedProfile);
        const expandedUser = await expandPlaceholders(this._draft);
        
        // If there's a system prompt, show both; title indicates profile
        // The editable area should contain exactly what will be sent
        let previewContent = '';
        let title = `Local LLM - ${profile?.label || 'Default'}`;
        
        if (profile?.systemPrompt) {
            const expandedSystem = await expandPlaceholders(profile.systemPrompt);
            // User prompt is what gets sent, system prompt is separate API param
            previewContent = expandedUser;
            title += ' (has system prompt)';
        } else {
            previewContent = expandedUser;
        }
        
        await showPreviewPanel(title, previewContent, async (text) => {
            // Send the edited text
            await this._sendExpanded(text);
        });
    }

    private async _send(): Promise<void> {
        const expanded = await expandPlaceholders(this._draft);
        await this._sendExpanded(expanded);
    }

    private async _sendExpanded(text: string): Promise<void> {
        const manager = getPromptExpanderManager();
        if (!manager) {
            vscode.window.showErrorMessage('Local LLM not available - extension not fully initialized');
            return;
        }
        
        // Use __none__ as null profile for raw prompt
        const profileKey = this._selectedProfile === '__none__' ? null : this._selectedProfile;
        const profileLabel = this._selectedProfile === '__none__' ? 'None' : this._selectedProfile;
        
        try {
            const result = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Sending to Local LLM (${profileLabel})...`,
                    cancellable: true,
                },
                async (_progress, token) => {
                    return manager.process(text, profileKey, null, undefined, token);
                }
            );
            
            if (result.success) {
                // Write to trail file
                await this._appendToTrail(text, result.result, profileLabel);
                // Open the trail file
                await this._showTrail();
            } else {
                vscode.window.showErrorMessage(`Local LLM error: ${result.error || 'Unknown error'}`);
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Local LLM failed: ${e}`);
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
        
        // Ensure directory exists
        const dir = path.dirname(trailPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Build entry
        const timestamp = new Date().toISOString();
        const entry = `\n---\n\n## ${timestamp} (${profile})\n\n### Prompt\n\n${prompt}\n\n### Response\n\n${response}\n`;
        
        // Append to file
        fs.appendFileSync(trailPath, entry, 'utf-8');
    }

    private async _showTrail(): Promise<void> {
        const trailPath = this._getTrailFilePath();
        if (!trailPath) {
            vscode.window.showWarningMessage('No workspace folder');
            return;
        }
        
        if (!fs.existsSync(trailPath)) {
            // Create empty file with header
            const dir = path.dirname(trailPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(trailPath, '# Local LLM Chat Trail\n\nConversation history with local LLM.\n', 'utf-8');
        }
        
        const doc = await vscode.workspace.openTextDocument(trailPath);
        await vscode.window.showTextDocument(doc, { preview: false });
    }

    private async _addProfile(): Promise<void> {
        await showTemplateEditorPanel({
            type: 'localLlm',
            title: 'New Local LLM Profile',
            fields: [
                { name: 'name', label: 'Profile Key', type: 'text', placeholder: 'my_profile' },
                { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Profile' },
                { name: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful coding assistant...', help: PLACEHOLDER_HELP }
            ]
        }, async (values) => {
            if (!values.name) {
                vscode.window.showWarningMessage('Profile key is required');
                return;
            }
            const config = loadSendToChatConfig();
            if (config) {
                if (!config.promptExpander) {
                    config.promptExpander = { profiles: {} };
                }
                config.promptExpander.profiles[values.name] = { 
                    label: values.label || values.name, 
                    systemPrompt: values.systemPrompt || null, 
                    toolsEnabled: true 
                };
                if (saveSendToChatConfig(config)) {
                    this._loadProfiles();
                    this._selectedProfile = values.name;
                    await this._saveDraft();
                    this._sendState();
                    vscode.window.showInformationMessage(`Profile "${values.label || values.name}" added`);
                }
            }
        });
    }

    private async _editProfile(): Promise<void> {
        if (!this._selectedProfile) { return; }
        const profile = this._profiles.find(p => p.key === this._selectedProfile);
        if (!profile) { return; }

        const config = loadSendToChatConfig();
        const fullProfile = config?.promptExpander?.profiles?.[this._selectedProfile];

        await showTemplateEditorPanel({
            type: 'localLlm',
            title: `Edit Profile: ${profile.label}`,
            fields: [
                { name: 'name', label: 'Profile Key', type: 'text', placeholder: 'my_profile', value: this._selectedProfile },
                { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Profile', value: profile.label },
                { name: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful coding assistant...', value: fullProfile?.systemPrompt || '', help: PLACEHOLDER_HELP }
            ]
        }, async (values) => {
            if (!values.name) {
                vscode.window.showWarningMessage('Profile key is required');
                return;
            }
            const cfg = loadSendToChatConfig();
            if (cfg) {
                if (!cfg.promptExpander) {
                    cfg.promptExpander = { profiles: {} };
                }
                // If name changed, delete old
                if (values.name !== this._selectedProfile && cfg.promptExpander.profiles[this._selectedProfile]) {
                    delete cfg.promptExpander.profiles[this._selectedProfile];
                }
                cfg.promptExpander.profiles[values.name] = { 
                    label: values.label || values.name, 
                    systemPrompt: values.systemPrompt || null, 
                    toolsEnabled: true 
                };
                if (saveSendToChatConfig(cfg)) {
                    this._loadProfiles();
                    this._selectedProfile = values.name;
                    await this._saveDraft();
                    this._sendState();
                    vscode.window.showInformationMessage(`Profile "${values.label || values.name}" updated`);
                }
            }
        });
    }

    private async _deleteProfile(): Promise<void> {
        if (!this._selectedProfile) { return; }
        const profile = this._profiles.find(p => p.key === this._selectedProfile);
        const confirm = await vscode.window.showWarningMessage(
            `Delete profile "${profile?.label || this._selectedProfile}"?`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') { return; }

        const config = loadSendToChatConfig();
        if (config?.promptExpander?.profiles?.[this._selectedProfile]) {
            delete config.promptExpander.profiles[this._selectedProfile];
            if (saveSendToChatConfig(config)) {
                this._loadProfiles();
                this._selectedProfile = this._profiles[0]?.key || '';
                await this._saveDraft();
                this._sendState();
                vscode.window.showInformationMessage('Profile deleted');
            }
        }
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <label>Profile:</label>
            <select id="profileSelect" onchange="selectProfile(this.value)"></select>
            <button class="icon-btn" onclick="addProfile()" title="Add Profile">+</button>
            <button class="icon-btn" onclick="editProfile()" title="Edit Profile">✏️</button>
            <button class="icon-btn danger" onclick="deleteProfile()" title="Delete Profile">🗑️</button>
        </div>
        <div class="toolbar-row">
            <button onclick="preview()">Preview</button>
            <button class="primary" onclick="send()">Send to LLM</button>
            <button onclick="showTrail()" title="Open chat trail file">📜 Trail</button>
        </div>
    </div>
    <div id="profileInfo" class="profile-info" style="display:none;"></div>
    <textarea id="content" placeholder="Enter your prompt for the local LLM..." oninput="updateDraft()"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
    </div>
    <div class="placeholder-help">
        <strong>Placeholders:</strong> <code>{{selection}}</code>, <code>{{file}}</code>, <code>{{clipboard}}</code>, <code>{{date}}</code>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let profiles = [], selectedProfile = '', draft = '';
        
        function selectProfile(key) { vscode.postMessage({ type: 'selectProfile', key }); }
        function updateDraft() {
            draft = document.getElementById('content').value;
            vscode.postMessage({ type: 'updateDraft', content: draft });
            document.getElementById('charCount').textContent = draft.length + ' chars';
        }
        function preview() { vscode.postMessage({ type: 'preview' }); }
        function send() { vscode.postMessage({ type: 'send' }); }
        function showTrail() { vscode.postMessage({ type: 'showTrail' }); }
        function addProfile() { vscode.postMessage({ type: 'addProfile' }); }
        function editProfile() { vscode.postMessage({ type: 'editProfile' }); }
        function deleteProfile() { vscode.postMessage({ type: 'deleteProfile' }); }
        
        function updateUI() {
            const select = document.getElementById('profileSelect');
            select.innerHTML = profiles.map(p => 
                '<option value="' + p.key + '"' + (p.key === selectedProfile ? ' selected' : '') + '>' + p.label + '</option>'
            ).join('');
            document.getElementById('content').value = draft;
            document.getElementById('charCount').textContent = draft.length + ' chars';
        }
        
        window.addEventListener('message', e => {
            if (e.data.type === 'state') {
                profiles = e.data.profiles;
                selectedProfile = e.data.selectedProfile;
                draft = e.data.draft;
                updateUI();
                const info = document.getElementById('profileInfo');
                if (e.data.profileInfo) {
                    info.textContent = e.data.profileInfo;
                    info.style.display = 'block';
                } else {
                    info.style.display = 'none';
                }
            }
        });
        
        document.addEventListener('DOMContentLoaded', () => vscode.postMessage({ type: 'ready' }));
    </script>
</body></html>`;
    }
}

// ============================================================================
// Conversation Notepad (uses botConversation.profiles)
// ============================================================================

class ConversationNotepadProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _profiles: { key: string; label: string; description?: string; maxTurns?: number; initialPromptTemplate?: string }[] = [];
    private _selectedProfile: string = '';
    private _draft: string = '';

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._loadDraft();
    }

    private _loadDraft(): void {
        this._draft = this._context.workspaceState.get<string>(STORAGE_KEYS.conversationDraft) || '';
        this._selectedProfile = this._context.workspaceState.get<string>(STORAGE_KEYS.conversationProfile) || '';
    }

    private async _saveDraft(): Promise<void> {
        await this._context.workspaceState.update(STORAGE_KEYS.conversationDraft, this._draft);
        await this._context.workspaceState.update(STORAGE_KEYS.conversationProfile, this._selectedProfile);
    }

    private _loadProfiles(): void {
        const config = loadSendToChatConfig();
        this._profiles = [];
        // Add "(None)" option for raw prompt
        this._profiles.push({ key: '__none__', label: '(None)', description: 'Send prompt as-is', maxTurns: undefined, initialPromptTemplate: undefined });
        if (config?.botConversation?.profiles) {
            for (const [key, value] of Object.entries(config.botConversation.profiles)) {
                this._profiles.push({
                    key,
                    label: value.label || key,
                    description: value.description || value.goal || '',
                    maxTurns: value.maxTurns,
                    initialPromptTemplate: value.initialPromptTemplate || undefined
                });
            }
        }
        if (!this._selectedProfile && this._profiles.length > 0) {
            this._selectedProfile = this._profiles[0].key;
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        
        this._loadProfiles();
        webviewView.webview.html = this._getHtml();

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._loadProfiles();
                this._sendState();
            }
        });

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'ready':
                    this._sendState();
                    break;
                case 'selectProfile':
                    this._selectedProfile = msg.key;
                    await this._saveDraft();
                    this._sendState();
                    break;
                case 'updateDraft':
                    this._draft = msg.content;
                    await this._saveDraft();
                    break;
                case 'preview':
                    await this._preview();
                    break;
                case 'startConversation':
                    await this._startConversation();
                    break;
                case 'addProfile':
                    await this._addProfile();
                    break;
                case 'editProfile':
                    await this._editProfile();
                    break;
                case 'deleteProfile':
                    await this._deleteProfile();
                    break;
            }
        });
    }

    private _sendState(): void {
        if (!this._view) { return; }
        const profile = this._profiles.find(p => p.key === this._selectedProfile);
        this._view.webview.postMessage({
            type: 'state',
            profiles: this._profiles,
            selectedProfile: this._selectedProfile,
            draft: this._draft,
            profileInfo: profile ? `${profile.description}${profile.maxTurns ? ` (max ${profile.maxTurns} turns)` : ''}` : ''
        });
    }

    private async _preview(): Promise<void> {
        const profile = this._profiles.find(p => p.key === this._selectedProfile);
        let content = this._draft;
        
        // Build preview showing template + draft interaction
        let previewContent = '';
        if (profile?.initialPromptTemplate) {
            // Replace ${goal} with draft in template
            previewContent = profile.initialPromptTemplate.replace(/\$\{goal\}/gi, this._draft);
            // If template doesn't contain ${goal}, append draft
            if (!profile.initialPromptTemplate.toLowerCase().includes('${goal}')) {
                previewContent = `=== TEMPLATE (${profile.label}) ===\n${profile.initialPromptTemplate}\n\n=== YOUR INPUT ===\n${this._draft}`;
            }
        } else {
            previewContent = `=== Profile: ${profile?.label || 'None'} ===\n\n${this._draft}`;
        }
        
        const expanded = await expandPlaceholders(previewContent);
        await showPreviewPanel('AI Conversation', expanded, async (text) => {
            await this._startConversationWithGoal(text);
        });
    }

    private async _startConversation(): Promise<void> {
        const expanded = await expandPlaceholders(this._draft);
        await this._startConversationWithGoal(expanded);
    }

    private async _startConversationWithGoal(goal: string): Promise<void> {
        // Use null for __none__ profile to send raw prompt
        const profileKey = this._selectedProfile === '__none__' ? null : this._selectedProfile;
        const profile = this._profiles.find(p => p.key === this._selectedProfile);
        
        // Trail: Log conversation start
        loadTrailConfig();
        logPrompt('conversation', 'bot_conversation', goal, undefined, {
            profile: profile?.label || '(None)',
            profileKey: profileKey || null,
            maxTurns: profile?.maxTurns || 10,
        });
        
        try {
            await vscode.commands.executeCommand('dartscript.startBotConversation', {
                goal,
                profileKey
            });
        } catch {
            vscode.window.showInformationMessage(`Start conversation (profile: ${profileKey || 'None'}): ${goal.substring(0, 50)}...`);
        }
    }

    private async _addProfile(): Promise<void> {
        await showTemplateEditorPanel({
            type: 'conversation',
            title: 'New Conversation Profile',
            fields: [
                { name: 'name', label: 'Profile Key', type: 'text', placeholder: 'my_conversation' },
                { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Conversation' },
                { name: 'description', label: 'Description', type: 'text', placeholder: 'What this conversation does...' },
                { name: 'maxTurns', label: 'Max Turns', type: 'text', placeholder: '10' },
                { name: 'initialPromptTemplate', label: 'Initial Prompt Template', type: 'textarea', placeholder: 'Goal: {{goal}}\\n\\nPlease help me...', help: `Use <code>{{goal}}</code> to insert the user\'s prompt.<br><br>${PLACEHOLDER_HELP}` }
            ]
        }, async (values) => {
            if (!values.name) {
                vscode.window.showWarningMessage('Profile key is required');
                return;
            }
            const maxTurns = values.maxTurns ? parseInt(values.maxTurns, 10) : 10;
            const config = loadSendToChatConfig();
            if (config) {
                if (!config.botConversation) {
                    config.botConversation = { profiles: {} };
                }
                config.botConversation.profiles[values.name] = { 
                    label: values.label || values.name, 
                    description: values.description || '', 
                    maxTurns,
                    initialPromptTemplate: values.initialPromptTemplate || null
                };
                if (saveSendToChatConfig(config)) {
                    this._loadProfiles();
                    this._selectedProfile = values.name;
                    await this._saveDraft();
                    this._sendState();
                    vscode.window.showInformationMessage(`Profile "${values.label || values.name}" added`);
                }
            }
        });
    }

    private async _editProfile(): Promise<void> {
        if (!this._selectedProfile) { return; }
        const profile = this._profiles.find(p => p.key === this._selectedProfile);
        if (!profile) { return; }

        const config = loadSendToChatConfig();
        const fullProfile = config?.botConversation?.profiles?.[this._selectedProfile];

        await showTemplateEditorPanel({
            type: 'conversation',
            title: `Edit Profile: ${profile.label}`,
            fields: [
                { name: 'name', label: 'Profile Key', type: 'text', placeholder: 'my_conversation', value: this._selectedProfile },
                { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Conversation', value: profile.label },
                { name: 'description', label: 'Description', type: 'text', placeholder: 'What this conversation does...', value: profile.description || '' },
                { name: 'maxTurns', label: 'Max Turns', type: 'text', placeholder: '10', value: String(profile.maxTurns || 10) },
                { name: 'initialPromptTemplate', label: 'Initial Prompt Template', type: 'textarea', placeholder: 'Goal: ${goal}\\n\\nPlease help me...', value: fullProfile?.initialPromptTemplate || '', help: `Use <code>\${goal}</code> to insert the user\'s prompt.<br><br>${PLACEHOLDER_HELP}` }
            ]
        }, async (values) => {
            if (!values.name) {
                vscode.window.showWarningMessage('Profile key is required');
                return;
            }
            const maxTurns = values.maxTurns ? parseInt(values.maxTurns, 10) : 10;
            const cfg = loadSendToChatConfig();
            if (cfg) {
                if (!cfg.botConversation) {
                    cfg.botConversation = { profiles: {} };
                }
                // If name changed, delete old
                if (values.name !== this._selectedProfile && cfg.botConversation.profiles[this._selectedProfile]) {
                    delete cfg.botConversation.profiles[this._selectedProfile];
                }
                cfg.botConversation.profiles[values.name] = { 
                    label: values.label || values.name, 
                    description: values.description || '', 
                    maxTurns,
                    initialPromptTemplate: values.initialPromptTemplate || null
                };
                if (saveSendToChatConfig(cfg)) {
                    this._loadProfiles();
                    this._selectedProfile = values.name;
                    await this._saveDraft();
                    this._sendState();
                    vscode.window.showInformationMessage(`Profile "${values.label || values.name}" updated`);
                }
            }
        });
    }

    private async _deleteProfile(): Promise<void> {
        if (!this._selectedProfile) { return; }
        const profile = this._profiles.find(p => p.key === this._selectedProfile);
        const confirm = await vscode.window.showWarningMessage(
            `Delete profile "${profile?.label || this._selectedProfile}"?`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') { return; }

        const config = loadSendToChatConfig();
        if (config?.botConversation?.profiles?.[this._selectedProfile]) {
            delete config.botConversation.profiles[this._selectedProfile];
            if (saveSendToChatConfig(config)) {
                this._loadProfiles();
                this._selectedProfile = this._profiles[0]?.key || '';
                await this._saveDraft();
                this._sendState();
                vscode.window.showInformationMessage('Profile deleted');
            }
        }
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <label>Profile:</label>
            <select id="profileSelect" onchange="selectProfile(this.value)"></select>
            <button class="icon-btn" onclick="addProfile()" title="Add Profile">+</button>
            <button class="icon-btn" onclick="editProfile()" title="Edit Profile">✏️</button>
            <button class="icon-btn danger" onclick="deleteProfile()" title="Delete Profile">🗑️</button>
        </div>
        <div class="toolbar-row">
            <button onclick="preview()">Preview</button>
            <button class="primary" onclick="startConversation()">Start Conversation</button>
        </div>
    </div>
    <div id="profileInfo" class="profile-info" style="display:none;"></div>
    <textarea id="content" placeholder="Enter your goal/description for the conversation..." oninput="updateDraft()"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
    </div>
    <div class="placeholder-help">
        <strong>Tip:</strong> Describe the goal clearly. The bot will orchestrate a multi-turn conversation with Copilot.
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let profiles = [], selectedProfile = '', draft = '';
        
        function selectProfile(key) { vscode.postMessage({ type: 'selectProfile', key }); }
        function updateDraft() {
            draft = document.getElementById('content').value;
            vscode.postMessage({ type: 'updateDraft', content: draft });
            document.getElementById('charCount').textContent = draft.length + ' chars';
        }
        function preview() { vscode.postMessage({ type: 'preview' }); }
        function startConversation() { vscode.postMessage({ type: 'startConversation' }); }
        function addProfile() { vscode.postMessage({ type: 'addProfile' }); }
        function editProfile() { vscode.postMessage({ type: 'editProfile' }); }
        function deleteProfile() { vscode.postMessage({ type: 'deleteProfile' }); }
        
        function updateUI() {
            const select = document.getElementById('profileSelect');
            select.innerHTML = profiles.map(p => 
                '<option value="' + p.key + '"' + (p.key === selectedProfile ? ' selected' : '') + '>' + p.label + '</option>'
            ).join('');
            document.getElementById('content').value = draft;
            document.getElementById('charCount').textContent = draft.length + ' chars';
        }
        
        window.addEventListener('message', e => {
            if (e.data.type === 'state') {
                profiles = e.data.profiles;
                selectedProfile = e.data.selectedProfile;
                draft = e.data.draft;
                updateUI();
                const info = document.getElementById('profileInfo');
                if (e.data.profileInfo) {
                    info.textContent = e.data.profileInfo;
                    info.style.display = 'block';
                } else {
                    info.style.display = 'none';
                }
            }
        });
        
        document.addEventListener('DOMContentLoaded', () => vscode.postMessage({ type: 'ready' }));
    </script>
</body></html>`;
    }
}

// ============================================================================
// Tom AI Chat Notepad (uses tomAiChat.templates)
// ============================================================================

class TomAiChatNotepadProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _templates: { key: string; label: string; description?: string; contextInstructions?: string }[] = [];
    private _selectedTemplate: string = '';
    private _draft: string = '';

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._loadDraft();
    }

    private _loadDraft(): void {
        this._draft = this._context.workspaceState.get<string>(STORAGE_KEYS.tomAiChatDraft) || '';
        this._selectedTemplate = this._context.workspaceState.get<string>(STORAGE_KEYS.tomAiChatTemplate) || '';
    }

    private async _saveDraft(): Promise<void> {
        await this._context.workspaceState.update(STORAGE_KEYS.tomAiChatDraft, this._draft);
        await this._context.workspaceState.update(STORAGE_KEYS.tomAiChatTemplate, this._selectedTemplate);
    }

    private _loadTemplates(): void {
        const config = loadSendToChatConfig();
        this._templates = [];
        
        // Add "(None)" option for raw prompt
        this._templates.push({ key: '__none__', label: '(None)', description: 'Send prompt as-is', contextInstructions: '' });
        
        if (config?.tomAiChat?.templates) {
            for (const [key, value] of Object.entries(config.tomAiChat.templates)) {
                this._templates.push({
                    key,
                    label: value.label || key,
                    description: value.description || '',
                    contextInstructions: value.contextInstructions || ''
                });
            }
        }
        
        if (this._templates.length === 1) {
            // Only "(None)" exists, add defaults
            this._templates.push(
                { key: 'standard', label: 'Standard', description: 'General-purpose prompt', contextInstructions: '' },
                { key: 'implement', label: 'Implement', description: 'Implement a feature', contextInstructions: 'Focus on implementation, testing, and documentation.' },
                { key: 'debug', label: 'Debug', description: 'Debug an issue', contextInstructions: 'Focus on finding root cause and fixing the issue.' }
            );
        }
        
        if (!this._selectedTemplate && this._templates.length > 0) {
            this._selectedTemplate = this._templates[0].key;
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        
        this._loadTemplates();
        webviewView.webview.html = this._getHtml();

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._loadTemplates();
                this._sendState();
            }
        });

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'ready':
                    this._sendState();
                    break;
                case 'selectTemplate':
                    this._selectedTemplate = msg.key;
                    await this._saveDraft();
                    this._sendState();
                    break;
                case 'updateDraft':
                    this._draft = msg.content;
                    await this._saveDraft();
                    break;
                case 'preview':
                    await this._preview();
                    break;
                case 'insertToChatFile':
                    await this._insertToChatFile();
                    break;
                case 'openChatFile':
                    await this._openOrCreateChatFile();
                    break;
                case 'addTemplate':
                    await this._addTemplate();
                    break;
                case 'editTemplate':
                    await this._editTemplate();
                    break;
                case 'deleteTemplate':
                    await this._deleteTemplate();
                    break;
            }
        });
    }

    private _sendState(): void {
        if (!this._view) { return; }
        const template = this._templates.find(t => t.key === this._selectedTemplate);
        this._view.webview.postMessage({
            type: 'state',
            templates: this._templates,
            selectedTemplate: this._selectedTemplate,
            draft: this._draft,
            templateInfo: template ? `${template.description}${template.contextInstructions ? '\n' + template.contextInstructions : ''}` : ''
        });
    }

    private async _preview(): Promise<void> {
        const template = this._templates.find(t => t.key === this._selectedTemplate);
        let content = this._draft;
        if (template?.contextInstructions) {
            content = template.contextInstructions + '\n\n' + content;
        }
        const expanded = await expandPlaceholders(content);
        await showPreviewPanel('Tom AI Chat', expanded, async (text) => {
            await this._insertExpandedToChatFile(text);
        });
    }

    private async _insertToChatFile(): Promise<void> {
        const template = this._templates.find(t => t.key === this._selectedTemplate);
        let content = this._draft;
        if (template?.contextInstructions) {
            content = template.contextInstructions + '\n\n' + content;
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

    private async _openOrCreateChatFile(): Promise<void> {
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

    private async _addTemplate(): Promise<void> {
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
            if (!values.name) {
                vscode.window.showWarningMessage('Template key is required');
                return;
            }
            const config = loadSendToChatConfig();
            if (config) {
                if (!config.tomAiChat) {
                    config.tomAiChat = { templates: {} };
                }
                if (!config.tomAiChat.templates) {
                    config.tomAiChat.templates = {};
                }
                config.tomAiChat.templates[values.name] = { 
                    label: values.label || values.name, 
                    description: values.description || '', 
                    contextInstructions: values.contextInstructions || '' 
                };
                if (saveSendToChatConfig(config)) {
                    this._loadTemplates();
                    this._selectedTemplate = values.name;
                    await this._saveDraft();
                    this._sendState();
                    vscode.window.showInformationMessage(`Template "${values.label || values.name}" added`);
                }
            }
        });
    }

    private async _editTemplate(): Promise<void> {
        if (!this._selectedTemplate) { return; }
        const template = this._templates.find(t => t.key === this._selectedTemplate);
        if (!template) { return; }

        await showTemplateEditorPanel({
            type: 'tomAiChat',
            title: `Edit Template: ${template.label}`,
            fields: [
                { name: 'name', label: 'Template Key', type: 'text', placeholder: 'my_template', value: this._selectedTemplate },
                { name: 'label', label: 'Display Label', type: 'text', placeholder: 'My Template', value: template.label },
                { name: 'description', label: 'Description', type: 'text', placeholder: 'What this template is for...', value: template.description || '' },
                { name: 'contextInstructions', label: 'Context Instructions (prepended to your prompt)', type: 'textarea', placeholder: 'Focus on implementation...', value: template.contextInstructions || '', help: PLACEHOLDER_HELP }
            ]
        }, async (values) => {
            if (!values.name) {
                vscode.window.showWarningMessage('Template key is required');
                return;
            }
            const config = loadSendToChatConfig();
            if (config) {
                if (!config.tomAiChat) {
                    config.tomAiChat = { templates: {} };
                }
                if (!config.tomAiChat.templates) {
                    config.tomAiChat.templates = {};
                }
                // If name changed, delete old
                if (values.name !== this._selectedTemplate && config.tomAiChat.templates[this._selectedTemplate]) {
                    delete config.tomAiChat.templates[this._selectedTemplate];
                }
                config.tomAiChat.templates[values.name] = { 
                    label: values.label || values.name, 
                    description: values.description || '', 
                    contextInstructions: values.contextInstructions || '' 
                };
                if (saveSendToChatConfig(config)) {
                    this._loadTemplates();
                    this._selectedTemplate = values.name;
                    await this._saveDraft();
                    this._sendState();
                    vscode.window.showInformationMessage(`Template "${values.label || values.name}" updated`);
                }
            }
        });
    }

    private async _deleteTemplate(): Promise<void> {
        if (!this._selectedTemplate) { return; }
        const template = this._templates.find(t => t.key === this._selectedTemplate);
        const confirm = await vscode.window.showWarningMessage(
            `Delete template "${template?.label || this._selectedTemplate}"?`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') { return; }

        const config = loadSendToChatConfig();
        if (config?.tomAiChat?.templates?.[this._selectedTemplate]) {
            delete config.tomAiChat.templates[this._selectedTemplate];
            if (saveSendToChatConfig(config)) {
                this._loadTemplates();
                this._selectedTemplate = this._templates[0]?.key || '';
                await this._saveDraft();
                this._sendState();
                vscode.window.showInformationMessage('Template deleted');
            }
        }
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <label>Template:</label>
            <select id="templateSelect" onchange="selectTemplate(this.value)"></select>
            <button class="icon-btn" onclick="addTemplate()" title="Add Template">+</button>
            <button class="icon-btn" onclick="editTemplate()" title="Edit Template">✏️</button>
            <button class="icon-btn danger" onclick="deleteTemplate()" title="Delete Template">🗑️</button>
        </div>
        <div class="toolbar-row">
            <button onclick="openChatFile()">Open Chat</button>
            <button onclick="preview()">Preview</button>
            <button class="primary" onclick="insertToChatFile()">Insert</button>
        </div>
    </div>
    <div id="templateInfo" class="profile-info" style="display:none;"></div>
    <textarea id="content" placeholder="Enter your prompt for Tom AI Chat..." oninput="updateDraft()"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
    </div>
    <div class="placeholder-help">
        <strong>Tip:</strong> Write your prompt, then click "Insert" to add it to an open .chat.md file.
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let templates = [], selectedTemplate = '', draft = '';
        
        function selectTemplate(key) { vscode.postMessage({ type: 'selectTemplate', key }); }
        function updateDraft() {
            draft = document.getElementById('content').value;
            vscode.postMessage({ type: 'updateDraft', content: draft });
            document.getElementById('charCount').textContent = draft.length + ' chars';
        }
        function preview() { vscode.postMessage({ type: 'preview' }); }
        function insertToChatFile() { vscode.postMessage({ type: 'insertToChatFile' }); }
        function openChatFile() { vscode.postMessage({ type: 'openChatFile' }); }
        function addTemplate() { vscode.postMessage({ type: 'addTemplate' }); }
        function editTemplate() { vscode.postMessage({ type: 'editTemplate' }); }
        function deleteTemplate() { vscode.postMessage({ type: 'deleteTemplate' }); }
        
        function updateUI() {
            const select = document.getElementById('templateSelect');
            select.innerHTML = templates.map(t => 
                '<option value="' + t.key + '"' + (t.key === selectedTemplate ? ' selected' : '') + '>' + t.label + '</option>'
            ).join('');
            document.getElementById('content').value = draft;
            document.getElementById('charCount').textContent = draft.length + ' chars';
        }
        
        window.addEventListener('message', e => {
            if (e.data.type === 'state') {
                templates = e.data.templates;
                selectedTemplate = e.data.selectedTemplate;
                draft = e.data.draft;
                updateUI();
                const info = document.getElementById('templateInfo');
                if (e.data.templateInfo) {
                    info.textContent = e.data.templateInfo;
                    info.style.display = 'block';
                } else {
                    info.style.display = 'none';
                }
            }
        });
        
        document.addEventListener('DOMContentLoaded', () => vscode.postMessage({ type: 'ready' }));
    </script>
</body></html>`;
    }
}

// ============================================================================
// Notes Notepad (simple multi-note storage, no templates)
// ============================================================================

interface NoteItem {
    id: string;
    title: string;
    filePath: string;
    content: string;
}

// Default notes folder (configurable via settings)
const NOTES_FOLDER = '_ai/notes';

class NotesNotepadProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _notes: NoteItem[] = [];
    private _activeNoteId: string | null = null;
    private _notesFolder: string | null = null;
    private _fileWatcher?: vscode.FileSystemWatcher;
    private _disposables: vscode.Disposable[] = [];

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._initNotesFolder();
        this._loadNotes();
        // Remember active note ID
        this._activeNoteId = this._context.workspaceState.get<string>('dartscript.dsNotes.activeNoteFile') || null;
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    private _initNotesFolder(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this._notesFolder = path.join(workspaceFolder.uri.fsPath, NOTES_FOLDER);
            // Create folder if it doesn't exist
            if (!fs.existsSync(this._notesFolder)) {
                fs.mkdirSync(this._notesFolder, { recursive: true });
            }
        }
    }

    private _setupFileWatcher(): void {
        if (!this._notesFolder) { return; }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        const pattern = new vscode.RelativePattern(workspaceFolder, `${NOTES_FOLDER}/*.md`);
        this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        const reload = () => {
            this._loadNotes();
            this._sendState();
        };

        this._disposables.push(
            this._fileWatcher.onDidCreate(reload),
            this._fileWatcher.onDidDelete(reload),
            this._fileWatcher.onDidChange((uri) => {
                if (this._activeNoteId && uri.fsPath.endsWith(this._activeNoteId)) {
                    this._sendState();
                }
            }),
            this._fileWatcher
        );
    }

    private _loadNotes(): void {
        if (!this._notesFolder) { return; }
        try {
            const files = fs.readdirSync(this._notesFolder)
                .filter(f => f.endsWith('.md'))
                .sort();
            this._notes = files.map(f => ({
                id: f,
                title: f.replace(/\.md$/, ''),
                filePath: path.join(this._notesFolder!, f),
                content: ''
            }));
        } catch {
            this._notes = [];
        }
    }

    private _loadNoteContent(noteId: string): string {
        const note = this._notes.find(n => n.id === noteId);
        if (!note) { return ''; }
        try {
            return fs.readFileSync(note.filePath, 'utf-8');
        } catch {
            return '';
        }
    }

    private _saveNoteContent(noteId: string, content: string): void {
        const note = this._notes.find(n => n.id === noteId);
        if (!note) { return; }
        try {
            fs.writeFileSync(note.filePath, content, 'utf-8');
            note.content = content;
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to save note: ${e}`);
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtml();

        this._setupFileWatcher();

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._loadNotes();
                this._sendState();
            }
        });

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'ready':
                    this._sendState();
                    break;
                case 'requestAddNote':
                    await this._requestAddNote();
                    break;
                case 'selectNote':
                    this._activeNoteId = msg.id;
                    await this._context.workspaceState.update('dartscript.dsNotes.activeNoteFile', this._activeNoteId);
                    this._sendState();
                    break;
                case 'deleteNote':
                    await this._deleteNote(msg.id);
                    break;
                case 'updateContent':
                    if (this._activeNoteId) {
                        this._saveNoteContent(this._activeNoteId, msg.content);
                    }
                    break;
                case 'openInEditor':
                    await this._openInEditor();
                    break;
            }
        });
    }

    private async _requestAddNote(): Promise<void> {
        const fileName = await vscode.window.showInputBox({
            prompt: 'Note file name (no path, no extension)',
            placeHolder: 'my_note',
            validateInput: (value) => {
                if (!value) { return 'File name is required'; }
                if (value.includes('/') || value.includes('\\\\')) { return 'Path separators not allowed'; }
                if (value.includes('.')) { return 'Extension not allowed (will be .md)'; }
                return null;
            }
        });
        if (fileName) {
            await this._addNote(fileName);
        }
    }

    private async _addNote(fileName: string): Promise<void> {
        if (!this._notesFolder) { return; }
        const filePath = path.join(this._notesFolder, `${fileName}.md`);
        
        if (fs.existsSync(filePath)) {
            vscode.window.showWarningMessage(`Note "${fileName}.md" already exists`);
            return;
        }
        
        try {
            fs.writeFileSync(filePath, '', 'utf-8');
            this._loadNotes();
            this._activeNoteId = `${fileName}.md`;
            await this._context.workspaceState.update('dartscript.dsNotes.activeNoteFile', this._activeNoteId);
            this._sendState();
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to create note: ${e}`);
        }
    }

    private async _deleteNote(id: string): Promise<void> {
        const note = this._notes.find(n => n.id === id);
        if (!note) { return; }
        
        const confirm = await vscode.window.showWarningMessage(
            `Delete note "${note.title}"? This will delete the file.`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') { return; }
        
        try {
            fs.unlinkSync(note.filePath);
            this._loadNotes();
            if (this._activeNoteId === id) {
                this._activeNoteId = this._notes.length > 0 ? this._notes[0].id : null;
                await this._context.workspaceState.update('dartscript.dsNotes.activeNoteFile', this._activeNoteId);
            }
            this._sendState();
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to delete note: ${e}`);
        }
    }

    private async _openInEditor(): Promise<void> {
        if (!this._activeNoteId) { return; }
        const note = this._notes.find(n => n.id === this._activeNoteId);
        if (!note) { return; }
        
        const doc = await vscode.workspace.openTextDocument(note.filePath);
        await vscode.window.showTextDocument(doc);
    }

    private _sendState(): void {
        if (!this._view) { return; }
        const content = this._activeNoteId ? this._loadNoteContent(this._activeNoteId) : '';
        this._view.webview.postMessage({
            type: 'state',
            notes: this._notes.map(n => ({ id: n.id, title: n.title })),
            activeNoteId: this._activeNoteId,
            content
        });
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <select id="noteSelect" onchange="selectNote(this.value)"></select>
            <button class="icon-btn" onclick="addNote()" title="Add Note">+</button>
            <button class="icon-btn" onclick="openInEditor()" title="Open in Editor">📄</button>
            <button class="icon-btn danger" onclick="deleteNote()" title="Delete Note">🗑️</button>
        </div>
    </div>
    <div id="emptyState" class="empty-state" style="display:none;">
        No notes yet. Click "+" to create one.
    </div>
    <textarea id="content" placeholder="Write your notes here..." oninput="updateContent()"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
        <span id="location" style="font-size:10px; color:var(--vscode-descriptionForeground);">_ai/notes/</span>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let notes = [], activeNoteId = null;
        let saveTimeout;
        
        function addNote() { vscode.postMessage({ type: 'requestAddNote' }); }
        function selectNote(id) { vscode.postMessage({ type: 'selectNote', id }); }
        function openInEditor() { vscode.postMessage({ type: 'openInEditor' }); }
        function deleteNote() {
            if (activeNoteId) {
                vscode.postMessage({ type: 'deleteNote', id: activeNoteId });
            }
        }
        function updateContent() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                vscode.postMessage({ type: 'updateContent', content: document.getElementById('content').value });
            }, 500);
            document.getElementById('charCount').textContent = document.getElementById('content').value.length + ' chars';
        }
        
        function updateUI() {
            const select = document.getElementById('noteSelect');
            const textarea = document.getElementById('content');
            const empty = document.getElementById('emptyState');
            
            select.innerHTML = notes.map(n => 
                '<option value="' + n.id + '"' + (n.id === activeNoteId ? ' selected' : '') + '>' + n.title + '</option>'
            ).join('');
            
            empty.style.display = notes.length === 0 ? 'flex' : 'none';
            textarea.style.display = notes.length > 0 ? 'block' : 'none';
        }
        
        window.addEventListener('message', e => {
            if (e.data.type === 'state') {
                notes = e.data.notes;
                activeNoteId = e.data.activeNoteId;
                document.getElementById('content').value = e.data.content;
                document.getElementById('charCount').textContent = e.data.content.length + ' chars';
                updateUI();
            }
        });
        
        document.addEventListener('DOMContentLoaded', () => vscode.postMessage({ type: 'ready' }));
    </script>
</body></html>`;
    }
}

// ============================================================================
// Guidelines Notepad (file-based, no templates)
// ============================================================================

class GuidelinesNotepadProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _files: { path: string; name: string }[] = [];
    private _activeFilePath: string | null = null;
    private _content: string = '';
    private _fileWatcher?: vscode.FileSystemWatcher;
    private _disposables: vscode.Disposable[] = [];

    constructor(private readonly _context: vscode.ExtensionContext) {}

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtml();

        this._setupFileWatcher();

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._loadFiles();
                this._sendState();
            }
        });

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'ready':
                    this._loadFiles();
                    this._sendState();
                    break;
                case 'selectFile':
                    this._activeFilePath = msg.path;
                    this._loadContent();
                    this._sendState();
                    break;
                case 'saveContent':
                    await this._saveContent(msg.content);
                    break;
                case 'addFile':
                    await this._addFile();
                    break;
                case 'deleteFile':
                    await this._deleteFile(msg.path);
                    break;
                case 'openInEditor':
                    await this._openInEditor();
                    break;
                case 'reload':
                    this._loadFiles();
                    this._sendState();
                    break;
            }
        });
    }

    private _setupFileWatcher(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        const pattern = new vscode.RelativePattern(workspaceFolder, '_copilot_guidelines/**/*.md');
        this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        const reload = () => {
            this._loadFiles();
            this._sendState();
        };

        this._disposables.push(
            this._fileWatcher.onDidCreate(reload),
            this._fileWatcher.onDidDelete(reload),
            this._fileWatcher.onDidChange((uri) => {
                if (uri.fsPath === this._activeFilePath) {
                    this._loadContent();
                    this._sendState();
                }
            }),
            this._fileWatcher
        );
    }

    private _loadFiles(): void {
        this._files = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        const rootPath = workspaceFolder.uri.fsPath;

        const instructionsPath = path.join(rootPath, '.github', 'copilot-instructions.md');
        if (fs.existsSync(instructionsPath)) {
            this._files.push({ path: instructionsPath, name: '📋 copilot-instructions.md' });
        }

        const guidelinesDir = path.join(rootPath, '_copilot_guidelines');
        if (fs.existsSync(guidelinesDir)) {
            const files = fs.readdirSync(guidelinesDir).filter(f => f.endsWith('.md')).sort();
            for (const file of files) {
                const filePath = path.join(guidelinesDir, file);
                if (fs.statSync(filePath).isFile()) {
                    this._files.push({ path: filePath, name: file });
                }
            }
        }

        if (this._files.length > 0 && !this._activeFilePath) {
            this._activeFilePath = this._files[0].path;
        }
        this._loadContent();
    }

    private _loadContent(): void {
        if (this._activeFilePath && fs.existsSync(this._activeFilePath)) {
            this._content = fs.readFileSync(this._activeFilePath, 'utf-8');
        } else {
            this._content = '';
        }
    }

    private async _saveContent(content: string): Promise<void> {
        if (this._activeFilePath) {
            fs.writeFileSync(this._activeFilePath, content, 'utf-8');
            this._content = content;
        }
    }

    private async _addFile(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        const name = await vscode.window.showInputBox({
            prompt: 'Guideline file name',
            placeHolder: 'my_guideline.md'
        });
        if (!name) { return; }

        let fileName = name.trim();
        if (!fileName.endsWith('.md')) { fileName += '.md'; }

        const guidelinesDir = path.join(workspaceFolder.uri.fsPath, '_copilot_guidelines');
        if (!fs.existsSync(guidelinesDir)) {
            fs.mkdirSync(guidelinesDir, { recursive: true });
        }

        const filePath = path.join(guidelinesDir, fileName);
        if (fs.existsSync(filePath)) {
            vscode.window.showErrorMessage(`File ${fileName} already exists`);
            return;
        }

        const title = fileName.replace('.md', '').replace(/_/g, ' ');
        fs.writeFileSync(filePath, `# ${title}\n\n`, 'utf-8');
        
        this._loadFiles();
        this._activeFilePath = filePath;
        this._loadContent();
        this._sendState();
        vscode.window.showInformationMessage(`Created ${fileName}`);
    }

    private async _deleteFile(filePath: string): Promise<void> {
        const file = this._files.find(f => f.path === filePath);
        if (!file || file.name.includes('copilot-instructions.md')) {
            vscode.window.showErrorMessage('Cannot delete this file');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Delete "${file.name}"?`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') { return; }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        this._loadFiles();
        this._sendState();
        vscode.window.showInformationMessage('File deleted');
    }

    private async _openInEditor(): Promise<void> {
        if (this._activeFilePath && fs.existsSync(this._activeFilePath)) {
            const doc = await vscode.workspace.openTextDocument(this._activeFilePath);
            await vscode.window.showTextDocument(doc);
        }
    }

    private _sendState(): void {
        if (!this._view) { return; }
        this._view.webview.postMessage({
            type: 'state',
            files: this._files,
            activeFilePath: this._activeFilePath,
            content: this._content
        });
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <select id="fileSelect" onchange="selectFile(this.value)" style="flex:1;"></select>
            <button class="icon-btn" onclick="reload()" title="Reload">🔄</button>
        </div>
        <div class="toolbar-row">
            <button class="icon-btn" onclick="addFile()" title="Add File">+</button>
            <button class="icon-btn danger" onclick="deleteFile()" title="Delete File">🗑️</button>
            <button onclick="openInEditor()">Open in Editor</button>
        </div>
    </div>
    <div id="emptyState" class="empty-state" style="display:none;">
        No guideline files found.
    </div>
    <textarea id="content" placeholder="Guideline content..." oninput="saveContent()"></textarea>
    <div class="status-bar">
        <span id="fileName">-</span>
        <span id="charCount">0 chars</span>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let files = [], activeFilePath = null;
        let saveTimeout;
        
        function selectFile(path) { vscode.postMessage({ type: 'selectFile', path }); }
        function reload() { vscode.postMessage({ type: 'reload' }); }
        function addFile() { vscode.postMessage({ type: 'addFile' }); }
        function deleteFile() {
            if (activeFilePath) {
                vscode.postMessage({ type: 'deleteFile', path: activeFilePath });
            }
        }
        function openInEditor() { vscode.postMessage({ type: 'openInEditor' }); }
        function saveContent() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                vscode.postMessage({ type: 'saveContent', content: document.getElementById('content').value });
            }, 500);
            document.getElementById('charCount').textContent = document.getElementById('content').value.length + ' chars';
        }
        
        function updateUI() {
            const select = document.getElementById('fileSelect');
            const textarea = document.getElementById('content');
            const empty = document.getElementById('emptyState');
            const fileName = document.getElementById('fileName');
            
            select.innerHTML = files.map(f => 
                '<option value="' + f.path + '"' + (f.path === activeFilePath ? ' selected' : '') + '>' + f.name + '</option>'
            ).join('');
            
            empty.style.display = files.length === 0 ? 'flex' : 'none';
            textarea.style.display = files.length > 0 ? 'block' : 'none';
            
            const active = files.find(f => f.path === activeFilePath);
            fileName.textContent = active?.name || '-';
        }
        
        window.addEventListener('message', e => {
            if (e.data.type === 'state') {
                files = e.data.files;
                activeFilePath = e.data.activeFilePath;
                document.getElementById('content').value = e.data.content;
                document.getElementById('charCount').textContent = e.data.content.length + ' chars';
                updateUI();
            }
        });
        
        document.addEventListener('DOMContentLoaded', () => vscode.postMessage({ type: 'ready' }));
    </script>
</body></html>`;
    }
}

// ============================================================================
// Workspace Notepad (file-based, stored in workspace root as notes.md)
// ============================================================================

class WorkspaceNotepadProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _content: string = '';
    private _notesFilePath: string | null = null;
    private _fileWatcher?: vscode.FileSystemWatcher;
    private _disposables: vscode.Disposable[] = [];
    private _ignoreNextFileChange: boolean = false;
    private _lastSaveTime: number = 0;

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._initNotesFilePath();
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    private _initNotesFilePath(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this._notesFilePath = path.join(workspaceFolder.uri.fsPath, 'notes.md');
        }
    }

    private _loadContent(): void {
        if (!this._notesFilePath) { return; }
        try {
            if (fs.existsSync(this._notesFilePath)) {
                this._content = fs.readFileSync(this._notesFilePath, 'utf-8');
            } else {
                this._content = '';
            }
        } catch {
            this._content = '';
        }
    }

    private _saveContent(): void {
        if (!this._notesFilePath) { return; }
        try {
            this._ignoreNextFileChange = true;
            this._lastSaveTime = Date.now();
            fs.writeFileSync(this._notesFilePath, this._content, 'utf-8');
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to save notes: ${e}`);
        }
    }

    private _setupFileWatcher(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        const pattern = new vscode.RelativePattern(workspaceFolder, 'notes.md');
        this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        const handleFileChange = () => {
            // Ignore if we just saved (within 1 second)
            if (this._ignoreNextFileChange || Date.now() - this._lastSaveTime < 1000) {
                this._ignoreNextFileChange = false;
                return;
            }
            this._loadContent();
            this._sendState();
        };

        this._disposables.push(
            this._fileWatcher.onDidChange(handleFileChange),
            this._fileWatcher.onDidCreate(handleFileChange),
            this._fileWatcher
        );
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        
        this._loadContent();
        this._setupFileWatcher();
        webviewView.webview.html = this._getHtml();

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._loadContent();
                this._sendState();
            }
        });

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case 'ready':
                    this._sendState();
                    break;
                case 'updateContent':
                    this._content = msg.content;
                    this._saveContent();
                    break;
                case 'openInEditor':
                    await this._openInEditor();
                    break;
            }
        });
    }

    private _sendState(): void {
        if (!this._view) { return; }
        this._view.webview.postMessage({
            type: 'state',
            content: this._content,
            filePath: this._notesFilePath
        });
    }

    private async _openInEditor(): Promise<void> {
        if (!this._notesFilePath) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        // Create file if it doesn't exist
        if (!fs.existsSync(this._notesFilePath)) {
            fs.writeFileSync(this._notesFilePath, '', 'utf-8');
        }
        const doc = await vscode.workspace.openTextDocument(this._notesFilePath);
        await vscode.window.showTextDocument(doc);
    }

    private _getHtml(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <span id="fileName" style="flex:1; font-size:11px; color:var(--vscode-descriptionForeground);">notes.md</span>
            <button class="icon-btn" onclick="openInEditor()" title="Open in Editor">📄</button>
        </div>
    </div>
    <textarea id="content" placeholder="Workspace notes (saved to notes.md)..." oninput="updateContent()"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let content = '';
        let saveTimeout;
        
        function updateContent() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                vscode.postMessage({ type: 'updateContent', content: document.getElementById('content').value });
            }, 500);
            document.getElementById('charCount').textContent = document.getElementById('content').value.length + ' chars';
        }
        function openInEditor() { vscode.postMessage({ type: 'openInEditor' }); }
        
        window.addEventListener('message', e => {
            if (e.data.type === 'state') {
                content = e.data.content;
                document.getElementById('content').value = content;
                document.getElementById('charCount').textContent = content.length + ' chars';
            }
        });
        
        document.addEventListener('DOMContentLoaded', () => vscode.postMessage({ type: 'ready' }));
    </script>
</body></html>`;
    }
}

// ============================================================================
// Registration
// ============================================================================

let guidelinesProvider: GuidelinesNotepadProvider | undefined;
let notesProvider: NotesNotepadProvider | undefined;
let localLlmProvider: LocalLlmNotepadProvider | undefined;
let conversationProvider: ConversationNotepadProvider | undefined;
let copilotProvider: CopilotNotepadProvider | undefined;
let tomAiChatProvider: TomAiChatNotepadProvider | undefined;
let tomNotepadProvider: TomNotepadProvider | undefined;
let workspaceNotepadProvider: WorkspaceNotepadProvider | undefined;

export function registerDsNotesViews(context: vscode.ExtensionContext): void {
    guidelinesProvider = new GuidelinesNotepadProvider(context);
    notesProvider = new NotesNotepadProvider(context);
    localLlmProvider = new LocalLlmNotepadProvider(context);
    conversationProvider = new ConversationNotepadProvider(context);
    copilotProvider = new CopilotNotepadProvider(context);
    tomAiChatProvider = new TomAiChatNotepadProvider(context);
    tomNotepadProvider = new TomNotepadProvider(context);
    workspaceNotepadProvider = new WorkspaceNotepadProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VIEW_IDS.guidelines, guidelinesProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.notes, notesProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.localLlm, localLlmProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.conversation, conversationProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.copilot, copilotProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.tomAiChat, tomAiChatProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.tomNotepad, tomNotepadProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.workspaceNotepad, workspaceNotepadProvider),
        vscode.commands.registerCommand('dartscript.focusTomAI', async () => {
            // Focus the Guidelines view to open the Tom AI panel
            await vscode.commands.executeCommand('dartscript.guidelinesNotepad.focus');
        })
    );
}

export { guidelinesProvider, notesProvider, localLlmProvider, conversationProvider, copilotProvider, tomAiChatProvider, tomNotepadProvider, workspaceNotepadProvider };
