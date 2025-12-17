/**
 * Domain event types and interfaces.
 *
 * This file is the SINGLE SOURCE OF TRUTH for all event types.
 * Based on Events-Catalog.md specification.
 */

import type { Timestamp, EntityId } from '../types';
import type {
  HexCoordinate,
  Duration,
  GameDateTime,
  TimeSegment,
  TransportMode,
  EncounterInstance,
  EncounterOutcome,
  EncounterType,
  CombatParticipant,
  CombatState,
  Condition,
  ConditionType,
  CombatEffect,
  CombatOutcome,
} from '../schemas';

// ============================================================================
// Domain Event Interface
// ============================================================================

/**
 * All domain events MUST follow this structure.
 * correlationId is mandatory for workflow tracing.
 */
export interface DomainEvent<T = unknown> {
  /** Event type (e.g., 'travel:started', 'map:loaded') */
  readonly type: string;
  /** Typed payload */
  readonly payload: T;
  /** Workflow correlation ID (mandatory) */
  readonly correlationId: string;
  /** When the event was created */
  readonly timestamp: Timestamp;
  /** Who sent the event (e.g., 'travel-orchestrator') */
  readonly source: string;
}

// ============================================================================
// Event Factory
// ============================================================================

/**
 * Create a domain event with required fields.
 */
export function createEvent<T>(
  type: string,
  payload: T,
  options: {
    correlationId: string;
    timestamp: Timestamp;
    source: string;
  }
): DomainEvent<T> {
  return {
    type,
    payload,
    correlationId: options.correlationId,
    timestamp: options.timestamp,
    source: options.source,
  };
}

/**
 * Generate a new correlation ID for starting a new workflow.
 */
export function newCorrelationId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// Event Type Constants
// ============================================================================

/**
 * All event type constants.
 * Single source of truth - never define event types elsewhere.
 */
