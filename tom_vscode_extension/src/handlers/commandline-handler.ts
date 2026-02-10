/**
 * Commandline Handler
 *
 * Provides commands to define, delete, and execute custom command lines.
 * Command definitions are stored in the `commandlines` section of send_to_chat.json.
 *
 * Features:
 *   - Dynamic working directory resolved at execution time:
 *     workspace root, extension root, project root (buildkit.yaml / pubspec.yaml),
 *     repository root (.git), document root (active file directory), or a custom path
 *   - Command placeholders: ${currentfile.name}, ${currentfile.ext}, ${currentfile.path}
 *   - Post-execution VS Code actions: configurable commands to run after the
 *     shell command finishes (e.g., reload window, open terminal, etc.)
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

/** How the working directory is determined at execution time. */
export type CwdMode = 'workspace' | 'extension' | 'project' | 'repository' | 'document' | 'custom';

export interface CommandlineEntry {
    /** The shell command to execute. May contain placeholders. */
    command: string;
    /** Human-readable description (if empty, the command is used) */
    description: string;
    /**
     * How the cwd is resolved at execution time.
     *   'workspace'   — first workspace folder root
     *   'extension'   — extension installation directory
     *   'project'     — walk up from active file for buildkit.yaml / pubspec.yaml
     *   'repository'  — walk up from active file for .git
     *   'document'    — directory of the active editor file
     *   'custom'      — use the path stored in `cwd`
     *
     * Legacy: if absent, falls back to 'custom' using the stored `cwd`.
     */
    cwdMode?: CwdMode;
    /** Only used when cwdMode is 'custom' (or absent for legacy entries). */
    cwd?: string;
    /** VS Code command IDs to execute after the shell command finishes. */
    postActions?: string[];
}

/** Configurable post-execution action definition. */
export interface PostActionDefinition {
    /** VS Code command ID */
    commandId: string;
    /** Human-readable label shown in quick-pick */
    label: string;
    /** Optional description */
    description?: string;
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

/** Default post-actions if none are configured. */
const DEFAULT_POST_ACTIONS: PostActionDefinition[] = [
    { commandId: 'workbench.action.reloadWindow', label: 'Reload Window', description: 'Reload the VS Code window' },
    { commandId: 'workbench.action.terminal.focus', label: 'Focus Terminal', description: 'Focus the integrated terminal' },
    { commandId: 'workbench.action.files.revert', label: 'Revert Active File', description: 'Revert the active editor file from disk' },
    { commandId: 'workbench.action.closeActiveEditor', label: 'Close Active Editor', description: 'Close the current editor tab' },
    { commandId: 'workbench.action.openSettings', label: 'Open Settings', description: 'Open VS Code settings' },
    { commandId: 'git.refresh', label: 'Git: Refresh', description: 'Refresh the Git source control view' },
    { commandId: 'workbench.action.tasks.runTask', label: 'Run Task...', description: 'Run a VS Code task' },
    { commandId: 'workbench.action.debug.start', label: 'Start Debugging', description: 'Start a debug session' },
    { commandId: 'workbench.action.output.toggleOutput', label: 'Toggle Output Panel', description: 'Show/hide the output panel' },
    { commandId: 'dartscript.openConfig', label: 'Open Config File', description: 'Open send_to_chat.json' },
];

/**
 * Get post-action definitions from config, falling back to defaults.
 * Re-reads config every time for live updates.
 */
function getPostActionDefinitions(): PostActionDefinition[] {
    const config = readConfig();
    if (config?.commandlinePostActions && Array.isArray(config.commandlinePostActions)) {
        return config.commandlinePostActions as PostActionDefinition[];
    }
    return DEFAULT_POST_ACTIONS;
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

/**
 * Get the directory of the currently active editor file.
 * Returns undefined if no editor is open or the file has no filesystem path.
 */
function getActiveFileDir(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return undefined; }
    const filePath = editor.document.uri.fsPath;
    if (!filePath) { return undefined; }
    return path.dirname(filePath);
}

/**
 * Walk up from `startDir` looking for a directory containing any of the given marker files.
 * Returns the first directory found, or undefined.
 */
function findAncestorWithMarker(startDir: string, markers: string[]): string | undefined {
    let current = startDir;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        for (const marker of markers) {
            const candidate = path.join(current, marker);
            if (fs.existsSync(candidate)) {
                return current;
            }
        }
        const parent = path.dirname(current);
        if (parent === current) { break; } // reached filesystem root
        current = parent;
    }
    return undefined;
}

/**
 * Find the project root by walking up from the active editor file,
 * looking for buildkit.yaml or pubspec.yaml.
 */
function findProjectRoot(): string | undefined {
    const startDir = getActiveFileDir();
    if (!startDir) { return undefined; }
    return findAncestorWithMarker(startDir, ['buildkit.yaml', 'pubspec.yaml']);
}

