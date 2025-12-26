/**
 * Encounter Pipeline Step 6: Adjustments
 *
 * Adjusts encounter to match target difficulty through environmental
 * and situational modifications.
 *
 * Spec: docs/features/encounter/Adjustments.md
 *
 * Deliverables:
 * - rollTargetDifficulty(): Terrain-Threat based normal distribution
 * - getTargetWinProbability(): Difficulty → Win% mapping
 * - collectAdjustmentOptions(): Gather available options
 * - adjustForFeasibility(): Iterative best-option algorithm
 */

import type {
  AdjustmentOption,
  BalancedEncounter,
  BalanceInfo,
  DifficultyLevel,
  DifficultyResult,
  EncounterContext,
  FlavouredEncounter,
  FlavouredGroup,
} from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';
import {
  calculateDifficulty,
  estimateWinProbability,
  estimateTPKRisk,
  getGroupMultiplier,
  calculatePartyThresholds,
} from './difficulty.js';

// =============================================================================
// Types
// =============================================================================

export type AdjustmentResult =
  | { success: true; encounter: BalancedEncounter }
  | { success: false; error: string };

// =============================================================================
// Constants
// =============================================================================

/**
 * Target win probability for each difficulty level.
 * These are the midpoints of the ranges.
 * Spec: Adjustments.md lines 144-152
 */
const TARGET_WIN_PROBABILITY: Record<DifficultyLevel, number> = {
  trivial: 0.97, // >95%
  easy: 0.90,    // 85-95%
  moderate: 0.77, // 70-85%
  hard: 0.60,    // 50-70%
  deadly: 0.40,  // <50%
};

/**
 * Distance deltas to test for distance adjustments.
 * Positive = further away, negative = closer.
 */
const DISTANCE_DELTAS = [-100, -50, -20, +20, +50, +100];

/**
 * Disposition values to test within valid range.
 * -100 = hostile, 0 = neutral, +100 = friendly
 */
const DISPOSITION_TEST_VALUES = [-80, -50, -20, 0, +20, +50];

/**
 * Maximum iterations for adjustment algorithm.
 */
const MAX_ITERATIONS = 10;

// =============================================================================
// Step 6.0: Roll Target Difficulty
// =============================================================================

/**
 * Rolls target difficulty based on terrain threat level and range.
 * Uses weighted normal distribution centered on threatLevel.
 * Spec: Adjustments.md lines 27-45
 */
export function rollTargetDifficulty(context: EncounterContext): DifficultyLevel {
  const difficulties: DifficultyLevel[] = ['trivial', 'easy', 'moderate', 'hard', 'deadly'];

  const threatLevel = context.terrain.threatLevel ?? 0;
  const threatRange = context.terrain.threatRange ?? 1.0;

  // Normal distribution: μ = 2 (moderate) + threatLevel * 0.5
  const mean = 2 + threatLevel * 0.5;
  const std = Math.max(0.1, threatRange); // Prevent division by zero

  // Calculate weights for each difficulty
  const weights = difficulties.map((_, i) =>
    Math.exp(-0.5 * Math.pow((i - mean) / std, 2))
  );

  // Normalize weights
  const sum = weights.reduce((a, b) => a + b, 0);
  const normalized = weights.map((w) => w / sum);

  // Weighted random selection
  const random = Math.random();
  let cumulative = 0;
  for (let i = 0; i < difficulties.length; i++) {
    cumulative += normalized[i];
    if (random <= cumulative) {
      return difficulties[i];
    }
  }

  return 'moderate'; // Fallback
}

/**
 * Gets the target win probability for a difficulty level.
 * Spec: Adjustments.md lines 144-152
 */
export function getTargetWinProbability(difficulty: DifficultyLevel): number {
  return TARGET_WIN_PROBABILITY[difficulty];
}

// =============================================================================
// Simulation Helpers
// =============================================================================

/**
 * Simulates an encounter and returns difficulty result.
 * Wraps calculateDifficulty for adjustment option evaluation.
 */
