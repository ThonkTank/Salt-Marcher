// src/features/maps/data/map-repository.ts
// Consolidated map CRUD operations
import type { App} from "obsidian";
import { TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { registerMapStores, unregisterMapStores } from "./map-store-registry";

const logger = configurableLogger.forModule("map-repository");
import { getTileJSONPath } from "./tile-json-io";
import { initTilesForNewMap } from "./tile-repository";
import { MapDimensions } from "../config/map-dimensions";
import type { MapClimateSettings, CompassDirection } from "../config/options";
import { HEX_BLOCK_REGEX, HEX_BLOCK_CONTENT_REGEX, HEXMAP_BLOCK_IDENTIFIER } from "../config/constants";

// ===== Create =====

/**
 * Configuration for creating a new hex map
 */
export interface CreateMapConfig {
    /** Map display name */
    name: string;
    /** Map dimensions (tile radius + hex pixel size) */
    dimensions: MapDimensions;
    /** Optional climate settings (defaults applied if not provided) */
    climate?: Partial<MapClimateSettings>;
    /** Optional generation settings */
    generation?: {
        /** Edges with water/coast */
        coastEdges?: CompassDirection[];
    };
}

/**
 * Creates a new map .md file with hex3x3 block.
 * Uses JSON tile storage (single .tiles.json file).
 *
 * @param app - Obsidian app instance
 * @param config - Map creation configuration
 * @returns Created map file
 */
export async function createHexMapFile(
    app: App,
    config: CreateMapConfig
): Promise<TFile> {
    logger.debug(`START`);
    logger.debug(`config.name: ${config.name}`);
    logger.debug(`config.dimensions.tileRadius: ${config.dimensions.tileRadius}`);
    logger.debug(`config.dimensions.tileCount: ${config.dimensions.tileCount}`);

    const name = sanitizeFileName(config.name) || "Neue Hex Map";
    const content = buildHexMapMarkdown(
        name,
        config.dimensions.hexPixelSize as number,
        config.climate?.globalBaseTemperature,
        config.climate?.globalWindDirection,
        config.climate?.basePrecipitation,
        config.generation?.coastEdges
    );
    const mapsFolder = "SaltMarcher/Maps";
    await app.vault.createFolder(mapsFolder).catch((e) => {
        if (!e?.message?.includes('already exists')) {
            logger.warn('Folder creation failed:', e);
        }
    });
    const path = await ensureUniquePath(app, `${mapsFolder}/${name}.md`);
    const file = await app.vault.create(path, content);

    logger.debug(`Markdown file created: ${file.path}`);
    logger.debug(`Calling initTilesForNewMap with radius: ${config.dimensions.tileRadius}`);

    // Immediately create initial tiles → renderer has bounds, brush/inspector work without reload
    await initTilesForNewMap(app, file, config.dimensions.tileRadius as number);
    registerMapStores(app, file);

    logger.debug(`DONE - map created: ${file.path}`);
    return file;
}

/**
 * Build map markdown with hexmap codeblock.
 * Uses JSON-only storage (no folder/folderPrefix needed).
 *
 * @param name - Map display name
 * @param hexPixelSize - Hex size in pixels (default: 42)
 * @param baseTemperature - Global base temperature in °C (default: 15)
 * @param windDirection - Prevailing wind direction in degrees (default: 270 = West)
 * @param basePrecipitation - Annual precipitation in mm (default: 800)
 * @param coastEdges - Optional: Edges with water/coast (for guided creation)
 * @returns Markdown content
 */
export function buildHexMapMarkdown(
    name: string,
    hexPixelSize: number = 42,
    baseTemperature: number = 15,
    windDirection: number = 270,
    basePrecipitation: number = 800,
    coastEdges?: CompassDirection[]
): string {
    const lines = [
        "---",
        'smMap: true',
        "---",
        `# ${name}`,
        "",
        `\`\`\`${HEXMAP_BLOCK_IDENTIFIER}`,
        `hexPixelSize: ${hexPixelSize}`,
        `baseTemperature: ${baseTemperature}`,
        `windDirection: ${windDirection}`,
        `basePrecipitation: ${basePrecipitation}`,
    ];

    // Add generation settings if provided
    if (coastEdges !== undefined && coastEdges.length > 0) {
        lines.push(`coastEdges: ${coastEdges.join(",")}`);
    }

    lines.push(
        "```",
        "",
        "Tiles stored in JSON format (automatic).",
        ""
    );

    return lines.join("\n");
}

/** Sanitizes filename against forbidden characters / double spaces. */
export function sanitizeFileName(input: string): string {
    return input
        .trim()
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .slice(0, 120);
}

/** Appends " (2)", " (3)", etc. if the path already exists. */
export async function ensureUniquePath(app: App, basePath: string): Promise<string> {
    if (!app.vault.getAbstractFileByPath(basePath)) return basePath;

    const dot = basePath.lastIndexOf(".");
    const stem = dot === -1 ? basePath : basePath.slice(0, dot);
    const ext = dot === -1 ? "" : basePath.slice(dot);

    for (let i = 2; i < 9999; i++) {
        const candidate = `${stem} (${i})${ext}`;
        if (!app.vault.getAbstractFileByPath(candidate)) return candidate;
    }

    // Fallback – extremely unlikely
    return `${stem}-${Date.now()}${ext}`;
}

// ===== Read =====

/** Returns the newest file from the list (by mtime). */
export function pickLatest(files: TFile[]): TFile | null {
    if (!files.length) return null;
    return [...files].sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0))[0];
}

/**
 * Returns all markdown files that contain at least one hexmap/hex3x3 codeblock.
 * Sorted by last modification (newest first).
 */
export async function getAllMapFiles(app: App): Promise<TFile[]> {
    const mdFiles = app.vault.getMarkdownFiles();
    const results: TFile[] = [];

    for (const f of mdFiles) {
        const content = await app.vault.cachedRead(f);
        if (HEX_BLOCK_REGEX.test(content)) results.push(f);
    }

    // Newest first
    return results.sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0));
}

/**
 * Returns the **first** hexmap/hex3x3 block content (without ``` markers).
 * Return value is the options text expected by `parseOptions(...)`.
 */
export async function getFirstHexBlock(app: App, file: TFile): Promise<string | null> {
    const content = await app.vault.cachedRead(file);
    const m = content.match(HEX_BLOCK_CONTENT_REGEX);
    // Capture group 1 is identifier (hex3x3|hexmap), group 2 is content
    return m ? m[2].trim() : null;
}

// ===== Delete =====

export async function deleteMapAndTiles(app: App, mapFile: TFile): Promise<void> {
    logger.info(`[map-repository] Starting deletion of map: ${mapFile.path}`);

    // 1) Delete JSON tile file (tiles are stored in single JSON file, not individual markdown files)
    const jsonPath = getTileJSONPath(mapFile);
    const jsonFile = app.vault.getAbstractFileByPath(jsonPath);
    if (jsonFile instanceof TFile) {
        try {
            await app.vault.delete(jsonFile);
            logger.info(`Deleted tiles JSON: ${jsonPath}`);
        } catch (e) {
            logger.warn(`Failed to delete tiles JSON: ${jsonPath}`, e);
        }
    } else {
        logger.info(`No tiles JSON file found: ${jsonPath}`);
    }

    // 2) Delete map markdown file
    try {
        await app.vault.delete(mapFile);
        logger.info(`Map file deleted: ${mapFile.path}`);
    } catch (e) {
        logger.error(`Delete map failed: ${mapFile.path}`, e);
    }

    // 3) Unregister stores
    unregisterMapStores(app, mapFile);
    logger.info(`Map deletion complete`);
}
