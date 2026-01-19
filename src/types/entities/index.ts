// Entity Types Index
// Siehe: docs/architecture/types.md

// Character
export {
  characterSchema,
  type Character,
  type CharacterId,
} from './character';

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

// Culture
export {
  cultureSchema,
  type Culture,
  type CultureId,
} from './culture';

// Species
export {
  speciesSchema,
  type Species,
  type SpeciesId,
} from './species';

// Faction
export {
  factionSchema,
  type Faction,
  factionStatusSchema,
  factionInfluenceSchema,
  type FactionInfluence,
  // DEPRECATED: cultureDataSchema wird durch Culture-Entity ersetzt
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

// CombatEvent (Unified Schema - ersetzt Action, ConditionExpression, EffectExpression, TriggerExpression, CombatTrait)
// Siehe: docs/types/combatEvent.md
export {
  // Main schema
  combatEventSchema,
  type CombatEvent,
  // Component schemas
  preconditionSchema,
  type Precondition,
  triggerSchema,
  type Trigger,
  checkSchema,
  type Check,
  costSchema,
  type Cost,
  targetingSchema,
  type Targeting,
  effectSchema,
  type Effect,
  durationSchema,
  type Duration,
  // SchemaModifier types (for modifier presets)
  schemaModifierSchema,
  type SchemaModifier,
  schemaModifierEffectSchema,
  type SchemaModifierEffect,
  conditionLifecycleSchema,
  type ConditionLifecycle,
  contextualEffectsSchema,
  type ContextualEffects,
  propertyModifierSchema,
  type PropertyModifier,
  // Helper types
  entityRefSchema,
  type EntityRef,
  quantifiedEntitySchema,
  type QuantifiedEntity,
  type ExistsExpression,
  type ConditionExpression,
  type BaseActionRef,
  type ActionEffect,
  type SaveDC,
} from './combatEvent';

// EncounterPreset
export {
  encounterPresetSchema,
  type EncounterPreset,
  type EncounterPresetMode,
  encounterPresetModeSchema,
  ENCOUNTER_PRESET_MODES,
  // Mode-specific schemas
  authoredPresetSchema,
  type AuthoredPreset,
  templatePresetSchema,
  type TemplatePreset,
  embeddedPresetSchema,
  type EmbeddedPreset,
  // Group schemas
  authoredGroupSchema,
  type AuthoredGroup,
  templateGroupSchema,
  type TemplateGroup,
  embeddedGroupSchema,
  type EmbeddedGroup,
  creatureEntrySchema,
  type CreatureEntry,
  // Combat config
  encounterCombatConfigSchema,
  type EncounterCombatConfig,
} from './encounterPreset';

// Migration abgeschlossen: Die folgenden alten Dateien wurden durch combatEvent.ts ersetzt:
// - action.ts → CombatEvent
// - triggerExpression.ts → Trigger (CombatEvent.trigger)
// - combatTrait.ts → CombatEvent
// - conditionExpression.ts → Precondition, SchemaModifier, ConditionLifecycle
// - effectExpression.ts → Effect (CombatEvent.effect)
// - basicExpression.ts → Precondition (CombatEvent.precondition)
