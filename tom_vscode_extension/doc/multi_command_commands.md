# Multi-Command Commands — Detailed Reference

This document describes the multi-command system in the DartScript VS Code Extension, including simple command sequences and state machine commands.

## Overview

The multi-command system allows mapping VS Code commands or keybindings to:

1. **Simple Command Sequences** — Execute a fixed list of commands in order
2. **State Machine Commands** — Execute different command sets based on current state, cycling through states

Both types support:
- VS Code command IDs (e.g., `workbench.action.toggleSidebarVisibility`)
- JavaScript fragments wrapped in `{ }` for inline evaluation

## Configuration Location

All multi-command configurations are stored in `send_to_chat.json`:

| Section | Purpose |
|---------|---------|
| `combinedCommands` | Named command sequences triggered by keybindings |
| `favorites` | Chord menu entries with `commandIds` arrays |
| `stateMachineCommands` | State-based command configurations |

## Simple Command Sequences

### In combinedCommands

```json
{
  "combinedCommands": {
    "maximizeToggle": {
      "label": "Maximize Toggle",
      "commands": [
        "workbench.action.toggleFullScreen"
      ]
    }
  }
}
```

### In favorites

```json
{
  "favorites": [
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

## State Machine Commands

State machine commands execute different action sets based on the current state, enabling cyclic workflows with a single keybinding.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    State Machine                         │
├─────────────────────────────────────────────────────────┤
│  [No State] ──► Init Actions ──► Initial State          │
│                                        │                 │
│       ┌────────────────────────────────┘                 │
│       ▼                                                  │
│  State A ──► Action Set 1 ──► State B                   │
│  State B ──► Action Set 2 ──► State C                   │
│  State C ──► Action Set 3 ──► State A  (cycle)          │
│                                                          │
│  [Reset Command] ──► Reset Actions ──► Clear All State  │
└─────────────────────────────────────────────────────────┘
```

### State Storage

- State is stored **in-memory** per VS Code window session
- State is keyed by the VS Code command ID
- State does **not** persist across VS Code restarts (no persistent window ID)
- Each window maintains independent state

### Configuration Schema

```json
{
  "stateMachineCommands": {
    "vsWindowStateFlow": {
      "label": "Window Panel State Flow",
      "initActions": {
        "endState": "default",
        "executeStateAction": false,
        "commands": [
          "workbench.view.explorer",
          "workbench.action.focusPanel",
          "workbench.action.focusAuxiliaryBar"
        ]
      },
      "resetActions": {
        "commands": [
          "workbench.view.explorer",
          "workbench.action.focusPanel",
          "workbench.action.focusAuxiliaryBar"
        ]
      },
      "stateActions": [
        {
          "startState": "default",
          "endState": "noExplorer",
          "commands": ["workbench.action.toggleSidebarVisibility"]
        },
        {
          "startState": "noExplorer",
          "endState": "noExplorerAndBottomPanel",
          "commands": ["workbench.action.togglePanel"]
        }
      ]
    }
  }
}
```

### Configuration Properties

#### Root Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `label` | string | Yes | Human-readable name for the command |
| `initActions` | object | Yes | Actions to run on first invocation |
| `resetActions` | object | No | Actions to run when state is reset |
| `stateActions` | array | Yes | Array of state transition definitions |

#### initActions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `endState` | string | Yes | State to set after init completes |
| `executeStateAction` | boolean | No | If `true`, immediately execute the state action for `endState` after init (default: `false`) |
| `commands` | array | Yes | Commands to execute during initialization |

#### resetActions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `commands` | array | Yes | Commands to execute when resetting state |

#### stateActions (array items)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `startState` | string | Yes | State required to execute this action set |
| `endState` | string | Yes | State to transition to after execution |
| `commands` | array | Yes | Commands to execute |

### Validation Rules

On first execution of a state machine command:

1. **Unique Start States** — Each `startState` must be unique across all `stateActions`. Duplicate start states cause an error message.
2. **Reachable States** — All states should be reachable from the init state (warning only).
3. **Valid Commands** — Commands must be valid VS Code command IDs or JavaScript fragments.

### Execution Flow

```
Command Triggered
       │
       ▼
┌──────────────────┐
│ State exists?    │
└────────┬─────────┘
         │
    No   │   Yes
   ┌─────┴─────┐
   ▼           ▼
┌──────┐  ┌────────────────────┐
│ Init │  │ Find action where  │
│      │  │ startState = state │
└──┬───┘  └─────────┬──────────┘
   │                │
   ▼                ▼
┌────────────────┐  ┌──────────────────┐
│ Set endState   │  │ Execute commands │
│ from init      │  │ Set new endState │
└───────┬────────┘  └──────────────────┘
        │
        ▼
┌───────────────────────┐
│ executeStateAction?   │
└───────────┬───────────┘
            │
      Yes   │   No
     ┌──────┴──────┐
     ▼             ▼
┌─────────────┐   Done
│ Execute     │
│ state action│
└─────────────┘
```

