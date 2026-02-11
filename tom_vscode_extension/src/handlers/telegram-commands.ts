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
import { bridgeLog, getConfigPath } from './handler_shared';
import { TelegramNotifier, TelegramConfig, TelegramCommand, TelegramApiResult, parseTelegramConfig } from './telegram-notifier';
import { TelegramCommandRegistry, ParsedTelegramCommand } from './telegram-cmd-parser';
import { TelegramResponseFormatter } from './telegram-cmd-response';
import { createCommandRegistry } from './telegram-cmd-handlers';
import { escapeMarkdownV2 } from './telegram-markdown';

// ============================================================================
// State
// ============================================================================

/** Singleton notifier for standalone polling mode. */
let standaloneTelegram: TelegramNotifier | null = null;
let isPollingActive = false;

/** Command infrastructure for rich command handling. */
let commandRegistry: TelegramCommandRegistry | null = null;
let responseFormatter: TelegramResponseFormatter | null = null;

// ============================================================================
// Config loading
// ============================================================================

// getConfigPath() is imported from handler_shared

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

    // Log configuration details for debugging
    const botId = config.botToken.includes(':') ? config.botToken.split(':')[0] : '(unknown format)';
    bridgeLog(`[Telegram] Using token from env var: ${config.botTokenEnv}`);
    bridgeLog(`[Telegram] Bot ID: ${botId}`);
    bridgeLog(`[Telegram] Target chat ID: ${config.defaultChatId}`);
    bridgeLog(`[Telegram] Token length: ${config.botToken.length} chars`);

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
            const result: TelegramApiResult = await notifier.sendMessageWithDetails(testMsg);
            if (result.ok) {
                vscode.window.showInformationMessage('✅ Telegram test message sent successfully!');
                bridgeLog('[Telegram] Test message sent successfully');
            } else {
                const errorDetail = result.error ?? 'Unknown error';
                vscode.window.showErrorMessage(`❌ Telegram test failed (chatId: ${config.defaultChatId}): ${errorDetail}`);
                bridgeLog(`[Telegram] Test message FAILED to chatId ${config.defaultChatId}: ${errorDetail}`, 'ERROR');
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

    // Initialize command infrastructure
    responseFormatter = new TelegramResponseFormatter(pollingConfig);
    commandRegistry = createCommandRegistry(() => {
        // Stop callback — triggered by stop command
        standaloneTelegram?.sendMessage('⏹ Polling stopped via Telegram command.');
        standaloneTelegram?.dispose();
        standaloneTelegram = null;
        isPollingActive = false;
        commandRegistry = null;
        responseFormatter = null;
        vscode.window.showInformationMessage('⏹ Telegram polling stopped (via stop command).');
    });

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
 * Dispatches to the command registry for rich command handling.
 */
function handleStandaloneCommand(cmd: TelegramCommand): void {
    bridgeLog(`[Telegram] Standalone command: ${cmd.type} raw="${cmd.text}" from @${cmd.username}`);

    // If we have a command registry, try to parse and dispatch
    if (commandRegistry && responseFormatter) {
        // Reconstruct the raw text: for 'unknown' type, the raw text is in cmd.text
        // For known types, build a synthetic command text
        let rawText = cmd.text;
        if (cmd.type !== 'unknown' && cmd.type !== 'info') {
            rawText = cmd.type;
        }

        // Try dispatching to the registry (parser accepts with or without / prefix)
        const parsed = commandRegistry.parse(rawText, cmd.userId, cmd.chatId, cmd.username);

        if (parsed) {
            const def = commandRegistry.get(parsed.command);
            if (def) {
                // Send immediate acknowledgment for long-running commands
                if (def.startMessage) {
                    const argsText = escapeMarkdownV2(parsed.args.join(' '));
                    const ackMsg = def.startMessage.replace('{args}', argsText);
                    responseFormatter?.sendMessage(ackMsg, cmd.chatId);
                }
                // Execute the command handler (non-blocking via .then())
                def.handler(parsed).then((result) => {
                    responseFormatter?.sendResult(result, parsed);
                }).catch((err: Error) => {
                    responseFormatter?.sendMessage(`❌ Command error: ${err.message}`, cmd.chatId);
                    bridgeLog(`[Telegram] Command error: ${err.message}`, 'ERROR');
                });
                return;
            }
        }
    }

    // Fallback for unrecognized commands
    switch (cmd.type) {
        case 'info':
            vscode.window.showInformationMessage(`📩 Telegram from @${cmd.username}: ${cmd.text}`);
            standaloneTelegram?.sendMessage(`✅ Message displayed in VS Code\\.`);
            break;

        default:
            standaloneTelegram?.sendMessage(`❓ Unknown command\\. Send help for a list of commands\\.`);
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
    commandRegistry = null;
    responseFormatter = null;
}
