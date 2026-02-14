/**
 * T3 Panel Handler – Tabbed panel containing TASKS, LOGS, SETTINGS, ISSUES and TESTS.
 *
 * A single VS Code webview panel ("TOM") with an internal tab bar.  The ISSUES
 * and TESTS tabs embed the issues panel fragments from issuesPanel-handler.
 */

import * as vscode from 'vscode';
import {
    getIssuesHtmlFragment,
    getIssuesCss,
    getIssuesScript,
    handleIssuesPanelMessage,
    initIssueProviders,
} from './issuesPanel-handler';

const VIEW_ID = 'dartscript.t3Panel';

export class T3PanelHandler implements vscode.WebviewViewProvider {
    public static readonly viewType = VIEW_ID;
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _extensionContext: vscode.ExtensionContext;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._extensionUri = extensionUri;
        this._extensionContext = context;
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

        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                await this._handleMessage(message, webviewView.webview);
            },
            undefined,
            this._extensionContext.subscriptions,
        );
    }

    // ------------------------------------------------------------------
    // Message routing
    // ------------------------------------------------------------------

    private async _handleMessage(message: any, webview: vscode.Webview): Promise<void> {
        if (message.type === 'action') {
            // T3 simple-tab actions (tasks / logs / settings)
            switch (message.action) {
                case 'addTask':
                    vscode.window.showInformationMessage('T3: Add Task clicked');
                    break;
                case 'clearTasks':
                    vscode.window.showInformationMessage('T3: Clear Tasks clicked');
                    break;
                case 'refreshLogs':
                    vscode.window.showInformationMessage('T3: Refresh Logs clicked');
                    break;
                case 'exportLogs':
                    vscode.window.showInformationMessage('T3: Export Logs clicked');
                    break;
                case 'saveSettings':
                    vscode.window.showInformationMessage('T3: Save Settings clicked');
                    break;
                case 'resetSettings':
                    vscode.window.showInformationMessage('T3: Reset Settings clicked');
                    break;
            }
        } else if (message.panelMode) {
            // Delegate to the issues panel handler
            await handleIssuesPanelMessage(message, webview);
        }
    }

    // ------------------------------------------------------------------
    // Full HTML page
    // ------------------------------------------------------------------

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'),
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<link rel="stylesheet" href="${codiconsUri}"/>
<style>
/* ---- Global reset ---- */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-panel-background);
    height: 100vh;
    overflow: hidden;
}

/* ---- Tab bar ---- */
.t3-container { display: flex; flex-direction: column; height: 100%; width: 100%; }
.t3-tab-bar {
    display: flex; flex-shrink: 0; align-items: stretch;
    background: var(--vscode-sideBarSectionHeader-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    height: 28px; gap: 0; overflow-x: auto;
    scrollbar-width: none;
}
.t3-tab-bar::-webkit-scrollbar { display: none; }
.t3-tab {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 0 10px; font-size: 11px; text-transform: uppercase;
    background: none; border: none; border-bottom: 2px solid transparent;
    color: var(--vscode-foreground); cursor: pointer; opacity: 0.6;
    white-space: nowrap; flex-shrink: 0;
}
.t3-tab:hover { opacity: 0.8; }
.t3-tab.active { opacity: 1; border-bottom-color: var(--vscode-focusBorder); font-weight: 600; }
.t3-tab .codicon { font-size: 14px; }

/* ---- Tab content ---- */
.t3-content { flex: 1; overflow: hidden; position: relative; }
.t3-tab-content { display: none; height: 100%; width: 100%; }
.t3-tab-content.active { display: flex; flex-direction: column; }

/* ---- Simple content (tasks / logs / settings) ---- */
.simple-content { display: flex; flex-direction: column; height: 100%; padding: 8px; gap: 6px; }
.simple-content .toolbar {
    display: flex; align-items: center; gap: 4px; flex-shrink: 0;
}
.simple-content textarea {
    flex: 1; resize: none; padding: 6px 8px;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border); border-radius: 3px;
    font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.4;
}
.simple-content textarea:focus { outline: none; border-color: var(--vscode-focusBorder); }
.simple-content .status-bar {
    flex-shrink: 0; font-size: 11px; color: var(--vscode-descriptionForeground);
    padding: 2px 4px;
}
.icon-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; background: none; border: none;
    color: var(--vscode-foreground); cursor: pointer; border-radius: 3px; opacity: 0.8;
}
.icon-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
.icon-btn.danger:hover { color: var(--vscode-errorForeground); }
.icon-btn.send-btn { color: var(--vscode-button-background); }
.icon-btn.send-btn:hover { opacity: 1; }
button.primary {
    padding: 4px 10px; font-size: 12px; border: none; border-radius: 3px; cursor: pointer;
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
}
button.primary:hover { background: var(--vscode-button-hoverBackground); }

