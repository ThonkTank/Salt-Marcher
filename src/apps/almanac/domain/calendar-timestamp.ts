// src/apps/almanac/domain/calendar-timestamp.ts
// Timestamp creation, comparison and formatting utilities for calendars.

/**
 * Calendar Timestamp
 *
 * Represents a specific point in time within a calendar system.
 * Supports day and hour precision.
 */

import type { CalendarSchema } from './calendar-schema';
import { getMonthIndex } from './calendar-schema';

export type TimestampPrecision = 'day' | 'hour' | 'minute';

export interface CalendarTimestamp {
  readonly calendarId: string;
  readonly year: number;
  readonly monthId: string;
  readonly day: number; // 1-indexed (1 = first day of month)
  readonly hour?: number; // 0-indexed (0 = first hour of day)
  readonly minute?: number; // 0-indexed (0 = first minute of hour, 0-59)
  readonly precision: TimestampPrecision;
}

/**
 * Helper: Create a day-precision timestamp
 */
export function createDayTimestamp(
  calendarId: string,
  year: number,
  monthId: string,
  day: number
): CalendarTimestamp {
  return {
    calendarId,
    year,
    monthId,
    day,
    precision: 'day',
  };
}

/**
 * Helper: Create an hour-precision timestamp
 */
export function createHourTimestamp(
  calendarId: string,
  year: number,
  monthId: string,
  day: number,
  hour: number
): CalendarTimestamp {
  return {
    calendarId,
    year,
    monthId,
    day,
    hour,
    precision: 'hour',
  };
}

/**
 * Helper: Create a minute-precision timestamp
 */
export function createMinuteTimestamp(
  calendarId: string,
  year: number,
  monthId: string,
  day: number,
  hour: number,
  minute: number
): CalendarTimestamp {
  return {
    calendarId,
    year,
    monthId,
    day,
    hour,
    minute,
    precision: 'minute',
  };
}

/**
 * Helper: Compare two timestamps
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 *
 * Note: This is a simplified comparison that uses alphabetic ordering for months.
 * Use compareTimestampsWithSchema for accurate month ordering.
 */
export function compareTimestamps(a: CalendarTimestamp, b: CalendarTimestamp): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }

  // Month comparison - alphabetic (not accurate for calendar ordering)
  if (a.monthId !== b.monthId) {
    return a.monthId.localeCompare(b.monthId);
  }

  if (a.day !== b.day) {
    return a.day - b.day;
  }

  // Hour comparison
  const aHour = a.hour ?? 0;
  const bHour = b.hour ?? 0;
  if (aHour !== bHour) {
    return aHour - bHour;
  }

  // Minute comparison
  const aMinute = a.minute ?? 0;
  const bMinute = b.minute ?? 0;
  return aMinute - bMinute;
}

/**
 * Helper: Compare two timestamps with schema-aware month ordering
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareTimestampsWithSchema(
  schema: CalendarSchema,
  a: CalendarTimestamp,
  b: CalendarTimestamp
): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }

  // Month comparison using schema index
  if (a.monthId !== b.monthId) {
    const aMonthIndex = getMonthIndex(schema, a.monthId);
    const bMonthIndex = getMonthIndex(schema, b.monthId);

    if (aMonthIndex === -1 || bMonthIndex === -1) {
      // Fallback to alphabetic if month not found
      return a.monthId.localeCompare(b.monthId);
    }

    return aMonthIndex - bMonthIndex;
  }

  if (a.day !== b.day) {
    return a.day - b.day;
  }

  // Hour comparison
  const aHour = a.hour ?? 0;
  const bHour = b.hour ?? 0;
  if (aHour !== bHour) {
    return aHour - bHour;
  }

  // Minute comparison
  const aMinute = a.minute ?? 0;
  const bMinute = b.minute ?? 0;
  return aMinute - bMinute;
}

/**
 * Helper: Format timestamp as string
 */
export function formatTimestamp(ts: CalendarTimestamp, monthName?: string): string {
  const month = monthName ?? ts.monthId;

  if (ts.precision === 'day') {
    return `Year ${ts.year}, Day ${ts.day} of ${month}`;
  }

  if (ts.precision === 'hour') {
    return `Year ${ts.year}, Day ${ts.day} of ${month}, ${String(ts.hour).padStart(2, '0')}:00`;
  }

  // minute precision
  const hourStr = String(ts.hour ?? 0).padStart(2, '0');
  const minuteStr = String(ts.minute ?? 0).padStart(2, '0');
  return `Year ${ts.year}, Day ${ts.day} of ${month}, ${hourStr}:${minuteStr}`;
}
