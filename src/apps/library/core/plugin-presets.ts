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
 * Import preset creatures from bundled plugin files to vault
 */
export async function importPluginPresets(app: App): Promise<void> {
    try {
        // Ensure creatures directory exists
        await ensureCreatureDir(app);

        // For now, we'll use a dynamic import to load the preset files
        // This will be generated at build time
        const presetModule = await import('./preset-data');
        const presetFiles = presetModule.PRESET_CREATURES || {};

        const fileNames = Object.keys(presetFiles);

        if (fileNames.length === 0) {
            console.log("No preset creatures found in plugin");
            return;
        }

        console.log(`Found ${fileNames.length} preset creatures in plugin`);

        // Get existing creature files for comparison
        const existingCreatures = new Set();
        try {
            const existingFiles = await app.vault.adapter.list(CREATURES_DIR);
            existingFiles.files.forEach(file => {
                const fileName = file.split('/').pop()?.toLowerCase();
                if (fileName) existingCreatures.add(fileName);
            });
        } catch {
            // Directory doesn't exist yet
        }

        let importedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const fileName of fileNames) {
            const targetPath = normalizePath(`${CREATURES_DIR}/${fileName}`);

            // Check if creature already exists
            if (existingCreatures.has(fileName.toLowerCase())) {
                skippedCount++;
                continue;
            }

            try {
                // Get preset content
                const content = presetFiles[fileName];

                // Create creature file in vault
                await app.vault.create(targetPath, content);
                importedCount++;

                console.log(`Imported preset: ${fileName}`);
            } catch (err) {
                console.error(`Failed to import preset ${fileName}:`, err);
                errorCount++;
            }
        }

        // Show notification with results
        if (importedCount > 0) {
            new Notice(`Imported ${importedCount} preset creatures`);
            console.log(`Import complete: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);
        } else if (skippedCount > 0) {
            console.log(`All ${skippedCount} preset creatures already exist`);
        } else if (errorCount > 0) {
            new Notice(`Failed to import presets. Check console for details.`);
        }
    } catch (err) {
        console.error("Failed to import plugin presets:", err);
        // If preset-data module doesn't exist, it's not an error - just no presets
        if (err instanceof Error && err.message.includes('Cannot find module')) {
            console.log("No preset data module found - skipping preset import");
        } else {
            new Notice("Failed to import preset creatures. Check console for details.");
        }
    }
}

/**
 * Check if presets should be imported (first time setup)
 */
export async function shouldImportPluginPresets(app: App): Promise<boolean> {
    const markerPath = `${CREATURES_DIR}/.plugin-presets-imported`;
    const markerFile = app.vault.getAbstractFileByPath(markerPath);

    if (markerFile) {
        return false; // Already imported
    }

    // Create marker file for future
    try {
        await app.vault.create(markerPath, `Plugin presets imported on ${new Date().toISOString()}`);
    } catch (err) {
        console.error("Failed to create import marker:", err);
    }

    return true;
}

/**
 * Import spell presets from bundled plugin files to vault
 */
export async function importSpellPresets(app: App): Promise<void> {
    try {
        // Ensure spells directory exists
        await ensureSpellDir(app);

        // Load spell presets from generated module
        const presetModule = await import('./preset-data');
        const presetFiles = presetModule.PRESET_SPELLS || {};

        const fileNames = Object.keys(presetFiles);

        if (fileNames.length === 0) {
            console.log("No preset spells found in plugin");
            return;
        }

        console.log(`Found ${fileNames.length} preset spells in plugin`);

        // Get existing spell files for comparison
        const existingSpells = new Set();
        try {
            const existingFiles = await app.vault.adapter.list(SPELLS_DIR);
            existingFiles.files.forEach(file => {
                const fileName = file.split('/').pop()?.toLowerCase();
                if (fileName) existingSpells.add(fileName);
            });
        } catch {
            // Directory doesn't exist yet
        }

        let importedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const fileName of fileNames) {
            const targetPath = normalizePath(`${SPELLS_DIR}/${fileName}`);

            // Check if spell already exists
            if (existingSpells.has(fileName.toLowerCase())) {
                skippedCount++;
                continue;
            }

            try {
                // Get preset content
                const content = presetFiles[fileName];

                // Create spell file in vault
                await app.vault.create(targetPath, content);
                importedCount++;

                console.log(`Imported spell preset: ${fileName}`);
            } catch (err) {
                console.error(`Failed to import spell preset ${fileName}:`, err);
                errorCount++;
            }
        }

        // Show notification with results
        if (importedCount > 0) {
            new Notice(`Imported ${importedCount} spell presets`);
            console.log(`Spell import complete: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);
        } else if (skippedCount > 0) {
            console.log(`All ${skippedCount} spell presets already exist`);
        } else if (errorCount > 0) {
            new Notice(`Failed to import spell presets. Check console for details.`);
        }
    } catch (err) {
        console.error("Failed to import spell presets:", err);
        // If preset-data module doesn't exist, it's not an error - just no presets
        if (err instanceof Error && err.message.includes('Cannot find module')) {
            console.log("No spell preset data found - skipping spell import");
        } else {
            new Notice("Failed to import spell presets. Check console for details.");
        }
    }
}