/* ---- Issues component styles ---- */
${getIssuesCss()}
</style>
</head>
<body>
<div class="t3-container">
  <div class="t3-tab-bar">
    <button class="t3-tab active" data-tab="tasks"><span class="codicon codicon-checklist"></span> Tasks</button>
    <button class="t3-tab" data-tab="logs"><span class="codicon codicon-output"></span> Logs</button>
    <button class="t3-tab" data-tab="settings"><span class="codicon codicon-settings-gear"></span> Settings</button>
    <button class="t3-tab" data-tab="issues"><span class="codicon codicon-issues"></span> Issues</button>
    <button class="t3-tab" data-tab="tests"><span class="codicon codicon-beaker"></span> Tests</button>
  </div>
  <div class="t3-content">
    <div class="t3-tab-content active" data-tab-content="tasks">
      <div class="simple-content">
        <div class="toolbar">
          <button class="icon-btn" data-action="addTask" title="Add Task"><span class="codicon codicon-add"></span></button>
          <button class="icon-btn danger" data-action="clearTasks" title="Clear All"><span class="codicon codicon-trash"></span></button>
        </div>
        <textarea placeholder="Enter tasks here..."></textarea>
        <div class="status-bar">Tasks panel ready</div>
      </div>
    </div>
    <div class="t3-tab-content" data-tab-content="logs">
      <div class="simple-content">
        <div class="toolbar">
          <button class="icon-btn" data-action="refreshLogs" title="Refresh"><span class="codicon codicon-refresh"></span></button>
          <button class="icon-btn" data-action="exportLogs" title="Export Logs"><span class="codicon codicon-go-to-file"></span></button>
        </div>
        <textarea readonly placeholder="Log output will appear here..."></textarea>
        <div class="status-bar">Logs panel ready</div>
      </div>
    </div>
    <div class="t3-tab-content" data-tab-content="settings">
      <div class="simple-content">
        <div class="toolbar">
          <button class="primary" data-action="saveSettings">Save</button>
          <button data-action="resetSettings">Reset</button>
        </div>
        <textarea placeholder="Configuration settings..."></textarea>
        <div class="status-bar">Settings panel ready</div>
      </div>
    </div>
    <div class="t3-tab-content" data-tab-content="issues">
      ${getIssuesHtmlFragment('issues')}
    </div>
    <div class="t3-tab-content" data-tab-content="tests">
      ${getIssuesHtmlFragment('tests')}
    </div>
  </div>
</div>
<script>
(function() {
    var vscode = acquireVsCodeApi();

    // ---- Tab switching ----
    var tabBtns = document.querySelectorAll('.t3-tab');
    function switchTab(tabId) {
        tabBtns.forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.t3-tab-content').forEach(function(c) { c.classList.remove('active'); });
        var btn = document.querySelector('.t3-tab[data-tab="' + tabId + '"]');
        var content = document.querySelector('[data-tab-content="' + tabId + '"]');
        if (btn && content) { btn.classList.add('active'); content.classList.add('active'); }
        var state = vscode.getState() || {};
        state.activeTab = tabId;
        vscode.setState(state);
    }
    tabBtns.forEach(function(btn) {
        btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
    });
    // Restore persisted tab
    (function() {
        var s = vscode.getState();
        if (s && s.activeTab) { switchTab(s.activeTab); }
    })();

    // ---- Simple-action buttons (tasks / logs / settings) ----
    document.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-action]');
        if (btn) { vscode.postMessage({ type: 'action', action: btn.dataset.action }); }
    });

    // ---- Issues & Tests panel scripts ----
    ${getIssuesScript('issues', 'issues')}
    ${getIssuesScript('tests', 'tests')}
})();
</script>
</body>
</html>`;
    }
}

let _provider: T3PanelHandler | undefined;

export function registerT3Panel(context: vscode.ExtensionContext): void {
    initIssueProviders();
    _provider = new T3PanelHandler(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VIEW_ID, _provider, {
            webviewOptions: { retainContextWhenHidden: true },
        }),
    );
}
