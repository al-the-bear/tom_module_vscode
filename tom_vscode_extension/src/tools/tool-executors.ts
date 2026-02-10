/**
 * Shared tool executors + SharedToolDefinition instances.
 *
 * Each tool is defined *once* here and consumed by:
 *   - tomAiChat-tools.ts  → VS Code LM registration
 *   - expandPrompt-handler.ts → Ollama tool-call loop
 *
 * All executors return a plain string result.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SharedToolDefinition } from './shared-tool-registry';
import { TodoManager, TodoOperationResult } from '../managers/todoManager';

const execAsync = promisify(exec);

// ============================================================================
// Helpers
// ============================================================================

function getWorkspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
}

function resolvePath(filePath: string): string {
    const root = getWorkspaceRoot();
    if (path.isAbsolute(filePath)) { return filePath; }
    return path.join(root, filePath);
}

/** Guard against path-traversal outside workspace. */
function isInsideWorkspace(resolvedPath: string): boolean {
    const root = getWorkspaceRoot();
    if (!root) { return true; } // no workspace → allow anything
    const rel = path.relative(root, resolvedPath);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
}

// ============================================================================
// READ-ONLY executors
// ============================================================================

// --- read_file ---------------------------------------------------------------

export interface ReadFileInput {
    filePath: string;
    startLine?: number;
    endLine?: number;
}

async function executeReadFile(input: ReadFileInput): Promise<string> {
    const resolved = resolvePath(input.filePath);
    if (!isInsideWorkspace(resolved)) {
        return `Error: path is outside workspace.`;
    }
    if (!fs.existsSync(resolved)) {
        return `File not found: ${resolved}`;
    }
    const content = fs.readFileSync(resolved, 'utf8');
    const lines = content.split('\n');
    const start = (input.startLine ?? 1) - 1;
    const end = input.endLine ?? lines.length;
    return lines.slice(start, end).join('\n');
}

export const READ_FILE_TOOL: SharedToolDefinition<ReadFileInput> = {
    name: 'tom_readFile',
    displayName: 'Read File',
    description: 'Read the contents of a file. Optionally specify line range.',
    tags: ['files', 'tom-ai-chat'],
    readOnly: true,
    inputSchema: {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'Path to the file to read (relative to workspace root or absolute).' },
            startLine: { type: 'number', description: 'Optional 1-based start line number.' },
            endLine: { type: 'number', description: 'Optional 1-based end line number.' },
        },
        required: ['filePath'],
    },
    execute: executeReadFile,
};

// --- list_directory ----------------------------------------------------------

export interface ListDirectoryInput { dirPath: string }

async function executeListDirectory(input: ListDirectoryInput): Promise<string> {
    const resolved = resolvePath(input.dirPath);
    if (!isInsideWorkspace(resolved)) {
        return `Error: path is outside workspace.`;
    }
    if (!fs.existsSync(resolved)) {
        return `Directory not found: ${resolved}`;
    }
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return entries.map(e => `${e.name}${e.isDirectory() ? '/' : ''}`).join('\n');
}

export const LIST_DIRECTORY_TOOL: SharedToolDefinition<ListDirectoryInput> = {
    name: 'tom_listDirectory',
    displayName: 'List Directory',
    description: 'List the contents of a directory. Directories have a trailing slash.',
    tags: ['files', 'tom-ai-chat'],
    readOnly: true,
    inputSchema: {
        type: 'object',
        properties: {
            dirPath: { type: 'string', description: 'Path to the directory to list.' },
        },
        required: ['dirPath'],
    },
    execute: executeListDirectory,
};

// --- find_files --------------------------------------------------------------

export interface FindFilesInput { pattern: string; maxResults?: number }

async function executeFindFiles(input: FindFilesInput): Promise<string> {
    const limit = input.maxResults ?? 100;
    try {
        const files = await vscode.workspace.findFiles(input.pattern, '**/node_modules/**', limit);
        const paths = files.map(f => vscode.workspace.asRelativePath(f));
        return paths.length > 0 ? paths.join('\n') : `No files found matching: ${input.pattern}`;
    } catch (error) {
        return `Error finding files: ${error}`;
    }
}

