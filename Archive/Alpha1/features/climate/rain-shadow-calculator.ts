// src/features/climate/rain-shadow-calculator.ts
// Rain shadow calculation: Mountains block prevailing winds, reducing precipitation on leeward side
//
// Algorithm:
// 1. Convert wind bearing (0-360°) to hex direction (0-5)
// 2. Raycast BACKWARDS from target hex (opposite wind direction)
// 3. If elevation >= 1500m found, calculate rain shadow modifier
// 4. Shadow strength decays with distance from mountain

import type { AxialCoord } from "@geometry";
import { neighborInDirection } from "@geometry";
import { coordToKey, type CoordKey } from "@geometry";
import { axialDistance } from "@geometry";

// ============================================================================
// Constants
// ============================================================================

/**
 * Elevation threshold for mountains to block precipitation (meters).
 * Below this elevation, terrain doesn't create rain shadows.
 */
export const MOUNTAIN_THRESHOLD = 1500;

/**
 * Maximum range of rain shadow effect (hexes).
 * Beyond this distance, mountains don't affect precipitation.
 */
export const MAX_SHADOW_RANGE = 15;

/**
 * Maximum precipitation reduction at mountain base (0.0 to 1.0).
 * -0.5 = 50% precipitation reduction at closest point to mountain.
 */
export const MAX_SHADOW_MODIFIER = -0.5;

/**
 * Maximum raycast distance when searching for blocking mountains (hexes).
 * Prevents infinite loops on large maps.
 */
export const DEFAULT_MAX_RAYCAST_DISTANCE = 20;

/**
 * LRU cache size for raycast results.
 * Caching prevents repeated raycasts for the same hex/wind combinations.
 */
export const CACHE_SIZE = 1000;

/**
 * Wind direction buckets for cache keys (degrees).
 * Groups similar wind directions to improve cache hit rate.
 * 15° = 24 buckets (every 15 degrees)
 */
export const WIND_BUCKET_SIZE = 15;

// ============================================================================
// Types
// ============================================================================

/**
 * Result of rain shadow calculation for a single hex.
 */
export interface RainShadowResult {
    /** Precipitation modifier (-0.5 to 0) - negative reduces precipitation */
    modifier: number;
    /** Coordinate of mountain that blocks precipitation */
    blockingCoord: AxialCoord;
    /** Elevation of blocking mountain (meters) */
    blockingElevation: number;
    /** Distance to blocking mountain (hexes) */
    distance: number;
    /** Maximum range of shadow effect for this mountain (hexes) */
    shadowRange: number;
}

// ============================================================================
// LRU Cache
// ============================================================================

/**
 * Simple LRU cache for raycast results.
 * Maps (coordKey + windBucket) -> RainShadowResult | null
 */
class RainShadowCache {
    private cache = new Map<string, RainShadowResult | null>();
    private maxSize: number;

    constructor(maxSize: number = CACHE_SIZE) {
        this.maxSize = maxSize;
    }

