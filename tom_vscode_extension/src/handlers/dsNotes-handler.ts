/**
 * DS Notes WebviewView Providers - Phase 2
 * 
 * Provides multiple notepad views for the DS Notes panel:
 * - Guidelines: File-based editor for copilot instructions (with file watcher)
 * - Notes: Simple multi-note storage
 * - Local LLM: Send prompts to local LLM with templates
 * - AI Conversation: Send prompts to AI with templates
 * - Copilot: Send prompts to Copilot with templates
 * 
 * Phase 2 Features:
 * - Template system with save/load
 * - Template placeholders: {{selection}}, {{file}}, {{date}}, {{clipboard}}, {{workspace}}
 * - Preview Prompt modal before sending
 * - File watcher for Guidelines
 * - Full replies section with history
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// View IDs
const VIEW_IDS = {
    guidelines: 'dartscript.guidelinesNotepad',
    notes: 'dartscript.notesNotepad',
    localLlm: 'dartscript.localLlmNotepad',
    conversation: 'dartscript.conversationNotepad',
    copilot: 'dartscript.copilotNotepad'
};

// Storage keys
const STORAGE_KEYS = {
    notes: 'dartscript.dsNotes.notes',
    localLlm: 'dartscript.dsNotes.localLlm',
    conversation: 'dartscript.dsNotes.conversation',
    copilot: 'dartscript.dsNotes.copilot',
    localLlmTemplates: 'dartscript.dsNotes.localLlmTemplates',
    conversationTemplates: 'dartscript.dsNotes.conversationTemplates',
    copilotTemplates: 'dartscript.dsNotes.copilotTemplates',
    localLlmReplies: 'dartscript.dsNotes.localLlmReplies',
    conversationReplies: 'dartscript.dsNotes.conversationReplies'
};

interface NoteItem {
    id: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
}

interface NotesState {
    notes: NoteItem[];
    activeNoteId: string | null;
}

interface TemplateItem {
    id: string;
    name: string;
    template: string;
}

interface TemplatesState {
    templates: TemplateItem[];
    activeTemplateId: string | null;
}

interface ReplyItem {
    id: string;
    prompt: string;
    reply: string;
    timestamp: number;
}

interface RepliesState {
    replies: ReplyItem[];
}

// ============================================================================
// Template Placeholder Expansion
// ============================================================================

async function expandPlaceholders(template: string): Promise<string> {
    let result = template;
    
    // {{selection}} - Current editor selection
    const editor = vscode.window.activeTextEditor;
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
    
    // {{date}} - Current date
    const now = new Date();
    result = result.replace(/\{\{date\}\}/gi, now.toLocaleDateString());
    
    // {{time}} - Current time
    result = result.replace(/\{\{time\}\}/gi, now.toLocaleTimeString());
    
    // {{datetime}} - Current date and time
    result = result.replace(/\{\{datetime\}\}/gi, now.toLocaleString());
    
    // {{clipboard}} - Clipboard content
    try {
        const clipboard = await vscode.env.clipboard.readText();
        result = result.replace(/\{\{clipboard\}\}/gi, clipboard || '(empty clipboard)');
    } catch {
        result = result.replace(/\{\{clipboard\}\}/gi, '(clipboard error)');
    }
    
    // {{workspace}} - Workspace name
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    result = result.replace(/\{\{workspace\}\}/gi, workspaceFolder?.name || '(no workspace)');
    
    // {{workspacepath}} - Workspace path
    result = result.replace(/\{\{workspacepath\}\}/gi, workspaceFolder?.uri.fsPath || '(no workspace)');
    
    // {{language}} - Current file language
    if (editor) {
        result = result.replace(/\{\{language\}\}/gi, editor.document.languageId);
    } else {
        result = result.replace(/\{\{language\}\}/gi, '(no file)');
    }
    
    // {{line}} - Current line number
    if (editor) {
        result = result.replace(/\{\{line\}\}/gi, String(editor.selection.active.line + 1));
    } else {
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
        select {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            min-width: 100px;
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
        }
        .replies-section {
            margin-top: 8px;
            border-top: 1px solid var(--vscode-input-border);
            padding-top: 8px;
            max-height: 250px;
            display: flex;
            flex-direction: column;
        }
        .replies-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }
        .replies-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        .replies-content {
            flex: 1;
            overflow-y: auto;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            padding: 8px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: var(--vscode-editor-font-size, 13px);
        }
        .reply-item {
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-input-border);
        }
        .reply-item:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
        }
        .reply-prompt {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            margin-bottom: 4px;
            white-space: pre-wrap;
            max-height: 60px;
            overflow: hidden;
        }
        .reply-text {
            white-space: pre-wrap;
        }
        .reply-time {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        /* Modal styles */
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        .modal-overlay.active { display: flex; }
        .modal {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        }
        .modal-header {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-input-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
        }
        .modal-body {
            padding: 12px;
            flex: 1;
            overflow-y: auto;
        }
        .modal-footer {
            padding: 12px;
            border-top: 1px solid var(--vscode-input-border);
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }
        .modal textarea {
            min-height: 200px;
        }
        .template-row {
            display: flex;
            gap: 4px;
            align-items: center;
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
// Base Multi-Note Provider with Templates
// ============================================================================

abstract class BaseTemplateProvider implements vscode.WebviewViewProvider {
    protected _view?: vscode.WebviewView;
    protected _notesState: NotesState = { notes: [], activeNoteId: null };
    protected _templatesState: TemplatesState = { templates: [], activeTemplateId: null };
    protected _repliesState: RepliesState = { replies: [] };

    constructor(
        protected readonly _context: vscode.ExtensionContext,
        protected readonly _notesStorageKey: string,
        protected readonly _templatesStorageKey: string,
        protected readonly _repliesStorageKey: string | null,
        protected readonly _noteTypeName: string,
        protected readonly _hasReplies: boolean = false
    ) {
        this._loadState();
    }

    protected _loadState(): void {
        const savedNotes = this._context.workspaceState.get<NotesState>(this._notesStorageKey);
        if (savedNotes) {
            this._notesState = savedNotes;
        }
        
        const savedTemplates = this._context.workspaceState.get<TemplatesState>(this._templatesStorageKey);
        if (savedTemplates) {
            this._templatesState = savedTemplates;
        }
        
        if (this._repliesStorageKey) {
            const savedReplies = this._context.workspaceState.get<RepliesState>(this._repliesStorageKey);
            if (savedReplies) {
                this._repliesState = savedReplies;
            }
        }
    }

    protected async _saveNotesState(): Promise<void> {
        await this._context.workspaceState.update(this._notesStorageKey, this._notesState);
    }

    protected async _saveTemplatesState(): Promise<void> {
        await this._context.workspaceState.update(this._templatesStorageKey, this._templatesState);
    }

    protected async _saveRepliesState(): Promise<void> {
        if (this._repliesStorageKey) {
            await this._context.workspaceState.update(this._repliesStorageKey, this._repliesState);
        }
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.html = this._getHtmlContent();
        
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this._handleMessage(message);
        });
    }

    protected async _handleMessage(message: { type: string; [key: string]: unknown }): Promise<void> {
        switch (message.type) {
            // Notes management
            case 'addNote':
                await this._addNote(message.title as string);
                break;
            case 'selectNote':
                await this._selectNote(message.noteId as string);
                break;
            case 'deleteNote':
                await this._deleteNote(message.noteId as string);
                break;
            case 'saveContent':
                await this._saveContent(message.content as string);
                break;
            
            // Templates management
            case 'saveTemplate':
                await this._saveTemplate(message.name as string, message.template as string);
                break;
            case 'loadTemplate':
                await this._loadTemplate(message.templateId as string);
                break;
            case 'deleteTemplate':
                await this._deleteTemplate(message.templateId as string);
                break;
            case 'applyTemplate':
                await this._applyTemplate(message.templateId as string);
                break;
            
            // Preview and send
            case 'previewPrompt':
                await this._previewPrompt(message.content as string);
                break;
            case 'sendPrompt':
                await this._sendPrompt(message.content as string);
                break;
            
            // Replies
            case 'clearReplies':
                await this._clearReplies();
                break;
            case 'copyReply':
                await this._copyReply(message.replyId as string);
                break;
            
            // Utils
            case 'copyToClipboard':
                await vscode.env.clipboard.writeText(message.content as string);
                vscode.window.showInformationMessage('Copied to clipboard');
                break;
            
            case 'ready':
                this._sendFullStateToWebview();
                break;
        }
    }

    // Notes operations
    protected async _addNote(title: string): Promise<void> {
        const note: NoteItem = {
            id: `note_${Date.now()}`,
            title: title || `${this._noteTypeName} ${this._notesState.notes.length + 1}`,
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this._notesState.notes.push(note);
        this._notesState.activeNoteId = note.id;
        await this._saveNotesState();
        this._sendFullStateToWebview();
    }

    protected async _selectNote(noteId: string): Promise<void> {
        this._notesState.activeNoteId = noteId;
        await this._saveNotesState();
        this._sendFullStateToWebview();
    }

    protected async _deleteNote(noteId: string): Promise<void> {
        const index = this._notesState.notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
            this._notesState.notes.splice(index, 1);
            if (this._notesState.activeNoteId === noteId) {
                this._notesState.activeNoteId = this._notesState.notes.length > 0 ? this._notesState.notes[0].id : null;
            }
            await this._saveNotesState();
            this._sendFullStateToWebview();
        }
    }

    protected async _saveContent(content: string): Promise<void> {
        if (this._notesState.activeNoteId) {
            const note = this._notesState.notes.find(n => n.id === this._notesState.activeNoteId);
            if (note) {
                note.content = content;
                note.updatedAt = Date.now();
                await this._saveNotesState();
            }
        }
    }

    // Template operations
    protected async _saveTemplate(name: string, template: string): Promise<void> {
        const templateItem: TemplateItem = {
            id: `template_${Date.now()}`,
            name: name || `Template ${this._templatesState.templates.length + 1}`,
            template
        };
        this._templatesState.templates.push(templateItem);
        this._templatesState.activeTemplateId = templateItem.id;
        await this._saveTemplatesState();
        this._sendFullStateToWebview();
        vscode.window.showInformationMessage(`Template "${templateItem.name}" saved`);
    }

    protected async _loadTemplate(templateId: string): Promise<void> {
        this._templatesState.activeTemplateId = templateId;
        await this._saveTemplatesState();
        this._sendFullStateToWebview();
    }

    protected async _deleteTemplate(templateId: string): Promise<void> {
        const index = this._templatesState.templates.findIndex(t => t.id === templateId);
        if (index !== -1) {
            const template = this._templatesState.templates[index];
            this._templatesState.templates.splice(index, 1);
            if (this._templatesState.activeTemplateId === templateId) {
                this._templatesState.activeTemplateId = this._templatesState.templates.length > 0 
                    ? this._templatesState.templates[0].id 
                    : null;
            }
            await this._saveTemplatesState();
            this._sendFullStateToWebview();
            vscode.window.showInformationMessage(`Template "${template.name}" deleted`);
        }
    }

    protected async _applyTemplate(templateId: string): Promise<void> {
        const template = this._templatesState.templates.find(t => t.id === templateId);
        if (template && this._notesState.activeNoteId) {
            const note = this._notesState.notes.find(n => n.id === this._notesState.activeNoteId);
            if (note) {
                note.content = template.template;
                note.updatedAt = Date.now();
                await this._saveNotesState();
                this._sendFullStateToWebview();
            }
        }
    }

    // Preview and send
    protected async _previewPrompt(content: string): Promise<void> {
        const expanded = await expandPlaceholders(content);
        if (this._view) {
            this._view.webview.postMessage({
                type: 'showPreview',
                original: content,
                expanded
            });
        }
    }

    protected abstract _sendPrompt(content: string): Promise<void>;

    // Replies operations
    protected async _addReply(prompt: string, reply: string): Promise<void> {
        if (!this._hasReplies) {
            return;
        }
        const replyItem: ReplyItem = {
            id: `reply_${Date.now()}`,
            prompt,
            reply,
            timestamp: Date.now()
        };
        this._repliesState.replies.unshift(replyItem); // Add to beginning
        // Keep only last 50 replies
        if (this._repliesState.replies.length > 50) {
            this._repliesState.replies = this._repliesState.replies.slice(0, 50);
        }
        await this._saveRepliesState();
        this._sendFullStateToWebview();
    }

    protected async _clearReplies(): Promise<void> {
        this._repliesState.replies = [];
        await this._saveRepliesState();
        this._sendFullStateToWebview();
    }

    protected async _copyReply(replyId: string): Promise<void> {
        const reply = this._repliesState.replies.find(r => r.id === replyId);
        if (reply) {
            await vscode.env.clipboard.writeText(reply.reply);
            vscode.window.showInformationMessage('Reply copied to clipboard');
        }
    }

    protected _sendFullStateToWebview(): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'fullStateUpdate',
                notesState: this._notesState,
                templatesState: this._templatesState,
                repliesState: this._repliesState
            });
        }
    }

    protected abstract _getHtmlContent(): string;

    protected _getTemplateScript(): string {
        return `
            const vscode = acquireVsCodeApi();
            let notesState = { notes: [], activeNoteId: null };
            let templatesState = { templates: [], activeTemplateId: null };
            let repliesState = { replies: [] };
            let saveTimeout;

            function getActiveNote() {
                return notesState.notes.find(n => n.id === notesState.activeNoteId);
            }

            function getActiveTemplate() {
                return templatesState.templates.find(t => t.id === templatesState.activeTemplateId);
            }

            // Notes UI
            function updateNoteSelector() {
                const selector = document.getElementById('noteSelector');
                if (!selector) return;
                selector.innerHTML = notesState.notes.map(n => 
                    \`<option value="\${n.id}" \${n.id === notesState.activeNoteId ? 'selected' : ''}>\${escapeHtml(n.title)}</option>\`
                ).join('');
            }

            function updateContent() {
                const textarea = document.getElementById('noteContent');
                const note = getActiveNote();
                if (textarea && note) {
                    textarea.value = note.content;
                    textarea.disabled = false;
                } else if (textarea) {
                    textarea.value = '';
                    textarea.disabled = true;
                }
                updateCharCount();
            }

            function updateCharCount() {
                const textarea = document.getElementById('noteContent');
                const charCount = document.getElementById('charCount');
                if (textarea && charCount) {
                    charCount.textContent = textarea.value.length + ' chars';
                }
            }

            function debouncedSave() {
                updateCharCount();
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    const textarea = document.getElementById('noteContent');
                    if (textarea) {
                        vscode.postMessage({ type: 'saveContent', content: textarea.value });
                    }
                }, 500);
            }

            // Notes operations
            function addNote() {
                const title = prompt('Enter title:');
                if (title !== null) {
                    vscode.postMessage({ type: 'addNote', title });
                }
            }

            function selectNote(noteId) {
                vscode.postMessage({ type: 'selectNote', noteId });
            }

            function deleteNote() {
                if (!notesState.activeNoteId) return;
                const note = getActiveNote();
                if (confirm(\`Delete "\${note?.title}"?\`)) {
                    vscode.postMessage({ type: 'deleteNote', noteId: notesState.activeNoteId });
                }
            }

            // Templates UI
            function updateTemplateSelector() {
                const selector = document.getElementById('templateSelector');
                if (!selector) return;
                selector.innerHTML = '<option value="">-- Select Template --</option>' +
                    templatesState.templates.map(t => 
                        \`<option value="\${t.id}" \${t.id === templatesState.activeTemplateId ? 'selected' : ''}>\${escapeHtml(t.name)}</option>\`
                    ).join('');
            }

            // Template operations
            function saveAsTemplate() {
                const textarea = document.getElementById('noteContent');
                if (!textarea || !textarea.value.trim()) {
                    alert('Nothing to save as template');
                    return;
                }
                const name = prompt('Enter template name:');
                if (name !== null) {
                    vscode.postMessage({ type: 'saveTemplate', name, template: textarea.value });
                }
            }

            function loadTemplate(templateId) {
                if (!templateId) return;
                vscode.postMessage({ type: 'loadTemplate', templateId });
            }

            function applyTemplate() {
                if (!templatesState.activeTemplateId) {
                    alert('Select a template first');
                    return;
                }
                vscode.postMessage({ type: 'applyTemplate', templateId: templatesState.activeTemplateId });
            }

            function deleteTemplate() {
                if (!templatesState.activeTemplateId) return;
                const template = getActiveTemplate();
                if (confirm(\`Delete template "\${template?.name}"?\`)) {
                    vscode.postMessage({ type: 'deleteTemplate', templateId: templatesState.activeTemplateId });
                }
            }

            // Preview and send
            function previewPrompt() {
                const textarea = document.getElementById('noteContent');
                if (textarea && textarea.value.trim()) {
                    vscode.postMessage({ type: 'previewPrompt', content: textarea.value });
                }
            }

            function sendPrompt() {
                const textarea = document.getElementById('noteContent');
                if (textarea && textarea.value.trim()) {
                    vscode.postMessage({ type: 'sendPrompt', content: textarea.value });
                }
            }

            function sendFromPreview() {
                const previewContent = document.getElementById('previewContent');
                if (previewContent) {
                    vscode.postMessage({ type: 'sendPrompt', content: previewContent.value });
                    closePreviewModal();
                }
            }

            function copyContent() {
                const textarea = document.getElementById('noteContent');
                if (textarea) {
                    vscode.postMessage({ type: 'copyToClipboard', content: textarea.value });
                }
            }

            // Modal
            function showPreviewModal(original, expanded) {
                const overlay = document.getElementById('previewModal');
                const content = document.getElementById('previewContent');
                if (overlay && content) {
                    content.value = expanded;
                    overlay.classList.add('active');
                }
            }

            function closePreviewModal() {
                const overlay = document.getElementById('previewModal');
                if (overlay) {
                    overlay.classList.remove('active');
                }
            }

            // Replies
            function updateReplies() {
                const container = document.getElementById('repliesContent');
                if (!container) return;
                
                if (repliesState.replies.length === 0) {
                    container.innerHTML = '<div style="color: var(--vscode-descriptionForeground);">No replies yet.</div>';
                    return;
                }
                
                container.innerHTML = repliesState.replies.map(r => \`
                    <div class="reply-item">
                        <div class="reply-prompt">▶ \${escapeHtml(r.prompt.substring(0, 100))}...</div>
                        <div class="reply-text">\${escapeHtml(r.reply)}</div>
                        <div class="reply-time">\${new Date(r.timestamp).toLocaleString()}</div>
                    </div>
                \`).join('');
            }

            function clearReplies() {
                if (confirm('Clear all replies?')) {
                    vscode.postMessage({ type: 'clearReplies' });
                }
            }

            // Utils
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            // Message handling
            window.addEventListener('message', (event) => {
                const message = event.data;
                switch (message.type) {
                    case 'fullStateUpdate':
                        notesState = message.notesState;
                        templatesState = message.templatesState;
                        repliesState = message.repliesState || { replies: [] };
                        updateNoteSelector();
                        updateTemplateSelector();
                        updateContent();
                        updateReplies();
                        updateUI();
                        break;
                    case 'showPreview':
                        showPreviewModal(message.original, message.expanded);
                        break;
                }
            });

            document.addEventListener('DOMContentLoaded', () => {
                vscode.postMessage({ type: 'ready' });
            });
        `;
    }

    protected _getPlaceholderHelp(): string {
        return `
            <div class="placeholder-help">
                <strong>Placeholders:</strong><br>
                <code>{{selection}}</code> - Editor selection<br>
                <code>{{file}}</code> - File path<br>
                <code>{{filename}}</code> - File name<br>
                <code>{{filecontent}}</code> - File content<br>
                <code>{{clipboard}}</code> - Clipboard<br>
                <code>{{date}}</code> / <code>{{time}}</code> / <code>{{datetime}}</code><br>
                <code>{{language}}</code> - File language<br>
                <code>{{workspace}}</code> - Workspace name
            </div>
        `;
    }

    protected _getPreviewModal(): string {
        return `
            <div id="previewModal" class="modal-overlay" onclick="if(event.target === this) closePreviewModal()">
                <div class="modal">
                    <div class="modal-header">
                        <span>Preview Prompt</span>
                        <button onclick="closePreviewModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <textarea id="previewContent" placeholder="Expanded prompt..."></textarea>
                    </div>
                    <div class="modal-footer">
                        <button onclick="closePreviewModal()">Cancel</button>
                        <button class="primary" onclick="sendFromPreview()">Send</button>
                    </div>
                </div>
            </div>
        `;
    }
}

