/**
 * Quest schema definitions.
 *
 * QuestDefinition is a template for quests (stored in EntityRegistry).
 * QuestProgress is runtime state (stored in feature state, Resumable).
 *
 * @see docs/features/Quest-System.md
 * @see docs/domain/Quest.md
 */

import { z } from 'zod';
import { entityIdSchema } from './common';
import { hexCoordSchema } from './map';
import { durationSchema, gameDateTimeSchema } from './time';

// ============================================================================
// QuestStatus Schema
// ============================================================================

/**
 * Quest state machine states.
 * - unknown: Quest exists, party doesn't know about it
 * - discovered: Party learned about quest, not yet accepted
 * - active: Quest accepted, objectives being tracked
 * - completed: All required objectives fulfilled
 * - failed: Deadline exceeded or condition violated
 */
export const questStatusSchema = z.enum([
  'unknown',
  'discovered',
  'active',
  'completed',
  'failed',
]);

export type QuestStatus = z.infer<typeof questStatusSchema>;

// ============================================================================
// ObjectiveType Schema
// ============================================================================

/**
 * Types of quest objectives.
 * MVP: kill, collect, visit, talk, custom
 * Post-MVP: escort, deliver
 */
export const objectiveTypeSchema = z.enum([
  'kill', // Kill creatures
  'collect', // Collect items
  'visit', // Visit location
  'escort', // Escort NPC
  'deliver', // Deliver item
  'talk', // Talk to NPC
  'custom', // Manual tracking
]);

export type ObjectiveType = z.infer<typeof objectiveTypeSchema>;

// ============================================================================
// QuestObjective Schema
// ============================================================================

/**
 * Target specification for objectives.
 * Fields are type-dependent.
 */
export const objectiveTargetSchema = z.object({
  // For 'kill'
  creatureId: entityIdSchema('creature').optional(),
  count: z.number().int().positive().optional(),

  // For 'collect', 'deliver'
  itemId: entityIdSchema('item').optional(),
  quantity: z.number().int().positive().optional(),

  // For 'visit', 'escort', 'deliver'
  locationId: entityIdSchema('poi').optional(),

  // For 'talk', 'escort'
  npcId: entityIdSchema('npc').optional(),
});

export type ObjectiveTarget = z.infer<typeof objectiveTargetSchema>;

/**
 * Single quest objective.
 */
export const questObjectiveSchema = z.object({
  /** Unique ID within quest */
  id: z.string().min(1),

  /** Objective type determines tracking behavior */
  type: objectiveTypeSchema,

  /** Player-facing description */
  description: z.string().min(1),

  /** Type-dependent target specification */
  target: objectiveTargetSchema.optional(),

  /** Must be fulfilled for quest completion */
  required: z.boolean(),

  /** Not shown in UI until discovered */
  hidden: z.boolean().optional(),
});

export type QuestObjective = z.infer<typeof questObjectiveSchema>;

// ============================================================================
// QuestEncounterSlot Schema
// ============================================================================

/**
 * Encounter slot modes:
 * - predefined-quantum: Encounter defined, location flexible (GM places)
 * - predefined-located: Encounter and location fixed
 * - unspecified: GM assigns any encounter manually
 */
export const questEncounterSlotTypeSchema = z.enum([
  'predefined-quantum',
  'predefined-located',
  'unspecified',
]);

export type QuestEncounterSlotType = z.infer<typeof questEncounterSlotTypeSchema>;

/**
 * Encounter slot in a quest.
 * Connects quests to encounters for 40/60 XP split.
 */
export const questEncounterSlotSchema = z.object({
  /** Unique ID within quest */
  id: z.string().min(1),

  /** Slot type determines how encounter is specified */
  type: questEncounterSlotTypeSchema,

  /** Player-facing description */
  description: z.string().min(1),

  /** Encounter definition ID (for predefined types) */
  encounterId: entityIdSchema('encounter').optional(),

  /** Fixed location (for predefined-located) */
  location: hexCoordSchema.optional(),

  /** Must be fulfilled for quest completion */
  required: z.boolean(),
});

export type QuestEncounterSlot = z.infer<typeof questEncounterSlotSchema>;

// ============================================================================
// QuestReward Schema
// ============================================================================

/**
 * Item reward specification.
 * Gold is a Currency-Item with id: 'gold-piece'.
 */
export const itemRewardSchema = z.object({
  itemId: entityIdSchema('item'),
  quantity: z.number().int().positive(),
});

export type ItemReward = z.infer<typeof itemRewardSchema>;

/**
 * Reputation reward specification.
 */
export const reputationRewardSchema = z.object({
  factionId: entityIdSchema('faction'),
  change: z.number().int(), // Can be negative
});

export type ReputationReward = z.infer<typeof reputationRewardSchema>;

/**
 * Quest reward with type discriminator.
 */
export const questRewardSchema = z.object({
  /** Reward type */
  type: z.enum(['item', 'xp', 'reputation']),

  /** Value depends on type */
  value: z.union([
    itemRewardSchema, // For 'item'
    z.number().int().positive(), // For 'xp'
    reputationRewardSchema, // For 'reputation'
  ]),

  /** How/when reward is given */
  placement: z.enum(['quantum', 'located', 'on-completion']),

  /** Fixed location (for 'located') */
  location: hexCoordSchema.optional(),
});

