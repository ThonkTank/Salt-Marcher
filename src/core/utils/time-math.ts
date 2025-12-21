/**
 * Time Math Utility Functions
 *
 * Pure functions for time/date calculations:
 * - Time segment determination
 * - Duration arithmetic
 * - Season calculation
 * - Moon phase calculation (when moon schema exists)
 *
 * @see docs/architecture/Core.md#allgemeine-module
 * @see docs/features/Time-System.md
 */

import type {
  GameDateTime,
  Duration,
  TimeSegment,
  CalendarDefinition,
  CalendarSeason,
} from '@core/schemas';

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Check if an hour falls within a time range.
 * Handles wrap-around for ranges like night (20-5).
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

/**
 * Calculate total days since year 0.
 * Used for moon phase calculation.
 */
function calculateTotalDays(time: GameDateTime, calendar: CalendarDefinition): number {
  let totalDays = 0;

  // Add full years
  const daysPerYear = calendar.months.reduce((sum, m) => sum + m.days, 0);
  totalDays += (time.year - 1) * daysPerYear;

  // Add full months
  for (let m = 0; m < time.month - 1; m++) {
    totalDays += calendar.months[m].days;
  }

  // Add days in current month
  totalDays += time.day;

  return totalDays;
}

// ============================================================================
// Time Segment Functions
// ============================================================================

/**
 * Get the time segment for a given hour based on calendar definition.
 *
 * Uses calendar's timeSegments configuration for segment boundaries.
 *
 * @param time - Game datetime to check
 * @param calendar - Calendar with timeSegments configuration
 * @returns TimeSegment for the given hour
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

/**
 * Get the time of day from an hour (simplified, no calendar required).
 *
 * Uses fixed boundaries:
 * - dawn: 5-7
 * - morning: 7-12
 * - midday: 12-14
 * - afternoon: 14-17
 * - dusk: 17-20
 * - night: 20-5
 *
 * @param hour - Hour (0-23)
 * @returns TimeSegment for the given hour
 */
export function getTimeOfDay(hour: number): TimeSegment {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

// ============================================================================
// Duration Arithmetic
// ============================================================================

/**
 * Add a duration to a game datetime.
 * Handles calendar-aware month/day calculations with overflow normalization.
 *
 * @param time - Starting datetime
 * @param duration - Duration to add
 * @param calendar - Calendar definition for month lengths
 * @returns New datetime with duration added
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
 *
 * @param from - Starting datetime
 * @param to - Ending datetime
 * @param calendar - Calendar definition for month lengths
 * @returns Difference in hours (can be negative if to < from)
 */
export function diffInHours(
  from: GameDateTime,
  to: GameDateTime,
  calendar: CalendarDefinition
): number {
  const fromHours = toTotalHours(from, calendar);
  const toHours = toTotalHours(to, calendar);
  return toHours - fromHours;
}

// ============================================================================
// Season & Moon Phase
// ============================================================================

/**
 * Get the current season for a given date.
 *
 * The CalendarSeason schema uses month indices (0-indexed) to define
 * which months belong to each season.
 *
 * @param time - Game datetime to check
 * @param calendar - Calendar with seasons configuration
 * @returns CalendarSeason or undefined if no seasons defined
 */
export function getCurrentSeason(
  time: GameDateTime,
  calendar: CalendarDefinition
): CalendarSeason | undefined {
  const seasons = calendar.seasons;
  if (!seasons || seasons.length === 0) {
    return undefined;
  }

  // Month in GameDateTime is 1-indexed, seasons use 0-indexed month indices
  const monthIndex = time.month - 1;

  // Find season that contains this month
  for (const season of seasons) {
    if (season.months.includes(monthIndex)) {
      return season;
    }
  }

  // No matching season found
  return undefined;
}

/**
 * Moon configuration interface (for future moon schema).
 * When moon schema is added to CalendarDefinition, this can be removed.
 */
interface MoonConfig {
  name: string;
  cycleLength: number;
  phases: string[];
}

/**
 * Get the current moon phase.
 *
 * Note: This function requires moon configuration in the calendar.
 * Currently returns 'unknown' as the CalendarDefinition schema
 * does not include moon configuration yet.
 *
 * @param time - Game datetime to check
 * @param calendar - Calendar (with optional moons property)
 * @returns Moon phase name or 'unknown' if no moon config
 */
export function getMoonPhase(
  time: GameDateTime,
  calendar: CalendarDefinition
): string {
  // Check if calendar has moon configuration
  // This is future-proofed for when moon schema is added
  const calendarWithMoons = calendar as CalendarDefinition & {
    moons?: MoonConfig[];
  };

  const moons = calendarWithMoons.moons;
  if (!moons || moons.length === 0) {
    return 'unknown';
  }

  // Use primary moon (first in array)
  const moon = moons[0];
  if (!moon.phases || moon.phases.length === 0 || moon.cycleLength <= 0) {
    return 'unknown';
  }

  // Calculate total days and determine phase
  const totalDays = calculateTotalDays(time, calendar);
  const cycleDay = totalDays % moon.cycleLength;
  const phaseLength = moon.cycleLength / moon.phases.length;
  const phaseIndex = Math.floor(cycleDay / phaseLength);

  return moon.phases[phaseIndex] ?? 'unknown';
}
