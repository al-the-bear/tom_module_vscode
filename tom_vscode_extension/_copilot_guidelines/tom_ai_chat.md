# Tom AI Chat

## Overview

Tom AI Chat is an agentic chat system that uses `.chat.md` files as conversation documents. It provides structured multi-turn conversations with AI models, supporting configuration headers, tool invocations (60+ workspace tools), iterative refinement, and automatic response management.

## Table of Contents

- [File Format](#file-format)
- [Configuration Options](#configuration-options)
- [Commands & Keybindings](#commands--keybindings)
- [Bottom Panel Integration](#bottom-panel-integration)
- [Prompt Processing Flow](#prompt-processing-flow)
- [Prompt Extraction Rules](#prompt-extraction-rules)
- [Post-Processing](#post-processing)
- [Output Channels](#output-channels)
- [Tool Support](#tool-support)
- [Template System](#template-system)
- [Placeholder Support](#placeholder-support)
- [File Management](#file-management)
- [Appendix: Unimplemented Design Features](#appendix-unimplemented-design-features)

## File Format

### Location

Chat files are stored in:
```
{workspace}/_ai/tom_ai_chat/chat_{YYYYMMDD}.chat.md
```

Companion files live in the same folder:
- `<chat-id>.responses.md` — accumulated responses (newest at top)
- `<chat-id>.response-summary.md` — summarized responses for context

### File Structure

```markdown
toolInvocationToken:
modelId: claude-sonnet-4-20250514
tokenModelId: gpt-4.1-mini
preProcessingModelId: 
enablePromptOptimization: false
responsesTokenLimit: 16000
responseSummaryTokenLimit: 4000
maxIterations: 100
maxContextChars: 50000
maxToolResultChars: 50000
maxDraftChars: 8000
contextFilePath:

_________ CHAT chat_20250115 ____________

Your prompt goes here after the header...

______________________________

... older prompts below separators ...
```

### Chat Header Format

The chat header uses underscores and the word "CHAT" followed by an identifier:

```
_________ CHAT identifier ____________
```

- Must have at least 3 underscores before and after
- The identifier can be any alphanumeric string (typically `chat_YYYYMMDD`)
- New prompts are inserted after this header line
- Completed prompts are pushed below separator lines

### Separator Lines

- Separator lines: `---` or `___` (at least three characters, may be longer)
- Generated separator: exactly 30 underscores
- Separate completed prompts from active prompt area

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `toolInvocationToken` | string | — | Token for tool invocation (auto-populated on Start) |
| `modelId` | string | `claude-sonnet-4-20250514` | Primary model for chat responses |
| `tokenModelId` | string | `gpt-4.1-mini` | Model for token counting |
| `preProcessingModelId` | string | — | Model for pre-processing prompts |
| `enablePromptOptimization` | boolean | `false` | Enable automatic prompt enhancement |
| `responsesTokenLimit` | number | `16000` | Max tokens for responses file |
| `responseSummaryTokenLimit` | number | `4000` | Max tokens for response summaries |
| `maxIterations` | number | `100` | Maximum conversation iterations |
| `maxContextChars` | number | `50000` | Maximum context size in characters |
| `maxToolResultChars` | number | `50000` | Maximum tool result size |
| `maxDraftChars` | number | `8000` | Maximum draft size in characters |
| `contextFilePath` | string | — | Path to additional context file to include |

## Commands & Keybindings

| Command ID | Title | Keybinding | Scope | Description |
|------------|-------|------------|-------|-------------|
| `dartscript.startTomAIChat` | Tom AI: Start Chat | `Ctrl+Cmd+N` | `.chat.md` files | Initialize chat file with metadata and CHAT header |
| `dartscript.sendToTomAIChat` | Tom AI: Send Prompt | `Ctrl+Cmd+S` | `.chat.md` files | Run agentic loop on current prompt |

### Chord Menu (Ctrl+Shift+T)

| Key | Action |
|-----|--------|
| `N` | Start/initialize chat |
| `S` | Send prompt |
| `I` | Interrupt running request |

### Start Chat Workflow

1. Validates active editor is a `.chat.md` file
2. Inserts metadata header and `CHAT <chat-id>` marker if missing
3. Overwrites companion `<chat-id>.responses.md` and `<chat-id>.response-summary.md`
4. Acquires `toolInvocationToken` via chat participant

### Send Prompt Workflow

1. Parses prompt block from `.chat.md` (text between CHAT header and first separator)
2. Generates response summary if `<chat-id>.responses.md` exists
3. Assembles prompt with summary attachment and template wrapping
4. Sends to LM API with tools enabled
5. Executes tool calls in iterative loop (logs to Tom AI Chat Log output)
6. Writes final response to `<chat-id>.responses.md` (newest at top)
7. Inserts separator above processed prompt, repositions cursor for next input

## Bottom Panel Integration

The Tom AI Chat section in the TOM AI bottom panel provides:

| Button | Action | Description |
|--------|--------|-------------|
| **Open** | Opens/creates chat file | Creates a new dated `.chat.md` file or opens existing |
| **Preview** | Shows expanded prompt | Displays the prompt with all placeholders expanded |
| **Insert** | Inserts into chat file | Adds the expanded prompt text after the CHAT header |

### Insertion Behavior

When clicking **Insert**:
1. Extension looks for the CHAT header pattern in the active `.chat.md` file
2. If found, inserts the expanded prompt immediately after the header
3. If not found, inserts at the current cursor position

## Prompt Processing Flow

1. **Pre-flight summary step:**
   - Skip if `<chat-id>.responses.md` does not exist
   - Otherwise summarize responses into `<chat-id>.response-summary.md`

2. **Prompt assembly:**
   - Attach summary file as context reference
   - Wrap user prompt in template with instructions to review previous responses

3. **Tool execution:**
   - Tool call logs → **Tom AI Chat Log** output channel
   - Supports iterative tool-calling loops (up to `maxIterations`)

4. **Final response:**
   - Final markdown response → **Tom AI Chat Responses** output channel
   - Stored at top of `<chat-id>.responses.md` (newest first)

## Prompt Extraction Rules

- Active prompt = text between CHAT header and first separator line
- Only the first block is used (single block, may span multiple lines)
- Separator lines: lines starting with `---` or `___` (three or more characters)

## Post-Processing

After response completion:
- Check size of `<chat-id>.responses.md`, remove oldest entries until within `responsesTokenLimit`
- Token estimates use `model.countTokens()` with `tokenModelId`
- Apply `responseSummaryTokenLimit` to summary file
- Insert separator line and blank lines above the processed prompt
- Move cursor to new blank prompt area (between header and separator)

## Output Channels

| Channel | Content |
|---------|---------|
| **Tom AI Chat Log** | Tool invocation requests and intermediate output |
| **Tom AI Chat Responses** | Final user-facing responses in markdown |

## Tool Support

**14 registered LM tools:** `tom_createFile`, `tom_readFile`, `tom_editFile`, `tom_multiEditFile`, `tom_listDirectory`, `tom_findFiles`, `tom_findTextInFiles`, `tom_runCommand`, `tom_runVscodeCommand`, `tom_getErrors`, `tom_fetchWebpage`, `tom_readGuideline`, `tom_webSearch`, `tom_manageTodo`

Tools provide file I/O, terminal execution, search, diagnostics, web access, and persistent task tracking for multi-step agentic workflows.

## Template System

Templates for Tom AI Chat are defined in `send_to_chat.json`:

```json
{
  "tomAiChat": {
    "templates": {
      "My Template": {
        "contextInstructions": "System context to prepend...",
        "prefix": "Optional prefix",
        "suffix": "Optional suffix"
      }
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `contextInstructions` | System instructions prepended to every prompt |
| `prefix` | Text added before the prompt |
| `suffix` | Text added after the prompt |

## Placeholder Support

Tom AI Chat supports the same placeholders as other panel sections:

| Placeholder | Expansion |
|-------------|-----------|
| `{{selection}}` | Current editor selection |
| `{{file}}` | Current file contents |
| `{{clipboard}}` | Clipboard contents |
| `{{date}}` | Current date |
| `{{time}}` | Current time |
| `{{datetime}}` | Date and time |
| `{{language}}` | File language ID |
| `{{workspace}}` | Workspace name |

## File Management

- Chat files organized by date (`chat_YYYYMMDD`)
- Multiple chats on the same day share one file
- Previous conversations preserved above the CHAT header
- Each chat session starts fresh with a new header
- Metadata is plain text and user-editable

## Appendix: Unimplemented Design Features

The following features were described in the original Tom AI Chat design document but have not been implemented:

| Feature | Design Description | Status |
|---------|-------------------|--------|
| `toolInvocationToken` auto-refresh | Auto-refresh when token expires during long sessions | Not implemented — token must be re-acquired by running Start Chat again |
| Pre-processing model step | Use `preProcessingModelId` for cheap-model context gathering before main prompt | Partially implemented — config field exists but pre-processing behavior may be limited |
| Token usage reporting | Report actual token consumption per request | Not surfaced to user — used internally for trimming |
