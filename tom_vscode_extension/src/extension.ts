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
    switchBridgeProfileHandler,
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
    interruptTomAiChatHandler,
    expandPromptHandler,
    PromptExpanderManager,
    setPromptExpanderManager,
    getPromptExpanderManager,
    createProfileHandler,
    switchModelHandler,
    startBotConversationHandler,
    stopBotConversationHandler,
    haltBotConversationHandler,
    continueBotConversationHandler,
    addToBotConversationHandler,
    BotConversationManager,
    setBotConversationManager,
    registerChordMenuCommands,
    registerCommandlineCommands,
    registerCombinedCommands,
    registerStateMachineCommands,
    registerDsNotesViews,
    telegramTestHandler,
    telegramToggleHandler,
    telegramConfigureHandler,
    disposeTelegramStandalone,
} from './handlers';

// Tom AI Chat tools
import { registerTomAiChatTools } from './tools/tomAiChat-tools';
import { initializeToolDescriptions } from './tools/tool-executors';

// Global manager instance for SendToChatAdvanced
let sendToChatAdvancedManager: SendToChatAdvancedManager | undefined;

// Global manager instance for Prompt Expander
let promptExpanderManager: PromptExpanderManager | undefined;

// Global manager instance for Bot Conversation
let botConversationManager: BotConversationManager | undefined;

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

    // Register chord menu (which-key) commands
    registerChordMenuCommands(context);

    // Register commandline commands
    registerCommandlineCommands(context);

    // Register combined commands (configurable multi-command shortcuts)
    registerCombinedCommands(context);

    // Register state machine commands (stateful multi-command shortcuts)
    registerStateMachineCommands(context);

    // Register DS Notes panel views
    registerDsNotesViews(context);

    // Check for test reinstall marker and send reload prompt to Copilot Chat
    checkTestReinstallMarker();

    // Auto-start the Dart bridge
    await restartBridgeHandler(context, false);

    // Initialize Send to Chat Advanced manager
    sendToChatAdvancedManager = new SendToChatAdvancedManager(context, DartBridgeClient.outputChannel);
    await sendToChatAdvancedManager.initialize();
    context.subscriptions.push({ dispose: () => sendToChatAdvancedManager?.dispose() });

    // Initialize Prompt Expander manager
    promptExpanderManager = new PromptExpanderManager(context);
    setPromptExpanderManager(promptExpanderManager);
    registerLocalLlmContextMenuCommands(context);
    context.subscriptions.push({ dispose: () => promptExpanderManager?.dispose() });

    // Initialize Bot Conversation manager
    botConversationManager = new BotConversationManager(context);
    setBotConversationManager(botConversationManager);
    context.subscriptions.push({ dispose: () => botConversationManager?.dispose() });

    // Dispose standalone Telegram on deactivation
    context.subscriptions.push({ dispose: () => disposeTelegramStandalone() });

    // Register Tom AI Chat tools
    initializeToolDescriptions();
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

    // Switch Bridge Profile command
    const switchBridgeProfileCmd = vscode.commands.registerCommand(
        'dartscript.switchBridgeProfile',
        async () => {
            await switchBridgeProfileHandler(context);
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

    // Expand Prompt with local Ollama model
    const expandPromptCmd = vscode.commands.registerCommand(
        'dartscript.expandPrompt',
        async () => {
            await expandPromptHandler();
        }
    );

    // Switch local Ollama model
    const switchLocalModelCmd = vscode.commands.registerCommand(
        'dartscript.switchLocalModel',
        async () => {
            await switchModelHandler();
        }
    );

    // Start Bot Conversation
    const startBotConversationCmd = vscode.commands.registerCommand(
        'dartscript.startBotConversation',
        async () => {
            await startBotConversationHandler();
        }
    );

    // Stop Bot Conversation
    const stopBotConversationCmd = vscode.commands.registerCommand(
        'dartscript.stopBotConversation',
        async () => {
            await stopBotConversationHandler();
        }
    );

    // Halt Bot Conversation
    const haltBotConversationCmd = vscode.commands.registerCommand(
        'dartscript.haltBotConversation',
        async () => {
            await haltBotConversationHandler();
        }
    );

    // Continue Bot Conversation
    const continueBotConversationCmd = vscode.commands.registerCommand(
        'dartscript.continueBotConversation',
        async () => {
            await continueBotConversationHandler();
        }
    );

    // Add to Bot Conversation
    const addToBotConversationCmd = vscode.commands.registerCommand(
        'dartscript.addToBotConversation',
        async () => {
            await addToBotConversationHandler();
        }
    );

    // Telegram Test Connection
    const telegramTestCmd = vscode.commands.registerCommand(
        'dartscript.telegramTest',
        async () => {
            await telegramTestHandler();
        }
    );

    // Telegram Toggle Polling
    const telegramToggleCmd = vscode.commands.registerCommand(
        'dartscript.telegramToggle',
        async () => {
            await telegramToggleHandler();
        }
    );

    // Telegram Configure
    const telegramConfigureCmd = vscode.commands.registerCommand(
        'dartscript.telegramConfigure',
        async () => {
            await telegramConfigureHandler();
        }
    );

    // Add all commands to subscriptions
    context.subscriptions.push(
        sendToChatCmd,
        executeInTomAiBuildCmd,
        executeAsScriptInTomAiBuildCmd,
        restartBridgeCmd,
        switchBridgeProfileCmd,
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
        interruptTomAiChatCmd,
        expandPromptCmd,
        switchLocalModelCmd,
        startBotConversationCmd,
        stopBotConversationCmd,
        haltBotConversationCmd,
        continueBotConversationCmd,
        addToBotConversationCmd,
        telegramTestCmd,
        telegramToggleCmd,
        telegramConfigureCmd
    );
}

// ============================================================================
// Local LLM Context Menu Registration
// ============================================================================

/**
 * Dynamically register context menu commands for each profile defined in
 * the Prompt Expander config. Also registers the three base commands:
 *  - dartscript.sendToLocalLlm          (shows profile picker)
 *  - dartscript.sendToLocalLlmStandard  (uses default profile)
 *  - dartscript.sendToLocalLlmAdvanced  (shows profile picker — alias)
 */
function registerLocalLlmContextMenuCommands(context: vscode.ExtensionContext): void {
    if (!promptExpanderManager) { return; }

    // Base command — uses default profile (direct send, no picker)
    const sendToLocalLlm = vscode.commands.registerCommand(
        'dartscript.sendToLocalLlm',
        async () => {
            bridgeLog('sendToLocalLlm command invoked');
            try {
                if (!promptExpanderManager) { return; }
                const config = promptExpanderManager.loadConfig();
                const defaultKey = Object.entries(config.profiles)
                    .find(([_, p]) => p.isDefault)?.[0]
                    ?? Object.keys(config.profiles)[0]
                    ?? undefined;
                await promptExpanderManager.expandPromptCommand(defaultKey);
            } catch (error) {
                bridgeLog(`sendToLocalLlm FAILED: ${error}`, 'ERROR');
                vscode.window.showErrorMessage(`Send to Local LLM failed: ${error}`);
            }
        }
    );

    // Standard — same as base (uses default profile without asking)
    const sendToLocalLlmStandard = vscode.commands.registerCommand(
        'dartscript.sendToLocalLlmStandard',
        async () => {
            bridgeLog('sendToLocalLlmStandard command invoked');
            try {
                if (!promptExpanderManager) { return; }
                const config = promptExpanderManager.loadConfig();
                const defaultKey = Object.entries(config.profiles)
                    .find(([_, p]) => p.isDefault)?.[0]
                    ?? Object.keys(config.profiles)[0]
                    ?? undefined;
                await promptExpanderManager.expandPromptCommand(defaultKey);
            } catch (error) {
                bridgeLog(`sendToLocalLlmStandard FAILED: ${error}`, 'ERROR');
                vscode.window.showErrorMessage(`Send to Local LLM (Standard) failed: ${error}`);
            }
        }
    );

    // Advanced — shows profile picker (for expand/rewrite/detailed etc.)
    const sendToLocalLlmAdvanced = vscode.commands.registerCommand(
        'dartscript.sendToLocalLlmAdvanced',
        async () => {
            bridgeLog('sendToLocalLlmAdvanced command invoked');
            try {
                await promptExpanderManager?.expandPromptCommand();
            } catch (error) {
                bridgeLog(`sendToLocalLlmAdvanced FAILED: ${error}`, 'ERROR');
                vscode.window.showErrorMessage(`Send to Local LLM (Advanced) failed: ${error}`);
            }
        }
    );

    context.subscriptions.push(sendToLocalLlm, sendToLocalLlmStandard, sendToLocalLlmAdvanced);

    // Dynamic per-profile commands (dartscript.sendToLocalLlm.<profileKey>)
    try {
        const config = promptExpanderManager.loadConfig();
        for (const profileKey of Object.keys(config.profiles)) {
            const cmd = vscode.commands.registerCommand(
                `dartscript.sendToLocalLlm.${profileKey}`,
                createProfileHandler(profileKey)
            );
            context.subscriptions.push(cmd);
            promptExpanderManager['registeredCommands'].push(cmd);
        }
    } catch (e) {
        bridgeLog(`Failed to register local LLM profile commands: ${e}`, 'ERROR');
    }
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
