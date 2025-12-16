// src/features/climate/derivation-engine.ts
// Derivation engine for auto-calculating moisture and flora from base layers
//
// This engine converts raw tile data (elevation, groundwater, fertility)
// plus environmental inputs (precipitation, temperature) into derived
// properties (moisture level, flora type). It respects manual overrides
// and only auto-derives properties marked as 'auto' or unset.

import type { AxialCoord } from "@geometry";
import type { TileData, DerivationSource } from "@services/domain/tile-types";
import type { MoistureLevel, FloraType } from "@services/domain/terrain-types";

// ============================================================================
// Types
// ============================================================================

/**
 * Input data for deriving moisture and flora for a single tile.
 */
export interface DerivationInput {
    /** Hex coordinate of the tile */
    coord: AxialCoord;
    /** Tile data with base properties (elevation, groundwater, fertility) */
    tile: TileData;
    /** Precipitation at this location (0-100), from rain shadow calculator */
    precipitation?: number;
    /** Temperature at this location (°C), from climate engine */
    temperature?: number;
}

/**
 * Result of derivation for a single tile.
 * Only includes properties that were auto-derived (not manual).
 */
export interface DerivationResult {
    /** Hex coordinate of the tile */
    coord: AxialCoord;
    /** Derived moisture level (only if auto-derived) */
    moisture?: { value: MoistureLevel; source: 'auto' };
    /** Derived flora type (only if auto-derived) */
    flora?: { value: FloraType; source: 'auto' };
}

// ============================================================================
// Moisture Level Mapping
// ============================================================================

/**
 * Moisture level thresholds.
 * Each entry maps [upperBound, moistureLevel].
 * A raw moisture value is mapped to the first level where value <= upperBound.
 */
const MOISTURE_THRESHOLDS: ReadonlyArray<readonly [number, MoistureLevel]> = [
    [0.10, "desert"],
    [0.20, "dry"],
    [0.40, "lush"],
    [0.60, "marshy"],
    [0.70, "swampy"],
    [0.75, "ponds"],
    [0.80, "lakes"],
    [0.85, "large_lake"],
    [0.95, "sea"],
    [1.00, "flood_plains"],
];

/**
 * Midpoint values for each moisture level.
 * Used for flora derivation to convert discrete moisture levels back to numeric values.
 */
export const MOISTURE_MIDPOINTS: Readonly<Record<MoistureLevel, number>> = Object.freeze({
    desert: 0.05,
    dry: 0.15,
    lush: 0.30,
    marshy: 0.50,
    swampy: 0.65,
    ponds: 0.725,
    lakes: 0.775,
    large_lake: 0.825,
    sea: 0.90,
    flood_plains: 0.975,
});

/**
 * Map raw moisture value (0-1) to discrete moisture level.
 *
 * @param rawMoisture Moisture value (0-1 range)
 * @returns Corresponding moisture level
 *
 * @example
 * mapToMoistureLevel(0.05)  // => "desert"
 * mapToMoistureLevel(0.35)  // => "lush"
 * mapToMoistureLevel(0.85)  // => "large_lake"
 */
export function mapToMoistureLevel(rawMoisture: number): MoistureLevel {
    // Clamp to valid range
    const clamped = Math.max(0, Math.min(1, rawMoisture));

    // Find first threshold where value <= upperBound
    for (const [upperBound, level] of MOISTURE_THRESHOLDS) {
        if (clamped <= upperBound) {
            return level;
        }
    }

    // Fallback (should never happen if thresholds cover [0, 1])
    return "flood_plains";
}

// ============================================================================
// Moisture Derivation
// ============================================================================

