# Tom VS Code Extension Project Guidelines - Index

This folder contains project-specific guidelines for the `tom_vscode_extension` package.

## Files

| File | Description |
|------|-------------|
| [copilot_guidelines.md](copilot_guidelines.md) | General guidelines for this package |
| [copilot_answers.md](copilot_answers.md) | Copilot answer file system and usage |
| [dartscript_extension_bridge.md](dartscript_extension_bridge.md) | VS Code commands + JSON-RPC bridge protocol (Vce + Vcb), consolidated |
| [keybindings_and_commands.md](keybindings_and_commands.md) | Keybindings, chord menus, commandlines, favorites, combined/state machine commands, JS execution, trail config |
| [tom_ai_chat.md](tom_ai_chat.md) | Tom AI Chat `.chat.md` workflow, tools, templates, unimplemented design features |
| [local_llm.md](local_llm.md) | Local LLM integration with Ollama |
| [ai_conversation.md](ai_conversation.md) | AI Conversation multi-turn orchestration |
| [bottom_panel_accordion.md](bottom_panel_accordion.md) | Reusable accordion component for bottom panels |
| [reinstall_extension.md](reinstall_extension.md) | Extension reinstallation workflow |
| [restart_debugging_flow.backup.md](restart_debugging_flow.backup.md) | Debugging flow reference (backup) |

## Related Documentation (doc/)

These files in `doc/` provide additional developer and user documentation:

| File | Description |
|------|-------------|
| [BRIDGE_SCRIPTING_GUIDE.md](../doc/BRIDGE_SCRIPTING_GUIDE.md) | Bridge scripting guide with bridge configuration (dartscriptBridge profiles) |
| [ARCHITECTURE.md](../doc/ARCHITECTURE.md) | System architecture (bridge, extension, protocol) |
| [vscode_extension_overview.md](../doc/vscode_extension_overview.md) | Feature overview with all 15 subsystems |
| [tom_ai_bottom_panel.md](../doc/tom_ai_bottom_panel.md) | TOM AI bottom panel (6 accordion sections) |
| [tom_status_page.md](../doc/tom_status_page.md) | Status & configuration page (8 sections) |
| [ask_ai_tools.md](../doc/ask_ai_tools.md) | Escalation tools (Ask Copilot, Ask Big Brother) with trail config |
| [USER_GUIDE.md](../doc/USER_GUIDE.md) | End-user guide |
| [QUICK_REFERENCE.md](../doc/QUICK_REFERENCE.md) | Quick reference card |

## Quick Reference

**Package:** `tom_vscode_extension`  
**Purpose:** VS Code extension for Tom development

**Key Components:**
- TypeScript extension host
- Integration with Dart bridge
- Tom workspace tooling support

**Documentation:**
- [README](../README.md) — Quick start guide

## Related Packages

- [tom_vscode_bridge](../tom_vscode_bridge/) — Dart bridge for VS Code API
