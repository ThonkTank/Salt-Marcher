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
// EncounterPerception Schema
// ============================================================================

/**
 * Detection methods for encounter perception.
 * Determines how party and encounter detected each other.
 *
 * @see docs/features/Encounter-System.md#perception
 */
export const detectionMethodSchema = z.enum([
  'visual', // Saw each other
  'auditory', // Heard each other
  'olfactory', // Smelled each other
  'tremorsense', // Felt vibrations
  'magical', // Detected via magical means
]);

export type DetectionMethod = z.infer<typeof detectionMethodSchema>;

/**
 * Ambush attempt result.
 * Tracks who attempted ambush and whether it succeeded.
 */
export const encounterAmbushSchema = z.object({
  /** Who attempted the ambush */
  attemptedBy: z.enum(['encounter', 'party']),

  /** Stealth roll made by ambusher */
  stealthRoll: z.number(),

  /** Opposing perception check */
  opposingPerception: z.number(),

  /** Who (if anyone) was surprised */
  surprised: z.enum(['party', 'encounter', 'none']),
});

export type EncounterAmbush = z.infer<typeof encounterAmbushSchema>;

/**
 * Perception modifiers applied during detection.
 * For UI display and debugging.
 */
export const perceptionModifiersSchema = z.object({
  /** Bonus from creature noise level */
  noiseBonus: z.number().optional(),

  /** Bonus from creature scent strength */
  scentBonus: z.number().optional(),

  /** Penalty applied to stealth */
  stealthPenalty: z.number().optional(),
});

export type PerceptionModifiers = z.infer<typeof perceptionModifiersSchema>;

/**
 * Full perception data for an encounter.
 * Tracks how detection occurred and awareness states.
 *
 * @see docs/features/Encounter-System.md#encounterperception
 */
export const encounterPerceptionSchema = z.object({
  /** How the encounter was detected */
  detectionMethod: detectionMethodSchema,

  /** Initial distance between party and encounter (in feet) */
  initialDistance: z.number().nonnegative(),

  /** Does the party know about the encounter? */
  partyAware: z.boolean(),

  /** Does the encounter know about the party? */
  encounterAware: z.boolean(),

  /** Applied perception modifiers (optional, for debugging) */
  modifiers: perceptionModifiersSchema.optional(),

  /** Ambush attempt result (if any) */
  ambush: encounterAmbushSchema.optional(),
});

export type EncounterPerception = z.infer<typeof encounterPerceptionSchema>;

// ============================================================================
// EncounterGroup Status Schema (Task #2992)
// ============================================================================

/**
 * Physical status of a group in an encounter.
 * Determines whether the group can help allies.
 *
 * @see docs/features/Encounter-Balancing.md#gruppen-status
 */
export const encounterGroupStatusSchema = z.enum([
  'free', // Handlungsfähig, kann helfen
  'captive', // Gefangen/gefesselt, kann nicht helfen
  'incapacitated', // Bewusstlos/paralysiert, kann nicht helfen
  'fleeing', // Auf der Flucht, kann nicht helfen
]);

export type EncounterGroupStatus = z.infer<typeof encounterGroupStatusSchema>;

// ============================================================================
// NarrativeRole Schema (Task #2992)
// ============================================================================

/**
 * Narrative role of a group in an encounter.
 * Used for budget distribution and difficulty calculation.
 *
 * @see docs/features/Encounter-Balancing.md#budget-bei-multi-gruppen
 */
export const narrativeRoleSchema = z.enum([
  'threat', // Hauptbedrohung (60-80% Budget)
  'victim', // Opfer/Gefangene (15-30% Budget)
  'neutral', // Unbeteiligte (20-40% Budget)
  'ally', // Potenzielle Verbündete (0-10% Budget, zählt zur Party-Stärke)
]);

export type NarrativeRole = z.infer<typeof narrativeRoleSchema>;

