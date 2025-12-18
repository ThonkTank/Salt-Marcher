/**
 * Core schemas - Public API
 */

// Common schemas
export {
  entityIdSchema,
  timestampSchema,
  entityTypeSchema,
  timeSegmentSchema,
  appErrorSchema,
} from './common';

// Terrain schemas
export {
  terrainDefinitionSchema,
  type TerrainDefinition,
  TERRAIN_IDS,
  type BuiltinTerrainId,
} from './terrain';

// Map schemas
export {
  hexCoordSchema,
  type HexCoordinate,
  mapTypeSchema,
  type MapType,
  overworldTileSchema,
  type OverworldTile,
  overworldMapSchema,
  type OverworldMap,
  tileKey,
  buildTileLookup,
} from './map';

// Party schemas
export {
  transportModeSchema,
  type TransportMode,
  TRANSPORT_BASE_SPEEDS,
  partySchema,
  type Party,
  type PartyTravelState,
} from './party';

// Settings schemas
export {
  pluginSettingsSchema,
  type PluginSettings,
  DEFAULT_SETTINGS,
} from './settings';

// Time schemas
export {
  type TimeSegment,
  gameDateTimeSchema,
  type GameDateTime,
  durationSchema,
  type Duration,
  calendarMonthSchema,
  type CalendarMonth,
  calendarSeasonSchema,
  type CalendarSeason,
  timeSegmentRangeSchema,
  type TimeSegmentRange,
  calendarDefinitionSchema,
  type CalendarDefinition,
  timeStateSchema,
  type TimeState,
  DEFAULT_GAME_TIME,
  DEFAULT_CALENDAR_ID,
} from './time';

// Weather schemas
export {
  weatherRangeSchema,
  type WeatherRange,
  terrainWeatherRangesSchema,
  type TerrainWeatherRanges,
  temperatureCategorySchema,
  type TemperatureCategory,
  windCategorySchema,
  type WindCategory,
  precipitationTypeSchema,
  type PrecipitationType,
  weatherParamsSchema,
  type WeatherParams,
  weatherCategoriesSchema,
  type WeatherCategories,
  weatherStateSchema,
  type WeatherState,
  SEGMENT_TEMPERATURE_MODIFIERS,
  WEATHER_SPEED_FACTORS,
  TEMPERATURE_THRESHOLDS,
  WIND_THRESHOLDS,
  PRECIPITATION_THRESHOLDS,
  DEFAULT_WEATHER_RANGES,
} from './weather';

// Creature schemas
export {
  creatureSizeSchema,
  type CreatureSize,
  creatureDispositionSchema,
  type CreatureDisposition,
  abilityScoresSchema,
  type AbilityScores,
  speedBlockSchema,
  type SpeedBlock,
  creaturePreferencesSchema,
  type CreaturePreferences,
  creatureDefinitionSchema,
  type CreatureDefinition,
  creatureInstanceSchema,
  type CreatureInstance,
  creatureRefSchema,
  type CreatureRef,
  DEFAULT_ABILITY_SCORES,
  DEFAULT_SPEED,
} from './creature';

// Faction schemas
export {
  weightedTraitSchema,
  type WeightedTrait,
  weightedQuirkSchema,
  type WeightedQuirk,
  namingDataSchema,
  type NamingData,
  personalityDataSchema,
  type PersonalityData,
  valuesDataSchema,
  type ValuesData,
  speechDataSchema,
  type SpeechData,
  cultureDataSchema,
  type CultureData,
  factionCreatureGroupSchema,
  type FactionCreatureGroup,
  factionSchema,
  type Faction,
  resolvedCultureSchema,
  type ResolvedCulture,
  factionPresenceSchema,
  type FactionPresence,
  EMPTY_RESOLVED_CULTURE,
} from './faction';

