// src/features/maps/data/tile-json-io.ts
// Consolidated Tile JSON I/O module

/**
 * Consolidated Tile JSON I/O
 *
 * Single module for all tile JSON operations:
 * - Type definitions and validation
 * - Schema migration
 * - Serialization helpers
 * - File I/O (load/save)
 * - Backup management
 *
 * Benefits of consolidation:
 * - Single source of truth for tile JSON format
 * - Easier maintenance (all logic in one place)
 * - Reduced import complexity
 * - Better cohesion (related functions grouped)
 */

// ============================================================================
// IMPORTS
// ============================================================================

import type { App} from "obsidian";
import { TFile, normalizePath } from "obsidian";
import { coordToKey as coordToKeyCore, keyToCoord as keyToCoordCore, type AxialCoord } from "@geometry";
import { isTerrainType, isFloraType, isMoistureLevel } from "../config/terrain";
import { getRandomTerrainVariant, getRandomFloraVariant } from "../rendering/icons/icon-registry";
import { getTerrainPositionConfig, getFloraPositionConfig } from "../rendering/icons/symbol-position-config";
import { TileValidationError } from "./tile-repository";
import type { TileData } from "./tile-repository";
import { configurableLogger } from "@services/logging/configurable-logger";
import { PerformanceTimer } from "@services/performance";

const logger = configurableLogger.forModule("tile-json-io");

/**
 * JSON Tile Storage Format
 *
 * Stores all tiles for a map in a single JSON file for performance.
 * Replaces one-file-per-tile markdown approach.
 *
 * Benefits:
 * - 96x faster loading (2.5ms vs 240ms for 95 tiles)
 * - 19x faster saving (7ms vs 133ms for radius-3 brush)
 * - 95% disk space reduction (20KB vs 380KB)
 * - Single atomic write operation
 *
 * Trade-offs:
 * - Loses Obsidian tile links (no `[[Hex 5,10]]`)
 * - No graph view for individual tiles
 * - No full-text search in tile data (JSON not indexed)
 */

// ============================================================================
// TYPES (from tile-json-schema.ts)
// ============================================================================

/**
 * Root JSON file structure.
 *
 * Version 2 format - stores tiles as sparse object (only painted tiles).
 * Version 2 adds: groundwater, fertility, derivations tracking
 */
export interface TileJSONFormat {
    version: number;                  // Schema version (currently 2)
    mapPath: string;                  // Reference to map file (e.g., "Maps/Regional-Map.md")
    created: string;                  // ISO timestamp (e.g., "2025-11-18T10:30:00Z")
    lastModified: string;             // ISO timestamp (updated on every save)
    tiles: Record<string, TileData>;  // Key format: "r,c" (e.g., "5,10")
}

/**
 * Coordinate key format: "r,c"
 *
 * Re-exported from central coordinate-system module.
 * These functions provide backward compatibility for existing code.
 *
 * Examples:
 * - (0, 0) → "0,0"
 * - (5, 10) → "5,10"
 * - (-3, 7) → "-3,7"
 */
export function coordToKey(coord: AxialCoord): string {
    return coordToKeyCore(coord);
}

export function keyToCoord(key: string): AxialCoord {
    return keyToCoordCore(key);
}

// ============================================================================
// VALIDATION (from tile-json-schema.ts + tile-json-validator.ts)
// ============================================================================

/**
 * Validate entire JSON file structure.
 *
 * Throws TileValidationError if invalid.
 */
