# Tom VS Code Extension — Project Overview

Project overview for the `dartscript-vscode` VS Code extension (publisher: `tom`, version 0.1.0).

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Feature Areas](#feature-areas)
- [Extension Commands](#extension-commands)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Development](#development)

---

## Overview

The Tom VS Code Extension (`dartscript-vscode`) is a comprehensive AI development platform built as a VS Code extension. It bridges TypeScript and Dart through a JSON-RPC child process, providing 15 feature areas with 57+ registered commands.

### What It Does

- **AI-assisted development** — Send to Chat, Tom AI Chat (agentic `.chat.md`), local LLM (Ollama), automated bot conversations
- **Keyboard productivity** — Chord menus, combined commands, state machines, commandlines, favorites
- **Dart bridge** — Execute Dart/D4rt scripts with full VS Code API access from Dart
- **Remote control** — Telegram bot with 14 CLI-like commands, TCP CLI server for Tom CLI
- **Dashboard & panels** — TOM AI bottom panel, Status Page, VS Code Notes, Workspace Notes

### Technology

| Component | Technology |
|-----------|-----------|
| Extension host | TypeScript, VS Code Extension API 1.96+ |
| Bridge server | Dart, JSON-RPC 2.0 over stdin/stdout |
| Dynamic execution | D4rt interpreter with VS Code API bridges |
| LLM integration | VS Code Language Model API (Copilot), Ollama HTTP API |
| Bot framework | Telegram Bot API via HTTP |
| Package dependencies | `@vscode/codicons`, `telegramify-markdown` |

---

## Quick Start

### 1. Install and Activate

The extension activates automatically on `onStartupFinished`. No manual activation needed.

### 2. Open Key Panels

| Action | How |
|--------|-----|
| Show chord menus | Keybinding (see Quick Reference) |
| Open Status Page | `DartScript: Show Status Page` |
| Open TOM AI panel | Click TOM AI tab in bottom panel |
| Open Notes | VS CODE NOTES / WORKSPACE NOTES in Explorer sidebar |

### 3. Try Core Features

**Send to Chat** — Select text, use chord menu or command palette → `DartScript: Send to Chat`.

**Tom AI Chat** — `DartScript: Start Tom AI Chat`, opens/creates `.chat.md` file with agentic loop using 14 workspace tools.

**Execute Script** — Open a `.d4rt.dart` file → `DartScript: Execute File in DartScript`.

**Chord Menu** — Press the chord key sequence → pick a command group → execute. Six groups: Chat, LLM, Execute, Conversation, Tom AI Chat, Favorites.

### 4. Configure

Open `~/.tom/vscode/tom_vscode_extension.json` directly or via `DartScript: Open Config`. Use `DartScript: Show Status Page` for a visual dashboard.

---

## Feature Areas

The extension has 15 feature areas. Each is briefly described below with links to detailed documentation.

### 1. Chord Menus

Quick-pick menus triggered by keyboard chords. Six menu groups (chat, llm, execute, conversation, tomAiChat, favorites) with configurable entries.

→ [keybindings_and_commands.md](keybindings_and_commands.md)

### 2. Favorites

User-defined command shortcuts stored in external config. Accessible via `chordMenu.favorites`.

→ [keybindings_and_commands.md](keybindings_and_commands.md)

### 3. Combined Commands

Execute multiple VS Code commands in sequence from a single keybinding. Configurable with delays between commands.

→ [keybindings_and_commands.md](keybindings_and_commands.md)

### 4. Send to Chat

Send selected text or file content to Copilot Chat using configurable templates with `${variable}` expansion. Supports `${dartscript.*}` variables (workspace state, bridge data), trail reminders, and answer value store.

→ [copilot_answers.md](copilot_answers.md)

### 5. Tom AI Chat

Agentic AI workflow using `.chat.md` files. The extension reads the file, sends it to VS Code LM API with 14 workspace tools, and appends the response. Supports multi-turn iteration, tool calling, and prompt optimization mode.

→ [tom_ai_chat.md](tom_ai_chat.md)

### 6. Bot Conversation

Automated multi-turn dialogue between Ollama (local) and Copilot (VS Code LM API). Configurable turn count with tool calling, halt/resume control, and conversation injection.

→ [ai_conversation.md](ai_conversation.md)

### 7. Local LLM (Prompt Expander)

Send prompts to a local Ollama model for expansion, rewriting, or annotation. Supports tool calling with the same 14 shared tools. Multiple output modes (expand, rewrite, detailed, annotated).

→ [local_llm.md](local_llm.md)

### 8. Script Execution & Bridge

Execute Dart/D4rt scripts via the bridge child process. Supports file execution, inline script execution, and D4rt REPL. Bridge profiles allow switching between project configurations.

→ [dartscript_extension_bridge.md](dartscript_extension_bridge.md), [bridge_scripting_guide.md](bridge_scripting_guide.md)

### 9. VS Code API from Dart

Full VS Code API access from Dart code through typed wrapper classes. 80+ D4rt helper functions for common operations. Bidirectional JSON-RPC communication.

→ [architecture.md](architecture.md) (Bridge Server Architecture section)

### 10. Telegram Bot Integration

Telegram bot with 14 CLI-like commands for remote workspace control: notifications, file operations, command execution, AI queries, bridge management.

→ [vscode_extension_overview.md](vscode_extension_overview.md)

### 11. CLI Integration

TCP server allowing Tom CLI to interact with VS Code. Start/stop via commands or Status Page. Configurable port.

→ [vscode_extension_overview.md](vscode_extension_overview.md)

### 12. Commandline Manager

Named command sequences stored in external config. Define, delete, and execute commandlines via command palette.

→ [keybindings_and_commands.md](keybindings_and_commands.md)

### 13. TOM AI Bottom Panel

Webview-based accordion panel with 6 collapsible sections: Chat Quick Access, Prompt Templates, Workspace Info, AI Configuration, Tools Reference, Quick Actions.

→ [tom_ai_bottom_panel.md](tom_ai_bottom_panel.md)

### 14. Status Page

Full-tab webview dashboard for configuring 8 service areas: Bridge, CLI Server, Telegram, Trail, Local LLM, Bot Conversation, Tom AI Chat, Prompt Expander.

→ [tom_status_page.md](tom_status_page.md)

### 15. Developer Utilities

API info viewer, configuration printer, help system, debug logging toggle, process monitor, quick reference card.

→ [implementation.md](implementation.md)

---

## Extension Commands

57+ commands registered under the `dartscript.*` namespace. Organized by feature area:

### Send to Chat Commands

| Command | Purpose |
|---------|---------|
| `dartscript.sendToChat` | Send to Copilot Chat (with template selection) |
| `dartscript.sendToChatAdvanced` | Send with advanced options |
| `dartscript.sendToChatStandard` | Send via standard template |
| `dartscript.sendToChatTodoExecution` | TODO execution template |
| `dartscript.sendToChatCodeReview` | Code review template |
| `dartscript.sendToChatExplain` | Explain code template |
| `dartscript.sendToChatAddToTodo` | Add to TODO template |
| `dartscript.sendToChatFixMarkdown` | Fix markdown template |
| `dartscript.sendToChatTrailReminder` | Toggle trail reminder warnings |
| `dartscript.reloadSendToChatConfig` | Reload template config |
| `dartscript.showChatAnswerValues` | Show stored answer values |
| `dartscript.clearChatAnswerValues` | Clear stored answer values |

### Tom AI Chat Commands

| Command | Purpose |
|---------|---------|
| `dartscript.startTomAIChat` | Start agentic chat from `.chat.md` file |
| `dartscript.sendToTomAIChat` | Send message to active chat |
| `dartscript.interruptTomAIChat` | Interrupt running chat |

### Local LLM Commands

| Command | Purpose |
|---------|---------|
| `dartscript.expandPrompt` | Expand prompt via Ollama |
| `dartscript.switchLocalModel` | Switch Ollama model |
| `dartscript.sendToLocalLlm` | Send to local LLM (with mode selection) |
| `dartscript.sendToLocalLlmAdvanced` | Send with advanced options |
| `dartscript.sendToLocalLlmStandard` | Send via standard mode |
| `dartscript.sendToLocalLlm.expand` | Expand mode |
| `dartscript.sendToLocalLlm.rewrite` | Rewrite mode |
| `dartscript.sendToLocalLlm.detailed` | Detailed mode |
| `dartscript.sendToLocalLlm.annotated` | Annotated mode |

### Bot Conversation Commands

| Command | Purpose |
|---------|---------|
| `dartscript.startBotConversation` | Start Ollama↔Copilot conversation |
| `dartscript.stopBotConversation` | Stop conversation |
| `dartscript.haltBotConversation` | Pause conversation |
| `dartscript.continueBotConversation` | Resume paused conversation |
| `dartscript.addToBotConversation` | Inject message into conversation |

### Chord Menu Commands

| Command | Purpose |
|---------|---------|
| `dartscript.chordMenu.chat` | Open Chat chord menu |
| `dartscript.chordMenu.llm` | Open LLM chord menu |
| `dartscript.chordMenu.execute` | Open Execute chord menu |
| `dartscript.chordMenu.conversation` | Open Conversation chord menu |
| `dartscript.chordMenu.tomAiChat` | Open Tom AI Chat chord menu |
| `dartscript.chordMenu.favorites` | Open Favorites chord menu |

### Combined & State Machine Commands

| Command | Purpose |
|---------|---------|
| `dartscript.combined.maximizeExplorer` | Maximize explorer pane |
| `dartscript.combined.maximizeEditor` | Maximize editor pane |
| `dartscript.combined.maximizeChat` | Maximize chat pane |
| `dartscript.combined.maximizeToggle` | Toggle maximize state |
| `dartscript.stateMachine.vsWindowStateFlow` | VS window state flow |
| `dartscript.resetMultiCommandState` | Reset all state machines |

### Commandline & Config Commands

| Command | Purpose |
|---------|---------|
| `dartscript.defineCommandline` | Define a new commandline |
| `dartscript.deleteCommandline` | Delete a commandline |
| `dartscript.executeCommandline` | Execute a commandline |
| `dartscript.openConfig` | Open external config file |
| `dartscript.openExtensionSettings` | Open VS Code extension settings |

### Bridge & Execution Commands

| Command | Purpose |
|---------|---------|
| `dartscript.executeFile` | Execute current file via bridge |
| `dartscript.executeScript` | Execute inline script |
| `dartscript.restartBridge` | Restart bridge process |
| `dartscript.switchBridgeProfile` | Switch bridge profile |
| `dartscript.runTests` | Run tests via bridge |

### Infrastructure Commands

| Command | Purpose |
|---------|---------|
| `dartscript.startCliServer` | Start CLI TCP server |
| `dartscript.startCliServerCustomPort` | Start CLI server on custom port |
| `dartscript.stopCliServer` | Stop CLI server |
| `dartscript.startProcessMonitor` | Start process monitor |
| `dartscript.telegramTest` | Test Telegram connection |
| `dartscript.telegramToggle` | Toggle Telegram bot |
| `dartscript.telegramConfigure` | Configure Telegram bot |
| `dartscript.toggleTrail` | Toggle trail logging |

### Utility Commands

| Command | Purpose |
|---------|---------|
| `dartscript.showStatusPage` | Open Status Page dashboard |
| `dartscript.showHelp` | Show extension help |
| `dartscript.showApiInfo` | Show API information |
| `dartscript.showQuickReference` | Show quick reference |
| `dartscript.printConfiguration` | Print current config to output |
| `dartscript.toggleBridgeDebugLogging` | Toggle debug logging |
| `dartscript.reloadWindow` | Reload VS Code window |
| `dartscript.focusTomAI` | Focus TOM AI bottom panel |

---

## Configuration

### VS Code Settings

Settings under the `dartscript.*` namespace in VS Code:

| Setting | Default | Description |
|---------|---------|-------------|
| `dartscript.contextApproach` | `accumulation` | Context persistence approach (`accumulation` or `persistent`) |
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
| `dartscript.tomAiChat.preProcessingModelId` | `gpt-5-mini` | Model for pre-processing step |
| `dartscript.tomAiChat.enablePromptOptimization` | `false` | Enable pre-processing with cheap model |
| `dartscript.ollama.url` | `http://localhost:11434` | Ollama server URL |
| `dartscript.ollama.model` | `qwen3:8b` | Ollama model name |

### External Configuration

Complex configuration lives in `~/.tom/vscode/tom_vscode_extension.json` (path configurable via `dartscript.configPath`). Open via `DartScript: Open Config` or edit through the Status Page.

**External config sections:**

| Section | Purpose |
|---------|---------|
| `sendToChat` | Template definitions, default template, variable mappings |
| `promptExpander` | Ollama URL, model, system prompts, tool configuration |
| `botConversation` | Turn count, auto-halt, Ollama/Copilot settings |
| `tomAiChat` | Tool config, system prompts, file conventions |
| `dartscriptBridge` | Bridge profiles (path, args, env per profile) |
| `chordMenus` | Chord menu entries and keybinding mappings |
| `combinedCommands` | Multi-command sequences with delays |
| `commandlines` | Named command sequences |
| `favorites` | User-defined command shortcuts |
| `stateMachines` | State transitions for window management |
| `telegram` | Bot token, chat ID, allowed users, notification config |
| `trail` | Trail logging file path and toggle state |

---

## Project Structure

```
tom_vscode_extension/
├── package.json                  # Extension manifest (commands, settings, views)
├── tsconfig.json                 # TypeScript configuration
├── src/
│   ├── extension.ts              # Entry point (activate/deactivate)
│   ├── vscode-bridge.ts          # DartBridgeClient + Vce handlers
│   ├── handler_shared.ts         # Shared state, utilities, logging
│   ├── handlers/                 # ~35 handler files (one per feature)
│   ├── tools/                    # LM tool registry, executors, escalation
│   └── managers/                 # todoManager and other state managers
├── doc/                          # Technical documentation
│   ├── user_guide.md              # End-user guide
│   └── quick_reference.md         # Command quick reference
├── _copilot_guidelines/          # Development guidelines + technical docs
│   ├── architecture.md           # System architecture
│   ├── implementation.md         # Implementation reference
│   ├── project.md                # This file
└── out/                          # Compiled JavaScript output
```

See [implementation.md](implementation.md) for the full handler file listing and handler architecture pattern.

---

## Development

### Prerequisites

- Node.js 18+
- TypeScript 5.3+
- VS Code 1.96+
- Dart SDK (for bridge development)

### Build

```bash
cd tom_vscode_extension
npm install
npm run compile     # One-time build
npm run watch       # Watch mode for development
```

### Install & Test

After compilation, install via VSIX or run in Extension Development Host (F5 in VS Code).

See [reinstall_extension.md](reinstall_extension.md) for the reinstall workflow.

### Debug Logging

Toggle bridge debug logging: `DartScript: Toggle Bridge Debug Logging` or enable via Status Page. Two levels: request handling and raw JSON output.

---

## See Also

- [architecture.md](architecture.md) — System architecture (bridge, protocol, Dart wrappers)
- [implementation.md](implementation.md) — Technical implementation reference
- [user_guide.md](../doc/user_guide.md) — End-user guide
- [quick_reference.md](../doc/quick_reference.md) — Command quick reference
- [vscode_extension_overview.md](vscode_extension_overview.md) — Feature overview with full documentation index
- [dartscript_extension_bridge.md](dartscript_extension_bridge.md) — Complete command and bridge method reference
