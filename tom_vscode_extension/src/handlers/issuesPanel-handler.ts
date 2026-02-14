/**
 * Issues Panel Module
 *
 * Provides HTML, CSS, JS fragments and a message handler for issue management
 * panels.  Designed to be embedded inside the T3 panel as tabs.
 *
 * Two instances are created – one for ISSUES, one for TESTS – each scoped by a
 * prefix so their DOM element IDs do not collide.
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

export type PanelMode = 'issues' | 'tests';

interface IssuePanelConfig {
    provider: string;
    repos: string[];
    additionalRepos: string[];
    statuses: string[];
    labels: string[];
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
// Provider initialisation
// ============================================================================

export function initIssueProviders(): void {
    registerIssueProvider(new GitHubIssueProvider());
}

// ============================================================================
// HTML fragment  (prefix is "issues" or "tests")
// ============================================================================

export function getIssuesHtmlFragment(prefix: string): string {
    return `
<div class="issues-root" id="${prefix}-root">
  <div class="issues-browser" id="${prefix}-browser">
    <div class="browser-toolbar">
      <select id="${prefix}-repoSelect"><option value="">Loading…</option></select>
      <button id="${prefix}-filterBtn" class="icon-btn" title="Filter by status"><span class="codicon codicon-filter"></span></button>
      <button id="${prefix}-sortBtn" class="icon-btn" title="Sort issues"><span class="codicon codicon-list-ordered"></span></button>
      <button id="${prefix}-refreshBtn" class="icon-btn" title="Refresh"><span class="codicon codicon-refresh"></span></button>
    </div>
    <div id="${prefix}-issueList" class="issue-list"></div>
    <div id="${prefix}-filterPicker" class="picker-overlay" style="display:none;"></div>
    <div id="${prefix}-sortPicker" class="picker-overlay sort-picker-overlay" style="display:none;"></div>
  </div>
  <div id="${prefix}-splitHandle" class="split-handle"></div>
  <div class="issues-editor" id="${prefix}-editor">
    <div class="editor-toolbar">
      <span id="${prefix}-issueTitle" class="issue-title-bar">No issue selected</span>
      <div class="toolbar-icons">
        <select id="${prefix}-statusSelect" class="status-select" style="display:none;" title="Change status"></select>
        <button id="${prefix}-openBrowserBtn" class="icon-btn" title="Open in Browser" style="display:none;"><span class="codicon codicon-link-external"></span></button>
        <button id="${prefix}-labelsBtn" class="icon-btn" title="Quick Labels" style="display:none;"><span class="codicon codicon-tag"></span></button>
        <button id="${prefix}-addBtn" class="icon-btn" title="New Issue"><span class="codicon codicon-add"></span></button>
      </div>
    </div>
    <div id="${prefix}-commentHistory" class="comment-history"></div>
    <div id="${prefix}-vSplitHandle" class="v-split-handle"></div>
    <div id="${prefix}-attachmentArea" class="attachment-area" style="display:none;">
      <div id="${prefix}-attachmentList" class="attachment-list"></div>
    </div>
    <div id="${prefix}-inputArea" class="input-area">
      <div class="input-column">
        <input id="${prefix}-titleInput" type="text" placeholder="Issue title…" style="display:none;" />
        <textarea id="${prefix}-inputText" placeholder="Write a comment…"></textarea>
      </div>
      <div class="input-icons">
        <button id="${prefix}-attachBtn" class="icon-btn" title="Add Attachment"><span class="codicon codicon-paperclip"></span></button>
        <button id="${prefix}-sendBtn" class="icon-btn send-btn" title="Send"><span class="codicon codicon-send"></span></button>
      </div>
    </div>
    <div id="${prefix}-labelsPicker" class="labels-picker" style="display:none;"></div>
  </div>
</div>`;
}

// ============================================================================
// CSS  (component-level – no body / global reset)
// ============================================================================

export function getIssuesCss(): string {
    return `
/* ---- Issues panel layout ---- */
.issues-root {
    display: flex;
    flex-direction: row;
    height: 100%;
    width: 100%;
}
.issues-browser {
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
.browser-toolbar select:first-child { flex: 1; min-width: 80px; }
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
.issue-item:hover { background: var(--vscode-list-hoverBackground); }
.issue-item.selected {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
.issue-number { color: var(--vscode-descriptionForeground); font-size: 11px; min-width: 35px; }
.issue-item-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.issue-state-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; background: #888; }
.issue-status-stamp {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    padding: 1px 6px; border-radius: 8px; font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.3px; pointer-events: none;
    background: #ffffff; color: #000000; border: 1px solid #cccccc;
}

/* ---- Picker overlays ---- */
.picker-overlay {
    position: absolute; left: 6px; top: 32px;
    background: var(--vscode-menu-background); border: 1px solid var(--vscode-menu-border);
    border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    z-index: 100; padding: 4px 0; min-width: 180px; max-height: 300px; overflow-y: auto;
}
.picker-option { padding: 4px 10px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px; }
.picker-option:hover { background: var(--vscode-menu-selectionBackground); color: var(--vscode-menu-selectionForeground); }
.picker-option .check-box { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.picker-option .check-box .codicon { font-size: 14px; }
.picker-option .sort-number {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
    font-size: 10px; font-weight: 700; flex-shrink: 0;
}
.picker-option .sort-number.empty { background: transparent; border: 1px solid var(--vscode-descriptionForeground); color: transparent; }
.picker-footer { display: flex; justify-content: flex-end; gap: 4px; padding: 6px 10px 4px 10px; border-top: 1px solid var(--vscode-panel-border); margin-top: 2px; }
.picker-footer button { padding: 3px 10px; font-size: 11px; border: none; border-radius: 3px; cursor: pointer; }
.picker-footer button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.picker-footer button.primary:hover { background: var(--vscode-button-hoverBackground); }
.picker-footer button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.picker-footer button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

/* ---- Split handles ---- */
.split-handle { flex: 0 0 4px; cursor: col-resize; background: transparent; transition: background 0.1s; }
.split-handle:hover, .split-handle.dragging { background: var(--vscode-focusBorder); }
.v-split-handle { flex: 0 0 4px; cursor: row-resize; background: transparent; transition: background 0.1s; }
.v-split-handle:hover, .v-split-handle.dragging { background: var(--vscode-focusBorder); }
.v-split-handle.hidden { display: none !important; }

/* ---- Editor pane ---- */
.issues-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
}
.editor-toolbar {
    display: flex; align-items: center; padding: 4px 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBarSectionHeader-background); gap: 4px;
}
.issue-title-bar { flex: 1; font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toolbar-icons { display: flex; gap: 2px; align-items: center; }
.status-select { padding: 1px 4px; height: 20px; background: #ffffff; color: #000000; border: 1px solid #cccccc; border-radius: 3px; font-size: 11px; cursor: pointer; }

/* Comment history */
.comment-history { flex: 1; overflow-y: auto; padding: 8px; min-height: 40px; }
.comment-history.hidden { display: none !important; }
.comment-card { margin-bottom: 10px; padding: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: var(--vscode-editor-background); }
.comment-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 11px; color: var(--vscode-descriptionForeground); }
.comment-avatar { width: 20px; height: 20px; border-radius: 50%; }
.comment-author { font-weight: 600; color: var(--vscode-foreground); }
.comment-body { font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
.comment-body code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; font-family: var(--vscode-editor-font-family); font-size: 12px; }
.issue-body-card { border-left: 3px solid var(--vscode-focusBorder); }

/* Attachments */
.attachment-area { padding: 4px 8px; border-bottom: 1px solid var(--vscode-panel-border); max-height: 80px; overflow-y: auto; }
.attachment-list { display: flex; flex-wrap: wrap; gap: 4px; }
.attachment-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px; font-size: 11px; }
.attachment-chip .remove-btn { display: none; cursor: pointer; font-size: 10px; opacity: 0.7; background: none; border: none; color: inherit; padding: 0 2px; }
.attachment-chip:hover .remove-btn { display: inline; }
.attachment-chip:hover .remove-btn:hover { opacity: 1; }

/* Input area */
.input-area { display: flex; flex-direction: row; padding: 6px 8px; gap: 4px; min-height: 60px; flex: 0 0 auto; }
.input-area.expanded { flex: 1; }
.input-column { flex: 1; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
.input-column input[type="text"] { padding: 4px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; font-family: var(--vscode-editor-font-family); font-size: 13px; flex: 0 0 auto; }
.input-column input[type="text"]:focus { outline: none; border-color: var(--vscode-focusBorder); }
.input-column textarea { flex: 1; min-height: 40px; resize: none; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.4; }
.input-column textarea:focus { outline: none; border-color: var(--vscode-focusBorder); }
.input-icons { display: flex; flex-direction: column; justify-content: flex-end; gap: 2px; width: 28px; flex-shrink: 0; }

/* Labels picker */
.labels-picker { position: absolute; right: 8px; top: 34px; background: var(--vscode-menu-background); border: 1px solid var(--vscode-menu-border); border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 100; padding: 4px 0; min-width: 160px; }
.label-option { padding: 5px 10px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px; }
.label-option:hover { background: var(--vscode-menu-selectionBackground); color: var(--vscode-menu-selectionForeground); }
.label-option .check-box { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.label-option .check-box .codicon { font-size: 14px; }

/* State indicators */
.empty-state { padding: 20px; text-align: center; color: var(--vscode-descriptionForeground); font-size: 12px; }
.spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid var(--vscode-descriptionForeground); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
`;
}

// ============================================================================
// Script  (prefix-scoped IIFE – uses global `vscode` from T3 panel)
// ============================================================================

export function getIssuesScript(prefix: string, mode: PanelMode): string {
    return `
(function() {
    var _p = '${prefix}';
    var _mode = '${mode}';
    function $e(id) { return document.getElementById(_p + '-' + id); }

    // State
    var repos = [];
    var configStatuses = ['open', 'in_triage', 'assigned', 'closed'];
    var configLabels = [];
    var currentRepo = null;
    var allIssues = [];
    var issues = [];
    var selectedIssue = null;
    var currentComments = [];
    var isNewIssueMode = false;
    var attachments = [];
    var activeFilters = ['open'];
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
    var repoSelect = $e('repoSelect');
    var filterBtn = $e('filterBtn');
    var sortBtn = $e('sortBtn');
    var refreshBtn = $e('refreshBtn');
    var issueListEl = $e('issueList');
    var addBtn = $e('addBtn');
    var statusSelect = $e('statusSelect');
    var openBrowserBtn = $e('openBrowserBtn');
    var labelsBtn = $e('labelsBtn');
    var sendBtn = $e('sendBtn');
    var attachBtn = $e('attachBtn');
    var titleInput = $e('titleInput');
    var inputText = $e('inputText');
    var commentHistory = $e('commentHistory');
    var attachmentArea = $e('attachmentArea');
    var attachmentListEl = $e('attachmentList');
    var labelsPicker = $e('labelsPicker');
    var issueTitleBar = $e('issueTitle');
    var splitHandle = $e('splitHandle');
    var vSplitHandle = $e('vSplitHandle');
    var browserEl = $e('browser');
    var editorEl = $e('editor');
    var filterPicker = $e('filterPicker');
    var sortPicker = $e('sortPicker');
    var inputArea = $e('inputArea');

    // Init
    vscode.postMessage({ type: 'issuesReady', panelMode: _mode });

    // ---- Message listener (filtered by panelMode) ----
    window.addEventListener('message', function(event) {
        var msg = event.data;
        if (msg.panelMode && msg.panelMode !== _mode) return;
        switch (msg.type) {
            case 'issuesInit':
                repos = msg.repos || [];
                configStatuses = msg.statuses || ['open', 'in_triage', 'assigned', 'closed'];
                configLabels = msg.labels || [];
                renderRepoDropdown();
                break;

            case 'issues':
                if (currentRepo && currentRepo.id === '__all__') {
                    var tagged = (msg.issues || []).map(function(iss) { iss._repoId = msg.repoId; return iss; });
                    allIssues = allIssues.concat(tagged);
                } else {
                    allIssues = (msg.issues || []).map(function(iss) { iss._repoId = msg.repoId; return iss; });
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
                for (var i = 0; i < msg.attachments.length; i++) { attachments.push(msg.attachments[i]); }
                renderAttachments();
                break;

            case 'issuesError':
                showError(msg.message);
                break;
        }
    });

    // ---- Effective status ----
    function getEffectiveStatus(issue) {
        if (issue.state === 'closed') return 'closed';
        var labels = issue.labels || [];
        var labelStatuses = configStatuses.filter(function(s) { return s !== 'open' && s !== 'closed'; });
        for (var i = 0; i < labelStatuses.length; i++) {
            if (labels.indexOf(labelStatuses[i]) >= 0) return labelStatuses[i];
        }
        return 'open';
    }

    // ---- Filter & Sort ----
    function applyFilterAndSort() {
        if (activeFilters.length === 0) { issues = allIssues.slice(); }
        else { issues = allIssues.filter(function(iss) { return activeFilters.indexOf(getEffectiveStatus(iss)) >= 0; }); }
        if (sortFields.length > 0) {
            issues.sort(function(a, b) {
                for (var i = 0; i < sortFields.length; i++) {
                    var va = getSortValue(a, sortFields[i]);
                    var vb = getSortValue(b, sortFields[i]);
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

    // ---- Repo dropdown ----
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
            for (var i = 0; i < repos.length; i++) { if (repos[i].id === val) { currentRepo = repos[i]; break; } }
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
        vscode.postMessage({ type: 'loadIssues', repoId: currentRepo.id, state: 'all', panelMode: _mode });
    }
    function loadAllIssues() {
        allIssues = [];
        issueListEl.innerHTML = '<div class="empty-state"><span class="spinner"></span></div>';
        if (repos.length === 0) { issues = []; renderIssueList(); return; }
        for (var i = 0; i < repos.length; i++) {
            vscode.postMessage({ type: 'loadIssues', repoId: repos[i].id, state: 'all', panelMode: _mode });
        }
    }
    function loadComments() {
        if (!selectedIssue || !currentRepo) return;
        var repoId = selectedIssue._repoId || currentRepo.id;
        vscode.postMessage({ type: 'loadComments', repoId: repoId, issueNumber: selectedIssue.number, panelMode: _mode });
    }

    // ---- Filter picker ----
    filterBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (filterPicker.style.display !== 'none') { filterPicker.style.display = 'none'; return; }
        sortPicker.style.display = 'none';
        renderFilterPicker();
        filterPicker.style.display = '';
    });
    function renderFilterPicker() {
        var presentStatuses = {};
        for (var i = 0; i < allIssues.length; i++) { presentStatuses[getEffectiveStatus(allIssues[i])] = true; }
        var html = '';
        for (var j = 0; j < configStatuses.length; j++) {
            var st = configStatuses[j];
            if (!presentStatuses[st]) continue;
            var checked = activeFilters.indexOf(st) >= 0;
            html += '<div class="picker-option" data-status="' + escapeHtml(st) + '">';
            html += '<span class="check-box">' + (checked ? '<span class="codicon codicon-check"></span>' : '') + '</span>';
            html += '<span>' + escapeHtml(formatStatusLabel(st)) + '</span></div>';
        }
        filterPicker.innerHTML = html;
        filterPicker.querySelectorAll('.picker-option').forEach(function(el) {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                var s = el.dataset.status;
                var idx = activeFilters.indexOf(s);
                if (idx >= 0) { activeFilters.splice(idx, 1); } else { activeFilters.push(s); }
                applyFilterAndSort();
                renderIssueList();
                renderFilterPicker();
            });
        });
    }

    // ---- Sort picker ----
    var pendingSortFields = [];
    sortBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (sortPicker.style.display !== 'none') { sortPicker.style.display = 'none'; return; }
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
            html += '<span class="sort-number ' + (hasOrder ? '' : 'empty') + '">' + (hasOrder ? (order + 1) : '') + '</span>';
            html += '<span>' + escapeHtml(f.label) + '</span></div>';
        }
        html += '<div class="picker-footer">';
        html += '<button class="secondary" id="' + _p + '-sortReset">Reset</button>';
        html += '<button class="primary" id="' + _p + '-sortOk">OK</button>';
        html += '</div>';
        sortPicker.innerHTML = html;
        sortPicker.querySelectorAll('.picker-option').forEach(function(el) {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                var field = el.dataset.field;
                var idx = pendingSortFields.indexOf(field);
                if (idx >= 0) { pendingSortFields.splice(idx, 1); } else { pendingSortFields.push(field); }
                renderSortPicker();
            });
        });
        $e('sortReset').addEventListener('click', function(e) { e.stopPropagation(); pendingSortFields = []; renderSortPicker(); });
        $e('sortOk').addEventListener('click', function(e) {
            e.stopPropagation(); sortFields = pendingSortFields.slice();
            sortPicker.style.display = 'none'; applyFilterAndSort(); renderIssueList();
        });
    }

    // ---- Issue list ----
    function renderIssueList() {
        if (issues.length === 0) { issueListEl.innerHTML = '<div class="empty-state">No issues found</div>'; return; }
        var html = '';
        for (var i = 0; i < issues.length; i++) {
            var issue = issues[i];
            var sel = selectedIssue && selectedIssue.id === issue.id ? ' selected' : '';
            var effStatus = getEffectiveStatus(issue);
            html += '<div class="issue-item' + sel + '" data-idx="' + i + '">';
            html += '<span class="issue-state-dot"></span>';
            html += '<span class="issue-number">#' + issue.number + '</span>';
            html += '<span class="issue-item-title">' + escapeHtml(issue.title) + '</span>';
            if (effStatus !== 'open') { html += '<span class="issue-status-stamp">' + escapeHtml(formatStatusLabel(effStatus)) + '</span>'; }
            html += '</div>';
        }
        issueListEl.innerHTML = html;
        issueListEl.querySelectorAll('.issue-item').forEach(function(el) {
            el.addEventListener('click', function() { selectIssue(issues[parseInt(el.dataset.idx)]); });
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

    // ---- Editor state ----
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
                var effStatus = getEffectiveStatus(selectedIssue);
                var optHtml = '';
                for (var i = 0; i < configStatuses.length; i++) {
                    var st = configStatuses[i];
                    optHtml += '<option value="' + escapeHtml(st) + '"' + (effStatus === st ? ' selected' : '') + '>' + escapeHtml(formatStatusLabel(st)) + '</option>';
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

    // ---- Comments ----
    function renderComments() {
        if (!selectedIssue) return;
        var html = '';
        html += '<div class="comment-card issue-body-card"><div class="comment-header">';
        html += '<img class="comment-avatar" src="' + escapeHtml(selectedIssue.author.avatarUrl) + '" />';
        html += '<span class="comment-author">' + escapeHtml(selectedIssue.author.name) + '</span>';
        html += '<span>' + formatDate(selectedIssue.createdAt) + '</span></div>';
        html += '<div class="comment-body">' + escapeHtml(selectedIssue.body || '(No description)') + '</div></div>';
        for (var i = 0; i < currentComments.length; i++) {
            var c = currentComments[i];
            html += '<div class="comment-card"><div class="comment-header">';
            html += '<img class="comment-avatar" src="' + escapeHtml(c.author.avatarUrl) + '" />';
            html += '<span class="comment-author">' + escapeHtml(c.author.name) + '</span>';
            html += '<span>' + formatDate(c.createdAt) + '</span></div>';
            html += '<div class="comment-body">' + escapeHtml(c.body) + '</div></div>';
        }
        commentHistory.innerHTML = html;
        commentHistory.scrollTop = commentHistory.scrollHeight;
    }

    // ---- New issue ----
    addBtn.addEventListener('click', function() {
        isNewIssueMode = true; attachments = []; titleInput.value = ''; inputText.value = '';
        renderAttachments(); renderEditorState();
    });

    // ---- Status dropdown ----
    statusSelect.addEventListener('change', function() {
        if (!selectedIssue || !currentRepo) return;
        var repoId = selectedIssue._repoId || currentRepo.id;
        vscode.postMessage({ type: 'changeStatus', repoId: repoId, issueNumber: selectedIssue.number, status: statusSelect.value, panelMode: _mode });
    });

    // ---- Open in browser ----
    openBrowserBtn.addEventListener('click', function() {
        if (selectedIssue && selectedIssue.url) { vscode.postMessage({ type: 'openExternal', url: selectedIssue.url }); }
    });

    // ---- Labels picker ----
    labelsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (labelsPicker.style.display !== 'none') { labelsPicker.style.display = 'none'; return; }
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
            html += '<span class="check-box">' + (hasLabel ? '<span class="codicon codicon-check"></span>' : '') + '</span>';
            html += '<span>' + escapeHtml(displayName) + '</span></div>';
        }
        labelsPicker.innerHTML = html;
        labelsPicker.style.display = '';
        labelsPicker.querySelectorAll('.label-option').forEach(function(el) {
            el.addEventListener('click', function() {
                if (!selectedIssue || !currentRepo) return;
                var repoId = selectedIssue._repoId || currentRepo.id;
                vscode.postMessage({ type: 'toggleLabel', repoId: repoId, issueNumber: selectedIssue.number, label: el.dataset.label, panelMode: _mode });
                labelsPicker.style.display = 'none';
            });
        });
    }

    // Close pickers on outside click (scoped to this panel's pickers)
    document.addEventListener('click', function() {
        filterPicker.style.display = 'none';
        sortPicker.style.display = 'none';
        labelsPicker.style.display = 'none';
    });

    // ---- Send ----
    sendBtn.addEventListener('click', function() {
        if (isNewIssueMode) {
            var title = titleInput.value.trim();
            if (!title) { showError('Please enter a title'); return; }
            if (!currentRepo || currentRepo.id === '__all__') { showError('Please select a specific repo to create an issue'); return; }
            var body = inputText.value.trim();
            if (attachments.length > 0) {
                body += '\\n\\n---\\nAttachments:\\n';
                for (var i = 0; i < attachments.length; i++) { body += '- ' + attachments[i].name + '\\n'; }
            }
            vscode.postMessage({ type: 'createIssue', repoId: currentRepo.id, title: title, body: body, panelMode: _mode });
        } else if (selectedIssue) {
            var text = inputText.value.trim();
            if (!text) return;
            var repoId = selectedIssue._repoId || currentRepo.id;
            var commentBody = text;
            if (attachments.length > 0) {
                commentBody += '\\n\\n---\\nAttachments:\\n';
                for (var j = 0; j < attachments.length; j++) { commentBody += '- ' + attachments[j].name + '\\n'; }
            }
            vscode.postMessage({ type: 'addComment', repoId: repoId, issueNumber: selectedIssue.number, body: commentBody, panelMode: _mode });
            attachments = [];
            renderAttachments();
        }
    });

    // ---- Attachments ----
    attachBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'pickAttachment', panelMode: _mode });
    });
    function renderAttachments() {
        if (attachments.length === 0) { attachmentArea.style.display = 'none'; return; }
        attachmentArea.style.display = '';
        var html = '';
        for (var i = 0; i < attachments.length; i++) {
            html += '<span class="attachment-chip" data-idx="' + i + '"><span class="codicon codicon-file"></span>';
            html += escapeHtml(attachments[i].name);
            html += '<button class="remove-btn" data-aidx="' + i + '">&times;</button></span>';
        }
        attachmentListEl.innerHTML = html;
        attachmentListEl.querySelectorAll('.remove-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                attachments.splice(parseInt(btn.dataset.aidx), 1);
                renderAttachments();
            });
        });
    }

    // ---- Horizontal split resize ----
    (function() {
        var dragging = false, startX, startWidth;
        splitHandle.addEventListener('mousedown', function(e) {
            e.preventDefault(); dragging = true; startX = e.clientX; startWidth = browserEl.offsetWidth;
            splitHandle.classList.add('dragging');
            document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
        });
        function onMove(e) { if (!dragging) return; var dx = e.clientX - startX; browserEl.style.flex = '0 0 ' + Math.max(120, Math.min(startWidth + dx, window.innerWidth - 200)) + 'px'; }
        function onUp() { dragging = false; splitHandle.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
    })();

    // ---- Vertical split resize ----
    (function() {
        var dragging = false, startY, startCommentH, startInputH;
        vSplitHandle.addEventListener('mousedown', function(e) {
            e.preventDefault(); dragging = true; startY = e.clientY;
            startCommentH = commentHistory.offsetHeight; startInputH = inputArea.offsetHeight;
            vSplitHandle.classList.add('dragging');
            document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
        });
        function onMove(e) { if (!dragging) return; var dy = e.clientY - startY; commentHistory.style.flex = '0 0 ' + Math.max(40, startCommentH + dy) + 'px'; inputArea.style.flex = '0 0 ' + Math.max(40, startInputH - dy) + 'px'; }
        function onUp() { dragging = false; vSplitHandle.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
    })();

    // ---- Utility ----
    function escapeHtml(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function formatDate(iso) { try { var d = new Date(iso); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch(e) { return iso; } }
    function formatStatusLabel(st) { return st.replace(/_/g, ' ').replace(/\\b[a-z]/g, function(c) { return c.toUpperCase(); }); }
    function showError(msg) {
        var div = document.createElement('div'); div.className = 'empty-state'; div.style.color = 'var(--vscode-errorForeground)'; div.textContent = msg;
        commentHistory.appendChild(div); setTimeout(function() { if (div.parentNode) div.parentNode.removeChild(div); }, 5000);
    }
})();
`;
}

// ============================================================================
// Extension-side message handler
// ============================================================================

export async function handleIssuesPanelMessage(msg: any, webview: vscode.Webview): Promise<void> {
    const mode: PanelMode = msg.panelMode;
    if (!mode) { return; }

    const configSection = mode === 'issues' ? 'tomIssues' : 'tomTests';
    const includeWorkspaceRepos = mode === 'issues';
    const config = loadPanelConfig(configSection);

    function getProvider(): IssueProvider {
        const provider = getIssueProvider(config.provider);
        if (!provider) { throw new Error(`Issue provider "${config.provider}" is not registered`); }
        return provider;
    }

    switch (msg.type) {
        case 'issuesReady': {
            const provider = getProvider();
            let repos: IssueProviderRepo[];
            if (includeWorkspaceRepos) {
                repos = provider.discoverRepos();
                const additional: IssueProviderRepo[] = config.additionalRepos.map(r => ({ id: r, displayName: r }));
                const seen = new Set(repos.map(r => r.id));
                for (const r of additional) { if (!seen.has(r.id)) { repos.push(r); seen.add(r.id); } }
            } else {
                repos = config.repos.map(r => ({ id: r, displayName: r }));
            }
            webview.postMessage({ type: 'issuesInit', repos, statuses: config.statuses, labels: config.labels, panelMode: mode });
            break;
        }

        case 'loadIssues': {
            try {
                const provider = getProvider();
                const issues = await provider.listIssues(msg.repoId, msg.state || 'all');
                webview.postMessage({ type: 'issues', issues, repoId: msg.repoId, panelMode: mode });
            } catch (e: any) {
                webview.postMessage({ type: 'issuesError', message: e.message, panelMode: mode });
            }
            break;
        }

        case 'loadComments': {
            try {
                const provider = getProvider();
                const comments = await provider.listComments(msg.repoId, msg.issueNumber);
                webview.postMessage({ type: 'comments', comments, issueNumber: msg.issueNumber, panelMode: mode });
            } catch (e: any) {
                webview.postMessage({ type: 'issuesError', message: e.message, panelMode: mode });
            }
            break;
        }

        case 'createIssue': {
            try {
                const provider = getProvider();
                const issue = await provider.createIssue(msg.repoId, msg.title, msg.body || '');
                webview.postMessage({ type: 'issueCreated', issue, panelMode: mode });
                vscode.window.showInformationMessage(`Issue #${issue.number} created`);
            } catch (e: any) {
                webview.postMessage({ type: 'issuesError', message: e.message, panelMode: mode });
            }
            break;
        }

        case 'addComment': {
            try {
                const provider = getProvider();
                const comment = await provider.addComment(msg.repoId, msg.issueNumber, msg.body);
                webview.postMessage({ type: 'commentAdded', comment, issueNumber: msg.issueNumber, panelMode: mode });
            } catch (e: any) {
                webview.postMessage({ type: 'issuesError', message: e.message, panelMode: mode });
            }
            break;
        }

        case 'changeStatus': {
            try {
                const provider = getProvider();
                const issue = await provider.changeStatus(msg.repoId, msg.issueNumber, msg.status, config.statuses);
                webview.postMessage({ type: 'issueUpdated', issue, panelMode: mode });
                vscode.window.showInformationMessage(`Issue #${msg.issueNumber} → ${msg.status}`);
            } catch (e: any) {
                webview.postMessage({ type: 'issuesError', message: e.message, panelMode: mode });
            }
            break;
        }

        case 'toggleLabel': {
            try {
                const provider = getProvider();
                const issue = await provider.toggleLabel(msg.repoId, msg.issueNumber, msg.label);
                const eqIdx = msg.label.indexOf('=');
                const displayLabel = eqIdx > 0 ? msg.label.substring(eqIdx + 1) : msg.label;
                webview.postMessage({ type: 'issueUpdated', issue, panelMode: mode });
                vscode.window.showInformationMessage(`Issue #${msg.issueNumber}: toggled label "${displayLabel}"`);
            } catch (e: any) {
                webview.postMessage({ type: 'issuesError', message: e.message, panelMode: mode });
            }
            break;
        }

        case 'openExternal': {
            if (msg.url) { vscode.env.openExternal(vscode.Uri.parse(msg.url)); }
            break;
        }

        case 'pickAttachment': {
            const files = await vscode.window.showOpenDialog({ canSelectMany: true, openLabel: 'Attach' });
            if (files && files.length > 0) {
                const attachments = files.map(f => ({ name: path.basename(f.fsPath), path: f.fsPath }));
                webview.postMessage({ type: 'attachmentsPicked', attachments, panelMode: mode });
            }
            break;
        }
    }
}
