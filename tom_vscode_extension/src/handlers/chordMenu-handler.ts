/**
 * Chord Menu Handler
 *
 * Implements a which-key style system for keyboard shortcuts.
 * Instead of VS Code's native chord keybindings (which provide no visual feedback),
 * the first key press shows a QuickPick with available second-key options.
 * Typing a single character auto-executes the matching command immediately.
 * Holding Ctrl+Shift also works — keybindings with "when": "dartscript.chordMenuOpen"
 * route the letter to executeChordKey().
 *
 * Groups:
 *   Ctrl+Shift+C → Conversation Control
 *   Ctrl+Shift+L → Local LLM
 *   Ctrl+Shift+A → Send to Copilot Chat
 *   Ctrl+Shift+T → Tom AI Chat
 *
 * All groups include a "?" item that opens the Quick Reference document.
 */

import * as vscode from 'vscode';
import * as path from 'path';

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
// Quick Reference Helper
// ============================================================================

const QUICK_REFERENCE_COMMAND = 'dartscript.showQuickReference';

/**
 * Opens the QUICK_REFERENCE.md file from the extension's doc/ folder.
 */
async function openQuickReference(): Promise<void> {
    // Find the extension by its ID
    const ext = vscode.extensions.getExtension('tom.dartscript-vscode');
    if (!ext) {
        vscode.window.showErrorMessage('DartScript extension not found.');
        return;
    }
    const refPath = path.join(ext.extensionPath, 'doc', 'QUICK_REFERENCE.md');
    try {
        const uri = vscode.Uri.file(refPath);
        await vscode.commands.executeCommand('markdown.showPreview', uri);
    } catch {
        // Fallback: open as plain text if markdown preview fails
        try {
            const uri = vscode.Uri.file(refPath);
            await vscode.window.showTextDocument(uri, { preview: true });
        } catch (e) {
            vscode.window.showErrorMessage(`Could not open quick reference: ${e}`);
        }
    }
}

// The "?" help item appended to every group
const HELP_ITEM: ChordMenuItem = {
    key: '?',
    label: 'Quick Reference',
    commandId: QUICK_REFERENCE_COMMAND,
};

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
            HELP_ITEM,
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
            HELP_ITEM,
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
            HELP_ITEM,
        ]
    },
    tomAiChat: {
        title: 'Tom AI Chat',
        prefix: 'Ctrl+Shift+T',
        items: [
            { key: 'n', label: 'Start Chat', commandId: 'dartscript.startTomAIChat' },
            { key: 's', label: 'Send Chat Prompt', commandId: 'dartscript.sendToTomAIChat' },
            { key: 'i', label: 'Interrupt Chat', commandId: 'dartscript.interruptTomAIChat' },
            HELP_ITEM,
        ]
    },
    execute: {
        title: 'Execute Commandline',
        prefix: 'Ctrl+Shift+E',
        items: [
            { key: 'e', label: 'Execute Commandline', commandId: 'dartscript.executeCommandline' },
            { key: 'a', label: 'Add Commandline', commandId: 'dartscript.defineCommandline' },
            { key: 'd', label: 'Delete Commandline', commandId: 'dartscript.deleteCommandline' },
            { key: 'o', label: 'Open Config File', commandId: 'dartscript.openConfig' },
            HELP_ITEM,
        ]
    }
};

// ============================================================================
// Active Menu State (for Ctrl+Shift held-down keybinding dispatch)
// ============================================================================

/** The currently open chord group ID, or null if no menu is showing */
let activeGroupId: string | null = null;

/** Reference to the active QuickPick so we can dismiss it from keybindings */
let activeQuickPick: vscode.QuickPick<vscode.QuickPickItem & { _chordItem?: ChordMenuItem }> | null = null;

// ============================================================================
// Show Chord Menu
// ============================================================================

/**
 * Shows a QuickPick for a chord group. Auto-executes on single unique keypress.
 * Also sets the `dartscript.chordMenuOpen` context key so that Ctrl+Shift+<letter>
 * keybindings work while the menu is visible.
 */