/**
 * Check if spell presets should be imported (first time setup)
 */
export async function shouldImportSpellPresets(app: App): Promise<boolean> {
    const markerPath = `${SPELLS_DIR}/.plugin-spells-imported`;
    const markerFile = app.vault.getAbstractFileByPath(markerPath);

    if (markerFile) {
        return false; // Already imported
    }

    // Create marker file for future
    try {
        await ensureSpellDir(app);
        await app.vault.create(markerPath, `Spell presets imported on ${new Date().toISOString()}`);
    } catch (err) {
        console.error("Failed to create spell import marker:", err);
    }

    return true;
}

/**
 * Import item presets from bundled plugin files to vault
 */
export async function importItemPresets(app: App): Promise<void> {
    try {
        // Ensure items directory exists
        await ensureItemDir(app);

        // Load item presets from generated module
        const presetModule = await import('./preset-data');
        const presetFiles = presetModule.PRESET_ITEMS || {};

        const fileNames = Object.keys(presetFiles);

        if (fileNames.length === 0) {
            console.log("No preset items found in plugin");
            return;
        }

        console.log(`Found ${fileNames.length} preset items in plugin`);

        // Get existing item files for comparison
        const existingItems = new Set();
        try {
            const existingFiles = await app.vault.adapter.list(ITEMS_DIR);
            existingFiles.files.forEach(file => {
                const fileName = file.split('/').pop()?.toLowerCase();
                if (fileName) existingItems.add(fileName);
            });
        } catch {
            // Directory doesn't exist yet
        }

        let importedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const fileName of fileNames) {
            const targetPath = normalizePath(`${ITEMS_DIR}/${fileName}`);

            // Check if item already exists
            if (existingItems.has(fileName.toLowerCase())) {
                skippedCount++;
                continue;
            }

            try {
                // Get preset content
                const content = presetFiles[fileName];

                // Create item file in vault
                await app.vault.create(targetPath, content);
                importedCount++;

                console.log(`Imported item preset: ${fileName}`);
            } catch (err) {
                console.error(`Failed to import item preset ${fileName}:`, err);
                errorCount++;
            }
        }

        // Show notification with results
        if (importedCount > 0) {
            new Notice(`Imported ${importedCount} item presets`);
            console.log(`Item import complete: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);
        } else if (skippedCount > 0) {
            console.log(`All ${skippedCount} item presets already exist`);
        } else if (errorCount > 0) {
            new Notice(`Failed to import item presets. Check console for details.`);
        }
    } catch (err) {
        console.error("Failed to import item presets:", err);
        // If preset-data module doesn't exist, it's not an error - just no presets
        if (err instanceof Error && err.message.includes('Cannot find module')) {
            console.log("No item preset data found - skipping item import");
        } else {
            new Notice("Failed to import item presets. Check console for details.");
        }
    }
}

/**
 * Check if item presets should be imported (first time setup)
 */
export async function shouldImportItemPresets(app: App): Promise<boolean> {
    const markerPath = `${ITEMS_DIR}/.plugin-items-imported`;
    const markerFile = app.vault.getAbstractFileByPath(markerPath);

    if (markerFile) {
        return false; // Already imported
    }

    // Create marker file for future
    try {
        await ensureItemDir(app);
        await app.vault.create(markerPath, `Item presets imported on ${new Date().toISOString()}`);
    } catch (err) {
        console.error("Failed to create item import marker:", err);
    }

    return true;
}

/**
 * Import equipment presets from bundled plugin files to vault
 */
export async function importEquipmentPresets(app: App): Promise<void> {
    try {
        // Ensure equipment directory exists
        await ensureEquipmentDir(app);

        // Load equipment presets from generated module
        const presetModule = await import('./preset-data');
        const presetFiles = presetModule.PRESET_EQUIPMENT || {};

        const fileNames = Object.keys(presetFiles);

        if (fileNames.length === 0) {
            console.log("No preset equipment found in plugin");
            return;
        }

        console.log(`Found ${fileNames.length} preset equipment in plugin`);

        // Get existing equipment files for comparison
        const existingEquipment = new Set();
        try {
            const existingFiles = await app.vault.adapter.list(EQUIPMENT_DIR);
            existingFiles.files.forEach(file => {
                const fileName = file.split('/').pop()?.toLowerCase();
                if (fileName) existingEquipment.add(fileName);
            });
        } catch {
            // Directory doesn't exist yet
        }

        let importedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const fileName of fileNames) {
            const targetPath = normalizePath(`${EQUIPMENT_DIR}/${fileName}`);

            // Check if equipment already exists
            if (existingEquipment.has(fileName.toLowerCase())) {
                skippedCount++;
                continue;
            }

            try {
                // Get preset content
                const content = presetFiles[fileName];

                // Create equipment file in vault
                await app.vault.create(targetPath, content);
                importedCount++;

                console.log(`Imported equipment preset: ${fileName}`);
            } catch (err) {
                console.error(`Failed to import equipment preset ${fileName}:`, err);
                errorCount++;
            }
        }

        // Show notification with results
        if (importedCount > 0) {
            new Notice(`Imported ${importedCount} equipment presets`);
            console.log(`Equipment import complete: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);
        } else if (skippedCount > 0) {
            console.log(`All ${skippedCount} equipment presets already exist`);
        } else if (errorCount > 0) {
            new Notice(`Failed to import equipment presets. Check console for details.`);
        }
    } catch (err) {
        console.error("Failed to import equipment presets:", err);
        // If preset-data module doesn't exist, it's not an error - just no presets
        if (err instanceof Error && err.message.includes('Cannot find module')) {
            console.log("No equipment preset data found - skipping equipment import");
        } else {
            new Notice("Failed to import equipment presets. Check console for details.");
        }
    }
}

/**
 * Check if equipment presets should be imported (first time setup)
 */
export async function shouldImportEquipmentPresets(app: App): Promise<boolean> {
    const markerPath = `${EQUIPMENT_DIR}/.plugin-equipment-imported`;
    const markerFile = app.vault.getAbstractFileByPath(markerPath);

    if (markerFile) {
        return false; // Already imported
    }

    // Create marker file for future
    try {
        await ensureEquipmentDir(app);
        await app.vault.create(markerPath, `Equipment presets imported on ${new Date().toISOString()}`);
    } catch (err) {
        console.error("Failed to create equipment import marker:", err);
    }

    return true;
}