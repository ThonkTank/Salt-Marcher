// src/apps/almanac/domain/calendar-event.ts
// Defines single-event structures used by Almanac calendars.

/**
 * Calendar Event
 *
 * Represents a single (non-recurring) event at a specific date/time.
 * MVP only supports single events.
 */

import type { CalendarTimestamp } from './calendar-timestamp';

export interface CalendarEvent {
  readonly id: string;
  readonly calendarId: string;
  readonly title: string;
  readonly description?: string;

  readonly date: CalendarTimestamp;
  readonly allDay: boolean;

  readonly category?: string;
  readonly tags?: ReadonlyArray<string>;
}

/**
 * Helper: Create a simple event
 */
export function createEvent(
  id: string,
  calendarId: string,
  title: string,
  date: CalendarTimestamp,
  options?: {
    description?: string;
    allDay?: boolean;
    category?: string;
    tags?: string[];
  }
): CalendarEvent {
  return {
    id,
    calendarId,
    title,
    description: options?.description,
    date,
    allDay: options?.allDay ?? (date.precision === 'day'),
    category: options?.category,
    tags: options?.tags,
  };
}