// ============================================================================
// Notes Provider (Simple multi-note, no templates)
// ============================================================================

class NotesProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _state: NotesState = { notes: [], activeNoteId: null };

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._loadState();
    }

    private _loadState(): void {
        const saved = this._context.workspaceState.get<NotesState>(STORAGE_KEYS.notes);
        if (saved) {
            this._state = saved;
        }
    }

    private async _saveState(): Promise<void> {
        await this._context.workspaceState.update(STORAGE_KEYS.notes, this._state);
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.html = this._getHtmlContent();

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'addNote':
                    await this._addNote(message.title as string);
                    break;
                case 'selectNote':
                    this._state.activeNoteId = message.noteId as string;
                    await this._saveState();
                    this._sendStateToWebview();
                    break;
                case 'deleteNote':
                    await this._deleteNote(message.noteId as string);
                    break;
                case 'saveContent':
                    await this._saveContent(message.content as string);
                    break;
                case 'ready':
                    this._sendStateToWebview();
                    break;
            }
        });
    }

    private async _addNote(title: string): Promise<void> {
        const note: NoteItem = {
            id: `note_${Date.now()}`,
            title: title || `Note ${this._state.notes.length + 1}`,
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this._state.notes.push(note);
        this._state.activeNoteId = note.id;
        await this._saveState();
        this._sendStateToWebview();
    }

    private async _deleteNote(noteId: string): Promise<void> {
        const index = this._state.notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
            this._state.notes.splice(index, 1);
            if (this._state.activeNoteId === noteId) {
                this._state.activeNoteId = this._state.notes.length > 0 ? this._state.notes[0].id : null;
            }
            await this._saveState();
            this._sendStateToWebview();
        }
    }

    private async _saveContent(content: string): Promise<void> {
        if (this._state.activeNoteId) {
            const note = this._state.notes.find(n => n.id === this._state.activeNoteId);
            if (note) {
                note.content = content;
                note.updatedAt = Date.now();
                await this._saveState();
            }
        }
    }

    private _sendStateToWebview(): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'stateUpdate',
                state: this._state
            });
        }
    }

    private _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <select id="noteSelector" onchange="selectNote(this.value)"></select>
        <button onclick="addNote()">+ Add Note</button>
        <button class="danger" id="deleteBtn" onclick="deleteNote()" title="Delete note">🗑️</button>
    </div>
    <div id="emptyState" class="empty-state" style="display:none;">
        No notes yet. Click "Add Note" to create one.
    </div>
    <textarea id="noteContent" placeholder="Write your notes here..." oninput="debouncedSave(); updateCharCount();"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let state = { notes: [], activeNoteId: null };
        let saveTimeout;

        function getActiveNote() {
            return state.notes.find(n => n.id === state.activeNoteId);
        }

        function updateNoteSelector() {
            const selector = document.getElementById('noteSelector');
            if (!selector) return;
            selector.innerHTML = state.notes.map(n => 
                \`<option value="\${n.id}" \${n.id === state.activeNoteId ? 'selected' : ''}>\${escapeHtml(n.title)}</option>\`
            ).join('');
        }

        function updateContent() {
            const textarea = document.getElementById('noteContent');
            const note = getActiveNote();
            if (textarea && note) {
                textarea.value = note.content;
                textarea.disabled = false;
            } else if (textarea) {
                textarea.value = '';
                textarea.disabled = true;
            }
            updateCharCount();
        }

        function updateCharCount() {
            const textarea = document.getElementById('noteContent');
            const charCount = document.getElementById('charCount');
            if (textarea && charCount) {
                charCount.textContent = textarea.value.length + ' chars';
            }
        }

        function debouncedSave() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const textarea = document.getElementById('noteContent');
                if (textarea) {
                    vscode.postMessage({ type: 'saveContent', content: textarea.value });
                }
            }, 500);
        }

        function addNote() {
            const title = prompt('Enter note title:');
            if (title !== null) {
                vscode.postMessage({ type: 'addNote', title });
            }
        }

        function selectNote(noteId) {
            vscode.postMessage({ type: 'selectNote', noteId });
        }

        function deleteNote() {
            if (!state.activeNoteId) return;
            const note = getActiveNote();
            if (confirm(\`Delete "\${note?.title}"?\`)) {
                vscode.postMessage({ type: 'deleteNote', noteId: state.activeNoteId });
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function updateUI() {
            const emptyState = document.getElementById('emptyState');
            const textarea = document.getElementById('noteContent');
            const deleteBtn = document.getElementById('deleteBtn');
            const hasNotes = state.notes.length > 0;
            emptyState.style.display = hasNotes ? 'none' : 'flex';
            textarea.style.display = hasNotes ? 'block' : 'none';
            deleteBtn.disabled = !hasNotes;
        }

        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'stateUpdate') {
                state = message.state;
                updateNoteSelector();
                updateContent();
                updateUI();
            }
        });

        document.addEventListener('DOMContentLoaded', () => {
            vscode.postMessage({ type: 'ready' });
        });
    </script>
</body></html>`;
    }
}

