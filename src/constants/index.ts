// Constants Index
// Siehe: docs/architecture/constants.md

// Creature
export {
  CREATURE_SIZES,
  type CreatureSize,
  CARRY_CAPACITY_BY_SIZE,
  DESIGN_ROLES,
  type DesignRole,
  DISPOSITIONS,
  type Disposition,
  DISPOSITION_THRESHOLDS,
  BASE_DISPOSITION_VALUES,
  NOISE_LEVELS,
  type NoiseLevel,
  SCENT_STRENGTHS,
  type ScentStrength,
  STEALTH_ABILITIES,
  type StealthAbility,
  CR_TO_XP,
} from './creature';

// Encounter
export {
  ENCOUNTER_TRIGGERS,
  type EncounterTrigger,
  NARRATIVE_ROLES,
  type NarrativeRole,
  DIFFICULTY_LABELS,
  type DifficultyLabel,
  GROUP_STATUSES,
  type GroupStatus,
  CREATURE_WEIGHTS,
  type Activity,
  ACTIVITY_DEFINITIONS,
  GENERIC_ACTIVITY_IDS,
  type GenericActivityId,
  NPC_ROLE_WEIGHTS,
  CR_DECAY_RATE,
  MIN_CR_WEIGHT,
  LAYER_CASCADE_RATIO,
} from './encounter';

// Faction
export { FACTION_STATUSES, type FactionStatus } from './faction';

// NPC
export {
  NPC_STATUSES,
  type NPCStatus,
  FALLBACK_NPC_NAMES,
  DEFAULT_PERSONALITY,
  DEFAULT_NPC_GOAL,
  QUIRK_GENERATION_CHANCE,
  TRAIT_WEIGHTS,
} from './npc';

// Terrain
export {
  MAP_TYPES,
  type MapType,
  WIND_EXPOSURES,
  type WindExposure,
  ENVIRONMENTAL_POOL_TYPES,
  type EnvironmentalPoolType,
  WEATHER_CATEGORIES,
  type WeatherCategory,
} from './terrain';

// Time
export { TIME_SEGMENTS, type TimeSegment } from './time';

// Config (separate, da keine einfachen Konstanten)
export * from './encounterConfig';

// Loot
export {
  GOLD_PER_XP_BY_LEVEL,
  type GoldPerXPByLevel,
  WEALTH_MULTIPLIERS,
  type WealthMultipliers,
  type WealthTag,
  LOOT_MULTIPLIER,
  CR_TO_LEVEL_MAP,
} from './loot';

// Item
export {
  ITEM_CATEGORIES,
  type ItemCategory,
  ITEM_RARITIES,
  type ItemRarity,
  ITEM_TAGS,
  type ItemTag,
} from './item';

// Culture
export {
  FACTION_CULTURE_BOOST,
  SPECIES_COMPATIBILITY_BOOST,
  PARENT_CULTURE_BOOST,
  DEFAULT_TOLERANCE,
} from './culture';

// Weather
export {
  SEASON_TEMPERATURE_OFFSET,
  type Season,
  TIME_TEMPERATURE_OFFSET,
  ELEVATION_TEMPERATURE_FACTOR,
  WIND_CATEGORIES,
  TEMPERATURE_CATEGORIES,
  DEFAULT_PRESSURE_RANGE,
  MOUNTAIN_PRESSURE_RANGE,
  COAST_PRESSURE_RANGE,
} from './weather';

// Action
export {
  ACTION_TYPES,
  type ActionType,
  ACTION_SOURCES,
  type ActionSource,
  DAMAGE_TYPES,
  type DamageType,
  ABILITY_TYPES,
  type AbilityType,
  CONDITION_TYPES,
  type ConditionType,
  DURATION_TYPES,
  type DurationType,
  ACTION_TIMING_TYPES,
  type ActionTimingType,
  TRIGGER_EVENTS,
  type TriggerEvent,
  RANGE_TYPES,
  type RangeType,
  AOE_SHAPES,
  type AoeShape,
  AOE_ORIGINS,
  type AoeOrigin,
  TARGETING_TYPES,
  type TargetingType,
  SAVE_ON_SAVE_EFFECTS,
  type SaveOnSaveEffect,
  ADVANTAGE_CONDITIONS,
  type AdvantageCondition,
  MODIFIABLE_STATS,
  type ModifiableStat,
  ROLL_TARGETS,
  type RollTarget,
  STAT_MODIFIER_TYPES,
  type StatModifierType,
  ROLL_MODIFIER_TYPES,
  type RollModifierType,
  DAMAGE_MODIFIER_TYPES,
  type DamageModifierType,
  MOVEMENT_MODIFIER_TYPES,
  type MovementModifierType,
  MOVEMENT_MODES,
  type MovementMode,
  FORCED_MOVEMENT_TYPES,
  type ForcedMovementType,
  FORCED_MOVEMENT_DIRECTIONS,
  type ForcedMovementDirection,
  AFFECTS_TARGETS,
  type AffectsTarget,
  TERRAIN_EFFECTS,
  type TerrainEffect,
  BONUS_CONDITIONS,
  type BonusCondition,
  CONDITIONAL_BONUS_TYPES,
  type ConditionalBonusType,
  COUNTER_TARGETS,
  type CounterTarget,
  SUMMON_CONTROLS,
  type SummonControl,
  TRANSFORM_TARGETS,
  type TransformTarget,
  HP_THRESHOLD_COMPARISONS,
  type HpThresholdComparison,
  SKILL_TYPES,
  type SkillType,
  RECHARGE_TYPES,
  type RechargeType,
  REST_TYPES,
  type RestType,
} from './action';