// ============================================================================
// EncounterInstance Schema (Runtime)
// ============================================================================

/**
 * Encounter difficulty levels (D&D 5e).
 * Used for XP budget calculation.
 */
export const encounterDifficultySchema = z.enum([
  'easy',
  'medium',
  'hard',
  'deadly',
]);

export type EncounterDifficultyValue = z.infer<typeof encounterDifficultySchema>;

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

  // === Balancing (Combat encounters) ===

  /** Rolled difficulty level for this encounter */
  difficulty: encounterDifficultySchema.optional(),

  /** XP budget used for encounter generation */
  xpBudget: z.number().int().nonnegative().optional(),

  /** Effective XP (including group multiplier) */
  effectiveXP: z.number().int().nonnegative().optional(),

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

  // === Loot (generated at encounter creation) ===

  /**
   * Generated loot for this encounter.
   * Created at encounter generation (not combat end) so creatures can use items.
   * @see docs/features/Loot-Feature.md
   */
  loot: z
    .object({
      /** Selected items with quantities (includes currency) */
      items: z.array(
        z.object({
          itemId: entityIdSchema('item'),
          quantity: z.number().int().positive(),
        })
      ),
      /** Total loot value in GP */
      totalValue: z.number().nonnegative(),
    })
    .optional(),

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

  // === Perception & Disposition ===

  /**
   * Perception data for this encounter.
   * Tracks how detection occurred and awareness states.
   *
   * @see docs/features/Encounter-System.md#encounterperception
   */
  perception: encounterPerceptionSchema,

  /**
   * Disposition toward party: -100 (hostile) to +100 (friendly).
   * Calculated from creature disposition + faction reputation.
   *
   * @see docs/features/Encounter-System.md#disposition
   */
  disposition: z.number().min(-100).max(100),
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

// ============================================================================
// EncounterTemplate Schema (Generic Templates)
// ============================================================================

/**
 * CR constraint for role filling in templates.
 * - highest: Pick creatures with highest CR within budget
 * - lowest: Pick creatures with lowest CR within budget
 * - any: Pick any creature that fits
 */
export const crConstraintSchema = z.enum(['highest', 'lowest', 'any']);

export type CRConstraint = z.infer<typeof crConstraintSchema>;

/**
 * MCDM-inspired design roles for creatures in encounters.
 * Used for tactical variety in encounter composition.
 *
 * @see docs/features/Encounter-System.md#design-roles
 */
export const designRoleSchema = z.enum([
  'ambusher', // Strikes from hiding, high burst damage
  'artillery', // Ranged attacks, fragile
  'brute', // High HP, high damage, low AC
  'controller', // Debuffs, area denial
  'leader', // Buffs allies, coordinates tactics
  'minion', // Low HP, swarm tactics
  'skirmisher', // Mobile, hit-and-run
  'soldier', // Balanced, frontline
  'solo', // Single powerful creature
  'support', // Heals, buffs, enables others
]);

export type DesignRole = z.infer<typeof designRoleSchema>;

/**
 * Role definition within an encounter template.
 * Specifies how many creatures of a role and their constraints.
 */
export const templateRoleSchema = z.object({
  /** Count range for this role */
  count: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
  }),

  /** Percentage of XP budget allocated to this role */
  budgetPercent: z.number().min(0).max(100),

  /** How to select CR for this role */
  crConstraint: crConstraintSchema.optional(),

  /** MCDM design role for tactical variety */
  designRole: designRoleSchema.optional(),
});

export type TemplateRole = z.infer<typeof templateRoleSchema>;

/**
 * Generic encounter template for procedural generation.
 * Defines composition patterns like "leader + minions" or "pack".
 *
 * Templates are loaded from presets/encounter-templates/ and matched
 * against faction/creature tags during encounter generation.
 *
 * @see docs/features/Encounter-System.md#encounter-templates
 */
