/**
 * T3 Panel Handler - Sample panel using the reusable accordion component
 * 
 * This demonstrates how to create a new accordion panel with minimal code.
 * It has 3 sample sections: Tasks, Logs, and Settings.
 */

import * as vscode from 'vscode';
import { AccordionSection, getAccordionHtml } from './accordionPanel';

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
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                await this._handleMessage(message);
            },
            undefined,
            this._extensionContext.subscriptions
        );
    }

    private async _handleMessage(message: any): Promise<void> {
        if (message.type === 'action') {
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
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
        );

        // Define the 3 sample sections
        const sections: AccordionSection[] = [
            {
                id: 'tasks',
                title: 'Tasks',
                icon: 'checklist',
                content: this._getTasksContent()
            },
            {
                id: 'logs',
                title: 'Logs',
                icon: 'output',
                content: this._getLogsContent()
            },
            {
                id: 'settings',
                title: 'Settings',
                icon: 'settings-gear',
                content: this._getSettingsContent()
            }
        ];

        return getAccordionHtml({
            codiconsUri: codiconsUri.toString(),
            sections,
            initialExpanded: 'tasks'
        });
    }

    private _getTasksContent(): string {
        return `
<div class="toolbar">
    <button class="icon-btn" data-action="addTask" title="Add Task">
        <span class="codicon codicon-add"></span>
    </button>
    <button class="icon-btn danger" data-action="clearTasks" title="Clear All">
        <span class="codicon codicon-trash"></span>
    </button>
</div>
<textarea placeholder="Enter tasks here..."></textarea>
<div class="status-bar">Tasks panel ready</div>
`;
    }

    private _getLogsContent(): string {
        return `
<div class="toolbar">
    <button class="icon-btn" data-action="refreshLogs" title="Refresh">
        <span class="codicon codicon-refresh"></span>
    </button>
    <button class="icon-btn" data-action="exportLogs" title="Export Logs">
        <span class="codicon codicon-go-to-file"></span>
    </button>
</div>
<textarea readonly placeholder="Log output will appear here..."></textarea>
<div class="status-bar">Logs panel ready</div>
`;
    }

    private _getSettingsContent(): string {
        return `
<div class="toolbar">
    <button class="primary" data-action="saveSettings">Save</button>
    <button data-action="resetSettings">Reset</button>
</div>
<textarea placeholder="Configuration settings..."></textarea>
<div class="status-bar">Settings panel ready</div>
`;
    }
}

let _provider: T3PanelHandler | undefined;

export function registerT3Panel(context: vscode.ExtensionContext): void {
    _provider = new T3PanelHandler(context.extensionUri, context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VIEW_ID, _provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );
}
