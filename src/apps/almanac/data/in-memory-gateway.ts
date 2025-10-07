// src/apps/almanac/data/in-memory-gateway.ts
// In-memory gateway managing Almanac state snapshots for tests and demos.

/**
 * In-Memory State Gateway
 *
 * Manages current almanac state (active calendar, current timestamp, etc.)
 * in memory for MVP testing.
 */

import type { CalendarSchema } from '../domain/calendar-schema';
import type { CalendarTimestamp } from '../domain/calendar-timestamp';
import { createDayTimestamp } from '../domain/calendar-timestamp';
import type { CalendarEvent } from '../domain/calendar-event';
import type { Phenomenon, PhenomenonOccurrence } from '../domain/phenomenon';
import { isPhenomenonVisibleForCalendar } from '../domain/phenomenon';
import {
  computeNextPhenomenonOccurrence,
  computePhenomenonOccurrencesInRange,
  sortOccurrencesByTimestamp,
} from '../domain/phenomenon-engine';
import { advanceTime } from '../domain/time-arithmetic';
import type { TimeUnit } from '../domain/time-arithmetic';
import type { CalendarRepository, EventRepository, PhenomenonRepository } from './in-memory-repository';
import type { AlmanacPreferencesSnapshot } from '../mode/contracts';

export interface AlmanacState {
  activeCalendarId: string | null;
  currentTimestamp: CalendarTimestamp | null;
}

export interface StateSnapshot {
  activeCalendar: CalendarSchema | null;
  currentTimestamp: CalendarTimestamp | null;
  upcomingEvents: CalendarEvent[];
  upcomingPhenomena: PhenomenonOccurrence[];
  defaultCalendarId: string | null;
  isGlobalDefault: boolean;
  wasAutoSelected: boolean; // True if calendar was auto-selected due to missing default
  travelDefaultCalendarId?: string | null;
}

export interface AdvanceTimeResult {
  timestamp: CalendarTimestamp;
  triggeredEvents: CalendarEvent[];
  triggeredPhenomena: PhenomenonOccurrence[];
  upcomingPhenomena: PhenomenonOccurrence[];
}

export class InMemoryStateGateway {
  private state: AlmanacState = {
    activeCalendarId: null,
    currentTimestamp: null,
  };
  private preferences: AlmanacPreferencesSnapshot = {};

  constructor(
    private calendarRepo: CalendarRepository,
    private eventRepo: EventRepository,
    private phenomenonRepo: PhenomenonRepository,
  ) {}

  /**
   * Load current state snapshot
   */
  async loadSnapshot(travelId?: string): Promise<StateSnapshot> {
    const { activeCalendarId, currentTimestamp } = this.state;

    // Get effective calendar (respects travel defaults)
    const effectiveCalendar = await this.getEffectiveCalendar(travelId);
    const travelDefaultCalendarId = travelId
      ? await this.calendarRepo.getTravelDefault(travelId)
      : null;

    if (!effectiveCalendar) {
      return {
        activeCalendar: null,
        currentTimestamp: null,
        upcomingEvents: [],
        upcomingPhenomena: [],
        defaultCalendarId: null,
        isGlobalDefault: false,
        wasAutoSelected: false,
        travelDefaultCalendarId,
      };
    }

    const activeCalendar = activeCalendarId
      ? await this.calendarRepo.getCalendar(activeCalendarId)
      : effectiveCalendar.calendar;

    if (!activeCalendar) {
      const defaultCalendarId = effectiveCalendar.isGlobalDefault
        ? effectiveCalendar.calendar?.id ?? null
        : null;
      return {
        activeCalendar: null,
        currentTimestamp: null,
        upcomingEvents: [],
        upcomingPhenomena: [],
        defaultCalendarId,
        isGlobalDefault: effectiveCalendar.isGlobalDefault,
        wasAutoSelected: effectiveCalendar.wasAutoSelected,
        travelDefaultCalendarId,
      };
    }

    const upcomingEvents = currentTimestamp
      ? await this.eventRepo.getUpcomingEvents(activeCalendar.id, activeCalendar, currentTimestamp, 5)
      : [];

    const visiblePhenomena = await this.listVisiblePhenomena(activeCalendar);
    const upcomingPhenomena = this.computeUpcomingPhenomenaForCalendar(
      activeCalendar,
      visiblePhenomena,
      currentTimestamp,
    );

    const defaultCalendarId = effectiveCalendar.isGlobalDefault
      ? effectiveCalendar.calendar.id
      : null;

    return {
      activeCalendar,
      currentTimestamp,
      upcomingEvents,
      upcomingPhenomena,
      defaultCalendarId,
      isGlobalDefault: effectiveCalendar.isGlobalDefault,
      wasAutoSelected: effectiveCalendar.wasAutoSelected,
      travelDefaultCalendarId,
    };
  }

