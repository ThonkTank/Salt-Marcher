// Ziel: Konstanten für TriggerExpression Language
// Siehe: docs/plans/shimmering-orbiting-hopper.md
//
// Erweitert und re-exportiert Konstanten aus action.ts für TriggerExpression.
// Neue Konstanten hier, bestehende aus action.ts importieren.

// Re-exports aus action.ts
export {
  // Timing
  ACTION_TIMING_TYPES,
  type ActionTimingType,
  TRIGGER_EVENTS,
  type TriggerEvent,
  DURATION_TYPES,
  type DurationType,
  RECHARGE_TYPES,
  type RechargeType,
  REST_TYPES,
  type RestType,

  // Range & Zones
  RANGE_TYPES,
  type RangeType,
  AOE_SHAPES,
  type AoeShape,
  AOE_ORIGINS,
  type AoeOrigin,
  VALID_TARGETS,
  type ValidTargets,

  // Resolution
  ABILITY_TYPES,
  type AbilityType,
  SKILL_TYPES,
  type SkillType,
  SAVE_ON_SAVE_EFFECTS,
  type SaveOnSaveEffect,
  ADVANTAGE_CONDITIONS,
  type AdvantageCondition,

  // Effects
  EFFECT_TRIGGERS,
  type EffectTrigger,
  ZONE_TARGET_FILTERS,
  type ZoneTargetFilter,
  ESCAPE_CHECK_TYPES,
  type EscapeCheckType,
  DAMAGE_TYPES,
  type DamageType,
} from './action';

// ============================================================================
// TRIGGER-SPECIFIC CONSTANTS
// ============================================================================

/**
 * Timing types for TriggerExpression.
 * Unterschied zu ACTION_TIMING_TYPES: Nur für Trigger-System relevant.
 */
export const TRIGGER_TIMING_TYPES = [
  'action-cost',
  'reaction-cost',
  'legendary-cost',
  'lair-action',
  'mythic-action',
  'passive',
] as const;
export type TriggerTimingType = (typeof TRIGGER_TIMING_TYPES)[number];

/**
 * Zone types for TriggerExpression spatial triggers.
 */
export const ZONE_TYPES = [
  'self-only',
  'touch',
  'reach',
  'ranged',
  'sphere',
  'cone',
  'line',
  'cube',
  'cylinder',
  'multi-target',
] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

/**
 * Resolution types for TriggerExpression.
 */
export const RESOLUTION_TYPES = [
  'attack-roll',
  'spell-attack',
  'save-dc',
  'contested-check',
  'auto-success',
] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];

/**
 * Event types for reaction and zone triggers.
 * Extended from TRIGGER_EVENTS with more specific types.
 */
export const TRIGGER_EVENT_TYPES = [
  // Reaction triggers (from TRIGGER_EVENTS)
  'on-attacked',
  'on-hit',
  'on-damaged',
  'on-spell-cast',
  'on-ally-attacked',
  'on-ally-damaged',

  // Movement triggers
  'on-leaves-reach',
  'on-enters-reach',
  'on-enters-zone',

  // Turn-based triggers
  'on-start-turn',
  'on-end-turn',
] as const;
export type TriggerEventType = (typeof TRIGGER_EVENT_TYPES)[number];

/**
 * Duration types for TriggerExpression.
 * More specific than DURATION_TYPES for trigger context.
 */
export const TRIGGER_DURATION_TYPES = [
  'instant',
  'rounds',
  'minutes',
  'concentration',
  'until-save',
  'until-escape',
  'permanent',
] as const;
export type TriggerDurationType = (typeof TRIGGER_DURATION_TYPES)[number];

/**
 * Cost types for TriggerExpression.
 */
export const TRIGGER_COST_TYPES = [
  'spell-slot',
  'recharge',
  'per-day',
  'per-rest',
  'movement-cost',
  'resource-pool',
] as const;
export type TriggerCostType = (typeof TRIGGER_COST_TYPES)[number];

/**
 * Attack type filters for reaction triggers like Shield.
 */
export const ATTACK_TYPE_FILTERS = ['any', 'melee', 'ranged', 'spell'] as const;
export type AttackTypeFilter = (typeof ATTACK_TYPE_FILTERS)[number];

/**
 * Movement cost types for movement-cost trigger.
 */
export const MOVEMENT_COST_AMOUNTS = ['to-target', 'all'] as const;
export type MovementCostAmount = (typeof MOVEMENT_COST_AMOUNTS)[number];

/**
 * Escape timing for until-escape duration.
 */
export const ESCAPE_TIMINGS = ['action', 'bonus', 'movement'] as const;
export type EscapeTiming = (typeof ESCAPE_TIMINGS)[number];

/**
 * Save timing for until-save duration.
 */
export const SAVE_TIMINGS = ['start', 'end'] as const;
export type SaveTiming = (typeof SAVE_TIMINGS)[number];

/**
 * Composition node types for TriggerExpression.
 */
export const TRIGGER_COMPOSITION_TYPES = [
  'compose',
  'ref',
  'extends',
  'conditional',
] as const;
export type TriggerCompositionType = (typeof TRIGGER_COMPOSITION_TYPES)[number];
