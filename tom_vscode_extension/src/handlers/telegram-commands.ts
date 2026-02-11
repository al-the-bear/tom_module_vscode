/**
 * Telegram standalone command handlers.
 *
 * Provides two VS Code commands:
 *  - dartscript.telegramTest   — Send a test message to verify bot token & chat ID
 *  - dartscript.telegramToggle — Start/stop Telegram polling independent of bot conversations
 *
 * Configuration is read from botConversation.telegram in send_to_chat.json.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { bridgeLog } from './handler_shared';
import { TelegramNotifier, TelegramConfig, TelegramCommand, parseTelegramConfig } from './telegram-notifier';

// ============================================================================
// State
// ============================================================================

/** Singleton notifier for standalone polling mode. */
let standaloneTelegram: TelegramNotifier | null = null;
let isPollingActive = false;

// ============================================================================
// Config loading
// ============================================================================

/** Resolve the path to send_to_chat.json. */
function getConfigPath(): string | undefined {
    const wf = vscode.workspace.workspaceFolders;
    if (!wf || wf.length === 0) { return undefined; }
    return path.join(wf[0].uri.fsPath, '_ai', 'send_to_chat', 'send_to_chat.json');
}

/** Load the Telegram config from send_to_chat.json → botConversation.telegram. */
function loadTelegramConfig(): TelegramConfig | undefined {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
        vscode.window.showErrorMessage('Cannot find send_to_chat.json config file.');
        return undefined;
    }

    try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const telegramRaw = raw?.botConversation?.telegram;
        if (!telegramRaw) {
            vscode.window.showErrorMessage('No botConversation.telegram section in send_to_chat.json.');
            return undefined;
        }
        return parseTelegramConfig(telegramRaw);
    } catch (err: any) {
        vscode.window.showErrorMessage(`Error reading Telegram config: ${err.message}`);
        return undefined;
    }
}

// ============================================================================
// Test Connection command
// ============================================================================

/**
 * Send a test message to the configured Telegram chat to verify
 * the bot token and chat ID are correct.
 */
export async function telegramTestHandler(): Promise<void> {
    bridgeLog('[Telegram] Test connection command invoked');

    const config = loadTelegramConfig();
    if (!config) { return; }

    if (!config.botTokenEnv) {
        vscode.window.showWarningMessage('Telegram botTokenEnv is not configured. Set it in send_to_chat.json → botConversation.telegram.');
        return;
    }
    if (!config.botToken) {
        vscode.window.showWarningMessage(`Environment variable '${config.botTokenEnv}' is not set. Export it before starting VS Code.`);
        return;
    }
    if (!config.defaultChatId) {
        vscode.window.showWarningMessage('Telegram defaultChatId is not configured. Set it in send_to_chat.json → botConversation.telegram.');
        return;
    }

    // Create a temporary notifier with enabled forced to true for the test
    const testConfig: TelegramConfig = {
        ...config,
        enabled: true,
        // For the test, we need at least one allowed user — use a dummy if empty
        allowedUserIds: config.allowedUserIds.length > 0 ? config.allowedUserIds : [0],
    };
    const notifier = new TelegramNotifier(testConfig);

    const timestamp = new Date().toLocaleString();
    const testMsg = `🔔 *Telegram Test*\n\nConnection successful!\n_Sent from DartScript VS Code Extension_\n_${timestamp}_`;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Testing Telegram connection...' },
        async () => {
            const success = await notifier.sendMessage(testMsg);
            if (success) {
                vscode.window.showInformationMessage('✅ Telegram test message sent successfully!');
                bridgeLog('[Telegram] Test message sent successfully');
            } else {
                vscode.window.showErrorMessage('❌ Failed to send Telegram test message. Check bot token and chat ID.');
                bridgeLog('[Telegram] Test message FAILED', 'ERROR');
            }
        }
    );
}

// ============================================================================
// Toggle Polling command
// ============================================================================

/**
 * Toggle Telegram polling on/off. When active, incoming commands are shown
 * as VS Code notifications and can trigger extension actions.
 */
export async function telegramToggleHandler(): Promise<void> {
    bridgeLog('[Telegram] Toggle polling command invoked');

    if (isPollingActive && standaloneTelegram) {
        // Stop polling
        standaloneTelegram.dispose();
        standaloneTelegram = null;
        isPollingActive = false;
        vscode.window.showInformationMessage('⏹ Telegram polling stopped.');
        bridgeLog('[Telegram] Standalone polling stopped');
        return;
    }

    // Start polling
    const config = loadTelegramConfig();
    if (!config) { return; }

    if (!config.botTokenEnv) {
        vscode.window.showWarningMessage('Telegram botTokenEnv is not configured. Set it in send_to_chat.json → botConversation.telegram.');
        return;
    }
    if (!config.botToken) {
        vscode.window.showWarningMessage(`Environment variable '${config.botTokenEnv}' is not set. Export it before starting VS Code.`);
        return;
    }
    if (config.allowedUserIds.length === 0) {
        vscode.window.showWarningMessage('Telegram allowedUserIds is empty. Add your Telegram user ID to send_to_chat.json → botConversation.telegram.');
        return;
    }

    // Force enabled for standalone mode
    const pollingConfig: TelegramConfig = { ...config, enabled: true };
    standaloneTelegram = new TelegramNotifier(pollingConfig);

    standaloneTelegram.onCommand((cmd: TelegramCommand) => {
        handleStandaloneCommand(cmd);
    });

    standaloneTelegram.startPolling();
    isPollingActive = true;
    vscode.window.showInformationMessage(`▶️ Telegram polling started (interval: ${config.pollIntervalMs}ms).`);
    bridgeLog(`[Telegram] Standalone polling started (interval: ${config.pollIntervalMs}ms)`);
}

/**
 * Handle commands received via standalone Telegram polling.
 * Shows them as VS Code notifications.
 */
function handleStandaloneCommand(cmd: TelegramCommand): void {
    bridgeLog(`[Telegram] Standalone command: ${cmd.type} from @${cmd.username}`);

    switch (cmd.type) {
        case 'status':
            standaloneTelegram?.sendMessage(
                `📊 *VS Code Status*\n\n` +
                `*Polling:* Active\n` +
                `*Workspace:* ${vscode.workspace.workspaceFolders?.[0]?.name ?? 'none'}\n` +
                `*Time:* ${new Date().toLocaleString()}`
            );
            break;

        case 'info':
            vscode.window.showInformationMessage(`📩 Telegram from @${cmd.username}: ${cmd.text}`);
            standaloneTelegram?.sendMessage(`✅ Message displayed in VS Code.`);
            break;

        case 'stop':
            // Stop polling via Telegram
            standaloneTelegram?.sendMessage('⏹ Polling stopped via Telegram command.');
            standaloneTelegram?.dispose();
            standaloneTelegram = null;
            isPollingActive = false;
            vscode.window.showInformationMessage('⏹ Telegram polling stopped (via /stop command).');
            break;

        default:
            vscode.window.showInformationMessage(`📩 Telegram /${cmd.type} from @${cmd.username}`);
            standaloneTelegram?.sendMessage(`ℹ️ Command /${cmd.type} received. No action in standalone mode.`);
            break;
    }
}

// ============================================================================
// Disposal
// ============================================================================

/** Dispose standalone Telegram resources. Called on extension deactivation. */
export function disposeTelegramStandalone(): void {
    if (standaloneTelegram) {
        standaloneTelegram.dispose();
        standaloneTelegram = null;
        isPollingActive = false;
    }
}
