/**
 * DartScript VS Code Extension
 * 
 * Main extension entry point. This file handles activation, deactivation,
 * and command registration. All command implementations are in separate
 * handler files in the handlers/ directory.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Bridge and test utilities
import { DartBridgeClient } from './vscode-bridge';

// Command handlers
import {
    bridgeLog,
    getBridgeClient,
    setBridgeClient,
    initializeBridgeClient,
    sendToChatHandler,
    SendToChatAdvancedManager,
    executeInTomAiBuildHandler,
    executeAsScriptHandler,
    restartBridgeHandler,
    runTestsHandler,
    reloadWindowHandler,
    startCliServerHandler,
    startCliServerCustomPortHandler,
    stopCliServerHandler,
    startProcessMonitorHandler,
    toggleBridgeDebugLoggingHandler,
    printConfigurationHandler,
    showHelpHandler,
    showApiInfoHandler,
    startTomAiChatHandler,
    sendToTomAiChatHandler,
    interruptTomAiChatHandler
} from './handlers';

// Tom AI Chat tools
import { registerTomAiChatTools } from './tools/tomAiChat-tools';

// Global manager instance for SendToChatAdvanced
let sendToChatAdvancedManager: SendToChatAdvancedManager | undefined;

// ============================================================================
// Extension Lifecycle
// ============================================================================

/**
 * Main extension activation function
 */
export async function activate(context: vscode.ExtensionContext) {
    bridgeLog('DartScript extension is now active!');

    // Initialize bridge client
    const bridgeClient = initializeBridgeClient(context);

    // Register all commands
    registerCommands(context);

    // Check for test reinstall marker and send reload prompt to Copilot Chat
    checkTestReinstallMarker();

    // Auto-start the Dart bridge
    await restartBridgeHandler(context, false);

    // Initialize Send to Chat Advanced manager
    sendToChatAdvancedManager = new SendToChatAdvancedManager(context, DartBridgeClient.outputChannel);
    await sendToChatAdvancedManager.initialize();
    context.subscriptions.push({ dispose: () => sendToChatAdvancedManager?.dispose() });

    // Register Tom AI Chat tools
    registerTomAiChatTools(context);

    // Show activation message
    vscode.window.showInformationMessage('DartScript extension activated!');

    bridgeLog('DartScript extension is now active!');
}

/**
 * Extension deactivation function
 * Note: This is called synchronously when VS Code is about to reload/close
 */