  /**
   * Set active calendar
   */
  async setActiveCalendar(calendarId: string, initialTimestamp?: CalendarTimestamp): Promise<void> {
    const calendar = await this.calendarRepo.getCalendar(calendarId);

    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    this.state.activeCalendarId = calendarId;
    if (initialTimestamp) {
      this.state.currentTimestamp = initialTimestamp;
      return;
    }

    if (this.state.currentTimestamp && this.state.activeCalendarId === calendarId) {
      return;
    }

    const firstMonth = calendar.months[0];
    const fallback = createDayTimestamp(
      calendar.id,
      calendar.epoch.year,
      firstMonth?.id ?? calendar.epoch.monthId,
      calendar.epoch.day,
    );

    this.state.currentTimestamp = fallback;
  }

  async setCurrentTimestamp(timestamp: CalendarTimestamp): Promise<void> {
    if (!this.state.activeCalendarId) {
      throw new Error('No active calendar set');
    }
    if (timestamp.calendarId !== this.state.activeCalendarId) {
      throw new Error('Timestamp calendar does not match active calendar');
    }

    this.state.currentTimestamp = timestamp;
  }

  /**
   * Advance time by amount
   */
  async advanceTimeBy(amount: number, unit: TimeUnit): Promise<AdvanceTimeResult> {
    const { activeCalendarId, currentTimestamp } = this.state;

    if (!activeCalendarId || !currentTimestamp) {
      throw new Error('No active calendar or current timestamp set');
    }

    const calendar = await this.calendarRepo.getCalendar(activeCalendarId);
    if (!calendar) {
      throw new Error(`Calendar ${activeCalendarId} not found`);
    }

    const visiblePhenomena = await this.listVisiblePhenomena(calendar);

    const result = advanceTime(calendar, currentTimestamp, amount, unit);
    this.state.currentTimestamp = result.timestamp;

    const [triggeredEvents, triggeredPhenomena] = await Promise.all([
      this.eventRepo.getEventsInRange(activeCalendarId, calendar, currentTimestamp, result.timestamp),
      Promise.resolve(
        this.computeTriggeredPhenomenaBetween(calendar, visiblePhenomena, currentTimestamp, result.timestamp),
      ),
    ]);

    const upcomingPhenomena = this.computeUpcomingPhenomenaForCalendar(
      calendar,
      visiblePhenomena,
      result.timestamp,
    );

    return { timestamp: result.timestamp, triggeredEvents, triggeredPhenomena, upcomingPhenomena };
  }

  /**
   * Get current state (for debugging)
   */
  getCurrentState(): AlmanacState {
    return { ...this.state };
  }

  getCurrentTimestamp(): CalendarTimestamp | null {
    return this.state.currentTimestamp ? { ...this.state.currentTimestamp } : null;
  }

  getActiveCalendarId(): string | null {
    return this.state.activeCalendarId;
  }

  private async listVisiblePhenomena(calendar: CalendarSchema): Promise<Phenomenon[]> {
    const all = await this.phenomenonRepo.listPhenomena();
    return all.filter(phenomenon => isPhenomenonVisibleForCalendar(phenomenon, calendar.id));
  }

