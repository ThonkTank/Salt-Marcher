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

  /** Culture data (embedded, not referenced) */
  culture: cultureDataSchema.default({}),

  /** Creatures belonging to this faction */
  creatures: z.array(factionCreatureGroupSchema).default([]),

  /** POIs controlled by this faction (for territory calculation) */
  controlledPOIs: z.array(entityIdSchema('poi')).default([]),

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
