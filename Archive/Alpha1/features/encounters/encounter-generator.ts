/**
 * ============================================================================
 * ENCOUNTER GENERATOR - Habitat-Based Random Encounter Generation
 * ============================================================================
 *
 * Generates random encounters using habitat-based creature selection.
 * Follows D&D 5e DMG encounter building guidelines (p.81-85).
 *
 * ## Architecture
 *
 * This module is a CONSUMER of the CreatureStore. It does NOT load creatures
 * itself - all creature data comes from the global store.
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                     ENCOUNTER GENERATION FLOW                           │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                          │
 * │   CreatureStore          encounter-filter         encounter-generator   │
 * │   ──────────────        ────────────────         ──────────────────     │
 * │                                                                          │
 * │   getCreatureStore() ──► filterCreaturesByHabitat() ──► generateEncounterFromHabitat()
 * │   store.getByType()      (scores by terrain/flora)      (selects creatures)
 * │                                                         (spawns combatants)
 * │                                                         (calculates XP)
 * │                                                                          │
 * │   Output: Encounter { combatants, totalXp, difficulty }                  │
 * │                                                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { generateEncounterFromHabitat } from '@features/encounters/encounter-generator';
 *
 * const encounter = generateEncounterFromHabitat({
 *     party: [{ id: '1', name: 'Fighter', level: 5 }],
 *     tileData: { terrain: 'forest', flora: 'dense', moisture: 'wet' },
 *     difficulty: 'medium',
 * });
 *
 * console.log(encounter.combatants); // Array of Combatant
 * console.log(encounter.totalXp);    // Total XP for the encounter
 * console.log(encounter.difficulty); // 'easy' | 'medium' | 'hard' | 'deadly'
 * ```
 *
 * ## Related Files
 *
 * - `creature-store.ts` - Source of creature data (MUST be initialized first)
 * - `encounter-filter.ts` - Habitat scoring and filtering logic
 * - `encounter-probability.ts` - XP and difficulty calculations
 * - `types.ts` - Type definitions (EncounterGenerationContext, Encounter, Combatant)
 *
 * @see creature-store.ts for how creatures are loaded from vault
 * @see encounter-filter.ts for habitat scoring algorithm
 * @module features/encounters/encounter-generator
 */

import { configurableLogger } from "@services/logging/configurable-logger";
import { getCreatureStore, type Creature } from "./creature-store";
import { filterCreaturesByHabitat } from "./encounter-filter";
import { calculateEncounterDifficulty } from "./encounter-probability";
import type {
    EncounterGenerationContext,
    Encounter,
    Combatant,
} from "./encounter-types";

const logger = configurableLogger.forModule("encounter-generator");

/**
 * Generate encounter using habitat-based creature selection.
 *
 * **Flow:**
 * 1. Get creatures from CreatureStore (global, already cached)
 * 2. Filter by type (e.g., "Beast")
 * 3. Filter by habitat using scoring system (30-point threshold)
 * 4. Filter by CR range (based on party level)
 * 5. Select random quantity (1-4 creatures)
 * 6. Spawn combatants with initiative rolls
 * 7. Calculate encounter difficulty
 *
 * @param context - Encounter generation context (party, tileData, difficulty)
 * @param options - Generation options (minCreatures, creatureType)
 * @returns Generated encounter with combatants, XP, difficulty
 */
