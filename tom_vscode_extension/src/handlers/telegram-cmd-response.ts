/**
 * Telegram Command Response Formatter.
 *
 * Handles:
 *  - Truncation to Telegram's 4096 char limit (default 4000 usable)
 *  - Sending long responses as file attachments
 *  - --attach flag for forced attachment mode
 *  - Markdown conversion via telegramify-markdown (MarkdownV2)
 *
 * Uses telegramify-markdown to convert standard Markdown to Telegram MarkdownV2.
 */

import * as https from 'https';
import * as http from 'http';
import { bridgeLog } from './handler_shared';
import { TelegramConfig } from './telegram-notifier';
import { TelegramCommandResult, ParsedTelegramCommand } from './telegram-cmd-parser';
import { toTelegramMarkdownV2, escapeMarkdownV2, stripMarkdown } from './telegram-markdown';

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

        // --- Convert markdown for Telegram MarkdownV2 ---
        if (!result.rawText) {
            text = this.convertToTelegramMarkdown(text);
        }

        // --- Decide: inline message vs attachment ---
        if (forceAttach || text.length > DEFAULT_TRUNCATE_LIMIT) {
            // Send as attachment
            const filename = result.attachmentFilename ?? 'response.txt';
            const shortSummary = `${cmd.command}${cmd.subcommand ? ' ' + cmd.subcommand : ''} executed.\nSee attachment _${filename}_`;

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
     * Uses Markdown parse mode with fallback to plain text on error.
     */
    async sendMessage(text: string, chatId: number): Promise<boolean> {
        if (!this.config.botToken) { return false; }

        const truncated = text.length > TELEGRAM_MAX_MESSAGE
            ? text.substring(0, TELEGRAM_MAX_MESSAGE - TRUNCATION_MARKER.length) + TRUNCATION_MARKER
            : text;

        // Try with MarkdownV2 first
        const success = await this.apiCall('sendMessage', {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            chat_id: chatId,
            text: truncated,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            parse_mode: 'MarkdownV2',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            disable_web_page_preview: true,
        });

        if (!success) {
            // Fallback: send without MarkdownV2 (strip formatting)
            bridgeLog('[Telegram] MarkdownV2 send failed, retrying without parse_mode');
            return this.apiCall('sendMessage', {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                chat_id: chatId,
                text: this.stripMarkdown(truncated),
                // eslint-disable-next-line @typescript-eslint/naming-convention
                disable_web_page_preview: true,
            });
        }
        return true;
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
     * Convert standard Markdown to Telegram MarkdownV2 format.
     *
     * Uses telegramify-markdown (Remark-based) to properly convert
     * standard Markdown syntax to Telegram MarkdownV2, handling:
     *  - Escaping of special characters
     *  - Bold, italic, code, links, lists, blockquotes
     *  - Stripping unsupported tags
     */
    convertToTelegramMarkdown(text: string): string {
        try {
            return toTelegramMarkdownV2(text);
        } catch (err: any) {
            bridgeLog(`[Telegram] Markdown conversion error: ${err.message}`);
            // Fallback: escape all special chars for MarkdownV2 plain text
            return escapeMarkdownV2(text);
        }
    }

    /**
     * Strip all Markdown formatting for plain-text output (attachments/fallback).
     */
    stripMarkdown(text: string): string {
        return stripMarkdown(text);
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
