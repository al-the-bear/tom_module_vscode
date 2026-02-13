# Tom Extension Status Page

The Status Page is a full-tab webview panel showing the extension's configuration and live service status. It provides a central dashboard for managing bridge connections, AI services, Telegram integration, and all configurable AI subsystems.

**Command:** `dartscript.showStatusPage`
**Keybinding:** `Ctrl+Shift+8`
**Opens in:** Active editor column (full editor-tab webview)
**Implementation:** `statusPage-handler.ts`

## Sections

The page contains 8 collapsible sections, each with a status badge where applicable:

### 1. Tom CLI Integration Server

| Item | Description |
|------|-------------|
| Status badge | **Running** (green) with port number / **Stopped** (red) |
| Start button | Start the CLI TCP server (auto-selects port 19900–19909) |
| Stop button | Stop the CLI integration server |

### 2. Tom Bridge

| Item | Description |
|------|-------------|
| Status badge | **Connected** (green) / **Disconnected** (red) |
| Restart button | Restart the Dart bridge process |
| Profile switcher | Select between bridge profiles (e.g., development, production) |

### 3. AI Trail Logging

| Item | Description |
|------|-------------|
| Status badge | **Enabled** (green) / **Disabled** (grey) |
| Toggle | Turn trail logging on/off |

Trail logging records AI interactions (Send to Chat, Ask Copilot, Local LLM) to timestamped files for auditing and context replay.

### 4. Local LLM Settings

Configures the Ollama-based prompt expander:

| Setting | Description |
|---------|-------------|
| Ollama URL | Base URL for the Ollama API |
| Model | Active model name |
| Temperature | Generation temperature |
| Strip thinking tags | Auto-remove `<think>` blocks from reasoning models |
| Expansion profile | Default profile for prompt expansion |
| Tools | Enable/disable tool calling in LLM requests |
| Trail summarization | Enable/disable trail summarization |

### 5. AI Conversation Settings

Configures the bot conversation system:

| Setting | Description |
|---------|-------------|
| Max turns | Maximum conversation turns |
| Temperature | Generation temperature |
| History mode | `full`, `last`, `summary`, `trim_and_summary` |
| Conversation mode | `ollama-copilot` or `ollama-ollama` |
| Tools | Enable/disable tool calling |
| Trail summarization | Enable/disable trail summarization |

### 6. Telegram Settings

Configures and controls the Telegram bot integration:

| Item | Description |
|------|-------------|
| Status badge | **Active** (green) / **Inactive** (grey) |
| Start/Stop | Start or stop Telegram polling |
| Test button | Send a test message to verify configuration |
| Bot token env | Environment variable name for bot token |
| Chat ID | Telegram chat ID for notifications |
| Poll interval | Polling interval in milliseconds |
| Notification toggles | Enable/disable specific notification types |

### 7. Ask Copilot

Configures the escalation tool for automated Copilot prompting:

| Setting | Description |
|---------|-------------|
| Enabled | Master switch for Ask Copilot |
| Answer timeout | Timeout waiting for answer file (ms) |
| Poll interval | How often to check for answer file (ms) |
| Answer folder | Directory where answer files are written |
| Prompt prefix | Text prepended to every prompt |
| Prompt suffix | Text appended to every prompt |
| Answer path | Path pattern for answer files |

### 8. Ask Big Brother

Configures the secondary AI escalation path:

| Setting | Description |
|---------|-------------|
| Enabled | Master switch for Ask Big Brother |
| Default model | Model to use for requests |
| Temperature | Generation temperature |
| Max tool iterations | Maximum number of tool-calling rounds |
| Tools by default | Whether to enable tools without explicit request |
| Summarization | Enable response summarization |
| Max response chars | Maximum response length |

## Architecture

- **Type ID:** `tomStatusPage`
- **Title:** "Tom Extension Status"
- **Panel type:** `vscode.window.createWebviewPanel()` — a full editor-tab webview (not a bottom panel view)
- **Message handling:** Bidirectional postMessage between webview HTML and extension host
- **Live updates:** Status badges update when services start/stop
- **Configuration persistence:** Changes are saved to the extension config file (`~/.tom/vscode/tom_vscode_extension.json`)