## JavaScript Fragment Support

Commands can include inline JavaScript fragments wrapped in `{ }`:

```json
{
  "commands": [
    "workbench.action.toggleFullScreen",
    "{ vscode.window.showInformationMessage('Toggled!'); }",
    "{ await new Promise(r => setTimeout(r, 500)); }"
  ]
}
```

### Available Context

JavaScript fragments have access to:

| Variable | Type | Description |
|----------|------|-------------|
| `vscode` | object | Full VS Code extension API |
| `require` | function | Node.js require function |

### Examples

```javascript
// Show notification
{ vscode.window.showInformationMessage('State changed!'); }

// Delay execution
{ await new Promise(r => setTimeout(r, 500)); }

// Conditional logic
{ if (process.platform === 'darwin') { /* macOS-specific */ } }

// Access workspace
{ const folders = vscode.workspace.workspaceFolders; }
```

## Reset State Command

The `dartscript.resetMultiCommandState` command:

1. Executes `resetActions` for **all** state machine commands that have them
2. Clears all state from the in-memory state map
3. Next invocation of any state machine command triggers its `initActions`

## Example: vsWindowStateFlow

This example demonstrates a panel visibility cycle:

```json
{
  "stateMachineCommands": {
    "vsWindowStateFlow": {
      "label": "Window Panel State Flow",
      "initActions": {
        "endState": "default",
        "executeStateAction": false,
        "commands": [
          "workbench.view.explorer",
          "workbench.action.focusPanel", 
          "workbench.action.focusAuxiliaryBar"
        ]
      },
      "resetActions": {
        "commands": [
          "workbench.view.explorer",
          "workbench.action.focusPanel",
          "workbench.action.focusAuxiliaryBar"
        ]
      },
      "stateActions": [
        {
          "startState": "default",
          "endState": "noExplorer",
          "commands": ["workbench.action.toggleSidebarVisibility"]
        },
        {
          "startState": "noExplorer", 
          "endState": "noExplorerAndBottomPanel",
          "commands": ["workbench.action.togglePanel"]
        },
        {
          "startState": "noExplorerAndBottomPanel",
          "endState": "noPanels",
          "commands": ["workbench.action.toggleAuxiliaryBar"]
        },
        {
          "startState": "noPanels",
          "endState": "noSidePanelAndNoBottomPanel",
          "commands": ["workbench.action.toggleSidebarVisibility"]
        },
        {
          "startState": "noSidePanelAndNoBottomPanel",
          "endState": "noSidePanel",
          "commands": ["workbench.action.togglePanel"]
        },
        {
          "startState": "noSidePanel",
          "endState": "default",
          "commands": ["workbench.action.toggleAuxiliaryBar"]
        }
      ]
    }
  }
}
```

### State Transition Diagram

```
                    ┌─────────┐
         init ────► │ default │ ◄──────────────────┐
                    └────┬────┘                    │
                         │ hide explorer           │
                         ▼                         │
                  ┌─────────────┐                  │
                  │ noExplorer  │                  │
                  └──────┬──────┘                  │
                         │ hide bottom panel       │
                         ▼                         │
           ┌──────────────────────────┐            │
           │ noExplorerAndBottomPanel │            │
           └────────────┬─────────────┘            │
                        │ hide chat panel          │
                        ▼                          │
                  ┌──────────┐                     │
                  │ noPanels │                     │
                  └─────┬────┘                     │
                        │ show explorer            │
                        ▼                          │
         ┌─────────────────────────────┐           │
         │ noSidePanelAndNoBottomPanel │           │
         └──────────────┬──────────────┘           │
                        │ show bottom panel        │
                        ▼                          │
                 ┌─────────────┐                   │
                 │ noSidePanel │                   │
                 └──────┬──────┘                   │
                        │ show chat panel          │
                        └──────────────────────────┘
```

### Keybinding

```json
{
  "key": "ctrl+shift+y",
  "command": "dartscript.vsWindowStateFlow"
}
```

## Related Commands

| Command ID | Description |
|------------|-------------|
| `dartscript.vsWindowStateFlow` | Execute panel state flow cycle |
| `dartscript.resetMultiCommandState` | Reset all state machine states |

## Favorites Integration

State machine commands can be added to favorites:

```json
{
  "key": "y",
  "label": "Panel State Flow",
  "commandId": "dartscript.vsWindowStateFlow"
}
```