/**
 * Find the repository root by walking up from the active editor file,
 * looking for .git (can be a directory or a file — submodules use a .git file
 * containing `gitdir: ...`).
 */
function findRepositoryRoot(): string | undefined {
    const startDir = getActiveFileDir();
    if (!startDir) { return undefined; }
    return findAncestorWithMarker(startDir, ['.git']);
}

// ============================================================================
// Post-action picker (loop until "Continue")
// ============================================================================

/**
 * Show a repeating quick-pick to select post-execution VS Code actions.
 * Returns the list of selected command IDs, or undefined if cancelled.
 * The config is re-read each time the picker is shown (live updates).
 */
async function pickPostActions(existingActions?: string[]): Promise<string[] | undefined> {
    try {
        const actions: string[] = existingActions ? [...existingActions] : [];

        // eslint-disable-next-line no-constant-condition
        while (true) {
            // Re-read definitions each iteration
            const definitions = getPostActionDefinitions();
            console.log(`[commandline-handler] pickPostActions: ${definitions.length} action definitions loaded`);

            const items: (vscode.QuickPickItem & { _commandId?: string })[] = [
                {
                    label: '$(play) Continue - execute command',
                    description: actions.length > 0
                        ? `(${actions.length} post-action${actions.length > 1 ? 's' : ''} queued)`
                        : '(no post-actions)',
                    _commandId: '__continue__',
                },
                { label: '', kind: vscode.QuickPickItemKind.Separator },
                ...definitions.map(def => ({
                    label: `$(add) ${def.label}`,
                    description: def.description,
                    detail: actions.includes(def.commandId) ? '✓ already added' : undefined,
                    _commandId: def.commandId,
                })),
            ];

            console.log(`[commandline-handler] pickPostActions: showing quickpick with ${items.length} items`);

            const picked = await vscode.window.showQuickPick(items, {
                title: 'Post-Execution Actions',
                placeHolder: actions.length > 0
                    ? `${actions.length} action(s) queued. Pick another or Continue.`
                    : 'Add actions to run after the command finishes, or Continue',
            });

            if (!picked) {
                console.log('[commandline-handler] pickPostActions: cancelled by user');
                return undefined;
            }
            if (picked._commandId === '__continue__') {
                console.log(`[commandline-handler] pickPostActions: continuing with ${actions.length} actions`);
                return actions;
            }

            if (picked._commandId && !actions.includes(picked._commandId)) {
                actions.push(picked._commandId);
                vscode.window.showInformationMessage(`Added: ${picked.label.replace('$(add) ', '')}`);
            }
        }
    } catch (err: any) {
        console.error(`[commandline-handler] pickPostActions error:`, err);
        vscode.window.showErrorMessage(`Post-action picker failed: ${err.message}`);
        return undefined;
    }
}

// ============================================================================
// Define Commandline
// ============================================================================

