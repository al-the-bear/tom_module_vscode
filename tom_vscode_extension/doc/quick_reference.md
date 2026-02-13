# DartScript — Quick Reference

Press a trigger key, then the letter (with or without `Ctrl+Shift` held). `?` = this page.

## Chord Menus

**`Ctrl+Shift+C` — Conversation:** (B)egin · (S)top · (H)alt · (C)ontinue · (A)dd info

**`Ctrl+Shift+L` — Local LLM:** E(x)pand · (C)hange model · (S)tandard · (T)emplate

**`Ctrl+Shift+A` — Send to Chat:** Send to (C)hat · (S)tandard · (T)emplate · (R)eload config

**`Ctrl+Shift+T` — Tom AI Chat:** (N)ew chat · (S)end prompt · (I)nterrupt

**`Ctrl+Shift+E` — Execute:** (E)xecute · (A)dd · (D)elete · (O)pen config

**`Ctrl+Shift+X` — Favorites:** User-configured keys (0–9, a–z)

## Direct Keybindings

| Key | Action |
|-----|--------|
| `Ctrl+Shift+^` | Toggle full screen |
| `Ctrl+Shift+2` | Toggle explorer sidebar |
| `Ctrl+Shift+3` | Toggle bottom panel |
| `Ctrl+Shift+4` | Toggle chat sidebar |
| `Ctrl+Shift+Y` | Cycle panel visibility states |
| `Ctrl+Shift+0` | Focus TOM AI Panel |
| `Ctrl+Shift+8` | Extension Status Page |
| `Ctrl+Shift+9` | Focus TOM Panel |

## UI Panels

| Panel | Location | Content |
|-------|----------|---------|
| **TOM AI** | Bottom panel | 6 accordion sections: Chat Quick Access, Prompt Templates, Workspace Info, AI Configuration, Tools Reference, Quick Actions |
| **TOM** | Bottom panel | Tasks, Logs, Settings |
| **VS CODE NOTES** | Explorer sidebar | Global markdown notepad (persisted to `~/.tom/`) |
| **WORKSPACE NOTES** | Explorer sidebar | Per-workspace markdown notepad |
| **Status Page** | Editor tab | Dashboard with 8 service configurations |

## Telegram Bot Commands

When enabled, the Telegram bot supports these CLI-like commands:

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

## Config

**External config:** `~/.tom/vscode/tom_vscode_extension.json` — 12 sections: sendToChat, promptExpander, botConversation, tomAiChat, dartscriptBridge, chordMenus, combinedCommands, commandlines, favorites, stateMachines, telegram, trail

Open via: `DS: Open Config` or `Ctrl+Shift+E → O`

**VS Code settings:** `dartscript.tomAiChat.modelId` (gpt-5.2) · `tokenModelId` (gpt-4o) · `preProcessingModelId` (gpt-5-mini) · `ollama.url` (localhost:11434) · `ollama.model` (qwen3:8b)

## Context Menu

**DartScript: Send to Chat...** submenu → Trail Reminder, TODO Execution, Code Review, Explain, Fix Markdown, Add to Todo

**DartScript: Send to local LLM...** submenu → Expand, Rewrite, Detailed, Annotated

**File Explorer** (on .dart files) → Execute File, Execute as Script

## Command Palette

`Cmd+Shift+P` → type `DS:` or `Tom AI:` to see all commands

**Full docs:** run `DS: Show Extension Help`
