/**
 * Creature schema definitions.
 *
 * CreatureDefinition is a template/statblock for monsters and NPCs.
 * Used by Encounter-Feature for creature selection and Combat-Feature for instances.
 *
 * @see docs/domain/Creature.md
 */

import { z } from 'zod';
import { entityIdSchema, timeSegmentSchema } from './common';
import { conditionSchema } from './combat';
import { weightedActivitySchema } from './encounter';

// ============================================================================
// Sub-Schemas
// ============================================================================

/**
 * Creature size categories (D&D 5e).
 */
export const creatureSizeSchema = z.enum([
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan',
]);

export type CreatureSize = z.infer<typeof creatureSizeSchema>;

/**
 * Creature disposition determines default behavior toward party.
 */
export const creatureDispositionSchema = z.enum([
  'hostile',
  'neutral',
  'friendly',
]);

export type CreatureDisposition = z.infer<typeof creatureDispositionSchema>;

/**
 * D&D 5e ability scores.
 */
export const abilityScoresSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});

export type AbilityScores = z.infer<typeof abilityScoresSchema>;

/**
 * Movement speeds in feet.
 */
export const speedBlockSchema = z.object({
  walk: z.number().nonnegative(),
  fly: z.number().nonnegative().optional(),
  swim: z.number().nonnegative().optional(),
  climb: z.number().nonnegative().optional(),
  burrow: z.number().nonnegative().optional(),
});

export type SpeedBlock = z.infer<typeof speedBlockSchema>;

/**
 * Creature preferences for weighted encounter selection.
 * Values: 2.0 = preferred, 1.0 = normal, 0.5 = rare, 0 = never.
 */
export const creaturePreferencesSchema = z.object({
  /** Terrain-specific weight modifiers */
  terrain: z.record(z.string(), z.number().nonnegative()).optional(),

  /** Time-of-day weight modifiers */
  timeOfDay: z.record(timeSegmentSchema, z.number().nonnegative()).optional(),

  /** Weather condition weight modifiers */
  weather: z.record(z.string(), z.number().nonnegative()).optional(),

  /** Altitude range preference (for mountain creatures) */
  altitude: z
    .object({
      min: z.number(),
      max: z.number(),
    })
    .optional(),
});

export type CreaturePreferences = z.infer<typeof creaturePreferencesSchema>;

// ============================================================================
// Detection Profile Schemas (Task #2950, #2949)
// ============================================================================

/**
 * Stealth abilities that affect creature detection.
 * Used by Encounter-System for perception calculations.
 *
 * @see docs/domain/Creature.md#stealthability
 * @see docs/features/Encounter-System.md#stealth-ability-effekte
 */
export const stealthAbilitySchema = z.enum([
  'burrowing', // Can travel underground - visual: 0ft, audio: normal
  'invisibility', // Can become invisible - visual: 0ft
  'ethereal', // On another plane - all senses: 0ft
  'shapechange', // Can assume harmless form - no auto-detection
  'mimicry', // Can imitate sounds - audio detection may mislead
  'ambusher', // Has ambush behavior - triggers ambush check
]);

export type StealthAbility = z.infer<typeof stealthAbilitySchema>;

/**
 * Noise level for auditory detection.
 * Determines base audio detection range.
 *
 * @see docs/features/Encounter-System.md#audio-range-tabelle
 */
export const noiseLevelSchema = z.enum([
  'silent', // 0ft base range
  'quiet', // 30ft base range
  'normal', // 60ft base range
  'loud', // 200ft base range
  'deafening', // 500ft base range
]);

export type NoiseLevel = z.infer<typeof noiseLevelSchema>;

/**
 * Scent strength for olfactory detection.
 * Determines base scent detection range.
 *
 * @see docs/features/Encounter-System.md#scent-range-tabelle
 */
export const scentStrengthSchema = z.enum([
  'none', // 0ft base range
  'faint', // 30ft base range (0ft in wind/rain)
  'moderate', // 60ft base range
  'strong', // 150ft base range
  'overwhelming', // 300ft base range
]);