export type QuestReward = z.infer<typeof questRewardSchema>;

// ============================================================================
// QuestPrerequisite Schema
// ============================================================================

/**
 * Quest prerequisite (informative, not auto-enforced).
 * GM sees these as hints but decides when to unlock.
 */
export const questPrerequisiteSchema = z.object({
  type: z.enum(['quest-completed', 'level-min', 'item-required', 'reputation-min']),

  // Type-dependent fields
  questId: entityIdSchema('quest').optional(),
  level: z.number().int().positive().optional(),
  itemId: entityIdSchema('item').optional(),
  factionId: entityIdSchema('faction').optional(),
  reputationMin: z.number().int().optional(),
});

export type QuestPrerequisite = z.infer<typeof questPrerequisiteSchema>;

// ============================================================================
// QuestDefinition Schema (Template - EntityRegistry)
// ============================================================================

/**
 * Quest template stored in EntityRegistry.
 * Defines objectives, encounters, rewards.
 */
export const questDefinitionSchema = z.object({
  /** Unique quest identifier */
  id: entityIdSchema('quest'),

  /** Display name */
  name: z.string().min(1),

  /** Player-facing description */
  description: z.string(),

  // === Objectives ===

  /** Quest objectives (at least one required) */
  objectives: z.array(questObjectiveSchema).min(1),

  // === Encounters ===

  /** Encounter slots for 40/60 XP split */
  encounters: z.array(questEncounterSlotSchema),

  // === Rewards ===

  /** Quest completion rewards */
  rewards: z.array(questRewardSchema),

  // === Constraints ===

  /** Informative prerequisites (GM decides) */
  prerequisites: z.array(questPrerequisiteSchema).optional(),

  /** Time limit (relative duration) */
  deadline: durationSchema.optional(),

  // === Metadata ===

  /** NPC who gives this quest */
  questGiver: entityIdSchema('npc').optional(),

  /** GM-only notes */
  gmNotes: z.string().optional(),
});

export type QuestDefinition = z.infer<typeof questDefinitionSchema>;

// ============================================================================
// ObjectiveProgress Schema (Runtime)
// ============================================================================

/**
 * Progress tracking for a single objective.
 */
export const objectiveProgressSchema = z.object({
  /** Reference to objective ID */
  objectiveId: z.string().min(1),

  /** Current count (for kill/collect) */
  currentCount: z.number().int().min(0),

  /** Target count (from objective definition) */
  targetCount: z.number().int().min(1),

  /** Is this objective completed? */
  completed: z.boolean(),
});

export type ObjectiveProgress = z.infer<typeof objectiveProgressSchema>;

// ============================================================================
// QuestProgress Schema (Runtime - Feature State)
// ============================================================================

/**
 * Runtime quest progress (stored in feature state, Resumable).
 */
export const questProgressSchema = z.object({
  /** Reference to quest definition */
  questId: entityIdSchema('quest'),

  /** Current status */
  status: questStatusSchema,

  /** When quest was activated */
  startedAt: gameDateTimeSchema,

  /** Calculated deadline (if quest has deadline duration) */
  deadlineAt: gameDateTimeSchema.optional(),

  /** Progress per objective (Map as array of entries) */
  objectiveProgress: z.array(
    z.tuple([z.string(), objectiveProgressSchema])
  ),

  /** Filled encounter slots (slotId -> encounterId) */
  encounterSlotsFilled: z.array(
    z.tuple([z.string(), z.string()])
  ),

  /** Accumulated XP from 60% split */
  accumulatedXP: z.number().int().min(0),

  /** Placed quantum rewards (rewardIndex -> position) */
  placedRewards: z.array(
    z.tuple([z.number(), hexCoordSchema])
  ),
});

export type QuestProgress = z.infer<typeof questProgressSchema>;

// ============================================================================
// Quest Completion Result
// ============================================================================

/**
 * Result of completing a quest.
 */
export const questCompletionResultSchema = z.object({
  questId: entityIdSchema('quest'),
  xpAwarded: z.number().int().min(0),
  rewards: z.array(questRewardSchema),
});

export type QuestCompletionResult = z.infer<typeof questCompletionResultSchema>;

// ============================================================================
// Quest Fail Reason
// ============================================================================

/**
 * Reasons for quest failure.
 */
export const questFailReasonSchema = z.enum([
  'deadline', // Time limit exceeded
  'condition-violated', // Critical condition no longer met
  'abandoned', // GM/Player manually abandoned
]);

export type QuestFailReason = z.infer<typeof questFailReasonSchema>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Immediate XP percentage (40%).
 * Given at encounter resolution, regardless of quest.
 */
export const IMMEDIATE_XP_PERCENT = 0.4;

/**
 * Quest pool XP percentage (60%).
 * Accumulated when encounter assigned to quest slot.
 * Paid out at quest completion.
 */
export const QUEST_POOL_XP_PERCENT = 0.6;