export function deactivate() {
    bridgeLog('DartScript extension deactivating - stopping bridge...');
    
    // Stop the bridge process to ensure clean shutdown
    const bridgeClient = getBridgeClient();
    if (bridgeClient) {
        try {
            bridgeClient.stop();
            bridgeLog('Bridge process stopped');
        } catch (error) {
            bridgeLog(`Failed to stop bridge: ${error}`, 'ERROR');
        }
    }
    
    bridgeLog('DartScript extension deactivated');
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Send to Chat command - sends selected text to Copilot Chat
    const sendToChatCmd = vscode.commands.registerCommand(
        'dartscript.sendToChat',
        async () => {
            await sendToChatHandler();
        }
    );

    // Execute Dart file in DartScript (executeFile)
    const executeInTomAiBuildCmd = vscode.commands.registerCommand(
        'dartscript.executeFile',
        async (uri?: vscode.Uri) => {
            await executeInTomAiBuildHandler(uri, context);
        }
    );

    // Execute Dart file as script in DartScript (executeScript)
    const executeAsScriptInTomAiBuildCmd = vscode.commands.registerCommand(
        'dartscript.executeScript',
        async (uri?: vscode.Uri) => {
            await executeAsScriptHandler(uri, context);
        }
    );

    // Restart/Start Dart Bridge command
    const restartBridgeCmd = vscode.commands.registerCommand(
        'dartscript.restartBridge',
        async () => {
            await restartBridgeHandler(context, true);
        }
    );

    // Run Tests command - executes all tests from tom_vscode_bridge/test/
    const runTestsCmd = vscode.commands.registerCommand(
        'dartscript.runTests',
        async () => {
            return await runTestsHandler(context);
        }
    );

    // Reload window with bridge notification command
    const reloadWithBridgeNotificationCmd = vscode.commands.registerCommand(
        'dartscript.reloadWindow',
        async () => {
            await reloadWindowHandler();
        }
    );

    // Reload Send to Chat config command
    const reloadSendToChatConfigCmd = vscode.commands.registerCommand(
        'dartscript.reloadSendToChatConfig',
        async () => {
            if (sendToChatAdvancedManager) {
                await sendToChatAdvancedManager.loadConfig();
                vscode.window.showInformationMessage('Send to Chat configuration reloaded');
            }
        }
    );

    // CLI Integration Server commands
    const startCliServerCmd = vscode.commands.registerCommand(
        'dartscript.startCliServer',
        async () => {
            await startCliServerHandler();
        }
    );

    const startCliServerCustomPortCmd = vscode.commands.registerCommand(
        'dartscript.startCliServerCustomPort',
        async () => {
            await startCliServerCustomPortHandler();
        }
    );

    const stopCliServerCmd = vscode.commands.registerCommand(
        'dartscript.stopCliServer',
        async () => {
            await stopCliServerHandler();
        }
    );

    // Process Monitor command
    const startProcessMonitorCmd = vscode.commands.registerCommand(
        'dartscript.startProcessMonitor',
        async () => {
            await startProcessMonitorHandler();
        }
    );

    // Debug Logging toggle command
    const toggleDebugLoggingCmd = vscode.commands.registerCommand(
        'dartscript.toggleBridgeDebugLogging',
        async () => {
            await toggleBridgeDebugLoggingHandler();
        }
    );

    // Print Configuration command
    const printConfigurationCmd = vscode.commands.registerCommand(
        'dartscript.printConfiguration',
        async () => {
            await printConfigurationHandler();
        }
    );

    // Show Help command
    const showHelpCmd = vscode.commands.registerCommand(
        'dartscript.showHelp',
        async () => {
            await showHelpHandler();
        }
    );

    // Show API Info command
    const showApiInfoCmd = vscode.commands.registerCommand(
        'dartscript.showApiInfo',
        async () => {
            await showApiInfoHandler();
        }
    );

    // Tom AI Chat commands
    const startTomAiChatCmd = vscode.commands.registerCommand(
        'dartscript.startTomAIChat',
        async () => {
            await startTomAiChatHandler();
        }
    );

    const sendToTomAiChatCmd = vscode.commands.registerCommand(
        'dartscript.sendToTomAIChat',
        async () => {
            await sendToTomAiChatHandler();
        }
    );

    const interruptTomAiChatCmd = vscode.commands.registerCommand(
        'dartscript.interruptTomAIChat',
        () => {
            interruptTomAiChatHandler();
        }
    );

    // Add all commands to subscriptions
    context.subscriptions.push(
        sendToChatCmd,
        executeInTomAiBuildCmd,
        executeAsScriptInTomAiBuildCmd,
        restartBridgeCmd,
        runTestsCmd,
        reloadWithBridgeNotificationCmd,
        reloadSendToChatConfigCmd,
        startCliServerCmd,
        startCliServerCustomPortCmd,
        stopCliServerCmd,
        startProcessMonitorCmd,
        toggleDebugLoggingCmd,
        printConfigurationCmd,
        showHelpCmd,
        showApiInfoCmd,
        startTomAiChatCmd,
        sendToTomAiChatCmd,
        interruptTomAiChatCmd
    );
}

// ============================================================================
// Activation Helpers
// ============================================================================

/**
 * Check for test reinstall marker and show reminder notification
 */
function checkTestReinstallMarker(): void {
    try {
        const markerPath = path.join(os.homedir(), '.vscode-tom-test-reinstall');

        if (fs.existsSync(markerPath)) {
            // Read timestamp from marker
            const timestamp = fs.readFileSync(markerPath, 'utf8').trim();
            const markerDate = new Date(parseInt(timestamp) * 1000);
            const now = new Date();
            const ageMinutes = Math.floor((now.getTime() - markerDate.getTime()) / 60000);

            // Only show if marker is recent (within 5 minutes)
            if (ageMinutes < 5) {
                // Show reminder after a brief delay to let extension fully activate
                setTimeout(() => {
                    vscode.commands.executeCommand('workbench.action.chat.open', { query: '!!!Reload finished' });
                    try {
                        fs.unlinkSync(markerPath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }, 5000);
            } else {
                // Marker is old, just delete it
                fs.unlinkSync(markerPath);
            }
        }
    } catch (error) {
        // Silently ignore errors checking for marker
        console.error('Error checking test reinstall marker:', error);
    }
}
