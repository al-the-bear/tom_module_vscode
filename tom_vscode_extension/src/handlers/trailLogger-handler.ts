/**
 * Trail Logger - Comprehensive logging of AI interactions
 * 
 * Writes timestamped files to configurable trail folders for debugging
 * and audit purposes. Each new prompt/conversation clears the trail.
 * 
 * Trail folders:
 *   - _ai/local/trail/     - Local LLM interactions
 *   - _ai/conversation/trail/ - Bot conversation interactions
 *   - _ai/tomai/trail/     - Tom AI chat interactions  
 *   - _ai/copilot/trail/   - Copilot interactions
 * 
 * File naming pattern:
 *   <timestamp>_<type>_<direction>.md|.json
 *   
 * Examples:
 *   20260212_143052_001_prompt_to_local.md
 *   20260212_143055_002_response_toolrequest_from_local.json
 *   20260212_143056_003_tool_call_read_file.json
 *   20260212_143057_004_tool_result.json
 *   20260212_143100_005_prompt_continuation_to_local.md
 *   20260212_143105_006_response_final_from_local.md
 *   20260212_143110_001_prompt_to_copilot.md
 *   20260212_143200_002_answerfile_from_copilot.json
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfigPath } from './handler_shared';

// Trail types
export type TrailType = 'local' | 'conversation' | 'tomai' | 'copilot';

// Sequence counters per trail type (reset on clear)
const sequenceCounters: Record<TrailType, number> = {
    local: 0,
    conversation: 0,
    tomai: 0,
    copilot: 0
};

// Trail enabled flags (loaded from config)
let trailConfig: {
    enabled: boolean;
    paths: Record<TrailType, string>;
} = {
    enabled: false,
    paths: {
        local: '_ai/local/trail',
        conversation: '_ai/conversation/trail',
        tomai: '_ai/tomai/trail',
        copilot: '_ai/copilot/trail'
    }
};

/**
 * Load trail configuration from send_to_chat.json
 */
export function loadTrailConfig(): void {
    try {
        const configPath = getConfigPath();
        if (!configPath || !fs.existsSync(configPath)) {
            return;
        }
        
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const trail = config?.trail;
        
        if (trail) {
            trailConfig.enabled = trail.enabled === true;
            if (trail.paths) {
                if (trail.paths.local) { trailConfig.paths.local = trail.paths.local; }
                if (trail.paths.conversation) { trailConfig.paths.conversation = trail.paths.conversation; }
                if (trail.paths.tomai) { trailConfig.paths.tomai = trail.paths.tomai; }
                if (trail.paths.copilot) { trailConfig.paths.copilot = trail.paths.copilot; }
            }
        }
    } catch (e) {
        console.error('[TrailLogger] Failed to load config:', e);
    }
}

/**
 * Check if trail logging is enabled
 */
export function isTrailEnabled(): boolean {
    loadTrailConfig();
    return trailConfig.enabled;
}

/**
 * Get the full trail folder path for a type
 */
function getTrailFolder(type: TrailType): string | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return null;
    }
    
    return path.join(workspaceFolder.uri.fsPath, trailConfig.paths[type]);
}

/**
 * Generate timestamp string for filenames (YYYYMMDD_HHMMSS)
 */
