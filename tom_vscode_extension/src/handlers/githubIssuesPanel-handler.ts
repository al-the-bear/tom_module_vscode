/**
 * GitHub Issues Panel Handler
 *
 * Provides a split-panel UI for browsing and managing GitHub issues.
 * Left side: issue browser with repo dropdown.
 * Right side: issue viewer/editor with comment history, attachments, and actions.
 *
 * Registered as a subpanel in the TOM bottom panel (T3).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    RepoInfo,
    discoverWorkspaceRepos,
    listIssues,
    listComments,
    createIssue,
    addComment,
    updateIssue,
    getIssue,
} from './githubApi';
import { getConfigPath } from './handler_shared';

const VIEW_ID = 'dartscript.githubIssues';

// ============================================================================
// Configuration
// ============================================================================

interface GitHubIssuesConfig {
    additionalRepos: string[];       // "owner/repo" strings
    statuses: string[];              // e.g. ["open", "in_triage", "assigned", "closed"]
}

function loadGitHubIssuesConfig(): GitHubIssuesConfig {
    const defaults: GitHubIssuesConfig = {
        additionalRepos: [],
        statuses: ['open', 'in_triage', 'assigned', 'closed'],
    };

    try {
        const configPath = getConfigPath();
        if (!configPath || !fs.existsSync(configPath)) { return defaults; }
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const cfg = raw.githubIssues;
        if (!cfg) { return defaults; }
        return {
            additionalRepos: Array.isArray(cfg.additionalRepos) ? cfg.additionalRepos : [],
            statuses: Array.isArray(cfg.statuses) && cfg.statuses.length > 0 ? cfg.statuses : defaults.statuses,
        };
    } catch {
        return defaults;
    }
}

// ============================================================================
// Panel Provider
// ============================================================================

export class GitHubIssuesPanelHandler implements vscode.WebviewViewProvider {
    public static readonly viewType = VIEW_ID;
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
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
    // Message handling
    // -----------------------------------------------------------------------

    private async _handleMessage(msg: any, webview: vscode.Webview): Promise<void> {
        switch (msg.type) {
            case 'ready':
                await this._sendInitialData(webview);
                break;

            case 'loadIssues': {
                const { owner, repo, state } = msg;
                try {
                    const issues = await listIssues(owner, repo, state || 'all');
                    // Filter out pull requests (GitHub returns PRs in the issues endpoint)
                    const filtered = issues.filter((i: any) => !i.pull_request);
                    webview.postMessage({ type: 'issues', issues: filtered, owner, repo });
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'loadComments': {
                const { owner, repo, issueNumber } = msg;
                try {
                    const comments = await listComments(owner, repo, issueNumber);
                    webview.postMessage({ type: 'comments', comments, issueNumber });
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'createIssue': {
                const { owner, repo, title, body } = msg;
                try {
                    const issue = await createIssue(owner, repo, title, body || '');
                    webview.postMessage({ type: 'issueCreated', issue });
                    vscode.window.showInformationMessage(`Issue #${issue.number} created`);
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'addComment': {
                const { owner, repo, issueNumber, body } = msg;
                try {
                    const comment = await addComment(owner, repo, issueNumber, body);
                    webview.postMessage({ type: 'commentAdded', comment, issueNumber });
                } catch (e: any) {
                    webview.postMessage({ type: 'error', message: e.message });
                }
                break;
            }

            case 'changeStatus': {
                const { owner, repo, issueNumber, status } = msg;
                try {
                    // GitHub only supports open/closed natively; other statuses use labels
                    const ghState = (status === 'closed') ? 'closed' : 'open';
                    const labelStatuses = ['in_triage', 'assigned'];
                    const updates: any = { state: ghState };

                    // Get current issue to manage labels
                    const currentIssue = await getIssue(owner, repo, issueNumber);
                    const currentLabels = (currentIssue.labels || []).map((l: any) => l.name);

                    if (labelStatuses.includes(status)) {
                        // Add label, remove other status labels, keep open
                        const filtered = currentLabels.filter((l: string) => !labelStatuses.includes(l));
                        filtered.push(status);
                        updates.labels = filtered;
                        updates.state = 'open';
                    } else {
                        // Remove status labels for plain open/closed
                        updates.labels = currentLabels.filter((l: string) => !labelStatuses.includes(l));
                    }

                    const issue = await updateIssue(owner, repo, issueNumber, updates);
                    webview.postMessage({ type: 'issueUpdated', issue });
                    vscode.window.showInformationMessage(`Issue #${issueNumber} → ${status}`);
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
        // Gather repos
        const workspaceRepos = discoverWorkspaceRepos();
        const config = loadGitHubIssuesConfig();

        // Add configured additional repos
        const additionalRepos: RepoInfo[] = config.additionalRepos
            .map(r => {
                const parts = r.split('/');
                if (parts.length === 2) {
                    return { owner: parts[0], repo: parts[1], displayName: r };
                }
                return undefined;
            })
            .filter((r): r is RepoInfo => r !== undefined);

        // Deduplicate
        const seen = new Set(workspaceRepos.map(r => r.displayName));
        for (const r of additionalRepos) {
            if (!seen.has(r.displayName)) {
                workspaceRepos.push(r);
                seen.add(r.displayName);
            }
        }

        webview.postMessage({
            type: 'init',
            repos: workspaceRepos,
            statuses: config.statuses,
        });
    }

    // -----------------------------------------------------------------------
    // HTML generation
    // -----------------------------------------------------------------------

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'),
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${codiconsUri}" rel="stylesheet" />
<style>
${getStyles()}
</style>
</head>
<body>
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
        <button id="statusBtn" class="icon-btn" title="Change Status"><span class="codicon codicon-circle-slash"></span></button>
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
      <textarea id="inputText" placeholder="Write a comment…"></textarea>
      <div class="input-icons">
        <button id="attachBtn" class="icon-btn" title="Add Attachment"><span class="codicon codicon-paperclip"></span></button>
        <button id="sendBtn" class="icon-btn send-btn" title="Send"><span class="codicon codicon-send"></span></button>
      </div>
    </div>

    <!-- Status picker overlay -->
    <div id="statusPicker" class="status-picker" style="display:none;"></div>
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
    return `
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
}
.issue-state-dot.open { background: #3fb950; }
.issue-state-dot.closed { background: #f85149; }
.issue-state-dot.in_triage { background: #d29922; }
.issue-state-dot.assigned { background: #58a6ff; }

/* Status stamp overlay on issue list items */
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
    opacity: 0.85;
}
.issue-status-stamp.closed {
    background: rgba(248, 81, 73, 0.15);
    color: #f85149;
    border: 1px solid rgba(248, 81, 73, 0.3);
}
.issue-status-stamp.in_triage {
    background: rgba(210, 153, 34, 0.15);
    color: #d29922;
    border: 1px solid rgba(210, 153, 34, 0.3);
}
.issue-status-stamp.assigned {
    background: rgba(88, 166, 255, 0.15);
    color: #58a6ff;
    border: 1px solid rgba(88, 166, 255, 0.3);
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
/* In new-issue mode, textarea fills the editor area */
.input-area.expanded { flex: 1; }
.input-area textarea {
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
.input-area textarea:focus {
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

/* Status picker (right side for changing issue status) */
.status-picker {
    position: absolute;
    right: 8px;
    top: 34px;
    background: var(--vscode-menu-background);
    border: 1px solid var(--vscode-menu-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    z-index: 100;
    padding: 4px 0;
    min-width: 140px;
}
.status-option {
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.status-option:hover {
    background: var(--vscode-menu-selectionBackground);
    color: var(--vscode-menu-selectionForeground);
}
.status-option .codicon { font-size: 14px; }

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
    var currentRepo = null;
    var allIssues = [];         // All issues from API, unfiltered
    var issues = [];            // Filtered+sorted for display
    var selectedIssue = null;
    var currentComments = [];
    var isNewIssueMode = false;
    var attachments = [];

    // Filter state: selected statuses (multi-select)
    var activeFilters = ['open']; // default: show open only

    // Sort state: ordered list of field keys
    var sortFields = ['updated_at'];
    var SORTABLE_FIELDS = [
        { key: 'number', label: 'Number' },
        { key: 'title', label: 'Title' },
        { key: 'state', label: 'Status' },
        { key: 'created_at', label: 'Created' },
        { key: 'updated_at', label: 'Updated' },
        { key: 'comments', label: 'Comments' },
        { key: 'user', label: 'Author' },
    ];

    // DOM refs
    var repoSelect = document.getElementById('repoSelect');
    var filterBtn = document.getElementById('filterBtn');
    var sortBtn = document.getElementById('sortBtn');
    var refreshBtn = document.getElementById('refreshBtn');
    var issueListEl = document.getElementById('issueList');
    var addBtn = document.getElementById('addBtn');
    var statusBtn = document.getElementById('statusBtn');
    var sendBtn = document.getElementById('sendBtn');
    var attachBtn = document.getElementById('attachBtn');
    var inputText = document.getElementById('inputText');
    var commentHistory = document.getElementById('commentHistory');
    var attachmentArea = document.getElementById('attachmentArea');
    var attachmentListEl = document.getElementById('attachmentList');
    var statusPicker = document.getElementById('statusPicker');
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
                renderRepoDropdown();
                break;

            case 'issues':
                // Merge issues (for "All" mode) or replace
                if (currentRepo && currentRepo.owner === '__all__') {
                    var tagged = (msg.issues || []).map(function(iss) {
                        iss._owner = msg.owner;
                        iss._repo = msg.repo;
                        return iss;
                    });
                    allIssues = allIssues.concat(tagged);
                } else {
                    allIssues = (msg.issues || []).map(function(iss) {
                        iss._owner = msg.owner;
                        iss._repo = msg.repo;
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
    // Determine effective status of an issue (GitHub state + labels)
    // ================================================================
    function getEffectiveStatus(issue) {
        if (issue.state === 'closed') return 'closed';
        var labelNames = (issue.labels || []).map(function(l) { return l.name; });
        var labelStatuses = ['in_triage', 'assigned'];
        for (var i = 0; i < labelStatuses.length; i++) {
            if (labelNames.indexOf(labelStatuses[i]) >= 0) return labelStatuses[i];
        }
        return 'open';
    }

    // ================================================================
    // Filter & Sort
    // ================================================================
    function applyFilterAndSort() {
        // Filter
        if (activeFilters.length === 0) {
            issues = allIssues.slice();
        } else {
            issues = allIssues.filter(function(iss) {
                return activeFilters.indexOf(getEffectiveStatus(iss)) >= 0;
            });
        }
        // Sort
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
            case 'created_at': return issue.created_at || '';
            case 'updated_at': return issue.updated_at || '';
            case 'comments': return issue.comments || 0;
            case 'user': return (issue.user && issue.user.login || '').toLowerCase();
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
            html += '<option value="' + i + '">' + escapeHtml(repos[i].displayName) + '</option>';
        }
        repoSelect.innerHTML = html;
    }

    repoSelect.addEventListener('change', function() {
        var val = repoSelect.value;
        if (val === '' || val === '__all__') {
            currentRepo = val === '__all__' ? { owner: '__all__', repo: '__all__', displayName: 'All Repos' } : null;
            if (val === '__all__') { loadAllIssues(); }
            else { allIssues = []; issues = []; renderIssueList(); }
        } else {
            currentRepo = repos[parseInt(val)];
            loadIssues();
        }
        selectedIssue = null;
        currentComments = [];
        renderEditorState();
    });

    refreshBtn.addEventListener('click', function() {
        if (currentRepo && currentRepo.owner === '__all__') { loadAllIssues(); }
        else if (currentRepo) { loadIssues(); }
    });

    function loadIssues() {
        if (!currentRepo || currentRepo.owner === '__all__') return;
        allIssues = [];
        issueListEl.innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
        vscode.postMessage({
            type: 'loadIssues',
            owner: currentRepo.owner,
            repo: currentRepo.repo,
            state: 'all',
        });
    }

    function loadAllIssues() {
        allIssues = [];
        issueListEl.innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
        if (repos.length === 0) { issues = []; renderIssueList(); return; }
        for (var i = 0; i < repos.length; i++) {
            vscode.postMessage({
                type: 'loadIssues',
                owner: repos[i].owner,
                repo: repos[i].repo,
                state: 'all',
            });
        }
    }

    function loadComments() {
        if (!selectedIssue || !currentRepo) return;
        var owner = selectedIssue._owner || currentRepo.owner;
        var repo = selectedIssue._repo || currentRepo.repo;
        vscode.postMessage({
            type: 'loadComments',
            owner: owner,
            repo: repo,
            issueNumber: selectedIssue.number,
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
        // Collect statuses actually present in current data
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
    // Sort picker (numbered multi-select)
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
            html += '<span class="issue-state-dot ' + effStatus + '"></span>';
            html += '<span class="issue-number">#' + issue.number + '</span>';
            html += '<span class="issue-item-title">' + escapeHtml(issue.title) + '</span>';
            // Status stamp for non-open issues
            if (effStatus !== 'open') {
                html += '<span class="issue-status-stamp ' + effStatus + '">' + escapeHtml(formatStatusLabel(effStatus)) + '</span>';
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
    // Editor state rendering
    // ================================================================
    function renderEditorState() {
        if (isNewIssueMode) {
            issueTitleBar.textContent = 'New Issue';
            commentHistory.classList.add('hidden');
            vSplitHandle.classList.add('hidden');
            commentHistory.style.flex = '';
            inputArea.classList.add('expanded');
            inputArea.style.flex = '';
            inputText.placeholder = 'First line = title, rest = body…';
            statusBtn.style.display = 'none';
        } else {
            commentHistory.classList.remove('hidden');
            vSplitHandle.classList.remove('hidden');
            commentHistory.style.flex = '';
            inputArea.classList.remove('expanded');
            inputArea.style.flex = '';
            if (selectedIssue) {
                issueTitleBar.textContent = '#' + selectedIssue.number + ' ' + selectedIssue.title;
                inputText.placeholder = 'Write a comment…';
                statusBtn.style.display = '';
                renderComments();
            } else {
                issueTitleBar.textContent = 'No issue selected';
                commentHistory.innerHTML = '<div class="empty-state">Select an issue from the list</div>';
                inputText.placeholder = 'Write a comment…';
                statusBtn.style.display = 'none';
            }
        }
    }

    // ================================================================
    // Comments rendering
    // ================================================================
    function renderComments() {
        if (!selectedIssue) return;
        var html = '';
        html += '<div class="comment-card issue-body-card">';
        html += '<div class="comment-header">';
        html += '<img class="comment-avatar" src="' + escapeHtml(selectedIssue.user.avatar_url) + '" />';
        html += '<span class="comment-author">' + escapeHtml(selectedIssue.user.login) + '</span>';
        html += '<span>' + formatDate(selectedIssue.created_at) + '</span>';
        html += '</div>';
        html += '<div class="comment-body">' + escapeHtml(selectedIssue.body || '(No description)') + '</div>';
        html += '</div>';

        for (var i = 0; i < currentComments.length; i++) {
            var c = currentComments[i];
            html += '<div class="comment-card">';
            html += '<div class="comment-header">';
            html += '<img class="comment-avatar" src="' + escapeHtml(c.user.avatar_url) + '" />';
            html += '<span class="comment-author">' + escapeHtml(c.user.login) + '</span>';
            html += '<span>' + formatDate(c.created_at) + '</span>';
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
        inputText.value = '';
        renderAttachments();
        renderEditorState();
    });

    // ================================================================
    // Status button (change issue status)
    // ================================================================
    statusBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (statusPicker.style.display === 'none') {
            showStatusPicker();
        } else {
            statusPicker.style.display = 'none';
        }
    });

    function showStatusPicker() {
        var html = '';
        for (var i = 0; i < configStatuses.length; i++) {
            var st = configStatuses[i];
            var icon;
            switch (st) {
                case 'closed': icon = 'codicon-circle-slash'; break;
                case 'in_triage': icon = 'codicon-search'; break;
                case 'assigned': icon = 'codicon-person'; break;
                default: icon = 'codicon-issue-opened'; break;
            }
            html += '<div class="status-option" data-status="' + escapeHtml(st) + '">';
            html += '<span class="codicon ' + icon + '"></span>';
            html += escapeHtml(formatStatusLabel(st));
            html += '</div>';
        }
        statusPicker.innerHTML = html;
        statusPicker.style.display = '';

        statusPicker.querySelectorAll('.status-option').forEach(function(el) {
            el.addEventListener('click', function() {
                statusPicker.style.display = 'none';
                if (!selectedIssue || !currentRepo) return;
                var owner = selectedIssue._owner || currentRepo.owner;
                var repo = selectedIssue._repo || currentRepo.repo;
                vscode.postMessage({
                    type: 'changeStatus',
                    owner: owner,
                    repo: repo,
                    issueNumber: selectedIssue.number,
                    status: el.dataset.status,
                });
            });
        });
    }

    // Close pickers on outside click
    document.addEventListener('click', function() {
        statusPicker.style.display = 'none';
        filterPicker.style.display = 'none';
        sortPicker.style.display = 'none';
    });

    // ================================================================
    // Send button
    // ================================================================
    sendBtn.addEventListener('click', function() {
        var text = inputText.value.trim();
        if (!text && !isNewIssueMode) return;

        if (isNewIssueMode) {
            if (!currentRepo || currentRepo.owner === '__all__') {
                showError('Please select a specific repo to create an issue');
                return;
            }
            var lines = text.split('\\n');
            var title = lines[0].trim();
            if (!title) {
                showError('First line must be the issue title');
                return;
            }
            var body = lines.slice(1).join('\\n').trim();
            if (attachments.length > 0) {
                body += '\\n\\n---\\nAttachments:\\n';
                for (var i = 0; i < attachments.length; i++) {
                    body += '- ' + attachments[i].name + '\\n';
                }
            }
            vscode.postMessage({
                type: 'createIssue',
                owner: currentRepo.owner,
                repo: currentRepo.repo,
                title: title,
                body: body,
            });
        } else if (selectedIssue) {
            var owner = selectedIssue._owner || currentRepo.owner;
            var repo = selectedIssue._repo || currentRepo.repo;
            var commentBody = text;
            if (attachments.length > 0) {
                commentBody += '\\n\\n---\\nAttachments:\\n';
                for (var j = 0; j < attachments.length; j++) {
                    commentBody += '- ' + attachments[j].name + '\\n';
                }
            }
            vscode.postMessage({
                type: 'addComment',
                owner: owner,
                repo: repo,
                issueNumber: selectedIssue.number,
                body: commentBody,
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
    // Vertical split resize (comment history vs input)
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

let _provider: GitHubIssuesPanelHandler | undefined;

export function registerGitHubIssuesPanel(context: vscode.ExtensionContext): void {
    _provider = new GitHubIssuesPanelHandler(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VIEW_ID, _provider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
    );
}
