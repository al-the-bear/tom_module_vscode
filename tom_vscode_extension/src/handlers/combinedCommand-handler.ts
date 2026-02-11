/**
 * Combined Command Handler
 *
 * Provides configurable "combined commands" — extension commands that
 * execute a sequence of VS Code commands read from `send_to_chat.json`.
 *
 * Each combined command is registered once in package.json with a fixed
 * command ID (e.g. `dartscript.combined.maximizeExplorer`), but the actual
 * VS Code commands it executes are read from the `combinedCommands` section
 * of the config file at runtime.  This means the behaviour can be changed
 * without reinstalling the extension.
 *
 * Config format in send_to_chat.json:
 *
 * ```json
 * "combinedCommands": {
 *   "maximizeExplorer": {
 *     "label": "Maximize Explorer",
 *     "commands": [
 *       "workbench.action.closeSidebar",
 *       "workbench.action.closeAuxiliaryBar",
 *       "workbench.action.focusSideBar"
 *     ]
 *   }
 * }
 * ```
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

interface CombinedCommandConfig {
    /** Human-readable label (for logging / status bar) */
    label?: string;
    /** The VS Code command IDs to execute in order */
    commands: string[];
}

/** The full map keyed by the short name used in the command ID */
type CombinedCommandsMap = Record<string, CombinedCommandConfig>;

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Returns the config file path for `send_to_chat.json`.
 * Mirrors the logic in chordMenu-handler.ts.
 */
function getConfigPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    const configSetting = vscode.workspace
        .getConfiguration('dartscript.sendToChat')
        .get<string>('configPath');
    if (!configSetting) {
        return path.join(
            workspaceFolders[0].uri.fsPath,
            '_ai',
            'send_to_chat',
            'send_to_chat.json',
        );
    }
    return configSetting.replace(
        '${workspaceFolder}',
        workspaceFolders[0].uri.fsPath,
    );
}

/**
 * Read the `combinedCommands` map from the config file.
 * Returns an empty object when the file or section doesn't exist.
 */
function loadCombinedCommands(): CombinedCommandsMap {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
        return {};
    }
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const section = config?.combinedCommands;
        if (!section || typeof section !== 'object') {
            return {};
        }
        // Validate each entry
        const result: CombinedCommandsMap = {};
        for (const [key, value] of Object.entries(section)) {
            const entry = value as any;
            if (Array.isArray(entry?.commands) && entry.commands.length > 0) {
                result[key] = {
                    label: entry.label ? String(entry.label) : key,
                    commands: entry.commands.map((c: any) => String(c)),
                };
            }
        }
        return result;
    } catch (e) {
        console.error('[CombinedCommand] Failed to load config:', e);
        return {};
    }
}

// ============================================================================
// Execution
// ============================================================================

/**
 * Execute a combined command by its short name.
 * Reads the command list from config each time so changes take effect
 * immediately without reload.
 */
async function executeCombinedCommand(name: string): Promise<void> {
    console.log(`[CombinedCommand] Executing "${name}"...`);
    const allCommands = loadCombinedCommands();
    const entry = allCommands[name];

    if (!entry) {
        const msg = `Combined command "${name}" is not configured in send_to_chat.json → combinedCommands.`;
        console.error(`[CombinedCommand] ${msg}`);
        vscode.window.showWarningMessage(msg);
        return;
    }

    console.log(`[CombinedCommand] "${name}" → executing ${entry.commands.length} command(s): ${entry.commands.join(', ')}`);

    for (const cmdId of entry.commands) {
        try {
            await vscode.commands.executeCommand(cmdId);
            console.log(`[CombinedCommand] ✓ "${cmdId}"`);
        } catch (err) {
            console.error(
                `[CombinedCommand] Error executing "${cmdId}" in "${name}":`,
                err,
            );
        }
    }
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Creates a command handler function for a given combined command name.
 */
export function createCombinedCommandHandler(
    name: string,
): () => Promise<void> {
    return () => executeCombinedCommand(name);
}

/**
 * Register all combined command entries.
 * Call this from extension.ts during activation.
 *
 * Each registered command has the ID `dartscript.combined.<name>`.
 * The names must match entries declared in package.json → contributes.commands.
 */
export function registerCombinedCommands(
    context: vscode.ExtensionContext,
): void {
    // These are the statically registered command names in package.json.
    // Add new entries here when adding new combined commands.
    const registeredNames = [
        'maximizeToggle',
        'maximizeExplorer',
        'maximizeEditor',
        'maximizeChat',
    ];

    for (const name of registeredNames) {
        const cmd = vscode.commands.registerCommand(
            `dartscript.combined.${name}`,
            createCombinedCommandHandler(name),
        );
        context.subscriptions.push(cmd);
    }
}