export const FIND_FILES_TOOL: SharedToolDefinition<FindFilesInput> = {
    name: 'tom_findFiles',
    displayName: 'Find Files',
    description: 'Find files matching a glob pattern in the workspace.',
    tags: ['files', 'search', 'tom-ai-chat'],
    readOnly: true,
    inputSchema: {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: "Glob pattern to match files, e.g. '**/*.ts' or 'src/**/*.dart'" },
            maxResults: { type: 'number', description: 'Maximum number of results to return. Default 100.' },
        },
        required: ['pattern'],
    },
    execute: executeFindFiles,
};

// --- find_text_in_files ------------------------------------------------------

export interface FindTextInFilesInput {
    searchText: string;
    filePattern?: string;
    isRegex?: boolean;
    maxResults?: number;
}

async function executeFindTextInFiles(input: FindTextInFilesInput): Promise<string> {
    const workspaceRoot = getWorkspaceRoot();
    const limit = input.maxResults ?? 50;
    const grepPattern = input.isRegex ? input.searchText : input.searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const includePattern = input.filePattern ?? '*';
    try {
        const { stdout } = await execAsync(
            `grep -rn --include="${includePattern}" -E "${grepPattern}" . 2>/dev/null | head -${limit}`,
            { cwd: workspaceRoot, maxBuffer: 1024 * 1024 },
        );
        return stdout.trim() || `No matches found for: ${input.searchText}`;
    } catch (error: any) {
        if (error.code === 1) { return `No matches found for: ${input.searchText}`; }
        return `Error searching: ${error.message}`;
    }
}

export const FIND_TEXT_IN_FILES_TOOL: SharedToolDefinition<FindTextInFilesInput> = {
    name: 'tom_findTextInFiles',
    displayName: 'Find Text in Files',
    description: 'Search for text in files using grep. Returns matching lines with file paths and line numbers.',
    tags: ['files', 'search', 'tom-ai-chat'],
    readOnly: true,
    inputSchema: {
        type: 'object',
        properties: {
            searchText: { type: 'string', description: 'The text or regex pattern to search for.' },
            filePattern: { type: 'string', description: "Optional glob pattern to filter files, e.g. '*.dart'" },
            isRegex: { type: 'boolean', description: 'Whether searchText is a regex pattern. Default false.' },
            maxResults: { type: 'number', description: 'Maximum number of matching lines to return. Default 50.' },
        },
        required: ['searchText'],
    },
    execute: executeFindTextInFiles,
};

// --- fetch_webpage -----------------------------------------------------------

export interface FetchWebpageInput { url: string }

async function executeFetchWebpage(input: FetchWebpageInput): Promise<string> {
    try {
        const { stdout } = await execAsync(
            `curl -sL --max-time 15 "${input.url}" | head -c 50000`,
            { maxBuffer: 1024 * 1024 },
        );
        return stdout || '(empty response)';
    } catch (error: any) {
        return `Error fetching URL: ${error.message}`;
    }
}

export const FETCH_WEBPAGE_TOOL: SharedToolDefinition<FetchWebpageInput> = {
    name: 'tom_fetchWebpage',
    displayName: 'Fetch Webpage',
    description: 'Fetch the content of a URL. Returns the raw HTML. Useful for reading documentation or web resources.',
    tags: ['web', 'tom-ai-chat'],
    readOnly: true,
    inputSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The URL to fetch.' },
        },
        required: ['url'],
    },
    execute: executeFetchWebpage,
};

// --- web_search (new) --------------------------------------------------------

export interface WebSearchInput { query: string; maxResults?: number }

/**
 * Web search via DuckDuckGo Lite. No API key required.
 * Parses the HTML result page and extracts titles + URLs.
 */
async function executeWebSearch(input: WebSearchInput): Promise<string> {
    const maxResults = input.maxResults ?? 8;

    return new Promise<string>((resolve) => {
        const postData = `q=${encodeURIComponent(input.query)}`;

        const req = https.request(
            {
                hostname: 'lite.duckduckgo.com',
                path: '/lite/',
                method: 'POST',
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Type': 'application/x-www-form-urlencoded',
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Length': Buffer.byteLength(postData),
                },
                timeout: 15000,
            },
            (res) => {
                let body = '';
                res.on('data', (c: Buffer) => { body += c.toString(); });
                res.on('end', () => {
                    try {
                        const results = parseDuckDuckGoLite(body, maxResults);
                        if (results.length === 0) {
                            resolve(`No results found for: ${input.query}`);
                        } else {
                            resolve(results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n\n'));
                        }
                    } catch {
                        resolve(`Error parsing search results for: ${input.query}`);
                    }
                });
                res.on('error', (e) => resolve(`Error: ${e.message}`));
            },
        );
        req.on('error', (e) => resolve(`Error: ${e.message}`));
        req.on('timeout', () => { req.destroy(); resolve('Error: search request timed out'); });
        req.write(postData);
        req.end();
    });
}

