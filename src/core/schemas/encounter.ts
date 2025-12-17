/**
 * Encounter schema definitions.
 *
 * EncounterDefinition is a template for encounters (stored in EntityRegistry).
 * EncounterInstance is a runtime instance (stored in feature state).
 *
 * @see docs/features/Encounter-System.md
 * @see docs/features/Encounter-Balancing.md
 */

import { z } from 'zod';
import { entityIdSchema, timeSegmentSchema } from './common';
import { gameDateTimeSchema } from './time';
import { creatureInstanceSchema } from './creature';
import { encounterLeadNpcSchema } from './npc';

// ============================================================================
// EncounterType Schema
// ============================================================================

/**
 * MVP encounter types.
 * - combat: Fight with creatures (CR-balanced)
 * - social: Interaction with NPCs
 * - passing: Something happens nearby, no interaction
 * - trace: Evidence of past events
 *
 * Post-MVP: environmental, location
 */
export const encounterTypeSchema = z.enum([
  'combat',
  'social',
  'passing',
  'trace',
]);

export type EncounterType = z.infer<typeof encounterTypeSchema>;

// ============================================================================
// EncounterState Schema
// ============================================================================

/**
 * Encounter state machine states.
 * - pending: Generated but not yet started
 * - active: Currently in progress
 * - resolved: Completed with outcome
 */
export const encounterStateValueSchema = z.enum([
  'pending',
  'active',
  'resolved',
]);

export type EncounterStateValue = z.infer<typeof encounterStateValueSchema>;

// ============================================================================
// EncounterOutcome Schema
// ============================================================================

/**
 * How an encounter was resolved.
 */
export const encounterOutcomeSchema = z.enum([
  'victory', // Party won combat
  'defeat', // Party lost
  'fled', // Party fled
  'negotiated', // Resolved through social means
  'avoided', // Party avoided the encounter
  'passed', // Passing/trace - just observed
  'dismissed', // GM dismissed without resolution
]);

export type EncounterOutcome = z.infer<typeof encounterOutcomeSchema>;

// ============================================================================
// CreatureSlot Schemas (3 Variants)
// ============================================================================

/**
 * Base fields for all creature slots.
 */
const baseCreatureSlotSchema = z.object({
  /** Group ID for multi-group encounters (e.g., "bandits", "merchants") */
  groupId: z.string().optional(),

  /** Is this the lead NPC of the group? */
  isLeader: z.boolean().optional(),
});

/**
 * Concrete slot: Specific creature, optionally with existing NPC.
 */
export const concreteCreatureSlotSchema = baseCreatureSlotSchema.extend({
  slotType: z.literal('concrete'),

  /** Specific creature template */
  creatureId: entityIdSchema('creature'),

  /** Optional: Use existing NPC */
  npcId: entityIdSchema('npc').optional(),

  /** Number of this creature (usually 1) */
  count: z.number().int().positive(),
});

export type ConcreteCreatureSlot = z.infer<typeof concreteCreatureSlotSchema>;

/**
 * Typed slot: Creature type with count or range.
 */
export const typedCreatureSlotSchema = baseCreatureSlotSchema.extend({
  slotType: z.literal('typed'),

  /** Creature type to use */
  creatureId: entityIdSchema('creature'),

  /** Fixed count or range */
  count: z.union([
    z.number().int().positive(),
    z.object({
      min: z.number().int().positive(),
      max: z.number().int().positive(),
    }),
  ]),
});

export type TypedCreatureSlot = z.infer<typeof typedCreatureSlotSchema>;

/**
 * Budget slot: XP budget with constraints.
 */
export const budgetCreatureSlotSchema = baseCreatureSlotSchema.extend({
  slotType: z.literal('budget'),

  /** XP budget for this slot */
  xpBudget: z.number().int().positive(),

  /** Optional constraints */
  constraints: z
    .object({
      /** Only creatures from this faction */
      factionId: entityIdSchema('faction').optional(),

      /** Allowed creature types (tags) */
      creatureTypes: z.array(z.string()).optional(),

      /** CR range */
      crRange: z
        .object({
          min: z.number().nonnegative().optional(),
          max: z.number().nonnegative().optional(),
        })
        .optional(),

      /** Required tags */
      tags: z.array(z.string()).optional(),
    })
    .optional(),

  /** Minimum creatures to generate */
  minCount: z.number().int().positive().optional(),

  /** Maximum creatures to generate */
  maxCount: z.number().int().positive().optional(),
});

export type BudgetCreatureSlot = z.infer<typeof budgetCreatureSlotSchema>;

/**
 * Union of all creature slot types.
 */
export const creatureSlotSchema = z.discriminatedUnion('slotType', [
  concreteCreatureSlotSchema,
  typedCreatureSlotSchema,
  budgetCreatureSlotSchema,
]);

export type CreatureSlot = z.infer<typeof creatureSlotSchema>;

// ============================================================================
// EncounterTriggers Schema
// ============================================================================

/**
 * Conditions for when an encounter can trigger.
 * Used for random tables and quest placement.
 */
export const encounterTriggersSchema = z.object({
  /** Terrain types where this encounter can occur */
  terrain: z.array(entityIdSchema('terrain')).optional(),

  /** Time segments when this encounter can occur */
  timeOfDay: z.array(timeSegmentSchema).optional(),

  /** Weather conditions (future: reference weather types) */
  weather: z.array(z.string()).optional(),

  /** Party level range for this encounter */
  partyLevelRange: z
    .object({
      min: z.number().int().positive().optional(),
      max: z.number().int().positive().optional(),
    })
    .optional(),
});

