// Action-bezogene Konstanten
// Siehe: docs/types/action.md

// ============================================================================
// ACTION CLASSIFICATION
// ============================================================================

export const ACTION_TYPES = [
  'melee-weapon',
  'ranged-weapon',
  'melee-spell',
  'ranged-spell',
  'save-effect',
  'aoe',
  'healing',
  'buff',
  'debuff',
  'utility',
  'summon',
  'transform',
  'counter',
  'multiattack',
  'lair',
  'legendary',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_SOURCES = [
  'class',
  'race',
  'item',
  'spell',
  'innate',
  'lair',
] as const;
export type ActionSource = (typeof ACTION_SOURCES)[number];

// ============================================================================
// DAMAGE & ABILITIES
// ============================================================================

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const ABILITY_TYPES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityType = (typeof ABILITY_TYPES)[number];

// ============================================================================
// CONDITIONS
// ============================================================================

export const CONDITION_TYPES = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
  'exhaustion',
] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

// ============================================================================
// TIMING & DURATION
// ============================================================================

export const DURATION_TYPES = [
  'instant',
  'rounds',
  'minutes',
  'hours',
  'until-save',
  'concentration',
  'until-long-rest',
] as const;
export type DurationType = (typeof DURATION_TYPES)[number];

export const ACTION_TIMING_TYPES = [
  'action',
  'bonus',
  'reaction',
  'legendary',
  'lair',
  'mythic',
  'free',
] as const;
export type ActionTimingType = (typeof ACTION_TIMING_TYPES)[number];

export const TRIGGER_EVENTS = [
  'attacked',
  'damaged',
  'spell-cast',
  'movement',
  'start-turn',
  'end-turn',
  'ally-attacked',
  'ally-damaged',
  'enters-reach',
  'leaves-reach',
] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

// ============================================================================
// RANGE & TARGETING
// ============================================================================

export const RANGE_TYPES = ['reach', 'ranged', 'self', 'touch'] as const;
export type RangeType = (typeof RANGE_TYPES)[number];

export const AOE_SHAPES = ['sphere', 'cube', 'cone', 'line', 'cylinder'] as const;
export type AoeShape = (typeof AOE_SHAPES)[number];

export const AOE_ORIGINS = ['self', 'point', 'creature'] as const;
export type AoeOrigin = (typeof AOE_ORIGINS)[number];

export const TARGETING_TYPES = ['single', 'multiple', 'area'] as const;
export type TargetingType = (typeof TARGETING_TYPES)[number];

// ============================================================================
// SAVES & ROLLS
// ============================================================================

export const SAVE_ON_SAVE_EFFECTS = ['none', 'half', 'special'] as const;
export type SaveOnSaveEffect = (typeof SAVE_ON_SAVE_EFFECTS)[number];

export const ADVANTAGE_CONDITIONS = ['always', 'conditional', 'none'] as const;
export type AdvantageCondition = (typeof ADVANTAGE_CONDITIONS)[number];

// ============================================================================
// MODIFIERS
// ============================================================================

export const MODIFIABLE_STATS = [
  'ac',
  'speed',
  'attack',
  'damage',
  'saves',
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
  'str-save',
  'dex-save',
  'con-save',
  'int-save',
  'wis-save',
  'cha-save',
  'initiative',
  'spell-dc',
] as const;
export type ModifiableStat = (typeof MODIFIABLE_STATS)[number];

export const ROLL_TARGETS = [
  'attacks',
  'saves',
  'ability-checks',
  'concentration',
  'death-saves',
  'str-checks',
  'dex-checks',
  'stealth',
  'perception',
  'initiative',
] as const;
export type RollTarget = (typeof ROLL_TARGETS)[number];

export const STAT_MODIFIER_TYPES = ['bonus', 'set', 'multiply'] as const;
export type StatModifierType = (typeof STAT_MODIFIER_TYPES)[number];

export const ROLL_MODIFIER_TYPES = [
  'advantage',
  'disadvantage',
  'auto-success',
  'auto-fail',
] as const;
export type RollModifierType = (typeof ROLL_MODIFIER_TYPES)[number];

