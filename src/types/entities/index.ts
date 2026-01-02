// Entity Types Index
// Siehe: docs/architecture/types.md

// Creature
export {
  creatureDefinitionSchema,
  type CreatureDefinition,
  type CreatureId,
  creatureInstanceSchema,
  type CreatureInstance,
  // Sub-schemas
  sizeSchema,
  baseDispositionSchema,
  designRoleSchema,
  abilityScoresSchema,
  type AbilityScores,
  speedBlockSchema,
  type SpeedBlock,
  sensesSchema,
  type Senses,
  noiseLevelSchema,
  scentStrengthSchema,
  stealthAbilitySchema,
  detectionProfileSchema,
  type DetectionProfile,
  countRangeSchema,
  type CountRange,
  creaturePreferencesSchema,
  type CreaturePreferences,
} from './creature';

// Faction
export {
  factionSchema,
  type Faction,
  factionStatusSchema,
  cultureDataSchema,
  type CultureData,
  // Sub-schemas
  weightedTraitSchema,
  type WeightedTrait,
  personalityConfigSchema,
  type PersonalityConfig,
  namingConfigSchema,
  type NamingConfig,
  weightedQuirkSchema,
  type WeightedQuirk,
  factionActivityRefSchema,
  type FactionActivityRef,
  personalityBonusEntrySchema,
  type PersonalityBonusEntry,
  weightedGoalSchema,
  type WeightedGoal,
  valuesConfigSchema,
  type ValuesConfig,
  speechConfigSchema,
  type SpeechConfig,
  factionCreatureGroupSchema,
  type FactionCreatureGroup,
} from './faction';

// GroupTemplate
export {
  groupTemplateSchema,
  type GroupTemplate,
  slotDefSchema,
  type SlotDef,
  slotCountSchema,
  type SlotCount,
  slotCountUniformSchema,
  type SlotCountUniform,
  slotCountNormalSchema,
  type SlotCountNormal,
} from './groupTemplate';

// Map
export {
  mapDefinitionSchema,
  type MapDefinition,
  type MapId,
  mapTypeSchema,
  hexCoordinateSchema,
  type HexCoordinate,
} from './map';

// NPC
export {
  npcSchema,
  type NPC,
  type NPCId,
  npcStatusSchema,
  creatureRefSchema,
  type CreatureRef,
} from './npc';

// OverworldTile
export {
  overworldTileSchema,
  type OverworldTile,
  factionPresenceSchema,
  type FactionPresence,
  windExposureSchema,
  tileClimateModifiersSchema,
  type TileClimateModifiers,
} from './overworldTile';

// TerrainDefinition
export {
  terrainDefinitionSchema,
  type TerrainDefinition,
  type TerrainId,
  threatLevelSchema,
  type ThreatLevel,
  weatherRangeSchema,
  type WeatherRange,
  terrainWeatherRangesSchema,
  type TerrainWeatherRanges,
  environmentalPoolEntrySchema,
  type EnvironmentalPoolEntry,
} from './terrainDefinition';

// Landmark
export { landmarkSchema, type Landmark } from './landmark';

// Activity
export { activitySchema, type Activity, type ActivityId } from './activity';

// Trait
export { traitSchema, type Trait } from './trait';

// Quirk
export { quirkSchema, type Quirk } from './quirk';

// Goal
export { goalSchema, type Goal, personalityBonusSchema, type PersonalityBonus } from './goal';

// LootContainer
export {
  lootContainerSchema,
  type LootContainer,
  type LootContainerId,
  lootContainerStatusSchema,
  type LootContainerStatus,
  LOOT_CONTAINER_STATUSES,
} from './lootContainer';