// ============================================================================
// Local LLM Provider (with templates and replies)
// ============================================================================

class LocalLlmProvider extends BaseTemplateProvider {
    constructor(context: vscode.ExtensionContext) {
        super(
            context,
            STORAGE_KEYS.localLlm,
            STORAGE_KEYS.localLlmTemplates,
            STORAGE_KEYS.localLlmReplies,
            'Prompt',
            true // has replies
        );
    }

    protected async _sendPrompt(content: string): Promise<void> {
        const expanded = await expandPlaceholders(content);
        // TODO: Integrate with actual local LLM
        // For now, show a message
        vscode.window.showInformationMessage('Local LLM integration - prompt ready to send');
        
        // Simulate a reply for demo purposes
        await this._addReply(expanded, '(Local LLM integration pending - this is a placeholder reply)');
    }

    protected _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <select id="noteSelector" onchange="selectNote(this.value)"></select>
            <button onclick="addNote()">+ Add</button>
            <button class="danger" id="deleteBtn" onclick="deleteNote()" title="Delete">🗑️</button>
        </div>
        <div class="toolbar-row">
            <select id="templateSelector" onchange="loadTemplate(this.value)"></select>
            <button onclick="applyTemplate()" title="Apply template">Apply</button>
            <button onclick="saveAsTemplate()" title="Save as template">💾 Save</button>
            <button class="danger" onclick="deleteTemplate()" title="Delete template">🗑️</button>
        </div>
        <div class="toolbar-row">
            <button onclick="previewPrompt()">Preview</button>
            <button class="primary" onclick="sendPrompt()">Send to LLM</button>
            <button onclick="copyContent()">Copy</button>
        </div>
    </div>
    <div id="emptyState" class="empty-state" style="display:none;">
        No prompts yet. Click "Add" to create one.
    </div>
    <textarea id="noteContent" placeholder="Write your prompt here... Use {{placeholders}} for dynamic content." oninput="debouncedSave();"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
    </div>
    ${this._getPlaceholderHelp()}
    <div class="replies-section">
        <div class="replies-header">
            <span class="replies-label">Replies</span>
            <button onclick="clearReplies()" style="font-size:10px;">Clear</button>
        </div>
        <div class="replies-content" id="repliesContent">No replies yet.</div>
    </div>
    ${this._getPreviewModal()}
    <script>
        ${this._getTemplateScript()}
        function updateUI() {
            const emptyState = document.getElementById('emptyState');
            const textarea = document.getElementById('noteContent');
            const deleteBtn = document.getElementById('deleteBtn');
            const hasNotes = notesState.notes.length > 0;
            emptyState.style.display = hasNotes ? 'none' : 'flex';
            textarea.style.display = hasNotes ? 'block' : 'none';
            deleteBtn.disabled = !hasNotes;
        }
    </script>
</body></html>`;
    }
}

// ============================================================================
// AI Conversation Provider (with templates and replies)
// ============================================================================

class ConversationProvider extends BaseTemplateProvider {
    constructor(context: vscode.ExtensionContext) {
        super(
            context,
            STORAGE_KEYS.conversation,
            STORAGE_KEYS.conversationTemplates,
            STORAGE_KEYS.conversationReplies,
            'Message',
            true // has replies
        );
    }

    protected async _sendPrompt(content: string): Promise<void> {
        const expanded = await expandPlaceholders(content);
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: expanded });
        // Note: We can't easily capture the reply from VS Code chat
        // Add a placeholder entry
        await this._addReply(expanded, '(Sent to AI chat - reply captured in chat window)');
    }

    protected _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <select id="noteSelector" onchange="selectNote(this.value)"></select>
            <button onclick="addNote()">+ Add</button>
            <button class="danger" id="deleteBtn" onclick="deleteNote()" title="Delete">🗑️</button>
        </div>
        <div class="toolbar-row">
            <select id="templateSelector" onchange="loadTemplate(this.value)"></select>
            <button onclick="applyTemplate()" title="Apply template">Apply</button>
            <button onclick="saveAsTemplate()" title="Save as template">💾 Save</button>
            <button class="danger" onclick="deleteTemplate()" title="Delete template">🗑️</button>
        </div>
        <div class="toolbar-row">
            <button onclick="previewPrompt()">Preview</button>
            <button class="primary" onclick="sendPrompt()">Send to AI</button>
            <button onclick="copyContent()">Copy</button>
        </div>
    </div>
    <div id="emptyState" class="empty-state" style="display:none;">
        No messages yet. Click "Add" to create one.
    </div>
    <textarea id="noteContent" placeholder="Write your message here... Use {{placeholders}} for dynamic content." oninput="debouncedSave();"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
    </div>
    ${this._getPlaceholderHelp()}
    <div class="replies-section">
        <div class="replies-header">
            <span class="replies-label">History</span>
            <button onclick="clearReplies()" style="font-size:10px;">Clear</button>
        </div>
        <div class="replies-content" id="repliesContent">No history yet.</div>
    </div>
    ${this._getPreviewModal()}
    <script>
        ${this._getTemplateScript()}
        function updateUI() {
            const emptyState = document.getElementById('emptyState');
            const textarea = document.getElementById('noteContent');
            const deleteBtn = document.getElementById('deleteBtn');
            const hasNotes = notesState.notes.length > 0;
            emptyState.style.display = hasNotes ? 'none' : 'flex';
            textarea.style.display = hasNotes ? 'block' : 'none';
            deleteBtn.disabled = !hasNotes;
        }
    </script>
</body></html>`;
    }
}

