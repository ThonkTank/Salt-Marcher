// src/workmodes/encounter/generator.ts
// Random encounter generator based on Faction/Terrain/Region tags
// Implements Phase 2.6 specification

import type { FactionData } from "../library/factions/types";
import type { TerrainData } from "../library/terrains/types";
import type { RegionData } from "../library/regions/types";
import type { StatblockData } from "../library/creatures/types";
import type { EncounterCreature } from "./session-store";
import { logger } from "../../app/plugin-logger";

// ============================================================================
// TYPES
// ============================================================================

export type Difficulty = "easy" | "medium" | "hard" | "deadly";

export interface GeneratorContext {
    faction: FactionData | null;
    terrain: TerrainData | null;
    region: RegionData | null;
    creatures: StatblockData[];
}

export interface GeneratorOptions {
    partyLevel: number;
    partySize: number;
    difficulty: Difficulty;
    seed?: number; // For deterministic randomization in tests
}

export interface GeneratorResult {
    creatures: EncounterCreature[];
    totalXP: number;
    filterLevel: number; // 1=exact, 2=partial, 3=terrain-only, 4=all
}

// D&D 5e XP thresholds per character level (DMG p.82)
const XP_THRESHOLDS: Record<Difficulty, number[]> = {
    easy: [25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800],
    medium: [50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500, 2800, 3200, 3900, 4200, 4900, 5700],
    hard: [75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500],
    deadly: [100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700]
};

// D&D 5e XP by CR lookup table
const XP_BY_CR: Record<number, number> = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
    6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
    16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
    26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
};

// DMG p.82: Multiplier based on creature count
function getXpMultiplier(count: number): number {
    if (count === 1) return 1;
    if (count === 2) return 1.5;
    if (count >= 3 && count <= 6) return 2;
    if (count >= 7 && count <= 10) return 2.5;
    if (count >= 11 && count <= 14) return 3;
    return 4; // 15+
}

// ============================================================================
// TAG FILTERING
// ============================================================================

/**
 * Filters creatures by tags with priority-based fallback.
 *
 * Priority levels:
 * 1. Exact match: Faction+Terrain+Region
 * 2. Partial match: Faction+Terrain
 * 3. Terrain-only match
 * 4. All creatures (no filter)
 *
 * Tag matching uses OR logic within categories, AND logic between categories.
 * Example: Faction=[Undead, Cult] + Terrain=[Swamp, Wetland]
 *   → Match if creature.typeTags contains (Undead OR Cult) AND (Swamp OR Wetland)
 */
export function filterCreaturesByTags(ctx: GeneratorContext): {
    creatures: StatblockData[];
    filterLevel: number;
} {
    const { faction, terrain, region, creatures } = ctx;

    // Extract tag values from tag arrays
    const factionTags = faction?.influence_tags?.map(t => t.value.toLowerCase()) ?? [];
    const terrainTags = [
        ...(terrain?.biome_tags?.map(t => t.value.toLowerCase()) ?? []),
        ...(terrain?.difficulty_tags?.map(t => t.value.toLowerCase()) ?? [])
    ];
    const regionTags = [
        ...(region?.biome_tags?.map(t => t.value.toLowerCase()) ?? []),
        ...(region?.danger_tags?.map(t => t.value.toLowerCase()) ?? []),
        ...(region?.climate_tags?.map(t => t.value.toLowerCase()) ?? []),
        ...(region?.settlement_tags?.map(t => t.value.toLowerCase()) ?? [])
    ];

    // Helper: Check if creature matches tag set (OR logic)
    const matchesAnyTag = (creatureTags: string[], filterTags: string[]): boolean => {
        if (filterTags.length === 0) return true; // Empty filter = always match
        if (creatureTags.length === 0) return false; // Creature has no tags, can't match specific filter
        return creatureTags.some(ct => filterTags.includes(ct.toLowerCase()));
    };

    // Build filtering levels dynamically based on available filters
    const filterLevels = [
        // Level 1: Faction + Terrain + Region (skip if any is empty)
        ...(factionTags.length > 0 && terrainTags.length > 0 && regionTags.length > 0
            ? [{ level: 1, tags: [factionTags, terrainTags, regionTags] }]
            : []),
        // Level 2: Faction + Terrain (skip if either is empty)
        ...(factionTags.length > 0 && terrainTags.length > 0
            ? [{ level: 2, tags: [factionTags, terrainTags] }]
            : []),
        // Level 3: Terrain only (skip if empty)
        ...(terrainTags.length > 0
            ? [{ level: 3, tags: [terrainTags] }]
            : []),
        // Level 4: No filter (always present)
        { level: 4, tags: [] }
    ];

    for (const { level, tags } of filterLevels) {
        const filtered = creatures.filter(creature => {
            const creatureTags = creature.typeTags?.map(t => {
                // Handle both string and {value: string} formats
                return typeof t === 'string' ? t : t;
            }) ?? [];

            // Level 4: No filter, return all creatures
            if (tags.length === 0) return true;

            // For other levels: AND logic - Must match ALL tag categories
            // But if creature has no tags, skip it unless we're at level 4
            if (creatureTags.length === 0) return false;

            return tags.every(filterTagSet => matchesAnyTag(creatureTags, filterTagSet));
        });

        if (filtered.length > 0) {
            logger.debug(`[generator] Filter level ${level}: ${filtered.length} matches`, {
                factionTags,
                terrainTags,
                regionTags,
                filterLevel: level
            });
            return { creatures: filtered, filterLevel: level };
        }
    }

    // Should never reach here (level 4 returns all creatures)
    logger.warn("[generator] No creatures found at any filter level");
    return { creatures: [], filterLevel: 4 };
}

