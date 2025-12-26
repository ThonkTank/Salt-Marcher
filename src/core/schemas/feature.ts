/**
 * Feature schema definitions.
 *
 * Features are environment effects for encounter balance and hazards.
 * Based on EntityRegistry.md specification (Lines 278-320).
 *
 * Features have creative names (e.g., "Dichte Dornen", "Schnappende Ranken")
 * and can define both balance modifiers and hazard effects.
 */

import { z } from 'zod';
import { entityIdSchema } from './common';

// ============================================================================
// Creature Property Schema
// ============================================================================

/**
 * Creature properties that features can modify.
 * Used for encounter balance calculations.
 */
export const creaturePropertySchema = z.enum([
  // Movement
  'fly',
  'swim',
  'climb',
  'burrow',
  'walk-only',
  // Senses
  'darkvision',
  'blindsight',
  'tremorsense',
  'trueSight',
  'no-special-sense',
  // Design Roles (MCDM)
  'ambusher',
  'artillery',
  'brute',
  'controller',
  'leader',
  'minion',
  'skirmisher',
  'soldier',
  'solo',
  'support',
]);

export type CreatureProperty = z.infer<typeof creaturePropertySchema>;

// ============================================================================
// Feature Modifier Schema
// ============================================================================

/**
 * Balance modifier for encounter calculations.
 * Adjusts creature effectiveness based on terrain features.
 */
export const featureModifierSchema = z.object({
  /** Which creature property is affected */
  target: creaturePropertySchema,
  /** Modifier value (e.g., -0.30 = 30% less effective, +0.15 = 15% more effective) */
  value: z.number(),
});

export type FeatureModifier = z.infer<typeof featureModifierSchema>;

// ============================================================================
// Hazard Schemas
// ============================================================================

/**
 * When the hazard triggers.
 */
export const hazardTriggerSchema = z.enum([
  'enter', // When entering the area
  'start-turn', // At the start of a turn in the area
  'end-turn', // At the end of a turn in the area
  'move-through', // When moving through the area
]);

export type HazardTrigger = z.infer<typeof hazardTriggerSchema>;

/**
 * Type of hazard effect.
 */
export const hazardEffectTypeSchema = z.enum([
  'damage', // Deal damage
  'condition', // Apply a condition
  'difficult-terrain', // Movement costs double
  'forced-movement', // Push/pull creatures
]);

export type HazardEffectType = z.infer<typeof hazardEffectTypeSchema>;

/**
 * Hazard effect details.
 */
export const hazardEffectSchema = z.object({
  /** Type of effect */
  type: hazardEffectTypeSchema,
  /** Damage details (for 'damage' type) */
  damage: z
    .object({
      dice: z.string(), // e.g., "1d4", "2d6"
      damageType: z.string(), // e.g., "piercing", "fire", "poison"
    })
    .optional(),
  /** Condition to apply (for 'condition' type) */
  condition: z.string().optional(), // e.g., "restrained", "poisoned"
  /** Distance in feet (for 'forced-movement' type) */
  distance: z.number().optional(),
});

export type HazardEffect = z.infer<typeof hazardEffectSchema>;

/**
 * Save requirement for a hazard.
 */
export const saveRequirementSchema = z.object({
  /** Ability used for the save (e.g., "dex", "con", "str") */
  ability: z.string(),
  /** Difficulty class */
  dc: z.number(),
});

export type SaveRequirement = z.infer<typeof saveRequirementSchema>;

/**
 * Attack requirement for a hazard (hazard rolls to hit).
 */
export const attackRequirementSchema = z.object({
  /** Attack bonus */
  bonus: z.number(),
});

export type AttackRequirement = z.infer<typeof attackRequirementSchema>;

/**
 * Complete hazard definition.
 */
export const hazardDefinitionSchema = z.object({
  /** When the hazard triggers */
  trigger: hazardTriggerSchema,
  /** What effect the hazard has */
  effect: hazardEffectSchema,
  /** Save requirement (target rolls) */
  save: saveRequirementSchema.optional(),
  /** Attack requirement (hazard rolls) */
  attack: attackRequirementSchema.optional(),
});

export type HazardDefinition = z.infer<typeof hazardDefinitionSchema>;

// ============================================================================
// Feature Schema
// ============================================================================

/**
 * Environment feature for encounter balance and hazards.
 *
 * Examples:
 * - "Dichte Dornen" (Dense Thorns): piercing damage on enter
 * - "Schnappende Ranken" (Snapping Vines): restrained condition
 * - "Dunkelheit" (Darkness): modifies no-darkvision creatures
 */
export const featureSchema = z.object({
  /** Unique feature identifier */
  id: entityIdSchema('feature'),

  /** Display name (creative, thematic) */
  name: z.string().min(1),

  /** Balance modifiers for encounter calculations */
  modifiers: z.array(featureModifierSchema).optional(),

  /** Hazard effects (damage, conditions, etc.) */
  hazard: hazardDefinitionSchema.optional(),

  /** Description for tooltips and flavor */
  description: z.string().optional(),
});

export type Feature = z.infer<typeof featureSchema>;