export function validateTileJSON(data: unknown): TileJSONFormat {
    if (typeof data !== "object" || data === null) {
        throw new TileValidationError(["Root must be an object"]);
    }

    const obj = data as any;
    const issues: string[] = [];

    // Validate version
    if (typeof obj.version !== "number") {
        issues.push("version must be a number");
    } else if (obj.version < 1 || obj.version > 2) {
        issues.push(`Unsupported version: ${obj.version} (expected 1 or 2)`);
    }

    // Validate mapPath
    if (typeof obj.mapPath !== "string" || obj.mapPath.trim() === "") {
        issues.push("mapPath must be a non-empty string");
    }

    // Validate created (optional but should be ISO string)
    if (obj.created !== undefined && typeof obj.created !== "string") {
        issues.push("created must be an ISO timestamp string");
    }

    // Validate lastModified (optional but should be ISO string)
    if (obj.lastModified !== undefined && typeof obj.lastModified !== "string") {
        issues.push("lastModified must be an ISO timestamp string");
    }

    // Validate tiles object
    if (typeof obj.tiles !== "object" || obj.tiles === null || Array.isArray(obj.tiles)) {
        issues.push("tiles must be an object (not array)");
    } else {
        // Validate and normalize each tile entry
        const normalizedTiles: Record<string, TileData> = {};

        for (const [key, tileData] of Object.entries(obj.tiles)) {
            // Validate key format
            try {
                keyToCoord(key);
            } catch (error) {
                issues.push(`Invalid tile key: "${key}"`);
                continue;
            }

            // Validate tile data (basic structure check)
            if (typeof tileData !== "object" || tileData === null) {
                issues.push(`Tile ${key}: data must be an object`);
                continue;
            }

            // Validate and normalize tile data (normalizes empty strings to undefined)
            try {
                normalizedTiles[key] = validateTileDataLightweight(tileData);
            } catch (error) {
                if (error instanceof TileValidationError) {
                    issues.push(`Tile ${key}: ${error.message}`);
                } else {
                    issues.push(`Tile ${key}: validation failed`);
                }
            }
        }

        // Replace with normalized tiles
        obj.tiles = normalizedTiles;
    }

    if (issues.length > 0) {
        throw new TileValidationError(issues);
    }

    return obj as TileJSONFormat;
}

/**
 * Ensure tile has variant arrays for terrain/flora symbols.
 * Auto-generates random variants for tiles created before variant system was added.
 *
 * @param data - Tile data (may be missing variant arrays)
 * @returns Tile data with variants (mutates in-place for performance)
 */
function ensureVariants(data: any): void {
    // Generate terrain variants if terrain exists but variants don't
    if (data.terrain && !data.terrainVariants) {
        const positionConfig = getTerrainPositionConfig(data.terrain);
        data.terrainVariants = Array(positionConfig.positions.length)
            .fill(0)
            .map(() => getRandomTerrainVariant(data.terrain));
    }

    // Generate flora variants if flora exists but variants don't
    if (data.flora && !data.floraVariants) {
        const positionConfig = getFloraPositionConfig(data.flora);
        data.floraVariants = Array(positionConfig.positions.length)
            .fill(0)
            .map(() => getRandomFloraVariant(data.flora));
    }
}

/**
 * Validate single tile data (lightweight check).
 *
 * Skips detailed climate validation for performance.
 * Assumes data already persisted is mostly valid.
 *
 * DEFENSIVE: Normalizes empty strings to undefined to handle legacy data.
 * MIGRATION: Auto-generates variants for tiles created before variant system.
 */
