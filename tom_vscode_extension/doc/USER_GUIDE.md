# DartScript Extension User Guide

Complete guide to using the DartScript VS Code extension for enhanced Dart/Flutter development with Copilot Chat integration.

## Table of Contents

- [DartScript Extension User Guide](#dartscript-extension-user-guide)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
    - [Installation](#installation)
    - [Verifying Installation](#verifying-installation)
  - [Copilot Chat Integration](#copilot-chat-integration)
    - [Quick Send to Chat](#quick-send-to-chat)
    - [Standard Send](#standard-send)
    - [Template-Based Prompts](#template-based-prompts)
    - [Built-in Template Commands](#built-in-template-commands)
    - [Custom Prompt Templates](#custom-prompt-templates)
      - [Template File Structure](#template-file-structure)
      - [Template Variables](#template-variables)
      - [Template Properties](#template-properties)
      - [Auto-Reload](#auto-reload)
    - [Chat Answer Values](#chat-answer-values)
  - [Prompt Expander (Ollama)](#prompt-expander-ollama)
    - [Prerequisites](#prerequisites)
    - [Basic Usage](#basic-usage)
    - [Configuration](#configuration)
      - [Configuration Properties](#configuration-properties)
      - [Profiles](#profiles)
      - [Available Placeholders](#available-placeholders)
      - [VS Code Settings Fallback](#vs-code-settings-fallback)
  - [Dart Script Execution](#dart-script-execution)
    - [Execute File](#execute-file)
    - [Execute as Script](#execute-as-script)
    - [Script Execution Context](#script-execution-context)
    - [Advanced Bridge Scripting](#advanced-bridge-scripting)
  - [Tom CLI Integration](#tom-cli-integration)
    - [Starting the Server](#starting-the-server)
    - [How It Works](#how-it-works)
    - [Use Cases](#use-cases)
    - [Server Status](#server-status)
  - [Process Monitor](#process-monitor)
    - [Features](#features)
    - [How to Use](#how-to-use)
    - [Configuration](#configuration)
  - [Utility Features](#utility-features)
    - [Quick Window Reload](#quick-window-reload)
    - [Debug Logging](#debug-logging)
    - [Extension Help](#extension-help)
    - [Restart Bridge](#restart-bridge)
    - [Run Tests](#run-tests)
  - [Configuration Reference](#configuration-reference)
    - [Context Settings](#context-settings)
    - [Copilot Settings](#copilot-settings)
    - [Send to Chat Settings](#send-to-chat-settings)
    - [Example settings.json](#example-settingsjson)
  - [Troubleshooting](#troubleshooting)
    - [Commands Not Appearing](#commands-not-appearing)
    - [Bridge Not Responding](#bridge-not-responding)
    - [Templates Not Loading](#templates-not-loading)
    - [Send to Chat Not Working](#send-to-chat-not-working)
    - [CLI Server Connection Issues](#cli-server-connection-issues)
  - [Additional Resources](#additional-resources)
  - [Keyboard Shortcuts Summary](#keyboard-shortcuts-summary)
  - [Context Menu Summary](#context-menu-summary)
    - [File Explorer (on .dart files)](#file-explorer-on-dart-files)
    - [Editor Context Menu](#editor-context-menu)

---

## Getting Started

### Installation

1. Build the extension:
   ```bash
   cd xternal/tom_module_vscode/tom_vscode_extension
   npm install
   npm run compile
   ```

2. Install for testing:
   ```bash
   bash reinstall_for_testing.sh
   ```

3. Reload VS Code window (`Cmd+Shift+R` or use **DS: Reload Window** command)

### Verifying Installation

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "DS:" - you should see all DartScript commands
3. Run **DS: Show Extension Help** to view documentation

---

## Copilot Chat Integration

The extension provides powerful integration with GitHub Copilot Chat, allowing you to send text with customizable prompt templates.

### Quick Send to Chat

**Command:** `DS: Send to Copilot Chat`

The simplest way to send selected text to Copilot:

1. Select text in the editor
2. Right-click and choose **DS: Send to Copilot Chat**
3. Or use Command Palette: **DS: Send to Copilot Chat**

The selected text is sent directly to Copilot Chat.

### Standard Send

**Command:** `DS: Send to Copilot Chat (Standard)`

Sends the current file or selection with standard formatting:

1. Right-click in editor
2. Choose **DS: Send to Copilot Chat (Standard)**

This command works even without a selection - it will include context about the current file.

### Template-Based Prompts

**Command:** `DS: Send to Copilot Chat (Template)...`

Opens a quick pick menu to choose from configured prompt templates:

1. Open Command Palette or right-click in editor
2. Choose **DS: Send to Copilot Chat (Template)...**
3. Select a template from the list
4. Your text is wrapped in the template and sent to Copilot

### Built-in Template Commands

Access these from the **DartScript: Send to Chat...** submenu (right-click in editor):

| Template | Description |
|----------|-------------|
| **Send with Trail Reminder** | Includes reminder about chat trail workflow |
| **TODO Execution** | Formats selection as TODO items to execute |
| **Code Review** | Requests a code review of the selection |
| **Explain Code** | Asks for explanation of the code |
| **Add to Todo** | Adds selection to todo list |
| **Fix Markdown here** | Requests markdown formatting fixes |

### Custom Prompt Templates

Create your own templates by creating a `send_to_chat.json` file:

**Default location:** `${workspaceFolder}/_ai/send_to_chat/send_to_chat.json`

#### Template File Structure

```json
{
  "templates": [
    {
      "id": "review",
      "name": "Code Review",
      "prompt": "Please review this code for bugs, performance, and best practices:\n\n${selection}",
      "showInSubmenu": true
    },
    {
      "id": "document",
      "name": "Generate Documentation",
      "prompt": "Generate comprehensive documentation for this code:\n\nFile: ${file}\n\n${selection}",
      "showInSubmenu": false
    },
    {
      "id": "refactor",
      "name": "Suggest Refactoring",
      "prompt": "Suggest refactoring improvements for this ${filename}:\n\n${selection}"
    }
  ]
}
```

#### Template Variables

| Variable | Description |
|----------|-------------|
| `${selection}` | Currently selected text (or entire file if no selection) |
| `${file}` | Full path to the current file |
| `${filename}` | Just the filename (without path) |

#### Template Properties

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Unique identifier for the template |
| `name` | Yes | Display name shown in quick pick |
| `prompt` | Yes | The prompt template with variable placeholders |
| `showInSubmenu` | No | Whether to show in the context menu submenu |

#### Auto-Reload

The extension watches your `send_to_chat.json` file and automatically reloads when you save changes. You can also manually reload using **DS: Reload Chat Config**.

### Chat Answer Values

The extension can capture and display values from Copilot Chat responses.

**Commands:**
- **DS: Show chat answer values** - Display captured values
- **DS: Clear chat answer values** - Clear all captured values

This is useful for:
- Tracking responses across multiple prompts
- Extracting specific values from chat conversations
- Building workflows that depend on chat output

---

## Prompt Expander (Ollama)

Use a local Ollama model to expand terse, shorthand prompts into detailed, well-structured prompts before sending them to Copilot Chat. This runs entirely on your machine — no cloud API calls.

### Prerequisites

1. **Install Ollama:** `brew install ollama`
2. **Start the service:** `brew services start ollama`
3. **Pull a model:** `ollama pull qwen3:8b` (or any model you prefer)

### Basic Usage

1. Write a short prompt in the editor (e.g., `add error handling to the save function`)
2. Select the text (or leave nothing selected to use the full document)
3. Press **Ctrl+Cmd+E** (or run **DS: Expand Prompt (Ollama)** from Command Palette)
4. If multiple profiles are configured, choose one from the quick pick
5. The selected text is replaced in-place with the expanded version

### Configuration

All settings live in the `promptExpander` section of your `send_to_chat.json` config file:

**Default location:** `${workspaceFolder}/_ai/send_to_chat/send_to_chat.json`

```json
{
  "promptExpander": {
    "ollamaUrl": "http://localhost:11434",
    "model": "qwen3:8b",
    "temperature": 0.4,
    "stripThinkingTags": true,
    "defaultProfile": "expand",
    "systemPrompt": "You are a prompt expansion assistant...",
    "resultTemplate": "${response}",
    "profiles": { ... }
  }
}
```

#### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `ollamaUrl` | string | `http://localhost:11434` | Ollama server URL |
| `model` | string | `qwen3:8b` | Model name to use |
| `temperature` | number | `0.4` | LLM temperature (0.0–2.0). Lower = more deterministic |
| `stripThinkingTags` | boolean | `true` | Strip `<think>...</think>` tags from Qwen 3 output |
| `defaultProfile` | string | `expand` | Profile to use when only one exists |
| `systemPrompt` | string | *(see below)* | Default system prompt sent to the LLM |
| `resultTemplate` | string | `${response}` | Template for the text that replaces the selection |
| `profiles` | object | `{}` | Named expansion profiles (see below) |

#### Profiles

Profiles let you define different expansion behaviors. Each profile can override `systemPrompt`, `resultTemplate`, and `temperature`. Values set to `null` inherit from the top-level config.

```json
"profiles": {
  "expand": {
    "label": "Expand Prompt",
    "systemPrompt": null,
    "resultTemplate": null,
    "temperature": null
  },
  "rewrite": {
    "label": "Rewrite for Clarity",
    "systemPrompt": "You are a technical writing assistant. Rewrite the following prompt...",
    "resultTemplate": null,
    "temperature": 0.3
  },
  "annotated": {
    "label": "Expand with Original",
    "systemPrompt": null,
    "resultTemplate": "<!-- Original prompt:\n${original}\n-->\n\n${response}",
    "temperature": null
  }
}
```

When multiple profiles exist, pressing **Ctrl+Cmd+E** shows a quick pick to choose one. If only one profile is defined (or none), it runs immediately.

#### Available Placeholders

Placeholders can be used in both `systemPrompt` and `resultTemplate`:

| Placeholder | Description |
|-------------|-------------|
| `${original}` | The original text before expansion |
| `${response}` | The raw LLM response (after thinking-tag stripping) |
| `${filename}` | Basename of the active file (e.g., `main.dart`) |
| `${filePath}` | Full path to the active file |
| `${languageId}` | VS Code language identifier (e.g., `dart`, `typescript`) |
| `${workspaceName}` | Name of the first workspace folder |
| `${datetime}` | Current date/time as `yyyymmdd_hhmmss` |
| `${model}` | The Ollama model used |
| `${profile}` | The profile name used |
| `${lineStart}` | Start line of the selection (1-based) |
| `${lineEnd}` | End line of the selection (1-based) |

**Note:** In `systemPrompt`, `${response}` is empty (it hasn't been generated yet). Use the other placeholders to give the LLM file/language context. In `resultTemplate`, all placeholders are available.

#### VS Code Settings Fallback

The `dartscript.ollama.url` and `dartscript.ollama.model` VS Code settings serve as fallbacks when `ollamaUrl`/`model` are not specified in the JSON config. The JSON config takes precedence.

---

## Dart Script Execution

Execute Dart files directly from VS Code without setting up a full project.

### Execute File

**Command:** `DS: Execute File`

Executes a Dart file that contains an `execute()` function:

1. Right-click a `.dart` file in Explorer
2. Choose **DS: Execute File**

**Required file format:**

```dart
Future<Map<String, dynamic>> execute() async {
  // Your code here
  return {
    'success': true,
    'data': 'Hello from Dart!',
  };
}
```

**How it works:**
1. The bridge imports and runs your file
2. Calls the `execute()` function
3. Returns the result as JSON
4. Opens a new document showing the result

### Execute as Script

**Command:** `DS: Execute as Script`

Executes Dart code using the D4rt interpreter - no `execute()` function needed:

1. Select some Dart code (or open a Dart file)
2. Right-click and choose **DS: Execute as Script**

**Works with:**
- Standalone scripts without `main()` or `execute()`
- Code snippets selected in the editor
- D4rt scripts with advanced features

**Example script:**

```dart
// Simple script - just write code directly
final numbers = [1, 2, 3, 4, 5];
final sum = numbers.reduce((a, b) => a + b);
print('Sum: $sum');
```

### Script Execution Context

When scripts are executed, they receive context about:
- `workspaceRoot` - The workspace root path
- `fileName` - The source file name
- `executedBy` - How the script was triggered
- `scriptSource` - Whether from selection or file

### Advanced Bridge Scripting

For advanced script development including JavaScript bridge scripting, VS Code API access, and bidirectional Dart-TypeScript communication, see the [Bridge Scripting Guide](BRIDGE_SCRIPTING_GUIDE.md).

---

## Tom CLI Integration

The extension provides a server that allows Tom CLI to communicate with VS Code.

### Starting the Server

**Commands:**
- **DS: Start Tom CLI Integration Server** - Start on default port (7891)
- **DS: Start Tom CLI Integration Server (Custom Port)** - Choose a custom port
- **DS: Stop Tom CLI Integration Server** - Stop the running server

### How It Works

1. Start the server from VS Code
2. Tom CLI can connect to the server
3. CLI commands can:
   - Send prompts to Copilot Chat
   - Execute VS Code commands
   - Read workspace information
   - Trigger extension features

### Use Cases

- Scripted Copilot interactions from command line
- Automated workspace operations
- Integration with build tools
- Remote control of VS Code features

### Server Status

The server status is shown in:
- VS Code status bar
- Output channel: "Tom CLI Server"

---

## Process Monitor

**Command:** `DS: Start Tom Process Monitor`

The Process Monitor watches and manages background processes:

### Features

- **Auto-restart**: Automatically restarts crashed processes
- **Status tracking**: Shows process health in output channel
- **Configuration-based**: Uses monitor configuration files

### How to Use

1. Run **DS: Start Tom Process Monitor**
2. Monitor starts watching configured processes
3. View status in "Tom Process Monitor" output channel

### Configuration

The monitor uses configuration files to determine which processes to watch. See the Process Monitor documentation for configuration details.

---

## Utility Features

### Quick Window Reload

**Command:** `DS: Reload Window`  
**Keyboard Shortcut:** `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows/Linux)

Quickly reload the VS Code window. Useful after:
- Extension updates
- Configuration changes
- Troubleshooting issues

### Debug Logging

**Command:** `DS: Toggle Bridge Debug Logging`

Enable or disable detailed logging for the Dart bridge:

- **Enabled**: Verbose logs in "VS Code Bridge" output channel
- **Disabled**: Only errors and important messages

Use this when:
- Debugging bridge communication issues
- Troubleshooting script execution
- Developing new features

### Extension Help

**Command:** `DS: Show Extension Help`

Opens this user guide in a markdown preview. Quick access to documentation without leaving VS Code.

### Restart Bridge

**Command:** `DS: Restart Bridge`

Restart the Dart bridge process. Use when:
- Bridge becomes unresponsive
- After updating bridge code
- Troubleshooting communication issues

### Run Tests

**Command:** `DS: Run Tests`

Runs extension tests for development and verification.

### Print Configuration

**Command:** `DartScript: Print Configuration`

Prints the complete D4rt interpreter configuration to the "DartScript" output channel. This shows:

- **Available packages**: All import paths registered with the interpreter
- **Global variables**: Variables accessible without imports (vscode, window, workspace, etc.)
- **Global getters**: Getter functions available globally
- **Bridged classes**: All Dart classes available in D4rt scripts, organized by package

Use this when:
- Debugging script errors about missing classes or methods
- Checking which APIs are available to D4rt scripts
- Verifying bridge registration after updates

### Show VS Code API Info

**Command:** `DartScript: Show VS Code API Info`

Displays comprehensive information about VS Code's AI and language model APIs in a dedicated "VS Code API Info" output channel. This includes:

- **Language Models**: All available chat models (name, ID, vendor, family, version, token limits)
- **Registered Tools**: Tools available to AI chat, grouped by extension
- **AI/Chat Extensions**: Installed extensions related to AI (Copilot, etc.)
- **MCP Servers**: Model Context Protocol servers configured in settings
- **Environment Info**: VS Code version, UI kind, shell, remote name
- **Workspace Info**: Folder paths, trust status, workspace file

Use this when:
- Exploring what AI models are available for your subscription
- Debugging if tools are properly registered by extensions
- Checking MCP server configuration
- Documenting current VS Code AI capabilities

### Tom AI Chat

**Commands:**

- `Tom AI: Start Chat`
- `Tom AI: Send Chat Prompt`

Creates and manages `.chat.md` files for the Tom AI chat workflow. The Start command initializes the file with metadata and chat header, and the Send command extracts the prompt block, sends it to the language model, and writes responses to `<chat-id>.responses.md`.

Key behaviors:

- Prompt is the first block under the `CHAT <chat-id>` header
- Separator lines use `---` or `___`
- Responses are prepended to `<chat-id>.responses.md`
- Tool calls are executed and logged to **Tom AI Chat Log**
- Final response is logged to **Tom AI Chat Responses**

Settings:

- `dartscript.tomAiChat.modelId`
- `dartscript.tomAiChat.tokenModelId`
- `dartscript.tomAiChat.responsesTokenLimit`
- `dartscript.tomAiChat.responseSummaryTokenLimit`

---

## Configuration Reference

Access settings via **File > Preferences > Settings** and search for "DartScript":

### Context Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `dartscript.contextApproach` | `accumulation` | Context persistence approach |
| `dartscript.maxContextSize` | `50000` | Maximum context size in tokens |

**Context Approaches:**
- `accumulation`: Build up context over multiple operations
- `persistent`: Maintain persistent context across sessions

### Copilot Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `dartscript.copilotModel` | `gpt-4o` | Preferred Copilot model |
| `dartscript.autoRunOnSave` | `false` | Auto-run scripts on save |

### Send to Chat Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `dartscript.sendToChat.configPath` | `${workspaceFolder}/_ai/send_to_chat/send_to_chat.json` | Path to prompt templates |
| `dartscript.sendToChat.showNotifications` | `true` | Show notifications when sending |
| `dartscript.sendToChat.chatAnswerFolder` | `_ai/chat_replies` | Folder for chat responses |

### Tom AI Chat Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `dartscript.tomAiChat.modelId` | `gpt-5.2` | Model ID for Tom AI chat |
| `dartscript.tomAiChat.tokenModelId` | `gpt-4o` | Model ID used for token count estimates |
| `dartscript.tomAiChat.responsesTokenLimit` | `50000` | Token limit for `<chat-id>.responses.md` |
| `dartscript.tomAiChat.responseSummaryTokenLimit` | `8000` | Token limit for `<chat-id>.response-summary.md` |

### Ollama Settings

These VS Code settings serve as fallbacks. Prefer configuring via the `promptExpander` section in `send_to_chat.json`.

| Setting | Default | Description |
|---------|---------|-------------|
| `dartscript.ollama.url` | `http://localhost:11434` | Ollama server URL |
| `dartscript.ollama.model` | `qwen3:8b` | Ollama model name |

### Example settings.json

```json
{
  "dartscript.copilotModel": "gpt-4o",
  "dartscript.maxContextSize": 100000,
  "dartscript.sendToChat.showNotifications": true,
  "dartscript.sendToChat.configPath": "${workspaceFolder}/my-templates/prompts.json"
}
```

---

## Troubleshooting

### Commands Not Appearing

**Problem:** DartScript commands don't appear in Command Palette

**Solutions:**
1. Ensure extension is installed: Check Extensions view
2. Reload window: `Cmd+Shift+R`
3. Check Output > Extension Host for errors

### Bridge Not Responding

**Problem:** Script execution hangs or times out

**Solutions:**
1. Restart bridge: **DS: Restart Bridge**
2. Enable debug logging to see what's happening
3. Check "VS Code Bridge" output channel for errors
4. Ensure Dart SDK is properly installed

### Templates Not Loading

**Problem:** Custom templates don't appear

**Solutions:**
1. Verify `send_to_chat.json` path in settings
2. Check JSON syntax is valid
3. Run **DS: Reload Chat Config**
4. Check Output channel for parsing errors

### Send to Chat Not Working

**Problem:** Text doesn't appear in Copilot Chat

**Solutions:**
1. Ensure GitHub Copilot is installed and active
2. Check you have a Copilot subscription
3. Try selecting text before sending
4. Check notifications are enabled in settings

### CLI Server Connection Issues

**Problem:** Tom CLI can't connect to server

**Solutions:**
1. Verify server is running (check status bar)
2. Check port isn't blocked by firewall
3. Try a different port with custom port command
4. Check "Tom CLI Server" output channel

---

## Additional Resources

- [README.md](../README.md) - Quick reference and installation
- [extension_commands.md](extension_commands.md) - Detailed command reference
- [BRIDGE_SCRIPTING_GUIDE.md](BRIDGE_SCRIPTING_GUIDE.md) - JavaScript bridge scripting
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture details

---

## Keyboard Shortcuts Summary

| Shortcut | Command |
|----------|---------|
| `Cmd+Shift+R` / `Ctrl+Shift+R` | Reload Window |
| `Ctrl+Cmd+E` | Expand Prompt (Ollama) |

## Context Menu Summary

### File Explorer (on .dart files)
- DS: Execute File
- DS: Execute as Script

### Editor Context Menu
- DartScript: Send to Chat... (submenu)
- DS: Send to Copilot Chat (Standard)
- DS: Send to Copilot Chat (Template)...
- DS: Send to Copilot Chat (on selection)
- DS: Execute as Script (on .dart files)
