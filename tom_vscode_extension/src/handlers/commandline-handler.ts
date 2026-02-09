/**
 * Commandline Handler
 *
 * Provides commands to define, delete, and execute custom command lines.
 * Command definitions are stored in the `commandlines` section of send_to_chat.json.
 *
 * Commands:
 *   dartscript.defineCommandline  — define a new commandline
 *   dartscript.deleteCommandline  — delete an existing commandline
 *   dartscript.executeCommandline — execute an existing commandline
 *   dartscript.openConfig         — open the config file in the editor
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface CommandlineEntry {
    /** The shell command to execute */
    command: string;
    /** Human-readable description (if empty, the command is used) */
    description: string;
    /** Absolute path where the command should be executed */
    cwd: string;
}

// ============================================================================
// Config Helpers
// ============================================================================

/**
 * Get the configuration file path (same as sendToChatAdvanced).
 */
function getConfigPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }

    const configSetting = vscode.workspace.getConfiguration('dartscript.sendToChat').get<string>('configPath');
    if (!configSetting) {
        return path.join(workspaceFolders[0].uri.fsPath, '_ai', 'send_to_chat', 'send_to_chat.json');
    }

    return configSetting.replace('${workspaceFolder}', workspaceFolders[0].uri.fsPath);
}

/**
 * Read and parse the config file. Returns the full JSON object.
 */
function readConfig(): any | undefined {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) { return undefined; }
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
        return undefined;
    }
}

/**
 * Write the config object back to disk (pretty-printed).
 */
