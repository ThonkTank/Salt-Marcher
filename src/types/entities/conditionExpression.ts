// Ziel: Schema-driven Expression Language für situative Combat-Modifier
// Siehe: docs/services/combatantAI/combatantAI.md
//
// JSON-basierte DSL für Modifier-Conditions. Ermöglicht:
// - Creature Traits (Pack Tactics, Sneak Attack)
// - Spell Effects (Faerie Fire, Bless)
// - Item Properties (Magic Weapon bonuses)
//
// Architektur:
// - Logical Operators: and, or, not (recursive composition)
// - Entity Selectors: self, attacker, target, quantified groups
// - Spatial Predicates: adjacent-to, within-range, opposite-side
// - State Predicates: has-condition, is-incapacitated, hp-threshold
// - Action Predicates: action-has-property, action-range-type

import { z } from 'zod';
import {
  CONDITION_TYPES,
  RANGE_TYPES,
  ACTION_TYPES,
} from '../../constants/action';

// ============================================================================
// CONSTANTS
// ============================================================================

export const ENTITY_REFS = ['self', 'attacker', 'target'] as const;
export type EntityRef = (typeof ENTITY_REFS)[number];

export const ENTITY_FILTERS = ['ally', 'enemy', 'any-creature'] as const;
export type EntityFilter = (typeof ENTITY_FILTERS)[number];

export const QUANTIFIERS = ['any', 'all', 'count-gte'] as const;
export type Quantifier = (typeof QUANTIFIERS)[number];

export const HP_COMPARISONS = ['below', 'above', 'equal-or-below', 'equal-or-above'] as const;
export type HpComparison = (typeof HP_COMPARISONS)[number];

export const MODIFIER_OPERATIONS = ['add', 'multiply', 'set', 'min', 'max'] as const;
export type ModifierOperation = (typeof MODIFIER_OPERATIONS)[number];

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const entityRefSchema = z.enum(ENTITY_REFS);
export const entityFilterSchema = z.enum(ENTITY_FILTERS);
export const quantifierSchema = z.enum(QUANTIFIERS);
export const hpComparisonSchema = z.enum(HP_COMPARISONS);

// ============================================================================
// ENTITY SELECTION
// ============================================================================

/** Quantified entity selection for exists/count operations */
export const quantifiedEntitySchema = z.object({
  type: z.literal('quantified'),
  quantifier: quantifierSchema,
  count: z.number().int().positive().optional(), // Only for count-gte
  filter: entityFilterSchema,
  relativeTo: entityRefSchema.optional(), // Default: 'attacker'
});
export type QuantifiedEntity = z.infer<typeof quantifiedEntitySchema>;

// ============================================================================
// PREDICATE SCHEMAS (non-recursive)
// ============================================================================

// --- Spatial Predicates ---

/** Adjacent-to: subject is within 5ft (1 cell) of object */
export const adjacentToPredicateSchema = z.object({
  type: z.literal('adjacent-to'),
  subject: entityRefSchema,
  object: entityRefSchema,
});
export type AdjacentToPredicate = z.infer<typeof adjacentToPredicateSchema>;

/** Within-range: subject is within specified range of object */
export const withinRangePredicateSchema = z.object({
  type: z.literal('within-range'),
  subject: entityRefSchema,
  object: entityRefSchema,
  range: z.number().positive(), // in feet
});
export type WithinRangePredicate = z.infer<typeof withinRangePredicateSchema>;

/** Beyond-range: subject is beyond specified range from object */
export const beyondRangePredicateSchema = z.object({
  type: z.literal('beyond-range'),
  subject: entityRefSchema,
  object: entityRefSchema,
  range: z.number().positive(), // in feet
});
export type BeyondRangePredicate = z.infer<typeof beyondRangePredicateSchema>;

/** Opposite-side: subject is on opposite side of center from 'of' (flanking) */
export const oppositeSidePredicateSchema = z.object({
  type: z.literal('opposite-side'),
  subject: entityRefSchema,
  center: entityRefSchema,
  of: entityRefSchema,
  angle: z.number().min(0).max(360).optional(), // Default: 180 degrees
});
export type OppositeSidePredicate = z.infer<typeof oppositeSidePredicateSchema>;

/** In-line-between: entity is in line between from and to (cover check) */
export const inLineBetweenPredicateSchema = z.object({
  type: z.literal('in-line-between'),
  entity: entityRefSchema,
  from: entityRefSchema,
  to: entityRefSchema,
});
export type InLineBetweenPredicate = z.infer<typeof inLineBetweenPredicateSchema>;

