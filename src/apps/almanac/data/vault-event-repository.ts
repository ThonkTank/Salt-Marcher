// src/apps/almanac/data/vault-event-repository.ts
// Vault-backed calendar event repository supporting range queries and upcoming lists.

import { compareTimestampsWithSchema } from "../domain/calendar-timestamp";
import { getEventAnchorTimestamp } from "../domain/calendar-event";
import type { CalendarTimestamp } from "../domain/calendar-timestamp";
import type { CalendarSchemaDTO, CalendarEventDTO, CalendarRangeDTO } from "./dto";
import type { CalendarRepository } from "./calendar-repository";
import type { EventRepository } from "./event-repository";
import { JsonStore } from "./json-store";
import type { VaultLike } from "./json-store";
import { reportAlmanacGatewayIssue } from "../telemetry";

interface EventStoreData {
  readonly eventsByCalendar: Record<string, CalendarEventDTO[]>;
}

const EVENT_STORE_VERSION = "1.4.0";
const EVENT_STORE_PATH = "SaltMarcher/Almanac/events.json";

export class VaultEventRepository implements EventRepository {
  private readonly store: JsonStore<EventStoreData>;

  constructor(private readonly calendars: CalendarRepository, vault: VaultLike) {
    this.store = new JsonStore<EventStoreData>(vault, {
      path: EVENT_STORE_PATH,
      currentVersion: EVENT_STORE_VERSION,
      initialData: () => ({ eventsByCalendar: {} }),
    });
  }

  async listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<CalendarEventDTO>> {
    const schema = await this.requireCalendar(calendarId);
    const events = await this.readCalendarEvents(calendarId);
    if (!range) {
      return events;
    }
    const start = range.start;
    const end = range.end;
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const afterStart = compareTimestampsWithSchema(schema, anchor, start) >= 0;
      const beforeEnd = compareTimestampsWithSchema(schema, anchor, end) <= 0;
      return afterStart && beforeEnd;
    });
  }

  async listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<CalendarEventDTO>> {
    const schema = await this.requireCalendar(calendarId);
    const events = await this.readCalendarEvents(calendarId);
    const sorted = [...events].sort((a, b) => {
      const aAnchor = getEventAnchorTimestamp(a) ?? a.date;
      const bAnchor = getEventAnchorTimestamp(b) ?? b.date;
      return compareTimestampsWithSchema(schema, aAnchor, bAnchor);
    });
    return sorted.slice(0, limit);
  }

  async createEvent(event: CalendarEventDTO): Promise<void> {
    try {
      await this.store.update(state => {
        const eventsByCalendar = { ...state.eventsByCalendar };
        const events = [...(eventsByCalendar[event.calendarId] ?? [])];
        if (events.some(entry => entry.id === event.id)) {
          throw new Error(`Event with ID ${event.id} already exists`);
        }
        events.push(event);
        eventsByCalendar[event.calendarId] = events;
        return { eventsByCalendar };
      });
    } catch (error) {
      reportAlmanacGatewayIssue({
        operation: "event.repository.createEvent",
        scope: "event",
        code: isEventRepositoryValidationError(error) ? "validation_error" : "io_error",
        error,
        context: { calendarId: event.calendarId, eventId: event.id },
      });
      throw error;
    }
  }

  async updateEvent(id: string, event: Partial<CalendarEventDTO>): Promise<void> {
    try {
      await this.store.update(state => {
        const eventsByCalendar = { ...state.eventsByCalendar };
        let found = false;
        for (const [calendarId, events] of Object.entries(eventsByCalendar)) {
          const index = events.findIndex(entry => entry.id === id);
          if (index === -1) {
            continue;
          }
          events[index] = { ...events[index], ...event } as CalendarEventDTO;
          eventsByCalendar[calendarId] = [...events];
          found = true;
        }
        if (!found) {
          throw new Error(`Event with ID ${id} not found`);
        }
        return { eventsByCalendar };
      });
    } catch (error) {
      reportAlmanacGatewayIssue({
        operation: "event.repository.updateEvent",
        scope: "event",
        code: isEventRepositoryValidationError(error) ? "validation_error" : "io_error",
        error,
        context: { eventId: id },
      });
      throw error;
    }
  }

  async deleteEvent(id: string): Promise<void> {
    try {
      await this.store.update(state => {
        const eventsByCalendar: Record<string, CalendarEventDTO[]> = {};
        let found = false;
        for (const [calendarId, events] of Object.entries(state.eventsByCalendar)) {
          const remaining = events.filter(event => event.id !== id);
          if (remaining.length !== events.length) {
            found = true;
          }
          eventsByCalendar[calendarId] = remaining;
        }
        if (!found) {
          throw new Error(`Event with ID ${id} not found`);
        }
        return { eventsByCalendar };
      });
    } catch (error) {
      reportAlmanacGatewayIssue({
        operation: "event.repository.deleteEvent",
        scope: "event",
        code: isEventRepositoryValidationError(error) ? "validation_error" : "io_error",
        error,
        context: { eventId: id },
      });
      throw error;
    }
  }

  async getEventsInRange(
    calendarId: string,
    schema: CalendarSchemaDTO,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<CalendarEventDTO[]> {
    const range: CalendarRangeDTO = { calendarId, start, end };
    return this.listEvents(calendarId, range);
  }

  async getUpcomingEvents(
    calendarId: string,
    schema: CalendarSchemaDTO,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<CalendarEventDTO[]> {
    const events = await this.listEvents(calendarId);
    return events
      .filter(event => {
        const anchor = getEventAnchorTimestamp(event) ?? event.date;
        return compareTimestampsWithSchema(schema, anchor, from) >= 0;
      })
      .slice(0, limit);
  }

  private async readCalendarEvents(calendarId: string): Promise<CalendarEventDTO[]> {
    const state = await this.store.read();
    return [...(state.eventsByCalendar[calendarId] ?? [])];
  }

  private async requireCalendar(calendarId: string): Promise<CalendarSchemaDTO> {
    const calendar = await this.calendars.getCalendar(calendarId);
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }
    return calendar;
  }
}

function isEventRepositoryValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /already exists|not found/i.test(error.message);
}
