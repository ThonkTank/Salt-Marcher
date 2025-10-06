// src/apps/library/tools/convert-references.ts
// Tool zum Konvertieren von Reference Statblöcken und Spells zu Preset-Format

import type { App, TFile } from "obsidian";
import { parseReferenceStatblock } from "../core/reference-parser";
import { parseReferenceSpell } from "../core/spell-reference-parser";
import { statblockToMarkdown } from "../core/creature-files";
import { spellToMarkdown } from "../core/spell-files";
import { Notice } from "obsidian";

const CREATURES_REFERENCES_DIR = "References/rulebooks/Statblocks/Creatures";
const CREATURES_PRESETS_DIR = "SaltMarcher/Presets/Creatures";
const SPELLS_REFERENCES_FILE = "References/rulebooks/Spells/07_Spells.md";
const SPELLS_PRESETS_DIR = "SaltMarcher/Presets/Spells";

export interface ConversionResult {
    success: number;
    failed: number;
    skipped: number;
    errors: Array<{ file: string; error: string }>;
}

/**
 * Konvertiert alle Reference Statblöcke zu Presets.
 * Behält die Ordnerstruktur bei (Animals/, Monsters/, etc.)
 */
export async function convertAllReferences(
    app: App,
    options: {
        dryRun?: boolean;
        limit?: number;
        onProgress?: (current: number, total: number, file: string) => void;
    } = {}
): Promise<ConversionResult> {
    const { dryRun = false, limit, onProgress } = options;

    const result: ConversionResult = {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [],
    };

    // 1. Finde alle Reference-Dateien
    const referenceFiles = await findReferenceFiles(app);

    if (referenceFiles.length === 0) {
        new Notice("Keine Reference Statblöcke gefunden");
        return result;
    }

    const filesToProcess = limit ? referenceFiles.slice(0, limit) : referenceFiles;

    new Notice(`Konvertiere ${filesToProcess.length} Statblöcke${dryRun ? " (Dry Run)" : ""}...`);

    // 2. Erstelle Preset-Verzeichnis
    if (!dryRun) {
        await ensureDir(app, CREATURES_PRESETS_DIR);
    }

    // 3. Konvertiere jede Datei
    for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        onProgress?.(i + 1, filesToProcess.length, file.path);

        try {
            await convertFile(app, file, dryRun);
            result.success++;
        } catch (error) {
            result.failed++;
            result.errors.push({
                file: file.path,
                error: error instanceof Error ? error.message : String(error),
            });
            console.error(`Fehler beim Konvertieren von ${file.path}:`, error);
        }
    }

    const summary = `Konvertierung abgeschlossen: ${result.success} erfolgreich, ${result.failed} fehlgeschlagen`;
    new Notice(summary);
    console.log(summary);

    if (result.errors.length > 0) {
        console.log("Fehler:", result.errors);
    }

    return result;
}

/**
 * Konvertiert eine einzelne Reference-Datei
 */
async function convertFile(app: App, file: TFile, dryRun: boolean): Promise<void> {
    // 1. Lese Reference Markdown
    const content = await app.vault.read(file);

    // 2. Parse zu StatblockData
    const statblockData = parseReferenceStatblock(content);

    // 3. Konvertiere zu Preset Markdown
    const presetMarkdown = statblockToMarkdown(statblockData);

    // 4. Bestimme Ziel-Pfad (behält Unterordner bei)
    const relativePath = file.path.replace(`${CREATURES_REFERENCES_DIR}/`, '');
    const targetPath = `${CREATURES_PRESETS_DIR}/${relativePath}`;

    if (dryRun) {
        console.log(`[DRY RUN] Würde konvertieren: ${file.path} -> ${targetPath}`);
        return;
    }

    // 5. Erstelle Unterordner falls nötig
    const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
    await ensureDir(app, targetDir);

    // 6. Speichere Preset
    const existingFile = app.vault.getAbstractFileByPath(targetPath);
    if (existingFile) {
        // Überschreibe existierende Datei
        await app.vault.modify(existingFile as TFile, presetMarkdown);
    } else {
        // Erstelle neue Datei
        await app.vault.create(targetPath, presetMarkdown);
    }
}

/**
 * Findet alle Reference Statblock Dateien
 */
async function findReferenceFiles(app: App): Promise<TFile[]> {
    const files: TFile[] = [];

    const traverse = (folderPath: string) => {
        const folder = app.vault.getAbstractFileByPath(folderPath);
        if (!folder) return;

        if ('children' in folder) {
            // Is a folder
            for (const child of (folder as any).children) {
                if ('children' in child) {
                    // Child is also a folder
                    traverse(child.path);
                } else if (child.path.endsWith('.md')) {
                    // Child is a markdown file
                    files.push(child as TFile);
                }
            }
        }
    };

    traverse(CREATURES_REFERENCES_DIR);
    return files;
}

/**
 * Stellt sicher dass ein Verzeichnis existiert
 */
