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
