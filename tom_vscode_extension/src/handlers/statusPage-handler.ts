/**
 * Status Page Handler
 * 
 * Custom webview panel for extension configuration and status control.
 * Shows toggle controls for:
 * - Tom CLI Integration Server (Start/Stop)
 * - Tom Bridge (Restart, Switch Profile)
 * - AI Trail (On/Off)
 * - Local LLM Settings
 * - AI Conversation Settings
 * - Telegram Settings
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getBridgeClient, getConfigPath } from './handler_shared';
import { getCliServerStatus } from './cliServer-handler';
import { loadBridgeConfig, BridgeConfig } from './restartBridge-handler';
import { isTrailEnabled, setTrailEnabled, loadTrailConfig, toggleTrail } from './trailLogger-handler';
import { isTelegramPollingActive } from './telegram-commands';
import { 
    loadEscalationToolsConfig, 
    saveEscalationToolsConfig, 
    clearConfigCache,
    AskCopilotConfig,
    AskBigBrotherConfig,
} from '../tools/escalation-tools-config';

let statusPanel: vscode.WebviewPanel | undefined;

// Config loading functions
function loadConfig(): any {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

function saveConfig(config: any): boolean {
    const configPath = getConfigPath();
    if (!configPath) {
        return false;
    }
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch {
        return false;
    }
}

// Update functions for settings
async function updateLocalLlmSettings(settings: any): Promise<void> {
    const config = loadConfig();
    if (!config) { return; }
    
    if (!config.promptExpander) {
        config.promptExpander = {};
    }
    
    Object.assign(config.promptExpander, {
        ollamaUrl: settings.ollamaUrl,
        model: settings.model,
        temperature: settings.temperature,
        stripThinkingTags: settings.stripThinkingTags,
        expansionProfile: settings.expansionProfile,
        toolsEnabled: settings.toolsEnabled,
        trailMaximumTokens: settings.trailMaximumTokens,
        trailSummarizationTemperature: settings.trailSummarizationTemperature,
        removePromptTemplateFromTrail: settings.removePromptTemplateFromTrail
    });
    
    if (saveConfig(config)) {
        vscode.window.showInformationMessage('Local LLM settings updated');
    }
}

async function updateAiConversationSettings(settings: any): Promise<void> {
    const config = loadConfig();
    if (!config) { return; }
    
    if (!config.botConversation) {
        config.botConversation = {};
    }
    
    Object.assign(config.botConversation, {
        maxTurns: settings.maxTurns,
        temperature: settings.temperature,
        historyMode: settings.historyMode,
        conversationMode: settings.conversationMode,
        toolsEnabled: settings.toolsEnabled,
        trailMaximumTokens: settings.trailMaximumTokens,
        trailSummarizationTemperature: settings.trailSummarizationTemperature,
        removePromptTemplateFromTrail: settings.removePromptTemplateFromTrail
    });
    
    if (saveConfig(config)) {
        vscode.window.showInformationMessage('AI Conversation settings updated');
    }
}

async function updateTelegramSettings(settings: any): Promise<void> {
    const config = loadConfig();
    if (!config) { return; }
    
    if (!config.botConversation) {
        config.botConversation = {};
    }
    if (!config.botConversation.telegram) {
        config.botConversation.telegram = {};
    }
    
    Object.assign(config.botConversation.telegram, {
        enabled: settings.enabled,
        botTokenEnv: settings.botTokenEnv,
        defaultChatId: settings.defaultChatId,
        pollIntervalMs: settings.pollIntervalMs,
        notifyOnStart: settings.notifyOnStart,
        notifyOnTurn: settings.notifyOnTurn,
        notifyOnEnd: settings.notifyOnEnd
    });
    
    if (saveConfig(config)) {
        vscode.window.showInformationMessage('Telegram settings updated');
    }
}

async function updateAskCopilotSettings(settings: any): Promise<void> {
    const config = loadEscalationToolsConfig();
    config.askCopilot = { ...config.askCopilot, ...settings };
    if (saveEscalationToolsConfig(config)) {
        clearConfigCache();
        vscode.window.showInformationMessage('Ask Copilot settings updated');
    }
}

async function updateAskBigBrotherSettings(settings: any): Promise<void> {
    const config = loadEscalationToolsConfig();
    config.askBigBrother = { ...config.askBigBrother, ...settings };
    if (saveEscalationToolsConfig(config)) {
        clearConfigCache();
        vscode.window.showInformationMessage('Ask Big Brother settings updated');
    }
}

/**
 * Status data for the webview
 */
