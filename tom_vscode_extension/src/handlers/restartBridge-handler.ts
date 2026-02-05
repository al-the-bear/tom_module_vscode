/**
 * Handler for dartscript.restartBridge command.
 * 
 * Starts or restarts the Dart bridge server.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    handleError,
    getWorkspaceRoot,
    getBridgeClient,
    setBridgeClient
} from './handler_shared';
import { DartBridgeClient } from '../vscode-bridge';

/**
 * Start or restart the Dart bridge
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

        const bridgePath = path.join(workspaceRoot, 'xternal', 'tom_module_vscode', 'tom_vscode_bridge');
        if (!fs.existsSync(bridgePath)) {
            if (showMessages) {
                vscode.window.showErrorMessage('tom_vscode_bridge not found in workspace (expected at xternal/tom_module_vscode/tom_vscode_bridge)');
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
            vscode.window.showInformationMessage('Starting Dart bridge...');
        }

        // Create new bridge client if needed
        if (!bridgeClient) {
            bridgeClient = new DartBridgeClient(context);
            setBridgeClient(bridgeClient);
        }

        // Start the bridge with auto-restart on error
        await bridgeClient.startWithAutoRestart(bridgePath);

        if (showMessages) {
            vscode.window.showInformationMessage('Dart bridge started successfully');
        }

    } catch (error) {
        handleError('Failed to start Dart bridge', error);
    }
}

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
