/**
 * Encounter Feature Utilities
 *
 * This file re-exports core encounter utilities and provides
 * feature-specific functions that depend on other features.
 *
 * Pure utilities are in @core/utils/encounter-utils.ts
 * Feature-specific utilities (with cross-feature dependencies) are here.
 *
 * @see docs/features/Encounter-System.md
 */

import type {
  CreatureDefinition,
  EncounterType,
  EncounterInstance,
  EncounterPerception,
  DetectionMethod,
  GameDateTime,
  CreatureInstance,
  Faction,
  NoiseLevel,
  ScentStrength,
} from '@core/schemas';
import { DEFAULT_DETECTION_PROFILE } from '@core/schemas';
import { createCombatCreature } from '@/features/combat';
import type { GenerationContext } from './types';
import { DEFAULT_ENCOUNTER_DESCRIPTION } from './types';

// ============================================================================
// Re-exports from @core/utils
// ============================================================================

// Re-export all pure utility functions and types from core
export {
  // Types
  type CRComparison,
  type EncounterDifficulty,
  type FactionRelation,
  type CreatureSelectionResult,
  type TypeDerivationResult,
  type VarietyValidationResult,
  type CreatureWeight,
  type FactionWeight,
  type CompanionSelectionResult,
  type TypeProbabilityMatrix,
  type EncounterHistoryEntry,

  // Step 1: Tile-Eligibility
  filterEligibleCreatures,

  // Step 2: Weighted Selection
  calculateCreatureWeight,
  selectWeightedCreature,

  // Step 3: Type Derivation
  compareCR,
  rollDifficulty,
  isWinnable,
  deriveEncounterType,
  deriveEncounterTypeWithVariety,

  // Step 4: Variety Validation (Type Dampening)
  calculateTypeWeights,
  createDefaultTypeMatrix,
  normalizeMatrix,

  // Helper Functions
  generateEncounterId,
  generateActivity,
  generateGoal,
  generateDescription,

  // XP Functions
  calculateXPBudget,
  calculateEncounterXP,
  selectCompanions,

  // Trigger & Slot Resolution (NEW)
  checkTriggers,
  resolveCreatureSlots,
} from '@core/utils';

// Re-export creature utils for backwards compatibility
export {
  calculateXP as calculateCreatureXP,
  getEncounterMultiplier as getGroupMultiplier,
  calculateEffectiveXP,
} from '@core/utils';

// Import functions we need internally
import {
  generateEncounterId,
  generateActivity,
  generateGoal,
  generateDescription,
  calculateXP as calculateXPFromCR,
} from '@core/utils';

// ============================================================================
// Perception Constants (Task #213)
// ============================================================================

/**
 * Noise level bonus for auditory detection.
 * Higher values = easier to hear.
 */
export const NOISE_LEVEL_BONUS: Record<NoiseLevel, number> = {
  silent: 0,
  quiet: 2,
  normal: 5,
  loud: 10,
  deafening: 15,
};

/**
 * Scent strength bonus for olfactory detection.
 * Higher values = easier to smell.
 */
export const SCENT_STRENGTH_BONUS: Record<ScentStrength, number> = {
  none: 0,
  faint: 2,
  moderate: 5,
  strong: 10,
  overwhelming: 15,
};

/**
 * Audio detection range by noise level (in feet).
 * Used for determining if auditory detection is better than visual.
 */
export const AUDIO_DETECTION_RANGE: Record<NoiseLevel, number> = {
  silent: 0,
  quiet: 30,
  normal: 60,
  loud: 200,
  deafening: 500,
};

/**
 * Default visual detection range (in feet).
 * Used when terrain visibility data is not available.
 */
export const DEFAULT_VISUAL_RANGE = 300;

// ============================================================================
// Perception Calculation Functions (Task #213)
// ============================================================================

/**
 * Calculate initial perception data for an encounter.
 * Determines detection method, distance, and awareness states.
 *
 * @param creature - The creature being encountered
 * @param encounterType - Type of encounter (affects initial distance)
 * @returns EncounterPerception data
 *
 * @see docs/features/Encounter-System.md#encounterperception
 */
export function calculateInitialPerception(
  creature: CreatureDefinition,
  encounterType: EncounterType
): EncounterPerception {
  const profile = creature.detectionProfile ?? DEFAULT_DETECTION_PROFILE;

  // Determine best detection method
  const visualRange = DEFAULT_VISUAL_RANGE;
  const audioRange = AUDIO_DETECTION_RANGE[profile.noiseLevel];

  let bestMethod: DetectionMethod = 'visual';
  let bestRange = visualRange;

  // Check if auditory detection is better
  if (audioRange > visualRange) {
    bestMethod = 'auditory';
    bestRange = audioRange;
  }

  // Calculate initial distance based on encounter type
  // Social encounters start closer (conversation distance)
  // Passing encounters at mid-range (observing)
  // Combat encounters at shorter range (detection led to confrontation)
  // Trace encounters at close range (investigating evidence)
  const initialDistance =
    encounterType === 'social'
      ? 60
      : encounterType === 'passing'
        ? Math.floor(bestRange * 0.5)
        : encounterType === 'trace'
          ? 30
          : Math.floor(bestRange * 0.3); // combat

  // Build modifiers object only if there are non-default values
  const hasNonDefaultNoise = profile.noiseLevel !== 'normal';
  const hasNonDefaultScent = profile.scentStrength !== 'faint';
  const modifiers =
    hasNonDefaultNoise || hasNonDefaultScent
      ? {
          noiseBonus: NOISE_LEVEL_BONUS[profile.noiseLevel],
          scentBonus: SCENT_STRENGTH_BONUS[profile.scentStrength],
        }
      : undefined;

  return {
    detectionMethod: bestMethod,
    initialDistance,
    partyAware: true, // MVP: Party always aware
    encounterAware: true, // MVP: Encounter always aware
    modifiers,
    // ambush: undefined for MVP (no ambush calculation yet)
  };
}