  private computeUpcomingPhenomenaForCalendar(
    calendar: CalendarSchema,
    phenomena: ReadonlyArray<Phenomenon>,
    from: CalendarTimestamp | null,
    limit: number = 5,
  ): PhenomenonOccurrence[] {
    if (phenomena.length === 0) {
      return [];
    }

    const anchor = from
      ?? createDayTimestamp(calendar.id, calendar.epoch.year, calendar.epoch.monthId, calendar.epoch.day);

    const occurrences: PhenomenonOccurrence[] = [];
    for (const phenomenon of phenomena) {
      try {
        const occurrence = computeNextPhenomenonOccurrence(
          phenomenon,
          calendar,
          calendar.id,
          anchor,
          { includeStart: true },
        );
        if (occurrence) {
          occurrences.push(occurrence);
        }
      } catch {
        // Unsupported rules/time policies are skipped for now.
        continue;
      }
    }

    return sortOccurrencesByTimestamp(calendar, occurrences).slice(0, limit);
  }

  private computeTriggeredPhenomenaBetween(
    calendar: CalendarSchema,
    phenomena: ReadonlyArray<Phenomenon>,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): PhenomenonOccurrence[] {
    if (phenomena.length === 0) {
      return [];
    }

    const occurrences: PhenomenonOccurrence[] = [];
    for (const phenomenon of phenomena) {
      try {
        const matches = computePhenomenonOccurrencesInRange(
          phenomenon,
          calendar,
          calendar.id,
          start,
          end,
          { includeStart: false, limit: 50 },
        );
        occurrences.push(...matches);
      } catch {
        continue;
      }
    }

    return sortOccurrencesByTimestamp(calendar, occurrences);
  }

  /**
   * Reset state (for testing)
   */
  reset(): void {
    this.state = {
      activeCalendarId: null,
      currentTimestamp: null,
    };
    this.preferences = {};
  }

  /**
   * Get effective calendar with default resolution
   * Priority: Travel Default > Global Default > First Available > null
   */
  async getEffectiveCalendar(travelId?: string): Promise<{
    calendar: CalendarSchema;
    isGlobalDefault: boolean;
    wasAutoSelected: boolean;
  } | null> {
    // Try travel-specific default first
    if (travelId) {
      const travelDefaultId = await this.calendarRepo.getTravelDefault(travelId);
      if (travelDefaultId) {
        const calendar = await this.calendarRepo.getCalendar(travelDefaultId);
        if (calendar) {
          return { calendar, isGlobalDefault: false, wasAutoSelected: false };
        }
      }
    }

    // Try global default
    const globalDefault = await this.calendarRepo.getGlobalDefault();
    if (globalDefault) {
      return { calendar: globalDefault, isGlobalDefault: true, wasAutoSelected: false };
    }

    // Fallback: Use first available calendar
    const allCalendars = await this.calendarRepo.listCalendars();
    if (allCalendars.length > 0) {
      return { calendar: allCalendars[0], isGlobalDefault: false, wasAutoSelected: true };
    }

    return null;
  }

  async loadPreferences(): Promise<AlmanacPreferencesSnapshot> {
    return {
      ...this.preferences,
      lastZoomByMode: this.preferences.lastZoomByMode
        ? { ...this.preferences.lastZoomByMode }
        : undefined,
      eventsFilters: this.preferences.eventsFilters
        ? {
            categories: [...(this.preferences.eventsFilters.categories ?? [])],
            calendarIds: [...(this.preferences.eventsFilters.calendarIds ?? [])],
          }
        : undefined,
    };
  }

  async savePreferences(partial: Partial<AlmanacPreferencesSnapshot>): Promise<void> {
    const next: AlmanacPreferencesSnapshot = {
      ...this.preferences,
      ...partial,
    };

    if (partial.lastZoomByMode) {
      next.lastZoomByMode = {
        ...(this.preferences.lastZoomByMode ?? {}),
        ...partial.lastZoomByMode,
      };
    }

    this.preferences = next;
  }
}
