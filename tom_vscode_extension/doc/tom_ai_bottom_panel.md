# TOM AI Bottom Panel

The TOM AI panel is a webview-based bottom panel in VS Code providing 6 specialized accordion sections for AI workflows and developer tools.

**Panel registration:** View container `dartscript-t2-panel` (icon: `$(layout)`, title: "TOM AI"), containing webview view `dartscript.unifiedNotepad`.

## Sections Overview

| # | Section | ID | Icon | Purpose |
|---|---------|-----|------|---------|
| 1 | **Guidelines** | `guidelines` | `codicon-book` | Edit Copilot instructions and guideline files |
| 2 | **Notes** | `notes` | `codicon-note` | General-purpose scratch notes |
| 3 | **Local LLM** | `localLlm` | `codicon-robot` | Send prompts to local Ollama LLM |
| 4 | **AI Conversation** | `conversation` | `codicon-comment-discussion` | Bot conversation control and prompting |
| 5 | **Copilot** | `copilot` | `codicon-copilot` | Send prompts to GitHub Copilot Chat |
| 6 | **Tom AI Chat** | `tomAiChat` | `codicon-comment-discussion-sparkle` | Insert prompts into `.chat.md` agentic workflow |

## Additional Notepad Views (Explorer Sidebar)

Two standalone notepad views are registered in the Explorer sidebar:

| View ID | Name | Purpose |
|---------|------|---------|
| `dartscript.tomNotepad` | VS CODE NOTES | Notes scoped to VS Code session |
| `dartscript.workspaceNotepad` | WORKSPACE NOTES | Notes scoped to workspace |

## Common Features

### Multi-Note Support
All sections except Guidelines support multiple notes:
- **Add Note**: Click "+ Add" button to create a new note
- **Select Note**: Use the dropdown to switch between notes
- **Delete Note**: Click the 🗑️ button to delete the current note

### Auto-Save
All content is automatically saved after 500ms of inactivity. Notes persist across VS Code sessions via VS Code workspace state.

### Character Counter
Each section shows the character count in the status bar area.

## Template System

The Local LLM, AI Conversation, Copilot, and Tom AI Chat sections support templates:

### Template Operations
- **Save as Template**: Save current content as a reusable template
- **Select Template**: Use the template dropdown to browse saved templates
- **Apply Template**: Load the selected template into the current note
- **Delete Template**: Remove a saved template

### Template Placeholders

| Placeholder | Description |
|-------------|-------------|
| `{{selection}}` | Current editor selection |
| `{{file}}` | Current file path (relative to workspace) |
| `{{filename}}` | Current file name only |
| `{{filecontent}}` | Entire current file content |
| `{{clipboard}}` | Clipboard content |
| `{{date}}` | Current date |
| `{{time}}` | Current time |
| `{{datetime}}` | Current date and time |
| `{{language}}` | Current file's language ID |
| `{{line}}` | Current line number |
| `{{workspace}}` | Workspace name |
| `{{workspacepath}}` | Full workspace path |

### Preview Prompt
Click "Preview" to see placeholders expanded before sending. The preview opens a webview panel where you can review, edit, and send directly.

## Section Details

### 1. Guidelines

Quick editing of Copilot instruction files without leaving the bottom panel:

- **Files**: Loads `copilot-instructions.md` and all `.md` files from `_copilot_guidelines/`
- **File Watcher**: Automatically reloads when files change on disk
- **Add Guideline**: Creates a new markdown file in `_copilot_guidelines/`
- **Delete**: Can delete guideline files (except `copilot-instructions.md`)
- **Open in Editor**: Opens the file in VS Code's main editor
- **Review**: Sends content to Copilot Chat for review
- **Reload**: Manual refresh button to reload all files

### 2. Notes

Simple scratch pad for general notes:
- No template system (keeps it lightweight)
- Multi-note support for organizing thoughts

### 3. Local LLM

For prompting local Ollama models:
- **Templates**: Full template support with placeholders
- **Preview**: Preview expanded prompt before sending
- **Send to LLM**: Sends content to configured local Ollama instance
- **Copy**: Copies content to clipboard
- **Replies Section**: Shows LLM responses (max 50 entries)
- **Clear Replies**: Remove all reply history

### 4. AI Conversation

For bot conversation control and prompting:
- **Templates**: Full template support with placeholders
- **Preview**: Preview expanded prompt before sending
- **Send**: Starts or sends to the bot conversation system
- **Copy**: Copies content to clipboard
- **History Section**: Shows sent messages (max 50 entries)
- **Clear History**: Remove all history

### 5. Copilot

For GitHub Copilot Chat interactions:
- **Templates**: Full template support with placeholders
- **Preview**: Preview expanded prompt before sending
- **Send to Copilot**: Opens Copilot Chat with expanded prompt
- **Copy**: Copies content to clipboard
- No replies section (replies appear in Copilot Chat UI)

### 6. Tom AI Chat

For the agentic `.chat.md` workflow:
- **Templates**: Full template support with placeholders
- **Open**: Opens or creates today's `.chat.md` file
- **Preview**: Preview expanded prompt before insertion
- **Insert**: Inserts expanded prompt into the active `.chat.md` file after the CHAT header
- Integrates with the Tom AI Chat agentic loop (see `tom_ai_chat.md` guideline)

## Secondary Panel: TOM

A second bottom panel container `dartscript-t3-panel` (icon: `$(beaker)`, title: "TOM") registers `dartscript.t3Panel` with sample accordion sections:

| Section | ID | Icon | Purpose |
|---------|-----|------|---------|
| Tasks | `tasks` | `codicon-checklist` | Task tracking |
| Logs | `logs` | `codicon-output` | Log viewing |
| Settings | `settings` | `codicon-settings-gear` | Settings management |

## Implementation

### Architecture
- **Panel Provider**: `unifiedNotepad-handler.ts` — single `WebviewViewProvider` rendering all 6 accordion sections
- **Shared Logic**: `handler_shared.ts` — template editing, preview panels, placeholder expansion
- **Section View IDs** (internal): `dartscript.guidelinesNotepad`, `dartscript.notesNotepad`, `dartscript.localLlmNotepad`, `dartscript.conversationNotepad`, `dartscript.copilotNotepad`, `dartscript.tomAiChatNotepad`
- **Accordion Component**: Reusable CSS/JS accordion with animated expand/collapse (see `bottom_panel_accordion.md` guideline)
- **T3 Panel Provider**: `t3Panel-handler.ts` — separate panel with its own accordion

### Webview Panels (Editor Tab)
The extension also creates ad-hoc webview panels in the editor area for:
- **Prompt Preview**: Shows expanded prompt before sending
- **Template Editor**: Edit template content with syntax highlighting

### Storage
- **Notes/Templates**: Stored in VS Code's workspace state, persist across sessions
- **Guidelines**: Stored as files on disk, synced via file watcher
- **Replies/History**: Stored in workspace state, max 50 entries per section
