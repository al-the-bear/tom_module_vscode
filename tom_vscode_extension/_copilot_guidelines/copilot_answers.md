# Copilot Answer Files

## Overview

The Copilot Answer File system provides a bidirectional communication channel between Copilot prompts and responses. When using templates that request structured answers, Copilot writes its response to a JSON file that can be read, viewed, or used as variables in subsequent prompts.

## Answer File Location

Answer files are stored at:
```
~/.tom/copilot-chat-answers/{windowId}_answer.json
```

The `windowId` is a unique identifier combining the VS Code session ID and machine ID (first 8 characters of each), ensuring each VS Code window has its own answer file.

## Answer File Format (JSON)

```json
{
  "requestId": "20250115_143052",
  "generatedMarkdown": "<your response as a JSON-escaped string>",
  "comments": "<optional comments>",
  "references": ["<optional array of file paths>"],
  "requestedAttachments": ["<optional array of requested file paths>"],
  "responseValues": {
    "myKey": "myValue",
    "anotherKey": "anotherValue"
  }
}
```

### Field Descriptions

| Field | Required | Description |
|-------|----------|-------------|
| `requestId` | Yes | Timestamp ID (YYYYMMDD_HHMMSS) matching the request |
| `generatedMarkdown` | Yes | The main response content as a JSON-escaped string |
| `comments` | No | Additional notes or metadata about the response |
| `references` | No | Array of file paths that were referenced while forming the response |
| `requestedAttachments` | No | Array of file paths the user explicitly requested |
| `responseValues` | No | Key-value pairs saved for reuse in subsequent prompts via `${dartscript.chat.<key>}` |

## Response Values Reuse

Response values from the copilot answer file are **automatically saved** to a shared store when the answer file is detected. They become available immediately in all template contexts:

- **Copilot templates** (prefix/suffix in TOM AI Panel)
- **Send to Chat templates** (context menu / command palette)
- **Freeform prompts** in any panel textarea
- **Tom AI Chat** context instructions

### How it works

1. Copilot writes an answer file with `responseValues`
2. The extension detects the new file via the file system watcher
3. All key-value pairs from `responseValues` are stored in the shared chat answer store
4. Values persist for the entire session (until cleared or overwritten)
5. Subsequent prompts can reference them via `${dartscript.chat.<key>}`

### Clearing values

Use the command **"Clear Chat Answer Values"** from the command palette to reset all stored values.

## Placeholder Systems

There are two placeholder systems, both expanded when a prompt is sent:

### 1. Double-Brace Placeholders (`{{...}}`)

Expanded in all prompts (Copilot, Local LLM, Tom AI Chat):

| Placeholder | Description |
|-------------|-------------|
| `{{selection}}` | Current editor selection |
| `{{file}}` | Current file path (relative to workspace) |
| `{{filename}}` | Current file name only |
| `{{filecontent}}` | Full content of the current file |
| `{{clipboard}}` | Clipboard contents |
| `{{date}}` | Current date (locale format) |
| `{{time}}` | Current time (locale format) |
| `{{datetime}}` | Current date and time (locale format) |
| `{{requestId}}` | Timestamp-based ID (YYYYMMDD_HHMMSS) |
| `{{workspace}}` | Workspace folder name |
| `{{workspacepath}}` | Full workspace folder path |
| `{{language}}` | File language ID (e.g., typescript, dart) |
| `{{line}}` | Current cursor line number |
| `{{column}}` | Current cursor column number |

### 2. Template Variables (`${...}`)

Expanded in all prompts. These provide system values and access to stored response data:

| Variable | Description |
|----------|-------------|
| `${dartscript.datetime}` | Timestamp (YYYYMMDD_HHMMSS format) |
| `${dartscript.windowId}` | VS Code session ID (unique per window) |
| `${dartscript.machineId}` | VS Code machine ID (unique per machine) |
| `${dartscript.chatAnswerFolder}` | Configured chat answer folder path |
| `${dartscript.chat.<key>}` | Value from copilot answer `responseValues` |
| `${dartscript.chat.requestId}` | Request ID from last answer |
| `${dartscript.chat.generatedMarkdown}` | Main response from last answer |
| `${dartscript.chat.comments}` | Comments from last answer |

### Where placeholders can be used

| Context | `{{...}}` | `${dartscript.*}` |
|---------|-----------|-------------------|
| Copilot template prefix | Yes | Yes |
| Copilot template suffix | Yes | Yes |
| Answer File template suffix | Yes | Yes |
| Tom AI Chat context instructions | Yes | Yes |
| Local LLM prompt textarea | Yes | Yes |
| Send to Chat templates | No* | Yes |
| Local LLM system prompt | No | `${...}` (own format) |
| Local LLM result template | No | `${...}` (own format) |

*Send to Chat uses its own `${path}` expansion with parsed content data.

## Sample Configuration

### Basic Answer File template (in `tom_vscode_extension.json`)

