/**
 * Encounter Utility Functions - Pure Utils for @core
 *
 * These are pure functions without side effects that can be used by all layers.
 * Feature-specific functions (createCreatureInstance, populateEncounter) remain
 * in src/features/encounter/encounter-utils.ts.
 *
 * @see docs/architecture/Core.md#entity-spezifische-utils
 * @see docs/features/Encounter-System.md
 */

import type {
  CreatureDefinition,
  EncounterType,
  WeatherState,
  TimeSegment,
  CreatureSlot,
  EncounterTriggers,
  NoiseLevel,
  ScentStrength,
  StealthAbility,
  CreatureDetectionProfile,
  WeightedActivity,
  ResolvedCulture,
} from '@core/schemas';
import { DEFAULT_DETECTION_PROFILE } from '@core/schemas/creature';
import { calculateXP, calculateEffectiveXP } from './creature-utils';

// ============================================================================
// Types
// ============================================================================

/**
 * CR comparison result - determines if combat is viable.
 * @see docs/features/Encounter-Balancing.md#cr-vergleich
 */
export type CRComparison = 'trivial' | 'manageable' | 'deadly' | 'impossible';

/**
 * Encounter difficulty levels for XP budget calculation.
 * @see docs/features/Encounter-Balancing.md#difficulty-bestimmung
 */
export type EncounterDifficulty = 'easy' | 'medium' | 'hard' | 'deadly';

/**
 * Faction relation to party - derived from faction.reputationWithParty
 * - hostile: reputation < -20
 * - neutral: reputation >= -20 && <= +20
 * - friendly: reputation > +20
 *
 * @see docs/features/Encounter-System.md#typ-ableitung
 * @see docs/domain/Faction.md#party-reputation
 */
export type FactionRelation = 'hostile' | 'neutral' | 'friendly';

/**
 * Type derivation probability matrix.
 * Maps disposition + CR comparison to encounter type probabilities.
 */
export interface TypeProbabilities {
  combat: number;
  social: number;
  passing: number;
  trace: number;
}

/**
 * Encounter type probability matrix for variety dampening.
 * All values should sum to 1.0 after normalization.
 *
 * Note: environmental and location are Post-MVP encounter types.
 * When they are added to EncounterType schema, add them here too.
 *
 * @see docs/features/Encounter-System.md#variety-validation
 */
export interface TypeProbabilityMatrix {
  combat: number;
  social: number;
  passing: number;
  trace: number;
}

/**
 * Entry in the encounter type history for variety validation.
 * Matches the feature-level type but defined here for utils.
 */
export interface EncounterHistoryEntry {
  type: EncounterType;
  sequence: number;
}

/**
 * Result of creature selection.
 */
export interface CreatureSelectionResult {
  creature: CreatureDefinition;
  faction: { id: string };
  weight: number;
}

/**
 * Result of type derivation.
 */
export interface TypeDerivationResult {
  type: EncounterType;
  reason: string;
  crComparison: CRComparison;
}

/**
 * Result of variety validation.
 */
export interface VarietyValidationResult {
  valid: boolean;
  rerollReason?: string;
}

/**
 * Creature weight calculation result.
 */
export interface CreatureWeight {
  creature: CreatureDefinition;
  factionId: string;
  baseWeight: number;
  terrainModifier: number;
  weatherModifier: number;
  finalWeight: number;
}

/**
 * Faction weight for creature selection.
 */
export interface FactionWeight {
  factionId: string;
  weight: number;
}

/**
 * Result of companion selection for multi-creature encounters.
 */
export interface CompanionSelectionResult {
  /** All creatures including lead and companions */
  creatures: readonly CreatureDefinition[];

  /** Raw total XP (sum of individual creature XP) */
  totalXP: number;

  /** Effective XP including group multiplier */
  effectiveXP: number;
}

// ============================================================================
// Step 1: Tile-Eligibility
// ============================================================================

/**
 * Filter creatures by terrain affinity and active time.
 * Only creatures that match BOTH terrain AND time pass through.
 */
export function filterEligibleCreatures(
  creatures: readonly CreatureDefinition[],
  terrainId: string,
  timeSegment: TimeSegment
): CreatureDefinition[] {
  return creatures.filter((creature) => {
    // Must have matching terrain
    const terrainMatch = creature.terrainAffinities.some(
      (affinity) => affinity === terrainId
    );
    if (!terrainMatch) return false;

    // Must have matching time segment
    const timeMatch = creature.activeTime.includes(timeSegment);
    return timeMatch;
  });
}

// ============================================================================
// Step 2: Weighted Creature Selection
// ============================================================================

/**
 * Calculate base weight for a creature based on faction presence.
 * Creatures in dominant factions have higher weight.
 */
export function calculateCreatureWeight(
  creature: CreatureDefinition,
  factionWeights: readonly FactionWeight[],
  weather: WeatherState | null,
  terrainId: string
): CreatureWeight {
  // Base weight from faction presence
  const factionId = creature.defaultFactionId ?? 'base-beasts';
  const factionEntry = factionWeights.find((fw) => fw.factionId === factionId);
  const baseWeight = factionEntry?.weight ?? 1.0;

  // Terrain modifier from preferences (if available)
  let terrainModifier = 1.0;
  if (creature.preferences?.terrain) {
    terrainModifier = creature.preferences.terrain[terrainId] ?? 1.0;
  }

  // Weather modifier (future: based on precipitation/temperature)
  let weatherModifier = 1.0;
  if (weather && creature.preferences?.weather) {
    // Simple: reduce weight in bad weather for non-adapted creatures
    if (weather.params.precipitation > 50) {
      weatherModifier = creature.preferences.weather['rain'] ?? 0.8;
    }
  }

  const finalWeight = baseWeight * terrainModifier * weatherModifier;

  return {
    creature,
    factionId,
    baseWeight,
    terrainModifier,
    weatherModifier,
    finalWeight,
  };
}

/**
 * Select a creature using weighted random selection.
 * Returns null if no eligible creatures.
 */