interface SearchResult { title: string; url: string; snippet: string }

/**
 * Parse DuckDuckGo Lite HTML response.
 * The lite page uses simple HTML tables with result links and snippets.
 */
function parseDuckDuckGoLite(html: string, max: number): SearchResult[] {
    const results: SearchResult[] = [];

    // DDG Lite puts results in table rows. Links are in <a> tags with class "result-link".
    // Snippets follow in nearby <td> with class "result-snippet".
    const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

    const links: { url: string; title: string }[] = [];
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null) {
        const url = m[1].trim();
        const title = m[2].replace(/<[^>]*>/g, '').trim();
        if (url && title) { links.push({ url, title }); }
    }

    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null) {
        snippets.push(m[1].replace(/<[^>]*>/g, '').trim());
    }

    for (let i = 0; i < Math.min(links.length, max); i++) {
        results.push({
            title: links[i].title,
            url: links[i].url,
            snippet: snippets[i] ?? '',
        });
    }

    return results;
}

export const WEB_SEARCH_TOOL: SharedToolDefinition<WebSearchInput> = {
    name: 'tom_webSearch',
    displayName: 'Web Search',
    description: 'Search the web using DuckDuckGo. Returns titles, URLs, and snippets of the top results. Use this to research topics, find documentation, or discover solutions.',
    tags: ['web', 'search', 'tom-ai-chat'],
    readOnly: true,
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The search query.' },
            maxResults: { type: 'number', description: 'Maximum number of results to return. Default 8.' },
        },
        required: ['query'],
    },
    execute: executeWebSearch,
};

// --- get_errors --------------------------------------------------------------

export interface GetErrorsInput { filePath?: string }

async function executeGetErrors(input: GetErrorsInput): Promise<string> {
    let diagnostics: [vscode.Uri, readonly vscode.Diagnostic[]][];
    if (input.filePath) {
        const resolved = resolvePath(input.filePath);
        const uri = vscode.Uri.file(resolved);
        diagnostics = [[uri, vscode.languages.getDiagnostics(uri)]];
    } else {
        diagnostics = vscode.languages.getDiagnostics();
    }
    const errors: string[] = [];
    for (const [uri, diags] of diagnostics) {
        for (const d of diags) {
            if (d.severity !== vscode.DiagnosticSeverity.Error && d.severity !== vscode.DiagnosticSeverity.Warning) { continue; }
            const sev = d.severity === vscode.DiagnosticSeverity.Error ? '❌' : '⚠️';
            errors.push(`${sev} ${vscode.workspace.asRelativePath(uri)}:${d.range.start.line + 1}: ${d.message}`);
        }
    }
    return errors.length > 0 ? errors.slice(0, 100).join('\n') : 'No errors or warnings found.';
}

export const GET_ERRORS_TOOL: SharedToolDefinition<GetErrorsInput> = {
    name: 'tom_getErrors',
    displayName: 'Get Errors',
    description: 'Get errors and warnings from VS Code diagnostics.',
    tags: ['diagnostics', 'tom-ai-chat'],
    readOnly: true,
    inputSchema: {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'Optional file path to get errors for. If not specified, returns all errors.' },
        },
    },
    execute: executeGetErrors,
};

// --- read_guideline ----------------------------------------------------------

export interface ReadGuidelineInput { fileName?: string }

