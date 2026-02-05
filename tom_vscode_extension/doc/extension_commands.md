# DartScript Extension Commands Reference

This document provides a detailed description of all VS Code commands provided by the DartScript extension.

---

## JSON-RPC Method Naming Convention

The bridge system uses suffixes to distinguish where commands are executed:

| Suffix | Meaning | Example |
|--------|---------|---------|
| `Vcb` | VS Code **Bridge** - D4rt execution in the Dart bridge | `executeScriptVcb`, `executeFileVcb` |
| `Vce` | VS Code **Extension** - JavaScript execution in VS Code | `executeScriptVce`, `showInfoVce` |

When calling from external tools (like the D4rt CLI via CLI Integration Server):
- **Vcb commands** are executed by the bridge's D4rt interpreter
- **Vce commands** are forwarded through the bridge to VS Code for JavaScript execution

---

## Command Summary

| Command | Title | Description |
|---------|-------|-------------|
| `dartscript.executeFile` | Execute in DartScript | Executes a Dart file that contains an `execute()` function |
| `dartscript.executeScript` | Execute as Script | Executes Dart code as an inline script via the D4rt interpreter |
| `dartscript.sendToChat` | Send to Copilot Chat | Sends selected text to GitHub Copilot Chat |
| `dartscript.restartBridge` | Restart/Start Dart Bridge | Starts or restarts the Dart bridge server |
| `dartscript.reloadWindow` | Reload Window | Reloads VS Code window after stopping the bridge cleanly |
| `dartscript.runTests` | Run Test Script on Bridge | Runs all D4rt tests from the test directory |
| `dartscript.printConfiguration` | Print Configuration | Prints D4rt interpreter configuration to output channel |
| `dartscript.showApiInfo` | Show VS Code API Info | Displays available language models, tools, and extensions |
| `dartscript.startTomAIChat` | Tom AI: Start Chat | Initializes a .chat.md file for Tom AI chat |
| `dartscript.sendToTomAIChat` | Tom AI: Send Chat Prompt | Sends the current prompt in a .chat.md file |

---

## Command Details

### dartscript.executeFile

**Title:** Execute in DartScript  
**Category:** DartScript  
**Keybinding:** None  
**Context Menu:** Explorer (on `.dart` files)

**Description:**

Executes a Dart file through the D4rt interpreter bridge. The file must contain an `execute()` function that will be called by the bridge.

**Workflow:**

1. Validates that a `.dart` file is selected (from URI or active editor)
2. Ensures the Dart bridge is running (starts it if needed)
3. Sends an `executeFileVcb` request to the bridge with:
   - `filePath`: Absolute path to the Dart file
   - `params.workspaceRoot`: Path to the workspace root
   - `params.executedBy`: `'vscode-context-menu'`
4. Displays the result in a new JSON document
5. Shows success/error notification

**Expected File Format:**

```dart
Future<Map<String, dynamic>> execute() async {
  // Your code here
  return {'status': 'ok', 'data': result};
}
```

**Result Handling:**

- **Success:** Opens a new JSON document with the result and shows a success notification
- **Failure:** Shows error message and opens a text document with error details and stack trace

---

### dartscript.executeScript

**Title:** Execute as Script in DartScript  
**Category:** DartScript  
**Keybinding:** None  
**Context Menu:** Explorer (on `.dart` files), Editor (on `.dart` files)

**Description:**

Executes Dart code as an inline script using the D4rt interpreter. Unlike `executeFile`, this command does not require an `execute()` function - the entire file (or selected text) is executed as a script.

**Workflow:**

1. Validates that a `.dart` file is selected
2. Determines script source:
   - If text is selected in the editor → uses selected text only
   - Otherwise → reads entire file content
3. Ensures the Dart bridge is running
4. Sends an `executeScriptVcb` request to the bridge with:
   - `script`: The Dart code to execute
   - `basePath`: Directory containing the file (for relative imports)
   - `params.workspaceRoot`: Path to the workspace root
   - `params.fileName`: Name of the source file
   - `params.executedBy`: `'vscode-context-menu'`
   - `params.scriptSource`: `'selection'` or `'file'`
5. Displays the result in a new JSON document

**Use Cases:**

- Running standalone Dart scripts without a `main()` or `execute()` function
- Quickly testing code snippets by selecting and executing them
- Running D4rt scripts that use `VSCodeBridgeServer.setResult()` to return values

---

### dartscript.sendToChat

**Title:** Send to Copilot Chat  
**Category:** DartScript  
**Keybinding:** None  
**Context Menu:** Editor (when text is selected)

**Description:**

Sends the currently selected text from the active editor to GitHub Copilot Chat.

**Workflow:**

1. Checks if there is an active text editor
2. Validates that text is selected
3. Extracts the selected text
4. Opens Copilot Chat with the selected text as the query

**Requirements:**

- Text must be selected in the active editor
- GitHub Copilot extension must be installed and active

---

### dartscript.restartBridge

**Title:** Restart/Start Dart Bridge  
**Category:** DartScript  
**Keybinding:** None