export function selectWeightedCreature(
  eligible: readonly CreatureDefinition[],
  factionWeights: readonly FactionWeight[],
  weather: WeatherState | null,
  terrainId: string
): CreatureSelectionResult | null {
  if (eligible.length === 0) return null;

  // Calculate weights for all eligible creatures
  const weights = eligible.map((creature) =>
    calculateCreatureWeight(creature, factionWeights, weather, terrainId)
  );

  // Sum of all weights
  const totalWeight = weights.reduce((sum, w) => sum + w.finalWeight, 0);
  if (totalWeight <= 0) return null;

  // Weighted random selection
  let random = Math.random() * totalWeight;
  for (const w of weights) {
    random -= w.finalWeight;
    if (random <= 0) {
      return {
        creature: w.creature,
        faction: { id: w.factionId },
        weight: w.finalWeight,
      };
    }
  }

  // Fallback to last creature
  const last = weights[weights.length - 1];
  return {
    creature: last.creature,
    faction: { id: last.factionId },
    weight: last.finalWeight,
  };
}

// ============================================================================
// Step 3: Type Derivation
// ============================================================================

/**
 * Compare creature CR to party level.
 *
 * @param creatureCR - The creature's Challenge Rating
 * @param partyLevel - Average party level
 * @returns CRComparison result
 *
 * Thresholds:
 * - trivial: CR < 0.25 * partyLevel (no real threat)
 * - manageable: CR <= 1.5 * partyLevel (fair fight)
 * - deadly: CR <= 3.0 * partyLevel (very dangerous but possible)
 * - impossible: CR > 3.0 * partyLevel (party cannot win)
 */
export function compareCR(
  creatureCR: number,
  partyLevel: number
): CRComparison {
  const effectiveLevel = Math.max(partyLevel, 1);
  const ratio = creatureCR / effectiveLevel;

  if (ratio < 0.25) return 'trivial';
  if (ratio <= 1.5) return 'manageable';
  if (ratio <= 3.0) return 'deadly';
  return 'impossible';
}

/**
 * Determine if combat is winnable based on CR comparison.
 *
 * @param crComparison - The CR comparison result from compareCR()
 * @returns true if the party can win the combat
 *
 * Winnable conditions:
 * - trivial: false (no real combat, too weak → becomes trace/passing)
 * - manageable: true (fair fight)
 * - deadly: true (very dangerous but winnable)
 * - impossible: false (party cannot win → becomes passing/trace)
 *
 * @see docs/features/Encounter-Balancing.md#winnable-logik
 */
export function isWinnable(crComparison: CRComparison): boolean {
  return crComparison !== 'trivial' && crComparison !== 'impossible';
}

/**
 * Roll encounter difficulty based on D&D 5e distribution.
 *
 * Distribution:
 * - Easy: 12.5%
 * - Medium: 50%
 * - Hard: 25%
 * - Deadly: 12.5%
 */
export function rollDifficulty(): EncounterDifficulty {
  const roll = Math.random();
  if (roll < 0.125) return 'easy';
  if (roll < 0.625) return 'medium'; // 0.125 + 0.5
  if (roll < 0.875) return 'hard'; // 0.625 + 0.25
  return 'deadly';
}

/**
 * Get encounter type probability matrix.
 *
 * Combines three factors to determine encounter type probabilities:
 * 1. Creature disposition (hostile/neutral/friendly)
 * 2. Faction relation to party (hostile/neutral/friendly)
 * 3. Whether combat is winnable
 *
 * @see docs/features/Encounter-System.md#typ-ableitung
 * @see docs/features/Encounter-System.md#wahrscheinlichkeits-matrix
 */
export function getTypeProbabilities(
  disposition: 'hostile' | 'neutral' | 'friendly',
  factionRelation: FactionRelation,
  winnable: boolean
): TypeProbabilities {
  // Hostile creatures - behavior depends on faction relation and winnability
  if (disposition === 'hostile') {
    if (factionRelation === 'hostile') {
      // Hostile creature + hostile faction → most aggressive
      return winnable
        ? { combat: 0.80, social: 0.05, passing: 0.10, trace: 0.05 }  // Spec: hostile+hostile+yes
        : { combat: 0.05, social: 0.05, passing: 0.70, trace: 0.20 }; // Spec: hostile+hostile+no
    }
    // Hostile creature + neutral/friendly faction → less aggressive
    return winnable
      ? { combat: 0.60, social: 0.10, passing: 0.20, trace: 0.10 }  // Spec: hostile+neutral+yes
      : { combat: 0.05, social: 0.10, passing: 0.65, trace: 0.20 }; // Not in spec, interpolated
  }

  // Neutral creatures - faction relation doesn't change behavior much
  if (disposition === 'neutral') {
    return { combat: 0.10, social: 0.50, passing: 0.25, trace: 0.15 }; // Spec: neutral+any
  }

  // Friendly creatures - never initiate combat
  return { combat: 0.00, social: 0.70, passing: 0.20, trace: 0.10 }; // Spec: friendly+friendly
}

/**
 * Select encounter type based on probability matrix.
 */
export function selectTypeFromProbabilities(probs: TypeProbabilities): EncounterType {
  const roll = Math.random();
  let cumulative = 0;

  cumulative += probs.combat;
  if (roll < cumulative) return 'combat';

  cumulative += probs.social;
  if (roll < cumulative) return 'social';

  cumulative += probs.passing;
  if (roll < cumulative) return 'passing';

  return 'trace';
}

/**
 * Derive encounter type from creature disposition, faction relation, and CR comparison.
 *
 * Uses probability matrix based on three factors:
 * - Creature disposition (hostile/neutral/friendly)
 * - Faction relation to party (hostile/neutral/friendly)
 * - CR comparison result → winnable (yes/no)
 *
 * @param creature - The creature definition to derive type for
 * @param partyLevel - Average party level for CR comparison
 * @param factionRelation - Faction's relationship to the party (defaults to 'neutral')
 * @returns Type derivation result with selected type and reason
 *
 * @see docs/features/Encounter-System.md#typ-ableitung
 */
export function deriveEncounterType(
  creature: CreatureDefinition,
  partyLevel: number | undefined,
  factionRelation: FactionRelation = 'neutral'
): TypeDerivationResult {
  const { disposition, cr } = creature;
  const effectivePartyLevel = partyLevel ?? 1;

  // Step 1: Calculate CR comparison
  const crComparison = compareCR(cr, effectivePartyLevel);

  // Step 2: Determine if combat is winnable
  const winnable = isWinnable(crComparison);

  // Step 3: Get probability matrix using all 3 factors
  const probs = getTypeProbabilities(disposition, factionRelation, winnable);

  // Step 4: Select type from probabilities
  const type = selectTypeFromProbabilities(probs);

  // Build reason string with all factors
  const reason = `${disposition}_${factionRelation}_${winnable ? 'winnable' : 'unwinnable'}`;

  return { type, reason, crComparison };
}

