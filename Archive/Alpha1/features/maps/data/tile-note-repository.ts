// src/features/maps/data/tile-note-repository.ts

import { TFile, normalizePath } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import type { AxialCoord } from "@geometry";

const logger = configurableLogger.forModule("tile-note-repository");
import type { VaultAdapter } from "@adapters/vault-adapter";

/**
 * Tile Note Repository
 *
 * Manages optional markdown notes for hexes (separate from JSON tile data).
 *
 * Purpose:
 * - User narratives (POI descriptions, DM secrets, session notes)
 * - Manual annotations (not auto-generated terrain data)
 * - Obsidian integration (links, backlinks, graph view)
 *
 * File Structure:
 * - Location: `tiles/{MapName}/notes/{q},{r}.md`
 * - Format: Standard markdown with optional frontmatter
 * - Creation: ONLY via explicit user action (not auto-generated)
 *
 * Separation of Concerns:
 * - JSON (performance-critical): terrain, flora, region, faction, elevation, climate
 * - Markdown (optional): narratives, descriptions, DM notes, manual links
 */

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Get notes folder path for map.
 *
 * Format: "tiles/Regional-Map/notes"
 */
export function getNotesFolderPath(mapFile: TFile): string {
    const baseName = mapFile.basename;
    return normalizePath(`tiles/${baseName}/notes`);
}

/**
 * Get note file path for coordinate.
 *
 * Format: "tiles/Regional-Map/notes/5,10.md"
 */
export function getNotePath(mapFile: TFile, coord: AxialCoord): string {
    const folder = getNotesFolderPath(mapFile);
    return normalizePath(`${folder}/${coord.q},${coord.r}.md`);
}

/**
 * Parse coordinate from note filename.
 *
 * Examples:
 * - "5,10.md" → { q: 5, r: 10 }
 * - "-3,7.md" → { q: -3, r: 7 }
 *
 * Returns null if filename doesn't match pattern.
 */
export function parseNoteFilename(filename: string): AxialCoord | null {
    const match = filename.match(/^(-?\d+),(-?\d+)\.md$/);
    if (!match) return null;

    const q = parseInt(match[1], 10);
    const r = parseInt(match[2], 10);

    if (isNaN(q) || isNaN(r)) return null;

    return { q, r };
}

// ============================================================================
// Note Operations
// ============================================================================

/**
 * Check if note exists for coordinate.
 */
export function noteExists(vault: VaultAdapter, mapFile: TFile, coord: AxialCoord): boolean {
    const path = getNotePath(mapFile, coord);
    const file = vault.getAbstractFileByPath(path);
    return file instanceof TFile;
}

/**
 * Load note content for coordinate.
 *
 * Returns null if note doesn't exist.
 */
export async function loadNote(
    vault: VaultAdapter,
    mapFile: TFile,
    coord: AxialCoord
): Promise<string | null> {
    const path = getNotePath(mapFile, coord);
    const file = vault.getAbstractFileByPath(path);

    if (!file || !(file instanceof TFile)) {
        logger.debug(`No note found: ${path}`);
        return null;
    }

    try {
        const content = await vault.read(file);
        logger.info(`Loaded note: ${path}`);
        return content;
    } catch (error) {
        logger.error(`Failed to load note ${path}:`, error);
        throw error;
    }
}

/**
 * Create new note for coordinate with optional template.
 *
 * ONLY call this from explicit user actions (e.g., "Add Note" button).
 * DO NOT auto-generate notes during painting.
 *
 * Template variables:
 * - {{coord}} → Coordinate string (e.g., "5,10")
 * - {{mapName}} → Map basename (e.g., "Regional-Map")
 * - {{date}} → ISO date (e.g., "2025-11-18")
 */
export async function createNote(
    vault: VaultAdapter,
    mapFile: TFile,
    coord: AxialCoord,
    template?: string
): Promise<TFile> {
    const path = getNotePath(mapFile, coord);

    // Check if already exists
    if (noteExists(vault, mapFile, coord)) {
        logger.warn(`Note already exists: ${path}`);
        throw new Error(`Note already exists for hex ${coord.q},${coord.r}`);
    }

    // Ensure notes folder exists
    const folder = getNotesFolderPath(mapFile);
    if (!vault.getAbstractFileByPath(folder)) {
        await vault.createFolder(folder);
        logger.info(`Created notes folder: ${folder}`);
    }

    // Apply template variables
    const content = template
        ? template
            .replace(/\{\{coord\}\}/g, `${coord.q},${coord.r}`)
            .replace(/\{\{mapName\}\}/g, mapFile.basename)
            .replace(/\{\{date\}\}/g, new Date().toISOString().split("T")[0])
        : `# Hex ${coord.q},${coord.r}\n\n`;

    try {
        const file = await vault.create(path, content);
        logger.info(`Created note: ${path}`);
        return file;
    } catch (error) {
        logger.error(`Failed to create note ${path}:`, error);
        throw error;
    }
}

