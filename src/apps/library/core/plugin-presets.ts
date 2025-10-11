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
            console.log(`No preset ${typeName} found in plugin`);
            return;
        }

        console.log(`Found ${fileNames.length} preset ${typeName} in plugin`);

        // Get existing files for comparison
        const existingFiles = new Set();
        try {
            const existing = await app.vault.adapter.list(normalizedDir);
            const prefix = `${normalizedDir}/`;
            existing.files.forEach(file => {
                const normalizedFile = normalizePath(file);
                if (normalizedFile.startsWith(prefix)) {
                    const relativePath = normalizedFile.slice(prefix.length).toLowerCase();
                    if (relativePath) existingFiles.add(relativePath);
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

            // Check if file already exists
            if (existingFiles.has(loweredName)) {
                skippedCount++;
                continue;
            }

            try {
                // Get preset content
                await ensureParentFolders(app, normalizedDir, fileName, ensuredFolders);
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