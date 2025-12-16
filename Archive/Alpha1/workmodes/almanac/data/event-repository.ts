// src/workmodes/almanac/data/event-repository.ts
// Repository for querying calendar events with range and filtering support

import {
  compareTimestampsWithSchema,
  getEventAnchorTimestamp,
  isSingleEvent,
  computeEventOccurrencesInRange,
} from "../helpers";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp } from "../helpers";

/**
 * Base event repository interface (already exists in repositories.ts)
 */
export interface BaseEventRepository {
  listEvents(calendarId: string): Promise<ReadonlyArray<CalendarEvent>>;
  getEvent?(eventId: string): Promise<CalendarEvent | null>;
  createEvent?(event: CalendarEvent): Promise<void>;
  updateEvent?(eventId: string, updates: Partial<CalendarEvent>): Promise<void>;
  deleteEvent?(eventId: string): Promise<void>;
}

/**
 * Event repository with query capabilities and date indexing
 *
 * Extends base repository with range-based queries, sorted queries, and O(1) date lookups.
 * The date index is built lazily on first query and invalidated on mutations.
 */
export class EventRepository {
  private dateIndex: Map<string, Set<string>> | null = null; // "YYYY-MM-DD" -> eventIds
  private singleEventIds: Set<string> = new Set();
  private recurringEventIds: Set<string> = new Set();
  private eventCache: Map<string, CalendarEvent> = new Map();
  private calendarIdCache: string | null = null;

  constructor(private readonly storage: BaseEventRepository) {}

  /**
   * Get all events for a calendar
   *
   * @param calendarId - Calendar ID
   * @returns All events for the calendar
   */
  async getAll(calendarId: string): Promise<ReadonlyArray<CalendarEvent>> {
    const events = await this.storage.listEvents(calendarId);
    this.updateCache(calendarId, events);
    return events;
  }

  /**
   * Get single event by ID
   *
   * @param eventId - Event ID
   * @returns Event or null if not found
   */
  async getById(eventId: string): Promise<CalendarEvent | null> {
    if (typeof this.storage.getEvent === "function") {
      return this.storage.getEvent(eventId);
    }
    // Fallback: scan all events (inefficient but functional)
    // Note: This requires knowing the calendar ID, which we don't have here
    // In practice, this should never be called without getEvent() implemented
    return null;
  }

  /**
   * Get all events occurring on a specific day (O(1) for single events).
   * Uses date index for fast lookups.
   *
   * @param calendarId - Calendar ID
   * @param calendar - Calendar schema for recurrence checks
   * @param year - Year
   * @param month - Month (1-based index)
   * @param day - Day
   * @returns Events occurring on this day
   */
  async getEventsForDay(
    calendarId: string,
    calendar: CalendarSchema,
    year: number,
    month: number,
    day: number,
  ): Promise<CalendarEvent[]> {
    await this.ensureIndexBuilt(calendarId);

    const dateKey = this.getDateKey(year, month, day);
    const eventIds = this.dateIndex?.get(dateKey) || new Set<string>();

    // O(1) lookup for single events
    const singleEvents: CalendarEvent[] = [];
    for (const id of eventIds) {
      if (this.singleEventIds.has(id)) {
        const event = this.eventCache.get(id);
        if (event) singleEvents.push(event);
      }
    }

    // O(k) check for recurring events (k << n)
    const recurringEvents: CalendarEvent[] = [];
    for (const id of this.recurringEventIds) {
      const event = this.eventCache.get(id);
      if (event && this.eventOccursOnDay(event, calendar, year, month, day)) {
        recurringEvents.push(event);
      }
    }

    return [...singleEvents, ...recurringEvents];
  }

  /**
   * Save (create or update) an event
   *
   * @param event - Event to save
   */
  async save(event: CalendarEvent): Promise<void> {
    // Check if event exists
    const existing = await this.getById(event.id);

    if (existing) {
      if (typeof this.storage.updateEvent === "function") {
        await this.storage.updateEvent(event.id, event);
      } else {
        throw new Error("Event repository does not support updates");
      }
    } else {
      if (typeof this.storage.createEvent === "function") {
        await this.storage.createEvent(event);
      } else {
        throw new Error("Event repository does not support creation");
      }
    }

    this.invalidateIndex();
  }

  /**
   * Delete an event
   *
   * @param eventId - Event ID to delete
   */
  async delete(eventId: string): Promise<void> {
    if (typeof this.storage.deleteEvent === "function") {
      await this.storage.deleteEvent(eventId);
    } else {
      throw new Error("Event repository does not support deletion");
    }

    this.invalidateIndex();
  }

