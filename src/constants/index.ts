// Constants Index
// Siehe: docs/architecture/constants.md

// Creature
export {
  CREATURE_SIZES,
  type CreatureSize,
  DESIGN_ROLES,
  type DesignRole,
  DISPOSITIONS,
  type Disposition,
  NOISE_LEVELS,
  type NoiseLevel,
  SCENT_STRENGTHS,
  type ScentStrength,
  STEALTH_ABILITIES,
  type StealthAbility,
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
} from './encounter';

// Faction
export { FACTION_STATUSES, type FactionStatus } from './faction';

// NPC
export { NPC_STATUSES, type NPCStatus } from './npc';

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