function writeConfig(config: any): boolean {
    const configPath = getConfigPath();
    if (!configPath) { return false; }
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to write config: ${e.message}`);
        return false;
    }
}

/**
 * Get the commandlines array from the config (or empty array).
 */
function getCommandlines(): CommandlineEntry[] {
    const config = readConfig();
    if (!config || !Array.isArray(config.commandlines)) { return []; }
    return config.commandlines as CommandlineEntry[];
}

// ============================================================================
// Resolve working directory
// ============================================================================

function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getExtensionRoot(): string | undefined {
    const ext = vscode.extensions.getExtension('tom.dartscript-vscode');
    return ext?.extensionPath;
}

/**
 * Resolve a potentially relative path against the workspace root.
 */
function resolveAbsolute(input: string): string {
    if (path.isAbsolute(input)) { return input; }
    const root = getWorkspaceRoot();
    if (root) { return path.resolve(root, input); }
    return path.resolve(input);
}

// ============================================================================
// Define Commandline
// ============================================================================

async function defineCommandline(): Promise<void> {
    // 1) Command
    const command = await vscode.window.showInputBox({
        title: 'Define Commandline (1/3) — Command',
        prompt: 'Shell command to execute',
        placeHolder: 'e.g. dart analyze, npm test, make build',
    });
    if (command === undefined) { return; } // cancelled
    if (!command.trim()) {
        vscode.window.showWarningMessage('Command cannot be empty.');
        return;
    }

    // 2) Description (optional)
    const description = await vscode.window.showInputBox({
        title: 'Define Commandline (2/3) — Description',
        prompt: 'Optional description (leave empty to use the command)',
        placeHolder: command,
    });
    if (description === undefined) { return; }

    // 3) Working directory
    const cwdChoice = await vscode.window.showQuickPick(
        [
            { label: '$(root-folder) Workspace Root', id: 'workspace' },
            { label: '$(extensions) Extension Root', id: 'extension' },
            { label: '$(folder-opened) Custom Path...', id: 'custom' },
        ],
        { title: 'Define Commandline (3/3) — Working Directory', placeHolder: 'Where should this command run?' }
    );
    if (!cwdChoice) { return; }

    let cwd: string;
    if (cwdChoice.id === 'workspace') {
        const root = getWorkspaceRoot();
        if (!root) { vscode.window.showErrorMessage('No workspace folder open.'); return; }
        cwd = root;
    } else if (cwdChoice.id === 'extension') {
        const root = getExtensionRoot();
        if (!root) { vscode.window.showErrorMessage('Extension root not found.'); return; }
        cwd = root;
    } else {
        const customPath = await vscode.window.showInputBox({
            title: 'Custom Working Directory',
            prompt: 'Enter an absolute or relative path (relative to workspace root)',
            placeHolder: '/absolute/path or relative/path',
        });
        if (customPath === undefined || !customPath.trim()) { return; }
        cwd = resolveAbsolute(customPath.trim());
    }

    // 4) Confirmation popup
    const confirm = await vscode.window.showInformationMessage(
        `Run "${command}" in:\n${cwd}`,
        { modal: true, detail: `Command: ${command}\nDirectory: ${cwd}` },
        'OK'
    );
    if (confirm !== 'OK') { return; }

    // 5) Write to config
    const config = readConfig() || {};
    if (!Array.isArray(config.commandlines)) { config.commandlines = []; }
    config.commandlines.push({
        command: command.trim(),
        description: description.trim() || '',
        cwd,
    } as CommandlineEntry);

    if (writeConfig(config)) {
        vscode.window.showInformationMessage(`Commandline saved: ${description.trim() || command.trim()}`);
    }
}

// ============================================================================
// Delete Commandline
// ============================================================================

async function deleteCommandline(): Promise<void> {
    const commandlines = getCommandlines();
    if (commandlines.length === 0) {
        vscode.window.showInformationMessage('No commandlines defined.');
        return;
    }

    const items = commandlines.map((entry, index) => ({
        label: entry.description || entry.command,
        description: entry.description ? entry.command : undefined,
        detail: `cwd: ${entry.cwd}`,
        _index: index,
    }));

    const picked = await vscode.window.showQuickPick(items, {
        title: 'Delete Commandline',
        placeHolder: 'Select a commandline to delete',
    });
    if (!picked) { return; }

    const config = readConfig();
    if (!config || !Array.isArray(config.commandlines)) { return; }
    config.commandlines.splice(picked._index, 1);

    if (writeConfig(config)) {
        vscode.window.showInformationMessage(`Deleted: ${picked.label}`);
    }
}

// ============================================================================
// Execute Commandline
// ============================================================================

async function executeCommandline(): Promise<void> {
    const commandlines = getCommandlines();
    if (commandlines.length === 0) {
        vscode.window.showInformationMessage('No commandlines defined. Use "Add Commandline" first.');
        return;
    }

    const items = commandlines.map((entry, index) => ({
        label: entry.description || entry.command,
        description: entry.description ? entry.command : undefined,
        detail: `cwd: ${entry.cwd}`,
        _index: index,
    }));

    const picked = await vscode.window.showQuickPick(items, {
        title: 'Execute Commandline',
        placeHolder: 'Select a commandline to execute',
    });
    if (!picked) { return; }

    const entry = commandlines[picked._index];

    // Execute in VS Code terminal
    const terminal = vscode.window.createTerminal({
        name: entry.description || entry.command,
        cwd: entry.cwd,
    });
    terminal.show();
    terminal.sendText(entry.command);
}

// ============================================================================
// Open Config File
// ============================================================================

async function openConfig(): Promise<void> {
    const configPath = getConfigPath();
    if (!configPath) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
    }
    if (!fs.existsSync(configPath)) {
        vscode.window.showWarningMessage(`Config file not found: ${configPath}`);
        return;
    }
    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc, { preview: false });
}

// ============================================================================
// Registration
// ============================================================================

export function registerCommandlineCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('dartscript.defineCommandline', defineCommandline),
        vscode.commands.registerCommand('dartscript.deleteCommandline', deleteCommandline),
        vscode.commands.registerCommand('dartscript.executeCommandline', executeCommandline),
        vscode.commands.registerCommand('dartscript.openConfig', openConfig),
    );
}
