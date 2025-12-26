/**
 * Faction schema definitions.
 *
 * Factions organize NPCs and creatures with embedded culture data.
 * Supports hierarchical inheritance (sub-factions inherit from parents).
 *
 * @see docs/domain/Faction.md
 */

import { z } from 'zod';
import { entityIdSchema } from './common';

// ============================================================================
// Culture Sub-Schemas
// ============================================================================

/**
 * Weighted trait for personality generation.
 */
export const weightedTraitSchema = z.object({
  trait: z.string().min(1),
  weight: z.number().min(0).max(1),
});

export type WeightedTrait = z.infer<typeof weightedTraitSchema>;

/**
 * Weighted quirk with description for GM.
 */
export const weightedQuirkSchema = z.object({
  quirk: z.string().min(1),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
});

export type WeightedQuirk = z.infer<typeof weightedQuirkSchema>;

/**
 * Naming generation data.
 */
export const namingDataSchema = z.object({
  /** Name patterns (e.g., ["{prefix}{root}", "{root} {title}"]) */
  patterns: z.array(z.string()).optional(),

  /** Name prefixes */
  prefixes: z.array(z.string()).optional(),

  /** Name roots */
  roots: z.array(z.string()).optional(),

  /** Name suffixes */
  suffixes: z.array(z.string()).optional(),

  /** Titles (e.g., "der Grausame", "Haendler") */
  titles: z.array(z.string()).optional(),
});

export type NamingData = z.infer<typeof namingDataSchema>;

/**
 * Personality generation data.
 */
export const personalityDataSchema = z.object({
  /** Common personality traits */
  common: z.array(weightedTraitSchema).optional(),

  /** Rare personality traits */
  rare: z.array(weightedTraitSchema).optional(),

  /** Traits that NEVER appear for this faction */
  forbidden: z.array(z.string()).optional(),
});

export type PersonalityData = z.infer<typeof personalityDataSchema>;

/**
 * Values and behavioral tendencies.
 */
export const valuesDataSchema = z.object({
  /** What the faction prioritizes */
  priorities: z.array(z.string()).optional(),

  /** What is taboo/forbidden */
  taboos: z.array(z.string()).optional(),

  /** Typical greetings */
  greetings: z.array(z.string()).optional(),
});

export type ValuesData = z.infer<typeof valuesDataSchema>;

/**
 * Speech patterns for RP hints.
 */
export const speechDataSchema = z.object({
  /** Speech style (e.g., "formal", "rough", "flowery") */
  dialect: z.string().optional(),

  /** Common phrases */
  commonPhrases: z.array(z.string()).optional(),

  /** Accent description */
  accent: z.string().optional(),
});

export type SpeechData = z.infer<typeof speechDataSchema>;

// ============================================================================
// Faction Status
// ============================================================================

/**
 * Status of a faction in the dynamic world.
 * - active: Faction appears in encounters
 * - dormant: Faction is inactive but can be reactivated
 * - extinct: All members eliminated, no encounters
 */
export const factionStatusSchema = z.enum(['active', 'dormant', 'extinct']);

export type FactionStatus = z.infer<typeof factionStatusSchema>;

// ============================================================================
// Activity & Goal References (for culture)
// ============================================================================

/**
 * Reference to an activity with faction-specific weighting.
 */
export const factionActivityRefSchema = z.object({
  /** Activity identifier (e.g., "activity:raiding", "activity:patrolling") */
  activityId: z.string().min(1),

  /** Faction-specific weight (1.0 = normal) */
  weight: z.number().min(0).default(1.0),
});

export type FactionActivityRef = z.infer<typeof factionActivityRefSchema>;

/**
 * Weighted goal for NPC generation.
 */
export const weightedGoalSchema = z.object({
  /** Goal identifier (e.g., "loot", "protect_territory") */
  goal: z.string().min(1),

  /** Base weight (0-1) */
  weight: z.number().min(0).max(1),

  /** GM description */
  description: z.string().optional(),

  /** Personality bonus: increased weight when NPC has matching trait */
  personalityBonus: z
    .array(
      z.object({
        trait: z.string(),
        multiplier: z.number(),
      })
    )
    .optional(),
});

export type WeightedGoal = z.infer<typeof weightedGoalSchema>;

// ============================================================================
// CultureData Schema
// ============================================================================

/**
 * Culture data embedded in factions.
 * All fields are optional - sub-factions inherit from parents.
 */
export const cultureDataSchema = z.object({
  /** Name generation patterns */
  naming: namingDataSchema.optional(),

  /** Personality trait pools */
  personality: personalityDataSchema.optional(),

  /** Quirk pool */
  quirks: z.array(weightedQuirkSchema).optional(),

  /** Values and behavioral tendencies */
  values: valuesDataSchema.optional(),

  /** Speech patterns for RP */
  speech: speechDataSchema.optional(),

  /** Activities for Flavour Step 4.1 (group-based) */
  activities: z.array(factionActivityRefSchema).optional(),

  /** Goals for NPC generation */
  goals: z.array(weightedGoalSchema).optional(),
});

export type CultureData = z.infer<typeof cultureDataSchema>;

// ============================================================================
// Faction Creature Group
// ============================================================================

/**
 * A group of creatures belonging to a faction.
 */
