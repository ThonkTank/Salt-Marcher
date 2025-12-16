// src/features/maps/data/tile-repository.ts
import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import type { TileData } from "@domain";

const logger = configurableLogger.forModule("tile-repository");
import type { AxialCoord } from "@geometry";
import { coordsInRadius } from "@geometry";
import { type TerrainType, type FloraType, type MoistureLevel, isTerrainType, isFloraType, isMoistureLevel } from "../config/terrain";
import { coordToKey, type CoordKey } from "@geometry";
import { getMapSession, disposeMapSession } from "../session";

// Re-export domain types for backward compatibility
export type { TileData };
// NOTE: TileCoord is exported from data/index.ts (canonical) - avoid duplicate re-exports

const TILE_REGION_MAX_LENGTH = 120;
const TILE_FACTION_MAX_LENGTH = 120;
const TILE_LOCATION_MARKER_MAX_LENGTH = 200;
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export class TileValidationError extends Error {
    constructor(public readonly issues: string[]) {
        super(`Invalid tile data: ${issues.join(", ")}`);
        this.name = "TileValidationError";
    }
}

/**
 * Validate climate data and return sanitized version.
 * Throws TileValidationError if validation fails.
 */
function validateClimateData(climate: any): TileData['climate'] {
    const issues: string[] = [];

    // Validate temperatureOffset
    let temperatureOffset: number | undefined;
    if (climate.temperatureOffset !== undefined && climate.temperatureOffset !== null) {
        const offset = typeof climate.temperatureOffset === "number" ? climate.temperatureOffset : Number(climate.temperatureOffset);
        if (isNaN(offset)) {
            issues.push("climate.temperatureOffset must be a number");
        } else if (offset < -30 || offset > 30) {
            issues.push("climate.temperatureOffset must be between -30 and +30 Celsius");
        } else {
            temperatureOffset = offset;
        }
    }

    if (issues.length > 0) {
        throw new TileValidationError(issues);
    }

    // Only return climate object if temperatureOffset is set
    if (temperatureOffset === undefined) {
        return undefined;
    }

    return {
        temperatureOffset,
    };
}

export function validateTileData(data: TileData): TileData {
    const issues: string[] = [];

    // Validate terrain type
    let terrain: TerrainType | undefined;
    if (data.terrain !== undefined && data.terrain !== null) {
        if (typeof data.terrain === "string") {
            const value = data.terrain.trim();
            if (value && !isTerrainType(value)) {
                issues.push(`Invalid terrain type "${value}" (must be: plains, hills, mountains)`);
            } else if (value) {
                terrain = value as TerrainType;
            }
        } else {
            issues.push(`terrain must be a string`);
        }
    }

    // Validate flora type
    let flora: FloraType | undefined;
    if (data.flora !== undefined && data.flora !== null) {
        if (typeof data.flora === "string") {
            const value = data.flora.trim();
            if (value && !isFloraType(value)) {
                issues.push(`Invalid flora type "${value}" (must be: dense, medium, field, barren)`);
            } else if (value) {
                flora = value as FloraType;
            }
        } else {
            issues.push(`flora must be a string`);
        }
    }

    // Validate background color (optional)
    let backgroundColor: string | undefined;
    if (data.backgroundColor !== undefined && data.backgroundColor !== null) {
        if (typeof data.backgroundColor === "string") {
            const value = data.backgroundColor.trim();
            if (value && value !== "transparent" && !HEX_COLOR_RE.test(value)) {
                issues.push(`backgroundColor must be a hex color (e.g., #2e7d32)`);
            } else if (value) {
                backgroundColor = value;
            }
        } else {
            issues.push(`backgroundColor must be a string`);
        }
    }

    // Validate region
    const regionRaw = typeof data.region === "string" ? data.region : "";
    const region = regionRaw.trim();
    if (region.length > TILE_REGION_MAX_LENGTH) {
        issues.push(`region exceeds ${TILE_REGION_MAX_LENGTH} characters`);
    }

    // Validate faction
    const factionRaw = typeof data.faction === "string" ? data.faction : "";
    const faction = factionRaw.trim();
    if (faction.length > TILE_FACTION_MAX_LENGTH) {
        issues.push(`faction exceeds ${TILE_FACTION_MAX_LENGTH} characters`);
    }

    // Validate locationMarker
    const locationMarkerRaw = typeof data.locationMarker === "string" ? data.locationMarker : "";
    const locationMarker = locationMarkerRaw.trim();
    if (locationMarker.length > TILE_LOCATION_MARKER_MAX_LENGTH) {
        issues.push(`locationMarker exceeds ${TILE_LOCATION_MARKER_MAX_LENGTH} characters`);
    }

    // Validate note
    const noteRaw = typeof data.note === "string" ? data.note : undefined;
    const note = noteRaw?.trim();

    // Validate elevation (optional, meters above sea level: -100 to +5000)
    let elevation: number | undefined;
    if (data.elevation !== undefined && data.elevation !== null) {
        const elevRaw = typeof data.elevation === "number" ? data.elevation : Number(data.elevation);
        if (isNaN(elevRaw)) {
            issues.push(`elevation must be a number`);
        } else if (elevRaw < -100 || elevRaw > 5000) {
            issues.push(`elevation must be between -100 and 5000 meters`);
        } else {
            elevation = elevRaw;
        }
    }

    // Validate moisture level (optional, categorical)
    let moisture: MoistureLevel | undefined;
    if (data.moisture !== undefined && data.moisture !== null) {
        if (typeof data.moisture === "string") {
            const value = data.moisture.trim();
            if (value && !isMoistureLevel(value)) {
                issues.push(`Invalid moisture level "${value}" (must be: desert, dry, lush, marshy, swampy, ponds, lakes, large_lake, sea, flood_plains)`);
            } else if (value) {
                moisture = value as MoistureLevel;
            }
        } else {
            issues.push(`moisture must be a string (moisture level)`);
        }
    }

    // Validate manualFactionEdit (optional boolean)
    let manualFactionEdit: boolean | undefined;
    if (data.manualFactionEdit !== undefined && data.manualFactionEdit !== null) {
        if (typeof data.manualFactionEdit !== "boolean") {
            issues.push(`manualFactionEdit must be a boolean`);
        } else {
            manualFactionEdit = data.manualFactionEdit;
        }
    }

    // Validate climate (optional nested structure)
    let climate: TileData['climate'] | undefined;
    if (data.climate !== undefined && data.climate !== null) {
        try {
            climate = validateClimateData(data.climate);
        } catch (error) {
            if (error instanceof TileValidationError) {
                issues.push(...error.issues);
            } else {
                throw error;
            }
        }
    }

    if (issues.length) {
        throw new TileValidationError(issues);
    }

    return {
        terrain,
        flora,
        backgroundColor,
        region,
        faction: faction || undefined,
        manualFactionEdit: manualFactionEdit,
        locationMarker: locationMarker || undefined,
        note: note || undefined,
        elevation: elevation,
        moisture: moisture,
        climate: climate,
    };
}

