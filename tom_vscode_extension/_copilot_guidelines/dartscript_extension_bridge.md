# DartScript Extension & Bridge Reference

Consolidated reference for all VS Code extension commands and JSON-RPC bridge methods. The DartScript extension communicates with a Dart bridge process via bidirectional JSON-RPC 2.0 over stdin/stdout.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Part 1: VS Code Extension Commands](#part-1-vs-code-extension-commands)
  - [Script Execution](#script-execution)
  - [Send to Chat](#send-to-chat)
  - [Tom AI Chat](#tom-ai-chat)
  - [Bridge Management](#bridge-management)
  - [Developer Utilities](#developer-utilities)
- [Part 2: JSON-RPC Bridge Protocol](#part-2-json-rpc-bridge-protocol)
  - [Protocol Format](#protocol-format)
  - [Routing Convention](#routing-convention)
- [Part 3: Vce Methods — Bridge → VS Code](#part-3-vce-methods--bridge--vs-code)
  - [UI & Notifications](#ui--notifications)
  - [File Operations](#file-operations)
  - [Code Execution (JS)](#code-execution-js)
  - [Copilot Integration](#copilot-integration)
  - [Local LLM / Prompt Expander](#local-llm--prompt-expander)
  - [Bot Conversation](#bot-conversation)
- [Part 4: Vcb Methods — VS Code → Bridge](#part-4-vcb-methods--vs-code--bridge)
  - [Diagnostics](#diagnostics)
  - [CLI Integration Server](#cli-integration-server)
  - [Workspace Information](#workspace-information)
  - [Documentation Generation](#documentation-generation)
  - [Dart/D4rt Execution](#dartd4rt-execution)
  - [Process Monitor](#process-monitor)
  - [Debug Settings](#debug-settings)
- [Part 5: Script Execution Context](#part-5-script-execution-context)
  - [Dart Scripts](#dart-scripts)
  - [JavaScript Scripts](#javascript-scripts)
- [Configuration Settings](#configuration-settings)

---

## Architecture Overview

```
┌──────────────────────┐    JSON-RPC 2.0     ┌──────────────────────┐
│   VS Code Extension  │ ◄═══ stdin/stdout ══► │    Dart Bridge       │
│   (TypeScript)       │                      │    (D4rt runtime)    │
│                      │   js-N ──► Vcb       │                      │
│  handleDartRequest() │   dart-N ──► Vce     │  _handleRequest...() │
└──────────────────────┘                      └──────────────────────┘
         │                                              │
    VS Code API                                    D4rt Interpreter
    Copilot LM API                                 CLI Server (TCP)
    Webview Panels                                 Process Monitor
```

The extension registers **VS Code commands** (invoked by users via command palette, keybindings, or menus) and communicates with the bridge via **JSON-RPC methods** (Vce/Vcb suffix convention).

---

## Part 1: VS Code Extension Commands

### Command Summary

| Command | Title | Keybinding | Description |
|---------|-------|------------|-------------|
| `dartscript.executeFile` | Execute in DartScript | — | Run `.dart` file with `execute()` function |
| `dartscript.executeScript` | Execute as Script | — | Run Dart code as inline D4rt script |
| `dartscript.sendToChat` | Send to Copilot Chat | — | Send selected text to Copilot Chat |
| `dartscript.restartBridge` | Restart/Start Dart Bridge | — | Start or restart bridge process |
| `dartscript.reloadWindow` | Reload Window | `Cmd+Shift+R` | Clean bridge shutdown + VS Code reload |
| `dartscript.runTests` | Run Test Script on Bridge | — | Run all D4rt tests from `test/` |
| `dartscript.printConfiguration` | Print Configuration | — | Dump D4rt interpreter config |
| `dartscript.showApiInfo` | Show VS Code API Info | — | Display LM models, tools, extensions |
| `dartscript.showStatusPage` | Show Status Page | `Ctrl+Shift+8` | Open status & configuration dashboard |
| `dartscript.startTomAIChat` | Tom AI: Start Chat | `Ctrl+Cmd+N` | Initialize `.chat.md` file |
| `dartscript.sendToTomAIChat` | Tom AI: Send Prompt | `Ctrl+Cmd+S` | Send prompt in `.chat.md` file |

### Script Execution

#### dartscript.executeFile

Executes a Dart file through the D4rt interpreter bridge. The file must contain an `execute()` function.

**Context menu:** Explorer (on `.dart` files)

**Workflow:**
1. Validates a `.dart` file is selected (from URI or active editor)
2. Ensures bridge is running (starts if needed)
3. Sends `executeFileVcb` with `filePath` and `params` (see [Vcb: executeFileVcb](#dartd4rt-execution))
4. Opens result as JSON document; shows error with stack trace on failure

**Expected file format:**
```dart
Future<Map<String, dynamic>> execute() async {
  return {'status': 'ok', 'data': result};
}
```

#### dartscript.executeScript

Executes Dart code as an inline script using D4rt. Does not require an `execute()` function.

**Context menu:** Explorer + Editor (on `.dart` files)

**Workflow:**
1. Uses selected text (if any) or reads entire file
2. Sends `executeScriptVcb` with `script`, `basePath`, and `params` (see [Vcb: executeScriptVcb](#dartd4rt-execution))
3. Opens result as JSON document

### Send to Chat

#### dartscript.sendToChat

Sends selected text to GitHub Copilot Chat. Requires text selection and Copilot extension.

### Tom AI Chat

#### dartscript.startTomAIChat

**Keybinding:** `Ctrl+Cmd+N` (only in `.chat.md` files)

Initializes the active `.chat.md` file with metadata header and `CHAT <chat-id>` marker. Overwrites companion `<chat-id>.responses.md` and `<chat-id>.response-summary.md` files.

#### dartscript.sendToTomAIChat

**Keybinding:** `Ctrl+Cmd+S` (only in `.chat.md` files)

Extracts the first prompt block under the CHAT header, runs pre-processing (summary generation if responses exist), sends to LM API with tools enabled, writes response to `<chat-id>.responses.md`, and repositions cursor for next prompt.

### Bridge Management

#### dartscript.restartBridge

Starts or restarts the Dart bridge process. Bridge is expected at `{workspaceRoot}/tom_vscode_bridge/`. Supports auto-restart on unexpected exit.

#### dartscript.reloadWindow

**Keybinding:** `Cmd+Shift+R`

Clean bridge shutdown followed by VS Code window reload. Sends `notifyReload` to bridge before stopping, preventing orphaned Dart processes. After reload, if a test reinstall marker exists, sends "!!!Reload finished" to Copilot Chat.

### Developer Utilities

#### dartscript.runTests

Runs all `.dart` files from `tom_vscode_bridge/test/` through D4rt. Saves individual results to `test_results/` and prints summary to output channel.

#### dartscript.printConfiguration

Sends `printConfiguration` to bridge (see [Vcb: printConfiguration](#debug-settings)). Dumps all registered packages, global variables, and per-package class details to the "DartScript" output channel.

#### dartscript.showApiInfo

Displays VS Code AI/Chat API information in a dedicated output channel: language models, registered tools (grouped by prefix), AI extensions, MCP servers, and environment details.

#### dartscript.showStatusPage

**Keybinding:** `Ctrl+Shift+8`

Opens the Tom Extension Status dashboard. See [tom_status_page.md](../doc/tom_status_page.md) for full section descriptions.

---

## Part 2: JSON-RPC Bridge Protocol

### Protocol Format

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "js-1",
  "method": "methodName",
  "params": { ... },
  "scriptName": "optional",
  "callId": "optional",
  "timeoutMs": 30000
}
```

**Success response:**
```json
{ "jsonrpc": "2.0", "id": "js-1", "result": { ... } }
```

**Error response:**
```json
{ "jsonrpc": "2.0", "id": "js-1", "error": { "message": "...", "data": "stackTrace" } }
```

### Routing Convention

| Suffix | Handled By | Description |
|--------|-----------|-------------|
| `Vce` | VS Code extension (TypeScript) | Commands needing VS Code API access |
| `Vcb` | Dart bridge | Commands needing Dart/D4rt runtime |
| *(none)* | Dart bridge | Legacy commands without suffix |

**ID prefixes:** VS Code uses `js-N`, Dart uses `dart-N`.

Any method ending in `Vce` is automatically forwarded from Dart → VS Code extension unchanged.

---

## Part 3: Vce Methods — Bridge → VS Code

These are handled in `vscode-bridge.ts` → `handleDartRequest()`.

### UI & Notifications

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `logVce` | `message: string` | *(fire-and-forget)* | Log to VS Code output channel |
| `showInfoVce` | `message: string` | `{ success: true }` | Info notification |
| `showErrorVce` | `message: string` | `{ success: true }` | Error notification |
| `showWarningVce` | `message: string` | `{ success: true }` | Warning notification |

### File Operations

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `readFileVce` | `path: string` | File content string | Read file via VS Code FS |
| `writeFileVce` | `path: string`, `content: string` | `{ success: true }` | Write content to file |
| `openFileVce` | `path: string` | `{ success: true }` | Open file in editor |

### Code Execution (JS)

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `executeFileVce` | `filePath: string`, `params?: object` | `{ filePath, success, result }` | Run JS file in extension host |
| `executeScriptVce` | `script: string`, `params?: object` | `{ success, result }` | Run inline JS in extension host |

JS files must export `(params, context)`. See [JavaScript Scripts](#javascript-scripts) for context shape.

**Error return:** `{ filePath?, success: false, error: string, stack: string }`

### Copilot Integration

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `askCopilotVce` | `prompt: string` | Response string | Send prompt to Copilot LM |
| `sendToChatVce` | `prompt: string` | `{ success: true }` | Open Copilot Chat with prompt |

**`sendToChatVce` error:** `{ success: false, error: string }`

### Local LLM / Prompt Expander

Delegated to `PromptExpanderManager.handleBridgeRequest()`.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `localLlm.getProfilesVce` | — | `{ profiles: [...] }` | List expansion profiles |
| `localLlm.getModelsVce` | — | `{ models: [...], effectiveDefault }` | List model configs |
| `localLlm.updateProfileVce` | `key`, `profile` | `{ success }` | Add/update profile |
| `localLlm.removeProfileVce` | `key` | `{ success }` | Remove profile |
| `localLlm.updateModelVce` | `key`, `model` | `{ success }` | Add/update model config |
| `localLlm.removeModelVce` | `key` | `{ success }` | Remove model config |
| `localLlm.processVce` | `prompt`, `profile?`, `model?` | `ExpanderProcessResult` | Process prompt through LLM |

**`ExpanderProcessResult`:**
```json
{
  "success": true,
  "result": "final text after template expansion",
  "rawResponse": "unprocessed LLM response",
  "response": "cleaned response (after think-tag stripping)",
  "thinkTagContent": "extracted <think> content",
  "profile": "expand",
  "modelConfig": "qwen3-8b"
}
```

### Bot Conversation

Delegated to `BotConversationManager.handleBridgeRequest()`.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `botConversation.getConfigVce` | — | Config object | Get resolved conversation config |
| `botConversation.getProfilesVce` | — | `{ profiles: [...] }` | List conversation profiles |
| `botConversation.startVce` | `goal` + overrides | Conversation result | Start multi-turn conversation |
| `botConversation.stopVce` | `reason?` | `{ success, message }` | Stop active conversation |
| `botConversation.haltVce` | `reason?` | `{ success, message, halted }` | Pause between turns |
| `botConversation.continueVce` | — | `{ success, message, halted }` | Resume halted conversation |
| `botConversation.addInfoVce` | `text` | `{ success, message }` | Inject text into next turn |
| `botConversation.statusVce` | — | Status object | Get conversation status |
| `botConversation.getLogVce` | `conversationId` | `{ found, content? }` | Read conversation log |
| `botConversation.singleTurnVce` | `prompt` + options | Single-turn result | One Ollama→Copilot round-trip |

**`startVce` parameters:** `goal` (required), `description?`, `profile?`, `maxTurns?`, `temperature?`, `modelConfig?`, `historyMode?`, `includeFileContext?`, `pauseBetweenTurns?`, `conversationMode?`

**`startVce` return:**
```json
{
  "conversationId": "uuid",
  "turns": 5,
  "goalReached": true,
  "logFilePath": "_ai/bot_conversations/...",
  "exchanges": [{ "turn": 1, "timestamp": "...", "promptToCopilot": "...", "copilotResponse": {...} }]
}
```

**`singleTurnVce` parameters:** `prompt` (required), `systemPrompt?`, `modelConfig?`, `temperature?`, `sendToCopilot?`, `copilotSuffix?`

**`statusVce` return (active):**
```json
{
  "active": true, "halted": false, "conversationId": "uuid",
  "goal": "...", "profileKey": "default", "conversationMode": "ollama-copilot",
  "turnsCompleted": 3, "maxTurns": 10, "pendingUserInput": 0
}
```

---

## Part 4: Vcb Methods — VS Code → Bridge

These are handled in `bridge_server.dart` → `_handleRequestInternalWithResult()`.

### Diagnostics

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `echo` | `message` | `{ message }` | Echo test |

### CLI Integration Server

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `startCliServer` | `port?` | `{ success, message, port, alreadyRunning }` | Start TCP server (port 19900–19909) |
| `stopCliServer` | — | `{ success, message, port?, wasRunning }` | Stop TCP server |
| `getCliServerStatus` | — | `{ running, port? }` | Get server status |

### Workspace Information

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `getWorkspaceInfo` | `workspaceRoot` | `{ root, projects, projectCount }` | List workspace directories |

### Documentation Generation

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `generateDocs` | `projectPath`, `prompt` | `{ docsPath, success, copilotResponse }` | Generate docs via Copilot |

### Dart/D4rt Execution

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `executeFileVcb` | `filePath`, `params?`, `basePath?` | `{ success, result, logs }` | Execute Dart file in D4rt |
| `executeScriptVcb` | `script`, `params?`, `basePath?` | `{ success, result, logs }` | Execute inline Dart in D4rt |
| `executeExpressionVcb` | `expression`, `params?`, `basePath?` | `{ success, result, logs }` | Evaluate Dart expression |

**Error return:** `{ success: false, error: string, stackTrace: string, logs: string[] }`

Execute commands send responses directly (not via outer dispatch) to support streaming logs.

### Process Monitor

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `startProcessMonitor` | — | `{ success, message, processMonitor, watcher, ledgerServer }` | Start Process Monitor |

### Debug Settings

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `setDebugLogging` | `enabled` | `{ success, debugLogging, debugTraceLogging }` | Toggle debug logging |
| `getDebugLogging` | — | `{ debugLogging, debugTraceLogging }` | Get debug status |
| `printConfiguration` | — | `{ success: true, message }` | Dump D4rt config |

---

## Part 5: Script Execution Context

### Dart Scripts

Scripts executed via `executeFileVcb` / `executeScriptVcb` can call back into VS Code:

```dart
// Request to VS Code (Vce method)
final result = await sendRequest('showInfoVce', {'message': 'Hello from Dart!'});

// Fire-and-forget notification
sendNotification('logVce', {'message': 'Script running...'});

// Call another bridge command
final info = await sendRequest('getWorkspaceInfo', {'workspaceRoot': '/path'});
```

Scripts run in a `runZonedGuarded` zone with zone values providing `bridgeServer`, `executionContext`, `result`, `params`, and optional `callId`.

### JavaScript Scripts

Scripts executed via `executeFileVce` / `executeScriptVce` receive a `context` object:

```javascript
module.exports = async function(params, context) {
  const { vscode, bridge, require, console } = context;
  
  // Use VS Code API directly
  vscode.window.showInformationMessage('Hello from JS!');
  
  // Call bridge (sends to Dart)
  const result = await bridge.sendRequest('echo', { message: 'test' });
  
  return { success: true, data: result };
};
```

**Two JS execution contexts exist in the extension:**

| Context | Trigger | Available Globals | Use Case |
|---------|---------|------------------|----------|
| `vscode.` prefix | Commandline manager | `vscode`, `path`, `fs`, `os` (via `new Function()`) | Quick VS Code API calls |
| `{ }` fragments | Combined commands | `vscode`, `require` | State machine command logic |

See [keybindings_and_commands.md](keybindings_and_commands.md) for details on these execution contexts.

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `dartscript.contextApproach` | string | `"accumulation"` | Context persistence approach |
| `dartscript.maxContextSize` | number | `50000` | Max context size in tokens |
| `dartscript.autoRunOnSave` | boolean | `false` | Auto-run scripts on save |
| `dartscript.copilotModel` | string | `"gpt-4o"` | Preferred Copilot model |
| `dartscript.configPath` | string | `~/.tom/vscode/tom_vscode_extension.json` | Config file path |
| `dartscript.tomAiChat.modelId` | string | `"gpt-5.2"` | Tom AI Chat model |
| `dartscript.tomAiChat.tokenModelId` | string | `"gpt-4o"` | Token counting model |
| `dartscript.tomAiChat.responsesTokenLimit` | number | `50000` | Responses file token limit |
| `dartscript.tomAiChat.responseSummaryTokenLimit` | number | `8000` | Summary file token limit |
