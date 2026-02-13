# Local LLM Integration

## Overview

The Local LLM section in the TOM AI Panel allows you to send prompts to locally-running language models using Ollama. It supports multiple model configurations, profiles with custom system prompts, tool calling, and conversation history.

## Requirements

- **Ollama** installed and running locally
- Models downloaded via `ollama pull <model-name>`

## Configuration

Local LLM settings are defined in the `promptExpander` section of `send_to_chat.json` (located at `~/.tom/vscode/send_to_chat.json`).

### Basic Configuration

```json
{
  "promptExpander": {
    "ollamaUrl": "http://localhost:11434",
    "model": "llama3:8b",
    "temperature": 0.7,
    "stripThinkingTags": true,
    "systemPrompt": "You are a helpful assistant.",
    "resultTemplate": "${rawResponse}",
    "toolsEnabled": false
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ollamaUrl` | string | http://localhost:11434 | Ollama server URL |
| `model` | string | required | Model name (e.g., llama3:8b, codellama:13b) |
| `temperature` | number | 0.7 | Sampling temperature (0=deterministic, 2=random) |
| `stripThinkingTags` | boolean | true | Remove `<think>...</think>` tags from output |
| `systemPrompt` | string | - | Default system prompt for all requests |
| `resultTemplate` | string | `${rawResponse}` | Template for formatting the response |
| `toolsEnabled` | boolean | false | Enable tool calling by default |

## Model Configurations

Define multiple model configurations for different use cases:

```json
{
  "promptExpander": {
    "models": {
      "fast": {
        "ollamaUrl": "http://localhost:11434",
        "model": "llama3:8b",
        "temperature": 0.5,
        "stripThinkingTags": true,
        "description": "Fast, general purpose",
        "isDefault": true
      },
      "code": {
        "ollamaUrl": "http://localhost:11434",
        "model": "codellama:13b",
        "temperature": 0.2,
        "stripThinkingTags": false,
        "description": "Optimized for code",
        "keepAlive": "10m"
      }
    }
  }
}
```

### Model Config Options

| Option | Type | Description |
|--------|------|-------------|
| `ollamaUrl` | string | Ollama server URL |
| `model` | string | Model name as known by Ollama |
| `temperature` | number | Sampling temperature |
| `stripThinkingTags` | boolean | Remove thinking tags |
| `description` | string | Human-readable description |
| `isDefault` | boolean | Mark as default model |
| `keepAlive` | string | Model keep-alive duration (e.g., "5m", "1h") |

## Profiles

Profiles allow you to save different prompt configurations:

```json
{
  "promptExpander": {
    "profiles": {
      "code-review": {
        "label": "Code Review",
        "systemPrompt": "You are a senior code reviewer. Focus on code quality, bugs, and best practices.",
        "resultTemplate": "## Code Review\n\n${rawResponse}",
        "temperature": 0.3,
        "modelConfig": "code",
        "toolsEnabled": true,
        "maxRounds": 5,
        "isDefault": false
      },
      "explain": {
        "label": "Explain Code",
        "systemPrompt": "Explain the code clearly for a junior developer.",
        "resultTemplate": "${rawResponse}",
        "temperature": 0.5,
        "modelConfig": null,
        "isDefault": true
      }
    }
  }
}
```

### Profile Options

| Option | Type | Description |
|--------|------|-------------|
| `label` | string | Display name in dropdown |
| `systemPrompt` | string | Override system prompt (null = inherit) |
| `resultTemplate` | string | Override result template (null = inherit) |
| `temperature` | number | Override temperature (null = inherit) |
| `modelConfig` | string | Model config key to use (null = default) |
| `isDefault` | boolean | Mark as default profile |
| `toolsEnabled` | boolean | Enable tool calling for this profile |
| `maxRounds` | number | Maximum tool-call rounds (default: 20) |
| `historyMode` | string | History handling: none, full, last, summary, trim_and_summary |

