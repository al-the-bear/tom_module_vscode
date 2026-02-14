# Tab Navigation Component

A reusable tab panel component for creating VS Code webview panels with horizontal tab navigation.

## Features

- **Horizontal tab bar**: Tabs with icons and labels at the top
- **Active tab highlighting**: Bottom border accent on active tab
- **State persistence**: Active tab saved across sessions via `vscode.getState`/`setState`
- **Scrollable overflow**: Tab bar scrolls horizontally when tabs exceed width
- **Built-in styles**: Standard VS Code theming for toolbars, buttons, textareas

## Quick Start

### 1. Create a Panel Handler

```typescript
import * as vscode from 'vscode';
import { TabSection, getTabPanelHtml } from './tabPanel';

const VIEW_ID = 'dartscript.myPanel';

export class MyPanelHandler implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _extensionContext: vscode.ExtensionContext;

    constructor(private _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
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
            async (message) => this._handleMessage(message),
            undefined,
            this._extensionContext.subscriptions
        );
    }

    private async _handleMessage(message: any): Promise<void> {
        if (message.type === 'action') {
            vscode.window.showInformationMessage(`Action: ${message.action}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
        );

        const tabs: TabSection[] = [
            {
                id: 'first',
                title: 'First',
                icon: 'book',
                content: '<div class="simple-content"><textarea placeholder="First tab..."></textarea></div>'
            },
            {
                id: 'second',
                title: 'Second',
                icon: 'gear',
                content: '<div class="simple-content"><textarea placeholder="Second tab..."></textarea></div>'
            }
        ];

        return getTabPanelHtml({
            codiconsUri: codiconsUri.toString(),
            tabs,
            initialActive: 'first'
        });
    }
}
```

### 2. Simple Provider Helper

```typescript
import { createTabPanelProvider, TabSection } from './tabPanel';

const tabs: TabSection[] = [
    { id: 'edit', title: 'Edit', icon: 'edit', content: '<div class="simple-content"><textarea></textarea></div>' },
    { id: 'preview', title: 'Preview', icon: 'eye', content: '<div class="simple-content"><p>Preview here</p></div>' }
];

const provider = createTabPanelProvider(context, tabs, (msg, webview) => {
    if (msg.type === 'action') { /* handle */ }
});
```

## API Reference

### TabSection Interface

```typescript
interface TabSection {
    id: string;       // Unique identifier
    title: string;    // Display title (shown in tab bar)
    icon: string;     // Codicon name (e.g., 'book', 'gear', 'output')
    content: string;  // HTML content for tab body
}
```

### TabPanelConfig Interface

```typescript
interface TabPanelConfig {
    codiconsUri: string;           // URI to codicon.css
    tabs: TabSection[];            // Array of tabs
    initialActive?: string;        // ID of initially active tab
    additionalCss?: string;        // Custom CSS to append
    additionalScript?: string;     // Custom JS to append
}
```

### Functions

| Function | Description |
|----------|-------------|
| `getTabPanelStyles()` | Returns base CSS string for tab panels |
| `getTabPanelScript(tabs, initialActive?)` | Returns JS string with tab switching behavior |
| `getTabPanelHtml(config)` | Returns complete HTML document for webview |
| `createTabPanelProvider(context, tabs, messageHandler?)` | Helper to create a simple provider |

## Built-in CSS Classes

| Class | Description |
|-------|-------------|
| `.tab-container` | Root container (flex column) |
| `.tab-bar` | Horizontal tab bar |
| `.tab-btn` | Tab button (auto-styled) |
| `.tab-content-area` | Content area below tab bar |
| `.tab-content` | Individual tab content pane |
| `.simple-content` | Padded flex column content wrapper |
| `.toolbar` | Horizontal toolbar |
| `.icon-btn` | Icon-only button |
| `.icon-btn.danger` | Red icon button |
| `textarea` | Full-height text area |
| `.status-bar` | Bottom status text |

## Message Handling

Buttons with `data-action` attributes automatically send messages:

```html
<button data-action="save" data-id="optional-context">Save</button>
```

Received message format:

```typescript
{
    type: 'action',
    action: 'save',
    sectionId: 'optional-context'  // From data-id attribute
}
```

## Implementation Files

| File | Purpose |
|------|---------|
| [tabPanel.ts](../src/handlers/tabPanel.ts) | Core component: interfaces, CSS, JS, HTML generation |

## Comparison with Accordion Component

| Feature | Tab Panel | Accordion Panel |
|---------|-----------|-----------------|
| Navigation | Horizontal tabs | Collapsible vertical sections |
| Multiple visible | One at a time | Multiple (via pinning) |
| Resizing | N/A | Drag handles between sections |
| State preservation | Tab content stays in DOM | **DOM preserved on toggle** |
| Best for | Simple content switching | Complex multi-pane layouts |

See [bottom_panel_accordion.md](bottom_panel_accordion.md) for the accordion component.
