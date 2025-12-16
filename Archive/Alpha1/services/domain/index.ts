/**
 * Domain Types Service
 *
 * Centralized domain type definitions shared across features and workmodes.
 * These are pure types without implementation logic.
 *
 * Layer Architecture:
 * - Features and workmodes import from @domain instead of cross-feature imports
 * - This prevents layer violations while sharing common types
 *
 * @module services/domain
 */

// Terrain types (from maps feature)
export type { TerrainType, FloraType, MoistureLevel, IconDefinition } from "./terrain-types";

// Tile types (from maps feature)
export type { TileData } from "./tile-types";

// Calendar types (from calendar domain)
export type {
    CalendarSchema,
    CalendarMonth,
    TimeDefinition,
    CalendarTimestamp,
    TimestampPrecision,
    CalendarEvent,
    CalendarEventSingle,
    CalendarEventRecurring,
    CalendarEventKind,
    CalendarEventTimePrecision,
    CalendarTimeOfDay,
    CalendarEventBase,
    CalendarEventBounds,
    CalendarEventOccurrence,
    PhenomenonOccurrence,
    HookType,
    HookDescriptor,
} from "./calendar-types";

// Library types (from library workmode)
export type {
    FilterableLibraryMode,
    CreatureEntryMeta,
    SpellEntryMeta,
    ItemEntryMeta,
    EquipmentEntryMeta,
    TerrainEntryMeta,
    RegionEntryMeta,
    FactionEntryMeta,
    CalendarEntryMeta,
    LocationEntryMeta,
    PlaylistEntryMeta,
    EncounterTableEntryMeta,
    CharacterEntryMeta,
    LibraryEntryMetaMap,
    LibraryEntry,
    LibraryDataSourceMap,
} from "./library-types";

// Audio types
export type { AudioTrack, PlaylistData } from "./audio-types";

// Entity types (Character, Creature, Location)
export type {
    // Characters
    Character,
    CharacterCreateData,
    CharacterUpdateData,
    // Creatures
    AbilityScoreKey,
    SpellcastingAbility,
    CreatureSpeedValue,
    CreatureSpeedExtra,
    CreatureSpeeds,
    SpeedEntry,
    SpeedArray,
    SenseToken,
    LanguageToken,
    SimpleValueToken,
    SpellcastingSpell,
    SpellcastingGroupAtWill,
    SpellcastingGroupPerDay,
    SpellcastingGroupLevel,
    SpellcastingGroupCustom,
    SpellcastingGroup,
    SpellcastingComputedValues,
    SpellcastingData,
    DamageInstance,
    AoeShape,
    AreaTarget,
    SingleTarget,
    SpecialTarget,
    Targeting,
    DurationTiming,
    SaveToEnd,
    ConditionEffect,
    MovementEffect,
    DamageOverTime,
    MechanicalEffect,
    EffectBlock,
    AttackData,
    SavingThrowData,
    LimitedUse,
    MultiattackSubstitution,
    MultiattackData,
    SpellcastingEntryData,
    BaseEntry,
    AttackEntry,
    SaveEntry,
    MultiattackEntry,
    SpellcastingEntry,
    SpecialEntry,
    LegacyEntry,
    CreatureEntry,
    AbilityScore,
    SaveBonus,
    SkillBonus,
    StatblockData,
    CreatureData,
    // Locations
    LocationType,
    OwnerType,
    LocationData,
    DungeonRoom,
    GridBounds,
    DungeonDoor,
    DungeonFeature,
    DungeonFeatureType,
    GridPosition,
    TokenType,
    DungeonToken,
} from "./entity-types";
export {
    getFeatureTypePrefix,
    getFeatureTypeLabel,
    getDefaultTokenColor,
    isDungeonLocation,
    isBuildingLocation,
} from "./entity-types";

// Faction types
export type {
    FactionPosition,
    FactionJob,
    NPCPersonality,
    FactionMember,
    FactionResources,
    FactionRelationship,
    TradeRoute,
    MarketData,
    ProductionChain,
    TradeGood,
    ResourceConsumption,
    MilitaryUnit,
    MilitaryEngagement,
    SupplyLine,
    DiplomaticTreaty,
    EspionageOperation,
    DiplomaticIncident,
    FactionData,
} from "./faction-types";

// Map types
export type { AreaType } from "./map-types";

// Encounter types (add missing)
export type { EncounterTableEntry, EncounterTableData } from "./encounter-types";
