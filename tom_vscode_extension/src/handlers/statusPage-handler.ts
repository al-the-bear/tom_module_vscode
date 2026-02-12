/**
 * Status Page Handler
 * 
 * Custom webview panel for extension configuration and status control.
 * Shows toggle controls for:
 * - Tom CLI Integration Server (Start/Stop)
 * - Tom Bridge (Restart, Switch Profile)
 * - AI Trail (On/Off)
 * - Telegram Polling (Start/Stop)
 */

import * as vscode from 'vscode';
import { getBridgeClient } from './handler_shared';
import { getCliServerStatus } from './cliServer-handler';
import { loadBridgeConfig, BridgeConfig } from './restartBridge-handler';
import { isTrailEnabled, setTrailEnabled, loadTrailConfig, toggleTrail } from './trailLogger-handler';
import { isTelegramPollingActive } from './telegram-commands';

let statusPanel: vscode.WebviewPanel | undefined;

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
    };
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
        },
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
    select {
        padding: 8px 12px;
        border: 1px solid var(--vscode-input-border);
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border-radius: 4px;
        font-size: 13px;
        min-width: 150px;
    }
    select:focus {
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
        <div class="section-header">
            <h2>📱 Telegram Polling</h2>
            <span class="status-badge ${status.telegram.polling ? 'status-running' : 'status-stopped'}">${status.telegram.polling ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="controls">
            <button class="${status.telegram.polling ? 'secondary' : 'primary'}" onclick="startTelegram()">Start</button>
            <button class="${status.telegram.polling ? 'primary' : 'secondary'}" onclick="stopTelegram()">Stop</button>
            <button class="secondary" onclick="testTelegram()">Test Connection</button>
        </div>
        <p class="info-text">Polls for Telegram commands to control VS Code remotely.</p>
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