async function executeReadGuideline(input: ReadGuidelineInput): Promise<string> {
    const workspaceRoot = getWorkspaceRoot();
    const guidelinesDir = path.join(workspaceRoot, '_copilot_guidelines');
    if (!fs.existsSync(guidelinesDir)) {
        return `Guidelines directory not found: ${guidelinesDir}`;
    }
    if (!input.fileName) {
        const files = fs.readdirSync(guidelinesDir).filter(f => f.endsWith('.md')).sort();
        let result = `Available guideline files in _copilot_guidelines/:\n\n`;
        result += files.map(f => `- ${f}`).join('\n');
        const indexPath = path.join(guidelinesDir, 'index.md');
        if (fs.existsSync(indexPath)) {
            result += '\n\n---\n\nindex.md content:\n\n';
            result += fs.readFileSync(indexPath, 'utf8');
        }
        return result;
    }
    const targetFile = input.fileName.endsWith('.md') ? input.fileName : `${input.fileName}.md`;
    const filePath = path.join(guidelinesDir, targetFile);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
    }
    // try subdirectories
    const subDirs = fs.readdirSync(guidelinesDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const sd of subDirs) {
        const subPath = path.join(guidelinesDir, sd.name, targetFile);
        if (fs.existsSync(subPath)) { return fs.readFileSync(subPath, 'utf8'); }
    }
    return `Guideline file not found: ${targetFile}`;
}

export const READ_GUIDELINE_TOOL: SharedToolDefinition<ReadGuidelineInput> = {
    name: 'tom_readGuideline',
    displayName: 'Read Guideline',
    description:
        'Read workspace Copilot guidelines from _copilot_guidelines/ folder. Without a fileName, returns the list of available files and the content of index.md (the main guideline index). Key guidelines: coding_guidelines.md (code structure, naming), documentation_guidelines.md (docs format), tests.md (test creation), project_structure.md (project patterns), bug_fixing.md (debugging workflow). Use this tool to understand workspace conventions before making changes.',
    tags: ['guidelines', 'tom-ai-chat'],
    readOnly: true,
    inputSchema: {
        type: 'object',
        properties: {
            fileName: {
                type: 'string',
                description: "Optional specific guideline file to read (e.g., 'coding_guidelines.md' or 'coding_guidelines'). If not specified, returns index.md with list of available files.",
            },
        },
    },
    execute: executeReadGuideline,
};

// ============================================================================
// WRITE executors (VS Code LM only — never sent to Ollama by default)
// ============================================================================

// --- create_file -------------------------------------------------------------

export interface CreateFileInput { filePath: string; content: string }

async function executeCreateFile(input: CreateFileInput): Promise<string> {
    const resolved = resolvePath(input.filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    fs.writeFileSync(resolved, input.content, 'utf8');
    return `Created file: ${resolved}`;
}

export const CREATE_FILE_TOOL: SharedToolDefinition<CreateFileInput> = {
    name: 'tom_createFile',
    displayName: 'Create File',
    description: 'Create a new file with the specified content. Creates parent directories if needed.',
    tags: ['files', 'tom-ai-chat'],
    readOnly: false,
    inputSchema: {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'The path to the file to create. Can be absolute or relative to workspace root.' },
            content: { type: 'string', description: 'The content to write to the file.' },
        },
        required: ['filePath', 'content'],
    },
    execute: executeCreateFile,
};

// --- edit_file ---------------------------------------------------------------

export interface EditFileInput { filePath: string; oldText: string; newText: string }

async function executeEditFile(input: EditFileInput): Promise<string> {
    const resolved = resolvePath(input.filePath);
    if (!fs.existsSync(resolved)) { return `File not found: ${resolved}`; }
    const content = fs.readFileSync(resolved, 'utf8');
    if (!content.includes(input.oldText)) { return 'Text not found in file. Make sure oldText matches exactly.'; }
    fs.writeFileSync(resolved, content.replace(input.oldText, input.newText), 'utf8');
    return `Edited file: ${resolved}`;
}

export const EDIT_FILE_TOOL: SharedToolDefinition<EditFileInput> = {
    name: 'tom_editFile',
    displayName: 'Edit File',
    description: 'Edit a file by replacing oldText with newText. The oldText must match exactly.',
    tags: ['files', 'tom-ai-chat'],
    readOnly: false,
    inputSchema: {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'The path to the file to edit.' },
            oldText: { type: 'string', description: 'The exact text to find and replace.' },
            newText: { type: 'string', description: 'The text to replace oldText with.' },
        },
        required: ['filePath', 'oldText', 'newText'],
    },
    execute: executeEditFile,
};