export const DAMAGE_MODIFIER_TYPES = [
  'resistance',
  'immunity',
  'vulnerability',
] as const;
export type DamageModifierType = (typeof DAMAGE_MODIFIER_TYPES)[number];

// ============================================================================
// MOVEMENT
// ============================================================================

export const MOVEMENT_MODIFIER_TYPES = [
  'speed',
  'fly',
  'swim',
  'climb',
  'burrow',
  'teleport',
] as const;
export type MovementModifierType = (typeof MOVEMENT_MODIFIER_TYPES)[number];

export const MOVEMENT_MODES = ['grant', 'bonus'] as const;
export type MovementMode = (typeof MOVEMENT_MODES)[number];

export const FORCED_MOVEMENT_TYPES = [
  'push',
  'pull',
  'teleport',
  'swap',
  'prone',
] as const;
export type ForcedMovementType = (typeof FORCED_MOVEMENT_TYPES)[number];

export const FORCED_MOVEMENT_DIRECTIONS = [
  'away',
  'toward',
  'chosen',
  'vertical',
] as const;
export type ForcedMovementDirection = (typeof FORCED_MOVEMENT_DIRECTIONS)[number];

// ============================================================================
// EFFECTS & TERRAIN
// ============================================================================

export const AFFECTS_TARGETS = ['self', 'ally', 'enemy', 'any'] as const;
export type AffectsTarget = (typeof AFFECTS_TARGETS)[number];

export const TERRAIN_EFFECTS = [
  'difficult',
  'magical-darkness',
  'silence',
  'fog',
] as const;
export type TerrainEffect = (typeof TERRAIN_EFFECTS)[number];

// ============================================================================
// CONDITIONAL BONUSES
// ============================================================================

export const BONUS_CONDITIONS = [
  'moved-distance',
  'ally-adjacent',
  'target-prone',
  'target-restrained',
  'below-half-hp',
  'first-attack',
  'hidden',
  'higher-ground',
  'darkness',
] as const;
export type BonusCondition = (typeof BONUS_CONDITIONS)[number];

export const CONDITIONAL_BONUS_TYPES = [
  'damage',
  'attack',
  'advantage',
  'crit-range',
] as const;
export type ConditionalBonusType = (typeof CONDITIONAL_BONUS_TYPES)[number];

// ============================================================================
// SPECIAL ACTIONS
// ============================================================================

export const COUNTER_TARGETS = [
  'spell',
  'condition',
  'curse',
  'disease',
  'charm',
  'frightened',
  'any-magic',
] as const;
export type CounterTarget = (typeof COUNTER_TARGETS)[number];

export const SUMMON_CONTROLS = ['friendly', 'hostile', 'uncontrolled'] as const;
export type SummonControl = (typeof SUMMON_CONTROLS)[number];

export const TRANSFORM_TARGETS = ['beast', 'creature', 'object', 'specific'] as const;
export type TransformTarget = (typeof TRANSFORM_TARGETS)[number];

// ============================================================================
// HP & CRITICAL
// ============================================================================

export const HP_THRESHOLD_COMPARISONS = ['below', 'above', 'equal-or-below'] as const;
export type HpThresholdComparison = (typeof HP_THRESHOLD_COMPARISONS)[number];

// ============================================================================
// SKILLS (for ContestedCheck)
// ============================================================================

export const SKILL_TYPES = [
  'acrobatics',
  'animal-handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight-of-hand',
  'stealth',
  'survival',
] as const;
export type SkillType = (typeof SKILL_TYPES)[number];

// ============================================================================
// RECHARGE TYPES
// ============================================================================

export const RECHARGE_TYPES = [
  'at-will',
  'recharge',
  'per-day',
  'per-rest',
  'legendary',
  'lair',
  'mythic',
] as const;
export type RechargeType = (typeof RECHARGE_TYPES)[number];

export const REST_TYPES = ['short', 'long'] as const;
export type RestType = (typeof REST_TYPES)[number];