export const factionCreatureGroupSchema = z.object({
  /** Reference to creature template */
  creatureId: entityIdSchema('creature'),

  /** Number of this creature in the faction */
  count: z.number().int().nonnegative(),
});

export type FactionCreatureGroup = z.infer<typeof factionCreatureGroupSchema>;

// ============================================================================
// Encounter Template Schemas
// ============================================================================

/**
 * A slot in an encounter template defining creature composition.
 */
export const templateCreatureSlotSchema = z.object({
  /** Reference to creature template */
  creatureId: entityIdSchema('creature'),

  /** Number of creatures (fixed or range) */
  count: z.union([
    z.number().int().positive(),
    z.object({
      min: z.number().int().nonnegative(),
      max: z.number().int().positive(),
    }),
  ]),

  /** Role in the encounter */
  role: z.enum(['leader', 'elite', 'regular', 'support']),
});

export type TemplateCreatureSlot = z.infer<typeof templateCreatureSlotSchema>;

/**
 * Faction-specific encounter template.
 * Defines structured group compositions for encounters.
 */
export const factionEncounterTemplateSchema = z.object({
  /** Template identifier */
  id: z.string().min(1),

  /** Display name (e.g., "Späher-Trupp", "Horde") */
  name: z.string().min(1),

  /** GM description */
  description: z.string().optional(),

  /** Creature composition slots */
  composition: z.array(templateCreatureSlotSchema),

  /** When to use this template */
  triggers: z
    .object({
      /** Minimum XP budget */
      minXPBudget: z.number().optional(),

      /** Maximum XP budget */
      maxXPBudget: z.number().optional(),

      /** Compatible terrain types */
      terrainTypes: z.array(entityIdSchema('terrain')).optional(),

      /** Compatible encounter types */
      encounterTypes: z.array(z.string()).optional(),
    })
    .optional(),

  /** Relative probability (1.0 = normal, 0.1 = rare) */
  weight: z.number().min(0).default(1.0),
});

export type FactionEncounterTemplate = z.infer<
  typeof factionEncounterTemplateSchema
>;

// ============================================================================
// Faction Schema
// ============================================================================

/**
 * Schema for a faction definition.
 * Factions organize NPCs and creatures with embedded culture.
 */
export const factionSchema = z.object({
  /** Unique faction identifier */
  id: entityIdSchema('faction'),

  /** Display name */
  name: z.string().min(1),

  /** Parent faction ID for inheritance (optional) */
  parentId: entityIdSchema('faction').optional(),

  /** Faction status for dynamic world (active factions appear in encounters) */
  status: factionStatusSchema.default('active'),

  /** Culture data (embedded, not referenced) */
  culture: cultureDataSchema.default({}),

  /** Creatures belonging to this faction */
  creatures: z.array(factionCreatureGroupSchema).default([]),

  /** POIs controlled by this faction (for territory calculation) */
  controlledPOIs: z.array(entityIdSchema('poi')).default([]),

  /** Encounter templates for structured group compositions */
  encounterTemplates: z.array(factionEncounterTemplateSchema).optional(),

  /** Display color for territory overlay (hex format, e.g., "#4169E1") */
  displayColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),

  /** Default disposition toward party (-100 hostile to +100 friendly) */
  defaultDisposition: z.number().int().min(-100).max(100).default(0),

  /** Party reputation with this faction (-100 to +100, default 0) */
  reputationWithParty: z.number().int().min(-100).max(100).default(0),

  /** Description for GM reference */
  description: z.string().optional(),

  /** GM notes */
  gmNotes: z.string().optional(),
});

export type Faction = z.infer<typeof factionSchema>;

// ============================================================================
// Resolved Culture (after inheritance)
// ============================================================================

/**
 * Fully resolved culture data after merging inheritance chain.
 * All fields are arrays/objects, not optional.
 */
export const resolvedCultureSchema = z.object({
  naming: z.object({
    patterns: z.array(z.string()),
    prefixes: z.array(z.string()),
    roots: z.array(z.string()),
    suffixes: z.array(z.string()),
    titles: z.array(z.string()),
  }),
  personality: z.object({
    common: z.array(weightedTraitSchema),
    rare: z.array(weightedTraitSchema),
    forbidden: z.array(z.string()),
  }),
  quirks: z.array(weightedQuirkSchema),
  values: z.object({
    priorities: z.array(z.string()),
    taboos: z.array(z.string()),
    greetings: z.array(z.string()),
  }),
  speech: speechDataSchema.nullable(),
});

export type ResolvedCulture = z.infer<typeof resolvedCultureSchema>;

// ============================================================================
// Faction Presence (for encounter selection)
// ============================================================================

/**
 * Faction presence strength at a tile.
 */
export const factionPresenceSchema = z.object({
  factionId: entityIdSchema('faction'),
  strength: z.number().min(0).max(1),
});

export type FactionPresence = z.infer<typeof factionPresenceSchema>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Empty resolved culture (base for inheritance).
 */
export const EMPTY_RESOLVED_CULTURE: ResolvedCulture = {
  naming: {
    patterns: ['{root}'],
    prefixes: [],
    roots: ['Unknown'],
    suffixes: [],
    titles: [],
  },
  personality: {
    common: [],
    rare: [],
    forbidden: [],
  },
  quirks: [],
  values: {
    priorities: [],
    taboos: [],
    greetings: [],
  },
  speech: null,
};
