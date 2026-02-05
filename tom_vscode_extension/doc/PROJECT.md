# Tom VS Code Integration System

The tom_vscode_extension is a VS Code extension that provides the TypeScript side of the bridge system, spawning and managing the Dart bridge process for Dart-based VS Code extension development.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Core Features](#core-features)
- [Extension Commands](#extension-commands)
- [Copilot Integration](#copilot-integration)
- [Bridge Communication](#bridge-communication)
- [Configuration](#configuration)
- [Best Practices](#best-practices)

---

## Overview

The Tom VS Code Integration System provides:

1. **Extension Host**: VS Code extension managing the Dart bridge as a child process
2. **Bridge Client**: JSON-RPC client for bidirectional communication with Dart
3. **Copilot Integration**: Full access to GitHub Copilot Language Model API
4. **Command System**: User commands for executing Dart scripts and analyzing workspaces

### Why Use This Extension?

- **Dart Extension Development**: Write VS Code extensions in Dart
- **Copilot Integration**: AI-powered documentation generation and analysis
- **Dynamic Execution**: Run Dart and JavaScript scripts dynamically
- **Workspace Analysis**: Analyze project structure with Copilot assistance
- **Context Menu Integration**: Execute Dart scripts directly from file explorer

---

## Quick Start

### 1. Installation

```bash
# Install from VSIX
code --install-extension tom-ai-build-vscode-0.1.0.vsix

# Or build from source
npm install
npm run compile
```

### 2. Configure Workspace

Ensure you have a workspace with `tom_vscode_bridge` project:

```
workspace/
├── tom_vscode_bridge/
│   ├── bin/
│   │   └── tom_vscode_bridge.dart
│   ├── lib/
│   └── pubspec.yaml
└── your_project/
```

### 3. Start Using

Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) and run:
- `DartScript: Hello World` - Test extension
- `DartScript: Analyze Workspace with Copilot` - AI-powered analysis
- `DartScript: Ask Copilot to Generate Docs` - Generate documentation

Right-click on `.dart` files:
- `Execute in DartScript` - Run Dart file via bridge
- `Execute as Script in DartScript` - Run as inline script

---

## Core Features

### Extension Lifecycle

The extension activates when:
- Workspace opens
- First command is executed
- Context menu action is triggered

```typescript
export function activate(context: vscode.ExtensionContext) {
    console.log('DartScript extension is now active!');
    
    // Initialize bridge client (not started yet)
    bridgeClient = new DartBridgeClient(context);
    
    // Register commands
    registerCommands(context);
}
```

### Bridge Management

```typescript
// Start bridge
await bridgeClient.start(workspaceRoot);

// Send request to Dart
const result = await bridgeClient.sendRequest('getWorkspaceInfo', {
    workspaceRoot: workspaceRoot
});

// Stop bridge
bridgeClient.stop();
```

### Script Execution

Execute JavaScript with VS Code API access:

```typescript
const result = await bridgeClient.sendRequest('executeScript', {
    script: `
        const files = await context.vscode.workspace.findFiles('**/*.ts');
        return { fileCount: files.length };
    `,
    params: {}
});
```

---

## Extension Commands

### DartScript: Hello World

Simple test command showing the extension is working.

```typescript
vscode.commands.registerCommand(
    'dartScript.helloWorld',
    () => {
        vscode.window.showInformationMessage('Hello from DartScript!');
    }
);
```

### DartScript: Analyze Workspace with Copilot

Analyzes workspace structure using GitHub Copilot.

**Process**:
1. Scans workspace directory structure
2. Sends structure to Copilot with analysis prompt
3. Receives AI-generated insights
4. Displays results in markdown document

**Example Output**:
```markdown
## Workspace Analysis

### Overview
This appears to be a multi-project Dart workspace with a bridge system for VS Code extension development...

### Project Structure
- tom_vscode_bridge: Dart bridge server
- tom_vscode_extension: TypeScript extension
...
```

### DartScript: Ask Copilot to Generate Docs

Generates documentation for Dart files using Copilot.

**Usage**:
1. Right-click on a `.dart` file
2. Select "DartScript: Ask Copilot to Generate Docs"
3. Wait for generation (shows progress)
4. Review generated markdown documentation

**Features**:
- Analyzes code structure
- Documents classes and functions
- Provides usage examples
- Lists dependencies
- Suggests improvements

### Execute in DartScript

Executes a Dart file via the bridge using the `executeFile` method.

**Requirements**:
- File must have an `execute()` function
- Function signature: `Future<Map<String, dynamic>> execute(Map<String, dynamic> params, dynamic context)`

**Example File**:
```dart
Future<Map<String, dynamic>> execute(
  Map<String, dynamic> params,
  dynamic context,
) async {
  final vscode = context['vscode'];
  
  await vscode.window.showInformationMessage('Hello from Dart file!');
  
  return {
    'success': true,
    'message': 'Execution complete'
  };
}
```

### Execute as Script in DartScript

Executes Dart file content as inline script using `executeScript`.

**Difference from executeFile**:
- `executeFile`: Runs as subprocess with `dart run`
- `executeScript`: Runs via D4rt interpreter (dynamic execution)

---
---

## Copilot Integration

### Language Model Selection

```typescript
async function getCopilotModel(): Promise<vscode.LanguageModelChat | undefined> {
    // Get configuration
    const config = vscode.workspace.getConfiguration('dartScript');
    const preferredModel = config.get<string>('copilotModel', 'gpt-4o');

    // Select model
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

    return models[0];
}
```

### Sending Requests

```typescript
async function sendCopilotRequest(
    model: vscode.LanguageModelChat,
    prompt: string,
    token: vscode.CancellationToken
): Promise<string> {
    const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
    ];

    const response = await model.sendRequest(messages, {}, token);

    let fullResponse = '';
    for await (const chunk of response.text) {
        if (token.isCancellationRequested) {
            throw new Error('Request cancelled');
        }
        fullResponse += chunk;
    }

    return fullResponse;
}
```

### Error Handling

```typescript
try {
    const result = await sendCopilotRequest(model, prompt, token);
} catch (error) {
    if (error instanceof vscode.LanguageModelError) {
        if (error.cause?.message.includes('off_topic')) {
            throw new Error('Request rejected as off-topic');
        }
        if (error.cause?.message.includes('quota')) {
            throw new Error('Copilot quota limit exceeded');
        }
    }
    throw error;
}
```

---

## Bridge Communication

### JSON-RPC Protocol

Communication uses JSON-RPC 2.0 over stdin/stdout pipes.

#### Sending Requests to Dart

```typescript
const result = await bridgeClient.sendRequest<WorkspaceInfo>(
    'getWorkspaceInfo',
    { workspaceRoot: '/path/to/workspace' }
);
```

#### Handling Dart Requests

```typescript
private async handleDartRequest(
    method: string,
    params: any,
    id?: number
): Promise<void> {
    let result: any;

    switch (method) {
        case 'showInfo':
            vscode.window.showInformationMessage(params.message);
            result = { success: true };
            break;

        case 'readFile':
            result = await this.readFile(params.path);
            break;

        // ... more handlers
    }

    if (id !== undefined) {
        this.sendResponse(id, result);
    }
}
```

### Available Methods

**TypeScript → Dart**:
- `getWorkspaceInfo`: Get workspace information
- `analyzeProject`: Analyze Dart project
- `executeFile`: Execute Dart file as subprocess
- `executeScript`: Execute Dart code via D4rt

**Dart → TypeScript**:
- `log`: Write to output channel
- `showInfo/showWarning/showError`: Show messages
- `askCopilot`: Query Copilot
- `readFile/writeFile`: File I/O
- `openFile`: Open file in editor
- `executeScript`: Execute JavaScript dynamically

---

## Configuration

### Settings

Configure in VS Code settings (`settings.json` or UI):

```json
{
  "dartScript.copilotModel": "gpt-4o",
  "dartScript.autoStart": false,
  "dartScript.maxContextSize": 100000
}
```

#### dartScript.copilotModel

Preferred Copilot model family.

- **Type**: `string`
- **Default**: `"gpt-4o"`
- **Options**: `"gpt-4o"`, `"gpt-4"`, `"gpt-3.5-turbo"`

#### dartScript.autoStart

Automatically start Dart bridge on extension activation.

- **Type**: `boolean`
- **Default**: `false`

#### dartScript.maxContextSize

Maximum context size for Copilot requests (in tokens).

- **Type**: `number`
- **Default**: `100000`

### Reading Configuration

```typescript
const config = vscode.workspace.getConfiguration('dartScript');
const model = config.get<string>('copilotModel', 'gpt-4o');
const autoStart = config.get<boolean>('autoStart', false);
```

---

## Best Practices

### 1. Check Bridge Status

```typescript
if (!bridgeClient || !bridgeClient.isRunning()) {
    await bridgeClient.start(workspaceRoot);
}
```

### 2. Use Progress Indicators

```typescript
await vscode.window.withProgress(
    {
        location: vscode.ProgressLocation.Notification,
        title: 'Processing...',
        cancellable: true
    },
    async (progress, token) => {
        progress.report({ message: 'Step 1...', increment: 33 });
        await step1();
        
        progress.report({ message: 'Step 2...', increment: 66 });
        await step2();
        
        progress.report({ message: 'Complete!', increment: 100 });
    }
);
```

### 3. Handle Cancellation

```typescript
async function longOperation(token: vscode.CancellationToken) {
    for (const item of items) {
        if (token.isCancellationRequested) {
            throw new Error('Operation cancelled');
        }
        await processItem(item);
    }
}
```

### 4. Clean Up Resources

```typescript
export function deactivate() {
    if (bridgeClient) {
        bridgeClient.stop();
        bridgeClient = null;
    }
    // Clean up other resources...
}
```

### 5. Use Output Channel for Logging

```typescript
const outputChannel = vscode.window.createOutputChannel('My Extension');
outputChannel.appendLine('[INFO] Starting operation...');
outputChannel.appendLine('[ERROR] Something went wrong');
outputChannel.show(); // Show channel to user
```

### 6. Show User-Friendly Errors

```typescript
try {
    await operation();
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Operation failed: ${errorMessage}`);
    console.error('Detailed error:', error);
}
```

### 7. Test in Extension Development Host

- Press `F5` to launch Extension Development Host
- Test all commands and features
- Check console and output channel for errors
- Use debugger for step-through debugging

---

## See Also

- [Architecture Documentation](./ARCHITECTURE.md) - System architecture
- [Implementation Guide](./IMPLEMENTATION.md) - Implementation details
- [VS Code Bridge Project](../tom_vscode_bridge/PROJECT.md) - Dart bridge side
- [API Reference](../tom_vscode_bridge/API_REFERENCE.md) - Dart API documentation