// ============================================================================
// CR BUDGET CALCULATION
// ============================================================================

/**
 * Calculates target XP budget for encounter based on D&D 5e DMG rules.
 *
 * @param options Party configuration and difficulty
 * @returns Object with targetXP (center), min (targetXP * 0.8), max (targetXP * 1.2)
 */
export function calculateCreatureBudget(options: GeneratorOptions): {
    targetXP: number;
    minXP: number;
    maxXP: number;
} {
    const { partyLevel, partySize, difficulty } = options;

    // Validate inputs
    if (partyLevel < 1 || partyLevel > 20) {
        logger.warn(`[generator] Invalid party level: ${partyLevel}, clamping to 1-20`);
    }
    if (partySize < 1) {
        logger.warn(`[generator] Invalid party size: ${partySize}, defaulting to 1`);
    }

    const level = Math.max(1, Math.min(20, partyLevel));
    const size = Math.max(1, partySize);

    const xpPerCharacter = XP_THRESHOLDS[difficulty][level - 1];
    const targetXP = xpPerCharacter * size;

    // ±20% tolerance
    const minXP = Math.floor(targetXP * 0.8);
    const maxXP = Math.ceil(targetXP * 1.2);

    logger.debug(`[generator] Budget: ${targetXP} XP (${minXP}-${maxXP})`, {
        partyLevel: level,
        partySize: size,
        difficulty,
        xpPerCharacter
    });

    return { targetXP, minXP, maxXP };
}

// ============================================================================
// CREATURE SELECTION
// ============================================================================

/**
 * Selects creatures to fill XP budget using greedy algorithm with variety constraint.
 *
 * Algorithm:
 * 1. Sort creatures by CR (ascending)
 * 2. Randomly select creatures until budget reached (±20% tolerance)
 * 3. Apply variety constraint: Max 3 copies of same creature
 * 4. Account for XP multiplier based on creature count
 * 5. If no combination works, return single strongest creature within budget
 */
