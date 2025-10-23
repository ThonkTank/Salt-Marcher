// src/workmodes/library/core/plugin-presets.ts
// Loads preset creatures and spells from bundled presets or reference files

import { App, Notice, Platform, normalizePath } from "obsidian";
import { ENTITY_REGISTRY } from "./entity-registry";
import { logger } from "../../src/app/plugin-logger";

// Simple directory ensure functions
async function ensureDir(app: App, dir: string): Promise<void> {
    const normalizedDir = normalizePath(dir);
    const folder = app.vault.getAbstractFileByPath(normalizedDir);
    if (!folder) {
        await app.vault.createFolder(normalizedDir).catch(() => {});
    }
}

const ensureCreatureDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.creatures.directory);
const ensureSpellDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.spells.directory);
const ensureItemDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.items.directory);
const ensureEquipmentDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.equipment.directory);
const ensureTerrainDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.terrains.directory);
const ensureRegionDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.regions.directory);
const ensureCalendarDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.calendars.directory);

// Define the preset files structure
// This will be populated at build time with actual preset files
const PRESET_FILES: { [key: string]: string } = {};

/**
 * Register a preset file content
 * This is called during plugin initialization to register bundled presets
 */
export function registerPreset(fileName: string, content: string): void {
    PRESET_FILES[fileName] = content;
}

/**
 * Generic helper to import presets for a given directory and preset type
 * @param force - If true, delete existing files before importing (for re-import with updated filenames)
 */
