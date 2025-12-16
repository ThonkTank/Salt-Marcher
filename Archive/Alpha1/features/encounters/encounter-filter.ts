/**
 * ============================================================================
 * ENCOUNTER FILTER - Habitat-Based Creature Scoring and Filtering
 * ============================================================================
 *
 * Scores and filters creatures based on habitat preferences vs. tile environment data.
 * Used to determine which creatures are appropriate for a given hex location.
 *
 * ## Architecture Position
 *
 * This module sits between the CreatureStore and encounter generation/display:
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        ENCOUNTER FILTER FLOW                             │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                          │
 * │   CreatureStore           encounter-filter          Consumers            │
 * │   ────────────           ────────────────          ──────────            │
 * │                                                                          │
 * │   store.get()  ──►  filterCreaturesByHabitat()  ──►  encounter-generator │
 * │   (all creatures)   calculateHabitatScore()         encounter-tracker    │
 * │                     HabitatScoreCache               UI display           │
 * │                                                                          │
 * │   Input:  Creature[] + TileData { terrain, flora, moisture }            │
 * │   Output: Creature[] with habitatScore (0-100) added                    │
 * │                                                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Scoring Algorithm
 *
 * The scoring uses **adaptive point distribution**:
 *
 * - 100 total points are distributed equally across DEFINED preference categories
 * - If creature has all 3 preferences (terrain, flora, moisture): ~33 points each
 * - If creature has 2 preferences: 50 points each
 * - If creature has 1 preference: 100 points for that match
 * - If creature has NO preferences: score = 0 (unknown/incompatible)
 *
 * This prevents creatures with sparse data from being unfairly penalized.
 *
 * ## Usage
 *
 * ```typescript
 * import { filterCreaturesByHabitat } from '@features/encounters/encounter-filter';
 *
 * // Filter creatures for a mountain hex
 * const filtered = filterCreaturesByHabitat(
 *     creatures,
 *     { terrain: 'mountains', flora: 'sparse', moisture: 'dry' },
 *     30  // minimum score threshold
 * );
 *
 * // Each creature now has habitatScore field (0-100)
 * filtered.forEach(c => console.log(`${c.name}: ${c.habitatScore}`));
 * ```
 *
 * ## Related Files
 *
 * - `creature-store.ts` - Source of creature data (Creature interface)
 * - `encounter-generator.ts` - Primary consumer for encounter generation
 * - `encounter-tracker-view.ts` - Consumer for UI display of nearby creatures
 * - `../maps/data/tile-repository.ts` - TileData type definition
 *
 * @see creature-store.ts for how creatures are loaded and cached
 * @see encounter-generator.ts for how filtered creatures become encounters
 * @module features/encounters/encounter-filter
 */

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("encounter-filter");
import type { TileData } from "../maps/data/tile-repository";

/**
 * Creature with habitat preferences - works with both flat and nested structures.
 *
 * **Flat Structure** (new CreatureStore format):
 * ```typescript
 * {
 *     name: "Wolf",
 *     terrainPreference: ["forest", "mountains"],  // At root level
 *     floraPreference: ["temperate"],
 *     moisturePreference: ["moderate", "wet"],
 * }
 * ```
 *
 * **Nested Structure** (legacy format - backward compatible):
 * ```typescript
 * {
 *     name: "Wolf",
 *     data: {
 *         terrainPreference: ["forest", "mountains"],  // Inside data object
 *         floraPreference: ["temperate"],
 *         moisturePreference: ["moderate", "wet"],
 *     }
 * }
 * ```
 *
 * The `getPreferences()` helper handles both formats automatically.
 *
 * @see creature-store.ts for the canonical Creature interface (flat structure)
 */
export interface FilterableCreature {
    name: string;
    type: string;
    cr: number;
    file: string;
    /** Terrain types this creature prefers (flat structure) */
    terrainPreference?: readonly string[];
    /** Flora/vegetation types this creature prefers (flat structure) */
    floraPreference?: readonly string[];
    /** Moisture levels this creature prefers (flat structure) */
    moisturePreference?: readonly string[];
    /** Calculated habitat score (0-100) - added by filterCreaturesByHabitat */
    habitatScore?: number;
    /** Legacy nested data structure for backward compatibility */
    data?: {
        terrainPreference?: readonly string[];
        floraPreference?: readonly string[];
        moisturePreference?: readonly string[];
    };
}

