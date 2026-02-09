# DartScript Extension — Quick Reference

## Keyboard Shortcuts (Which-Key Menus)

Press a trigger key to open a popup, then press the indicated letter (with or without Ctrl+Shift held).

### Ctrl+Shift+C — Conversation

| Key | Command |
|-----|---------|
| B | Start Local-Copilot Conversation |
| S | Stop Conversation |
| H | Halt (pause between turns) |
| C | Continue (resume halted) |
| A | Add info to conversation |
| ? | This quick reference |

### Ctrl+Shift+L — Local LLM (Ollama)

| Key | Command |
|-----|---------|
| X | Expand Prompt |
| C | Change Ollama model |
| S | Send to LLM (Standard profile) |
| T | Send to LLM (Template picker) |
| ? | This quick reference |

### Ctrl+Shift+A — Send to Copilot Chat

| Key | Command |
|-----|---------|
| C | Send selection to Chat |
| S | Send to Chat (Standard template) |
| T | Send to Chat (Template picker) |
| R | Reload Chat Config |
| ? | This quick reference |

### Ctrl+Shift+T — Tom AI Chat

| Key | Command |
|-----|---------|
| N | Start Chat (init .chat.md) |
| S | Send Chat Prompt |
| I | Interrupt Chat |
| ? | This quick reference |

## Key Configuration Files

| File | Purpose |
|------|---------|
| `_ai/send_to_chat/send_to_chat.json` | Templates, models, profiles |
| `*.chat.md` | Tom AI Chat session files |

### send_to_chat.json Structure

```json
{
  "ollamaUrl": "http://localhost:11434",
  "defaultModel": "qwen3:8b",
  "defaultTemplate": "Trail Reminder",
  "templates": [ { "name": "...", "prefix": "...", "suffix": "..." } ],
  "promptExpander": { "systemPrompt": "...", "profiles": [...] },
  "botConversation": { "profiles": [...], "maxTurns": 10 }
}
```

## VS Code Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `dartscript.tomAiChat.modelId` | `gpt-5.2` | Primary chat model |
| `dartscript.tomAiChat.tokenModelId` | `gpt-4o` | Token counting model |
| `dartscript.tomAiChat.preProcessingModelId` | `gpt-5-mini` | Context-gathering model |
| `dartscript.ollamaUrl` | `http://localhost:11434` | Ollama server URL |

## Context Menu

Right-click in the editor to access:
- **DartScript submenu**: Send with Trail Reminder, TODO Execution, Code Review, Explain Code, Fix Markdown, Add to Todo
- **Expand Prompt / Rewrite / Detailed / Annotated**: Direct Ollama profile shortcuts

## Command Palette

Type `DS:` or `Tom AI:` in the Command Palette (`Cmd+Shift+P`) to find all commands.

## More Information

Run any shortcut group + `?` or use **DS: Show Extension Help** for the full User Guide.
