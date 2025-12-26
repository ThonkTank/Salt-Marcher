/**
 * Encounter Pipeline Step 5 (Simplified): CR-Based Difficulty
 *
 * Calculates encounter difficulty using D&D 5e XP thresholds instead of
 * full PMF combat simulation. This is a simplified approach for the prototype.
 *
 * The full PMF simulation will be implemented in Task #3268.
 */

import type {
  DifficultyLevel,
  DifficultyResult,
  FlavouredEncounter,
  PartySnapshot,
} from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';

// =============================================================================
// Types
// =============================================================================

export type DifficultyCalcResult =
  | { success: true; result: DifficultyResult }
  | { success: false; error: string };

interface PartyThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

// =============================================================================
// Constants: D&D 5e CR to XP Mapping
// =============================================================================

/**
 * Standard D&D 5e Challenge Rating to XP conversion.
 * Source: Monster Manual, DMG
 */
const CR_TO_XP: Record<number, number> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
};

// =============================================================================
// Constants: D&D 5e XP Thresholds per Character Level
// =============================================================================

/**
 * XP thresholds per character level.
 * Source: DMG, Difficulty.md:1210-1231
 */
const XP_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get XP value for a given CR.
 */
function getXPFromCR(cr: number): number {
  return CR_TO_XP[cr] ?? 0;
}

/**
 * Get group multiplier based on creature count.
 * Source: DMG, Difficulty.md
 */
function getGroupMultiplier(creatureCount: number): number {
  if (creatureCount <= 1) return 1.0;
  if (creatureCount === 2) return 1.5;
  if (creatureCount <= 6) return 2.0;
  if (creatureCount <= 10) return 2.5;
  if (creatureCount <= 14) return 3.0;
  return 4.0;
}

/**
 * Calculate party thresholds by summing individual character thresholds.
 */
function calculatePartyThresholds(party: PartySnapshot): PartyThresholds {
  let easy = 0;
  let medium = 0;
  let hard = 0;
  let deadly = 0;

  for (const character of party.characters) {
    const level = Math.min(20, Math.max(1, character.level));
    const thresholds = XP_THRESHOLDS[level];
    easy += thresholds.easy;
    medium += thresholds.medium;
    hard += thresholds.hard;
    deadly += thresholds.deadly;
  }

  return { easy, medium, hard, deadly };
}

/**
 * Calculate total base XP from all creatures in encounter.
 */
function calculateBaseXP(encounter: FlavouredEncounter, lookups: PresetLookups): number {
  let totalXP = 0;

  for (const group of encounter.groups) {
    for (const creature of group.creatures) {
      const creatureDef = lookups.creatures.get(creature.definitionId);
      if (creatureDef) {
        totalXP += getXPFromCR(creatureDef.cr);
      }
    }
  }

  return totalXP;
}

/**
 * Count total creatures in encounter.
 */
function countCreatures(encounter: FlavouredEncounter): number {
  return encounter.groups.reduce(
    (sum, group) => sum + group.creatures.length,
    0
  );
}

/**
 * Classify difficulty based on adjusted XP vs party thresholds.
 */
function classifyByThreshold(adjustedXP: number, thresholds: PartyThresholds): DifficultyLevel {
  if (adjustedXP >= thresholds.deadly) return 'deadly';
  if (adjustedXP >= thresholds.hard) return 'hard';
  if (adjustedXP >= thresholds.medium) return 'moderate';
  if (adjustedXP >= thresholds.easy) return 'easy';
  return 'trivial';
}

/**
 * Estimate party win probability based on XP ratio.
 * Simplified heuristic: Higher adjusted XP = lower win probability.
 */
function estimateWinProbability(adjustedXP: number, mediumThreshold: number): number {
  // At medium threshold, party has ~80% win chance
  // Below medium: higher win chance
  // Above medium: lower win chance (approaches 50% at deadly)
  const ratio = adjustedXP / mediumThreshold;

  if (ratio <= 0.5) return 0.98; // Trivial
  if (ratio <= 1.0) return 0.95 - (ratio - 0.5) * 0.3; // Easy to Medium: 95% -> 80%
  if (ratio <= 1.5) return 0.80 - (ratio - 1.0) * 0.3; // Medium to Hard: 80% -> 65%
  if (ratio <= 2.0) return 0.65 - (ratio - 1.5) * 0.3; // Hard to Deadly: 65% -> 50%

  // Beyond deadly
  return Math.max(0.30, 0.50 - (ratio - 2.0) * 0.1);
}

/**
 * Estimate TPK risk based on XP ratio.
 * Simplified heuristic: Higher adjusted XP = higher TPK risk.
 */
function estimateTPKRisk(adjustedXP: number, deadlyThreshold: number): number {
  const ratio = adjustedXP / deadlyThreshold;

  if (ratio <= 0.5) return 0.01; // Below easy
  if (ratio <= 0.75) return 0.03; // Easy
  if (ratio <= 1.0) return 0.08 + (ratio - 0.75) * 0.12; // Medium to Hard: 8% -> 11%
  if (ratio <= 1.25) return 0.15 + (ratio - 1.0) * 0.20; // Hard to Deadly: 15% -> 20%
  if (ratio <= 1.5) return 0.25 + (ratio - 1.25) * 0.20; // At Deadly: 25% -> 30%

  // Beyond deadly
  return Math.min(0.80, 0.30 + (ratio - 1.5) * 0.20);
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Calculate encounter difficulty using CR-based XP thresholds.
 *
 * This is the simplified version that uses D&D 5e XP math instead of
 * full PMF combat simulation.
 */
export function calculateDifficulty(
  encounter: FlavouredEncounter,
  lookups: PresetLookups
): DifficultyCalcResult {
  try {
    // 1. Calculate base XP from all creatures
    const baseXP = calculateBaseXP(encounter, lookups);

    // 2. Apply group multiplier
    const creatureCount = countCreatures(encounter);
    const multiplier = getGroupMultiplier(creatureCount);
    const adjustedXP = Math.floor(baseXP * multiplier);

    // 3. Calculate party thresholds
    const thresholds = calculatePartyThresholds(encounter.context.party);

    // 4. Classify difficulty by threshold
    const difficulty = classifyByThreshold(adjustedXP, thresholds);

    // 5. Estimate win probability and TPK risk
    const winProbability = estimateWinProbability(adjustedXP, thresholds.medium);
    const tpkRisk = estimateTPKRisk(adjustedXP, thresholds.deadly);

    const result: DifficultyResult = {
      difficulty,
      partyWinProbability: winProbability,
      tpkRisk,
      xpReward: baseXP, // Base XP is the actual reward, not adjusted
      simulationMethod: 'cr-based',
    };

    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in calculateDifficulty',
    };
  }
}

// =============================================================================
// Exports for Testing/Debugging
// =============================================================================

export {
  CR_TO_XP,
  XP_THRESHOLDS,
  getXPFromCR,
  getGroupMultiplier,
  calculatePartyThresholds,
  calculateBaseXP,
  countCreatures,
  classifyByThreshold,
  estimateWinProbability,
  estimateTPKRisk,
};