export function selectCreaturesForBudget(
    creatures: StatblockData[],
    budget: ReturnType<typeof calculateCreatureBudget>,
    options: GeneratorOptions
): EncounterCreature[] {
    if (creatures.length === 0) {
        logger.warn("[generator] No creatures available for selection");
        return [];
    }

    const { minXP, maxXP } = budget;
    const MAX_CREATURES = 6; // Limit for readability
    const MAX_COPIES = 3; // Variety constraint

    // Sort by CR ascending
    const sorted = [...creatures].sort((a, b) => {
        const crA = typeof a.cr === 'string' ? parseFloat(a.cr) : 0;
        const crB = typeof b.cr === 'string' ? parseFloat(b.cr) : 0;
        return crA - crB;
    });

    // Helper: Calculate adjusted XP for creature group
    const getAdjustedXP = (selections: Map<string, number>): number => {
        const totalCount = Array.from(selections.values()).reduce((sum, count) => sum + count, 0);
        const multiplier = getXpMultiplier(totalCount);

        let rawXP = 0;
        for (const [name, count] of selections) {
            const creature = sorted.find(c => c.name === name);
            if (!creature) continue;
            const cr = typeof creature.cr === 'string' ? parseFloat(creature.cr) : 0;
            const xpPerCreature = XP_BY_CR[cr] ?? 0;
            rawXP += xpPerCreature * count;
        }

        return Math.round(rawXP * multiplier);
    };

    // Try greedy selection with randomization
    const rng = options.seed !== undefined
        ? seededRandom(options.seed)
        : Math.random;

    let bestSelection = new Map<string, number>();
    let bestXP = 0;

    // Multiple attempts with randomization
    for (let attempt = 0; attempt < 10; attempt++) {
        const selection = new Map<string, number>();

        // Shuffle sorted list for variety
        const shuffled = [...sorted].sort(() => rng() - 0.5);

        for (const creature of shuffled) {
            if (Array.from(selection.values()).reduce((sum, c) => sum + c, 0) >= MAX_CREATURES) {
                break;
            }

            const currentCopies = selection.get(creature.name) ?? 0;
            if (currentCopies >= MAX_COPIES) continue;

            // Try adding one more copy
            selection.set(creature.name, currentCopies + 1);
            const adjustedXP = getAdjustedXP(selection);

            if (adjustedXP > maxXP) {
                // Overshot budget, revert and try next creature
                if (currentCopies === 0) {
                    selection.delete(creature.name);
                } else {
                    selection.set(creature.name, currentCopies);
                }
            } else if (adjustedXP >= minXP) {
                // Within budget range! Save and keep trying to improve
                if (adjustedXP > bestXP || bestSelection.size === 0) {
                    bestSelection = new Map(selection);
                    bestXP = adjustedXP;
                }
            }
            // else: Under budget, keep adding
        }

        // If we found a valid selection in this attempt, consider it
        const finalXP = getAdjustedXP(selection);
        if (finalXP >= minXP && finalXP <= maxXP) {
            if (finalXP > bestXP || bestSelection.size === 0) {
                bestSelection = new Map(selection);
                bestXP = finalXP;
            }
        }
    }

    // Fallback: If no valid combination, return single strongest creature within budget
    if (bestSelection.size === 0) {
        for (let i = sorted.length - 1; i >= 0; i--) {
            const creature = sorted[i];
            const cr = typeof creature.cr === 'string' ? parseFloat(creature.cr) : 0;
            const xp = XP_BY_CR[cr] ?? 0;
            if (xp <= maxXP) {
                bestSelection.set(creature.name, 1);
                bestXP = xp;
                logger.debug("[generator] Fallback: Single creature", { name: creature.name, xp });
                break;
            }
        }
    }

    // Convert selection to EncounterCreature[]
    const result: EncounterCreature[] = [];
    for (const [name, count] of bestSelection) {
        const creature = sorted.find(c => c.name === name);
        if (!creature) continue;

        const cr = typeof creature.cr === 'string' ? parseFloat(creature.cr) : 0;

        result.push({
            id: `${name}-${Date.now()}`,
            name: creature.name,
            count,
            cr,
            source: "library",
            statblockPath: `Creatures/${creature.name}.md` // TODO: Get actual path
        });
    }

    logger.debug("[generator] Selected creatures", {
        count: result.length,
        totalXP: bestXP,
        budget: `${minXP}-${maxXP}`,
        creatures: result.map(c => `${c.name} x${c.count}`)
    });

    return result;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generates a random encounter based on context and party configuration.
 *
 * @param ctx Faction/Terrain/Region context and available creatures
 * @param options Party configuration and difficulty
 * @returns Generated encounter with creatures and metadata
 */
export function generateRandomEncounter(
    ctx: GeneratorContext,
    options: GeneratorOptions
): GeneratorResult {
    logger.info("[generator] Starting encounter generation", {
        partyLevel: options.partyLevel,
        partySize: options.partySize,
        difficulty: options.difficulty,
        availableCreatures: ctx.creatures.length
    });

    // Step 1: Filter creatures by tags
    const { creatures: filteredCreatures, filterLevel } = filterCreaturesByTags(ctx);

    if (filteredCreatures.length === 0) {
        logger.error("[generator] No matching creatures found");
        return { creatures: [], totalXP: 0, filterLevel: 4 };
    }

    // Step 2: Calculate XP budget
    const budget = calculateCreatureBudget(options);

    // Step 3: Select creatures to fill budget
    const selectedCreatures = selectCreaturesForBudget(filteredCreatures, budget, options);

    // Step 4: Calculate actual XP
    const totalXP = selectedCreatures.reduce((sum, creature) => {
        const xpPerCreature = XP_BY_CR[creature.cr] ?? 0;
        return sum + (xpPerCreature * creature.count);
    }, 0);

    logger.info("[generator] Encounter generated successfully", {
        creatureCount: selectedCreatures.length,
        totalCreatures: selectedCreatures.reduce((sum, c) => sum + c.count, 0),
        totalXP,
        filterLevel
    });

    return {
        creatures: selectedCreatures,
        totalXP,
        filterLevel
    };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Seeded random number generator for deterministic testing.
 * Simple LCG implementation.
 */
function seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}
