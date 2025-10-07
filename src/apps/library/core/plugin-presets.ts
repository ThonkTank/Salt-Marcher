// src/apps/library/core/plugin-presets.ts
// Loads preset creatures and spells from bundled presets or reference files

import { App, Notice, Platform, normalizePath } from "obsidian";
import { CREATURES_DIR, ensureCreatureDir } from "./creature-files";
import { SPELLS_DIR, ensureSpellDir } from "./spell-files";
import { ITEMS_DIR, ensureItemDir } from "./item-files";
import { EQUIPMENT_DIR, ensureEquipmentDir } from "./equipment-files";

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
 */
async function importPresetsForDir(
    app: App,
    dir: string,
    presetKey: string,
    typeName: string,
    ensureDir: (app: App) => Promise<void>
): Promise<void> {
    try {
        // Ensure directory exists
        await ensureDir(app);

        // Load presets from generated module
        const presetModule = await import('./preset-data');
        const presetFiles = (presetModule as any)[presetKey] || {};

        const fileNames = Object.keys(presetFiles);

        if (fileNames.length === 0) {
            console.log(`No preset ${typeName} found in plugin`);
            return;
        }

        console.log(`Found ${fileNames.length} preset ${typeName} in plugin`);

        // Get existing files for comparison
        const existingFiles = new Set();
        try {
            const existing = await app.vault.adapter.list(dir);
            existing.files.forEach(file => {
                const fileName = file.split('/').pop()?.toLowerCase();
                if (fileName) existingFiles.add(fileName);
            });
        } catch {
            // Directory doesn't exist yet
        }

        let importedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const fileName of fileNames) {
            const targetPath = normalizePath(`${dir}/${fileName}`);

            // Check if file already exists
            if (existingFiles.has(fileName.toLowerCase())) {
                skippedCount++;
                continue;
            }

            try {
                // Get preset content
                const content = presetFiles[fileName];

                // Create file in vault
                await app.vault.create(targetPath, content);
                importedCount++;

                console.log(`Imported ${typeName} preset: ${fileName}`);
            } catch (err) {
                console.error(`Failed to import ${typeName} preset ${fileName}:`, err);
                errorCount++;
            }
        }

        // Show notification with results
        if (importedCount > 0) {
            new Notice(`Imported ${importedCount} ${typeName} presets`);
            console.log(`${typeName} import complete: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);
        } else if (skippedCount > 0) {
            console.log(`All ${skippedCount} ${typeName} presets already exist`);
        } else if (errorCount > 0) {
            new Notice(`Failed to import ${typeName} presets. Check console for details.`);
        }
    } catch (err) {
        console.error(`Failed to import ${typeName} presets:`, err);
        // If preset-data module doesn't exist, it's not an error - just no presets
        if (err instanceof Error && err.message.includes('Cannot find module')) {
            console.log(`No ${typeName} preset data found - skipping import`);
        } else {
            new Notice(`Failed to import ${typeName} presets. Check console for details.`);
        }
    }
}

/**
 * Import preset creatures from bundled plugin files to vault
 */
export async function importPluginPresets(app: App): Promise<void> {
    return importPresetsForDir(app, CREATURES_DIR, "PRESET_CREATURES", "creature", ensureCreatureDir);
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
    const markerPath = `${dir}/${markerName}`;
    const markerFile = app.vault.getAbstractFileByPath(markerPath);

    if (markerFile) {
        return false; // Already imported
    }

    // Create marker file for future
    try {
        await ensureDir(app);
        await app.vault.create(markerPath, `${label} imported on ${new Date().toISOString()}`);
    } catch (err) {
        console.error(`Failed to create ${label} marker:`, err);
    }

    return true;
}

/**
 * Check if presets should be imported (first time setup)
 */
export async function shouldImportPluginPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, CREATURES_DIR, ".plugin-presets-imported", "Plugin presets", ensureCreatureDir);
}

/**
 * Import spell presets from bundled plugin files to vault
 */
export async function importSpellPresets(app: App): Promise<void> {
    return importPresetsForDir(app, SPELLS_DIR, "PRESET_SPELLS", "spell", ensureSpellDir);
}

/**
 * Check if spell presets should be imported (first time setup)
 */
export async function shouldImportSpellPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, SPELLS_DIR, ".plugin-spells-imported", "Spell presets", ensureSpellDir);
}

/**
 * Import item presets from bundled plugin files to vault
 */
export async function importItemPresets(app: App): Promise<void> {
    return importPresetsForDir(app, ITEMS_DIR, "PRESET_ITEMS", "item", ensureItemDir);
}

/**
 * Check if item presets should be imported (first time setup)
 */
export async function shouldImportItemPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, ITEMS_DIR, ".plugin-items-imported", "Item presets", ensureItemDir);
}

/**
 * Import equipment presets from bundled plugin files to vault
 */
export async function importEquipmentPresets(app: App): Promise<void> {
    return importPresetsForDir(app, EQUIPMENT_DIR, "PRESET_EQUIPMENT", "equipment", ensureEquipmentDir);
}

/**
 * Check if equipment presets should be imported (first time setup)
 */
export async function shouldImportEquipmentPresets(app: App): Promise<boolean> {
    return shouldImportPresetsForDir(app, EQUIPMENT_DIR, ".plugin-equipment-imported", "Equipment presets", ensureEquipmentDir);
}