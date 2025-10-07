// src/apps/almanac/data/event-repository.ts
// Event repository contracts mirroring the Almanac API definitions.

import type { CalendarSchema } from "../domain/calendar-schema";
import type { CalendarTimestamp } from "../domain/calendar-timestamp";
import type { CalendarEventDTO, CalendarRangeDTO } from "./dto";

export interface EventRepository {
  listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<CalendarEventDTO>>;
  listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<CalendarEventDTO>>;
  createEvent(event: CalendarEventDTO): Promise<void>;
  updateEvent(id: string, event: Partial<CalendarEventDTO>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  getEventsInRange?(
    calendarId: string,
    schema: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<ReadonlyArray<CalendarEventDTO>>;
  getUpcomingEvents?(
    calendarId: string,
    schema: CalendarSchema,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<ReadonlyArray<CalendarEventDTO>>;
}