/**
 * Derive moisture level from groundwater, precipitation, and elevation.
 *
 * Formula:
 * - Groundwater contribution: 40%
 * - Precipitation contribution: 40%
 * - Elevation contribution: 20% (higher elevation = drier)
 *
 * Higher elevations have a drying effect due to lower atmospheric pressure
 * and faster runoff. Above 500m, each additional 50m reduces the moisture
 * contribution.
 *
 * @param groundwater Groundwater saturation (0-100, default: 50)
 * @param precipitation Precipitation level (0-100, default: 50)
 * @param elevation Elevation in meters (default: 0)
 * @returns Derived moisture level
 *
 * @example
 * deriveMoisture(80, 70, 0)    // => "marshy" (high water, low elevation)
 * deriveMoisture(20, 15, 2000) // => "desert" (low water, high elevation)
 * deriveMoisture(50, 50, 500)  // => "lush" (temperate conditions)
 */
export function deriveMoisture(
    groundwater: number = 50,
    precipitation: number = 50,
    elevation: number = 0
): MoistureLevel {
    // Ensure inputs are in valid range
    const gw = Math.max(0, Math.min(100, groundwater));
    const precip = Math.max(0, Math.min(100, precipitation));
    const elev = Math.max(-100, Math.min(5000, elevation));

    // Calculate contributions (weighted percentages)
    const gwContrib = gw * 0.4;
    const precipContrib = precip * 0.4;

    // Elevation penalty: Above 500m, each additional 50m reduces contribution by 1
    const elevPenalty = Math.max(0, (elev - 500) / 50);
    const elevContrib = Math.max(0, 20 - elevPenalty);

    // Combine contributions and normalize to 0-1 range
    const rawMoisture = (gwContrib + precipContrib + elevContrib) / 100;

    // Map to discrete moisture level
    return mapToMoistureLevel(rawMoisture);
}

// ============================================================================
// Flora Derivation
// ============================================================================

/**
 * Derive flora type from moisture, temperature, and fertility.
 *
 * Formula:
 * - Moisture factor: 40% (optimal range: 0.15-0.55, too dry or too wet reduces growth)
 * - Temperature factor: 35% (optimal range: 5-25°C)
 * - Fertility factor: 25%
 *
 * Vegetation potential is calculated as a weighted combination, then mapped
 * to flora density thresholds.
 *
 * @param moisture Current moisture level
 * @param temperature Temperature in Celsius (default: 15°C)
 * @param fertility Soil fertility (0-100, default: 50)
 * @returns Derived flora type
 *
 * @example
 * deriveFlora("lush", 20, 70)     // => "dense" (ideal conditions)
 * deriveFlora("desert", 35, 10)   // => "barren" (too dry and hot)
 * deriveFlora("marshy", 15, 60)   // => "medium" (wet but fertile)
 * deriveFlora("sea", 15, 50)      // => "barren" (too wet)
 */
export function deriveFlora(
    moisture: MoistureLevel,
    temperature: number = 15,
    fertility: number = 50
): FloraType {
    // Convert moisture level to numeric value using midpoints
    const moistureValue = MOISTURE_MIDPOINTS[moisture];

    // Ensure inputs are in valid range
    const temp = Math.max(-50, Math.min(50, temperature));
    const fert = Math.max(0, Math.min(100, fertility));

    // Temperature factor: Optimal range is 5-25°C
    // Outside this range, vegetation potential decreases
    const tempFactor = Math.max(0, 1 - Math.abs(temp - 15) / 30);

    // Moisture factor: Optimal range is 0.15-0.55 (dry to marshy)
    // Too dry (< 0.15): linear increase from 0
    // Optimal (0.15-0.55): full potential
    // Too wet (> 0.55): linear decrease to 0
    let moistureFactor: number;
    if (moistureValue < 0.15) {
        moistureFactor = moistureValue / 0.15;
    } else if (moistureValue <= 0.55) {
        moistureFactor = 1.0;
    } else {
        moistureFactor = Math.max(0, 1.0 - (moistureValue - 0.55) / 0.45);
    }

    // Combine factors with weights
    const vegPotential = (
        moistureFactor * 0.4 +
        tempFactor * 0.35 +
        (fert / 100) * 0.25
    );

    // Map to flora type based on thresholds
    if (vegPotential < 0.2) {
        return "barren";
    } else if (vegPotential < 0.4) {
        return "field";
    } else if (vegPotential < 0.7) {
        return "medium";
    } else {
        return "dense";
    }
}

