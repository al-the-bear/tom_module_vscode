# Keybindings, Commands & Custom Actions

## Overview

The extension provides a layered command system built on VS Code keybindings, chord menus, configurable command sequences, and saved shell commands. All configurable parts are stored in `tom_vscode_extension.json`.

## Keybinding Map

### Chord Menus (two-key sequences)

Press the trigger key, then the action key. The chord menu stays open briefly for the second keypress.

| Trigger | Group | Actions |
|---------|-------|---------|
| `Ctrl+Shift+C` | Conversation | (B)egin · (S)top · (H)alt · (C)ontinue · (A)dd info |
| `Ctrl+Shift+L` | Local LLM | E(x)pand · (C)hange model · (S)tandard · (T)emplate |
| `Ctrl+Shift+A` | Send to Chat | Send to (C)hat · (S)tandard · (T)emplate · (R)eload config |
| `Ctrl+Shift+T` | Tom AI Chat | (N)ew chat · (S)end prompt · (I)nterrupt |
| `Ctrl+Shift+E` | Execute | (E)xecute · (A)dd · (D)elete · (O)pen config |
| `Ctrl+Shift+X` | Favorites | User-configured keys (see [Favorites](#favorites)) |

### Direct Keybindings

| Key | Command ID | Description |
|-----|-----------|-------------|
| `Ctrl+Shift+^` | `dartscript.combined.maximizeToggle` | Toggle full screen |
| `Ctrl+Shift+2` | `dartscript.combined.maximizeExplorer` | Toggle explorer sidebar |
| `Ctrl+Shift+3` | `dartscript.combined.maximizeEditor` | Toggle bottom panel |
| `Ctrl+Shift+4` | `dartscript.combined.maximizeChat` | Toggle chat sidebar |
| `Ctrl+Shift+Y` | `dartscript.stateMachine.vsWindowStateFlow` | Cycle panel visibility states |
| `Ctrl+Shift+0` | `dartscript.focusTomAI` | Focus TOM AI Panel |
| `Ctrl+Shift+8` | `dartscript.showStatusPage` | Extension status page |
| `Ctrl+Shift+9` | `dartscript.t3Panel.focus` | Focus TOM Panel |

---

## Favorites

User-configurable shortcut picker invoked via `Ctrl+Shift+X`. Each entry maps a single key to a VS Code command or a sequence of commands.

### Configuration

Located in `tom_vscode_extension.json` → `favorites` array:

```json
{
  "favorites": [
    {
      "key": "0",
      "label": "Reload Window",
      "commandId": "workbench.action.reloadWindow"
    },
    {
      "key": "x",
      "label": "Toggle Both Sidebars",
      "commandIds": [
        "workbench.action.toggleSidebarVisibility",
        "workbench.action.toggleAuxiliaryBar"
      ]
    }
  ]
}
```

### Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Single character (0-9, a-z) shown in the picker |
| `label` | string | Yes | Display label |
| `commandId` | string | Yes* | Single VS Code command ID to execute |
| `commandIds` | string[] | No | Multiple VS Code command IDs executed sequentially (overrides `commandId`) |

*Required unless `commandIds` is provided (first entry becomes fallback `commandId`).

The picker shows auto-assigned keys for fast keyboard selection. Press `?` to show the quick reference card.

---

## Combined Commands

Named command sequences mapped to direct keybindings. Each entry executes its commands in order.

### Configuration

Located in `tom_vscode_extension.json` → `combinedCommands` object:

```json
{
  "combinedCommands": {
    "maximizeToggle": {
      "label": "Maximize Toggle",
      "commands": [
        "workbench.action.toggleFullScreen"
      ]
    },
    "maximizeExplorer": {
      "label": "Toggle Explorer Sidebar",
      "commands": [
        "workbench.action.toggleSidebarVisibility"
      ]
    }
  }
}
```

### Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | No | Human-readable name (defaults to the key name) |
| `commands` | string[] | Yes | VS Code command IDs executed in sequence |

### Registered Command IDs

Each key maps to `dartscript.combined.<name>`:

| Config Key | Command ID | Default Keybinding |
|-----------|------------|-------------------|
| `maximizeToggle` | `dartscript.combined.maximizeToggle` | `Ctrl+Shift+^` |
| `maximizeExplorer` | `dartscript.combined.maximizeExplorer` | `Ctrl+Shift+2` |
| `maximizeEditor` | `dartscript.combined.maximizeEditor` | `Ctrl+Shift+3` |
| `maximizeChat` | `dartscript.combined.maximizeChat` | `Ctrl+Shift+4` |

---

## State Machine Commands

State machine commands execute different action sets based on current state, enabling cyclic workflows with a single keybinding.

### Architecture

```
[No State] ──► Init Actions ──► Initial State
                                      │
     ┌────────────────────────────────┘
     ▼
State A ──► Action Set 1 ──► State B
State B ──► Action Set 2 ──► State C
State C ──► Action Set 3 ──► State A  (cycle)

[Reset Command] ──► Reset Actions ──► Clear All State
```

### Configuration

Located in `tom_vscode_extension.json` → `stateMachineCommands` object:

```json
{
  "stateMachineCommands": {
    "vsWindowStateFlow": {
      "label": "Markdown Preview Toggle",
      "initActions": {
        "endState": "noPreview",
        "executeStateAction": false,
        "commands": []
      },
      "resetActions": {
        "commands": []
      },
      "stateActions": [
        {
          "startState": "noPreview",
          "endState": "hasPreview",
          "commands": ["markdown.showPreviewToSide"]
        },
        {
          "startState": "hasPreview",
          "endState": "noPreview",
          "commands": [
            "workbench.action.editorLayoutSingle",
            "{ const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs); for (const t of tabs) { if (t.label.startsWith('Preview ') && t.label.endsWith('.md')) await vscode.window.tabGroups.close(t); } }"
          ]
        }
      ]
    }
  }
}
```

### Root Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `label` | string | Yes | Human-readable name for the command |
| `initActions` | object | Yes | Actions to run on first invocation |
| `resetActions` | object | No | Actions to run when state is reset |
| `stateActions` | array | Yes | Array of state transition definitions |

### initActions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `endState` | string | Yes | State to set after init completes |
| `executeStateAction` | boolean | No | If `true`, immediately execute the state action for `endState` after init (default: `false`) |
| `commands` | string[] | Yes | Commands to execute during initialization |

### resetActions

| Property | Type | Description |
|----------|------|-------------|
| `commands` | string[] | Commands to execute when resetting state |

### stateActions (array items)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `startState` | string | Yes | State required to execute this action set |
| `endState` | string | Yes | State to transition to after execution |
| `commands` | string[] | Yes | Commands to execute (VS Code IDs or JavaScript fragments) |

### State Storage

- State is stored **in-memory** per VS Code window session
- State does **not** persist across VS Code restarts
- Each window maintains independent state
- State is keyed by VS Code command ID

### Validation

On first execution:
- Each `startState` must be unique across all `stateActions` (duplicates trigger an error)
- All states should be reachable from the init state

### Registered Command IDs

| Config Key | Command ID | Default Keybinding |
|-----------|------------|-------------------|
| `vsWindowStateFlow` | `dartscript.stateMachine.vsWindowStateFlow` | `Ctrl+Shift+Y` |

Reset all state machines: `dartscript.resetMultiCommandState` (command palette or favorites).

---

## Commandline Manager

Save, organize, and execute shell commands or VS Code JavaScript expressions from a quick-pick menu.

### Chord Menu

| Key | Action |
|-----|--------|
| `Ctrl+Shift+E → E` | Pick from saved commands and execute |
| `Ctrl+Shift+E → A` | Add a new command (multi-step wizard) |
| `Ctrl+Shift+E → D` | Delete a saved command |
| `Ctrl+Shift+E → O` | Open config file in editor |

### Configuration

Located in `tom_vscode_extension.json` → `commandlines` array:

```json
{
  "commandlines": [
    {
      "command": "git status",
      "description": "",
      "cwd": "/Users/me/projects/myrepo"
    },
    {
      "command": "./reinstall_for_testing.sh",
      "description": "Reinstall + reload window",
      "cwd": "/path/to/extension",
      "postActions": ["workbench.action.reloadWindow"]
    },
    {
      "command": "vscode.env.openExternal(vscode.Uri.file(os.homedir() + '/.tom'))",
      "description": "Open ~/.tom in Finder",
      "cwdMode": "none"
    }
  ]
}
```

### Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | Yes | Shell command or `vscode.` JavaScript expression |
| `description` | string | Yes | Display label (falls back to command if empty) |
| `cwdMode` | CwdMode | No | How the working directory is resolved (see below) |
| `cwd` | string | No | Absolute or relative path, used when `cwdMode` is `custom` or for legacy entries |
| `postActions` | string[] | No | VS Code command IDs to execute after the command finishes |

### CWD Modes

| Mode | Resolution |
|------|-----------|
| `none` | No working directory (used for `vscode.` expressions) |
| `workspace` | First workspace folder root |
| `extension` | Extension installation directory |
| `project` | Walk up from active file looking for `buildkit.yaml` or `pubspec.yaml` |
| `repository` | Walk up from active file looking for `.git` |
| `document` | Directory of the active editor file |
| `custom` | Uses the `cwd` field (absolute or resolved against workspace root) |

Dynamic modes (`project`, `repository`, `document`) show a confirmation dialog with the resolved path before execution.

### Command Placeholders

Commands support these placeholders (expanded at execution time):

| Placeholder | Description |
|-------------|-------------|
| `${currentfile.name}` | Active file name (without extension) |
| `${currentfile.ext}` | Active file extension |
| `${currentfile.path}` | Active file full path |
| `${selection}` | Current editor selection text |

### Post-Actions

Post-actions are VS Code commands executed **after** a shell command completes successfully. They require VS Code's Shell Integration to detect command completion.

- If shell integration is available: actions execute immediately after the command finishes
- If shell integration is unavailable: post-actions are **skipped** with a warning
- For `vscode.` expressions: post-actions execute immediately after the expression resolves

### Post-Action Definitions

The available post-action options are defined in `tom_vscode_extension.json` → `commandlinePostActions` array. These appear in the quick-pick when adding commands:

```json
{
  "commandlinePostActions": [
    {
      "commandId": "workbench.action.reloadWindow",
      "label": "Reload Window",
      "description": "Reload the VS Code window"
    },
    {
      "commandId": "workbench.action.terminal.focus",
      "label": "Focus Terminal",
      "description": "Focus the integrated terminal"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `commandId` | string | Yes | VS Code command ID |
| `label` | string | Yes | Display label in the picker |
| `description` | string | No | Description shown in the picker |

If `commandlinePostActions` is not configured, built-in defaults are used (Reload Window, Focus Terminal, Revert Active File, Git Refresh, Run Task, Start Debugging, Open Config).

---

## JavaScript Execution

The extension supports two distinct JavaScript execution contexts:

### 1. Commandline JavaScript Expressions (`vscode.` prefix)

In the **commandlines** system, any command starting with `vscode.` is executed as a JavaScript expression instead of a shell command:

```json
{
  "command": "vscode.env.openExternal(vscode.Uri.file(os.homedir() + '/.tom'))",
  "description": "Open ~/.tom in Finder",
  "cwdMode": "none"
}
```

**Available context:**

| Variable | Type | Description |
|----------|------|-------------|
| `vscode` | object | Full VS Code extension API |
| `path` | module | Node.js `path` module |
| `fs` | module | Node.js `fs` module |
| `os` | module | Node.js `os` module |

The expression is wrapped in an async IIFE, so `await` works:
```
vscode.window.showInformationMessage(await vscode.env.clipboard.readText())
```

CWD resolution is skipped for `vscode.` expressions. Use `cwdMode: "none"`.

### 2. State Machine / Combined Command JavaScript Fragments (`{ }`)

In **stateActions** and **combinedCommands**, any command string wrapped in `{ }` is executed as an inline JavaScript fragment:

```json
{
  "commands": [
    "workbench.action.toggleFullScreen",
    "{ vscode.window.showInformationMessage('Toggled!'); }",
    "{ await new Promise(r => setTimeout(r, 500)); }"
  ]
}
```

**Available context:**

| Variable | Type | Description |
|----------|------|-------------|
| `vscode` | object | Full VS Code extension API |
| `require` | function | Node.js require function |

### Key Differences

| Feature | Commandline (`vscode.` prefix) | State Machine / Combined (`{ }`) |
|---------|-------------------------------|----------------------------------|
| Detection | Starts with `vscode.` | Wrapped in `{ }` |
| Context | vscode, path, fs, os | vscode, require |
| Async | Yes (auto-wrapped in async IIFE) | Yes (await supported) |
| Post-actions | Yes | No |
| CWD | Skipped | Not applicable |
| Where used | `commandlines` entries | `combinedCommands`, `stateMachineCommands`, `favorites` (via commandIds) |

---

## Trail Configuration

Trail logging records AI interactions (prompts, responses, tool calls) to files. Configured in `tom_vscode_extension.json` → `trail`:

```json
{
  "trail": {
    "enabled": true,
    "paths": {
      "local": "_ai/local/trail",
      "conversation": "_ai/conversation/trail",
      "tomai": "_ai/tomai/trail",
      "copilot": "_ai/copilot/trail"
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Master switch for trail logging |
| `paths.local` | string | Trail folder for Local LLM interactions |
| `paths.conversation` | string | Trail folder for Bot Conversation sessions |
| `paths.tomai` | string | Trail folder for Tom AI Chat sessions |
| `paths.copilot` | string | Trail folder for Copilot answer file interactions |

Paths are relative to the workspace root. Toggle at runtime via the `DS: Toggle AI Trail Logging` command or favorites key `h`.