  /**
   * Get events within a date range
   *
   * @param calendarId - Calendar ID
   * @param calendar - Calendar schema for date comparison
   * @param start - Range start timestamp
   * @param end - Range end timestamp
   * @returns Events within the range (inclusive)
   */
  async getEventsInRange(
    calendarId: string,
    calendar: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<ReadonlyArray<CalendarEvent>> {
    const events = await this.getAll(calendarId);

    // Normalize range (ensure start <= end)
    const [rangeStart, rangeEnd] =
      compareTimestampsWithSchema(calendar, start, end) <= 0
        ? [start, end]
        : [end, start];

    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const afterStart = compareTimestampsWithSchema(calendar, anchor, rangeStart) >= 0;
      const beforeEnd = compareTimestampsWithSchema(calendar, anchor, rangeEnd) <= 0;
      return afterStart && beforeEnd;
    });
  }

  /**
   * Get upcoming events from a starting point
   *
   * @param calendarId - Calendar ID
   * @param calendar - Calendar schema for date comparison
   * @param from - Starting timestamp
   * @param limit - Maximum number of events to return
   * @returns Upcoming events sorted by date
   */
  async getUpcomingEvents(
    calendarId: string,
    calendar: CalendarSchema,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<ReadonlyArray<CalendarEvent>> {
    const events = await this.getAll(calendarId);

    return events
      .filter(event => {
        const anchor = getEventAnchorTimestamp(event) ?? event.date;
        return compareTimestampsWithSchema(calendar, anchor, from) >= 0;
      })
      .sort((a, b) => {
        const anchorA = getEventAnchorTimestamp(a) ?? a.date;
        const anchorB = getEventAnchorTimestamp(b) ?? b.date;
        return compareTimestampsWithSchema(calendar, anchorA, anchorB);
      })
      .slice(0, limit);
  }

  /**
   * Get events between two timestamps (exclusive of start)
   *
   * Used for time advancement to find triggered events
   *
   * @param calendarId - Calendar ID
   * @param calendar - Calendar schema
   * @param start - Start timestamp (exclusive)
   * @param end - End timestamp (inclusive)
   * @returns Events in range
   */
  async getEventsBetween(
    calendarId: string,
    calendar: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<ReadonlyArray<CalendarEvent>> {
    const events = await this.getAll(calendarId);

    // Normalize range
    const [rangeStart, rangeEnd] =
      compareTimestampsWithSchema(calendar, start, end) <= 0
        ? [start, end]
        : [end, start];

    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const afterStart = compareTimestampsWithSchema(calendar, anchor, rangeStart) > 0;
      const beforeEnd = compareTimestampsWithSchema(calendar, anchor, rangeEnd) <= 0;
      return afterStart && beforeEnd;
    });
  }

  /**
   * Ensure index is built before queries
   */
  private async ensureIndexBuilt(calendarId: string): Promise<void> {
    if (!this.dateIndex || this.calendarIdCache !== calendarId) {
      await this.buildIndex(calendarId);
    }
  }

  /**
   * Build date index from all events
   */
  private async buildIndex(calendarId: string): Promise<void> {
    const events = await this.getAll(calendarId);

    this.dateIndex = new Map();
    this.singleEventIds.clear();
    this.recurringEventIds.clear();

    for (const event of events) {
      if (isSingleEvent(event)) {
        this.singleEventIds.add(event.id);
        const dateKey = this.getDateKey(
          event.date.year,
          this.getMonthNumber(event.date.monthId),
          event.date.day,
        );
        if (!this.dateIndex.has(dateKey)) {
          this.dateIndex.set(dateKey, new Set());
        }
        this.dateIndex.get(dateKey)!.add(event.id);
      } else {
        this.recurringEventIds.add(event.id);
      }
    }

    this.calendarIdCache = calendarId;
  }

  /**
   * Invalidate index on mutations
   */
  private invalidateIndex(): void {
    this.dateIndex = null;
    this.calendarIdCache = null;
  }

  /**
   * Update event cache after loading
   */
  private updateCache(calendarId: string, events: ReadonlyArray<CalendarEvent>): void {
    this.eventCache.clear();
    for (const event of events) {
      this.eventCache.set(event.id, event);
    }
    this.calendarIdCache = calendarId;
  }

  /**
   * Generate date key for indexing
   */
  private getDateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  /**
   * Convert monthId to month number (assumes simple numeric monthIds)
   * TODO: This needs to be replaced with schema-based lookup for non-numeric monthIds
   */
  private getMonthNumber(monthId: string): number {
    const parsed = parseInt(monthId, 10);
    return isNaN(parsed) ? 1 : parsed;
  }

  /**
   * Check if event occurs on specific day
   */
  private eventOccursOnDay(
    event: CalendarEvent,
    calendar: CalendarSchema,
    year: number,
    month: number,
    day: number,
  ): boolean {
    if (isSingleEvent(event)) {
      return (
        event.date.year === year &&
        this.getMonthNumber(event.date.monthId) === month &&
        event.date.day === day
      );
    }

    // For recurring events, compute occurrences for this day
    const dayStart: CalendarTimestamp = {
      calendarId: event.calendarId,
      year,
      monthId: this.getMonthIdFromNumber(calendar, month),
      day,
      precision: "day",
    };

    const dayEnd: CalendarTimestamp = {
      calendarId: event.calendarId,
      year,
      monthId: this.getMonthIdFromNumber(calendar, month),
      day: day + 1,
      precision: "day",
    };

    const occurrences = computeEventOccurrencesInRange(
      event,
      calendar,
      event.calendarId,
      dayStart,
      dayEnd,
      { includeStart: true, limit: 1 },
    );

    return occurrences.length > 0;
  }

  /**
   * Convert month number to monthId (assumes simple numeric monthIds)
   * TODO: This needs to be replaced with schema-based lookup for non-numeric monthIds
   */
  private getMonthIdFromNumber(calendar: CalendarSchema, month: number): string {
    if (calendar.months[month - 1]) {
      return calendar.months[month - 1].id;
    }
    return String(month);
  }
}
