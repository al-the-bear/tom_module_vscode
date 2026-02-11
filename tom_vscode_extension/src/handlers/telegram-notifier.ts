/**
 * Telegram Bot integration for Bot Conversation notifications.
 *
 * Uses the Telegram Bot HTTP API directly (no npm dependency needed).
 * Supports:
 *  - Sending turn-by-turn notifications
 *  - Receiving commands: /stop, /halt, /continue, /info <text>
 *  - Explicit user ID whitelisting for security
 *
 * Configuration lives in botConversation.telegram section of send_to_chat.json.
 */

import * as https from 'https';
import { bridgeLog } from './handler_shared';

// ============================================================================
// Interfaces
// ============================================================================

/** Telegram configuration from send_to_chat.json → botConversation.telegram */
export interface TelegramConfig {
    /** Whether Telegram integration is enabled. */
    enabled: boolean;
    /** Name of the environment variable that holds the Bot API token. */
    botTokenEnv: string;
    /** Resolved Bot API token (read from the environment variable at parse time). */
    botToken: string;
    /** Whitelisted Telegram user IDs (numeric). Only these can interact. */
    allowedUserIds: number[];
    /** Default chat ID to send notifications to (usually your personal chat). */
    defaultChatId: number;
    /** Whether to send a notification for each turn. */
    notifyOnTurn: boolean;
    /** Whether to send a notification when the conversation starts. */
    notifyOnStart: boolean;
    /** Whether to send a notification when the conversation ends. */
    notifyOnEnd: boolean;
    /** Whether to include the full Copilot response text in notifications. */
    includeResponseText: boolean;
    /** Max characters of response text to include in notifications. */
    maxResponseChars: number;
    /** Polling interval in milliseconds for incoming messages. */
    pollIntervalMs: number;
}

/** Parsed Telegram update from the Bot API. */
// eslint-disable-next-line @typescript-eslint/naming-convention
interface TelegramUpdate {
    update_id: number; // eslint-disable-line @typescript-eslint/naming-convention
    message?: {
        message_id: number; // eslint-disable-line @typescript-eslint/naming-convention
        from: { id: number; first_name: string; username?: string }; // eslint-disable-line @typescript-eslint/naming-convention
        chat: { id: number; type: string };
        text?: string;
        date: number;
    };
}

/** A command received from Telegram. */
export interface TelegramCommand {
    /** Command type. */
    type: 'stop' | 'halt' | 'continue' | 'info' | 'status' | 'unknown';
    /** Additional text (for /info). */
    text: string;
    /** Telegram user ID who sent the command. */
    userId: number;
    /** Chat ID for replies. */
    chatId: number;
    /** Username of sender. */
    username: string;
}

/** Callback type for when a command is received. */
export type TelegramCommandCallback = (command: TelegramCommand) => void;

// ============================================================================
// Default config
// ============================================================================

export const TELEGRAM_DEFAULTS: TelegramConfig = {
    enabled: false,
    botTokenEnv: '',
    botToken: '',
    allowedUserIds: [],
    defaultChatId: 0,
    notifyOnTurn: true,
    notifyOnStart: true,
    notifyOnEnd: true,
    includeResponseText: true,
    maxResponseChars: 500,
    pollIntervalMs: 2000,
};

// ============================================================================
// TelegramNotifier
// ============================================================================

export class TelegramNotifier {
    private config: TelegramConfig;
    private lastUpdateId: number = 0;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private commandCallback: TelegramCommandCallback | null = null;
    private _isPolling: boolean = false;

    constructor(config: TelegramConfig) {
        this.config = config;
    }

    /** Whether this notifier is properly configured and enabled. */
    get isEnabled(): boolean {
        return this.config.enabled && !!this.config.botToken && this.config.allowedUserIds.length > 0;
    }

    /** Update config (e.g. after reload). */
    updateConfig(config: TelegramConfig): void {
        const wasPolling = this._isPolling;
        if (wasPolling) { this.stopPolling(); }
        this.config = config;
        if (wasPolling && this.isEnabled) { this.startPolling(); }
    }

