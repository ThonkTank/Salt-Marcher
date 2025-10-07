// src/apps/almanac/domain/calendar-schema.ts
// Core calendar schema definitions and helpers for month/time lookups.

/**
 * Calendar Schema Definition
 *
 * Represents the structure of a custom calendar system with configurable
 * months, week lengths, and time units (hours per day).
 */

export interface CalendarMonth {
  readonly id: string;
  readonly name: string;
  readonly length: number; // days in this month
}

/**
 * Default time constants used when a schema does not provide
 * explicit time-definition overrides.
 */
export const DEFAULT_HOURS_PER_DAY = 24;
export const DEFAULT_MINUTES_PER_HOUR = 60;
export const DEFAULT_SECONDS_PER_MINUTE = 60;
export const DEFAULT_MINUTE_STEP = 1;

// Backwards compatibility exports – legacy code still imports these names.
export const HOURS_PER_DAY = DEFAULT_HOURS_PER_DAY;
export const MINUTES_PER_HOUR = DEFAULT_MINUTES_PER_HOUR;
export const SECONDS_PER_MINUTE = DEFAULT_SECONDS_PER_MINUTE;

export interface TimeDefinition {
  readonly hoursPerDay: number;
  readonly minutesPerHour: number;
  readonly secondsPerMinute: number;
  readonly minuteStep: number;
}

export interface CalendarSchema {
  readonly id: string;
  readonly name: string;
  readonly description?: string;

  // Calendar structure
  readonly daysPerWeek: number;
  readonly months: ReadonlyArray<CalendarMonth>;

  /**
   * Optional schema-specific overrides for handling sub-day time units.
   * If omitted the defaults (24h/60m/60s, minute step 1) are used.
   */
  readonly hoursPerDay?: number;
  readonly minutesPerHour?: number;
  readonly secondsPerMinute?: number;
  readonly minuteStep?: number;

  // Starting point (epoch)
  readonly epoch: {
    readonly year: number;
    readonly monthId: string;
    readonly day: number;
  };

  // Default calendar marker (global scope)
  readonly isDefaultGlobal?: boolean;

  readonly schemaVersion: string;
}

/**
 * Configuration for travel-specific default calendars
 */
export interface DefaultCalendarConfig {
  readonly travelId: string;
  readonly calendarId: string;
}

/**
 * Helper: Get total days in a year for the given schema
 */
export function getTotalDaysInYear(schema: CalendarSchema): number {
  return schema.months.reduce((sum, month) => sum + month.length, 0);
}

/**
 * Helper: Get month by ID
 */
export function getMonthById(schema: CalendarSchema, monthId: string): CalendarMonth | null {
  return schema.months.find(m => m.id === monthId) ?? null;
}

/**
 * Helper: Get month index (0-based)
 */
export function getMonthIndex(schema: CalendarSchema, monthId: string): number {
  return schema.months.findIndex(m => m.id === monthId);
}

/**
 * Helper: Get month by index
 */
export function getMonthByIndex(schema: CalendarSchema, index: number): CalendarMonth | null {
  if (index < 0 || index >= schema.months.length) {
    return null;
  }
  return schema.months[index];
}

export function getHoursPerDay(schema: CalendarSchema): number {
  return schema.hoursPerDay ?? DEFAULT_HOURS_PER_DAY;
}

export function getMinutesPerHour(schema: CalendarSchema): number {
  return schema.minutesPerHour ?? DEFAULT_MINUTES_PER_HOUR;
}

export function getSecondsPerMinute(schema: CalendarSchema): number {
  return schema.secondsPerMinute ?? DEFAULT_SECONDS_PER_MINUTE;
}

export function getMinuteStep(schema: CalendarSchema): number {
  return schema.minuteStep ?? DEFAULT_MINUTE_STEP;
}

export function getTimeDefinition(schema: CalendarSchema): TimeDefinition {
  return {
    hoursPerDay: getHoursPerDay(schema),
    minutesPerHour: getMinutesPerHour(schema),
    secondsPerMinute: getSecondsPerMinute(schema),
    minuteStep: getMinuteStep(schema),
  };
}
