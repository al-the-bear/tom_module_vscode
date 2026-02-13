# VS Code Integration User Guide

Complete guide to writing JavaScript scripts that control VS Code, callable from Dart through the bridge system.

## Table of Contents

- [Overview](#overview)
- [Script Execution Methods](#script-execution-methods)
- [JavaScript Script Structure](#javascript-script-structure)
- [Available Context](#available-context)
- [Window Operations](#window-operations)
  - [Show Messages](#show-messages)
  - [User Input Dialogs](#user-input-dialogs)
  - [Quick Pick](#quick-pick)
  - [Progress Indicators](#progress-indicators)
- [Workspace Operations](#workspace-operations)
  - [Get Workspace Info](#get-workspace-info)
  - [Find Files](#find-files)
  - [Read and Write Files](#read-and-write-files)
  - [File System Operations](#file-system-operations)
- [Editor Operations](#editor-operations)
  - [Open and Show Documents](#open-and-show-documents)
  - [Get Active Editor](#get-active-editor)
  - [Edit Text](#edit-text)
  - [Selections and Ranges](#selections-and-ranges)
- [Terminal Operations](#terminal-operations)
  - [Create Terminals](#create-terminals)
  - [Send Commands](#send-commands)
  - [Execute Shell Commands](#execute-shell-commands)
- [Command Execution](#command-execution)
  - [Execute VS Code Commands](#execute-vs-code-commands)
  - [Get Command List](#get-command-list)
- [Testing Operations](#testing-operations)
  - [Run Tests](#run-tests)
  - [Test Controllers](#test-controllers)
- [Copilot Integration](#copilot-integration)
  - [Select Models](#select-models)
  - [Send Requests](#send-requests)
  - [Stream Responses](#stream-responses)
- [Chat Operations](#chat-operations)
  - [Chat Participants](#chat-participants)
  - [Handle Chat Requests](#handle-chat-requests)
- [Search Operations](#search-operations)
  - [Text Search](#text-search)
  - [Find and Replace](#find-and-replace)
- [Extension Operations](#extension-operations)
  - [Get Extensions](#get-extensions)
  - [Extension Activation](#extension-activation)
- [Calling from Dart](#calling-from-dart)
  - [Execute Script from Dart](#execute-script-from-dart)
  - [Pass Parameters](#pass-parameters)
  - [Return Results](#return-results)
- [Advanced Patterns](#advanced-patterns)
  - [Async Operations](#async-operations)
  - [Error Handling](#error-handling)
  - [Combining Dart and JavaScript](#combining-dart-and-javascript)

---

## Overview

JavaScript scripts can be executed through the bridge in two ways:

1. **Inline Scripts**: JavaScript code sent as a string from Dart
2. **Script Files**: JavaScript files executed via `executeScript` method

These scripts have full access to the VS Code API through the `context.vscode` object.

---

## Bridge Configuration

The Dart bridge process is configured via the `dartscriptBridge` section in `tom_vscode_extension.json`. This controls which Dart executable runs, with what arguments, and from which working directory.

### Configuration Schema

```json
{
  "dartscriptBridge": {
    "current": "<profile-key>",
    "profiles": {
      "<profile-key>": {
        "label": "Display Name",
        "command": "executable",
        "args": ["arg1", "arg2"],
        "cwd": "/path/to/working/directory",
        "runPubGet": false
      }
    }
  }
}
```

### Profile Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Human-readable name shown in the profile picker |
| `command` | string | Yes | Executable to run (e.g., `dart`, `tom_bs`, `d4rt`) |
| `args` | string[] | Yes | Command-line arguments passed to the executable |
| `cwd` | string | Yes | Working directory. Supports `${workspaceFolder}` placeholder |
| `runPubGet` | boolean | Yes | Whether to run `dart pub get` before starting the bridge |

### Root Fields

| Field | Type | Description |
|-------|------|-------------|
| `current` | string | Key of the active profile. Persisted when switching profiles |
| `profiles` | object | Map of profile keys to profile configurations |

### Example Configuration

```json
{
  "dartscriptBridge": {
    "current": "production",
    "profiles": {
      "development": {
        "label": "Development",
        "command": "dart",
        "args": ["run", "bin/tom_bs.dart"],
        "cwd": "${workspaceFolder}/xternal/tom_module_vscode/tom_vscode_bridge",
        "runPubGet": true
      },
      "production": {
        "label": "Production",
        "command": "tom_bs",
        "args": [],
        "cwd": "${workspaceFolder}",
        "runPubGet": false
      }
    }
  }
}
```

### Profile Management Commands

| Command | Description |
|---------|-------------|
| `DS: Restart/Start Dart Bridge` | Start or restart the bridge with the current profile |
| `DS: Switch Bridge Profile` | Quick-pick to select a different profile; persists and restarts |
| `DS: Toggle Bridge Debug Logging` | Enable/disable verbose bridge debug output |

### Profile Selection

When switching profiles:
1. All available profiles are shown in a quick-pick menu
2. The selected profile key is written back to `tom_vscode_extension.json` (`dartscriptBridge.current`)
3. The bridge process is automatically restarted with the new profile

---

## Script Execution Methods

### From Dart: Execute Inline Script

```dart
// In Dart
final result = await vscode.workspace.executeScript(
  script: '''
    const files = await context.vscode.workspace.findFiles('**/*.dart');
    return { fileCount: files.length };
  ''',
  params: {},
);
```

### From Dart: Execute Script File

```dart
// In Dart
final result = await vscode.workspace.executeFile(
  filePath: 'scripts/analyze.js',
  params: {'verbose': true},
);
```

### From TypeScript Extension

```typescript
// In extension.ts
const result = await bridgeClient.sendRequest('executeScriptVce', {
    script: `
        const vscode = context.vscode;
        const files = await vscode.workspace.findFiles('**/*.ts');
        return { count: files.length };
    `,
    params: {}
});
```

---

## JavaScript Script Structure

### Basic Script Template

```javascript
// Access VS Code API
const vscode = context.vscode;

// Your code here
const files = await vscode.workspace.findFiles('**/*.dart');

// Return result
return {
    success: true,
    fileCount: files.length
};
```

### Script with Parameters

```javascript
// Access parameters
const verbose = params.verbose || false;
const pattern = params.pattern || '**/*.dart';

const vscode = context.vscode;
const files = await vscode.workspace.findFiles(pattern);

if (verbose) {
    await vscode.window.showInformationMessage(
        `Found ${files.length} files`
    );
}

return {
    success: true,
    files: files.map(uri => uri.fsPath)
};
```

### Script with Error Handling

```javascript
const vscode = context.vscode;

try {
    const result = await performOperation();
    return { success: true, result };
} catch (error) {
    await vscode.window.showErrorMessage(`Error: ${error.message}`);
    return { success: false, error: error.message };
}
```

---

## Available Context

### Context Object Structure

```javascript
const vscode = context.vscode;  // VS Code API namespace
const params = params;           // Parameters passed from Dart
const workspaceRoot = context.workspaceRoot;  // Current workspace root
```

### Accessing Namespaces

```javascript
// Window operations
const window = vscode.window;

// Workspace operations
const workspace = vscode.workspace;

// Commands
const commands = vscode.commands;

// Extensions
const extensions = vscode.extensions;

// Language Model (Copilot)
const lm = vscode.lm;

// Chat
const chat = vscode.chat;
```

---

## Window Operations

### Show Messages

**Information Message:**

```javascript
const vscode = context.vscode;

await vscode.window.showInformationMessage('Operation completed!');

// With buttons
const choice = await vscode.window.showInformationMessage(
    'Do you want to continue?',
    'Yes',
    'No'
);

if (choice === 'Yes') {
    // User clicked Yes
}
```

**Warning Message:**

```javascript
await vscode.window.showWarningMessage('This action cannot be undone');
```

**Error Message:**

```javascript
await vscode.window.showErrorMessage('Failed to save file');
```

### User Input Dialogs

**Input Box:**

```javascript
const name = await vscode.window.showInputBox({
    prompt: 'Enter your name',
    placeHolder: 'John Doe',
    value: 'Default Name'
});

if (name) {
    await vscode.window.showInformationMessage(`Hello, ${name}!`);
}
```

**Input Box with Validation:**

```javascript
const port = await vscode.window.showInputBox({
    prompt: 'Enter port number',
    placeHolder: '8080',
    validateInput: (value) => {
        if (!value) return 'Port cannot be empty';
        const portNum = parseInt(value);
        if (isNaN(portNum)) return 'Must be a number';
        if (portNum < 1024 || portNum > 65535) {
            return 'Port must be between 1024 and 65535';
        }
        return null; // Valid
    }
});
```

### Quick Pick

**Simple Selection:**

```javascript
const choice = await vscode.window.showQuickPick(
    ['Option 1', 'Option 2', 'Option 3'],
    { placeHolder: 'Select an option' }
);

if (choice) {
    await vscode.window.showInformationMessage(`You selected: ${choice}`);
}
```

**Multi-Select:**

```javascript
const selected = await vscode.window.showQuickPick(
    ['Feature A', 'Feature B', 'Feature C'],
    {
        canPickMany: true,
        placeHolder: 'Select features to enable'
    }
);

if (selected && selected.length > 0) {
    await vscode.window.showInformationMessage(
        `Selected: ${selected.join(', ')}`
    );
}
```

**Quick Pick with Details:**

```javascript
const items = [
    {
        label: 'Development',
        description: 'Local development environment',
        detail: 'Uses localhost:3000'
    },
    {
        label: 'Production',
        description: 'Production environment',
        detail: 'Uses production.example.com'
    }
];

const choice = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select environment'
});

if (choice) {
    await vscode.window.showInformationMessage(`Selected: ${choice.label}`);
}
```

### Progress Indicators

**Simple Progress:**

```javascript
await vscode.window.withProgress(
    {
        location: vscode.ProgressLocation.Notification,
        title: 'Processing files...',
        cancellable: true
    },
    async (progress, token) => {
        progress.report({ message: 'Step 1 of 3', increment: 33 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        progress.report({ message: 'Step 2 of 3', increment: 66 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        progress.report({ message: 'Complete!', increment: 100 });
    }
);
```

**Progress with Cancellation Check:**

```javascript
await vscode.window.withProgress(
    {
        location: vscode.ProgressLocation.Notification,
        title: 'Long operation...',
        cancellable: true
    },
    async (progress, token) => {
        for (let i = 0; i < 10; i++) {
            if (token.isCancellationRequested) {
                await vscode.window.showWarningMessage('Operation cancelled');
                return;
            }
            
            progress.report({
                message: `Processing item ${i + 1}/10`,
                increment: (i + 1) * 10
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
);
```

---

## Workspace Operations

### Get Workspace Info

```javascript
const vscode = context.vscode;

// Get workspace folders
const folders = vscode.workspace.workspaceFolders;
if (folders && folders.length > 0) {
    const rootPath = folders[0].uri.fsPath;
    await vscode.window.showInformationMessage(`Workspace: ${rootPath}`);
}

// Get workspace name
const workspaceName = vscode.workspace.name;
```

### Find Files

**Find All Files:**

```javascript
const files = await vscode.workspace.findFiles('**/*.dart');
await vscode.window.showInformationMessage(`Found ${files.length} Dart files`);
```

**Find with Exclusions:**

```javascript
const files = await vscode.workspace.findFiles(
    '**/*.{dart,yaml}',
    '{**/node_modules,**/.dart_tool}'
);
```

**Find with Limits:**

```javascript
const files = await vscode.workspace.findFiles(
    '**/*.ts',
    null,
    100  // Max 100 results
);
```

### Read and Write Files

**Read File:**

```javascript
const uri = vscode.Uri.file('/path/to/file.dart');
const content = await vscode.workspace.fs.readFile(uri);
const text = new TextDecoder().decode(content);

const lines = text.split('\n');
await vscode.window.showInformationMessage(`File has ${lines.length} lines`);
```

**Write File:**

```javascript
const uri = vscode.Uri.file('/path/to/output.txt');
const content = new TextEncoder().encode('Generated content\nLine 2\nLine 3');
await vscode.workspace.fs.writeFile(uri, content);
```

**Read Text Document:**

```javascript
const doc = await vscode.workspace.openTextDocument('/path/to/file.dart');
const text = doc.getText();
const lineCount = doc.lineCount;
```

### File System Operations

**Create Directory:**

```javascript
const uri = vscode.Uri.file('/path/to/new/directory');
await vscode.workspace.fs.createDirectory(uri);
```

**Delete File:**

```javascript
const uri = vscode.Uri.file('/path/to/file.txt');
await vscode.workspace.fs.delete(uri);
```

**Copy File:**

```javascript
const source = vscode.Uri.file('/path/to/source.dart');
const target = vscode.Uri.file('/path/to/copy.dart');
await vscode.workspace.fs.copy(source, target);
```

**Check if File Exists:**

```javascript
const uri = vscode.Uri.file('/path/to/file.dart');
try {
    await vscode.workspace.fs.stat(uri);
    // File exists
    return { exists: true };
} catch (error) {
    // File doesn't exist
    return { exists: false };
}
```

---

## Editor Operations

### Open and Show Documents

**Open File:**

```javascript
const uri = vscode.Uri.file('/path/to/file.dart');
const doc = await vscode.workspace.openTextDocument(uri);
await vscode.window.showTextDocument(doc);
```

**Open at Specific Line:**

```javascript
const uri = vscode.Uri.file('/path/to/file.dart');
const doc = await vscode.workspace.openTextDocument(uri);

await vscode.window.showTextDocument(doc, {
    selection: new vscode.Range(
        new vscode.Position(10, 0),
        new vscode.Position(10, 0)
    )
});
```

**Open to Side:**

```javascript
await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.Beside
});
```

### Get Active Editor

```javascript
const editor = vscode.window.activeTextEditor;
if (editor) {
    const filePath = editor.document.uri.fsPath;
    const languageId = editor.document.languageId;
    const lineCount = editor.document.lineCount;
    
    await vscode.window.showInformationMessage(
        `Editing: ${filePath} (${languageId}, ${lineCount} lines)`
    );
}
```

### Edit Text

**Insert Text:**

```javascript
const editor = vscode.window.activeTextEditor;
if (editor) {
    await editor.edit(editBuilder => {
        editBuilder.insert(
            new vscode.Position(0, 0),
            '// Generated comment\n'
        );
    });
}
```

**Replace Text:**

```javascript
const editor = vscode.window.activeTextEditor;
if (editor) {
    await editor.edit(editBuilder => {
        const range = new vscode.Range(
            new vscode.Position(5, 0),
            new vscode.Position(5, 100)
        );
        editBuilder.replace(range, 'const apiUrl = "https://api.example.com";');
    });
}
```

**Delete Text:**

```javascript
const editor = vscode.window.activeTextEditor;
if (editor) {
    await editor.edit(editBuilder => {
        const range = new vscode.Range(
            new vscode.Position(10, 0),
            new vscode.Position(11, 0)
        );
        editBuilder.delete(range);
    });
}
```

### Selections and Ranges

**Get Current Selection:**

```javascript
const editor = vscode.window.activeTextEditor;
if (editor) {
    const selection = editor.selection;
    const text = editor.document.getText(selection);
    
    await vscode.window.showInformationMessage(`Selected: ${text}`);
}
```

**Set Selection:**

```javascript
const editor = vscode.window.activeTextEditor;
if (editor) {
    editor.selection = new vscode.Selection(
        new vscode.Position(5, 0),
        new vscode.Position(10, 0)
    );
}
```

---

## Terminal Operations

### Create Terminals

```javascript
const terminal = vscode.window.createTerminal({
    name: 'My Terminal',
    cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
});

terminal.show();
```

### Send Commands

```javascript
const terminal = vscode.window.createTerminal('Build');
terminal.show();
terminal.sendText('dart pub get');
terminal.sendText('dart analyze');
```

### Execute Shell Commands

**Using Child Process (if available):**

```javascript
// Note: Direct shell execution may require additional setup
// This is typically handled by the bridge on the Dart side

// Request shell execution through bridge
return {
    requestShellExecution: true,
    command: 'dart --version'
};
```

---

## Command Execution

### Execute VS Code Commands

**Built-in Commands:**

```javascript
const vscode = context.vscode;

// Save all files
await vscode.commands.executeCommand('workbench.action.files.saveAll');

// Format document
await vscode.commands.executeCommand('editor.action.formatDocument');

// Open settings
await vscode.commands.executeCommand('workbench.action.openSettings');
```

**Commands with Arguments:**

```javascript
// Open file
await vscode.commands.executeCommand(
    'vscode.open',
    vscode.Uri.file('/path/to/file.dart')
);

// Go to line
await vscode.commands.executeCommand('revealLine', {
    lineNumber: 42,
    at: 'center'
});
```

### Get Command List

```javascript
const commands = await vscode.commands.getCommands();
await vscode.window.showInformationMessage(`Available commands: ${commands.length}`);

// Filter commands
const dartCommands = commands.filter(cmd => cmd.includes('dart'));
```

---

## Testing Operations

### Run Tests

**Run All Tests:**

```javascript
await vscode.commands.executeCommand('testing.runAll');
```

**Run Current File Tests:**

```javascript
await vscode.commands.executeCommand('testing.runCurrentFile');
```

**Run Failed Tests:**

```javascript
await vscode.commands.executeCommand('testing.reRunFailTests');
```

### Test Controllers

**Access Test Controller:**

```javascript
// Note: Test controller access typically requires extension context
// This would be set up in the extension activation

const testController = vscode.tests.createTestController(
    'myTests',
    'My Test Suite'
);
```

---

## Copilot Integration

### Select Models

```javascript
const vscode = context.vscode;

// Get available Copilot models
const models = await vscode.lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4o'
});

if (models.length > 0) {
    await vscode.window.showInformationMessage(
        `Using model: ${models[0].id}`
    );
    return { model: models[0].id };
}
```

### Send Requests

```javascript
const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
if (models.length === 0) {
    return { error: 'Copilot not available' };
}

const model = models[0];

const messages = [
    vscode.LanguageModelChatMessage.User('Explain async/await in Dart')
];

const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

let fullResponse = '';
for await (const chunk of response.text) {
    fullResponse += chunk;
}

return { response: fullResponse };
```

### Stream Responses

```javascript
const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
const model = models[0];

const messages = [
    vscode.LanguageModelChatMessage.User('Write a Dart function to parse JSON')
];

const response = await model.sendRequest(messages);

// Collect chunks
const chunks = [];
for await (const chunk of response.text) {
    chunks.push(chunk);
    
    // Could report progress here
    if (chunks.length % 10 === 0) {
        await vscode.window.showInformationMessage(
            `Received ${chunks.length} chunks...`
        );
    }
}

const fullResponse = chunks.join('');
return { response: fullResponse, chunkCount: chunks.length };
```

---

## Chat Operations

### Chat Participants

**Register Chat Participant:**

```javascript
// Note: Chat participant registration happens in extension.ts
// This shows how to handle chat requests

async function handleChatRequest(request, context, stream, token) {
    const vscode = context.vscode;
    
    // Parse the user's request
    const prompt = request.prompt;
    
    // Get project info
    const files = await vscode.workspace.findFiles('**/*.dart');
    
    // Stream response
    stream.markdown(`Found ${files.length} Dart files in the workspace.\n\n`);
    
    if (prompt.includes('analyze')) {
        stream.markdown('Analyzing project structure...\n');
        // Perform analysis
    }
    
    return { metadata: { filesAnalyzed: files.length } };
}
```

### Handle Chat Requests

```javascript
// In a chat handler context
const vscode = context.vscode;
const prompt = params.prompt;

// Get context
const files = await vscode.workspace.findFiles('**/*.dart');
const activeEditor = vscode.window.activeTextEditor;

let response = `I found ${files.length} Dart files. `;

if (activeEditor) {
    const fileName = activeEditor.document.fileName;
    response += `You're currently editing ${fileName}. `;
}

// Ask Copilot for detailed response
const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
if (models.length > 0) {
    const messages = [
        vscode.LanguageModelChatMessage.User(
            `Context: ${response}\n\nUser asked: ${prompt}\n\nProvide a helpful response.`
        )
    ];
    
    const aiResponse = await models[0].sendRequest(messages);
    let fullResponse = '';
    for await (const chunk of aiResponse.text) {
        fullResponse += chunk;
    }
    
    response += fullResponse;
}

return { response };
```

---

## Search Operations

### Text Search

**Search in Files:**

```javascript
const vscode = context.vscode;

// Find all TODO comments
const todos = [];
const files = await vscode.workspace.findFiles('**/*.dart');

for (const fileUri of files) {
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const text = doc.getText();
    const lines = text.split('\n');
    
    lines.forEach((line, index) => {
        if (line.includes('// TODO')) {
            todos.push({
                file: fileUri.fsPath,
                line: index + 1,
                text: line.trim()
            });
        }
    });
}

await vscode.window.showInformationMessage(`Found ${todos.length} TODOs`);
return { todos };
```

**Regex Search:**

```javascript
const pattern = /class\s+(\w+)\s+extends/g;
const classes = [];

const files = await vscode.workspace.findFiles('lib/**/*.dart');
for (const fileUri of files) {
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const text = doc.getText();
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
        classes.push({
            name: match[1],
            file: fileUri.fsPath
        });
    }
}

return { classes };
```

### Find and Replace

**Replace in Active File:**

```javascript
const editor = vscode.window.activeTextEditor;
if (!editor) {
    return { error: 'No active editor' };
}

await editor.edit(editBuilder => {
    const text = editor.document.getText();
    const updated = text.replace(/oldFunction/g, 'newFunction');
    
    const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(text.length)
    );
    
    editBuilder.replace(fullRange, updated);
});

await editor.document.save();
return { success: true };
```

**Replace in Multiple Files:**

```javascript
const files = await vscode.workspace.findFiles('lib/**/*.dart');
let replacedCount = 0;

for (const fileUri of files) {
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const text = doc.getText();
    
    if (text.includes('oldFunction')) {
        const updated = text.replace(/oldFunction/g, 'newFunction');
        
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            fileUri,
            new vscode.Range(
                doc.positionAt(0),
                doc.positionAt(text.length)
            ),
            updated
        );
        
        await vscode.workspace.applyEdit(edit);
        await doc.save();
        replacedCount++;
    }
}

return { success: true, filesUpdated: replacedCount };
```

---

## Extension Operations

### Get Extensions

```javascript
const vscode = context.vscode;

const extensions = vscode.extensions.all;
await vscode.window.showInformationMessage(
    `Installed extensions: ${extensions.length}`
);

const extensionList = extensions.map(ext => ({
    id: ext.id,
    version: ext.packageJSON.version,
    isActive: ext.isActive
}));

return { extensions: extensionList };
```

### Extension Activation

```javascript
// Get specific extension
const dartExt = vscode.extensions.getExtension('Dart-Code.dart-code');

if (dartExt) {
    if (!dartExt.isActive) {
        await dartExt.activate();
    }
    
    // Access extension API
    const api = dartExt.exports;
    
    return { active: true, api: typeof api };
} else {
    return { error: 'Dart extension not installed' };
}
```

---

## Calling from Dart

### Execute Script from Dart

**Inline Script:**

```dart
// In Dart code
final result = await bridgeClient.sendRequest('executeScriptVce', {
  'script': '''
    const vscode = context.vscode;
    const files = await vscode.workspace.findFiles('**/*.dart');
    return { fileCount: files.length };
  ''',
  'params': {}
});

print('Found ${result['fileCount']} files');
```

**Script File:**

```dart
// In Dart code
final result = await bridgeClient.sendRequest('executeFile', {
  'filePath': 'scripts/analyze_project.js',
  'params': {'verbose': true, 'outputFile': 'analysis.md'}
});

if (result['success']) {
  print('Analysis complete: ${result['message']}');
}
```

### Pass Parameters

**From Dart:**

```dart
final result = await bridgeClient.sendRequest('executeScriptVce', {
  'script': '''
    const searchTerm = params.searchTerm;
    const caseSensitive = params.caseSensitive || false;
    
    const vscode = context.vscode;
    // Use parameters...
    
    return { results: [] };
  ''',
  'params': {
    'searchTerm': 'TODO',
    'caseSensitive': false
  }
});
```

**In JavaScript:**

```javascript
// Access parameters
const searchTerm = params.searchTerm;
const caseSensitive = params.caseSensitive || false;
const maxResults = params.maxResults || 100;

// Use parameters
const results = await performSearch(searchTerm, {
    caseSensitive,
    maxResults
});

return { results };
```

### Return Results

**Simple Return:**

```javascript
return {
    success: true,
    message: 'Operation completed',
    data: { count: 42 }
};
```

**Complex Return:**

```javascript
const files = await vscode.workspace.findFiles('**/*.dart');

const analysis = {
    totalFiles: files.length,
    files: files.map(uri => ({
        path: uri.fsPath,
        name: uri.fsPath.split('/').pop()
    })),
    timestamp: new Date().toISOString()
};

return {
    success: true,
    analysis
};
```

---

## Advanced Patterns

### Async Operations

**Sequential:**

```javascript
const vscode = context.vscode;

// Step 1
await vscode.window.showInformationMessage('Step 1: Analyzing...');
const files = await vscode.workspace.findFiles('**/*.dart');

// Step 2
await vscode.window.showInformationMessage('Step 2: Reading files...');
const contents = [];
for (const fileUri of files) {
    const doc = await vscode.workspace.openTextDocument(fileUri);
    contents.push(doc.getText());
}

// Step 3
await vscode.window.showInformationMessage('Step 3: Processing...');
// Process contents...

return { success: true, filesProcessed: files.length };
```

**Parallel:**

```javascript
// Run multiple operations concurrently
const [dartFiles, yamlFiles, folders] = await Promise.all([
    vscode.workspace.findFiles('**/*.dart'),
    vscode.workspace.findFiles('**/*.yaml'),
    Promise.resolve(vscode.workspace.workspaceFolders)
]);

return {
    dartFiles: dartFiles.length,
    yamlFiles: yamlFiles.length,
    workspaces: folders.length
};
```

### Error Handling

**Try-Catch:**

```javascript
const vscode = context.vscode;

try {
    const uri = vscode.Uri.file(params.filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const text = doc.getText();
    
    return { success: true, content: text };
} catch (error) {
    await vscode.window.showErrorMessage(`Failed to read file: ${error.message}`);
    return { success: false, error: error.message };
}
```

**Graceful Degradation:**

```javascript
const vscode = context.vscode;

// Try Copilot, fall back to simple analysis
let analysis;

try {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (models.length > 0) {
        const response = await models[0].sendRequest([
            vscode.LanguageModelChatMessage.User('Analyze this project')
        ]);
        
        analysis = '';
        for await (const chunk of response.text) {
            analysis += chunk;
        }
    }
} catch (error) {
    // Copilot not available, do basic analysis
    const files = await vscode.workspace.findFiles('**/*.dart');
    analysis = `Project has ${files.length} Dart files`;
}

return { analysis };
```

### Combining Dart and JavaScript

**Dart Script Calling JavaScript:**

```dart
// In Dart script
import 'package:tom_vscode_bridge/d4rt_helpers.dart';

Future<Map<String, dynamic>> execute(
  Map<String, dynamic> params,
  dynamic context,
) async {
  await initializeVSCode(context);
  
  // First, analyze with Dart
  final dartFiles = await findFiles('**/*.dart');
  await showInfo('Found ${dartFiles.length} Dart files');
  
  // Then, use JavaScript for complex VS Code operations
  final vscode = context['vscode'];
  final jsResult = await vscode.workspace.executeScript(
    script: '''
      const vscode = context.vscode;
      
      // Do something complex that's easier in JavaScript
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selections = editor.selections;
        return { hasSelections: selections.length > 0 };
      }
      return { hasSelections: false };
    ''',
    params: {},
  );
  
  return {
    'success': true,
    'dartFiles': dartFiles.length,
    'jsResult': jsResult,
  };
}
```

---

## Complete Example Scripts

### Project Analyzer (JavaScript)

```javascript
const vscode = context.vscode;

// Collect project information
const dartFiles = await vscode.workspace.findFiles('**/*.dart');
const testFiles = await vscode.workspace.findFiles('test/**/*_test.dart');

let totalLines = 0;
for (const fileUri of dartFiles) {
    const doc = await vscode.workspace.openTextDocument(fileUri);
    totalLines += doc.lineCount;
}

// Get Copilot insights
let insights = 'Copilot not available';
try {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (models.length > 0) {
        const prompt = `Project statistics:
- ${dartFiles.length} Dart files
- ${testFiles.length} test files  
- ${totalLines} total lines of code

Provide 3 recommendations for improving this project.`;

        const response = await models[0].sendRequest([
            vscode.LanguageModelChatMessage.User(prompt)
        ]);
        
        insights = '';
        for await (const chunk of response.text) {
            insights += chunk;
        }
    }
} catch (error) {
    insights = `Error getting Copilot insights: ${error.message}`;
}

// Create report
const report = `# Project Analysis

## Statistics
- Dart files: ${dartFiles.length}
- Test files: ${testFiles.length}
- Total lines: ${totalLines}
- Test coverage: ${(testFiles.length / dartFiles.length * 100).toFixed(1)}%

## AI Insights
${insights}
`;

// Write and open report
const reportUri = vscode.Uri.file(
    vscode.workspace.workspaceFolders[0].uri.fsPath + '/analysis/report.md'
);

await vscode.workspace.fs.writeFile(
    reportUri,
    new TextEncoder().encode(report)
);

await vscode.window.showTextDocument(reportUri);

return {
    success: true,
    files: dartFiles.length,
    tests: testFiles.length,
    lines: totalLines
};
```

### Documentation Generator (JavaScript)

```javascript
const vscode = context.vscode;
const filePath = params.file;

// Read file
const uri = vscode.Uri.file(filePath);
const doc = await vscode.workspace.openTextDocument(uri);
const content = doc.getText();

// Generate documentation with Copilot
const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
if (models.length === 0) {
    return { error: 'Copilot not available' };
}

const prompt = `Generate comprehensive documentation for this Dart file:

\`\`\`dart
${content}
\`\`\`

Include:
1. Overview
2. Classes and methods
3. Usage examples
4. Dependencies
`;

await vscode.window.showInformationMessage('Generating documentation with Copilot...');

const response = await models[0].sendRequest([
    vscode.LanguageModelChatMessage.User(prompt)
]);

let docs = '';
for await (const chunk of response.text) {
    docs += chunk;
}

// Save documentation
const docPath = filePath.replace('.dart', '_docs.md');
const docUri = vscode.Uri.file(docPath);

await vscode.workspace.fs.writeFile(
    docUri,
    new TextEncoder().encode(docs)
);

await vscode.window.showTextDocument(docUri);

return {
    success: true,
    docFile: docPath
};
```

---

## See Also

- [Architecture Documentation](../doc/ARCHITECTURE.md) - System architecture
- [Implementation Guide](../doc/IMPLEMENTATION.md) - Implementation details
- [Project Overview](../doc/PROJECT.md) - Extension features and setup
- [Dart User Guide](../../tom_vscode_bridge/USER_GUIDE.md) - Dart side documentation
