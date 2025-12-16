/**
 * Domain Event Type Definitionen
 * Alle Events die zwischen Domains kommuniziert werden
 */

import type { DomainEvent } from './event-bus';
import type { EntityId } from '../types/common';
import type { AppError } from '../types/result';
import type { WorldPosition } from '../schemas/coordinates';

// Forward declarations für Types aus anderen Schemas
// Diese werden später durch die echten Imports ersetzt
type DateTime = unknown;
type Weather = unknown;
type LightLevel = 'bright' | 'dim' | 'dark' | 'magical_darkness';

// ═══════════════════════════════════════════════════════════════
// Time Events
// ═══════════════════════════════════════════════════════════════

export type TimeChangedEvent = DomainEvent<
  'time:changed',
  {
    previous: DateTime;
    current: DateTime;
    reason: 'tick' | 'travel' | 'rest' | 'manual';
  }
>;

export type DayChangedEvent = DomainEvent<
  'time:dayChanged',
  {
    day: number;
    month: number;
    year: number;
  }
>;

export type SeasonChangedEvent = DomainEvent<
  'time:seasonChanged',
  {
    season: string;
  }
>;

export type TimeOfDayChangedEvent = DomainEvent<
  'time:timeOfDayChanged',
  {
    previous: string;
    current: string;
  }
>;

// Time Command Events (ViewModel → Domain)
export type TimeAdvanceRequestedEvent = DomainEvent<
  'time:advance-requested',
  {
    duration: { hours?: number; minutes?: number; days?: number };
    reason: 'tick' | 'travel' | 'rest' | 'manual';
  }
>;

// ═══════════════════════════════════════════════════════════════
// Geography Events
// ═══════════════════════════════════════════════════════════════

export type MapLoadedEvent = DomainEvent<
  'map:loaded',
  {
    mapId: EntityId<'map'>;
    mapName: string;
    previousMapId: EntityId<'map'> | null;
  }
>;

export type MapCreatedEvent = DomainEvent<
  'map:created',
  {
    mapId: EntityId<'map'>;
    mapName: string;
  }
>;

export type MapDeletedEvent = DomainEvent<
  'map:deleted',
  {
    mapId: EntityId<'map'>;
  }
>;

export type MapChangedEvent = DomainEvent<
  'map:changed',
  {
    mapId: EntityId<'map'>;
    changeType: 'terrain' | 'location' | 'link' | 'metadata' | 'tile';
  }
>;

export type MapTilesUpdatedEvent = DomainEvent<
  'map:tiles-updated',
  {
    mapId: EntityId<'map'>;
    coords: string[]; // CoordKey[]
  }
>;

export type MapSavedEvent = DomainEvent<
  'map:saved',
  {
    mapId: EntityId<'map'>;
  }
>;

/**
 * Position changed during travel.
 * Published by TravelOrchestrator when party moves to a new hex.
 */
export type PositionChangedEvent = DomainEvent<
  'position:changed',
  {
    previous: { q: number; r: number };
    current: { q: number; r: number };
    pixelPosition: { x: number; y: number };
  }
>;

// Geography Command Events (ViewModel → Domain)
export type MapLoadRequestedEvent = DomainEvent<
  'map:load-requested',
  { mapId: EntityId<'map'> }
>;

// ═══════════════════════════════════════════════════════════════
// Entity Events
// ═══════════════════════════════════════════════════════════════

export type EntityLoadedEvent = DomainEvent<
  'entity:loaded',
  {
    entityType: string;
    count: number;
  }
>;

export type EntityCreatedEvent = DomainEvent<
  'entity:created',
  {
    entityType: string;
    entityId: string;
  }
>;

export type EntityUpdatedEvent = DomainEvent<
  'entity:updated',
  {
    entityType: string;
    entityId: string;
    changes: string[];
  }
>;

export type EntityDeletedEvent = DomainEvent<
  'entity:deleted',
  {
    entityType: string;
    entityId: string;
  }
>;

// ═══════════════════════════════════════════════════════════════
// Environment Events
// ═══════════════════════════════════════════════════════════════

export type WeatherUpdatedEvent = DomainEvent<
  'weather:updated',
  {
    previous: Weather;
    current: Weather;
  }
>;

export type LightChangedEvent = DomainEvent<
  'light:changed',
  {
    level: LightLevel;
  }
>;

// ═══════════════════════════════════════════════════════════════
// Combat Events
// ═══════════════════════════════════════════════════════════════

