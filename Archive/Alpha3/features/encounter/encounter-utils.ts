/**
 * Encounter Utils - Pure Functions
 *
 * Functions for generating D&D 5e encounters based on party composition,
 * terrain, and difficulty targets. All functions are pure and testable.
 */

import type { CreatureEntity } from '@/features/entity';
import type { Party } from '@core/schemas/party';
import {
  XP_THRESHOLDS_BY_LEVEL,
  CR_TO_XP,
  ENCOUNTER_MULTIPLIERS,
} from '@core/schemas/dnd-constants';
import { parseCR } from '@core/schemas/creature';
import type { Difficulty, EntityId, Timestamp } from '@core/types/common';
import { createEntityId, now } from '@core/types/common';
import type {
  GeneratedEncounter,
  EncounterCreatureGroup,
} from './types';

// ═══════════════════════════════════════════════════════════════
// Party Threshold Calculations
// ═══════════════════════════════════════════════════════════════

/**
 * Party thresholds for all difficulty levels
 */
export type PartyThresholds = Record<Difficulty, number>;

/**
 * Calculate XP thresholds for a party based on member levels.
 * Sums individual thresholds from DMG p.82.
 */
export function calculatePartyThresholds(party: Party): PartyThresholds {
  const thresholds: PartyThresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 };

  for (const member of party) {
    // Clamp level to 1-20 range
    const level = Math.max(1, Math.min(20, member.level));
    const index = level - 1;

    thresholds.easy += XP_THRESHOLDS_BY_LEVEL.easy[index];
    thresholds.medium += XP_THRESHOLDS_BY_LEVEL.medium[index];
    thresholds.hard += XP_THRESHOLDS_BY_LEVEL.hard[index];
    thresholds.deadly += XP_THRESHOLDS_BY_LEVEL.deadly[index];
  }

  return thresholds;
}

/**
 * Get average party level (rounded)
 */
export function getAveragePartyLevel(party: Party): number {
  if (party.length === 0) return 1;
  const sum = party.reduce((acc, m) => acc + m.level, 0);
  return Math.round(sum / party.length);
}

// ═══════════════════════════════════════════════════════════════
// XP and Difficulty Calculations
// ═══════════════════════════════════════════════════════════════

/**
 * Get XP value for a Challenge Rating
 */
export function getXpForCR(cr: string | undefined): number {
  if (!cr) return 0;
  return CR_TO_XP[cr] ?? 0;
}

/**
 * Convert numeric CR to string representation
 */
export function crToString(numericCR: number): string {
  if (numericCR === 0.125) return '1/8';
  if (numericCR === 0.25) return '1/4';
  if (numericCR === 0.5) return '1/2';
  return String(Math.floor(numericCR));
}

/**
 * Get encounter multiplier based on creature count
 */
export function getEncounterMultiplier(creatureCount: number): number {
  for (const [maxCount, multiplier] of ENCOUNTER_MULTIPLIERS) {
    if (creatureCount <= maxCount) return multiplier;
  }
  return 4.0;
}

/**
 * Calculate adjusted XP (total XP * multiplier)
 */
export function calculateAdjustedXP(
  totalXp: number,
  creatureCount: number
): number {
  return Math.floor(totalXp * getEncounterMultiplier(creatureCount));
}

/**
 * Determine difficulty based on adjusted XP and party thresholds
 */
export function determineDifficulty(
  adjustedXp: number,
  thresholds: PartyThresholds
): Difficulty {
  if (adjustedXp >= thresholds.deadly) return 'deadly';
  if (adjustedXp >= thresholds.hard) return 'hard';
  if (adjustedXp >= thresholds.medium) return 'medium';
  return 'easy';
}

// ═══════════════════════════════════════════════════════════════
// Creature Filtering
// ═══════════════════════════════════════════════════════════════

/**
 * Parameters for filtering creatures
 */
export interface FilterParams {
  terrain: string;
  crMin: number;
  crMax: number;
}

/**
 * Filter creatures by terrain preference and CR range
 */
export function filterCreaturesForEncounter(
  creatures: CreatureEntity[],
  params: FilterParams
): CreatureEntity[] {
  const terrainLower = params.terrain.toLowerCase();

  return creatures.filter((creature) => {
    // Check terrain preference
    const terrainPrefs = creature.data.terrainPreference ?? [];

    // Must match terrain (case-insensitive, substring match)
    const matchesTerrain =
      terrainPrefs.length === 0 || // No preference = any terrain
      terrainPrefs.some(
        (pref) =>
          pref.toLowerCase().includes(terrainLower) ||
          terrainLower.includes(pref.toLowerCase())
      );

    if (!matchesTerrain) return false;

    // Check CR range
    const cr = parseCR(creature.data.cr);
    return cr >= params.crMin && cr <= params.crMax;
  });
}

/**
 * Sort creatures by CR (ascending)
 */
export function sortCreaturesByCR(creatures: CreatureEntity[]): CreatureEntity[] {
  return [...creatures].sort((a, b) => {
    const crA = parseCR(a.data.cr);
    const crB = parseCR(b.data.cr);
    return crA - crB;
  });
}

// ═══════════════════════════════════════════════════════════════
// Encounter Generation
// ═══════════════════════════════════════════════════════════════

/**
 * Parameters for encounter generation
 */