**Description:**

Starts the Dart bridge server or restarts it if already running. The bridge is required for executing Dart scripts through D4rt.

**Workflow:**

1. Validates workspace is open
2. Checks for `tom_vscode_bridge` directory in workspace
3. If bridge is already running:
   - Shows "Stopping existing Dart bridge..." message
   - Stops the current bridge process
4. Creates a new bridge client if needed
5. Starts the bridge with auto-restart capability
6. Shows success/error notification

**Bridge Location:**

The bridge server is expected at: `{workspaceRoot}/tom_vscode_bridge/`

**Auto-Restart:**

The bridge is started with auto-restart enabled, meaning it will automatically restart if the process exits unexpectedly.

---

### dartscript.reloadWindow

**Title:** Reload Window (with Bridge Notification)  
**Category:** DartScript  
**Keybinding:** `Cmd+Shift+R` (macOS) / `Ctrl+Shift+R` (Windows/Linux)

**Description:**

Reloads the VS Code window after properly shutting down the Dart bridge. This ensures a clean restart without orphaned bridge processes.

**Workflow:**

1. Logs "Reload initiated - notifying and stopping bridge..."
2. If bridge is running:
   - Sends a `notifyReload` request to the bridge (with 1 second timeout)
   - Logs success or failure of notification
   - Stops the bridge process
   - Logs "Bridge process stopped"
3. Executes `workbench.action.reloadWindow` to reload VS Code

**Why Use This Instead of Standard Reload:**

- Ensures the bridge process is properly terminated
- Allows the bridge to save any state before shutdown
- Prevents orphaned Dart processes
- After reload, the extension automatically restarts the bridge

**Post-Reload Behavior:**

After the window reloads, if a test reinstall marker exists (created by `reinstall_for_testing.sh`), the extension will:
1. Wait 5 seconds for full activation
2. Send `!!!Reload finished` to Copilot Chat
3. Delete the marker file

---

### dartscript.runTests

**Title:** Run Test Script on Bridge  
**Category:** DartScript  
**Keybinding:** None

**Description:**

Runs all D4rt test scripts from the `tom_vscode_bridge/test/` directory. This is the primary command for testing the bridge functionality.

**Workflow:**

1. Clears the `tom_vscode_bridge/test_results/` directory
2. Finds all `.dart` files in `tom_vscode_bridge/test/`
3. Sorts test files alphabetically (for ordered execution)
4. For each test file:
   - Reads the Dart script content
   - Sends `executeScriptVcb` request to the bridge
   - Records test result (pass/fail, duration, logs)
   - Saves result to `test_results/{testname}_results.json`
5. Prints test summary to output channel

**Test File Format:**

```dart
import 'package:tom_vscode_bridge/tom_vscode_bridge.dart';

Future<void> main() async {
  // Test code here
  await VsCodeHelper.showInfo('Testing...');
  
  // Return results
  VSCodeBridgeServer.setResult({
    'status': 'ok',
    'message': 'Test passed'
  });
}
```

**Result Files:**

Each test creates a JSON file in `test_results/`:

```json
{
  "testFile": "01_basic_test.dart",
  "testName": "01_basic_test",
  "passed": true,
  "duration": 150,
  "result": { "status": "ok" },
  "logs": ["[print] Test message"],
  "timestamp": "2026-01-07T10:30:00.000Z"
}
```

**Output:**

- Results are shown in the "Bridge Tests" output channel
- Summary includes total tests, passed, failed, and duration
- Failed tests are listed with their error messages

---

### dartscript.printConfiguration

**Title:** DartScript: Print Configuration  
**Category:** DartScript  
**Keybinding:** None

**Description:**

Prints the complete D4rt interpreter configuration to the "DartScript" output channel. This provides visibility into what classes, methods, and global variables are available to D4rt scripts.

**Workflow:**

1. Sends `printConfiguration` request to the Dart bridge
2. Bridge calls `_logInterpreterConfigurationDetailed()` on the D4rt interpreter
3. Detailed configuration is printed to the output channel
4. Shows success/failure notification

**Output Includes:**

- **Packages**: All import paths registered (e.g., `package:tom_core_kernel/tom_core_kernel.dart`)
- **Global Variables**: Variables accessible without imports (`vscode`, `window`, `workspace`, `commands`, `extensions`, `lm`, `chat`)
- **Global Getters**: Getter functions available globally
- **Per-Package Classes**: All bridged classes organized by package, including:
  - Class name and constructors
  - Instance methods and static methods
  - Getters and setters

**Use Cases:**

- **Debugging**: Check if a class or method is available when scripts fail with "undefined" errors
- **Discovery**: Explore available APIs for D4rt scripts
- **Verification**: Confirm bridge registration after code updates

**Example Output:**