    get(key: string): RainShadowResult | null | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: string, value: RainShadowResult | null): void {
        // Remove if exists (to update position)
        this.cache.delete(key);

        // Add to end
        this.cache.set(key, value);

        // Evict oldest if over capacity
        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

/** Global cache instance */
const rainShadowCache = new RainShadowCache();

/**
 * Clear the rain shadow cache.
 * Call this when map data changes or during testing.
 */
export function clearRainShadowCache(): void {
    rainShadowCache.clear();
}

/**
 * Get current cache size (for debugging/testing).
 */
export function getRainShadowCacheSize(): number {
    return rainShadowCache.size();
}

// ============================================================================
// Direction Conversion
// ============================================================================

/**
 * Convert compass bearing (0-360°) to hex direction (0-5).
 *
 * Hex grid directions (clockwise from East):
 * - 0 = East (60-120°)
 * - 1 = Northeast (0-60°)
 * - 2 = Northwest (300-360°)
 * - 3 = West (240-300°)
 * - 4 = Southwest (180-240°)
 * - 5 = Southeast (120-180°)
 *
 * @param bearing Wind bearing in degrees (0-360, 0=North, 90=East)
 * @returns Hex direction (0-5)
 *
 * @example
 * bearingToHexDirection(90)  // => 0 (East)
 * bearingToHexDirection(30)  // => 1 (Northeast)
 * bearingToHexDirection(270) // => 3 (West)
 */
export function bearingToHexDirection(bearing: number): number {
    // Normalize bearing to 0-360
    const normalized = ((bearing % 360) + 360) % 360;

    // Convert compass bearing (0=N, 90=E) to hex grid direction
    // Hex directions are 60° sectors
    if (normalized >= 60 && normalized < 120) return 0;  // East
    if (normalized >= 0 && normalized < 60) return 1;    // Northeast
    if (normalized >= 300 && normalized < 360) return 2; // Northwest
    if (normalized >= 240 && normalized < 300) return 3; // West
    if (normalized >= 180 && normalized < 240) return 4; // Southwest
    return 5; // Southeast (120-180)
}

/**
 * Get opposite direction for raycast backwards.
 *
 * @param direction Hex direction (0-5)
 * @returns Opposite direction (0-5)
 *
 * @example
 * oppositeDirection(0) // => 3 (East -> West)
 * oppositeDirection(1) // => 4 (Northeast -> Southwest)
 */
export function oppositeDirection(direction: number): number {
    return (direction + 3) % 6;
}

// ============================================================================
// Shadow Range Calculation
// ============================================================================

/**
 * Calculate the range of rain shadow effect based on mountain elevation.
 *
 * Higher mountains create larger rain shadows.
 * Formula: min(MAX_SHADOW_RANGE, (elevation - MOUNTAIN_THRESHOLD) / 150 + 1)
 *
 * @param elevation Mountain elevation (meters)
 * @returns Shadow range (hexes)
 *
 * @example
 * calculateShadowRange(1500) // => 1 (minimal shadow)
 * calculateShadowRange(3000) // => 11 (1 + 10 from extra height)
 * calculateShadowRange(5000) // => 15 (capped at MAX_SHADOW_RANGE)
 */
export function calculateShadowRange(elevation: number): number {
    if (elevation < MOUNTAIN_THRESHOLD) {
        return 0;
    }

    const baseRange = 1;
    const extraRange = (elevation - MOUNTAIN_THRESHOLD) / 150;
    const totalRange = baseRange + extraRange;

    return Math.min(MAX_SHADOW_RANGE, totalRange);
}

/**
 * Calculate rain shadow modifier based on distance to mountain.
 *
 * Modifier decays linearly with distance:
 * - At mountain base (distance 1): full effect (MAX_SHADOW_MODIFIER)
 * - At shadow range edge: no effect (0)
 *
 * @param distance Distance to blocking mountain (hexes)
 * @param shadowRange Maximum shadow range (hexes)
 * @returns Precipitation modifier (-0.5 to 0)
 *
 * @example
 * calculateShadowModifier(1, 10)  // => -0.45 (near mountain)
 * calculateShadowModifier(5, 10)  // => -0.25 (mid-range)
 * calculateShadowModifier(10, 10) // => 0 (edge of shadow)
 */
export function calculateShadowModifier(distance: number, shadowRange: number): number {
    if (distance <= 0 || shadowRange <= 0) {
        return 0;
    }

    if (distance >= shadowRange) {
        return 0;
    }

    // Linear decay: -0.5 at base, 0 at edge
    const decay = 1 - (distance / shadowRange);
    return MAX_SHADOW_MODIFIER * decay;
}

// ============================================================================
// Rain Shadow Calculation
// ============================================================================

/**
 * Calculate rain shadow for a single hex.
 *
 * Raycasts backwards (opposite wind direction) to find blocking mountains.
 * Returns null if no mountains found or hex is outside shadow range.
 *
 * @param coord Target hex coordinate
 * @param windDirection Wind bearing in degrees (0-360)
 * @param getElevation Function to get elevation for a coordinate
 * @param maxRaycastDistance Maximum raycast distance (default 20 hexes)
 * @returns Rain shadow result or null if not in shadow
 *
 * @example
 * const result = calculateRainShadow(
 *   { q: 5, r: 10 },
 *   90, // East wind
 *   (coord) => elevationMap.get(coordToKey(coord))
 * );
 * if (result) {
 *   console.log(`${result.modifier * 100}% precipitation reduction`);
 * }
 */
export function calculateRainShadow(
    coord: AxialCoord,
    windDirection: number,
    getElevation: (coord: AxialCoord) => number | undefined,
    maxRaycastDistance: number = DEFAULT_MAX_RAYCAST_DISTANCE
): RainShadowResult | null {
    // Check cache first
    const windBucket = Math.round(windDirection / WIND_BUCKET_SIZE);
    const cacheKey = `${coordToKey(coord)}_${windBucket}`;
    const cached = rainShadowCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    // Convert wind bearing to hex direction, then get opposite for raycast
    const windDir = bearingToHexDirection(windDirection);
    const raycastDir = oppositeDirection(windDir);

    // Raycast backwards from target hex
    let current = coord;
    for (let step = 1; step <= maxRaycastDistance; step++) {
        current = neighborInDirection(current, raycastDir);
        const elevation = getElevation(current);

        // Check if this hex is a mountain
        if (elevation !== undefined && elevation >= MOUNTAIN_THRESHOLD) {
            const shadowRange = calculateShadowRange(elevation);

            // Check if target is within shadow range
            const distance = axialDistance(coord, current);
            if (distance <= shadowRange) {
                const modifier = calculateShadowModifier(distance, shadowRange);
                const result: RainShadowResult = {
                    modifier,
                    blockingCoord: current,
                    blockingElevation: elevation,
                    distance,
                    shadowRange,
                };

                // Cache and return
                rainShadowCache.set(cacheKey, result);
                return result;
            }
        }
    }

    // No blocking mountain found
    rainShadowCache.set(cacheKey, null);
    return null;
}

/**
 * Calculate rain shadow for entire map (batch operation).
 *
 * More efficient than calling calculateRainShadow for each tile individually
 * because it caches the elevation lookup.
 *
 * @param tiles Map of tile data with elevation
 * @param windDirection Wind bearing in degrees (0-360)
 * @returns Map of coordinates to rain shadow results
 *
 * @example
 * const shadowMap = calculateRainShadowMap(tileMap, 90);
 * for (const [key, result] of shadowMap) {
 *   console.log(`${key}: ${result.modifier * 100}% reduction`);
 * }
 */
export function calculateRainShadowMap(
    tiles: Map<string, { elevation?: number }>,
    windDirection: number
): Map<string, RainShadowResult> {
    const results = new Map<string, RainShadowResult>();

    // Create elevation lookup function
    const getElevation = (coord: AxialCoord): number | undefined => {
        const key = coordToKey(coord);
        return tiles.get(key)?.elevation;
    };

    // Calculate shadow for each tile
    for (const [key, tile] of tiles) {
        // Skip tiles without valid coordinates
        try {
            const parts = key.split(',');
            if (parts.length !== 2) continue;

            const coord: AxialCoord = {
                q: parseInt(parts[0], 10),
                r: parseInt(parts[1], 10),
            };

            const result = calculateRainShadow(coord, windDirection, getElevation);
            if (result !== null) {
                results.set(key, result);
            }
        } catch (error) {
            // Skip invalid coordinate keys
            continue;
        }
    }

    return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format rain shadow result for display in UI/inspector.
 *
 * @param result Rain shadow calculation result
 * @returns Formatted strings for UI display
 *
 * @example
 * const lines = formatRainShadowResult(result);
 * // => [
 * //   "Rain Shadow: -25%",
 * //   "Mountain at (5,10): 2400m",
 * //   "Distance: 3 hexes",
 * //   "Shadow Range: 7 hexes"
 * // ]
 */
export function formatRainShadowResult(result: RainShadowResult): string[] {
    const lines: string[] = [];

    // Modifier as percentage
    const percentage = Math.round(result.modifier * 100);
    lines.push(`Rain Shadow: ${percentage}%`);

    // Blocking mountain info
    const coordStr = `(${result.blockingCoord.q},${result.blockingCoord.r})`;
    lines.push(`Mountain at ${coordStr}: ${result.blockingElevation}m`);

    // Distance and range
    lines.push(`Distance: ${result.distance} hexes`);
    lines.push(`Shadow Range: ${result.shadowRange} hexes`);

    return lines;
}

/**
 * Check if a hex is likely to be in a rain shadow based on wind and nearby elevations.
 * Quick approximation without full raycast (for preview/hinting).
 *
 * @param coord Target hex
 * @param windDirection Wind bearing (0-360)
 * @param getElevation Elevation lookup function
 * @returns True if likely in rain shadow
 */
export function isLikelyInRainShadow(
    coord: AxialCoord,
    windDirection: number,
    getElevation: (coord: AxialCoord) => number | undefined
): boolean {
    // Quick check: look 3 hexes upwind for mountains
    const windDir = bearingToHexDirection(windDirection);
    const raycastDir = oppositeDirection(windDir);

    let current = coord;
    for (let step = 1; step <= 3; step++) {
        current = neighborInDirection(current, raycastDir);
        const elevation = getElevation(current);
        if (elevation !== undefined && elevation >= MOUNTAIN_THRESHOLD) {
            return true;
        }
    }

    return false;
}
