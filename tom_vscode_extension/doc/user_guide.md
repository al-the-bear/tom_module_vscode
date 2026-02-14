# DartScript Extension User Guide

Complete guide to using the DartScript VS Code extension for enhanced Dart/Flutter development with AI integration, keyboard productivity, and remote control.

## Table of Contents

- [Getting Started](#getting-started)
- [Keyboard System](#keyboard-system)
  - [Chord Menus](#chord-menus)
  - [Direct Keybindings](#direct-keybindings)
  - [Favorites](#favorites)
  - [Combined Commands](#combined-commands)
  - [State Machine Commands](#state-machine-commands)
  - [Commandline Manager](#commandline-manager)
- [Send to Copilot Chat](#send-to-copilot-chat)
  - [Quick Send](#quick-send)
  - [Standard Send](#standard-send)
  - [Template-Based Prompts](#template-based-prompts)
  - [Built-in Template Commands](#built-in-template-commands)
  - [Custom Prompt Templates](#custom-prompt-templates)
  - [Chat Answer Values](#chat-answer-values)
- [Tom AI Chat](#tom-ai-chat)
  - [Chat File Structure](#chat-file-structure)
  - [Starting a Chat Session](#starting-a-chat-session)
  - [Sending a Prompt](#sending-a-prompt)
  - [Available Tools](#available-tools)
  - [Pre-Processing (Context Gathering)](#pre-processing-context-gathering)
  - [Response Management](#response-management)
  - [Interrupting](#interrupting)
- [Prompt Expander (Ollama)](#prompt-expander-ollama)
  - [Prerequisites](#prerequisites)
  - [Basic Usage](#basic-usage)
  - [Profiles and Models](#profiles-and-models)
  - [Tool-Calling for Ollama](#tool-calling-for-ollama)
  - [Bridge API](#bridge-api)
- [Bot Conversation (Ollama ↔ Copilot)](#bot-conversation-ollama--copilot)
  - [How It Works](#how-it-works)
  - [Conversation Profiles](#conversation-profiles)
  - [Conversation Modes](#conversation-modes)
  - [Halting, Resuming, and Adding Info](#halting-resuming-and-adding-info)
  - [Conversation Logs](#conversation-logs)
- [UI Panels](#ui-panels)
  - [TOM AI Panel](#tom-ai-panel)
  - [TOM Panel](#tom-panel)
  - [VS Code Notes](#vs-code-notes)
  - [Workspace Notes](#workspace-notes)
  - [Status Page](#status-page)
- [Dart Script Execution](#dart-script-execution)
  - [Execute File](#execute-file)
  - [Execute as Script](#execute-as-script)
  - [Advanced Bridge Scripting](#advanced-bridge-scripting)
- [Telegram Bot](#telegram-bot)
  - [Setup](#telegram-setup)
  - [Available Commands](#telegram-available-commands)
  - [Conversation Control](#telegram-conversation-control)
- [Tom CLI Integration](#tom-cli-integration)
- [Trail Logging](#trail-logging)
- [Process Monitor](#process-monitor)
- [Utility Features](#utility-features)
- [Configuration Reference](#configuration-reference)
  - [VS Code Settings](#vs-code-settings)
  - [External Configuration](#external-configuration)
- [Troubleshooting](#troubleshooting)
- [Command & Keybinding Reference](#command--keybinding-reference)
- [Context Menu Summary](#context-menu-summary)

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

3. Reload VS Code window (use **DS: Reload Window** from the Command Palette)

### Verifying Installation

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "DS:" — you should see all DartScript commands
3. Run **DS: Show Extension Help** to view documentation
4. Press `Ctrl+Shift+8` to open the Status Page dashboard

---

## Keyboard System

The extension provides a layered keyboard system for fast command access without leaving the keyboard.

### Chord Menus

**Which-key style menus** — press a trigger key, a popup menu appears, then press a letter to execute. Works whether you release `Ctrl+Shift` first or keep it held.

| Trigger | Group | Actions |
|---------|-------|---------|
| `Ctrl+Shift+C` | Conversation | (B)egin · (S)top · (H)alt · (C)ontinue · (A)dd info |
| `Ctrl+Shift+L` | Local LLM | E(x)pand · (C)hange model · (S)tandard · (T)emplate |
| `Ctrl+Shift+A` | Send to Chat | Send to (C)hat · (S)tandard · (T)emplate · (R)eload config |
| `Ctrl+Shift+T` | Tom AI Chat | (N)ew chat · (S)end prompt · (I)nterrupt |
| `Ctrl+Shift+E` | Execute | (E)xecute · (A)dd · (D)elete · (O)pen config |
| `Ctrl+Shift+X` | Favorites | User-configured keys (0–9, a–z) |

Press `?` in any menu to open the Quick Reference card.

**Note:** On macOS, `Ctrl+Shift` uses the Control key (not Command), so no conflicts with standard VS Code shortcuts.

### Direct Keybindings

| Key | Command | Description |
|-----|---------|-------------|
| `Ctrl+Shift+^` | `dartscript.combined.maximizeToggle` | Toggle full screen |
| `Ctrl+Shift+2` | `dartscript.combined.maximizeExplorer` | Toggle explorer sidebar |
| `Ctrl+Shift+3` | `dartscript.combined.maximizeEditor` | Toggle bottom panel |
| `Ctrl+Shift+4` | `dartscript.combined.maximizeChat` | Toggle chat sidebar |
| `Ctrl+Shift+Y` | `dartscript.stateMachine.vsWindowStateFlow` | Cycle panel visibility states |
| `Ctrl+Shift+0` | `dartscript.focusTomAI` | Focus TOM AI Panel |
| `Ctrl+Shift+8` | `dartscript.showStatusPage` | Extension Status Page |
| `Ctrl+Shift+9` | `dartscript.t3Panel.focus` | Focus TOM Panel |

### Favorites

User-configurable shortcut picker invoked via `Ctrl+Shift+X`. Each entry maps a single key to a VS Code command or a sequence of commands.

Configure in `tom_vscode_extension.json` → `favorites`:

```json
{
  "favorites": [
    {
      "key": "0",
      "label": "Reload Window",
      "commandId": "workbench.action.reloadWindow"
    },
    {
      "key": "x",
      "label": "Toggle Both Sidebars",
      "commandIds": [
        "workbench.action.toggleSidebarVisibility",
        "workbench.action.toggleAuxiliaryBar"
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Single character (0–9, a–z) shown in the picker |
| `label` | string | Display label |
| `commandId` | string | Single VS Code command to execute |
| `commandIds` | string[] | Multiple commands executed sequentially (overrides `commandId`) |

### Combined Commands

Execute multiple VS Code commands in sequence from a single keybinding. Configure in `tom_vscode_extension.json` → `combinedCommands`:

```json
{
  "combinedCommands": {
    "maximizeToggle": {
      "label": "Maximize Toggle",
      "commands": ["workbench.action.toggleFullScreen"]
    },
    "maximizeExplorer": {
      "label": "Toggle Explorer Sidebar",
      "commands": ["workbench.action.toggleSidebarVisibility"]
    }
  }
}
```

Each key maps to `dartscript.combined.<name>`. Commands can include JavaScript fragments wrapped in `{ }`:

```json
{
  "commands": [
    "workbench.action.toggleFullScreen",
    "{ vscode.window.showInformationMessage('Toggled!'); }"
  ]
}
```

### State Machine Commands

State machine commands execute different action sets based on current state, enabling cyclic workflows with a single keybinding.

Example: pressing `Ctrl+Shift+Y` cycles through panel visibility states — toggling markdown preview, layout, etc.

Configure in `tom_vscode_extension.json` → `stateMachineCommands`:

```json
{
  "stateMachineCommands": {
    "vsWindowStateFlow": {
      "label": "Markdown Preview Toggle",
      "initActions": {
        "endState": "noPreview",
        "commands": []
      },
      "stateActions": [
        {
          "startState": "noPreview",
          "endState": "hasPreview",
          "commands": ["markdown.showPreviewToSide"]
        },
        {
          "startState": "hasPreview",
          "endState": "noPreview",
          "commands": ["workbench.action.editorLayoutSingle"]
        }
      ]
    }
  }
}
```

State is stored in-memory per window session and does not persist across restarts. Reset all state machines with `dartscript.resetMultiCommandState`.

### Commandline Manager

Save, organize, and execute shell commands or VS Code JavaScript expressions from a quick-pick menu.

| Chord | Action |
|-------|--------|
| `Ctrl+Shift+E → E` | Execute a saved commandline |
| `Ctrl+Shift+E → A` | Add a new commandline (wizard) |
| `Ctrl+Shift+E → D` | Delete a saved commandline |
| `Ctrl+Shift+E → O` | Open config file |

Configure in `tom_vscode_extension.json` → `commandlines`:

```json
{
  "commandlines": [
    {
      "command": "git status",
      "description": "Check git status",
      "cwd": "/path/to/repo"
    },
    {
      "command": "./reinstall_for_testing.sh",
      "description": "Reinstall + reload window",
      "cwd": "/path/to/extension",
      "postActions": ["workbench.action.reloadWindow"]
    }
  ]
}
```

**CWD modes:** `none`, `workspace`, `extension`, `project` (walks up for `pubspec.yaml`), `repository` (walks up for `.git`), `document`, `custom`.

**JavaScript expressions:** Commands starting with `vscode.` are executed as JavaScript with access to `vscode`, `path`, `fs`, `os` modules:

```json
{
  "command": "vscode.env.openExternal(vscode.Uri.file(os.homedir() + '/.tom'))",
  "description": "Open ~/.tom in Finder",
  "cwdMode": "none"
}
```

**Placeholders:** `${currentfile.name}`, `${currentfile.ext}`, `${currentfile.path}`, `${selection}`.

**Post-actions:** VS Code commands executed after a shell command completes (requires Shell Integration). Configure available options in `commandlinePostActions` array.

For full details, see [keybindings_and_commands.md](../_copilot_guidelines/keybindings_and_commands.md).

---

## Send to Copilot Chat

The extension provides powerful integration with GitHub Copilot Chat, allowing you to send text with customizable prompt templates.

### Quick Send

**Command:** `DS: Send to Copilot Chat` (`Ctrl+Shift+A → C`)

Select text in the editor, then send it directly to Copilot Chat.

### Standard Send

**Command:** `DS: Send to Copilot Chat (Standard)` (`Ctrl+Shift+A → S`)

Sends the current file or selection with standard formatting using the default template from `send_to_chat.json`. Works even without a selection.

### Template-Based Prompts

**Command:** `DS: Send to Copilot Chat (Template)...` (`Ctrl+Shift+A → T`)

Opens a quick pick menu to choose from configured prompt templates. Your text is wrapped in the template and sent to Copilot.

### Built-in Template Commands

Access from the **DartScript: Send to Chat...** submenu (right-click in editor):

| Template | Description |
|----------|-------------|
| **Send with Trail Reminder** | Includes reminder about chat trail workflow |
| **TODO Execution** | Formats selection as TODO items to execute |
| **Code Review** | Requests a code review of the selection |
| **Explain Code** | Asks for explanation of the code |
| **Add to Todo** | Adds selection to todo list |
| **Fix Markdown here** | Requests markdown formatting fixes |

### Custom Prompt Templates

Create templates in `send_to_chat.json` (default: `${workspaceFolder}/_ai/send_to_chat/send_to_chat.json`):

```json
{
  "templates": [
    {
      "id": "review",
      "name": "Code Review",
      "prompt": "Please review this code:\n\n${selection}",
      "showInSubmenu": true
    }
  ]
}
```

**Template variables:** `${selection}` (selected text or full file), `${file}` (full path), `${filename}` (basename), plus `${dartscript.*}` variables for workspace state.

The extension watches `send_to_chat.json` and auto-reloads on save. Manual reload: `Ctrl+Shift+A → R`.

### Chat Answer Values

Capture and display values from Copilot Chat responses for use as `${dartscript.chat.*}` placeholders in templates.

- **DS: Show chat answer values** — Display captured key-value pairs
- **DS: Clear chat answer values** — Clear all captured values

---

## Tom AI Chat

An agentic AI workflow that operates through `.chat.md` files. The model gets full access to 14+ workspace tools and runs a multi-iteration loop for complex autonomous tasks.

### Chat File Structure

```markdown
modelId: gpt-5.2
tokenModelId: gpt-4o
preProcessingModelId: gpt-5-mini
enablePromptOptimization: true
responsesTokenLimit: 50000
responseSummaryTokenLimit: 8000
maxIterations: 100
maxContextChars: 50000
maxToolResultChars: 50000
maxDraftChars: 8000
toolInvocationToken:
contextFilePath:
_________ CHAT my-task ____________

Your prompt text here...

---
```

### Starting a Chat Session

1. Create or open a `.chat.md` file (e.g., `my-task.chat.md`)
2. Run **Tom AI: Start Chat** (`Ctrl+Shift+T → N`)
3. The command adds the metadata header (if not present) using VS Code settings defaults
4. Two companion files are created:
   - `{chatId}.responses.md` — accumulated responses (newest first)
   - `{chatId}.response-summary.md` — summarized conversation history

### Sending a Prompt

1. Write your prompt below the `CHAT` header
2. Run **Tom AI: Send Chat Prompt** (`Ctrl+Shift+T → S`)
3. The model receives your prompt with access to workspace tools
4. The agentic loop runs until the model produces a text-only response (up to `maxIterations`)
5. Loop detection warns after 3 identical tool calls
6. Final response is written to `{chatId}.responses.md`

### Available Tools

The model can invoke a wide range of workspace tools:

- **File operations**: `tom_readFile`, `tom_createFile`, `tom_editFile`, `tom_multiEditFile`, `tom_listDirectory`, `tom_findFiles`, `tom_findTextInFiles`
- **Terminal**: `tom_runCommand`
- **Diagnostics**: `tom_getErrors`
- **Web**: `tom_fetchWebpage`, `tom_webSearch`
- **VS Code**: `tom_runVscodeCommand`, `tom_readGuideline`
- **Task management**: `tom_manageTodo`

Plus Copilot-registered tools (search, debug, Dart/Flutter) — 60+ tools total, capped at 128 per request.

### Pre-Processing (Context Gathering)

When `enablePromptOptimization` is `true`, a cheaper model (`preProcessingModelId`) first gathers context using read-only tools (up to 5 iterations). The gathered context is prepended to the main prompt, so the primary model starts with relevant file contents.

### Response Management

- Responses **prepended** to `{chatId}.responses.md` (newest first), trimmed to `responsesTokenLimit`
- Previous responses summarized in `{chatId}.response-summary.md`
- Detailed per-request log in `{chatId}.chat-log.md`
- Three output channels: "Tom AI Chat Log", "Tom AI Tool Log", "Tom AI Chat Responses"

### Interrupting

**Tom AI: Interrupt Chat** (`Ctrl+Shift+T → I`) cancels a running request. In-flight tool calls complete before the loop terminates. An `[INTERRUPTED]` marker is written to the chat log.

**Settings:**

| Setting | Default | Description |
|---------|---------|-------------|
| `dartscript.tomAiChat.modelId` | `gpt-5.2` | Primary language model |
| `dartscript.tomAiChat.tokenModelId` | `gpt-4o` | Model for token counting |
| `dartscript.tomAiChat.preProcessingModelId` | `gpt-5-mini` | Model for context gathering |
| `dartscript.tomAiChat.enablePromptOptimization` | `false` | Enable pre-processing |
| `dartscript.tomAiChat.responsesTokenLimit` | `50000` | Max tokens in responses file |
| `dartscript.tomAiChat.responseSummaryTokenLimit` | `8000` | Max tokens in summary |

For detailed workflow documentation, see [tom_ai_chat.md](../_copilot_guidelines/tom_ai_chat.md).

---

## Prompt Expander (Ollama)

Use a local Ollama model to expand terse prompts into detailed ones. Runs entirely on your machine — no cloud API calls.

### Prerequisites

1. **Install Ollama:** `brew install ollama`
2. **Start the service:** `brew services start ollama`
3. **Pull a model:** `ollama pull qwen3:8b`

### Basic Usage

1. Write a short prompt in the editor
2. Select the text (or leave empty for full document)
3. Press `Ctrl+Shift+L → X` (or run **DS: Expand Prompt (Ollama)**)
4. If multiple profiles exist, choose one from the quick pick
5. The selected text is **replaced in-place** with the expanded version

### Profiles and Models

Configure in `send_to_chat.json` → `promptExpander`:

```json
{
  "promptExpander": {
    "ollamaUrl": "http://localhost:11434",
    "model": "qwen3:8b",
    "temperature": 0.4,
    "stripThinkingTags": true,
    "models": { ... },
    "profiles": { ... }
  }
}
```

**Profiles** define expansion behaviors (expand, rewrite, detailed, annotated). Each can override system prompt, result template, temperature, and model.

**Models** define named model configurations with URL, temperature, and options. One must be `isDefault: true`.

**Context menu:** `DartScript: Send to local LLM...` submenu with Expand, Rewrite, Detailed, Annotated profiles.

**Switch Ollama model:** `Ctrl+Shift+L → C` queries Ollama for available models and shows a quick-pick.

### Tool-Calling for Ollama

All Ollama interactions use a **tool-call loop** by default. The model receives read-only tools (file read, directory list, find files, grep, web search, web fetch, diagnostics, read guideline) and can autonomously gather context before producing its response.

- Default maximum: **20 rounds** (configurable per-profile via `maxRounds`)
- Turn budget injections guide the model to converge on an answer
- On the last round, tools are withheld to force a text-only answer
- **Security:** Only read-only tools provided — no writes, no command execution

### Bridge API

The Prompt Expander provides a JSON-RPC bridge API accessible from Dart/JavaScript scripts:

| Method | Description |
|--------|-------------|
| `localLlm.getProfilesVce` | List all configured profiles |
| `localLlm.getModelsVce` | List all configured model configs |
| `localLlm.updateProfileVce` | Add or update a profile |
| `localLlm.removeProfileVce` | Remove a profile |
| `localLlm.updateModelVce` | Add or update a model config |
| `localLlm.removeModelVce` | Remove a model config |
| `localLlm.processVce` | Process a prompt through a profile |

For complete configuration details, see [local_llm.md](../_copilot_guidelines/local_llm.md).

---

## Bot Conversation (Ollama ↔ Copilot)

Automated multi-turn dialogue between a local Ollama model and GitHub Copilot. The local model generates prompts, evaluates responses, and iterates toward a user-defined goal.

### How It Works

1. **Define a goal** — what you want Copilot to accomplish
2. **Local model generates prompts** — tailored to drive Copilot toward the goal
3. **Copilot responds** via the VS Code Language Model API
4. **Local model evaluates** and generates the next prompt
5. **Loop continues** until `[GOAL_REACHED]`, max turns, or an error

### Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Start Conversation | `Ctrl+Shift+C → B` | Start a new session |
| Stop Conversation | `Ctrl+Shift+C → S` | Permanently stop |
| Halt Conversation | `Ctrl+Shift+C → H` | Pause between turns |
| Continue Conversation | `Ctrl+Shift+C → C` | Resume after halt |
| Add to Conversation | `Ctrl+Shift+C → A` | Inject additional context |

### Conversation Profiles

| Profile | Purpose | Default Max Turns |
|---------|---------|-------------------|
| `research` | Gather information across the codebase | 8 |
| `implement` | Guide step-by-step implementation | 12 |
| `debug` | Systematically investigate and fix a bug | 10 |

### Conversation Modes

| Mode | Description |
|------|-------------|
| **ollama-copilot** (default) | Local model → Copilot → iterate |
| **ollama-ollama** (self-talk) | Two local model personas discuss the goal with each other |

### Halting, Resuming, and Adding Info

- **Halt** (`Ctrl+Shift+C → H`) pauses after the current turn completes
- **Continue** (`Ctrl+Shift+C → C`) resumes from where it paused
- **Add** (`Ctrl+Shift+C → A`) queues text for the next turn (multiple calls concatenated)

### Conversation Logs

Each conversation produces a markdown log with metadata, full exchange history, and goal completion status. Configure `answerFolder` and `logFolder` in `botConversation` config section.

**Configuration:** `tom_vscode_extension.json` → `botConversation` section with `maxTurns`, `temperature`, `historyMode` (full, last, summary, trim_and_summary), `pauseBetweenTurns`, custom profiles.

For complete configuration details, see [ai_conversation.md](../_copilot_guidelines/ai_conversation.md).

---

## UI Panels

The extension provides four webview panels and a full-tab dashboard.

### TOM AI Panel

**Location:** Bottom panel tab labeled "TOM AI"
**Focus:** `Ctrl+Shift+0`

An accordion-based panel with 6 collapsible sections:

1. **Chat Quick Access** — Recently used `.chat.md` files, one-click open
2. **Prompt Templates** — Browse and apply send-to-chat templates
3. **Workspace Info** — Current workspace paths, bridge status, active config
4. **AI Configuration** — View/edit model settings, Ollama status
5. **Tools Reference** — List of available LM tools with descriptions
6. **Quick Actions** — Common commands as clickable buttons

For details, see [tom_ai_bottom_panel.md](../_copilot_guidelines/tom_ai_bottom_panel.md).

### TOM Panel

**Location:** Bottom panel tab labeled "TOM"
**Focus:** `Ctrl+Shift+9`

Accordion-based panel with two sections for GitHub issue and test tracking.

#### Issues Section

Browse, create, and manage GitHub issues across workspace repositories and additional configured repos. Features include:

- **Repository selector** — dropdown with workspace-discovered repos and manually configured additional repos (with optional display-name prefixes, e.g. `"Global Issues:owner/repo"`)
- **All Repos view** — aggregate issues from all repos into a single list (configurable via `allReposOption`)
- **Status filtering** — filter by configurable statuses (e.g. open, in_triage, assigned, closed), each with a color indicator
- **Label filtering** — quick-labels (one-click toggle) and slow-labels (picker from sections)
- **Sorting** — sort by number, title, status, created/updated date, comments, or author (multi-field)
- **Column system** — configurable table columns with drag-to-resize handles. Right-click any issue row to show/hide optional columns
- **Split-panel detail view** — select an issue to view comments, change status, toggle labels, add comments with attachments, or open in browser

#### Tests Section

Same interface as Issues, configured independently for test-tracking repos. Typically uses `scanWorkspace: false` with manually specified test repos.

#### Issue Panel Configuration

Configuration is in `~/.tom/vscode/tom_vscode_extension.json` under the `issuePanels` section. Config is re-read on every panel interaction (repo switch, refresh, etc.) — no reload needed for config changes.

**Structure:**

```json
{
  "issuePanels": {
    "common": { ... },
    "issueKit": { ... },
    "testkit": { ... }
  }
}
```

**`common`** — Shared settings for both panels:

| Key | Type | Description |
|-----|------|-------------|
| `columnLabels` | `object` | Display names for columns (e.g. `"commentCount": "# of Comments"`) |
| `growthPriority` | `string[]` | Column expansion order when extra space is available (e.g. `["title", "author", "repository"]`) |

**`issueKit` / `testkit`** — Per-panel settings:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `provider` | `string` | `"github"` | Issue provider (currently only `github`) |
| `scanWorkspace` | `boolean` | `true`/`false` | Auto-discover repos from workspace git remotes |
| `allReposOption` | `boolean` | `true`/`false` | Show "All Repos" aggregate option in dropdown |
| `excludeRepos` | `string[]` | `[]` | Repos to hide (e.g. `["owner/repo"]`) |
| `additionalRepos` | `string[]` | `[]` | Extra repos, optionally with display prefix (`"Label:owner/repo"`) |
| `statuses` | `string[]` | — | Status definitions with colors: `"status_name[color]"` |
| `defaultColumns` | `string` | — | Comma-separated optional columns shown by default |
| `availableColumns` | `string[]` | — | Column definitions (see format below) |
| `labels` | `string[]` | — | Label definitions: `"quicklabel=Name"` or `"slowlabel=Name"` |

**Column definition format:** `columnName{style}[minWidth,maxWidth]*`

- `columnName` — one of: `statusDot`, `id`, `title`, `repository`, `repositoryOwner`, `status`, `author`, `commentCount`, `creationTimestamp`, `updateTimestamp`, `labels`
- `{style}` — visual style: `dot` (status dot), `normal` (foreground color, 12px), `grey` (muted, 11px). Optional, defaults to `grey`
- `[minWidth,maxWidth]` — pixel width range for auto-layout and resize limits
- `*` — marks the column as required (always visible, not toggleable)

### VS Code Notes

**Location:** Explorer sidebar view ("VS CODE NOTES")

A markdown notepad persisted globally to `~/.tom/vscode/notes.md`. Editable directly in the sidebar with real-time sync via file watchers. Content survives across workspaces and VS Code restarts.

### Workspace Notes

**Location:** Explorer sidebar view ("WORKSPACE NOTES")

A per-workspace markdown notepad persisted to `{workspace}/.tom/notes.md`. Same editing experience as VS Code Notes but scoped to the current workspace.

For details, see [explorer_notes.md](../_copilot_guidelines/explorer_notes.md).

### Status Page

**Command:** `DS: Show Status Page` (`Ctrl+Shift+8`)

Full-tab webview dashboard for configuring and monitoring 8 service areas:

| Section | What You Can Configure |
|---------|----------------------|
| **Bridge** | Profile selection, auto-start, debug logging |
| **CLI Server** | Port, start/stop |
| **Telegram** | Bot token, chat ID, enable/disable |
| **Trail** | Enable/disable, log paths |
| **Local LLM** | Ollama URL, model, temperature |
| **Bot Conversation** | Max turns, history mode, profiles |
| **Tom AI Chat** | Model, token limits, pre-processing |
| **Prompt Expander** | System prompt, result template, tool config |

Changes are saved to `tom_vscode_extension.json` in real-time.

For details, see [tom_status_page.md](../_copilot_guidelines/tom_status_page.md).

---

## Dart Script Execution

Execute Dart files directly from VS Code without setting up a full project.

### Execute File

**Command:** `DS: Execute File`

Executes a Dart file that contains an `execute()` function:

```dart
Future<Map<String, dynamic>> execute() async {
  return {'success': true, 'data': 'Hello from Dart!'};
}
```

Right-click a `.dart` file in Explorer → **DS: Execute File**.

### Execute as Script

**Command:** `DS: Execute as Script`

Executes Dart code using the D4rt interpreter — no `execute()` function needed:

```dart
final numbers = [1, 2, 3, 4, 5];
final sum = numbers.reduce((a, b) => a + b);
print('Sum: $sum');
```

Select code or open a file → right-click → **DS: Execute as Script**.

Supports a `// @timeout: <seconds>` comment to override the default 2-hour timeout.

### Advanced Bridge Scripting

For advanced script development including JavaScript bridge scripting, VS Code API access, and bidirectional Dart-TypeScript communication, see [bridge_scripting_guide.md](../_copilot_guidelines/bridge_scripting_guide.md).

---

## Telegram Bot

<a id="telegram-setup"></a>

### Setup

Configure in `tom_vscode_extension.json` → `telegram`:

```json
{
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN",
    "allowedUserIds": [123456789],
    "enabled": true
  }
}
```

Or configure via the Status Page (`Ctrl+Shift+8` → Telegram section).

**Commands:**
- `DS: Toggle Telegram Bot` — Enable/disable the bot
- `DS: Test Telegram Connection` — Verify token and connectivity
- `DS: Configure Telegram` — Open configuration dialog

<a id="telegram-available-commands"></a>

### Available Commands

When enabled, send commands to your bot via Telegram:

| Command | Action |
|---------|--------|
| `/status` | Extension and bridge status |
| `/ls [path]` | List directory contents |
| `/cat <file>` | Read file contents |
| `/find <pattern>` | Find files by glob |
| `/grep <text>` | Search in workspace files |
| `/exec <cmd>` | Run terminal command |
| `/vscode <cmd>` | Execute VS Code command |
| `/copilot <prompt>` | Send prompt to Copilot |
| `/bridge <method>` | Call bridge method |
| `/stop` | Stop bot conversation |
| `/halt` | Halt bot conversation |
| `/continue` | Continue halted conversation |
| `/info` | Current conversation state |

<a id="telegram-conversation-control"></a>

### Conversation Control

Bot Conversation sessions can be controlled remotely via Telegram:
- Receive per-turn updates with prompt/response summaries
- Notification when conversation completes (with goal status)
- Remote `/stop`, `/halt`, `/continue` commands

---

## Tom CLI Integration

The extension provides a TCP server for Tom CLI → VS Code communication.

**Commands:**
- **DS: Start Tom CLI Integration Server** — Start on default port (range 19900–19909)
- **DS: Start Tom CLI Integration Server (Custom Port)** — Choose a custom port
- **DS: Stop Tom CLI Integration Server** — Stop the running server

Use cases: scripted Copilot interactions from command line, automated workspace operations, integration with build tools.

---

## Trail Logging

Trail logging records AI interactions (prompts, responses, tool calls) to files for audit and replay.

**Toggle:** `DS: Toggle AI Trail Logging` or via Status Page

Configure in `tom_vscode_extension.json` → `trail`:

```json
{
  "trail": {
    "enabled": true,
    "paths": {
      "local": "_ai/local/trail",
      "conversation": "_ai/conversation/trail",
      "tomai": "_ai/tomai/trail",
      "copilot": "_ai/copilot/trail"
    }
  }
}
```

Paths are relative to the workspace root. Each AI subsystem (Local LLM, Bot Conversation, Tom AI Chat, Copilot) has its own trail folder.

---

## Process Monitor

**Command:** `DS: Start Tom Process Monitor`

Watches and manages background processes with auto-restart, status tracking, and configuration-based monitoring. View status in the "Tom Process Monitor" output channel.

---

## Utility Features

| Command | Description |
|---------|-------------|
| `DS: Reload Window` | Clean shutdown of bridge, then reload VS Code |
| `DS: Toggle Bridge Debug Logging` | Enable/disable verbose bridge logging |
| `DS: Show Extension Help` | Open this user guide in markdown preview |
| `DS: Show Quick Reference` | Open compact cheat sheet (also `?` in any chord menu) |
| `DS: Open Config File` | Open `tom_vscode_extension.json` in editor |
| `DS: Print Configuration` | Print D4rt interpreter config to output channel |
| `DS: Show VS Code API Info` | Show available models, tools, MCP servers, environment |
| `DS: Restart Bridge` | Restart the Dart bridge process |
| `DS: Run Tests` | Run bridge integration tests |
| `DS: Open Extension Settings` | Open VS Code settings filtered to `dartscript.*` |

---

## Configuration Reference

### VS Code Settings

Access via **File > Preferences > Settings** and search for "dartscript":

| Setting | Default | Description |
|---------|---------|-------------|
| `dartscript.contextApproach` | `accumulation` | Context persistence approach |
| `dartscript.maxContextSize` | `50000` | Maximum context size in tokens |
| `dartscript.autoRunOnSave` | `false` | Auto-run scripts on save |
| `dartscript.copilotModel` | `gpt-4o` | Preferred Copilot model family |
| `dartscript.configPath` | `~/.tom/vscode/tom_vscode_extension.json` | External config file path |
| `dartscript.sendToChat.showNotifications` | `true` | Show Send to Chat notifications |
| `dartscript.sendToChat.chatAnswerFolder` | `_ai/chat_replies` | Folder for chat answer files |
| `dartscript.tomAiChat.modelId` | `gpt-5.2` | Model for Tom AI Chat |
| `dartscript.tomAiChat.tokenModelId` | `gpt-4o` | Model for token counting |
| `dartscript.tomAiChat.responsesTokenLimit` | `50000` | Token limit for responses file |
| `dartscript.tomAiChat.responseSummaryTokenLimit` | `8000` | Token limit for response summary |
| `dartscript.tomAiChat.preProcessingModelId` | `gpt-5-mini` | Model for pre-processing |
| `dartscript.tomAiChat.enablePromptOptimization` | `false` | Enable pre-processing with cheap model |
| `dartscript.ollama.url` | `http://localhost:11434` | Ollama server URL (fallback) |
| `dartscript.ollama.model` | `qwen3:8b` | Ollama model name (fallback) |

### External Configuration

Complex configuration lives in `~/.tom/vscode/tom_vscode_extension.json` (path set by `dartscript.configPath`). Open via `DS: Open Config` or edit through the Status Page.

| Section | Purpose |
|---------|---------|
| `sendToChat` | Template definitions, default template, variable mappings |
| `promptExpander` | Ollama URL, model, system prompts, profiles, models, tool config |
| `botConversation` | Turn count, history mode, Ollama/Copilot settings, custom profiles |
| `tomAiChat` | Tool config, system prompts, file conventions |
| `dartscriptBridge` | Bridge profiles (path, args, env per profile) |
| `chordMenus` | Chord menu entries and keybinding mappings |
| `combinedCommands` | Multi-command sequences with delays |
| `commandlines` | Named command sequences |
| `favorites` | User-defined shortcut entries |
| `stateMachines` | State transitions for cyclic workflows |
| `telegram` | Bot token, chat ID, allowed users, notification config |
| `trail` | Trail logging paths and toggle state |

---

## Troubleshooting

### Commands Not Appearing

1. Ensure extension is installed: Check Extensions view
2. Reload window: **DS: Reload Window**
3. Check Output > Extension Host for errors

### Bridge Not Responding

1. Restart bridge: **DS: Restart Bridge**
2. Enable debug logging (`DS: Toggle Bridge Debug Logging`)
3. Check "VS Code Bridge" output channel
4. Ensure Dart SDK is installed

### Templates Not Loading

1. Verify `send_to_chat.json` path in settings
2. Check JSON syntax is valid
3. Run **DS: Reload Chat Config** (`Ctrl+Shift+A → R`)
4. Check Output channel for parsing errors

### Send to Chat Not Working

1. Ensure GitHub Copilot is installed and active
2. Check you have a Copilot subscription
3. Try selecting text before sending
4. Check notifications are enabled

### CLI Server Connection Issues

1. Verify server is running (check status bar)
2. Check port isn't blocked by firewall
3. Try a different port with custom port command
4. Check "Tom CLI Server" output channel

### Chord Menu Not Triggering

1. Ensure `Ctrl+Shift` uses the Control key on macOS (not Command)
2. Check no other extension has overridden the keybinding
3. Verify the chord menu context flag: `!dartscript.chordMenuOpen`

---

## Command & Keybinding Reference

57+ commands registered under the `dartscript.*` namespace. Open the Command Palette (`Cmd+Shift+P`) and type `DS:` or `Tom AI:` to see commands.

### Bot Conversation

| Command | ID | Shortcut |
|---------|----|----------|
| Start Conversation | `dartscript.startBotConversation` | `Ctrl+Shift+C → B` |
| Stop Conversation | `dartscript.stopBotConversation` | `Ctrl+Shift+C → S` |
| Halt Conversation | `dartscript.haltBotConversation` | `Ctrl+Shift+C → H` |
| Continue Conversation | `dartscript.continueBotConversation` | `Ctrl+Shift+C → C` |
| Add to Conversation | `dartscript.addToBotConversation` | `Ctrl+Shift+C → A` |

### Local LLM / Prompt Expander

| Command | ID | Shortcut |
|---------|----|----------|
| Expand Prompt | `dartscript.expandPrompt` | `Ctrl+Shift+L → X` |
| Change Model | `dartscript.switchLocalModel` | `Ctrl+Shift+L → C` |
| Send to LLM | `dartscript.sendToLocalLlm` | — |
| Send (Standard) | `dartscript.sendToLocalLlmStandard` | `Ctrl+Shift+L → S` |
| Send (Template) | `dartscript.sendToLocalLlmAdvanced` | `Ctrl+Shift+L → T` |
| Expand (context menu) | `dartscript.sendToLocalLlm.expand` | — |
| Rewrite (context menu) | `dartscript.sendToLocalLlm.rewrite` | — |
| Detailed (context menu) | `dartscript.sendToLocalLlm.detailed` | — |
| Annotated (context menu) | `dartscript.sendToLocalLlm.annotated` | — |

### Send to Copilot Chat

| Command | ID | Shortcut |
|---------|----|----------|
| Send to Chat | `dartscript.sendToChat` | `Ctrl+Shift+A → C` |
| Standard | `dartscript.sendToChatStandard` | `Ctrl+Shift+A → S` |
| Template | `dartscript.sendToChatAdvanced` | `Ctrl+Shift+A → T` |
| Reload Config | `dartscript.reloadSendToChatConfig` | `Ctrl+Shift+A → R` |
| Trail Reminder | `dartscript.sendToChatTrailReminder` | — |
| TODO Execution | `dartscript.sendToChatTodoExecution` | — |
| Code Review | `dartscript.sendToChatCodeReview` | — |
| Explain | `dartscript.sendToChatExplain` | — |
| Add to Todo | `dartscript.sendToChatAddToTodo` | — |
| Fix Markdown | `dartscript.sendToChatFixMarkdown` | — |
| Show Answer Values | `dartscript.showChatAnswerValues` | — |
| Clear Answer Values | `dartscript.clearChatAnswerValues` | — |

### Tom AI Chat

| Command | ID | Shortcut |
|---------|----|----------|
| Start Chat | `dartscript.startTomAIChat` | `Ctrl+Shift+T → N` |
| Send Prompt | `dartscript.sendToTomAIChat` | `Ctrl+Shift+T → S` |
| Interrupt | `dartscript.interruptTomAIChat` | `Ctrl+Shift+T → I` |

### Chord Menus

| Command | ID | Shortcut |
|---------|----|----------|
| Conversation Menu | `dartscript.chordMenu.conversation` | `Ctrl+Shift+C` |
| LLM Menu | `dartscript.chordMenu.llm` | `Ctrl+Shift+L` |
| Chat Menu | `dartscript.chordMenu.chat` | `Ctrl+Shift+A` |
| Tom AI Chat Menu | `dartscript.chordMenu.tomAiChat` | `Ctrl+Shift+T` |
| Execute Menu | `dartscript.chordMenu.execute` | `Ctrl+Shift+E` |
| Favorites Menu | `dartscript.chordMenu.favorites` | `Ctrl+Shift+X` |

### Layout & Navigation

| Command | ID | Shortcut |
|---------|----|----------|
| Maximize Toggle | `dartscript.combined.maximizeToggle` | `Ctrl+Shift+^` |
| Toggle Explorer | `dartscript.combined.maximizeExplorer` | `Ctrl+Shift+2` |
| Toggle Bottom Panel | `dartscript.combined.maximizeEditor` | `Ctrl+Shift+3` |
| Toggle Chat | `dartscript.combined.maximizeChat` | `Ctrl+Shift+4` |
| Cycle Panel States | `dartscript.stateMachine.vsWindowStateFlow` | `Ctrl+Shift+Y` |
| Focus TOM AI | `dartscript.focusTomAI` | `Ctrl+Shift+0` |
| Status Page | `dartscript.showStatusPage` | `Ctrl+Shift+8` |
| Focus TOM Panel | `dartscript.t3Panel.focus` | `Ctrl+Shift+9` |
| Reset State Machines | `dartscript.resetMultiCommandState` | — |

### Script Execution

| Command | ID | Shortcut |
|---------|----|----------|
| Execute File | `dartscript.executeFile` | — |
| Execute as Script | `dartscript.executeScript` | — |

### Commandline Manager

| Command | ID | Shortcut |
|---------|----|----------|
| Execute Commandline | `dartscript.executeCommandline` | `Ctrl+Shift+E → E` |
| Add Commandline | `dartscript.defineCommandline` | `Ctrl+Shift+E → A` |
| Delete Commandline | `dartscript.deleteCommandline` | `Ctrl+Shift+E → D` |

### Bridge & Server

| Command | ID | Shortcut |
|---------|----|----------|
| Restart Bridge | `dartscript.restartBridge` | — |
| Switch Bridge Profile | `dartscript.switchBridgeProfile` | — |
| Start CLI Server | `dartscript.startCliServer` | — |
| Start CLI (Custom Port) | `dartscript.startCliServerCustomPort` | — |
| Stop CLI Server | `dartscript.stopCliServer` | — |
| Start Process Monitor | `dartscript.startProcessMonitor` | — |
| Toggle Debug Logging | `dartscript.toggleBridgeDebugLogging` | — |

### Telegram

| Command | ID | Shortcut |
|---------|----|----------|
| Test Connection | `dartscript.telegramTest` | — |
| Toggle Bot | `dartscript.telegramToggle` | — |
| Configure | `dartscript.telegramConfigure` | — |

### Utility

| Command | ID | Shortcut |
|---------|----|----------|
| Reload Window | `dartscript.reloadWindow` | — |
| Run Tests | `dartscript.runTests` | — |
| Show Help | `dartscript.showHelp` | — |
| Quick Reference | `dartscript.showQuickReference` | `?` in menus |
| Open Config | `dartscript.openConfig` | `Ctrl+Shift+E → O` |
| Open Settings | `dartscript.openExtensionSettings` | — |
| Print Configuration | `dartscript.printConfiguration` | — |
| Show API Info | `dartscript.showApiInfo` | — |
| Toggle Trail | `dartscript.toggleTrail` | — |

---

## Context Menu Summary

### File Explorer (on .dart files)

- DS: Execute File
- DS: Execute as Script

### Editor Context Menu

- **DartScript: Send to Chat...** submenu → Trail Reminder, TODO Execution, Code Review, Explain, Add to Todo, Fix Markdown
- DS: Send to Copilot Chat (Standard)
- DS: Send to Copilot Chat (Template)...
- DS: Send to Copilot Chat (on selection)
- **DartScript: Send to local LLM...** submenu → Expand, Rewrite, Detailed, Annotated
- DS: Send to local LLM (Standard)
- DS: Send to local LLM (Template)...
- DS: Send to local LLM (on selection)
- DS: Execute as Script (on .dart files)
