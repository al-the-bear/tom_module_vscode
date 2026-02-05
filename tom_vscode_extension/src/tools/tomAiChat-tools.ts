import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TodoManager, TodoOperationResult } from '../managers/todoManager';

const execAsync = promisify(exec);

// Active TodoManager instance - set by handler when starting a chat
let activeTodoManager: TodoManager | null = null;

/**
 * Set the active TodoManager for the current chat session
 */
export function setActiveTodoManager(manager: TodoManager | null): void {
    activeTodoManager = manager;
}

/**
 * Get the active TodoManager
 */
export function getActiveTodoManager(): TodoManager | null {
    return activeTodoManager;
}

/**
 * Custom tools for Tom AI Chat that work without requiring a chat participant token.
 * These tools handle file operations directly via Node.js fs module.
 */

// Helper to resolve paths
function resolvePath(filePath: string): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    return path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
}

function getWorkspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
}

// ============================================================================
// File Operations
// ============================================================================

export const TOM_CREATE_FILE_TOOL: vscode.LanguageModelTool<{ filePath: string; content: string }> = {
    async invoke(options, _token) {
        const { filePath, content } = options.input;
        const resolvedPath = resolvePath(filePath);
        
        // Create parent directories if needed
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write the file
        fs.writeFileSync(resolvedPath, content, 'utf8');
        
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Created file: ${resolvedPath}`)
        ]);
    }
};

export const TOM_READ_FILE_TOOL: vscode.LanguageModelTool<{ filePath: string; startLine?: number; endLine?: number }> = {
    async invoke(options, _token) {
        const { filePath, startLine, endLine } = options.input;
        const resolvedPath = resolvePath(filePath);
        
        if (!fs.existsSync(resolvedPath)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`File not found: ${resolvedPath}`)
            ]);
        }
        
        const content = fs.readFileSync(resolvedPath, 'utf8');
        const lines = content.split('\n');
        
        const start = (startLine ?? 1) - 1;
        const end = endLine ?? lines.length;
        const selectedLines = lines.slice(start, end);
        
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(selectedLines.join('\n'))
        ]);
    }
};

export const TOM_EDIT_FILE_TOOL: vscode.LanguageModelTool<{ filePath: string; oldText: string; newText: string }> = {
    async invoke(options, _token) {
        const { filePath, oldText, newText } = options.input;
        const resolvedPath = resolvePath(filePath);
        
        if (!fs.existsSync(resolvedPath)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`File not found: ${resolvedPath}`)
            ]);
        }
        
        const content = fs.readFileSync(resolvedPath, 'utf8');
        
        if (!content.includes(oldText)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Text not found in file. Make sure oldText matches exactly.`)
            ]);
        }
        
        const newContent = content.replace(oldText, newText);
        fs.writeFileSync(resolvedPath, newContent, 'utf8');
        
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Edited file: ${resolvedPath}`)
        ]);
    }
};

export const TOM_MULTI_EDIT_FILE_TOOL: vscode.LanguageModelTool<{ edits: Array<{ filePath: string; oldText: string; newText: string }> }> = {
    async invoke(options, _token) {
        const { edits } = options.input;
        const results: string[] = [];
        
        for (const edit of edits) {
            const resolvedPath = resolvePath(edit.filePath);
            
            if (!fs.existsSync(resolvedPath)) {
                results.push(`❌ File not found: ${resolvedPath}`);
                continue;
            }
            
            const content = fs.readFileSync(resolvedPath, 'utf8');
            
            if (!content.includes(edit.oldText)) {
                results.push(`❌ Text not found in: ${resolvedPath}`);
                continue;
            }
            
            const newContent = content.replace(edit.oldText, edit.newText);
            fs.writeFileSync(resolvedPath, newContent, 'utf8');
            results.push(`✅ Edited: ${resolvedPath}`);
        }
        
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(results.join('\n'))
        ]);
    }
};

export const TOM_LIST_DIR_TOOL: vscode.LanguageModelTool<{ dirPath: string }> = {
    async invoke(options, _token) {
        const { dirPath } = options.input;
        const resolvedPath = resolvePath(dirPath);
        
        if (!fs.existsSync(resolvedPath)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Directory not found: ${resolvedPath}`)
            ]);
        }
        
        const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
        const listing = entries.map(entry => {
            const suffix = entry.isDirectory() ? '/' : '';
            return `${entry.name}${suffix}`;
        }).join('\n');
        
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(listing)
        ]);
    }
};

// ============================================================================
// Search Operations
// ============================================================================