/**
 * Calculate disposition value based on creature and faction.
 * Combines creature's default disposition with faction's party reputation.
 *
 * @param creature - The creature being encountered
 * @param faction - The faction (if any) the creature belongs to
 * @returns Disposition value from -100 (hostile) to +100 (friendly)
 *
 * @see docs/features/Encounter-System.md#disposition
 */
export function calculateDisposition(
  creature: CreatureDefinition,
  faction: Faction | null
): number {
  // Base disposition from creature template
  const base =
    creature.disposition === 'hostile'
      ? -50
      : creature.disposition === 'friendly'
        ? 50
        : 0; // neutral

  // Faction modifier from party reputation
  const factionMod = faction?.reputationWithParty ?? 0;

  // Clamp to [-100, +100] range
  return Math.max(-100, Math.min(100, base + factionMod));
}

// ============================================================================
// Feature-Specific Functions (depend on other features)
// ============================================================================

/**
 * Create a creature instance from a definition with index-based ID.
 * Uses createCombatCreature internally and overrides the instanceId
 * with an index-based ID for encounter grouping.
 *
 * NOTE: This function stays in the feature layer because it depends on
 * @/features/combat (createCombatCreature).
 */
export function createCreatureInstance(
  definition: CreatureDefinition,
  index: number
): CreatureInstance {
  const instance = createCombatCreature(definition);
  return {
    ...instance,
    instanceId: `${definition.id}-${index}-${Math.random().toString(36).substring(2, 7)}`,
  };
}

/**
 * Create a complete encounter instance.
 *
 * NOTE: This function stays in the feature layer because it uses
 * createCreatureInstance which depends on @/features/combat.
 *
 * @param creature - The primary creature for this encounter
 * @param type - Encounter type (combat, social, passing, trace)
 * @param context - Generation context (position, terrain, time, etc.)
 * @param currentTime - Current in-game time
 * @param faction - Optional faction for disposition calculation
 * @returns Complete EncounterInstance
 */
export function populateEncounter(
  creature: CreatureDefinition,
  type: EncounterType,
  context: GenerationContext,
  currentTime: GameDateTime,
  faction?: Faction | null
): EncounterInstance {
  const activity = generateActivity(creature, context.timeSegment);
  const goal = generateGoal(creature);
  const description = generateDescription(type, creature, activity);

  // Create creature instance(s)
  // For MVP: single creature per encounter
  const creatureInstance = createCreatureInstance(creature, 0);

  // Calculate perception and disposition (Task #213)
  const perception = calculateInitialPerception(creature, type);
  const disposition = calculateDisposition(creature, faction ?? null);

  return {
    id: generateEncounterId(),
    type,
    state: 'pending',
    creatures: [creatureInstance],
    activity,
    goal,
    description,
    generatedAt: currentTime,
    mapId: undefined, // Will be set by service
    position: context.position,
    trigger: context.trigger,
    perception,
    disposition,
  };
}

// Re-export DEFAULT_ENCOUNTER_DESCRIPTION for backwards compatibility
export { DEFAULT_ENCOUNTER_DESCRIPTION };

// ============================================================================
// Creature Grouping (for UI display)
// ============================================================================

/**
 * Grouped creature info for UI display.
 * Used to show "3× Goblin" instead of 3 separate goblin rows.
 */
export interface GroupedCreature {
  /** Creature definition ID */
  definitionId: string;
  /** Display name from definition */
  name: string;
  /** Challenge Rating from definition */
  cr: number;
  /** XP per single creature */
  xpEach: number;
  /** Total XP (xpEach × count) */
  totalXp: number;
  /** Number of creatures of this type */
  count: number;
  /** Instance IDs for all creatures in this group */
  instanceIds: string[];
}

/**
 * Group creature instances by definition ID for display.
 * Looks up CR and XP from creature definitions.
 *
 * @param instances - Runtime creature instances from an encounter
 * @param definitions - Creature definitions for CR/XP lookup
 * @returns Grouped creatures with aggregated counts
 *
 * @example
 * // 3 goblins + 1 hobgoblin → 2 groups
 * const grouped = groupCreaturesByDefinitionId(encounter.creatures, creatureDefs);
 * // [{ name: "Goblin", count: 3, ... }, { name: "Hobgoblin", count: 1, ... }]
 */
export function groupCreaturesByDefinitionId(
  instances: readonly CreatureInstance[],
  definitions: readonly CreatureDefinition[]
): GroupedCreature[] {
  // Build a lookup map for definitions
  const defMap = new Map(definitions.map((d) => [d.id, d]));

  // Group instances by definition ID
  const groups = new Map<string, GroupedCreature>();

  for (const instance of instances) {
    const defId = instance.definitionId;
    const def = defMap.get(defId);

    // Calculate XP from CR (use calculateXP from core)
    const cr = def?.cr ?? 0;
    const xpEach = calculateXPFromCR(cr);

    if (groups.has(defId)) {
      const group = groups.get(defId)!;
      group.count += 1;
      group.totalXp = group.xpEach * group.count;
      group.instanceIds.push(instance.instanceId);
    } else {
      groups.set(defId, {
        definitionId: defId,
        name: def?.name ?? defId,
        cr,
        xpEach,
        totalXp: xpEach,
        count: 1,
        instanceIds: [instance.instanceId],
      });
    }
  }

  return Array.from(groups.values());
}