/**
 * List all tiles for a map.
 * Returns array of {coord, data} objects via TileCache.
 */
export async function listTilesForMap(app: App, mapFile: TFile): Promise<Array<{ coord: AxialCoord; data: TileData }>> {
    const { tileCache } = getMapSession(app, mapFile);
    await tileCache.load();
    const tiles = tileCache.getAll();
    const result: Array<{ coord: AxialCoord; data: TileData }> = [];
    for (const [key, data] of tiles) {
        const [q, r] = key.split(',').map(Number);
        result.push({ coord: { q, r }, data });
    }
    return result;
}

/**
 * Load a single tile.
 * Returns tile data via TileCache.
 */
export async function loadTile(app: App, mapFile: TFile, coord: AxialCoord): Promise<TileData | null> {
    const { tileCache } = getMapSession(app, mapFile);
    await tileCache.load();
    return tileCache.get(coordToKey(coord)) ?? null;
}

/**
 * Save a single tile.
 * Writes tile data via TileCache.
 */
export async function saveTile(app: App, mapFile: TFile, coord: AxialCoord, data: TileData): Promise<void> {
    const { tileCache } = getMapSession(app, mapFile);
    tileCache.set(coordToKey(coord), data);
}

/**
 * Delete a single tile.
 * Removes tile via TileCache.
 */
export async function deleteTile(app: App, mapFile: TFile, coord: AxialCoord): Promise<void> {
    const { tileCache } = getMapSession(app, mapFile);
    tileCache.delete(coordToKey(coord));
}

/**
 * Initialize tiles for a new map.
 * Creates a hexagonal grid of empty tiles based on the specified radius.
 * @param radius - Number of tiles from center to edge (default: 1 = 7 tiles)
 * @param onProgress - Optional callback for progress reporting (0-100)
 * @param signal - Optional AbortSignal for cancellation support
 */
export async function initTilesForNewMap(
    app: App,
    mapFile: TFile,
    radius: number = 1,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
): Promise<void> {
    const startTime = Date.now();
    const emptyTile: TileData = {};
    const center: AxialCoord = { q: 0, r: 0 };

    // Generate hexagonal grid using proper hex distance
    const coords = coordsInRadius(center, radius);
    const totalTiles = coords.length;
    const chunkCount = Math.ceil(totalTiles / 100);

    logger.info(`Initializing map: ${totalTiles} tiles in ${chunkCount} chunks`);

    // Get session with tileCache
    const { tileCache } = getMapSession(app, mapFile);

    // Begin batch mode to suppress separate store notifications per chunk
    tileCache.beginBatch();

    // Process tiles in chunks to avoid UI freeze on large maps
    const CHUNK_SIZE = 100;

    try {
        for (let i = 0; i < totalTiles; i += CHUNK_SIZE) {
            // Check for cancellation
            if (signal?.aborted) {
                throw new Error('Map creation cancelled');
            }

            // Extract chunk of coordinates
            const chunk = coords.slice(i, Math.min(i + CHUNK_SIZE, totalTiles));
            const entries = chunk.map(coord => ({ key: coordToKey(coord), data: { ...emptyTile } }));

            // Save this chunk directly via TileCache
            tileCache.setBatch(entries);

            // Report progress
            const processedTiles = i + chunk.length;
            const progress = Math.min(100, Math.round((processedTiles / totalTiles) * 100));
            onProgress?.(progress);

            // Yield to UI thread between chunks (allows rendering, prevents freeze)
            if (i + CHUNK_SIZE < totalTiles) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // Final progress report
        onProgress?.(100);

        const elapsed = Date.now() - startTime;
        logger.info(`Map initialized: ${totalTiles} tiles, radius ${radius} (${elapsed}ms)`);
    } finally {
        // Commit batch mode - triggers single store notification
        tileCache.commitBatch();
    }
}

/**
 * Reset/cleanup the TileStore for a map.
 * Disposes the session and all its stores.
 * NOTE: Overlay cleanup now handled by TileEventBus.clearMap() (see tile-events.ts)
 */
export function resetTileStore(app: App, mapFile: TFile): void {
    // Dispose session (cleans up all stores atomically)
    disposeMapSession(app, mapFile);
}

