// src/features/encounters/encounter-probability.ts

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("encounter-probability");
import {
    CR_TO_XP,
    XP_THRESHOLDS_BY_LEVEL,
    ENCOUNTER_MULTIPLIERS,
} from "./encounter-types";
import type { Combatant, EncounterGenerationContext } from "./encounter-types";
import type { EncounterTableData, EncounterTableEntry } from "@services/domain";

/**
 * Encounter Probability
 *
 * Handles weighted selection and difficulty calculations.
 * - Dice rolling (quantity, initiative)
 * - Weighted table selection
 * - XP calculation
 * - Difficulty assessment
 */

/**
 * Roll on encounter table using weighted selection
 */
export function rollOnTable(table: EncounterTableData): EncounterTableEntry | null {
    if (!table || !table.entries || table.entries.length === 0) return null;

    const totalWeight = table.entries.reduce((sum, entry) => sum + (entry.weight || 1), 0);
    let roll = Math.random() * totalWeight;

    for (const entry of table.entries) {
        const weight = entry.weight || 1;
        if (roll < weight) {
            return entry;
        }
        roll -= weight;
    }

    // Fallback to last entry
    return table.entries[table.entries.length - 1];
}

/**
 * Roll dice formula (e.g. "1d4", "2", "1d6+2")
 */
export function rollQuantity(formula: string): number {
    const trimmed = formula.trim();

    // Simple number
    if (/^\d+$/.test(trimmed)) {
        return parseInt(trimmed, 10);
    }

    // Dice formula: NdM or NdM+B
    const match = trimmed.match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!match) {
        return 1; // Fallback to 1
    }

    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const bonus = match[3] ? parseInt(match[3], 10) : 0;

    let total = bonus;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * sides) + 1;
    }

    return Math.max(1, total);
}

/**
 * Calculate encounter XP and difficulty
 */
export function calculateEncounterDifficulty(
    combatants: Combatant[],
    context: EncounterGenerationContext,
): {
    totalXp: number;
    adjustedXp: number;
    difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly";
} {
    // Sum total XP
    const totalXp = combatants.reduce((sum, c) => sum + (CR_TO_XP[c.cr] || 0), 0);

    // Apply encounter multiplier based on number of monsters
    const multiplier = getEncounterMultiplier(combatants.length);
    const adjustedXp = totalXp * multiplier;

    // Calculate average party level and size from party array
    const partySize = context.party.length || 1; // Default to 1 if empty
    const avgLevel = partySize > 0
        ? Math.floor(context.party.reduce((sum, member) => sum + member.level, 0) / partySize)
        : 1;
    const level = Math.max(1, Math.min(20, avgLevel));

    // Calculate party XP threshold
    const thresholds = XP_THRESHOLDS_BY_LEVEL[level];
    const partyXp = {
        easy: thresholds.easy * partySize,
        medium: thresholds.medium * partySize,
        hard: thresholds.hard * partySize,
        deadly: thresholds.deadly * partySize,
    };

    // Determine difficulty
    let difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly";
    if (adjustedXp < partyXp.easy) {
        difficulty = "trivial";
    } else if (adjustedXp < partyXp.medium) {
        difficulty = "easy";
    } else if (adjustedXp < partyXp.hard) {
        difficulty = "medium";
    } else if (adjustedXp < partyXp.deadly) {
        difficulty = "hard";
    } else {
        difficulty = "deadly";
    }

    logger.debug("Calculated difficulty", {
        totalXp,
        adjustedXp,
        difficulty,
        partyLevel: level,
        partySize,
    });

    return { totalXp, adjustedXp, difficulty };
}

/**
 * Get encounter multiplier based on number of monsters
 */
export function getEncounterMultiplier(monsterCount: number): number {
    for (let i = ENCOUNTER_MULTIPLIERS.length - 1; i >= 0; i--) {
        if (monsterCount >= ENCOUNTER_MULTIPLIERS[i].minMonsters) {
            return ENCOUNTER_MULTIPLIERS[i].multiplier;
        }
    }
    return 1.0;
}