export type EncounterTriggers = z.infer<typeof encounterTriggersSchema>;

// ============================================================================
// EncounterDefinition Schema (Template)
// ============================================================================

/**
 * Encounter template stored in EntityRegistry.
 * Can be concrete, semi-specific, or generic.
 */
export const encounterDefinitionSchema = z.object({
  /** Unique encounter identifier */
  id: entityIdSchema('encounter'),

  /** Display name */
  name: z.string().min(1),

  /** Player-facing description */
  description: z.string(),

  /** GM-only setup hints */
  setupDescription: z.string().optional(),

  /** Encounter type (determines behavior) */
  type: encounterTypeSchema,

  // === Creatures ===

  /** Creature slots (required for all MVP types) */
  creatureSlots: z.array(creatureSlotSchema).min(1),

  // === Context ===

  /** What are they doing? (optional, else generated) */
  activity: z.string().optional(),

  /** What do they want? (optional, else generated) */
  goal: z.string().optional(),

  // === Trigger Conditions ===

  /** When/where this encounter can appear */
  triggers: encounterTriggersSchema.optional(),

  // === Rewards ===

  /** XP override (else calculated from creatures) */
  xpReward: z.number().int().nonnegative().optional(),

  /** Loot table reference or inline loot */
  loot: z
    .union([
      z.string(), // LootTableRef
      z.array(z.string()), // LootEntry[] (simplified for MVP)
    ])
    .optional(),

  // === Flags ===

  /** Can only occur once */
  isUnique: z.boolean().optional(),

  /** Only appears via quest assignment, not randomly */
  requiresQuestAssignment: z.boolean().optional(),
});

export type EncounterDefinition = z.infer<typeof encounterDefinitionSchema>;

// ============================================================================
// EncounterInstance Schema (Runtime)
// ============================================================================

/**
 * Runtime encounter instance (in feature state, not persisted).
 */
export const encounterInstanceSchema = z.object({
  /** Unique instance ID */
  id: z.string().min(1),

  /** Reference to definition (if from template) */
  definitionId: entityIdSchema('encounter').optional(),

  /** Encounter type */
  type: encounterTypeSchema,

  /** Current state */
  state: encounterStateValueSchema,

  // === Creatures ===

  /** Instantiated creatures */
  creatures: z.array(creatureInstanceSchema),

  /** Lead NPC for this encounter (if any) */
  leadNpc: encounterLeadNpcSchema.optional(),

  // === Context ===

  /** Activity description */
  activity: z.string().optional(),

  /** Goal description */
  goal: z.string().optional(),

  /** Player-facing description */
  description: z.string(),

  // === Timing ===

  /** When this encounter was generated */
  generatedAt: gameDateTimeSchema,

  /** When this encounter was resolved (if resolved) */
  resolvedAt: gameDateTimeSchema.optional(),

  // === Resolution ===

  /** How the encounter ended */
  outcome: encounterOutcomeSchema.optional(),

  /** XP awarded (calculated at resolution) */
  xpAwarded: z.number().int().nonnegative().optional(),

  // === Location Context ===

  /** Map where encounter occurred */
  mapId: entityIdSchema('map').optional(),

  /** Position where encounter occurred */
  position: z
    .object({
      q: z.number().int(),
      r: z.number().int(),
    })
    .optional(),

  // === Metadata ===

  /** Trigger source */
  trigger: z.enum(['time-based', 'manual', 'location', 'travel']).optional(),
});

export type EncounterInstance = z.infer<typeof encounterInstanceSchema>;

// ============================================================================
// Generated Encounter Context (Input for generation)
// ============================================================================

/**
 * Context provided to encounter generation.
 */
export const encounterContextSchema = z.object({
  /** Current position */
  position: z.object({
    q: z.number().int(),
    r: z.number().int(),
  }),

  /** Terrain at position */
  terrainId: entityIdSchema('terrain'),

  /** Current time segment */
  timeSegment: timeSegmentSchema,

  /** Current weather (optional) */
  weather: z
    .object({
      temperature: z.number(),
      windSpeed: z.number(),
      precipitation: z.number(),
    })
    .optional(),

  /** Party level (optional, for type derivation) */
  partyLevel: z.number().int().positive().optional(),

  /** Trigger source */
  trigger: z.enum(['time-based', 'manual', 'location', 'travel']),
});

export type EncounterContext = z.infer<typeof encounterContextSchema>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum recent creature types to track for variety validation.
 */
export const VARIETY_HISTORY_SIZE = 5;

/**
 * Reroll if same creature type appeared recently.
 */
export const VARIETY_REROLL_WINDOW = 3;

/**
 * Maximum reroll attempts before accepting any creature.
 */
export const MAX_REROLL_ATTEMPTS = 3;

/**
 * CR threshold for type derivation (combat vs passing).
 * If creature CR > partyLevel * this factor, derive as passing (not winnable).
 */
export const CR_COMBAT_THRESHOLD_FACTOR = 2.0;

/**
 * Base encounter check chance per hour during travel.
 */
export const BASE_ENCOUNTER_CHANCE = 0.125; // 12.5%
