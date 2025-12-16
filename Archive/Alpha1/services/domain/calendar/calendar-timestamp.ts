/**
 * Calendar Timestamp Types
 *
 * Timestamp primitives and manipulation functions.
 * These types are shared across all workmodes and features.
 *
 * @module services/domain/calendar/calendar-timestamp
 */

import type { CalendarSchema } from './calendar-schema';
import { getMonthIndex, getTimeDefinition, getTotalDaysInYear, mod, getMonthLength } from './calendar-schema';

export type TimestampPrecision = 'day' | 'hour' | 'minute';

export interface CalendarTimestamp {
  readonly calendarId: string;
  readonly year: number;
  readonly monthId: string;
  readonly day: number;
  readonly hour?: number;
  readonly minute?: number;
  readonly precision: TimestampPrecision;
}

export function createDayTimestamp(
  calendarId: string,
  year: number,
  monthId: string,
  day: number,
): CalendarTimestamp {
  return { calendarId, year, monthId, day, precision: 'day' };
}

export function createHourTimestamp(
  calendarId: string,
  year: number,
  monthId: string,
  day: number,
  hour: number,
): CalendarTimestamp {
  return { calendarId, year, monthId, day, hour, precision: 'hour' };
}

export function createMinuteTimestamp(
  calendarId: string,
  year: number,
  monthId: string,
  day: number,
  hour: number,
  minute: number,
): CalendarTimestamp {
  return { calendarId, year, monthId, day, hour, minute, precision: 'minute' };
}

export function compareTimestamps(a: CalendarTimestamp, b: CalendarTimestamp): number {
  return compareTimestampParts(a, b, (left, right) => left.localeCompare(right));
}

export function compareTimestampsWithSchema(
  schema: CalendarSchema,
  a: CalendarTimestamp,
  b: CalendarTimestamp,
): number {
  return compareTimestampParts(a, b, (left, right) => {
    const aIndex = getMonthIndex(schema, left);
    const bIndex = getMonthIndex(schema, right);
    if (aIndex === -1 || bIndex === -1) {
      return left.localeCompare(right);
    }
    return aIndex - bIndex;
  });
}

export function formatTimestamp(ts: CalendarTimestamp, monthName?: string): string {
  const month = monthName ?? ts.monthId;
  if (ts.precision === 'day') {
    return `Year ${ts.year}, Day ${ts.day} of ${month}`;
  }
  if (ts.precision === 'hour') {
    const hour = String(ts.hour ?? 0).padStart(2, '0');
    return `Year ${ts.year}, Day ${ts.day} of ${month}, ${hour}:00`;
  }
  const hour = String(ts.hour ?? 0).padStart(2, '0');
  const minute = String(ts.minute ?? 0).padStart(2, '0');
  return `Year ${ts.year}, Day ${ts.day} of ${month}, ${hour}:${minute}`;
}

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

export function resolveMonthAndDayByDayOfYear(
  schema: CalendarSchema,
  dayOfYear: number,
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
  throw new RangeError(`Unable to resolve day-of-year ${dayOfYear} for schema ${schema.id}`);
}

export function createTimestampFromDayOfYear(
  schema: CalendarSchema,
  calendarId: string,
  year: number,
  dayOfYear: number,
): CalendarTimestamp {
  const { monthId, day } = resolveMonthAndDayByDayOfYear(schema, dayOfYear);
  return createDayTimestamp(calendarId, year, monthId, day);
}

export function timestampToAbsoluteDay(schema: CalendarSchema, timestamp: CalendarTimestamp): number {
  const daysPerYear = getTotalDaysInYear(schema);
  const dayOfYearIndex = getDayOfYear(schema, timestamp) - 1;
  const yearOffset = timestamp.year - schema.epoch.year;
  return yearOffset * daysPerYear + dayOfYearIndex;
}