// --- multi_edit_file ---------------------------------------------------------

export interface MultiEditFileInput { edits: Array<{ filePath: string; oldText: string; newText: string }> }

async function executeMultiEditFile(input: MultiEditFileInput): Promise<string> {
    const results: string[] = [];
    for (const edit of input.edits) {
        const resolved = resolvePath(edit.filePath);
        if (!fs.existsSync(resolved)) { results.push(`❌ File not found: ${resolved}`); continue; }
        const content = fs.readFileSync(resolved, 'utf8');
        if (!content.includes(edit.oldText)) { results.push(`❌ Text not found in: ${resolved}`); continue; }
        fs.writeFileSync(resolved, content.replace(edit.oldText, edit.newText), 'utf8');
        results.push(`✅ Edited: ${resolved}`);
    }
    return results.join('\n');
}

export const MULTI_EDIT_FILE_TOOL: SharedToolDefinition<MultiEditFileInput> = {
    name: 'tom_multiEditFile',
    displayName: 'Multi Edit File',
    description: 'Apply multiple find/replace edits across one or more files.',
    tags: ['files', 'tom-ai-chat'],
    readOnly: false,
    inputSchema: {
        type: 'object',
        properties: {
            edits: {
                type: 'array', description: 'Array of edit operations to apply.',
                items: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string' },
                        oldText: { type: 'string' },
                        newText: { type: 'string' },
                    },
                    required: ['filePath', 'oldText', 'newText'],
                },
            },
        },
        required: ['edits'],
    },
    execute: executeMultiEditFile,
};

// --- run_command --------------------------------------------------------------

export interface RunCommandInput { command: string; cwd?: string }

async function executeRunCommand(input: RunCommandInput): Promise<string> {
    const cwd = input.cwd ? resolvePath(input.cwd) : getWorkspaceRoot();
    try {
        const { stdout, stderr } = await execAsync(input.command, { cwd, maxBuffer: 1024 * 1024 });
        return stdout || stderr || '(no output)';
    } catch (error: any) {
        return `Error: ${error.message}\n${error.stderr || ''}`;
    }
}

export const RUN_COMMAND_TOOL: SharedToolDefinition<RunCommandInput> = {
    name: 'tom_runCommand',
    displayName: 'Run Command',
    description: 'Run a shell command and return the output.',
    tags: ['terminal', 'tom-ai-chat'],
    readOnly: false,
    inputSchema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The shell command to run.' },
            cwd: { type: 'string', description: 'Optional working directory for the command.' },
        },
        required: ['command'],
    },
    execute: executeRunCommand,
};

// --- run_vscode_command ------------------------------------------------------

export interface RunVscodeCommandInput { command: string; args?: unknown[] }

async function executeRunVscodeCommand(input: RunVscodeCommandInput): Promise<string> {
    try {
        const result = await vscode.commands.executeCommand(input.command, ...(input.args ?? []));
        return `Command executed: ${input.command}\nResult: ${JSON.stringify(result) ?? '(no result)'}`;
    } catch (error) {
        return `Error executing command: ${error}`;
    }
}

export const RUN_VSCODE_COMMAND_TOOL: SharedToolDefinition<RunVscodeCommandInput> = {
    name: 'tom_runVscodeCommand',
    displayName: 'Run VS Code Command',
    description: 'Execute a VS Code command by ID.',
    tags: ['vscode', 'tom-ai-chat'],
    readOnly: false,
    inputSchema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The VS Code command ID to execute.' },
            args: { type: 'array', description: 'Optional arguments to pass to the command.', items: { type: 'string' } },
        },
        required: ['command'],
    },
    execute: executeRunVscodeCommand,
};

// ============================================================================
// Todo tool — needs special wiring for the active TodoManager
// ============================================================================

let activeTodoManager: TodoManager | null = null;

export function setActiveTodoManager(manager: TodoManager | null): void {
    activeTodoManager = manager;
}

export function getActiveTodoManager(): TodoManager | null {
    return activeTodoManager;
}

export interface ManageTodoInput {
    operation: 'list' | 'add' | 'update' | 'remove' | 'clear';
    id?: number;
    title?: string;
    description?: string;
    status?: 'not-started' | 'in-progress' | 'completed';
    filterStatus?: 'not-started' | 'in-progress' | 'completed';
}

