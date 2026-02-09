/**
 * Chord Menu Handler
 *
 * Implements a which-key style system for keyboard shortcuts.
 * Instead of VS Code's native chord keybindings (which provide no visual feedback),
 * the first key press shows a QuickPick with available second-key options.
 * Typing a single character auto-executes the matching command immediately.
 *
 * Groups:
 *   Ctrl+Shift+C → Conversation Control
 *   Ctrl+Shift+L → Local LLM
 *   Ctrl+Shift+A → Send to Copilot Chat
 *   Ctrl+Shift+T → Tom AI Chat
 */

import * as vscode from 'vscode';

// ============================================================================
// Types
// ============================================================================

interface ChordMenuItem {
    /** The shortcut key letter (lowercase) displayed and matched */
    key: string;
    /** Human-readable label for the command */
    label: string;
    /** The VS Code command ID to execute */
    commandId: string;
    /** Optional: only show this item when a condition is met */
    when?: () => boolean;
}

interface ChordGroup {
    /** Group title shown at the top of the QuickPick */
    title: string;
    /** The first-key chord prefix for display, e.g. "Ctrl+Shift+C" */
    prefix: string;
    /** Available commands in this group */
    items: ChordMenuItem[];
}

// ============================================================================
// Chord Group Definitions
// ============================================================================

const CHORD_GROUPS: Record<string, ChordGroup> = {
    conversation: {
        title: 'Bot Conversation',
        prefix: 'Ctrl+Shift+C',
        items: [
            { key: 'b', label: 'Start Conversation', commandId: 'dartscript.startBotConversation' },
            { key: 's', label: 'Stop Conversation', commandId: 'dartscript.stopBotConversation' },
            { key: 'h', label: 'Halt Conversation', commandId: 'dartscript.haltBotConversation' },
            { key: 'c', label: 'Continue Conversation', commandId: 'dartscript.continueBotConversation' },
            { key: 'a', label: 'Add Info to Conversation', commandId: 'dartscript.addToBotConversation' },
        ]
    },
    llm: {
        title: 'Local LLM (Ollama)',
        prefix: 'Ctrl+Shift+L',
        items: [
            { key: 'x', label: 'Expand Prompt', commandId: 'dartscript.expandPrompt' },
            { key: 'c', label: 'Change Ollama Model', commandId: 'dartscript.switchLocalModel' },
            { key: 's', label: 'Send to LLM (Standard)', commandId: 'dartscript.sendToLocalLlmStandard' },
            { key: 't', label: 'Send to LLM (Template)', commandId: 'dartscript.sendToLocalLlmAdvanced' },
        ]
    },
    chat: {
        title: 'Send to Copilot Chat',
        prefix: 'Ctrl+Shift+A',
        items: [
            { key: 'c', label: 'Send to Chat', commandId: 'dartscript.sendToChat' },
            { key: 's', label: 'Send to Chat (Standard)', commandId: 'dartscript.sendToChatStandard' },
            { key: 't', label: 'Send to Chat (Template)', commandId: 'dartscript.sendToChatAdvanced' },
            { key: 'r', label: 'Reload Chat Config', commandId: 'dartscript.reloadSendToChatConfig' },
        ]
    },
    tomAiChat: {
        title: 'Tom AI Chat',
        prefix: 'Ctrl+Shift+T',
        items: [
            { key: 'n', label: 'Start Chat', commandId: 'dartscript.startTomAIChat' },
            { key: 's', label: 'Send Chat Prompt', commandId: 'dartscript.sendToTomAIChat' },
            { key: 'i', label: 'Interrupt Chat', commandId: 'dartscript.interruptTomAIChat' },
        ]
    }
};

// ============================================================================
// Show Chord Menu
// ============================================================================

/**
 * Shows a QuickPick for a chord group. Auto-executes on single unique keypress.
 */
async function showChordMenu(groupId: string): Promise<void> {
    const group = CHORD_GROUPS[groupId];
    if (!group) {
        vscode.window.showErrorMessage(`Unknown chord group: ${groupId}`);
        return;
    }

    // Filter items by their `when` condition (if any)
    const activeItems = group.items.filter(item => !item.when || item.when());

    // Build QuickPick items
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = `${group.title}  (${group.prefix}, ...)`;
    quickPick.placeholder = 'Type a letter to execute, or select with arrow keys';
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = false;

    quickPick.items = activeItems.map(item => ({
        label: `$(key) ${item.key.toUpperCase()}`,
        description: item.label,
        detail: undefined,
        // Store the item data for retrieval
        _chordItem: item
    } as vscode.QuickPickItem & { _chordItem: ChordMenuItem }));

    let executed = false;

    // Auto-execute on single unique character match
    quickPick.onDidChangeValue((value) => {
        if (executed) { return; }
        const typed = value.toLowerCase().trim();
        if (typed.length !== 1) { return; }

        // Find exact key match
        const match = activeItems.filter(item => item.key === typed);
        if (match.length === 1) {
            executed = true;
            quickPick.hide();
            vscode.commands.executeCommand(match[0].commandId);
        }
    });

    // Handle explicit selection (click or Enter)
    quickPick.onDidAccept(() => {
        if (executed) { return; }
        const selected = quickPick.selectedItems[0] as vscode.QuickPickItem & { _chordItem?: ChordMenuItem };
        if (selected?._chordItem) {
            executed = true;
            quickPick.hide();
            vscode.commands.executeCommand(selected._chordItem.commandId);
        }
    });

    // Clean up on hide
    quickPick.onDidHide(() => {
        quickPick.dispose();
    });

    quickPick.show();
}

// ============================================================================
// Command Handlers (exported for extension.ts)
// ============================================================================

export function chordMenuConversationHandler(): void {
    showChordMenu('conversation');
}

export function chordMenuLlmHandler(): void {
    showChordMenu('llm');
}

export function chordMenuChatHandler(): void {
    showChordMenu('chat');
}

export function chordMenuTomAiChatHandler(): void {
    showChordMenu('tomAiChat');
}

/**
 * Registers all four chord menu commands and returns the disposables.
 */
export function registerChordMenuCommands(context: vscode.ExtensionContext): void {
    const cmds = [
        vscode.commands.registerCommand('dartscript.chordMenu.conversation', chordMenuConversationHandler),
        vscode.commands.registerCommand('dartscript.chordMenu.llm', chordMenuLlmHandler),
        vscode.commands.registerCommand('dartscript.chordMenu.chat', chordMenuChatHandler),
        vscode.commands.registerCommand('dartscript.chordMenu.tomAiChat', chordMenuTomAiChatHandler),
    ];
    context.subscriptions.push(...cmds);
}