async function showChordMenu(groupId: string): Promise<void> {
    const group = CHORD_GROUPS[groupId];
    if (!group) {
        vscode.window.showErrorMessage(`Unknown chord group: ${groupId}`);
        return;
    }

    // Filter items by their `when` condition (if any)
    const activeItems = group.items.filter(item => !item.when || item.when());

    // Set context for keybinding dispatch
    activeGroupId = groupId;
    await vscode.commands.executeCommand('setContext', 'dartscript.chordMenuOpen', true);

    // Build QuickPick items
    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { _chordItem?: ChordMenuItem }>();
    activeQuickPick = quickPick;
    quickPick.title = `${group.title}  (${group.prefix} → ...)`;
    quickPick.placeholder = 'Type a letter to execute, or select with arrow keys';
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = false;

    quickPick.items = activeItems.map(item => ({
        label: `$(key) ${item.key.toUpperCase()}`,
        description: item.label,
        detail: undefined,
        _chordItem: item
    }));

    let executed = false;

    const executeItem = (item: ChordMenuItem) => {
        if (executed) { return; }
        executed = true;
        quickPick.hide();
        vscode.commands.executeCommand(item.commandId);
    };

    // Auto-execute on single unique character match (plain typing)
    quickPick.onDidChangeValue((value) => {
        if (executed) { return; }
        const typed = value.toLowerCase().trim();
        if (typed.length !== 1) { return; }

        const match = activeItems.filter(item => item.key === typed);
        if (match.length === 1) {
            executeItem(match[0]);
        }
    });

    // Handle explicit selection (click or Enter)
    quickPick.onDidAccept(() => {
        if (executed) { return; }
        const selected = quickPick.selectedItems[0];
        if (selected?._chordItem) {
            executeItem(selected._chordItem);
        }
    });

    // Clean up on hide
    quickPick.onDidHide(() => {
        activeGroupId = null;
        activeQuickPick = null;
        vscode.commands.executeCommand('setContext', 'dartscript.chordMenuOpen', false);
        quickPick.dispose();
    });

    quickPick.show();
}

// ============================================================================
// Execute Key from Keybinding (Ctrl+Shift held down)
// ============================================================================

/**
 * Called from keybindings when a Ctrl+Shift+<letter> is pressed while the
 * chord menu is open. Looks up the letter in the active group and executes.
 */
export function executeChordKey(key: string): void {
    if (!activeGroupId || !activeQuickPick) { return; }

    const group = CHORD_GROUPS[activeGroupId];
    if (!group) { return; }

    const normalizedKey = key.toLowerCase();
    const match = group.items.filter(item =>
        item.key === normalizedKey && (!item.when || item.when())
    );

    if (match.length === 1) {
        // Dismiss the QuickPick and execute the command
        const quickPick = activeQuickPick;
        activeGroupId = null;
        activeQuickPick = null;
        vscode.commands.executeCommand('setContext', 'dartscript.chordMenuOpen', false);
        quickPick.hide();
        vscode.commands.executeCommand(match[0].commandId);
    }
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

export function chordMenuExecuteHandler(): void {
    showChordMenu('execute');
}

/**
 * Registers all chord menu commands, the key dispatcher, and the quick reference command.
 */
export function registerChordMenuCommands(context: vscode.ExtensionContext): void {
    const cmds = [
        vscode.commands.registerCommand('dartscript.chordMenu.conversation', chordMenuConversationHandler),
        vscode.commands.registerCommand('dartscript.chordMenu.llm', chordMenuLlmHandler),
        vscode.commands.registerCommand('dartscript.chordMenu.chat', chordMenuChatHandler),
        vscode.commands.registerCommand('dartscript.chordMenu.tomAiChat', chordMenuTomAiChatHandler),
        vscode.commands.registerCommand('dartscript.chordMenu.execute', chordMenuExecuteHandler),
        vscode.commands.registerCommand('dartscript.chordMenu.executeKey', (key: string) => executeChordKey(key)),
        vscode.commands.registerCommand(QUICK_REFERENCE_COMMAND, openQuickReference),
    ];
    context.subscriptions.push(...cmds);
}