    // -----------------------------------------------------------------------
    // Sending messages
    // -----------------------------------------------------------------------

    /** Send a text message to the default chat. */
    async sendMessage(text: string, chatId?: number): Promise<boolean> {
        if (!this.isEnabled) { return false; }

        const targetChatId = chatId ?? this.config.defaultChatId;
        if (!targetChatId) { return false; }

        return this.apiCall('sendMessage', {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            chat_id: targetChatId,
            text: this.truncate(text, 4096), // Telegram max message length
            // eslint-disable-next-line @typescript-eslint/naming-convention
            parse_mode: 'Markdown',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            disable_web_page_preview: true,
        });
    }

    /** Send a conversation start notification. */
    async notifyStart(conversationId: string, goal: string, profile: string): Promise<void> {
        if (!this.config.notifyOnStart) { return; }
        const msg = `🤖 *Bot Conversation Started*\n\n` +
            `*ID:* \`${conversationId}\`\n` +
            `*Profile:* ${profile}\n` +
            `*Goal:* ${this.escapeMarkdown(goal)}\n\n` +
            `Commands: /stop /halt /continue /status\n` +
            `Send info: /info <your message>`;
        await this.sendMessage(msg);
    }

    /** Send a turn completion notification. */
    async notifyTurn(
        turn: number,
        maxTurns: number,
        promptPreview: string,
        responsePreview: string,
        stats?: { promptTokens: number; completionTokens: number; totalDurationMs: number },
    ): Promise<void> {
        if (!this.config.notifyOnTurn) { return; }

        let msg = `📝 *Turn ${turn}/${maxTurns}*\n\n`;
        msg += `*Prompt:* ${this.escapeMarkdown(this.truncate(promptPreview, 200))}\n\n`;

        if (this.config.includeResponseText) {
            msg += `*Response:* ${this.escapeMarkdown(this.truncate(responsePreview, this.config.maxResponseChars))}\n`;
        }

        if (stats) {
            msg += `\n_${stats.promptTokens}+${stats.completionTokens} tokens, ${(stats.totalDurationMs / 1000).toFixed(1)}s_`;
        }

        await this.sendMessage(msg);
    }

    /** Send a conversation end notification. */
    async notifyEnd(conversationId: string, turns: number, goalReached: boolean, reason?: string): Promise<void> {
        if (!this.config.notifyOnEnd) { return; }
        const status = goalReached ? '✅ Goal Reached' : reason ? `⏹ ${reason}` : '⏹ Ended';
        const msg = `🏁 *Bot Conversation Ended*\n\n` +
            `*ID:* \`${conversationId}\`\n` +
            `*Turns:* ${turns}\n` +
            `*Status:* ${status}`;
        await this.sendMessage(msg);
    }

    /** Send a halt notification. */
    async notifyHalted(turn: number): Promise<void> {
        await this.sendMessage(`⏸ *Conversation halted* after turn ${turn}.\nSend /continue to resume or /info <text> to add context.`);
    }

    /** Send a continue notification. */
    async notifyContinued(additionalInfo?: string): Promise<void> {
        let msg = `▶️ *Conversation resumed*`;
        if (additionalInfo) {
            msg += `\nAdditional info will be included in next prompt.`;
        }
        await this.sendMessage(msg);
    }

    // -----------------------------------------------------------------------
    // Polling for incoming commands
    // -----------------------------------------------------------------------

    /** Start polling for incoming Telegram messages. */
    startPolling(): void {
        if (this._isPolling || !this.isEnabled) { return; }
        this._isPolling = true;

        bridgeLog(`[Telegram] Starting poll loop (interval: ${this.config.pollIntervalMs}ms)`);

        // Initial fetch to get current offset
        this.fetchUpdates().catch(() => { /* ignore initial errors */ });

        this.pollTimer = setInterval(async () => {
            try {
                await this.fetchUpdates();
            } catch (err: any) {
                bridgeLog(`[Telegram] Poll error: ${err.message}`);
            }
        }, this.config.pollIntervalMs);
    }

