/**
 * WebviewManager — manages the webview panel's HTML content and
 * message passing between extension host and webview.
 *
 * Generates the HTML structure containing the tree panel, Mermaid preview,
 * node editor, and status bar. Handles all postMessage communication.
 */

import * as vscode from 'vscode';
import type { GraphType } from 'yaml-graph-core';
import type { ValidationError } from 'yaml-graph-core';
import type {
    ExtensionMessage, WebviewMessage, TreeNode, WebviewManagerOptions
} from './types.js';

export class WebviewManager {
    private readonly panel: vscode.WebviewPanel;
    private readonly graphType: GraphType;
    private readonly options: WebviewManagerOptions;
    private messageHandler?: (msg: WebviewMessage) => void;

    constructor(
        panel: vscode.WebviewPanel,
        graphType: GraphType,
        options?: Partial<WebviewManagerOptions>
    ) {
        this.panel = panel;
        this.graphType = graphType;
        this.options = {
            extensionUri: options?.extensionUri ?? { fsPath: '' },
            baseCss: options?.baseCss,
            graphTypeCss: options?.graphTypeCss ?? graphType.styleSheet,
        };

        // Set initial HTML
        this.panel.webview.html = this.generateHtml();

        // Listen for messages from webview
        this.panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
            if (this.messageHandler) {
                this.messageHandler(msg);
            }
        });
    }

    /**
     * Register a handler for messages from the webview.
     */
    onMessage(handler: (msg: WebviewMessage) => void): void {
        this.messageHandler = handler;
    }

    /**
     * Send a message to the webview.
     */
    postMessage(message: ExtensionMessage): void {
        this.panel.webview.postMessage(message);
    }

    /**
     * Update the webview with new conversion results.
     * Sends an updateAll message containing YAML, Mermaid, tree data, and errors.
     */
    update(
        yamlText: string,
        mermaidSource: string,
        treeData: TreeNode[],
        errors: ValidationError[]
    ): void {
        this.postMessage({
            type: 'updateAll',
            yamlText,
            mermaidSource,
            treeData,
            errors,
        });
    }

    /**
     * Select a node in the tree panel.
     */
    selectTreeNode(nodeId: string): void {
        this.postMessage({ type: 'selectNode', nodeId });
    }

    /**
     * Highlight a node in the Mermaid preview.
     */
    highlightMermaidNode(nodeId: string): void {
        this.postMessage({ type: 'highlightMermaidNode', nodeId });
    }

    /**
     * Generate the initial HTML for the webview.
     * Contains the split-pane layout with tree, preview, node editor, and status bar.
     */
    generateHtml(): string {
        const nonce = this.generateNonce();
        const graphTypeCss = this.options.graphTypeCss ?? '';
        const baseCss = this.options.baseCss ?? '';
        const title = `${this.graphType.id} Editor`;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src 'unsafe-inline';
                   script-src 'nonce-${nonce}';">
    <title>${this.escapeHtml(title)}</title>
    <style>
        /* Base theme — adapts to VS Code theme via CSS variables */
        :root {
            --tree-width: 280px;
            --node-editor-height: 200px;
            --border-color: var(--vscode-panel-border, #333);
            --bg-color: var(--vscode-editor-background, #1e1e1e);
            --fg-color: var(--vscode-editor-foreground, #d4d4d4);
            --select-bg: var(--vscode-list-activeSelectionBackground, #094771);
        }

        body {
            margin: 0;
            padding: 0;
            background: var(--bg-color);
            color: var(--fg-color);
            font-family: var(--vscode-font-family, sans-serif);
            font-size: var(--vscode-font-size, 13px);
            height: 100vh;
            overflow: hidden;
        }

        #layout {
            display: flex;
            height: 100vh;
        }

        #left-panel {
            width: var(--tree-width);
            min-width: 200px;
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        #tree-container {
            flex: 1;
            overflow: auto;
            padding: 8px;
        }

        #node-editor {
            height: var(--node-editor-height);
            min-height: 100px;
            border-top: 1px solid var(--border-color);
            overflow: auto;
            padding: 8px;
        }

        #preview-container {
            flex: 1;
            overflow: auto;
            padding: 16px;
            display: flex;
            align-items: flex-start;
            justify-content: center;
        }

        #mermaid-output {
            max-width: 100%;
        }

        #status-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 22px;
            background: var(--vscode-statusBar-background, #007acc);
            color: var(--vscode-statusBar-foreground, #fff);
            font-size: 12px;
            line-height: 22px;
            padding: 0 8px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        /* Tree node styling */
        .tree-node {
            padding: 2px 4px;
            cursor: pointer;
            border-radius: 3px;
            white-space: nowrap;
        }
        .tree-node:hover {
            background: var(--vscode-list-hoverBackground, #2a2d2e);
        }
        .tree-node.selected {
            background: var(--select-bg);
        }

        ${baseCss}
        ${graphTypeCss}
    </style>
</head>
<body>
    <div id="layout">
        <div id="left-panel">
            <div id="tree-container">
                <div id="tree">Loading tree...</div>
            </div>
            <div id="node-editor">
                <em>Select a node to edit</em>
            </div>
        </div>
        <div id="preview-container">
            <div id="mermaid-output">Loading diagram...</div>
        </div>
    </div>
    <div id="status-bar">
        <span id="status-text">Ready</span>
        <span id="error-count"></span>
    </div>

    <script nonce="${nonce}">
        const vscodeApi = acquireVsCodeApi();

        // Listen for messages from extension host
        window.addEventListener('message', event => {
            const msg = event.data;
            switch (msg.type) {
                case 'updateAll':
                    handleUpdateAll(msg);
                    break;
                case 'selectNode':
                    handleSelectNode(msg.nodeId);
                    break;
                case 'highlightMermaidNode':
                    handleHighlightMermaidNode(msg.nodeId);
                    break;
                case 'showNode':
                    handleShowNode(msg);
                    break;
                case 'showErrors':
                    handleShowErrors(msg.errors);
                    break;
                case 'clearNodeEditor':
                    handleClearNodeEditor();
                    break;
            }
        });

        function handleUpdateAll(msg) {
            // Update tree
            const treeEl = document.getElementById('tree');
            if (treeEl) treeEl.innerHTML = renderTree(msg.treeData);

            // Update Mermaid preview
            const previewEl = document.getElementById('mermaid-output');
            if (previewEl) previewEl.textContent = msg.mermaidSource;

            // Update status bar
            const errorCount = msg.errors?.length ?? 0;
            const errEl = document.getElementById('error-count');
            if (errEl) errEl.textContent = errorCount > 0
                ? errorCount + ' error(s)' : '';
        }

        function renderTree(nodes) {
            if (!nodes || nodes.length === 0) return '<em>No data</em>';
            return '<ul>' + nodes.map(n => renderTreeNode(n)).join('') + '</ul>';
        }

        function renderTreeNode(node) {
            const children = node.children
                ? renderTree(node.children)
                : '';
            return '<li class="tree-node" data-id="' + node.id + '" '
                + 'onclick="onTreeClick(event, \\'' + node.id + '\\')">'
                + node.label + children + '</li>';
        }

        function onTreeClick(event, nodeId) {
            event.stopPropagation();
            vscodeApi.postMessage({ type: 'treeNodeSelected', nodeId: nodeId });
        }

        function handleSelectNode(nodeId) {
            document.querySelectorAll('.tree-node.selected')
                .forEach(el => el.classList.remove('selected'));
            const el = document.querySelector('[data-id="' + nodeId + '"]');
            if (el) el.classList.add('selected');
        }

        function handleHighlightMermaidNode(nodeId) {
            // Mermaid SVG highlighting would go here
        }

        function handleShowNode(msg) {
            const editorEl = document.getElementById('node-editor');
            if (editorEl) {
                editorEl.innerHTML = '<h4>Node: ' + msg.nodeId + '</h4>'
                    + '<pre>' + JSON.stringify(msg.nodeData, null, 2) + '</pre>';
            }
        }

        function handleShowErrors(errors) {
            const errEl = document.getElementById('error-count');
            if (errEl) errEl.textContent = errors.length > 0
                ? errors.length + ' error(s)' : '';
        }

        function handleClearNodeEditor() {
            const editorEl = document.getElementById('node-editor');
            if (editorEl) editorEl.innerHTML = '<em>Select a node to edit</em>';
        }
    </script>
</body>
</html>`;
    }

    /**
     * Generate a random nonce for Content Security Policy.
     */
    private generateNonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
        for (let i = 0; i < 32; i++) {
            nonce += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return nonce;
    }

    /**
     * Escape HTML special characters for safe embedding.
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Get the underlying webview panel (for disposal/lifecycle management).
     */
    getPanel(): vscode.WebviewPanel {
        return this.panel;
    }
}
