# DS Notes Panel

The DS Notes panel provides 5 specialized notepads for different development workflows, accessible from the bottom panel in VS Code.

## Notepads Overview

| Notepad | Purpose | Features |
|---------|---------|----------|
| **Guidelines** | Edit Copilot instructions and guidelines | File-based, file watcher, syncs with `.github/copilot-instructions.md` and `_copilot_guidelines/` |
| **Notes** | General-purpose scratch notes | Multi-note, persistent storage |
| **Local LLM** | Send prompts to local LLM | Multi-note, templates, placeholders, preview, replies |
| **AI Conversation** | Send prompts to AI chat | Multi-note, templates, placeholders, preview, replies |
| **Copilot** | Send prompts to GitHub Copilot | Multi-note, templates, placeholders, preview |

## Common Features

### Multi-Note Support
All notepads except Guidelines support multiple notes:
- **Add Note**: Click "+ Add" button to create a new note
- **Select Note**: Use the dropdown to switch between notes
- **Delete Note**: Click the 🗑️ button to delete the current note

### Auto-Save
All content is automatically saved after 500ms of inactivity. Notes persist across VS Code sessions.

### Character Counter
Each notepad shows the character count in the status bar.

## Template System

The Local LLM, AI Conversation, and Copilot notepads support templates:

### Template Operations
- **Save as Template**: Click "💾 Save" to save current content as a reusable template
- **Select Template**: Use the template dropdown to browse saved templates
- **Apply Template**: Click "Apply" to load the selected template into the current note
- **Delete Template**: Click 🗑️ next to template selector to delete

### Template Placeholders
Use placeholders in your templates for dynamic content:

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
Click "Preview" to see placeholders expanded before sending. The preview modal allows you to:
- View the expanded prompt
- Edit if needed
- Send directly from the preview

## Guidelines Notepad

The Guidelines notepad provides quick editing of Copilot instruction files:

- **Files**: Loads `copilot-instructions.md` and all `.md` files from `_copilot_guidelines/`
- **File Watcher**: Automatically reloads when files change on disk
- **Add Guideline**: Creates a new markdown file in `_copilot_guidelines/`
- **Delete**: Can delete guideline files (except `copilot-instructions.md`)
- **Open in Editor**: Opens the file in VS Code's main editor
- **Review**: Sends content to Copilot chat for review
- **Reload**: Manual refresh button to reload all files

## Notes Notepad

Simple scratch pad for general notes:
- No template system (keeps it lightweight)
- Perfect for quick notes during development

## Local LLM Notepad

For interacting with local language models:
- **Templates**: Full template support with placeholders
- **Preview**: Preview expanded prompt before sending
- **Send to LLM**: Sends current content to configured local LLM
- **Copy**: Copies content to clipboard
- **Replies Section**: Shows responses from the LLM (max 50 entries)
- **Clear Replies**: Remove all reply history

> **Note**: Local LLM integration is pending. Currently shows placeholder replies.

## AI Conversation Notepad

For AI chat interactions:
- **Templates**: Full template support with placeholders
- **Preview**: Preview expanded prompt before sending
- **Send to AI**: Opens VS Code chat with the expanded prompt
- **Copy**: Copies content to clipboard
- **History Section**: Shows sent messages (max 50 entries)
- **Clear History**: Remove all history

## Copilot Notepad

For GitHub Copilot interactions:
- **Templates**: Full template support with placeholders
- **Preview**: Preview expanded prompt before sending
- **Send to Copilot**: Opens Copilot chat with expanded prompt
- **Copy**: Copies content to clipboard
- No replies section (replies appear in Copilot chat)

## Example Template

```
Review this {{language}} code from {{filename}}:

```{{language}}
{{selection}}
```

Please check for:
1. Potential bugs
2. Performance issues
3. Best practices

Date: {{date}}
```

## Keyboard Shortcuts

Currently no dedicated keyboard shortcuts. Access via:
- Bottom panel → DS Notes tab
- Each notepad has its own collapsible section

## Storage

- **Notes/Templates**: Stored in VS Code's workspace state, persist across sessions
- **Guidelines**: Stored as files on disk, synced via file watcher
- **Replies/History**: Stored in workspace state, max 50 entries per notepad

## Future Enhancements

Potential future features:
1. Local LLM integration (Ollama, LM Studio, etc.)
2. Export/import templates
3. Keyboard shortcuts for common actions
4. Template categories/folders
5. Reply capture from VS Code chat
