/**
 * Handler for dartscript.expandPrompt command.
 *
 * Uses a local Ollama model (Qwen 3 8B) to expand terse user prompts
 * into detailed, well-structured prompts suitable for Copilot Chat.
 *
 * The command works on:
 * 1. Selected text in the active editor (replaces selection)
 * 2. Full document content if nothing is selected (replaces all)
 *
 * The expansion happens in-place with a progress indicator.
 */

import * as vscode from 'vscode';
import * as http from 'http';
import { handleError, bridgeLog } from './handler_shared';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen3:8b';

interface OllamaConfig {
    url: string;
    model: string;
}

function getOllamaConfig(): OllamaConfig {
    const config = vscode.workspace.getConfiguration('dartscript.ollama');
    return {
        url: config.get<string>('url', DEFAULT_OLLAMA_URL),
        model: config.get<string>('model', DEFAULT_MODEL),
    };
}

// ---------------------------------------------------------------------------
// System prompt for expansion
// ---------------------------------------------------------------------------

const EXPANSION_SYSTEM_PROMPT = `You are a prompt expansion assistant. Your job is to take a short, terse user prompt and expand it into a detailed, well-structured prompt that will produce better results from an AI coding assistant (GitHub Copilot).

Rules:
- Keep the original intent exactly — do not add tasks the user did not ask for.
- Add structure: break vague requests into clear, numbered steps if appropriate.
- Add specificity: if the user mentions a file, technology, or pattern, reference it explicitly.
- Add quality cues: remind the assistant to handle edge cases, follow conventions, write tests if applicable.
- Keep it concise — expand, don't bloat. A good expansion is 2-5x the original length, not 20x.
- Output ONLY the expanded prompt text. No explanations, no markdown fences, no preamble.
- Do NOT wrap your output in thinking tags or chain-of-thought. Output the final prompt directly.
- Preserve any special syntax the user wrote (e.g., !prompt, $prompt, file paths, code snippets).
- Write in the same language/tone as the original prompt.`;

// ---------------------------------------------------------------------------
// Ollama API interaction
// ---------------------------------------------------------------------------

/**
 * Check if Ollama is reachable.
 */
async function isOllamaRunning(baseUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
        const url = new URL(baseUrl);
        const req = http.request(
            { hostname: url.hostname, port: url.port, path: '/', method: 'GET', timeout: 3000 },
            (res) => { resolve(res.statusCode === 200); }
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
}

/**
 * Send a prompt to Ollama and collect the full response.
 */
async function ollamaGenerate(
    baseUrl: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    onToken?: (token: string) => void,
    cancellationToken?: vscode.CancellationToken,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/chat', baseUrl);
        const body = JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            stream: true,
            options: {
                // Disable thinking/reasoning for this task — we just want the output
                temperature: 0.4,
            },
        });

        const req = http.request(
            {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            },
            (res) => {
                let fullResponse = '';
                let buffer = '';

                res.on('data', (chunk: Buffer) => {
                    buffer += chunk.toString();
                    // Ollama streams newline-delimited JSON
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';

                    for (const line of lines) {
                        if (!line.trim()) { continue; }
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.message?.content) {
                                fullResponse += parsed.message.content;
                                onToken?.(parsed.message.content);
                            }
                        } catch {
                            // Partial JSON, will be completed in next chunk
                        }
                    }
                });

                res.on('end', () => {
                    // Process any remaining buffer
                    if (buffer.trim()) {
                        try {
                            const parsed = JSON.parse(buffer);
                            if (parsed.message?.content) {
                                fullResponse += parsed.message.content;
                            }
                        } catch { /* ignore */ }
                    }
                    resolve(fullResponse);
                });

                res.on('error', reject);
            },
        );

        // Handle cancellation
        if (cancellationToken) {
            cancellationToken.onCancellationRequested(() => {
                req.destroy();
                reject(new Error('Cancelled'));
            });
        }

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ---------------------------------------------------------------------------
// Strip thinking tags from Qwen 3 output
// ---------------------------------------------------------------------------

function stripThinkingTags(text: string): string {
    // Qwen 3 may wrap reasoning in <think>...</think> tags
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

/**
 * Expand the current selection (or full document) using a local Ollama model.
 */
export async function expandPromptHandler(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const { url: ollamaUrl, model } = getOllamaConfig();

    // Get text to expand
    const selection = editor.selection;
    const hasSelection = !selection.isEmpty;
    const originalText = hasSelection
        ? editor.document.getText(selection)
        : editor.document.getText();

    if (!originalText.trim()) {
        vscode.window.showWarningMessage('Nothing to expand — editor or selection is empty.');
        return;
    }

    try {
        // Check Ollama is reachable
        const running = await isOllamaRunning(ollamaUrl);
        if (!running) {
            const action = await vscode.window.showErrorMessage(
                `Ollama is not running at ${ollamaUrl}. Start it with: brew services start ollama`,
                'Copy Command'
            );
            if (action === 'Copy Command') {
                await vscode.env.clipboard.writeText('brew services start ollama');
            }
            return;
        }

        // Expand with progress
        const expandedText = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Expanding prompt with ${model}...`,
                cancellable: true,
            },
            async (progress, cancellationToken) => {
                let tokenCount = 0;
                const result = await ollamaGenerate(
                    ollamaUrl,
                    model,
                    EXPANSION_SYSTEM_PROMPT,
                    originalText,
                    (_token) => {
                        tokenCount++;
                        if (tokenCount % 10 === 0) {
                            progress.report({ message: `${tokenCount} tokens generated...` });
                        }
                    },
                    cancellationToken,
                );
                return result;
            },
        );

        if (!expandedText.trim()) {
            vscode.window.showWarningMessage('Ollama returned an empty response.');
            return;
        }

        // Strip any thinking tags from the output
        const cleanedText = stripThinkingTags(expandedText);

        // Replace in editor
        const success = await editor.edit((editBuilder) => {
            if (hasSelection) {
                editBuilder.replace(selection, cleanedText);
            } else {
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length),
                );
                editBuilder.replace(fullRange, cleanedText);
            }
        });

        if (success) {
            bridgeLog(`[Prompt Expander] Expanded ${originalText.length} chars → ${cleanedText.length} chars using ${model}`);
            vscode.window.showInformationMessage(
                `Prompt expanded (${originalText.length} → ${cleanedText.length} chars)`
            );
        }
    } catch (error) {
        if (error instanceof Error && error.message === 'Cancelled') {
            vscode.window.showInformationMessage('Prompt expansion cancelled.');
            return;
        }
        handleError('Failed to expand prompt', error);
    }
}