export interface GenerateParams {
  creatures: CreatureEntity[];
  party: Party;
  terrain: string;
  targetDifficulty: Difficulty;
  crRangeMin: number;
  crRangeMax: number;
  maxCreatureCount: number;
}

/**
 * Get maximum XP for a difficulty level
 */
function getMaxXpForDifficulty(
  difficulty: Difficulty,
  thresholds: PartyThresholds
): number {
  const levels: Difficulty[] = ['easy', 'medium', 'hard', 'deadly'];
  const index = levels.indexOf(difficulty);

  if (index < levels.length - 1) {
    // Use next difficulty threshold as upper bound
    return thresholds[levels[index + 1]] - 1;
  }
  // For deadly, allow up to 1.5x the threshold
  return Math.floor(thresholds.deadly * 1.5);
}

/**
 * Build encounter groups using greedy algorithm
 */
function buildEncounterGroups(
  sortedCreatures: CreatureEntity[],
  targetXp: number,
  maxXp: number,
  maxCreatureCount: number
): EncounterCreatureGroup[] {
  const groups = new Map<string, EncounterCreatureGroup>();
  let totalXp = 0;
  let creatureCount = 0;

  const tryAddCreature = (
    creature: CreatureEntity,
    xpEach: number
  ): boolean => {
    const testCount = creatureCount + 1;
    const testTotalXp = totalXp + xpEach;
    const testAdjusted = calculateAdjustedXP(testTotalXp, testCount);

    // Check constraints
    if (testCount > maxCreatureCount) return false;
    if (testAdjusted > maxXp) return false;

    // Add to groups
    const key = creature.id;
    const existing = groups.get(key);

    if (existing) {
      existing.count++;
    } else {
      groups.set(key, {
        creatureId: creature.id as EntityId<'entity'>,
        creatureName: creature.data.name,
        cr: creature.data.cr ?? '0',
        count: 1,
        xpEach,
      });
    }

    totalXp = testTotalXp;
    creatureCount = testCount;
    return true;
  };

  // Start from highest CR creatures (reversed order)
  const reversed = [...sortedCreatures].reverse();

  // Add high-CR creatures first
  for (const creature of reversed) {
    const xpEach = getXpForCR(creature.data.cr);
    if (xpEach === 0) continue;

    tryAddCreature(creature, xpEach);

    const adjustedXp = calculateAdjustedXP(totalXp, creatureCount);
    if (adjustedXp >= targetXp) break;
  }

  // Fill with lowest CR creatures if target not reached
  let adjustedXp = calculateAdjustedXP(totalXp, creatureCount);
  if (adjustedXp < targetXp && sortedCreatures.length > 0) {
    const lowestCR = sortedCreatures[0];
    const xpEach = getXpForCR(lowestCR.data.cr);

    while (adjustedXp < targetXp) {
      if (!tryAddCreature(lowestCR, xpEach)) break;
      adjustedXp = calculateAdjustedXP(totalXp, creatureCount);
    }
  }

  return Array.from(groups.values());
}

/**
 * Generate an encounter based on parameters.
 * Returns null if no valid encounter could be generated.
 */
export function generateEncounter(
  params: GenerateParams
): GeneratedEncounter | null {
  const { creatures, party, terrain, targetDifficulty, maxCreatureCount } =
    params;

  // Validate inputs
  if (party.length === 0 || creatures.length === 0) return null;

  // Calculate party thresholds
  const thresholds = calculatePartyThresholds(party);
  const avgLevel = getAveragePartyLevel(party);

  // Calculate CR range
  const crMin = Math.max(0, avgLevel + params.crRangeMin);
  const crMax = avgLevel + params.crRangeMax;

  // Filter creatures by terrain and CR
  const filtered = filterCreaturesForEncounter(creatures, {
    terrain,
    crMin,
    crMax,
  });
  if (filtered.length === 0) return null;

  // Sort by CR (ascending)
  const sorted = sortCreaturesByCR(filtered);

  // Get XP targets
  const targetXp = thresholds[targetDifficulty];
  const maxXp = getMaxXpForDifficulty(targetDifficulty, thresholds);

  // Build encounter using greedy algorithm
  const groups = buildEncounterGroups(sorted, targetXp, maxXp, maxCreatureCount);
  if (groups.length === 0) return null;

  // Calculate final totals
  const totalXp = groups.reduce((sum, g) => sum + g.xpEach * g.count, 0);
  const creatureCountFinal = groups.reduce((sum, g) => sum + g.count, 0);
  const adjustedXpFinal = calculateAdjustedXP(totalXp, creatureCountFinal);
  const multiplier = getEncounterMultiplier(creatureCountFinal);
  const difficulty = determineDifficulty(adjustedXpFinal, thresholds);

  return {
    id: createEntityId('encounter'),
    groups,
    totalXp,
    adjustedXp: adjustedXpFinal,
    multiplier,
    difficulty,
    creatureCount: creatureCountFinal,
    terrain,
    generatedAt: now(),
  };
}

// ═══════════════════════════════════════════════════════════════
// Encounter Check
// ═══════════════════════════════════════════════════════════════

/**
 * Roll for an encounter check
 * @param probability - Probability of encounter (0-1), default 0.125 (12.5%)
 * @returns true if encounter should occur
 */
export function rollEncounterCheck(probability: number = 0.125): boolean {
  return Math.random() < probability;
}