function getTimestamp(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${h}${min}${s}`;
}

/**
 * Get next sequence number for a trail type
 */
function getNextSequence(type: TrailType): string {
    sequenceCounters[type]++;
    return String(sequenceCounters[type]).padStart(3, '0');
}

/**
 * Clear trail folder for a new session
 */
export function clearTrail(type: TrailType): void {
    if (!isTrailEnabled()) {
        return;
    }
    
    const folder = getTrailFolder(type);
    if (!folder) {
        return;
    }
    
    try {
        if (fs.existsSync(folder)) {
            // Remove all files in the folder
            const files = fs.readdirSync(folder);
            for (const file of files) {
                const filePath = path.join(folder, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            }
        } else {
            // Create the folder
            fs.mkdirSync(folder, { recursive: true });
        }
        
        // Reset sequence counter
        sequenceCounters[type] = 0;
        
        console.log(`[TrailLogger] Cleared trail for ${type}`);
    } catch (e) {
        console.error(`[TrailLogger] Failed to clear trail for ${type}:`, e);
    }
}

/**
 * Write a trail file
 */
export function writeTrailFile(
    type: TrailType,
    filename: string,
    content: string,
    isJson: boolean = false
): string | null {
    if (!isTrailEnabled()) {
        return null;
    }
    
    const folder = getTrailFolder(type);
    if (!folder) {
        return null;
    }
    
    try {
        // Ensure folder exists
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
        
        const timestamp = getTimestamp();
        const seq = getNextSequence(type);
        const ext = isJson ? '.json' : '.md';
        const fullFilename = `${timestamp}_${seq}_${filename}${ext}`;
        const filePath = path.join(folder, fullFilename);
        
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`[TrailLogger] Wrote ${fullFilename}`);
        
        return filePath;
    } catch (e) {
        console.error(`[TrailLogger] Failed to write trail file:`, e);
        return null;
    }
}

// ============================================================================
// Convenience functions for specific file types
// ============================================================================

/**
 * Log a prompt being sent to an AI
 */
export function logPrompt(
    type: TrailType,
    target: string,
    prompt: string,
    systemPrompt?: string,
    metadata?: Record<string, unknown>
): void {
    let content = `# Prompt to ${target}\n\n`;
    
    if (metadata) {
        content += `## Metadata\n\n\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\`\n\n`;
    }
    
    if (systemPrompt) {
        content += `## System Prompt\n\n${systemPrompt}\n\n`;
    }
    
    content += `## User Prompt\n\n${prompt}\n`;
    
    writeTrailFile(type, `prompt_to_${target.toLowerCase().replace(/\s+/g, '_')}`, content);
}

/**
 * Log a response received from an AI
 */
export function logResponse(
    type: TrailType,
    source: string,
    response: string,
    isFinal: boolean = true,
    metadata?: Record<string, unknown>
): void {
    const qualifier = isFinal ? 'final' : 'partial';
    let content = `# Response from ${source} (${qualifier})\n\n`;
    
    if (metadata) {
        content += `## Metadata\n\n\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\`\n\n`;
    }
    
    content += `## Response\n\n${response}\n`;
    
    writeTrailFile(type, `response_${qualifier}_from_${source.toLowerCase().replace(/\s+/g, '_')}`, content);
}

/**
 * Log a tool request from the AI
 */
export function logToolRequest(
    type: TrailType,
    toolName: string,
    args: Record<string, unknown>
): void {
    const content = JSON.stringify({
        type: 'tool_request',
        tool: toolName,
        arguments: args,
        timestamp: new Date().toISOString()
    }, null, 2);
    
    writeTrailFile(type, `toolrequest_${toolName.toLowerCase().replace(/\s+/g, '_')}`, content, true);
}

/**
 * Log a tool result being sent back
 */
export function logToolResult(
    type: TrailType,
    toolName: string,
    result: string,
    error?: string
): void {
    const content = JSON.stringify({
        type: 'tool_result',
        tool: toolName,
        result: result,
        error: error || null,
        timestamp: new Date().toISOString()
    }, null, 2);
    
    writeTrailFile(type, `toolresult_${toolName.toLowerCase().replace(/\s+/g, '_')}`, content, true);
}

/**
 * Log a continuation prompt (after tool results)
 */
export function logContinuationPrompt(
    type: TrailType,
    target: string,
    messages: unknown[]
): void {
    let content = `# Continuation to ${target}\n\n`;
    content += `## Messages\n\n\`\`\`json\n${JSON.stringify(messages, null, 2)}\n\`\`\`\n`;
    
    writeTrailFile(type, `continuation_to_${target.toLowerCase().replace(/\s+/g, '_')}`, content);
}

/**
 * Log Copilot answer file content
 */
export function logCopilotAnswer(
    answerFilePath: string,
    content: unknown
): void {
    const jsonContent = JSON.stringify({
        type: 'copilot_answer',
        answerFile: answerFilePath,
        content: content,
        timestamp: new Date().toISOString()
    }, null, 2);
    
    writeTrailFile('copilot', 'answerfile_from_copilot', jsonContent, true);
}

/**
 * Log raw API request/response for debugging
 */
export function logRawApiCall(
    type: TrailType,
    direction: 'request' | 'response',
    endpoint: string,
    data: unknown
): void {
    const content = JSON.stringify({
        type: `raw_${direction}`,
        endpoint: endpoint,
        data: data,
        timestamp: new Date().toISOString()
    }, null, 2);
    
    writeTrailFile(type, `raw_${direction}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`, content, true);
}

/**
 * Open the trail folder in VS Code
 */
export async function openTrailFolder(type: TrailType): Promise<void> {
    const folder = getTrailFolder(type);
    if (!folder) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
    }
    
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
    
    const uri = vscode.Uri.file(folder);
    await vscode.commands.executeCommand('revealInExplorer', uri);
}
