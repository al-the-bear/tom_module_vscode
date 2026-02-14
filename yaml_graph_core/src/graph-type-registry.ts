import { readdir } from 'fs/promises';
import { join } from 'path';
import type { GraphType } from './types.js';
import { MappingLoader } from './mapping-loader.js';

// ============================================================
// Error classes
// ============================================================

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

// ============================================================
// Registry
// ============================================================

export class GraphTypeRegistry {
    /**
     * All registered versions keyed by "{id}@{version}".
     */
    private allVersions = new Map<string, GraphType>();

    /**
     * File pattern → highest-version GraphType (default lookup).
     */
    private filePatternMap = new Map<string, GraphType>();

    /**
     * File pattern → map of version → GraphType.
     */
    private versionedPatternMap = new Map<string, Map<number, GraphType>>();

    private loader = new MappingLoader();

    /**
     * Register a graph type. Throws GraphTypeConflictError if any file
     * pattern is already claimed by a *different* graph type id.
     * Multiple versions of the *same* id are allowed.
     */
    register(graphType: GraphType): void {
        for (const pattern of graphType.filePatterns) {
            const existing = this.filePatternMap.get(pattern);
            if (existing && existing.id !== graphType.id) {
                throw new GraphTypeConflictError(
                    graphType.id, existing.id, pattern
                );
            }
        }

        const versionKey = `${graphType.id}@${graphType.version}`;
        this.allVersions.set(versionKey, graphType);

        for (const pattern of graphType.filePatterns) {
            // Update versioned map
            let versions = this.versionedPatternMap.get(pattern);
            if (!versions) {
                versions = new Map();
                this.versionedPatternMap.set(pattern, versions);
            }
            versions.set(graphType.version, graphType);

            // Default map always points to highest version
            const current = this.filePatternMap.get(pattern);
            if (!current || graphType.version > current.version) {
                this.filePatternMap.set(pattern, graphType);
            }
        }
    }

    /**
     * Register all versions of a graph type from a folder containing
     * version subfolders.
     */
    async registerFromFolder(folderPath: string): Promise<void> {
        const graphTypes = await this.loader.loadFromFolder(folderPath);
        for (const gt of graphTypes) {
            this.register(gt);
        }
    }

    /**
     * Return and clear accumulated loader warnings.
     */
    consumeWarnings(): string[] {
        return this.loader.consumeWarnings();
    }

    /**
     * Auto-scan a directory of graph-type folders and register them all.
     * On error, collects warnings and continues with the remaining folders.
     * Returns an array of error messages for the caller to display.
     */
    async registerAllFromDirectory(dirPath: string): Promise<string[]> {
        const errors: string[] = [];
        const entries = await readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const folderPath = join(dirPath, entry.name);

            try {
                await this.registerFromFolder(folderPath);

                // Collect non-fatal warnings
                for (const warning of this.loader.consumeWarnings()) {
                    errors.push(`Warning: ${warning}`);
                }
            } catch (err) {
                const message = err instanceof Error
                    ? `Graph type '${entry.name}': ${err.message}`
                    : `Graph type '${entry.name}': unknown error`;
                errors.push(message);
                // Continue with next folder
            }
        }

        return errors;
    }

    /**
     * Look up graph type by file extension/pattern.
     * Returns the highest registered version.
     */
    getForFile(filename: string): GraphType | undefined {
        for (const [pattern, type] of this.filePatternMap) {
            if (this.matchesPattern(filename, pattern)) {
                return type;
            }
        }
        return undefined;
    }

    /**
     * Look up a specific version of a graph type for a file.
     * Primary lookup method — used by resolveGraphType() since
     * meta.graph-version is required in all data files.
     */
    getForFileVersion(filename: string, version: number): GraphType | undefined {
        for (const [pattern, versions] of this.versionedPatternMap) {
            if (this.matchesPattern(filename, pattern)) {
                return versions.get(version);
            }
        }
        return undefined;
    }

    /**
     * Get all registered graph types.
     */
    getAll(): GraphType[] {
        return Array.from(this.allVersions.values());
    }

    /**
     * Get a graph type by its versioned key ("{id}@{version}").
     */
    getByVersionKey(key: string): GraphType | undefined {
        return this.allVersions.get(key);
    }

    /**
     * List all registered version keys.
     */
    listVersionKeys(): string[] {
        return Array.from(this.allVersions.keys());
    }

    private matchesPattern(filename: string, pattern: string): boolean {
        // Simple glob: *.flow.yaml → matches 'anything.flow.yaml'
        const ext = pattern.replace('*', '');
        return filename.endsWith(ext);
    }
}