## Panel Actions

| Button | Action |
|--------|--------|
| **Profile dropdown** | Select a saved profile |
| **Add Profile** (+) | Create a new profile |
| **Edit Profile** (pencil) | Edit the selected profile |
| **Delete Profile** (trash) | Delete the selected profile |
| **Preview** | Show expanded prompt with placeholders resolved |
| **Send to LLM** | Send the prompt to Ollama |
| **Trail** (list icon) | Open the conversation trail file |

## Placeholder Support

Prompts support the standard placeholders:
- `{{selection}}` - Current editor selection
- `{{file}}` - Current file contents
- `{{clipboard}}` - Clipboard contents
- `{{date}}` - Current date

Result templates support:
- `${rawResponse}` - The raw LLM response
- `${thinkTagInfo}` - Content of removed thinking tags (if stripped)

## Trail File

Local LLM conversations are logged to a trail file at:
```
{workspace}/_ai/local/chat_trail.md
```

Each entry includes:
- Timestamp and profile used
- The prompt sent
- The model's response

Click the **Trail** button to open the trail file.

## Tool Calling

When `toolsEnabled: true` (in a profile or globally), the model can invoke read-only tools to gather information before generating its response. Tool calling is automatic — the model decides when and which tools to use.

### Available Tools

| Tool | Description |
|------|-------------|
| `tom_readFile` | Read a file from the workspace (with optional line range) |
| `tom_listDirectory` | List contents of a directory |
| `tom_findFiles` | Find files by glob pattern |
| `tom_findTextInFiles` | Search for text/regex across workspace files |
| `tom_fetchWebpage` | Fetch the text content of a URL |
| `tom_webSearch` | Web search via DuckDuckGo (no API key needed) |
| `tom_getErrors` | Get compile/lint errors from VS Code |
| `tom_readLocalGuideline` | Read from `_copilot_local/` guidelines |
| `tom_askBigBrother` | Escalate a question to VS Code Language Model API |
| `tom_askCopilot` | Escalate a question to Copilot Chat (writes answer file, waits for response) |

The `tom_askCopilot` tool communicates with Copilot via JSON answer files. When Copilot's response includes `responseValues`, they are automatically stored in the shared chat answer store and become available as `${dartscript.chat.<key>}` in all template contexts. See [copilot_answers.md](copilot_answers.md) for the complete answer file specification.

### How Tool Calls Work

1. The model receives your prompt along with the system prompt and tool definitions
2. If the model needs more information, it returns tool-call requests instead of text
3. The extension executes each tool and feeds the results back to the model
4. The model can make additional tool calls (multi-round) or produce its final answer
5. This continues up to `maxRounds` (default: 20) after which the model is forced to respond without tools

### Tool Call Configuration

```json
{
  "promptExpander": {
    "toolsEnabled": false,
    "profiles": {
      "research": {
        "label": "Research",
        "toolsEnabled": true,
        "maxRounds": 10,
        "systemPrompt": "You are a research assistant with access to workspace files...",
        "temperature": 0.3
      }
    }
  }
}
```

### Turn Budget

The model receives turn-budget notifications as system messages:
- Normal: "Turn X/Y — Z tool rounds remaining. When you have enough context, produce your final answer."
- Low (≤5 remaining): "You are running low on turns. Start wrapping up."
- Urgent (≤2 remaining): "URGENT: You are almost out of turns. Provide your FINAL answer now."
- Last round: Tools are not offered, forcing a text-only response

### Progress Display

During tool calling, the notification shows:
- `Sending to local <model>...` → initial status
- `Loading <model>...` → if model needs to be loaded into memory first
- `Processing prompt with <model>...` → model is generating
- `Tool #N: <toolName>(args...)` → each tool call is shown in real time

### Logging