async function importPresetsForDir(
    app: App,
    dir: string,
    presetKey: string,
    typeName: string,
    ensureDir: (app: App) => Promise<void>,
    force = false
): Promise<void> {
    try {
        // Ensure directory exists
        await ensureDir(app);
        const normalizedDir = normalizePath(dir);

        // Load presets from generated module
        const presetModule = await import('./preset-data');
        const rawPresetFiles = (presetModule as any)[presetKey] || {};
        const presetEntries = Object.entries(rawPresetFiles)
            .map(([fileName, content]) => [
                normalizeRelativePath(fileName),
                content as string,
            ] as const)
            .filter(([fileName]) => !isOrganizationalPresetFile(fileName));
        const fileNames = presetEntries.map(([fileName]) => fileName);

        if (fileNames.length === 0) {
            logger.log(`No preset ${typeName} found in plugin`);
            return;
        }

        logger.log(`Found ${fileNames.length} preset ${typeName} in plugin`);

        // Get existing files for comparison (map lowercase names to actual paths)
        const existingFiles = new Map<string, string>();
        try {
            const existing = await app.vault.adapter.list(normalizedDir);
            const prefix = `${normalizedDir}/`;
            existing.files.forEach(file => {
                const normalizedFile = normalizePath(file);
                if (normalizedFile.startsWith(prefix)) {
                    const relativePath = normalizedFile.slice(prefix.length);
                    if (relativePath) {
                        existingFiles.set(relativePath.toLowerCase(), normalizedFile);
                    }
                }
            });
        } catch {
            // Directory doesn't exist yet
        }

        let importedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const ensuredFolders = new Set<string>([normalizedDir]);

        for (const [fileName, content] of presetEntries) {
            const loweredName = fileName.toLowerCase();
            const targetPath = normalizePath(`${normalizedDir}/${fileName}`);
            const existingPath = existingFiles.get(loweredName);

            try {
                await ensureParentFolders(app, normalizedDir, fileName, ensuredFolders);

                // If force mode and file exists, delete and recreate
                if (force && existingPath) {
                    // Delete the old file (might have different capitalization)
                    const existingFile = app.vault.getAbstractFileByPath(existingPath);
                    if (existingFile) {
                        await app.vault.delete(existingFile);
                        logger.log(`Deleted existing ${typeName} preset: ${existingPath}`);
                    }
                    // Use adapter.write to bypass vault cache after deletion
                    await app.vault.adapter.write(targetPath, content);
                    importedCount++;
                    logger.log(`Re-imported ${typeName} preset: ${fileName}`);
                } else if (existingPath) {
                    // File exists but not force mode - skip
                    skippedCount++;
                } else {
                    // New file - use vault.create
                    await app.vault.create(targetPath, content);
                    importedCount++;
                    logger.log(`Imported ${typeName} preset: ${fileName}`);
                }
            } catch (err) {
                logger.error(`Failed to import ${typeName} preset ${fileName}:`, err);
                errorCount++;
            }
        }

        // Show notification with results
        if (importedCount > 0) {
            new Notice(`Imported ${importedCount} ${typeName} presets`);
            logger.log(`${typeName} import complete: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);
        } else if (skippedCount > 0) {
            logger.log(`All ${skippedCount} ${typeName} presets already exist`);
        } else if (errorCount > 0) {
            new Notice(`Failed to import ${typeName} presets. Check console for details.`);
        }
    } catch (err) {
        logger.error(`Failed to import ${typeName} presets:`, err);
        // If preset-data module doesn't exist, it's not an error - just no presets
        if (err instanceof Error && err.message.includes('Cannot find module')) {
            logger.log(`No ${typeName} preset data found - skipping import`);
        } else {
            new Notice(`Failed to import ${typeName} presets. Check console for details.`);
        }
    }
}

function normalizeRelativePath(fileName: string): string {
    return fileName.replace(/\\/g, '/');
}

async function ensureParentFolders(
    app: App,
    baseDir: string,
    relativePath: string,
    ensured: Set<string>
): Promise<void> {
    const parts = normalizeRelativePath(relativePath).split('/');
    parts.pop();
    let current = baseDir;
    for (const part of parts) {
        current = normalizePath(`${current}/${part}`);
        if (ensured.has(current)) continue;
        ensured.add(current);
        if (!app.vault.getAbstractFileByPath(current)) {
            await app.vault.createFolder(current).catch(() => {});
        }
    }
}

function isOrganizationalPresetFile(fileName: string): boolean {
    const normalized = fileName.toLowerCase();
    return normalized === "agents.md" || normalized.endsWith("/agents.md");
}

/**
 * Import preset creatures from bundled plugin files to vault
 */
export async function importPluginPresets(app: App): Promise<void> {
    return importPresetsForDir(app, ENTITY_REGISTRY.creatures.directory, "PRESET_CREATURES", "creature", ensureCreatureDir);
}

/**
 * Generic helper to check if presets should be imported for a given directory
 */
async function shouldImportPresetsForDir(
    app: App,
    dir: string,
    markerName: string,
    label: string,
    ensureDir: (app: App) => Promise<void>
): Promise<boolean> {
    const markerPath = normalizePath(`${dir}/${markerName}`);
    const markerFile = app.vault.getAbstractFileByPath(markerPath);

    if (markerFile) {
        return false; // Already imported
    }

    // Create marker file for future
    try {
        await ensureDir(app);
        await app.vault.create(markerPath, `${label} imported on ${new Date().toISOString()}`);
    } catch (err) {
        // Marker could not be created (likely already exists) → no import needed
        logger.log(`${label} already imported (marker exists)`);
        return false;
    }

    return true;
}

/**
 * Check if presets should be imported (first time setup)
 */
export async function shouldImportPluginPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, ENTITY_REGISTRY.creatures.directory, ".plugin-presets-imported", "Plugin presets", ensureCreatureDir);
}

/**
 * Import spell presets from bundled plugin files to vault
 */
export async function importSpellPresets(app: App): Promise<void> {
    return importPresetsForDir(app, ENTITY_REGISTRY.spells.directory, "PRESET_SPELLS", "spell", ensureSpellDir);
}

/**
 * Check if spell presets should be imported (first time setup)
 */
export async function shouldImportSpellPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, ENTITY_REGISTRY.spells.directory, ".plugin-spells-imported", "Spell presets", ensureSpellDir);
}

/**
 * Import item presets from bundled plugin files to vault
 */
export async function importItemPresets(app: App): Promise<void> {
    return importPresetsForDir(app, ENTITY_REGISTRY.items.directory, "PRESET_ITEMS", "item", ensureItemDir);
}

/**
 * Check if item presets should be imported (first time setup)
 */
export async function shouldImportItemPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, ENTITY_REGISTRY.items.directory, ".plugin-items-imported", "Item presets", ensureItemDir);
}

/**
 * Import equipment presets from bundled plugin files to vault
 */
export async function importEquipmentPresets(app: App): Promise<void> {
    return importPresetsForDir(app, ENTITY_REGISTRY.equipment.directory, "PRESET_EQUIPMENT", "equipment", ensureEquipmentDir);
}

/**
 * Check if equipment presets should be imported (first time setup)
 */
export async function shouldImportEquipmentPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, ENTITY_REGISTRY.equipment.directory, ".plugin-equipment-imported", "Equipment presets", ensureEquipmentDir);
}

/**
 * Import terrain presets from bundled plugin files to vault
 */
export async function importTerrainPresets(app: App): Promise<void> {
    return importPresetsForDir(app, ENTITY_REGISTRY.terrains.directory, "PRESET_TERRAINS", "terrain", ensureTerrainDir);
}

/**
 * Check if terrain presets should be imported (first time setup)
 */
export async function shouldImportTerrainPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, ENTITY_REGISTRY.terrains.directory, ".plugin-terrains-imported", "Terrain presets", ensureTerrainDir);
}

/**
 * Import region presets from bundled plugin files to vault
 */
export async function importRegionPresets(app: App): Promise<void> {
    return importPresetsForDir(app, ENTITY_REGISTRY.regions.directory, "PRESET_REGIONS", "region", ensureRegionDir);
}

/**
 * Check if region presets should be imported (first time setup)
 */
export async function shouldImportRegionPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, ENTITY_REGISTRY.regions.directory, ".plugin-regions-imported", "Region presets", ensureRegionDir);
}

/**
 * Import calendar presets from bundled plugin files to vault
 */
export async function importCalendarPresets(app: App): Promise<void> {
    return importPresetsForDir(app, ENTITY_REGISTRY.calendars.directory, "PRESET_CALENDARS", "calendar", ensureCalendarDir);
}

/**
 * Check if calendar presets should be imported (first time setup)
 */
export async function shouldImportCalendarPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, ENTITY_REGISTRY.calendars.directory, ".plugin-calendars-imported", "Calendar presets", ensureCalendarDir);
}

/**
 * Import presets for a specific category with optional force flag
 * Used by IPC commands for re-importing presets
 */
export async function importPresetsByCategory(app: App, category: string, force = false): Promise<{ imported: number; category: string }> {
    const categoryLower = category.toLowerCase();

    switch (categoryLower) {
        case "creatures":
            await importPresetsForDir(app, ENTITY_REGISTRY.creatures.directory, "PRESET_CREATURES", "creature", ensureCreatureDir, force);
            return { imported: 0, category: "creatures" }; // Count not available in current implementation

        case "spells":
            await importPresetsForDir(app, ENTITY_REGISTRY.spells.directory, "PRESET_SPELLS", "spell", ensureSpellDir, force);
            return { imported: 0, category: "spells" };

        case "items":
            await importPresetsForDir(app, ENTITY_REGISTRY.items.directory, "PRESET_ITEMS", "item", ensureItemDir, force);
            return { imported: 0, category: "items" };

        case "equipment":
            await importPresetsForDir(app, ENTITY_REGISTRY.equipment.directory, "PRESET_EQUIPMENT", "equipment", ensureEquipmentDir, force);
            return { imported: 0, category: "equipment" };

        case "terrains":
            await importPresetsForDir(app, ENTITY_REGISTRY.terrains.directory, "PRESET_TERRAINS", "terrain", ensureTerrainDir, force);
            return { imported: 0, category: "terrains" };

        case "regions":
            await importPresetsForDir(app, ENTITY_REGISTRY.regions.directory, "PRESET_REGIONS", "region", ensureRegionDir, force);
            return { imported: 0, category: "regions" };

        case "calendars":
            await importPresetsForDir(app, ENTITY_REGISTRY.calendars.directory, "PRESET_CALENDARS", "calendar", ensureCalendarDir, force);
            return { imported: 0, category: "calendars" };

        case "all":
            await importPresetsForDir(app, ENTITY_REGISTRY.creatures.directory, "PRESET_CREATURES", "creature", ensureCreatureDir, force);
            await importPresetsForDir(app, ENTITY_REGISTRY.spells.directory, "PRESET_SPELLS", "spell", ensureSpellDir, force);
            await importPresetsForDir(app, ENTITY_REGISTRY.items.directory, "PRESET_ITEMS", "item", ensureItemDir, force);
            await importPresetsForDir(app, ENTITY_REGISTRY.equipment.directory, "PRESET_EQUIPMENT", "equipment", ensureEquipmentDir, force);
            await importPresetsForDir(app, ENTITY_REGISTRY.terrains.directory, "PRESET_TERRAINS", "terrain", ensureTerrainDir, force);
            await importPresetsForDir(app, ENTITY_REGISTRY.regions.directory, "PRESET_REGIONS", "region", ensureRegionDir, force);
            await importPresetsForDir(app, ENTITY_REGISTRY.calendars.directory, "PRESET_CALENDARS", "calendar", ensureCalendarDir, force);
            return { imported: 0, category: "all" };

        default:
            throw new Error(`Unknown preset category: ${category}. Valid categories: creatures, spells, items, equipment, terrains, regions, calendars, all`);
    }
}