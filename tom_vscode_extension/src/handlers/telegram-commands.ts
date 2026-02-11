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
// Configure Telegram command
// ============================================================================

/**
 * Interactive configuration for Telegram integration.
 * Prompts for env var name, allowed user IDs, default chat ID, and enabled state,
 * then writes the values back to send_to_chat.json → botConversation.telegram.
 */
export async function telegramConfigureHandler(): Promise<void> {
    bridgeLog('[Telegram] Configure command invoked');

    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
        vscode.window.showErrorMessage('Cannot find send_to_chat.json config file.');
        return;
    }

    let raw: any;
    try {
        raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err: any) {
        vscode.window.showErrorMessage(`Error reading config: ${err.message}`);
        return;
    }

    const telegram = raw?.botConversation?.telegram;
    if (!telegram) {
        vscode.window.showErrorMessage('No botConversation.telegram section in send_to_chat.json.');
        return;
    }

    // --- Step 1: Bot token env var name ---
    const tokenEnv = await vscode.window.showInputBox({
        title: 'Configure Telegram (1/4): Bot Token Environment Variable',
        prompt: 'Name of the environment variable holding the bot token',
        value: telegram.botTokenEnv ?? 'TELEGRAM_BOT_TOKEN',
        placeHolder: 'TELEGRAM_BOT_TOKEN',
        ignoreFocusOut: true,
    });
    if (tokenEnv === undefined) { return; } // cancelled

    // --- Step 2: Allowed user IDs ---
    const currentUsers = (telegram.allowedUserIds ?? []).join(', ');
    const usersInput = await vscode.window.showInputBox({
        title: 'Configure Telegram (2/4): Allowed User IDs',
        prompt: 'Comma-separated Telegram user IDs allowed to send commands',
        value: currentUsers,
        placeHolder: '123456789, 987654321',
        ignoreFocusOut: true,
    });
    if (usersInput === undefined) { return; } // cancelled

    const allowedUserIds = usersInput
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(Number)
        .filter(n => !isNaN(n) && n > 0);

    // --- Step 3: Default chat ID ---
    const currentChat = telegram.defaultChatId !== null && telegram.defaultChatId !== undefined ? String(telegram.defaultChatId) : '';
    const chatIdInput = await vscode.window.showInputBox({
        title: 'Configure Telegram (3/4): Default Chat ID',
        prompt: 'Telegram chat ID for notifications (leave empty for none)',
        value: currentChat,
        placeHolder: '-1001234567890',
        ignoreFocusOut: true,
    });
    if (chatIdInput === undefined) { return; } // cancelled

    const defaultChatId = chatIdInput.trim().length > 0 ? Number(chatIdInput.trim()) : null;
    if (defaultChatId !== null && isNaN(defaultChatId)) {
        vscode.window.showErrorMessage('Invalid chat ID — must be a number.');
        return;
    }

    // --- Step 4: Enabled toggle ---
    const enabledPick = await vscode.window.showQuickPick(
        [
            { label: 'Enabled', description: 'Telegram notifications active', value: true },
            { label: 'Disabled', description: 'Telegram notifications inactive', value: false },
        ],
        {
            title: 'Configure Telegram (4/4): Enable Notifications?',
            placeHolder: telegram.enabled ? 'Currently: enabled' : 'Currently: disabled',
            ignoreFocusOut: true,
        }
    );
    if (!enabledPick) { return; } // cancelled

    // --- Write config ---
    telegram.botTokenEnv = tokenEnv;
    telegram.allowedUserIds = allowedUserIds;
    telegram.defaultChatId = defaultChatId;
    telegram.enabled = enabledPick.value;

    try {
        fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
        const summary = [
            `Token env: ${tokenEnv}`,
            `Users: ${allowedUserIds.length > 0 ? allowedUserIds.join(', ') : '(none)'}`,
            `Chat ID: ${defaultChatId ?? '(none)'}`,
            `Enabled: ${enabledPick.value}`,
        ].join(' | ');
        vscode.window.showInformationMessage(`✅ Telegram configured — ${summary}`);
        bridgeLog(`[Telegram] Configuration saved: ${summary}`);
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to write config: ${err.message}`);
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
