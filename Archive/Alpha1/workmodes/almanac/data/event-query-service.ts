// src/workmodes/almanac/data/event-query-service.ts
// Service for querying and filtering calendar events

import {
  compareTimestampsWithSchema,
  getEventAnchorTimestamp,
} from "../helpers";
import { searchEvents, type SearchQuery, type SearchMatch                 , CalendarEvent, CalendarSchema, CalendarTimestamp } from "../helpers";

/**
 * Service for querying calendar events with various filters
 *
 * Provides filtering, sorting, and range-based queries on event collections
 */
export class EventQueryService {
  /**
   * Get events within a date range
   *
   * @param events - Events to filter
   * @param calendar - Calendar schema for date comparison
   * @param start - Range start timestamp (inclusive)
   * @param end - Range end timestamp (inclusive)
   * @returns Events within the range
   */
  getEventsInRange(
    events: ReadonlyArray<CalendarEvent>,
    calendar: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): CalendarEvent[] {
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
   * @param events - Events to filter
   * @param calendar - Calendar schema for date comparison
   * @param from - Starting timestamp (inclusive)
   * @param limit - Maximum number of events to return
   * @returns Upcoming events sorted by date
   */
  getUpcomingEvents(
    events: ReadonlyArray<CalendarEvent>,
    calendar: CalendarSchema,
    from: CalendarTimestamp,
    limit: number,
  ): CalendarEvent[] {
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
   * Filter events by category
   *
   * @param events - Events to filter
   * @param category - Category to filter by
   * @returns Events matching the category
   */
  filterByCategory(events: ReadonlyArray<CalendarEvent>, category: string): CalendarEvent[] {
    return events.filter(event => event.category === category);
  }

  /**
   * Filter events by calendar IDs
   *
   * @param events - Events to filter
   * @param calendarIds - Calendar IDs to include
   * @returns Events matching any of the calendar IDs
   */
  filterByCalendars(
    events: ReadonlyArray<CalendarEvent>,
    calendarIds: ReadonlyArray<string>,
  ): CalendarEvent[] {
    if (calendarIds.length === 0) {
      return Array.from(events);
    }

    const idSet = new Set(calendarIds);
    return events.filter(event => idSet.has(event.date.calendarId));
  }

  /**
   * Filter events by priority level
   *
   * @param events - Events to filter
   * @param minPriority - Minimum priority level (inclusive)
   * @param maxPriority - Maximum priority level (inclusive)
   * @returns Events within priority range
   */
  filterByPriority(
    events: ReadonlyArray<CalendarEvent>,
    minPriority: number,
    maxPriority: number,
  ): CalendarEvent[] {
    return events.filter(event => {
      const priority = event.priority ?? 0;
      return priority >= minPriority && priority <= maxPriority;
    });
  }

  /**
   * Sort events by date
   *
   * @param events - Events to sort
   * @param calendar - Calendar schema for date comparison
   * @param direction - Sort direction ('asc' or 'desc')
   * @returns Sorted events
   */
  sortByDate(
    events: ReadonlyArray<CalendarEvent>,
    calendar: CalendarSchema,
    direction: "asc" | "desc" = "asc",
  ): CalendarEvent[] {
    const sorted = Array.from(events).sort((a, b) => {
      const anchorA = getEventAnchorTimestamp(a) ?? a.date;
      const anchorB = getEventAnchorTimestamp(b) ?? b.date;
      return compareTimestampsWithSchema(calendar, anchorA, anchorB);
    });

    return direction === "desc" ? sorted.reverse() : sorted;
  }

  /**
   * Get events that occur exactly on a specific date
   *
   * @param events - Events to filter
   * @param calendar - Calendar schema for date comparison
   * @param date - Target date
   * @returns Events on the specified date
   */
  getEventsOnDate(
    events: ReadonlyArray<CalendarEvent>,
    calendar: CalendarSchema,
    date: CalendarTimestamp,
  ): CalendarEvent[] {
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      return compareTimestampsWithSchema(calendar, anchor, date) === 0;
    });
  }

  /**
   * Get events between two timestamps (exclusive of start, inclusive of end)
   *
   * Used for time advancement to find triggered events
   *
   * @param events - Events to filter
   * @param calendar - Calendar schema
   * @param start - Start timestamp (exclusive)
   * @param end - End timestamp (inclusive)
   * @returns Events in range
   */
  getEventsBetween(
    events: ReadonlyArray<CalendarEvent>,
    calendar: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): CalendarEvent[] {
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
   * Group events by date
   *
   * @param events - Events to group
   * @param calendar - Calendar schema
   * @returns Map of date strings to events
   */
  groupByDate(
    events: ReadonlyArray<CalendarEvent>,
    calendar: CalendarSchema,
  ): Map<string, CalendarEvent[]> {
    const groups = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const key = `${anchor.year}-${anchor.monthId}-${anchor.day}`;

      const existing = groups.get(key);
      if (existing) {
        existing.push(event);
      } else {
        groups.set(key, [event]);
      }
    }

    return groups;
  }

  /**
   * Search events by text query with optional filters
   *
   * Phase 13 Priority 6 - Search Functionality
   *
   * @param events - Events to search
   * @param query - Search query with text and optional filters
   * @param calendar - Calendar schema for date filtering
   * @returns Search matches sorted by relevance
   */
  searchByText(
    events: ReadonlyArray<CalendarEvent>,
    query: SearchQuery,
    calendar: CalendarSchema,
  ): SearchMatch[] {
    return searchEvents(events, query, calendar);
  }

  /**
   * Check if an event matches a search query
   *
   * Phase 13 Priority 6 - Search Functionality
   *
   * @param event - Event to check
   * @param query - Search query
   * @param calendar - Calendar schema for date filtering
   * @returns True if event matches query
   */
  matchesQuery(
    event: CalendarEvent,
    query: SearchQuery,
    calendar: CalendarSchema,
  ): boolean {
    const matches = searchEvents([event], query, calendar);
    return matches.length > 0;
  }
}
