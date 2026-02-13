/**
 * Unified Prompt Template Processing
 *
 * Central module for placeholder expansion and template processing across all
 * handler flows. Supports two syntaxes:
 *
 *   {{name}}  – Mustache-style (legacy, still fully supported)
 *   ${name}   – Dollar-brace style (preferred)
 *
 * Built-in placeholders are resolved automatically.  Callers may pass extra
 * key/value pairs via `PromptTemplateOptions.values` for domain-specific
 * variables like `${originalPrompt}`, `${response}`, `${goal}`, etc.
 *
 * Backward compatibility: `${dartscript.X}` resolves identically to `${X}`.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getChatResponseValues } from './handler_shared';

// ============================================================================
// Public types
// ============================================================================

export interface PromptTemplateOptions {
    /** Additional caller-specific values to expand (e.g. originalPrompt, response). */
    values?: Record<string, string>;
    /**
     * If true, resolve editor-dependent placeholders (selection, file, filecontent, …).
     * Defaults to true.
     */
    includeEditorContext?: boolean;
    /**
     * Maximum depth for recursive resolution.  0 = single pass (default).
     */
    maxDepth?: number;
}

// ============================================================================
// Utility functions (exported for reuse)
// ============================================================================

/**
 * Format a Date as `YYYYMMDD_HHMMSS`.
 */
export function formatDateTime(date: Date = new Date()): string {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d  = String(date.getDate()).padStart(2, '0');
    const h  = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s  = String(date.getSeconds()).padStart(2, '0');
    return `${y}${mo}${d}_${h}${mi}${s}`;
}

/**
 * Get the chat answer folder from VS Code settings.
 */
export function getChatAnswerFolder(): string {
    const setting = vscode.workspace
        .getConfiguration('dartscript.sendToChat')
        .get<string>('chatAnswerFolder');
    return setting || '_ai/chat_replies';
}

/**
 * Resolve a dot-separated path against a nested data object.
 * Returns the stringified value, or undefined if not found.
 */
export function resolveDotPath(
    data: Record<string, any>,
    dotPath: string,
): string | undefined {
    const parts = dotPath.split('.');
    let value: any = data;
    for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
            value = value[part];
        } else {
            return undefined;
        }
    }
    if (typeof value === 'string') { return value; }
    if (value !== null && value !== undefined) { return JSON.stringify(value); }
    return undefined;
}

// ============================================================================
// Core expansion
// ============================================================================

/**
 * Build the map of built-in placeholder values (non-async, non-editor).
 * Chat response values are included under the `chat.*` namespace.
 */
function buildBuiltinValues(): Record<string, string> {
    const now = new Date();
    const requestId = formatDateTime(now);
    const wf = vscode.workspace.workspaceFolders?.[0];

    const values: Record<string, string> = {
        datetime:        requestId,
        requestId:       requestId,
        windowId:        vscode.env.sessionId,
        machineId:       vscode.env.machineId,
        chatAnswerFolder: getChatAnswerFolder(),
        workspace:       wf?.name || '(no workspace)',
        workspacepath:   wf?.uri.fsPath || '(no workspace)',
        date:            now.toLocaleDateString(),
        time:            now.toLocaleTimeString(),
    };

    // Flatten chat response values as chat.KEY
    const chatVals = getChatResponseValues();
    for (const [k, v] of Object.entries(chatVals)) {
        const str = typeof v === 'string' ? v : (v !== null && v !== undefined ? JSON.stringify(v) : '');
        values[`chat.${k}`] = str;
    }

    return values;
}

/**
 * Add editor-dependent values to the map.
 */
function addEditorValues(values: Record<string, string>): void {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        const doc = editor.document;
        const wf  = vscode.workspace.workspaceFolders?.[0];
        const sel = doc.getText(editor.selection);

        values['selection']    = sel || '(no selection)';
        values['file']         = wf
            ? path.relative(wf.uri.fsPath, doc.uri.fsPath)
            : doc.uri.fsPath;
        values['filename']     = path.basename(doc.uri.fsPath);
        values['filecontent']  = doc.getText();
        values['language']     = doc.languageId;
        values['line']         = String(editor.selection.active.line + 1);
        values['column']       = String(editor.selection.active.character + 1);
    } else {
        values['selection']   = '(no editor)';
        values['file']        = '(no file)';
        values['filename']    = '(no file)';
        values['filecontent'] = '(no file)';
        values['language']    = '(no file)';
        values['line']        = '(no editor)';
        values['column']      = '(no editor)';
    }
}

/**
 * Add async values (clipboard) to the map.
 */
async function addAsyncValues(values: Record<string, string>): Promise<void> {
    try {
        const clip = await vscode.env.clipboard.readText();
        values['clipboard'] = clip || '(empty clipboard)';
    } catch {
        values['clipboard'] = '(clipboard error)';
    }
}

/**
 * Perform a single resolution pass over `text`, replacing both `{{key}}` and
 * `${key}` patterns from the supplied values map.
 *
 * Also handles the legacy `${dartscript.X}` prefix — it strips the prefix and
 * looks up `X` in the values map.
 */
