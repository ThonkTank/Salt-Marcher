/**
 * Time utility functions for duration calculations and time segment detection.
 *
 * From Time-System.md specification.
 */

import type { GameDateTime, Duration, TimeSegment, CalendarDefinition } from '@core/schemas';

// ============================================================================
// Time Segment Detection
// ============================================================================

/**
 * Check if an hour falls within a time range.
 * Handles wrap-around for ranges like night (20-5).
 *
 * From Time-System.md lines 286-296.
 */
function isInRange(hour: number, range: { start: number; end: number }): boolean {
  if (range.start <= range.end) {
    // Normal range (e.g., morning: 7-11)
    return hour >= range.start && hour < range.end;
  } else {
    // Wrap around (e.g., night: 20-5)
    return hour >= range.start || hour < range.end;
  }
}

/**
 * Get the time segment for a given hour based on calendar definition.
 *
 * From Time-System.md lines 271-284.
 */
export function getTimeSegment(
  time: GameDateTime,
  calendar: CalendarDefinition
): TimeSegment {
  const hour = time.hour;
  const segments = calendar.timeSegments;

  if (isInRange(hour, segments.dawn)) return 'dawn';
  if (isInRange(hour, segments.morning)) return 'morning';
  if (isInRange(hour, segments.midday)) return 'midday';
  if (isInRange(hour, segments.afternoon)) return 'afternoon';
  if (isInRange(hour, segments.dusk)) return 'dusk';
  return 'night';
}

// ============================================================================
// Duration Calculations
// ============================================================================

/**
 * Get total days in a month for a calendar.
 */
function getDaysInMonth(month: number, calendar: CalendarDefinition): number {
  const monthIndex = month - 1; // Convert 1-indexed to 0-indexed
  if (monthIndex < 0 || monthIndex >= calendar.months.length) {
    return 30; // Fallback
  }
  return calendar.months[monthIndex].days;
}

/**
 * Get total months in a year for a calendar.
 */
function getMonthsInYear(calendar: CalendarDefinition): number {
  return calendar.months.length;
}

/**
 * Normalize time values to valid ranges.
 * Handles overflow of minutes, hours, days, months.
 */
function normalizeTime(
  time: GameDateTime,
  calendar: CalendarDefinition
): GameDateTime {
  let { year, month, day, hour, minute } = time;

  // Normalize minutes
  while (minute >= 60) {
    minute -= 60;
    hour += 1;
  }
  while (minute < 0) {
    minute += 60;
    hour -= 1;
  }

  // Normalize hours
  while (hour >= 24) {
    hour -= 24;
    day += 1;
  }
  while (hour < 0) {
    hour += 24;
    day -= 1;
  }

  // Normalize days (overflow into next month)
  const monthsInYear = getMonthsInYear(calendar);

  while (day > getDaysInMonth(month, calendar)) {
    day -= getDaysInMonth(month, calendar);
    month += 1;
    if (month > monthsInYear) {
      month = 1;
      year += 1;
    }
  }

  // Normalize days (underflow into previous month)
  while (day < 1) {
    month -= 1;
    if (month < 1) {
      month = monthsInYear;
      year -= 1;
    }
    day += getDaysInMonth(month, calendar);
  }

  // Normalize months (overflow into next year)
  while (month > monthsInYear) {
    month -= monthsInYear;
    year += 1;
  }

  // Normalize months (underflow into previous year)
  while (month < 1) {
    month += monthsInYear;
    year -= 1;
  }

  return { year, month, day, hour, minute };
}

/**
 * Add a duration to a game datetime.
 * Handles calendar-aware month/day calculations.
 *
 * From Time-System.md advanceTime specification.
 */
export function addDuration(
  time: GameDateTime,
  duration: Duration,
  calendar: CalendarDefinition
): GameDateTime {
  let { year, month, day, hour, minute } = time;

  // Add duration components
  if (duration.years) {
    year += duration.years;
  }
  if (duration.months) {
    month += duration.months;
  }
  if (duration.days) {
    day += duration.days;
  }
  if (duration.hours) {
    hour += duration.hours;
  }
  if (duration.minutes) {
    minute += duration.minutes;
  }

  // Normalize the result
  return normalizeTime({ year, month, day, hour, minute }, calendar);
}

/**
 * Calculate the difference between two datetimes in total hours.
 * Useful for travel time display.
 */
export function diffInHours(
  from: GameDateTime,
  to: GameDateTime,
  calendar: CalendarDefinition
): number {
  // Simple approximation: convert both to total hours and subtract
  const fromHours = toTotalHours(from, calendar);
  const toHours = toTotalHours(to, calendar);
  return toHours - fromHours;
}

/**
 * Convert a datetime to approximate total hours since year 0.
 * Only used for diffInHours calculation.
 */
function toTotalHours(time: GameDateTime, calendar: CalendarDefinition): number {
  let totalDays = 0;

  // Add full years
  const daysPerYear = calendar.months.reduce((sum, m) => sum + m.days, 0);
  totalDays += (time.year - 1) * daysPerYear;

  // Add full months
  for (let m = 0; m < time.month - 1; m++) {
    totalDays += calendar.months[m].days;
  }

  // Add days
  totalDays += time.day - 1;

  // Convert to hours and add time
  return totalDays * 24 + time.hour + time.minute / 60;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a game datetime as a human-readable string.
 */
export function formatGameDateTime(
  time: GameDateTime,
  calendar: CalendarDefinition
): string {
  const monthName = calendar.months[time.month - 1]?.name ?? `Month ${time.month}`;
  const hourStr = time.hour.toString().padStart(2, '0');
  const minuteStr = time.minute.toString().padStart(2, '0');

  return `${time.day}. ${monthName} ${time.year}, ${hourStr}:${minuteStr}`;
}

/**
 * Format time only (hour:minute).
 */
export function formatTime(time: GameDateTime): string {
  const hourStr = time.hour.toString().padStart(2, '0');
  const minuteStr = time.minute.toString().padStart(2, '0');
  return `${hourStr}:${minuteStr}`;
}

/**
 * Format date only (day. month year).
 */
export function formatDate(
  time: GameDateTime,
  calendar: CalendarDefinition
): string {
  const monthName = calendar.months[time.month - 1]?.name ?? `Month ${time.month}`;
  return `${time.day}. ${monthName} ${time.year}`;
}