interface StatusData {
    cliServer: {
        running: boolean;
        port?: number;
    };
    bridge: {
        connected: boolean;
        currentProfile: string;
        profiles: string[];
    };
    trail: {
        enabled: boolean;
    };
    telegram: {
        polling: boolean;
        enabled: boolean;
        botTokenEnv: string;
        defaultChatId: number;
        pollIntervalMs: number;
        notifyOnTurn: boolean;
        notifyOnStart: boolean;
        notifyOnEnd: boolean;
    };
    localLlm: {
        ollamaUrl: string;
        model: string;
        temperature: number;
        stripThinkingTags: boolean;
        expansionProfile: string;
        trailMaximumTokens: number;
        trailSummarizationTemperature: number;
        removePromptTemplateFromTrail: boolean;
        toolsEnabled: boolean;
        profiles: string[];
    };
    aiConversation: {
        maxTurns: number;
        temperature: number;
        historyMode: string;
        conversationMode: string;
        trailMaximumTokens: number;
        trailSummarizationTemperature: number;
        removePromptTemplateFromTrail: boolean;
        toolsEnabled: boolean;
        profiles: string[];
    };
    askCopilot: AskCopilotConfig;
    askBigBrother: AskBigBrotherConfig;
}

/**
 * Gather all status data
 */
async function gatherStatusData(): Promise<StatusData> {
    // CLI Server status
    const cliStatus = await getCliServerStatus();
    
    // Bridge status
    const bridgeClient = getBridgeClient();
    const bridgeConfig = loadBridgeConfig();
    
    // Trail status
    loadTrailConfig();
    
    // Load config for local LLM, AI conversation, and telegram
    const config = loadConfig();
    const promptExpander = config?.promptExpander || {};
    const botConversation = config?.botConversation || {};
    const telegram = botConversation?.telegram || {};
    
    return {
        cliServer: {
            running: cliStatus.running,
            port: cliStatus.port,
        },
        bridge: {
            connected: bridgeClient !== null,
            currentProfile: bridgeConfig?.current ?? 'default',
            profiles: bridgeConfig ? Object.keys(bridgeConfig.profiles) : ['default'],
        },
        trail: {
            enabled: isTrailEnabled(),
        },
        telegram: {
            polling: isTelegramPollingActive(),
            enabled: telegram.enabled ?? false,
            botTokenEnv: telegram.botTokenEnv ?? 'TELEGRAM_BOT_TOKEN',
            defaultChatId: telegram.defaultChatId ?? 0,
            pollIntervalMs: telegram.pollIntervalMs ?? 3000,
            notifyOnTurn: telegram.notifyOnTurn ?? true,
            notifyOnStart: telegram.notifyOnStart ?? true,
            notifyOnEnd: telegram.notifyOnEnd ?? true,
        },
        localLlm: {
            ollamaUrl: promptExpander.ollamaUrl ?? 'http://localhost:11434',
            model: promptExpander.model ?? 'qwen3:8b',
            temperature: promptExpander.temperature ?? 0.4,
            stripThinkingTags: promptExpander.stripThinkingTags ?? true,
            expansionProfile: promptExpander.expansionProfile ?? 'expand',
            trailMaximumTokens: promptExpander.trailMaximumTokens ?? 8000,
            trailSummarizationTemperature: promptExpander.trailSummarizationTemperature ?? 0.3,
            removePromptTemplateFromTrail: promptExpander.removePromptTemplateFromTrail ?? true,
            toolsEnabled: promptExpander.toolsEnabled ?? true,
            profiles: promptExpander.profiles ? Object.keys(promptExpander.profiles) : [],
        },
        aiConversation: {
            maxTurns: botConversation.maxTurns ?? 10,
            temperature: botConversation.temperature ?? 0.5,
            historyMode: botConversation.historyMode ?? 'trim_and_summary',
            conversationMode: botConversation.conversationMode ?? 'ollama-copilot',
            trailMaximumTokens: botConversation.trailMaximumTokens ?? 8000,
            trailSummarizationTemperature: botConversation.trailSummarizationTemperature ?? 0.3,
            removePromptTemplateFromTrail: botConversation.removePromptTemplateFromTrail ?? true,
            toolsEnabled: botConversation.toolsEnabled ?? true,
            profiles: botConversation.profiles ? Object.keys(botConversation.profiles) : [],
        },
        ...loadEscalationToolsConfig(),
    };
}