export type ScentStrength = z.infer<typeof scentStrengthSchema>;

/**
 * Detection profile for a creature.
 * REQUIRED on CreatureDefinition for Encounter-System perception calculations.
 *
 * @see docs/domain/Creature.md#detection-profil
 * @see docs/features/Encounter-System.md#calculatedetection
 */
export const creatureDetectionProfileSchema = z.object({
  /** How loud is the creature? Affects auditory detection range. */
  noiseLevel: noiseLevelSchema,

  /** How strong is the creature's scent? Affects olfactory detection range. */
  scentStrength: scentStrengthSchema,

  /** Stealth abilities that can reduce or negate detection. */
  stealthAbilities: z.array(stealthAbilitySchema).optional(),
});

export type CreatureDetectionProfile = z.infer<
  typeof creatureDetectionProfileSchema
>;

/**
 * Default detection profile for creatures without explicit profile.
 * Used as fallback during migration period.
 */
export const DEFAULT_DETECTION_PROFILE: CreatureDetectionProfile = {
  noiseLevel: 'normal',
  scentStrength: 'faint',
};

// ============================================================================
// DefaultLoot Schema
// ============================================================================

/**
 * Entry for default loot that a creature may drop.
 * Used by Loot-Feature during encounter processing.
 *
 * @see docs/domain/Creature.md#defaultloot
 */
export const defaultLootEntrySchema = z.object({
  /** Reference to the item */
  itemId: entityIdSchema('item'),

  /** Drop chance (0.0-1.0, where 1.0 = guaranteed) */
  chance: z.number().min(0).max(1),

  /** Quantity: fixed number or [min, max] range */
  quantity: z
    .union([
      z.number().int().positive(),
      z.tuple([z.number().int().positive(), z.number().int().positive()]),
    ])
    .optional(),
});

export type DefaultLootEntry = z.infer<typeof defaultLootEntrySchema>;

// ============================================================================
// CreatureDefinition Schema
// ============================================================================

/**
 * Schema for a creature definition (template/statblock).
 * This is a reusable template - runtime instances are created during Encounter/Combat.
 *
 * The Creature-Hierarchy:
 * - CreatureDefinition: Template/Statblock (EntityRegistry)
 * - Creature: Runtime instance during Encounter/Combat (not persisted)
 * - NPC: Named persistent instance with personality (EntityRegistry)
 *
 * @see docs/domain/Creature.md
 * @see docs/architecture/EntityRegistry.md#creature-hierarchie-definition-vs-instanz-vs-npc
 */
