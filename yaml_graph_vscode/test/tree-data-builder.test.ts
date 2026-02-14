/**
 * Tests for TreeDataBuilder — building tree panel data from YAML.
 */

import { describe, it, expect } from 'vitest';
import { TreeDataBuilder } from '../src/tree-data-builder.js';
import type { GraphType, GraphMapping } from 'yaml-graph-core';
import { parse } from 'yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Helpers ────────────────────────────────────────────────

function loadFixture(name: string): unknown {
    const content = fs.readFileSync(
        path.join(__dirname, 'fixtures', name), 'utf-8'
    );
    return parse(content);
}

function makeFlowchartMapping(): GraphMapping {
    return {
        map: { id: 'flowchart', version: 1, mermaidType: 'flowchart' },
        nodeShapes: {
            sourcePath: 'nodes',
            idField: '_key',
            labelField: 'label',
            typeField: 'type',
            shapes: {
                start: '(["{label}"])',
                end: '(["{label}"])',
                process: '["{label}"]',
                decision: '{"{label}"}',
                subprocess: '[["{label}"]]',
            },
        },
        edgeLinks: {
            sourcePath: 'edges',
            fromField: 'from',
            toField: 'to',
            labelField: 'label',
            linkStyles: { default: '-->', dotted: '-.->', thick: '==>' },
            labelTemplate: '{from} -->|"{label}"| {to}',
        },
    };
}

function makeStateMachineMapping(): GraphMapping {
    return {
        map: { id: 'state-machine', version: 1, mermaidType: 'stateDiagram-v2' },
        nodeShapes: {
            sourcePath: 'states',
            idField: '_key',
            labelField: 'label',
            typeField: 'type',
            shapes: {
                initial: '[*]',
                state: '{id} : {label}',
                final: '[*]',
                composite: '{id} : {label}',
            },
            initialConnector: '[*] --> {first}',
            finalConnector: '{last} --> [*]',
        },
        edgeLinks: {
            sourcePath: 'transitions',
            fromField: 'from',
            toField: 'to',
            labelField: 'event',
            linkStyles: { default: '-->' },
        },
    };
}

function makeErMapping(): GraphMapping {
    return {
        map: { id: 'er-diagram', version: 1, mermaidType: 'erDiagram' },
        nodeShapes: {
            sourcePath: 'entities',
            idField: '_key',
            labelField: '_key',
            typeField: '_key',
            shapes: {},
        },
        edgeLinks: {
            sourcePath: 'relationships',
            fromField: 'from',
            toField: 'to',
            labelField: 'label',
            linkStyles: { default: '-->' },
        },
    };
}

function makeGraphType(mapping: GraphMapping, schema: object = {}): GraphType {
    return {
        id: mapping.map.id,
        version: mapping.map.version,
        filePatterns: ['*.test.yaml'],
        schema,
        mapping,
    };
}

// ─── Tests ──────────────────────────────────────────────────