    /** Stop polling. */
    stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this._isPolling = false;
        bridgeLog('[Telegram] Polling stopped');
    }

    /** Register a callback for received commands. */
    onCommand(callback: TelegramCommandCallback): void {
        this.commandCallback = callback;
    }

    /** Fetch and process updates from Telegram. */
    private async fetchUpdates(): Promise<void> {
        const updates = await this.getUpdates(this.lastUpdateId + 1);
        if (!updates || updates.length === 0) { return; }

        for (const update of updates) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            this.processUpdate(update);
        }
    }

    /** Process a single Telegram update. */
    private processUpdate(update: TelegramUpdate): void {
        const msg = update.message;
        if (!msg || !msg.text || !msg.from) { return; }

        // Security check: only process from whitelisted users
        if (!this.config.allowedUserIds.includes(msg.from.id)) {
            bridgeLog(`[Telegram] Rejected message from unauthorized user: ${msg.from.id} (${msg.from.username ?? 'unknown'})`);
            // Reply with rejection
            this.sendMessage(`⛔ Unauthorized. Your user ID (${msg.from.id}) is not whitelisted.`, msg.chat.id);
            return;
        }

        const text = msg.text.trim();
        const command = this.parseCommand(text, msg.from.id, msg.chat.id, msg.from.username ?? msg.from.first_name);

        if (command && this.commandCallback) {
            bridgeLog(`[Telegram] Command from ${msg.from.username ?? msg.from.id}: ${command.type}${command.text ? ' — ' + command.text.substring(0, 50) : ''}`);
            this.commandCallback(command);
        }
    }

    /** Parse a text message into a TelegramCommand. */
    private parseCommand(text: string, userId: number, chatId: number, username: string): TelegramCommand | null {
        const lower = text.toLowerCase();

        if (lower === '/stop' || lower === '/stop@' || lower.startsWith('/stop ')) {
            return { type: 'stop', text: '', userId, chatId, username };
        }
        if (lower === '/halt' || lower === '/halt@' || lower === '/pause' || lower.startsWith('/halt ')) {
            return { type: 'halt', text: '', userId, chatId, username };
        }
        if (lower === '/continue' || lower === '/continue@' || lower === '/resume' || lower.startsWith('/continue ')) {
            return { type: 'continue', text: '', userId, chatId, username };
        }
        if (lower === '/status') {
            return { type: 'status', text: '', userId, chatId, username };
        }
        if (lower.startsWith('/info ') || lower.startsWith('/add ')) {
            const infoText = text.substring(text.indexOf(' ') + 1).trim();
            if (infoText) {
                return { type: 'info', text: infoText, userId, chatId, username };
            }
        }

        // Plain text messages (not starting with /) treated as /info when conversation is active
        if (!text.startsWith('/')) {
            return { type: 'info', text, userId, chatId, username };
        }

        return { type: 'unknown', text, userId, chatId, username };
    }

    // -----------------------------------------------------------------------
    // Telegram Bot API helpers
    // -----------------------------------------------------------------------

    /** Call a Telegram Bot API method. */
    private apiCall(method: string, body: any): Promise<boolean> {
        return new Promise((resolve) => {
            const data = JSON.stringify(body);
            const options: https.RequestOptions = {
                hostname: 'api.telegram.org',
                path: `/bot${this.config.botToken}/${method}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
                    'Content-Length': Buffer.byteLength(data), // eslint-disable-line @typescript-eslint/naming-convention
                },
                timeout: 10000,
            };

            const req = https.request(options, (res) => {
                let responseBody = '';
                res.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseBody);
                        if (!parsed.ok) {
                            bridgeLog(`[Telegram] API error (${method}): ${parsed.description ?? 'unknown'}`);
                        }
                        resolve(parsed.ok === true);
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', (err) => {
                bridgeLog(`[Telegram] Request error (${method}): ${err.message}`);
                resolve(false);
            });
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.write(data);
            req.end();
        });
    }

    /** Get updates from Telegram. */
    private getUpdates(offset: number): Promise<TelegramUpdate[]> {
        return new Promise((resolve) => {
            const body = JSON.stringify({
                offset,
                timeout: 0, // Short poll, don't long-poll in VS Code
                // eslint-disable-next-line @typescript-eslint/naming-convention
                allowed_updates: ['message'],
            });

            const options: https.RequestOptions = {
                hostname: 'api.telegram.org',
                path: `/bot${this.config.botToken}/getUpdates`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
                    'Content-Length': Buffer.byteLength(body), // eslint-disable-line @typescript-eslint/naming-convention
                },
                timeout: 10000,
            };

            const req = https.request(options, (res) => {
                let responseBody = '';
                res.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseBody);
                        resolve(parsed.ok ? (parsed.result ?? []) : []);
                    } catch {
                        resolve([]);
                    }
                });
            });

            req.on('error', () => resolve([]));
            req.on('timeout', () => { req.destroy(); resolve([]); });

            req.write(body);
            req.end();
        });
    }

    // -----------------------------------------------------------------------
    // Utilities
    // -----------------------------------------------------------------------

    private truncate(text: string, maxLen: number): string {
        if (text.length <= maxLen) { return text; }
        return text.substring(0, maxLen - 3) + '...';
    }

    /** Escape Markdown special characters for Telegram Markdown V1. */
    private escapeMarkdown(text: string): string {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    /** Dispose/cleanup. */
    dispose(): void {
        this.stopPolling();
        this.commandCallback = null;
    }
}

// ============================================================================
// Config parser
// ============================================================================

/**
 * Parse Telegram config from a raw botConversation.telegram object.
 */
export function parseTelegramConfig(raw: any): TelegramConfig {
    if (!raw || typeof raw !== 'object') { return { ...TELEGRAM_DEFAULTS }; }

    // Resolve bot token from environment variable
    const botTokenEnv = typeof raw.botTokenEnv === 'string' ? raw.botTokenEnv : TELEGRAM_DEFAULTS.botTokenEnv;
    let botToken = '';
    if (botTokenEnv) {
        botToken = process.env[botTokenEnv] ?? '';
        if (!botToken) {
            bridgeLog(`[Telegram] Environment variable '${botTokenEnv}' is not set or empty`);
        }
    }

    return {
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : TELEGRAM_DEFAULTS.enabled,
        botTokenEnv,
        botToken,
        allowedUserIds: Array.isArray(raw.allowedUserIds)
            ? raw.allowedUserIds.filter((id: any) => typeof id === 'number')
            : TELEGRAM_DEFAULTS.allowedUserIds,
        defaultChatId: typeof raw.defaultChatId === 'number' ? raw.defaultChatId : TELEGRAM_DEFAULTS.defaultChatId,
        notifyOnTurn: typeof raw.notifyOnTurn === 'boolean' ? raw.notifyOnTurn : TELEGRAM_DEFAULTS.notifyOnTurn,
        notifyOnStart: typeof raw.notifyOnStart === 'boolean' ? raw.notifyOnStart : TELEGRAM_DEFAULTS.notifyOnStart,
        notifyOnEnd: typeof raw.notifyOnEnd === 'boolean' ? raw.notifyOnEnd : TELEGRAM_DEFAULTS.notifyOnEnd,
        includeResponseText: typeof raw.includeResponseText === 'boolean' ? raw.includeResponseText : TELEGRAM_DEFAULTS.includeResponseText,
        maxResponseChars: typeof raw.maxResponseChars === 'number' ? raw.maxResponseChars : TELEGRAM_DEFAULTS.maxResponseChars,
        pollIntervalMs: typeof raw.pollIntervalMs === 'number' ? raw.pollIntervalMs : TELEGRAM_DEFAULTS.pollIntervalMs,
    };
}