// NPC schemas
export {
  personalityTraitsSchema,
  type PersonalityTraits,
  npcStatusSchema,
  type NpcStatus,
  npcSchema,
  type NPC,
  npcMatchCriteriaSchema,
  type NpcMatchCriteria,
  encounterLeadNpcSchema,
  type EncounterLeadNpc,
  NPC_MATCH_THRESHOLD,
  NPC_RECENCY_PENALTIES,
} from './npc';

// Encounter schemas
export {
  encounterTypeSchema,
  type EncounterType,
  encounterStateValueSchema,
  type EncounterStateValue,
  encounterOutcomeSchema,
  type EncounterOutcome,
  encounterDifficultySchema,
  type EncounterDifficultyValue,
  concreteCreatureSlotSchema,
  type ConcreteCreatureSlot,
  typedCreatureSlotSchema,
  type TypedCreatureSlot,
  budgetCreatureSlotSchema,
  type BudgetCreatureSlot,
  creatureSlotSchema,
  type CreatureSlot,
  encounterTriggersSchema,
  type EncounterTriggers,
  encounterDefinitionSchema,
  type EncounterDefinition,
  encounterInstanceSchema,
  type EncounterInstance,
  encounterContextSchema,
  type EncounterContext,
  VARIETY_HISTORY_SIZE,
  VARIETY_REROLL_WINDOW,
  MAX_REROLL_ATTEMPTS,
  CR_COMBAT_THRESHOLD_FACTOR,
  BASE_ENCOUNTER_CHANCE,
} from './encounter';

// Character schemas
export {
  characterSchema,
  type Character,
  calculatePartyLevel,
  calculatePartySpeed,
  calculateTotalPartyHp,
} from './character';

// Combat schemas
export {
  abilityKeySchema,
  type AbilityKey,
  conditionTypeSchema,
  type ConditionType,
  conditionSchema,
  type Condition,
  effectTriggerSchema,
  type EffectTrigger,
  effectTypeSchema,
  type EffectType,
  saveEffectSchema,
  type SaveEffect,
  damageEffectSchema,
  type DamageEffect,
  effectDetailsSchema,
  type EffectDetails,
  combatEffectSchema,
  type CombatEffect,
  participantTypeSchema,
  type ParticipantType,
  combatParticipantSchema,
  type CombatParticipant,
  combatStatusSchema,
  type CombatStatus,
  combatStateSchema,
  type CombatState,
  CONDITION_REMINDERS,
  SECONDS_PER_ROUND,
  createInitialCombatState,
  createCondition,
} from './combat';

// Quest schemas
export {
  questStatusSchema,
  type QuestStatus,
  objectiveTypeSchema,
  type ObjectiveType,
  objectiveTargetSchema,
  type ObjectiveTarget,
  questObjectiveSchema,
  type QuestObjective,
  questEncounterSlotTypeSchema,
  type QuestEncounterSlotType,
  questEncounterSlotSchema,
  type QuestEncounterSlot,
  itemRewardSchema,
  type ItemReward,
  reputationRewardSchema,
  type ReputationReward,
  questRewardSchema,
  type QuestReward,
  questPrerequisiteSchema,
  type QuestPrerequisite,
  questDefinitionSchema,
  type QuestDefinition,
  objectiveProgressSchema,
  type ObjectiveProgress,
  questProgressSchema,
  type QuestProgress,
  questCompletionResultSchema,
  type QuestCompletionResult,
  questFailReasonSchema,
  type QuestFailReason,
  IMMEDIATE_XP_PERCENT,
  QUEST_POOL_XP_PERCENT,
} from './quest';

// Item schemas
export {
  itemCategorySchema,
  type ItemCategory,
  raritySchema,
  type Rarity,
  itemSchema,
  type Item,
  inventorySlotSchema,
  type InventorySlot,
  CURRENCY_RATES,
  COIN_WEIGHT,
  CURRENCY_IDS,
  type CurrencyId,
  isStackable,
  isCurrency,
  calculateTotalValue,
  calculateTotalWeight,
} from './item';
