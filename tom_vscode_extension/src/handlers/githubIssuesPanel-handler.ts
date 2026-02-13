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
    GitHubIssue,
    GitHubComment,
    RepoInfo,
    discoverWorkspaceRepos,
    listIssues,
    listComments,
    createIssue,
    addComment,
    updateIssue,
} from './githubApi';
import { getConfigPath } from './handler_shared';

const VIEW_ID = 'dartscript.githubIssues';

// ============================================================================
// Configuration
// ============================================================================

interface GitHubIssuesConfig {
    additionalRepos: string[];       // "owner/repo" strings
    statuses: string[];              // e.g. ["open", "closed"]
}

function loadGitHubIssuesConfig(): GitHubIssuesConfig {
    const defaults: GitHubIssuesConfig = {
        additionalRepos: [],
        statuses: ['open', 'closed'],
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
                    const issues = await listIssues(owner, repo, state || 'open');
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
                    const state = (status === 'closed') ? 'closed' : 'open';
                    const issue = await updateIssue(owner, repo, issueNumber, { state });
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
      <select id="stateFilter">
        <option value="open" selected>Open</option>
        <option value="closed">Closed</option>
        <option value="all">All</option>
      </select>
      <button id="refreshBtn" class="icon-btn" title="Refresh"><span class="codicon codicon-refresh"></span></button>
    </div>
    <div id="issueList" class="issue-list"></div>
  </div>

  <!-- Resize handle -->
  <div id="splitHandle" class="split-handle"></div>

  <!-- RIGHT: Issue Editor -->
  <div id="editor">
    <!-- Top icon bar -->
    <div class="editor-toolbar">
      <span id="issueTitle" class="issue-title-bar">No issue selected</span>
      <div class="toolbar-icons">
        <button id="addBtn" class="icon-btn" title="New Issue"><span class="codicon codicon-add"></span></button>
        <button id="statusBtn" class="icon-btn" title="Change Status"><span class="codicon codicon-circle-slash"></span></button>
      </div>
    </div>

    <!-- Comment history -->
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
#stateFilter { width: 70px; }
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
    min-height: 60px;
}
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
.attachment-chip:hover .remove-btn {
    display: inline;
}
.attachment-chip:hover .remove-btn:hover {
    opacity: 1;
}

/* Input area */
.input-area {
    display: flex;
    flex-direction: row;
    padding: 6px 8px;
    gap: 4px;
    min-height: 60px;
    flex: 0 0 auto;
}
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

/* Status picker */
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
    min-width: 120px;
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

/* New issue mode */
.new-issue-input {
    width: 100%;
    padding: 6px 8px;
    margin-bottom: 6px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    font-size: 13px;
    font-family: var(--vscode-font-family);
}
.new-issue-input:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
}
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
    var statuses = ['open', 'closed'];
    var currentRepo = null; // { owner, repo, displayName }
    var issues = [];
    var selectedIssue = null;   // GitHubIssue
    var currentComments = [];
    var isNewIssueMode = false;
    var attachments = [];       // [{ name, path }]

    // DOM refs
    var repoSelect = document.getElementById('repoSelect');
    var stateFilter = document.getElementById('stateFilter');
    var refreshBtn = document.getElementById('refreshBtn');
    var issueList = document.getElementById('issueList');
    var addBtn = document.getElementById('addBtn');
    var statusBtn = document.getElementById('statusBtn');
    var sendBtn = document.getElementById('sendBtn');
    var attachBtn = document.getElementById('attachBtn');
    var inputText = document.getElementById('inputText');
    var commentHistory = document.getElementById('commentHistory');
    var attachmentArea = document.getElementById('attachmentArea');
    var attachmentList = document.getElementById('attachmentList');
    var statusPicker = document.getElementById('statusPicker');
    var issueTitleBar = document.getElementById('issueTitle');
    var splitHandle = document.getElementById('splitHandle');
    var vSplitHandle = document.getElementById('vSplitHandle');
    var browserEl = document.getElementById('browser');
    var editorEl = document.getElementById('editor');

    // ---- Init ----
    vscode.postMessage({ type: 'ready' });

    // ---- Message handlers ----
    window.addEventListener('message', function(event) {
        var msg = event.data;
        switch (msg.type) {
            case 'init':
                repos = msg.repos || [];
                statuses = msg.statuses || ['open', 'closed'];
                renderRepoDropdown();
                break;

            case 'issues':
                issues = msg.issues || [];
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

    // ---- Repo dropdown ----
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
            else { issues = []; renderIssueList(); }
        } else {
            currentRepo = repos[parseInt(val)];
            loadIssues();
        }
        selectedIssue = null;
        currentComments = [];
        renderEditorState();
    });

    stateFilter.addEventListener('change', function() {
        if (currentRepo && currentRepo.owner === '__all__') { loadAllIssues(); }
        else if (currentRepo) { loadIssues(); }
    });

    refreshBtn.addEventListener('click', function() {
        if (currentRepo && currentRepo.owner === '__all__') { loadAllIssues(); }
        else if (currentRepo) { loadIssues(); }
    });

    function loadIssues() {
        if (!currentRepo || currentRepo.owner === '__all__') return;
        issueList.innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
        vscode.postMessage({
            type: 'loadIssues',
            owner: currentRepo.owner,
            repo: currentRepo.repo,
            state: stateFilter.value,
        });
    }

    function loadAllIssues() {
        issues = [];
        issueList.innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
        var pending = repos.length;
        if (pending === 0) { renderIssueList(); return; }
        for (var i = 0; i < repos.length; i++) {
            vscode.postMessage({
                type: 'loadIssues',
                owner: repos[i].owner,
                repo: repos[i].repo,
                state: stateFilter.value,
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

    // ---- Issue list rendering ----
    function renderIssueList() {
        if (issues.length === 0) {
            issueList.innerHTML = '<div class="empty-state">No issues found</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < issues.length; i++) {
            var issue = issues[i];
            var sel = selectedIssue && selectedIssue.id === issue.id ? ' selected' : '';
            html += '<div class="issue-item' + sel + '" data-idx="' + i + '">';
            html += '<span class="issue-state-dot ' + issue.state + '"></span>';
            html += '<span class="issue-number">#' + issue.number + '</span>';
            html += '<span class="issue-item-title">' + escapeHtml(issue.title) + '</span>';
            html += '</div>';
        }
        issueList.innerHTML = html;

        // Attach click handlers
        var items = issueList.querySelectorAll('.issue-item');
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

    // ---- Editor state rendering ----
    function renderEditorState() {
        if (isNewIssueMode) {
            issueTitleBar.textContent = 'New Issue';
            commentHistory.innerHTML = '<input id="newIssueTitle" class="new-issue-input" placeholder="Issue title…" />';
            inputText.placeholder = 'Issue body…';
            statusBtn.style.display = 'none';
        } else if (selectedIssue) {
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

    // ---- Comments rendering ----
    function renderComments() {
        if (!selectedIssue) return;
        var html = '';

        // Issue body as first "comment"
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

    // ---- Add button (new issue) ----
    addBtn.addEventListener('click', function() {
        isNewIssueMode = true;
        attachments = [];
        inputText.value = '';
        renderAttachments();
        renderEditorState();
    });

    // ---- Status button ----
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
        for (var i = 0; i < statuses.length; i++) {
            var icon = statuses[i] === 'closed' ? 'codicon-circle-slash' : 'codicon-issue-opened';
            html += '<div class="status-option" data-status="' + escapeHtml(statuses[i]) + '">';
            html += '<span class="codicon ' + icon + '"></span>';
            html += escapeHtml(statuses[i].charAt(0).toUpperCase() + statuses[i].slice(1));
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

    // Close status picker on outside click
    document.addEventListener('click', function() {
        statusPicker.style.display = 'none';
    });

    // ---- Send button ----
    sendBtn.addEventListener('click', function() {
        var text = inputText.value.trim();
        if (!text) return;

        if (isNewIssueMode) {
            // Create new issue
            if (!currentRepo || currentRepo.owner === '__all__') {
                showError('Please select a specific repo to create an issue');
                return;
            }
            var titleEl = document.getElementById('newIssueTitle');
            var title = titleEl ? titleEl.value.trim() : '';
            if (!title) {
                showError('Issue title is required');
                return;
            }
            var body = text;
            // Append attachment references
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
            // Add comment
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

    // ---- Attachment button ----
    attachBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'pickAttachment' });
    });

    // ---- Attachment rendering ----
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
        attachmentList.innerHTML = html;

        attachmentList.querySelectorAll('.remove-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(btn.dataset.aidx);
                attachments.splice(idx, 1);
                renderAttachments();
            });
        });
    }

    // ---- Drag and drop ----
    document.body.addEventListener('dragover', function(e) { e.preventDefault(); });
    document.body.addEventListener('drop', function(e) {
        e.preventDefault();
        // Note: In webview, dropped files from Finder need special handling;
        // for now we show a message suggesting the attach button.
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            showError('Drag-and-drop from external apps is limited in webviews. Please use the attachment button.');
        }
    });

    // ---- Horizontal split resize ----
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

    // ---- Vertical split resize (comment history vs input) ----
    (function() {
        var dragging = false;
        var startY, startHeight;
        vSplitHandle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            dragging = true;
            startY = e.clientY;
            startHeight = commentHistory.offsetHeight;
            vSplitHandle.classList.add('dragging');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        function onMove(e) {
            if (!dragging) return;
            var dy = e.clientY - startY;
            var newHeight = Math.max(40, startHeight + dy);
            commentHistory.style.flex = '0 0 ' + newHeight + 'px';
        }
        function onUp() {
            dragging = false;
            vSplitHandle.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
    })();

    // ---- Utility ----
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

    function showError(msg) {
        // Brief error toast in the comment history
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
