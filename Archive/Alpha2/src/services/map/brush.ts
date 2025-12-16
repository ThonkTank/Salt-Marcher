/**
 * Brush Service
 *
 * Orchestrates brush operations on tiles.
 * Uses brush utils for calculations.
 *
 * @module services/map/brush
 */

import type { AxialCoord, CoordKey, TileData } from '../../schemas';
import type { TerrainType } from '../../schemas/map/tile';
import type { BrushConfig, BrushField, BrushResult } from '../../utils';
import {
    getBrushCoords,
    getBrushDistances,
    calculateFalloff,
    applyBrushValue,
    applySmoothValue,
    coordToKey,
    neighbors,
} from '../../utils';
import { clampClimate } from '../../utils/common/math';

// ============================================================================
// Tile Field Accessors
// ============================================================================

type FieldAccessor = {
    get: (tile: TileData) => number;
    set: (tile: TileData, value: number) => TileData;
};

/**
 * Field accessor definitions for each brush field.
 * Consolidates get/set logic in one place.
 */
const FIELD_ACCESSORS: Record<BrushField, FieldAccessor> = {
    terrain: {
        get: () => 0, // Terrain is categorical - returns 0
        set: (tile) => tile, // No-op for terrain
    },
    elevation: {
        get: (tile) => tile.elevation ?? 0,
        set: (tile, value) => ({ ...tile, elevation: value }),
    },
    'climate.temperature': {
        get: (tile) => tile.climate.temperature,
        set: (tile, value) => ({
            ...tile,
            climate: { ...tile.climate, temperature: clampClimate(value) },
        }),
    },
    'climate.precipitation': {
        get: (tile) => tile.climate.precipitation,
        set: (tile, value) => ({
            ...tile,
            climate: { ...tile.climate, precipitation: clampClimate(value) },
        }),
    },
    'climate.clouds': {
        get: (tile) => tile.climate.clouds,
        set: (tile, value) => ({
            ...tile,
            climate: { ...tile.climate, clouds: clampClimate(value) },
        }),
    },
    'climate.wind': {
        get: (tile) => tile.climate.wind,
        set: (tile, value) => ({
            ...tile,
            climate: { ...tile.climate, wind: clampClimate(value) },
        }),
    },
};

// Re-export from utils for backward compatibility
export { getBrushPreview } from '../../utils/brush/brush-geometry';

/**
 * Apply brush to tiles at center coordinate.
 * Returns modified tiles (immutable - creates copies).
 * Also returns oldTiles for future undo support.
 *
 * @param tiles - Map of all tiles
 * @param center - Center coordinate of brush application
 * @param config - Brush configuration
 * @param field - Tile field to modify
 * @returns BrushResult with affected coords and modified tiles
 */
export function applyBrush(
    tiles: Map<CoordKey, TileData>,
    center: AxialCoord,
    config: BrushConfig,
    field: BrushField
): BrushResult {
    const coords = getBrushCoords(center, config.radius);
    const distances = getBrushDistances(center, coords);

    const affectedCoords: AxialCoord[] = [];
    const modifiedTiles = new Map<CoordKey, TileData>();
    const oldTiles = new Map<CoordKey, TileData>();

    // For smooth mode, pre-calculate neighbor averages using original tile values
    const neighborAverages = config.mode === 'smooth'
        ? calculateNeighborAverages(tiles, coords, field)
        : null;

    for (const coord of coords) {
        const key = coordToKey(coord);
        const tile = tiles.get(key);
        if (!tile) continue;

        const distance = distances.get(key) ?? 0;
        const falloff = calculateFalloff(distance, config.radius, config.falloff);
        const currentValue = getTileFieldValue(tile, field);

        let newValue: number;
        if (config.mode === 'smooth' && neighborAverages) {
            // Smooth mode: blend towards neighbor average
            const avg = neighborAverages.get(key) ?? currentValue;
            newValue = applySmoothValue(currentValue, avg, config.strength, falloff);
        } else {
            // Set, sculpt, or noise mode
            newValue = applyBrushValue(
                currentValue,
                config.value,
                config.strength,
                falloff,
                config.mode
            );
        }

        // Only modify if value actually changed (with small threshold for float comparison)
        if (Math.abs(newValue - currentValue) > 0.001) {
            oldTiles.set(key, tile);
            modifiedTiles.set(key, setTileFieldValue(tile, field, newValue));
            affectedCoords.push(coord);
        }
    }

    return { affectedCoords, modifiedTiles, oldTiles };
}

/**
 * Calculate neighbor averages for smooth brush.
 * Uses original tile values (not modified ones) to avoid order-dependent results.
 */
function calculateNeighborAverages(
    tiles: Map<CoordKey, TileData>,
    coords: AxialCoord[],
    field: BrushField
): Map<CoordKey, number> {
    const averages = new Map<CoordKey, number>();

    for (const coord of coords) {
        const key = coordToKey(coord);
        const neighborCoords = neighbors(coord);

        let sum = 0;
        let count = 0;

        for (const neighborCoord of neighborCoords) {
            const neighborKey = coordToKey(neighborCoord);
            const neighborTile = tiles.get(neighborKey);
            if (neighborTile) {
                sum += getTileFieldValue(neighborTile, field);
                count++;
            }
        }

        // Only set average if we have neighbors
        if (count > 0) {
            averages.set(key, sum / count);
        }
    }

    return averages;
}

/**
 * Get tile field value (supports nested paths like 'climate.temperature').
 * Note: 'terrain' field returns 0 - use applyTerrainBrush for terrain.
 *
 * @param tile - Tile to read from
 * @param field - Field path
 * @returns Current value of the field
 */
export function getTileFieldValue(tile: TileData, field: BrushField): number {
    return FIELD_ACCESSORS[field].get(tile);
}

/**
 * Set tile field value (returns new tile, immutable).
 * Note: 'terrain' field is ignored - use applyTerrainBrush for terrain.
 *
 * @param tile - Original tile
 * @param field - Field path
 * @param value - New value
 * @returns New tile with updated value
 */
export function setTileFieldValue(
    tile: TileData,
    field: BrushField,
    value: number
): TileData {
    return FIELD_ACCESSORS[field].set(tile, value);
}

/**
 * Apply terrain brush to tiles at center coordinate.
 * All tiles in brush radius get the same terrain type (no falloff).
 *
 * @param tiles - Map of all tiles
 * @param center - Center coordinate of brush application
 * @param radius - Brush radius
 * @param terrain - Terrain type to apply
 * @returns BrushResult with affected coords and modified tiles
 */
export function applyTerrainBrush(
    tiles: Map<CoordKey, TileData>,
    center: AxialCoord,
    radius: number,
    terrain: TerrainType
): BrushResult {
    const coords = getBrushCoords(center, radius);

    const affectedCoords: AxialCoord[] = [];
    const modifiedTiles = new Map<CoordKey, TileData>();
    const oldTiles = new Map<CoordKey, TileData>();

    for (const coord of coords) {
        const key = coordToKey(coord);
        const tile = tiles.get(key);
        if (!tile) continue;

        // Only modify if terrain actually changed
        if (tile.terrain !== terrain) {
            oldTiles.set(key, tile);
            modifiedTiles.set(key, { ...tile, terrain });
            affectedCoords.push(coord);
        }
    }

    return { affectedCoords, modifiedTiles, oldTiles };
}