export const creatureDefinitionSchema = z.object({
  /** Unique creature identifier */
  id: entityIdSchema('creature'),

  /** Display name (e.g., "Goblin", "Dire Wolf") */
  name: z.string().min(1),

  // === Base Statistics ===

  /** Challenge Rating (e.g., 0.25 for CR 1/4, 1 for CR 1) */
  cr: z.number().nonnegative(),

  /** Maximum hit points */
  maxHp: z.number().int().positive(),

  /** Armor class */
  ac: z.number().int().positive(),

  /** Creature size category */
  size: creatureSizeSchema,

  // === Categorization ===

  /** Tags for filtering (e.g., ["humanoid", "goblinoid"]) */
  tags: z.array(z.string()).default([]),

  /** Default disposition toward party */
  disposition: creatureDispositionSchema,

  // === Encounter System: Where/When ===

  /** Terrain types where this creature can appear (filter) */
  terrainAffinities: z.array(entityIdSchema('terrain')).min(1),

  /** Time segments when creature is active (filter) */
  activeTime: z.array(timeSegmentSchema).min(1),

  /** Optional weight modifiers for fine-tuning (soft preferences) */
  preferences: creaturePreferencesSchema.optional(),

  /**
   * Detection profile for perception calculations.
   * Determines how easily the creature can be detected (auditory, olfactory).
   * Optional during migration - use DEFAULT_DETECTION_PROFILE as fallback.
   *
   * @see docs/domain/Creature.md#detection-profil
   * @see docs/features/Encounter-System.md#calculatedetection
   */
  detectionProfile: creatureDetectionProfileSchema.optional(),

  /**
   * Creature-type-specific activities for encounter groups.
   * Medium priority in the Activity-Pool-Hierarchy (below faction, above generic).
   *
   * @see docs/features/Encounter-System.md#activity-pool-hierarchie
   */
  activities: z.array(weightedActivitySchema).optional(),

  // === Loot System ===

  /** Tags for loot generation (e.g., ["humanoid", "poor", "tribal"]) */
  lootTags: z.array(z.string()).default([]),

  /** Default loot that this creature may drop (guaranteed/probable items) */
  defaultLoot: z.array(defaultLootEntrySchema).optional(),

  // === D&D 5e Statblock (MVP subset) ===

  /** Ability scores */
  abilities: abilityScoresSchema,

  /** Movement speeds */
  speed: speedBlockSchema,

  /** Languages known (for social encounters) */
  languages: z.array(z.string()).default([]),

  /** Actions (simplified for MVP: just names/descriptions) */
  actions: z.array(z.string()).default([]),

  // === Metadata ===

  /** Description for GM reference */
  description: z.string().optional(),

  /** Source reference (e.g., "Monster Manual, p. 166") */
  source: z.string().optional(),

  /** Faction this creature belongs to (optional, can be overridden by NPC) */
  defaultFactionId: entityIdSchema('faction').optional(),
});

export type CreatureDefinition = z.infer<typeof creatureDefinitionSchema>;

// ============================================================================
// Creature Runtime Instance (not persisted)
// ============================================================================

/**
 * Schema for a creature runtime instance during Encounter/Combat.
 * NOT stored in EntityRegistry - exists only in Feature state.
 *
 * This is distinct from CreatureDefinition (template) and NPC (persistent instance).
 *
 * @see docs/domain/Creature.md#creature-runtime
 * @see docs/architecture/EntityRegistry.md#creature-hierarchie-definition-vs-instanz-vs-npc
 */
export const creatureSchema = z.object({
  /** Unique runtime instance ID */
  instanceId: z.string().min(1),

  /** Reference to the creature template */
  definitionId: entityIdSchema('creature'),

  // === Current State ===

  /** Current hit points */
  currentHp: z.number().int(),

  /** Temporary hit points */
  tempHp: z.number().int().nonnegative().default(0),

  /** Active conditions (full Condition objects per spec) */
  conditions: z.array(conditionSchema).default([]),

  // === Combat State ===

  /** Initiative roll result */
  initiative: z.number().optional(),

  /** Whether creature has acted this round */
  hasActed: z.boolean().default(false),

  /** Spell being concentrated on */
  concentrationSpell: z.string().optional(),
});

export type Creature = z.infer<typeof creatureSchema>;

/**
 * @deprecated Use `creatureSchema` instead. Will be removed in next major version.
 */
export const creatureInstanceSchema = creatureSchema;

/**
 * @deprecated Use `Creature` instead. Will be removed in next major version.
 */
export type CreatureInstance = Creature;

// ============================================================================
// CreatureRef (for NPC linking)
// ============================================================================

/**
 * Reference to a creature template from an NPC.
 */
export const creatureRefSchema = z.object({
  /** Creature type name (e.g., "goblin") */
  type: z.string().min(1),

  /** Reference to the creature template */
  id: entityIdSchema('creature'),
});

export type CreatureRef = z.infer<typeof creatureRefSchema>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Default ability scores for a typical commoner.
 */
export const DEFAULT_ABILITY_SCORES: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

/**
 * Default speed block for humanoid creatures.
 */
export const DEFAULT_SPEED: SpeedBlock = {
  walk: 30,
};
