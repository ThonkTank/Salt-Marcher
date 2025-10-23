// src/workmodes/library/core/vault-preset-loader.ts
// Generic vault preset loading for all library entities

import { App, TFile, TFolder } from "obsidian";
import { ENTITY_REGISTRY, type EntityId } from "./entity-registry";
import { logger } from "../../src/app/plugin-logger";

/**
 * Load a specific preset from the vault by name and entity type
 *
 * @param app Obsidian App instance
 * @param entityType Type of entity (creatures, spells, items, equipment, terrains, regions)
 * @param presetName Name of the preset file (without .md extension)
 * @returns File content or null if not found
 */
export async function loadVaultPreset(
    app: App,
    entityType: EntityId,
    presetName: string
): Promise<string | null> {
    const entityConfig = ENTITY_REGISTRY[entityType];
    if (!entityConfig) {
        logger.warn(`[VaultPresetLoader] Unknown entity type: ${entityType}`);
        return null;
    }

    const filepath = `${entityConfig.directory}/${presetName}.md`;
    const file = app.vault.getAbstractFileByPath(filepath);

    if (!(file instanceof TFile)) {
        logger.warn(`[VaultPresetLoader] Preset not found: ${filepath}`);
        return null;
    }

    try {
        return await app.vault.read(file);
    } catch (err) {
        logger.error(`[VaultPresetLoader] Failed to read preset ${filepath}:`, err);
        return null;
    }
}

/**
 * List all vault presets for a given entity type (recursive)
 *
 * @param app Obsidian App instance
 * @param entityType Type of entity
 * @returns Array of TFiles representing presets
 */
export async function listVaultPresets(
    app: App,
    entityType: EntityId
): Promise<TFile[]> {
    const entityConfig = ENTITY_REGISTRY[entityType];
    if (!entityConfig) {
        logger.warn(`[VaultPresetLoader] Unknown entity type: ${entityType}`);
        return [];
    }

    const folder = app.vault.getAbstractFileByPath(entityConfig.directory);
    if (!folder || !(folder instanceof TFolder)) {
        return [];
    }

    const files: TFile[] = [];

    // Recursive helper function to traverse folders
    const collectFiles = (currentFolder: TFolder) => {
        for (const child of currentFolder.children) {
            if (child instanceof TFile && child.extension === "md") {
                files.push(child);
            } else if (child instanceof TFolder) {
                // Recursively process subfolders
                collectFiles(child);
            }
        }
    };

    collectFiles(folder);

    return files;
}

/**
 * Find vault presets matching a filter function
 *
 * @param app Obsidian App instance
 * @param entityType Type of entity
 * @param filter Function to filter presets by frontmatter
 * @returns Array of matching files with their parsed frontmatter
 */
export async function findVaultPresets<T = any>(
    app: App,
    entityType: EntityId,
    filter: (frontmatter: T) => boolean
): Promise<Array<{ file: TFile; frontmatter: T }>> {
    const files = await listVaultPresets(app, entityType);
    const results: Array<{ file: TFile; frontmatter: T }> = [];

    for (const file of files) {
        const cache = app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter) continue;

        const frontmatter = cache.frontmatter as T;
        if (filter(frontmatter)) {
            results.push({ file, frontmatter });
        }
    }

    return results;
}

/**
 * Get unique values for a category field from vault presets
 *
 * @param app Obsidian App instance
 * @param entityType Type of entity
 * @param categoryField Field name to extract categories from (e.g., "type", "school", "category")
 * @returns Sorted array of unique category values
 */
export async function getVaultPresetCategories(
    app: App,
    entityType: EntityId,
    categoryField: string
): Promise<string[]> {
    const files = await listVaultPresets(app, entityType);
    const categories = new Set<string>();

    for (const file of files) {
        const cache = app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter) continue;

        const value = cache.frontmatter[categoryField];
        if (typeof value === "string" && value.trim()) {
            categories.add(value.trim());
        }
    }

    return Array.from(categories).sort();
}

/**
 * Watch vault preset directory for changes
 *
 * @param app Obsidian App instance
 * @param entityType Type of entity
 * @param onChange Callback when presets change
 * @returns Cleanup function to unregister listeners
 */
export function watchVaultPresets(
    app: App,
    entityType: EntityId,
    onChange: () => void
): () => void {
    const entityConfig = ENTITY_REGISTRY[entityType];
    if (!entityConfig) {
        logger.warn(`[VaultPresetLoader] Unknown entity type: ${entityType}`);
        return () => {};
    }

    const notify = () => {
        onChange();
    };

    // Listen for file changes in the entity directory
    const createRef = app.vault.on("create", (file) => {
        if (file instanceof TFile && file.path.startsWith(entityConfig.directory)) {
            notify();
        }
    });

    const deleteRef = app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.path.startsWith(entityConfig.directory)) {
            notify();
        }
    });

    const renameRef = app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile &&
            (file.path.startsWith(entityConfig.directory) ||
             oldPath.startsWith(entityConfig.directory))) {
            notify();
        }
    });

    const modifyRef = app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.path.startsWith(entityConfig.directory)) {
            notify();
        }
    });

    // Return cleanup function
    return () => {
        app.vault.offref(createRef);
        app.vault.offref(deleteRef);
        app.vault.offref(renameRef);
        app.vault.offref(modifyRef);
    };
}
