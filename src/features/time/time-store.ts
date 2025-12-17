/**
 * Time Feature store.
 *
 * Manages the current time state including datetime and active calendar.
 */

import type { CalendarId } from '@core/index';
import type { GameDateTime, CalendarDefinition } from '@core/schemas';
import type { InternalTimeState } from './types';
import { createInitialTimeState } from './types';
import { DEFAULT_GAME_TIME, DEFAULT_CALENDAR_ID } from '@core/schemas';

// ============================================================================
// Time Store
// ============================================================================

/**
 * Create a time store for managing time state.
 */
export function createTimeStore() {
  let state: InternalTimeState = createInitialTimeState(
    DEFAULT_GAME_TIME,
    DEFAULT_CALENDAR_ID as CalendarId
  );

  return {
    /**
     * Get current state (read-only).
     */
    getState(): Readonly<InternalTimeState> {
      return state;
    },

    /**
     * Initialize state from loaded data.
     */
    initialize(
      currentTime: GameDateTime,
      activeCalendarId: CalendarId,
      calendar: CalendarDefinition | null
    ): void {
      state = {
        currentTime,
        activeCalendarId,
        cachedCalendar: calendar,
        isDirty: false,
        isLoaded: true,
      };
    },

    /**
     * Update the current time.
     */
    setTime(time: GameDateTime): void {
      state = {
        ...state,
        currentTime: time,
        isDirty: true,
      };
    },

    /**
     * Set the active calendar.
     */
    setActiveCalendar(
      calendarId: CalendarId,
      calendar: CalendarDefinition
    ): void {
      state = {
        ...state,
        activeCalendarId: calendarId,
        cachedCalendar: calendar,
        isDirty: true,
      };
    },

    /**
     * Update cached calendar without changing ID.
     */
    setCachedCalendar(calendar: CalendarDefinition): void {
      state = {
        ...state,
        cachedCalendar: calendar,
      };
    },

    /**
     * Mark state as saved (not dirty).
     */
    markSaved(): void {
      state = {
        ...state,
        isDirty: false,
      };
    },

    /**
     * Clear the store to initial state.
     */
    clear(): void {
      state = createInitialTimeState(
        DEFAULT_GAME_TIME,
        DEFAULT_CALENDAR_ID as CalendarId
      );
    },
  };
}

export type TimeStore = ReturnType<typeof createTimeStore>;