export type CombatStartedEvent = DomainEvent<
  'combat:started',
  {
    combatId: string;
    participants: string[];
  }
>;

export type CombatEndedEvent = DomainEvent<
  'combat:ended',
  {
    combatId: string;
    outcome: 'victory' | 'defeat' | 'flee' | 'negotiated';
  }
>;

export type CombatTurnChangedEvent = DomainEvent<
  'combat:turnChanged',
  {
    combatId: string;
    previousTurn: string | null;
    currentTurn: string;
    round: number;
  }
>;

// ═══════════════════════════════════════════════════════════════
// Audio Events
// ═══════════════════════════════════════════════════════════════

export type AudioTrackChangedEvent = DomainEvent<
  'audio:trackChanged',
  {
    layer: 'music' | 'ambience';
    trackId: string | null;
  }
>;

export type AudioMoodChangedEvent = DomainEvent<
  'audio:moodChanged',
  {
    mood: string;
  }
>;

// ═══════════════════════════════════════════════════════════════
// Quest Events
// ═══════════════════════════════════════════════════════════════

export type QuestStartedEvent = DomainEvent<
  'quest:started',
  {
    questId: EntityId<'quest'>;
  }
>;

export type QuestCompletedEvent = DomainEvent<
  'quest:completed',
  {
    questId: EntityId<'quest'>;
  }
>;

export type QuestFailedEvent = DomainEvent<
  'quest:failed',
  {
    questId: EntityId<'quest'>;
    reason?: string;
  }
>;

export type QuestUpdatedEvent = DomainEvent<
  'quest:updated',
  {
    questId: EntityId<'quest'>;
    stage: string;
    objectiveIndex?: number;
  }
>;

// ═══════════════════════════════════════════════════════════════
// Encounter Events (Orchestration Layer)
// ═══════════════════════════════════════════════════════════════

export type EncounterCheckTriggeredEvent = DomainEvent<
  'encounter:check-triggered',
  {
    hour: number;
    terrain: string;
    position: { q: number; r: number };
  }
>;

export type EncounterGeneratedEvent = DomainEvent<
  'encounter:generated',
  {
    encounterId: string;
    terrain: string;
    difficulty: string;
    creatureCount: number;
    totalXp: number;
    hour: number;
    position: { q: number; r: number };
  }
>;

export type EncounterSkippedEvent = DomainEvent<
  'encounter:skipped',
  {
    hour: number;
    terrain: string;
    reason: 'roll_failed' | 'no_creatures' | 'disabled';
  }
>;

export type EncounterResolvedEvent = DomainEvent<
  'encounter:resolved',
  {
    encounterId: string;
    outcome: 'victory' | 'flee' | 'negotiated';
  }
>;

export type EncounterStateChangedEvent = DomainEvent<
  'encounter:state-changed',
  {
    status: 'idle' | 'active';
    hasActiveEncounter: boolean;
    // Full state for UI consumption (avoids orchestrator reference in ViewModel)
    state: {
      status: 'idle' | 'active';
      activeEncounter: unknown | null; // GeneratedEncounter
      travelHoursElapsed: number;
      lastCheckHour: number;
    };
  }
>;

// Encounter Command Events (ViewModel → Orchestrator)
export type EncounterResolveRequestedEvent = DomainEvent<
  'encounter:resolve-requested',
  { outcome: 'victory' | 'flee' | 'negotiated' }
>;

export type EncounterDismissRequestedEvent = DomainEvent<
  'encounter:dismiss-requested',
  Record<string, never>
>;

// ═══════════════════════════════════════════════════════════════
// Encounter Failure Events (Command Failures)
// ═══════════════════════════════════════════════════════════════

export type EncounterTriggerFailedEvent = DomainEvent<
  'encounter:trigger-failed',
  { error: AppError }
>;

export type EncounterGenerateFailedEvent = DomainEvent<
  'encounter:generate-failed',
  { error: AppError; terrain: string }
>;

export type EncounterResolveFailedEvent = DomainEvent<
  'encounter:resolve-failed',
  { error: AppError }
>;

// ═══════════════════════════════════════════════════════════════
// Travel Events (Orchestration Layer)
// ═══════════════════════════════════════════════════════════════

export type TravelStartedEvent = DomainEvent<
  'travel:started',
  {
    routeId: string;
    from: { q: number; r: number };
    to: { q: number; r: number };
    estimatedDuration: { hours?: number; minutes?: number; days?: number };
  }
>;