async function ensureDir(app: App, path: string): Promise<void> {
    const exists = app.vault.getAbstractFileByPath(path);
    if (!exists) {
        await app.vault.createFolder(path);
    }
}

/**
 * Konvertiert nur spezifische Creature Dateien (für Testing)
 */
export async function convertSpecificFiles(
    app: App,
    filePaths: string[],
    dryRun: boolean = false
): Promise<ConversionResult> {
    const result: ConversionResult = {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [],
    };

    if (!dryRun) {
        await ensureDir(app, CREATURES_PRESETS_DIR);
    }

    for (const filePath of filePaths) {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file || !('extension' in file) || file.extension !== 'md') {
            result.skipped++;
            continue;
        }

        try {
            await convertFile(app, file as TFile, dryRun);
            result.success++;
        } catch (error) {
            result.failed++;
            result.errors.push({
                file: filePath,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return result;
}

// ========== SPELL CONVERSION ==========

/**
 * Konvertiert alle Spells aus der Spells Reference Datei zu einzelnen Presets.
 */
export async function convertAllSpells(
    app: App,
    options: {
        dryRun?: boolean;
        limit?: number;
        onProgress?: (current: number, total: number, spell: string) => void;
    } = {}
): Promise<ConversionResult> {
    const { dryRun = false, limit, onProgress } = options;

    const result: ConversionResult = {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [],
    };

    // 1. Lese die Spells Reference Datei
    const spellsFile = app.vault.getAbstractFileByPath(SPELLS_REFERENCES_FILE);
    if (!spellsFile || !('extension' in spellsFile)) {
        new Notice("Spells Reference Datei nicht gefunden");
        return result;
    }

    const content = await app.vault.read(spellsFile as TFile);

    // 2. Extrahiere einzelne Spells (Split by #### headers)
    const spellSections = extractSpellSections(content);

    if (spellSections.length === 0) {
        new Notice("Keine Spells in Reference Datei gefunden");
        return result;
    }

    const sectionsToProcess = limit ? spellSections.slice(0, limit) : spellSections;

    new Notice(`Konvertiere ${sectionsToProcess.length} Spells${dryRun ? " (Dry Run)" : ""}...`);

    // 3. Erstelle Preset-Verzeichnis
    if (!dryRun) {
        await ensureDir(app, SPELLS_PRESETS_DIR);
    }

    // 4. Konvertiere jeden Spell
    for (let i = 0; i < sectionsToProcess.length; i++) {
        const spellMarkdown = sectionsToProcess[i];
        onProgress?.(i + 1, sectionsToProcess.length, spellMarkdown.split('\n')[0]);

        try {
            await convertSpellSection(app, spellMarkdown, dryRun);
            result.success++;
        } catch (error) {
            result.failed++;
            result.errors.push({
                file: `Spell ${i + 1}`,
                error: error instanceof Error ? error.message : String(error),
            });
            console.error(`Fehler beim Konvertieren von Spell:`, error);
        }
    }

    const summary = `Spell-Konvertierung abgeschlossen: ${result.success} erfolgreich, ${result.failed} fehlgeschlagen`;
    new Notice(summary);
    console.log(summary);

    if (result.errors.length > 0) {
        console.log("Fehler:", result.errors);
    }

    return result;
}

/**
 * Extrahiert einzelne Spell-Sektionen aus der großen Spells.md Datei
 */
function extractSpellSections(content: string): string[] {
    const sections: string[] = [];
    const lines = content.split('\n');
    let currentSection: string[] = [];

    for (const line of lines) {
        // Spell beginnt mit #### Header
        if (line.startsWith('####')) {
            // Save previous section if it exists
            if (currentSection.length > 0) {
                sections.push(currentSection.join('\n'));
            }
            currentSection = [line];
        } else if (currentSection.length > 0) {
            // Continue current section
            currentSection.push(line);
        }
    }

    // Don't forget the last section
    if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
    }

    return sections;
}

/**
 * Konvertiert eine einzelne Spell-Sektion
 */
async function convertSpellSection(app: App, spellMarkdown: string, dryRun: boolean): Promise<void> {
    // 1. Parse zu SpellData
    const spellData = parseReferenceSpell(spellMarkdown);

    // 2. Konvertiere zu Preset Markdown
    const presetMarkdown = spellToMarkdown(spellData);

    // 3. Sanitize spell name für Dateinamen
    const fileName = spellData.name.replace(/[\\/:*?"<>|]/g, '-') + '.md';
    const targetPath = `${SPELLS_PRESETS_DIR}/${fileName}`;

    if (dryRun) {
        console.log(`[DRY RUN] Würde konvertieren: ${spellData.name} -> ${targetPath}`);
        return;
    }

    // 4. Speichere Preset
    const existingFile = app.vault.getAbstractFileByPath(targetPath);
    if (existingFile) {
        // Überschreibe existierende Datei
        await app.vault.modify(existingFile as TFile, presetMarkdown);
    } else {
        // Erstelle neue Datei
        await app.vault.create(targetPath, presetMarkdown);
    }
}