function simulateEncounter(
  encounter: FlavouredEncounter,
  lookups: PresetLookups
): DifficultyResult | null {
  const result = calculateDifficulty(encounter, lookups);
  if (!result.success) return null;
  return result.result;
}

/**
 * Creates a modified copy of the encounter with distance changed.
 */
function withDistance(
  encounter: FlavouredEncounter,
  distance: number
): FlavouredEncounter {
  return {
    ...encounter,
    encounterDistance: Math.max(0, distance),
  };
}

/**
 * Creates a modified copy of the encounter with group disposition changed.
 * Note: For prototype, disposition affects win probability heuristically.
 */
function withGroupDisposition(
  encounter: FlavouredEncounter,
  groupId: string,
  disposition: number
): FlavouredEncounter {
  return {
    ...encounter,
    groups: encounter.groups.map((g) =>
      g.id === groupId
        ? { ...g, disposition } as FlavouredGroup & { disposition: number }
        : g
    ),
  };
}

/**
 * Creates a modified copy with a feature applied.
 */
function withFeature(
  encounter: FlavouredEncounter,
  featureId: string
): FlavouredEncounter {
  const feature = encounter.context.features.find((f) => f.id === featureId);
  if (!feature) return encounter;

  // Add feature to active features (if not already present)
  const activeFeatures = encounter.context.features.filter((f) => f.id !== featureId);
  return {
    ...encounter,
    context: {
      ...encounter.context,
      features: [...activeFeatures, feature],
    },
  };
}

// =============================================================================
// Adjustment Options Collection
// =============================================================================

/**
 * Collects all available adjustment options with their simulated effects.
 * Spec: Adjustments.md lines 581-693
 *
 * For prototype, we implement:
 * - Distance adjustments
 * - Disposition adjustments
 * - Environment (feature) adjustments
 *
 * Multi-group and creature-slot adjustments are in separate tasks.
 */
export function collectAdjustmentOptions(
  encounter: FlavouredEncounter,
  currentResult: DifficultyResult,
  targetWinProb: number,
  lookups: PresetLookups
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];

  // 1. Distance options
  const baseDistance = encounter.encounterDistance;
  for (const delta of DISTANCE_DELTAS) {
    const testDistance = Math.max(0, baseDistance + delta);
    if (testDistance === baseDistance) continue;

    const modified = withDistance(encounter, testDistance);
    const simResult = simulateEncounter(modified, lookups);
    if (!simResult) continue;

    options.push({
      type: 'distance',
      description: `Adjust distance by ${delta > 0 ? '+' : ''}${delta}ft (${testDistance}ft)`,
      resultingWinProbability: simResult.partyWinProbability,
      resultingTPKRisk: simResult.tpkRisk,
      resultingDifficulty: simResult.difficulty,
      distanceToTarget: Math.abs(simResult.partyWinProbability - targetWinProb),
    });
  }

  // 2. Disposition options (per group)
  // In prototype, disposition adjusts win probability heuristically
  for (const group of encounter.groups) {
    for (const testDisp of DISPOSITION_TEST_VALUES) {
      const modified = withGroupDisposition(encounter, group.id, testDisp);

      // Heuristic: Disposition affects win probability
      // Higher disposition = less likely to fight = higher effective win%
      const dispModifier = testDisp / 200; // -0.5 to +0.5
      const adjustedWinProb = Math.max(0, Math.min(1, currentResult.partyWinProbability + dispModifier));
      const adjustedTPK = Math.max(0, Math.min(1, currentResult.tpkRisk - dispModifier * 0.5));

      // Classify adjusted result
      const adjustedDifficulty = classifyByWinProbability(adjustedWinProb);

      options.push({
        type: 'disposition',
        description: `Set ${group.id} disposition to ${testDisp}`,
        groupId: group.id,
        resultingWinProbability: adjustedWinProb,
        resultingTPKRisk: adjustedTPK,
        resultingDifficulty: adjustedDifficulty,
        distanceToTarget: Math.abs(adjustedWinProb - targetWinProb),
      });
    }
  }

  // 3. Environment options (terrain features)
  // Only include features not already active
  const activeFeatureIds = new Set(encounter.context.features.map((f) => f.id));
  const terrain = lookups.terrains.get(encounter.context.terrain.id);

  if (terrain) {
    // For prototype, we use features from context
    // In full implementation, terrain.features would contain available features
    for (const feature of encounter.context.features) {
      if (activeFeatureIds.has(feature.id)) continue;

      const modified = withFeature(encounter, feature.id);
      const simResult = simulateEncounter(modified, lookups);
      if (!simResult) continue;

      options.push({
        type: 'environment',
        description: `Add feature: ${feature.name}`,
        resultingWinProbability: simResult.partyWinProbability,
        resultingTPKRisk: simResult.tpkRisk,
        resultingDifficulty: simResult.difficulty,
        distanceToTarget: Math.abs(simResult.partyWinProbability - targetWinProb),
      });
    }
  }

  // 4. Activity options
  // Activity affects awareness/detectability which influences surprise
  // For prototype, we generate synthetic options based on activity impact
  const activityOptions = generateActivityOptions(encounter, currentResult, targetWinProb);
  options.push(...activityOptions);

  return options;
}

