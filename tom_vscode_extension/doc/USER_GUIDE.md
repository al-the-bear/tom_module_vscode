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
    - [Context Menu](#context-menu)
    - [Configuration](#configuration)
      - [Configuration Properties](#configuration-properties)
      - [Model Configurations](#model-configurations)
      - [Profiles](#profiles)
      - [Available Placeholders](#available-placeholders)
      - [VS Code Settings Fallback](#vs-code-settings-fallback)
    - [Switching Ollama Models](#switching-ollama-models)
    - [Model Selection Flow](#model-selection-flow)
    - [Bridge API](#bridge-api)
      - [Available Methods](#available-methods)
      - [Examples](#examples)
  - [Bot Conversation (Ollama → Copilot)](#bot-conversation-ollama--copilot)
    - [How It Works](#how-it-works)
    - [Commands](#commands)
    - [Starting a Conversation](#starting-a-conversation)
    - [Conversation Profiles](#conversation-profiles)
    - [Conversation Modes](#conversation-modes)
    - [Halting and Resuming](#halting-and-resuming)
    - [Adding Information Mid-Conversation](#adding-information-mid-conversation)
    - [Telegram Notifications](#telegram-notifications)
    - [Configuration](#configuration-1)
      - [Configuration Properties](#configuration-properties-1)
      - [History Modes](#history-modes)
      - [Custom Profiles](#custom-profiles)
    - [Conversation Logs](#conversation-logs)
    - [Stopping a Conversation](#stopping-a-conversation)
  - [Dart Script Execution](#dart-script-execution)
    - [Execute File](#execute-file)
    - [Execute as Script](#execute-as-script)
    - [Script Execution Context](#script-execution-context)
    - [Advanced Bridge Scripting](#advanced-bridge-scripting)
  - [Tom CLI Integration](#tom-cli-integration)
    - [Starting the Server](#starting-the-server)
    - [How It Works](#how-it-works-1)
    - [Use Cases](#use-cases)
    - [Server Status](#server-status)
  - [Process Monitor](#process-monitor)
    - [Features](#features)
    - [How to Use](#how-to-use)
    - [Configuration](#configuration-2)
  - [Utility Features](#utility-features)
    - [Quick Window Reload](#quick-window-reload)
    - [Debug Logging](#debug-logging)
    - [Extension Help](#extension-help)
    - [Restart Bridge](#restart-bridge)
    - [Run Tests](#run-tests)
    - [Print Configuration](#print-configuration)
    - [Show VS Code API Info](#show-vs-code-api-info)
    - [Tom AI Chat](#tom-ai-chat)
  - [Configuration Reference](#configuration-reference)
    - [Context Settings](#context-settings)
    - [Copilot Settings](#copilot-settings)
    - [Send to Chat Settings](#send-to-chat-settings)
    - [Tom AI Chat Settings](#tom-ai-chat-settings)
    - [Ollama Settings](#ollama-settings)
    - [Example settings.json](#example-settingsjson)
  - [Troubleshooting](#troubleshooting)
    - [Commands Not Appearing](#commands-not-appearing)
    - [Bridge Not Responding](#bridge-not-responding)
    - [Templates Not Loading](#templates-not-loading)
    - [Send to Chat Not Working](#send-to-chat-not-working)
    - [CLI Server Connection Issues](#cli-server-connection-issues)
  - [Additional Resources](#additional-resources)
  - [Keyboard Shortcuts Summary](#keyboard-shortcuts-summary)
    - [Conversation Control (`Ctrl+Shift+C, ...`)](#conversation-control-ctrlshiftc-)
    - [Local LLM (`Ctrl+Shift+L, ...`)](#local-llm-ctrlshiftl-)
    - [Send to Copilot Chat (`Ctrl+Shift+S, ...`)](#send-to-copilot-chat-ctrlshifts-)
    - [Tom AI Chat (`Ctrl+Shift+T, ...`)](#tom-ai-chat-ctrlshiftt-)
    - [Standalone](#standalone)
  - [Command \& Keybinding Reference](#command--keybinding-reference)
    - [Bot Conversation Control](#bot-conversation-control)
    - [Local LLM / Prompt Expander](#local-llm--prompt-expander)
    - [Send to Copilot Chat](#send-to-copilot-chat)
    - [Tom AI Chat](#tom-ai-chat-1)
    - [Dart Script Execution](#dart-script-execution-1)
    - [Bridge \& Server](#bridge--server)
    - [Utility](#utility)
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

3. Reload VS Code window (use **DS: Reload Window** from the Command Palette)

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

### Context Menu

The editor right-click context menu shows **Send to local LLM** entries mirroring the Send to Chat pattern:

| Entry | Description |
|-------|-------------|
| **DartScript: Send to local LLM…** | Submenu listing all configured profiles |
| **DS: Send to local LLM (Standard)** | Runs the default profile immediately |
| **DS: Send to local LLM (Template)…** | Shows profile picker (same as Ctrl+Cmd+E) |
| **DS: Send to local LLM** | Visible only when text is selected; sends selection |

### Configuration

All settings live in the `promptExpander` section of your `send_to_chat.json` config file.

**Default location:** `${workspaceFolder}/_ai/send_to_chat/send_to_chat.json`

The configuration is loaded **fresh from disk on every invocation** — changes take effect immediately without reloading.

```json
{
  "promptExpander": {
    "ollamaUrl": "http://localhost:11434",
    "model": "qwen3:8b",
    "temperature": 0.4,
    "stripThinkingTags": true,
    "systemPrompt": "You are a prompt expansion assistant...",
    "resultTemplate": "${response}",
    "models": { ... },
    "profiles": { ... }
  }
}
```

#### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `ollamaUrl` | string | `http://localhost:11434` | Default Ollama server URL (backward compat) |
| `model` | string | `qwen3:8b` | Default model name (backward compat) |
| `temperature` | number | `0.4` | Default LLM temperature (0.0–2.0) |
| `stripThinkingTags` | boolean | `true` | Strip `<think>...</think>` tags from output |
| `systemPrompt` | string | *(see below)* | Default system prompt sent to the LLM |
| `resultTemplate` | string | `${response}` | Template for the text that replaces the selection |
| `models` | object | `{}` | Named model configurations (see below) |
| `profiles` | object | `{}` | Named expansion profiles (see below) |

#### Model Configurations

The `models` section lets you define named model configs. One must be marked `isDefault: true`.

```json
"models": {
  "qwen3-8b": {
    "ollamaUrl": "http://localhost:11434",
    "model": "qwen3:8b",
    "temperature": 0.4,
    "stripThinkingTags": true,
    "description": "Qwen 3 8B — fast reasoning model with thinking tags",
    "isDefault": true,
    "keepAlive": "5m"
  },
  "llama3-70b": {
    "ollamaUrl": "http://gpu-server:11434",
    "model": "llama3:70b",
    "temperature": 0.6,
    "stripThinkingTags": false,
    "description": "Llama 3 70B — high quality, slower",
    "keepAlive": "10m"
  },
  "codestral": {
    "ollamaUrl": "http://localhost:11434",
    "model": "codestral:latest",
    "temperature": 0.2,
    "stripThinkingTags": false,
    "description": "Codestral — code-focused model"
  }
}
```

| Model Property | Type | Description |
|----------------|------|-------------|
| `ollamaUrl` | string | Ollama server URL for this model |
| `model` | string | Model name as known to Ollama (e.g. `qwen3:8b`, `llama3:70b`) |
| `temperature` | number | Sampling temperature. `0` = deterministic, `2` = very random |
| `stripThinkingTags` | boolean | Whether to strip `<think>…</think>` tags (useful for Qwen 3 reasoning models) |
| `description` | string | Human-readable description shown in the model selection quick-pick |
| `isDefault` | boolean | If `true`, this model is used when no model is specified. Exactly one model should have this set. |
| `keepAlive` | string | How long Ollama keeps the model loaded after the last request. Default: `"5m"`. Values: `"5m"`, `"1h"`, `"0"` (unload immediately), `"-1"` (keep forever). |

**When no `models` section exists**, the top-level `ollamaUrl`, `model`, `temperature`, and `stripThinkingTags` are used as a default model config. This maintains backward compatibility with earlier configurations.

#### Profiles

Profiles define expansion behaviors. Each profile can override `systemPrompt`, `resultTemplate`, `temperature`, and which model to use. Values set to `null` inherit from the top-level config. One profile must be marked `isDefault: true`.

```json
"profiles": {
  "expand": {
    "label": "Expand Prompt",
    "systemPrompt": null,
    "resultTemplate": null,
    "temperature": null,
    "modelConfig": null,
    "isDefault": true
  },
  "rewrite": {
    "label": "Rewrite for Clarity",
    "systemPrompt": "You are a technical writing assistant...",
    "resultTemplate": null,
    "temperature": 0.3,
    "modelConfig": null
  },
  "code-expand": {
    "label": "Code-focused Expansion",
    "systemPrompt": "...",
    "resultTemplate": null,
    "temperature": 0.2,
    "modelConfig": "codestral"
  },
  "annotated": {
    "label": "Expand with Original",
    "systemPrompt": null,
    "resultTemplate": "<!-- Original prompt:\n${original}\n-->\n\n${response}",
    "temperature": null,
    "modelConfig": null
  }
}
```

| Profile Property | Type | Description |
|------------------|------|-------------|
| `label` | string | Human-readable label shown in quick-pick and context menu |
| `systemPrompt` | string \| null | System prompt override. `null` = inherit top-level |
| `resultTemplate` | string \| null | Result template override. `null` = inherit top-level |
| `temperature` | number \| null | Temperature override. `null` = inherit from model config |
| `modelConfig` | string \| null | Key into `models` section. `null` = use default model |
| `isDefault` | boolean | If `true`, this profile is used for the Standard context menu entry |

When multiple profiles exist, pressing **Ctrl+Cmd+E** shows a quick pick. The default profile is pre-selected.

#### Available Placeholders

Placeholders can be used in both `systemPrompt` and `resultTemplate`:

| Placeholder | Description |
|-------------|-------------|
| `${original}` | The original text before expansion |
| `${response}` | The LLM response after think-tag stripping |
| `${rawResponse}` | The unprocessed LLM response (before any stripping) |
| `${thinkTagInfo}` | Content extracted from `<think>…</think>` tags (empty if none) |
| `${filename}` | Basename of the active file (e.g., `main.dart`) |
| `${filePath}` | Full path to the active file |
| `${languageId}` | VS Code language identifier (e.g., `dart`, `typescript`) |
| `${workspaceName}` | Name of the first workspace folder |
| `${datetime}` | Current date/time as `yyyymmdd_hhmmss` |
| `${model}` | The Ollama model name used |
| `${modelConfig}` | The model configuration key used |
| `${profile}` | The profile key used |
| `${lineStart}` | Start line of the selection (1-based) |
| `${lineEnd}` | End line of the selection (1-based) |

**Note:** In `systemPrompt`, `${response}`, `${rawResponse}`, and `${thinkTagInfo}` are empty (the response hasn't been generated yet). Use context placeholders (`${filename}`, `${languageId}`, etc.) to give the LLM file/language context. In `resultTemplate`, all placeholders are available.

**`${rawResponse}` vs `${response}`:** When `stripThinkingTags` is enabled, `${response}` contains the cleaned text (without `<think>` blocks), while `${rawResponse}` preserves everything the LLM returned. Use `${rawResponse}` if you need the full output for debugging or logging.

**`${thinkTagInfo}`:** If the model wraps reasoning in `<think>…</think>` tags (like Qwen 3), this placeholder contains the extracted thinking content. Useful for annotated templates:

```json
"resultTemplate": "${response}\n\n<!-- Model reasoning:\n${thinkTagInfo}\n-->"
```

#### VS Code Settings Fallback

The `dartscript.ollama.url` and `dartscript.ollama.model` VS Code settings serve as fallbacks when `ollamaUrl`/`model` are not specified in the JSON config. The JSON config always takes precedence.

### Changing Ollama Models

**Command:** `DS: Change local Ollama model...` (`Ctrl+Shift+L, Ctrl+Shift+C`)

Queries the Ollama server for all locally available models and shows a quick-pick with model names and sizes. The currently active model is marked with a checkmark. Selecting a model updates the default model configuration in `send_to_chat.json`.

This is useful when you've pulled multiple models (`ollama pull llama3:70b`, `ollama pull codestral:latest`, etc.) and want to quickly switch between them without editing the config file.

### Model Selection Flow

When **multiple model configurations** are defined in the `models` section, the expand prompt command flow is:

1. **Choose model** — quick-pick showing model config keys with descriptions
2. **Choose profile** — quick-pick showing expansion profiles
3. **Expand** — runs the selected profile with the selected model

When only one model configuration exists, step 1 is skipped automatically.

### Bridge API

The Prompt Expander provides a JSON-RPC bridge API accessible from Dart/JavaScript scripts through the VS Code bridge. All methods use the `Vce` suffix (handled on the VS Code extension side).

#### Available Methods

| Method | Description |
|--------|-------------|
| `localLlm.getProfilesVce` | List all configured profiles |
| `localLlm.getModelsVce` | List all configured model configs |
| `localLlm.updateProfileVce` | Add or update a profile |
| `localLlm.removeProfileVce` | Remove a profile |
| `localLlm.updateModelVce` | Add or update a model config |
| `localLlm.removeModelVce` | Remove a model config |
| `localLlm.processVce` | Process a prompt through a profile |

#### Examples

**Get all profiles:**

```javascript
const profiles = await bridge.call('localLlm.getProfilesVce', {});
// Returns: { profiles: { expand: { label: "Expand Prompt", ... }, ... } }
```

**Process a prompt:**

```javascript
const result = await bridge.call('localLlm.processVce', {
  prompt: 'add error handling to save function',
  profile: 'expand',        // optional — uses default if omitted
  model: 'codestral'        // optional — uses default if omitted
});
// Returns: { success: true, result: "...", rawResponse: "...", response: "...",
//            thinkTagContent: "...", profile: "expand", modelConfig: "qwen3-8b" }
```

**Add a new profile:**

```javascript
await bridge.call('localLlm.updateProfileVce', {
  key: 'summarize',
  profile: {
    label: 'Summarize Code',
    systemPrompt: 'Summarize the following code in 2-3 sentences...',
    resultTemplate: null,
    temperature: 0.3,
    modelConfig: null
  }
});
```

**Add a new model:**

```javascript
await bridge.call('localLlm.updateModelVce', {
  key: 'deepseek',
  model: {
    ollamaUrl: 'http://localhost:11434',
    model: 'deepseek-coder:33b',
    temperature: 0.3,
    stripThinkingTags: false
  }
});
```

---

## Bot Conversation (Ollama → Copilot)

The Bot Conversation feature lets a local Ollama model orchestrate multi-turn conversations with GitHub Copilot Chat. The local model generates prompts, sends them to Copilot, reads the responses, and iterates toward a user-defined goal.

### How It Works

1. **You define a goal** — what you want Copilot to accomplish
2. **Local model generates a prompt** — tailored to drive Copilot toward the goal
3. **Prompt is sent to Copilot** via the VS Code Language Model API
4. **Copilot's response is captured** and fed back to the local model
5. **Local model evaluates progress** and generates the next prompt
6. **Loop continues** until the goal is reached or max turns exhausted

### Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `DS: Start Local-Copilot Conversation` | `Ctrl+Shift+C, Ctrl+Shift+B` | Start a new bot conversation session |
| `DS: Stop Local-Copilot Conversation` | `Ctrl+Shift+C, Ctrl+Shift+S` | Stop the currently active conversation |
| `DS: Halt Local-Copilot Conversation` | `Ctrl+Shift+C, Ctrl+Shift+H` | Pause the conversation between turns |
| `DS: Continue Local-Copilot Conversation` | `Ctrl+Shift+C, Ctrl+Shift+C` | Resume a halted conversation |
| `DS: Add to Local-Copilot Conversation` | `Ctrl+Shift+C, Ctrl+Shift+A` | Inject additional context into the next turn |

### Starting a Conversation

1. Open the Command Palette (`Cmd+Shift+P`)
2. Run **DS: Start Bot Conversation**
3. Select a conversation profile (research, implement, debug, or custom)
4. Enter your goal (e.g., "Find all usages of the Logger class and document them")
5. Optionally add a description for more context
6. The conversation begins automatically

If you have text selected in the editor, it will be pre-filled as the goal.

### Conversation Profiles

Profiles define how the local model approaches the conversation:

| Profile | Purpose | Default Max Turns |
|---------|---------|-------------------|
| `research` | Gather information across the codebase | 8 |
| `implement` | Guide Copilot through step-by-step implementation | 12 |
| `debug` | Systematically investigate and fix a bug | 10 |

Each profile has customizable `initialPromptTemplate` and `followUpTemplate` that control what the local model generates.

### Conversation Modes

The bot conversation supports two modes:

| Mode | Description |
|------|-------------|
| **ollama-copilot** (default) | Local Ollama model generates prompts → sends to GitHub Copilot → reads response → iterates |
| **ollama-ollama** (self-talk) | Two local Ollama model personas (Person A and Person B) discuss the goal with each other, without involving Copilot |

Self-talk mode is useful for brainstorming, design exploration, or when you want two AI perspectives to debate a topic. Each persona can have its own system prompt, model, and temperature.

To start a self-talk conversation, select `ollama-ollama` when prompted for the conversation mode, or set `conversationMode` in the config.

### Halting and Resuming

You can pause a running conversation between turns:

1. Run **DS: Halt Local-Copilot Conversation** (`Ctrl+Shift+C, Ctrl+Shift+H`)
2. The conversation pauses after the current turn completes
3. Review the conversation state, add context if needed
4. Run **DS: Continue Local-Copilot Conversation** (`Ctrl+Shift+C, Ctrl+Shift+C`) to resume

Halting is useful when you want to review intermediate results or steer the conversation in a different direction.

### Adding Information Mid-Conversation

While a conversation is active (running or halted), you can inject additional context:

1. Run **DS: Add to Local-Copilot Conversation** (`Ctrl+Shift+C, Ctrl+Shift+A`)
2. Enter the additional text (instructions, constraints, corrections)
3. The text is queued and injected into the local model’s prompt at the next turn

Multiple calls are concatenated. This is useful for course-correcting a conversation without stopping it.

### Telegram Notifications

Optionally receive Telegram notifications about conversation progress:

- Notification when a conversation starts
- Per-turn updates with prompt/response summaries
- Notification when a conversation completes (with goal status)

Configure in `send_to_chat.json`:

```json
{
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN",
    "allowedUserIds": [123456789],
    "enabled": true
  }
}
```

Telegram also supports `/stop`, `/halt`, `/continue`, and `/info` commands for remote conversation control.

### Configuration

Add a `botConversation` section to `send_to_chat.json`:

```json
{
  "botConversation": {
    "maxTurns": 10,
    "temperature": 0.5,
    "historyMode": "trim_and_summary",
    "maxHistoryChars": 8000,
    "pauseBetweenTurns": false,
    "modelConfig": null,
    "answerFolder": "_ai/bot_conversations",
    "logFolder": "_ai/bot_conversations/logs",
    "profiles": {
      "research": { ... },
      "implement": { ... },
      "debug": { ... }
    }
  }
}
```

#### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxTurns` | number | 10 | Maximum conversation turns before auto-stopping |
| `temperature` | number | 0.5 | Ollama generation temperature |
| `historyMode` | string | `trim_and_summary` | How conversation history is managed |
| `maxHistoryChars` | number | 8000 | Max characters for history in prompts |
| `pauseBetweenTurns` | boolean | false | Pause for review between each turn |
| `modelConfig` | string\|null | null | Ollama model config key (null = default) |
| `answerFolder` | string | `_ai/bot_conversations` | Where answer exchange files are stored |
| `logFolder` | string | `_ai/bot_conversations/logs` | Where conversation logs are written |

#### History Modes

| Mode | Description |
|------|-------------|
| `full` | Include all previous exchanges verbatim |
| `last` | Include only the most recent exchange |
| `summary` | Summarize all exchanges using the local model |
| `trim_and_summary` | Summarize older exchanges, keep last 2 in full (recommended) |

The `trim_and_summary` mode balances context retention with token efficiency — older exchanges are compressed into a summary by the local model, while the most recent exchanges remain in full detail.

#### Custom Profiles

Add profiles to the `botConversation.profiles` section with these properties:

| Property | Type | Description |
|----------|------|-------------|
| `label` | string | Display name shown in the profile picker |
| `description` | string | Description of what this profile does |
| `goal` | string | Default goal text (user can override) |
| `maxTurns` | number | Override default max turns |
| `temperature` | number | Override default temperature |
| `modelConfig` | string | Override model config key |
| `initialPromptTemplate` | string | Template for generating the first Copilot prompt |
| `followUpTemplate` | string | Template for generating follow-up prompts |

Templates support these placeholders: `${goal}`, `${description}`, `${turn}`, `${maxTurns}`, `${history}`.

### Conversation Logs

Each conversation produces a markdown log in the configured `logFolder` with:

- Conversation metadata (profile, goal, timestamps)
- Full exchange history with turn numbers
- Copilot responses (markdown content, references, attachments)
- Goal completion status

Log filenames include a timestamp and window ID for uniqueness.

### Stopping a Conversation

- Run **DS: Stop Bot Conversation** from the Command Palette
- The conversation also stops automatically when:
  - The local model includes `[GOAL_REACHED]` in its output
  - The maximum number of turns is reached
  - An unrecoverable error occurs

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

**Command:** `DS: Reload Window` (Command Palette only)

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

- `Tom AI: Start Chat` (`Ctrl+Shift+T, Ctrl+Shift+N`)
- `Tom AI: Send Chat Prompt` (`Ctrl+Shift+T, Ctrl+Shift+S`)
- `Tom AI: Interrupt Chat` (`Ctrl+Shift+T, Ctrl+Shift+I`)

Tom AI Chat is an agentic chat workflow that operates through `.chat.md` files. Unlike the Copilot Chat panel, Tom AI Chat gives the model full access to workspace tools (file editing, terminal, search) and runs a multi-iteration loop where the model can perform complex tasks autonomously.

#### Chat File Structure

A `.chat.md` file has this structure:

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

The metadata block at the top configures model selection, token limits, and iteration caps. The `CHAT {id}` header separates metadata from the prompt. The separator line (`---` or `___`) marks the end of the current prompt.

#### Starting a Chat Session

1. Create or open a `.chat.md` file (e.g., `my-task.chat.md`)
2. Run **Tom AI: Start Chat** (`Ctrl+Shift+T, Ctrl+Shift+N`)
3. The command adds the metadata header block (if not already present) using defaults from VS Code settings
4. Two companion files are created:
   - `{chatId}.responses.md` — accumulates model responses (newest first)
   - `{chatId}.response-summary.md` — stores summarized conversation history for context

#### Sending a Prompt

1. Write your prompt below the `CHAT` header
2. Run **Tom AI: Send Chat Prompt** (`Ctrl+Shift+T, Ctrl+Shift+S`)
3. The model receives your prompt with access to workspace tools
4. The multi-iteration agentic loop runs:
   - Model generates a response (may include tool calls)
   - If the response is text-only, it becomes the final answer
   - If tool calls are present, each tool is invoked and results are fed back
   - The loop continues (up to `maxIterations`) until the model produces a text-only response
   - Loop detection prevents the model from calling the same tool with the same arguments more than 3 times
5. The final response is written to `{chatId}.responses.md` and logged

#### Available Tools

The model can invoke a wide range of workspace tools during the agentic loop:

- **File operations**: `tom_readFile`, `tom_createFile`, `tom_editFile`, `tom_multiEditFile`, `tom_listDirectory`, `tom_findFiles`, `tom_findTextInFiles`
- **Terminal**: `tom_runCommand`, `run_in_terminal`, `get_terminal_output`
- **Copilot search**: `copilot_searchCodebase`, `copilot_searchWorkspaceSymbols`, `copilot_listCodeUsages`
- **Diagnostics**: `tom_getErrors`, `copilot_getErrors`, `copilot_testFailure`
- **Web**: `tom_fetchWebpage`, `copilot_fetchWebPage`, `copilot_openSimpleBrowser`
- **VS Code**: `tom_runVscodeCommand`, `tom_readGuideline`, `copilot_getVSCodeAPI`
- **Dart/Flutter**: `dart_format`, MCP Dart SDK tools (`launch_app`, `hot_reload`, `pub`, etc.)
- **Debug**: `get_debug_session_info`, `get_debug_stack_trace`, `get_debug_threads`, `get_debug_variables`
- **Tasks**: `create_and_run_task`, `runTests`, `runSubagent`, `tom_manageTodo`

Tools are capped at 128 max per request.

#### Pre-Processing (Context Gathering)

When `enablePromptOptimization` is `true`, the prompt is first sent to a cheaper model (`preProcessingModelId`, default `gpt-5-mini`) with a restricted read-only tool set. This model runs up to 5 iterations gathering relevant context (reading files, searching the codebase) and produces a context summary. The gathered context is prepended to the main prompt, giving the primary model relevant file contents and codebase knowledge upfront without spending expensive tokens on exploration.

#### Response Management

- Responses are **prepended** to `{chatId}.responses.md` (newest first)
- The file is trimmed to `responsesTokenLimit` tokens using a block-based algorithm
- Previous responses are summarized and stored in `{chatId}.response-summary.md` for conversation continuity
- A detailed per-request log with timestamps is written to `{chatId}.chat-log.md`
- Three VS Code output channels are used: "Tom AI Chat Log" (progress), "Tom AI Tool Log" (tool details), "Tom AI Chat Responses" (final responses)

#### Interrupting

Run **Tom AI: Interrupt Chat** (`Ctrl+Shift+T, Ctrl+Shift+I`) to cancel a running request. The cancellation is checked at the start of each iteration and during pre-processing. In-flight tool calls at the moment of cancellation will complete before the loop terminates. An `[INTERRUPTED]` marker is written to the chat log.

Settings:

- `dartscript.tomAiChat.modelId` — Primary language model (default: `gpt-5.2`)
- `dartscript.tomAiChat.tokenModelId` — Model for token counting (default: `gpt-4o`)
- `dartscript.tomAiChat.preProcessingModelId` — Cheaper model for context gathering (default: `gpt-5-mini`)
- `dartscript.tomAiChat.enablePromptOptimization` — Enable pre-processing context gathering
- `dartscript.tomAiChat.responsesTokenLimit` — Max tokens in responses file (default: 50000)
- `dartscript.tomAiChat.responseSummaryTokenLimit` — Max tokens in summary (default: 8000)
- `dartscript.tomAiChat.maxIterations` — Max agentic loop iterations (default: 100)

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
2. Reload window: Use **DS: Reload Window** from the Command Palette
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

All chord shortcuts use `Ctrl+Shift` as the modifier. Press the first combination, release, then press the second.

### Conversation Control (`Ctrl+Shift+C, ...`)

| Shortcut | Command |
|----------|---------|
| `Ctrl+Shift+C, Ctrl+Shift+B` | Start Local-Copilot Conversation |
| `Ctrl+Shift+C, Ctrl+Shift+S` | Stop Local-Copilot Conversation |
| `Ctrl+Shift+C, Ctrl+Shift+H` | Halt Local-Copilot Conversation |
| `Ctrl+Shift+C, Ctrl+Shift+C` | Continue Local-Copilot Conversation |
| `Ctrl+Shift+C, Ctrl+Shift+A` | Add to Local-Copilot Conversation |

### Local LLM (`Ctrl+Shift+L, ...`)

| Shortcut | Command |
|----------|---------|
| `Ctrl+Shift+L, Ctrl+Shift+X` | Expand Prompt (Ollama) |
| `Ctrl+Shift+L, Ctrl+Shift+C` | Change local Ollama model |
| `Ctrl+Shift+L, Ctrl+Shift+S` | Send to local LLM (Standard) |
| `Ctrl+Shift+L, Ctrl+Shift+T` | Send to local LLM (Template) |

### Send to Copilot Chat (`Ctrl+Shift+A, ...`)

| Shortcut | Command |
|----------|---------|
| `Ctrl+Shift+A, Ctrl+Shift+C` | Send to Copilot Chat |
| `Ctrl+Shift+A, Ctrl+Shift+S` | Send to Copilot Chat (Standard) |
| `Ctrl+Shift+A, Ctrl+Shift+T` | Send to Copilot Chat (Template) |
| `Ctrl+Shift+A, Ctrl+Shift+R` | Reload Chat Config |

### Tom AI Chat (`Ctrl+Shift+T, ...`)

| Shortcut | Command |
|----------|---------|
| `Ctrl+Shift+T, Ctrl+Shift+N` | Start Tom AI Chat (in .md files) |
| `Ctrl+Shift+T, Ctrl+Shift+S` | Send Tom AI Chat Prompt (in .md files) |
| `Ctrl+Shift+T, Ctrl+Shift+I` | Interrupt Tom AI Chat |

**Note:** On macOS, `Ctrl+Shift+` chords use the Control key (not Command), so they don't conflict with standard VS Code shortcuts which use `Cmd+Shift+`. On Windows/Linux, some `Ctrl+Shift+` first-chord prefixes may shadow default bindings; use the Command Palette as an alternative.

---

## Command & Keybinding Reference

Complete reference for all 42 extension commands. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and type "DS:" to see most commands. Chord shortcuts use `Ctrl+Shift` — press the first combination, release, then press the second.

### Bot Conversation Control

| Command | ID | Shortcut | Description |
|---------|----|----------|-------------|
| DS: Start Local-Copilot Conversation | `dartscript.startBotConversation` | `Ctrl+Shift+C, Ctrl+Shift+B` | Starts a multi-turn automated conversation between a local Ollama model and GitHub Copilot (or between two local model personas in self-talk mode). Shows a profile picker if profiles are configured, then prompts for a goal description (pre-filled with selected text if any) and optional constraints. The local model generates prompts for Copilot, evaluates responses, and iterates until the goal is reached or max turns exhausted. Supports configurable history modes, pause-between-turns, file context inclusion, conversation logging, and optional Telegram notifications. |
| DS: Stop Local-Copilot Conversation | `dartscript.stopBotConversation` | `Ctrl+Shift+C, Ctrl+Shift+S` | Permanently stops the active bot conversation by cancelling its loop. The conversation log is finalized and written to disk. Shows a message if no conversation is active. |
| DS: Halt Local-Copilot Conversation | `dartscript.haltBotConversation` | `Ctrl+Shift+C, Ctrl+Shift+H` | Pauses the active bot conversation between turns. Unlike stop, the conversation remains active and can be resumed. The loop blocks at the next halt checkpoint, waiting for a continue signal. Useful for reviewing intermediate results before proceeding. |
| DS: Continue Local-Copilot Conversation | `dartscript.continueBotConversation` | `Ctrl+Shift+C, Ctrl+Shift+C` | Resumes a halted bot conversation, allowing the loop to proceed to the next turn. Any additional user input queued via "Add to" is incorporated into the next prompt. Shows a message if not currently halted. |
| DS: Add to Local-Copilot Conversation | `dartscript.addToBotConversation` | `Ctrl+Shift+C, Ctrl+Shift+A` | Shows an input box (pre-filled with selected text) where you can type additional context, corrections, or instructions. The text is queued and injected into the local model's next prompt via the `${additionalUserInfo}` placeholder. Multiple calls are concatenated. Can be used while the conversation is running or halted. |

### Local LLM / Prompt Expander

| Command | ID | Shortcut | Description |
|---------|----|----------|-------------|
| DS: Expand Prompt (Ollama) | `dartscript.expandPrompt` | `Ctrl+Shift+L, Ctrl+Shift+X` | Takes the selected text (or full file) from the active editor, sends it to a local Ollama model with a configurable system prompt (default: expand terse prompt into detailed one), and **replaces the text in-place** with the LLM's response. Supports `<think>` tag stripping, result templates with placeholder substitution, and cancellable progress notifications. |
| DS: Change local Ollama model... | `dartscript.switchLocalModel` | `Ctrl+Shift+L, Ctrl+Shift+C` | Queries the local Ollama server (`/api/tags`) for all available models and shows a QuickPick listing them with sizes. When you pick a model, it updates the default model in `send_to_chat.json` and sends a warm-up request to pre-load the model into Ollama's memory for faster first use. |
| DS: Send to local LLM | `dartscript.sendToLocalLlm` | — | Shows a QuickPick listing all profiles defined in `promptExpander.profiles` in `send_to_chat.json`. When you pick a profile, it sends the selected text (or full file) to Ollama using that profile's system prompt, temperature, and result template, then replaces the text in the editor with the result. |
| DS: Send to local LLM (Standard) | `dartscript.sendToLocalLlmStandard` | `Ctrl+Shift+L, Ctrl+Shift+S` | Sends the selected text (or full file) to the local Ollama model using the **default profile** (marked `isDefault: true`, or the first profile). Skips the profile picker. Processes the result and replaces text in the editor. |
| DS: Send to local LLM (Template)... | `dartscript.sendToLocalLlmAdvanced` | `Ctrl+Shift+L, Ctrl+Shift+T` | Same as "Send to local LLM" — shows the profile picker QuickPick, lets you choose a profile, then processes and replaces text. |
| Expand Prompt | `dartscript.sendToLocalLlm.expand` | — | Context-menu shortcut that sends selected text to Ollama using the `"expand"` profile directly, without showing the picker. |
| Rewrite | `dartscript.sendToLocalLlm.rewrite` | — | Context-menu shortcut that sends selected text to Ollama using the `"rewrite"` profile directly, without showing the picker. |
| Detailed Expansion | `dartscript.sendToLocalLlm.detailed` | — | Context-menu shortcut that sends selected text to Ollama using the `"detailed"` profile directly, without showing the picker. |
| Annotated Expansion | `dartscript.sendToLocalLlm.annotated` | — | Context-menu shortcut that sends selected text to Ollama using the `"annotated"` profile directly, without showing the picker. |

### Send to Copilot Chat

| Command | ID | Shortcut | Description |
|---------|----|----------|-------------|
| DS: Send to Copilot Chat | `dartscript.sendToChat` | `Ctrl+Shift+A, Ctrl+Shift+C` | Takes the currently selected text in the active editor and opens VS Code's Copilot Chat panel with that text as the query. Requires a non-empty selection; shows an error if nothing is selected. |
| DS: Send to Copilot Chat (Standard) | `dartscript.sendToChatStandard` | `Ctrl+Shift+A, Ctrl+Shift+S` | Sends selected text (or full file) to Copilot Chat using the **default template** from `send_to_chat.json`. Skips the template picker. The text is wrapped with the template's prefix/suffix and placeholder substitution is applied. Shows a warning if no default template is configured. |
| DS: Send to Copilot Chat (Template)... | `dartscript.sendToChatAdvanced` | `Ctrl+Shift+A, Ctrl+Shift+T` | Shows a QuickPick menu listing all templates from `send_to_chat.json`. The user picks a template, and the selected text (or full file) is wrapped with that template's prefix/suffix. Supports `${placeholder}` substitution from parsed content (JSON, YAML, or colon-delimited values). The combined text is sent to Copilot Chat. |
| DS: Reload Chat Config | `dartscript.reloadSendToChatConfig` | `Ctrl+Shift+A, Ctrl+Shift+R` | Reloads the `send_to_chat.json` configuration file from disk, re-parsing all templates and the default template name. Updates the template list without restarting the extension. Shows a confirmation message. |
| Send with Trail Reminder | `dartscript.sendToChatTrailReminder` | — | Sends the selected text (or full file) to Copilot Chat using the `"Trail Reminder"` template from `send_to_chat.json`. Available from the editor context menu submenu. |
| TODO Execution | `dartscript.sendToChatTodoExecution` | — | Sends the selected text (or full file) to Copilot Chat using the `"TODO Execution"` template from `send_to_chat.json`. Available from the editor context menu submenu. |
| Code Review | `dartscript.sendToChatCodeReview` | — | Sends the selected text (or full file) to Copilot Chat using the `"Code Review"` template from `send_to_chat.json`. Available from the editor context menu submenu. |
| Explain Code | `dartscript.sendToChatExplain` | — | Sends the selected text (or full file) to Copilot Chat using the `"Explain Code"` template from `send_to_chat.json`. Available from the editor context menu submenu. |
| Add to Todo | `dartscript.sendToChatAddToTodo` | — | Sends the selected text (or full file) to Copilot Chat using the `"Add to Todo"` template from `send_to_chat.json`. Available from the editor context menu submenu. |
| Fix Markdown here | `dartscript.sendToChatFixMarkdown` | — | Sends the selected text (or full file) to Copilot Chat using the `"Fix Markdown here"` template from `send_to_chat.json`. Available from the editor context menu submenu. |
| DS: Show chat answer values | `dartscript.showChatAnswerValues` | — | Opens the DartScript output channel and prints the current accumulated chat answer values — a key-value map loaded from a session-unique answer YAML file. These values are used as `${dartscript.chat.*}` placeholders in templates. |
| DS: Clear chat answer values | `dartscript.clearChatAnswerValues` | — | Clears the in-memory chat answer values map (the `${dartscript.chat.*}` placeholder data). Shows how many entries were cleared. Does not delete the answer file on disk. |

### Tom AI Chat

| Command | ID | Shortcut | Description |
|---------|----|----------|-------------|
| Tom AI: Start Chat | `dartscript.startTomAIChat` | `Ctrl+Shift+T, Ctrl+Shift+N` | Initializes a Tom AI Chat session from a `.chat.md` file open in the active editor. Reads VS Code settings for defaults (`modelId`, `tokenModelId`, `preProcessingModelId`, token limits, iteration caps). If the file doesn't have a `CHAT` header yet, prepends a complete metadata block followed by the `CHAT {chatId}` separator (chatId derived from filename). Creates two companion files: `{chatId}.responses.md` for accumulated responses (newest first) and `{chatId}.response-summary.md` for summarized conversation history. Does not send any prompt — only sets up the file structure. |
| Tom AI: Send Chat Prompt | `dartscript.sendToTomAIChat` | `Ctrl+Shift+T, Ctrl+Shift+S` | Parses the `.chat.md` file's metadata and prompt text (everything between the `CHAT` header and the next separator), selects the configured language model via `vscode.lm.selectChatModels`, and runs a multi-iteration agentic loop (up to `maxIterations`, default 100). On each iteration, the model can invoke whitelisted workspace tools (file read/write/edit, terminal commands, codebase search, diagnostics, Dart/Flutter tools, debug inspection — 60+ tools total). Tool results are truncated and fed back; the loop continues until the model produces a text-only response. Loop detection warns the model after 3 identical tool calls. Optionally pre-processes the prompt with a cheaper model (`preProcessingModelId`) to gather context first. Previous responses are summarized for conversation continuity. Final response is prepended to `{chatId}.responses.md`, logged to `{chatId}.chat-log.md`, and shown in the "Tom AI Chat Responses" output channel. |
| Tom AI: Interrupt Chat | `dartscript.interruptTomAIChat` | `Ctrl+Shift+T, Ctrl+Shift+I` | Cancels a running Tom AI Chat request by triggering the cancellation token. The check fires at the start of each agentic loop iteration and during pre-processing. In-flight tool calls at the moment of cancellation will complete before the loop terminates. An `[INTERRUPTED]` marker is written to the chat log. Shows a confirmation if interrupted, or an info message if nothing is running. |

### Dart Script Execution

| Command | ID | Shortcut | Description |
|---------|----|----------|-------------|
| DS: Execute File | `dartscript.executeFile` | — | Sends the active/selected Dart file to the Dart bridge via `executeFileVcb`. The bridge loads and runs the file, which must contain an `execute()` function entry point. If the bridge returns a `showDocument` action, the result is opened in a new editor tab. Available from the file explorer context menu on `.dart` files. |
| DS: Execute as Script | `dartscript.executeScript` | — | Sends the **selected text** (or full file content) to the Dart bridge as inline script code — no `execute()` function needed. Supports a `// @timeout: <seconds>` comment on the first line to override the default 2-hour timeout. Available from the editor context menu on `.dart` files. |

### Bridge & Server

| Command | ID | Shortcut | Description |
|---------|----|----------|-------------|
| DS: Restart Bridge | `dartscript.restartBridge` | — | Stops any existing Dart bridge process and starts a new one. The bridge is the `tom_vscode_bridge` Dart process that communicates with the extension via JSON-RPC over stdin/stdout, providing DartScript execution, CLI server integration, and other backend services. Uses auto-restart for crash recovery. |
| DS: Start Tom CLI Integration Server | `dartscript.startCliServer` | — | Sends a request to the Dart bridge to start a TCP socket server that allows external CLI tools (like Tom CLI) to communicate with VS Code. Auto-selects an available port from the range 19900–19909. Shows the selected port on success. |
| DS: Start Tom CLI Integration Server (Custom Port) | `dartscript.startCliServerCustomPort` | — | Shows an input box for a custom port number (validated as 1–65535, default 19900), then starts the CLI integration server on that port. Reports success or an error if the port is in use. |
| DS: Stop Tom CLI Integration Server | `dartscript.stopCliServer` | — | Shuts down the TCP CLI integration server. Reports whether the server was running and was successfully stopped. |
| DS: Start Tom Process Monitor | `dartscript.startProcessMonitor` | — | Launches the Tom Process Monitor via the Dart bridge, which manages a watcher twin process and a ledger server process. Reports the alive/dead status of all three processes (ProcessMonitor, Watcher, Ledger Server) with status indicators. |
| DS: Toggle Bridge Debug Logging | `dartscript.toggleBridgeDebugLogging` | — | Toggles verbose debug logging on/off for the Dart bridge. When enabled, the bridge outputs detailed debug information to the DartScript output channel. Shows the new logging state. |

### Utility

| Command | ID | Shortcut | Description |
|---------|----|----------|-------------|
| DS: Reload Window | `dartscript.reloadWindow` | — | Notifies the Dart bridge to save state, explicitly stops the bridge process to prevent orphaned processes, then executes VS Code's built-in window reload. Ensures clean shutdown before reloading. |
| DS: Run Tests | `dartscript.runTests` | — | Creates a `BridgeTestRunner` and runs all bridge integration tests from the `tom_vscode_bridge/test/` directory. Reports test results. |
| DS: Show Extension Help | `dartscript.showHelp` | — | Opens the extension's documentation in VS Code's markdown preview. Looks for `doc/USER_GUIDE.md` in the extension directory; falls back to `README.md` if not found. |
| DartScript: Print Configuration | `dartscript.printConfiguration` | — | Prints the complete DartScript interpreter configuration to the output channel — all registered imports, classes, methods, constructors, global variables, and getters available in the DartScript runtime. Useful for debugging what's available to scripts. |
| DartScript: Show VS Code API Info | `dartscript.showApiInfo` | — | Opens a dedicated output channel with a comprehensive report: all available Language Models (name, vendor, family, max tokens), all registered LM Tools grouped by prefix, AI/Chat-related extensions and their capabilities, and configured MCP servers. Useful for debugging the AI API surface. |

## Context Menu Summary

### File Explorer (on .dart files)
- DS: Execute File
- DS: Execute as Script

### Editor Context Menu
- DartScript: Send to Chat... (submenu with templates)
- DS: Send to Copilot Chat (Standard)
- DS: Send to Copilot Chat (Template)...
- DS: Send to Copilot Chat (on selection)
- DartScript: Send to local LLM... (submenu with profiles)
- DS: Send to local LLM (Standard) — uses default profile
- DS: Send to local LLM (Template)... — shows profile picker
- DS: Send to local LLM (on selection)
- DS: Execute as Script (on .dart files)