async function defineCommandline(): Promise<void> {
  try {
    console.log('[commandline-handler] defineCommandline: started');

    // 1) Command (supports placeholders: ${currentfile.name}, ${currentfile.ext}, ${currentfile.path})
    const command = await vscode.window.showInputBox({
        title: 'Define Commandline (1/3) - Command',
        prompt: 'Placeholders: ${currentfile}, ${currentfile.name}, ${currentfile.ext}, ${currentfile.path}',
        placeHolder: 'e.g. dart analyze, npm test ${currentfile}',
    });
    if (command === undefined) { console.log('[commandline-handler] defineCommandline: cancelled at command input'); return; }
    if (!command.trim()) {
        vscode.window.showWarningMessage('Command cannot be empty.');
        return;
    }
    console.log(`[commandline-handler] defineCommandline: command = "${command}"`);

    // 2) Description (optional)
    const description = await vscode.window.showInputBox({
        title: 'Define Commandline (2/3) - Description',
        prompt: 'Optional description (leave empty to use the command)',
        placeHolder: command,
    });
    if (description === undefined) { console.log('[commandline-handler] defineCommandline: cancelled at description'); return; }
    console.log(`[commandline-handler] defineCommandline: description = "${description}"`);

    // 3) Working directory mode — no resolution here, just store the mode
    const cwdItems = [
        { label: '$(root-folder) Workspace Root', _id: 'workspace' as CwdMode },
        { label: '$(extensions) Extension Root', _id: 'extension' as CwdMode },
        { label: '$(package) Project Root', _id: 'project' as CwdMode, description: 'Resolved at runtime from active file (buildkit.yaml / pubspec.yaml)' },
        { label: '$(git-branch) Repository Root', _id: 'repository' as CwdMode, description: 'Resolved at runtime from active file (.git)' },
        { label: '$(file-directory) Document Root', _id: 'document' as CwdMode, description: 'Directory of the active editor file at runtime' },
        { label: '$(folder-opened) Custom Path...', _id: 'custom' as CwdMode },
    ];
    const cwdChoice = await vscode.window.showQuickPick(cwdItems, {
        title: 'Define Commandline (3/3) - Working Directory',
        placeHolder: 'Where should this command run?',
    });
    if (!cwdChoice) { console.log('[commandline-handler] defineCommandline: cancelled at cwd picker'); return; }
    console.log(`[commandline-handler] defineCommandline: cwdChoice = "${cwdChoice._id}"`);

    // Build entry
    const entry: CommandlineEntry = {
        command: command.trim(),
        description: description.trim() || '',
        cwdMode: cwdChoice._id,
    };

    // Only ask for a path if custom
    if (cwdChoice._id === 'custom') {
        const customPath = await vscode.window.showInputBox({
            title: 'Custom Working Directory',
            prompt: 'Enter an absolute or relative path (relative to workspace root)',
            placeHolder: '/absolute/path or relative/path',
        });
        if (customPath === undefined || !customPath.trim()) { return; }
        entry.cwd = customPath.trim();
    }

    // 4) Write to config
    console.log('[commandline-handler] defineCommandline: writing to config');
    const config = readConfig() || {};
    if (!Array.isArray(config.commandlines)) { config.commandlines = []; }
    config.commandlines.push(entry);

    if (!writeConfig(config)) {
        vscode.window.showErrorMessage('Failed to save commandline.');
        return;
    }
    console.log('[commandline-handler] defineCommandline: saved successfully');
    vscode.window.showInformationMessage(`Commandline saved: ${description.trim() || command.trim()}`);

    // 5) Offer to add post-execution actions (after command is already saved)
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log('[commandline-handler] defineCommandline: showing post-action offer');
    const addPostActionsChoice = await vscode.window.showQuickPick(
        [
            { label: '$(check) Done', _action: 'done' as const },
            { label: '$(add) Add post-execution actions...', _action: 'add' as const, description: 'e.g. Reload Window after script finishes' },
        ],
        {
            title: 'Add Post-Execution Actions?',
            placeHolder: 'Optionally add VS Code actions to run after this command finishes',
        },
    );
    console.log(`[commandline-handler] defineCommandline: post-action offer choice = ${addPostActionsChoice?._action ?? 'cancelled'}`);

    if (addPostActionsChoice && addPostActionsChoice._action === 'add') {
        const postActions = await pickPostActions();
        if (postActions && postActions.length > 0) {
            const freshConfig = readConfig();
            if (freshConfig && Array.isArray(freshConfig.commandlines) && freshConfig.commandlines.length > 0) {
                freshConfig.commandlines[freshConfig.commandlines.length - 1].postActions = postActions;
                writeConfig(freshConfig);
                vscode.window.showInformationMessage(`${postActions.length} post-action(s) added.`);
                console.log(`[commandline-handler] defineCommandline: ${postActions.length} post-actions saved`);
            }
        }
    }
  } catch (err: any) {
    console.error(`[commandline-handler] defineCommandline error:`, err);
    vscode.window.showErrorMessage(`Define commandline failed: ${err.message}`);
  }
}

// ============================================================================
// Placeholder expansion
// ============================================================================

/**
 * Human-readable label for a CwdMode value.
 */
function cwdModeLabel(mode: CwdMode | undefined): string {
    switch (mode) {
        case 'workspace': return 'Workspace Root';
        case 'extension': return 'Extension Root';
        case 'project': return 'Project Root (dynamic)';
        case 'repository': return 'Repository Root (dynamic)';
        case 'document': return 'Document Root (dynamic)';
        case 'custom': return 'Custom Path';
        default: return 'Custom Path';
    }
}

/**
 * Expand command placeholders using the currently active editor file.
 * Supported placeholders:
 *   ${currentfile.name} — filename without extension (e.g. "main")
 *   ${currentfile.ext}  — file extension including dot (e.g. ".dart")
 *   ${currentfile.path} — full absolute file path
 *
 * Returns the expanded command string, or undefined if placeholders are
 * present but no editor is open.
 */
function expandPlaceholders(command: string): string | undefined {
    const hasPlaceholders = /\$\{currentfile(\.(name|ext|path))?\}/.test(command);
    if (!hasPlaceholders) { return command; }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage(
            'Command uses ${currentfile.*} placeholders but no editor is open.',
        );
        return undefined;
    }

    const filePath = editor.document.uri.fsPath;
    const ext = path.extname(filePath);            // ".dart"
    const name = path.basename(filePath, ext);      // "main"
    const fullName = path.basename(filePath);        // "main.dart"

    return command
        .replace(/\$\{currentfile\.name\}/g, name)
        .replace(/\$\{currentfile\.ext\}/g, ext)
        .replace(/\$\{currentfile\.path\}/g, filePath)
        .replace(/\$\{currentfile\}/g, fullName);
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
        detail: `cwd: ${cwdModeLabel(entry.cwdMode)}${entry.cwdMode === 'custom' || !entry.cwdMode ? ` (${entry.cwd || '?'})` : ''}${entry.postActions?.length ? ` | ${entry.postActions.length} post-action(s)` : ''}`,
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

