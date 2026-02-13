# VS Code Bridge Architecture

Comprehensive architecture documentation for the VS Code Bridge system, covering both the TypeScript extension (`tom_vscode_extension`) and the Dart bridge server (`tom_vscode_bridge`).

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram)
- [Extension Architecture (TypeScript)](#extension-architecture-typescript)
- [Bridge Server Architecture (Dart)](#bridge-server-architecture-dart)
- [Communication Protocol](#communication-protocol)
- [Process Management](#process-management)
- [Webview Architecture](#webview-architecture)
- [Tool System Architecture](#tool-system-architecture)
- [Copilot & AI Architecture](#copilot--ai-architecture)
- [D4rt Integration](#d4rt-integration)
- [Security Model](#security-model)
- [Performance Considerations](#performance-considerations)
- [Extension Points](#extension-points)

---

## System Overview

The VS Code Bridge system enables **bidirectional communication** between a VS Code extension (TypeScript) and a Dart process. It has grown from a simple bridge into a comprehensive AI development platform with 15 feature areas, 57 registered commands, and integrations with Copilot, Ollama, and Telegram.

**Two main components:**

1. **VS Code Extension** (`tom_vscode_extension`): TypeScript extension host with ~35 handler files managing commands, webviews, AI workflows, and the bridge client.

2. **Dart Bridge Server** (`tom_vscode_bridge`): Dart child process that wraps VS Code APIs and provides dynamic Dart script execution via D4rt.

### Design Principles

- **Child Process Model**: The extension spawns the Dart bridge as a child process
- **JSON-RPC 2.0**: All communication uses JSON-RPC 2.0 over stdin/stdout
- **Bidirectional**: Both sides can initiate requests (Vce/Vcb naming convention)
- **Handler-per-Feature**: Each feature area lives in its own handler file
- **Dual Configuration**: VS Code settings for simple values, external JSON for complex config
- **Shared Tools**: Language Model Tools defined once, consumed by multiple AI providers
- **Type-Safe**: Dart wrapper classes provide type-safe access to VS Code APIs
- **Dynamic Execution**: D4rt allows runtime Dart code execution with full VS Code API access

### Key Capabilities

| Area | Description |
|------|-------------|
| **Bridge Communication** | JSON-RPC 2.0 over stdin/stdout with profiles and auto-restart |
| **AI Workflows** | Tom AI Chat, Bot Conversation, Prompt Expander, Send to Chat |
| **Language Model Tools** | 14 workspace tools shared across VS Code LM API and Ollama |
| **Webview Panels** | 4 panels: TOM AI (6 sections), TOM, VS Code Notes, Workspace Notes |
| **Keyboard System** | Chord menus, combined commands, state machines, commandlines |
| **Telegram Bot** | Remote workspace control with 14 CLI-like commands |
| **CLI Integration** | TCP server for Tom CLI → VS Code external access |
| **Status Dashboard** | Full-tab webview for managing 8 service configurations |

For the complete feature list, see [vscode_extension_overview.md](../_copilot_guidelines/vscode_extension_overview.md).

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VS Code Editor                             │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │           VS Code Extension (TypeScript)                      │  │
│  │           tom_vscode_extension/src/                            │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│  │
│  │  │ extension.ts │  │vscode-bridge │  │ handlers/ (35 files) ││  │
│  │  │ ──────────── │  │.ts           │  │ ──────────────────── ││  │
│  │  │ • Activation │  │ ──────────── │  │ AI & Chat:           ││  │
│  │  │ • Commands   │◄►│ • Bridge     │  │  sendToChat          ││  │
│  │  │ • Lifecycle  │  │   Client     │  │  tomAiChat           ││  │
│  │  │              │  │ • JSON-RPC   │  │  botConversation     ││  │
│  │  │              │  │ • Process    │  │  expandPrompt        ││  │
│  │  └──────────────┘  │   Mgmt      │  │  trailLogger         ││  │
│  │                     └──────┬───────┘  │ Bridge & Execution:  ││  │
│  │                            │          │  restartBridge       ││  │
│  │  ┌──────────────────────┐  │          │  executeInTomAiBuild ││  │
│  │  │ tools/               │  │          │  cliServer           ││  │
│  │  │ ──────────────────── │  │          │ UI Panels:           ││  │
│  │  │ • SharedToolDefs     │  │          │  dsNotes (explorer)  ││  │
│  │  │ • tool-executors     │  │          │  unifiedNotepad (T2) ││  │
│  │  │ • LM tool register   │  │          │  t3Panel (T3)        ││  │
│  │  │ • Escalation tools   │  │          │  statusPage          ││  │
│  │  └──────────────────────┘  │          │ Shortcuts & Menus:   ││  │
│  │                            │          │  chordMenu           ││  │
│  │  ┌──────────────────────┐  │          │  combinedCommand     ││  │
│  │  │ managers/            │  │          │  stateMachine        ││  │
│  │  │ • todoManager        │  │          │  commandline         ││  │
│  │  └──────────────────────┘  │          │ Telegram:            ││  │
│  │                            │          │  telegram-* (6 files)││  │
│  │  ┌──────────────────────┐  │          │ Utilities:           ││  │
│  │  │ handler_shared.ts    │  │          │  showApiInfo, etc.   ││  │
│  │  │ • Bridge access      │  │          └──────────────────────┘│  │
│  │  │ • Copilot model      │  │                                   │  │
│  │  │ • Logging, errors    │  │                                   │  │
│  │  └──────────────────────┘  │                                   │  │
│  └────────────────────────────┼───────────────────────────────────┘  │
│                               │                                      │
└───────────────────────────────┼──────────────────────────────────────┘
                                │
                                │ stdin/stdout (JSON-RPC 2.0)
                                │ ID: js-N (TS→Dart), dart-N (Dart→TS)
                                │ Methods: *Vcb (→Dart), *Vce (→TS)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                Dart Bridge Process (Child)                           │
│                tom_vscode_bridge/lib/                                │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  bridge_server.dart                                           │  │
│  │  • JSON-RPC Server        • D4rt Integration                  │  │
│  │  • Message Router         • Request Handler                   │  │
│  └──────────────────┬─────────────────────────────────────────┬──┘  │
│                     │                                         │     │
│  ┌──────────────────▼──┐  ┌──────────────────┐  ┌───────────▼───┐ │
│  │ vscode_api/          │  │  D4rt Engine     │  │ API Handlers  │ │
│  │ • vscode.dart        │  │  • Script Exec   │  │ • Window      │ │
│  │ • vscode_window      │  │  • Sandboxing    │  │ • Workspace   │ │
│  │ • vscode_workspace   │  │  • Context       │  │ • Commands    │ │
│  │ • vscode_commands    │  │                  │  │ • Chat        │ │
│  │ • vscode_lm          │  │                  │  │ • LM          │ │
│  │ • vscode_chat        │  │                  │  │               │ │
│  │ • vscode_extensions  │  │                  │  │               │ │
│  │ • vscode_types       │  │                  │  │               │ │
│  │ • d4rt_helpers (80+) │  │                  │  │               │ │
│  └──────────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Extension Architecture (TypeScript)

**Location:** `tom_vscode_extension/src/`

### Entry Point (`extension.ts`)

Activation event: `onStartupFinished`. The `activate()` function orchestrates initialization in 18 steps:

1. Create `DartBridgeClient` singleton
2. Register ~35 core commands (`dartscript.*`)
3. Register subsystem commands (chord menus, commandlines, combined commands, state machines)
4. Register webview panels (dsNotes, unifiedNotepad, t3Panel)
5. Check reinstall marker for reload-finished notification
6. Auto-start the Dart bridge
7. Initialize AI subsystems (SendToChat, PromptExpander, BotConversation)
8. Register Language Model Tools (14 tools)

See [implementation.md](implementation.md) for the full 18-step activation sequence.

### Handler Architecture

Every feature lives in its own handler file under `src/handlers/`. All handlers share state through `handler_shared.ts`.

**Handler categories:**

| Category | Handlers | Purpose |
|----------|----------|---------|
| AI & Chat | `sendToChat`, `sendToChatAdvanced`, `tomAiChat`, `expandPrompt`, `botConversation`, `trailLogger` | AI-powered workflows |
| Bridge & Execution | `restartBridge`, `executeInTomAiBuild`, `executeAsScript`, `runTests`, `cliServer` | Bridge lifecycle and script execution |
| UI Panels | `dsNotes`, `unifiedNotepad`, `t3Panel`, `statusPage`, `accordionPanel`, `notepad` | Webview-based UI components |
| Shortcuts & Menus | `chordMenu`, `commandline`, `combinedCommand`, `stateMachine` | Keyboard-driven command system |
| Telegram | `telegram-commands`, `telegram-notifier`, `telegram-cmd-handlers`, `telegram-cmd-parser`, `telegram-cmd-response`, `telegram-markdown` | Remote bot integration |
| Utilities | `showApiInfo`, `showHelp`, `debugLogging`, `printConfiguration`, `processMonitor`, `reloadWindow` | Developer tools |

**Two registration styles:**
- **Direct:** Registered via `registerCommands()` in `extension.ts`
- **Subsystem:** Handler exports `register*()` function that registers its own commands internally

### Shared Utilities (`handler_shared.ts`)

Central module providing bridge access, logging, Copilot model selection, workspace paths, file validation, error handling, and config file reading. All handlers import from this module rather than accessing globals directly.

### Bridge Client (`vscode-bridge.ts`)

`DartBridgeClient` manages the Dart child process:
- Spawns `dart run` with configurable profiles
- JSON-RPC 2.0 message serialization/deserialization
- Pending request tracking with 30-second timeout
- Inbound request routing to `*Vce` handlers
- Auto-restart on unexpected process exit
- Debug logging at two levels (request handling, raw JSON)

### Tools (`tools/`)

| File | Purpose |
|------|---------|
| `shared-tool-registry.ts` | Provider-agnostic `SharedToolDefinition` interface + VS Code/Ollama adapters |
| `tool-executors.ts` | 14 tool implementations (file I/O, search, terminal, diagnostics, web) |
| `tomAiChat-tools.ts` | VS Code LM API tool registration wrapper |
| `escalation-tools-config.ts` | Ask Copilot and Ask Big Brother escalation configuration |

---

## Bridge Server Architecture (Dart)

**Location:** `tom_vscode_bridge/lib/`

### bridge_server.dart

**Class:** `VSCodeBridgeServer`

Core JSON-RPC server implementation:
- Listens on stdin for JSON-RPC messages, responds via stdout
- Routes requests to appropriate Dart handlers
- Initializes D4rt interpreter for dynamic execution
- Provides Dart-friendly wrappers for VS Code APIs
- Can send requests back to VS Code extension (bidirectional)

Key Methods:
```dart
void start()
void _handleMessage(String line)
Future<void> _handleRequest(String method, Map<String, dynamic> params, int? id)
Future<T> sendRequest<T>(String method, Map<String, dynamic> params)
void _sendResponse(int id, dynamic result)
void _sendError(String message)
void _sendLog(String message)
```

### VS Code API Wrappers (`vscode_api/`)

Type-safe Dart classes that wrap VS Code's TypeScript API:

| Class | Namespace | Key APIs |
|-------|-----------|----------|
| `VSCode` | Main aggregator | `getVersion()`, `getEnv()`, `openExternal()` |
| `VSCodeWindow` | `vscode.window` | `showInformationMessage`, `showQuickPick`, `showInputBox`, `showTextDocument` |
| `VSCodeWorkspace` | `vscode.workspace` | `getWorkspaceFolders`, `findFiles`, `readFile`, `writeFile`, `getConfiguration` |
| `VSCodeCommands` | `vscode.commands` | `executeCommand`, `getCommands` |
| `VSCodeLanguageModel` | `vscode.lm` | `selectChatModels`, `sendRequest`, `countTokens` |
| `VSCodeChat` | `vscode.chat` | `registerChatParticipant`, `sendChatResponse`, `reportChatProgress` |
| `VSCodeExtensions` | `vscode.extensions` | `getAllExtensions`, `getExtension` |

**Wrapping pattern:** Each Dart method sends a `executeScriptVce` request containing a JavaScript fragment that calls the real VS Code API:

```dart
Future<void> showInformationMessage(String message, [List<String>? options]) async {
  await _bridge.sendRequest('executeScriptVce', {
    'script': 'return await context.vscode.window.showInformationMessage(params.message, ...(params.options || []));',
    'params': {'message': message, 'options': options},
  });
}
```

### D4rt Helpers (`d4rt_helpers.dart`)

80+ utility functions for common VS Code operations in D4rt scripts:

```dart
await log('Debug message');
await showInfo('Success!');
final currentFile = await getCurrentFile();
await openFile('/path/to/file.dart');
final folders = await getWorkspaceFolders();
```

---

## Communication Protocol

### JSON-RPC 2.0

All messages use JSON-RPC 2.0 over stdin/stdout pipes, one JSON object per line.

| Message Type | Fields | Response Expected |
|-------------|--------|-------------------|
| Request | `jsonrpc`, `id`, `method`, `params` | Yes |
| Response | `jsonrpc`, `id`, `result` or `error` | No |
| Notification | `jsonrpc`, `method`, `params` (no `id`) | No |

### ID and Method Conventions

| Convention | Pattern | Example |
|-----------|---------|---------|
| TS→Dart ID prefix | `js-` | `js-1`, `js-42` |
| Dart→TS ID prefix | `dart-` | `dart-1`, `dart-7` |
| Dart→TS method suffix | `*Vce` | `executeScriptVce`, `showInfoVce` |
| TS→Dart method suffix | `*Vcb` | `getWorkspaceInfoVcb`, `executeFileVcb` |

### Message Flow

**Outbound (TypeScript → Dart):**
1. Handler calls `bridgeClient.sendRequest(method, params)`
2. Client generates `js-N` ID, serializes JSON-RPC message
3. Writes JSON + newline to child process stdin
4. Stores `{resolve, reject, timer}` in `pendingRequests` Map
5. Dart bridge parses, routes, executes, returns result via stdout
6. Client matches ID, resolves Promise with result

**Inbound (Dart → TypeScript):**
1. Dart calls `bridge.sendRequest(method, params)`
2. Dart generates `dart-N` ID, writes JSON to stdout
3. Extension's `handleMessage()` parses the line
4. Routes to appropriate `*Vce` handler in `vscode-bridge.ts`
5. Handler executes (often calling VS Code API)
6. Extension writes JSON response to child process stdin

For the complete list of bridge methods, see [dartscript_extension_bridge.md](../_copilot_guidelines/dartscript_extension_bridge.md).

---

## Process Management

### Lifecycle

**Startup:**
1. Extension activates on `onStartupFinished`
2. `restartBridgeHandler()` calls `bridgeClient.start(workspaceRoot, profile)`
3. Spawns `dart run` with the configured bridge project path
4. Sets up stdin/stdout/stderr pipes
5. Dart `VSCodeBridgeServer.start()` initializes, sends ready log

**Normal Operation:**
- Both sides exchange JSON-RPC messages
- Pending request maps track outstanding requests (ID → Promise/Completer)
- 30-second timeout per request
- Errors propagate as JSON-RPC error responses

**Shutdown:**
1. `deactivate()` calls `bridgeClient.stop()`
2. `process.kill()` terminates the Dart child
3. All pending requests rejected
4. Event listeners and resources cleaned up

### Error Handling

| Error Type | Behavior |
|-----------|----------|
| Process crash | All pending requests rejected, optional auto-restart |
| Invalid JSON | Logged and ignored, connection stays alive |
| Unknown method | JSON-RPC error response returned to caller |
| Request timeout | Promise rejected after 30 seconds |
| Pipe error | Process terminates, pending requests rejected |

### Bridge Profiles

Multiple configurations in `~/.tom/vscode/tom_vscode_extension.json` under `dartscriptBridge.profiles`:

```json
{
  "dartscriptBridge": {
    "profiles": {
      "default": {
        "dartProjectPath": "/path/to/tom_vscode_bridge",
        "workingDirectory": "/workspace",
        "args": [],
        "env": {}
      }
    }
  }
}
```

Switch via `dartscript.switchBridgeProfile` or the Status Page dashboard.

See [bridge_scripting_guide.md](../_copilot_guidelines/bridge_scripting_guide.md) for full profile configuration and scripting documentation.

---

## Webview Architecture

### Four Webview Locations

| View ID | Container | Location | Handler | Purpose |
|---------|-----------|----------|---------|---------|
| `dartscript.unifiedNotepad` | `dartscript-t2-panel` | Bottom panel | `unifiedNotepad-handler.ts` | TOM AI (6 accordion sections) |
| `dartscript.t3Panel` | `dartscript-t3-panel` | Bottom panel | `t3Panel-handler.ts` | TOM (Tasks, Logs, Settings) |
| `dartscript.tomNotepad` | Explorer sidebar | Sidebar | `dsNotes-handler.ts` | VS CODE NOTES (global) |
| `dartscript.workspaceNotepad` | Explorer sidebar | Sidebar | `dsNotes-handler.ts` | WORKSPACE NOTES (per-workspace) |

### Webview Communication

All panels use bidirectional messaging via `postMessage()` / `onDidReceiveMessage()`. Content sync uses either:
- **File I/O** (dsNotes) — Direct read/write to markdown files with file watchers
- **Webview state** (unifiedNotepad) — `getState()` / `setState()` for persistence

### Accordion Component

`AccordionPanel` (`accordionPanel.ts`) provides reusable collapsible sections with headers, icons, expand/collapse state, and CSS animations. Used by the TOM AI and TOM bottom panels.

See [tom_ai_bottom_panel.md](../_copilot_guidelines/tom_ai_bottom_panel.md), [explorer_notes.md](../_copilot_guidelines/explorer_notes.md), and [tom_status_page.md](../_copilot_guidelines/tom_status_page.md) for detailed panel documentation.

---

## Tool System Architecture

### Shared Tool Registry

Tools are defined as `SharedToolDefinition` objects in `tool-executors.ts` and consumed by multiple providers through adapters:

```
SharedToolDefinition
    │
    ├──► VS Code LM API adapter (tomAiChat-tools.ts)
    │    → Registered as LanguageModelTool for Tom AI Chat
    │
    └──► Ollama adapter (shared-tool-registry.ts)
         → Used by PromptExpander and BotConversation tool loops
```

**14 registered tools:** File operations (create, read, edit, multi-edit), workspace exploration (list, find files, find text), execution (run command, VS Code command), diagnostics (get errors), web (fetch, search), and AI workflow (read guideline, manage todo).

### Escalation Tools

Two mechanisms for one AI to delegate to another:
- **Ask Copilot** — Opens Copilot Chat with prompt, polls for answer file at configurable interval
- **Ask Big Brother** — Uses VS Code LM API directly with tool calling and optional summarization

See [ask_ai_tools.md](../_copilot_guidelines/ask_ai_tools.md) for escalation tool details.

---

## Copilot & AI Architecture

### AI Integration Layers

The extension provides four distinct AI integration patterns:

| Layer | Technology | Use Case |
|-------|-----------|----------|
| **Send to Chat** | VS Code Chat API | Send text to Copilot Chat with templates |
| **Tom AI Chat** | VS Code LM API + tools | Agentic `.chat.md` workflow with 14 workspace tools |
| **Prompt Expander** | Ollama HTTP API | Local LLM expansion with tool calling |
| **Bot Conversation** | Ollama + VS Code Chat | Multi-turn automated Ollama↔Copilot dialogue |

### Language Model Access

Copilot model selection follows a fallback chain:
1. Try configured model family (`dartscript.copilotModel`)
2. Fallback to any `copilot` vendor model
3. Show error if none available

### Trail Logging

AI interactions can be recorded to `_ai/trail/` files for audit and replay. Toggle via Status Page or `dartscript.toggleTrail`.

See [tom_ai_chat.md](../_copilot_guidelines/tom_ai_chat.md), [ai_conversation.md](../_copilot_guidelines/ai_conversation.md), and [local_llm.md](../_copilot_guidelines/local_llm.md) for detailed AI workflow documentation.

---

## D4rt Integration

### Dynamic Dart Execution

D4rt allows executing Dart code at runtime without compilation:
- Full Dart language support
- Access to imported packages
- Type safety preserved
- Variable passing between host and script
- Exception handling

**Example:**
```dart
final result = await _interpreter.execute('''
  final message = params['message'];
  for (int i = 0; i < 5; i++) {
    await log('$message $i');
  }
  return 'Logged 5 messages';
''', params: {'message': 'Hello'});
```

### Sandboxing

D4rt provides configurable sandboxing:
- **Full Access**: All `dart:` libraries available
- **Limited Access**: Only safe libraries (core, async, collection)
- **Custom**: Specific whitelist of allowed imports

### VS Code API Access from D4rt

D4rt scripts have full access to wrapped VS Code APIs via registered bridges:

```dart
await _interpreter.execute('''
  final vscode = VSCode(bridge);
  await vscode.window.showInformationMessage('From D4rt!');
  final folders = await vscode.workspace.getWorkspaceFolders();
  return folders.length;
''');
```

The 80+ helper functions in `d4rt_helpers.dart` provide shortcuts for common operations.

---

## Security Model

### Process Isolation

- Bridge runs as **child process**, not in the main extension process
- Bridge crash doesn't crash VS Code
- Resource limits enforced by OS (memory, CPU)

### API Sandboxing

- D4rt scripts sandboxed by import whitelist
- No direct file system access unless explicitly allowed
- Network access controlled through configuration

### Input Validation

- All JSON-RPC messages validated before processing
- Type checking on method parameters
- Unknown methods rejected with error response

### Error Boundaries

- Exceptions caught and converted to error responses
- Stack traces sanitized before sending to client
- Sensitive information (tokens, keys) filtered from logs

---

## Performance Considerations

### Message Overhead

- **JSON Serialization**: ~1ms per message
- **Pipe I/O**: ~0.1ms latency
- **Typical round-trip**: 2–5ms for simple requests

### Optimization Strategies

1. **Batching**: Group multiple API calls into a single `executeScriptVce` call
2. **Caching**: Cache workspace folders, configuration values
3. **Async parallelism**: Use `Future.wait()` for independent operations
4. **Debouncing**: Webview auto-saves use 300–500ms debounce to reduce writes

### Memory Management

- Completed requests removed from pending map immediately
- Limited buffer size for stdout/stdin
- D4rt scopes cleaned up after script execution
- File watchers disposed on panel hide/destroy

---

## Extension Points

### Adding New VS Code API Wrappers (Dart side)

1. Create new wrapper class in `vscode_api/` following the namespace mapping pattern
2. Add to `VSCode` main aggregator class
3. Each method sends a `executeScriptVce` request with a JavaScript fragment
4. Add helper functions to `d4rt_helpers.dart` for common D4rt operations

### Adding New Extension Commands (TypeScript side)

1. Create handler file in `src/handlers/` using `handler_shared.ts` utilities
2. Export from `handlers/index.ts`
3. Register in `extension.ts` → `registerCommands()` or via subsystem `register*()` function
4. Add to `package.json` → `contributes.commands`

See [implementation.md](implementation.md) for implementation patterns with code examples.

### Adding Language Model Tools

Define a `SharedToolDefinition` in `tool-executors.ts` — it is automatically registered with both the VS Code LM API and Ollama tool adapters.

---

## See Also

- [implementation.md](implementation.md) — Technical implementation reference with code patterns
- [project.md](project.md) — Project overview, quick start, and configuration
- [user_guide.md](../doc/user_guide.md) — End-user guide
- [vscode_extension_overview.md](vscode_extension_overview.md) — Complete 15-area feature overview with documentation index
- [dartscript_extension_bridge.md](dartscript_extension_bridge.md) — Full command and bridge method reference
- [tom_vscode_bridge PROJECT.md](../tom_vscode_bridge/PROJECT.md) — Dart bridge project documentation
