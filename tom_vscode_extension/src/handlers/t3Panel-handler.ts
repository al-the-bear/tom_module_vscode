/**
 * T3 Panel Handler – Accordion panel containing TASKS, LOGS, SETTINGS, ISSUES and TESTS.
 *
 * A single VS Code webview panel ("TOM") using the reusable accordion component.
 * The ISSUES and TESTS sections embed the issues panel fragments from
 * issuesPanel-handler.
 */

import * as vscode from 'vscode';
import { AccordionSection, getAccordionHtml } from './accordionPanel';
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
            // T3 simple-section actions (tasks / logs / settings)
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
    // HTML via accordion component
    // ------------------------------------------------------------------

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'),
        );

        const sections: AccordionSection[] = [
            {
                id: 'tasks',
                title: 'Tasks',
                icon: 'checklist',
                content: `
<div class="toolbar">
    <button class="icon-btn" data-action="addTask" title="Add Task"><span class="codicon codicon-add"></span></button>
    <button class="icon-btn danger" data-action="clearTasks" title="Clear All"><span class="codicon codicon-trash"></span></button>
</div>
<textarea placeholder="Enter tasks here..."></textarea>
<div class="status-bar">Tasks panel ready</div>`,
            },
            {
                id: 'logs',
                title: 'Logs',
                icon: 'output',
                content: `
<div class="toolbar">
    <button class="icon-btn" data-action="refreshLogs" title="Refresh"><span class="codicon codicon-refresh"></span></button>
    <button class="icon-btn" data-action="exportLogs" title="Export Logs"><span class="codicon codicon-go-to-file"></span></button>
</div>
<textarea readonly placeholder="Log output will appear here..."></textarea>
<div class="status-bar">Logs panel ready</div>`,
            },
            {
                id: 'settings',
                title: 'Settings',
                icon: 'settings-gear',
                content: `
<div class="toolbar">
    <button class="primary" data-action="saveSettings">Save</button>
    <button data-action="resetSettings">Reset</button>
</div>
<textarea placeholder="Configuration settings..."></textarea>
<div class="status-bar">Settings panel ready</div>`,
            },
            {
                id: 'issues',
                title: 'Issues',
                icon: 'issues',
                content: getIssuesHtmlFragment('issues'),
            },
            {
                id: 'tests',
                title: 'Tests',
                icon: 'beaker',
                content: getIssuesHtmlFragment('tests'),
            },
        ];

        // Issues panels need their own CSS and client-side scripts
        const additionalCss = getIssuesCss();
        const additionalScript = `
${getIssuesScript('issues', 'issues')}
${getIssuesScript('tests', 'tests')}
`;

        return getAccordionHtml({
            codiconsUri: codiconsUri.toString(),
            sections,
            initialExpanded: 'tasks',
            additionalCss,
            additionalScript,
        });
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