describe('TreeDataBuilder', () => {
    const builder = new TreeDataBuilder();

    describe('buildTree — flowchart', () => {
        const data = loadFixture('sample.flow.yaml');
        const graphType = makeGraphType(makeFlowchartMapping());
        const tree = builder.buildTree(data, graphType);

        it('returns three top-level groups (meta, nodes, edges)', () => {
            expect(tree).toHaveLength(3);
            expect(tree[0]!.id).toBe('__meta__');
            expect(tree[1]!.id).toBe('__nodes__');
            expect(tree[2]!.id).toBe('__edges__');
        });

        it('meta node has title as label', () => {
            expect(tree[0]!.label).toBe('Build Pipeline');
        });

        it('meta has children for each field', () => {
            expect(tree[0]!.children!.length).toBeGreaterThanOrEqual(4);
            const ids = tree[0]!.children!.map(c => c.label);
            expect(ids).toContain('id: build-pipeline');
            expect(ids).toContain('title: Build Pipeline');
        });

        it('nodes group contains all 6 nodes', () => {
            expect(tree[1]!.children).toHaveLength(6);
            expect(tree[1]!.label).toBe('Nodes (6)');
        });

        it('each node has id, label, type, icon', () => {
            const startNode = tree[1]!.children![0]!;
            expect(startNode.id).toBe('start');
            expect(startNode.label).toContain('Start');
            expect(startNode.type).toBe('start');
            expect(startNode.icon).toBe('debug-start');
        });

        it('process node gets correct icon', () => {
            const buildNode = tree[1]!.children!.find(n => n.id === 'build');
            expect(buildNode?.icon).toBe('symbol-method');
        });

        it('decision node gets question icon', () => {
            const testNode = tree[1]!.children!.find(n => n.id === 'test');
            expect(testNode?.icon).toBe('question');
        });

        it('subprocess node gets symbol-class icon', () => {
            const deployNode = tree[1]!.children!.find(n => n.id === 'deploy');
            expect(deployNode?.icon).toBe('symbol-class');
        });

        it('node with tags has array child', () => {
            const deployNode = tree[1]!.children!.find(n => n.id === 'deploy');
            expect(deployNode?.children).toBeDefined();
            const tagsChild = deployNode!.children!.find(c => c.id === 'deploy.tags');
            expect(tagsChild).toBeDefined();
            expect(tagsChild!.label).toBe('tags (2)');
            expect(tagsChild!.children).toHaveLength(2);
        });

        it('edges group contains all 6 edges', () => {
            expect(tree[2]!.children).toHaveLength(6);
            expect(tree[2]!.label).toBe('Edges (6)');
        });

        it('each edge shows from → to with label', () => {
            const firstEdge = tree[2]!.children![0]!;
            expect(firstEdge.label).toContain('start');
            expect(firstEdge.label).toContain('checkout');
            expect(firstEdge.label).toContain('Begin');
        });

        it('edge nodes have arrow-right icon', () => {
            for (const edge of tree[2]!.children!) {
                expect(edge.icon).toBe('arrow-right');
            }
        });
    });

    describe('buildTree — state machine', () => {
        const data = loadFixture('sample.state.yaml');
        const graphType = makeGraphType(makeStateMachineMapping());
        const tree = builder.buildTree(data, graphType);

        it('has meta, states, transitions groups', () => {
            expect(tree).toHaveLength(3);
        });

        it('states are found via nodeShapes sourcePath', () => {
            const statesGroup = tree.find(n => n.id === '__nodes__');
            expect(statesGroup).toBeDefined();
            expect(statesGroup!.children).toHaveLength(6);
        });

        it('state nodes have correct labels', () => {
            const statesGroup = tree.find(n => n.id === '__nodes__')!;
            const pending = statesGroup.children!.find(n => n.id === 'pending');
            expect(pending?.label).toContain('Pending Review');
        });

        it('initial state gets debug-start icon', () => {
            const statesGroup = tree.find(n => n.id === '__nodes__')!;
            const init = statesGroup.children!.find(n => n.id === 'init');
            expect(init?.icon).toBe('debug-start');
        });

        it('transitions are in edges group', () => {
            const edgesGroup = tree.find(n => n.id === '__edges__');
            expect(edgesGroup).toBeDefined();
            expect(edgesGroup!.children).toHaveLength(5);
        });

        it('transitions show event as label', () => {
            const edgesGroup = tree.find(n => n.id === '__edges__')!;
            const firstTransition = edgesGroup.children![0]!;
            expect(firstTransition.label).toContain('submit');
        });
    });

    describe('buildTree — ER diagram', () => {
        const data = loadFixture('sample.er.yaml');
        const graphType = makeGraphType(makeErMapping());
        const tree = builder.buildTree(data, graphType);

        it('has meta, entities, relationships', () => {
            expect(tree).toHaveLength(3);
        });

        it('entities are listed correctly', () => {
            const entitiesGroup = tree.find(n => n.id === '__nodes__')!;
            expect(entitiesGroup.children).toHaveLength(3);
            const ids = entitiesGroup.children!.map(c => c.id);
            expect(ids).toContain('user');
            expect(ids).toContain('role');
            expect(ids).toContain('permission');
        });

        it('entity node has attributes as array child', () => {
            const entitiesGroup = tree.find(n => n.id === '__nodes__')!;
            const userNode = entitiesGroup.children!.find(n => n.id === 'user');
            expect(userNode?.children).toBeDefined();
            const attrsChild = userNode!.children!.find(c => c.id === 'user.attributes');
            expect(attrsChild).toBeDefined();
            expect(attrsChild!.label).toBe('attributes (4)');
        });

        it('attribute children show name as label', () => {
            const entitiesGroup = tree.find(n => n.id === '__nodes__')!;
            const userNode = entitiesGroup.children!.find(n => n.id === 'user');
            const attrsChild = userNode!.children!.find(c => c.id === 'user.attributes');
            const attrItems = attrsChild!.children!;
            expect(attrItems[0]!.label).toBe('id');
            expect(attrItems[1]!.label).toBe('username');
        });

        it('relationships show from → to with label', () => {
            const relGroup = tree.find(n => n.id === '__edges__')!;
            expect(relGroup.children).toHaveLength(3);
            expect(relGroup.children![0]!.label).toContain('user');
            expect(relGroup.children![0]!.label).toContain('role');
            expect(relGroup.children![0]!.label).toContain('has role');
        });
    });

    describe('edge cases', () => {
        it('returns empty array for null data', () => {
            const graphType = makeGraphType(makeFlowchartMapping());
            expect(builder.buildTree(null, graphType)).toEqual([]);
        });

        it('returns empty array for non-object data', () => {
            const graphType = makeGraphType(makeFlowchartMapping());
            expect(builder.buildTree('not an object', graphType)).toEqual([]);
        });

        it('returns empty array for undefined data', () => {
            const graphType = makeGraphType(makeFlowchartMapping());
            expect(builder.buildTree(undefined, graphType)).toEqual([]);
        });

        it('handles data with only meta', () => {
            const graphType = makeGraphType(makeFlowchartMapping());
            const data = { meta: { id: 'test', title: 'Test' } };
            const tree = builder.buildTree(data, graphType);
            expect(tree).toHaveLength(1);
            expect(tree[0]!.id).toBe('__meta__');
        });

        it('handles data with empty nodes and edges', () => {
            const graphType = makeGraphType(makeFlowchartMapping());
            const data = { meta: { id: 'test', title: 'Test' }, nodes: {}, edges: [] };
            const tree = builder.buildTree(data, graphType);
            expect(tree).toHaveLength(3);
            expect(tree[1]!.children).toHaveLength(0);
            expect(tree[2]!.children).toHaveLength(0);
        });
    });

    describe('custom options', () => {
        it('accepts custom icon map', () => {
            const customBuilder = new TreeDataBuilder({
                iconMap: { process: 'custom-icon' },
            });
            const data = { nodes: { a: { type: 'process', label: 'A' } } };
            const graphType = makeGraphType(makeFlowchartMapping());
            const tree = customBuilder.buildTree(data, graphType);
            const nodesGroup = tree.find(n => n.id === '__nodes__')!;
            expect(nodesGroup.children![0]!.icon).toBe('custom-icon');
        });

        it('custom icon map merges with defaults', () => {
            const customBuilder = new TreeDataBuilder({
                iconMap: { custom: 'my-icon' },
            });
            // Default icons should still work
            const data = { nodes: { a: { type: 'start', label: 'A' } } };
            const graphType = makeGraphType(makeFlowchartMapping());
            const tree = customBuilder.buildTree(data, graphType);
            const nodesGroup = tree.find(n => n.id === '__nodes__')!;
            expect(nodesGroup.children![0]!.icon).toBe('debug-start');
        });
    });

    describe('node label extraction', () => {
        it('uses label field when present', () => {
            const data = { nodes: { a: { type: 'process', label: 'My Label' } } };
            const graphType = makeGraphType(makeFlowchartMapping());
            const tree = builder.buildTree(data, graphType);
            const node = tree.find(n => n.id === '__nodes__')!.children![0]!;
            expect(node.label).toContain('My Label');
        });

        it('uses name field as fallback', () => {
            const data = { nodes: { a: { type: 'process', name: 'My Name' } } };
            const graphType = makeGraphType(makeFlowchartMapping());
            const tree = builder.buildTree(data, graphType);
            const node = tree.find(n => n.id === '__nodes__')!.children![0]!;
            expect(node.label).toContain('My Name');
        });

        it('uses node ID as final fallback', () => {
            const data = { nodes: { myNodeId: { type: 'process' } } };
            const graphType = makeGraphType(makeFlowchartMapping());
            const tree = builder.buildTree(data, graphType);
            const node = tree.find(n => n.id === '__nodes__')!.children![0]!;
            expect(node.label).toContain('myNodeId');
        });
    });

    describe('meta node construction', () => {
        it('uses id when title is absent', () => {
            const data = { meta: { id: 'my-diagram' } };
            const graphType = makeGraphType(makeFlowchartMapping());
            const tree = builder.buildTree(data, graphType);
            expect(tree[0]!.label).toBe('my-diagram');
        });

        it('meta children have correct IDs', () => {
            const data = { meta: { id: 'test', title: 'Test Title', version: 1 } };
            const graphType = makeGraphType(makeFlowchartMapping());
            const tree = builder.buildTree(data, graphType);
            const metaChildren = tree[0]!.children!;
            expect(metaChildren.some(c => c.id === '__meta__.id')).toBe(true);
            expect(metaChildren.some(c => c.id === '__meta__.title')).toBe(true);
        });
    });

    describe('buildEdgesGroup from mapping fields', () => {
        it('uses custom from/to/label fields from mapping', () => {
            const mapping = makeStateMachineMapping();
            const transitionsData = [
                { from: 'A', to: 'B', event: 'go' },
                { from: 'B', to: 'C', event: 'next' },
            ];
            const group = builder.buildEdgesGroup(transitionsData, mapping);
            expect(group.children).toHaveLength(2);
            expect(group.children![0]!.label).toContain('A');
            expect(group.children![0]!.label).toContain('B');
            expect(group.children![0]!.label).toContain('go');
        });
    });
});