/**
 * Derive encounter type with variety dampening.
 * Combines base type derivation with history-based probability adjustment.
 *
 * This function:
 * 1. Gets base probability matrix from creature disposition, faction relation, and CR comparison
 * 2. Applies exponential decay dampening based on recent encounter type history
 * 3. Selects final type from the dampened probability matrix
 *
 * @param creature - The creature definition to derive type for
 * @param partyLevel - Average party level for CR comparison
 * @param typeHistory - Recent encounter type history (newest first)
 * @param factionRelation - Faction's relationship to the party (defaults to 'neutral')
 * @returns Type derivation result with dampened selection
 *
 * @see docs/features/Encounter-System.md#variety-validation
 * @see docs/features/Encounter-System.md#typ-ableitung
 */
export function deriveEncounterTypeWithVariety(
  creature: CreatureDefinition,
  partyLevel: number | undefined,
  typeHistory: readonly EncounterHistoryEntry[],
  factionRelation: FactionRelation = 'neutral'
): TypeDerivationResult {
  const { disposition, cr } = creature;
  const effectivePartyLevel = partyLevel ?? 1;

  // Step 1: Calculate CR comparison
  const crComparison = compareCR(cr, effectivePartyLevel);

  // Step 2: Determine if combat is winnable
  const winnable = isWinnable(crComparison);

  // Step 3: Get base probability matrix using all 3 factors
  const baseProbs = getTypeProbabilities(disposition, factionRelation, winnable);

  // Step 4: Apply variety dampening
  const dampenedMatrix = calculateTypeWeights(typeHistory, {
    combat: baseProbs.combat,
    social: baseProbs.social,
    passing: baseProbs.passing,
    trace: baseProbs.trace,
  });

  // Step 5: Select from dampened matrix
  const type = selectTypeFromProbabilities({
    combat: dampenedMatrix.combat,
    social: dampenedMatrix.social,
    passing: dampenedMatrix.passing,
    trace: dampenedMatrix.trace,
  });

  // Include 'dampened' in reason to indicate variety adjustment was applied
  const reason = typeHistory.length > 0
    ? `${disposition}_${factionRelation}_${winnable ? 'winnable' : 'unwinnable'}_dampened`
    : `${disposition}_${factionRelation}_${winnable ? 'winnable' : 'unwinnable'}`;

  return { type, reason, crComparison };
}

// ============================================================================
// Step 4: Variety Validation (Type Dampening)
// ============================================================================

/**
 * Number of recent encounters to consider for variety dampening.
 * Only the last 10 are relevant for decay calculation.
 */
const VARIETY_WINDOW_SIZE = 10;

/**
 * Threshold above which type dampening kicks in.
 * If accumulated weight > 1.5, the type is overrepresented.
 */
const OVERREPRESENTATION_THRESHOLD = 1.5;

/**
 * Create a default type probability matrix with equal weights.
 */
export function createDefaultTypeMatrix(): TypeProbabilityMatrix {
  return {
    combat: 0.25,
    social: 0.25,
    passing: 0.25,
    trace: 0.25,
  };
}

/**
 * Normalize a probability matrix so all values sum to 1.0.
 */
export function normalizeMatrix(matrix: TypeProbabilityMatrix): TypeProbabilityMatrix {
  const total = Object.values(matrix).reduce((sum, val) => sum + val, 0);
  if (total <= 0) {
    return createDefaultTypeMatrix();
  }

  return {
    combat: matrix.combat / total,
    social: matrix.social / total,
    passing: matrix.passing / total,
    trace: matrix.trace / total,
  };
}

/**
 * Calculate type weights with exponential decay dampening.
 *
 * This function adjusts encounter type probabilities based on recent history
 * to prevent monotony. Overrepresented types are dampened, not filtered.
 *
 * Algorithm:
 * 1. Sum up type occurrences with exponential decay (1.0, 0.5, 0.25, 0.125...)
 * 2. If a type's accumulated weight > 1.5, apply dampening factor
 * 3. Dampening: probability *= 1 / (1 + overrepresentation - 1.5)
 *
 * @param history - Recent encounter type history (newest first)
 * @param baseMatrix - Base probability matrix to adjust
 * @returns Adjusted and normalized probability matrix
 *
 * @example
 * // After 3 combat encounters in a row:
 * // combat weight = 1.0 + 0.5 + 0.25 = 1.75
 * // overrepresentation = 1.75 > 1.5, so dampen
 * // combat probability *= 1 / (1 + 1.75 - 1.5) = 1/1.25 = 0.8
 *
 * @see docs/features/Encounter-System.md#variety-validation
 */