export function validateTileDataLightweight(data: any): TileData {
    // MIGRATION: Ensure variants exist (for tiles created before variant system)
    ensureVariants(data);
    const issues: string[] = [];

    // DEFENSIVE: Normalize empty strings to undefined (handles legacy/corrupted data)
    const terrain = data.terrain || undefined;
    const flora = data.flora || undefined;
    const backgroundColor = data.backgroundColor || undefined;
    const region = data.region || undefined;
    const faction = data.faction || undefined;
    const note = data.note || undefined;
    const locationMarker = data.locationMarker || undefined;

    // Validate terrain (optional)
    if (terrain !== undefined && !isTerrainType(terrain)) {
        issues.push(`Invalid terrain: "${terrain}" (expected "plains" | "hills" | "mountains")`);
    }

    // Validate flora (optional)
    if (flora !== undefined && !isFloraType(flora)) {
        issues.push(`Invalid flora: "${flora}" (expected "dense" | "medium" | "field" | "barren")`);
    }

    // Validate backgroundColor (optional, hex color)
    if (backgroundColor !== undefined) {
        if (typeof backgroundColor !== "string") {
            issues.push("backgroundColor must be a string");
        } else if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(backgroundColor)) {
            issues.push(`Invalid backgroundColor: "${backgroundColor}" (expected hex color like "#2e7d32")`);
        }
    }

    // Validate region (optional, string, max 120 chars)
    if (region !== undefined) {
        if (typeof region !== "string") {
            issues.push("region must be a string");
        } else if (region.length > 120) {
            issues.push(`region too long: ${region.length} chars (max 120)`);
        }
    }

    // Validate faction (optional, string, max 120 chars)
    if (faction !== undefined) {
        if (typeof faction !== "string") {
            issues.push("faction must be a string");
        } else if (faction.length > 120) {
            issues.push(`faction too long: ${faction.length} chars (max 120)`);
        }
    }

    // Validate locationMarker (optional, string, max 200 chars)
    if (locationMarker !== undefined) {
        if (typeof locationMarker !== "string") {
            issues.push("locationMarker must be a string");
        } else if (locationMarker.length > 200) {
            issues.push(`locationMarker too long: ${locationMarker.length} chars (max 200)`);
        }
    }

    // Validate elevation (optional, number, -100 to 5000)
    if (data.elevation !== undefined) {
        if (typeof data.elevation !== "number" || isNaN(data.elevation)) {
            issues.push("elevation must be a number");
        } else if (data.elevation < -100 || data.elevation > 5000) {
            issues.push(`elevation out of range: ${data.elevation} (expected -100 to 5000)`);
        }
    }

    // Validate moisture level (optional, categorical string)
    if (data.moisture !== undefined) {
        if (typeof data.moisture !== "string") {
            issues.push("moisture must be a string (moisture level)");
        } else if (!isMoistureLevel(data.moisture)) {
            issues.push(`Invalid moisture level: ${data.moisture} (expected: desert, dry, lush, marshy, swampy, ponds, lakes, large_lake, sea, flood_plains)`);
        }
    }

    // Validate groundwater (optional, number, 0-100)
    if (data.groundwater !== undefined) {
        if (typeof data.groundwater !== "number" || isNaN(data.groundwater)) {
            issues.push("groundwater must be a number");
        } else if (data.groundwater < 0 || data.groundwater > 100) {
            issues.push(`groundwater out of range: ${data.groundwater} (expected 0-100)`);
        }
    }

    // Validate fertility (optional, number, 0-100)
    if (data.fertility !== undefined) {
        if (typeof data.fertility !== "number" || isNaN(data.fertility)) {
            issues.push("fertility must be a number");
        } else if (data.fertility < 0 || data.fertility > 100) {
            issues.push(`fertility out of range: ${data.fertility} (expected 0-100)`);
        }
    }

    // Validate derivations (optional, object with specific structure)
    if (data.derivations !== undefined) {
        if (typeof data.derivations !== "object" || data.derivations === null || Array.isArray(data.derivations)) {
            issues.push("derivations must be an object");
        } else {
            const validKeys = ['moisture', 'flora', 'terrain'];
            const derivations = data.derivations as any;

            for (const key of Object.keys(derivations)) {
                if (!validKeys.includes(key)) {
                    issues.push(`Invalid derivation key: "${key}" (expected: moisture, flora, terrain)`);
                } else {
                    const deriv = derivations[key];
                    if (typeof deriv !== "object" || deriv === null) {
                        issues.push(`derivations.${key} must be an object`);
                    } else if (deriv.source !== 'auto' && deriv.source !== 'manual') {
                        issues.push(`derivations.${key}.source must be 'auto' or 'manual' (got: ${deriv.source})`);
                    }
                }
            }
        }
    }

    // Validate terrainVariants (optional, array of positive integers, max 3 elements)
    if (data.terrainVariants !== undefined) {
        if (!Array.isArray(data.terrainVariants)) {
            issues.push("terrainVariants must be an array");
        } else if (data.terrainVariants.length > 3) {
            issues.push(`terrainVariants too long: ${data.terrainVariants.length} elements (max 3 for terrain)`);
        } else {
            for (let i = 0; i < data.terrainVariants.length; i++) {
                const variant = data.terrainVariants[i];
                if (typeof variant !== "number" || !Number.isInteger(variant) || variant < 1) {
                    issues.push(`terrainVariants[${i}] must be a positive integer (got ${variant})`);
                }
            }
        }
    }

    // Validate floraVariants (optional, array of positive integers, max 10 elements)
    if (data.floraVariants !== undefined) {
        if (!Array.isArray(data.floraVariants)) {
            issues.push("floraVariants must be an array");
        } else if (data.floraVariants.length > 10) {
            issues.push(`floraVariants too long: ${data.floraVariants.length} elements (max 10 for dense flora)`);
        } else {
            for (let i = 0; i < data.floraVariants.length; i++) {
                const variant = data.floraVariants[i];
                if (typeof variant !== "number" || !Number.isInteger(variant) || variant < 1) {
                    issues.push(`floraVariants[${i}] must be a positive integer (got ${variant})`);
                }
            }
        }
    }

    // Skip detailed climate validation for performance (assume valid if persisted)

    if (issues.length > 0) {
        throw new TileValidationError(issues);
    }

    // Return normalized data (empty strings converted to undefined, new fields preserved)
    return {
        terrain,
        flora,
        backgroundColor,
        region,
        faction,
        elevation: data.elevation,
        moisture: data.moisture,
        groundwater: data.groundwater,
        fertility: data.fertility,
        note,
        locationMarker,
        terrainVariants: data.terrainVariants,
        floraVariants: data.floraVariants,
        climate: data.climate, // Preserve climate data (skipping validation for performance)
        derivations: data.derivations, // Preserve derivations tracking
    } as TileData;
}