export function generateEncounterFromHabitat(
    context: EncounterGenerationContext,
    options?: {
        minCreatures?: number;
        creatureType?: string;
    }
): Encounter {
    const warnings: string[] = [];
    const minCreatures = options?.minCreatures ?? 5;
    const creatureType = options?.creatureType ?? "Beast";

    logger.info("Starting habitat-based generation", {
        creatureType,
        minCreatures,
        hasTileData: !!context.tileData,
        difficulty: context.difficulty,
    });

    // 1. Get creatures from store (already loaded at plugin init)
    const store = getCreatureStore();
    const allCreatures = creatureType
        ? store.getByType(creatureType)
        : store.get().creatures;

    logger.info("Got creatures from store", {
        count: allCreatures.length,
        creatureType,
    });

    if (allCreatures.length === 0) {
        warnings.push(`No creatures of type "${creatureType}" found in library`);
        return createEmptyEncounter(warnings);
    }

    // 2. Filter by habitat (if tile data available)
    let filteredCreatures = applyHabitatFilter(
        allCreatures,
        context,
        minCreatures,
        warnings
    );

    if (filteredCreatures.length === 0) {
        warnings.push("No creatures available after habitat filtering");
        return createEmptyEncounter(warnings);
    }

    // 3. Filter by CR range
    const { crMin, crMax, partyLevel } = calculateCRRange(context);
    let crFiltered = filteredCreatures.filter((c) => c.cr >= crMin && c.cr <= crMax);

    logger.info("CR filtering", {
        before: filteredCreatures.length,
        after: crFiltered.length,
        crRange: `${crMin}-${crMax}`,
        partyLevel,
    });

    // Fallback: use closest CRs if none in range
    if (crFiltered.length === 0) {
        warnings.push(`No creatures in CR ${crMin}-${crMax}, using closest available`);
        crFiltered = getClosestByCR(filteredCreatures, crMin, crMax, 5);
    }

    // 4. Spawn combatants
    const quantity = Math.max(1, Math.floor(1 + Math.random() * 4)); // 1-4
    const combatants = spawnCombatants(crFiltered, quantity);

    // 5. Calculate difficulty
    const { totalXp, adjustedXp, difficulty } = calculateEncounterDifficulty(
        combatants,
        context
    );

    const title =
        combatants.length > 0
            ? `Habitat Encounter: ${combatants.map((c) => c.name).join(", ")}`
            : "No Encounter";

    logger.info("Complete", {
        title,
        combatants: combatants.length,
        difficulty,
        totalXp,
    });

    return {
        id: `encounter-${Date.now()}`,
        title,
        combatants,
        totalXp,
        adjustedXp,
        difficulty,
        source: 'travel' as const,
        warnings,
        timestamp: Date.now(),
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

function createEmptyEncounter(warnings: string[]): Encounter {
    return {
        id: `encounter-${Date.now()}`,
        title: "No Encounter",
        combatants: [],
        totalXp: 0,
        adjustedXp: 0,
        difficulty: "trivial",
        source: 'travel' as const,
        warnings,
        timestamp: Date.now(),
    };
}

function applyHabitatFilter(
    creatures: ReadonlyArray<Creature>,
    context: EncounterGenerationContext,
    minCreatures: number,
    warnings: string[]
): Creature[] {
    if (!context.tileData) {
        warnings.push("No tile data - habitat filtering skipped");
        return [...creatures];
    }

    // Convert to mutable array with habitatScore field for filtering
    const creaturesWithScore = creatures.map((c) => ({
        ...c,
        habitatScore: 0,
    }));

    const filtered = filterCreaturesByHabitat(creaturesWithScore, context.tileData, 30);

    logger.info("Habitat filter", {
        before: creatures.length,
        after: filtered.length,
        terrain: context.tileData.terrain,
        flora: context.tileData.flora,
        moisture: context.tileData.moisture,
    });

    // Check for fallback scenarios
    const maxScore = filtered.length > 0
        ? Math.max(...filtered.map((c) => c.habitatScore || 0))
        : 0;

    if (maxScore === 0 && filtered.length > 0) {
        warnings.push("No habitat matches - using CR-based selection");
    } else if (filtered.length < minCreatures) {
        warnings.push(`Only ${filtered.length} habitat matches - expanding selection`);
        // Get more creatures with lower scores
        const allScored = filterCreaturesByHabitat(creaturesWithScore, context.tileData, 0);
        return allScored.slice(0, Math.max(minCreatures, filtered.length));
    }

    return filtered;
}

function calculateCRRange(context: EncounterGenerationContext): {
    crMin: number;
    crMax: number;
    partyLevel: number;
} {
    const partyLevel =
        context.party.length > 0
            ? Math.round(
                  context.party.reduce((sum, m) => sum + m.level, 0) /
                      context.party.length
              )
            : 1;

    return {
        crMin: context.crRange?.min ?? Math.max(0, partyLevel - 2),
        crMax: context.crRange?.max ?? partyLevel + 2,
        partyLevel,
    };
}

function getClosestByCR(
    creatures: Creature[],
    crMin: number,
    crMax: number,
    count: number
): Creature[] {
    return [...creatures]
        .sort((a, b) => {
            const distA = Math.min(Math.abs(a.cr - crMin), Math.abs(a.cr - crMax));
            const distB = Math.min(Math.abs(b.cr - crMin), Math.abs(b.cr - crMax));
            return distA - distB;
        })
        .slice(0, count);
}

function spawnCombatants(
    creatures: ReadonlyArray<Creature>,
    quantity: number
): Combatant[] {
    const combatants: Combatant[] = [];

    for (let i = 0; i < quantity; i++) {
        const creature = creatures[Math.floor(Math.random() * creatures.length)];

        // Parse HP (expecting format like "19" or "3d8+6")
        const maxHp = parseInt(creature.hp, 10) || 10;

        // Roll initiative (1d20)
        const initiative = Math.floor(Math.random() * 20) + 1;

        combatants.push({
            id: `${creature.name}-${Date.now()}-${i}`,
            name: creature.name,
            cr: creature.cr,
            initiative,
            currentHp: maxHp,
            maxHp,
            tempHp: 0,
            ac: creature.ac,
            defeated: false,
            creatureFile: creature.file,
        });
    }

    return combatants;
}

// Re-export for other modules
export { calculateEncounterDifficulty } from "./encounter-probability";