/**
 * Resolve the effective cwd for a commandline entry at execution time.
 * All dynamic modes (project, repository, document) are resolved here.
 * Returns the resolved absolute path, or undefined (with modal error shown) on failure.
 */
async function resolveExecutionCwd(entry: CommandlineEntry): Promise<string | undefined> {
    const mode: CwdMode = entry.cwdMode || 'custom';

    const showError = (msg: string) =>
        vscode.window.showErrorMessage(msg, { modal: true });

    switch (mode) {
        case 'workspace': {
            const root = getWorkspaceRoot();
            if (!root) {
                await showError('No workspace folder open.');
                return undefined;
            }
            return root;
        }
        case 'extension': {
            const root = getExtensionRoot();
            if (!root) {
                await showError('Extension root not found.');
                return undefined;
            }
            return root;
        }
        case 'project': {
            const root = findProjectRoot();
            if (!root) {
                await showError(
                    'Project root could not be determined.\n\nOpen a file inside a project (with buildkit.yaml or pubspec.yaml) first.',
                );
                return undefined;
            }
            return root;
        }
        case 'repository': {
            const root = findRepositoryRoot();
            if (!root) {
                await showError(
                    'Repository root could not be determined.\n\nOpen a file inside a git repository first.',
                );
                return undefined;
            }
            return root;
        }
        case 'document': {
            const dir = getActiveFileDir();
            if (!dir) {
                await showError(
                    'Document root could not be determined.\n\nOpen a file in the editor first.',
                );
                return undefined;
            }
            return dir;
        }
        case 'custom':
        default: {
            if (!entry.cwd) {
                await showError('Custom working directory path is missing.');
                return undefined;
            }
            const resolved = resolveAbsolute(entry.cwd);
            if (!fs.existsSync(resolved)) {
                await showError(`Custom working directory does not exist:\n${resolved}`);
                return undefined;
            }
            return resolved;
        }
    }
}

async function executeCommandline(): Promise<void> {
  try {
    const commandlines = getCommandlines();
    if (commandlines.length === 0) {
        vscode.window.showInformationMessage('No commandlines defined. Use "Add Commandline" first.');
        return;
    }

    const items = commandlines.map((entry, index) => ({
        label: entry.description || entry.command,
        description: entry.description ? entry.command : undefined,
        detail: `cwd: ${cwdModeLabel(entry.cwdMode)}${entry.postActions?.length ? ` -> ${entry.postActions.length} post-action(s)` : ''}`,
        _index: index,
    }));

    const picked = await vscode.window.showQuickPick(items, {
        title: 'Execute Commandline',
        placeHolder: 'Select a commandline to execute',
    });
    if (!picked) { return; }

    const entry = commandlines[picked._index];

    // Resolve effective working directory at runtime
    const effectiveCwd = await resolveExecutionCwd(entry);
    if (!effectiveCwd) { return; }

    // Expand placeholders in command string
    const expandedCommand = expandPlaceholders(entry.command);
    if (expandedCommand === undefined) { return; } // error already shown

    // Confirmation only for dynamic modes (project, repository, document)
    const mode: CwdMode = entry.cwdMode || 'custom';
    if (mode === 'project' || mode === 'repository' || mode === 'document') {
        const confirm = await vscode.window.showInformationMessage(
            `Run in ${cwdModeLabel(mode)}?`,
            { modal: true, detail: `Directory: ${effectiveCwd}\nCommand: ${expandedCommand}` },
            'OK',
        );
        if (confirm !== 'OK') { return; }
    }

    // Use saved post-actions directly — no picker at execution time
    const postActions: string[] = entry.postActions || [];

    // Execute in VS Code terminal
    const terminal = vscode.window.createTerminal({
        name: entry.description || entry.command,
        cwd: effectiveCwd,
    });
    terminal.show();
    terminal.sendText(expandedCommand);

    // Run post-actions
    if (postActions.length > 0) {
        for (const commandId of postActions) {
            try {
                await vscode.commands.executeCommand(commandId);
            } catch (err: any) {
                vscode.window.showWarningMessage(`Post-action failed: ${commandId} - ${err.message}`);
            }
        }
    }
  } catch (err: any) {
    console.error(`[commandline-handler] executeCommandline error:`, err);
    vscode.window.showErrorMessage(`Execute commandline failed: ${err.message}`);
  }
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
