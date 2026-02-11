/**
 * Handler for dartscript.restartBridge command.
 * 
 * Starts or restarts the Dart bridge server using the configured profile
 * from send_to_chat.json → dartscriptBridge section.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    handleError,
    getWorkspaceRoot,
    getConfigPath,
    getBridgeClient,
    setBridgeClient
} from './handler_shared';
import { DartBridgeClient } from '../vscode-bridge';

// ────────────────────────────────────────────────────────────────
// Bridge Profile Types
// ────────────────────────────────────────────────────────────────

export interface BridgeProfile {
    label: string;
    command: string;
    args: string[];
    cwd: string;
    runPubGet: boolean;
}

export interface BridgeConfig {
    current: string;
    profiles: Record<string, BridgeProfile>;
}

// ────────────────────────────────────────────────────────────────
// Config Loading
// ────────────────────────────────────────────────────────────────

// getConfigPath() is imported from handler_shared

function resolveWorkspacePlaceholders(value: string): string {
    const wf = vscode.workspace.workspaceFolders;
    if (wf && wf.length > 0) {
        return value.replace(/\$\{workspaceFolder\}/g, wf[0].uri.fsPath);
    }
    return value;
}

/**
 * Load bridge configuration from send_to_chat.json.
 * Returns undefined if no config section exists (falls back to legacy behaviour).
 */
export function loadBridgeConfig(): BridgeConfig | undefined {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) { return undefined; }

    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const sec = parsed?.dartscriptBridge;
        if (!sec || typeof sec !== 'object') { return undefined; }

        const profiles: Record<string, BridgeProfile> = {};
        if (sec.profiles && typeof sec.profiles === 'object') {
            for (const [key, val] of Object.entries(sec.profiles)) {
                const p = val as any;
                if (p && typeof p === 'object' && typeof p.command === 'string') {
                    profiles[key] = {
                        label: typeof p.label === 'string' ? p.label : key,
                        command: p.command,
                        args: Array.isArray(p.args) ? p.args : [],
                        cwd: typeof p.cwd === 'string' ? resolveWorkspacePlaceholders(p.cwd) : '',
                        runPubGet: p.runPubGet === true,
                    };
                }
            }
        }

        if (Object.keys(profiles).length === 0) { return undefined; }

        const current = typeof sec.current === 'string' && profiles[sec.current]
            ? sec.current
            : Object.keys(profiles)[0];

        return { current, profiles };
    } catch {
        return undefined;
    }
}

/**
 * Persist the selected profile key back to send_to_chat.json.
 */
function saveBridgeCurrentProfile(profileKey: string): void {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) { return; }

    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.dartscriptBridge) { return; }
        parsed.dartscriptBridge.current = profileKey;
        fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
    } catch {
        // Ignore write errors
    }
}

// ────────────────────────────────────────────────────────────────
// Restart Bridge
// ────────────────────────────────────────────────────────────────

/**
 * Start or restart the Dart bridge using the active profile.
 */
export async function restartBridgeHandler(
    context: vscode.ExtensionContext,
    showMessages: boolean = true
): Promise<void> {
    try {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
            if (showMessages) {
                vscode.window.showErrorMessage('No workspace folder open');
            }
            return;
        }

        // Load bridge config — fall back to legacy hardcoded path
        const bridgeConfig = loadBridgeConfig();
        let bridgePath: string;
        let command: string | undefined;
        let args: string[] | undefined;
        let runPubGet = true;

        if (bridgeConfig) {
            const profile = bridgeConfig.profiles[bridgeConfig.current];
            bridgePath = profile.cwd || workspaceRoot;
            command = profile.command;
            args = profile.args;
            runPubGet = profile.runPubGet;
        } else {
            // Legacy: hardcoded development path
            bridgePath = path.join(workspaceRoot, 'xternal', 'tom_module_vscode', 'tom_vscode_bridge');
        }

        if (!fs.existsSync(bridgePath)) {
            if (showMessages) {
                vscode.window.showErrorMessage(`Bridge working directory not found: ${bridgePath}`);
            }
            return;
        }

        let bridgeClient = getBridgeClient();

        // Stop existing bridge if running
        if (bridgeClient) {
            if (showMessages) {
                vscode.window.showInformationMessage('Stopping existing Dart bridge...');
            }
            bridgeClient.stop();
        }

        if (showMessages) {
            const label = bridgeConfig
                ? bridgeConfig.profiles[bridgeConfig.current].label
                : 'Development (legacy)';
            vscode.window.showInformationMessage(`Starting Dart bridge [${label}]...`);
        }

        // Create new bridge client if needed
        if (!bridgeClient) {
            bridgeClient = new DartBridgeClient(context);
            setBridgeClient(bridgeClient);
        }

        // Start the bridge with the resolved configuration
        if (command !== undefined && args !== undefined) {
            await bridgeClient.startWithAutoRestart(bridgePath, command, args, runPubGet);
        } else {
            await bridgeClient.startWithAutoRestart(bridgePath);
        }

        if (showMessages) {
            vscode.window.showInformationMessage('Dart bridge started successfully');
        }

    } catch (error) {
        handleError('Failed to start Dart bridge', error);
    }
}

// ────────────────────────────────────────────────────────────────
// Switch Bridge Profile
// ────────────────────────────────────────────────────────────────

/**
 * Show a QuickPick to select a bridge profile, persist the choice,
 * and restart the bridge with the new profile.
 */
export async function switchBridgeProfileHandler(
    context: vscode.ExtensionContext
): Promise<void> {
    const bridgeConfig = loadBridgeConfig();
    if (!bridgeConfig) {
        vscode.window.showWarningMessage(
            'No dartscriptBridge profiles configured in send_to_chat.json'
        );
        return;
    }

    interface ProfileItem extends vscode.QuickPickItem {
        profileKey: string;
    }

    const items: ProfileItem[] = Object.entries(bridgeConfig.profiles).map(
        ([key, profile]) => {
            const cmdLine = [profile.command, ...profile.args].join(' ');
            return {
                label: profile.label,
                description: key === bridgeConfig.current ? '$(check) active' : '',
                detail: cmdLine,
                profileKey: key,
            };
        }
    );

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a Dartscript Bridge profile',
        title: 'Switch Dartscript Bridge Profile',
    });

    if (!picked) { return; }

    // Persist and restart
    saveBridgeCurrentProfile(picked.profileKey);
    await restartBridgeHandler(context, true);
}

// ────────────────────────────────────────────────────────────────
// Bridge Client Initialization
// ────────────────────────────────────────────────────────────────

/**
 * Initialize the bridge client during extension activation
 */
export function initializeBridgeClient(context: vscode.ExtensionContext): DartBridgeClient {
    const bridgeClient = new DartBridgeClient(context);
    setBridgeClient(bridgeClient);
    
    // Register cleanup handlers
    context.subscriptions.push(bridgeClient.getOutputChannel());
    context.subscriptions.push(new vscode.Disposable(() => bridgeClient?.stop()));
    process.on('exit', () => bridgeClient?.stop());
    process.on('SIGTERM', () => bridgeClient?.stop());
    
    return bridgeClient;
}