/**
 * Validate and normalize tile data before saving
 *
 * From tile-json-validator.ts
 */
export function validateAndNormalizeTileJSON(data: TileJSONFormat): TileJSONFormat {
    if (!data) {
        return createEmptyTileJSON("unknown");
    }

    // Ensure required fields exist
    const normalized: TileJSONFormat = {
        version: data.version || 1,
        mapPath: data.mapPath || "unknown",
        created: data.created || new Date().toISOString(),
        lastModified: data.lastModified || new Date().toISOString(),
        tiles: data.tiles || {},
    };

    // Validate tiles
    const validTiles: Record<string, any> = {};
    for (const [key, tileData] of Object.entries(normalized.tiles)) {
        try {
            validateTileDataLightweight(tileData);
            validTiles[key] = tileData;
        } catch (error) {
            logger.warn(`Skipping invalid tile: ${key}`);
        }
    }

    normalized.tiles = validTiles;
    return normalized;
}

/**
 * Check if tile data requires migration
 *
 * From tile-json-validator.ts
 */
export function requiresMigration(data: TileJSONFormat): boolean {
    // Check if version is old
    return data.version < 2;
}

// ============================================================================
// MIGRATION (from tile-json-schema.ts)
// ============================================================================

/**
 * Migrate JSON from older versions to current version.
 *
 * Version 1 → Version 2: Adds groundwater, fertility, and derivations tracking.
 * All new fields are optional, so existing data remains valid.
 */
