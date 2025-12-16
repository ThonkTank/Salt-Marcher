/**
 * Map Utils
 *
 * Pure functions for map serialization, creation, and validation.
 *
 * @module utils/map/map-utils
 */

import type { CoordKey, AxialCoord, TileData, MapData, MapMetadata, MapListEntry } from '../../schemas';
import { coordsInRadius, coordToKey } from '../hex';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_HEX_SIZE = 42;

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique map ID.
 */
export function generateMapId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `map-${timestamp}-${random}`;
}

// ============================================================================
// Map Creation
// ============================================================================

/**
 * Create an empty map with default tiles.
 */
export function createEmptyMap(name: string, radius: number, hexSize: number = DEFAULT_HEX_SIZE): MapData {
    const id = generateMapId();
    const now = Date.now();
    const center: AxialCoord = { q: 0, r: 0 };

    const metadata: MapMetadata = {
        id,
        name,
        createdAt: now,
        modifiedAt: now,
        hexSize,
        center,
    };

    // Generate tiles in radius
    const coords = coordsInRadius(center, radius);
    const tiles: Record<string, TileData> = {};

    for (const coord of coords) {
        const key = coordToKey(coord);
        tiles[key] = createDefaultTile();
    }

    return { metadata, tiles };
}

/**
 * Create a default tile.
 */
function createDefaultTile(): TileData {
    return {
        terrain: 'grassland',
        climate: {
            temperature: 6,
            precipitation: 6,
            clouds: 4,
            wind: 3,
        },
        elevation: 100,
    };
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize map state to MapData (for storage).
 */
export function serializeMap(
    metadata: MapMetadata,
    tiles: Map<CoordKey, TileData>
): MapData {
    const tilesRecord: Record<string, TileData> = {};

    for (const [key, tile] of tiles) {
        tilesRecord[key] = tile;
    }

    return {
        metadata: {
            ...metadata,
            modifiedAt: Date.now(),
        },
        tiles: tilesRecord,
    };
}

/**
 * Deserialize MapData to map state (for editing).
 */
export function deserializeMap(data: MapData): {
    metadata: MapMetadata;
    tiles: Map<CoordKey, TileData>;
    coords: AxialCoord[];
} {
    const tiles = new Map<CoordKey, TileData>();
    const coords: AxialCoord[] = [];

    for (const [key, tile] of Object.entries(data.tiles)) {
        tiles.set(key as CoordKey, tile);
        // Parse coord from key
        const [q, r] = key.split(',').map(Number);
        coords.push({ q, r });
    }

    return {
        metadata: data.metadata,
        tiles,
        coords,
    };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if data is valid MapData.
 */
export function isValidMapData(data: unknown): data is MapData {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;

    // Check metadata
    if (!obj.metadata || typeof obj.metadata !== 'object') return false;
    const meta = obj.metadata as Record<string, unknown>;
    if (typeof meta.id !== 'string') return false;
    if (typeof meta.name !== 'string') return false;
    if (typeof meta.createdAt !== 'number') return false;
    if (typeof meta.modifiedAt !== 'number') return false;
    if (typeof meta.hexSize !== 'number') return false;
    if (!meta.center || typeof meta.center !== 'object') return false;

    // Check tiles
    if (!obj.tiles || typeof obj.tiles !== 'object') return false;

    return true;
}

/**
 * Extract list entry from map data.
 */
export function toListEntry(data: MapData): MapListEntry {
    return {
        id: data.metadata.id,
        name: data.metadata.name,
        modifiedAt: data.metadata.modifiedAt,
    };
}

// ============================================================================
// Demo Map Generation
// ============================================================================

/**
 * Generate a demo tile with random values based on distance from origin.
 */
export function generateDemoTile(coord: AxialCoord): TileData {
    const distance = Math.abs(coord.q) + Math.abs(coord.r) + Math.abs(-coord.q - coord.r);
    const elevation = Math.max(0, 500 - distance * 50 + Math.random() * 200);

    return {
        terrain: 'grassland',
        climate: {
            temperature: Math.round(6 + Math.random() * 4),
            precipitation: Math.round(4 + Math.random() * 4),
            clouds: Math.round(3 + Math.random() * 3),
            wind: Math.round(2 + Math.random() * 3),
        },
        elevation,
    };
}

/**
 * Generate a demo map with tiles in a given radius.
 */
export function generateDemoMap(
    center: AxialCoord,
    radius: number
): { tiles: Map<CoordKey, TileData>; coords: AxialCoord[] } {
    const coords = coordsInRadius(center, radius);
    const tiles = new Map<CoordKey, TileData>();

    for (const coord of coords) {
        const key = coordToKey(coord);
        tiles.set(key, generateDemoTile(coord));
    }

    return { tiles, coords };
}
