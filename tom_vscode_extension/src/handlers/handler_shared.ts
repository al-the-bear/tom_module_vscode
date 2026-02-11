/**
 * Shared functionality for VS Code command handlers.
 * 
 * This module provides common utilities used across multiple command handlers,
 * including logging, error handling, workspace utilities, and bridge management.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DartBridgeClient } from '../vscode-bridge';

// ============================================================================
// Global State
// ============================================================================

/**
 * Global bridge client instance - shared across all handlers
 */
let bridgeClient: DartBridgeClient | null = null;

/**
 * Get the global bridge client instance
 */
export function getBridgeClient(): DartBridgeClient | null {
    return bridgeClient;
}

/**
 * Set the global bridge client instance
 */
export function setBridgeClient(client: DartBridgeClient | null): void {
    bridgeClient = client;
}

// ============================================================================
// Logging
// ============================================================================

/**
 * Log a message to the DartScript output channel
 */
export function bridgeLog(message: string, level: 'INFO' | 'ERROR' = 'INFO'): void {
    if (!DartBridgeClient.outputChannel) {
        console.log(`[VS Code Extension] ${level} ${message}`);
        return;
    }
    DartBridgeClient.outputChannel.appendLine(`[VS Code Extension] ${level} ${message}`);
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle errors consistently across all handlers.
 * Extracts error IDs (e.g., [B01], [E01]) from the original error
 * and prepends them to the message for easier debugging.
 */
export function handleError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(message, error);
    
    // Extract error ID from the original error message (e.g., [B01], [E01])
    const errorIdMatch = errorMessage.match(/\[([A-Z]\d+)\]/);
    const errorId = errorIdMatch ? errorIdMatch[0] + ' ' : '';
    
    vscode.window.showErrorMessage(`${errorId}${message}: ${errorMessage}`);
}

// ============================================================================
// Workspace Utilities
// ============================================================================

/**
 * Get the workspace root path
 */
export function getWorkspaceRoot(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
}

/**
 * Get the resolved path to the extension config file.
 *
 * Reads the `dartscript.configPath` setting (default: `~/.tom/vscode/tom_vscode_extension.json`).
 * Supports `~` (home directory) and `${workspaceFolder}` placeholders.
 */
export function getConfigPath(): string | undefined {
    const configSetting = vscode.workspace
        .getConfiguration('dartscript')
        .get<string>('configPath');

    if (!configSetting) {
        // Fallback default
        return path.join(os.homedir(), '.tom', 'vscode', 'tom_vscode_extension.json');
    }

    let resolved = configSetting;

    // Resolve ~ to home directory
    if (resolved.startsWith('~/') || resolved === '~') {
        resolved = path.join(os.homedir(), resolved.slice(2));
    }

    // Resolve ${workspaceFolder}
    const wf = vscode.workspace.workspaceFolders;
    if (wf && wf.length > 0) {
        resolved = resolved.replace(/\$\{workspaceFolder\}/g, wf[0].uri.fsPath);
    }

    return resolved;
}

/**
 * Get VS Code language ID from filename extension
 */
export function getLanguageFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const languageMap: Record<string, string> = {
        '.dart': 'dart',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.ts': 'typescript',
        '.js': 'javascript',
        '.html': 'html',
        '.css': 'css',
        '.xml': 'xml',
        '.txt': 'plaintext'
    };
    return languageMap[ext] || 'plaintext';
}

/**
 * Get workspace structure as a string for display
 */
