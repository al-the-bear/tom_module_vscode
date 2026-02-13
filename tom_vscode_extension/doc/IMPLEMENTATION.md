# Implementation Guide

Technical implementation reference for the Tom VS Code Extension (`dartscript-vscode`).

## Table of Contents

- [Extension Identity](#extension-identity)
- [Project Structure](#project-structure)
- [Extension Lifecycle](#extension-lifecycle)
- [Handler Architecture](#handler-architecture)
- [Bridge Communication](#bridge-communication)
- [Webview System](#webview-system)
- [Tool System](#tool-system)
- [Configuration System](#configuration-system)
- [Testing](#testing)
- [Debugging](#debugging)
- [Extension Points](#extension-points)

---

## Extension Identity

| Field | Value |
|-------|-------|
| Package name | `dartscript-vscode` |
| Display name | DartScript |
| Publisher | `tom` |
| Version | `0.1.0` |
| VS Code engine | `^1.96.0` |
| Activation | `onStartupFinished` |
| Entry point | `./out/extension.js` |
| Dependencies | `@vscode/codicons`, `telegramify-markdown` |

---

## Project Structure

```
tom_vscode_extension/
├── package.json                    Extension manifest (commands, views, settings, keybindings)
├── tsconfig.json                   TypeScript configuration
├── src/
│   ├── extension.ts          (609) Entry point: activation, command registration, lifecycle
│   ├── vscode-bridge.ts     (1046) DartBridgeClient: JSON-RPC process management
│   ├── tests.ts                    BridgeTestRunner for D4rt test scripts
│   ├── handlers/
│   │   ├── index.ts           (72) Re-exports all handler modules
│   │   ├── handler_shared.ts (850) Shared state, logging, utilities, Copilot model access
│   │   ├── accordionPanel.ts (280) Reusable accordion webview component
│   │   ├── notepad-handler.ts(345) Base notepad webview panel class
│   │   ├── --- AI & Chat ---
│   │   ├── sendToChat-handler.ts        (37)  Send selection to Copilot Chat
│   │   ├── sendToChatAdvanced-handler.ts(872) Template-based send to Chat
│   │   ├── tomAiChat-handler.ts        (1185) .chat.md agentic workflow
│   │   ├── tomAiChat-utils.ts           (268) Chat utilities
│   │   ├── expandPrompt-handler.ts     (1805) Ollama prompt expansion
│   │   ├── botConversation-handler.ts  (2024) Multi-turn Ollama↔Copilot
│   │   ├── trailLogger-handler.ts       (422) AI interaction trail logging
│   │   ├── --- Bridge & Execution ---
│   │   ├── restartBridge-handler.ts     (260) Bridge lifecycle, profile switching
│   │   ├── executeInTomAiBuild-handler.ts(92) Execute .dart via D4rt bridge
│   │   ├── executeAsScript-handler.ts   (117) Execute Dart as inline script
│   │   ├── runTests-handler.ts           (16) Run D4rt tests
│   │   ├── cliServer-handler.ts         (150) TCP CLI integration server
│   │   ├── --- UI Panels ---
│   │   ├── dsNotes-handler.ts          (2783) Explorer sidebar notes
│   │   ├── unifiedNotepad-handler.ts   (2206) TOM AI bottom panel (T2)
│   │   ├── t3Panel-handler.ts           (160) TOM bottom panel (T3)
│   │   ├── statusPage-handler.ts        (950) Status dashboard webview
│   │   ├── --- Shortcuts & Menus ---
│   │   ├── chordMenu-handler.ts         (366) Which-key style chord menus
│   │   ├── commandline-handler.ts       (832) User-defined commandlines
│   │   ├── combinedCommand-handler.ts   (162) Multi-command shortcuts
│   │   ├── stateMachine-handler.ts      (360) Stateful command sequences
│   │   ├── --- Telegram ---
│   │   ├── telegram-commands.ts         (369) Bot integration commands
│   │   ├── telegram-notifier.ts         (541) Standalone HTTP polling
│   │   ├── telegram-cmd-handlers.ts     (718) Command implementations
│   │   ├── telegram-cmd-parser.ts       (222) Message parsing
│   │   ├── telegram-cmd-response.ts     (290) Response formatting
│   │   ├── telegram-markdown.ts          (57) Telegram markdown
│   │   ├── --- Utilities ---
│   │   ├── showApiInfo-handler.ts       (285) LM models, tools, extensions info
│   │   ├── showHelp-handler.ts           (40) Show help
│   │   ├── debugLogging-handler.ts       (68) Toggle debug logging
│   │   ├── printConfiguration-handler.ts (47) Dump D4rt config
│   │   ├── processMonitor-handler.ts     (61) Launch process monitor
│   │   └── reloadWindow-handler.ts       (56) Clean shutdown + reload
│   ├── managers/
│   │   └── todoManager.ts        (253) Todo list persistence for Tom AI Chat
│   └── tools/
│       ├── shared-tool-registry.ts(142) Provider-agnostic tool definitions + adapters
│       ├── tool-executors.ts     (1211) 13 shared tool implementations
│       ├── tomAiChat-tools.ts      (37) VS Code LM tool registration
│       └── escalation-tools-config.ts(296) Ask Copilot / Ask Big Brother config
├── doc/                            Documentation (ARCHITECTURE, USER_GUIDE, etc.)
└── _copilot_guidelines/            Developer reference docs
```

**~21,000 lines** across ~35 handler/source files.

---

## Extension Lifecycle

### Activation (`extension.ts`)

The extension activates on `onStartupFinished`. The `activate()` function performs initialization in this order:

1. **`initializeBridgeClient(context)`** — Creates the `DartBridgeClient` singleton
2. **`registerCommands(context)`** — Registers ~35 core VS Code commands (`dartscript.*`)
3. **`registerChordMenuCommands(context)`** — Which-key style chord menus from config
4. **`registerCommandlineCommands(context)`** — User-defined commandlines from config
5. **`registerCombinedCommands(context)`** — Multi-command shortcuts from config
6. **`registerStateMachineCommands(context)`** — Stateful command sequences from config
7. **`registerDsNotesViews(context)`** — Explorer sidebar notes panels
8. **`registerUnifiedNotepad(context)`** — TOM AI bottom panel (T2)
9. **`registerT3Panel(context)`** — TOM bottom panel (T3)
10. **`checkTestReinstallMarker()`** — Sends "!!!Reload finished" to Copilot Chat if reinstall marker exists
11. **`restartBridgeHandler(context, false)`** — Auto-starts the Dart bridge process
12. **Initialize `SendToChatAdvancedManager`** — Template-based chat sending
13. **Initialize `PromptExpanderManager`** — Local LLM prompt expansion
14. **Register local LLM context menu commands** — Per-profile dynamic commands
15. **Initialize `BotConversationManager`** — Multi-turn conversation orchestration
16. **Register Telegram disposal** — Cleanup for standalone polling
17. **`initializeToolDescriptions()` + `initializeEscalationTools()`** — Tool config
18. **`registerTomAiChatTools(context)`** — Register 13 Language Model Tools with VS Code

### Deactivation

`deactivate()` calls `bridgeClient.stop()` synchronously to kill the Dart child process and prevent orphaned processes.

---

## Handler Architecture

### Pattern

All handlers follow a consistent pattern:

1. **One file per feature** in `src/handlers/`
2. **Exported through `handlers/index.ts`** for clean imports
3. **Shared state via `handler_shared.ts`** — provides `getBridgeClient()`, `logToOutput()`, `getCopilotModel()`, workspace path utilities, file validation
4. **Two registration styles:**
   - **Direct commands:** Registered in `registerCommands()` in `extension.ts`
   - **Subsystem registration:** Handler exports a `register*()` function that registers its own commands (used by chordMenu, commandline, combinedCommand, stateMachine, dsNotes, unifiedNotepad, t3Panel)

### Shared Utilities (`handler_shared.ts`)

Key exports used by all handlers:

| Function | Purpose |
|----------|---------|
| `getBridgeClient()` | Access the singleton `DartBridgeClient` |
| `logToOutput(msg)` | Write to the extension output channel |
| `getCopilotModel()` | Get Copilot language model with fallback logic |
| `getWorkspaceRoot()` | Resolve workspace root path |
| `validateDartFile(uri)` | Check file is `.dart` and exists |
| `handleError(msg, err)` | Consistent error reporting to output + user |
| `readConfigFile()` | Read external config JSON |

---

## Bridge Communication

### DartBridgeClient (`vscode-bridge.ts`)

The `DartBridgeClient` manages a Dart child process (`tom_vscode_bridge`) connected via stdin/stdout using JSON-RPC 2.0.

### Process Lifecycle

```
Extension activate()
    → restartBridgeHandler()
        → bridgeClient.start(workspaceRoot, profile?)
            → spawn 'dart run' (tom_vscode_bridge)
            → setup stdin/stdout pipes
            → setup stdout line listener → handleMessage()
            → setup stderr listener → logToOutput()
            → setup exit handler → cleanup + optional auto-restart
```

### JSON-RPC 2.0 Protocol

**Request format (both directions):**
```json
{ "jsonrpc": "2.0", "id": "js-1", "method": "methodName", "params": {} }
```

**Response format:**
```json
{ "jsonrpc": "2.0", "id": "js-1", "result": {} }
```

**Error response:**
```json
{ "jsonrpc": "2.0", "id": "js-1", "error": { "code": -1, "message": "..." } }
```

### ID Conventions

| Direction | ID Prefix | Example |
|-----------|-----------|---------|
| VS Code → Dart | `js-` | `js-1`, `js-2` |
| Dart → VS Code | `dart-` | `dart-1`, `dart-2` |

### Method Naming Convention

| Suffix | Handled By | Direction |
|--------|-----------|-----------|
| `*Vce` | VS Code extension (TypeScript) | Dart → VS Code requests |
| `*Vcb` | VS Code bridge (Dart) | VS Code → Dart requests |

### Request Flow

**Outbound (VS Code → Dart):**
1. `sendRequest(method, params)` creates a Promise
2. Generates unique `js-N` ID, creates JSON-RPC message
3. Stores `{resolve, reject, timer}` in `pendingRequests` Map
4. Writes JSON + newline to stdin
5. Sets 30-second timeout
6. Returns Promise (resolves when matching response arrives)

**Inbound (Dart → VS Code):**
1. `handleMessage(line)` parses JSON from stdout
2. If message has `id` and matches `pendingRequests` → resolve/reject the Promise
3. If message has `method` → route to appropriate `*Vce` handler
4. Send JSON-RPC response back via stdin

### Bridge Profiles

Multiple bridge configurations stored in `~/.tom/vscode/tom_vscode_extension.json` under `dartscriptBridge.profiles`. Each profile specifies:
- `dartProjectPath` — path to the Dart bridge project
- `workingDirectory` — optional working directory override
- `args` — additional command-line arguments
- `env` — environment variables

Switch profiles via `dartscript.switchBridgeProfile` command or Status Page.

### Debug Logging

Two levels controlled by `debugLogging-handler.ts`:
- **`debugLogging`** — Logs request/response handling activity
- **`debugTraceLogging`** — Logs raw JSON-RPC messages on stdin/stdout

---

## Webview System

### Panel Architecture

Four webview locations across two container types:

| View ID | Container | Location | Handler |
|---------|-----------|----------|---------|
| `dartscript.unifiedNotepad` | `dartscript-t2-panel` | Bottom panel (TOM AI) | `unifiedNotepad-handler.ts` |
| `dartscript.t3Panel` | `dartscript-t3-panel` | Bottom panel (TOM) | `t3Panel-handler.ts` |
| `dartscript.tomNotepad` | Explorer | Sidebar (VS CODE NOTES) | `dsNotes-handler.ts` |
| `dartscript.workspaceNotepad` | Explorer | Sidebar (WORKSPACE NOTES) | `dsNotes-handler.ts` |

### Accordion Component (`accordionPanel.ts`)

Reusable collapsible section component used by the TOM AI and TOM bottom panels. Each accordion section has:
- Collapsible header with icon
- Content area (textarea, buttons, etc.)
- Independent expand/collapse state
- CSS-based animations

### TOM AI Bottom Panel (T2)

Six accordion sections in `unifiedNotepad-handler.ts`:

| Section | Icon | Purpose |
|---------|------|---------|
| Guidelines | `codicon-book` | Edit `_copilot_guidelines/` files |
| Notes | `codicon-note` | Multi-note scratch pad |
| Local LLM | `codicon-robot` | Ollama prompt expansion |
| AI Conversation | `codicon-comment-discussion` | Bot conversation control |
| Copilot | `codicon-copilot` | Template-based Copilot Chat prompts |
| Tom AI Chat | `codicon-comment-discussion-sparkle` | `.chat.md` agentic workflow prompts |

### Status Page Dashboard (`statusPage-handler.ts`)

Full-tab webview opened via `Ctrl+Shift+8`. Eight collapsible configuration sections:
CLI Server, Bridge, Trail Logging, Local LLM, AI Conversation, Telegram, Ask Copilot, Ask Big Brother.

All changes persist to `~/.tom/vscode/tom_vscode_extension.json`.

### Webview Communication Pattern

All webview panels use the same messaging pattern:

```typescript
// Extension → Webview
webview.postMessage({ type: 'updateContent', content: '...' });

// Webview → Extension
webview.onDidReceiveMessage(message => {
    switch (message.type) {
        case 'save': /* persist content */ break;
        case 'sendToCopilot': /* open chat */ break;
    }
});
```

---

## Tool System

### Shared Tool Registry (`tools/`)

Tools are defined once and consumed by multiple providers:

```
SharedToolDefinition (tool-executors.ts)
    ├── VS Code LM API registration (tomAiChat-tools.ts)
    └── Ollama tool-calling loop (expandPrompt-handler.ts, botConversation-handler.ts)
```

### Registered Language Model Tools (14)

| Tool | Purpose |
|------|---------|
| `tom_createFile` | Create a new file |
| `tom_readFile` | Read file contents |
| `tom_editFile` | Edit a file (search & replace) |
| `tom_multiEditFile` | Multiple edits in a single call |
| `tom_listDirectory` | List directory contents |
| `tom_findFiles` | Find files by glob pattern |
| `tom_findTextInFiles` | Search text across files |
| `tom_runCommand` | Execute shell command |
| `tom_runVscodeCommand` | Execute VS Code command |
| `tom_getErrors` | Get diagnostics for files |
| `tom_fetchWebpage` | Fetch webpage content |
| `tom_readGuideline` | Read `_copilot_guidelines/` files |
| `tom_webSearch` | Web search |
| `tom_manageTodo` | Manage todo lists |

### Escalation Tools

Two AI escalation mechanisms in `escalation-tools-config.ts`:
- **Ask Copilot** — Opens Copilot Chat window with prompt, polls for answer file
- **Ask Big Brother** — Uses VS Code LM API directly for model queries with tool calling

---

## Configuration System

### VS Code Settings (`package.json` → `contributes.configuration`)

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `dartscript.contextApproach` | string | `"accumulation"` | Context persistence approach |
| `dartscript.maxContextSize` | number | `50000` | Max context tokens |
| `dartscript.autoRunOnSave` | boolean | `false` | Auto-run scripts on save |
| `dartscript.copilotModel` | string | `"gpt-4o"` | Preferred Copilot model |
| `dartscript.configPath` | string | `~/.tom/.../tom_vscode_extension.json` | External config file |
| `dartscript.sendToChat.showNotifications` | boolean | `true` | Chat send notifications |
| `dartscript.sendToChat.chatAnswerFolder` | string | `"_ai/chat_replies"` | Answer file folder |
| `dartscript.tomAiChat.modelId` | string | `"gpt-5.2"` | Tom AI Chat model |
| `dartscript.tomAiChat.tokenModelId` | string | `"gpt-4o"` | Token counting model |
| `dartscript.tomAiChat.responsesTokenLimit` | number | `50000` | Responses file token limit |
| `dartscript.tomAiChat.responseSummaryTokenLimit` | number | `8000` | Summary token limit |
| `dartscript.tomAiChat.preProcessingModelId` | string | `"gpt-5-mini"` | Pre-processing model |
| `dartscript.tomAiChat.enablePromptOptimization` | boolean | `false` | Enable prompt pre-processing |
| `dartscript.ollama.url` | string | `"http://localhost:11434"` | Ollama server URL |
| `dartscript.ollama.model` | string | `"qwen3:8b"` | Ollama model name |

### External Config File

**Path:** `~/.tom/vscode/tom_vscode_extension.json` (configurable via `dartscript.configPath`)

Contains all runtime configuration not suitable for VS Code settings:

| Section | Content |
|---------|---------|
| `dartscriptBridge.profiles` | Bridge profiles (Dart project path, args, env) |
| `sendToChat.templates` | Send-to-Chat prompt templates |
| `promptExpander.profiles` | Local LLM expansion profiles (model, system prompt, tools) |
| `botConversation.profiles` | AI Conversation profiles (turns, temperature, mode) |
| `chordMenu.*` | Chord menu key bindings and entries |
| `commandlineDefinitions` | User-defined commandline sequences |
| `combinedCommands` | Multi-command shortcut definitions |
| `stateMachines` | Stateful command sequence definitions |
| `askCopilot` | Ask Copilot escalation settings |
| `askBigBrother` | Ask Big Brother escalation settings |
| `telegram` | Bot token, chat ID, poll interval |
| `trailLogging` | Trail logger enable/disable, file paths |

---

## Testing

### D4rt Bridge Tests

The `BridgeTestRunner` (`tests.ts`) runs Dart test scripts from `tom_vscode_bridge/test/`:

1. Clears `test_results/` directory
2. Finds all `.dart` files in the test directory
3. Executes each test via the bridge connection
4. Saves results to `test_results/{name}_results.json`
5. Displays summary in the output channel

**Run:** Command Palette → `DartScript: Run Test Script on Bridge`

### Manual Testing via Extension Development Host

1. Press **F5** to launch the Extension Development Host
2. Execute commands from the Command Palette (`Ctrl+Shift+P`)
3. Check the **Dart Bridge** output channel for logs
4. Test context menu commands on `.dart` files

### Debug Configuration (`.vscode/launch.json`)

```json
{
  "type": "extensionHost",
  "request": "launch",
  "name": "Launch Extension",
  "runtimeExecutable": "${execPath}",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
  "outFiles": ["${workspaceFolder}/out/**/*.js"]
}
```

---

## Debugging

### Output Channels

| Channel | Content |
|---------|---------|
| Dart Bridge | Bridge process logs, JSON-RPC activity, handler output |

### Debug Logging Levels

Toggle via `dartscript.toggleBridgeDebugLogging`:

| Level | What it logs |
|-------|-------------|
| `debugLogging` | Request handling, method routing, handler results |
| `debugTraceLogging` | Raw JSON-RPC messages (stdin/stdout byte-level) |

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Bridge won't start | Wrong Dart project path | Check profile `dartProjectPath` in config |
| Orphaned processes | Window closed without deactivate | Use `dartscript.reloadWindow` instead of manual reload |
| Timeout errors | Dart handler taking >30s | Check bridge-side handler, increase timeout if needed |
| No Copilot model | GitHub Copilot not active | Install/activate GitHub Copilot extension |

---

## Extension Points

### Adding a New Command

1. **Create handler file** in `src/handlers/`:

```typescript
// src/handlers/myFeature-handler.ts
import * as vscode from 'vscode';
import { logToOutput, handleError } from './handler_shared';

export async function myFeatureHandler(): Promise<void> {
    try {
        // Implementation
        logToOutput('My feature executed');
    } catch (error) {
        handleError('My feature failed', error);
    }
}
```

2. **Export from `handlers/index.ts`:**

```typescript
export { myFeatureHandler } from './myFeature-handler';
```

3. **Register in `extension.ts`:**

```typescript
context.subscriptions.push(
    vscode.commands.registerCommand('dartscript.myFeature', myFeatureHandler)
);
```

4. **Add to `package.json`:**

```json
{
  "contributes": {
    "commands": [{
      "command": "dartscript.myFeature",
      "title": "My Feature",
      "category": "DartScript"
    }]
  }
}
```

### Adding a Bridge Request Handler (Vce method)

In `vscode-bridge.ts`, add a case in the inbound request router:

```typescript
case 'myMethod.doSomethingVce':
    result = await this.handleMyMethod(params);
    break;
```

### Adding a Language Model Tool

1. **Define in `tool-executors.ts`** as a `SharedToolDefinition`:

```typescript
export const myTool: SharedToolDefinition = {
    name: 'tom_myTool',
    description: 'What this tool does',
    inputSchema: { type: 'object', properties: { /* ... */ } },
    execute: async (params) => { /* ... */ }
};
```

2. **Register** — The tool is automatically picked up by `registerTomAiChatTools()`.

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and component diagrams
- [USER_GUIDE.md](USER_GUIDE.md) — End-user guide
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) — Quick reference card
- [vscode_extension_overview.md](../_copilot_guidelines/vscode_extension_overview.md) — Feature overview with documentation index
- [dartscript_extension_bridge.md](../_copilot_guidelines/dartscript_extension_bridge.md) — Complete command and bridge method reference
