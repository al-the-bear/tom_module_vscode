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
| `responseValues` | No | Key-value pairs accessible via `${dartscript.chat.KEY}` in subsequent prompts |

## Built-in Answer File Template

When selecting **Answer File** from the Copilot section template dropdown, the extension appends instructions for Copilot to write its response to the answer file. The template includes:

- The answer file path
- Required JSON structure
- A unique request ID for matching prompts to responses
- Field descriptions for Copilot to follow

## Using Answer Values in Templates

After Copilot writes an answer file, the values become available as template variables using the `${dartscript.chat.KEY}` notation.

### Available Template Variables

| Variable | Description |
|----------|-------------|
| `${dartscript.datetime}` | Current timestamp (YYYYMMDD_HHMMSS) |
| `${dartscript.windowId}` | Unique window identifier |
| `${dartscript.machineId}` | VS Code machine ID |
| `${dartscript.chatAnswerFolder}` | Configured answer folder path |
| `${dartscript.chat.requestId}` | Request ID from last answer |
| `${dartscript.chat.generatedMarkdown}` | Main response from last answer |
| `${dartscript.chat.KEY}` | Custom value from responseValues (replace KEY with actual key) |
| `${dartscript.chat.comments}` | Comments from last answer |

### Example Template Usage

```
Based on your previous response:
${dartscript.chat.generatedMarkdown}

Custom value from last response: ${dartscript.chat.myKey}

Please now proceed with the implementation.
```

## Placeholders

### Standard Placeholders (`{{...}}` format)

These are expanded when the prompt is sent:

| Placeholder | Description |
|-------------|-------------|
| `{{selection}}` | Current editor selection |
| `{{file}}` | Current file path (relative) |
| `{{clipboard}}` | Clipboard contents |
| `{{date}}` | Current date |
| `{{requestId}}` | Unique timestamp ID (YYYYMMDD_HHMMSS) |

The `{{requestId}}` placeholder is useful for correlating prompts with responses - use the same ID in your prompt that appears in the answer file template.

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
      "suffix": "Custom answer instructions..."
    }
  }
}
```

## Implementation Notes

- Answer files are watched via file system watcher - the UI updates automatically when Copilot writes a response
- Multiple answer values accumulate in the `chatAnswerData` static object during a session
- Clearing answer values does not delete the answer file itself
- The request ID helps match prompts to responses when debugging