export const EventTypes = {
  // -------------------------------------------------------------------------
  // time:* Events (8)
  // -------------------------------------------------------------------------
  TIME_ADVANCE_REQUESTED: 'time:advance-requested',
  TIME_SET_REQUESTED: 'time:set-requested',
  TIME_SET_CALENDAR_REQUESTED: 'time:set-calendar-requested',
  TIME_STATE_CHANGED: 'time:state-changed',
  TIME_SEGMENT_CHANGED: 'time:segment-changed',
  TIME_DAY_CHANGED: 'time:day-changed',
  TIME_CALENDAR_CHANGED: 'time:calendar-changed',
  TIME_CALENDAR_CHANGE_FAILED: 'time:calendar-change-failed',

  // -------------------------------------------------------------------------
  // travel:* Events (14)
  // -------------------------------------------------------------------------
  TRAVEL_PLAN_REQUESTED: 'travel:plan-requested',
  TRAVEL_START_REQUESTED: 'travel:start-requested',
  TRAVEL_PAUSE_REQUESTED: 'travel:pause-requested',
  TRAVEL_RESUME_REQUESTED: 'travel:resume-requested',
  TRAVEL_CANCEL_REQUESTED: 'travel:cancel-requested',
  TRAVEL_MOVE_REQUESTED: 'travel:move-requested',
  TRAVEL_STATE_CHANGED: 'travel:state-changed',
  TRAVEL_POSITION_CHANGED: 'travel:position-changed',
  TRAVEL_ROUTE_PLANNED: 'travel:route-planned',
  TRAVEL_STARTED: 'travel:started',
  TRAVEL_PAUSED: 'travel:paused',
  TRAVEL_RESUMED: 'travel:resumed',
  TRAVEL_COMPLETED: 'travel:completed',
  TRAVEL_FAILED: 'travel:failed',

  // -------------------------------------------------------------------------
  // party:* Events (12)
  // -------------------------------------------------------------------------
  PARTY_LOAD_REQUESTED: 'party:load-requested',
  PARTY_UPDATE_REQUESTED: 'party:update-requested',
  PARTY_ADD_MEMBER_REQUESTED: 'party:add-member-requested',
  PARTY_REMOVE_MEMBER_REQUESTED: 'party:remove-member-requested',
  PARTY_STATE_CHANGED: 'party:state-changed',
  PARTY_POSITION_CHANGED: 'party:position-changed',
  PARTY_MEMBERS_CHANGED: 'party:members-changed',
  PARTY_TRANSPORT_CHANGED: 'party:transport-changed',
  PARTY_MEMBER_ADDED: 'party:member-added',
  PARTY_MEMBER_REMOVED: 'party:member-removed',
  PARTY_XP_GAINED: 'party:xp-gained',
  PARTY_LOADED: 'party:loaded',

  // -------------------------------------------------------------------------
  // map:* Events (13)
  // -------------------------------------------------------------------------
  MAP_LOAD_REQUESTED: 'map:load-requested',
  MAP_NAVIGATE_REQUESTED: 'map:navigate-requested',
  MAP_BACK_REQUESTED: 'map:back-requested',
  MAP_STATE_CHANGED: 'map:state-changed',
  MAP_LOADED: 'map:loaded',
  MAP_UNLOADED: 'map:unloaded',
  MAP_SAVED: 'map:saved',
  MAP_NAVIGATED: 'map:navigated',
  MAP_CREATED: 'map:created',
  MAP_UPDATED: 'map:updated',
  MAP_DELETED: 'map:deleted',
  MAP_TILE_UPDATED: 'map:tile-updated',
  MAP_LOAD_FAILED: 'map:load-failed',

  // -------------------------------------------------------------------------
  // cartographer:* Events (2)
  // -------------------------------------------------------------------------
  CARTOGRAPHER_UNDO_REQUESTED: 'cartographer:undo-requested',
  CARTOGRAPHER_REDO_REQUESTED: 'cartographer:redo-requested',

  // -------------------------------------------------------------------------
  // encounter:* Events (9)
  // -------------------------------------------------------------------------
  ENCOUNTER_GENERATE_REQUESTED: 'encounter:generate-requested',
  ENCOUNTER_START_REQUESTED: 'encounter:start-requested',
  ENCOUNTER_DISMISS_REQUESTED: 'encounter:dismiss-requested',
  ENCOUNTER_RESOLVE_REQUESTED: 'encounter:resolve-requested',
  ENCOUNTER_STATE_CHANGED: 'encounter:state-changed',
  ENCOUNTER_GENERATED: 'encounter:generated',
  ENCOUNTER_STARTED: 'encounter:started',
  ENCOUNTER_DISMISSED: 'encounter:dismissed',
  ENCOUNTER_RESOLVED: 'encounter:resolved',

  // -------------------------------------------------------------------------
  // combat:* Events (23)
  // -------------------------------------------------------------------------
  COMBAT_START_REQUESTED: 'combat:start-requested',
  COMBAT_NEXT_TURN_REQUESTED: 'combat:next-turn-requested',
  COMBAT_END_REQUESTED: 'combat:end-requested',
  COMBAT_APPLY_DAMAGE_REQUESTED: 'combat:apply-damage-requested',
  COMBAT_APPLY_HEALING_REQUESTED: 'combat:apply-healing-requested',
  COMBAT_ADD_CONDITION_REQUESTED: 'combat:add-condition-requested',
  COMBAT_REMOVE_CONDITION_REQUESTED: 'combat:remove-condition-requested',
  COMBAT_UPDATE_INITIATIVE_REQUESTED: 'combat:update-initiative-requested',
  COMBAT_STATE_CHANGED: 'combat:state-changed',
  COMBAT_PARTICIPANT_HP_CHANGED: 'combat:participant-hp-changed',
  COMBAT_TURN_CHANGED: 'combat:turn-changed',
  COMBAT_CONDITION_CHANGED: 'combat:condition-changed',
  COMBAT_CONDITION_ADDED: 'combat:condition-added',
  COMBAT_CONDITION_REMOVED: 'combat:condition-removed',
  COMBAT_STARTED: 'combat:started',
  COMBAT_COMPLETED: 'combat:completed',
  COMBAT_CHARACTER_DOWNED: 'combat:character-downed',
  COMBAT_CHARACTER_STABILIZED: 'combat:character-stabilized',
  COMBAT_CHARACTER_DIED: 'combat:character-died',
  COMBAT_DEATH_SAVE_RECORDED: 'combat:death-save-recorded',
  COMBAT_CONCENTRATION_CHECK_REQUIRED: 'combat:concentration-check-required',
  COMBAT_CONCENTRATION_BROKEN: 'combat:concentration-broken',
  COMBAT_EFFECT_ADDED: 'combat:effect-added',
  COMBAT_EFFECT_REMOVED: 'combat:effect-removed',

  // -------------------------------------------------------------------------
  // worldevents:* Events (9)
  // -------------------------------------------------------------------------
  WORLDEVENTS_CREATE_REQUESTED: 'worldevents:create-requested',
  WORLDEVENTS_ADD_JOURNAL_REQUESTED: 'worldevents:add-journal-requested',
  WORLDEVENTS_STATE_CHANGED: 'worldevents:state-changed',
  WORLDEVENTS_CREATED: 'worldevents:created',
  WORLDEVENTS_TRIGGERED: 'worldevents:triggered',
  WORLDEVENTS_DELETED: 'worldevents:deleted',
  WORLDEVENTS_JOURNAL_ADDED: 'worldevents:journal-added',
  WORLDEVENTS_DUE: 'worldevents:due',
  WORLDEVENTS_UPCOMING: 'worldevents:upcoming',

  // -------------------------------------------------------------------------
  // faction:* Events (9)
  // -------------------------------------------------------------------------
  FACTION_CREATE_REQUESTED: 'faction:create-requested',
  FACTION_UPDATE_REQUESTED: 'faction:update-requested',
  FACTION_DELETE_REQUESTED: 'faction:delete-requested',
  FACTION_STATE_CHANGED: 'faction:state-changed',
  FACTION_CREATED: 'faction:created',
  FACTION_UPDATED: 'faction:updated',
  FACTION_DELETED: 'faction:deleted',
  FACTION_POI_CLAIMED: 'faction:poi-claimed',
  FACTION_POI_LOST: 'faction:poi-lost',

  // -------------------------------------------------------------------------
  // poi:* Events (9)
  // -------------------------------------------------------------------------
  POI_CREATE_REQUESTED: 'poi:create-requested',
  POI_UPDATE_REQUESTED: 'poi:update-requested',
  POI_DELETE_REQUESTED: 'poi:delete-requested',
  POI_CREATED: 'poi:created',
  POI_UPDATED: 'poi:updated',
  POI_DELETED: 'poi:deleted',
  POI_TRAP_TRIGGERED: 'poi:trap-triggered',
  POI_TRAP_DETECTED: 'poi:trap-detected',
  POI_TREASURE_LOOTED: 'poi:treasure-looted',

  // -------------------------------------------------------------------------
  // loot:* Events (6)
  // -------------------------------------------------------------------------
  LOOT_GENERATE_REQUESTED: 'loot:generate-requested',
  LOOT_DISTRIBUTE_REQUESTED: 'loot:distribute-requested',
  LOOT_STATE_CHANGED: 'loot:state-changed',
  LOOT_GENERATED: 'loot:generated',
  LOOT_ADJUSTED: 'loot:adjusted',
  LOOT_DISTRIBUTED: 'loot:distributed',

  // -------------------------------------------------------------------------
  // quest:* Events (14)
  // -------------------------------------------------------------------------
  QUEST_DISCOVER_REQUESTED: 'quest:discover-requested',
  QUEST_ACTIVATE_REQUESTED: 'quest:activate-requested',
  QUEST_COMPLETE_OBJECTIVE_REQUESTED: 'quest:complete-objective-requested',
  QUEST_ASSIGN_ENCOUNTER_REQUESTED: 'quest:assign-encounter-requested',
  QUEST_FAIL_REQUESTED: 'quest:fail-requested',
  QUEST_STATE_CHANGED: 'quest:state-changed',
  QUEST_DISCOVERED: 'quest:discovered',
  QUEST_ACTIVATED: 'quest:activated',
  QUEST_OBJECTIVE_COMPLETED: 'quest:objective-completed',
  QUEST_XP_ACCUMULATED: 'quest:xp-accumulated',
  QUEST_COMPLETED: 'quest:completed',
  QUEST_FAILED: 'quest:failed',
  QUEST_SLOT_ASSIGNMENT_AVAILABLE: 'quest:slot-assignment-available',
  QUEST_ENCOUNTER_ASSIGNED: 'quest:encounter-assigned',

  // -------------------------------------------------------------------------
  // environment:* Events (8)
  // -------------------------------------------------------------------------
  ENVIRONMENT_WEATHER_OVERRIDE_REQUESTED: 'environment:weather-override-requested',
  ENVIRONMENT_WEATHER_OVERRIDE_CLEAR_REQUESTED: 'environment:weather-override-clear-requested',
  ENVIRONMENT_STATE_CHANGED: 'environment:state-changed',
  ENVIRONMENT_WEATHER_CHANGED: 'environment:weather-changed',
  ENVIRONMENT_LIGHTING_CHANGED: 'environment:lighting-changed',
  ENVIRONMENT_WEATHER_OVERRIDE_APPLIED: 'environment:weather-override-applied',
  ENVIRONMENT_WEATHER_OVERRIDE_CLEARED: 'environment:weather-override-cleared',
  ENVIRONMENT_WEATHER_EVENT_TRIGGERED: 'environment:weather-event-triggered',

  // -------------------------------------------------------------------------
  // audio:* Events (12)
  // -------------------------------------------------------------------------
  AUDIO_PLAY_REQUESTED: 'audio:play-requested',
  AUDIO_PAUSE_REQUESTED: 'audio:pause-requested',
  AUDIO_RESUME_REQUESTED: 'audio:resume-requested',
  AUDIO_SET_VOLUME_REQUESTED: 'audio:set-volume-requested',
  AUDIO_SKIP_REQUESTED: 'audio:skip-requested',
  AUDIO_OVERRIDE_TRACK_REQUESTED: 'audio:override-track-requested',
  AUDIO_STATE_CHANGED: 'audio:state-changed',
  AUDIO_VOLUME_CHANGED: 'audio:volume-changed',
  AUDIO_TRACK_CHANGED: 'audio:track-changed',
  AUDIO_PAUSED: 'audio:paused',
  AUDIO_RESUMED: 'audio:resumed',
  AUDIO_CONTEXT_CHANGED: 'audio:context-changed',

  // -------------------------------------------------------------------------
  // entity:* Events (5)
  // -------------------------------------------------------------------------
  ENTITY_DELETE_REQUESTED: 'entity:delete-requested',
  ENTITY_SAVED: 'entity:saved',
  ENTITY_DELETED: 'entity:deleted',
  ENTITY_DELETE_FAILED: 'entity:delete-failed',
  ENTITY_SAVE_FAILED: 'entity:save-failed',

  // -------------------------------------------------------------------------
  // town:* Events (2)
  // -------------------------------------------------------------------------
  TOWN_NAVIGATE_REQUESTED: 'town:navigate-requested',
  TOWN_ROUTE_CALCULATED: 'town:route-calculated',

  // -------------------------------------------------------------------------
  // dungeon:* Events (6)
  // -------------------------------------------------------------------------
  DUNGEON_MOVE_REQUESTED: 'dungeon:move-requested',
  DUNGEON_POSITION_CHANGED: 'dungeon:position-changed',
  DUNGEON_TILE_EXPLORED: 'dungeon:tile-explored',
  DUNGEON_ROOM_ENTERED: 'dungeon:room-entered',
  DUNGEON_TRAP_TRIGGERED: 'dungeon:trap-triggered',
  DUNGEON_TRAP_DETECTED: 'dungeon:trap-detected',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

// ============================================================================
// Event Payload Interfaces
// ============================================================================

// ---------------------------------------------------------------------------
// time:* Payloads
// ---------------------------------------------------------------------------

export interface TimeAdvanceRequestedPayload {
  duration: Duration;
  reason?: 'travel' | 'rest' | 'activity' | 'manual';
}

export interface TimeSetRequestedPayload {
  newDateTime: GameDateTime;
}

export interface TimeSetCalendarRequestedPayload {
  calendarId: string;
}

export interface TimeStateChangedPayload {
  previousTime: GameDateTime;
  currentTime: GameDateTime;
  activeCalendarId: string;
  duration?: Duration;
}

export interface TimeSegmentChangedPayload {
  previousSegment: TimeSegment;
  newSegment: TimeSegment;
}

export interface TimeDayChangedPayload {
  previousDay: number;
  newDay: number;
}

export interface TimeCalendarChangedPayload {
  oldCalendarId: string;
  newCalendarId: string;
  time: GameDateTime;
}

export interface TimeCalendarChangeFailedPayload {
  reason: 'calendar_not_found' | 'conversion_failed';
  calendarId: string;
}

// ---------------------------------------------------------------------------
// travel:* Payloads
// ---------------------------------------------------------------------------

export interface TravelPlanRequestedPayload {
  from: HexCoordinate;
  to: HexCoordinate;
  transport: TransportMode;
}

export interface TravelStartRequestedPayload {
  routeId: string;
}

export interface TravelPauseRequestedPayload {
  reason: 'user' | 'encounter' | 'obstacle';
}

export interface TravelResumeRequestedPayload {
  // empty
}

export interface TravelCancelRequestedPayload {
  // empty
}

export interface TravelMoveRequestedPayload {
  target: HexCoordinate;
}

export interface TravelStateChangedPayload {
  state: unknown; // TravelState from travel feature
}

export interface TravelPositionChangedPayload {
  position: HexCoordinate;
  from: HexCoordinate;
  progress: number;
  remainingDuration: Duration;
  terrainId: string;
  timeCostHours: number;
}

export interface TravelRoutePlannedPayload {
  routeId: string;
  route: unknown; // Route type
  estimatedDuration: Duration;
}

export interface TravelStartedPayload {
  routeId: string;
  from: HexCoordinate;
  to: HexCoordinate;
  estimatedArrival: GameDateTime;
}

export interface TravelPausedPayload {
  position: HexCoordinate;
  reason: 'user' | 'encounter' | 'obstacle';
}

export interface TravelResumedPayload {
  position: HexCoordinate;
}

export interface TravelCompletedPayload {
  destination: HexCoordinate;
  totalDuration: Duration;
}

export interface TravelFailedPayload {
  reason: 'invalid_route' | 'blocked_terrain' | 'no_transport' | 'not_neighbor' | 'invalid_target';
  details?: string;
}

// ---------------------------------------------------------------------------
// party:* Payloads
// ---------------------------------------------------------------------------

export interface PartyLoadRequestedPayload {
  partyId: string;
}

export interface PartyUpdateRequestedPayload {
  changes: Record<string, unknown>;
}

export interface PartyAddMemberRequestedPayload {
  characterId: string;
}

export interface PartyRemoveMemberRequestedPayload {
  characterId: string;
}

export interface PartyStateChangedPayload {
  state: unknown; // PartyState
}

export interface PartyPositionChangedPayload {
  previousPosition: HexCoordinate;
  newPosition: HexCoordinate;
  source: 'travel' | 'teleport' | 'manual';
}

export interface PartyMembersChangedPayload {
  memberIds: string[];
}

export interface PartyTransportChangedPayload {
  previousTransport: TransportMode;
  newTransport: TransportMode;
}

export interface PartyMemberAddedPayload {
  characterId: string;
}

export interface PartyMemberRemovedPayload {
  characterId: string;
}

export interface PartyXpGainedPayload {
  amount: number;
  source: string;
}

export interface PartyLoadedPayload {
  partyId: string;
  state: unknown; // PartyState
}

// ---------------------------------------------------------------------------
// map:* Payloads
// ---------------------------------------------------------------------------

export interface MapLoadRequestedPayload {
  mapId: string;
}

export interface MapNavigateRequestedPayload {
  targetMapId: string;
  sourcePOIId?: string;
}

export interface MapBackRequestedPayload {
  // empty
}

export interface MapStateChangedPayload {
  state: unknown; // MapState
}

export interface MapLoadedPayload {
  mapId: string;
  mapType: 'hex' | 'town' | 'grid';
}

export interface MapUnloadedPayload {
  mapId: string;
}

export interface MapSavedPayload {
  mapId: string;
}

export interface MapNavigatedPayload {
  previousMapId: string;
  newMapId: string;
  spawnPosition: HexCoordinate;
}

export interface MapCreatedPayload {
  map: unknown; // BaseMap
}

export interface MapUpdatedPayload {
  mapId: string;
  changes: Record<string, unknown>;
}

export interface MapDeletedPayload {
  mapId: string;
}

export interface MapTileUpdatedPayload {
  mapId: string;
  coordinate: HexCoordinate;
  tile: unknown; // OverworldTile | DungeonTile
}

export interface MapLoadFailedPayload {
  mapId: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// cartographer:* Payloads
// ---------------------------------------------------------------------------

export interface CartographerUndoRequestedPayload {
  // empty
}

export interface CartographerRedoRequestedPayload {
  // empty
}

// ---------------------------------------------------------------------------
// encounter:* Payloads
// ---------------------------------------------------------------------------

export interface EncounterGenerateRequestedPayload {
  /** Current party position - Service builds full context from this */
  position: HexCoordinate;
  /** What triggered this generation */
  trigger: 'time-based' | 'manual' | 'location' | 'travel';
}

export interface EncounterStartRequestedPayload {
  encounterId: string;
}

export interface EncounterDismissRequestedPayload {
  encounterId: string;
  reason?: string;
}

export interface EncounterResolveRequestedPayload {
  encounterId: string;
  outcome: EncounterOutcome;
}

export interface EncounterStateChangedPayload {
  currentEncounter: EncounterInstance | null;
  historyLength: number;
}

export interface EncounterGeneratedPayload {
  encounter: EncounterInstance;
}

export interface EncounterStartedPayload {
  encounterId: string;
  type: EncounterType;
  encounter: EncounterInstance;
}

export interface EncounterDismissedPayload {
  encounterId: string;
  reason?: string;
}

export interface EncounterResolvedPayload {
  encounterId: string;
  outcome: EncounterOutcome;
  xpAwarded: number;
  loot?: unknown; // LootResult (defined in loot feature)
}

// ---------------------------------------------------------------------------
// combat:* Payloads
// ---------------------------------------------------------------------------

export interface CombatStartRequestedPayload {
  participants: CombatParticipant[];
  fromEncounter?: EntityId<'encounter'>;
}

export interface CombatNextTurnRequestedPayload {
  // empty
}

export interface CombatEndRequestedPayload {
  outcome: CombatOutcome;
}

export interface CombatApplyDamageRequestedPayload {
  participantId: string;
  amount: number;
}

export interface CombatApplyHealingRequestedPayload {
  participantId: string;
  amount: number;
}

export interface CombatAddConditionRequestedPayload {
  participantId: string;
  condition: Condition;
}

export interface CombatRemoveConditionRequestedPayload {
  participantId: string;
  conditionType: ConditionType;
}

export interface CombatUpdateInitiativeRequestedPayload {
  participantId: string;
  initiative: number;
}

export interface CombatStateChangedPayload {
  state: CombatState;
}

export interface CombatParticipantHpChangedPayload {
  participantId: string;
  previousHp: number;
  currentHp: number;
  change: number;
}

export interface CombatTurnChangedPayload {
  participantId: string;
  roundNumber: number;
}

export interface CombatConditionChangedPayload {
  participantId: string;
  conditions: Condition[];
}

export interface CombatConditionAddedPayload {
  participantId: string;
  condition: Condition;
}

export interface CombatConditionRemovedPayload {
  participantId: string;
  conditionType: ConditionType;
}

export interface CombatStartedPayload {
  combatId: string;
  initiativeOrder: CombatParticipant[];
}

export interface CombatCompletedPayload {
  combatId: string;
  outcome: CombatOutcome;
  duration: number;
  xpAwarded: number;
}

export interface CombatCharacterDownedPayload {
  participantId: string;
}

export interface CombatCharacterStabilizedPayload {
  participantId: string;
}

export interface CombatCharacterDiedPayload {
  participantId: string;
}

export interface CombatDeathSaveRecordedPayload {
  participantId: string;
  success: boolean;
}

export interface CombatConcentrationCheckRequiredPayload {
  participantId: string;
  spell: string;
  dc: number;
}

export interface CombatConcentrationBrokenPayload {
  participantId: string;
  spell: string;
}

export interface CombatEffectAddedPayload {
  participantId: string;
  effect: CombatEffect;
}

export interface CombatEffectRemovedPayload {
  participantId: string;
  effectId: string;
}

// ---------------------------------------------------------------------------
// worldevents:* Payloads
// ---------------------------------------------------------------------------

export interface WorldEventsCreateRequestedPayload {
  event: unknown; // WorldEventInput
}

export interface WorldEventsAddJournalRequestedPayload {
  entry: unknown; // JournalEntryInput
}

export interface WorldEventsStateChangedPayload {
  state: unknown; // WorldEventsState
}

export interface WorldEventsCreatedPayload {
  event: unknown; // WorldEvent
}

export interface WorldEventsTriggeredPayload {
  eventId: string;
  event: unknown; // WorldEvent
}

export interface WorldEventsDeletedPayload {
  eventId: string;
}

export interface WorldEventsJournalAddedPayload {
  entry: unknown; // JournalEntry
  source: 'manual' | 'system';
}

export interface WorldEventsDuePayload {
  events: unknown[]; // WorldEvent[]
}

export interface WorldEventsUpcomingPayload {
  events: unknown[]; // WorldEvent[]
  within: Duration;
}

// ---------------------------------------------------------------------------
// faction:* Payloads
// ---------------------------------------------------------------------------

export interface FactionCreateRequestedPayload {
  faction: unknown; // Faction
}

export interface FactionUpdateRequestedPayload {
  factionId: string;
  changes: Record<string, unknown>;
}

export interface FactionDeleteRequestedPayload {
  factionId: string;
}

export interface FactionStateChangedPayload {
  state: unknown; // FactionState
}

export interface FactionCreatedPayload {
  faction: unknown; // Faction
}

export interface FactionUpdatedPayload {
  factionId: string;
  faction: unknown; // Faction
}

export interface FactionDeletedPayload {
  factionId: string;
}

export interface FactionPoiClaimedPayload {
  factionId: string;
  poiId: string;
}

export interface FactionPoiLostPayload {
  factionId: string;
  poiId: string;
}

// ---------------------------------------------------------------------------
// poi:* Payloads
// ---------------------------------------------------------------------------

export interface PoiCreateRequestedPayload {
  poi: unknown; // POI
}

export interface PoiUpdateRequestedPayload {
  poiId: string;
  changes: Record<string, unknown>;
}

export interface PoiDeleteRequestedPayload {
  poiId: string;
}

export interface PoiCreatedPayload {
  poi: unknown; // POI
}

export interface PoiUpdatedPayload {
  poiId: string;
  poi: unknown; // POI
}

export interface PoiDeletedPayload {
  poiId: string;
}

export interface PoiTrapTriggeredPayload {
  poiId: string;
  triggeredBy: string;
}

export interface PoiTrapDetectedPayload {
  poiId: string;
  detectedBy: string;
}

export interface PoiTreasureLootedPayload {
  poiId: string;
  items: string[];
}

// ---------------------------------------------------------------------------
// loot:* Payloads
// ---------------------------------------------------------------------------

export interface LootGenerateRequestedPayload {
  encounterId: string;
  context: unknown; // LootContext
}

export interface LootDistributeRequestedPayload {
  encounterId: string;
  selectedItems: unknown[]; // SelectedItem[]
}

export interface LootStateChangedPayload {
  state: unknown; // LootState
}

export interface LootGeneratedPayload {
  encounterId: string;
  loot: unknown; // GeneratedLoot
}

export interface LootAdjustedPayload {
  encounterId: string;
  adjustedLoot: unknown; // GeneratedLoot
}

export interface LootDistributedPayload {
  encounterId: string;
  items: unknown[]; // SelectedItem[]
  recipients: string[];
}

// ---------------------------------------------------------------------------
// quest:* Payloads
// ---------------------------------------------------------------------------

export interface QuestDiscoverRequestedPayload {
  questId: string;
}

export interface QuestActivateRequestedPayload {
  questId: string;
}

export interface QuestCompleteObjectiveRequestedPayload {
  questId: string;
  objectiveId: string;
}

export interface QuestAssignEncounterRequestedPayload {
  questId: string;
  slotId: string;
  encounterId: string;
  encounterXP: number;
}

export interface QuestFailRequestedPayload {
  questId: string;
  reason: string;
}

export interface QuestStateChangedPayload {
  state: unknown; // QuestState
}

export interface QuestDiscoveredPayload {
  questId: string;
  quest: unknown; // QuestDefinition
}

export interface QuestActivatedPayload {
  questId: string;
}

export interface QuestObjectiveCompletedPayload {
  questId: string;
  objectiveId: string;
  remainingObjectives: number;
}

export interface QuestXpAccumulatedPayload {
  questId: string;
  amount: number;
}

export interface QuestCompletedPayload {
  questId: string;
  rewards: unknown[]; // QuestReward[]
  xpAwarded: number;
}

export interface QuestFailedPayload {
  questId: string;
  reason: 'deadline' | 'condition-violated' | 'abandoned';
}

export interface QuestSlotAssignmentAvailablePayload {
  encounterId: string;
  encounterXP: number;
  openSlots: Array<{
    questId: string;
    questName: string;
    slotId: string;
    slotDescription: string;
  }>;
}

export interface QuestEncounterAssignedPayload {
  questId: string;
  slotId: string;
  encounterId: string;
  xpAccumulated: number;
}

// ---------------------------------------------------------------------------
// environment:* Payloads
// ---------------------------------------------------------------------------

export interface EnvironmentWeatherOverrideRequestedPayload {
  mapId: string;
  overrides: Record<string, unknown>; // Partial<WeatherParams>
  reason?: string;
}

export interface EnvironmentWeatherOverrideClearRequestedPayload {
  mapId: string;
}

export interface EnvironmentStateChangedPayload {
  state: unknown; // EnvironmentState
}

export interface EnvironmentWeatherChangedPayload {
  previousWeather: unknown; // WeatherState
  newWeather: unknown; // WeatherState
  trigger: 'segment-change' | 'location-change' | 'event' | 'override';
}

export interface EnvironmentLightingChangedPayload {
  previousLighting: unknown; // LightingState
  newLighting: unknown; // LightingState
}

export interface EnvironmentWeatherOverrideAppliedPayload {
  mapId: string;
  baseWeather: unknown; // WeatherParams
  finalWeather: unknown; // WeatherParams
  overrides: Record<string, unknown>;
}

export interface EnvironmentWeatherOverrideClearedPayload {
  mapId: string;
  reason: 'manual' | 'map-changed';
}

export interface EnvironmentWeatherEventTriggeredPayload {
  eventType: string; // WeatherEventType
  severity: 'mild' | 'moderate' | 'severe';
  effects: unknown[]; // WeatherEffect[]
}

// ---------------------------------------------------------------------------
// audio:* Payloads
// ---------------------------------------------------------------------------

export interface AudioPlayRequestedPayload {
  layer?: 'music' | 'ambiance' | 'all';
}

export interface AudioPauseRequestedPayload {
  // empty
}

export interface AudioResumeRequestedPayload {
  // empty
}

export interface AudioSetVolumeRequestedPayload {
  layer: 'music' | 'ambiance';
  volume: number;
}

export interface AudioSkipRequestedPayload {
  layer: 'music' | 'ambiance';
}

export interface AudioOverrideTrackRequestedPayload {
  layer: 'music' | 'ambiance';
  trackId: string;
}

export interface AudioStateChangedPayload {
  state: unknown; // AudioState
}

export interface AudioVolumeChangedPayload {
  layer: 'music' | 'ambiance';
  volume: number;
}

export interface AudioTrackChangedPayload {
  layer: 'music' | 'ambiance';
  previousTrack?: string;
  newTrack: string;
  reason: 'context-change' | 'track-ended' | 'user-skip' | 'user-override';
}

export interface AudioPausedPayload {
  layer: 'music' | 'ambiance' | 'all';
}

export interface AudioResumedPayload {
  layer: 'music' | 'ambiance' | 'all';
}

export interface AudioContextChangedPayload {
  context: unknown; // MoodContext
}

// ---------------------------------------------------------------------------
// entity:* Payloads
// ---------------------------------------------------------------------------

export interface EntityDeleteRequestedPayload {
  type: string; // EntityType
  id: string;
}

export interface EntitySavedPayload {
  type: string; // EntityType
  id: string;
  isNew: boolean;
}

export interface EntityDeletedPayload {
  type: string; // EntityType
  id: string;
}

export interface EntityDeleteFailedPayload {
  type: string; // EntityType
  id: string;
  reason: 'referenced' | 'not_found' | 'storage_error';
  referencedBy?: unknown[]; // EntityRef[]
}

export interface EntitySaveFailedPayload {
  type: string; // EntityType
  id: string;
  reason: 'validation_failed' | 'storage_error';
  details?: string;
}

// ---------------------------------------------------------------------------
// town:* Payloads
// ---------------------------------------------------------------------------

export interface TownNavigateRequestedPayload {
  from: { x: number; y: number };
  to: { x: number; y: number };
  via?: { x: number; y: number }[];
}

export interface TownRouteCalculatedPayload {
  path: { x: number; y: number }[];
  duration: Duration;
}

// ---------------------------------------------------------------------------
// dungeon:* Payloads
// ---------------------------------------------------------------------------

export interface DungeonMoveRequestedPayload {
  to: { x: number; y: number };
  mode: 'walk' | 'dash' | 'stealth';
}

export interface DungeonPositionChangedPayload {
  previousPosition: { x: number; y: number };
  newPosition: { x: number; y: number };
  elapsedTime: Duration;
}

export interface DungeonTileExploredPayload {
  tile: { x: number; y: number };
}

export interface DungeonRoomEnteredPayload {
  roomId: string;
  firstTime: boolean;
}

export interface DungeonTrapTriggeredPayload {
  trapId: string;
  triggeredBy: string;
  damage?: number;
  effect?: string;
}

export interface DungeonTrapDetectedPayload {
  trapId: string;
  detectedBy: string;
}

// ============================================================================
// Event Payload Map
// ============================================================================

/**
 * Maps event types to their payload types for type-safe event handling.
 */
export interface EventPayloadMap {
  // time:*
  [EventTypes.TIME_ADVANCE_REQUESTED]: TimeAdvanceRequestedPayload;
  [EventTypes.TIME_SET_REQUESTED]: TimeSetRequestedPayload;
  [EventTypes.TIME_SET_CALENDAR_REQUESTED]: TimeSetCalendarRequestedPayload;
  [EventTypes.TIME_STATE_CHANGED]: TimeStateChangedPayload;
  [EventTypes.TIME_SEGMENT_CHANGED]: TimeSegmentChangedPayload;
  [EventTypes.TIME_DAY_CHANGED]: TimeDayChangedPayload;
  [EventTypes.TIME_CALENDAR_CHANGED]: TimeCalendarChangedPayload;
  [EventTypes.TIME_CALENDAR_CHANGE_FAILED]: TimeCalendarChangeFailedPayload;

  // travel:*
  [EventTypes.TRAVEL_PLAN_REQUESTED]: TravelPlanRequestedPayload;
  [EventTypes.TRAVEL_START_REQUESTED]: TravelStartRequestedPayload;
  [EventTypes.TRAVEL_PAUSE_REQUESTED]: TravelPauseRequestedPayload;
  [EventTypes.TRAVEL_RESUME_REQUESTED]: TravelResumeRequestedPayload;
  [EventTypes.TRAVEL_CANCEL_REQUESTED]: TravelCancelRequestedPayload;
  [EventTypes.TRAVEL_MOVE_REQUESTED]: TravelMoveRequestedPayload;
  [EventTypes.TRAVEL_STATE_CHANGED]: TravelStateChangedPayload;
  [EventTypes.TRAVEL_POSITION_CHANGED]: TravelPositionChangedPayload;
  [EventTypes.TRAVEL_ROUTE_PLANNED]: TravelRoutePlannedPayload;
  [EventTypes.TRAVEL_STARTED]: TravelStartedPayload;
  [EventTypes.TRAVEL_PAUSED]: TravelPausedPayload;
  [EventTypes.TRAVEL_RESUMED]: TravelResumedPayload;
  [EventTypes.TRAVEL_COMPLETED]: TravelCompletedPayload;
  [EventTypes.TRAVEL_FAILED]: TravelFailedPayload;

  // party:*
  [EventTypes.PARTY_LOAD_REQUESTED]: PartyLoadRequestedPayload;
  [EventTypes.PARTY_UPDATE_REQUESTED]: PartyUpdateRequestedPayload;
  [EventTypes.PARTY_ADD_MEMBER_REQUESTED]: PartyAddMemberRequestedPayload;
  [EventTypes.PARTY_REMOVE_MEMBER_REQUESTED]: PartyRemoveMemberRequestedPayload;
  [EventTypes.PARTY_STATE_CHANGED]: PartyStateChangedPayload;
  [EventTypes.PARTY_POSITION_CHANGED]: PartyPositionChangedPayload;
  [EventTypes.PARTY_MEMBERS_CHANGED]: PartyMembersChangedPayload;
  [EventTypes.PARTY_TRANSPORT_CHANGED]: PartyTransportChangedPayload;
  [EventTypes.PARTY_MEMBER_ADDED]: PartyMemberAddedPayload;
  [EventTypes.PARTY_MEMBER_REMOVED]: PartyMemberRemovedPayload;
  [EventTypes.PARTY_XP_GAINED]: PartyXpGainedPayload;
  [EventTypes.PARTY_LOADED]: PartyLoadedPayload;

  // map:*
  [EventTypes.MAP_LOAD_REQUESTED]: MapLoadRequestedPayload;
  [EventTypes.MAP_NAVIGATE_REQUESTED]: MapNavigateRequestedPayload;
  [EventTypes.MAP_BACK_REQUESTED]: MapBackRequestedPayload;
  [EventTypes.MAP_STATE_CHANGED]: MapStateChangedPayload;
  [EventTypes.MAP_LOADED]: MapLoadedPayload;
  [EventTypes.MAP_UNLOADED]: MapUnloadedPayload;
  [EventTypes.MAP_SAVED]: MapSavedPayload;
  [EventTypes.MAP_NAVIGATED]: MapNavigatedPayload;
  [EventTypes.MAP_CREATED]: MapCreatedPayload;
  [EventTypes.MAP_UPDATED]: MapUpdatedPayload;
  [EventTypes.MAP_DELETED]: MapDeletedPayload;
  [EventTypes.MAP_TILE_UPDATED]: MapTileUpdatedPayload;
  [EventTypes.MAP_LOAD_FAILED]: MapLoadFailedPayload;

  // cartographer:*
  [EventTypes.CARTOGRAPHER_UNDO_REQUESTED]: CartographerUndoRequestedPayload;
  [EventTypes.CARTOGRAPHER_REDO_REQUESTED]: CartographerRedoRequestedPayload;

  // encounter:*
  [EventTypes.ENCOUNTER_GENERATE_REQUESTED]: EncounterGenerateRequestedPayload;
  [EventTypes.ENCOUNTER_START_REQUESTED]: EncounterStartRequestedPayload;
  [EventTypes.ENCOUNTER_DISMISS_REQUESTED]: EncounterDismissRequestedPayload;
  [EventTypes.ENCOUNTER_RESOLVE_REQUESTED]: EncounterResolveRequestedPayload;
  [EventTypes.ENCOUNTER_STATE_CHANGED]: EncounterStateChangedPayload;
  [EventTypes.ENCOUNTER_GENERATED]: EncounterGeneratedPayload;
  [EventTypes.ENCOUNTER_STARTED]: EncounterStartedPayload;
  [EventTypes.ENCOUNTER_DISMISSED]: EncounterDismissedPayload;
  [EventTypes.ENCOUNTER_RESOLVED]: EncounterResolvedPayload;

  // combat:*
  [EventTypes.COMBAT_START_REQUESTED]: CombatStartRequestedPayload;
  [EventTypes.COMBAT_NEXT_TURN_REQUESTED]: CombatNextTurnRequestedPayload;
  [EventTypes.COMBAT_END_REQUESTED]: CombatEndRequestedPayload;
  [EventTypes.COMBAT_APPLY_DAMAGE_REQUESTED]: CombatApplyDamageRequestedPayload;
  [EventTypes.COMBAT_APPLY_HEALING_REQUESTED]: CombatApplyHealingRequestedPayload;
  [EventTypes.COMBAT_ADD_CONDITION_REQUESTED]: CombatAddConditionRequestedPayload;
  [EventTypes.COMBAT_REMOVE_CONDITION_REQUESTED]: CombatRemoveConditionRequestedPayload;
  [EventTypes.COMBAT_UPDATE_INITIATIVE_REQUESTED]: CombatUpdateInitiativeRequestedPayload;
  [EventTypes.COMBAT_STATE_CHANGED]: CombatStateChangedPayload;
  [EventTypes.COMBAT_PARTICIPANT_HP_CHANGED]: CombatParticipantHpChangedPayload;
  [EventTypes.COMBAT_TURN_CHANGED]: CombatTurnChangedPayload;
  [EventTypes.COMBAT_CONDITION_CHANGED]: CombatConditionChangedPayload;
  [EventTypes.COMBAT_CONDITION_ADDED]: CombatConditionAddedPayload;
  [EventTypes.COMBAT_CONDITION_REMOVED]: CombatConditionRemovedPayload;
  [EventTypes.COMBAT_STARTED]: CombatStartedPayload;
  [EventTypes.COMBAT_COMPLETED]: CombatCompletedPayload;
  [EventTypes.COMBAT_CHARACTER_DOWNED]: CombatCharacterDownedPayload;
  [EventTypes.COMBAT_CHARACTER_STABILIZED]: CombatCharacterStabilizedPayload;
  [EventTypes.COMBAT_CHARACTER_DIED]: CombatCharacterDiedPayload;
  [EventTypes.COMBAT_DEATH_SAVE_RECORDED]: CombatDeathSaveRecordedPayload;
  [EventTypes.COMBAT_CONCENTRATION_CHECK_REQUIRED]: CombatConcentrationCheckRequiredPayload;
  [EventTypes.COMBAT_CONCENTRATION_BROKEN]: CombatConcentrationBrokenPayload;
  [EventTypes.COMBAT_EFFECT_ADDED]: CombatEffectAddedPayload;
  [EventTypes.COMBAT_EFFECT_REMOVED]: CombatEffectRemovedPayload;

  // worldevents:*
  [EventTypes.WORLDEVENTS_CREATE_REQUESTED]: WorldEventsCreateRequestedPayload;
  [EventTypes.WORLDEVENTS_ADD_JOURNAL_REQUESTED]: WorldEventsAddJournalRequestedPayload;
  [EventTypes.WORLDEVENTS_STATE_CHANGED]: WorldEventsStateChangedPayload;
  [EventTypes.WORLDEVENTS_CREATED]: WorldEventsCreatedPayload;
  [EventTypes.WORLDEVENTS_TRIGGERED]: WorldEventsTriggeredPayload;
  [EventTypes.WORLDEVENTS_DELETED]: WorldEventsDeletedPayload;
  [EventTypes.WORLDEVENTS_JOURNAL_ADDED]: WorldEventsJournalAddedPayload;
  [EventTypes.WORLDEVENTS_DUE]: WorldEventsDuePayload;
  [EventTypes.WORLDEVENTS_UPCOMING]: WorldEventsUpcomingPayload;

  // faction:*
  [EventTypes.FACTION_CREATE_REQUESTED]: FactionCreateRequestedPayload;
  [EventTypes.FACTION_UPDATE_REQUESTED]: FactionUpdateRequestedPayload;
  [EventTypes.FACTION_DELETE_REQUESTED]: FactionDeleteRequestedPayload;
  [EventTypes.FACTION_STATE_CHANGED]: FactionStateChangedPayload;
  [EventTypes.FACTION_CREATED]: FactionCreatedPayload;
  [EventTypes.FACTION_UPDATED]: FactionUpdatedPayload;
  [EventTypes.FACTION_DELETED]: FactionDeletedPayload;
  [EventTypes.FACTION_POI_CLAIMED]: FactionPoiClaimedPayload;
  [EventTypes.FACTION_POI_LOST]: FactionPoiLostPayload;

  // poi:*
  [EventTypes.POI_CREATE_REQUESTED]: PoiCreateRequestedPayload;
  [EventTypes.POI_UPDATE_REQUESTED]: PoiUpdateRequestedPayload;
  [EventTypes.POI_DELETE_REQUESTED]: PoiDeleteRequestedPayload;
  [EventTypes.POI_CREATED]: PoiCreatedPayload;
  [EventTypes.POI_UPDATED]: PoiUpdatedPayload;
  [EventTypes.POI_DELETED]: PoiDeletedPayload;
  [EventTypes.POI_TRAP_TRIGGERED]: PoiTrapTriggeredPayload;
  [EventTypes.POI_TRAP_DETECTED]: PoiTrapDetectedPayload;
  [EventTypes.POI_TREASURE_LOOTED]: PoiTreasureLootedPayload;

  // loot:*
  [EventTypes.LOOT_GENERATE_REQUESTED]: LootGenerateRequestedPayload;
  [EventTypes.LOOT_DISTRIBUTE_REQUESTED]: LootDistributeRequestedPayload;
  [EventTypes.LOOT_STATE_CHANGED]: LootStateChangedPayload;
  [EventTypes.LOOT_GENERATED]: LootGeneratedPayload;
  [EventTypes.LOOT_ADJUSTED]: LootAdjustedPayload;
  [EventTypes.LOOT_DISTRIBUTED]: LootDistributedPayload;

  // quest:*
  [EventTypes.QUEST_DISCOVER_REQUESTED]: QuestDiscoverRequestedPayload;
  [EventTypes.QUEST_ACTIVATE_REQUESTED]: QuestActivateRequestedPayload;
  [EventTypes.QUEST_COMPLETE_OBJECTIVE_REQUESTED]: QuestCompleteObjectiveRequestedPayload;
  [EventTypes.QUEST_ASSIGN_ENCOUNTER_REQUESTED]: QuestAssignEncounterRequestedPayload;
  [EventTypes.QUEST_FAIL_REQUESTED]: QuestFailRequestedPayload;
  [EventTypes.QUEST_STATE_CHANGED]: QuestStateChangedPayload;
  [EventTypes.QUEST_DISCOVERED]: QuestDiscoveredPayload;
  [EventTypes.QUEST_ACTIVATED]: QuestActivatedPayload;
  [EventTypes.QUEST_OBJECTIVE_COMPLETED]: QuestObjectiveCompletedPayload;
  [EventTypes.QUEST_XP_ACCUMULATED]: QuestXpAccumulatedPayload;
  [EventTypes.QUEST_COMPLETED]: QuestCompletedPayload;
  [EventTypes.QUEST_FAILED]: QuestFailedPayload;
  [EventTypes.QUEST_SLOT_ASSIGNMENT_AVAILABLE]: QuestSlotAssignmentAvailablePayload;
  [EventTypes.QUEST_ENCOUNTER_ASSIGNED]: QuestEncounterAssignedPayload;

  // environment:*
  [EventTypes.ENVIRONMENT_WEATHER_OVERRIDE_REQUESTED]: EnvironmentWeatherOverrideRequestedPayload;
  [EventTypes.ENVIRONMENT_WEATHER_OVERRIDE_CLEAR_REQUESTED]: EnvironmentWeatherOverrideClearRequestedPayload;
  [EventTypes.ENVIRONMENT_STATE_CHANGED]: EnvironmentStateChangedPayload;
  [EventTypes.ENVIRONMENT_WEATHER_CHANGED]: EnvironmentWeatherChangedPayload;
  [EventTypes.ENVIRONMENT_LIGHTING_CHANGED]: EnvironmentLightingChangedPayload;
  [EventTypes.ENVIRONMENT_WEATHER_OVERRIDE_APPLIED]: EnvironmentWeatherOverrideAppliedPayload;
  [EventTypes.ENVIRONMENT_WEATHER_OVERRIDE_CLEARED]: EnvironmentWeatherOverrideClearedPayload;
  [EventTypes.ENVIRONMENT_WEATHER_EVENT_TRIGGERED]: EnvironmentWeatherEventTriggeredPayload;

  // audio:*
  [EventTypes.AUDIO_PLAY_REQUESTED]: AudioPlayRequestedPayload;
  [EventTypes.AUDIO_PAUSE_REQUESTED]: AudioPauseRequestedPayload;
  [EventTypes.AUDIO_RESUME_REQUESTED]: AudioResumeRequestedPayload;
  [EventTypes.AUDIO_SET_VOLUME_REQUESTED]: AudioSetVolumeRequestedPayload;
  [EventTypes.AUDIO_SKIP_REQUESTED]: AudioSkipRequestedPayload;
  [EventTypes.AUDIO_OVERRIDE_TRACK_REQUESTED]: AudioOverrideTrackRequestedPayload;
  [EventTypes.AUDIO_STATE_CHANGED]: AudioStateChangedPayload;
  [EventTypes.AUDIO_VOLUME_CHANGED]: AudioVolumeChangedPayload;
  [EventTypes.AUDIO_TRACK_CHANGED]: AudioTrackChangedPayload;
  [EventTypes.AUDIO_PAUSED]: AudioPausedPayload;
  [EventTypes.AUDIO_RESUMED]: AudioResumedPayload;
  [EventTypes.AUDIO_CONTEXT_CHANGED]: AudioContextChangedPayload;

  // entity:*
  [EventTypes.ENTITY_DELETE_REQUESTED]: EntityDeleteRequestedPayload;
  [EventTypes.ENTITY_SAVED]: EntitySavedPayload;
  [EventTypes.ENTITY_DELETED]: EntityDeletedPayload;
  [EventTypes.ENTITY_DELETE_FAILED]: EntityDeleteFailedPayload;
  [EventTypes.ENTITY_SAVE_FAILED]: EntitySaveFailedPayload;

  // town:*
  [EventTypes.TOWN_NAVIGATE_REQUESTED]: TownNavigateRequestedPayload;
  [EventTypes.TOWN_ROUTE_CALCULATED]: TownRouteCalculatedPayload;

  // dungeon:*
  [EventTypes.DUNGEON_MOVE_REQUESTED]: DungeonMoveRequestedPayload;
  [EventTypes.DUNGEON_POSITION_CHANGED]: DungeonPositionChangedPayload;
  [EventTypes.DUNGEON_TILE_EXPLORED]: DungeonTileExploredPayload;
  [EventTypes.DUNGEON_ROOM_ENTERED]: DungeonRoomEnteredPayload;
  [EventTypes.DUNGEON_TRAP_TRIGGERED]: DungeonTrapTriggeredPayload;
  [EventTypes.DUNGEON_TRAP_DETECTED]: DungeonTrapDetectedPayload;
}
