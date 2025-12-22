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
  calculateXP as calculateXPFromCR,
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