// ============================================================================
// Copilot Provider (with templates, no replies)
// ============================================================================

class CopilotProvider extends BaseTemplateProvider {
    constructor(context: vscode.ExtensionContext) {
        super(
            context,
            STORAGE_KEYS.copilot,
            STORAGE_KEYS.copilotTemplates,
            null, // no replies
            'Prompt',
            false
        );
    }

    protected async _sendPrompt(content: string): Promise<void> {
        const expanded = await expandPlaceholders(content);
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: expanded });
    }

    protected _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <select id="noteSelector" onchange="selectNote(this.value)"></select>
            <button onclick="addNote()">+ Add</button>
            <button class="danger" id="deleteBtn" onclick="deleteNote()" title="Delete">🗑️</button>
        </div>
        <div class="toolbar-row">
            <select id="templateSelector" onchange="loadTemplate(this.value)"></select>
            <button onclick="applyTemplate()" title="Apply template">Apply</button>
            <button onclick="saveAsTemplate()" title="Save as template">💾 Save</button>
            <button class="danger" onclick="deleteTemplate()" title="Delete template">🗑️</button>
        </div>
        <div class="toolbar-row">
            <button onclick="previewPrompt()">Preview</button>
            <button class="primary" onclick="sendPrompt()">Send to Copilot</button>
            <button onclick="copyContent()">Copy</button>
        </div>
    </div>
    <div id="emptyState" class="empty-state" style="display:none;">
        No prompts yet. Click "Add" to create one.
    </div>
    <textarea id="noteContent" placeholder="Write your Copilot prompt here... Use {{placeholders}} for dynamic content." oninput="debouncedSave();"></textarea>
    <div class="status-bar">
        <span id="charCount">0 chars</span>
    </div>
    ${this._getPlaceholderHelp()}
    ${this._getPreviewModal()}
    <script>
        ${this._getTemplateScript()}
        function updateUI() {
            const emptyState = document.getElementById('emptyState');
            const textarea = document.getElementById('noteContent');
            const deleteBtn = document.getElementById('deleteBtn');
            const hasNotes = notesState.notes.length > 0;
            emptyState.style.display = hasNotes ? 'none' : 'flex';
            textarea.style.display = hasNotes ? 'block' : 'none';
            deleteBtn.disabled = !hasNotes;
        }
        
        // Override updateReplies for Copilot (no replies section)
        function updateReplies() {}
    </script>