async function executeManageTodo(input: ManageTodoInput): Promise<string> {
    const todoManager = activeTodoManager;
    if (!todoManager) {
        return 'Error: No active todo manager. This tool only works during Tom AI Chat sessions.';
    }
    let result: TodoOperationResult;
    switch (input.operation) {
        case 'list': result = todoManager.list(input.filterStatus); break;
        case 'add':
            if (!input.title) { return 'Error: "title" is required for add operation.'; }
            result = todoManager.add(input.title, input.description || '');
            break;
        case 'update':
            if (input.id === undefined) { return 'Error: "id" is required for update operation.'; }
            result = todoManager.update(input.id, { title: input.title, description: input.description, status: input.status });
            break;
        case 'remove':
            if (input.id === undefined) { return 'Error: "id" is required for remove operation.'; }
            result = todoManager.remove(input.id);
            break;
        case 'clear': result = todoManager.clear(); break;
        default: return `Error: Unknown operation "${input.operation}". Use: list, add, update, remove, or clear.`;
    }
    const lines: string[] = [result.message, ''];
    if (result.todos && result.todos.length > 0) {
        lines.push('**Current Todos:**');
        for (const todo of result.todos) {
            const icon = todo.status === 'completed' ? '✅' : todo.status === 'in-progress' ? '🔄' : '⬜';
            lines.push(`${icon} **#${todo.id}** ${todo.title} _(${todo.status})_`);
            if (todo.description) { lines.push(`   ${todo.description}`); }
        }
    } else if (result.todos && result.todos.length === 0) {
        lines.push('No todos.');
    }
    return lines.join('\n');
}

export const MANAGE_TODO_TOOL: SharedToolDefinition<ManageTodoInput> = {
    name: 'tom_manageTodo',
    displayName: 'Manage Todo List',
    description:
        "Optional: Manage a persistent todo list for complex multi-step tasks. Skip for simple tasks. Operations: 'list' (view todos), 'add' (create with title/description), 'update' (change status/title/description by id), 'remove' (delete by id), 'clear' (remove all). Status values: not-started, in-progress, completed. Use when you have 3+ distinct steps to track.",
    tags: ['todo', 'task-management', 'tom-ai-chat'],
    readOnly: false,
    inputSchema: {
        type: 'object',
        required: ['operation'],
        properties: {
            operation: { type: 'string', enum: ['list', 'add', 'update', 'remove', 'clear'], description: 'The operation to perform.' },
            id: { type: 'number', description: "Todo ID. Required for 'update' and 'remove'." },
            title: { type: 'string', description: "Short headline for the todo. Required for 'add', optional for 'update'." },
            description: { type: 'string', description: 'Detailed description. Optional.' },
            status: { type: 'string', enum: ['not-started', 'in-progress', 'completed'], description: "Todo status. Used with 'update'." },
            filterStatus: { type: 'string', enum: ['not-started', 'in-progress', 'completed'], description: "Filter by status when using 'list'." },
        },
    },
    execute: executeManageTodo,
};

// ============================================================================
// Master registry — all shared tools in one array
// ============================================================================

/** All shared tool definitions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_SHARED_TOOLS: SharedToolDefinition<any>[] = [
    // Read-only tools (available to both Ollama and VS Code LM)
    READ_FILE_TOOL,
    LIST_DIRECTORY_TOOL,
    FIND_FILES_TOOL,
    FIND_TEXT_IN_FILES_TOOL,
    FETCH_WEBPAGE_TOOL,
    WEB_SEARCH_TOOL,
    GET_ERRORS_TOOL,
    READ_GUIDELINE_TOOL,
    // Write tools (VS Code LM only by default)
    CREATE_FILE_TOOL,
    EDIT_FILE_TOOL,
    MULTI_EDIT_FILE_TOOL,
    RUN_COMMAND_TOOL,
    RUN_VSCODE_COMMAND_TOOL,
    MANAGE_TODO_TOOL,
];

/** Read-only tools suitable for Ollama. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const READ_ONLY_TOOLS: SharedToolDefinition<any>[] = ALL_SHARED_TOOLS.filter(t => t.readOnly);
