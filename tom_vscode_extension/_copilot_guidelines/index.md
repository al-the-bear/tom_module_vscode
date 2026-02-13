# Tom VS Code Extension Project Guidelines - Index

This folder contains project-specific guidelines for the `tom_vscode_extension` package.

## Files

| File | Description |
|------|-------------|
| [copilot_guidelines.md](copilot_guidelines.md) | General guidelines for this package |
| [copilot_answers.md](copilot_answers.md) | Copilot answer file system and usage |
| [vscode_extension_overview.md](vscode_extension_overview.md) | Feature overview with all 15 subsystems and documentation index |
| [dartscript_extension_bridge.md](dartscript_extension_bridge.md) | VS Code commands + JSON-RPC bridge protocol (Vce + Vcb), consolidated |
| [keybindings_and_commands.md](keybindings_and_commands.md) | Keybindings, chord menus, commandlines, favorites, combined/state machine commands, JS execution, trail config |
| [bridge_scripting_guide.md](bridge_scripting_guide.md) | Bridge scripting guide with profile configuration (dartscriptBridge) |
| [tom_ai_chat.md](tom_ai_chat.md) | Tom AI Chat `.chat.md` workflow, tools, templates, unimplemented design features |
| [local_llm.md](local_llm.md) | Local LLM integration with Ollama |
| [ai_conversation.md](ai_conversation.md) | AI Conversation multi-turn orchestration |
| [ask_ai_tools.md](ask_ai_tools.md) | Escalation tools (Ask Copilot, Ask Big Brother) with trail config |
| [tom_ai_bottom_panel.md](tom_ai_bottom_panel.md) | TOM AI bottom panel (6 accordion sections) |
| [tom_status_page.md](tom_status_page.md) | Status & configuration page (8 sections) |
| [explorer_notes.md](explorer_notes.md) | VS Code Notes & Workspace Notes explorer sidebar views |
| [bottom_panel_accordion.md](bottom_panel_accordion.md) | Reusable accordion component for bottom panels |
| [reinstall_extension.md](reinstall_extension.md) | Extension reinstallation workflow |
| [restart_debugging_flow.backup.md](restart_debugging_flow.backup.md) | Debugging flow reference (backup) |
| [architecture.md](architecture.md) | System architecture (bridge, extension, protocol) |
| [implementation.md](implementation.md) | Technical implementation reference |
| [project.md](project.md) | Project overview, commands, and configuration |

## Related Documentation (doc/)

These files in `doc/` provide additional user documentation:

| File | Description |
|------|-------------|
| [user_guide.md](../doc/user_guide.md) | End-user guide |
| [quick_reference.md](../doc/quick_reference.md) | Quick reference card |

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
