/**
 * Time Feature service.
 *
 * Provides time operations: advance, set, segment detection.
 * Publishes time:state-changed and time:segment-changed events for reactive features.
 * Handles time:advance-requested and time:set-requested command events.
 *
 * From Time-System.md specification.
 */

import type {
  Result,
  AppError,
  CalendarId,
  Option,
  EventBus,
  Unsubscribe,
} from '@core/index';
import {
  ok,
  err,
  some,
  none,
  createError,
  createEvent,
  newCorrelationId,
  now,
  EventTypes,
} from '@core/index';
import type {
  GameDateTime,
  Duration,
  TimeSegment,
  CalendarDefinition,
} from '@core/schemas';
import { DEFAULT_GAME_TIME, DEFAULT_CALENDAR_ID } from '@core/schemas';
import type { TimeFeaturePort, TimeStoragePort, CalendarRegistryPort } from './types';
import type { TimeStore } from './time-store';
import { getTimeSegment, addDuration } from './time-utils';
import type {
  TimeStateChangedPayload,
  TimeSegmentChangedPayload,
  TimeDayChangedPayload,
  TimeAdvanceRequestedPayload,
  TimeSetRequestedPayload,
} from '@core/events/domain-events';

// ============================================================================
// Time Service
// ============================================================================

export interface TimeServiceDeps {
  store: TimeStore;
  storage: TimeStoragePort;
  calendarRegistry: CalendarRegistryPort;
  eventBus: EventBus;
}

/**
 * Create the time service (implements TimeFeaturePort).
 */
