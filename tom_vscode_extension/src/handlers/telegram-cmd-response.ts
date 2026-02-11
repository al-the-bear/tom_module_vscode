/**
 * Telegram Command Response Formatter.
 *
 * Handles:
 *  - Truncation to Telegram's 4096 char limit (default 4000 usable)
 *  - Sending long responses as file attachments
 *  - --attach flag for forced attachment mode
 *  - Markdown conversion/stripping for Telegram compatibility
 *
 * Telegram supports a subset of Markdown V1:
 *   *bold*, _italic_, `code`, ```pre```, [link](url)
 * Everything else is stripped.
 */

import * as https from 'https';
import * as http from 'http';
import { bridgeLog } from './handler_shared';
import { TelegramConfig } from './telegram-notifier';
import { TelegramCommandResult, ParsedTelegramCommand } from './telegram-cmd-parser';

// ============================================================================
// Constants
// ============================================================================

/** Max chars for a Telegram text message. */
const TELEGRAM_MAX_MESSAGE = 4096;

/** Default usable limit (leaves room for wrapper text). */
const DEFAULT_TRUNCATE_LIMIT = 4000;

/** Truncation marker. */
const TRUNCATION_MARKER = '\n\n_... output truncated. Use --attach for full output._';

// ============================================================================
// Response Formatter
// ============================================================================

export class TelegramResponseFormatter {
    private config: TelegramConfig;

    constructor(config: TelegramConfig) {
        this.config = config;
    }

    /** Update config reference. */
    updateConfig(config: TelegramConfig): void {
        this.config = config;
    }

    /**
     * Format and send the result of a command execution.
     * Handles truncation, attachment mode, and markdown conversion.
     */
    async sendResult(
        result: TelegramCommandResult,
        cmd: ParsedTelegramCommand,
    ): Promise<void> {
        if (result.silent) { return; }

        const forceAttach = result.forceAttachment || cmd.flags['attach'] === true;
        let text = result.text;

        // --- Convert markdown for Telegram ---
        if (!result.rawText) {
            text = this.convertMarkdown(text);
        }

        // --- Decide: inline message vs attachment ---
        if (forceAttach || text.length > DEFAULT_TRUNCATE_LIMIT) {
            // Send as attachment
            const filename = result.attachmentFilename ?? 'response.txt';
            const shortSummary = `/${cmd.command}${cmd.subcommand ? ' ' + cmd.subcommand : ''} executed.\nSee attachment _${filename}_`;

            // Send the brief confirmation first
            await this.sendMessage(shortSummary, cmd.chatId);

            // Send the document
            await this.sendDocument(
                Buffer.from(this.stripMarkdown(result.text), 'utf-8'),
                filename,
                cmd.chatId,
            );
        } else {
            // Send inline (escaping is done in convertMarkdown)
            await this.sendMessage(text, cmd.chatId);
        }
    }

    /**
     * Send a plain text message to a chat.
     * Uses Markdown parse mode.
     */
    async sendMessage(text: string, chatId: number): Promise<boolean> {
        if (!this.config.botToken) { return false; }

        const truncated = text.length > TELEGRAM_MAX_MESSAGE
            ? text.substring(0, TELEGRAM_MAX_MESSAGE - TRUNCATION_MARKER.length) + TRUNCATION_MARKER
            : text;

        return this.apiCall('sendMessage', {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            chat_id: chatId,
            text: truncated,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            parse_mode: 'Markdown',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            disable_web_page_preview: true,
        });
    }

    /**
     * Send a file attachment (document) to a Telegram chat.
     * Uses multipart/form-data upload.
     */
    async sendDocument(content: Buffer, filename: string, chatId: number): Promise<boolean> {
        if (!this.config.botToken) { return false; }

        const boundary = '----TelegramBotBoundary' + Date.now().toString(36);

        // Build multipart body
        const parts: Buffer[] = [];

        // chat_id field
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="chat_id"\r\n\r\n` +
            `${chatId}\r\n`
        ));

        // document field (file upload)
        parts.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n` +
            `Content-Type: application/octet-stream\r\n\r\n`
        ));
        parts.push(content);
        parts.push(Buffer.from('\r\n'));

        // closing boundary
        parts.push(Buffer.from(`--${boundary}--\r\n`));

        const body = Buffer.concat(parts);

        return new Promise((resolve) => {
            const options: https.RequestOptions = {
                hostname: 'api.telegram.org',
                path: `/bot${this.config.botToken}/sendDocument`,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`, // eslint-disable-line @typescript-eslint/naming-convention
                    'Content-Length': body.length, // eslint-disable-line @typescript-eslint/naming-convention
                },
                timeout: 30000,
            };

            const req = https.request(options, (res: http.IncomingMessage) => {
                let responseBody = '';
                res.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseBody);
                        if (!parsed.ok) {
                            bridgeLog(`[Telegram] sendDocument error: ${parsed.description ?? 'unknown'}`);
                        }
                        resolve(parsed.ok === true);
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', (err: Error) => {
                bridgeLog(`[Telegram] sendDocument request error: ${err.message}`);
                resolve(false);
            });
            req.on('timeout', () => { req.destroy(); resolve(false); });

            req.write(body);
            req.end();
        });
    }

    // -----------------------------------------------------------------------
    // Markdown conversion
    // -----------------------------------------------------------------------

    /**
     * Convert general Markdown to Telegram-compatible Markdown V1.
     *
     * Telegram supports: *bold*, _italic_, `inline code`, ```pre```, [text](url)
     * Everything else is stripped or converted.
     */
    convertMarkdown(text: string): string {
        let result = text;

        // Convert headers (## Title → *Title*)
        result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

        // Convert bold (**text** → *text*) — Telegram uses single *
        result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');

        // Convert strikethrough (~~text~~ → text)
        result = result.replace(/~~(.+?)~~/g, '$1');

        // Convert HTML tags — strip them
        result = result.replace(/<[^>]+>/g, '');

        // Convert horizontal rules to simple line
        result = result.replace(/^[-*_]{3,}$/gm, '————');

        // Convert bullet lists (- item → • item)
        result = result.replace(/^[\t ]*[-*+]\s+/gm, '• ');

        // Convert numbered lists — keep as-is (1. item)

        // Convert blockquotes (> text → | text)
        result = result.replace(/^>\s?/gm, '│ ');

        // Fenced code blocks: ```lang\ncode\n``` → ```\ncode\n```
        result = result.replace(/```[a-zA-Z]*\n/g, '```\n');

        return result;
    }

    /**
     * Strip all Markdown formatting for plain-text output (attachments).
     */
    stripMarkdown(text: string): string {
        let result = text;
        result = result.replace(/^#{1,6}\s+/gm, '');
        result = result.replace(/\*\*(.+?)\*\*/g, '$1');
        result = result.replace(/\*(.+?)\*/g, '$1');
        result = result.replace(/_(.+?)_/g, '$1');
        result = result.replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
        result = result.replace(/~~(.+?)~~/g, '$1');
        result = result.replace(/<[^>]+>/g, '');
        result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        return result;
    }

    // -----------------------------------------------------------------------
    // API helper (duplicated from notifier for independence)
    // -----------------------------------------------------------------------

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

            const req = https.request(options, (res: http.IncomingMessage) => {
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

            req.on('error', (err: Error) => {
                bridgeLog(`[Telegram] Request error (${method}): ${err.message}`);
                resolve(false);
            });
            req.on('timeout', () => { req.destroy(); resolve(false); });

            req.write(data);
            req.end();
        });
    }
}
