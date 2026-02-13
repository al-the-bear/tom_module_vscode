# Bridge Request Handling

Complete reference for all JSON-RPC commands supported between the VS Code extension (TypeScript) and the Dart bridge process.

## Protocol

The bridge uses **JSON-RPC 2.0** over **stdin/stdout**.

### Request Format

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

### Response Format

**Success:**
```json
{ "jsonrpc": "2.0", "id": "js-1", "result": { ... } }
```

**Error:**
```json
{ "jsonrpc": "2.0", "id": "js-1", "error": { "message": "...", "data": "stackTrace" } }
```

### Routing Convention

| Suffix | Handled By | Description |
|--------|-----------|-------------|
| `Vce` | VS Code extension (TypeScript) | Commands that need VS Code API access |
| `Vcb` | Dart bridge | Commands that need Dart/D4rt runtime |
| *(none)* | Dart bridge | Legacy commands without suffix |

ID prefixes: VS Code uses `js-N`, Dart uses `dart-N`.

Any method ending in `Vce` is automatically forwarded from Dart → VS Code extension unchanged.

---

## Part 1: Commands the Bridge Can Send to VS Code (Vce)

These are handled in `vscode-bridge.ts` → `handleDartRequest()`.

### UI & Notifications

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `logVce` | `message: string` | *(none — fire-and-forget)* | Logs to VS Code output channel |
| `showInfoVce` | `message: string` | `{ success: true }` | Shows info notification |
| `showErrorVce` | `message: string` | `{ success: true }` | Shows error notification |
| `showWarningVce` | `message: string` | `{ success: true }` | Shows warning notification |

### File Operations

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `readFileVce` | `path: string` | File content as string | Reads a file via VS Code workspace FS |
| `writeFileVce` | `path: string`, `content: string` | `{ success: true }` | Writes content to a file |
| `openFileVce` | `path: string` | `{ success: true }` | Opens a file in the VS Code editor |

### Code Execution

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `executeFileVce` | `filePath: string`, `params?: object` | `{ filePath, success, result }` | Loads and runs a JavaScript file in the extension host |
| `executeScriptVce` | `script: string`, `params?: object` | `{ success, result }` | Executes inline JavaScript in the extension host |

**`executeFileVce` context:** File must export a function `(params, context)` where `context = { vscode, bridge, require, console }`.

**Error return shape:** `{ filePath?, success: false, error: string, stack: string }`

### Copilot Integration

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `askCopilotVce` | `prompt: string` | Response text as string | Sends a prompt to Copilot LLM and returns the response |
| `sendToChatVce` | `prompt: string` | `{ success: true }` | Opens VS Code Copilot Chat with the given prompt |

**`sendToChatVce` error return:** `{ success: false, error: string }`

### Local LLM / Prompt Expander

Delegated to `PromptExpanderManager.handleBridgeRequest()`.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `localLlm.getProfilesVce` | *(none)* | `{ profiles: [...] }` | Lists all prompt expansion profiles |
| `localLlm.getModelsVce` | *(none)* | `{ models: [...], effectiveDefault: {...} }` | Lists all model configurations |
| `localLlm.updateProfileVce` | `key: string`, `profile: object` | `{ success: bool }` | Adds or updates a named profile |
| `localLlm.removeProfileVce` | `key: string` | `{ success: bool }` | Removes a profile |
| `localLlm.updateModelVce` | `key: string`, `model: object` | `{ success: bool }` | Adds or updates a model config |
| `localLlm.removeModelVce` | `key: string` | `{ success: bool }` | Removes a model config |
| `localLlm.processVce` | `prompt: string`, `profile?: string`, `model?: string` | `ExpanderProcessResult` | Processes a prompt through local LLM |

**`ExpanderProcessResult` shape:**
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
| `botConversation.getConfigVce` | *(none)* | Config object (see below) | Returns resolved bot conversation config |
| `botConversation.getProfilesVce` | *(none)* | `{ profiles: [...] }` | Lists named conversation profiles |
| `botConversation.startVce` | See below | Conversation result (see below) | Starts a multi-turn conversation |
| `botConversation.stopVce` | `reason?: string` | `{ success, message }` | Stops the active conversation |
| `botConversation.haltVce` | `reason?: string` | `{ success, message, halted }` | Pauses conversation between turns |
| `botConversation.continueVce` | *(none)* | `{ success, message, halted }` | Resumes a halted conversation |
| `botConversation.addInfoVce` | `text: string` | `{ success, message }` | Injects text into the next turn's prompt |
| `botConversation.statusVce` | *(none)* | Status object (see below) | Returns conversation status |
| `botConversation.getLogVce` | `conversationId: string` | `{ found, conversationId, logFilePath?, content? }` | Reads a conversation log from disk |
| `botConversation.singleTurnVce` | See below | `{ localModelOutput, localModelStats?, copilotResponse? }` | Single Ollama→Copilot round-trip |

**`botConversation.getConfigVce` return shape:**
```json
{
  "maxTurns": 10,
  "temperature": 0.5,
  "historyMode": "trim_and_summary",
  "maxHistoryTokens": 4000,
  "modelConfig": null,
  "pauseBetweenTurns": false,
  "pauseBeforeFirst": false,
  "logConversation": true,
  "stripThinkingTags": true,
  "copilotModel": null,
  "conversationLogPath": "_ai/bot_conversations",
  "goalReachedMarker": "__GOAL_REACHED__",
  "profileKeys": ["profile1", "profile2"]
}
```