export const encounterTemplateSchema = z.object({
  /** Unique template identifier */
  id: z.string().min(1),

  /** Display name */
  name: z.string().min(1),

  /** Optional description */
  description: z.string().optional(),

  /** Tags that make this template applicable (e.g., "organized", "tribal") */
  compatibleTags: z.array(z.string()),

  /** Role definitions (keyed by role name like "leader", "minions") */
  roles: z.record(z.string(), templateRoleSchema),
});

export type EncounterTemplate = z.infer<typeof encounterTemplateSchema>;

// ============================================================================
// GroupRelation Schema (Multi-Group Encounters)
// ============================================================================

/**
 * Relation type between two encounter groups.
 * - hostile: Groups are fighting/attacking each other
 * - neutral: Groups are indifferent to each other
 * - friendly: Groups are allied or cooperative
 * - fleeing: This group is fleeing from the target group
 *
 * @see docs/features/Encounter-Balancing.md#gruppen-relationen
 */
export const groupRelationTypeSchema = z.enum([
  'hostile',
  'neutral',
  'friendly',
  'fleeing',
]);

export type GroupRelationType = z.infer<typeof groupRelationTypeSchema>;

/**
 * Describes how one group relates to another in a multi-group encounter.
 *
 * Note: `context` was removed - narrative context derives from
 * Activity + Goal of the groups.
 *
 * @see docs/features/Encounter-Balancing.md#gruppen-relationen
 * @see docs/features/Encounter-System.md#gruppenrelation
 */
export const groupRelationSchema = z.object({
  /** ID of the target group (e.g., "merchants", "guards") */
  targetGroupId: z.string().min(1),

  /** How this group relates to the target group */
  relation: groupRelationTypeSchema,
});

export type GroupRelation = z.infer<typeof groupRelationSchema>;

// ============================================================================
// EncounterGroup Schema (Task #2992)
// ============================================================================

/**
 * A group of creatures within a multi-group encounter.
 * Each group has its own lead NPC, disposition, activity, and goals.
 *
 * Multi-group encounters allow for complex scenarios like:
 * - Bandits attacking merchants (threat + victim)
 * - Rival factions fighting (threat + threat)
 * - Party allies helping in combat (threat + ally)
 *
 * @see docs/features/Encounter-System.md#encountergroup-schema
 */
export const encounterGroupSchema = z.object({
  /** Unique group ID within this encounter (e.g., "bandits", "merchants") */
  groupId: z.string().min(1),

  /** Creatures in this group */
  creatures: z.array(creatureInstanceSchema).min(1),

  /** Lead NPC for this group (full details, persisted) */
  leadNPC: encounterLeadNpcSchema.optional(),

  /** Highlight NPCs (session-only, shallow details, max 3 GLOBAL across all groups) */
  highlightNPCs: z.array(encounterLeadNpcSchema).optional(),

  /** Disposition toward party: -100 (hostile) to +100 (friendly) */
  dispositionToParty: z.number().min(-100).max(100),

  /** Relations to other groups in this encounter */
  relationsToOthers: z.array(groupRelationSchema),

  /** What the group is currently doing */
  activity: z.string().min(1),

  /** What the group wants to achieve */
  goal: z.string().min(1),

  /** Share of total XP budget (0.0 to 1.0) */
  budgetShare: z.number().min(0).max(1),

  /** Narrative role in the encounter (affects budget distribution) */
  narrativeRole: narrativeRoleSchema,

  /** Physical status of the group (affects ability to help allies) */
  status: encounterGroupStatusSchema,

  /** Group-specific loot pool (optional, generated at encounter creation) */
  lootPool: z
    .object({
      items: z.array(
        z.object({
          itemId: entityIdSchema('item'),
          quantity: z.number().int().positive(),
        })
      ),
      totalValue: z.number().nonnegative(),
    })
    .optional(),
});

export type EncounterGroup = z.infer<typeof encounterGroupSchema>;
