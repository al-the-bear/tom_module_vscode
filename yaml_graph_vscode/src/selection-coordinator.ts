/**
 * SelectionCoordinator — coordinates selection state across all panes:
 * tree panel, Mermaid preview, YAML text editor, and node editor.
 *
 * When a node is selected in any pane, the coordinator updates all other
 * panes to reflect the selection. This provides the unified selection
 * experience described in the architecture.
 */

import * as vscode from 'vscode';
import { YamlParserWrapper } from 'yaml-graph-core';
import type { GraphType } from 'yaml-graph-core';
import type { WebviewManager } from './webview-manager.js';
import type { NodeEditorController } from './node-editor-controller.js';
import type { WebviewMessage, NodeEditRequest } from './types.js';

export class SelectionCoordinator {
    private parser = new YamlParserWrapper();
    private currentNodeId: string | undefined;

    constructor(
        private readonly webview: WebviewManager,
        private readonly nodeEditor: NodeEditorController,
        private readonly graphType: GraphType
    ) {}

    /**
     * Get the currently selected node ID.
     */
    getSelectedNodeId(): string | undefined {
        return this.currentNodeId;
    }

    /**
     * Handle an incoming message from the webview.
     * Dispatches to the appropriate handler based on message type.
     */
    handleWebviewMessage(msg: WebviewMessage, document: vscode.TextDocument): void {
        switch (msg.type) {
            case 'nodeClicked':
            case 'treeNodeSelected':
                this.onNodeSelected(msg.nodeId, document);
                break;
            case 'applyEdit':
                this.onApplyEdit({
                    nodeId: msg.nodeId,
                    changes: Object.fromEntries(msg.edits.map(e => [e.path, e.value])),
                }, document);
                break;
        }
    }

    /**
     * Handle node selection from any source (tree click, diagram click).
     * Updates all panes: tree highlight, Mermaid highlight, YAML cursor, node editor.
     */
    onNodeSelected(nodeId: string, document: vscode.TextDocument): void {
        this.currentNodeId = nodeId;

        // 1. Highlight in tree
        this.webview.postMessage({ type: 'selectNode', nodeId });

        // 2. Highlight in Mermaid preview
        this.webview.postMessage({ type: 'highlightMermaidNode', nodeId });

        // 3. Reveal in YAML text editor
        this.revealInEditor(nodeId, document);

        // 4. Update node editor panel
        this.updateNodeEditor(nodeId, document);
    }

    /**
     * Reveal a node's YAML source in the text editor.
     * Scrolls to the node's position and selects its range.
     */
    revealInEditor(nodeId: string, document: vscode.TextDocument): void {
        const parsed = this.parser.parse(document.getText());
        const range = this.parser.getSourceRange(parsed, `nodes.${nodeId}`);

        if (range) {
            const startPos = document.positionAt(range.startOffset);
            const endPos = document.positionAt(range.endOffset);
            const vsRange = new vscode.Range(startPos, endPos);

            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document.uri.toString() === document.uri.toString()) {
                    editor.revealRange(vsRange, vscode.TextEditorRevealType.InCenter);
                    editor.selection = new vscode.Selection(startPos, endPos);
                }
            }
        }
    }

    /**
     * Update the node editor with data for the selected node.
     */
    updateNodeEditor(nodeId: string, document: vscode.TextDocument): void {
        const parsed = this.parser.parse(document.getText());
        const data = parsed.data as Record<string, unknown> | undefined;
        const nodes = data?.['nodes'] as Record<string, unknown> | undefined;
        const nodeData = nodes?.[nodeId];

        if (nodeData) {
            const msg = this.nodeEditor.buildShowNodeMessage(
                nodeId, nodeData, this.graphType
            );
            this.webview.postMessage(msg);
        } else {
            this.webview.postMessage(this.nodeEditor.buildClearMessage());
        }
    }

    /**
     * Handle edit requests from the node editor in the webview.
     * Applies changes to the YAML document via AST operations to preserve comments.
     */
    async onApplyEdit(
        editRequest: NodeEditRequest,
        document: vscode.TextDocument
    ): Promise<boolean> {
        const parsed = this.parser.parse(document.getText());

        let updatedText = parsed.document.toString();
        for (const [field, value] of Object.entries(editRequest.changes)) {
            const path = `nodes.${editRequest.nodeId}.${field}`;
            const reparsed = this.parser.parse(updatedText);
            updatedText = this.parser.editValue(reparsed, path, value);
        }

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        edit.replace(document.uri, fullRange, updatedText);
        return vscode.workspace.applyEdit(edit);
    }
}
