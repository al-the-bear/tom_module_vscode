# Tom AI Chat

## Overview

Tom AI Chat is an automated chat system that uses `.chat.md` files as conversation documents. It provides a structured format for multi-turn conversations with AI assistants, supporting configuration headers, tool invocations, and iterative refinement.

## File Format

### Location

Chat files are stored in:
```
{workspace}/_ai/tom_ai_chat/chat_{YYYYMMDD}.chat.md
```

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
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `toolInvocationToken` | string | - | Token for tool invocation authentication |
| `modelId` | string | claude-sonnet-4-20250514 | Primary model for chat responses |
| `tokenModelId` | string | gpt-4.1-mini | Model for token counting |
| `preProcessingModelId` | string | - | Model for pre-processing prompts |
| `enablePromptOptimization` | boolean | false | Enable automatic prompt enhancement |
| `responsesTokenLimit` | number | 16000 | Max tokens for responses |
| `responseSummaryTokenLimit` | number | 4000 | Max tokens for response summaries |
| `maxIterations` | number | 100 | Maximum conversation iterations |
| `maxContextChars` | number | 50000 | Maximum context size in characters |
| `maxToolResultChars` | number | 50000 | Maximum tool result size |
| `maxDraftChars` | number | 8000 | Maximum draft size in characters |
| `contextFilePath` | string | - | Path to additional context file |

## Using the Tom AI Chat Section

### Panel Actions

| Button | Action | Description |
|--------|--------|-------------|
| **Open** | Opens/creates chat file | Creates a new dated `.chat.md` file or opens existing |
| **Preview** | Shows expanded prompt | Displays the prompt with all placeholders expanded |
| **Insert** | Inserts into chat file | Adds the prompt text to the open `.chat.md` file |

### Workflow

1. **Open a chat file** - Click "Open" to create or open today's chat file
2. **Write your prompt** - Enter your prompt in the Tom AI Chat textarea
3. **Click Insert** - Adds your prompt after the CHAT header line
4. **Run the chat processor** - External tool processes the `.chat.md` file

## Templates

### Configuration

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

### Template Fields

| Field | Description |
|-------|-------------|
| `contextInstructions` | System instructions prepended to every prompt |
| `prefix` | Text added before the prompt |
| `suffix` | Text added after the prompt |

## Chat Header Format

The chat header uses underscores and the word "CHAT" followed by an identifier:

```
_________ CHAT identifier ____________
```

- Must have at least 3 underscores before and after
- The identifier can be any alphanumeric string
- New prompts are inserted after this header line

## Insertion Behavior

When clicking **Insert**:
1. Extension looks for the CHAT header pattern
2. If found, inserts the prompt immediately after the header
3. If not found, inserts at the current cursor position

The prompt is automatically expanded using placeholders (`{{selection}}`, `{{file}}`, etc.) before insertion.

## Integration with Other Systems

### Placeholder Support

Tom AI Chat supports the same placeholders as the Copilot section:
- `{{selection}}` - Current editor selection
- `{{file}}` - Current file contents
- `{{clipboard}}` - Clipboard contents
- `{{date}}` - Current date

### Tool Output Files

The chat processor can write tool outputs to files in the chat directory, enabling multi-step automated workflows.

## Example Session

1. Click **Open** in Tom AI Chat section → Creates `_ai/tom_ai_chat/chat_20250115.chat.md`
2. Write: "Analyze the code in {{selection}} and suggest improvements"
3. Click **Insert** → Prompt with expanded selection is added to the file
4. External processor runs the chat and appends responses
5. Continue adding prompts for iterative refinement

## File Management

- Chat files are organized by date
- Multiple chats on the same day share one file
- Previous conversations are preserved above the CHAT header
- Each chat session starts fresh with a new header
