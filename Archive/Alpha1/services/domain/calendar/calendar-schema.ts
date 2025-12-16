/**
 * Calendar Schema Types
 *
 * Core schema definitions for calendar structures.
 * These types are shared across all workmodes and features.
 *
 * @module services/domain/calendar/calendar-schema
 */

export interface CalendarMonth {
  readonly id: string;
  readonly name: string;
  readonly length: number;
}

const DEFAULT_TIME_DEFINITION: TimeDefinition = {
  hoursPerDay: 24,
  minutesPerHour: 60,
  secondsPerMinute: 60,
  minuteStep: 1,
};

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
  readonly daysPerWeek: number;
  readonly months: ReadonlyArray<CalendarMonth>;
  readonly hoursPerDay?: number;
  readonly minutesPerHour?: number;
  readonly secondsPerMinute?: number;
  readonly minuteStep?: number;
  readonly epoch: {
    readonly year: number;
    readonly monthId: string;
    readonly day: number;
  };
  readonly isDefaultGlobal?: boolean;
  readonly schemaVersion: string;
}

export interface DefaultCalendarConfig {
  readonly travelId: string;
  readonly calendarId: string;
}

export function getTotalDaysInYear(schema: CalendarSchema): number {
  return schema.months.reduce((sum, month) => sum + month.length, 0);
}

export function getMonthById(schema: CalendarSchema, monthId: string): CalendarMonth | null {
  return schema.months.find(month => month.id === monthId) ?? null;
}

export function getMonthIndex(schema: CalendarSchema, monthId: string): number {
  return schema.months.findIndex(month => month.id === monthId);
}

export function getTimeDefinition(schema: CalendarSchema): TimeDefinition {
  return {
    ...DEFAULT_TIME_DEFINITION,
    ...(schema.hoursPerDay !== undefined ? { hoursPerDay: schema.hoursPerDay } : {}),
    ...(schema.minutesPerHour !== undefined ? { minutesPerHour: schema.minutesPerHour } : {}),
    ...(schema.secondsPerMinute !== undefined ? { secondsPerMinute: schema.secondsPerMinute } : {}),
    ...(schema.minuteStep !== undefined ? { minuteStep: schema.minuteStep } : {}),
  };
}

export function getMonthLength(schema: CalendarSchema, monthId: string): number | null {
  const month = getMonthById(schema, monthId);
  return month?.length ?? null;
}

export function clampDayToMonth(schema: CalendarSchema, monthId: string, day: number): number {
  const monthLength = getMonthLength(schema, monthId);
  if (monthLength === null) {
    throw new Error(`Month with id ${monthId} not found in schema ${schema.id}`);
  }
  if (day < 1) return 1;
  if (day > monthLength) return monthLength;
  return day;
}

export function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
