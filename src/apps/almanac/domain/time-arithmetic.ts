/**
 * Time Arithmetic
 *
 * Core functions for advancing time, normalizing timestamps,
 * and handling day/month/year boundaries.
 */

import type { CalendarSchema } from './calendar-schema';
import { HOURS_PER_DAY, MINUTES_PER_HOUR } from './calendar-schema';
import type { CalendarTimestamp } from './calendar-timestamp';
import { getMonthById, getMonthIndex, getMonthByIndex } from './calendar-schema';
import { createDayTimestamp, createHourTimestamp, createMinuteTimestamp } from './calendar-timestamp';

export type TimeUnit = 'day' | 'hour' | 'minute';

export interface AdvanceResult {
  readonly timestamp: CalendarTimestamp;
  readonly normalized: boolean;
  readonly carriedDays?: number;
  readonly carriedHours?: number;
}

/**
 * Advance time by a given amount and unit
 */
export function advanceTime(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  amount: number,
  unit: TimeUnit
): AdvanceResult {
  if (unit === 'day') {
    return advanceByDays(schema, current, amount);
  }

  if (unit === 'hour') {
    return advanceByHours(schema, current, amount);
  }

  return advanceByMinutes(schema, current, amount);
}

/**
 * Advance by days
 */
function advanceByDays(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  days: number
): AdvanceResult {
  let year = current.year;
  let monthId = current.monthId;
  let day = current.day;
  const hour = current.hour;
  let remainingDays = days;
  let normalized = false;

  while (remainingDays !== 0) {
    const month = getMonthById(schema, monthId);
    if (!month) {
      throw new Error(`Invalid month ID: ${monthId}`);
    }

    if (remainingDays > 0) {
      // Forward
      const daysLeftInMonth = month.length - day + 1;

      if (remainingDays < daysLeftInMonth) {
        day += remainingDays;
        remainingDays = 0;
      } else {
        // Move to next month
        remainingDays -= daysLeftInMonth;
        day = 1;
        const nextMonth = getNextMonth(schema, monthId);

        if (!nextMonth) {
          // Year boundary
          year += 1;
          monthId = schema.months[0].id;
          normalized = true;
        } else {
          monthId = nextMonth.id;
        }
      }
    } else {
      // Backward
      const daysToBoundary = day - 1;

      if (Math.abs(remainingDays) <= daysToBoundary) {
        day += remainingDays; // remainingDays is negative
        remainingDays = 0;
      } else {
        // Move to previous month
        remainingDays += daysToBoundary + 1;
        const prevMonth = getPreviousMonth(schema, monthId);

        if (!prevMonth) {
          // Year boundary
          year -= 1;
          const lastMonth = schema.months[schema.months.length - 1];
          monthId = lastMonth.id;
          day = lastMonth.length;
          normalized = true;
        } else {
          monthId = prevMonth.id;
          day = prevMonth.length;
        }
      }
    }
  }

  const result: CalendarTimestamp =
    hour !== undefined
      ? createHourTimestamp(current.calendarId, year, monthId, day, hour)
      : createDayTimestamp(current.calendarId, year, monthId, day);

  return { timestamp: result, normalized };
}

/**
 * Advance by hours
 */
function advanceByHours(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  hours: number
): AdvanceResult {
  const currentHour = current.hour ?? 0;
  let totalHours = currentHour + hours;
  let carriedDays = 0;
  let normalized = false;

  // Calculate day overflow
  if (totalHours >= HOURS_PER_DAY) {
    carriedDays = Math.floor(totalHours / HOURS_PER_DAY);
    totalHours = totalHours % HOURS_PER_DAY;
    normalized = true;
  } else if (totalHours < 0) {
    // For negative hours, we need to borrow days
    const daysNeeded = Math.ceil(Math.abs(totalHours) / HOURS_PER_DAY);
    carriedDays = -daysNeeded;
    totalHours = totalHours + (daysNeeded * HOURS_PER_DAY);
    normalized = true;
  }

  // Advance days if needed
  let baseTimestamp: CalendarTimestamp = current;
  if (carriedDays !== 0) {
    const dayResult = advanceByDays(schema, current, carriedDays);
    baseTimestamp = dayResult.timestamp;
    normalized = normalized || dayResult.normalized;
  }

  const result = createHourTimestamp(
    baseTimestamp.calendarId,
    baseTimestamp.year,
    baseTimestamp.monthId,
    baseTimestamp.day,
    totalHours
  );

  return { timestamp: result, normalized, carriedDays: carriedDays !== 0 ? carriedDays : undefined, carriedHours: hours };
}

/**
 * Get next month (wraps to null at year boundary)
 */
function getNextMonth(schema: CalendarSchema, currentMonthId: string) {
  const index = getMonthIndex(schema, currentMonthId);
  if (index === -1) {
    throw new Error(`Month not found: ${currentMonthId}`);
  }

  if (index === schema.months.length - 1) {
    return null; // Year boundary
  }

  return getMonthByIndex(schema, index + 1);
}

/**
 * Get previous month (wraps to null at year boundary)
 */
function getPreviousMonth(schema: CalendarSchema, currentMonthId: string) {
  const index = getMonthIndex(schema, currentMonthId);
  if (index === -1) {
    throw new Error(`Month not found: ${currentMonthId}`);
  }

  if (index === 0) {
    return null; // Year boundary
  }

  return getMonthByIndex(schema, index - 1);
}

/**
 * Advance by minutes
 */
function advanceByMinutes(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  minutes: number
): AdvanceResult {
  const currentMinute = current.minute ?? 0;
  const currentHour = current.hour ?? 0;

  let totalMinutes = currentMinute + minutes;
  let carriedHours = 0;
  let normalized = false;

  // Calculate hour overflow
  if (totalMinutes >= MINUTES_PER_HOUR) {
    carriedHours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
    totalMinutes = totalMinutes % MINUTES_PER_HOUR;
    normalized = true;
  } else if (totalMinutes < 0) {
    // For negative minutes, we need to borrow hours
    const hoursNeeded = Math.ceil(Math.abs(totalMinutes) / MINUTES_PER_HOUR);
    carriedHours = -hoursNeeded;
    totalMinutes = totalMinutes + (hoursNeeded * MINUTES_PER_HOUR);
    normalized = true;
  }

  // Advance hours if needed (this will handle day overflow)
  let baseTimestamp: CalendarTimestamp = current;
  if (carriedHours !== 0) {
    const hourResult = advanceByHours(schema, current, carriedHours);
    baseTimestamp = hourResult.timestamp;
    normalized = normalized || hourResult.normalized;
  }

  const result = createMinuteTimestamp(
    baseTimestamp.calendarId,
    baseTimestamp.year,
    baseTimestamp.monthId,
    baseTimestamp.day,
    baseTimestamp.hour ?? 0,
    totalMinutes
  );

  return { timestamp: result, normalized };
}
