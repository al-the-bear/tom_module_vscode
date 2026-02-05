# VS Code Bridge Architecture

Comprehensive architecture documentation for the VS Code Bridge system, covering both the TypeScript extension (tom_vscode_extension) and Dart bridge server (tom_vscode_bridge).

## Table of Contents

- [VS Code Bridge Architecture](#vs-code-bridge-architecture)
  - [Table of Contents](#table-of-contents)
  - [System Overview](#system-overview)
    - [Design Principles](#design-principles)
    - [Key Benefits](#key-benefits)
  - [Architecture Diagram](#architecture-diagram)
  - [Component Breakdown](#component-breakdown)
    - [VS Code Extension (TypeScript)](#vs-code-extension-typescript)
      - [extension.ts](#extensionts)
      - [vscode-bridge.ts](#vscode-bridgets)
    - [Bridge Server (Dart)](#bridge-server-dart)
      - [bridge\_server.dart](#bridge_serverdart)
      - [vscode\_api/ (API Wrappers)](#vscode_api-api-wrappers)
  - [Communication Protocol](#communication-protocol)
    - [JSON-RPC 2.0](#json-rpc-20)
    - [Message Flow](#message-flow)
      - [TypeScript → Dart (Request)](#typescript--dart-request)
      - [Dart → TypeScript (Request)](#dart--typescript-request)
    - [Request/Response Pattern](#requestresponse-pattern)
  - [Process Management](#process-management)
    - [Lifecycle](#lifecycle)
      - [Startup Sequence](#startup-sequence)
      - [Normal Operation](#normal-operation)
      - [Shutdown Sequence](#shutdown-sequence)
    - [Error Handling](#error-handling)
      - [Process Crashes](#process-crashes)
      - [Communication Errors](#communication-errors)
      - [Graceful Degradation](#graceful-degradation)
    - [Resource Cleanup](#resource-cleanup)
  - [API Integration](#api-integration)
    - [VS Code API Wrapping](#vs-code-api-wrapping)
    - [Bidirectional Communication](#bidirectional-communication)
    - [Dynamic Script Execution](#dynamic-script-execution)
  - [Copilot Integration](#copilot-integration)
    - [Language Model API](#language-model-api)
    - [Chat Participant](#chat-participant)
    - [Workspace Analysis](#workspace-analysis)
  - [D4rt Integration](#d4rt-integration)
    - [Dynamic Dart Execution](#dynamic-dart-execution)
    - [Sandboxing](#sandboxing)
    - [VS Code API Access from D4rt](#vs-code-api-access-from-d4rt)
  - [Security Model](#security-model)
    - [Process Isolation](#process-isolation)
    - [API Sandboxing](#api-sandboxing)
    - [Input Validation](#input-validation)
    - [Error Boundaries](#error-boundaries)
  - [Performance Considerations](#performance-considerations)
    - [Message Overhead](#message-overhead)
    - [Optimization Strategies](#optimization-strategies)
    - [Memory Management](#memory-management)
  - [Extension Points](#extension-points)
    - [Adding New VS Code APIs](#adding-new-vs-code-apis)
    - [Adding Extension Commands](#adding-extension-commands)
    - [Extending D4rt Helpers](#extending-d4rt-helpers)
  - [Conclusion](#conclusion)

---

## System Overview

The VS Code Bridge system enables **bidirectional communication** between a VS Code extension (TypeScript) and a Dart process. The architecture consists of two main components:

1. **VS Code Extension** (`tom_vscode_extension`): A TypeScript extension running within VS Code that provides user commands, Copilot integration, and bridge client functionality.

2. **Dart Bridge Server** (`tom_vscode_bridge`): A Dart process that wraps VS Code APIs and provides dynamic Dart script execution via D4rt.

### Design Principles

- **Child Process Model**: The VS Code extension spawns the Dart bridge as a child process
- **JSON-RPC Communication**: All communication uses JSON-RPC 2.0 over stdin/stdout
- **Bidirectional**: Both sides can initiate requests to the other
- **Type-Safe**: Dart wrapper classes provide type-safe access to VS Code APIs
- **Dynamic Execution**: D4rt allows runtime execution of Dart code with full VS Code API access
- **Copilot Native**: Built-in support for VS Code Copilot language models and chat participants

### Key Benefits

- **Unified Development**: Write VS Code extensions in Dart instead of TypeScript
- **Dynamic Scripts**: Execute Dart code dynamically without recompiling
- **Type Safety**: Strong typing on Dart side vs JavaScript's dynamic nature
- **Reusability**: Dart code can be shared between bridge scripts and standalone Dart projects
- **AI Integration**: Native support for Copilot features from Dart

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Editor                            │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         VS Code Extension (TypeScript)                      │ │
│  │         tom_vscode_extension/src/                            │ │
│  │                                                              │ │
│  │  ┌──────────────────┐      ┌─────────────────────────────┐ │ │
│  │  │  extension.ts    │      │  vscode-bridge.ts           │ │ │
│  │  │  ───────────────│      │  ────────────────────────  │ │ │
│  │  │  • Commands      │◄────►│  • DartBridgeClient        │ │ │
│  │  │  • Copilot       │      │  • Process Management      │ │ │
│  │  │  • Context Menu  │      │  • JSON-RPC Client         │ │ │
│  │  │  • UI Actions    │      │  • Message Routing         │ │ │
│  │  └──────────────────┘      └─────────────────────────────┘ │ │
│  │                                       │                      │ │
│  └───────────────────────────────────────┼──────────────────────┘ │
│                                          │                        │
└──────────────────────────────────────────┼────────────────────────┘
                                           │
                                           │ stdin/stdout
                                           │ (JSON-RPC 2.0)
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Dart Bridge Process (Child)                         │
│              tom_vscode_bridge/lib/                                 │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  bridge_server.dart                                         │ │
│  │  ───────────────────                                        │ │
│  │  • JSON-RPC Server                                          │ │
│  │  • Message Router                                           │ │
│  │  • Request Handler                                          │ │
│  │  • D4rt Integration                                         │ │
│  └──────────────────┬─────────────────────────────────────────┘ │
│                     │                                            │
│                     ├──────────────────┬─────────────────────┐  │
│                     ▼                  ▼                     ▼  │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │ vscode_api/          │  │  D4rt Engine     │  │ API       │ │
│  │ ──────────────────  │  │  ─────────────   │  │ Handlers  │ │
│  │ • vscode.dart       │  │  • Script Exec   │  │ • Window  │ │
│  │ • vscode_window     │  │  • Sandboxing    │  │ • Workspace│ │
│  │ • vscode_workspace  │  │  • Context       │  │ • Commands│ │
│  │ • vscode_commands   │  │  • Type Bridge   │  │ • Chat    │ │
│  │ • vscode_lm         │  │                  │  │ • LM      │ │
│  │ • vscode_chat       │  │                  │  │           │ │
│  │ • vscode_extensions │  │                  │  │           │ │
│  │ • vscode_types      │  │                  │  │           │ │
│  │ • d4rt_helpers      │  │                  │  │           │ │
│  └──────────────────────┘  └──────────────────┘  └───────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Legend:
  ◄────►  Bidirectional communication
  ───►    Unidirectional flow
  ▼       Data/control flow
```

---

## Component Breakdown

### VS Code Extension (TypeScript)

**Location**: `tom_vscode_extension/src/`

The TypeScript extension is the VS Code-facing component that users interact with.

#### extension.ts

Entry point for the VS Code extension. Responsibilities:

- **Command Registration**: Registers all VS Code commands (`dartScript.*`)
- **Activation**: Initializes the bridge client on extension activation
- **Copilot Integration**: Implements Copilot language model and chat participant features
- **User Interface**: Handles context menus, quick picks, and status bar items
- **Bridge Lifecycle**: Manages start/stop/restart of the Dart bridge process

Key Functions:
```typescript
export function activate(context: vscode.ExtensionContext)
export function deactivate()
function registerCommands(context: vscode.ExtensionContext)
async function askCopilotForDocumentation(uri?: vscode.Uri)
async function analyzeWorkspaceWithCopilot()
```

#### vscode-bridge.ts

Bridge client implementation for communication with the Dart process.

**Class**: `DartBridgeClient`

Core responsibilities:
- **Process Management**: Spawns and manages the Dart child process
- **JSON-RPC Client**: Sends requests and handles responses
- **Message Routing**: Routes incoming messages to appropriate handlers
- **Error Handling**: Manages process errors and unexpected terminations
- **Logging**: Outputs debug information to VS Code output channel

Key Methods:
```typescript
async start(workspaceRoot: string): Promise<void>
stop(): void
async sendRequest(method: string, params: any): Promise<any>
private handleMessage(line: string): void
private handleNotification(notification: JsonRpcNotification): void
```

**Function**: `createVSCodeBridgeDefinition()`

Creates a bridge definition object that's passed to the Dart process, providing access to VS Code APIs.

---

### Bridge Server (Dart)

**Location**: `tom_vscode_bridge/lib/`

The Dart bridge server wraps VS Code APIs and provides D4rt script execution.

#### bridge_server.dart

**Class**: `VSCodeBridgeServer`

Core JSON-RPC server implementation.

Responsibilities:
- **JSON-RPC Server**: Listens on stdin for messages, responds via stdout
- **Request Routing**: Routes incoming requests to appropriate handlers
- **D4rt Integration**: Initializes D4rt interpreter for dynamic execution
- **API Wrapping**: Provides Dart-friendly wrappers for VS Code APIs
- **Bidirectional Communication**: Can send requests back to VS Code extension

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

#### vscode_api/ (API Wrappers)

Dart wrapper classes that provide type-safe access to VS Code APIs.

**vscode.dart** - Main API aggregator
```dart
class VSCode {
  final VSCodeWorkspace workspace;
  final VSCodeWindow window;
  final VSCodeCommands commands;
  final VSCodeExtensions extensions;
  final VSCodeLanguageModel lm;
  final VSCodeChat chat;
  
  Future<String> getVersion()
  Future<Map<String, dynamic>> getEnv()
  Future<bool> openExternal(String uri)
}
```

**vscode_window.dart** - Window/UI APIs
```dart
class VSCodeWindow {
  Future<void> showInformationMessage(String message, [List<String>? options])
  Future<void> showWarningMessage(String message, [List<String>? options])
  Future<void> showErrorMessage(String message, [List<String>? options])
  Future<String?> showQuickPick(List<String> items, [String? placeHolder])
  Future<String?> showInputBox({String? prompt, String? value})
  Future<void> showTextDocument(String uri, [String? viewColumn])
}
```

**vscode_workspace.dart** - Workspace APIs
```dart
class VSCodeWorkspace {
  Future<List<Map<String, dynamic>>> getWorkspaceFolders()
  Future<List<String>> findFiles(String include, [String? exclude])
  Future<String?> readFile(String uri)
  Future<void> writeFile(String uri, String content)
  Future<Map<String, dynamic>?> getConfiguration(String section)
}
```

**vscode_commands.dart** - Command execution
```dart
class VSCodeCommands {
  Future<dynamic> executeCommand(String command, [List<dynamic>? args])
  Future<List<String>> getCommands([bool filterInternal = true])
}
```

**vscode_lm.dart** - Language Model (Copilot) APIs
```dart
class VSCodeLanguageModel {
  Future<List<Map<String, dynamic>>> selectChatModels([Map<String, dynamic>? selector])
  Future<String> sendRequest(String modelId, List<Map<String, dynamic>> messages, 
                             [Map<String, dynamic>? options])
  Future<int> countTokens(String modelId, dynamic input)
}
```

**vscode_chat.dart** - Chat Participant APIs
```dart
class VSCodeChat {
  Future<void> registerChatParticipant(String id, ChatRequestHandler handler)
  Future<void> sendChatResponse(String requestId, String response)
  Future<void> reportChatProgress(String requestId, String progress)
}
```

**vscode_extensions.dart** - Extension APIs
```dart
class VSCodeExtensions {
  Future<List<Map<String, dynamic>>> getAllExtensions()
  Future<Map<String, dynamic>?> getExtension(String extensionId)
}
```

**vscode_types.dart** - Type definitions
```dart
class Uri { /* ... */ }
class Range { /* ... */ }
class Position { /* ... */ }
class Location { /* ... */ }
class DiagnosticSeverity { /* ... */ }
```

**d4rt_helpers.dart** - Helper functions for D4rt scripts
```dart
// 80+ utility functions for common VS Code operations
Future<void> log(String message)
Future<void> showInfo(String message)
Future<void> showWarning(String message)
Future<void> showError(String message)
Future<List<String>> getWorkspaceFolders()
Future<String?> getCurrentFile()
Future<void> openFile(String path)
// ... and many more
```

---

## Communication Protocol

### JSON-RPC 2.0

The bridge uses JSON-RPC 2.0 protocol over stdin/stdout pipes.

**Message Format**:
```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "method": "methodName",
  "params": { /* ... */ }
}
```

**Response Format**:
```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "result": { /* ... */ }
}
```

**Error Format**:
```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "error": {
    "code": -32600,
    "message": "Error description"
  }
}
```

**Notification Format** (no response expected):
```json
{
  "jsonrpc": "2.0",
  "method": "notificationName",
  "params": { /* ... */ }
}
```

### Message Flow

#### TypeScript → Dart (Request)

1. User triggers command in VS Code
2. Extension calls `bridgeClient.sendRequest(method, params)`
3. Client assigns unique ID and serializes to JSON
4. JSON sent to Dart process via stdin
5. Dart process receives and parses JSON
6. Dart routes to appropriate handler
7. Handler executes and returns result
8. Dart serializes result to JSON response
9. JSON sent back to extension via stdout
10. Client resolves promise with result

#### Dart → TypeScript (Request)

1. Dart code needs VS Code API access
2. Dart calls `bridge.sendRequest(method, params)`
3. Dart assigns unique ID and serializes to JSON
4. JSON sent to extension via stdout
5. Extension receives and parses JSON
6. Extension routes to VS Code API handler
7. Handler executes VS Code API call
8. Extension serializes result to JSON response
9. JSON sent back to Dart via stdin
10. Dart resolves future with result

### Request/Response Pattern

**Example: Show Information Message**

TypeScript → Dart:
```typescript
const result = await bridgeClient.sendRequest('window.showInformationMessage', {
  message: 'Hello from TypeScript!',
  options: ['OK', 'Cancel']
});
```

JSON sent to Dart:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "window.showInformationMessage",
  "params": {
    "message": "Hello from TypeScript!",
    "options": ["OK", "Cancel"]
  }
}
```

Dart processes and sends to VS Code:
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "executeScriptVce",
  "params": {
    "script": "return await context.vscode.window.showInformationMessage(params.message, ...params.options);",
    "params": {
      "message": "Hello from TypeScript!",
      "options": ["OK", "Cancel"]
    }
  }
}
```

VS Code executes and responds:
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": "OK"
}
```

Dart forwards to TypeScript:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "OK"
}
```

---

## Process Management

### Lifecycle

#### Startup Sequence

1. **Extension Activation**: VS Code activates extension on workspace open or command trigger
2. **Bridge Client Creation**: `DartBridgeClient` instance created in `activate()`
3. **Process Spawn**: User triggers command → `bridgeClient.start(workspaceRoot)`
4. **Dart Process Launch**: `spawn('dart', ['run', 'tom_vscode_bridge.dart'])`
5. **Stdio Setup**: stdin/stdout/stderr pipes configured
6. **Bridge Server Init**: Dart `VSCodeBridgeServer` starts, initializes D4rt
7. **Ready State**: Bridge sends log message, ready to handle requests

#### Normal Operation

- Extension and bridge exchange JSON-RPC messages
- Both sides maintain maps of pending requests (ID → Completer/Promise)
- Requests timeout after configured duration (default: 30s)
- Errors propagate back through JSON-RPC error responses

#### Shutdown Sequence

1. **Deactivation Trigger**: Extension deactivates or user stops bridge
2. **Stop Request**: `bridgeClient.stop()` called
3. **Process Kill**: `process.kill()` sent to Dart child process
4. **Cleanup**: All pending requests rejected with error
5. **Resource Release**: Output channel, event listeners cleaned up

### Error Handling

#### Process Crashes

```typescript
this.process.on('exit', (code) => {
  this.outputChannel.appendLine(`Dart process exited with code ${code}`);
  this.process = null;
  // Reject all pending requests
  for (const [id, { reject }] of this.pendingRequests) {
    reject(new Error('Bridge process terminated'));
  }
  this.pendingRequests.clear();
});
```

#### Communication Errors

- **Invalid JSON**: Logged and ignored, connection stays alive
- **Unknown Method**: Error response sent back to caller
- **Timeout**: Request rejected after timeout period
- **Pipe Errors**: Process terminates, all pending requests rejected

#### Graceful Degradation

- Extension continues to function even if bridge isn't running
- Commands that require bridge show user-friendly error messages
- User can manually restart bridge via `dartScript.startBridge` command

### Resource Cleanup

```typescript
export function deactivate() {
  if (bridgeClient) {
    bridgeClient.stop();
    bridgeClient = null;
  }
}
```

```dart
// Dart side cleanup
void dispose() {
  _outputController.close();
  _pendingRequests.clear();
}
```

---

## API Integration

### VS Code API Wrapping

The bridge wraps VS Code's TypeScript API into type-safe Dart classes.

**Wrapping Strategy**:

1. **Namespace Mapping**: VS Code namespaces → Dart classes
   - `vscode.window` → `VSCodeWindow`
   - `vscode.workspace` → `VSCodeWorkspace`
   - `vscode.commands` → `VSCodeCommands`

2. **Method Wrapping**: Each VS Code API method gets a Dart equivalent
   ```dart
   Future<void> showInformationMessage(String message, [List<String>? options]) async {
     await _bridge.sendRequest('executeScriptVce', {
       'script': 'return await context.vscode.window.showInformationMessage(params.message, ...(params.options || []));',
       'params': {'message': message, 'options': options},
     });
   }
   ```

3. **Type Conversion**: Complex types serialized to JSON
   - VS Code `Uri` → Dart `Map<String, dynamic>`
   - VS Code `Range` → Dart `Map<String, dynamic>`
   - Arrays/objects preserved through JSON serialization

### Bidirectional Communication

Both sides can initiate requests:

**TypeScript → Dart**:
- User commands
- Script execution requests
- API calls from TypeScript

**Dart → TypeScript**:
- VS Code API calls from Dart scripts
- D4rt scripts calling back to extension
- Event notifications

### Dynamic Script Execution

The `executeScriptVce` method allows arbitrary JavaScript execution in VS Code context:

```dart
Future<dynamic> executeScript(String script, Map<String, dynamic> params) async {
  return await _bridge.sendRequest('executeScriptVce', {
    'script': script,
    'params': params,
  });
}
```

**Context Object**:
```javascript
{
  vscode: vscode,          // VS Code API
  bridge: VSCodeBridge,    // Bridge definition
  params: { /* ... */ }    // Parameters passed from Dart
}
```

**Example**:
```dart
final result = await vscode.executeScript('''
  const editor = context.vscode.window.activeTextEditor;
  if (editor) {
    return {
      fileName: editor.document.fileName,
      lineCount: editor.document.lineCount,
      languageId: editor.document.languageId
    };
  }
  return null;
''', {});
```

---

## Copilot Integration

### Language Model API

The bridge provides full access to VS Code's Language Model API (Copilot).

**Capabilities**:
- Select and query available language models
- Send chat requests with conversation history
- Stream responses
- Count tokens
- Configure model parameters (temperature, max tokens, etc.)

**Example from Dart**:
```dart
final models = await vscode.lm.selectChatModels();
final copilot = models.firstWhere((m) => m['family'] == 'gpt-4');

final response = await vscode.lm.sendRequest(
  copilot['id'],
  [
    {'role': 'user', 'content': 'Explain async/await in Dart'}
  ],
  {'temperature': 0.7, 'maxTokens': 500}
);
```

### Chat Participant

Extensions can register chat participants that appear in Copilot chat.

**Registration**:
```dart
await vscode.chat.registerChatParticipant('tom-ai', (request) async {
  final prompt = request['prompt'];
  final command = request['command'];
  
  // Process request and generate response
  final response = await generateResponse(prompt);
  
  await vscode.chat.sendChatResponse(request['id'], response);
});
```

**Features**:
- Custom slash commands
- Progress reporting
- Streaming responses
- Variable references
- Tool invocation

### Workspace Analysis

Copilot can analyze workspace structure and content:

```dart
// Get workspace summary
final folders = await vscode.workspace.getWorkspaceFolders();
final files = await vscode.workspace.findFiles('**/*.dart');

// Build context for Copilot
final context = {
  'folders': folders.length,
  'dartFiles': files.length,
  'structure': await analyzeStructure()
};

// Ask Copilot for insights
final analysis = await vscode.lm.sendRequest(copilotModel, [
  {'role': 'system', 'content': 'You are a Dart code analyzer.'},
  {'role': 'user', 'content': 'Analyze this workspace: ${jsonEncode(context)}'}
]);
```

---

## D4rt Integration

### Dynamic Dart Execution

D4rt allows executing Dart code at runtime without compilation.

**Capabilities**:
- Full Dart language support
- Access to imported packages
- Type safety preserved
- Variable passing between host and script
- Exception handling

**Example**:
```dart
final result = await _interpreter.execute('''
  final message = params['message'];
  final count = params['count'];
  
  for (int i = 0; i < count; i++) {
    await log('$message $i');
  }
  
  return 'Logged $count messages';
''', params: {'message': 'Hello', 'count': 5});
```

### Sandboxing

D4rt provides configurable sandboxing for security:

**Levels**:
- **Full Access**: All dart: libraries available (io, isolate, mirrors)
- **Limited Access**: Only safe libraries (core, async, collection)
- **Custom**: Specific whitelist of allowed imports

**Configuration**:
```dart
_interpreter = D4rt(
  allowedImports: [
    'dart:core',
    'dart:async',
    'dart:collection',
    'package:tom_vscode_bridge/vscode_api/vscode.dart'
  ]
);
```

### VS Code API Access from D4rt

D4rt scripts have full access to wrapped VS Code APIs:

```dart
// Register VS Code bridges
registerVSCodeBridges(_interpreter);

// Now D4rt scripts can use:
await _interpreter.execute('''
  final vscode = VSCode(bridge);
  
  await vscode.window.showInformationMessage('From D4rt!');
  
  final folders = await vscode.workspace.getWorkspaceFolders();
  return folders.length;
''');
```

**Helper Functions**:

80+ helper functions available in D4rt scripts via `d4rt_helpers.dart`:

```dart
await log('Debug message');
await showInfo('Success!');
await showError('Something went wrong');
final currentFile = await getCurrentFile();
await openFile('/path/to/file.dart');
final folders = await getWorkspaceFolders();
```

---

## Security Model

### Process Isolation

- Bridge runs as **child process**, not in main extension process
- Crash in bridge doesn't crash VS Code
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
- Sensitive information filtered from logs

---

## Performance Considerations

### Message Overhead

- **JSON Serialization**: Small overhead for each message (~1ms)
- **Pipe I/O**: Very fast, minimal latency (~0.1ms)
- **Overall**: Typical request round-trip ~2-5ms

### Optimization Strategies

1. **Batching**: Group multiple API calls into single script execution
   ```dart
   final result = await executeScript('''
     const doc = await vscode.workspace.openTextDocument(params.uri);
     const text = doc.getText();
     const lineCount = doc.lineCount;
     return {text, lineCount};
   ''', {'uri': fileUri});
   ```

2. **Caching**: Cache frequently accessed data (workspace folders, configuration)
   ```dart
   List<Map<String, dynamic>>? _cachedFolders;
   
   Future<List<Map<String, dynamic>>> getWorkspaceFolders() async {
     _cachedFolders ??= await _fetchWorkspaceFolders();
     return _cachedFolders!;
   }
   ```

3. **Async Operations**: Use async/await to avoid blocking
   ```dart
   // Parallel execution
   final results = await Future.wait([
     vscode.workspace.findFiles('**/*.dart'),
     vscode.workspace.findFiles('**/*.yaml'),
     vscode.workspace.findFiles('**/*.md'),
   ]);
   ```

### Memory Management

- **Request Map Cleanup**: Completed requests removed from pending map
- **Stream Buffering**: Limited buffer size for stdout/stdin
- **D4rt Scope**: Variables cleaned up after script execution

---

## Extension Points

### Adding New VS Code APIs

1. Create new wrapper class in `vscode_api/`
2. Add to `VSCode` main class
3. Implement methods following existing pattern
4. Update documentation

Example:
```dart
// vscode_debug.dart
class VSCodeDebug {
  final VSCodeBridgeServer _bridge;
  
  VSCodeDebug(this._bridge);
  
  Future<void> startDebugging(String name, Map<String, dynamic> config) async {
    await _bridge.sendRequest('executeScriptVce', {
      'script': '''
        const folder = context.vscode.workspace.workspaceFolders[0];
        return await context.vscode.debug.startDebugging(folder, params.config);
      ''',
      'params': {'config': config},
    });
  }
}
```

### Adding Extension Commands

1. Register command in `extension.ts`
2. Implement handler function
3. Optionally call bridge if Dart processing needed
4. Update package.json contributes section

### Extending D4rt Helpers

1. Add function to `d4rt_helpers.dart`
2. Follow existing naming conventions
3. Document with dartdoc comments
4. Re-export from bridge registration

---

## Conclusion

The VS Code Bridge architecture provides a robust foundation for building VS Code extensions in Dart. The bidirectional communication model, combined with D4rt's dynamic execution capabilities and Copilot integration, enables powerful extension development while maintaining type safety and performance.

Key takeaways:
- **Child process model** provides isolation and reliability
- **JSON-RPC 2.0** enables clean bidirectional communication
- **Type-safe wrappers** make VS Code APIs accessible from Dart
- **D4rt integration** allows dynamic script execution
- **Copilot native** support for AI-powered features
- **Extensible design** makes adding new capabilities straightforward

For implementation details, see the respective project documentation:
- [tom_vscode_bridge Project Documentation](../tom_vscode_bridge/PROJECT.md)
- [tom_vscode_extension Project Documentation](./PROJECT.md)