export function calculateTypeWeights(
  history: readonly EncounterHistoryEntry[],
  baseMatrix: TypeProbabilityMatrix
): TypeProbabilityMatrix {
  // Empty history = no adjustment needed
  if (history.length === 0) {
    return normalizeMatrix(baseMatrix);
  }

  // Accumulate type weights with exponential decay
  const typeAccumulator: Record<EncounterType, number> = {
    combat: 0,
    social: 0,
    passing: 0,
    trace: 0,
  };

  // Get last N entries (already sorted newest-first)
  const recentEntries = history.slice(0, VARIETY_WINDOW_SIZE);

  // Apply exponential decay: newest = 1.0, then 0.5, 0.25, 0.125...
  recentEntries.forEach((entry, index) => {
    const weight = Math.pow(0.5, index);
    typeAccumulator[entry.type] += weight;
  });

  // Adjust base matrix (dampen overrepresented types)
  const adjusted: TypeProbabilityMatrix = { ...baseMatrix };

  for (const type of Object.keys(adjusted) as EncounterType[]) {
    const overrepresentation = typeAccumulator[type];
    if (overrepresentation > OVERREPRESENTATION_THRESHOLD) {
      // Dampening factor: 1 / (1 + overrepresentation - threshold)
      const dampeningFactor = 1 / (1 + overrepresentation - OVERREPRESENTATION_THRESHOLD);
      adjusted[type] *= dampeningFactor;
    }
  }

  // Normalize to ensure probabilities sum to 1.0
  return normalizeMatrix(adjusted);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique encounter ID.
 */
export function generateEncounterId(): string {
  return `enc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate activity description based on creature and time.
 */
export function generateActivity(
  creature: CreatureDefinition,
  timeSegment: TimeSegment
): string {
  const activities: Record<string, string[]> = {
    dawn: ['waking up', 'starting to move', 'hunting', 'preparing'],
    morning: ['patrolling', 'hunting', 'foraging', 'traveling'],
    midday: ['resting', 'eating', 'guarding', 'watching'],
    afternoon: ['patrolling', 'hunting', 'traveling', 'searching'],
    dusk: ['returning', 'settling down', 'hunting', 'gathering'],
    night: ['sleeping', 'prowling', 'hunting', 'guarding'],
  };

  const options = activities[timeSegment] ?? ['moving about'];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate goal description based on creature disposition.
 */
export function generateGoal(creature: CreatureDefinition): string {
  const goals: Record<string, string[]> = {
    hostile: ['attack intruders', 'defend territory', 'hunt prey', 'raid'],
    neutral: ['survive', 'find food', 'protect young', 'rest'],
    friendly: ['trade', 'seek help', 'share news', 'offer assistance'],
  };

  const options = goals[creature.disposition] ?? ['survive'];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Default encounter description fallback.
 */
const DEFAULT_ENCOUNTER_DESCRIPTION =
  'You encounter something in your travels.';

/**
 * Generate encounter description based on type and creature.
 */
export function generateDescription(
  type: EncounterType,
  creature: CreatureDefinition,
  activity: string
): string {
  const templates: Record<EncounterType, string[]> = {
    combat: [
      `A ${creature.name} blocks your path, ready for battle.`,
      `You are ambushed by a ${creature.name}!`,
      `A hostile ${creature.name} emerges, ${activity}.`,
    ],
    social: [
      `You encounter a ${creature.name}, ${activity}.`,
      `A ${creature.name} approaches, ${activity}.`,
      `You come across a ${creature.name} who seems willing to talk.`,
    ],
    passing: [
      `In the distance, you spot a ${creature.name}, ${activity}.`,
      `A ${creature.name} passes nearby, ${activity}.`,
      `You notice a ${creature.name} in the area, but it doesn't notice you.`,
    ],
    trace: [
      `You find signs of a ${creature.name} - fresh tracks and markings.`,
      `Evidence of a ${creature.name} is scattered here - they were ${activity}.`,
      `The area shows signs of recent ${creature.name} activity.`,
    ],
  };

  const options = templates[type] ?? [DEFAULT_ENCOUNTER_DESCRIPTION];
  return options[Math.floor(Math.random() * options.length)];
}

// ============================================================================
// XP Budget Calculation
// ============================================================================

/**
 * DMG XP Thresholds per character level.
 * @see docs/features/Encounter-Balancing.md#dd-5e-xp-thresholds
 */
const XP_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1:  { easy: 25,   medium: 50,    hard: 75,    deadly: 100   },
  2:  { easy: 50,   medium: 100,   hard: 150,   deadly: 200   },
  3:  { easy: 75,   medium: 150,   hard: 225,   deadly: 400   },
  4:  { easy: 125,  medium: 250,   hard: 375,   deadly: 500   },
  5:  { easy: 250,  medium: 500,   hard: 750,   deadly: 1100  },
  6:  { easy: 300,  medium: 600,   hard: 900,   deadly: 1400  },
  7:  { easy: 350,  medium: 750,   hard: 1100,  deadly: 1700  },
  8:  { easy: 450,  medium: 900,   hard: 1400,  deadly: 2100  },
  9:  { easy: 550,  medium: 1100,  hard: 1600,  deadly: 2400  },
  10: { easy: 600,  medium: 1200,  hard: 1900,  deadly: 2800  },
  11: { easy: 800,  medium: 1600,  hard: 2400,  deadly: 3600  },
  12: { easy: 1000, medium: 2000,  hard: 3000,  deadly: 4500  },
  13: { easy: 1100, medium: 2200,  hard: 3400,  deadly: 5100  },
  14: { easy: 1250, medium: 2500,  hard: 3800,  deadly: 5700  },
  15: { easy: 1400, medium: 2800,  hard: 4300,  deadly: 6400  },
  16: { easy: 1600, medium: 3200,  hard: 4800,  deadly: 7200  },
  17: { easy: 2000, medium: 3900,  hard: 5900,  deadly: 8800  },
  18: { easy: 2100, medium: 4200,  hard: 6300,  deadly: 9500  },
  19: { easy: 2400, medium: 4900,  hard: 7300,  deadly: 10900 },
  20: { easy: 2800, medium: 5700,  hard: 8500,  deadly: 12700 },
};

/**
 * Calculate XP budget for an encounter based on party composition and difficulty.
 *
 * Uses DMG XP Thresholds table: sums individual character thresholds.
 *
 * @param partyMembers - Array of party members with their levels
 * @param difficulty - The encounter difficulty level
 * @returns Total XP budget for the encounter
 *
 * @example
 * // 4 level-5 characters, medium difficulty
 * calculateXPBudget([{level: 5}, {level: 5}, {level: 5}, {level: 5}], 'medium')
 * // Returns: 4 × 500 = 2000 XP (from DMG table)
 *
 * @see docs/features/Encounter-Balancing.md#party-thresholds
 */
export function calculateXPBudget(
  partyMembers: readonly { level: number }[],
  difficulty: EncounterDifficulty
): number {
  return partyMembers.reduce((sum, member) => {
    // Clamp level to 1-20, fallback to level 20 for higher
    const level = Math.max(1, Math.min(member.level, 20));
    const thresholds = XP_THRESHOLDS[level];
    return sum + thresholds[difficulty];
  }, 0);
}

/**
 * Calculate total XP for an encounter.
 * Uses calculateXP from @core/utils for individual creature XP.
 */
export function calculateEncounterXP(
  creatures: readonly CreatureDefinition[]
): number {
  return creatures.reduce((sum, creature) => {
    return sum + calculateXP(creature.cr);
  }, 0);
}

// ============================================================================
// Companion Selection (Multi-Creature Encounters)
// ============================================================================

/**
 * Budget tolerance factor for companion selection.
 * Allows slight overshoot to avoid leaving too much budget unused.
 */