export type TravelCompletedEvent = DomainEvent<
  'travel:completed',
  {
    routeId: string;
    from: { q: number; r: number };
    to: { q: number; r: number };
    actualDuration: { hours?: number; minutes?: number; days?: number };
  }
>;

export type TravelPausedEvent = DomainEvent<
  'travel:paused',
  {
    routeId: string;
    currentPosition: { q: number; r: number };
    progress: number;
  }
>;

export type TravelResumedEvent = DomainEvent<
  'travel:resumed',
  {
    routeId: string;
  }
>;

export type TravelStoppedEvent = DomainEvent<
  'travel:stopped',
  {
    finalPosition: { q: number; r: number };
    progress: number;
  }
>;

export type TravelWaypointReachedEvent = DomainEvent<
  'travel:waypoint-reached',
  {
    routeId: string;
    waypointId: string;
    coord: { q: number; r: number };
  }
>;

// ═══════════════════════════════════════════════════════════════
// Travel Command Events (ViewModel → Orchestrator)
// ═══════════════════════════════════════════════════════════════

export type TravelStartRequestedEvent = DomainEvent<
  'travel:start-requested',
  Record<string, never>
>;

export type TravelPauseRequestedEvent = DomainEvent<
  'travel:pause-requested',
  Record<string, never>
>;

export type TravelResumeRequestedEvent = DomainEvent<
  'travel:resume-requested',
  Record<string, never>
>;

export type TravelStopRequestedEvent = DomainEvent<
  'travel:stop-requested',
  Record<string, never>
>;

export type TravelClearRequestedEvent = DomainEvent<
  'travel:clear-requested',
  Record<string, never>
>;

export type TravelSpeedChangedEvent = DomainEvent<
  'travel:speed-changed',
  { speed: number }
>;

export type TravelWaypointAddRequestedEvent = DomainEvent<
  'travel:waypoint-add-requested',
  { coord: { q: number; r: number } }
>;

export type TravelWaypointRemoveRequestedEvent = DomainEvent<
  'travel:waypoint-remove-requested',
  { waypointId: string }
>;

export type TravelWaypointMoveRequestedEvent = DomainEvent<
  'travel:waypoint-move-requested',
  { waypointId: string; coord: { q: number; r: number } }
>;

export type TravelPositionSetRequestedEvent = DomainEvent<
  'travel:position-set-requested',
  { coord: { q: number; r: number } }
>;

export type TravelTickRequestedEvent = DomainEvent<
  'travel:tick-requested',
  { deltaMs: number }
>;

// ═══════════════════════════════════════════════════════════════
// Travel Failure Events (Command Failures)
// ═══════════════════════════════════════════════════════════════

export type TravelStartFailedEvent = DomainEvent<
  'travel:start-failed',
  { error: AppError }
>;

export type TravelPauseFailedEvent = DomainEvent<
  'travel:pause-failed',
  { error: AppError }
>;

export type TravelResumeFailedEvent = DomainEvent<
  'travel:resume-failed',
  { error: AppError }
>;

export type TravelWaypointRemoveFailedEvent = DomainEvent<
  'travel:waypoint-remove-failed',
  { error: AppError; waypointId: string }
>;

export type TravelWaypointMoveFailedEvent = DomainEvent<
  'travel:waypoint-move-failed',
  { error: AppError; waypointId: string }
>;

// ═══════════════════════════════════════════════════════════════
// Travel State Sync Event (Orchestrator → ViewModel)
// ═══════════════════════════════════════════════════════════════

/**
 * TravelState is imported from orchestration layer.
 * We use a generic payload type here to avoid circular dependencies.
 */
export type TravelStateChangedEvent = DomainEvent<
  'travel:state-changed',
  {
    state: {
      status: 'idle' | 'planning' | 'traveling' | 'paused' | 'arrived';
      route: unknown | null;
      progress: unknown | null;
      partyPosition: { q: number; r: number };
    };
  }
>;

// ═══════════════════════════════════════════════════════════════
// Session Events (Application Layer)
// ═══════════════════════════════════════════════════════════════

/**
 * SessionContextChangedEvent
 *
 * Published by SessionRunner when panel context updates.
 * Consumed by DetailView to sync panel state.
 * Payload uses generic type to avoid circular dependencies with PanelContext.
 */
