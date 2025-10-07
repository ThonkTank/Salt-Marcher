// src/apps/almanac/domain/calendar-math.ts
// Utility helpers converting between absolute days and calendar timestamps.

/**
 * Calendar Math Utilities
 *
 * Helper functions that convert between day-of-year, absolute day offsets and
 * concrete calendar timestamps. These utilities intentionally work with
 * schema-specific data to support custom calendars with varying month lengths
 * and week sizes.
 */

import type { CalendarSchema } from './calendar-schema';
import { getMonthById, getMonthIndex, getTotalDaysInYear } from './calendar-schema';
import type { CalendarTimestamp } from './calendar-timestamp';
import { createDayTimestamp } from './calendar-timestamp';

/**
 * Returns the length of the month or `null` if the month does not exist.
 */
export function getMonthLength(schema: CalendarSchema, monthId: string): number | null {
  const month = getMonthById(schema, monthId);
  return month?.length ?? null;
}

/**
 * Calculates the (1-based) day-of-year for a timestamp.
 */
export function getDayOfYear(schema: CalendarSchema, timestamp: CalendarTimestamp): number {
  const monthIndex = getMonthIndex(schema, timestamp.monthId);
  if (monthIndex === -1) {
    throw new Error(`Month with id ${timestamp.monthId} not found in schema ${schema.id}`);
  }

  let days = 0;
  for (let index = 0; index < monthIndex; index++) {
    days += schema.months[index].length;
  }

  return days + timestamp.day;
}

/**
 * Resolves a (1-based) day-of-year into { monthId, day }.
 */
export function resolveMonthAndDayByDayOfYear(
  schema: CalendarSchema,
  dayOfYear: number
): { monthId: string; day: number } {
  if (dayOfYear < 1 || dayOfYear > getTotalDaysInYear(schema)) {
    throw new RangeError(`Day-of-year ${dayOfYear} is out of range for schema ${schema.id}`);
  }

  let remaining = dayOfYear;
  for (const month of schema.months) {
    if (remaining <= month.length) {
      return { monthId: month.id, day: remaining };
    }
    remaining -= month.length;
  }

  // Should never happen because we validate the range above.
  throw new RangeError(`Unable to resolve day-of-year ${dayOfYear} for schema ${schema.id}`);
}

/**
 * Creates a day-precision timestamp from (year, day-of-year).
 */
export function createTimestampFromDayOfYear(
  schema: CalendarSchema,
  calendarId: string,
  year: number,
  dayOfYear: number
): CalendarTimestamp {
  const { monthId, day } = resolveMonthAndDayByDayOfYear(schema, dayOfYear);
  return createDayTimestamp(calendarId, year, monthId, day);
}

/**
 * Calculates an absolute day offset (0-based) from the start of the schema's
 * epoch year. For now we assume the epoch month/day is the first day of its
 * year – this mirrors all current fixtures and keeps the helper lightweight.
 */
export function timestampToAbsoluteDay(schema: CalendarSchema, timestamp: CalendarTimestamp): number {
  const daysPerYear = getTotalDaysInYear(schema);
  const dayOfYearIndex = getDayOfYear(schema, timestamp) - 1; // 0-based
  const yearOffset = timestamp.year - schema.epoch.year;
  return yearOffset * daysPerYear + dayOfYearIndex;
}

/**
 * Converts an absolute day offset back into a timestamp.
 */
export function absoluteDayToTimestamp(
  schema: CalendarSchema,
  calendarId: string,
  absoluteDay: number
): CalendarTimestamp {
  const daysPerYear = getTotalDaysInYear(schema);

  let yearOffset = Math.floor(absoluteDay / daysPerYear);
  let dayOfYearIndex = absoluteDay - yearOffset * daysPerYear;

  if (dayOfYearIndex < 0) {
    dayOfYearIndex += daysPerYear;
    yearOffset -= 1;
  }

  const targetYear = schema.epoch.year + yearOffset;
  return createTimestampFromDayOfYear(schema, calendarId, targetYear, dayOfYearIndex + 1);
}

/**
 * Utility to clamp a day number to the valid range of the given month.
 */
export function clampDayToMonth(schema: CalendarSchema, monthId: string, day: number): number {
  const monthLength = getMonthLength(schema, monthId);
  if (monthLength === null) {
    throw new Error(`Month with id ${monthId} not found in schema ${schema.id}`);
  }

  if (day < 1) return 1;
  if (day > monthLength) return monthLength;
  return day;
}

/**
 * Math helper that handles negative modulo operations gracefully.
 */
export function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