export const TOM_FIND_FILES_TOOL: vscode.LanguageModelTool<{ pattern: string; maxResults?: number }> = {
    async invoke(options, _token) {
        const { pattern, maxResults } = options.input;
        const limit = maxResults ?? 100;
        
        try {
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', limit);
            const paths = files.map(f => vscode.workspace.asRelativePath(f));
            
            if (paths.length === 0) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`No files found matching: ${pattern}`)
                ]);
            }
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(paths.join('\n'))
            ]);
        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error finding files: ${error}`)
            ]);
        }
    }
};

export const TOM_FIND_TEXT_IN_FILES_TOOL: vscode.LanguageModelTool<{ searchText: string; filePattern?: string; isRegex?: boolean; maxResults?: number }> = {
    async invoke(options, _token) {
        const { searchText, filePattern, isRegex, maxResults } = options.input;
        const workspaceRoot = getWorkspaceRoot();
        const limit = maxResults ?? 50;
        
        try {
            // Use grep/ripgrep for fast searching
            const grepPattern = isRegex ? searchText : searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const includePattern = filePattern ?? '*';
            
            const { stdout } = await execAsync(
                `grep -rn --include="${includePattern}" -E "${grepPattern}" . 2>/dev/null | head -${limit}`,
                { cwd: workspaceRoot, maxBuffer: 1024 * 1024 }
            );
            
            if (!stdout.trim()) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`No matches found for: ${searchText}`)
                ]);
            }
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(stdout.trim())
            ]);
        } catch (error: any) {
            // grep returns exit code 1 when no matches found
            if (error.code === 1) {
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`No matches found for: ${searchText}`)
                ]);
            }
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error searching: ${error.message}`)
            ]);
        }
    }
};

// ============================================================================
// Terminal/Command Operations
// ============================================================================

export const TOM_RUN_COMMAND_TOOL: vscode.LanguageModelTool<{ command: string; cwd?: string }> = {
    async invoke(options, _token) {
        const { command, cwd } = options.input;
        const workingDir = cwd ? resolvePath(cwd) : getWorkspaceRoot();
        
        try {
            const { stdout, stderr } = await execAsync(command, { 
                cwd: workingDir, 
                maxBuffer: 1024 * 1024 
            });
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(stdout || stderr || '(no output)')
            ]);
        } catch (error: any) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error: ${error.message}\n${error.stderr || ''}`)
            ]);
        }
    }
};

export const TOM_RUN_VSCODE_COMMAND_TOOL: vscode.LanguageModelTool<{ command: string; args?: unknown[] }> = {
    async invoke(options, _token) {
        const { command, args } = options.input;
        
        try {
            const result = await vscode.commands.executeCommand(command, ...(args ?? []));
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Command executed: ${command}\nResult: ${JSON.stringify(result) ?? '(no result)'}`)
            ]);
        } catch (error) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error executing command: ${error}`)
            ]);
        }
    }
};

// ============================================================================
// Diagnostics
// ============================================================================

export const TOM_GET_ERRORS_TOOL: vscode.LanguageModelTool<{ filePath?: string }> = {
    async invoke(options, _token) {
        const { filePath } = options.input;
        
        let diagnostics: [vscode.Uri, readonly vscode.Diagnostic[]][];
        
        if (filePath) {
            const resolvedPath = resolvePath(filePath);
            const uri = vscode.Uri.file(resolvedPath);
            const fileDiags = vscode.languages.getDiagnostics(uri);
            diagnostics = [[uri, fileDiags]];
        } else {
            diagnostics = vscode.languages.getDiagnostics();
        }
        
        const errors: string[] = [];
        for (const [uri, diags] of diagnostics) {
            const relevantDiags = diags.filter(d => 
                d.severity === vscode.DiagnosticSeverity.Error || 
                d.severity === vscode.DiagnosticSeverity.Warning
            );
            
            for (const diag of relevantDiags) {
                const severity = diag.severity === vscode.DiagnosticSeverity.Error ? '❌' : '⚠️';
                const relativePath = vscode.workspace.asRelativePath(uri);
                errors.push(`${severity} ${relativePath}:${diag.range.start.line + 1}: ${diag.message}`);
            }
        }
        
        if (errors.length === 0) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('No errors or warnings found.')
            ]);
        }
        
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(errors.slice(0, 100).join('\n'))
        ]);
    }
};

// ============================================================================
// Web/HTTP Operations
// ============================================================================

export const TOM_FETCH_WEBPAGE_TOOL: vscode.LanguageModelTool<{ url: string }> = {
    async invoke(options, _token) {
        const { url } = options.input;
        
        try {
            // Use curl for simplicity (available on macOS/Linux)
            const { stdout } = await execAsync(
                `curl -sL --max-time 10 "${url}" | head -c 50000`,
                { maxBuffer: 1024 * 1024 }
            );
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(stdout || '(empty response)')
            ]);
        } catch (error: any) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Error fetching URL: ${error.message}`)
            ]);
        }
    }
};

// ============================================================================
// Guidelines Access
// ============================================================================

