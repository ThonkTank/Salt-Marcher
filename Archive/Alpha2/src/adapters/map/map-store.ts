/**
 * Map Store
 *
 * Vault adapter for map persistence.
 *
 * @module adapters/map-store
 */

import type { Vault } from 'obsidian';
import type { MapData, MapListEntry } from '../../schemas';
import { isValidMapData, toListEntry } from '../../utils/map';
import { ensureDirectory, saveFile, deleteFile, listFilesInDirectory } from '../shared/vault-utils';

// ============================================================================
// MapStore
// ============================================================================

export class MapStore {
    constructor(
        private vault: Vault,
        private basePath: string
    ) {}

    // ========================================================================
    // CRUD Operations
    // ========================================================================

    /**
     * List all maps.
     */
    async list(): Promise<MapListEntry[]> {
        const entries: MapListEntry[] = [];

        // Ensure directory exists
        await ensureDirectory(this.vault, this.basePath);

        // Get all JSON files in maps directory
        const files = listFilesInDirectory(this.vault, this.basePath, 'json');

        for (const file of files) {
            try {
                const content = await this.vault.read(file);
                const data = JSON.parse(content);
                if (isValidMapData(data)) {
                    entries.push(toListEntry(data));
                }
            } catch {
                // Skip invalid files
            }
        }

        // Sort by modification date (newest first)
        entries.sort((a, b) => b.modifiedAt - a.modifiedAt);

        return entries;
    }

    /**
     * Load a map by ID.
     */
    async load(id: string): Promise<MapData | null> {
        const path = this.getFilePath(id);
        const file = this.vault.getAbstractFileByPath(path);

        if (!file) return null;

        try {
            const content = await this.vault.read(file as any);
            const data = JSON.parse(content);

            if (isValidMapData(data)) {
                return data;
            }
        } catch {
            // Invalid file
        }

        return null;
    }

    /**
     * Save a map.
     */
    async save(data: MapData): Promise<void> {
        await ensureDirectory(this.vault, this.basePath);
        const path = this.getFilePath(data.metadata.id);
        const content = JSON.stringify(data, null, 2);
        await saveFile(this.vault, path, content);
    }

    /**
     * Delete a map.
     */
    async delete(id: string): Promise<void> {
        const path = this.getFilePath(id);
        await deleteFile(this.vault, path);
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    /**
     * Get file path for a map ID.
     */
    private getFilePath(id: string): string {
        return `${this.basePath}/${id}.json`;
    }
}
