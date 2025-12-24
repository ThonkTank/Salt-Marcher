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
  NarrativeRole,
  EncounterGroup,
  GroupRelationType,
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
    isMultiGroup: false,
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

// ============================================================================
// Multi-Group Encounter Functions (Task #252)
// ============================================================================

/**
 * Base chance for generating a multi-group encounter.
 * ~17% chance per encounter generation.
 *
 * @see docs/features/Encounter-Balancing.md#multi-gruppen-encounters-post-mvp
 */
export const MULTI_GROUP_BASE_CHANCE = 0.17;

/**
 * Budget distribution ranges by narrative role.
 * Each role has a [min, max] percentage range.
 *
 * @see docs/features/Encounter-Balancing.md#budget-bei-multi-gruppen
 */
export const NARRATIVE_ROLE_BUDGET_RANGES: Record<NarrativeRole, [number, number]> = {
  threat: [0.6, 0.8],
  victim: [0.15, 0.3],
  neutral: [0.2, 0.4],
  ally: [0.0, 0.1],
};

/**
 * Determines whether to generate a multi-group encounter.
 *
 * Trigger conditions:
 * 1. Base chance: ~17% per encounter
 * 2. Variety rescue: When single-group can't satisfy variety needs (future)
 *
 * @param _context - Generation context (unused in MVP, for future variety rescue)
 * @returns true if multi-group should be generated
 *
 * @see docs/features/Encounter-Balancing.md#wann-multi-gruppen
 */
export function shouldGenerateMultiGroup(_context?: GenerationContext): boolean {
  // MVP: Simple base chance only
  // Future: Add variety rescue logic when varietyState is available
  return Math.random() < MULTI_GROUP_BASE_CHANCE;
}

/**
 * Input for budget distribution: group ID with narrative role.
 */
export interface BudgetDistributionInput {
  groupId: string;
  narrativeRole: NarrativeRole;
}

/**
 * Distributes XP budget among groups based on their narrative roles.
 *
 * Each narrative role has a budget range:
 * - threat: 60-80% (main opposition)
 * - victim: 15-30% (hostages, endangered)
 * - neutral: 20-40% (bystanders, merchants)
 * - ally: 0-10% (potential helpers)
 *
 * The actual percentage is randomly selected within the range.
 * If total exceeds 100%, all shares are normalized proportionally.
 *
 * @param totalBudget - Total XP budget to distribute
 * @param groups - Groups with their narrative roles
 * @returns Map of groupId to allocated XP budget
 *
 * @see docs/features/Encounter-Balancing.md#budget-bei-multi-gruppen
 */
export function distributeBudget(
  totalBudget: number,
  groups: BudgetDistributionInput[]
): Map<string, number> {
  if (groups.length === 0) {
    return new Map();
  }

  // Calculate raw shares for each group
  const rawShares = new Map<string, number>();
  let totalShare = 0;

  for (const group of groups) {
    const [min, max] = NARRATIVE_ROLE_BUDGET_RANGES[group.narrativeRole];
    const share = min + Math.random() * (max - min);
    rawShares.set(group.groupId, share);
    totalShare += share;
  }

  // Normalize if total exceeds 1.0 (100%)
  const result = new Map<string, number>();
  for (const [groupId, share] of rawShares) {
    const normalizedShare = totalShare > 1.0 ? share / totalShare : share;
    const budget = Math.floor(totalBudget * normalizedShare);
    result.set(groupId, budget);
  }

  return result;
}

/**
 * Generates a relation type based on narrative roles of two groups.
 * This creates realistic default relations.
 *
 * @param fromRole - Narrative role of the source group
 * @param toRole - Narrative role of the target group
 * @returns Appropriate relation type
 */
export function deriveGroupRelation(
  fromRole: NarrativeRole,
  toRole: NarrativeRole
): GroupRelationType {
  // Threat groups are hostile to victims and other threats
  if (fromRole === 'threat') {
    if (toRole === 'victim') return 'hostile';
    if (toRole === 'threat') return 'hostile'; // Rival threats
    if (toRole === 'ally') return 'hostile';
    return 'neutral';
  }

  // Victims flee from threats
  if (fromRole === 'victim') {
    if (toRole === 'threat') return 'fleeing';
    return 'neutral';
  }

  // Allies are friendly to victims and hostile to threats
  if (fromRole === 'ally') {
    if (toRole === 'threat') return 'hostile';
    if (toRole === 'victim') return 'friendly';
    return 'neutral';
  }

  // Neutral groups are neutral to everyone
  return 'neutral';
}

/**
 * Creates an EncounterGroup from basic parameters.
 * Helper function for generateMultiGroupEncounter.
 *
 * @param params - Group creation parameters
 * @returns Complete EncounterGroup
 */
export function createEncounterGroup(params: {
  groupId: string;
  creatures: CreatureInstance[];
  narrativeRole: NarrativeRole;
  budgetShare: number;
  activity: string;
  goal: string;
  dispositionToParty: number;
  relationsToOthers: Array<{ targetGroupId: string; relation: GroupRelationType }>;
}): EncounterGroup {
  return {
    groupId: params.groupId,
    creatures: params.creatures,
    dispositionToParty: params.dispositionToParty,
    relationsToOthers: params.relationsToOthers,
    activity: params.activity,
    goal: params.goal,
    budgetShare: params.budgetShare,
    narrativeRole: params.narrativeRole,
    status: 'free',
  };
}