/**
 * Habitat score cache for memoization.
 *
 * Caches scores by creature name + biome fingerprint to avoid redundant calculations.
 * Automatically invalidates when the biome (terrain/flora/moisture) changes.
 *
 * **Why Cache?**
 * - Habitat scoring involves string comparisons across multiple preference arrays
 * - The same creatures are scored repeatedly when filtering/sorting
 * - Cache invalidates only when the biome actually changes
 *
 * **Cache Key Format**: `{creatureName}|{terrain}|{flora}|{moisture}|{temperature}|{elevation}`
 *
 * @example
 * ```typescript
 * const cache = new HabitatScoreCache();
 *
 * // First call: computes and caches
 * const score1 = cache.getOrCompute(wolf, { terrain: 'forest' }); // ~5ms
 *
 * // Second call: returns cached value
 * const score2 = cache.getOrCompute(wolf, { terrain: 'forest' }); // ~0.1ms
 *
 * // Different biome: invalidates cache, recomputes
 * cache.invalidateOnBiomeChange({ terrain: 'mountains' });
 * const score3 = cache.getOrCompute(wolf, { terrain: 'mountains' }); // ~5ms
 * ```
 */
export class HabitatScoreCache {
    private cache = new Map<string, number>();
    private currentBiome: string | null = null;

    /**
     * Get cached score or compute and cache it.
     *
     * @param creature - Creature data
     * @param tileData - Current tile data
     * @returns Habitat score (0-100)
     */
    getOrCompute(creature: FilterableCreature, tileData: TileData): number {
        const key = this.generateCacheKey(creature, tileData);

        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }

        const score = calculateHabitatScore(creature, tileData);
        this.cache.set(key, score);
        return score;
    }

    /**
     * Invalidate cache if biome has changed.
     *
     * @param newTileData - New tile data to check against
     */
    invalidateOnBiomeChange(newTileData: TileData | undefined): void {
        if (!newTileData) {
            this.cache.clear();
            this.currentBiome = null;
            return;
        }

        const newBiome = this.getBiomeFingerprint(newTileData);

        if (newBiome !== this.currentBiome) {
            this.cache.clear();
            this.currentBiome = newBiome;
        }
    }

    /**
     * Get current cache size (for monitoring/testing).
     *
     * @returns Number of cached scores
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Clear all cached scores.
     */
    clear(): void {
        this.cache.clear();
        this.currentBiome = null;
    }

    /**
     * Generate cache key from creature + tile data.
     *
     * @private
     * @param creature - Creature data
     * @param tileData - Tile data
     * @returns Cache key string
     */
    private generateCacheKey(creature: FilterableCreature, tileData: TileData): string {
        const biome = this.getBiomeFingerprint(tileData);
        return `${creature.name}|${biome}`;
    }

    /**
     * Generate biome fingerprint from tile data.
     * Rounds numeric values to prevent cache fragmentation.
     *
     * @private
     * @param tileData - Tile data
     * @returns Biome fingerprint string
     */
    private getBiomeFingerprint(tileData: TileData): string {
        return [
            tileData.terrain ?? "none",
            tileData.flora ?? "none",
            tileData.moisture ?? "none",
            Math.round(tileData.climate?.temperature?.avg ?? 0),
            Math.round(tileData.elevation ?? 0),
        ].join("|");
    }
}

// ============================================================================
// Preference Extraction
// ============================================================================

/**
 * Extract habitat preferences from creature, handling both flat and nested structures.
 *
 * **Priority Order**:
 * 1. Flat structure (new format): `creature.terrainPreference`, etc.
 * 2. Nested structure (legacy): `creature.data.terrainPreference`, etc.
 *
 * This allows gradual migration from legacy CreatureData to new Creature format.
 *
 * @param creature - Creature with preferences in either format
 * @returns Normalized preference object
 */
function getPreferences(creature: FilterableCreature): {
    terrain: readonly string[] | undefined;
    flora: readonly string[] | undefined;
    moisture: readonly string[] | undefined;
} {
    // Try flat structure first (new CreatureStore format)
    if (creature.terrainPreference || creature.floraPreference || creature.moisturePreference) {
        return {
            terrain: creature.terrainPreference,
            flora: creature.floraPreference,
            moisture: creature.moisturePreference,
        };
    }
    // Fall back to nested data structure (legacy format)
    return {
        terrain: creature.data?.terrainPreference,
        flora: creature.data?.floraPreference,
        moisture: creature.data?.moisturePreference,
    };
}

// ============================================================================
// Scoring Algorithm
// ============================================================================