export function createTimeService(deps: TimeServiceDeps): TimeFeaturePort {
  const { store, storage, calendarRegistry, eventBus } = deps;

  /**
   * Get calendar from cache or load it.
   */
  async function ensureCalendarLoaded(): Promise<CalendarDefinition | null> {
    const state = store.getState();

    if (state.cachedCalendar) {
      return state.cachedCalendar;
    }

    const result = await calendarRegistry.get(state.activeCalendarId);
    if (result.ok) {
      store.setCachedCalendar(result.value);
      return result.value;
    }

    return null;
  }

  // Track subscriptions for cleanup
  const subscriptions: Unsubscribe[] = [];

  /**
   * Publish time state changed event.
   */
  function publishStateChanged(
    previousTime: GameDateTime,
    currentTime: GameDateTime,
    duration?: Duration,
    correlationId?: string
  ): void {
    const state = store.getState();
    const payload: TimeStateChangedPayload = {
      previousTime,
      currentTime,
      activeCalendarId: state.activeCalendarId,
      duration,
    };

    eventBus.publish(
      createEvent(EventTypes.TIME_STATE_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'time-feature',
      })
    );
  }

  /**
   * Publish time segment changed event.
   */
  function publishSegmentChanged(
    previousSegment: TimeSegment,
    newSegment: TimeSegment,
    correlationId?: string
  ): void {
    const payload: TimeSegmentChangedPayload = {
      previousSegment,
      newSegment,
    };

    eventBus.publish(
      createEvent(EventTypes.TIME_SEGMENT_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'time-feature',
      })
    );
  }

  /**
   * Publish day changed event.
   */
  function publishDayChanged(
    previousDay: number,
    newDay: number,
    correlationId?: string
  ): void {
    const payload: TimeDayChangedPayload = {
      previousDay,
      newDay,
    };

    eventBus.publish(
      createEvent(EventTypes.TIME_DAY_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'time-feature',
      })
    );
  }

  // ===========================================================================
  // Event Handlers for Command Events
  // ===========================================================================

  /**
   * Handle time:advance-requested command event.
   * Uses Pessimistic Save-First: persists before updating state.
   */
  function setupEventHandlers(): void {
    // Handle advance time requests
    subscriptions.push(
      eventBus.subscribe<TimeAdvanceRequestedPayload>(
        EventTypes.TIME_ADVANCE_REQUESTED,
        async (event) => {
          const { duration, reason } = event.payload;
          const correlationId = event.correlationId;

          const state = store.getState();
          const calendar = state.cachedCalendar;

          if (!calendar) {
            console.warn(
              'Time: Cannot advance time without loaded calendar',
              { reason }
            );
            return;
          }

          const previousTime = state.currentTime;
          const previousSegment = getTimeSegment(previousTime, calendar);
          const previousDay = previousTime.day;

          // Calculate new time
          const newTime = addDuration(previousTime, duration, calendar);

          // 1. Pessimistic Save-First: persist before updating state
          const saveResult = await storage.save({
            currentTime: newTime,
            activeCalendarId: state.activeCalendarId,
          });
          if (!saveResult.ok) {
            console.warn('Time: Failed to save time state', saveResult.error);
            return; // State remains unchanged on error
          }

          // 2. Update state after successful save
          store.setTime(newTime);
          store.markSaved();

          // 3. Publish events with same correlationId
          publishStateChanged(previousTime, newTime, duration, correlationId);

          // Check for segment change
          const newSegment = getTimeSegment(newTime, calendar);
          if (previousSegment !== newSegment) {
            publishSegmentChanged(previousSegment, newSegment, correlationId);
          }

          // Check for day change
          if (
            previousDay !== newTime.day ||
            previousTime.month !== newTime.month
          ) {
            publishDayChanged(previousDay, newTime.day, correlationId);
          }
        }
      )
    );

    // Handle set time requests
    subscriptions.push(
      eventBus.subscribe<TimeSetRequestedPayload>(
        EventTypes.TIME_SET_REQUESTED,
        async (event) => {
          const { newDateTime: time } = event.payload;
          const correlationId = event.correlationId;

          const state = store.getState();
          const calendar = state.cachedCalendar;

          const previousTime = state.currentTime;

          // 1. Pessimistic Save-First: persist before updating state
          const saveResult = await storage.save({
            currentTime: time,
            activeCalendarId: state.activeCalendarId,
          });
          if (!saveResult.ok) {
            console.warn('Time: Failed to save time state', saveResult.error);
            return; // State remains unchanged on error
          }

          // 2. Update state after successful save
          store.setTime(time);
          store.markSaved();

          // 3. Publish events (no duration for direct set)
          publishStateChanged(previousTime, time, undefined, correlationId);

          // Check for segment change if calendar is loaded
          if (calendar) {
            const previousSegment = getTimeSegment(previousTime, calendar);
            const newSegment = getTimeSegment(time, calendar);
            if (previousSegment !== newSegment) {
              publishSegmentChanged(previousSegment, newSegment, correlationId);
            }
          }
        }
      )
    );
  }

  // Set up event handlers immediately
  setupEventHandlers();

  return {
    // =========================================================================
    // State Queries
    // =========================================================================

    getCurrentTime(): GameDateTime {
      return store.getState().currentTime;
    },

    getTimeSegment(): TimeSegment {
      const state = store.getState();
      const calendar = state.cachedCalendar;

      if (!calendar) {
        // Fallback: simple hour-based segment
        const hour = state.currentTime.hour;
        if (hour >= 5 && hour < 7) return 'dawn';
        if (hour >= 7 && hour < 11) return 'morning';
        if (hour >= 11 && hour < 14) return 'midday';
        if (hour >= 14 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 20) return 'dusk';
        return 'night';
      }

      return getTimeSegment(state.currentTime, calendar);
    },

    getActiveCalendar(): Option<CalendarDefinition> {
      const calendar = store.getState().cachedCalendar;
      return calendar ? some(calendar) : none();
    },

    getActiveCalendarId(): CalendarId {
      return store.getState().activeCalendarId;
    },

    isLoaded(): boolean {
      return store.getState().isLoaded;
    },

    // =========================================================================
    // Time Operations
    // =========================================================================

    async advanceTime(duration: Duration): Promise<Result<void, AppError>> {
      const state = store.getState();
      const calendar = state.cachedCalendar;

      if (!calendar) {
        return err(createError('NO_CALENDAR', 'Cannot advance time without loaded calendar'));
      }

      const previousTime = state.currentTime;
      const previousSegment = getTimeSegment(previousTime, calendar);
      const previousDay = previousTime.day;

      // Calculate new time
      const newTime = addDuration(previousTime, duration, calendar);

      // 1. Pessimistic Save-First: persist before updating state
      const saveResult = await storage.save({
        currentTime: newTime,
        activeCalendarId: state.activeCalendarId,
      });
      if (!saveResult.ok) {
        return saveResult; // State remains unchanged on error
      }

      // 2. Update state after successful save
      store.setTime(newTime);
      store.markSaved();

      // 3. Publish events
      publishStateChanged(previousTime, newTime, duration);

      // Check for segment change
      const newSegment = getTimeSegment(newTime, calendar);
      if (previousSegment !== newSegment) {
        publishSegmentChanged(previousSegment, newSegment);
      }

      // Check for day change
      if (previousDay !== newTime.day || previousTime.month !== newTime.month) {
        publishDayChanged(previousDay, newTime.day);
      }

      return ok(undefined);
    },

    async setTime(time: GameDateTime): Promise<Result<void, AppError>> {
      const state = store.getState();
      const calendar = state.cachedCalendar;

      const previousTime = state.currentTime;

      // 1. Pessimistic Save-First: persist before updating state
      const saveResult = await storage.save({
        currentTime: time,
        activeCalendarId: state.activeCalendarId,
      });
      if (!saveResult.ok) {
        return saveResult; // State remains unchanged on error
      }

      // 2. Update state after successful save
      store.setTime(time);
      store.markSaved();

      // 3. Publish events
      publishStateChanged(previousTime, time);

      // Check for segment change if calendar is loaded
      if (calendar) {
        const previousSegment = getTimeSegment(previousTime, calendar);
        const newSegment = getTimeSegment(time, calendar);
        if (previousSegment !== newSegment) {
          publishSegmentChanged(previousSegment, newSegment);
        }
      }

      return ok(undefined);
    },

    // =========================================================================
    // Persistence
    // =========================================================================

    async loadTime(): Promise<Result<void, AppError>> {
      // Try to load existing time state
      const exists = await storage.exists();

      if (exists) {
        const loadResult = await storage.load();
        if (loadResult.ok) {
          // Successful load - use stored state
          const { currentTime, activeCalendarId } = loadResult.value;
          const calendarResult = await calendarRegistry.get(activeCalendarId);
          const calendar = calendarResult.ok ? calendarResult.value : null;

          store.initialize(currentTime, activeCalendarId, calendar);
          return ok(undefined);
        }

        // Recovery: Invalid state file → fall through to defaults
        console.warn('Time: Invalid state file, using defaults:', loadResult.error);
      }

      // No existing state OR invalid state - use defaults
      const defaultCalendarId = DEFAULT_CALENDAR_ID as CalendarId;

      // Try to load the default calendar
      const calendarResult = await calendarRegistry.get(defaultCalendarId);
      const calendar = calendarResult.ok ? calendarResult.value : null;

      // Warn if calendar not found (helps debugging)
      if (!calendar) {
        console.warn('Time: Default calendar not found:', defaultCalendarId);
      }

      store.initialize(DEFAULT_GAME_TIME, defaultCalendarId, calendar);

      // Save the corrected/default state
      const saveResult = await storage.save({
        currentTime: DEFAULT_GAME_TIME,
        activeCalendarId: defaultCalendarId,
      });

      if (!saveResult.ok) {
        console.warn('Time: Failed to save initial state:', saveResult.error);
      }

      return ok(undefined);
    },

    async saveTime(): Promise<Result<void, AppError>> {
      const state = store.getState();

      if (!state.isLoaded) {
        return err(createError('NOT_LOADED', 'Time state not loaded'));
      }

      const result = await storage.save({
        currentTime: state.currentTime,
        activeCalendarId: state.activeCalendarId,
      });

      if (result.ok) {
        store.markSaved();
      }

      return result;
    },

    // =========================================================================
    // Lifecycle
    // =========================================================================

    dispose(): void {
      // Clean up all EventBus subscriptions
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
    },
  };
}
