/**
 * Time Feature types and interfaces.
 *
 * Design from Time-System.md:
 * - Time is a backend feature
 * - Owns currentTime and activeCalendarId
 * - CalendarDefinition is stored in EntityRegistry (not separate storage)
 * - Publishes time:state-changed for reactive features
 */

import type { Result, AppError, CalendarId, Option } from '@core/index';
import type {
  GameDateTime,
  Duration,
  TimeSegment,
  CalendarDefinition,
  TimeState,
} from '@core/schemas';

// ============================================================================
// Time Storage Port
// ============================================================================

/**
 * Storage port for time state persistence.
 * Only stores currentTime and activeCalendarId.
 * CalendarDefinition is loaded from EntityRegistry.
 */
export interface TimeStoragePort {
  /** Load time state from storage */
  load(): Promise<Result<TimeState, AppError>>;

  /** Save time state to storage */
  save(state: TimeState): Promise<Result<void, AppError>>;

  /** Check if time state exists */
  exists(): Promise<boolean>;
}

// ============================================================================
// Calendar Registry Port
// ============================================================================

/**
 * Port for accessing CalendarDefinition from EntityRegistry.
 * CalendarDefinitions are entities, not separate storage.
 */
export interface CalendarRegistryPort {
  /** Get a calendar by ID */
  get(id: CalendarId): Promise<Result<CalendarDefinition, AppError>>;

  /** List all calendar IDs */
  listIds(): Promise<Result<CalendarId[], AppError>>;

  /** Check if calendar exists */
  exists(id: CalendarId): Promise<boolean>;
}

// ============================================================================
// Time Feature Port
// ============================================================================

/**
 * Public interface for the Time Feature.
 * Used by ViewModels and other Features (Travel, Weather, Audio).
 */
export interface TimeFeaturePort {
  // === State Queries ===

  /** Get the current game time */
  getCurrentTime(): GameDateTime;

  /** Get the current time segment (dawn, morning, etc.) */
  getTimeSegment(): TimeSegment;

  /** Get the active calendar definition */
  getActiveCalendar(): Option<CalendarDefinition>;

  /** Get the active calendar ID */
  getActiveCalendarId(): CalendarId;

  /** Check if time state is loaded */
  isLoaded(): boolean;

  // === Time Operations ===

  /**
   * Advance time by a duration. Publishes time:state-changed event.
   * Uses Pessimistic Save-First: persists before updating state.
   */
  advanceTime(duration: Duration): Promise<Result<void, AppError>>;

  /**
   * Set time to a specific datetime. Publishes time:state-changed event.
   * Uses Pessimistic Save-First: persists before updating state.
   */
  setTime(time: GameDateTime): Promise<Result<void, AppError>>;

  // === Persistence ===

  /** Load time state from storage */
  loadTime(): Promise<Result<void, AppError>>;

  /** Save time state to storage */
  saveTime(): Promise<Result<void, AppError>>;

  // === Lifecycle ===

  /** Clean up subscriptions and resources */
  dispose(): void;
}

// ============================================================================
// Internal Time State
// ============================================================================

/**
 * Internal state for the Time Feature.
 * Extends TimeState with cached calendar and dirty tracking.
 */
export interface InternalTimeState {
  /** Current game time */
  currentTime: GameDateTime;

  /** Active calendar ID */
  activeCalendarId: CalendarId;

  /** Cached calendar definition (loaded from EntityRegistry) */
  cachedCalendar: CalendarDefinition | null;

  /** Flag indicating unsaved changes */
  isDirty: boolean;

  /** Flag indicating state has been loaded */
  isLoaded: boolean;
}

/**
 * Create initial time state with defaults.
 */
export function createInitialTimeState(
  defaultTime: GameDateTime,
  defaultCalendarId: CalendarId
): InternalTimeState {
  return {
    currentTime: defaultTime,
    activeCalendarId: defaultCalendarId,
    cachedCalendar: null,
    isDirty: false,
    isLoaded: false,
  };
}
