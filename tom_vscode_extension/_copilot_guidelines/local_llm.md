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

When `toolsEnabled: true`, the model can use read-only tools:
- File reading
- Web search
- Workspace search

Tools are called automatically when the model needs additional information.

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
3. **Click Preview** to see the expanded prompt
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