const BUDGET_TOLERANCE = 1.1; // 10% tolerance

/**
 * Maximum companions to add (to prevent huge groups).
 */
const MAX_COMPANIONS = 7;

/**
 * Select companion creatures to fill an XP budget.
 *
 * Uses a greedy algorithm:
 * 1. Start with lead creature
 * 2. Filter eligible companions (CR <= lead CR)
 * 3. Repeatedly select random companion until budget exhausted
 *
 * @param lead - The lead creature for this encounter
 * @param budget - Total XP budget to fill
 * @param eligibleCreatures - Creatures that can be selected as companions
 * @returns Selected creatures with XP totals
 *
 * @see docs/features/Encounter-Balancing.md#companion-selection
 */
export function selectCompanions(
  lead: CreatureDefinition,
  budget: number,
  eligibleCreatures: readonly CreatureDefinition[]
): CompanionSelectionResult {
  const leadXP = calculateXP(lead.cr);
  const creatures: CreatureDefinition[] = [lead];
  let totalXP = leadXP;

  // All eligible creatures can be companions - budget logic handles selection
  const potentialCompanions = [...eligibleCreatures];

  // If no companions available or budget already exceeded, return just lead
  if (potentialCompanions.length === 0) {
    return {
      creatures,
      totalXP,
      effectiveXP: calculateEffectiveXP([{ xp: leadXP }]),
    };
  }

  // Greedy selection: add companions while budget allows
  let attempts = 0;
  const maxAttempts = potentialCompanions.length * 2; // Prevent infinite loop

  while (creatures.length <= MAX_COMPANIONS && attempts < maxAttempts) {
    attempts++;

    // Select a random companion (weighted selection would be better, but simple random for MVP)
    const randomIndex = Math.floor(Math.random() * potentialCompanions.length);
    const candidate = potentialCompanions[randomIndex];
    const candidateXP = calculateXP(candidate.cr);

    // Calculate what effective XP would be with this companion
    const newCreatures = [...creatures, candidate];
    const newTotalXP = totalXP + candidateXP;
    const newEffectiveXP = calculateEffectiveXP(
      newCreatures.map((c) => ({ xp: calculateXP(c.cr) }))
    );

    // Check if adding this companion would exceed budget tolerance
    if (newEffectiveXP > budget * BUDGET_TOLERANCE) {
      // Try smaller creatures first before giving up
      const smallerCompanions = potentialCompanions.filter(
        (c) => calculateXP(c.cr) < candidateXP
      );

      if (smallerCompanions.length === 0) {
        // No smaller companions available, we're done
        break;
      }
      // Continue loop to try again (will pick random, might get smaller)
      continue;
    }

    // Add the companion
    creatures.push(candidate);
    totalXP = newTotalXP;

    // If we're at or over budget, stop
    if (newEffectiveXP >= budget * 0.9) {
      break;
    }
  }

  const effectiveXP = calculateEffectiveXP(
    creatures.map((c) => ({ xp: calculateXP(c.cr) }))
  );

  return {
    creatures,
    totalXP,
    effectiveXP,
  };
}

// ============================================================================
// NEW: Trigger Checking
// ============================================================================

/**
 * Check if encounter triggers are satisfied.
 *
 * Triggers define conditions under which an encounter can occur:
 * - terrain: Current terrain must be in the list
 * - timeOfDay: Current time segment must be in the list
 * - partyLevelRange: Party level must be within range
 *
 * @param triggers - The encounter trigger configuration (undefined = always valid)
 * @param context - Current game context
 * @returns true if all triggers are satisfied (or no triggers defined)
 */
export function checkTriggers(
  triggers: EncounterTriggers | undefined,
  context: { terrainId: string; timeSegment: TimeSegment; partyLevel?: number }
): boolean {
  // No triggers = always valid
  if (!triggers) return true;

  // Terrain check (cast to string for comparison since EntityId is branded string)
  if (triggers.terrain && triggers.terrain.length > 0) {
    const terrainStrings = triggers.terrain.map((t) => String(t));
    if (!terrainStrings.includes(context.terrainId)) return false;
  }

  // Time of day check
  if (triggers.timeOfDay && triggers.timeOfDay.length > 0) {
    if (!triggers.timeOfDay.includes(context.timeSegment)) return false;
  }

  // Party level range check
  if (triggers.partyLevelRange && context.partyLevel !== undefined) {
    const { min, max } = triggers.partyLevelRange;
    if (min !== undefined && context.partyLevel < min) return false;
    if (max !== undefined && context.partyLevel > max) return false;
  }

  return true;
}

// ============================================================================
// NEW: CreatureSlot Resolution
// ============================================================================

/**
 * Generate a random integer in range [min, max] (inclusive).
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Filter creatures by BudgetCreatureSlot constraints.
 */
