# DartScript VS Code Extension — Feature Overview

The DartScript extension provides keyboard-driven AI workflows, a bidirectional Dart↔VS Code bridge, Telegram remote control, and developer utilities. All features are accessible via chord menus, context menus, or the command palette.

## Feature Areas

| # | Area | Description |
|---|------|-------------|
| 1 | [Chord Menu Shortcuts](#1-chord-menu-shortcuts) | Which-key style keyboard shortcut system with 6 chord menus |
| 2 | [Favorites & Multi-Command Shortcuts](#2-favorites--multi-command-shortcuts) | User-configurable shortcut picker with multi-command support |
| 3 | [Combined Commands](#3-combined-commands) | Direct keybindings for configurable command sequences |
| 4 | [Send to Copilot Chat](#4-send-to-copilot-chat) | Template-based prompt sending to GitHub Copilot Chat |
| 5 | [Tom AI Chat](#5-tom-ai-chat) | Agentic `.chat.md` workflow with 60+ workspace tools |
| 6 | [Bot Conversation](#6-bot-conversation) | Automated multi-turn Ollama↔Copilot conversation loop |
| 7 | [Local LLM / Prompt Expander](#7-local-llm--prompt-expander) | Ollama integration with profiles, tool calling, and inline expansion |
| 8 | [Script Execution & Bridge](#8-script-execution--bridge) | Run Dart scripts via bridge; JSON-RPC Dart↔VS Code communication |
| 9 | [VS Code API Access from Dart](#9-vs-code-api-access-from-dart) | Typed Dart wrappers for VS Code Window, Workspace, Commands, LM APIs |
| 10 | [Telegram Integration](#10-telegram-integration) | Remote workspace control via Telegram bot with 14 commands |
| 11 | [CLI Integration](#11-cli-integration) | TCP server for Tom CLI→VS Code external access |
| 12 | [Commandline Manager](#12-commandline-manager) | Save, execute, and manage shell commands and VS Code expressions |
| 13 | [Developer Utilities](#13-developer-utilities) | Debug logging, API info, process monitor, configuration dump |

---

## 1. Chord Menu Shortcuts

A which-key style system: press a trigger chord, then a single letter to execute. All menus include `?` for the Quick Reference cheat sheet.

| Menu | Trigger | Purpose |
|------|---------|---------|
| Send to Chat | `Ctrl+Shift+A` | Copilot Chat template shortcuts |
| Conversation | `Ctrl+Shift+C` | Bot conversation control |
| Execute | `Ctrl+Shift+E` | Commandline execution |
| Local LLM | `Ctrl+Shift+L` | Ollama / prompt expander |
| Tom AI Chat | `Ctrl+Shift+T` | Agentic chat workflow |
| Favorites | `Ctrl+Shift+X` | User-configurable favorites |

## 2. Favorites & Multi-Command Shortcuts

User-configurable shortcut picker loaded from `send_to_chat.json → favorites`. Each entry maps a single key to a VS Code command or a sequence of commands.

| Capability | Description |
|------------|-------------|
| Single command | Map a key to any VS Code command ID |
| Multi-command | Map a key to execute multiple commands sequentially (`commandIds` array) |
| JSON-configured | Add, remove, or reorder entries by editing the config file |

Example: key `x` executes both `workbench.action.toggleSidebarVisibility` and `workbench.action.toggleAuxiliaryBar` in sequence to toggle both sidebars.

## 3. Combined Commands

Direct keybindings that execute configurable sequences of VS Code commands for quick layout management. Supports both simple command sequences and state machine commands.

### Simple Command Sequences

| Keybinding | Command ID | Default Action |
|------------|------------|----------------|
| `Ctrl+Shift+^` | `dartscript.maximizeToggle` | Toggle sidebar and auxiliary bar |
| `Ctrl+Shift+2` | `dartscript.maximizeExplorer` | Show explorer, hide aux bar and panel |
| `Ctrl+Shift+3` | `dartscript.maximizeEditor` | Hide both sidebars and panel |
| `Ctrl+Shift+4` | `dartscript.maximizeChat` | Hide explorer and panel, show aux bar |

Each command corresponds to a `combinedCommands` entry in the config file. Entries contain an array of VS Code command IDs to execute in sequence. Commands can include JavaScript fragments wrapped in `{ }` for inline evaluation.

### State Machine Commands

State machine commands execute different action sets based on current state, enabling cyclic workflows with a single keybinding.

| Keybinding | Command ID | Description |
|------------|------------|-------------|
| `Ctrl+Shift+Y` | `dartscript.vsWindowStateFlow` | Cycle through panel visibility states |
| — | `dartscript.resetMultiCommandState` | Reset all state machines to initial state |

**Features:**
- **Init Actions** — Run once on first invocation to establish known initial state
- **State Actions** — Define transitions: `startState` → execute commands → `endState`
- **Reset Actions** — Run when state is reset, then clear all state
- **Per-window state** — Each VS Code window maintains independent state (memory only, not persisted)
- **Validation** — Duplicate start states trigger an error message

See [keybindings_and_commands.md](../_copilot_guidelines/keybindings_and_commands.md) for detailed configuration reference.

## 4. Send to Copilot Chat

Send selected text or full files to GitHub Copilot Chat using configurable templates with placeholder substitution.

| Feature | Shortcut | Description |
|---------|----------|-------------|
| Send to Chat | `Ctrl+Shift+A → C` | Send selection directly |
| Send Standard | `Ctrl+Shift+A → S` | Send with default template |
| Send Template | `Ctrl+Shift+A → T` | Pick template, then send |
| Reload Config | `Ctrl+Shift+A → R` | Reload templates from JSON |
| Built-in templates | Context menu | Trail Reminder, TODO Execution, Code Review, Explain, Add to Todo, Fix Markdown |
| Answer values | Command palette | Show/clear captured `${dartscript.chat.*}` placeholder values |

## 5. Tom AI Chat

Agentic `.chat.md` workflow with multi-iteration tool-calling loops and 60+ workspace tools.

| Feature | Shortcut | Description |
|---------|----------|-------------|
| Start Chat | `Ctrl+Shift+T → N` | Initialize `.chat.md` with metadata and companion files |
| Send Prompt | `Ctrl+Shift+T → S` | Run agentic loop with file I/O, terminal, search, diagnostics tools |
| Interrupt | `Ctrl+Shift+T → I` | Cancel running request |
| Pre-processing | Automatic | Cheap-model context gathering before main prompt |
| Todo management | Tool | Persistent `tom_manageTodo` for multi-step task tracking |
| Token management | Automatic | Response trimming, conversation summarization |

**Registered LM Tools (14):** `tom_createFile`, `tom_readFile`, `tom_editFile`, `tom_multiEditFile`, `tom_listDirectory`, `tom_findFiles`, `tom_findTextInFiles`, `tom_runCommand`, `tom_runVscodeCommand`, `tom_getErrors`, `tom_fetchWebpage`, `tom_readGuideline`, `tom_webSearch`, `tom_manageTodo`

## 6. Bot Conversation

Automated multi-turn conversation loop between a local Ollama model and GitHub Copilot Chat.

| Feature | Shortcut | Description |
|---------|----------|-------------|
| Start | `Ctrl+Shift+C → B` | Launch conversation with profile selection |
| Stop / Halt / Continue | `C → S / H / C` | Permanent stop, pause, or resume |
| Add Info | `Ctrl+Shift+C → A` | Inject context into next turn |
| Self-Talk mode | At start | Two Ollama personas discuss without Copilot |
| Profiles | At start | Built-in: research, implement, debug (customizable) |
| History modes | Config | full, last, summary, trim_and_summary |
| Logging | Automatic | Full markdown log with timestamps |
| Telegram alerts | Automatic | Notifications on start, turn, and completion |

## 7. Local LLM / Prompt Expander

Send text to a local Ollama instance for expansion, rewriting, or annotation with optional tool-calling loops.

| Feature | Shortcut | Description |
|---------|----------|-------------|
| Expand Prompt | `Ctrl+Shift+L → X` | Replace selection with Ollama-expanded version |
| Change Model | `Ctrl+Shift+L → C` | Switch active Ollama model |
| Send Standard | `Ctrl+Shift+L → S` | Send with default profile |
| Send Template | `Ctrl+Shift+L → T` | Pick profile, then send |
| Context menu profiles | Right-click | Expand, Rewrite, Detailed, Annotated |
| Tool calling | Automatic | Read-only tools (file read, grep, web search, guidelines) up to 20 rounds |
| Think tag stripping | Config | Auto-strip `<think>` tags from reasoning models |

## 8. Script Execution & Bridge

Run Dart scripts through the bridge and manage the JSON-RPC bridge process.

| Feature | Description |
|---------|-------------|
| Execute File | Run `.dart` file with `execute()` function via bridge (explorer context menu) |
| Execute as Script | Run selected text or full file as inline D4rt script (editor + explorer) |
| Restart Bridge | Start/restart the Dart bridge process (JSON-RPC over stdin/stdout) |
| Switch Profile | Switch between bridge profiles |
| Run Tests | Run all D4rt bridge test scripts from `test/` directory |

## 9. VS Code API Access from Dart

The Dart bridge exposes typed wrappers so Dart scripts can call VS Code APIs programmatically.

| API Surface | Capabilities |
|-------------|-------------|
| Window | showInformationMessage, showWarningMessage, showErrorMessage, showQuickPick, showInputBox, showTextDocument |
| Workspace | getWorkspaceFolders, findFiles, readFile, writeFile, getConfiguration |
| Commands | executeCommand, getCommands |
| Language Model | selectChatModels, sendRequest, countTokens |
| Chat | registerChatParticipant, sendChatResponse, reportChatProgress |
| Extensions | getAllExtensions, getExtension |
| D4rt Helpers | 80+ utility functions for common operations (log, showInfo, openFile, etc.) |

## 10. Telegram Integration

Remote workspace control via Telegram bot with standalone polling and 14 CLI-like commands.

| VS Code Command | Description |
|-----------------|-------------|
| Test Connection | Send test message to verify bot token & chat ID |
| Toggle Polling | Start/stop Telegram polling independent of conversations |
| Configure | Interactive 4-step configuration wizard |

**Bot Commands (via polling):**

| Command | Description |
|---------|-------------|
| `/help [cmd]` | Show available commands or details for one |
| `/ls [path]` | List files in current/given directory |
| `/cd <path>` | Change virtual working directory |
| `/cwd` | Show current working directory |
| `/project [name]` | Switch to a project root folder |
| `/dart analyze` | Run dart analyze on current project |
| `/problems` | Show VS Code Problems pane summary |
| `/todos` | Show TODO/FIXME comments |
| `/tests [project]` | Run testkit tests |
| `/baseline [project]` | Create testkit baseline |
| `/bridge <cmd>` | Control Dart bridge (restart / stop / mode) |
| `/cli-integration <cmd>` | CLI integration server control |
| `/status` | Workspace and polling status overview |
| `/stop` | Stop Telegram polling |

## 11. CLI Integration

TCP socket server for Tom CLI→VS Code external communication.

| Feature | Description |
|---------|-------------|
| Start Server | Listen on port 19900–19909 for incoming CLI connections |
| Custom Port | Start with user-specified port |
| Stop Server | Shut down the CLI integration server |

## 12. Commandline Manager

Save, organize, and execute shell commands or VS Code expressions with smart working directory resolution.

| Feature | Shortcut | Description |
|---------|----------|-------------|
| Execute | `Ctrl+Shift+E → E` | Pick from saved commands, run in terminal |
| Add | `Ctrl+Shift+E → A` | Multi-step wizard with cwd mode selection |
| Delete | `Ctrl+Shift+E → D` | Remove a saved command |
| Open Config | `Ctrl+Shift+E → O` | Open config file in editor |

**CWD modes:** none (no working directory), workspace, extension, project, repository, document folder, custom path.

**Placeholders:** `${currentfile.name}`, `${currentfile.ext}`, `${currentfile.path}`, `${selection}`

**VS Code Expressions:** Commands starting with `vscode.` are evaluated as JavaScript expressions with access to `vscode`, `os`, `path`, and `fs` modules. Example: `vscode.env.openExternal(vscode.Uri.file(os.homedir() + '/.tom'))` opens the ~/.tom folder in Finder.

**Quick selection:** The picker shows auto-assigned keys (1-9, a-z) for fast keyboard selection without arrow navigation.

## 13. Developer Utilities

| Feature | Description |
|---------|-------------|
| Reload Window | Clean bridge shutdown + VS Code reload (prevents orphaned processes) |
| Toggle Debug Logging | Enable/disable verbose bridge debug output |
| Print Configuration | Dump full D4rt interpreter config to output channel |
| Show API Info | Display language models, tools, AI extensions, MCP servers, env info |
| Show Help | Open USER_GUIDE.md in markdown preview |
| Process Monitor | Launch watcher + ledger server for process alive/dead status reporting |

---

*57 registered commands across 18 handler files. Configuration via VS Code settings (`dartscript.*`) and config file (`dartscript.configPath`, default: `~/.tom/vscode/tom_vscode_extension.json`).*
