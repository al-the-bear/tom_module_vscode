# Bottom Panel Accordion Component

A reusable accordion panel component for creating VS Code bottom panel tabs with multiple collapsible/expandable sections.

## Features

- **Accordion behavior**: Opening one section collapses unpinned others
- **Pin functionality**: Pinned sections stay open when switching
- **Resizable sections**: Drag handles between expanded sections
- **Vertical tab rotation**: Collapsed sections show vertical labels
- **State persistence**: Expanded/pinned state saved across sessions
- **Codicon icons**: Uses VS Code's standard icon set

## Quick Start

### 1. Create a Panel Handler

```typescript
import * as vscode from 'vscode';
import { AccordionSection, getAccordionHtml } from './accordionPanel';

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
            // Handle button clicks from data-action attributes
            vscode.window.showInformationMessage(`Action: ${message.action}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
        );

        const sections: AccordionSection[] = [
            {
                id: 'section1',
                title: 'First Section',
                icon: 'book',           // codicon name without "codicon-" prefix
                content: this._getSection1Content()
            },
            {
                id: 'section2',
                title: 'Second Section',
                icon: 'gear',
                content: '<div class="sample-content"><p>Section 2 content</p></div>'
            }
        ];

        return getAccordionHtml({
            codiconsUri: codiconsUri.toString(),
            sections,
            initialExpanded: 'section1'  // Optional: defaults to first section
        });
    }

    private _getSection1Content(): string {
        return `
<div class="toolbar">
    <button class="icon-btn" data-action="refresh" title="Refresh">
        <span class="codicon codicon-refresh"></span>
    </button>
    <button class="primary" data-action="save">Save</button>
</div>
<textarea placeholder="Enter content..."></textarea>
<div class="status-bar">Ready</div>
`;
    }
}

let _provider: MyPanelHandler | undefined;

export function registerMyPanel(context: vscode.ExtensionContext): void {
    _provider = new MyPanelHandler(context.extensionUri, context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VIEW_ID, _provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );
}
```

### 2. Register in package.json

Add to `contributes.viewsContainers.panel`:

```json
{
  "id": "dartscript-my-panel",
  "title": "My Panel",
  "icon": "$(symbol-misc)"
}
```

Add to `contributes.views`:

```json
"dartscript-my-panel": [
  {
    "type": "webview",
    "id": "dartscript.myPanel",
    "name": "My Panel",
    "icon": "$(symbol-misc)"
  }
]
```

### 3. Export and Register Provider

In `handlers/index.ts`:

```typescript
export { registerMyPanel } from './myPanel-handler';
```

In `extension.ts`:

```typescript
import { registerMyPanel } from './handlers';

export async function activate(context: vscode.ExtensionContext) {
    // ... other initialization
    registerMyPanel(context);
}
```

## Adding a Focus Command

To create a command that brings the panel to the foreground:

### 1. Add Command to package.json

```json
{
  "command": "dartscript.focusMyPanel",
  "title": "DS: Focus My Panel",
  "category": "DartScript"
}
```

### 2. Register Command in Handler

```typescript
export function registerMyPanel(context: vscode.ExtensionContext): void {
    _provider = new MyPanelHandler(context.extensionUri, context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VIEW_ID, _provider, {
            webviewOptions: { retainContextWhenHidden: true }
        }),
        vscode.commands.registerCommand('dartscript.focusMyPanel', () => {
            vscode.commands.executeCommand('dartscript.myPanel.focus');
        })
    );
}
```

The focus command follows the pattern `{viewId}.focus` which VS Code automatically provides for all registered views.

### 3. Optional: Add Keyboard Shortcut

In `contributes.keybindings`:

```json
{
  "command": "dartscript.focusMyPanel",
  "key": "ctrl+shift+m",
  "mac": "cmd+shift+m"
}
```

## API Reference

### AccordionSection Interface

```typescript
interface AccordionSection {
    id: string;       // Unique identifier
    title: string;    // Display title (uppercase in header)
    icon: string;     // Codicon name (e.g., 'book', 'gear', 'output')
    content: string;  // HTML content for section body
}
```

### AccordionPanelConfig Interface

```typescript
interface AccordionPanelConfig {
    codiconsUri: string;           // URI to codicon.css
    sections: AccordionSection[];  // Array of sections
    initialExpanded?: string;      // ID of initially expanded section
    additionalCss?: string;        // Custom CSS to append
    additionalScript?: string;     // Custom JS to append
}
```

### Functions

| Function | Description |
|----------|-------------|
| `getAccordionStyles()` | Returns base CSS string for accordion panels |
| `getAccordionScript(sections, initialExpanded?)` | Returns JS string with accordion behavior |
| `getAccordionHtml(config)` | Returns complete HTML document for webview |
| `createAccordionPanelProvider(context, sections, messageHandler?)` | Helper to create a simple provider |

## Built-in CSS Classes

Use these classes in your section content:

| Class | Description |
|-------|-------------|
| `.toolbar` | Horizontal toolbar with gap between items |
| `.toolbar button` | Standard button (22px height) |
| `.toolbar button.primary` | Primary action button |
| `.icon-btn` | Icon-only button |
| `.icon-btn.danger` | Red icon button |
| `textarea` | Full-height text area |
| `.status-bar` | Bottom status text |
| `.sample-content` | Padded content container |

## Message Handling

Buttons with `data-action` attributes automatically send messages:

```html
<button data-action="myAction" data-id="optional-id">Click</button>
```

Received message format:

```typescript
{
    type: 'action',
    action: 'myAction',
    sectionId: 'optional-id'  // From data-id attribute
}
```

## Implementation Files

| File | Purpose |
|------|---------|
| [accordionPanel.ts](../src/handlers/accordionPanel.ts) | Core component: interfaces, CSS, JS, HTML generation |
| [t3Panel-handler.ts](../src/handlers/t3Panel-handler.ts) | Example implementation with 3 sample sections |
| [unifiedNotepad-handler.ts](../src/handlers/unifiedNotepad-handler.ts) | T2 panel (original implementation with full features) |
| [package.json](../package.json) | Panel container and view registration |
| [extension.ts](../src/extension.ts) | Provider registration in activate() |
| [index.ts](../src/handlers/index.ts) | Handler exports |

## Available Codicons

Common codicons for panel sections:

| Icon | Name | Use Case |
|------|------|----------|
| 📖 | `book` | Documentation, guides |
| 📝 | `note` | Notes, text content |
| 🤖 | `robot` | AI, automation |
| 💬 | `comment-discussion` | Chat, conversations |
| ⚙️ | `settings-gear` | Settings, configuration |
| 📋 | `checklist` | Tasks, todos |
| 📤 | `output` | Logs, output |
| 🔄 | `refresh` | Refresh action |
| ➕ | `add` | Add/create action |
| 🗑️ | `trash` | Delete action |
| 📄 | `go-to-file` | Export, open file |

Full list: https://microsoft.github.io/vscode-codicons/dist/codicon.html
