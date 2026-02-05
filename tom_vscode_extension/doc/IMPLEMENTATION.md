# VS Code Integration Implementation Guide

Detailed implementation guide for the tom_vscode_extension TypeScript project - the VS Code extension that communicates with the Dart bridge.

---

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
  - [Extension Activation](#extension-activation)
  - [Bridge Client](#bridge-client)
  - [Command System](#command-system)
  - [Copilot Integration](#copilot-integration)
- [Communication Protocol](#communication-protocol)
- [Request Handling](#request-handling)
- [Script Execution](#script-execution)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [Testing](#testing)
- [Debugging](#debugging)
- [Extension Points](#extension-points)

---

## Overview

The tom_vscode_extension project is a VS Code extension that provides the TypeScript side of the bridge system. It spawns and manages the Dart bridge process, handles bidirectional JSON-RPC communication, and integrates with VS Code features like Copilot.

**Key Features**:
- Extension host managing Dart child process
- JSON-RPC 2.0 client communicating via stdin/stdout
- Copilot integration (Language Model API)
- Context menu commands for executing Dart scripts
- Workspace analysis and documentation generation
- Dynamic script execution (JavaScript and Dart)

**Technology Stack**:
- TypeScript 5.x
- VS Code Extension API 1.85+
- Node.js child processes
- JSON-RPC 2.0 protocol

---

## Project Structure

```
tom_vscode_extension/
├── src/
│   ├── extension.ts            # Extension entry point
│   ├── vscode-bridge.ts        # Bridge client implementation
│   ├── tests.ts                # Bridge test runner
│   └── handlers/               # Command handlers
├── out/                        # Compiled JavaScript
├── node_modules/               # Dependencies
├── package.json                # Package configuration
├── tsconfig.json               # TypeScript configuration
├── .eslintrc.json              # Linting rules
└── README.md                   # Project documentation
```

### Key Files

- **extension.ts**: Main extension logic, command registration, Copilot integration
- **vscode-bridge.ts**: Bridge client, process management, JSON-RPC communication
- **tests.ts**: BridgeTestRunner class for running D4rt test scripts
- **handlers/**: Modular command handler files
- **package.json**: Extension manifest, commands, configuration schema

---

## Core Components

### Extension Activation

**File**: `src/extension.ts`

#### Activation Function

```typescript
let bridgeClient: DartBridgeClient | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('DartScript extension is now active!');

    // Initialize bridge client
    bridgeClient = new DartBridgeClient(context);

    // Register all commands
    registerCommands(context);

    // Show activation message
    vscode.window.showInformationMessage('DartScript extension activated!');
}
```

**Process**:
1. Called automatically by VS Code on extension load
2. Create `DartBridgeClient` instance (not started yet)
3. Register all commands with VS Code
4. Show user notification

#### Deactivation

```typescript
export function deactivate() {
    console.log('DartScript extension deactivated');
    
    // Stop bridge client
    if (bridgeClient) {
        bridgeClient.stop();
        bridgeClient = null;
    }
}
```

**Purpose**: Clean up resources when extension is unloaded

---

### Bridge Client

**File**: `src/vscode-bridge.ts`

#### Class: DartBridgeClient

Main class responsible for managing the Dart process and JSON-RPC communication.

```typescript
export class DartBridgeClient {
    private process: ChildProcess | null = null;
    private messageId = 0;
    private pendingRequests = new Map<number, {
        resolve: (value: any) => void;
        reject: (reason: any) => void;
    }>();
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Dart Bridge');
    }
}
```

**State**:
- `process`: Child process handle (null when not running)
- `messageId`: Counter for generating unique request IDs
- `pendingRequests`: Map of in-flight requests awaiting responses
- `outputChannel`: VS Code output channel for logging

#### Starting the Bridge

```typescript
async start(workspaceRoot: string): Promise<void> {
    if (this.process) {
        this.outputChannel.appendLine('Bridge already running');
        return;
    }

    const dartScript = path.join(workspaceRoot, 'tom_vscode_bridge', 'bin', 'tom_vscode_bridge.dart');

    this.outputChannel.appendLine(`Starting Dart bridge: ${dartScript}`);

    // Spawn Dart process
    this.process = spawn('dart', ['run', dartScript], {
        cwd: workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    if (!this.process.stdout || !this.process.stdin || !this.process.stderr) {
        throw new Error('Failed to initialize process stdio');
    }

    // Handle stdout (JSON-RPC messages from Dart)
    let buffer = '';
    this.process.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                this.handleMessage(line.trim());
            }
        }
    });

    // Handle stderr (Dart errors)
    this.process.stderr.on('data', (data: Buffer) => {
        this.outputChannel.appendLine(`[Dart Error] ${data.toString()}`);
    });

    // Handle process exit
    this.process.on('exit', (code) => {
        this.outputChannel.appendLine(`Dart process exited with code ${code}`);
        this.process = null;
        // Reject all pending requests
        for (const [id, { reject }] of this.pendingRequests) {
            reject(new Error('Bridge process terminated'));
        }
        this.pendingRequests.clear();
    });

    // Wait a bit for process to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.outputChannel.appendLine('Dart bridge started');
}
```

**Process**:
1. Check if already running
2. Locate Dart script in workspace
3. Spawn `dart run` command as child process
4. Set up stdio pipes (stdin, stdout, stderr)
5. Set up stdout listener for JSON-RPC messages
6. Set up stderr listener for error logging
7. Set up exit handler to clean up pending requests
8. Wait for initialization

#### Sending Requests

```typescript
async sendRequest<T = any>(method: string, params: any = {}): Promise<T> {
    if (!this.process || !this.process.stdin) {
        throw new Error('Bridge not started');
    }

    const id = this.messageId++;
    const message: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
    };

    return new Promise((resolve, reject) => {
        this.pendingRequests.set(id, { resolve, reject });

        const json = JSON.stringify(message) + '\n';
        this.process!.stdin!.write(json);

        // Timeout after 30 seconds
        setTimeout(() => {
            if (this.pendingRequests.has(id)) {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }
        }, 30000);
    });
}
```

**Flow**:
1. Check process is running
2. Generate unique ID and create JSON-RPC message
3. Create Promise and store resolve/reject in pending map
4. Serialize and write to stdin
5. Set 30-second timeout
6. Return Promise (resolves when response received)

#### Handling Messages

```typescript
private handleMessage(line: string): void {
    try {
        const message = JSON.parse(line);

        // Check if it's a response to our request
        if (message.id !== undefined) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(message.error.message || 'Unknown error'));
                } else {
                    pending.resolve(message.result);
                }
            }
            return;
        }

        // Check if it's a request from Dart
        if (message.method) {
            this.handleDartRequest(message.method, message.params, message.id);
        }
    } catch (error) {
        this.outputChannel.appendLine(`Failed to parse message: ${error}`);
    }
}
```

**Logic**:
1. Parse JSON from line
2. If has `id`, it's a response → resolve/reject pending Promise
3. If has `method`, it's a request from Dart → handle it
4. If neither, log error

---

### Command System

Commands are registered in `extension.ts` and appear in the Command Palette and context menus.

#### Command Registration

```typescript
function registerCommands(context: vscode.ExtensionContext) {
    // Simple hello world command
    const helloWorldCmd = vscode.commands.registerCommand(
        'dartScript.helloWorld',
        () => {
            vscode.window.showInformationMessage('Hello from DartScript!');
        }
    );

    // Ask Copilot command
    const askCopilotCmd = vscode.commands.registerCommand(
        'dartScript.askCopilot',
        async (uri?: vscode.Uri) => {
            await askCopilotForDocumentation(uri);
        }
    );

    // Analyze workspace command
    const analyzeWorkspaceCmd = vscode.commands.registerCommand(
        'dartScript.analyzeWorkspace',
        async () => {
            await analyzeWorkspaceWithCopilot();
        }
    );

    // Add all commands to subscriptions
    context.subscriptions.push(
        helloWorldCmd,
        askCopilotCmd,
        analyzeWorkspaceCmd,
        // ... more commands
    );
}
```

**Pattern**:
1. Call `vscode.commands.registerCommand(id, handler)`
2. Handler is async function (if performs I/O)
3. Add disposable to `context.subscriptions` for cleanup

#### Context Menu Integration

Commands appear in context menus via `package.json`:

```json
{
  "contributes": {
    "menus": {
      "explorer/context": [
        {
          "command": "dartScript.executeInDartScript",
          "when": "resourceExtname == .dart",
          "group": "dartScript@1"
        }
      ]
    }
  }
}
```

**Properties**:
- `explorer/context`: Show in file explorer context menu
- `when`: Conditional visibility (e.g., only on `.dart` files)
- `group`: Menu group and sort order

---

### Copilot Integration

#### Getting Copilot Model

```typescript
async function getCopilotModel(): Promise<vscode.LanguageModelChat | undefined> {
    try {
        // Get configuration
        const config = vscode.workspace.getConfiguration('dartScript');
        const preferredModel = config.get<string>('copilotModel', 'gpt-4o');

        // Try to get the preferred model
        let models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: preferredModel
        });

        // Fallback to any Copilot model
        if (models.length === 0) {
            models = await vscode.lm.selectChatModels({
                vendor: 'copilot'
            });
        }

        if (models.length === 0) {
            vscode.window.showErrorMessage(
                'No Copilot models available. Please ensure GitHub Copilot is installed and activated.'
            );
            return undefined;
        }

        console.log(`Using Copilot model: ${models[0].name} (${models[0].vendor})`);
        return models[0];

    } catch (error) {
        console.error('Error getting Copilot model:', error);
        return undefined;
    }
}
```

**Process**:
1. Read preferred model from configuration
2. Try to select model by vendor + family
3. Fallback to any Copilot model
4. Show error if none available
5. Return selected model

#### Sending Copilot Requests

```typescript
async function sendCopilotRequest(
    model: vscode.LanguageModelChat,
    prompt: string,
    token: vscode.CancellationToken
): Promise<string> {
    try {
        // Create chat messages
        const messages = [
            vscode.LanguageModelChatMessage.User(prompt)
        ];

        // Send request
        const response = await model.sendRequest(messages, {}, token);

        // Collect response text
        let fullResponse = '';
        for await (const chunk of response.text) {
            if (token.isCancellationRequested) {
                throw new Error('Request cancelled');
            }
            fullResponse += chunk;
        }

        return fullResponse;

    } catch (error) {
        if (error instanceof vscode.LanguageModelError) {
            console.error('Copilot error:', error.message, error.code);
            
            // Handle specific error cases
            if (error.cause instanceof Error) {
                if (error.cause.message.includes('off_topic')) {
                    throw new Error('The request was rejected as off-topic');
                }
                if (error.cause.message.includes('consent')) {
                    throw new Error('User consent required for Copilot');
                }
                if (error.cause.message.includes('quota')) {
                    throw new Error('Copilot quota limit exceeded');
                }
            }
            
            throw new Error(`Copilot error: ${error.message}`);
        }
        throw error;
    }
}
```

**Flow**:
1. Create user message
2. Send request with cancellation token
3. Stream response chunks
4. Check for cancellation
5. Handle specific error types
6. Return full response text

#### Example: Ask Copilot for Documentation

```typescript
async function askCopilotForDocumentation(uri?: vscode.Uri): Promise<void> {
    try {
        // Get file path
        let filePath: string;
        if (uri) {
            filePath = uri.fsPath;
        } else {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }
            filePath = editor.document.uri.fsPath;
        }

        // Read file content
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);

        // Show progress
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Generating documentation with Copilot',
                cancellable: true
            },
            async (progress, token) => {
                progress.report({ message: 'Connecting to Copilot...', increment: 10 });

                // Get Copilot model
                const model = await getCopilotModel();
                if (!model) {
                    throw new Error('Copilot model not available');
                }

                progress.report({ message: 'Analyzing code...', increment: 30 });

                // Create prompt
                const prompt = createDocumentationPrompt(fileName, fileContent);

                progress.report({ message: 'Generating documentation...', increment: 50 });

                // Send request to Copilot
                const documentation = await sendCopilotRequest(model, prompt, token);

                progress.report({ message: 'Complete!', increment: 100 });

                // Show result in new document
                await showDocumentationResult(fileName, documentation);
            }
        );

    } catch (error) {
        handleError('Failed to generate documentation', error);
    }
}
```

---

## Communication Protocol

### JSON-RPC Messages

#### TypeScript → Dart (Request)

```typescript
const message = {
    jsonrpc: '2.0',
    id: 123,
    method: 'getWorkspaceInfo',
    params: { workspaceRoot: '/path' }
};

this.process.stdin.write(JSON.stringify(message) + '\n');
```

#### Dart → TypeScript (Response)

```typescript
{
    "jsonrpc": "2.0",
    "id": 123,
    "result": {
        "root": "/path",
        "projects": ["project1"],
        "projectCount": 1
    }
}
```

#### Dart → TypeScript (Request)

```typescript
{
    "jsonrpc": "2.0",
    "id": 456,
    "method": "showInfo",
    "params": { "message": "Hello from Dart!" }
}
```

#### TypeScript → Dart (Response)

```typescript
const response = {
    jsonrpc: '2.0',
    id: 456,
    result: { success: true }
};

this.process.stdin.write(JSON.stringify(response) + '\n');
```

---

## Request Handling

### Handling Dart Requests

```typescript
private async handleDartRequest(method: string, params: any, id?: number): Promise<void> {
    try {
        let result: any;

        switch (method) {
            case 'log':
                this.outputChannel.appendLine(`[Dart ${params.level}] ${params.message}`);
                return; // No response needed for logs

            case 'showInfo':
                vscode.window.showInformationMessage(params.message);
                result = { success: true };
                break;

            case 'askCopilot':
                result = await this.askCopilot(params.prompt);
                break;

            case 'readFile':
                result = await this.readFile(params.path);
                break;

            case 'writeFile':
                await this.writeFile(params.path, params.content);
                result = { success: true };
                break;

            case 'executeScript':
                result = await this.executeScript(params.script, params.params || {});
                break;

            default:
                throw new Error(`Unknown method: ${method}`);
        }

        if (id !== undefined) {
            this.sendResponse(id, result);
        }
    } catch (error: any) {
        if (id !== undefined) {
            this.sendErrorResponse(id, error.message);
        }
    }
}
```

**Handlers**:
- `log`: Write to output channel (notification, no response)
- `showInfo/showError/showWarning`: Show message to user
- `askCopilot`: Query Copilot model
- `readFile/writeFile`: File I/O
- `executeScript`: Execute JavaScript dynamically

---

## Script Execution

### Execute JavaScript File

```typescript
private async executeFile(filePath: string, params: any = {}): Promise<any> {
    this.outputChannel.appendLine(`Executing file: ${filePath}`);

    try {
        // Clear require cache to allow re-execution
        delete require.cache[require.resolve(filePath)];
        
        // Create execution context
        const context = {
            vscode: vscode,
            bridge: this,
            require: require,
            console: console
        };
        
        // Load the module
        const module = require(filePath);
        
        // The module should export a function
        const executeFunc = module.default || module.execute || module;
        
        if (typeof executeFunc !== 'function') {
            throw new Error('Module must export a function');
        }
        
        // Execute with params and context
        const result = await Promise.resolve(executeFunc(params, context));
        
        return {
            filePath,
            success: true,
            result: result
        };
    } catch (error: any) {
        return {
            filePath,
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
}
```

**Process**:
1. Clear require cache (allows re-execution)
2. Create context object with VS Code API
3. Load module with `require()`
4. Extract function (default, execute, or direct export)
5. Execute function with params and context
6. Return result or error

### Execute JavaScript Inline

```typescript
private async executeScript(script: string, params: any = {}): Promise<any> {
    this.outputChannel.appendLine(`Executing script (${script.length} chars)`);

    try {
        // Create execution context
        const context = {
            vscode: vscode,
            bridge: this,
            require: require,
            console: console
        };
        
        // Create async function with params and context
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('params', 'context', script);
        
        // Execute the script
        const result = await fn(params, context);

        return {
            success: true,
            result: result
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
}
```

**Pattern**:
1. Create context with VS Code API
2. Use AsyncFunction constructor to create function from string
3. Function signature: `async (params, context) => {}`
4. Execute and return result

**Example Script**:
```javascript
// Script passed as string
const files = await context.vscode.workspace.findFiles('**/*.ts');
return { fileCount: files.length };
```

---

## Error Handling

### Consistent Error Reporting

```typescript
function handleError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(message, error);
    vscode.window.showErrorMessage(`${message}: ${errorMessage}`);
}
```

### Error Types

1. **Process Errors**: Bridge process crashes
2. **Communication Errors**: Invalid JSON, timeouts
3. **API Errors**: VS Code API failures
4. **Copilot Errors**: Model unavailable, rate limits

### Graceful Degradation

```typescript
try {
    await bridgeClient.sendRequest('analyze', params);
} catch (error) {
    // Bridge not available - degrade gracefully
    vscode.window.showWarningMessage('Bridge not started. Starting now...');
    await bridgeClient.start(workspaceRoot);
    // Retry...
}
```

---

## Configuration

**File**: `package.json` → `contributes.configuration`

```json
{
  "contributes": {
    "configuration": {
      "title": "Tom AI Build",
      "properties": {
        "tomAiBuild.copilotModel": {
          "type": "string",
          "default": "gpt-4o",
          "description": "Preferred Copilot model family",
          "enum": ["gpt-4o", "gpt-4", "gpt-3.5-turbo"]
        },
        "tomAiBuild.autoStart": {
          "type": "boolean",
          "default": false,
          "description": "Automatically start Dart bridge on activation"
        }
      }
    }
  }
}
```

### Reading Configuration

```typescript
const config = vscode.workspace.getConfiguration('dartScript');
const model = config.get<string>('copilotModel', 'gpt-4o');
const autoStart = config.get<boolean>('autoStart', false);
```

---

## Testing

### Running D4rt Tests

**File**: `src/tests.ts`

The `BridgeTestRunner` class runs D4rt test scripts from `tom_vscode_bridge/test/`:

```typescript
// Run via Command Palette: "DartScript: Run Test Script on Bridge"
const runner = new BridgeTestRunner(context);
await runner.runAllTests();
```

**Process**:
1. Clears `test_results/` directory
2. Finds all `.dart` files in test directory
3. Executes each test via the bridge
4. Saves individual results to `test_results/{name}_results.json`
5. Displays summary in output channel

### Manual Testing

1. Press F5 to launch Extension Development Host
2. Execute commands from Command Palette
3. Check output channel for logs
4. Test context menu commands on Dart files

### Unit Testing

Create test file in `test/` folder:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { DartBridgeClient } from '../src/vscode-bridge';

suite('Bridge Client Tests', () => {
    test('Bridge initialization', () => {
        const context = {} as vscode.ExtensionContext;
        const client = new DartBridgeClient(context);
        assert.ok(client);
    });
});
```

---

## Debugging

### Enable Debug Output

```typescript
const DEBUG = true;

if (DEBUG) {
    console.log('[DEBUG]', message);
    this.outputChannel.appendLine(`[DEBUG] ${message}`);
}
```

### VS Code Output Channel

View logs:
1. View → Output
2. Select "Dart Bridge" from dropdown

### Debug Configuration

`.vscode/launch.json`:

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

## Extension Points

### Adding New Commands

1. Register in `extension.ts`:

```typescript
const newCmd = vscode.commands.registerCommand(
    'dartScript.newCommand',
    async () => {
        // Implementation
    }
);

context.subscriptions.push(newCmd);
```

2. Add to `package.json`:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "dartScript.newCommand",
        "title": "New Command",
        "category": "DartScript"
      }
    ]
  }
}
```

### Adding Bridge Handlers

In `handleDartRequest()`:

```typescript
case 'newHandler':
    result = await this.handleNewMethod(params);
    break;
```

---

## Best Practices

1. **Always check bridge status** before sending requests
2. **Use progress indicators** for long operations
3. **Handle cancellation** in Copilot requests
4. **Log important events** to output channel
5. **Show user-friendly error messages**
6. **Clean up resources** in deactivate()
7. **Test with Extension Development Host**
8. **Version your API** for compatibility

---

## See Also

- [Architecture Documentation](./ARCHITECTURE.md) - System architecture
- [API Reference](../tom_vscode_bridge/API_REFERENCE.md) - Dart API documentation
- [Bridge Implementation](../tom_vscode_bridge/IMPLEMENTATION.md) - Dart side implementation
- [Project Documentation](./PROJECT.md) - Project overview