</body></html>`;
    }
}

// ============================================================================
// Guidelines Provider (File-based with file watcher)
// ============================================================================

class GuidelinesProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _files: { path: string; name: string; content: string }[] = [];
    private _activeFilePath: string | null = null;
    private _fileWatcher?: vscode.FileSystemWatcher;
    private _disposables: vscode.Disposable[] = [];

    constructor(private readonly _context: vscode.ExtensionContext) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.html = this._getHtmlContent();

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'ready':
                    await this._loadGuidelineFiles();
                    this._setupFileWatcher();
                    this._sendStateToWebview();
                    break;
                case 'selectFile':
                    await this._selectFile(message.filePath as string);
                    break;
                case 'saveContent':
                    await this._saveContent(message.content as string);
                    break;
                case 'addGuideline':
                    await this._addGuideline(message.fileName as string);
                    break;
                case 'deleteFile':
                    await this._deleteFile(message.filePath as string);
                    break;
                case 'openInEditor':
                    await this._openInEditor();
                    break;
                case 'reviewInCopilot':
                    await this._reviewIn('copilot', message.content as string);
                    break;
                case 'reloadFiles':
                    await this._loadGuidelineFiles();
                    this._sendStateToWebview();
                    break;
            }
        });
    }

    private _setupFileWatcher(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        // Watch for changes in _copilot_guidelines folder
        const guidelinesPattern = new vscode.RelativePattern(
            workspaceFolder,
            '_copilot_guidelines/**/*.md'
        );
        
        const copilotInstructionsPattern = new vscode.RelativePattern(
            workspaceFolder,
            '.github/copilot-instructions.md'
        );

        this._fileWatcher = vscode.workspace.createFileSystemWatcher(guidelinesPattern);
        const instructionsWatcher = vscode.workspace.createFileSystemWatcher(copilotInstructionsPattern);

        const reloadHandler = async () => {
            await this._loadGuidelineFiles();
            this._sendStateToWebview();
        };

        this._disposables.push(
            this._fileWatcher.onDidCreate(reloadHandler),
            this._fileWatcher.onDidDelete(reloadHandler),
            this._fileWatcher.onDidChange(async (uri) => {
                // Update specific file content
                const file = this._files.find(f => f.path === uri.fsPath);
                if (file && fs.existsSync(uri.fsPath)) {
                    file.content = fs.readFileSync(uri.fsPath, 'utf-8');
                    this._sendStateToWebview();
                }
            }),
            instructionsWatcher.onDidChange(async (uri) => {
                const file = this._files.find(f => f.path === uri.fsPath);
                if (file && fs.existsSync(uri.fsPath)) {
                    file.content = fs.readFileSync(uri.fsPath, 'utf-8');
                    this._sendStateToWebview();
                }
            }),
            this._fileWatcher,
            instructionsWatcher
        );
    }

    dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    private async _loadGuidelineFiles(): Promise<void> {
        this._files = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const rootPath = workspaceFolder.uri.fsPath;

        // Load copilot-instructions.md
        const copilotInstructionsPath = path.join(rootPath, '.github', 'copilot-instructions.md');
        if (fs.existsSync(copilotInstructionsPath)) {
            this._files.push({
                path: copilotInstructionsPath,
                name: '📋 copilot-instructions.md',
                content: fs.readFileSync(copilotInstructionsPath, 'utf-8')
            });
        }

        // Load _copilot_guidelines files
        const guidelinesDir = path.join(rootPath, '_copilot_guidelines');
        if (fs.existsSync(guidelinesDir)) {
            const files = fs.readdirSync(guidelinesDir)
                .filter(f => f.endsWith('.md'))
                .sort();
            for (const file of files) {
                const filePath = path.join(guidelinesDir, file);
                if (fs.statSync(filePath).isFile()) {
                    this._files.push({
                        path: filePath,
                        name: file,
                        content: fs.readFileSync(filePath, 'utf-8')
                    });
                }
            }
        }

        if (this._files.length > 0 && !this._activeFilePath) {
            this._activeFilePath = this._files[0].path;
        }
    }

    private async _selectFile(filePath: string): Promise<void> {
        this._activeFilePath = filePath;
        this._sendStateToWebview();
    }

    private async _saveContent(content: string): Promise<void> {
        if (this._activeFilePath) {
            fs.writeFileSync(this._activeFilePath, content, 'utf-8');
            const file = this._files.find(f => f.path === this._activeFilePath);
            if (file) {
                file.content = content;
            }
        }
    }

    private async _addGuideline(fileName: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        let name = fileName.trim();
        if (!name.endsWith('.md')) {
            name += '.md';
        }

        const guidelinesDir = path.join(workspaceFolder.uri.fsPath, '_copilot_guidelines');
        if (!fs.existsSync(guidelinesDir)) {
            fs.mkdirSync(guidelinesDir, { recursive: true });
        }

        const filePath = path.join(guidelinesDir, name);
        if (fs.existsSync(filePath)) {
            vscode.window.showErrorMessage(`File ${name} already exists`);
            return;
        }

        const title = name.replace('.md', '').replace(/_/g, ' ');
        fs.writeFileSync(filePath, `# ${title}\n\n`, 'utf-8');
        await this._loadGuidelineFiles();
        this._activeFilePath = filePath;
        this._sendStateToWebview();
        vscode.window.showInformationMessage(`Created ${name}`);
    }

    private async _deleteFile(filePath: string): Promise<void> {
        const file = this._files.find(f => f.path === filePath);
        if (!file) {
            return;
        }

        // Don't allow deleting copilot-instructions.md
        if (file.name.includes('copilot-instructions.md')) {
            vscode.window.showErrorMessage('Cannot delete copilot-instructions.md');
            return;
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        this._files = this._files.filter(f => f.path !== filePath);
        if (this._activeFilePath === filePath) {
            this._activeFilePath = this._files.length > 0 ? this._files[0].path : null;
        }
        this._sendStateToWebview();
        vscode.window.showInformationMessage(`Deleted ${file.name}`);
    }

    private async _openInEditor(): Promise<void> {
        if (this._activeFilePath && fs.existsSync(this._activeFilePath)) {
            const doc = await vscode.workspace.openTextDocument(this._activeFilePath);
            await vscode.window.showTextDocument(doc);
        }
    }

    private async _reviewIn(target: 'copilot', content: string): Promise<void> {
        const activeFile = this._files.find(f => f.path === this._activeFilePath);
        const fileName = activeFile?.name || 'guideline';
        await vscode.commands.executeCommand('workbench.action.chat.open', {
            query: `Review this guideline file (${fileName}):\n\n${content}`
        });
    }

    private _sendStateToWebview(): void {
        if (this._view) {
            const activeFile = this._files.find(f => f.path === this._activeFilePath);
            this._view.webview.postMessage({
                type: 'stateUpdate',
                files: this._files.map(f => ({ path: f.path, name: f.name })),
                activeFilePath: this._activeFilePath,
                content: activeFile?.content || ''
            });
        }
    }

    private _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${getBaseStyles()}</style></head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <select id="fileSelector" onchange="selectFile(this.value)" style="flex:1;"></select>
            <button onclick="reloadFiles()" title="Reload files">🔄</button>
        </div>
        <div class="toolbar-row">
            <button onclick="addGuideline()">+ Add</button>
            <button class="danger" id="deleteBtn" onclick="deleteFile()" title="Delete">🗑️</button>
            <button onclick="openInEditor()">Open in Editor</button>
            <button onclick="reviewInCopilot()">Review</button>
        </div>
    </div>
    <div id="emptyState" class="empty-state" style="display:none;">
        No guideline files found.
    </div>
    <textarea id="guidelineContent" placeholder="Guideline content..." oninput="debouncedSave()"></textarea>
    <div class="status-bar">
        <span id="fileName">-</span>
        <span id="charCount">0 chars</span>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let files = [];
        let activeFilePath = null;
        let saveTimeout;

        function updateUI() {
            const selector = document.getElementById('fileSelector');
            const textarea = document.getElementById('guidelineContent');
            const emptyState = document.getElementById('emptyState');
            const deleteBtn = document.getElementById('deleteBtn');
            const fileNameEl = document.getElementById('fileName');
            
            selector.innerHTML = files.map(f => 
                \`<option value="\${f.path}" \${f.path === activeFilePath ? 'selected' : ''}>\${f.name}</option>\`
            ).join('');
            
            const hasFiles = files.length > 0;
            emptyState.style.display = hasFiles ? 'none' : 'flex';
            textarea.style.display = hasFiles ? 'block' : 'none';
            
            const activeFile = files.find(f => f.path === activeFilePath);
            deleteBtn.disabled = !activeFile || activeFile.name.includes('copilot-instructions.md');
            fileNameEl.textContent = activeFile?.name || '-';
        }

        function updateCharCount() {
            const textarea = document.getElementById('guidelineContent');
            document.getElementById('charCount').textContent = textarea.value.length + ' chars';
        }

        function selectFile(filePath) {
            vscode.postMessage({ type: 'selectFile', filePath });
        }

        function debouncedSave() {
            updateCharCount();
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const textarea = document.getElementById('guidelineContent');
                vscode.postMessage({ type: 'saveContent', content: textarea.value });
            }, 500);
        }

        function addGuideline() {
            const name = prompt('Enter guideline file name:');
            if (name) {
                vscode.postMessage({ type: 'addGuideline', fileName: name });
            }
        }

        function deleteFile() {
            const activeFile = files.find(f => f.path === activeFilePath);
            if (activeFile && confirm(\`Delete "\${activeFile.name}"?\`)) {
                vscode.postMessage({ type: 'deleteFile', filePath: activeFilePath });
            }
        }

        function openInEditor() {
            vscode.postMessage({ type: 'openInEditor' });
        }

        function reloadFiles() {
            vscode.postMessage({ type: 'reloadFiles' });
        }

        function reviewInCopilot() {
            const textarea = document.getElementById('guidelineContent');
            vscode.postMessage({ type: 'reviewInCopilot', content: textarea.value });
        }

        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'stateUpdate') {
                files = message.files;
                activeFilePath = message.activeFilePath;
                document.getElementById('guidelineContent').value = message.content;
                updateUI();
                updateCharCount();
            }
        });

        document.addEventListener('DOMContentLoaded', () => {
            vscode.postMessage({ type: 'ready' });
        });
    </script>
</body></html>`;
    }
}

// ============================================================================
// Registration
// ============================================================================

let guidelinesProvider: GuidelinesProvider | undefined;
let notesProvider: NotesProvider | undefined;
let localLlmProvider: LocalLlmProvider | undefined;
let conversationProvider: ConversationProvider | undefined;
let copilotProvider: CopilotProvider | undefined;

export function registerDsNotesViews(context: vscode.ExtensionContext): void {
    guidelinesProvider = new GuidelinesProvider(context);
    notesProvider = new NotesProvider(context);
    localLlmProvider = new LocalLlmProvider(context);
    conversationProvider = new ConversationProvider(context);
    copilotProvider = new CopilotProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VIEW_IDS.guidelines, guidelinesProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.notes, notesProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.localLlm, localLlmProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.conversation, conversationProvider),
        vscode.window.registerWebviewViewProvider(VIEW_IDS.copilot, copilotProvider)
    );
}

// Export providers for potential external use
export { guidelinesProvider, notesProvider, localLlmProvider, conversationProvider, copilotProvider };
