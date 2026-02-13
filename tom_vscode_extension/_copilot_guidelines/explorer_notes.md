# VS Code Notes & Workspace Notes

Two webview-based notepad views in the Explorer sidebar for quick note-taking.

## Views

| View | View ID | Storage File | Scope |
|------|---------|-------------|-------|
| **VS CODE NOTES** | `dartscript.tomNotepad` | `~/.tom/notes/global_notes.md` | Global (all workspaces) |
| **WORKSPACE NOTES** | `dartscript.workspaceNotepad` | `{workspace_root}/notes.md` | Per-workspace |

Both are registered as webview views in the Explorer sidebar container (not tree views). They render a textarea with toolbar buttons inside a webview panel.

## VS CODE NOTES

Global notepad shared across all VS Code windows.

**Storage:** `~/.tom/notes/global_notes.md` (hardcoded constant `GLOBAL_NOTES_PATH`)
- Auto-creates `~/.tom/notes/` directory and file if missing
- Auto-save: 300ms debounce after typing
- File watcher: detects external changes (1-second ignore window to avoid self-triggered reloads)

**Toolbar buttons:**

| Button | Icon | Message Type | Action |
|--------|------|-------------|--------|
| Send to Copilot | ➤ | `sendToCopilot` | Opens Copilot Chat with notepad content via `workbench.action.chat.open` |
| Copy | 📋 | `copy` | Copies content to clipboard |
| Open in Editor | 📄 | `openInEditor` | Opens the backing `.md` file in a VS Code editor tab |
| Clear | 🗑️ | `clear` | Clears content (with browser `confirm()` dialog) |

## WORKSPACE NOTES

Per-workspace notepad stored in the workspace root.

**Storage:** `{workspace_root}/notes.md` (first workspace folder)
- File created on first write or "Open in Editor"
- Auto-save: 500ms debounce after typing
- File watcher: detects external changes

**Toolbar buttons:**

| Button | Icon | Message Type | Action |
|--------|------|-------------|--------|
| Open in Editor | 📄 | `openInEditor` | Opens `notes.md` in editor; creates file if it doesn't exist |

## Implementation

- **Handler:** `dsNotes-handler.ts` — `TomNotepadProvider` and `WorkspaceNotepadProvider` classes
- **Provider type:** `vscode.WebviewViewProvider` (not TreeView)
- **Registration:** `registerDsNotesViews()` exported from `handlers/index.ts`
- **Communication:** Bidirectional webview messaging via `postMessage()` / `onDidReceiveMessage()`
- **Content sync:** Direct file I/O via Node.js `fs` module (not `workspaceState`)

## Configuration

No dedicated VS Code settings. File paths are hardcoded:
- VS Code Notes: `~/.tom/notes/global_notes.md`
- Workspace Notes: `{workspace_root}/notes.md`

## See Also

- [tom_ai_bottom_panel.md](tom_ai_bottom_panel.md) — TOM AI bottom panel (separate from explorer views)
- [vscode_extension_overview.md](vscode_extension_overview.md) — Feature overview
