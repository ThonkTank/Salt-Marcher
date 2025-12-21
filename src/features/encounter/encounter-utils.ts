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
  GameDateTime,
  CreatureInstance,
} from '@core/schemas';
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
  type CreatureSelectionResult,
  type TypeDerivationResult,
  type VarietyValidationResult,
  type CreatureWeight,
  type FactionWeight,
  type CompanionSelectionResult,

  // Step 1: Tile-Eligibility
  filterEligibleCreatures,

  // Step 2: Weighted Selection
  calculateCreatureWeight,
  selectWeightedCreature,

  // Step 3: Type Derivation
  compareCR,
  rollDifficulty,
  deriveEncounterType,

  // Step 4: Variety Validation
  validateVariety,

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
} from '@core/utils';

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
 */
export function populateEncounter(
  creature: CreatureDefinition,
  type: EncounterType,
  context: GenerationContext,
  currentTime: GameDateTime
): EncounterInstance {
  const activity = generateActivity(creature, context.timeSegment);
  const goal = generateGoal(creature);
  const description = generateDescription(type, creature, activity);

  // Create creature instance(s)
  // For MVP: single creature per encounter
  const creatureInstance = createCreatureInstance(creature, 0);

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
  };
}

// Re-export DEFAULT_ENCOUNTER_DESCRIPTION for backwards compatibility
export { DEFAULT_ENCOUNTER_DESCRIPTION };
