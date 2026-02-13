/**
 * Issues Panel Handler
 *
 * Provides a split-panel UI for browsing and managing issues.
 * Left side: issue browser with repo dropdown.
 * Right side: issue viewer/editor with comment history, attachments, and actions.
 *
 * Works with any IssueProvider implementation (GitHub, Jira, Bugzilla, …).
 * Registered as subpanels in the TOM bottom panel (T3):
 *   - TOM ISSUES  (dartscript.tomIssues)
 *   - TOM TESTS   (dartscript.tomTests)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    IssueProvider,
    IssueProviderRepo,
    getIssueProvider,
    registerIssueProvider,
} from './issueProvider';
import { GitHubIssueProvider } from './githubIssueProvider';
import { getConfigPath } from './handler_shared';

// ============================================================================
// Types & Configuration
// ============================================================================

type PanelMode = 'issues' | 'tests';

interface IssuePanelOptions {
    mode: PanelMode;
    viewId: string;
    configSection: string;
    panelTitle: string;
    includeWorkspaceRepos: boolean;
}

interface IssuePanelConfig {
    provider: string;                // provider id, default "github"
    repos: string[];                 // explicit repos (tests mode)
    additionalRepos: string[];       // extra repos beyond workspace (issues mode)
    statuses: string[];              // e.g. ["open", "in_triage", "assigned", "closed"]
    labels: string[];                // quick-apply labels in key=value form
}

function loadPanelConfig(section: string): IssuePanelConfig {
    const defaults: IssuePanelConfig = {
        provider: 'github',
        repos: [],
        additionalRepos: [],
        statuses: ['open', 'in_triage', 'assigned', 'closed'],
        labels: ['quicklabel=Flaky', 'quicklabel=Regression', 'quicklabel=Blocked'],
    };

    try {
        const configPath = getConfigPath();
        if (!configPath || !fs.existsSync(configPath)) { return defaults; }
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const cfg = raw[section];
        if (!cfg) { return defaults; }
        return {
            provider: typeof cfg.provider === 'string' ? cfg.provider : defaults.provider,
            repos: Array.isArray(cfg.repos) ? cfg.repos : [],
            additionalRepos: Array.isArray(cfg.additionalRepos) ? cfg.additionalRepos : [],
            statuses: Array.isArray(cfg.statuses) && cfg.statuses.length > 0 ? cfg.statuses : defaults.statuses,
            labels: Array.isArray(cfg.labels) ? cfg.labels : defaults.labels,
        };
    } catch {
        return defaults;
    }
}

// ============================================================================
// Panel Provider
// ============================================================================

export class IssuesPanelHandler implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _options: IssuePanelOptions;

    constructor(extensionUri: vscode.Uri, options: IssuePanelOptions) {
        this._extensionUri = extensionUri;
        this._options = options;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist'),
            ],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            await this._handleMessage(msg, webviewView.webview);
        });
    }

    // -----------------------------------------------------------------------
    // Resolve provider
    // -----------------------------------------------------------------------

    private _getProvider(): IssueProvider {
        const config = loadPanelConfig(this._options.configSection);
        const provider = getIssueProvider(config.provider);
        if (!provider) {
            throw new Error(`Issue provider "${config.provider}" is not registered. Available: github`);
        }
        return provider;
    }

    // -----------------------------------------------------------------------
    // Message handling
    // -----------------------------------------------------------------------

    private async _handleMessage(msg: any, webview: vscode.Webview): Promise<void> {
        switch (msg.type) {
            case 'ready':
                await this._sendInitialData(webview);
                break;

            case 'loadIssues': {
                const { repoId, state } = msg;
                try {
                    const provider = this._getProvider();
                    const issues = await provider.listIssues(repoId, state || 'all');
                    webview.postMessage({ type: 'issues', issues, repoId });
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'loadComments': {
                const { repoId, issueNumber } = msg;
                try {
                    const provider = this._getProvider();
                    const comments = await provider.listComments(repoId, issueNumber);
                    webview.postMessage({ type: 'comments', comments, issueNumber });
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'createIssue': {
                const { repoId, title, body } = msg;
                try {
                    const provider = this._getProvider();
                    const issue = await provider.createIssue(repoId, title, body || '');
                    webview.postMessage({ type: 'issueCreated', issue });
                    vscode.window.showInformationMessage(`Issue #${issue.number} created`);
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'addComment': {
                const { repoId, issueNumber, body } = msg;
                try {
                    const provider = this._getProvider();
                    const comment = await provider.addComment(repoId, issueNumber, body);
                    webview.postMessage({ type: 'commentAdded', comment, issueNumber });
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'changeStatus': {
                const { repoId, issueNumber, status } = msg;
                try {
                    const provider = this._getProvider();
                    const config = loadPanelConfig(this._options.configSection);
                    const issue = await provider.changeStatus(repoId, issueNumber, status, config.statuses);
                    webview.postMessage({ type: 'issueUpdated', issue });
                    vscode.window.showInformationMessage(`Issue #${issueNumber} → ${status}`);
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'toggleLabel': {
                const { repoId, issueNumber, label } = msg;
                try {
                    const provider = this._getProvider();
                    const issue = await provider.toggleLabel(repoId, issueNumber, label);
                    const eqIdx = label.indexOf('=');
                    const displayLabel = eqIdx > 0 ? label.substring(eqIdx + 1) : label;
                    webview.postMessage({ type: 'issueUpdated', issue });
                    vscode.window.showInformationMessage(`Issue #${issueNumber}: toggled label "${displayLabel}"`);
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'openExternal': {
                if (msg.url) {
                    vscode.env.openExternal(vscode.Uri.parse(msg.url));
                }
                break;
            }

            case 'pickAttachment': {
                const files = await vscode.window.showOpenDialog({
                    canSelectMany: true,
                    openLabel: 'Attach',
                });
                if (files && files.length > 0) {
                    const attachments = files.map(f => ({
                        name: path.basename(f.fsPath),
                        path: f.fsPath,
                    }));
                    webview.postMessage({ type: 'attachmentsPicked', attachments });
                }
                break;
            }
        }
    }

    private async _sendInitialData(webview: vscode.Webview): Promise<void> {
        const config = loadPanelConfig(this._options.configSection);
        const provider = this._getProvider();
        let repos: IssueProviderRepo[];

        if (this._options.includeWorkspaceRepos) {
            // Issues mode: workspace repos + additional configured repos
            repos = provider.discoverRepos();
            const additionalRepos: IssueProviderRepo[] = config.additionalRepos.map(r => ({
                id: r,
                displayName: r,
            }));
            const seen = new Set(repos.map(r => r.id));
            for (const r of additionalRepos) {
                if (!seen.has(r.id)) {
                    repos.push(r);
                    seen.add(r.id);
                }
            }
        } else {
            // Tests mode: only explicitly configured repos
            repos = config.repos.map(r => ({ id: r, displayName: r }));
        }

        webview.postMessage({
            type: 'init',
            repos,
            statuses: config.statuses,
            mode: this._options.mode,
            labels: config.labels,
        });
    }

    // -----------------------------------------------------------------------
    // HTML generation
    // -----------------------------------------------------------------------

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'),
        );
        const mode = this._options.mode;

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${codiconsUri}" rel="stylesheet" />
<style>
${getStyles()}
</style>
</head>
<body data-mode="${mode}">
<div id="root">
  <!-- LEFT: Issue Browser -->
  <div id="browser">
    <div class="browser-toolbar">
      <select id="repoSelect"><option value="">Loading…</option></select>
      <button id="filterBtn" class="icon-btn" title="Filter by status"><span class="codicon codicon-filter"></span></button>
      <button id="sortBtn" class="icon-btn" title="Sort issues"><span class="codicon codicon-list-ordered"></span></button>
      <button id="refreshBtn" class="icon-btn" title="Refresh"><span class="codicon codicon-refresh"></span></button>
    </div>
    <div id="issueList" class="issue-list"></div>
    <!-- Filter picker overlay -->
    <div id="filterPicker" class="picker-overlay" style="display:none;"></div>
    <!-- Sort picker overlay -->
    <div id="sortPicker" class="picker-overlay sort-picker-overlay" style="display:none;"></div>
  </div>

  <!-- Resize handle -->
  <div id="splitHandle" class="split-handle"></div>

  <!-- RIGHT: Issue Editor -->
  <div id="editor">
    <!-- Top icon bar -->
    <div class="editor-toolbar">
      <span id="issueTitle" class="issue-title-bar">No issue selected</span>
      <div class="toolbar-icons">
        <select id="statusSelect" class="status-select" style="display:none;" title="Change status"></select>
        <button id="openBrowserBtn" class="icon-btn" title="Open in Browser" style="display:none;"><span class="codicon codicon-link-external"></span></button>
        <button id="labelsBtn" class="icon-btn" title="Quick Labels" style="display:none;"><span class="codicon codicon-tag"></span></button>
        <button id="addBtn" class="icon-btn" title="New Issue"><span class="codicon codicon-add"></span></button>
      </div>
    </div>

    <!-- Comment history (hidden in new-issue mode) -->
    <div id="commentHistory" class="comment-history"></div>

    <!-- Vertical resize handle -->
    <div id="vSplitHandle" class="v-split-handle"></div>

    <!-- Attachments area (hidden initially) -->
    <div id="attachmentArea" class="attachment-area" style="display:none;">
      <div id="attachmentList" class="attachment-list"></div>
    </div>

    <!-- Input area -->
    <div id="inputArea" class="input-area">
      <div class="input-column">
        <input id="titleInput" type="text" placeholder="Issue title…" style="display:none;" />
        <textarea id="inputText" placeholder="Write a comment…"></textarea>
      </div>
      <div class="input-icons">
        <button id="attachBtn" class="icon-btn" title="Add Attachment"><span class="codicon codicon-paperclip"></span></button>
        <button id="sendBtn" class="icon-btn send-btn" title="Send"><span class="codicon codicon-send"></span></button>
      </div>
    </div>

    <!-- Labels picker overlay -->
    <div id="labelsPicker" class="labels-picker" style="display:none;"></div>
  </div>
</div>
<script>
${getScript()}
</script>
</body>
</html>`;
    }
}

// ============================================================================
// Styles
// ============================================================================

function getStyles(): string {
    return /* css */ `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-panel-background);
    height: 100vh;
    overflow: hidden;
}
#root {
    display: flex;
    flex-direction: row;
    height: 100%;
    width: 100%;
}

/* ---- Left: Browser ---- */
#browser {
    flex: 0 0 280px;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--vscode-panel-border);
    overflow: hidden;
    position: relative;
}
.browser-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBarSectionHeader-background);
}
.browser-toolbar select {
    padding: 2px 4px;
    height: 22px;
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 3px;
    font-size: 12px;
}
#repoSelect { flex: 1; min-width: 80px; }
.issue-list {
    flex: 1;
    overflow-y: auto;
}
.issue-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 8px;
    cursor: pointer;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 12px;
    line-height: 1.4;
    position: relative;
    overflow: hidden;
}
.issue-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.issue-item.selected {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.issue-number {
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    min-width: 35px;
}
.issue-item-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.issue-state-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
    background: #888;
}

/* Status stamp overlay – uniform black on white */
.issue-status-stamp {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    pointer-events: none;
    background: #ffffff;
    color: #000000;
    border: 1px solid #cccccc;
}

/* ---- Picker overlays ---- */
.picker-overlay {
    position: absolute;
    left: 6px;
    top: 32px;
    background: var(--vscode-menu-background);
    border: 1px solid var(--vscode-menu-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    z-index: 100;
    padding: 4px 0;
    min-width: 180px;
    max-height: 300px;
    overflow-y: auto;
}
.picker-option {
    padding: 4px 10px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.picker-option:hover {
    background: var(--vscode-menu-selectionBackground);
    color: var(--vscode-menu-selectionForeground);
}
.picker-option .check-box {
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.picker-option .check-box .codicon { font-size: 14px; }
.picker-option .sort-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
}
.picker-option .sort-number.empty {
    background: transparent;
    border: 1px solid var(--vscode-descriptionForeground);
    color: transparent;
}
.picker-footer {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    padding: 6px 10px 4px 10px;
    border-top: 1px solid var(--vscode-panel-border);
    margin-top: 2px;
}
.picker-footer button {
    padding: 3px 10px;
    font-size: 11px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
}
.picker-footer button.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.picker-footer button.primary:hover { background: var(--vscode-button-hoverBackground); }
.picker-footer button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.picker-footer button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

/* ---- Horizontal split handle ---- */
.split-handle {
    flex: 0 0 4px;
    cursor: col-resize;
    background: transparent;
    transition: background 0.1s;
}
.split-handle:hover, .split-handle.dragging {
    background: var(--vscode-focusBorder);
}

/* ---- Right: Editor ---- */
#editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
}
.editor-toolbar {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBarSectionHeader-background);
    gap: 4px;
}
.issue-title-bar {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.toolbar-icons {
    display: flex;
    gap: 2px;
    align-items: center;
}

/* Status dropdown – black on white, no transparency */
.status-select {
    padding: 1px 4px;
    height: 20px;
    background: #ffffff;
    color: #000000;
    border: 1px solid #cccccc;
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
}

/* Comment history */
.comment-history {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    min-height: 40px;
}
.comment-history.hidden { display: none !important; }
.comment-card {
    margin-bottom: 10px;
    padding: 8px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background: var(--vscode-editor-background);
}
.comment-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}
.comment-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
}
.comment-author {
    font-weight: 600;
    color: var(--vscode-foreground);
}
.comment-body {
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
}
.comment-body code {
    background: var(--vscode-textCodeBlock-background);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
}
.issue-body-card {
    border-left: 3px solid var(--vscode-focusBorder);
}

/* Vertical split handle */
.v-split-handle {
    flex: 0 0 4px;
    cursor: row-resize;
    background: transparent;
    transition: background 0.1s;
}
.v-split-handle:hover, .v-split-handle.dragging {
    background: var(--vscode-focusBorder);
}
.v-split-handle.hidden { display: none !important; }

/* Attachments */
.attachment-area {
    padding: 4px 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    max-height: 80px;
    overflow-y: auto;
}
.attachment-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.attachment-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 10px;
    font-size: 11px;
}
.attachment-chip .remove-btn {
    display: none;
    cursor: pointer;
    font-size: 10px;
    opacity: 0.7;
    background: none;
    border: none;
    color: inherit;
    padding: 0 2px;
}
.attachment-chip:hover .remove-btn { display: inline; }
.attachment-chip:hover .remove-btn:hover { opacity: 1; }

/* Input area */
.input-area {
    display: flex;
    flex-direction: row;
    padding: 6px 8px;
    gap: 4px;
    min-height: 60px;
    flex: 0 0 auto;
}
.input-area.expanded { flex: 1; }
.input-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
}
.input-column input[type="text"] {
    padding: 4px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    font-family: var(--vscode-editor-font-family);
    font-size: 13px;
    flex: 0 0 auto;
}
.input-column input[type="text"]:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
}
.input-column textarea {
    flex: 1;
    min-height: 40px;
    resize: none;
    padding: 6px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    font-family: var(--vscode-editor-font-family);
    font-size: 13px;
    line-height: 1.4;
}
.input-column textarea:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
}
.input-icons {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 2px;
    width: 28px;
    flex-shrink: 0;
}

/* Buttons */
.icon-btn {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    padding: 3px;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.8;
}
.icon-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
.icon-btn .codicon { font-size: 16px; }
.send-btn .codicon { font-size: 18px; }

/* Labels picker */
.labels-picker {
    position: absolute;
    right: 8px;
    top: 34px;
    background: var(--vscode-menu-background);
    border: 1px solid var(--vscode-menu-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    z-index: 100;
    padding: 4px 0;
    min-width: 160px;
}
.label-option {
    padding: 5px 10px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.label-option:hover {
    background: var(--vscode-menu-selectionBackground);
    color: var(--vscode-menu-selectionForeground);
}
.label-option .check-box {
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.label-option .check-box .codicon { font-size: 14px; }

/* Empty / loading states */
.empty-state {
    padding: 20px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
}
.spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid var(--vscode-descriptionForeground);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
`;
}