function filterByConstraints(
  creatures: readonly CreatureDefinition[],
  constraints?: {
    factionId?: string;
    creatureTypes?: string[];
    crRange?: { min?: number; max?: number };
    tags?: string[];
  }
): CreatureDefinition[] {
  if (!constraints) return [...creatures];

  return creatures.filter((c) => {
    // Faction filter
    if (constraints.factionId && c.defaultFactionId !== constraints.factionId) {
      return false;
    }

    // Creature type filter (checks against creature tags)
    if (
      constraints.creatureTypes &&
      constraints.creatureTypes.length > 0
    ) {
      const creatureTags = c.tags ?? [];
      const hasMatchingType = constraints.creatureTypes.some((type) =>
        creatureTags.includes(type)
      );
      if (!hasMatchingType) {
        return false;
      }
    }

    // CR range filter
    if (constraints.crRange) {
      if (constraints.crRange.min !== undefined && c.cr < constraints.crRange.min) {
        return false;
      }
      if (constraints.crRange.max !== undefined && c.cr > constraints.crRange.max) {
        return false;
      }
    }

    // Tags filter (creature must have ALL specified tags)
    if (constraints.tags && constraints.tags.length > 0) {
      const creatureTags = c.tags ?? [];
      if (!constraints.tags.every((tag) => creatureTags.includes(tag))) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Resolve CreatureSlots to concrete CreatureDefinitions.
 *
 * Handles all three slot types:
 * - concrete: Finds specific creature by ID, repeats count times
 * - typed: Finds creature type, determines random count from range
 * - budget: Fills XP budget using selectCompanions algorithm
 *
 * @param slots - The creature slots to resolve
 * @param allCreatures - Available creatures to select from
 * @param _context - Optional context (partyLevel, xpBudget) - currently unused but reserved
 * @returns Array of resolved creature definitions
 */
export function resolveCreatureSlots(
  slots: readonly CreatureSlot[],
  allCreatures: readonly CreatureDefinition[],
  _context?: { partyLevel?: number; xpBudget?: number }
): CreatureDefinition[] {
  const result: CreatureDefinition[] = [];

  for (const slot of slots) {
    switch (slot.slotType) {
      case 'concrete': {
        // Find specific creature by ID
        const creature = allCreatures.find((c) => c.id === slot.creatureId);
        if (creature) {
          for (let i = 0; i < slot.count; i++) {
            result.push(creature);
          }
        }
        break;
      }
      case 'typed': {
        // Find creature type, determine count
        const creature = allCreatures.find((c) => c.id === slot.creatureId);
        if (creature) {
          const count =
            typeof slot.count === 'number'
              ? slot.count
              : randomInRange(slot.count.min, slot.count.max);
          for (let i = 0; i < count; i++) {
            result.push(creature);
          }
        }
        break;
      }
      case 'budget': {
        // Fill XP budget using selectCompanions algorithm
        const filtered = filterByConstraints(allCreatures, slot.constraints);
        if (filtered.length > 0) {
          // Pick a random lead creature
          const lead = filtered[Math.floor(Math.random() * filtered.length)];
          const companions = selectCompanions(lead, slot.xpBudget, filtered);
          result.push(...companions.creatures);
        }
        break;
      }
    }
  }

  return result;
}

// ============================================================================
// Multi-Sense Detection System (Task #2951)
// ============================================================================

/**
 * Detection method - how the party detects an encounter.
 * @see docs/features/Encounter-System.md#multi-sense-detection
 */
export type DetectionMethod =
  | 'visual'
  | 'auditory'
  | 'olfactory'
  | 'tremorsense'
  | 'magical';

/**
 * Result of detection calculation.
 */
export interface DetectionResult {
  /** How the encounter was detected */
  method: DetectionMethod;
  /** Detection range in feet */
  range: number;
}

/**
 * Minimal terrain interface for detection calculations.
 * Full TerrainDefinition may have more fields.
 */
export interface TerrainForDetection {
  /** Base visual encounter visibility in feet */
  encounterVisibility: number;
}

/**
 * Minimal weather interface for detection calculations.
 * Full WeatherState may have more fields.
 */
export interface WeatherForDetection {
  /** Visibility modifier (0.1 to 1.0) */
  visibilityModifier: number;
  /** Precipitation percentage (0-100) */
  precipitation: number;
  /** Wind strength (0-100) */
  windStrength: number;
  /** Cloud cover (0 to 1) */
  cloudCover: number;
  /** Moon phase for night visibility */
  moonPhase?: 'new' | 'crescent' | 'half' | 'gibbous' | 'full';
}

/**
 * Audio range lookup table.
 * @see docs/features/Encounter-System.md#audio-range-tabelle
 */
const AUDIO_RANGE: Record<NoiseLevel, { base: number; reduced: number }> = {
  silent: { base: 0, reduced: 0 },
  quiet: { base: 30, reduced: 15 },
  normal: { base: 60, reduced: 30 },
  loud: { base: 200, reduced: 100 },
  deafening: { base: 500, reduced: 250 },
};

/**
 * Scent range lookup table.
 * @see docs/features/Encounter-System.md#scent-range-tabelle
 */
const SCENT_RANGE: Record<ScentStrength, { base: number; reduced: number }> = {
  none: { base: 0, reduced: 0 },
  faint: { base: 30, reduced: 0 },
  moderate: { base: 60, reduced: 30 },
  strong: { base: 150, reduced: 75 },
  overwhelming: { base: 300, reduced: 150 },
};

/**
 * Base daylight visibility modifiers by time segment.
 * @see docs/features/Encounter-System.md#dynamischer-time-modifier
 */
const BASE_DAYLIGHT: Record<TimeSegment, number> = {
  dawn: 0.6,
  morning: 1.0,
  midday: 1.0,
  afternoon: 1.0,
  dusk: 0.6,
  night: 0.1,
};

/**
 * Moonlight bonus by moon phase.
 */
const MOONLIGHT_BONUS: Record<
  NonNullable<WeatherForDetection['moonPhase']>,
  number
> = {
  new: 0,
  crescent: 0.05,
  half: 0.15,
  gibbous: 0.2,
  full: 0.3,
};

/**
 * Calculate time-based visibility modifier.
 * Weather-dependent - moonlight and cloud cover affect night visibility.
 *
 * @param timeSegment - Current time of day
 * @param weather - Current weather state
 * @returns Visibility modifier (0.0 to 1.0)
 *
 * @see docs/features/Encounter-System.md#dynamischer-time-modifier
 */
export function getTimeVisibilityModifier(
  timeSegment: TimeSegment,
  weather: WeatherForDetection
): number {
  const baseDaylight = BASE_DAYLIGHT[timeSegment];
  const moonlight =
    weather.moonPhase !== undefined ? MOONLIGHT_BONUS[weather.moonPhase] : 0;
  const cloudCover = weather.cloudCover;

  // Night: Base + moonlight × (1 - cloudCover)
  if (timeSegment === 'night') {
    return baseDaylight + moonlight * (1 - cloudCover);
  }

  // Daytime (morning, midday, afternoon): Clouds reduce visibility by max 30%
  if (
    timeSegment === 'morning' ||
    timeSegment === 'midday' ||
    timeSegment === 'afternoon'
  ) {
    return baseDaylight * (1 - cloudCover * 0.3);
  }

  // Dawn/Dusk: Combination of both effects
  return baseDaylight * (1 - cloudCover * 0.2) + moonlight * 0.5;
}

/**
 * Calculate visual detection range.
 *
 * @param terrain - Terrain with encounterVisibility
 * @param weather - Current weather state
 * @param timeSegment - Current time of day
 * @returns Visual range in feet
 *
 * @see docs/features/Encounter-System.md#visuelle-range
 */
export function calculateVisualRange(
  terrain: TerrainForDetection,
  weather: WeatherForDetection,
  timeSegment: TimeSegment
): number {
  const terrainBase = terrain.encounterVisibility;
  const weatherModifier = weather.visibilityModifier;
  const timeModifier = getTimeVisibilityModifier(timeSegment, weather);

  return Math.floor(terrainBase * weatherModifier * timeModifier);
}

/**
 * Calculate audio detection range based on creature noise level.
 *
 * @param noiseLevel - Creature's noise level
 * @param weather - Current weather state
 * @returns Audio range in feet
 *
 * @see docs/features/Encounter-System.md#audio-range-tabelle
 */
export function calculateAudioRange(
  noiseLevel: NoiseLevel,
  weather: WeatherForDetection
): number {
  const ranges = AUDIO_RANGE[noiseLevel];

  // Wind or rain reduces audio range (normalized 0-1 values)
  const hasWindOrRain = weather.windStrength > 0.5 || weather.precipitation > 0.3;

  return hasWindOrRain ? ranges.reduced : ranges.base;
}

/**
 * Calculate scent detection range based on creature scent strength.
 *
 * @param scentStrength - Creature's scent strength
 * @param weather - Current weather state
 * @returns Scent range in feet
 *
 * @see docs/features/Encounter-System.md#scent-range-tabelle
 */
export function calculateScentRange(
  scentStrength: ScentStrength,
  weather: WeatherForDetection
): number {
  const ranges = SCENT_RANGE[scentStrength];

  // Strong wind or rain reduces scent range (normalized 0-1 values)
  const hasWindOrRain = weather.windStrength > 0.5 || weather.precipitation > 0.3;

  return hasWindOrRain ? ranges.reduced : ranges.base;
}

/**
 * Apply stealth ability effects to detection ranges.
 *
 * @param visualRange - Base visual range
 * @param audioRange - Base audio range
 * @param scentRange - Base scent range
 * @param stealthAbilities - Creature's stealth abilities
 * @returns Adjusted ranges
 *
 * @see docs/features/Encounter-System.md#stealth-ability-effekte
 */
export function applyStealthAbilities(
  visualRange: number,
  audioRange: number,
  scentRange: number,
  stealthAbilities: StealthAbility[] | undefined
): { visual: number; audio: number; scent: number } {
  if (!stealthAbilities || stealthAbilities.length === 0) {
    return { visual: visualRange, audio: audioRange, scent: scentRange };
  }

  let visual = visualRange;
  let audio = audioRange;
  let scent = scentRange;

  for (const ability of stealthAbilities) {
    switch (ability) {
      case 'burrowing':
        // Can travel underground - visual: 0ft, audio: normal
        visual = 0;
        break;

      case 'invisibility':
        // Can become invisible - visual: 0ft
        visual = 0;
        break;

      case 'ethereal':
        // On another plane - all senses: 0ft
        visual = 0;
        audio = 0;
        scent = 0;
        break;

      case 'shapechange':
        // Can assume harmless form - no auto-detection change
        // Detection still possible but creature appears harmless
        break;

      case 'mimicry':
        // Can imitate sounds - audio detection may mislead
        // Detection range unchanged, but type may be misleading
        break;

      case 'ambusher':
        // Has ambush behavior - triggers ambush check (handled separately)
        // Detection range unchanged
        break;
    }
  }

  return { visual, audio, scent };
}

/**
 * Calculate how an encounter is detected and at what range.
 * Considers visual, auditory, and olfactory senses.
 * Returns the best (longest range) detection method.
 *
 * @param creatureOrProfile - Creature definition or detection profile directly
 * @param terrain - Terrain with encounterVisibility
 * @param weather - Current weather state
 * @param timeSegment - Current time of day
 * @returns Detection method and range
 *
 * @see docs/features/Encounter-System.md#calculatedetection
 */
export function calculateDetection(
  creatureOrProfile: CreatureDefinition | CreatureDetectionProfile,
  terrain: TerrainForDetection,
  weather: WeatherForDetection,
  timeSegment: TimeSegment
): DetectionResult {
  // Get detection profile - either directly passed or from creature
  const profile: CreatureDetectionProfile =
    'noiseLevel' in creatureOrProfile
      ? creatureOrProfile
      : (creatureOrProfile.detectionProfile ?? DEFAULT_DETECTION_PROFILE);

  // 1. Calculate base ranges for each sense
  const baseVisual = calculateVisualRange(terrain, weather, timeSegment);
  const baseAudio = calculateAudioRange(profile.noiseLevel, weather);
  const baseScent = calculateScentRange(profile.scentStrength, weather);

  // 2. Apply stealth abilities
  const adjusted = applyStealthAbilities(
    baseVisual,
    baseAudio,
    baseScent,
    profile.stealthAbilities
  );

  // 3. Find best detection method (longest range)
  let bestMethod: DetectionMethod = 'visual';
  let bestRange = adjusted.visual;

  if (adjusted.audio > bestRange) {
    bestRange = adjusted.audio;
    bestMethod = 'auditory';
  }

  if (adjusted.scent > bestRange) {
    bestRange = adjusted.scent;
    bestMethod = 'olfactory';
  }

  return { method: bestMethod, range: bestRange };
}

/**
 * Calculate initial encounter distance based on detection range and encounter type.
 *
 * @param detectionRange - Detection range in feet
 * @param encounterType - Type of encounter
 * @returns Initial distance in feet
 *
 * @see docs/features/Encounter-System.md#distanz-nach-encounter-typ
 */
export function calculateInitialDistance(
  detectionRange: number,
  encounterType: EncounterType
): number {
  switch (encounterType) {
    case 'combat':
      // 30-80% of detection range
      return Math.floor(detectionRange * (0.3 + Math.random() * 0.5));

    case 'social':
      // 50-100% of detection range
      return Math.floor(detectionRange * (0.5 + Math.random() * 0.5));

    case 'passing':
      // 70-100% of detection range (observed from afar)
      return Math.floor(detectionRange * (0.7 + Math.random() * 0.3));

    case 'trace':
      // Party stumbles upon traces - fixed range
      return Math.floor(10 + Math.random() * 20); // 10-30 feet

    default:
      return detectionRange;
  }
}

// ============================================================================
// Activity-Pool-Hierarchy (Task #2969)
// ============================================================================

/**
 * Generic activities available to all creatures.
 * Lowest priority in the Activity-Pool-Hierarchy.
 *
 * @see docs/features/Encounter-System.md#activity-pool-hierarchie
 */
export const GENERIC_ACTIVITIES: readonly WeightedActivity[] = [
  { activity: 'resting', weight: 1.0, contextTags: [] },
  { activity: 'traveling', weight: 1.0, contextTags: [] },
  { activity: 'foraging', weight: 0.8, contextTags: ['daylight'] },
  { activity: 'patrolling', weight: 0.8, contextTags: [] },
  { activity: 'hunting', weight: 0.6, contextTags: [] },
  { activity: 'guarding', weight: 0.7, contextTags: [] },
  { activity: 'prowling', weight: 0.5, contextTags: ['nocturnal'] },
  { activity: 'sleeping', weight: 0.4, contextTags: ['nocturnal'] },
];

/**
 * Context for activity filtering.
 */
export interface ActivityContext {
  /** Current time of day */
  timeSegment: TimeSegment;

  /** Current terrain (for terrain-specific activities) */
  terrainId: string;

  /** Current weather (for weather-specific activities) */
  weather: WeatherState | null;
}

/**
 * Personality-based activity weight modifiers.
 * Maps activity names to multipliers.
 */
export type PersonalityActivityModifiers = Readonly<Record<string, number>>;

/**
 * Check if an activity's context tags match the current context.
 *
 * @param contextTags - Tags from the activity (e.g., ["nocturnal", "aquatic"])
 * @param context - Current encounter context
 * @returns true if activity is available in this context
 *
 * @see docs/features/Encounter-System.md#activity-generierung-gruppen-basiert
 */
export function matchesActivityContext(
  contextTags: readonly string[] | undefined,
  context: ActivityContext
): boolean {
  // No tags = always available
  if (!contextTags || contextTags.length === 0) return true;

  // All tags must match
  return contextTags.every((tag) => {
    switch (tag) {
      case 'nocturnal':
        return context.timeSegment === 'night';

      case 'daylight':
        return ['morning', 'midday', 'afternoon'].includes(context.timeSegment);

      case 'dawn':
        return context.timeSegment === 'dawn';

      case 'dusk':
        return context.timeSegment === 'dusk';

      case 'storm':
        // Available during heavy precipitation
        return context.weather !== null && context.weather.params.precipitation > 70;

      case 'calm':
        // Available during low wind
        return context.weather === null || context.weather.params.wind < 30;

      // Terrain-specific tags could be added here
      // case 'aquatic': return context.terrainId === 'water';

      default:
        // Unknown tags are ignored (permissive)
        return true;
    }
  });
}

/**
 * Collect activities from creature definitions.
 * Filters out duplicates by activity name (later definitions override earlier).
 *
 * @param creatures - Creatures in the encounter group
 * @returns Combined activity pool from all creatures
 */
export function getCreatureTypeActivities(
  creatures: readonly CreatureDefinition[]
): WeightedActivity[] {
  const activitiesMap = new Map<string, WeightedActivity>();

  for (const creature of creatures) {
    if (creature.activities) {
      for (const activity of creature.activities) {
        activitiesMap.set(activity.activity, activity);
      }
    }
  }

  return Array.from(activitiesMap.values());
}

/**
 * Apply personality-based weight modifiers to activities.
 *
 * @param activities - Base activity pool
 * @param personality - Optional personality modifiers (activity name → multiplier)
 * @returns Activities with adjusted weights
 *
 * @example
 * // Paranoid personality favors guarding, dislikes resting
 * applyPersonalityWeights(activities, { guarding: 2.0, resting: 0.5 })
 */
function applyPersonalityWeights(
  activities: readonly WeightedActivity[],
  personality: PersonalityActivityModifiers | undefined
): WeightedActivity[] {
  if (!personality) return [...activities];

  return activities.map((a) => {
    const modifier = personality[a.activity] ?? 1.0;
    return { ...a, weight: a.weight * modifier };
  });
}

/**
 * Select a random activity from a weighted pool.
 *
 * @param activities - Weighted activity pool
 * @returns Selected activity name
 */
function weightedRandomActivity(activities: readonly WeightedActivity[]): string {
  const totalWeight = activities.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight <= 0) {
    // Fallback to first activity if weights are invalid
    return activities[0]?.activity ?? 'resting';
  }

  let random = Math.random() * totalWeight;

  for (const activity of activities) {
    random -= activity.weight;
    if (random <= 0) return activity.activity;
  }

  // Fallback to last activity (rounding edge case)
  return activities[activities.length - 1].activity;
}

/**
 * Select an activity for an encounter group using the Activity-Pool-Hierarchy.
 *
 * Hierarchy (lowest to highest priority):
 * 1. Generic activities (GENERIC_ACTIVITIES)
 * 2. Creature-type activities (from CreatureDefinition.activities)
 * 3. Faction activities (from ResolvedCulture.activities)
 *
 * Higher-priority activities add to the pool, increasing their selection probability.
 *
 * @param creatures - Creatures in the encounter group
 * @param context - Current encounter context (time, terrain, weather)
 * @param factionCulture - Optional resolved faction culture
 * @param leadNPCPersonality - Optional personality modifiers from lead NPC
 * @returns Selected activity string
 *
 * @see docs/features/Encounter-System.md#activity-generierung-gruppen-basiert
 * @see docs/features/Encounter-System.md#activity-pool-hierarchie
 */
export function selectActivity(
  creatures: readonly CreatureDefinition[],
  context: ActivityContext,
  factionCulture?: ResolvedCulture,
  leadNPCPersonality?: PersonalityActivityModifiers
): string {
  // 1. Assemble pool from all three levels (Hierarchie)
  const pool: WeightedActivity[] = [
    ...GENERIC_ACTIVITIES,
    ...getCreatureTypeActivities(creatures),
    ...(factionCulture?.activities ?? []),
  ];

  // 2. Filter by context
  const filtered = pool.filter((a) =>
    matchesActivityContext(a.contextTags, context)
  );

  // 3. Fallback if nothing matches
  if (filtered.length === 0) {
    return GENERIC_ACTIVITIES[0].activity; // "resting"
  }

  // 4. Apply personality weighting
  const weighted = applyPersonalityWeights(filtered, leadNPCPersonality);

  // 5. Weighted random selection
  return weightedRandomActivity(weighted);
}