/**
 * Generates activity-based adjustment options.
 * Activity affects surprise probability and initial positioning.
 */
function generateActivityOptions(
  encounter: FlavouredEncounter,
  currentResult: DifficultyResult,
  targetWinProb: number
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];

  // Predefined activity effects (simplified for prototype)
  const activityEffects: Array<{ id: string; name: string; winModifier: number; tpkModifier: number }> = [
    { id: 'sleeping', name: 'Sleeping', winModifier: +0.20, tpkModifier: -0.15 },
    { id: 'distracted', name: 'Distracted', winModifier: +0.10, tpkModifier: -0.08 },
    { id: 'alert', name: 'Alert', winModifier: -0.10, tpkModifier: +0.05 },
    { id: 'ambushing', name: 'Ambushing', winModifier: -0.15, tpkModifier: +0.10 },
  ];

  for (const effect of activityEffects) {
    const adjustedWinProb = Math.max(0, Math.min(1, currentResult.partyWinProbability + effect.winModifier));
    const adjustedTPK = Math.max(0, Math.min(1, currentResult.tpkRisk + effect.tpkModifier));
    const adjustedDifficulty = classifyByWinProbability(adjustedWinProb);

    options.push({
      type: 'activity',
      description: `Change activity to ${effect.name}`,
      resultingWinProbability: adjustedWinProb,
      resultingTPKRisk: adjustedTPK,
      resultingDifficulty: adjustedDifficulty,
      distanceToTarget: Math.abs(adjustedWinProb - targetWinProb),
    });
  }

  return options;
}

/**
 * Classifies difficulty based on win probability.
 */
function classifyByWinProbability(winProb: number): DifficultyLevel {
  if (winProb >= 0.95) return 'trivial';
  if (winProb >= 0.85) return 'easy';
  if (winProb >= 0.70) return 'moderate';
  if (winProb >= 0.50) return 'hard';
  return 'deadly';
}

// =============================================================================
// Step 6.1: Feasibility Adjustment Algorithm
// =============================================================================

/**
 * Adjusts encounter to match target difficulty using best-option algorithm.
 * Spec: Adjustments.md lines 66-139
 */