```
[D4RT CONFIG] ═══════════════════════════════════════════════════════
[D4RT CONFIG] Detailed DartScript Configuration
[D4RT CONFIG] ═══════════════════════════════════════════════════════
[D4RT CONFIG] Packages: package:tom_core_kernel/tom_core_kernel.dart, ...
[D4RT CONFIG] Globals: chat, commands, extensions, lm, vscode, window, workspace
[D4RT CONFIG] 
[D4RT CONFIG] tom_core_kernel: AnalyzerOptions, ProjectInfo, ...
```

---

### dartscript.showApiInfo

**Title:** DartScript: Show VS Code API Info  
**Category:** DartScript  
**Keybinding:** None

**Description:**

Displays comprehensive information about VS Code's AI and Chat APIs in a dedicated output channel. This command is useful for understanding what language models, tools, and AI-related extensions are available in your VS Code instance.

**Workflow:**

1. Creates/shows a "VS Code API Info" output channel
2. Queries `vscode.lm.selectChatModels()` for all available language models
3. Reads `vscode.lm.tools` for all registered tools
4. Scans installed extensions for AI/Chat related ones
5. Checks MCP server configuration
6. Collects environment and workspace information

**Output Sections:**

- **Language Models**: All models from GitHub Copilot and other providers
  - Name, ID, Vendor, Family, Version
  - Max input tokens capacity
- **Registered Tools**: All tools available to AI chat (grouped by prefix)
  - Tool name and description
  - Tags and input schema
- **AI/Chat Extensions**: Installed extensions related to AI
  - Extension ID, version, active status
  - Chat participants and LM tools contributed
- **MCP Servers**: Model Context Protocol servers configured in settings
- **Environment**: VS Code version, UI kind, app name, shell
- **Workspace**: Folder paths, trust status, workspace file
- **Summary**: Quick counts of models, tools, and extensions

**Use Cases:**

- **Discovery**: Explore what language models are available for your subscription
- **Debugging**: Verify tools are properly registered by extensions
- **MCP Troubleshooting**: Check if MCP servers are configured
- **Documentation**: Capture current VS Code AI capabilities

**Example Output:**

```
═══════════════════════════════════════════════════════════════════════════════
                        VS Code API Information
═══════════════════════════════════════════════════════════════════════════════
Timestamp: 2025-01-31T12:30:00.000Z

┌─────────────────────────────────────────────────────────────────────────────┐
│                           LANGUAGE MODELS                                   │
└─────────────────────────────────────────────────────────────────────────────┘
  Found 3 language model(s):

  ┌── Model: GPT-4o
  │   ID:              copilot-gpt-4o
  │   Vendor:          copilot
  │   Family:          gpt-4o
  │   Version:         gpt-4o-2024-08-06
  │   Max Input Tokens: 128,000
  └──
...
```

---

### dartscript.startTomAIChat

**Title:** Tom AI: Start Chat  
**Category:** DartScript  
**Keybinding:** `Ctrl+Cmd+N`

**Description:**

Initializes the active `.chat.md` file with metadata and a `CHAT <chat-id>` header. Overwrites related response and summary files on start.

**Workflow:**

1. Validates active editor is a `.chat.md` file
2. Inserts metadata and `CHAT` header if missing
3. Overwrites `<chat-id>.responses.md` and `<chat-id>.response-summary.md`

---

### dartscript.sendToTomAIChat

**Title:** Tom AI: Send Chat Prompt  
**Category:** DartScript  
**Keybinding:** `Ctrl+Cmd+S`

**Description:**

Extracts the first prompt block under the `CHAT <chat-id>` header, sends it to the configured model, executes tool calls, and writes the final response to `<chat-id>.responses.md`.

**Workflow:**

1. Parses prompt block from `.chat.md`
2. Generates response summary (if responses file exists)
3. Sends prompt via LM API with tools enabled
4. Executes tool calls (logs to **Tom AI Chat Log**)
5. Writes response to `<chat-id>.responses.md` and logs to **Tom AI Chat Responses**

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `dartscript.contextApproach` | string | `"accumulation"` | Context persistence approach for AI operations |
| `dartscript.maxContextSize` | number | `50000` | Maximum context size in tokens |
| `dartscript.autoRunOnSave` | boolean | `false` | Automatically run scripts on save |
| `dartscript.copilotModel` | string | `"gpt-4o"` | Preferred Copilot model |
| `dartscript.tomAiChat.modelId` | string | `"gpt-5.2"` | Model ID for Tom AI chat |
| `dartscript.tomAiChat.tokenModelId` | string | `"gpt-4o"` | Model ID used for token count estimates |
| `dartscript.tomAiChat.responsesTokenLimit` | number | `50000` | Token limit for `<chat-id>.responses.md` |
| `dartscript.tomAiChat.responseSummaryTokenLimit` | number | `8000` | Token limit for `<chat-id>.response-summary.md` |

---

## Related Documentation

- [test_and_fix_workflow.md](../_copilot_guidelines/test_and_fix_workflow.md) - Development and testing workflow guide
- [D4rt Bridging Guide](../../_copilot_guidelines/d4rt/BRIDGING_GUIDE.md) - How to bridge Dart classes to D4rt