// ============================================================================
// Tile Derivation
// ============================================================================

/**
 * Derive moisture and flora for a single tile.
 *
 * Respects manual overrides: if a property is marked as 'manual' in
 * tile.derivations, it will not be overwritten.
 *
 * @param input Tile data and environmental inputs
 * @returns Derivation results (only for auto-derived properties)
 *
 * @example
 * const result = deriveForTile({
 *     coord: { q: 5, r: 10 },
 *     tile: { groundwater: 70, fertility: 60, elevation: 100 },
 *     precipitation: 65,
 *     temperature: 18
 * });
 * // result.moisture = { value: "marshy", source: "auto" }
 * // result.flora = { value: "dense", source: "auto" }
 */
export function deriveForTile(input: DerivationInput): DerivationResult {
    const { coord, tile, precipitation, temperature } = input;
    const result: DerivationResult = { coord };

    // Derive moisture (if not manually set)
    const moistureSource = tile.derivations?.moisture?.source;
    if (moistureSource !== 'manual') {
        const derivedMoisture = deriveMoisture(
            tile.groundwater ?? 50,
            precipitation ?? 50,
            tile.elevation ?? 0
        );
        result.moisture = { value: derivedMoisture, source: 'auto' };
    }

    // Derive flora (if not manually set)
    const floraSource = tile.derivations?.flora?.source;
    if (floraSource !== 'manual') {
        // Use derived moisture if available, otherwise use existing moisture
        const moistureForFlora = result.moisture?.value ?? tile.moisture ?? 'lush';

        const derivedFlora = deriveFlora(
            moistureForFlora,
            temperature ?? 15,
            tile.fertility ?? 50
        );
        result.flora = { value: derivedFlora, source: 'auto' };
    }

    return result;
}

// ============================================================================
// Batch Derivation
// ============================================================================

/**
 * Derive moisture and flora for all tiles in a map.
 *
 * This is the primary API for batch processing during map generation
 * or when climate parameters change.
 *
 * @param tiles Map of tile data keyed by coordinate string (e.g., "r5_c10")
 * @param getPrecipitation Function to get precipitation for a coordinate
 * @param getTemperature Function to get temperature for a coordinate
 * @returns Array of derivation results
 *
 * @example
 * const results = deriveForMap(
 *     tileStore.tiles,
 *     (coord) => rainShadowCalc.getPrecipitation(coord),
 *     (coord) => climateEngine.getTemperature(coord, currentHour)
 * );
 *
 * // Apply results to tile store
 * results.forEach(result => {
 *     if (result.moisture) {
 *         tileStore.setMoisture(result.coord, result.moisture.value, 'auto');
 *     }
 *     if (result.flora) {
 *         tileStore.setFlora(result.coord, result.flora.value, 'auto');
 *     }
 * });
 */
export function deriveForMap(
    tiles: Map<string, TileData>,
    getPrecipitation: (coord: AxialCoord) => number,
    getTemperature: (coord: AxialCoord) => number
): DerivationResult[] {
    const results: DerivationResult[] = [];

    for (const [key, tile] of tiles.entries()) {
        // Parse coordinate from key (format: "r5_c10")
        const match = key.match(/r(-?\d+)_c(-?\d+)/);
        if (!match) continue;

        const coord: AxialCoord = {
            q: parseInt(match[2], 10),
            r: parseInt(match[1], 10)
        };

        // Get environmental inputs
        const precipitation = getPrecipitation(coord);
        const temperature = getTemperature(coord);

        // Derive for this tile
        const result = deriveForTile({
            coord,
            tile,
            precipitation,
            temperature
        });

        // Only include tiles with actual derivations
        if (result.moisture || result.flora) {
            results.push(result);
        }
    }

    return results;
}