All tool calls are logged to:
- **Output channel**: "Tom: Prompt Expander" output panel in VS Code (detailed args and results)
- **Trail file**: `{workspace}/_ai/local/chat_trail.md` (full conversation including tool calls)

## Placeholder Systems

### Prompt Placeholders (`{{...}}`)

Expanded when the prompt is sent from any panel:

| Placeholder | Description |
|-------------|-------------|
| `{{selection}}` | Current editor selection |
| `{{file}}` | Current file path (relative) |
| `{{filename}}` | Current file name |
| `{{filecontent}}` | Full file content |
| `{{clipboard}}` | Clipboard contents |
| `{{date}}` / `{{time}}` / `{{datetime}}` | Current date/time |
| `{{requestId}}` | Timestamp ID (YYYYMMDD_HHMMSS) |
| `{{workspace}}` | Workspace name |
| `{{workspacepath}}` | Workspace path |
| `{{language}}` | File language ID |
| `{{line}}` / `{{column}}` | Cursor position |

### Template Variables (`${dartscript.*}`)

Expanded in prompt templates alongside `{{...}}` placeholders:

| Variable | Description |
|----------|-------------|
| `${dartscript.datetime}` | Timestamp (YYYYMMDD_HHMMSS) |
| `${dartscript.windowId}` | VS Code session ID |
| `${dartscript.machineId}` | Machine ID |
| `${dartscript.chatAnswerFolder}` | Answer folder path |
| `${dartscript.chat.<key>}` | Value from copilot answer `responseValues` |

### System Prompt / Result Template Placeholders (`${...}`)

These are a **separate placeholder system** for system prompts and result templates configured in the `promptExpander` section. They are resolved by the prompt expander, NOT by `expandPlaceholders()`:

| Placeholder | Description |
|-------------|-------------|
| `${original}` | Original prompt text before expansion |
| `${response}` | Cleaned LLM response (think tags stripped if enabled) |
| `${rawResponse}` | Raw LLM response as received |
| `${thinkTagInfo}` | Extracted `<think>` tag content |
| `${filename}` | Active file basename |
| `${filePath}` | Full path to active file |
| `${languageId}` | VS Code language ID |
| `${workspaceName}` | Workspace folder name |
| `${datetime}` | Current date/time (yyyymmdd_hhmmss) |
| `${model}` | Ollama model name used |
| `${modelConfig}` | Model config key used |
| `${profile}` | Profile key used |
| `${lineStart}` / `${lineEnd}` | Selection line range (1-based) |
| `${turnsUsed}` | Tool-call rounds completed |
| `${turnsRemaining}` | Remaining tool-call rounds |
| `${maxTurns}` | Maximum tool-call rounds allowed |
| `${instructions}` | Content from `.tom/local-instructions/` |

### Bot Conversation Follow-Up Placeholders

Used in the `followUpTemplate` field of profiles:

| Placeholder | Description |
|-------------|-------------|
| `${goal}` | Original user goal/prompt |
| `${turn}` | Current turn number |
| `${maxTurns}` | Maximum turns configured |
| `${history}` | Formatted conversation history |

## History Modes

| Mode | Description |
|------|-------------|
| `none` | No conversation history |
| `full` | Keep full conversation history |
| `last` | Only keep last exchange |
| `summary` | Summarize long conversations |
| `trim_and_summary` | Trim old messages and summarize |

## Usage Workflow

1. **Select a profile** from the dropdown (or create one)
2. **Write your prompt** in the textarea
3. **Click Preview** to see the expanded prompt with all placeholders resolved
4. **Click Send to LLM** to get a response
5. **View the trail** to see the conversation history

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| "Connection refused" | Ensure Ollama is running (`ollama serve`) |
| "Model not found" | Pull the model first (`ollama pull <model>`) |
| Slow responses | Try a smaller model or reduce context |
| Empty responses | Check the trail file for errors |
| Tool calls failing | Check the "Tom: Prompt Expander" output panel for details |