/** Has-line-of-sight: from can see to */
export const hasLineOfSightPredicateSchema = z.object({
  type: z.literal('has-line-of-sight'),
  from: entityRefSchema,
  to: entityRefSchema,
});
export type HasLineOfSightPredicate = z.infer<typeof hasLineOfSightPredicateSchema>;

// --- Action Range Predicates ---

/** Target is in long range (distance > normal AND distance <= long) */
export const targetInLongRangePredicateSchema = z.object({
  type: z.literal('target-in-long-range'),
});
export type TargetInLongRangePredicate = z.infer<typeof targetInLongRangePredicateSchema>;

/** Target is beyond normal range (distance > normal) */
export const targetBeyondNormalRangePredicateSchema = z.object({
  type: z.literal('target-beyond-normal-range'),
});
export type TargetBeyondNormalRangePredicate = z.infer<typeof targetBeyondNormalRangePredicateSchema>;

// --- State Predicates ---

/** Has-condition: entity has specified D&D condition */
export const hasConditionPredicateSchema = z.object({
  type: z.literal('has-condition'),
  entity: entityRefSchema,
  condition: z.enum(CONDITION_TYPES),
  negate: z.boolean().optional(), // Default: false
});
export type HasConditionPredicate = z.infer<typeof hasConditionPredicateSchema>;

/** Is-incapacitated: entity has any incapacitating condition */
export const isIncapacitatedPredicateSchema = z.object({
  type: z.literal('is-incapacitated'),
  entity: entityRefSchema,
  negate: z.boolean().optional(), // Default: false
});
export type IsIncapacitatedPredicate = z.infer<typeof isIncapacitatedPredicateSchema>;

/** HP-threshold: entity HP is above/below percentage */
export const hpThresholdPredicateSchema = z.object({
  type: z.literal('hp-threshold'),
  entity: entityRefSchema,
  comparison: hpComparisonSchema,
  threshold: z.number().min(0).max(100), // percentage
});
export type HpThresholdPredicate = z.infer<typeof hpThresholdPredicateSchema>;

/** Is-ally: entity is allied with relativeTo (default: attacker) */
export const isAllyPredicateSchema = z.object({
  type: z.literal('is-ally'),
  entity: entityRefSchema,
  relativeTo: entityRefSchema.optional(), // Default: 'attacker'
});
export type IsAllyPredicate = z.infer<typeof isAllyPredicateSchema>;

/** Is-enemy: entity is hostile to relativeTo (default: attacker) */
export const isEnemyPredicateSchema = z.object({
  type: z.literal('is-enemy'),
  entity: entityRefSchema,
  relativeTo: entityRefSchema.optional(), // Default: 'attacker'
});
export type IsEnemyPredicate = z.infer<typeof isEnemyPredicateSchema>;

/** Has-advantage: attacker currently has advantage (from other sources) */
export const hasAdvantagePredicateSchema = z.object({
  type: z.literal('has-advantage'),
});
export type HasAdvantagePredicate = z.infer<typeof hasAdvantagePredicateSchema>;

/** Is-creature-type: entity matches specific creature definition ID (for Aura of Authority, etc.) */
export const isCreatureTypePredicateSchema = z.object({
  type: z.literal('is-creature-type'),
  entity: entityRefSchema,
  creatureId: z.string().min(1),
});
export type IsCreatureTypePredicate = z.infer<typeof isCreatureTypePredicateSchema>;

// --- Action Predicates ---

/** Action has specific property (finesse, light, heavy, etc.) */
export const actionHasPropertyPredicateSchema = z.object({
  type: z.literal('action-has-property'),
  property: z.string().min(1),
});
export type ActionHasPropertyPredicate = z.infer<typeof actionHasPropertyPredicateSchema>;

/** Action is of specific type (melee-weapon, ranged-spell, etc.) */
export const actionIsTypePredicateSchema = z.object({
  type: z.literal('action-is-type'),
  actionType: z.enum(ACTION_TYPES),
});
export type ActionIsTypePredicate = z.infer<typeof actionIsTypePredicateSchema>;

/** Action range type (reach, ranged, self, touch) */
export const actionRangeTypePredicateSchema = z.object({
  type: z.literal('action-range-type'),
  rangeType: z.enum(RANGE_TYPES),
});
export type ActionRangeTypePredicate = z.infer<typeof actionRangeTypePredicateSchema>;

// ============================================================================
// CONDITION EXPRESSION (Recursive Discriminated Union)
// ============================================================================

/** AND: All conditions must be true */
export interface AndExpression {
  type: 'and';
  conditions: ConditionExpression[];
}

/** OR: At least one condition must be true */
export interface OrExpression {
  type: 'or';
  conditions: ConditionExpression[];
}

/** NOT: Condition must be false */
export interface NotExpression {
  type: 'not';
  condition: ConditionExpression;
}