export type SessionContextChangedEvent = DomainEvent<
  'session:context-changed',
  {
    context: {
      mapId: unknown | null;
      mapName: string;
      partyPosition: { q: number; r: number };
      travelState: unknown;
      currentDateTime: unknown;
      calendar: unknown;
      timeOfDay: string;
      season: unknown | undefined;
      moonPhases: unknown[];
      encounterState: unknown;
      activeEncounter: unknown | null;
    };
  }
>;

// ═══════════════════════════════════════════════════════════════
// Union Type aller Events
// ═══════════════════════════════════════════════════════════════

export type AllDomainEvents =
  // Time
  | TimeChangedEvent
  | DayChangedEvent
  | SeasonChangedEvent
  | TimeOfDayChangedEvent
  | TimeAdvanceRequestedEvent
  // Geography
  | MapLoadedEvent
  | MapCreatedEvent
  | MapDeletedEvent
  | MapChangedEvent
  | MapTilesUpdatedEvent
  | MapSavedEvent
  | PositionChangedEvent
  | MapLoadRequestedEvent
  // Entity
  | EntityLoadedEvent
  | EntityCreatedEvent
  | EntityUpdatedEvent
  | EntityDeletedEvent
  // Environment
  | WeatherUpdatedEvent
  | LightChangedEvent
  // Combat
  | CombatStartedEvent
  | CombatEndedEvent
  | CombatTurnChangedEvent
  // Audio
  | AudioTrackChangedEvent
  | AudioMoodChangedEvent
  // Quest
  | QuestStartedEvent
  | QuestCompletedEvent
  | QuestFailedEvent
  | QuestUpdatedEvent
  // Encounter Events
  | EncounterCheckTriggeredEvent
  | EncounterGeneratedEvent
  | EncounterSkippedEvent
  | EncounterResolvedEvent
  | EncounterStateChangedEvent
  // Encounter Command Events
  | EncounterResolveRequestedEvent
  | EncounterDismissRequestedEvent
  // Encounter Failure Events
  | EncounterTriggerFailedEvent
  | EncounterGenerateFailedEvent
  | EncounterResolveFailedEvent
  // Travel Status Events
  | TravelStartedEvent
  | TravelCompletedEvent
  | TravelPausedEvent
  | TravelResumedEvent
  | TravelStoppedEvent
  | TravelWaypointReachedEvent
  // Travel Command Events
  | TravelStartRequestedEvent
  | TravelPauseRequestedEvent
  | TravelResumeRequestedEvent
  | TravelStopRequestedEvent
  | TravelClearRequestedEvent
  | TravelSpeedChangedEvent
  | TravelWaypointAddRequestedEvent
  | TravelWaypointRemoveRequestedEvent
  | TravelWaypointMoveRequestedEvent
  | TravelPositionSetRequestedEvent
  | TravelTickRequestedEvent
  // Travel Failure Events
  | TravelStartFailedEvent
  | TravelPauseFailedEvent
  | TravelResumeFailedEvent
  | TravelWaypointRemoveFailedEvent
  | TravelWaypointMoveFailedEvent
  // Travel State Sync
  | TravelStateChangedEvent
  // Session Events
  | SessionContextChangedEvent;

// ═══════════════════════════════════════════════════════════════
// Event Type Map (automatisch abgeleitet - DRY!)
// ═══════════════════════════════════════════════════════════════

/**
 * Mapped Type: Extrahiert Event-Type → Event-Objekt aus AllDomainEvents
 * Ergebnis: { 'time:changed': TimeChangedEvent, 'map:loaded': MapLoadedEvent, ... }
 */
export type EventTypeMap = {
  [E in AllDomainEvents as E['type']]: E;
};

/** Alle bekannten Event-Type Strings */
export type KnownEventType = keyof EventTypeMap;

// ═══════════════════════════════════════════════════════════════
// Event Type Constants
// ═══════════════════════════════════════════════════════════════