export function absoluteDayToTimestamp(
  schema: CalendarSchema,
  calendarId: string,
  absoluteDay: number,
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
 * Calculate the weekday (0-6) for a given timestamp
 *
 * Uses the calendar's epoch as reference point (epoch is assumed to be weekday 0).
 * Calculates absolute day difference from epoch and applies modulo with daysPerWeek.
 *
 * @param schema - Calendar schema containing epoch and week configuration
 * @param timestamp - The timestamp to calculate weekday for
 * @returns Weekday index (0 = first day of week, up to daysPerWeek - 1)
 *
 * @example
 * // For Gregorian calendar with epoch Jan 1, 2024 (Monday = 0):
 * const weekday = getWeekdayForTimestamp(schema, timestamp);
 * // weekday = 0 (Monday), 1 (Tuesday), ..., 6 (Sunday)
 */
export function getWeekdayForTimestamp(schema: CalendarSchema, timestamp: CalendarTimestamp): number {
  // Calculate absolute days from epoch
  const absoluteDay = timestampToAbsoluteDay(schema, timestamp);
  const epochDay = timestampToAbsoluteDay(schema, {
    calendarId: timestamp.calendarId,
    year: schema.epoch.year,
    monthId: schema.epoch.monthId,
    day: schema.epoch.day,
    precision: 'day',
  });

  // Days since epoch
  const daysSinceEpoch = absoluteDay - epochDay;

  // Calculate weekday using modulo (epoch is weekday 0)
  return mod(daysSinceEpoch, schema.daysPerWeek);
}

/**
 * Time arithmetic
 */
export type TimeUnit = 'day' | 'hour' | 'minute';

export interface AdvanceResult {
  readonly timestamp: CalendarTimestamp;
  readonly normalized: boolean;
  readonly carriedDays?: number;
  readonly carriedHours?: number;
}

export function advanceTime(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  amount: number,
  unit: TimeUnit,
): AdvanceResult {
  if (unit === 'day') {
    return advanceByDays(schema, current, amount);
  }
  if (unit === 'hour') {
    return advanceByHours(schema, current, amount);
  }
  return advanceByMinutes(schema, current, amount);
}

function advanceByDays(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  days: number,
): AdvanceResult {
  if (days === 0) {
    return { timestamp: current, normalized: false };
  }

  const startDay = timestampToAbsoluteDay(schema, current);
  const targetDay = startDay + days;
  const base = absoluteDayToTimestamp(schema, current.calendarId, targetDay);
  const timestamp = rebuildTimestamp(base, current);
  return { timestamp, normalized: base.year !== current.year };
}

function advanceByHours(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  hours: number,
): AdvanceResult {
  if (hours === 0) {
    return { timestamp: rebuildTimestamp(current, current), normalized: false };
  }

  const { hoursPerDay } = getTimeDefinition(schema);
  const currentHour = current.hour ?? 0;
  const totalHours = currentHour + hours;
  const wrappedHour = mod(totalHours, hoursPerDay);
  const dayShift = (totalHours - wrappedHour) / hoursPerDay;
  const baseDay = advanceByDays(schema, current, dayShift);
  const timestamp = current.minute !== undefined
    ? createMinuteTimestamp(
        current.calendarId,
        baseDay.timestamp.year,
        baseDay.timestamp.monthId,
        baseDay.timestamp.day,
        wrappedHour,
        current.minute,
      )
    : createHourTimestamp(
        current.calendarId,
        baseDay.timestamp.year,
        baseDay.timestamp.monthId,
        baseDay.timestamp.day,
        wrappedHour,
      );

  const normalized = dayShift !== 0 || baseDay.normalized;
  return {
    timestamp,
    normalized,
    carriedDays: dayShift !== 0 ? dayShift : undefined,
    carriedHours: hours,
  };
}

function advanceByMinutes(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  minutes: number,
): AdvanceResult {
  if (minutes === 0) {
    return { timestamp: rebuildTimestamp(current, current), normalized: false };
  }

  const { hoursPerDay, minutesPerHour } = getTimeDefinition(schema);
  const minutesPerDay = hoursPerDay * minutesPerHour;
  const startDay = timestampToAbsoluteDay(schema, current);
  const originalHour = current.hour ?? 0;
  const startMinuteOfDay = originalHour * minutesPerHour + (current.minute ?? 0);
  let totalMinutes = startDay * minutesPerDay + startMinuteOfDay + minutes;

  let dayIndex = Math.floor(totalMinutes / minutesPerDay);
  let minuteOfDay = totalMinutes - dayIndex * minutesPerDay;
  if (minuteOfDay < 0) {
    minuteOfDay += minutesPerDay;
    dayIndex -= 1;
  }

  const hour = Math.floor(minuteOfDay / minutesPerHour);
  const minute = minuteOfDay - hour * minutesPerHour;
  const baseDay = absoluteDayToTimestamp(schema, current.calendarId, dayIndex);
  const timestamp = createMinuteTimestamp(
    current.calendarId,
    baseDay.year,
    baseDay.monthId,
    baseDay.day,
    hour,
    minute,
  );

  const normalized = hour !== originalHour || dayIndex !== startDay;
  return { timestamp, normalized };
}

function rebuildTimestamp(base: CalendarTimestamp, template: CalendarTimestamp): CalendarTimestamp {
  if (template.minute !== undefined) {
    return createMinuteTimestamp(
      template.calendarId,
      base.year,
      base.monthId,
      base.day,
      template.hour ?? 0,
      template.minute,
    );
  }
  if (template.hour !== undefined) {
    return createHourTimestamp(template.calendarId, base.year, base.monthId, base.day, template.hour);
  }
  return createDayTimestamp(template.calendarId, base.year, base.monthId, base.day);
}

function compareTimestampParts(
  a: CalendarTimestamp,
  b: CalendarTimestamp,
  compareMonth: (left: string, right: string) => number,
): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.monthId !== b.monthId) {
    const monthComparison = compareMonth(a.monthId, b.monthId);
    if (monthComparison !== 0) {
      return monthComparison;
    }
  }
  if (a.day !== b.day) {
    return a.day - b.day;
  }

  const hourA = a.hour ?? 0;
  const hourB = b.hour ?? 0;
  if (hourA !== hourB) {
    return hourA - hourB;
  }

  const minuteA = a.minute ?? 0;
  const minuteB = b.minute ?? 0;
  return minuteA - minuteB;
}
