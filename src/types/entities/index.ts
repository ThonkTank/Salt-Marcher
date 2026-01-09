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

// ConditionExpression (Schema-driven Modifier DSL)
export {
  conditionExpressionSchema,
  type ConditionExpression,
  type AndExpression,
  type OrExpression,
  type NotExpression,
  type ExistsExpression,
  schemaModifierSchema,
  type SchemaModifier,
  schemaModifierEffectSchema,
  type SchemaModifierEffect,
  quantifiedEntitySchema,
  type QuantifiedEntity,
  entityRefSchema,
  type EntityRef,
  // Constants
  ENTITY_REFS,
  ENTITY_FILTERS,
  QUANTIFIERS,
  HP_COMPARISONS,
} from './conditionExpression';

// Action
export {
  actionSchema,
  type Action,
  // Enum schemas
  actionTypeSchema,
  actionSourceSchema,
  damageTypeSchema,
  abilityTypeSchema,
  conditionTypeSchema,
  durationTypeSchema,
  actionTimingTypeSchema,
  triggerEventSchema,
  rangeTypeSchema,
  aoeShapeSchema,
  aoeOriginSchema,
  targetingTypeSchema,
  saveOnSaveEffectSchema,
  advantageConditionSchema,
  modifiableStatSchema,
  rollTargetSchema,
  statModifierTypeSchema,
  rollModifierTypeSchema,
  damageModifierTypeSchema,
  movementModifierTypeSchema,
  movementModeSchema,
  forcedMovementTypeSchema,
  forcedMovementDirectionSchema,
  affectsTargetSchema,
  terrainEffectSchema,
  counterTargetSchema,
  summonControlSchema,
  transformTargetSchema,
  hpThresholdComparisonSchema,
  skillTypeSchema,
  restTypeSchema,
  // Sub-schemas
  actionRangeSchema,
  type ActionRange,
  aoeSchema,
  type Aoe,
  actionDamageSchema,
  type ActionDamage,
  attackRollSchema,
  type AttackRoll,
  saveDCSchema,
  type SaveDC,
  escapeTimingSchema,
  type EscapeTiming,
  escapeCheckSchema,
  type EscapeCheck,
  saveTimingSchema,
  type SaveTiming,
  durationSchema,
  type Duration,
  healingSchema,
  type Healing,
  triggerConditionSchema,
  type TriggerCondition,
  statModifierSchema,
  type StatModifier,
  rollModifierSchema,
  type RollModifier,
  damageModifierSchema,
  type DamageModifier,
  movementModifierSchema,
  type MovementModifier,
  forcedMovementSchema,
  type ForcedMovement,
  spellSlotSchema,
  type SpellSlot,
  spellComponentsSchema,
  type SpellComponents,
  criticalSchema,
  type Critical,
  multiattackEntrySchema,
  type MultiattackEntry,
  multiattackSchema,
  type Multiattack,
  counterCheckSchema,
  type CounterCheck,
  targetingSchema,
  type Targeting,
  actionTimingSchema,
  type ActionTiming,
  actionEffectSchema,
  type ActionEffect,
  contestedCheckSchema,
  type ContestedCheck,
  hpThresholdSchema,
  type HpThreshold,
  summonSchema,
  type Summon,
  transformSchema,
  type Transform,
  counterSchema,
  type Counter,
  actionRechargeSchema,
  type ActionRecharge,
  // Budget Costs
  BUDGET_RESOURCES,
  type BudgetResource,
  budgetCostTypeSchema,
  type BudgetCostType,
  resourceCostSchema,
  type ResourceCost,
  // Action Requirements & Base Action
  actionRequirementSchema,
  type ActionRequirement,
  actionRequiresSchema,
  type ActionRequires,
  baseActionRefSchema,
  type BaseActionRef,
  BASE_ACTION_SELECT_MODES,
  type BaseActionSelectMode,
  BASE_ACTION_USAGE_MODES,
  type BaseActionUsageMode,
} from './action';