// ============================================================================
// Script
// ============================================================================

function getScript(): string {
    return `
(function() {
    var vscode = acquireVsCodeApi();

    // State
    var repos = [];
    var configStatuses = ['open', 'in_triage', 'assigned', 'closed'];
    var configLabels = [];
    var panelMode = document.body.dataset.mode || 'issues';
    var currentRepo = null;
    var allIssues = [];
    var issues = [];
    var selectedIssue = null;
    var currentComments = [];
    var isNewIssueMode = false;
    var attachments = [];

    // Filter state
    var activeFilters = ['open'];

    // Sort state
    var sortFields = ['updatedAt'];
    var SORTABLE_FIELDS = [
        { key: 'number', label: 'Number' },
        { key: 'title', label: 'Title' },
        { key: 'state', label: 'Status' },
        { key: 'createdAt', label: 'Created' },
        { key: 'updatedAt', label: 'Updated' },
        { key: 'commentCount', label: 'Comments' },
        { key: 'author', label: 'Author' }
    ];

    // DOM refs
    var repoSelect = document.getElementById('repoSelect');
    var filterBtn = document.getElementById('filterBtn');
    var sortBtn = document.getElementById('sortBtn');
    var refreshBtn = document.getElementById('refreshBtn');
    var issueListEl = document.getElementById('issueList');
    var addBtn = document.getElementById('addBtn');
    var statusSelect = document.getElementById('statusSelect');
    var openBrowserBtn = document.getElementById('openBrowserBtn');
    var labelsBtn = document.getElementById('labelsBtn');
    var sendBtn = document.getElementById('sendBtn');
    var attachBtn = document.getElementById('attachBtn');
    var titleInput = document.getElementById('titleInput');
    var inputText = document.getElementById('inputText');
    var commentHistory = document.getElementById('commentHistory');
    var attachmentArea = document.getElementById('attachmentArea');
    var attachmentListEl = document.getElementById('attachmentList');
    var labelsPicker = document.getElementById('labelsPicker');
    var issueTitleBar = document.getElementById('issueTitle');
    var splitHandle = document.getElementById('splitHandle');
    var vSplitHandle = document.getElementById('vSplitHandle');
    var browserEl = document.getElementById('browser');
    var editorEl = document.getElementById('editor');
    var filterPicker = document.getElementById('filterPicker');
    var sortPicker = document.getElementById('sortPicker');
    var inputArea = document.getElementById('inputArea');

    // ---- Init ----
    vscode.postMessage({ type: 'ready' });

    // ---- Message handlers ----
    window.addEventListener('message', function(event) {
        var msg = event.data;
        switch (msg.type) {
            case 'init':
                repos = msg.repos || [];
                configStatuses = msg.statuses || ['open', 'in_triage', 'assigned', 'closed'];
                configLabels = msg.labels || [];
                if (msg.mode) panelMode = msg.mode;
                renderRepoDropdown();
                break;

            case 'issues':
                if (currentRepo && currentRepo.id === '__all__') {
                    var tagged = (msg.issues || []).map(function(iss) {
                        iss._repoId = msg.repoId;
                        return iss;
                    });
                    allIssues = allIssues.concat(tagged);
                } else {
                    allIssues = (msg.issues || []).map(function(iss) {
                        iss._repoId = msg.repoId;
                        return iss;
                    });
                }
                applyFilterAndSort();
                renderIssueList();
                break;

            case 'comments':
                currentComments = msg.comments || [];
                renderComments();
                break;

            case 'issueCreated':
                isNewIssueMode = false;
                selectedIssue = msg.issue;
                loadIssues();
                loadComments();
                renderEditorState();
                break;

            case 'commentAdded':
                currentComments.push(msg.comment);
                renderComments();
                inputText.value = '';
                break;

            case 'issueUpdated':
                if (selectedIssue && selectedIssue.number === msg.issue.number) {
                    selectedIssue = msg.issue;
                    renderEditorState();
                }
                loadIssues();
                break;

            case 'attachmentsPicked':
                for (var i = 0; i < msg.attachments.length; i++) {
                    attachments.push(msg.attachments[i]);
                }
                renderAttachments();
                break;

            case 'error':
                showError(msg.message);
                break;
        }
    });

    // ================================================================
    // Determine effective status (provider-normalized)
    // ================================================================
    function getEffectiveStatus(issue) {
        if (issue.state === 'closed') return 'closed';
        var labels = issue.labels || [];
        var labelStatuses = configStatuses.filter(function(s) { return s !== 'open' && s !== 'closed'; });
        for (var i = 0; i < labelStatuses.length; i++) {
            if (labels.indexOf(labelStatuses[i]) >= 0) return labelStatuses[i];
        }
        return 'open';
    }

    // ================================================================
    // Filter & Sort
    // ================================================================
    function applyFilterAndSort() {
        if (activeFilters.length === 0) {
            issues = allIssues.slice();
        } else {
            issues = allIssues.filter(function(iss) {
                return activeFilters.indexOf(getEffectiveStatus(iss)) >= 0;
            });
        }
        if (sortFields.length > 0) {
            issues.sort(function(a, b) {
                for (var i = 0; i < sortFields.length; i++) {
                    var f = sortFields[i];
                    var va = getSortValue(a, f);
                    var vb = getSortValue(b, f);
                    if (va < vb) return -1;
                    if (va > vb) return 1;
                }
                return 0;
            });
        }
    }

    function getSortValue(issue, field) {
        switch (field) {
            case 'number': return issue.number || 0;
            case 'title': return (issue.title || '').toLowerCase();
            case 'state': return getEffectiveStatus(issue);
            case 'createdAt': return issue.createdAt || '';
            case 'updatedAt': return issue.updatedAt || '';
            case 'commentCount': return issue.commentCount || 0;
            case 'author': return (issue.author && issue.author.name || '').toLowerCase();
            default: return '';
        }
    }

    // ================================================================
    // Repo dropdown
    // ================================================================
    function renderRepoDropdown() {
        var html = '<option value="">-- Select Repo --</option>';
        html += '<option value="__all__">All Repos</option>';
        for (var i = 0; i < repos.length; i++) {
            html += '<option value="' + escapeHtml(repos[i].id) + '">' + escapeHtml(repos[i].displayName) + '</option>';
        }
        repoSelect.innerHTML = html;
    }

    repoSelect.addEventListener('change', function() {
        var val = repoSelect.value;
        if (val === '' || val === '__all__') {
            currentRepo = val === '__all__' ? { id: '__all__', displayName: 'All Repos' } : null;
            if (val === '__all__') { loadAllIssues(); }
            else { allIssues = []; issues = []; renderIssueList(); }
        } else {
            currentRepo = null;
            for (var i = 0; i < repos.length; i++) {
                if (repos[i].id === val) { currentRepo = repos[i]; break; }
            }
            loadIssues();
        }
        selectedIssue = null;
        currentComments = [];
        renderEditorState();
    });

    refreshBtn.addEventListener('click', function() {
        if (currentRepo && currentRepo.id === '__all__') { loadAllIssues(); }
        else if (currentRepo) { loadIssues(); }
    });

    function loadIssues() {
        if (!currentRepo || currentRepo.id === '__all__') return;
        allIssues = [];
        issueListEl.innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
        vscode.postMessage({
            type: 'loadIssues',
            repoId: currentRepo.id,
            state: 'all'
        });
    }

    function loadAllIssues() {
        allIssues = [];
        issueListEl.innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
        if (repos.length === 0) { issues = []; renderIssueList(); return; }
        for (var i = 0; i < repos.length; i++) {
            vscode.postMessage({
                type: 'loadIssues',
                repoId: repos[i].id,
                state: 'all'
            });
        }
    }

    function loadComments() {
        if (!selectedIssue || !currentRepo) return;
        var repoId = selectedIssue._repoId || currentRepo.id;
        vscode.postMessage({
            type: 'loadComments',
            repoId: repoId,
            issueNumber: selectedIssue.number
        });
    }

    // ================================================================
    // Filter picker (multi-select status)
    // ================================================================
    filterBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (filterPicker.style.display !== 'none') {
            filterPicker.style.display = 'none';
            return;
        }
        sortPicker.style.display = 'none';
        renderFilterPicker();
        filterPicker.style.display = '';
    });

    function renderFilterPicker() {
        var presentStatuses = {};
        for (var i = 0; i < allIssues.length; i++) {
            presentStatuses[getEffectiveStatus(allIssues[i])] = true;
        }
        var html = '';
        for (var j = 0; j < configStatuses.length; j++) {
            var st = configStatuses[j];
            if (!presentStatuses[st]) continue;
            var checked = activeFilters.indexOf(st) >= 0;
            html += '<div class="picker-option" data-status="' + escapeHtml(st) + '">';
            html += '<span class="check-box">';
            html += checked ? '<span class="codicon codicon-check"></span>' : '';
            html += '</span>';
            html += '<span>' + escapeHtml(formatStatusLabel(st)) + '</span>';
            html += '</div>';
        }
        filterPicker.innerHTML = html;

        filterPicker.querySelectorAll('.picker-option').forEach(function(el) {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                var s = el.dataset.status;
                var idx = activeFilters.indexOf(s);
                if (idx >= 0) { activeFilters.splice(idx, 1); }
                else { activeFilters.push(s); }
                applyFilterAndSort();
                renderIssueList();
                renderFilterPicker();
            });
        });
    }

    // ================================================================
    // Sort picker
    // ================================================================
    var pendingSortFields = [];

    sortBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (sortPicker.style.display !== 'none') {
            sortPicker.style.display = 'none';
            return;
        }
        filterPicker.style.display = 'none';
        pendingSortFields = sortFields.slice();
        renderSortPicker();
        sortPicker.style.display = '';
    });

    function renderSortPicker() {
        var html = '';
        for (var i = 0; i < SORTABLE_FIELDS.length; i++) {
            var f = SORTABLE_FIELDS[i];
            var order = pendingSortFields.indexOf(f.key);
            var hasOrder = order >= 0;
            html += '<div class="picker-option" data-field="' + f.key + '">';
            html += '<span class="sort-number ' + (hasOrder ? '' : 'empty') + '">';
            html += hasOrder ? (order + 1) : '';
            html += '</span>';
            html += '<span>' + escapeHtml(f.label) + '</span>';
            html += '</div>';
        }
        html += '<div class="picker-footer">';
        html += '<button class="secondary" id="sortReset">Reset</button>';
        html += '<button class="primary" id="sortOk">OK</button>';
        html += '</div>';
        sortPicker.innerHTML = html;

        sortPicker.querySelectorAll('.picker-option').forEach(function(el) {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                var field = el.dataset.field;
                var idx = pendingSortFields.indexOf(field);
                if (idx >= 0) { pendingSortFields.splice(idx, 1); }
                else { pendingSortFields.push(field); }
                renderSortPicker();
            });
        });
        document.getElementById('sortReset').addEventListener('click', function(e) {
            e.stopPropagation();
            pendingSortFields = [];
            renderSortPicker();
        });
        document.getElementById('sortOk').addEventListener('click', function(e) {
            e.stopPropagation();
            sortFields = pendingSortFields.slice();
            sortPicker.style.display = 'none';
            applyFilterAndSort();
            renderIssueList();
        });
    }

    // ================================================================
    // Issue list rendering
    // ================================================================
    function renderIssueList() {
        if (issues.length === 0) {
            issueListEl.innerHTML = '<div class="empty-state">No issues found</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < issues.length; i++) {
            var issue = issues[i];
            var sel = selectedIssue && selectedIssue.id === issue.id ? ' selected' : '';
            var effStatus = getEffectiveStatus(issue);
            html += '<div class="issue-item' + sel + '" data-idx="' + i + '">';
            html += '<span class="issue-state-dot"></span>';
            html += '<span class="issue-number">#' + issue.number + '</span>';
            html += '<span class="issue-item-title">' + escapeHtml(issue.title) + '</span>';
            if (effStatus !== 'open') {
                html += '<span class="issue-status-stamp">' + escapeHtml(formatStatusLabel(effStatus)) + '</span>';
            }
            html += '</div>';
        }
        issueListEl.innerHTML = html;

        var items = issueListEl.querySelectorAll('.issue-item');
        items.forEach(function(el) {
            el.addEventListener('click', function() {
                var idx = parseInt(el.dataset.idx);
                selectIssue(issues[idx]);
            });
        });
    }

    function selectIssue(issue) {
        selectedIssue = issue;
        isNewIssueMode = false;
        currentComments = [];
        renderEditorState();
        renderIssueList();
        loadComments();
    }

    // ================================================================
    // Editor state
    // ================================================================
    function renderEditorState() {
        if (isNewIssueMode) {
            issueTitleBar.textContent = 'New Issue';
            commentHistory.classList.add('hidden');
            vSplitHandle.classList.add('hidden');
            commentHistory.style.flex = '';
            inputArea.classList.add('expanded');
            inputArea.style.flex = '';
            titleInput.style.display = '';
            titleInput.value = '';
            inputText.placeholder = 'Issue body (optional)…';
            statusSelect.style.display = 'none';
            openBrowserBtn.style.display = 'none';
            labelsBtn.style.display = 'none';
        } else {
            commentHistory.classList.remove('hidden');
            vSplitHandle.classList.remove('hidden');
            commentHistory.style.flex = '';
            inputArea.classList.remove('expanded');
            inputArea.style.flex = '';
            titleInput.style.display = 'none';
            if (selectedIssue) {
                issueTitleBar.textContent = '#' + selectedIssue.number + ' ' + selectedIssue.title;
                inputText.placeholder = 'Write a comment…';
                // Populate status dropdown
                var effStatus = getEffectiveStatus(selectedIssue);
                var optHtml = '';
                for (var i = 0; i < configStatuses.length; i++) {
                    var st = configStatuses[i];
                    var sel = (effStatus === st) ? ' selected' : '';
                    optHtml += '<option value="' + escapeHtml(st) + '"' + sel + '>' + escapeHtml(formatStatusLabel(st)) + '</option>';
                }
                statusSelect.innerHTML = optHtml;
                statusSelect.style.display = '';
                openBrowserBtn.style.display = '';
                labelsBtn.style.display = '';
                renderComments();
            } else {
                issueTitleBar.textContent = 'No issue selected';
                commentHistory.innerHTML = '<div class="empty-state">Select an issue from the list</div>';
                inputText.placeholder = 'Write a comment…';
                statusSelect.style.display = 'none';
                openBrowserBtn.style.display = 'none';
                labelsBtn.style.display = 'none';
            }
        }
    }

    // ================================================================
    // Comments
    // ================================================================
    function renderComments() {
        if (!selectedIssue) return;
        var html = '';
        html += '<div class="comment-card issue-body-card">';
        html += '<div class="comment-header">';
        html += '<img class="comment-avatar" src="' + escapeHtml(selectedIssue.author.avatarUrl) + '" />';
        html += '<span class="comment-author">' + escapeHtml(selectedIssue.author.name) + '</span>';
        html += '<span>' + formatDate(selectedIssue.createdAt) + '</span>';
        html += '</div>';
        html += '<div class="comment-body">' + escapeHtml(selectedIssue.body || '(No description)') + '</div>';
        html += '</div>';

        for (var i = 0; i < currentComments.length; i++) {
            var c = currentComments[i];
            html += '<div class="comment-card">';
            html += '<div class="comment-header">';
            html += '<img class="comment-avatar" src="' + escapeHtml(c.author.avatarUrl) + '" />';
            html += '<span class="comment-author">' + escapeHtml(c.author.name) + '</span>';
            html += '<span>' + formatDate(c.createdAt) + '</span>';
            html += '</div>';
            html += '<div class="comment-body">' + escapeHtml(c.body) + '</div>';
            html += '</div>';
        }
        commentHistory.innerHTML = html;
        commentHistory.scrollTop = commentHistory.scrollHeight;
    }

    // ================================================================
    // New issue mode
    // ================================================================
    addBtn.addEventListener('click', function() {
        isNewIssueMode = true;
        attachments = [];
        titleInput.value = '';
        inputText.value = '';
        renderAttachments();
        renderEditorState();
    });

    // ================================================================
    // Status dropdown (native <select>)
    // ================================================================
    statusSelect.addEventListener('change', function() {
        if (!selectedIssue || !currentRepo) return;
        var repoId = selectedIssue._repoId || currentRepo.id;
        vscode.postMessage({
            type: 'changeStatus',
            repoId: repoId,
            issueNumber: selectedIssue.number,
            status: statusSelect.value
        });
    });

    // ================================================================
    // Open in Browser
    // ================================================================
    openBrowserBtn.addEventListener('click', function() {
        if (selectedIssue && selectedIssue.url) {
            vscode.postMessage({ type: 'openExternal', url: selectedIssue.url });
        }
    });

    // ================================================================
    // Labels picker
    // ================================================================
    labelsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (labelsPicker.style.display !== 'none') {
            labelsPicker.style.display = 'none';
            return;
        }
        showLabelsPicker();
    });

    function showLabelsPicker() {
        if (!selectedIssue) return;
        var currentLabels = selectedIssue.labels || [];
        var html = '';
        for (var i = 0; i < configLabels.length; i++) {
            var label = configLabels[i];
            var eqIdx = label.indexOf('=');
            var displayName = eqIdx > 0 ? label.substring(eqIdx + 1) : label;
            var hasLabel = currentLabels.indexOf(label) >= 0;

            html += '<div class="label-option" data-label="' + escapeHtml(label) + '">';
            html += '<span class="check-box">';
            html += hasLabel ? '<span class="codicon codicon-check"></span>' : '';
            html += '</span>';
            html += '<span>' + escapeHtml(displayName) + '</span>';
            html += '</div>';
        }
        labelsPicker.innerHTML = html;
        labelsPicker.style.display = '';

        labelsPicker.querySelectorAll('.label-option').forEach(function(el) {
            el.addEventListener('click', function() {
                if (!selectedIssue || !currentRepo) return;
                var repoId = selectedIssue._repoId || currentRepo.id;
                vscode.postMessage({
                    type: 'toggleLabel',
                    repoId: repoId,
                    issueNumber: selectedIssue.number,
                    label: el.dataset.label
                });
                labelsPicker.style.display = 'none';
            });
        });
    }

    // Close pickers on outside click
    document.addEventListener('click', function() {
        filterPicker.style.display = 'none';
        sortPicker.style.display = 'none';
        labelsPicker.style.display = 'none';
    });

    // ================================================================
    // Send button
    // ================================================================
    sendBtn.addEventListener('click', function() {
        if (isNewIssueMode) {
            var title = titleInput.value.trim();
            if (!title) {
                showError('Please enter a title');
                return;
            }
            if (!currentRepo || currentRepo.id === '__all__') {
                showError('Please select a specific repo to create an issue');
                return;
            }
            var body = inputText.value.trim();
            if (attachments.length > 0) {
                body += '\\n\\n---\\nAttachments:\\n';
                for (var i = 0; i < attachments.length; i++) {
                    body += '- ' + attachments[i].name + '\\n';
                }
            }
            vscode.postMessage({
                type: 'createIssue',
                repoId: currentRepo.id,
                title: title,
                body: body
            });
        } else if (selectedIssue) {
            var text = inputText.value.trim();
            if (!text) return;
            var repoId = selectedIssue._repoId || currentRepo.id;
            var commentBody = text;
            if (attachments.length > 0) {
                commentBody += '\\n\\n---\\nAttachments:\\n';
                for (var j = 0; j < attachments.length; j++) {
                    commentBody += '- ' + attachments[j].name + '\\n';
                }
            }
            vscode.postMessage({
                type: 'addComment',
                repoId: repoId,
                issueNumber: selectedIssue.number,
                body: commentBody
            });
            attachments = [];
            renderAttachments();
        }
    });

    // ================================================================
    // Attachments
    // ================================================================
    attachBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'pickAttachment' });
    });

    function renderAttachments() {
        if (attachments.length === 0) {
            attachmentArea.style.display = 'none';
            return;
        }
        attachmentArea.style.display = '';
        var html = '';
        for (var i = 0; i < attachments.length; i++) {
            html += '<span class="attachment-chip" data-idx="' + i + '">';
            html += '<span class="codicon codicon-file"></span>';
            html += escapeHtml(attachments[i].name);
            html += '<button class="remove-btn" data-aidx="' + i + '">&times;</button>';
            html += '</span>';
        }
        attachmentListEl.innerHTML = html;

        attachmentListEl.querySelectorAll('.remove-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(btn.dataset.aidx);
                attachments.splice(idx, 1);
                renderAttachments();
            });
        });
    }

    // Drag and drop
    document.body.addEventListener('dragover', function(e) { e.preventDefault(); });
    document.body.addEventListener('drop', function(e) {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            showError('Drag-and-drop from external apps is limited in webviews. Please use the attachment button.');
        }
    });

    // ================================================================
    // Horizontal split resize
    // ================================================================
    (function() {
        var dragging = false;
        var startX, startWidth;
        splitHandle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            dragging = true;
            startX = e.clientX;
            startWidth = browserEl.offsetWidth;
            splitHandle.classList.add('dragging');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        function onMove(e) {
            if (!dragging) return;
            var dx = e.clientX - startX;
            var newWidth = Math.max(120, Math.min(startWidth + dx, window.innerWidth - 200));
            browserEl.style.flex = '0 0 ' + newWidth + 'px';
        }
        function onUp() {
            dragging = false;
            splitHandle.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
    })();

    // ================================================================
    // Vertical split resize
    // ================================================================
    (function() {
        var dragging = false;
        var startY, startCommentH, startInputH;
        vSplitHandle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            dragging = true;
            startY = e.clientY;
            startCommentH = commentHistory.offsetHeight;
            startInputH = inputArea.offsetHeight;
            vSplitHandle.classList.add('dragging');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        function onMove(e) {
            if (!dragging) return;
            var dy = e.clientY - startY;
            var newCommentH = Math.max(40, startCommentH + dy);
            var newInputH = Math.max(40, startInputH - dy);
            commentHistory.style.flex = '0 0 ' + newCommentH + 'px';
            inputArea.style.flex = '0 0 ' + newInputH + 'px';
        }
        function onUp() {
            dragging = false;
            vSplitHandle.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
    })();

    // ================================================================
    // Utility
    // ================================================================
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatDate(iso) {
        try {
            var d = new Date(iso);
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch(e) { return iso; }
    }

    function formatStatusLabel(st) {
        return st.replace(/_/g, ' ').replace(/\\b[a-z]/g, function(c) { return c.toUpperCase(); });
    }

    function showError(msg) {
        var div = document.createElement('div');
        div.className = 'empty-state';
        div.style.color = 'var(--vscode-errorForeground)';
        div.textContent = msg;
        commentHistory.appendChild(div);
        setTimeout(function() { if (div.parentNode) div.parentNode.removeChild(div); }, 5000);
    }

})();
`;
}

// ============================================================================
// Registration
// ============================================================================

let _issuesProvider: IssuesPanelHandler | undefined;
let _testsProvider: IssuesPanelHandler | undefined;

export function registerIssuePanels(context: vscode.ExtensionContext): void {
    // Register the built-in GitHub provider
    registerIssueProvider(new GitHubIssueProvider());

    _issuesProvider = new IssuesPanelHandler(context.extensionUri, {
        mode: 'issues',
        viewId: 'dartscript.tomIssues',
        configSection: 'tomIssues',
        panelTitle: 'TOM ISSUES',
        includeWorkspaceRepos: true,
    });

    _testsProvider = new IssuesPanelHandler(context.extensionUri, {
        mode: 'tests',
        viewId: 'dartscript.tomTests',
        configSection: 'tomTests',
        panelTitle: 'TOM TESTS',
        includeWorkspaceRepos: false,
    });

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('dartscript.tomIssues', _issuesProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
        vscode.window.registerWebviewViewProvider('dartscript.tomTests', _testsProvider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
    );
}