export function migrateTileJSON(data: any): TileJSONFormat {
    // Version 0 → Version 1 (hypothetical, for future)
    if (!data.version || data.version === 0) {
        // Add version field, convert old format
        data.version = 1;
        data.created = data.created || new Date().toISOString();
        data.lastModified = data.lastModified || new Date().toISOString();
    }

    // Version 1 → Version 2: Add new fields (all optional, no data transformation needed)
    if (data.version === 1) {
        data.version = 2;
        data.lastModified = new Date().toISOString();
        // No tile data transformation needed - new fields are optional
    }

    // Validate after migration
    return validateTileJSON(data);
}

// ============================================================================
// SERIALIZATION (from tile-json-schema.ts)
// ============================================================================

/**
 * Create empty JSON structure for new map.
 */
export function createEmptyTileJSON(mapPath: string): TileJSONFormat {
    return {
        version: 2,
        mapPath,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        tiles: {}
    };
}

/**
 * Serialize JSON with pretty-printing for human readability.
 */
export function serializeTileJSON(data: TileJSONFormat): string {
    return JSON.stringify(data, null, 2);
}

/**
 * Parse JSON from string with validation.
 */
export function parseTileJSON(json: string): TileJSONFormat {
    let parsed: any;

    try {
        parsed = JSON.parse(json);
    } catch (error) {
        throw new TileValidationError([`JSON parse error: ${error.message}`]);
    }

    // Migrate if needed (handles older versions)
    const migrated = migrateTileJSON(parsed);

    // Validate structure
    return validateTileJSON(migrated);
}

// ============================================================================
// TILE HELPERS (from tile-json-schema.ts)
// ============================================================================

/**
 * Get tile data from JSON, returns undefined if not painted.
 */
export function getTileFromJSON(json: TileJSONFormat, coord: AxialCoord): TileData | undefined {
    const key = coordToKey(coord);
    return json.tiles[key];
}

/**
 * Set tile data in JSON (mutates in-place).
 *
 * If data is undefined/null, removes tile from JSON (unpaint).
 */
export function setTileInJSON(json: TileJSONFormat, coord: AxialCoord, data: TileData | null | undefined): void {
    const key = coordToKey(coord);

    if (data === null || data === undefined) {
        // Unpaint: Remove from sparse representation
        delete json.tiles[key];
    } else {
        // Paint: Add/update tile
        json.tiles[key] = data;
    }

    // Update lastModified timestamp
    json.lastModified = new Date().toISOString();
}

/**
 * Get all painted tiles as array.
 */
export function listTilesFromJSON(json: TileJSONFormat): Array<{ coord: AxialCoord; data: TileData }> {
    const result: Array<{ coord: AxialCoord; data: TileData }> = [];

    for (const [key, data] of Object.entries(json.tiles)) {
        const coord = keyToCoord(key);
        result.push({ coord, data });
    }

    return result;
}

/**
 * Count painted tiles in JSON.
 */
export function countTilesInJSON(json: TileJSONFormat): number {
    return Object.keys(json.tiles).length;
}

// ============================================================================
// FILE I/O (from tile-json-loader.ts + tile-json-saver.ts)
// ============================================================================

/**
 * Get JSON file path for map.
 *
 * Format: "Maps/Regional-Map.tiles.json"
 *
 * From tile-json-loader.ts
 */
export function getTileJSONPath(mapFile: TFile): string {
    const basePath = mapFile.path.replace(/\.md$/, "");
    return `${basePath}.tiles.json`;
}

/**
 * Load JSON file from disk.
 *
 * Returns null if file doesn't exist yet.
 *
 * From tile-json-loader.ts
 */
export async function loadTileJSONFromDisk(
    app: App,
    mapFile: TFile
): Promise<TileJSONFormat | null> {
    const timer = new PerformanceTimer("tile-json-load");
    const jsonPath = getTileJSONPath(mapFile);
    const file = app.vault.getAbstractFileByPath(jsonPath);

    if (!file || !(file instanceof TFile)) {
        timer.abort();
        return null;
    }

    try {
        const raw = await app.vault.read(file);
        const parsed = parseTileJSON(raw);
        timer.end();
        return parsed;
    } catch (error) {
        timer.abort();
        logger.error(`Failed to load ${jsonPath}:`, error);
        throw error;
    }
}