/**
 * Generate the HTML for the status page
 */
function getStatusPageHtml(status: StatusData): string {
    const cliStatusText = status.cliServer.running 
        ? `Running on port ${status.cliServer.port}` 
        : 'Stopped';
    
    const bridgeStatusText = status.bridge.connected 
        ? 'Connected' 
        : 'Disconnected';
    
    const profileOptions = status.bridge.profiles.map(p => 
        `<option value="${p}" ${p === status.bridge.currentProfile ? 'selected' : ''}>${p}</option>`
    ).join('');
    
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        padding: 24px;
        font-family: var(--vscode-font-family);
        background-color: var(--vscode-editor-background);
        color: var(--vscode-foreground);
    }
    h1 {
        margin-bottom: 24px;
        font-size: 24px;
        font-weight: 600;
    }
    .section {
        margin-bottom: 32px;
        padding: 20px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        background: var(--vscode-editorWidget-background);
    }
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    .section h2 {
        font-size: 16px;
        font-weight: 600;
    }
    .status-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
    }
    .status-running { background: var(--vscode-testing-iconPassed); color: white; }
    .status-stopped { background: var(--vscode-testing-iconFailed); color: white; }
    .status-connected { background: var(--vscode-testing-iconPassed); color: white; }
    .status-disconnected { background: var(--vscode-testing-iconFailed); color: white; }
    .controls {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
    }
    button {
        padding: 8px 16px;
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: background-color 0.15s;
    }
    button.primary {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
    }
    button.primary:hover {
        background-color: var(--vscode-button-hoverBackground);
    }
    button.secondary {
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
    }
    select, input {
        padding: 8px 12px;
        border: 1px solid var(--vscode-input-border);
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border-radius: 4px;
        font-size: 13px;
        min-width: 150px;
    }
    input { min-width: 100px; }
    input[type="number"] { width: 100px; min-width: 80px; }
    select:focus, input:focus {
        border-color: var(--vscode-focusBorder);
        outline: none;
    }
    .toggle-group {
        display: flex;
        gap: 0;
    }
    .toggle-group button {
        border-radius: 0;
    }
    .toggle-group button:first-child {
        border-radius: 4px 0 0 4px;
    }
    .toggle-group button:last-child {
        border-radius: 0 4px 4px 0;
    }
    .info-text {
        font-size: 13px;
        color: var(--vscode-descriptionForeground);
        margin-top: 12px;
    }
    .divider {
        height: 1px;
        background: var(--vscode-panel-border);
        margin: 16px 0;
    }
    .setting-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }
    .setting-row label {
        min-width: 180px;
        font-size: 13px;
    }
    .setting-row input, .setting-row select {
        flex: 1;
        max-width: 300px;
    }
    .collapsible {
        cursor: pointer;
        user-select: none;
    }
    .collapsible:hover {
        opacity: 0.8;
    }
    .collapse-content {
        overflow: hidden;
        transition: max-height 0.3s ease-out;
    }
    .collapse-icon {
        display: inline-block;
        transition: transform 0.3s;
        margin-right: 8px;
    }
    .collapsed .collapse-icon {
        transform: rotate(-90deg);
    }