```json
{
  "templates": {
    "__answer_file__": {
      "prefix": "Data requested by the user will be marked with data[key] to be inserted in responseValues.",
      "suffix": "---\nIMPORTANT: Write your answer to:\n${dartscript.chatAnswerFolder}/${dartscript.windowId}_${dartscript.machineId}_answer.json\n\nJSON structure:\n{\n  \"requestId\": \"{{requestId}}\",\n  \"generatedMarkdown\": \"<response>\",\n  \"responseValues\": { \"key\": \"value\" }\n}\n\nRequest ID: {{requestId}}\n",
      "showInMenu": true
    }
  }
}
```

### Template using response values from a previous answer

```json
{
  "templates": {
    "Follow Up": {
      "prefix": "Quest: ${dartscript.chat.quest}\n\nContinuing from your previous response:\n",
      "suffix": "\n\nPrevious request ID: ${dartscript.chat.requestId}",
      "showInMenu": true
    }
  }
}
```

### Template with data collection

```json
{
  "templates": {
    "Trail Reminder": {
      "prefix": "Quest: ${dartscript.chat.quest}\n\nREMINDER: Create trail file with timestamp ${dartscript.datetime}.\n",
      "suffix": "\n\nWrite data to \"${dartscript.chatAnswerFolder}/${dartscript.windowId}_${dartscript.machineId}_answer.json\" in JSON format",
      "showInMenu": true
    }
  }
}
```

## Answer File Workflow

1. **Create prompt with Answer File template** - Select "Answer File" from the template dropdown or create a custom template with the answer file suffix
2. **Send to Copilot** - Click Send to open the prompt in Copilot Chat
3. **Copilot writes answer** - Copilot processes the request and writes structured output to the answer file
4. **View or use the answer**:
   - Click the eye icon to view the answer in a modal
   - Use `${dartscript.chat.*}` variables in subsequent prompts
   - Click the extract icon to save to a markdown file

## Answer File Commands

| Command | Description |
|---------|-------------|
| `Show Chat Answer Values` | Display accumulated answer data in output channel |
| `Clear Chat Answer Values` | Reset the accumulated answer data |

## Answer Viewer Features

When an answer file exists, the Copilot section shows an **Answers** toolbar with:

- **Answer Ready** indicator
- **View Answer** button (eye icon) - Opens a modal displaying the structured answer
- **Extract to Markdown** button - Saves the answer to the copilot-answer.md file

## Configuration

### Custom Answer File Path

In `send_to_chat.json`:
```json
{
  "copilotAnswerPath": "_ai/copilot"
}
```

This controls where extracted markdown files are saved (default: `_ai/copilot`).

### Custom Answer File Template

Create a custom `__answer_file__` template in your `send_to_chat.json`:
```json
{
  "templates": {
    "__answer_file__": {
      "prefix": "Custom prefix here...",
      "suffix": "Custom answer instructions with {{requestId}} placeholder..."
    }
  }
}
```

## Implementation Notes

- Answer files are watched via file system watcher — the UI updates automatically when Copilot writes a response
- When an answer file with `responseValues` is detected, values are automatically propagated to the shared chat answer store
- Values are accessible via `${dartscript.chat.<key>}` in **all** template contexts (Copilot, Send to Chat, Tom AI Chat, Local LLM)
- Multiple answer values accumulate across the session (until cleared or overwritten by a new answer)
- Clearing answer values (via command palette) resets both the shared store and the Send to Chat data
- The request ID helps match prompts to responses when debugging
- The `{{requestId}}` placeholder is expanded at send time; use it instead of hardcoded values

## Send to Chat Answer File

The **Send to Chat** system uses a separate answer file path for Copilot communication via the context menu / command palette:

```
{workspace}/{chatAnswerFolder}/{sessionId}_{machineId}_answer.json
```

- `chatAnswerFolder` is configured in `send_to_chat.json` (default: `_ai/chat_replies`)
- `sessionId` and `machineId` are VS Code environment values

### Format

The Send to Chat answer file uses the same JSON format. Copilot writes the file, and the extension reads and parses it:

```json
{
  "response": "Summary of completed work...",
  "responseValues": {
    "status": "completed",
    "filesChanged": 3
  }
}
```

When `responseValues` are present, they are automatically propagated to the shared chat answer store — making them available as `${dartscript.chat.<key>}` in all template contexts.

### Ask Copilot Tool (Escalation)

The **Ask Copilot** tool (used by local LLMs to escalate questions to Copilot) uses the same answer file mechanism:

- The tool sends a prompt to Copilot Chat with a suffix instructing it to write a JSON answer file
- It then polls for the file and reads the response
- If the response contains `responseValues`, they are propagated to the shared store
- Configuration: `localLlmTools.askCopilot` section in `tom_vscode_extension.json`

```json
{
  "localLlmTools": {
    "askCopilot": {
      "answerFolder": "_ai/chat_replies",
      "promptSuffix": "...write to answer.json in JSON format with a response key..."
    }
  }
}
```

**Important:** All answer files use JSON format (`.json` extension). The legacy YAML format (`.yaml`) is no longer used.