/**
 * Get backup folder path for JSON file.
 *
 * Format: ".obsidian/plugins/salt-marcher/backups/tiles/"
 *
 * From tile-json-saver.ts
 */
export function getBackupFolder(app: App): string {
    // @ts-ignore - Plugin API
    const pluginDir = app.vault.configDir + "/plugins/salt-marcher";
    return normalizePath(`${pluginDir}/backups/tiles`);
}

/**
 * Get backup file path with timestamp.
 *
 * Format: ".obsidian/plugins/salt-marcher/backups/tiles/Regional-Map-1732000000000.json"
 *
 * From tile-json-saver.ts
 */
export function getBackupPath(app: App, mapFile: TFile, timestamp: number): string {
    const backupFolder = getBackupFolder(app);
    const baseName = mapFile.basename;
    return normalizePath(`${backupFolder}/${baseName}-${timestamp}.json`);
}

/**
 * Save JSON file to disk with automatic backup.
 *
 * Creates backup of previous version before writing new version.
 *
 * From tile-json-saver.ts
 */
export async function saveTileJSONToDisk(
    app: App,
    mapFile: TFile,
    data: TileJSONFormat
): Promise<void> {
    const timer = new PerformanceTimer("tile-json-save");
    const jsonPath = getTileJSONPath(mapFile);

    try {
        // Ensure backups folder exists
        const backupFolder = getBackupFolder(app);
        if (!app.vault.getAbstractFileByPath(backupFolder)) {
            try {
                await app.vault.createFolder(backupFolder);
            } catch (error) {
                // Ignore "already exists" errors from race condition
                if (!(error instanceof Error && error.message.includes("already exists"))) {
                    throw error;
                }
            }
        }

        // Create backup of current version (if exists)
        const existingFile = app.vault.getAbstractFileByPath(jsonPath);
        if (existingFile && existingFile instanceof TFile) {
            const backupPath = getBackupPath(app, mapFile, Date.now());
            const content = await app.vault.read(existingFile);
            await app.vault.create(backupPath, content);

            // Cleanup old backups (keep last 2 - Obsidian has own recovery)
            await cleanupOldBackups(app, mapFile, 2);
        }

        // Update lastModified timestamp
        data.lastModified = new Date().toISOString();

        // Serialize with pretty-printing
        const serialized = serializeTileJSON(data);

        // Write to disk (atomic)
        if (existingFile && existingFile instanceof TFile) {
            await app.vault.modify(existingFile, serialized);
        } else {
            await app.vault.create(jsonPath, serialized);
        }

        timer.end();
    } catch (error) {
        timer.abort();
        logger.error(`FAILED to save ${jsonPath}:`, error);
        throw error;
    }
}

/**
 * Delete old backup files, keeping only the N most recent.
 *
 * From tile-json-saver.ts
 */
export async function cleanupOldBackups(app: App, mapFile: TFile, keepCount: number): Promise<void> {
    const backupFolder = getBackupFolder(app);
    const folder = app.vault.getAbstractFileByPath(backupFolder);
    if (!folder) return;

    // Find all backup files for this map
    const baseName = mapFile.basename;
    const pattern = new RegExp(`^${baseName}-(\\d+)\\.json$`);

    const backups: Array<{ file: TFile; timestamp: number }> = [];

    for (const file of app.vault.getMarkdownFiles()) {
        if (!file.path.startsWith(backupFolder)) continue;

        const match = file.name.match(pattern);
        if (match) {
            const timestamp = parseInt(match[1], 10);
            backups.push({ file, timestamp });
        }
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp - a.timestamp);

    // Delete old backups
    for (let i = keepCount; i < backups.length; i++) {
        await app.vault.delete(backups[i].file);
    }
}