</style>
</head>
<body>
    <h1>🔧 Tom Extension Status</h1>
    
    <div class="section">
        <div class="section-header">
            <h2>📡 Tom CLI Integration Server</h2>
            <span class="status-badge ${status.cliServer.running ? 'status-running' : 'status-stopped'}">${cliStatusText}</span>
        </div>
        <div class="controls">
            <button class="${status.cliServer.running ? 'secondary' : 'primary'}" onclick="startCliServer()">Start</button>
            <button class="${status.cliServer.running ? 'primary' : 'secondary'}" onclick="stopCliServer()">Stop</button>
        </div>
        <p class="info-text">Allows Tom CLI tools to communicate with VS Code via socket connection.</p>
    </div>

    <div class="section">
        <div class="section-header">
            <h2>🔗 Tom Bridge</h2>
            <span class="status-badge ${status.bridge.connected ? 'status-connected' : 'status-disconnected'}">${bridgeStatusText}</span>
        </div>
        <div class="controls">
            <button class="primary" onclick="restartBridge()">Restart</button>
            <select id="bridgeProfile" onchange="switchProfile(this.value)">
                ${profileOptions}
            </select>
        </div>
        <div class="divider"></div>
        <div class="controls">
            <span style="margin-right: 8px;">Switch Mode:</span>
            <button class="${status.bridge.currentProfile === 'development' ? 'primary' : 'secondary'}" onclick="switchToProfile('development')">Development</button>
            <button class="${status.bridge.currentProfile === 'production' ? 'primary' : 'secondary'}" onclick="switchToProfile('production')">Production</button>
        </div>
        <p class="info-text">Current profile: <strong>${status.bridge.currentProfile}</strong>. Switching profiles will restart the bridge automatically.</p>
    </div>

    <div class="section">
        <div class="section-header">
            <h2>📝 AI Trail Logging</h2>
            <span class="status-badge ${status.trail.enabled ? 'status-running' : 'status-stopped'}">${status.trail.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div class="controls">
            <div class="toggle-group">
                <button class="${status.trail.enabled ? 'primary' : 'secondary'}" onclick="setTrail(true)">On</button>
                <button class="${!status.trail.enabled ? 'primary' : 'secondary'}" onclick="setTrail(false)">Off</button>
            </div>
        </div>
        <p class="info-text">Logs all AI interactions (prompts, responses, tool calls) to _ai/*/trail/ folders.</p>
    </div>

    <div class="section">
        <div class="section-header collapsible" onclick="toggleSection('localLlm')">
            <h2><span class="collapse-icon">▼</span>🤖 Local LLM Settings</h2>
        </div>
        <div id="localLlm-content" class="collapse-content">
            <div class="setting-row">
                <label>Ollama URL:</label>
                <input type="text" id="llm-ollamaUrl" value="${status.localLlm.ollamaUrl}" onchange="updateLocalLlm()">
            </div>
            <div class="setting-row">
                <label>Model:</label>
                <input type="text" id="llm-model" value="${status.localLlm.model}" onchange="updateLocalLlm()">
            </div>
            <div class="setting-row">
                <label>Temperature:</label>
                <input type="number" id="llm-temperature" value="${status.localLlm.temperature}" step="0.1" min="0" max="2" onchange="updateLocalLlm()">
            </div>
            <div class="setting-row">
                <label>Strip Thinking Tags:</label>
                <select id="llm-stripThinkingTags" onchange="updateLocalLlm()">
                    <option value="true" ${status.localLlm.stripThinkingTags ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.localLlm.stripThinkingTags ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Expansion Profile:</label>
                <select id="llm-expansionProfile" onchange="updateLocalLlm()">
                    ${status.localLlm.profiles.map(p => `<option value="${p}" ${p === status.localLlm.expansionProfile ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
            </div>
            <div class="setting-row">
                <label>Tools Enabled:</label>
                <select id="llm-toolsEnabled" onchange="updateLocalLlm()">
                    <option value="true" ${status.localLlm.toolsEnabled ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.localLlm.toolsEnabled ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="divider"></div>
            <h3 style="font-size: 14px; margin-bottom: 12px;">Trail Summarization</h3>
            <div class="setting-row">
                <label>Max Tokens:</label>
                <input type="number" id="llm-trailMaximumTokens" value="${status.localLlm.trailMaximumTokens}" step="1000" min="1000" onchange="updateLocalLlm()">
            </div>
            <div class="setting-row">
                <label>Summarization Temperature:</label>
                <input type="number" id="llm-trailSummarizationTemperature" value="${status.localLlm.trailSummarizationTemperature}" step="0.1" min="0" max="2" onchange="updateLocalLlm()">
            </div>
            <div class="setting-row">
                <label>Remove Prompt Template:</label>
                <select id="llm-removePromptTemplateFromTrail" onchange="updateLocalLlm()">
                    <option value="true" ${status.localLlm.removePromptTemplateFromTrail ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.localLlm.removePromptTemplateFromTrail ? 'selected' : ''}>No</option>
                </select>
            </div>
            <p class="info-text">Global settings for local LLM interactions. Profile-specific settings can be edited in the Local LLM panel.</p>
        </div>
    </div>

    <div class="section">
        <div class="section-header collapsible" onclick="toggleSection('aiConversation')">
            <h2><span class="collapse-icon">▼</span>💬 AI Conversation Settings</h2>
        </div>
        <div id="aiConversation-content" class="collapse-content">
            <div class="setting-row">
                <label>Max Turns:</label>
                <input type="number" id="conv-maxTurns" value="${status.aiConversation.maxTurns}" min="1" onchange="updateAiConversation()">
            </div>
            <div class="setting-row">
                <label>Temperature:</label>
                <input type="number" id="conv-temperature" value="${status.aiConversation.temperature}" step="0.1" min="0" max="2" onchange="updateAiConversation()">
            </div>
            <div class="setting-row">
                <label>History Mode:</label>
                <select id="conv-historyMode" onchange="updateAiConversation()">
                    <option value="full" ${status.aiConversation.historyMode === 'full' ? 'selected' : ''}>Full (all exchanges)</option>
                    <option value="last" ${status.aiConversation.historyMode === 'last' ? 'selected' : ''}>Last (only last exchange)</option>
                    <option value="summary" ${status.aiConversation.historyMode === 'summary' ? 'selected' : ''}>Summary (summarized history)</option>
                    <option value="trim_and_summary" ${status.aiConversation.historyMode === 'trim_and_summary' ? 'selected' : ''}>Trim + Summary (trimmed + older summarized)</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Conversation Mode:</label>
                <select id="conv-conversationMode" onchange="updateAiConversation()">
                    <option value="ollama-copilot" ${status.aiConversation.conversationMode === 'ollama-copilot' ? 'selected' : ''}>Ollama → Copilot</option>
                    <option value="ollama-ollama" ${status.aiConversation.conversationMode === 'ollama-ollama' ? 'selected' : ''}>Ollama ↔ Ollama (Self-Talk)</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Tools Enabled:</label>
                <select id="conv-toolsEnabled" onchange="updateAiConversation()">
                    <option value="true" ${status.aiConversation.toolsEnabled ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.aiConversation.toolsEnabled ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="divider"></div>
            <h3 style="font-size: 14px; margin-bottom: 12px;">Trail Summarization</h3>
            <div class="setting-row">
                <label>Max Tokens:</label>
                <input type="number" id="conv-trailMaximumTokens" value="${status.aiConversation.trailMaximumTokens}" step="1000" min="1000" onchange="updateAiConversation()">
            </div>
            <div class="setting-row">
                <label>Summarization Temperature:</label>
                <input type="number" id="conv-trailSummarizationTemperature" value="${status.aiConversation.trailSummarizationTemperature}" step="0.1" min="0" max="2" onchange="updateAiConversation()">
            </div>
            <div class="setting-row">
                <label>Remove Prompt Template:</label>
                <select id="conv-removePromptTemplateFromTrail" onchange="updateAiConversation()">
                    <option value="true" ${status.aiConversation.removePromptTemplateFromTrail ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.aiConversation.removePromptTemplateFromTrail ? 'selected' : ''}>No</option>
                </select>
            </div>
            <p class="info-text">Global settings for AI conversations. Profile-specific settings can override these in the AI Conversation panel.</p>
        </div>
    </div>

    <div class="section">
        <div class="section-header collapsible" onclick="toggleSection('telegram')">
            <h2><span class="collapse-icon">▼</span>📱 Telegram Settings</h2>
            <span class="status-badge ${status.telegram.polling ? 'status-running' : 'status-stopped'}">${status.telegram.polling ? 'Active' : 'Inactive'}</span>
        </div>
        <div id="telegram-content" class="collapse-content">
            <div class="controls" style="margin-bottom: 16px;">
                <button class="${status.telegram.polling ? 'secondary' : 'primary'}" onclick="startTelegram()">Start</button>
                <button class="${status.telegram.polling ? 'primary' : 'secondary'}" onclick="stopTelegram()">Stop</button>
                <button class="secondary" onclick="testTelegram()">Test Connection</button>
            </div>
            <div class="setting-row">
                <label>Enabled:</label>
                <select id="tg-enabled" onchange="updateTelegram()">
                    <option value="true" ${status.telegram.enabled ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.telegram.enabled ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Bot Token Env Variable:</label>
                <input type="text" id="tg-botTokenEnv" value="${status.telegram.botTokenEnv}" onchange="updateTelegram()">
            </div>
            <div class="setting-row">
                <label>Default Chat ID:</label>
                <input type="number" id="tg-defaultChatId" value="${status.telegram.defaultChatId}" onchange="updateTelegram()">
            </div>
            <div class="setting-row">
                <label>Poll Interval (ms):</label>
                <input type="number" id="tg-pollIntervalMs" value="${status.telegram.pollIntervalMs}" step="1000" min="1000" onchange="updateTelegram()">
            </div>
            <div class="divider"></div>
            <h3 style="font-size: 14px; margin-bottom: 12px;">Notifications</h3>
            <div class="setting-row">
                <label>Notify on Start:</label>
                <select id="tg-notifyOnStart" onchange="updateTelegram()">
                    <option value="true" ${status.telegram.notifyOnStart ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.telegram.notifyOnStart ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Notify on Turn:</label>
                <select id="tg-notifyOnTurn" onchange="updateTelegram()">
                    <option value="true" ${status.telegram.notifyOnTurn ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.telegram.notifyOnTurn ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Notify on End:</label>
                <select id="tg-notifyOnEnd" onchange="updateTelegram()">
                    <option value="true" ${status.telegram.notifyOnEnd ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.telegram.notifyOnEnd ? 'selected' : ''}>No</option>
                </select>
            </div>
            <p class="info-text">Polls for Telegram commands to control VS Code remotely.</p>
        </div>
    </div>

    <!-- Ask Copilot Settings -->
    <div class="section">
        <div class="section-header collapsed" onclick="toggleSection('askCopilot')">Ask Copilot <span class="collapse-icon"></span></div>
        <div id="askCopilot-content" class="section-content">
            <div class="setting-row">
                <label>Enabled:</label>
                <select id="ac-enabled" onchange="updateAskCopilot()">
                    <option value="true" ${status.askCopilot.enabled ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.askCopilot.enabled ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Answer Timeout (ms):</label>
                <input type="number" id="ac-answerFileTimeout" value="${status.askCopilot.answerFileTimeout}" onchange="updateAskCopilot()">
            </div>
            <div class="setting-row">
                <label>Poll Interval (ms):</label>
                <input type="number" id="ac-pollInterval" value="${status.askCopilot.pollInterval}" onchange="updateAskCopilot()">
            </div>
            <div class="setting-row">
                <label>Answer Folder:</label>
                <input type="text" id="ac-answerFolder" value="${status.askCopilot.answerFolder}" onchange="updateAskCopilot()">
            </div>
            <div class="setting-row">
                <label>Prompt Prefix:</label>
                <textarea id="ac-promptPrefix" rows="2" onchange="updateAskCopilot()">${status.askCopilot.promptPrefix || ''}</textarea>
            </div>
            <div class="setting-row">
                <label>Prompt Suffix:</label>
                <textarea id="ac-promptSuffix" rows="3" onchange="updateAskCopilot()">${status.askCopilot.promptSuffix || ''}</textarea>
            </div>
            <p class="info-text">Opens Copilot Chat and monitors for answer file responses.</p>
        </div>
    </div>

    <!-- Ask Big Brother Settings -->
    <div class="section">
        <div class="section-header collapsed" onclick="toggleSection('askBigBrother')">Ask Big Brother <span class="collapse-icon"></span></div>
        <div id="askBigBrother-content" class="section-content">
            <div class="setting-row">
                <label>Enabled:</label>
                <select id="abb-enabled" onchange="updateAskBigBrother()">
                    <option value="true" ${status.askBigBrother.enabled ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.askBigBrother.enabled ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Default Model:</label>
                <input type="text" id="abb-defaultModel" value="${status.askBigBrother.defaultModel}" onchange="updateAskBigBrother()">
            </div>
            <div class="setting-row">
                <label>Temperature:</label>
                <input type="number" id="abb-temperature" value="${status.askBigBrother.temperature}" step="0.1" min="0" max="2" onchange="updateAskBigBrother()">
            </div>
            <div class="setting-row">
                <label>Max Tool Iterations:</label>
                <input type="number" id="abb-maxIterations" value="${status.askBigBrother.maxIterations}" min="1" max="20" onchange="updateAskBigBrother()">
            </div>
            <div class="setting-row">
                <label>Enable Tools by Default:</label>
                <select id="abb-enableToolsByDefault" onchange="updateAskBigBrother()">
                    <option value="true" ${status.askBigBrother.enableToolsByDefault ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.askBigBrother.enableToolsByDefault ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Summarization Enabled:</label>
                <select id="abb-summarizationEnabled" onchange="updateAskBigBrother()">
                    <option value="true" ${status.askBigBrother.summarizationEnabled ? 'selected' : ''}>Yes</option>
                    <option value="false" ${!status.askBigBrother.summarizationEnabled ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="setting-row">
                <label>Max Response Chars:</label>
                <input type="number" id="abb-maxResponseChars" value="${status.askBigBrother.maxResponseChars}" onchange="updateAskBigBrother()">
            </div>
            <div class="setting-row">
                <label>Summarization Model:</label>
                <input type="text" id="abb-summarizationModel" value="${status.askBigBrother.summarizationModel || ''}" onchange="updateAskBigBrother()">
            </div>
            <p class="info-text">Uses VS Code LM API for direct model queries with tool support.</p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function startCliServer() { vscode.postMessage({ type: 'startCliServer' }); }
        function stopCliServer() { vscode.postMessage({ type: 'stopCliServer' }); }
        function restartBridge() { vscode.postMessage({ type: 'restartBridge' }); }
        function switchProfile(profile) { vscode.postMessage({ type: 'switchProfile', profile }); }
        function switchToProfile(profile) { 
            document.getElementById('bridgeProfile').value = profile;
            vscode.postMessage({ type: 'switchProfile', profile }); 
        }
        function setTrail(enabled) { vscode.postMessage({ type: 'setTrail', enabled }); }
        function startTelegram() { vscode.postMessage({ type: 'telegramToggle' }); }
        function stopTelegram() { vscode.postMessage({ type: 'telegramToggle' }); }
        function testTelegram() { vscode.postMessage({ type: 'telegramTest' }); }
        
        function toggleSection(id) {
            const content = document.getElementById(id + '-content');
            const header = content.previousElementSibling;
            header.classList.toggle('collapsed');
        }
        
        function updateLocalLlm() {
            vscode.postMessage({ 
                type: 'updateLocalLlm',
                settings: {
                    ollamaUrl: document.getElementById('llm-ollamaUrl').value,
                    model: document.getElementById('llm-model').value,
                    temperature: parseFloat(document.getElementById('llm-temperature').value),
                    stripThinkingTags: document.getElementById('llm-stripThinkingTags').value === 'true',
                    expansionProfile: document.getElementById('llm-expansionProfile').value,
                    toolsEnabled: document.getElementById('llm-toolsEnabled').value === 'true',
                    trailMaximumTokens: parseInt(document.getElementById('llm-trailMaximumTokens').value),
                    trailSummarizationTemperature: parseFloat(document.getElementById('llm-trailSummarizationTemperature').value),
                    removePromptTemplateFromTrail: document.getElementById('llm-removePromptTemplateFromTrail').value === 'true'
                }
            });
        }
        
        function updateAiConversation() {
            vscode.postMessage({ 
                type: 'updateAiConversation',
                settings: {
                    maxTurns: parseInt(document.getElementById('conv-maxTurns').value),
                    temperature: parseFloat(document.getElementById('conv-temperature').value),
                    historyMode: document.getElementById('conv-historyMode').value,
                    conversationMode: document.getElementById('conv-conversationMode').value,
                    toolsEnabled: document.getElementById('conv-toolsEnabled').value === 'true',
                    trailMaximumTokens: parseInt(document.getElementById('conv-trailMaximumTokens').value),
                    trailSummarizationTemperature: parseFloat(document.getElementById('conv-trailSummarizationTemperature').value),
                    removePromptTemplateFromTrail: document.getElementById('conv-removePromptTemplateFromTrail').value === 'true'
                }
            });
        }
        
        function updateTelegram() {
            vscode.postMessage({ 
                type: 'updateTelegram',
                settings: {
                    enabled: document.getElementById('tg-enabled').value === 'true',
                    botTokenEnv: document.getElementById('tg-botTokenEnv').value,
                    defaultChatId: parseInt(document.getElementById('tg-defaultChatId').value),
                    pollIntervalMs: parseInt(document.getElementById('tg-pollIntervalMs').value),
                    notifyOnStart: document.getElementById('tg-notifyOnStart').value === 'true',
                    notifyOnTurn: document.getElementById('tg-notifyOnTurn').value === 'true',
                    notifyOnEnd: document.getElementById('tg-notifyOnEnd').value === 'true'
                }
            });
        }
        
        function updateAskCopilot() {
            vscode.postMessage({ 
                type: 'updateAskCopilot',
                settings: {
                    enabled: document.getElementById('ac-enabled').value === 'true',
                    answerFileTimeout: parseInt(document.getElementById('ac-answerFileTimeout').value),
                    pollInterval: parseInt(document.getElementById('ac-pollInterval').value),
                    answerFolder: document.getElementById('ac-answerFolder').value,
                    promptPrefix: document.getElementById('ac-promptPrefix').value,
                    promptSuffix: document.getElementById('ac-promptSuffix').value
                }
            });
        }
        
        function updateAskBigBrother() {
            vscode.postMessage({ 
                type: 'updateAskBigBrother',
                settings: {
                    enabled: document.getElementById('abb-enabled').value === 'true',
                    defaultModel: document.getElementById('abb-defaultModel').value,
                    temperature: parseFloat(document.getElementById('abb-temperature').value),
                    maxIterations: parseInt(document.getElementById('abb-maxIterations').value),
                    enableToolsByDefault: document.getElementById('abb-enableToolsByDefault').value === 'true',
                    summarizationEnabled: document.getElementById('abb-summarizationEnabled').value === 'true',
                    maxResponseChars: parseInt(document.getElementById('abb-maxResponseChars').value),
                    summarizationModel: document.getElementById('abb-summarizationModel').value
                }
            });
        }
    </script>
</body></html>`;
}

/**
 * Show the status page webview panel
 */
export async function showStatusPageHandler(): Promise<void> {
    if (statusPanel) {
        statusPanel.reveal();
        await refreshStatusPage();
        return;
    }
    
    statusPanel = vscode.window.createWebviewPanel(
        'tomStatusPage',
        'Tom Extension Status',
        vscode.ViewColumn.Active,
        { enableScripts: true }
    );
    
    // Gather initial status and render
    const status = await gatherStatusData();
    statusPanel.webview.html = getStatusPageHtml(status);
    
    // Handle messages from the webview
    statusPanel.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
            case 'startCliServer':
                await vscode.commands.executeCommand('dartscript.startCliServer');
                break;
            case 'stopCliServer':
                await vscode.commands.executeCommand('dartscript.stopCliServer');
                break;
            case 'restartBridge':
                await vscode.commands.executeCommand('dartscript.restartBridge');
                break;
            case 'switchProfile':
                await vscode.commands.executeCommand('dartscript.switchBridgeProfile', msg.profile);
                break;
            case 'setTrail':
                await setTrailEnabled(msg.enabled);
                break;
            case 'telegramToggle':
                await vscode.commands.executeCommand('dartscript.telegramToggle');
                break;
            case 'telegramTest':
                await vscode.commands.executeCommand('dartscript.telegramTest');
                break;
            case 'updateLocalLlm':
                await updateLocalLlmSettings(msg.settings);
                break;
            case 'updateAiConversation':
                await updateAiConversationSettings(msg.settings);
                break;
            case 'updateTelegram':
                await updateTelegramSettings(msg.settings);
                break;
            case 'updateAskCopilot':
                await updateAskCopilotSettings(msg.settings);
                break;
            case 'updateAskBigBrother':
                await updateAskBigBrotherSettings(msg.settings);
                break;
        }
        
        // Refresh the status page after any action
        setTimeout(refreshStatusPage, 500);
    });
    
    statusPanel.onDidDispose(() => {
        statusPanel = undefined;
    });
}

/**
 * Refresh the status page with current data
 */
async function refreshStatusPage(): Promise<void> {
    if (!statusPanel) { return; }
    const status = await gatherStatusData();
    statusPanel.webview.html = getStatusPageHtml(status);
}

/**
 * Toggle trail and show notification
 */
export async function toggleTrailHandler(): Promise<void> {
    await toggleTrail();
}
