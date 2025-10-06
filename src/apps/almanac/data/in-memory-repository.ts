/**
 * In-Memory Calendar Repository
 *
 * Simple map-based repository for MVP testing.
 * Stores calendars and events in memory without file persistence.
 */

import type { CalendarSchema, DefaultCalendarConfig } from '../domain/calendar-schema';
import type { CalendarEvent } from '../domain/calendar-event';
import type { CalendarTimestamp } from '../domain/calendar-timestamp';
import { compareTimestampsWithSchema } from '../domain/calendar-timestamp';

export interface CalendarRepository {
  listCalendars(): Promise<CalendarSchema[]>;
  getCalendar(id: string): Promise<CalendarSchema | null>;
  createCalendar(schema: CalendarSchema): Promise<void>;
  updateCalendar(id: string, schema: Partial<CalendarSchema>): Promise<void>;
  deleteCalendar(id: string): Promise<void>;

  // Default calendar management
  setGlobalDefault(calendarId: string): Promise<void>;
  getGlobalDefault(): Promise<CalendarSchema | null>;
  setTravelDefault(travelId: string, calendarId: string): Promise<void>;
  getTravelDefault(travelId: string): Promise<string | null>;
  clearTravelDefault(travelId: string): Promise<void>;
}

export interface EventRepository {
  listEvents(calendarId: string, schema: CalendarSchema): Promise<CalendarEvent[]>;
  getUpcomingEvents(calendarId: string, schema: CalendarSchema, from: CalendarTimestamp, limit: number): Promise<CalendarEvent[]>;
  getEventsInRange(
    calendarId: string,
    schema: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp
  ): Promise<CalendarEvent[]>;
  createEvent(event: CalendarEvent): Promise<void>;
  updateEvent(id: string, event: Partial<CalendarEvent>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}

export class InMemoryCalendarRepository implements CalendarRepository {
  private calendars: Map<string, CalendarSchema> = new Map();
  private travelDefaults: Map<string, string> = new Map(); // travelId -> calendarId

  async listCalendars(): Promise<CalendarSchema[]> {
    return Array.from(this.calendars.values());
  }

  async getCalendar(id: string): Promise<CalendarSchema | null> {
    return this.calendars.get(id) ?? null;
  }

  async createCalendar(schema: CalendarSchema): Promise<void> {
    if (this.calendars.has(schema.id)) {
      throw new Error(`Calendar with ID ${schema.id} already exists`);
    }
    this.calendars.set(schema.id, schema);
  }

  async updateCalendar(id: string, updates: Partial<CalendarSchema>): Promise<void> {
    const existing = this.calendars.get(id);
    if (!existing) {
      throw new Error(`Calendar with ID ${id} not found`);
    }

    this.calendars.set(id, { ...existing, ...updates });
  }

  async deleteCalendar(id: string): Promise<void> {
    if (!this.calendars.has(id)) {
      throw new Error(`Calendar with ID ${id} not found`);
    }
    this.calendars.delete(id);

    // Clean up travel defaults pointing to deleted calendar
    for (const [travelId, calendarId] of this.travelDefaults.entries()) {
      if (calendarId === id) {
        this.travelDefaults.delete(travelId);
      }
    }
  }

  async setGlobalDefault(calendarId: string): Promise<void> {
    const calendar = this.calendars.get(calendarId);
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    // Remove isDefaultGlobal from all calendars
    for (const [id, cal] of this.calendars.entries()) {
      if (cal.isDefaultGlobal) {
        this.calendars.set(id, { ...cal, isDefaultGlobal: false });
      }
    }

    // Set new default
    this.calendars.set(calendarId, { ...calendar, isDefaultGlobal: true });
  }

  async getGlobalDefault(): Promise<CalendarSchema | null> {
    for (const calendar of this.calendars.values()) {
      if (calendar.isDefaultGlobal) {
        return calendar;
      }
    }
    return null;
  }

  async setTravelDefault(travelId: string, calendarId: string): Promise<void> {
    const calendar = this.calendars.get(calendarId);
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    this.travelDefaults.set(travelId, calendarId);
  }

  async getTravelDefault(travelId: string): Promise<string | null> {
    return this.travelDefaults.get(travelId) ?? null;
  }

  async clearTravelDefault(travelId: string): Promise<void> {
    this.travelDefaults.delete(travelId);
  }

  // Helper: Initialize with test data
  seed(schemas: CalendarSchema[]): void {
    schemas.forEach(schema => {
      this.calendars.set(schema.id, schema);
    });
  }

  // Helper: Clear all data
  clear(): void {
    this.calendars.clear();
    this.travelDefaults.clear();
  }
}

export class InMemoryEventRepository implements EventRepository {
  private events: Map<string, CalendarEvent> = new Map();

  async listEvents(calendarId: string, schema: CalendarSchema): Promise<CalendarEvent[]> {
    const events = Array.from(this.events.values())
      .filter(e => e.calendarId === calendarId)
      .sort((a, b) => compareTimestampsWithSchema(schema, a.date, b.date));

    return events;
  }

  async getUpcomingEvents(
    calendarId: string,
    schema: CalendarSchema,
    from: CalendarTimestamp,
    limit: number
  ): Promise<CalendarEvent[]> {
    const allEvents = await this.listEvents(calendarId, schema);

    return allEvents
      .filter(e => compareTimestampsWithSchema(schema, e.date, from) >= 0)
      .slice(0, limit);
  }

  async getEventsInRange(
    calendarId: string,
    schema: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp
  ): Promise<CalendarEvent[]> {
    const allEvents = await this.listEvents(calendarId, schema);

    const rangeStart =
      compareTimestampsWithSchema(schema, start, end) <= 0 ? start : end;
    const rangeEnd = rangeStart === start ? end : start;

    return allEvents.filter(event => {
      const afterStart = compareTimestampsWithSchema(schema, event.date, rangeStart) > 0;
      const beforeOrEqualEnd = compareTimestampsWithSchema(schema, event.date, rangeEnd) <= 0;
      return afterStart && beforeOrEqualEnd;
    });
  }

  async createEvent(event: CalendarEvent): Promise<void> {
    if (this.events.has(event.id)) {
      throw new Error(`Event with ID ${event.id} already exists`);
    }
    this.events.set(event.id, event);
  }

  async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<void> {
    const existing = this.events.get(id);
    if (!existing) {
      throw new Error(`Event with ID ${id} not found`);
    }

    this.events.set(id, { ...existing, ...updates } as CalendarEvent);
  }

  async deleteEvent(id: string): Promise<void> {
    if (!this.events.has(id)) {
      throw new Error(`Event with ID ${id} not found`);
    }
    this.events.delete(id);
  }

  // Helper: Initialize with test data
  seed(events: CalendarEvent[]): void {
    events.forEach(event => {
      this.events.set(event.id, event);
    });
  }

  // Helper: Clear all data
  clear(): void {
    this.events.clear();
  }
}