export async function getWorkspaceStructure(workspaceRoot: string): Promise<string> {
    const structure: string[] = [];

    function scanDirectory(dir: string, indent: string = '', maxDepth: number = 3, currentDepth: number = 0): void {
        if (currentDepth >= maxDepth) {
            return;
        }

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                // Skip hidden files and common build directories
                if (entry.name.startsWith('.') ||
                    entry.name === 'node_modules' ||
                    entry.name === 'build' ||
                    entry.name === 'out') {
                    continue;
                }

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    structure.push(`${indent}📁 ${entry.name}/`);
                    scanDirectory(fullPath, indent + '  ', maxDepth, currentDepth + 1);
                } else {
                    structure.push(`${indent}📄 ${entry.name}`);
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dir}:`, error);
        }
    }

    scanDirectory(workspaceRoot);
    return structure.join('\n');
}

// ============================================================================
// Bridge Utilities
// ============================================================================

/**
 * Ensure the bridge client is available and running.
 * Creates a new client if needed and starts the bridge if not running.
 * 
 * @param context - Extension context for creating new bridge client
 * @param showMessages - Whether to show status messages to the user
 * @returns The bridge client, or null if it couldn't be started
 */
export async function ensureBridgeRunning(
    context: vscode.ExtensionContext,
    showMessages: boolean = false
): Promise<DartBridgeClient | null> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        if (showMessages) {
            vscode.window.showErrorMessage('No workspace folder open');
        }
        return null;
    }

    const bridgePath = path.join(workspaceRoot, 'xternal', 'tom_module_vscode', 'tom_vscode_bridge');
    if (!fs.existsSync(bridgePath)) {
        if (showMessages) {
            vscode.window.showErrorMessage('tom_vscode_bridge not found in workspace (expected at xternal/tom_module_vscode/tom_vscode_bridge)');
        }
        return null;
    }

    // Create bridge client if needed
    if (!bridgeClient) {
        bridgeClient = new DartBridgeClient(context);
    }

    // Start bridge if not already running
    if (!bridgeClient.isRunning()) {
        if (showMessages) {
            vscode.window.showInformationMessage('Starting Dart bridge...');
        }
        await bridgeClient.startWithAutoRestart(bridgePath);
    }

    return bridgeClient;
}

// ============================================================================
// Copilot Integration
// ============================================================================

/**
 * Get a Copilot chat model
 */
export async function getCopilotModel(): Promise<vscode.LanguageModelChat | undefined> {
    try {
        // Get configuration
        const config = vscode.workspace.getConfiguration('dartscript');
        const preferredModel = config.get<string>('copilotModel', 'gpt-4o');

        // Try to get the preferred model
        let models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: preferredModel
        });

        // Fallback to any Copilot model
        if (models.length === 0) {
            models = await vscode.lm.selectChatModels({
                vendor: 'copilot'
            });
        }

        if (models.length === 0) {
            vscode.window.showErrorMessage(
                'No Copilot models available. Please ensure GitHub Copilot is installed and activated.'
            );
            return undefined;
        }

        console.log(`Using Copilot model: ${models[0].name} (${models[0].vendor})`);
        return models[0];

    } catch (error) {
        console.error('Error getting Copilot model:', error);
        return undefined;
    }
}

/**
 * Send a request to Copilot and get the response
 */
export async function sendCopilotRequest(
    model: vscode.LanguageModelChat,
    prompt: string,
    token: vscode.CancellationToken
): Promise<string> {
    try {
        // Create chat messages
        const messages = [
            vscode.LanguageModelChatMessage.User(prompt)
        ];

        // Send request
        const response = await model.sendRequest(messages, {}, token);

        // Collect response text
        let fullResponse = '';
        for await (const chunk of response.text) {
            if (token.isCancellationRequested) {
                throw new Error('Request cancelled');
            }
            fullResponse += chunk;
        }

        return fullResponse;

    } catch (error) {
        if (error instanceof vscode.LanguageModelError) {
            console.error('Copilot error:', error.message, error.code);

            // Handle specific error cases
            if (error.cause instanceof Error) {
                if (error.cause.message.includes('off_topic')) {
                    throw new Error('The request was rejected as off-topic');
                }
                if (error.cause.message.includes('consent')) {
                    throw new Error('User consent required for Copilot');
                }
                if (error.cause.message.includes('quota')) {
                    throw new Error('Copilot quota limit exceeded');
                }
            }

            throw new Error(`Copilot error: ${error.message}`);
        }
        throw error;
    }
}

// ============================================================================
// File Utilities
// ============================================================================

/**
 * Validate that a file path is a Dart file and exists
 */
export function validateDartFile(filePath: string): { valid: boolean; error?: string } {
    if (!filePath.endsWith('.dart')) {
        return { valid: false, error: 'Selected file is not a Dart file' };
    }

    if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File does not exist' };
    }

    return { valid: true };
}

/**
 * Get the file path from a URI or active editor
 */
export function getFilePath(uri?: vscode.Uri): string | undefined {
    if (uri) {
        return uri.fsPath;
    }
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }
    
    return editor.document.uri.fsPath;
}

/**
 * Show analysis result in a new document
 */
export async function showAnalysisResult(analysis: string): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({
        content: `# Workspace Analysis\n\n${analysis}`,
        language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
}