/**
 * Calculate habitat match score for a creature against tile data.
 *
 * Returns 0-100 score where:
 * - **100** = Perfect match (all defined preferences match)
 * - **50-99** = Partial match (some preferences match)
 * - **0** = No match or no preferences defined
 *
 * ## Adaptive Scoring Algorithm
 *
 * Points are distributed equally across **defined** preference categories only:
 *
 * | Defined Categories | Points per Category | Example |
 * |--------------------|--------------------|---------|
 * | 3 (all)            | ~33 each           | terrain + flora + moisture |
 * | 2                  | 50 each            | terrain + flora |
 * | 1                  | 100                | only moisture |
 * | 0                  | N/A → score = 0    | no preferences |
 *
 * **Why Adaptive?**
 * A creature with only `moisturePreference: "dry"` that matches should score 100,
 * not 33, because we can't penalize missing data.
 *
 * @param creature - Creature with habitat preferences
 * @param tileData - Tile environment data to match against
 * @returns Score 0-100 (higher = better match)
 *
 * @example
 * ```typescript
 * // Creature with all 3 preferences, all match → 100
 * calculateHabitatScore(
 *     { terrainPreference: ['mountains'], floraPreference: ['sparse'], moisturePreference: ['dry'] },
 *     { terrain: 'mountains', flora: 'sparse', moisture: 'dry' }
 * ); // Returns 100
 *
 * // Creature with 2 preferences, 1 matches → 50
 * calculateHabitatScore(
 *     { terrainPreference: ['forest'], floraPreference: ['dense'] },
 *     { terrain: 'mountains', flora: 'dense' }
 * ); // Returns 50 (only flora matches)
 * ```
 */
export function calculateHabitatScore(
    creature: FilterableCreature,
    tileData: TileData,
): number {
    const prefs = getPreferences(creature);

    // Count which preference categories are defined
    const hasTerrain = !!(prefs.terrain && prefs.terrain.length > 0 && tileData.terrain);
    const hasFlora = !!(prefs.flora && prefs.flora.length > 0 && tileData.flora);
    const hasMoisture = !!(prefs.moisture && prefs.moisture.length > 0 && tileData.moisture);

    const categoryCount = (hasTerrain ? 1 : 0) + (hasFlora ? 1 : 0) + (hasMoisture ? 1 : 0);

    // If no preferences defined, return 0 (incompatible/unknown)
    if (categoryCount === 0) {
        return 0;
    }

    // Distribute 100 points equally across defined categories
    const pointsPerCategory = 100 / categoryCount;
    let score = 0;

    // Terrain check
    if (hasTerrain && prefs.terrain) {
        const tileTerrain = tileData.terrain!.toLowerCase();
        const hasMatch = prefs.terrain.some((pref) => {
            return pref === "any" || pref.toLowerCase() === tileTerrain;
        });
        if (hasMatch) {
            score += pointsPerCategory;
        }
    }

    // Flora check
    if (hasFlora && prefs.flora) {
        const tileFlora = tileData.flora!.toLowerCase();
        const hasMatch = prefs.flora.some((pref) => {
            return pref === "any" || pref.toLowerCase() === tileFlora;
        });
        if (hasMatch) {
            score += pointsPerCategory;
        }
    }

    // Moisture check
    if (hasMoisture && prefs.moisture) {
        const tileMoisture = tileData.moisture!.toLowerCase();
        const hasMatch = prefs.moisture.some((pref) => {
            return pref.toLowerCase() === tileMoisture;
        });
        if (hasMatch) {
            score += pointsPerCategory;
        }
    }

    return Math.round(score);
}

// ============================================================================
// Global Cache Instance
// ============================================================================

/**
 * Global cache instance for habitat score memoization.
 * Shared across all filter calls for maximum efficiency.
 * Automatically invalidates when biome changes.
 */
const globalHabitatCache = new HabitatScoreCache();

// ============================================================================
// Main Filter Function
// ============================================================================