function resolvePass(text: string, values: Record<string, string>): string {
    // 1. Replace {{key}} patterns (case-insensitive)
    let result = text.replace(/\{\{(\w+)\}\}/gi, (match, key: string) => {
        const lk = key.toLowerCase();
        // Look up case-insensitive
        for (const [k, v] of Object.entries(values)) {
            if (k.toLowerCase() === lk) { return v; }
        }
        return match; // keep unresolved
    });

    // 2. Replace ${key} patterns (including dot paths like ${chat.foo})
    //    Also handles legacy ${dartscript.X} → resolves X
    result = result.replace(/\$\{([^}]+)\}/g, (match, rawKey: string) => {
        let key = rawKey;
        // Strip legacy dartscript. prefix
        if (key.startsWith('dartscript.')) {
            key = key.substring('dartscript.'.length);
        }

        // Direct lookup
        if (key in values) {
            return values[key];
        }

        // Dot-path lookup (e.g. chat.someKey where values has chat.someKey)
        // Already handled by direct lookup above since we flatten chat.* keys.

        return match; // keep unresolved
    });

    return result;
}

/**
 * Expand all placeholders in a template string.
 *
 * **Supported placeholders** (both `{{name}}` and `${name}` syntax):
 *
 * | Placeholder | Description |
 * |-------------|-------------|
 * | `selection` | Current editor selection |
 * | `file` | Current file path (relative) |
 * | `filename` | Current file name |
 * | `filecontent` | Full file content |
 * | `clipboard` | Clipboard contents |
 * | `date` / `time` | Locale date / time |
 * | `datetime` | Locale date+time |
 * | `requestId` | Timestamp ID (YYYYMMDD_HHMMSS) |
 * | `workspace` | Workspace name |
 * | `workspacepath` | Workspace root path |
 * | `language` | File language ID |
 * | `line` / `column` | Cursor position (1-based) |
 * | `windowId` | VS Code session ID |
 * | `machineId` | VS Code machine ID |
 * | `chatAnswerFolder` | Answer folder from settings |
 * | `chat.KEY` | Value from chat response store |
 *
 * Caller-provided values in `options.values` override built-ins.
 * The legacy `${dartscript.X}` prefix is transparently mapped to `${X}`.
 */
export async function expandTemplate(
    template: string,
    options?: PromptTemplateOptions,
): Promise<string> {
    // Build the values map
    const values = buildBuiltinValues();

    const includeEditor = options?.includeEditorContext !== false;
    if (includeEditor) {
        addEditorValues(values);
        await addAsyncValues(values);
    }

    // Merge caller-provided values (override built-ins)
    if (options?.values) {
        Object.assign(values, options.values);
    }

    // Resolve (potentially recursive)
    const maxDepth = Math.max(1, (options?.maxDepth ?? 0) + 1);
    let result = template;
    let prev = '';
    for (let i = 0; i < maxDepth && result !== prev; i++) {
        prev = result;
        result = resolvePass(result, values);
    }

    return result;
}

/**
 * Synchronous placeholder resolution for callers that already have a
 * complete values map (no editor/clipboard lookups needed).
 * Supports both {{key}} and ${key} syntaxes plus ${dartscript.X} compat.
 */
export function resolveTemplate(
    template: string,
    values: Record<string, string>,
    maxDepth: number = 1,
): string {
    let result = template;
    let prev = '';
    for (let i = 0; i < maxDepth && result !== prev; i++) {
        prev = result;
        result = resolvePass(result, values);
    }
    return result;
}

// ============================================================================
// Placeholder help text
// ============================================================================

/** HTML help text listing all available placeholders (for template editors). */
export const PLACEHOLDER_HELP = `<strong>Available Placeholders:</strong><br>
<code>\${selection}</code> – Current text selection<br>
<code>\${file}</code> – Current file path (relative)<br>
<code>\${filename}</code> – Current file name<br>
<code>\${filecontent}</code> – Full file content<br>
<code>\${clipboard}</code> – Clipboard contents<br>
<code>\${date}</code> / <code>\${time}</code> – Current date / time<br>
<code>\${requestId}</code> – Timestamp-based ID (YYYYMMDD_HHMMSS)<br>
<code>\${workspace}</code> – Workspace name<br>
<code>\${workspacepath}</code> – Workspace root path<br>
<code>\${language}</code> – File language ID<br>
<code>\${line}</code> / <code>\${column}</code> – Cursor position (1-based)<br>
<code>\${windowId}</code> – VS Code session ID<br>
<code>\${machineId}</code> – VS Code machine ID<br>
<code>\${chatAnswerFolder}</code> – Answer folder path<br>
<code>\${chat.KEY}</code> – Value from copilot response store<br>
<br><em>Legacy <code>\${dartscript.X}</code> syntax is also supported and resolves to <code>\${X}</code>.</em><br>
<em>Mustache syntax <code>{{name}}</code> is also supported for all placeholders.</em>`;
