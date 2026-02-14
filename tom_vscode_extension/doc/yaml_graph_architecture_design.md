# YAML Graph Editor — Architecture & Design

Detailed architecture, component design, APIs, and draft schemas for the
YAML Graph Editor system. This document complements the design proposal
(`yaml_graph.md`) with implementation-level specifics.

**Status:** Architecture Design (non-binding — details may evolve as long as
primary goals are met)  
**Date:** 2026-02-14  
**Related:** [yaml_graph.md](yaml_graph.md) — Design Proposal

---

## Table of Contents

- [1. Primary Goals](#1-primary-goals)
- [2. Repository Layout](#2-repository-layout)
- [3. yaml-graph-core — Core Library](#3-yaml-graph-core--core-library)
- [4. yaml-graph-vscode — VS Code Integration](#4-yaml-graph-vscode--vs-code-integration)
- [5. Diagram Type Packages](#5-diagram-type-packages)
- [6. Schemas](#6-schemas)
- [7. Mapping File Schema & Format](#7-mapping-file-schema--format)
- [8. Conversion Engine — Detailed Design](#8-conversion-engine--detailed-design)
- [9. YAML Parser Wrapper](#9-yaml-parser-wrapper)
- [10. Webview Architecture](#10-webview-architecture)
- [11. PostMessage Protocol](#11-postmessage-protocol)
- [12. Extension Integration](#12-extension-integration)
- [13. Testing Strategy](#13-testing-strategy)
- [14. Open Questions](#14-open-questions)

---

## 1. Primary Goals

These are the non-negotiable goals that all design decisions must serve.
Implementation details, APIs, and schemas may change freely as long as these
goals remain satisfied.

### G1 — Configuration-Only Diagram Types

All diagram type transformations must be expressible through the generator
mapping configuration alone — JSON Schema + `*.graph-map.yaml` — without
writing or modifying any TypeScript code. Adding a new diagram type requires
only two configuration files. No extension rebuild, no custom renderers.

### G2 — Standalone Core Library

The core conversion engine (`yaml-graph-core`) has zero VS Code dependencies.
It can run in Node.js, a browser, a CLI tool, or any TypeScript project.
The library is useful on its own — converting YAML to Mermaid — before any
editor exists.

### G3 — Layered Package Architecture

The system is split into clearly separated layers:
- **Core library** (standalone, no VS Code) — conversion engine, parser, validator
- **VS Code integration** (separate package) — editor provider, webview, sync
- **Diagram type packages** (config-only, no TypeScript) — schema + mapping per type
- **Extension core** (minimal glue) — instantiation and injection only

### G4 — Comment-Preserving YAML Editing

All edits from the tree panel and node editor preserve existing YAML comments.
Users can freely mix tree-panel editing with direct YAML text editing without
losing comments or formatting.

### G5 — Interactive Diagrams via Converter Callbacks

The Mermaid preview is interactive — clicking nodes navigates to the tree and
YAML source. This interactivity is injected through converter callbacks, not
hard-coded in the core engine. Different host environments can provide
different callback implementations.

### G6 — Node Editor Panel

A dedicated panel below the tree shows all editable fields for the selected
node. It updates from any selection source (tree click, diagram click, YAML
cursor). It replaces the overlay concept — always visible, no positioning
complexity.

---

## 2. Repository Layout

All packages live inside the `tom_module_vscode` repository as sibling folders:

```
tom_module_vscode/
    tom_repository.yaml
    tom_vscode_bridge/          # existing — Dart bridge
    tom_vscode_extension/       # existing — VS Code extension
    yaml_graph_core/            # NEW — standalone core library
        package.json
        tsconfig.json
        src/
            index.ts
            conversion-engine.ts
            mapping-loader.ts
            schema-validator.ts
            yaml-parser-wrapper.ts
            ast-node-transformer.ts
            types.ts
        test/
            conversion-engine.test.ts
            mapping-loader.test.ts
            schema-validator.test.ts
            yaml-parser-wrapper.test.ts
        graph-types/            # config-only diagram type packages
            flowchart/
                flowchart.schema.json
                flowchart.graph-map.yaml
            state-machine/
                state-machine.schema.json
                state-machine.graph-map.yaml
            er-diagram/
                er-diagram.schema.json
                er-diagram.graph-map.yaml
    yaml_graph_vscode/          # NEW — VS Code integration
        package.json
        tsconfig.json
        src/
            index.ts
            yaml-graph-editor-provider.ts
            webview-manager.ts
            selection-coordinator.ts
            post-message-protocol.ts
            vscode-callbacks.ts
            tree-data-builder.ts
            node-editor-controller.ts
        webview/                # HTML/CSS/JS for the webview
            index.html
            webview-main.ts
            tree-panel.ts
            node-editor-panel.ts
            mermaid-preview.ts
            styles.css
        test/
            yaml-graph-editor-provider.test.ts
```

### Why This Layout

- Matches the existing repo pattern (`tom_vscode_bridge/` and `tom_vscode_extension/` are already siblings)
- `yaml_graph_core/` can be extracted to its own npm package later without restructuring
- `graph-types/` lives inside `yaml_graph_core/` because the core engine loads them — any consumer of the core library also gets the built-in diagram types
- `yaml_graph_vscode/` depends on `yaml_graph_core/` via relative path (`"yaml-graph-core": "file:../yaml_graph_core"`)

---

## 3. yaml-graph-core — Core Library

### package.json

```json
{
    "name": "yaml-graph-core",
    "version": "0.1.0",
    "description": "YAML graph to Mermaid conversion engine with configurable mappings",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "scripts": {
        "build": "tsc",
        "test": "vitest run",
        "test:watch": "vitest"
    },
    "dependencies": {
        "yaml": "^2.6.0",
        "ajv": "^8.17.0"
    },
    "devDependencies": {
        "typescript": "^5.7.0",
        "vitest": "^3.0.0"
    }
}
```

### tsconfig.json

```json
{
    "compilerOptions": {
        "module": "Node16",
        "target": "ES2022",
        "lib": ["ES2022"],
        "outDir": "dist",
        "rootDir": "src",
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "strict": true,
        "moduleResolution": "Node16",
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
    },
    "include": ["src"],
    "exclude": ["node_modules", "dist", "test"]
}
```

### Core Types (src/types.ts)

```typescript
// ============================================================
// Graph Type — represents a registered diagram type
// ============================================================

export interface GraphType {
    /** Unique type id, e.g. 'flowchart', 'stateMachine' */
    id: string;

    /** File extension patterns, e.g. ['*.flow.yaml'] */
    filePatterns: string[];

    /** JSON Schema object for validating YAML source files */
    schema: object;

    /** Parsed mapping configuration from *.graph-map.yaml */
    mapping: GraphMapping;
}

// ============================================================
// Graph Mapping — parsed *.graph-map.yaml structure
// ============================================================

export interface GraphMapping {
    map: {
        id: string;
        mermaidType: string;
        directionField?: string;
        defaultDirection?: string;
    };

    nodeShapes: {
        sourcePath: string;
        idField: string;
        labelField: string;
        typeField: string;
        shapes: Record<string, string>;
        initialConnector?: string;
        finalConnector?: string;
    };

    edgeLinks: {
        sourcePath: string;
        fromField: string;
        toField: string;
        labelField?: string;
        linkStyles: Record<string, string>;
        labelTemplate?: string;
    };

    styleRules?: {
        field: string;
        rules: Record<string, {
            fill: string;
            stroke: string;
            color: string;
        }>;
    };

    annotations?: {
        sourceField: string;
        template: string;
    };

    transforms?: TransformRule[];

    customRenderer?: string;
}

// ============================================================
// Transform Rules — inline JS transforms in mapping files
// ============================================================

export interface TransformRule {
    /** 'node' (default) or 'edge' */
    scope?: 'node' | 'edge';

    /** Condition to match */
    match: {
        field: string;
        exists?: boolean;
        equals?: string | number | boolean;
        pattern?: string;  // regex pattern
    };

    /** JavaScript fragment — AstNodeTransformer body */
    js: string;
}

// ============================================================
// AstNodeTransformer — function signature for inline transforms
// ============================================================

export interface NodeData {
    id: string;
    type: string;
    fields: Record<string, unknown>;
}

export interface EdgeData {
    from: string;
    to: string;
    fields: Record<string, unknown>;
}

export interface TransformContext {
    allNodes: Map<string, NodeData>;
    allEdges: EdgeData[];
    mapping: GraphMapping;
    output: string[];
}

export type AstNodeTransformer = (
    element: NodeData | EdgeData,
    context: TransformContext
) => string[];

// ============================================================
// Conversion Callbacks — host-provided hooks
// ============================================================

export interface ConversionCallbacks {
    /**
     * Called once before conversion starts. Use to pre-compute async
     * data (file lookups, workspace queries) that synchronous emit
     * callbacks will reference via captured state on `this`.
     *
     * The engine calls this from convertWithPrepare(). Callers using
     * the synchronous convert() must call prepare() themselves.
     */
    prepare?: () => Promise<void>;

    /**
     * Called for each emitted node. Returns additional Mermaid lines
     * to append (e.g., click directives for navigation).
     */
    onNodeEmit?: (
        nodeId: string,
        nodeData: NodeData,
        emittedLines: string[]
    ) => string[];

    /**
     * Called for each emitted edge. Returns additional Mermaid lines.
     */
    onEdgeEmit?: (
        edgeData: EdgeData,
        emittedLines: string[]
    ) => string[];

    /**
     * Called once after all elements are emitted. Returns additional
     * Mermaid lines to append at the end.
     */
    onComplete?: (
        allNodeIds: string[],
        output: string[]
    ) => string[];
}

// ============================================================
// Conversion Result
// ============================================================

export interface SourceRange {
    startOffset: number;
    endOffset: number;
}

export interface ValidationError {
    path: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface ConversionResult {
    /** Generated Mermaid source text */
    mermaidSource: string;

    /** Schema validation errors/warnings */
    errors: ValidationError[];

    /** Map of node ID → YAML source byte range */
    nodeMap: Map<string, SourceRange>;

    /** Map of edge index → YAML source byte range */
    edgeMap: Map<number, SourceRange>;
}
```

### ConversionEngine API (src/conversion-engine.ts)

```typescript
import {
    GraphType, GraphMapping, ConversionCallbacks, ConversionResult,
    NodeData, EdgeData, TransformContext, SourceRange, ValidationError
} from './types.js';
import { YamlParserWrapper } from './yaml-parser-wrapper.js';
import { SchemaValidator } from './schema-validator.js';
import { AstNodeTransformerRuntime } from './ast-node-transformer.js';

export class ConversionEngine {
    private parser: YamlParserWrapper;
    private validator: SchemaValidator;
    private transformRuntime: AstNodeTransformerRuntime;

    constructor() {
        this.parser = new YamlParserWrapper();
        this.validator = new SchemaValidator();
        this.transformRuntime = new AstNodeTransformerRuntime();
    }

    /**
     * Convert a YAML source string to Mermaid using the given graph type
     * definition and optional callbacks.
     */
    convert(
        yamlText: string,
        graphType: GraphType,
        callbacks?: ConversionCallbacks
    ): ConversionResult {
        // 1. Parse YAML (comment-preserving)
        const parsed = this.parser.parse(yamlText);

        // 2. Validate against schema
        const errors = this.validator.validate(parsed.data, graphType.schema);

        // 3. Extract nodes and edges
        const { nodes, edges, nodeMap, edgeMap } = this.extractElements(
            parsed, graphType.mapping
        );

        // 4. Generate Mermaid output
        const mermaidSource = this.generateMermaid(
            nodes, edges, graphType.mapping, callbacks
        );

        return { mermaidSource, errors, nodeMap, edgeMap };
    }

    /**
     * Async wrapper: calls callbacks.prepare() first, then runs the
     * synchronous conversion pipeline. Use this from VS Code integration
     * where callbacks may need pre-computed async data.
     */
    async convertWithPrepare(
        yamlText: string,
        graphType: GraphType,
        callbacks?: ConversionCallbacks
    ): Promise<ConversionResult> {
        if (callbacks?.prepare) {
            await callbacks.prepare();
        }
        return this.convert(yamlText, graphType, callbacks);
    }

    private extractElements(
        parsed: ParsedYaml,
        mapping: GraphMapping
    ): {
        nodes: Map<string, NodeData>;
        edges: EdgeData[];
        nodeMap: Map<string, SourceRange>;
        edgeMap: Map<number, SourceRange>;
    } {
        // Walk YAML AST using mapping.nodeShapes.sourcePath
        // and mapping.edgeLinks.sourcePath to extract elements
        // and their source ranges.
        // ... implementation
    }

    private generateMermaid(
        nodes: Map<string, NodeData>,
        edges: EdgeData[],
        mapping: GraphMapping,
        callbacks?: ConversionCallbacks
    ): string {
        const output: string[] = [];
        const direction = mapping.map.defaultDirection ?? 'TD';
        output.push(`${mapping.map.mermaidType} ${direction}`);

        // Render nodes
        for (const [id, node] of nodes) {
            let lines = this.renderNode(id, node, mapping);

            // Apply matching transform (first match wins)
            lines = this.applyTransforms(
                node, 'node', lines, mapping, nodes, edges
            );

            // Invoke callback
            if (callbacks?.onNodeEmit) {
                const extra = callbacks.onNodeEmit(id, node, lines);
                lines = [...lines, ...extra];
            }

            output.push(...lines.map(l => '    ' + l));
        }

        // Render edges
        for (let i = 0; i < edges.length; i++) {
            let lines = this.renderEdge(edges[i], mapping);

            lines = this.applyTransforms(
                edges[i], 'edge', lines, mapping, nodes, edges
            );

            if (callbacks?.onEdgeEmit) {
                const extra = callbacks.onEdgeEmit(edges[i], lines);
                lines = [...lines, ...extra];
            }

            output.push(...lines.map(l => '    ' + l));
        }

        // Apply style rules
        if (mapping.styleRules) {
            for (const [id, node] of nodes) {
                const value = node.fields[mapping.styleRules.field];
                const rule = mapping.styleRules.rules[String(value)];
                if (rule) {
                    output.push(
                        `    style ${id} fill:${rule.fill},stroke:${rule.stroke},color:${rule.color}`
                    );
                }
            }
        }

        // Final callback
        if (callbacks?.onComplete) {
            const extra = callbacks.onComplete(
                Array.from(nodes.keys()), output
            );
            output.push(...extra);
        }

        return output.join('\n');
    }

    private renderNode(
        id: string, node: NodeData, mapping: GraphMapping
    ): string[] {
        const shapeTemplate = mapping.nodeShapes.shapes[node.type];
        if (!shapeTemplate) return [`${id}["${node.fields[mapping.nodeShapes.labelField]}"]`];

        const label = String(node.fields[mapping.nodeShapes.labelField] ?? id);
        const rendered = shapeTemplate
            .replace('{label}', label)
            .replace('{id}', id);
        return [id + rendered];
    }

    private renderEdge(edge: EdgeData, mapping: GraphMapping): string[] {
        const from = edge.from;
        const to = edge.to;
        const label = edge.fields[mapping.edgeLinks.labelField ?? 'label'];

        if (label) {
            const template = mapping.edgeLinks.labelTemplate
                ?? `${from} -->|"${label}"| ${to}`;
            return [template
                .replace('{from}', from)
                .replace('{to}', to)
                .replace('{label}', String(label))
            ];
        }

        const linkStyle = mapping.edgeLinks.linkStyles['default'] ?? '-->';
        return [`${from} ${linkStyle} ${to}`];
    }

    private applyTransforms(
        element: NodeData | EdgeData,
        scope: 'node' | 'edge',
        defaultLines: string[],
        mapping: GraphMapping,
        nodes: Map<string, NodeData>,
        edges: EdgeData[]
    ): string[] {
        if (!mapping.transforms) return defaultLines;

        for (const rule of mapping.transforms) {
            const ruleScope = rule.scope ?? 'node';
            if (ruleScope !== scope) continue;

            if (this.matchesCondition(element, rule.match)) {
                const ctx: TransformContext = {
                    allNodes: nodes,
                    allEdges: edges,
                    mapping,
                    output: defaultLines
                };
                return this.transformRuntime.execute(rule.js, element, ctx);
            }
        }

        return defaultLines;
    }

    private matchesCondition(
        element: NodeData | EdgeData,
        match: { field: string; exists?: boolean; equals?: unknown; pattern?: string }
    ): boolean {
        const fields = 'fields' in element ? element.fields : {};
        const value = fields[match.field];

        if (match.exists !== undefined) {
            return (value !== undefined) === match.exists;
        }
        if (match.equals !== undefined) {
            return value === match.equals;
        }
        if (match.pattern !== undefined) {
            return new RegExp(match.pattern).test(String(value ?? ''));
        }
        return false;
    }
}
```

### GraphTypeRegistry API (src/index.ts — registry portion)

```typescript
import { GraphType, GraphMapping } from './types.js';
import { MappingLoader } from './mapping-loader.js';

export class GraphTypeRegistry {
    private types = new Map<string, GraphType>();
    private filePatternMap = new Map<string, GraphType>();
    private loader = new MappingLoader();

    /** Register a graph type from its constituent parts. */
    register(graphType: GraphType): void {
        this.types.set(graphType.id, graphType);
        for (const pattern of graphType.filePatterns) {
            this.filePatternMap.set(pattern, graphType);
        }
    }

    /**
     * Register a graph type by loading schema.json and *.graph-map.yaml
     * from a directory.
     */
    async registerFromFolder(folderPath: string): Promise<void> {
        const graphType = await this.loader.loadFromFolder(folderPath);
        this.register(graphType);
    }

    /** Look up graph type by file extension/pattern. */
    getForFile(filename: string): GraphType | undefined {
        for (const [pattern, type] of this.filePatternMap) {
            if (this.matchesPattern(filename, pattern)) {
                return type;
            }
        }
        return undefined;
    }

    /** Get a graph type by its id. */
    getById(id: string): GraphType | undefined {
        return this.types.get(id);
    }

    /** List all registered graph type ids. */
    listIds(): string[] {
        return Array.from(this.types.keys());
    }

    private matchesPattern(filename: string, pattern: string): boolean {
        // Simple glob: *.flow.yaml → matches 'anything.flow.yaml'
        const ext = pattern.replace('*', '');
        return filename.endsWith(ext);
    }
}
```

### MappingLoader (src/mapping-loader.ts)

```typescript
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import { GraphType, GraphMapping } from './types.js';
import { SchemaValidator } from './schema-validator.js';

export class MappingLoader {
    private validator = new SchemaValidator();

    /**
     * Load a graph type from a folder containing:
     *   - *.schema.json (exactly one)
     *   - *.graph-map.yaml (exactly one)
     */
    async loadFromFolder(folderPath: string): Promise<GraphType> {
        const schemaFile = await this.findFile(folderPath, '.schema.json');
        const mappingFile = await this.findFile(folderPath, '.graph-map.yaml');

        const schemaText = await readFile(schemaFile, 'utf-8');
        const schema = JSON.parse(schemaText);

        const mappingText = await readFile(mappingFile, 'utf-8');
        const mappingRaw = parseYaml(mappingText);
        const mapping = this.normalizeMapping(mappingRaw);

        // Derive file patterns from mapping id
        // e.g., id: 'flowchart' → ['*.flow.yaml']
        const filePatterns = this.deriveFilePatterns(mapping);

        return {
            id: mapping.map.id,
            filePatterns,
            schema,
            mapping
        };
    }

    /**
     * Load mapping from a YAML string (for testing or embedded use).
     */
    loadMappingFromString(yamlText: string): GraphMapping {
        const raw = parseYaml(yamlText);
        return this.normalizeMapping(raw);
    }

    private normalizeMapping(raw: any): GraphMapping {
        // Convert kebab-case YAML keys to camelCase TypeScript interface.
        // e.g., 'node-shapes' → 'nodeShapes', 'source-path' → 'sourcePath'
        return {
            map: {
                id: raw.map.id,
                mermaidType: raw.map['mermaid-type'],
                directionField: raw.map['direction-field'],
                defaultDirection: raw.map['default-direction'],
            },
            nodeShapes: {
                sourcePath: raw['node-shapes']['source-path'],
                idField: raw['node-shapes']['id-field'],
                labelField: raw['node-shapes']['label-field'],
                typeField: raw['node-shapes']['type-field'],
                shapes: raw['node-shapes'].shapes,
                initialConnector: raw['node-shapes']['initial-connector'],
                finalConnector: raw['node-shapes']['final-connector'],
            },
            edgeLinks: {
                sourcePath: raw['edge-links']['source-path'],
                fromField: raw['edge-links']['from-field'],
                toField: raw['edge-links']['to-field'],
                labelField: raw['edge-links']['label-field'],
                linkStyles: raw['edge-links']['link-styles'],
                labelTemplate: raw['edge-links']['label-template'],
            },
            styleRules: raw['style-rules'] ? {
                field: raw['style-rules'].field,
                rules: raw['style-rules'].rules,
            } : undefined,
            annotations: raw.annotations ? {
                sourceField: raw.annotations['source-field'],
                template: raw.annotations.template,
            } : undefined,
            transforms: raw.transforms?.map((t: any) => ({
                scope: t.scope,
                match: t.match,
                js: t.js,
            })),
            customRenderer: raw['custom-renderer'],
        };
    }

    private deriveFilePatterns(mapping: GraphMapping): string[] {
        // Convention: mapping id → file extension
        const patternMap: Record<string, string[]> = {
            'flowchart': ['*.flow.yaml'],
            'stateMachine': ['*.state.yaml'],
            'erDiagram': ['*.er.yaml'],
            'classDiagram': ['*.class.yaml'],
        };
        return patternMap[mapping.map.id] ?? [`*.${mapping.map.id}.yaml`];
    }

    private async findFile(dir: string, suffix: string): Promise<string> {
        // Implementation: list directory, find file ending with suffix
        // Throws if not exactly one match
        const { readdir } = await import('fs/promises');
        const files = await readdir(dir);
        const matches = files.filter(f => f.endsWith(suffix));
        if (matches.length !== 1) {
            throw new Error(
                `Expected exactly one ${suffix} file in ${dir}, found ${matches.length}`
            );
        }
        return join(dir, matches[0]);
    }
}
```

### YamlParserWrapper (src/yaml-parser-wrapper.ts)

```typescript
import { parseDocument, Document, stringify, Scalar, YAMLMap, Pair } from 'yaml';
import { SourceRange } from './types.js';

export interface ParsedYaml {
    /** Parsed data as plain JavaScript object */
    data: Record<string, unknown>;

    /** The yaml AST Document (preserves comments and source ranges) */
    document: Document;

    /** Raw YAML text */
    text: string;
}

export class YamlParserWrapper {
    /**
     * Parse YAML text into data + AST (comment-preserving).
     */
    parse(yamlText: string): ParsedYaml {
        const document = parseDocument(yamlText);
        const data = document.toJSON() as Record<string, unknown>;
        return { data, document, text: yamlText };
    }

    /**
     * Get the source range of a node at the given YAML path.
     * Path segments are dot-separated: 'nodes.validate.label'
     */
    getSourceRange(parsed: ParsedYaml, path: string): SourceRange | undefined {
        const segments = path.split('.');
        const node = parsed.document.getIn(segments, true);
        if (node && typeof node === 'object' && 'range' in node) {
            const range = (node as any).range;
            if (Array.isArray(range) && range.length >= 2) {
                return { startOffset: range[0], endOffset: range[1] };
            }
        }
        return undefined;
    }

    /**
     * Edit a scalar value at the given path, preserving comments.
     * Returns the modified YAML text.
     */
    editValue(parsed: ParsedYaml, path: string, newValue: unknown): string {
        const segments = path.split('.');
        parsed.document.setIn(segments, newValue);
        return parsed.document.toString();
    }

    /**
     * Add a new map entry at the given path.
     * Returns the modified YAML text.
     */
    addMapEntry(
        parsed: ParsedYaml,
        parentPath: string,
        key: string,
        value: Record<string, unknown>
    ): string {
        const segments = parentPath.split('.');
        const parent = parsed.document.getIn(segments, true);
        if (parent instanceof YAMLMap) {
            parent.add(new Pair(new Scalar(key), parsed.document.createNode(value)));
        }
        return parsed.document.toString();
    }

    /**
     * Delete a map entry at the given path.
     * Returns the modified YAML text.
     */
    deleteEntry(parsed: ParsedYaml, path: string): string {
        const segments = path.split('.');
        parsed.document.deleteIn(segments);
        return parsed.document.toString();
    }
}
```

### AstNodeTransformerRuntime (src/ast-node-transformer.ts)

```typescript
import { NodeData, EdgeData, TransformContext } from './types.js';

export class AstNodeTransformerRuntime {
    /**
     * Execute a JavaScript fragment with the given element and context.
     * The fragment is wrapped in a function with `node`/`edge` and `ctx`
     * as parameters, depending on the element type.
     *
     * Returns the Mermaid lines produced by the fragment.
     */
    execute(
        jsFragment: string,
        element: NodeData | EdgeData,
        context: TransformContext
    ): string[] {
        try {
            const isNode = 'id' in element && 'type' in element;
            const paramName = isNode ? 'node' : 'edge';

            // Wrap the JS fragment in a function
            // Provides: node/edge, ctx
            const fn = new Function(
                paramName, 'ctx',
                jsFragment
            ) as (
                element: NodeData | EdgeData,
                ctx: TransformContext
            ) => string[];

            const result = fn(element, context);

            // Validate return type
            if (!Array.isArray(result)) {
                console.warn(
                    `Transform for ${isNode ? (element as NodeData).id : 'edge'} ` +
                    `did not return string[]. Got: ${typeof result}`
                );
                return context.output;
            }

            return result;
        } catch (error) {
            console.error('Transform execution error:', error);
            return context.output; // fall back to default output
        }
    }
}
```

### SchemaValidator (src/schema-validator.ts)

```typescript
import Ajv from 'ajv';
import { ValidationError } from './types.js';

export class SchemaValidator {
    private ajv: Ajv;

    constructor() {
        this.ajv = new Ajv({ allErrors: true, verbose: true });
    }

    /**
     * Validate data against a JSON Schema.
     * Returns an array of validation errors (empty if valid).
     */
    validate(data: unknown, schema: object): ValidationError[] {
        const validate = this.ajv.compile(schema);
        const valid = validate(data);

        if (valid) return [];

        return (validate.errors ?? []).map(err => ({
            path: err.instancePath || '/',
            message: err.message ?? 'Unknown validation error',
            severity: 'error' as const,
        }));
    }

    /**
     * Validate a mapping file against the graph-map JSON Schema.
     */
    validateMapping(mappingData: unknown, mappingSchema: object): ValidationError[] {
        return this.validate(mappingData, mappingSchema);
    }
}
```

### Public API (src/index.ts)

```typescript
// Core classes
export { ConversionEngine } from './conversion-engine.js';
export { GraphTypeRegistry } from './graph-type-registry.js';
export { MappingLoader } from './mapping-loader.js';
export { SchemaValidator } from './schema-validator.js';
export { YamlParserWrapper } from './yaml-parser-wrapper.js';
export { AstNodeTransformerRuntime } from './ast-node-transformer.js';

// Types
export type {
    GraphType,
    GraphMapping,
    ConversionCallbacks,
    ConversionResult,
    NodeData,
    EdgeData,
    TransformContext,
    TransformRule,
    SourceRange,
    ValidationError,
    AstNodeTransformer,
} from './types.js';

// Re-export ParsedYaml from wrapper
export type { ParsedYaml } from './yaml-parser-wrapper.js';
```

---

## 4. yaml-graph-vscode — VS Code Integration

### package.json

```json
{
    "name": "yaml-graph-vscode",
    "version": "0.1.0",
    "description": "VS Code custom editor integration for YAML graph files",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "scripts": {
        "build": "tsc",
        "test": "vitest run"
    },
    "dependencies": {
        "yaml-graph-core": "file:../yaml_graph_core"
    },
    "devDependencies": {
        "@types/vscode": "^1.96.0",
        "typescript": "^5.7.0",
        "vitest": "^3.0.0"
    }
}
```

### YamlGraphEditorProvider (src/yaml-graph-editor-provider.ts)

```typescript
import * as vscode from 'vscode';
import {
    ConversionEngine, GraphTypeRegistry, ConversionCallbacks,
    ConversionResult, GraphType
} from 'yaml-graph-core';
import { WebviewManager } from './webview-manager.js';
import { SelectionCoordinator } from './selection-coordinator.js';
import { TreeDataBuilder } from './tree-data-builder.js';
import { NodeEditorController } from './node-editor-controller.js';

export class YamlGraphEditorProvider implements vscode.CustomTextEditorProvider {
    private engine: ConversionEngine;
    private registry: GraphTypeRegistry;
    private callbacks: ConversionCallbacks;

    constructor(
        engine: ConversionEngine,
        registry: GraphTypeRegistry,
        callbacks: ConversionCallbacks
    ) {
        this.engine = engine;
        this.registry = registry;
        this.callbacks = callbacks;
    }

    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const graphType = this.registry.getForFile(document.fileName);
        if (!graphType) {
            vscode.window.showErrorMessage(
                `No graph type registered for ${document.fileName}`
            );
            return;
        }

        // Set up webview
        const webview = new WebviewManager(webviewPanel, graphType);
        const treeBuilder = new TreeDataBuilder(graphType);
        const nodeEditor = new NodeEditorController(graphType);
        const coordinator = new SelectionCoordinator(
            webview, document, treeBuilder, nodeEditor
        );

        // Initial render
        this.updateWebview(document, graphType, webview);

        // Listen for document changes (debounced ~1s)
        let debounceTimer: ReturnType<typeof setTimeout> | undefined;
        const changeListener = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.updateWebview(document, graphType, webview);
                }, 1000);
            }
        });

        // Listen for messages from webview
        webviewPanel.webview.onDidReceiveMessage(msg => {
            coordinator.handleWebviewMessage(msg, document);
        });

        // Cleanup
        webviewPanel.onDidDispose(() => {
            changeListener.dispose();
            clearTimeout(debounceTimer);
        });
    }

    private updateWebview(
        document: vscode.TextDocument,
        graphType: GraphType,
        webview: WebviewManager
    ): void {
        const yamlText = document.getText();
        // Use convertWithPrepare to allow async pre-computation
        this.engine.convertWithPrepare(yamlText, graphType, this.callbacks)
            .then(result => webview.update(yamlText, result));
    }
}
```

### VsCodeCallbacks (src/vscode-callbacks.ts)

```typescript
import * as vscode from 'vscode';
import { ConversionCallbacks, NodeData, EdgeData } from 'yaml-graph-core';

/**
 * VS Code-specific callback implementations that inject interactive
 * behavior into the Mermaid output.
 *
 * The prepare() method pre-computes async data (e.g., workspace file
 * existence) that the synchronous emit callbacks reference via `this`.
 */
export class VsCodeCallbacks implements ConversionCallbacks {
    private existingGraphFiles = new Set<string>();

    async prepare(): Promise<void> {
        const files = await vscode.workspace.findFiles(
            '**/*.{flow,state,er}.yaml'
        );
        this.existingGraphFiles = new Set(
            files.map(f => vscode.workspace.asRelativePath(f))
        );
    }

    onNodeEmit(
        nodeId: string,
        _nodeData: NodeData,
        _emittedLines: string[]
    ): string[] {
        // Inject click callback for jump-to-tree and jump-to-YAML
        return [`click ${nodeId} callback "${nodeId}"`];
    }

    onEdgeEmit(
        _edgeData: EdgeData,
        _emittedLines: string[]
    ): string[] {
        return [];
    }

    onComplete(
        _allNodeIds: string[],
        _output: string[]
    ): string[] {
        return [];
    }
}
```

### SelectionCoordinator (src/selection-coordinator.ts)

```typescript
import * as vscode from 'vscode';
import { YamlParserWrapper } from 'yaml-graph-core';
import { WebviewManager } from './webview-manager.js';
import { TreeDataBuilder } from './tree-data-builder.js';
import { NodeEditorController } from './node-editor-controller.js';

/**
 * Coordinates selection state across all four panes:
 * tree panel, Mermaid preview, YAML text, node editor.
 */
export class SelectionCoordinator {
    private webview: WebviewManager;
    private document: vscode.TextDocument;
    private treeBuilder: TreeDataBuilder;
    private nodeEditor: NodeEditorController;
    private parser = new YamlParserWrapper();

    constructor(
        webview: WebviewManager,
        document: vscode.TextDocument,
        treeBuilder: TreeDataBuilder,
        nodeEditor: NodeEditorController
    ) {
        this.webview = webview;
        this.document = document;
        this.treeBuilder = treeBuilder;
        this.nodeEditor = nodeEditor;
    }

    handleWebviewMessage(
        msg: { type: string; [key: string]: unknown },
        document: vscode.TextDocument
    ): void {
        switch (msg.type) {
            case 'nodeClicked':
                this.onNodeSelected(String(msg.nodeId), document);
                break;
            case 'treeNodeSelected':
                this.onNodeSelected(String(msg.nodeId), document);
                break;
            case 'applyEdit':
                this.onApplyEdit(msg as any, document);
                break;
        }
    }

    private onNodeSelected(nodeId: string, document: vscode.TextDocument): void {
        const parsed = this.parser.parse(document.getText());

        // 1. Highlight in tree
        this.webview.selectTreeNode(nodeId);

        // 2. Highlight in Mermaid
        this.webview.highlightMermaidNode(nodeId);

        // 3. Reveal in YAML
        const range = this.parser.getSourceRange(parsed, `nodes.${nodeId}`);
        if (range) {
            // Convert byte offsets to VS Code positions
            const startPos = document.positionAt(range.startOffset);
            const endPos = document.positionAt(range.endOffset);
            const vsRange = new vscode.Range(startPos, endPos);
            // Reveal in text editor if visible
            for (const editor of vscode.window.visibleTextEditors) {
                if (editor.document.uri.toString() === document.uri.toString()) {
                    editor.revealRange(vsRange, vscode.TextEditorRevealType.InCenter);
                    editor.selection = new vscode.Selection(startPos, endPos);
                }
            }
        }

        // 4. Update node editor panel
        const nodeData = (parsed.data as any)?.nodes?.[nodeId];
        if (nodeData) {
            this.nodeEditor.showNode(nodeId, nodeData);
        }
    }

    private async onApplyEdit(
        msg: { nodeId: string; changes: Record<string, unknown> },
        document: vscode.TextDocument
    ): Promise<void> {
        const parsed = this.parser.parse(document.getText());

        // Apply each changed field
        let updatedText = parsed.document.toString();
        for (const [field, value] of Object.entries(msg.changes)) {
            const path = `nodes.${msg.nodeId}.${field}`;
            updatedText = this.parser.editValue(
                this.parser.parse(updatedText), path, value
            );
        }

        // Write back to document
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        edit.replace(document.uri, fullRange, updatedText);
        await vscode.workspace.applyEdit(edit);
    }
}
```

### Public API (src/index.ts)

```typescript
export { YamlGraphEditorProvider } from './yaml-graph-editor-provider.js';
export { VsCodeCallbacks } from './vscode-callbacks.js';
export { WebviewManager } from './webview-manager.js';
export { SelectionCoordinator } from './selection-coordinator.js';
export { TreeDataBuilder } from './tree-data-builder.js';
export { NodeEditorController } from './node-editor-controller.js';
```

---

## 5. Diagram Type Packages

Each diagram type is a self-contained folder with two files. No TypeScript.

### flowchart/

`flowchart.schema.json` — validates `*.flow.yaml` files  
`flowchart.graph-map.yaml` — converts YAML → Mermaid flowchart

### state-machine/

`state-machine.schema.json` — validates `*.state.yaml` files  
`state-machine.graph-map.yaml` — converts YAML → Mermaid stateDiagram-v2

### er-diagram/

`er-diagram.schema.json` — validates `*.er.yaml` files  
`er-diagram.graph-map.yaml` — converts YAML → Mermaid erDiagram

See Section 6 for the complete draft schemas and Section 7 for the mapping
file format.

---

## 6. Schemas

### 6.1 Flow Diagram JSON Schema (flowchart.schema.json)

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "flowchart.schema.json",
    "title": "Flow Diagram",
    "description": "YAML schema for flowchart/process-flow diagrams",
    "type": "object",
    "required": ["meta", "nodes", "edges"],
    "properties": {
        "meta": {
            "type": "object",
            "required": ["id", "title"],
            "properties": {
                "id": {
                    "type": "string",
                    "pattern": "^[a-z][a-z0-9-]*$",
                    "description": "Unique diagram identifier"
                },
                "title": { "type": "string" },
                "version": { "type": "integer", "minimum": 1, "default": 1 },
                "direction": {
                    "type": "string",
                    "enum": ["TD", "LR", "BT", "RL"],
                    "default": "TD"
                },
                "description": { "type": "string" }
            }
        },
        "nodes": {
            "type": "object",
            "additionalProperties": {
                "$ref": "#/$defs/node"
            },
            "minProperties": 1
        },
        "edges": {
            "type": "array",
            "items": { "$ref": "#/$defs/edge" },
            "minItems": 0
        }
    },
    "$defs": {
        "node": {
            "type": "object",
            "required": ["type", "label"],
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["start", "end", "process", "decision", "subprocess"]
                },
                "label": { "type": "string" },
                "status": {
                    "type": "string",
                    "enum": ["planned", "implemented", "deprecated"]
                },
                "owner": { "type": "string" },
                "tags": {
                    "type": "array",
                    "items": { "type": "string" }
                },
                "description": { "type": "string" }
            }
        },
        "edge": {
            "type": "object",
            "required": ["from", "to"],
            "properties": {
                "from": { "type": "string" },
                "to": { "type": "string" },
                "label": { "type": "string" },
                "style": {
                    "type": "string",
                    "enum": ["default", "dotted", "thick"],
                    "default": "default"
                }
            }
        }
    }
}
```

### 6.2 State Machine JSON Schema (state-machine.schema.json)

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "state-machine.schema.json",
    "title": "State Machine",
    "description": "YAML schema for state machine / lifecycle diagrams",
    "type": "object",
    "required": ["meta", "states", "transitions"],
    "properties": {
        "meta": {
            "type": "object",
            "required": ["id", "title"],
            "properties": {
                "id": {
                    "type": "string",
                    "pattern": "^[a-z][a-z0-9-]*$"
                },
                "title": { "type": "string" },
                "version": { "type": "integer", "minimum": 1, "default": 1 },
                "description": { "type": "string" }
            }
        },
        "states": {
            "type": "object",
            "additionalProperties": {
                "$ref": "#/$defs/state"
            },
            "minProperties": 1
        },
        "transitions": {
            "type": "array",
            "items": { "$ref": "#/$defs/transition" },
            "minItems": 0
        }
    },
    "$defs": {
        "state": {
            "type": "object",
            "required": ["type", "label"],
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["initial", "state", "final", "composite"]
                },
                "label": { "type": "string" },
                "entry-action": { "type": "string" },
                "exit-action": { "type": "string" },
                "description": { "type": "string" },
                "tags": {
                    "type": "array",
                    "items": { "type": "string" }
                }
            }
        },
        "transition": {
            "type": "object",
            "required": ["from", "to", "event"],
            "properties": {
                "from": { "type": "string" },
                "to": { "type": "string" },
                "event": { "type": "string" },
                "guard": { "type": "string" },
                "action": { "type": "string" }
            }
        }
    }
}
```

### 6.3 ER Diagram JSON Schema (er-diagram.schema.json)

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "er-diagram.schema.json",
    "title": "ER Diagram",
    "description": "YAML schema for entity-relationship diagrams",
    "type": "object",
    "required": ["meta", "entities"],
    "properties": {
        "meta": {
            "type": "object",
            "required": ["id", "title"],
            "properties": {
                "id": {
                    "type": "string",
                    "pattern": "^[a-z][a-z0-9-]*$"
                },
                "title": { "type": "string" },
                "version": { "type": "integer", "minimum": 1, "default": 1 },
                "description": { "type": "string" }
            }
        },
        "entities": {
            "type": "object",
            "additionalProperties": {
                "$ref": "#/$defs/entity"
            },
            "minProperties": 1
        },
        "relationships": {
            "type": "array",
            "items": { "$ref": "#/$defs/relationship" },
            "default": []
        }
    },
    "$defs": {
        "entity": {
            "type": "object",
            "required": ["attributes"],
            "properties": {
                "attributes": {
                    "type": "array",
                    "items": { "$ref": "#/$defs/attribute" },
                    "minItems": 1
                },
                "description": { "type": "string" }
            }
        },
        "attribute": {
            "type": "object",
            "required": ["name", "type"],
            "properties": {
                "name": { "type": "string" },
                "type": { "type": "string" },
                "key": {
                    "type": "string",
                    "enum": ["PK", "FK", "UK"]
                },
                "nullable": { "type": "boolean", "default": true }
            }
        },
        "relationship": {
            "type": "object",
            "required": ["from", "to", "type"],
            "properties": {
                "from": { "type": "string" },
                "to": { "type": "string" },
                "type": {
                    "type": "string",
                    "enum": [
                        "one-to-one",
                        "one-to-many",
                        "many-to-one",
                        "many-to-many"
                    ]
                },
                "label": { "type": "string" }
            }
        }
    }
}
```

### 6.4 Graph Mapping File JSON Schema (graph-map.schema.json)

This schema validates `*.graph-map.yaml` files themselves.

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "graph-map.schema.json",
    "title": "Graph Mapping",
    "description": "Schema for *.graph-map.yaml mapping configuration files",
    "type": "object",
    "required": ["map", "node-shapes", "edge-links"],
    "properties": {
        "map": {
            "type": "object",
            "required": ["id", "mermaid-type"],
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique identifier for this graph type"
                },
                "mermaid-type": {
                    "type": "string",
                    "description": "Mermaid diagram type keyword",
                    "enum": [
                        "flowchart", "stateDiagram-v2", "erDiagram",
                        "classDiagram", "sequenceDiagram", "mindmap"
                    ]
                },
                "direction-field": {
                    "type": "string",
                    "description": "YAML path to direction value (e.g., meta.direction)"
                },
                "default-direction": {
                    "type": "string",
                    "enum": ["TD", "LR", "BT", "RL"]
                }
            }
        },
        "node-shapes": {
            "type": "object",
            "required": ["source-path", "id-field", "label-field", "type-field", "shapes"],
            "properties": {
                "source-path": {
                    "type": "string",
                    "description": "YAML path to the nodes collection"
                },
                "id-field": {
                    "type": "string",
                    "description": "Field for node ID (_key = YAML map key)"
                },
                "label-field": { "type": "string" },
                "type-field": { "type": "string" },
                "shapes": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "string",
                        "description": "Mermaid shape template with {label} and {id} placeholders"
                    }
                },
                "initial-connector": { "type": "string" },
                "final-connector": { "type": "string" }
            }
        },
        "edge-links": {
            "type": "object",
            "required": ["source-path", "from-field", "to-field"],
            "properties": {
                "source-path": { "type": "string" },
                "from-field": { "type": "string" },
                "to-field": { "type": "string" },
                "label-field": { "type": "string" },
                "link-styles": {
                    "type": "object",
                    "additionalProperties": { "type": "string" }
                },
                "label-template": { "type": "string" }
            }
        },
        "style-rules": {
            "type": "object",
            "properties": {
                "field": { "type": "string" },
                "rules": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "fill": { "type": "string" },
                            "stroke": { "type": "string" },
                            "color": { "type": "string" }
                        }
                    }
                }
            }
        },
        "annotations": {
            "type": "object",
            "properties": {
                "source-field": { "type": "string" },
                "template": { "type": "string" }
            }
        },
        "transforms": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["match", "js"],
                "properties": {
                    "scope": {
                        "type": "string",
                        "enum": ["node", "edge"],
                        "default": "node"
                    },
                    "match": {
                        "type": "object",
                        "required": ["field"],
                        "properties": {
                            "field": { "type": "string" },
                            "exists": { "type": "boolean" },
                            "equals": {},
                            "pattern": { "type": "string" }
                        }
                    },
                    "js": {
                        "type": "string",
                        "description": "JavaScript fragment (AstNodeTransformer body)"
                    }
                }
            }
        },
        "custom-renderer": {
            "type": "string",
            "description": "Name of a registered custom renderer (overrides mapping)"
        }
    }
}
```

---

## 7. Mapping File Schema & Format

The mapping file is the heart of configuration-only conversion. See the draft
schema above (Section 6.4). The key design decisions:

### Template Placeholders

| Placeholder | Resolves To |
|-------------|-------------|
| `{label}` | Value of the configured `label-field` |
| `{id}` | Node/state ID (map key or configured id-field) |
| `{from}` | Edge source node ID |
| `{to}` | Edge target node ID |
| `{field-name}` | Any field name from the source YAML node |

### Special Values

| Value | Meaning |
|-------|---------|
| `_key` | The YAML map key itself (not a field within the value) |
| `[*]` | Mermaid's start/end pseudo-state marker |

### Transform Matching Rules

Transforms match top-down; first match wins. Match conditions:

| Condition | Meaning |
|-----------|---------|
| `exists: true` | Field is present and not `undefined` |
| `exists: false` | Field is absent or `undefined` |
| `equals: value` | Field equals the given literal value |
| `pattern: regex` | Field matches the given regex pattern |

Multiple conditions on the same `match` block are AND-combined.

---

## 8. Conversion Engine — Detailed Design

### Processing Pipeline

```
Input: YAML text + GraphType (schema + mapping) + optional Callbacks

    ┌──────────────┐
    │  Parse YAML   │  yaml npm parseDocument() → AST + data
    └──────┬───────┘
           │
    ┌──────▼───────┐
    │ Validate      │  ajv validate(data, schema) → errors[]
    └──────┬───────┘
           │
    ┌──────▼───────┐
    │ Extract       │  Walk AST using mapping paths → nodes, edges,
    │ Elements      │  source ranges (nodeMap, edgeMap)
    └──────┬───────┘
           │
    ┌──────▼───────┐
    │ Generate      │  For each node: render shape → apply transform →
    │ Mermaid       │  invoke callback. Same for edges. Apply styles.
    └──────┬───────┘
           │
    ┌──────▼───────┐
    │ Return        │  ConversionResult { mermaidSource, errors,
    │ Result        │  nodeMap, edgeMap }
    └──────────────┘
```

### Transform Execution Order

For each element (node or edge):
1. Render using declarative mapping rules → `defaultLines: string[]`
2. Check transforms array top-down for first matching condition
3. If matched: execute JS fragment → `transformedLines: string[]`
4. Invoke callback (`onNodeEmit` / `onEdgeEmit`) → `extraLines: string[]`
5. Final output for this element = transformedLines + extraLines

Transforms **replace** default output. Callbacks **append** to it.

### Error Handling

| Error Type | Behavior |
|-----------|----------|
| YAML syntax error | Return empty mermaidSource + parse error in errors[] |
| Schema validation error | Continue conversion (best-effort) + include in errors[] |
| Transform JS error | Log warning, fall back to default declarative output |
| Missing shape for node type | Use fallback rectangle shape with warning |
| Missing node referenced by edge | Include edge with warning in errors[] |

---

## 9. YAML Parser Wrapper

### Design Decisions

- Uses `yaml` npm package v2 (the `parseDocument()` API, not the deprecated v1)
- All edits go through the AST — never through regex or string manipulation
- Comments attached to nodes are preserved because `Document.setIn()` modifies
  only the value, not surrounding comments
- Source ranges use byte offsets from the `range` property on AST nodes

### Comment Preservation Strategy

```
Original:
    validate:
        type: process       # Auth step
        label: Validate input

After tree edit (label changed):
    validate:
        type: process       # Auth step
        label: New label text
```

The `# Auth step` comment is preserved because:
1. We parse with `parseDocument()` → full AST with comments
2. We set only `document.setIn(['nodes', 'validate', 'label'], 'New label text')`
3. We serialize with `document.toString()` — comments are part of the AST

### Limitations

- Moving nodes (reordering YAML) may lose comments between the moved node
  and adjacent nodes
- Adding entirely new nodes appends them at the end of the map (or uses
  `YAMLMap.add()` which places at end with no comments)

---

## 10. Webview Architecture

The custom editor uses a single webview split into regions:

```
┌───────────────────────────────────────────────────────────┐
│  Webview (single HTML document)                           │
├──────────────────────┬────────────────────────────────────┤
│  #tree-container     │  #preview-container                │
│                      │                                    │
│  <div id="tree">     │  <div id="mermaid-output">         │
│    Tree DOM           │    SVG rendered by mermaid.js      │
│  </div>              │  </div>                            │
│                      │                                    │
│  #node-editor        │                                    │
│  <div id="editor">   │                                    │
│    Form fields        │                                    │
│  </div>              │                                    │
├──────────────────────┴────────────────────────────────────┤
│  #status-bar                                              │
│  Validation errors, warnings                              │
└───────────────────────────────────────────────────────────┘
```

### Webview Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Tree panel | Plain DOM + CSS | Simple, no framework dependency. Expandable/collapsible `<ul>` tree with icons. |
| Node editor | Plain DOM forms | `<input>`, `<select>`, rendered from schema metadata. |
| Mermaid preview | mermaid.js (bundled) | Official library, renders SVG in-place. |
| Styling | CSS custom properties | Adapts to VS Code theme (dark/light). |
| Split pane | CSS flexbox + resize handle | No external dependency for resizing. |

### Webview → Extension Communication

All communication uses `postMessage`. The webview never directly accesses the
file system or VS Code API. See Section 11 for the protocol definition.

### Node Editor — Schema-Driven Form Architecture

The node editor panel is a **key challenge** of the project. It must be able to
edit any data structure that occurs in any graph type — scalars, enums, arrays,
nested objects, and combinations thereof. Associated metadata in graph types can
contain arbitrarily complex sub-structures (e.g., ER diagram attributes are
arrays of objects, state machines have nested composite states).

The solution is a **recursive, JSON Schema-driven form renderer**.

#### Design Principle

Given a JSON Schema sub-tree and a YAML value, the node editor renders the
appropriate editor widget. For compound types (array, object), it recurses into
child schemas. Every form element tracks its **JSON pointer path** relative to
the node root (e.g., `attributes[2].name`), so edits produce precise
`{ path, value }` pairs that map directly to `Document.setIn()` calls on the
YAML AST.

#### Schema-to-Widget Mapping

| JSON Schema Type | Widget | Notes |
|-----------------|--------|-------|
| `string` | `<input type="text">` | Multi-line if `format: 'multiline'` → `<textarea>` |
| `string` + `enum` | `<select>` | Options derived from schema `enum` array |
| `number` / `integer` | `<input type="number">` | Respects `minimum`, `maximum` from schema |
| `boolean` | `<input type="checkbox">` | |
| `array` of scalars | Tag-list widget | Inline chips with add/remove |
| `array` of objects | Expandable item list | Each item rendered as collapsible fieldset |
| `object` | Collapsible fieldset | Child properties rendered recursively |
| `object` + `additionalProperties` | Key-value table | Free-form key + typed value editor |

#### Recursive Rendering Architecture

```
NodeEditorPanel
├── renderFieldGroup(schema, value, basePath)
│   └── for each property in schema.properties:
│       └── renderField(propSchema, propValue, basePath + "." + propName)
│
├── renderField(schema, value, path)   ← dispatch
│   ├── if schema.enum           → renderEnum(schema, value, path)
│   ├── if schema.type=string    → renderScalar('text', value, path)
│   ├── if schema.type=number    → renderScalar('number', value, path)
│   ├── if schema.type=boolean   → renderScalar('checkbox', value, path)
│   ├── if schema.type=array     → renderArray(schema, value, path)
│   └── if schema.type=object    → renderObject(schema, value, path)
│
├── renderArray(schema, value, path)
│   ├── Header: "field-name (3 items)" [+ Add]
│   └── for each item at index i:
│       ├── [▲ ▼ ✕] reorder/delete controls
│       └── renderField(schema.items, value[i], path + "[" + i + "]")
│
└── renderObject(schema, value, path)
    ├── Collapsible header: "field-name" [▾]
    └── renderFieldGroup(schema, value, path)
```

#### Example: ER Diagram Entity

When a user selects an entity node in an ER diagram, the node editor receives:

```yaml
# YAML source (entity 'user')
user:
  attributes:
    - name: id
      type: integer
      key: PK
      nullable: false
    - name: email
      type: varchar(255)
      key: UK
      nullable: false
  description: Main user account table
```

The schema-driven renderer produces:

```
┌─────────────────────────────────────┐
│ Node: user                          │
├─────────────────────────────────────┤
│ description  [Main user account ta] │
│                                     │
│ ▾ attributes (2 items)        [+]   │
│   ┌─ [0] ──────────── [▲ ▼ ✕] ──┐  │
│   │ name      [id               ] │  │
│   │ type      [integer          ] │  │
│   │ key       [PK ▾             ] │  │
│   │ nullable  [ ]                 │  │
│   └───────────────────────────────┘  │
│   ┌─ [1] ──────────── [▲ ▼ ✕] ──┐  │
│   │ name      [email            ] │  │
│   │ type      [varchar(255)     ] │  │
│   │ key       [UK ▾             ] │  │
│   │ nullable  [ ]                 │  │
│   └───────────────────────────────┘  │
├─────────────────────────────────────┤
│           [Apply]  [Reset]          │
└─────────────────────────────────────┘
```

#### FieldSchema Types (recursive)

These replace the flat `FieldDefinition` interface:

```typescript
/** A schema-driven field descriptor for the node editor form. */
type FieldSchema =
    | ScalarFieldSchema
    | EnumFieldSchema
    | ArrayFieldSchema
    | ObjectFieldSchema;

interface BaseFieldSchema {
    /** JSON pointer path relative to node root, e.g. "label", "metadata.priority" */
    path: string;
    label: string;
    required: boolean;
    description?: string;
}

interface ScalarFieldSchema extends BaseFieldSchema {
    fieldType: 'string' | 'number' | 'boolean';
    multiline?: boolean;  // string with format: 'multiline'
    minimum?: number;     // number constraints
    maximum?: number;
}

interface EnumFieldSchema extends BaseFieldSchema {
    fieldType: 'enum';
    options: string[];
}

interface ArrayFieldSchema extends BaseFieldSchema {
    fieldType: 'array';
    /** Schema for each array item (recursive) */
    itemSchema: FieldSchema;
    minItems?: number;
    maxItems?: number;
}

interface ObjectFieldSchema extends BaseFieldSchema {
    fieldType: 'object';
    /** Child field schemas (recursive) */
    properties: FieldSchema[];
    /** Whether to allow free-form additional properties */
    allowAdditional?: boolean;
}
```

#### Schema Resolution Pipeline

Before sending field schemas to the webview, the extension host must:

1. **Resolve `$ref` references** — JSON Schema `$ref` pointers are resolved
   against `$defs` to produce a self-contained schema tree. This happens once
   per graph type at registration time.
2. **Extract node sub-schema** — for a given node, extract the relevant object
   schema from the graph type's full schema (using `nodeShapes.sourcePath`).
3. **Build `FieldSchema[]` tree** — walk the resolved sub-schema recursively,
   creating the `FieldSchema` tree that the webview renderer consumes.
4. **Send via `showNode`** — the `FieldSchema[]` tree is sent once per node
   selection; the webview caches it until the graph type changes.

#### YAML AST Integration for Nested Edits

The webview sends edits as `{ path, value }` pairs where `path` is a JSON
pointer (e.g., `attributes[1].name`). The extension host translates this to
`yaml` npm AST operations:

```typescript
// JSON pointer "attributes[1].name" → YAML setIn path
function jsonPointerToYamlPath(
    basePath: string, pointer: string
): (string | number)[] {
    // "nodes.user" + "attributes[1].name"
    // → ['nodes', 'user', 'attributes', 1, 'name']
    const parts: (string | number)[] = basePath.split('.');
    for (const segment of pointer.split('.')) {
        const arrayMatch = segment.match(/^(.+)\[(\d+)\]$/);
        if (arrayMatch) {
            parts.push(arrayMatch[1], Number(arrayMatch[2]));
        } else {
            parts.push(segment);
        }
    }
    return parts;
}

// Usage:
const yamlPath = jsonPointerToYamlPath(
    'entities.user', 'attributes[1].name'
);
document.setIn(yamlPath, 'email_address');
```

#### Key Challenges

| Challenge | Approach |
|-----------|----------|
| `$ref` resolution before webview | One-time resolver at graph type registration; store resolved schema on `GraphType` |
| Array item reordering in YAML | Delete item at old index, insert at new index via AST. Comments on the moved item may be lost — document this limitation. |
| Deep nesting usability | Collapsible sections with depth indicator. Limit initial expansion to 2 levels; deeper levels collapsed by default. |
| `additionalProperties: true` | Show key-value table with "+ Add property" button. Keys are free-text `<input>`. |
| Large arrays (50+ items) | Virtual scrolling — render only visible items. Show total count in header. |
| Schema changes between graph types | Rebuild form completely on graph type switch. Cache `FieldSchema[]` per graph type. |

---

## 11. PostMessage Protocol

### Webview → Extension Host

```typescript
/** Messages sent from webview to extension host. */
type WebviewMessage =
    | { type: 'nodeClicked'; nodeId: string }
    | { type: 'treeNodeSelected'; nodeId: string }
    | { type: 'applyEdit'; nodeId: string;
        edits: Array<{ path: string; value: unknown }> }
    | { type: 'addNode'; parentPath: string; nodeType: string; nodeId: string }
    | { type: 'deleteNode'; nodeId: string }
    | { type: 'addEdge'; from: string; to: string; label?: string }
    | { type: 'deleteEdge'; index: number }
    | { type: 'reorderArrayItem'; nodeId: string; path: string;
        fromIndex: number; toIndex: number }
    | { type: 'addArrayItem'; nodeId: string; path: string }
    | { type: 'deleteArrayItem'; nodeId: string; path: string; index: number }
    | { type: 'requestExportSvg' }
    | { type: 'changeDirection'; direction: 'TD' | 'LR' | 'BT' | 'RL' };
```

### Extension Host → Webview

```typescript
/** Messages sent from extension host to webview. */
type ExtensionMessage =
    | { type: 'updateAll'; yamlText: string; mermaidSource: string;
        treeData: TreeNode[]; errors: ValidationError[] }
    | { type: 'selectNode'; nodeId: string }
    | { type: 'highlightMermaidNode'; nodeId: string }
    | { type: 'showNode'; nodeId: string; nodeData: unknown;
        schema: FieldSchema[] }
    | { type: 'showErrors'; errors: ValidationError[] }
    | { type: 'clearNodeEditor' };

interface TreeNode {
    id: string;
    label: string;
    type: string;
    icon: string;
    children?: TreeNode[];
    expanded?: boolean;
}

// FieldSchema types are defined in Section 10 — Node Editor
// (ScalarFieldSchema, EnumFieldSchema, ArrayFieldSchema, ObjectFieldSchema)
}
```

---

## 12. Extension Integration

### Registration in extension.ts

```typescript
import * as vscode from 'vscode';
import { ConversionEngine, GraphTypeRegistry } from 'yaml-graph-core';
import { YamlGraphEditorProvider, VsCodeCallbacks } from 'yaml-graph-vscode';

export async function activateYamlGraphEditor(
    context: vscode.ExtensionContext
): Promise<void> {
    // 1. Core engine (no VS Code dependency)
    const engine = new ConversionEngine();
    const registry = new GraphTypeRegistry();

    // 2. Register built-in diagram types
    const graphTypesPath = context.extensionPath + '/graph-types';
    await registry.registerFromFolder(graphTypesPath + '/flowchart');
    await registry.registerFromFolder(graphTypesPath + '/state-machine');
    await registry.registerFromFolder(graphTypesPath + '/er-diagram');

    // 3. VS Code integration with callbacks
    const callbacks = new VsCodeCallbacks();
    const provider = new YamlGraphEditorProvider(engine, registry, callbacks);

    // 4. Register custom editor
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'yamlGraph.editor',
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );
}
```

### package.json contributions (in tom_vscode_extension)

```json
{
    "contributes": {
        "customEditors": [
            {
                "viewType": "yamlGraph.editor",
                "displayName": "YAML Graph Editor",
                "selector": [
                    { "filenamePattern": "*.flow.yaml" },
                    { "filenamePattern": "*.state.yaml" },
                    { "filenamePattern": "*.er.yaml" },
                    { "filenamePattern": "*.class.yaml" }
                ],
                "priority": "default"
            }
        ]
    }
}
```

### Build Integration

The extension's build process needs to:
1. Build `yaml_graph_core` first (`cd ../yaml_graph_core && npm run build`)
2. Build `yaml_graph_vscode` second (`cd ../yaml_graph_vscode && npm run build`)
3. Bundle both into the extension's output via npm workspace or explicit copy
4. Copy `graph-types/` folders into the extension's output directory

This can be handled through npm workspaces or a simple build script.

---

## 13. Testing Strategy

### yaml-graph-core Tests

| Test Category | What to Test |
|---------------|-------------|
| **ConversionEngine** | YAML → Mermaid for each built-in graph type. Snapshot tests comparing expected Mermaid output. |
| **MappingLoader** | Loads from folder, validates mapping files, handles missing files gracefully. |
| **SchemaValidator** | Valid YAML passes, invalid YAML returns structured errors with paths. |
| **YamlParserWrapper** | Parse → edit → serialize preserves comments. Source range lookup returns correct offsets. |
| **AstNodeTransformerRuntime** | Execute JS fragments, handle errors gracefully, validate return types. |
| **Transform matching** | Correct condition evaluation (exists, equals, pattern). First-match-wins behavior. |
| **Callbacks** | Verify callbacks are invoked with correct arguments, their output is appended. |

### End-to-End Conversion Tests

For each diagram type, maintain a set of test fixtures:

```
test/fixtures/
    flowchart/
        simple.flow.yaml           # input
        simple.expected.mermaid    # expected output
    state-machine/
        order-lifecycle.state.yaml
        order-lifecycle.expected.mermaid
    er-diagram/
        user-schema.er.yaml
        user-schema.expected.mermaid
```

### yaml-graph-vscode Tests

| Test Category | What to Test |
|---------------|-------------|
| **EditorProvider** | Resolves correct graph type for file. Handles unknown file types. |
| **SelectionCoordinator** | Selection from tree propagates to preview. Selection from Mermaid propagates to tree. |
| **PostMessage** | Correct message types sent for each interaction. |

### Test Framework

- **yaml-graph-core:** `vitest` (fast, TypeScript-native, no VS Code dependency)
- **yaml-graph-vscode:** `@vscode/test-electron` for integration tests that
  require the VS Code API

---

## 14. Open Questions

### Resolved Questions

These questions were raised during the design process and have been resolved:

| # | Question | Decision | Notes |
|---|----------|----------|-------|
| 1 | Should the ER diagram mapping use the generic node/edge model, or does it need a separate entity/relationship model? | **Use generic model** with special shape templates | May need mapping format extensions later, but start generic |
| 2 | How should composite/nested states be handled in the mapping format? | **Inline JS transforms** for nesting | If a dedicated `children`/`subgraph` mapping concept proves necessary, it can be added as a mapping extension |
| 3 | Should `MappingLoader` support loading from URLs (for external/shared diagram types)? | **File system only** for now | Easy to add URL loading later if shared diagram types become a need |
| 4 | Should the webview use a framework (Lit, Svelte) or stay framework-free? | **Plain DOM** | Revisit if webview complexity warrants a framework |
| 5 | How to handle Mermaid configuration (theme, font size, etc.)? | **CSS-based**, adjustable per diagram type | Each graph type can provide a CSS file or CSS variables block. The webview injects the appropriate CSS based on the active graph type. VS Code theme CSS variables serve as defaults. |
| 6 | Should the graph-type folders support an optional `README.md` or metadata file? | **Not needed initially** | Nice for discoverability, can add later |
| 7 | How should the build process bundle `yaml-graph-core` into the extension? | **npm workspace** | The repository will be structured as an npm workspace with `yaml_graph_core` and `yaml_graph_vscode` as workspace packages. This simplifies dependency resolution, shared tooling, and `tsc --build` usage. |
| 8 | Should `AstNodeTransformerRuntime` use `vm.runInContext` instead of `new Function` for better sandboxing? | **`new Function`** for simplicity | Mapping files are authored by the user, not loaded from untrusted sources. Sandboxing can be revisited if the threat model changes. |
| 9 | How should `mermaid.js` be bundled into the webview? | **esbuild from `node_modules`** | Single build step, one output file, offline-friendly. Avoids CDN (CSP issues, requires internet) and manual copy-to-assets. Bundle is ~800 KB gzipped, acceptable for a VS Code extension. |
| 10 | How should graph-type folders be discovered and registered? | **Auto-scan `graph-types/`** for subdirectories containing `*.graph-map.yaml` | Zero configuration, deterministic. Third-party scan paths can be added later via VS Code extension API. |
| 12 | Per-diagram-type CSS styling structure in graph-type folders? | **Optional `style.css` file** per graph-type folder | Injected as `<style>` block after base theme CSS. Real CSS file gives syntax highlighting and linting. `GraphType` gains optional `styleSheet?: string` field. |
| 14 | How should the node editor form handle complex field types? | **Schema-driven recursive form renderer** | Full design in Section 10 — Node Editor subsection. Handles scalars, enums, arrays of objects, nested objects, and `additionalProperties`. |
| 15 | Should `ConversionCallbacks` support async operations? | **`prepare()` method** on `ConversionCallbacks` | Async `prepare()` runs once before conversion. Emit callbacks remain synchronous, reading pre-computed data from `this`. Engine provides `convertWithPrepare()` async wrapper. See updated types in Section 3. |
| 16 | How should undo/redo work for node editor edits? | **Single `WorkspaceEdit`** with all field changes | One `workspace.applyEdit()` call per "Apply" action produces one native undo step. Webview sends `edits: Array<{ path, value }>` in the `applyEdit` message. |

### Open Questions

Design questions requiring further discussion:

#### Q11 — File pattern conflicts between graph types

**Context:** `GraphTypeRegistry` uses a `filePatternMap` that maps file
patterns to graph types. Two types claiming `*.flow.yaml` would silently shadow
each other.

**Proposal: fail loudly with a visible error — not just a log message.**

When `register()` detects a pattern already claimed by another type:

1. **Reject the conflicting registration** — the conflicting graph type is
   *not* registered at all (not just the overlapping pattern).
2. **Show a VS Code error notification** — `vscode.window.showErrorMessage()`
   with the message: `Graph type '${newId}' conflicts with '${existingId}' on
   pattern '${pattern}'. The type '${newId}' was not loaded.`
3. **Add to Problems pane** — create a diagnostic on the conflicting
   `*.graph-map.yaml` file so it appears in the VS Code Problems panel.
4. **Log full details** — output channel logging for debugging.

The first-registered type retains ownership. Since graph-type folders are
scanned alphabetically, the order is deterministic. This ensures developers
notice conflicts immediately rather than getting mysterious wrong-diagram-type
behavior.

In `yaml-graph-core` (which has no VS Code dependency), the `register()` method
throws a `GraphTypeConflictError`. The `yaml-graph-vscode` layer catches it and
translates to the VS Code-specific error notifications described above.

```typescript
// In yaml-graph-core:
export class GraphTypeConflictError extends Error {
    constructor(
        public readonly newTypeId: string,
        public readonly existingTypeId: string,
        public readonly pattern: string
    ) {
        super(
            `Graph type '${newTypeId}' conflicts with '${existingTypeId}' ` +
            `on pattern '${pattern}'`
        );
        this.name = 'GraphTypeConflictError';
    }
}

// In GraphTypeRegistry.register():
register(graphType: GraphType): void {
    for (const pattern of graphType.filePatterns) {
        const existing = this.filePatternMap.get(pattern);
        if (existing) {
            throw new GraphTypeConflictError(
                graphType.id, existing.id, pattern
            );
        }
    }
    this.types.set(graphType.id, graphType);
    for (const pattern of graphType.filePatterns) {
        this.filePatternMap.set(pattern, graphType);
    }
}

// In yaml-graph-vscode activation:
try {
    await registry.registerFromFolder(folderPath);
} catch (e) {
    if (e instanceof GraphTypeConflictError) {
        vscode.window.showErrorMessage(e.message);
        // Add diagnostic to Problems pane
        diagnosticCollection.set(mappingFileUri, [
            new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                e.message,
                vscode.DiagnosticSeverity.Error
            )
        ]);
    }
}
```

---

#### Q13 — Mapping format versioning and version coexistence

**Context:** As the mapping format evolves, older mapping files may become
incompatible. Different graph-type authors may update at different speeds.

**Proposal: required `version: 1` field + version coexistence strategy.**

**Part A — Version field from day one.** The mapping file has a required
`version` field in the `map:` section:

```yaml
map:
  version: 1
  id: flowchart
  mermaidType: flowchart
```

`MappingLoader` checks the version and refuses to load files with an
unrecognized version, emitting a clear error message. The
`graph-map.schema.json` includes `version` as a required property with
`const: 1` (updated when the format changes).

**Part B — Supporting two versions simultaneously.** When the mapping format
evolves from v1 to v2, the system must support both during the transition
period:

1. **Version-specific loaders.** `MappingLoader` maintains an internal registry
   of version normalizers:

   ```typescript
   private normalizers = new Map<number, MappingNormalizer>([
       [1, new MappingNormalizerV1()],
       [2, new MappingNormalizerV2()],
   ]);
   ```

   Each normalizer converts the raw parsed YAML into the internal
   `GraphMapping` TypeScript interface. The internal interface always reflects
   the latest version. Older normalizers transform the v1 structure into the
   current internal representation (upward migration).

2. **Schema per version.** Each mapping format version has its own JSON Schema:
   - `graph-map.v1.schema.json`
   - `graph-map.v2.schema.json`

   `MappingLoader` selects the schema based on the `version` field before
   validation.

3. **Graph types are not duplicated.** A single graph type folder contains one
   `*.graph-map.yaml` file at one version. There is no need for two flowchart
   folders — the normalizer handles the difference.

4. **Deprecation cycle.** When v2 is released:
   - Built-in graph types are updated to v2.
   - v1 normalizer remains functional with a deprecation warning.
   - After two minor releases, v1 support is removed.

5. **Error on unknown version.** If the `version` field contains a value with
   no registered normalizer, `MappingLoader` throws a typed error:

   ```typescript
   export class UnsupportedMappingVersionError extends Error {
       constructor(
           public readonly version: number,
           public readonly supportedVersions: number[]
       ) {
           super(
               `Mapping format version ${version} is not supported. ` +
               `Supported: ${supportedVersions.join(', ')}`
           );
       }
   }
   ```

This approach keeps the internal engine working against a single `GraphMapping`
interface while gracefully handling mapping files at any supported version.

---

### Further Open Questions

These are smaller items that emerged from the recent design expansion:

| # | Question | Context | Impact |
|---|----------|---------|--------|
| 17 | Should `FieldSchema` support `oneOf` / `anyOf` JSON Schema combinators? | Some schemas use `oneOf` for polymorphic fields (e.g., a field that is either a string or an object). The recursive renderer needs a strategy for these. | May need a "variant selector" widget in the node editor |
| 18 | How should the node editor handle YAML anchors and aliases? | YAML anchors (`&anchor`) and aliases (`*anchor`) create shared references. Editing an aliased value should warn that it affects multiple nodes. | Affects YAML AST edit logic and user communication |
| 19 | Should the schema-driven form support custom widget hints in the JSON Schema? | Graph type authors may want to hint at a specific widget (e.g., `"x-widget": "color-picker"` for a color string field). A `x-widget` extension keyword in the schema could enable this. | Nice-to-have for rich editors; can start with standard types only |
| 20 | How should validation errors be displayed for nested fields in the node editor? | Schema validation returns paths like `/entities/user/attributes/0/type`. The node editor needs to map these back to form fields and show inline error indicators. | Affects form rendering and error propagation from extension host to webview |
