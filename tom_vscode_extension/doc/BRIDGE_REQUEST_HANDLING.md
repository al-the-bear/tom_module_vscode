# Bridge Request Handling

Documentation of all JSON-RPC commands supported between the VS Code extension (TypeScript) and the Dart bridge process.

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
| `executeFileVce` | `filePath: string`, `params?: object` | `{ filePath, success, result }` | Loads and runs a JavaScript file in the extension host. File must export a function `(params, context)` where context = `{ vscode, bridge, require, console }` |
| `executeScriptVce` | `script: string`, `params?: object` | `{ success, result }` | Executes inline JavaScript in the extension host with `params` and `context` |

### Copilot Integration

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `askCopilotVce` | `prompt: string` | Response text as string | Sends a prompt to Copilot LLM and returns the response |
| `sendToChatVce` | `prompt: string` | `{ success: true }` | Opens VS Code Copilot Chat with the given prompt |

### Local LLM / Prompt Expander

These are delegated to `PromptExpanderManager.handleBridgeRequest()`.

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
| `stopCliServer` | *(none)* | `{ success, message, port, wasRunning }` | Stops the CLI integration server |
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
| `executeFileVcb` | `filePath: string`, `params?: object`, `basePath?: string` | `{ success, result, logs }` | Loads a Dart file and executes it in D4rt. Sets `basePath` to file's directory for relative imports |
| `executeScriptVcb` | `script: string`, `params?: object`, `basePath?: string` | `{ success, result, logs }` | Executes inline Dart code in D4rt. Script has access to bridge context (`sendRequest`, `sendNotification`) |
| `executeExpressionVcb` | `expression: string`, `params?: object`, `basePath?: string` | `{ success, result, logs }` | Evaluates a single Dart expression using D4rt's `eval()` |

**Note:** The execute commands send their responses directly inside the handler (not via the outer dispatch) to support streaming logs.

### Process Monitor

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `startProcessMonitor` | *(none)* | `{ success, processMonitor, watcher, ledgerServer }` | Starts Tom Process Monitor, waits 3s, then checks aliveness of Process Monitor, Watcher, and Ledger Server |

### Debug Settings

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `setDebugLogging` | `enabled: bool` | `{ success, debugLogging, debugTraceLogging }` | Enables/disables debug logging in Dart bridge |
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