/** EXISTS: At least one entity matching filter satisfies where clause */
export interface ExistsExpression {
  type: 'exists';
  entity: QuantifiedEntity;
  where?: ConditionExpression; // Optional filter for matched entities
}

/** Base type for all condition expressions */
export type ConditionExpression =
  // Logical operators
  | AndExpression
  | OrExpression
  | NotExpression
  | ExistsExpression
  // Spatial predicates
  | AdjacentToPredicate
  | WithinRangePredicate
  | BeyondRangePredicate
  | OppositeSidePredicate
  | InLineBetweenPredicate
  | HasLineOfSightPredicate
  // Action range predicates
  | TargetInLongRangePredicate
  | TargetBeyondNormalRangePredicate
  // State predicates
  | HasConditionPredicate
  | IsIncapacitatedPredicate
  | HpThresholdPredicate
  | IsAllyPredicate
  | IsEnemyPredicate
  | HasAdvantagePredicate
  | IsCreatureTypePredicate
  // Action predicates
  | ActionHasPropertyPredicate
  | ActionIsTypePredicate
  | ActionRangeTypePredicate;

/**
 * Lazy schema for recursive structure.
 * Uses z.ZodType annotation to allow recursive references.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const conditionExpressionSchema: z.ZodType<ConditionExpression> = z.lazy((): any =>
  z.discriminatedUnion('type', [
    // Logical operators
    z.object({
      type: z.literal('and'),
      conditions: z.array(conditionExpressionSchema).min(2),
    }),
    z.object({
      type: z.literal('or'),
      conditions: z.array(conditionExpressionSchema).min(2),
    }),
    z.object({
      type: z.literal('not'),
      condition: conditionExpressionSchema,
    }),
    z.object({
      type: z.literal('exists'),
      entity: quantifiedEntitySchema,
      where: conditionExpressionSchema.optional(),
    }),
    // Spatial predicates
    adjacentToPredicateSchema,
    withinRangePredicateSchema,
    beyondRangePredicateSchema,
    oppositeSidePredicateSchema,
    inLineBetweenPredicateSchema,
    hasLineOfSightPredicateSchema,
    // Action range predicates
    targetInLongRangePredicateSchema,
    targetBeyondNormalRangePredicateSchema,
    // State predicates
    hasConditionPredicateSchema,
    isIncapacitatedPredicateSchema,
    hpThresholdPredicateSchema,
    isAllyPredicateSchema,
    isEnemyPredicateSchema,
    hasAdvantagePredicateSchema,
    isCreatureTypePredicateSchema,
    // Action predicates
    actionHasPropertyPredicateSchema,
    actionIsTypePredicateSchema,
    actionRangeTypePredicateSchema,
  ])
);

// ============================================================================
// PROPERTY MODIFIERS
// ============================================================================

/**
 * Generic property modifier that can target any action property via JSON path.
 *
 * Examples:
 * - { path: 'range.normal', operation: 'add', value: 5 }  // Long-Limbed trait
 * - { path: 'attack.bonus', operation: 'add', value: 1 }  // Magic Weapon
 * - { path: 'damage.modifier', operation: 'add', value: 2 }  // Rage
 */
export const propertyModifierSchema = z.object({
  path: z.string().min(1), // JSON path to property: 'range.normal', 'attack.bonus'
  operation: z.enum(MODIFIER_OPERATIONS),
  value: z.union([z.number(), z.boolean(), z.string()]),
});
export type PropertyModifier = z.infer<typeof propertyModifierSchema>;

// ============================================================================
// MODIFIER EFFECT
// ============================================================================

/** Effect produced by a schema modifier */
export const schemaModifierEffectSchema = z.object({
  // Legacy fields (kept for compatibility)
  advantage: z.boolean().optional(),
  disadvantage: z.boolean().optional(),
  attackBonus: z.number().optional(),
  acBonus: z.number().optional(),
  damageBonus: z.union([z.number(), z.string()]).optional(), // number or dice expression
  autoCrit: z.boolean().optional(),
  autoMiss: z.boolean().optional(),

  // Generic property modifiers
  propertyModifiers: z.array(propertyModifierSchema).optional(),
});
export type SchemaModifierEffect = z.infer<typeof schemaModifierEffectSchema>;

// ============================================================================
// SCHEMA MODIFIER DEFINITION
// ============================================================================

/** A complete schema-driven modifier definition */
export const schemaModifierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  condition: conditionExpressionSchema,
  effect: schemaModifierEffectSchema,
  priority: z.number().optional(), // Higher = evaluated first
});
export type SchemaModifier = z.infer<typeof schemaModifierSchema>;