export const EventTypes = {
  // Time
  TIME_CHANGED: 'time:changed' as const,
  DAY_CHANGED: 'time:dayChanged' as const,
  SEASON_CHANGED: 'time:seasonChanged' as const,
  TIME_OF_DAY_CHANGED: 'time:timeOfDayChanged' as const,
  TIME_ADVANCE_REQUESTED: 'time:advance-requested' as const,

  // Geography
  MAP_LOADED: 'map:loaded' as const,
  MAP_CREATED: 'map:created' as const,
  MAP_DELETED: 'map:deleted' as const,
  MAP_CHANGED: 'map:changed' as const,
  MAP_TILES_UPDATED: 'map:tiles-updated' as const,
  MAP_SAVED: 'map:saved' as const,
  POSITION_CHANGED: 'position:changed' as const,
  MAP_LOAD_REQUESTED: 'map:load-requested' as const,

  // Entity
  ENTITY_LOADED: 'entity:loaded' as const,
  ENTITY_CREATED: 'entity:created' as const,
  ENTITY_UPDATED: 'entity:updated' as const,
  ENTITY_DELETED: 'entity:deleted' as const,

  // Environment
  WEATHER_UPDATED: 'weather:updated' as const,
  LIGHT_CHANGED: 'light:changed' as const,

  // Combat
  COMBAT_STARTED: 'combat:started' as const,
  COMBAT_ENDED: 'combat:ended' as const,
  COMBAT_TURN_CHANGED: 'combat:turnChanged' as const,

  // Audio
  AUDIO_TRACK_CHANGED: 'audio:trackChanged' as const,
  AUDIO_MOOD_CHANGED: 'audio:moodChanged' as const,

  // Quest
  QUEST_STARTED: 'quest:started' as const,
  QUEST_COMPLETED: 'quest:completed' as const,
  QUEST_FAILED: 'quest:failed' as const,
  QUEST_UPDATED: 'quest:updated' as const,

  // Encounter
  ENCOUNTER_CHECK_TRIGGERED: 'encounter:check-triggered' as const,
  ENCOUNTER_GENERATED: 'encounter:generated' as const,
  ENCOUNTER_SKIPPED: 'encounter:skipped' as const,
  ENCOUNTER_RESOLVED: 'encounter:resolved' as const,
  ENCOUNTER_STATE_CHANGED: 'encounter:state-changed' as const,
  // Encounter Command Events
  ENCOUNTER_RESOLVE_REQUESTED: 'encounter:resolve-requested' as const,
  ENCOUNTER_DISMISS_REQUESTED: 'encounter:dismiss-requested' as const,

  // Encounter Failure Events
  ENCOUNTER_TRIGGER_FAILED: 'encounter:trigger-failed' as const,
  ENCOUNTER_GENERATE_FAILED: 'encounter:generate-failed' as const,
  ENCOUNTER_RESOLVE_FAILED: 'encounter:resolve-failed' as const,

  // Travel Status Events
  TRAVEL_STARTED: 'travel:started' as const,
  TRAVEL_COMPLETED: 'travel:completed' as const,
  TRAVEL_PAUSED: 'travel:paused' as const,
  TRAVEL_RESUMED: 'travel:resumed' as const,
  TRAVEL_STOPPED: 'travel:stopped' as const,
  TRAVEL_WAYPOINT_REACHED: 'travel:waypoint-reached' as const,

  // Travel Command Events
  TRAVEL_START_REQUESTED: 'travel:start-requested' as const,
  TRAVEL_PAUSE_REQUESTED: 'travel:pause-requested' as const,
  TRAVEL_RESUME_REQUESTED: 'travel:resume-requested' as const,
  TRAVEL_STOP_REQUESTED: 'travel:stop-requested' as const,
  TRAVEL_CLEAR_REQUESTED: 'travel:clear-requested' as const,
  TRAVEL_SPEED_CHANGED: 'travel:speed-changed' as const,
  TRAVEL_WAYPOINT_ADD_REQUESTED: 'travel:waypoint-add-requested' as const,
  TRAVEL_WAYPOINT_REMOVE_REQUESTED: 'travel:waypoint-remove-requested' as const,
  TRAVEL_WAYPOINT_MOVE_REQUESTED: 'travel:waypoint-move-requested' as const,
  TRAVEL_POSITION_SET_REQUESTED: 'travel:position-set-requested' as const,
  TRAVEL_TICK_REQUESTED: 'travel:tick-requested' as const,

  // Travel Failure Events
  TRAVEL_START_FAILED: 'travel:start-failed' as const,
  TRAVEL_PAUSE_FAILED: 'travel:pause-failed' as const,
  TRAVEL_RESUME_FAILED: 'travel:resume-failed' as const,
  TRAVEL_WAYPOINT_REMOVE_FAILED: 'travel:waypoint-remove-failed' as const,
  TRAVEL_WAYPOINT_MOVE_FAILED: 'travel:waypoint-move-failed' as const,

  // Travel State Sync
  TRAVEL_STATE_CHANGED: 'travel:state-changed' as const,

  // Session Events
  SESSION_CONTEXT_CHANGED: 'session:context-changed' as const,
} as const;
