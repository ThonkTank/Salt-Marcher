/**
 * In-Memory State Gateway
 *
 * Manages current almanac state (active calendar, current timestamp, etc.)
 * in memory for MVP testing.
 */

import type { CalendarSchema } from '../domain/calendar-schema';
import type { CalendarTimestamp } from '../domain/calendar-timestamp';
import type { CalendarEvent } from '../domain/calendar-event';
import { advanceTime } from '../domain/time-arithmetic';
import type { TimeUnit } from '../domain/time-arithmetic';
import type { CalendarRepository, EventRepository } from './in-memory-repository';

export interface AlmanacState {
  activeCalendarId: string | null;
  currentTimestamp: CalendarTimestamp | null;
}

export interface StateSnapshot {
  activeCalendar: CalendarSchema | null;
  currentTimestamp: CalendarTimestamp | null;
  upcomingEvents: CalendarEvent[];
}

export interface AdvanceTimeResult {
  timestamp: CalendarTimestamp;
  triggeredEvents: CalendarEvent[];
}

export class InMemoryStateGateway {
  private state: AlmanacState = {
    activeCalendarId: null,
    currentTimestamp: null,
  };

  constructor(
    private calendarRepo: CalendarRepository,
    private eventRepo: EventRepository
  ) {}

  /**
   * Load current state snapshot
   */
  async loadSnapshot(): Promise<StateSnapshot> {
    const { activeCalendarId, currentTimestamp } = this.state;

    if (!activeCalendarId) {
      return {
        activeCalendar: null,
        currentTimestamp: null,
        upcomingEvents: [],
      };
    }

    const activeCalendar = await this.calendarRepo.getCalendar(activeCalendarId);

    if (!activeCalendar) {
      return {
        activeCalendar: null,
        currentTimestamp: null,
        upcomingEvents: [],
      };
    }

    const upcomingEvents = currentTimestamp
      ? await this.eventRepo.getUpcomingEvents(activeCalendarId, activeCalendar, currentTimestamp, 5)
      : [];

    return {
      activeCalendar,
      currentTimestamp,
      upcomingEvents,
    };
  }

  /**
   * Set active calendar
   */
  async setActiveCalendar(calendarId: string, initialTimestamp: CalendarTimestamp): Promise<void> {
    const calendar = await this.calendarRepo.getCalendar(calendarId);

    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    this.state.activeCalendarId = calendarId;
    this.state.currentTimestamp = initialTimestamp;
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

    const result = advanceTime(calendar, currentTimestamp, amount, unit);
    this.state.currentTimestamp = result.timestamp;

    const triggeredEvents = await this.eventRepo.getEventsInRange(
      activeCalendarId,
      calendar,
      currentTimestamp,
      result.timestamp
    );

    return { timestamp: result.timestamp, triggeredEvents };
  }

  /**
   * Get current state (for debugging)
   */
  getCurrentState(): AlmanacState {
    return { ...this.state };
  }

  /**
   * Reset state (for testing)
   */
  reset(): void {
    this.state = {
      activeCalendarId: null,
      currentTimestamp: null,
    };
  }
}