export function adjustForFeasibility(
  encounter: FlavouredEncounter,
  currentResult: DifficultyResult,
  targetDifficulty: DifficultyLevel,
  lookups: PresetLookups
): BalancedEncounter {
  const targetWinProb = getTargetWinProbability(targetDifficulty);

  let working = { ...encounter };
  let result = currentResult;
  let iterations = 0;
  const appliedAdjustments: string[] = [];

  while (result.difficulty !== targetDifficulty && iterations < MAX_ITERATIONS) {
    const options = collectAdjustmentOptions(working, result, targetWinProb, lookups);

    if (options.length === 0) break;

    // Find best option: smallest distance to target
    const bestOption = options.reduce((best, opt) =>
      opt.distanceToTarget < best.distanceToTarget ? opt : best
    );

    // Check if this option improves our situation
    const currentDistance = Math.abs(result.partyWinProbability - targetWinProb);
    if (bestOption.distanceToTarget >= currentDistance) {
      // No improvement possible, stop
      break;
    }

    // Apply option (update working copy)
    working = applyOption(working, bestOption);
    appliedAdjustments.push(bestOption.description);

    // Update result with option's pre-calculated values
    result = {
      difficulty: bestOption.resultingDifficulty,
      partyWinProbability: bestOption.resultingWinProbability,
      tpkRisk: bestOption.resultingTPKRisk,
      xpReward: result.xpReward, // XP doesn't change from adjustments
      simulationMethod: result.simulationMethod,
    };

    iterations++;
  }

  // Calculate combat probability from group dispositions
  const combatProbability = calculateCombatProbability(working);

  // Calculate adjusted XP
  const creatureCount = working.groups.reduce(
    (sum, g) => sum + g.creatures.length,
    0
  );
  const multiplier = getGroupMultiplier(creatureCount);
  const adjustedXP = Math.floor(result.xpReward * multiplier);

  const balance: BalanceInfo = {
    targetDifficulty,
    actualDifficulty: result.difficulty,
    partyWinProbability: result.partyWinProbability,
    tpkRisk: result.tpkRisk,
    combatProbability,
    xpReward: result.xpReward,
    adjustedXP,
    adjustmentsMade: iterations,
  };

  return {
    ...working,
    balance,
    difficulty: result,
  };
}

/**
 * Applies an adjustment option to the encounter.
 */
function applyOption(
  encounter: FlavouredEncounter,
  option: AdjustmentOption
): FlavouredEncounter {
  switch (option.type) {
    case 'distance': {
      // Extract distance from description (e.g., "... (60ft)")
      const match = option.description.match(/\((\d+)ft\)/);
      if (match) {
        return withDistance(encounter, parseInt(match[1], 10));
      }
      return encounter;
    }
    case 'disposition': {
      if (option.groupId) {
        // Extract disposition value from description
        const match = option.description.match(/to (-?\d+)/);
        if (match) {
          return withGroupDisposition(encounter, option.groupId, parseInt(match[1], 10));
        }
      }
      return encounter;
    }
    case 'environment':
    case 'activity':
      // For prototype, these options affect simulation results directly
      // The actual changes are tracked in the adjustment description
      return encounter;
    default:
      return encounter;
  }
}

/**
 * Calculates combat probability based on group dispositions.
 * Lower disposition = higher combat probability.
 */
function calculateCombatProbability(encounter: FlavouredEncounter): number {
  // In prototype, use a fixed probability based on narrative role
  // Full implementation would use disposition values
  const threatGroups = encounter.groups.filter((g) => g.narrativeRole === 'threat');
  if (threatGroups.length === 0) return 0.1; // Minimal if no threats

  // Assume hostile encounters have 80% combat probability
  // This would be calculated from disposition in full implementation
  return 0.8;
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Options for adjustment calculation.
 */
export interface AdjustmentOptions {
  /** Override the rolled target difficulty */
  targetDifficulty?: DifficultyLevel;
}

/**
 * Calculates adjustments for a flavoured encounter.
 * Steps:
 * 1. Roll target difficulty (or use override)
 * 2. Calculate current difficulty
 * 3. Adjust to match target
 */
export function calculateAdjustments(
  encounter: FlavouredEncounter,
  lookups: PresetLookups,
  options: AdjustmentOptions = {}
): AdjustmentResult {
  try {
    // 1. Roll target difficulty
    const targetDifficulty = options.targetDifficulty ?? rollTargetDifficulty(encounter.context);

    // 2. Calculate current difficulty
    const difficultyResult = calculateDifficulty(encounter, lookups);
    if (!difficultyResult.success) {
      return { success: false, error: difficultyResult.error };
    }

    // 3. Adjust for feasibility
    const balanced = adjustForFeasibility(
      encounter,
      difficultyResult.result,
      targetDifficulty,
      lookups
    );

    return { success: true, encounter: balanced };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in calculateAdjustments',
    };
  }
}
