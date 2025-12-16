// src/features/encounters/vault-scanner.ts
// Unified vault file scanning utilities

import type { App, TFile } from "obsidian";

/**
 * Scan vault options
 */
export interface VaultScanOptions {
    /**
     * Path patterns to include (e.g., ["Creatures", "Presets/Creatures"])
     * Files matching ANY pattern will be included.
     */
    includePaths: string[];

    /**
     * Optional additional file filter (runs after path matching)
     */
    fileFilter?: (file: TFile) => boolean;

    /**
     * Whether to use recursive folder traversal (default: false)
     * If false, uses getMarkdownFiles() + path matching (faster)
     * If true, uses recursive folder traversal (more thorough)
     */
    recursive?: boolean;
}

/**
 * Scan vault for markdown files matching criteria.
 * Fast, non-recursive implementation using getMarkdownFiles().
 *
 * @param app - Obsidian App instance
 * @param options - Scan configuration
 * @returns Array of matching markdown files
 *
 * @example
 * // Find all creature files
 * const creatureFiles = await scanVault(app, {
 *     includePaths: ["Creatures", "Presets/Creatures"],
 * });
 *
 * @example
 * // Find creature files with custom filter
 * const highCRCreatures = await scanVault(app, {
 *     includePaths: ["Creatures"],
 *     fileFilter: (file) => {
 *         const cache = app.metadataCache.getFileCache(file);
 *         return cache?.frontmatter?.cr >= 10;
 *     }
 * });
 */
export async function scanVault(
    app: App,
    options: VaultScanOptions
): Promise<TFile[]> {
    const { includePaths, fileFilter, recursive = false } = options;

    if (recursive) {
        throw new Error("Recursive scanning not yet implemented. Use recursive: false (default).");
    }

    // Fast path: Use getMarkdownFiles() + path matching
    const allFiles = app.vault.getMarkdownFiles();

    // Filter by path patterns
    const matchedFiles = allFiles.filter(file => {
        // Check if file path matches any include pattern
        const pathMatches = includePaths.some(pattern => {
            return file.path.includes(pattern) || file.parent?.path.includes(pattern);
        });

        if (!pathMatches) return false;

        // Apply optional custom filter
        if (fileFilter && !fileFilter(file)) {
            return false;
        }

        return true;
    });

    return matchedFiles;
}