export const TOM_READ_GUIDELINE_TOOL: vscode.LanguageModelTool<{ fileName?: string }> = {
    async invoke(options, _token) {
        const { fileName } = options.input;
        const workspaceRoot = getWorkspaceRoot();
        const guidelinesDir = path.join(workspaceRoot, '_copilot_guidelines');
        
        if (!fs.existsSync(guidelinesDir)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Guidelines directory not found: ${guidelinesDir}`)
            ]);
        }
        
        // If no file specified, list available guidelines and return index.md
        if (!fileName) {
            const files = fs.readdirSync(guidelinesDir)
                .filter(f => f.endsWith('.md'))
                .sort();
            
            let result = `Available guideline files in _copilot_guidelines/:\n\n`;
            result += files.map(f => `- ${f}`).join('\n');
            
            // Also include index.md content
            const indexPath = path.join(guidelinesDir, 'index.md');
            if (fs.existsSync(indexPath)) {
                result += '\n\n---\n\nindex.md content:\n\n';
                result += fs.readFileSync(indexPath, 'utf8');
            }
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(result)
            ]);
        }
        
        // Read specific file
        const targetFile = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
        const filePath = path.join(guidelinesDir, targetFile);
        
        if (!fs.existsSync(filePath)) {
            // Try subdirectories
            const subDirs = fs.readdirSync(guidelinesDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);
            
            for (const subDir of subDirs) {
                const subPath = path.join(guidelinesDir, subDir, targetFile);
                if (fs.existsSync(subPath)) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(fs.readFileSync(subPath, 'utf8'))
                    ]);
                }
            }
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`Guideline file not found: ${targetFile}`)
            ]);
        }
        
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(fs.readFileSync(filePath, 'utf8'))
        ]);
    }
};

// ============================================================================
// Todo Management
// ============================================================================

interface TodoManageInput {
    operation: 'list' | 'add' | 'update' | 'remove' | 'clear';
    id?: number;
    title?: string;
    description?: string;
    status?: 'not-started' | 'in-progress' | 'completed';
    filterStatus?: 'not-started' | 'in-progress' | 'completed';
}

export const TOM_MANAGE_TODO_TOOL: vscode.LanguageModelTool<TodoManageInput> = {
    async invoke(options, _token) {
        const { operation, id, title, description, status, filterStatus } = options.input;
        
        const todoManager = getActiveTodoManager();
        if (!todoManager) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('Error: No active todo manager. This tool only works during Tom AI Chat sessions.')
            ]);
        }
        
        let result: TodoOperationResult;
        
        switch (operation) {
            case 'list':
                result = todoManager.list(filterStatus);
                break;
                
            case 'add':
                if (!title) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart('Error: "title" is required for add operation.')
                    ]);
                }
                result = todoManager.add(title, description || '');
                break;
                
            case 'update':
                if (id === undefined) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart('Error: "id" is required for update operation.')
                    ]);
                }
                result = todoManager.update(id, { title, description, status });
                break;
                
            case 'remove':
                if (id === undefined) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart('Error: "id" is required for remove operation.')
                    ]);
                }
                result = todoManager.remove(id);
                break;
                
            case 'clear':
                result = todoManager.clear();
                break;
                
            default:
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`Error: Unknown operation "${operation}". Use: list, add, update, remove, or clear.`)
                ]);
        }
        
        // Format response
        const lines: string[] = [result.message, ''];
        
        if (result.todos && result.todos.length > 0) {
            lines.push('**Current Todos:**');
            for (const todo of result.todos) {
                const statusIcon = todo.status === 'completed' ? '✅' : 
                                  todo.status === 'in-progress' ? '🔄' : '⬜';
                lines.push(`${statusIcon} **#${todo.id}** ${todo.title} _(${todo.status})_`);
                if (todo.description) {
                    lines.push(`   ${todo.description}`);
                }
            }
        } else if (result.todos && result.todos.length === 0) {
            lines.push('No todos.');
        }
        
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(lines.join('\n'))
        ]);
    }
};

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register all Tom AI Chat tools with VS Code.
 */
export function registerTomAiChatTools(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        // File operations
        vscode.lm.registerTool('tom_createFile', TOM_CREATE_FILE_TOOL),
        vscode.lm.registerTool('tom_readFile', TOM_READ_FILE_TOOL),
        vscode.lm.registerTool('tom_editFile', TOM_EDIT_FILE_TOOL),
        vscode.lm.registerTool('tom_multiEditFile', TOM_MULTI_EDIT_FILE_TOOL),
        vscode.lm.registerTool('tom_listDirectory', TOM_LIST_DIR_TOOL),
        // Search operations
        vscode.lm.registerTool('tom_findFiles', TOM_FIND_FILES_TOOL),
        vscode.lm.registerTool('tom_findTextInFiles', TOM_FIND_TEXT_IN_FILES_TOOL),
        // Command/terminal operations
        vscode.lm.registerTool('tom_runCommand', TOM_RUN_COMMAND_TOOL),
        vscode.lm.registerTool('tom_runVscodeCommand', TOM_RUN_VSCODE_COMMAND_TOOL),
        // Diagnostics
        vscode.lm.registerTool('tom_getErrors', TOM_GET_ERRORS_TOOL),
        // Web
        vscode.lm.registerTool('tom_fetchWebpage', TOM_FETCH_WEBPAGE_TOOL),
        // Guidelines
        vscode.lm.registerTool('tom_readGuideline', TOM_READ_GUIDELINE_TOOL),
        // Todo management
        vscode.lm.registerTool('tom_manageTodo', TOM_MANAGE_TODO_TOOL)
    );
}
