/**
 * Send to Chat Advanced - Configuration and dynamic menu management
 * 
 * Provides configurable prompt templates for sending text to Copilot Chat
 * with customizable prefixes and suffixes.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfigPath, updateChatResponseValues, clearChatResponseValues } from './handler_shared';
import { logCopilotAnswer, isTrailEnabled, loadTrailConfig } from './trailLogger-handler';

/**
 * Configuration entry for a send-to-chat template
 */
export interface SendToChatTemplate {
    prefix: string;
    suffix: string;
    /** If true, this template gets its own static menu entry (requires extension reload) */
    showInMenu?: boolean;
}

/**
 * Full configuration file structure with optional default
 */
export interface SendToChatFullConfig {
    /** Name of the default template to use for Standard Template command */
    default?: string;
    /** Template definitions */
    templates: { [menuLabel: string]: SendToChatTemplate };
}

/**
 * Legacy configuration file structure (templates at root level)
 */
export interface SendToChatLegacyConfig {
    [menuLabel: string]: SendToChatTemplate;
}

/**
 * Parsed content from selected text (JSON, YAML, or colon-delimited)
 */
export interface ParsedContent {
    preamble?: string;
    data: { [key: string]: any };
}

/**
 * Manages send-to-chat configuration and dynamic menu generation
 */
export class SendToChatAdvancedManager {
    private templates: { [menuLabel: string]: SendToChatTemplate } = {};
    private defaultTemplateName: string | undefined;
    private configWatcher: vscode.FileSystemWatcher | undefined;
    private registeredCommands: vscode.Disposable[] = [];
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel | undefined;
    
    /** Static accumulated data from chat answer files */
    private static chatAnswerData: { [key: string]: any } = {};

    constructor(context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
    }

    /**
     * Initialize the manager - load config and set up file watcher
     */
    async initialize(): Promise<void> {
        await this.loadConfig();
        this.setupFileWatcher();
        this.registerCommands();
    }

    /**
     * Get the configuration file path
     */
    private getConfigPath(): string | undefined {
        return getConfigPath();
    }

    /**
     * Load configuration from JSON file
     * Supports both legacy format (templates at root) and new format (with default and templates)
     */
    async loadConfig(): Promise<void> {
        const configPath = this.getConfigPath();
        if (!configPath) {
            this.log('No workspace folder found, skipping config load');
            return;
        }

        try {
            if (!fs.existsSync(configPath)) {
                this.log(`Config file not found: ${configPath}`);
                this.templates = {};
                this.defaultTemplateName = undefined;
                return;
            }

            const content = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(content);
            
            // Store old values to check if anything changed
            const oldTemplates = JSON.stringify(this.templates);
            const oldDefault = this.defaultTemplateName;
            
            // Check for new format (has 'templates' key) vs legacy format
            if (parsed.templates && typeof parsed.templates === 'object') {
                // New format with default and templates
                if (!this.validateTemplates(parsed.templates)) {
                    vscode.window.showErrorMessage('Invalid send_to_chat.json format. Each template must have "prefix" and "suffix" strings.');
                    this.templates = {};
                    return;
                }
                this.templates = parsed.templates;
                this.defaultTemplateName = typeof parsed.default === 'string' ? parsed.default : undefined;
            } else {
                // Legacy format - templates at root level
                if (!this.validateTemplates(parsed)) {
                    vscode.window.showErrorMessage('Invalid send_to_chat.json format. Each entry must have "prefix" and "suffix" strings.');
                    this.templates = {};
                    return;
                }
                this.templates = parsed;
                this.defaultTemplateName = undefined;
            }

            // Only log and re-register if something actually changed
            const newTemplates = JSON.stringify(this.templates);
            if (oldTemplates !== newTemplates || oldDefault !== this.defaultTemplateName) {
                this.log(`Loaded ${Object.keys(this.templates).length} templates from ${configPath}${this.defaultTemplateName ? `, default: ${this.defaultTemplateName}` : ''}`);
                
                // Re-register commands with new config
                this.registerCommands();
            }

        } catch (error: any) {
            this.log(`Error loading config: ${error.message}`, 'ERROR');
            vscode.window.showErrorMessage(`Error loading send_to_chat.json: ${error.message}`);
            this.templates = {};
        }
    }