/**
 * Save note content for coordinate.
 *
 * If note doesn't exist, creates it. Otherwise updates existing note.
 */
export async function saveNote(
    vault: VaultAdapter,
    mapFile: TFile,
    coord: AxialCoord,
    content: string
): Promise<void> {
    const path = getNotePath(mapFile, coord);
    const file = vault.getAbstractFileByPath(path);

    if (file instanceof TFile) {
        // Update existing note
        await vault.modify(file, content);
        logger.info(`Updated note: ${path}`);
    } else {
        // Create new note
        await createNote(vault, mapFile, coord, content);
    }
}

/**
 * Delete note for coordinate.
 *
 * Does nothing if note doesn't exist.
 */
export async function deleteNote(
    vault: VaultAdapter,
    mapFile: TFile,
    coord: AxialCoord
): Promise<void> {
    const path = getNotePath(mapFile, coord);
    const file = vault.getAbstractFileByPath(path);

    if (!file || !(file instanceof TFile)) {
        logger.debug(`No note to delete: ${path}`);
        return;
    }

    try {
        await vault.delete(file);
        logger.info(`Deleted note: ${path}`);
    } catch (error) {
        logger.error(`Failed to delete note ${path}:`, error);
        throw error;
    }
}

/**
 * List all notes for map.
 *
 * Returns array of { coord, file, path } objects.
 */
export async function listNotes(
    vault: VaultAdapter,
    mapFile: TFile
): Promise<Array<{ coord: AxialCoord; file: TFile; path: string }>> {
    const folder = getNotesFolderPath(mapFile);
    const folderObj = vault.getAbstractFileByPath(folder);

    if (!folderObj) {
        logger.debug(`Notes folder doesn't exist: ${folder}`);
        return [];
    }

    const notes: Array<{ coord: AxialCoord; file: TFile; path: string }> = [];

    // Find all .md files in notes folder
    for (const file of vault.getMarkdownFiles()) {
        if (!file.path.startsWith(folder)) continue;

        const coord = parseNoteFilename(file.name);
        if (coord) {
            notes.push({ coord, file, path: file.path });
        }
    }

    logger.info(`Found ${notes.length} notes for ${mapFile.basename}`);
    return notes;
}

/**
 * Delete all notes for map (cleanup on map deletion).
 *
 * Removes entire notes folder and all contained files.
 */
export async function deleteAllNotes(vault: VaultAdapter, mapFile: TFile): Promise<void> {
    const folder = getNotesFolderPath(mapFile);
    const folderObj = vault.getAbstractFileByPath(folder);

    if (!folderObj) {
        logger.debug(`No notes folder to delete: ${folder}`);
        return;
    }

    try {
        // Delete all note files first
        const notes = await listNotes(vault, mapFile);
        for (const { file } of notes) {
            await vault.delete(file);
        }

        // Delete folder (if empty)
        const updatedFolder = vault.getAbstractFileByPath(folder);
        if (updatedFolder instanceof TFile) {
            await vault.delete(updatedFolder);
        }

        logger.info(`Deleted all notes for ${mapFile.basename}`);
    } catch (error) {
        logger.error(`Failed to delete notes folder ${folder}:`, error);
        throw error;
    }
}

// ============================================================================
// Template Helpers
// ============================================================================

/**
 * Default note template.
 *
 * Used when creating notes without custom template.
 */
export const DEFAULT_NOTE_TEMPLATE = `# Hex {{coord}}

**Map:** [[{{mapName}}]]
**Created:** {{date}}

## Description

(Write your description here)

## Notes

(Session notes, DM secrets, etc.)
`;

/**
 * Create note with default template.
 */
export async function createNoteWithDefaultTemplate(
    vault: VaultAdapter,
    mapFile: TFile,
    coord: AxialCoord
): Promise<TFile> {
    return createNote(vault, mapFile, coord, DEFAULT_NOTE_TEMPLATE);
}