**`botConversation.startVce` parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `goal` | `string` | **Yes** | The conversation goal |
| `description` | `string` | No | Optional context/description |
| `profile` | `string` | No | Profile key (omit for defaults) |
| `maxTurns` | `number` | No | Override max turns |
| `temperature` | `number` | No | Override temperature |
| `modelConfig` | `string` | No | Override model config key |
| `historyMode` | `string` | No | `"full"`, `"last"`, `"summary"`, `"trim_and_summary"` |
| `includeFileContext` | `string[]` | No | File paths to include as context |
| `pauseBetweenTurns` | `boolean` | No | Override pause setting |
| `conversationMode` | `string` | No | `"ollama-copilot"` or `"ollama-ollama"` |

**`botConversation.startVce` return shape:**
```json
{
  "conversationId": "uuid",
  "turns": 5,
  "goalReached": true,
  "logFilePath": "_ai/bot_conversations/...",
  "exchanges": [
    {
      "turn": 1,
      "timestamp": "2026-02-13T10:00:00.000Z",
      "promptToCopilot": "...",
      "copilotResponse": {
        "requestId": "...",
        "generatedMarkdown": "...",
        "comments": "...",
        "references": [],
        "requestedAttachments": []
      },
      "localModelStats": null
    }
  ]
}
```

**`botConversation.singleTurnVce` parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | **Yes** | The prompt for the local model |
| `systemPrompt` | `string` | No | System prompt (default: orchestrator prompt) |
| `modelConfig` | `string` | No | Model config key |
| `temperature` | `number` | No | Generation temperature |
| `sendToCopilot` | `boolean` | No | Forward to Copilot (default: `true`) |
| `copilotSuffix` | `string` | No | Suffix appended to Copilot prompt |

**`botConversation.statusVce` return shape:**

When inactive: `{ "active": false }`

When active:
```json
{
  "active": true,
  "halted": false,
  "conversationId": "uuid",
  "goal": "...",
  "profileKey": "default",
  "conversationMode": "ollama-copilot",
  "turnsCompleted": 3,
  "maxTurns": 10,
  "pendingUserInput": 0
}
```

---

## Part 2: Commands the Extension Can Send to the Bridge (Vcb)

These are handled in `bridge_server.dart` → `_handleRequestInternalWithResult()`.

### Diagnostics

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `echo` | `message: string` | `{ message }` | Echo test — returns the message unchanged |

### CLI Integration Server

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `startCliServer` | `port?: int` | `{ success, message, port, alreadyRunning }` | Starts CLI integration TCP server. Auto-selects port 19900–19909 if not specified |
| `stopCliServer` | *(none)* | `{ success, message, port?, wasRunning }` | Stops the CLI integration server. `port` field only present when server was running |
| `getCliServerStatus` | *(none)* | `{ running: bool, port: int? }` | Returns CLI server status |

### Workspace Information

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `getWorkspaceInfo` | `workspaceRoot: string` | `{ root, projects: string[], projectCount }` | Lists top-level directories in the workspace |

### Documentation Generation

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `generateDocs` | `projectPath: string`, `prompt: string` | `{ docsPath, success, copilotResponse }` | Generates docs by asking Copilot, writes to `{projectPath}/docs/generated.md`, opens the file |

### Dart/D4rt Execution

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `executeFileVcb` | `filePath: string`, `params?: object`, `basePath?: string` | `{ success, result, logs }` | Loads and executes a Dart file in D4rt. Sets `basePath` to file's directory for relative imports |
| `executeScriptVcb` | `script: string`, `params?: object`, `basePath?: string` | `{ success, result, logs }` | Executes inline Dart code in D4rt. Script has access to bridge context (`sendRequest`, `sendNotification`) |
| `executeExpressionVcb` | `expression: string`, `params?: object`, `basePath?: string` | `{ success, result, logs }` | Evaluates a single Dart expression using D4rt's `eval()` |

**Error return shape:** `{ success: false, error: string, stackTrace: string, logs: string[] }`

**Note:** The execute commands send their responses directly inside the handler (not via the outer dispatch) to support streaming logs.

### Process Monitor

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `startProcessMonitor` | *(none)* | `{ success, message, processMonitor, watcher, ledgerServer }` | Starts Tom Process Monitor, waits 3s, then checks aliveness of Process Monitor, Watcher, and Ledger Server |

### Debug Settings

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `setDebugLogging` | `enabled: bool` | `{ success, debugLogging, debugTraceLogging }` | Enables/disables debug logging in Dart bridge. Defaults to `false` if `enabled` omitted |
| `getDebugLogging` | *(none)* | `{ debugLogging, debugTraceLogging }` | Returns current debug logging status |
| `printConfiguration` | *(none)* | `{ success: true, message }` | Prints full D4rt interpreter configuration to output channel |

---

## Usage from Dart Scripts

Dart scripts executed via `executeFileVcb` or `executeScriptVcb` can call back into VS Code using the bridge context:

```dart
// Send a request to VS Code (Vce method)
final result = await sendRequest('showInfoVce', {'message': 'Hello from Dart!'});

// Send a notification (fire-and-forget)
sendNotification('logVce', {'message': 'Script running...'});

// Call another bridge command
final info = await sendRequest('getWorkspaceInfo', {'workspaceRoot': '/path/to/workspace'});
```

## Usage from JavaScript Scripts

JavaScript scripts executed via `executeFileVce` or `executeScriptVce` receive a `context` object:

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