    /**
     * Validate templates structure
     */
    private validateTemplates(templates: any): templates is { [key: string]: SendToChatTemplate } {
        if (typeof templates !== 'object' || templates === null) {
            return false;
        }

        for (const key of Object.keys(templates)) {
            // Skip non-template keys
            if (key === 'default') {
                continue;
            }
            
            const entry = templates[key];
            if (typeof entry !== 'object' || entry === null) {
                return false;
            }
            if (typeof entry.prefix !== 'string' || typeof entry.suffix !== 'string') {
                return false;
            }
            // showInMenu is optional boolean
            if (entry.showInMenu !== undefined && typeof entry.showInMenu !== 'boolean') {
                return false;
            }
        }

        return true;
    }

    /**
     * Set up file watcher for config changes
     */
    private setupFileWatcher(): void {
        const configPath = this.getConfigPath();
        if (!configPath) {
            return;
        }

        // Watch the specific file
        const configDir = path.dirname(configPath);
        const configFile = path.basename(configPath);
        
        this.configWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(configDir, configFile)
        );

        let debounceTimer: NodeJS.Timeout | undefined;
        const debounceReload = () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => {
                this.loadConfig();
            }, 500);
        };

        this.configWatcher.onDidChange(debounceReload);
        this.configWatcher.onDidCreate(debounceReload);
        this.configWatcher.onDidDelete(() => {
            this.templates = {};
            this.defaultTemplateName = undefined;
            this.registerCommands();
        });

        this.context.subscriptions.push(this.configWatcher);
    }

    /**
     * Register dynamic commands for each template
     */
    private registerCommands(): void {
        // Dispose old commands
        for (const cmd of this.registeredCommands) {
            cmd.dispose();
        }
        this.registeredCommands = [];

        // Register main command that shows QuickPick with templates
        const mainCmd = vscode.commands.registerCommand('dartscript.sendToChatAdvanced', async () => {
            await this.showTemplateQuickPick();
        });
        this.registeredCommands.push(mainCmd);
        this.context.subscriptions.push(mainCmd);

        // Register static commands for templates with showInMenu: true
        // These correspond to commands defined in package.json
        this.registerStaticMenuCommands();

        // Update menu contributions dynamically
        this.updateMenuContributions();
    }

    /**
     * Register static commands for templates with showInMenu: true
     * These are registered at extension activation and correspond to static menu entries in package.json
     */
    private registerStaticMenuCommands(): void {
        // Register the Trail Reminder command (static, defined in package.json)
        const trailReminderCmd = vscode.commands.registerCommand('dartscript.sendToChatTrailReminder', async () => {
            const template = this.templates['Trail Reminder'];
            if (template) {
                await this.sendToChat('Trail Reminder', template);
            } else {
                vscode.window.showWarningMessage('Trail Reminder template not found in configuration');
            }
        });
        this.registeredCommands.push(trailReminderCmd);
        this.context.subscriptions.push(trailReminderCmd);

        // Register the TODO Execution command (static, defined in package.json)
        const todoExecutionCmd = vscode.commands.registerCommand('dartscript.sendToChatTodoExecution', async () => {
            const template = this.templates['TODO Execution'];
            if (template) {
                await this.sendToChat('TODO Execution', template);
            } else {
                vscode.window.showWarningMessage('TODO Execution template not found in configuration');
            }
        });
        this.registeredCommands.push(todoExecutionCmd);
        this.context.subscriptions.push(todoExecutionCmd);

        // Register the Standard Template command (uses default from config, loaded dynamically)
        const standardTemplateCmd = vscode.commands.registerCommand('dartscript.sendToChatStandard', async () => {
            await this.sendWithDefaultTemplate();
        });
        this.registeredCommands.push(standardTemplateCmd);
        this.context.subscriptions.push(standardTemplateCmd);

        // Register submenu commands for Code Review, Explain, Add to Todo
        const codeReviewCmd = vscode.commands.registerCommand('dartscript.sendToChatCodeReview', async () => {
            const template = this.templates['Code Review'];
            if (template) {
                await this.sendToChat('Code Review', template);
            } else {
                vscode.window.showWarningMessage('Code Review template not found in configuration');
            }
        });
        this.registeredCommands.push(codeReviewCmd);
        this.context.subscriptions.push(codeReviewCmd);

        const explainCmd = vscode.commands.registerCommand('dartscript.sendToChatExplain', async () => {
            const template = this.templates['Explain Code'];
            if (template) {
                await this.sendToChat('Explain Code', template);
            } else {
                vscode.window.showWarningMessage('Explain Code template not found in configuration');
            }
        });
        this.registeredCommands.push(explainCmd);
        this.context.subscriptions.push(explainCmd);

        const addToTodoCmd = vscode.commands.registerCommand('dartscript.sendToChatAddToTodo', async () => {
            const template = this.templates['Add to Todo'];
            if (template) {
                await this.sendToChat('Add to Todo', template);
            } else {
                vscode.window.showWarningMessage('Add to Todo template not found in configuration');
            }
        });
        this.registeredCommands.push(addToTodoCmd);
        this.context.subscriptions.push(addToTodoCmd);

        // Register Fix Markdown here command
        const fixMarkdownCmd = vscode.commands.registerCommand('dartscript.sendToChatFixMarkdown', async () => {
            const template = this.templates['Fix Markdown here'];
            if (template) {
                await this.sendToChat('Fix Markdown here', template);
            } else {
                vscode.window.showWarningMessage('Fix Markdown here template not found in configuration');
            }
        });
        this.registeredCommands.push(fixMarkdownCmd);
        this.context.subscriptions.push(fixMarkdownCmd);

        // Register Show Chat Answer Values command (command palette only)
        const showChatAnswerCmd = vscode.commands.registerCommand('dartscript.showChatAnswerValues', () => {
            if (this.outputChannel) {
                this.outputChannel.show();
                this.outputChannel.appendLine('=== Chat Answer Values ===');
                
                const data = SendToChatAdvancedManager.chatAnswerData;
                if (Object.keys(data).length === 0) {
                    this.outputChannel.appendLine('(No chat answer values stored)');
                } else {
                    this.outputChannel.appendLine(JSON.stringify(data, null, 2));
                }
                
                this.outputChannel.appendLine('=========================');
            }
        });
        this.registeredCommands.push(showChatAnswerCmd);
        this.context.subscriptions.push(showChatAnswerCmd);

        // Register Clear Chat Answer Values command (command palette only)
        const clearChatAnswerCmd = vscode.commands.registerCommand('dartscript.clearChatAnswerValues', () => {
            const keyCount = Object.keys(SendToChatAdvancedManager.chatAnswerData).length;
            SendToChatAdvancedManager.chatAnswerData = {};
            clearChatResponseValues();
            
            if (this.outputChannel) {
                this.outputChannel.appendLine(`Cleared ${keyCount} chat answer value(s)`);
            }
            vscode.window.showInformationMessage(`Cleared ${keyCount} chat answer value(s)`);
        });
        this.registeredCommands.push(clearChatAnswerCmd);
        this.context.subscriptions.push(clearChatAnswerCmd);
    }

    /**
     * Send to chat using the default template from config
     */
    private async sendWithDefaultTemplate(): Promise<void> {
        // Reload config to get latest default
        await this.loadConfig();

        if (!this.defaultTemplateName) {
            vscode.window.showWarningMessage('No default template configured. Add "default": "Template Name" to your send_to_chat.json');
            return;
        }

        const template = this.templates[this.defaultTemplateName];
        if (!template) {
            vscode.window.showWarningMessage(`Default template "${this.defaultTemplateName}" not found in configuration`);
            return;
        }

        await this.sendToChat(this.defaultTemplateName, template);
    }

    /**
     * Show QuickPick with available templates
     */
    async showTemplateQuickPick(): Promise<void> {
        const templateEntries = Object.entries(this.templates);
        
        if (templateEntries.length === 0) {
            const action = await vscode.window.showWarningMessage(
                'No send-to-chat templates configured. Would you like to create a default configuration?',
                'Create Config',
                'Cancel'
            );
            if (action === 'Create Config') {
                await this.createDefaultConfig();
            }
            return;
        }

        const items: vscode.QuickPickItem[] = templateEntries.map(([label, template]) => ({
            label,
            description: (template as SendToChatTemplate).prefix.substring(0, 50).replace(/\n/g, ' ') + '...'
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a template to send to Copilot Chat',
            title: 'Send to Copilot Chat'
        });

        if (selected) {
            const template = this.templates[selected.label];
            if (template) {
                await this.sendToChat(selected.label, template);
            }
        }
    }

    /**
     * Update menu contributions for the submenu
     * Note: This requires package.json to have an empty submenu array that we populate via setContext
     */
    private updateMenuContributions(): void {
        // Set context with available templates for menu visibility
        const templateLabels = Object.keys(this.templates);
        vscode.commands.executeCommand('setContext', 'dartscript.sendToChatTemplates', templateLabels);
        vscode.commands.executeCommand('setContext', 'dartscript.hasSendToChatTemplates', templateLabels.length > 0);
    }

    /**
     * Send text to Copilot Chat with template
     */
    private async sendToChat(label: string, template: SendToChatTemplate): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        // Get content - selected text or full file
        let content: string;
        const selection = editor.selection;
        if (selection.isEmpty) {
            content = editor.document.getText();
        } else {
            content = editor.document.getText(selection);
        }

        // Concatenate with template
        const fullPrompt = this.concatenatePrompt(template.prefix, content, template.suffix);

        try {
            // Send to Copilot Chat
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: fullPrompt
            });

            // Log to output panel
            this.log(`Sent to Copilot Chat: ${label}`);

        } catch (error: any) {
            this.log(`Error sending to chat: ${error.message}`, 'ERROR');
            vscode.window.showErrorMessage(`Failed to send to Copilot Chat: ${error.message}`);
        }
    }

    /**
     * Concatenate prefix, content, and suffix with proper formatting
     * Supports placeholder substitution using ${path} notation
     * Placeholders are replaced recursively (up to 10 levels) in the entire result
     */
    private concatenatePrompt(prefix: string, content: string, suffix: string): string {
        // Try to parse content as structured data for placeholder substitution
        const parsed = this.parseContent(content);
        
        // First, concatenate everything
        let result = '';

        if (prefix) {
            result += prefix;
            if (!prefix.endsWith('\n')) {
                result += '\n';
            }
        }

        result += content;

        if (suffix) {
            if (!content.endsWith('\n')) {
                result += '\n';
            }
            result += suffix;
        }

        // Then, recursively replace placeholders in the entire result (up to 10 levels)
        result = this.replacePlaceholdersRecursive(result, parsed, 10);

        return result;
    }

    /**
     * Recursively replace placeholders until no more replacements occur or max depth reached
     * Does not fail after max depth - just leaves remaining placeholders for user to see
     */
    private replacePlaceholdersRecursive(text: string, parsed: ParsedContent, maxDepth: number): string {
        let result = text;
        let previousResult = '';
        let depth = 0;

        while (result !== previousResult && depth < maxDepth) {
            previousResult = result;
            result = this.replacePlaceholders(result, parsed);
            depth++;
        }

        return result;
    }

    /**
     * Parse content as JSON, YAML, or colon-delimited format
     * Always includes default values: datetime, windowId
     */
    private parseContent(content: string): ParsedContent {
        let parsed: ParsedContent;

        // Try JSON first
        try {
            const data = JSON.parse(content);
            if (typeof data === 'object' && data !== null) {
                parsed = { data };
            } else {
                parsed = { data: {} };
            }
        } catch {
            // Try YAML-like parsing (simple key: value format)
            try {
                const yamlData = this.parseYamlLike(content);
                if (Object.keys(yamlData.data).length > 0) {
                    parsed = yamlData;
                } else {
                    // Try colon-delimited format
                    parsed = this.parseColonDelimited(content);
                }
            } catch {
                // Try colon-delimited format
                parsed = this.parseColonDelimited(content);
            }
        }

        // Add default values (don't override existing keys)
        this.addDefaultValues(parsed);

        return parsed;
    }

    /**
     * Get the chat answer folder from settings
     */
    private getChatAnswerFolder(): string {
        const setting = vscode.workspace.getConfiguration('dartscript.sendToChat').get<string>('chatAnswerFolder');
        return setting || '_ai/chat_replies';
    }

    /**
     * Add default values to parsed content in the 'dartscript' sub-object
     * The dartscript object CANNOT be overwritten by user values
     * - dartscript.datetime: Current date/time in yyyymmdd_hhmmss format
     * - dartscript.windowId: Unique VS Code session ID (unique per window)
     * - dartscript.machineId: VS Code machine ID (unique per machine)
     * - dartscript.chatAnswerFolder: Path to chat answer folder from settings
     * - dartscript.chat: Accumulated data from chat answer files
     */
    private addDefaultValues(parsed: ParsedContent): void {
        // Load chat answer file and accumulate data
        this.loadChatAnswerFile();

        // Create dartscript object - ALWAYS overwrite to prevent user manipulation
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        parsed.data['dartscript'] = {
            datetime: `${year}${month}${day}_${hours}${minutes}${seconds}`,
            windowId: vscode.env.sessionId,
            machineId: vscode.env.machineId,
            chatAnswerFolder: this.getChatAnswerFolder(),
            chat: { ...SendToChatAdvancedManager.chatAnswerData }
        };
    }

    /**
     * Load and parse the chat answer file, accumulating data into static map
     */
    private loadChatAnswerFile(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const chatAnswerFolder = this.getChatAnswerFolder();
        const answerFilePath = path.join(
            workspaceFolders[0].uri.fsPath,
            chatAnswerFolder,
            `${vscode.env.sessionId}_${vscode.env.machineId}_answer.yaml`
        );

        try {
            if (!fs.existsSync(answerFilePath)) {
                return;
            }

            const content = fs.readFileSync(answerFilePath, 'utf-8');
            if (!content.trim()) {
                return;
            }

            // Try to parse as JSON first
            try {
                const jsonData = JSON.parse(content);
                if (typeof jsonData === 'object' && jsonData !== null) {
                    // Copy all top-level fields first
                    Object.assign(SendToChatAdvancedManager.chatAnswerData, jsonData);
                    
                    // If responseValues exists, also spread those keys to top-level for ${dartscript.chat.KEY} access
                    if (jsonData.responseValues && typeof jsonData.responseValues === 'object') {
                        Object.assign(SendToChatAdvancedManager.chatAnswerData, jsonData.responseValues);
                    }
                    
                    // Sync to shared store so all handlers can access via ${dartscript.chat.KEY}
                    updateChatResponseValues(SendToChatAdvancedManager.chatAnswerData);
                    
                    this.log(`Loaded chat answer data from ${answerFilePath}`);
                    
                    // Trail: Log Copilot answer file
                    loadTrailConfig();
                    logCopilotAnswer(answerFilePath, jsonData);
                    
                    return;
                }
            } catch {
                // Not JSON, try YAML-like
            }

            // Parse as YAML-like
            const parsed = this.parseYamlLike(content);
            if (Object.keys(parsed.data).length > 0) {
                Object.assign(SendToChatAdvancedManager.chatAnswerData, parsed.data);
                
                // Sync to shared store
                updateChatResponseValues(SendToChatAdvancedManager.chatAnswerData);
                
                this.log(`Loaded chat answer data from ${answerFilePath}`);
                
                // Trail: Log Copilot answer file (YAML format)
                loadTrailConfig();
                logCopilotAnswer(answerFilePath, parsed.data);
            }

        } catch (error: any) {
            this.log(`Error loading chat answer file: ${error.message}`, 'ERROR');
        }
    }

    /**
     * Parse simple YAML-like format (key: value pairs)
     */
    private parseYamlLike(content: string): ParsedContent {
        const lines = content.split('\n');
        const data: { [key: string]: any } = {};
        let preamble = '';
        let currentKey: string | null = null;
        let currentValue = '';
        let foundFirstKey = false;

        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            const trimmedLine = line.trim();
            
            // Check if this line starts a new key (has colon and key part has no spaces or is indented)
            if (colonIndex > 0 && !line.substring(0, colonIndex).includes(' ') && trimmedLine.length > 0) {
                // Save previous key-value if exists
                if (currentKey !== null) {
                    data[currentKey] = currentValue.trim();
                }
                
                foundFirstKey = true;
                currentKey = line.substring(0, colonIndex).trim();
                currentValue = line.substring(colonIndex + 1);
            } else if (foundFirstKey && currentKey !== null) {
                // Continue current value
                currentValue += '\n' + line;
            } else {
                // Preamble (before first key)
                preamble += (preamble ? '\n' : '') + line;
            }
        }

        // Save last key-value
        if (currentKey !== null) {
            data[currentKey] = currentValue.trim();
        }

        return { preamble: preamble || undefined, data };
    }

    /**
     * Parse colon-delimited format with preamble support
     */
    private parseColonDelimited(content: string): ParsedContent {
        const lines = content.split('\n');
        const data: { [key: string]: any } = {};
        let preamble = '';
        let currentKey: string | null = null;
        let currentValue = '';
        let foundFirstKey = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const colonIndex = line.indexOf(':');
            
            if (colonIndex > 0) {
                // This line has a colon - could be a key
                const potentialKey = line.substring(0, colonIndex).trim();
                
                // Check if next line also has a colon (indicating this is a key line)
                const isKeyLine = potentialKey.length > 0 && !potentialKey.includes('\n');
                
                if (isKeyLine) {
                    // Save previous key-value if exists
                    if (currentKey !== null) {
                        data[currentKey] = currentValue.trim();
                    }
                    
                    foundFirstKey = true;
                    currentKey = potentialKey;
                    currentValue = line.substring(colonIndex + 1);
                    continue;
                }
            }
            
            if (foundFirstKey && currentKey !== null) {
                // Continue current value
                currentValue += '\n' + line;
            } else {
                // Preamble (before first key)
                preamble += (preamble ? '\n' : '') + line;
            }
        }

        // Save last key-value
        if (currentKey !== null) {
            data[currentKey] = currentValue.trim();
        }

        return { preamble: preamble || undefined, data };
    }

    /**
     * Replace ${path} placeholders with values from parsed content
     */
    private replacePlaceholders(text: string, parsed: ParsedContent): string {
        return text.replace(/\$\{([^}]+)\}/g, (match, path) => {
            // Handle special 'preamble' placeholder
            if (path === 'preamble') {
                return parsed.preamble || '';
            }
            
            // Navigate the path (e.g., "user.name" or just "name")
            const parts = path.split('.');
            let value: any = parsed.data;
            
            for (const part of parts) {
                if (value && typeof value === 'object' && part in value) {
                    value = value[part];
                } else {
                    // Path not found, keep original placeholder
                    return match;
                }
            }
            
            // Convert value to string
            if (typeof value === 'string') {
                return value;
            } else if (value !== null && value !== undefined) {
                return JSON.stringify(value);
            }
            
            return match;
        });
    }

    /**
     * Get available templates for menu generation
     */
    getTemplates(): Map<string, SendToChatTemplate> {
        return new Map(Object.entries(this.templates));
    }

    /**
     * Create default configuration file
     */
    async createDefaultConfig(): Promise<void> {
        const configPath = this.getConfigPath();
        if (!configPath) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const defaultConfig: { [key: string]: SendToChatTemplate } = {};
        
        // Use bracket notation to avoid lint errors for property names with spaces
        defaultConfig["Explain Code"] = {
            prefix: "Please explain the following code in detail:\n",
            suffix: "\n\nInclude:\n- What it does\n- Key algorithms or patterns\n- Potential issues or improvements"
        };
        defaultConfig["Review for Bugs"] = {
            prefix: "Review this code for bugs and security issues:\n",
            suffix: "\n\nFocus on:\n- Security vulnerabilities\n- Edge cases\n- Error handling\n- Performance issues"
        };
        defaultConfig["Add Unit Tests"] = {
            prefix: "Generate comprehensive unit tests for:\n",
            suffix: "\n\nRequirements:\n- High coverage\n- Test edge cases\n- Test error conditions\n- Use appropriate testing framework"
        };
        defaultConfig["Add Documentation"] = {
            prefix: "Add complete documentation for:\n",
            suffix: "\n\nInclude:\n- API documentation\n- Usage examples\n- Parameter descriptions\n- Return value descriptions"
        };
        defaultConfig["Refactor"] = {
            prefix: "Refactor this code for better quality:\n",
            suffix: "\n\nFocus on:\n- Readability\n- Maintainability\n- Performance\n- Best practices"
        };

        try {
            // Ensure directory exists
            const configDir = path.dirname(configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
            vscode.window.showInformationMessage(`Created default config: ${configPath}`);
            
            // Open the file for editing
            const doc = await vscode.workspace.openTextDocument(configPath);
            await vscode.window.showTextDocument(doc);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to create config: ${error.message}`);
        }
    }

    /**
     * Log message to output channel if available
     */
    private log(message: string, level: 'INFO' | 'ERROR' = 'INFO'): void {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[SendToChatAdvanced] [${level}] ${message}`);
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        for (const cmd of this.registeredCommands) {
            cmd.dispose();
        }
        this.registeredCommands = [];
        
        if (this.configWatcher) {
            this.configWatcher.dispose();
        }
    }
}
