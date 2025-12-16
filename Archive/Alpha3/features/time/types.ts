/**
 * Time Feature - Types
 * Inbound Port (TimeFeaturePort) und Outbound Port (TimeStoragePort)
 */

import type {
  DateTime,
  Duration,
  CalendarConfig,
  TimeOfDay,
  SeasonConfig,
} from '@core/schemas/time';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Reason for time change (for events) */
export type TimeChangeReason = 'tick' | 'travel' | 'rest' | 'manual';

/** Persisted state */
export interface TimeState {
  currentDateTime: DateTime;
  calendarId: string;
}

/** Moon phase info */
export interface MoonPhaseInfo {
  moon: string;
  phase: string;
}

/** Result of advanceTime() - contains all change information */
export interface TimeAdvanceResult {
  previous: DateTime;
  current: DateTime;
  dayChanged: boolean;
  timeOfDayChange: { previous: TimeOfDay; current: TimeOfDay } | null;
  seasonChange: { previous: string | null; current: string | null } | null;
}

/** Result of setDateTime() */
export interface SetDateTimeResult {
  previous: DateTime;
  current: DateTime;
}

// ═══════════════════════════════════════════════════════════════
// Inbound Port - TimeFeaturePort
// ═══════════════════════════════════════════════════════════════

/**
 * Inbound Port für das Time Feature
 * Wird von Application Layer und anderen Features aufgerufen
 */
export interface TimeFeaturePort {
  // ─────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────

  /** Current game time */
  getCurrentDateTime(): DateTime;

  /** Active calendar configuration */
  getCalendar(): CalendarConfig;

  /** Current time of day (dawn, morning, etc.) */
  getTimeOfDay(): TimeOfDay;

  /** Current season */
  getCurrentSeason(): SeasonConfig | undefined;

  /** Moon phases of all moons */
  getMoonPhases(): MoonPhaseInfo[];

  // ─────────────────────────────────────────────────────────────
  // Commands
  // ─────────────────────────────────────────────────────────────

  /**
   * Advance time by duration
   * @returns Result with previous/new state and change flags
   */
  advanceTime(duration: Duration, reason: TimeChangeReason): TimeAdvanceResult;

  /**
   * Set time directly (e.g. for manual corrections)
   * @returns Result with previous/new state
   */
  setDateTime(dateTime: DateTime): SetDateTimeResult;

  /**
   * Switch calendar
   * Loads calendar from storage or uses built-in
   */
  setCalendar(calendarId: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  /** Initialize feature, load state from storage */
  initialize(): Promise<void>;

  /** Cleanup on plugin unload */
  dispose(): void;
}

// ═══════════════════════════════════════════════════════════════
// Outbound Port - TimeStoragePort
// ═══════════════════════════════════════════════════════════════

/**
 * Outbound Port for persistence
 * Implemented by infrastructure layer (Vault Adapter)
 */
export interface TimeStoragePort {
  /**
   * Load saved state
   * @returns null if no state exists yet
   */
  loadState(): Promise<TimeState | null>;

  /** Save current state */
  saveState(state: TimeState): Promise<void>;

  /**
   * Load calendar configuration
   * @param id Calendar ID (e.g. "gregorian", "harptos")
   * @returns null if calendar not found
   */
  loadCalendar(id: string): Promise<CalendarConfig | null>;

  /** List available calendars (built-in + custom) */
  listCalendars(): Promise<Array<{ id: string; name: string }>>;
}