/**
 * Filter creatures by habitat compatibility score threshold.
 *
 * This is the **primary entry point** for habitat-based creature filtering.
 * Used by:
 * - `encounter-generator.ts` for random encounter generation
 * - `encounter-tracker-view.ts` for displaying nearby creatures
 *
 * ## What It Does
 *
 * 1. Scores each creature against tile data using `calculateHabitatScore()`
 * 2. Adds `habitatScore` field (0-100) to each creature
 * 3. Filters by minimum score threshold
 * 4. Returns sorted array (highest scores first)
 *
 * ## Fallback Behavior (Ensures Encounters Are Always Possible)
 *
 * | Scenario | Fallback |
 * |----------|----------|
 * | All creatures score 0 | Returns diverse CR selection (low/med/high) |
 * | No creatures meet threshold | Returns top 5 highest-scoring creatures |
 * | No tile data provided | Returns all creatures with score 0 |
 *
 * @param creatures - Creatures to filter (must implement FilterableCreature)
 * @param tileData - Current hex tile data (undefined = return all with score 0)
 * @param minScore - Minimum habitat score (default: 30, range: 0-100)
 * @returns Filtered array with `habitatScore` field added to each creature
 *
 * @example
 * ```typescript
 * import { filterCreaturesByHabitat } from '@features/encounters/encounter-filter';
 * import { getCreatureStore } from '@features/encounters/creature-store';
 *
 * // Get all creatures from store
 * const allCreatures = getCreatureStore().get().creatures;
 *
 * // Filter for mountain hex with 30+ score
 * const mountainCreatures = filterCreaturesByHabitat(
 *     allCreatures.map(c => ({ ...c, habitatScore: 0 })),
 *     { terrain: 'mountains', flora: 'sparse', moisture: 'dry' },
 *     30
 * );
 *
 * // Results sorted by score, each has habitatScore field
 * console.log(mountainCreatures[0].name, mountainCreatures[0].habitatScore);
 * ```
 *
 * @see calculateHabitatScore for the scoring algorithm
 * @see HabitatScoreCache for caching behavior
 */
export function filterCreaturesByHabitat<T extends FilterableCreature>(
    creatures: T[],
    tileData: { terrain?: string; flora?: string; moisture?: string } | undefined,
    minScore: number = 30,
): Array<T & { habitatScore: number }> {
    // If no tile data, return all creatures with score 0
    if (!tileData) {
        return creatures.map(c => ({ ...c, habitatScore: 0 }));
    }

    // Invalidate cache if biome has changed
    globalHabitatCache.invalidateOnBiomeChange(tileData as TileData);

    // Calculate habitat scores with caching
    const scored = creatures.map((creature) => ({
        ...creature,
        habitatScore: globalHabitatCache.getOrCompute(creature, tileData as TileData),
    }));

    // Check if all creatures scored 0 (likely due to missing habitat data)
    const maxScore = scored.length > 0 ? Math.max(...scored.map(c => c.habitatScore)) : 0;

    if (maxScore === 0) {
        // Fallback: Return diverse selection when no habitat data is available
        logger.debug("All creatures scored 0 - using CR-based fallback");

        // Sort by CR to get a diverse selection
        const sortedByCR = [...scored].sort((a, b) => (a.cr || 0) - (b.cr || 0));

        // Return a diverse selection: low, medium, and high CR creatures
        const diverseSelection: Array<T & { habitatScore: number }> = [];

        // Low CR (0-2)
        const lowCR = sortedByCR.filter(c => (c.cr || 0) <= 2);
        if (lowCR.length > 0) {
            diverseSelection.push(...lowCR.slice(0, Math.min(5, lowCR.length)));
        }

        // Medium CR (3-8)
        const medCR = sortedByCR.filter(c => {
            const cr = c.cr || 0;
            return cr > 2 && cr <= 8;
        });
        if (medCR.length > 0) {
            diverseSelection.push(...medCR.slice(0, Math.min(5, medCR.length)));
        }

        // High CR (9+)
        const highCR = sortedByCR.filter(c => (c.cr || 0) > 8);
        if (highCR.length > 0) {
            diverseSelection.push(...highCR.slice(0, Math.min(5, highCR.length)));
        }

        // If still no creatures, just return first 10
        if (diverseSelection.length === 0 && scored.length > 0) {
            return scored.slice(0, 10);
        }

        return diverseSelection;
    }

    // Filter by minimum score
    const filtered = scored.filter((c) => c.habitatScore >= minScore);

    // If no creatures pass threshold but some have scores > 0, return top scorers
    if (filtered.length === 0 && scored.length > 0) {
        logger.debug("No creatures met threshold, using top scorers");
        scored.sort((a, b) => b.habitatScore - a.habitatScore);
        return scored.slice(0, Math.min(5, scored.length));
    }

    return filtered;
}

// ============================================================================
// Exports for Testing/Monitoring
// ============================================================================

/**
 * Get the global habitat cache instance for testing/monitoring.
 *
 * Useful for:
 * - Testing: Verify cache behavior in unit tests
 * - Monitoring: Check cache size and hit rate
 * - Debugging: Clear cache to force recalculation
 *
 * @returns Global HabitatScoreCache instance
 *
 * @example
 * ```typescript
 * const cache = getHabitatCache();
 * console.log(`Cache size: ${cache.size}`);
 * cache.clear(); // Force recalculation on next filter
 * ```
 */
export function getHabitatCache(): HabitatScoreCache {
    return globalHabitatCache;
}
