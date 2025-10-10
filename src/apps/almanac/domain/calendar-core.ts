// src/apps/almanac/domain/calendar-core.ts
// Consolidated calendar schema, timestamp utilities and time arithmetic helpers.

/**
 * Calendar schema structures
 */
export interface CalendarMonth {
  readonly id: string;
  readonly name: string;
  readonly length: number;
}

export const DEFAULT_HOURS_PER_DAY = 24;
export const DEFAULT_MINUTES_PER_HOUR = 60;
export const DEFAULT_SECONDS_PER_MINUTE = 60;
export const DEFAULT_MINUTE_STEP = 1;

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

/**
 * Calendar timestamp primitives
 */
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
  if (a.year !== b.year) return a.year - b.year;
  if (a.monthId !== b.monthId) return a.monthId.localeCompare(b.monthId);
  if (a.day !== b.day) return a.day - b.day;

  const hourA = a.hour ?? 0;
  const hourB = b.hour ?? 0;
  if (hourA !== hourB) return hourA - hourB;

  const minuteA = a.minute ?? 0;
  const minuteB = b.minute ?? 0;
  return minuteA - minuteB;
}

export function compareTimestampsWithSchema(
  schema: CalendarSchema,
  a: CalendarTimestamp,
  b: CalendarTimestamp,
): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }

  if (a.monthId !== b.monthId) {
    const aIndex = getMonthIndex(schema, a.monthId);
    const bIndex = getMonthIndex(schema, b.monthId);
    if (aIndex === -1 || bIndex === -1) {
      return a.monthId.localeCompare(b.monthId);
    }
    return aIndex - bIndex;
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

/**
 * Calendar math helpers
 */
export function getMonthLength(schema: CalendarSchema, monthId: string): number | null {
  const month = getMonthById(schema, monthId);
  return month?.length ?? null;
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
      const daysLeftInMonth = month.length - day + 1;
      if (remainingDays < daysLeftInMonth) {
        day += remainingDays;
        remainingDays = 0;
      } else {
        remainingDays -= daysLeftInMonth;
        day = 1;
        const nextMonth = getNextMonth(schema, monthId);
        if (!nextMonth) {
          year += 1;
          monthId = schema.months[0].id;
          normalized = true;
        } else {
          monthId = nextMonth.id;
        }
      }
    } else {
      const daysToBoundary = day - 1;
      if (Math.abs(remainingDays) <= daysToBoundary) {
        day += remainingDays;
        remainingDays = 0;
      } else {
        remainingDays += daysToBoundary + 1;
        const prevMonth = getPreviousMonth(schema, monthId);
        if (!prevMonth) {
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

  const timestamp =
    hour !== undefined
      ? createHourTimestamp(current.calendarId, year, monthId, day, hour)
      : createDayTimestamp(current.calendarId, year, monthId, day);

  return { timestamp, normalized };
}

function advanceByHours(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  hours: number,
): AdvanceResult {
  const hoursPerDay = getHoursPerDay(schema);
  const currentHour = current.hour ?? 0;
  let totalHours = currentHour + hours;
  let carriedDays = 0;
  let normalized = false;

  if (totalHours >= hoursPerDay) {
    carriedDays = Math.floor(totalHours / hoursPerDay);
    totalHours %= hoursPerDay;
    normalized = true;
  } else if (totalHours < 0) {
    const daysNeeded = Math.ceil(Math.abs(totalHours) / hoursPerDay);
    carriedDays = -daysNeeded;
    totalHours += daysNeeded * hoursPerDay;
    normalized = true;
  }

  let baseTimestamp: CalendarTimestamp = current;
  if (carriedDays !== 0) {
    const dayResult = advanceByDays(schema, current, carriedDays);
    baseTimestamp = dayResult.timestamp;
    normalized = normalized || dayResult.normalized;
  }

  const timestamp = createHourTimestamp(
    baseTimestamp.calendarId,
    baseTimestamp.year,
    baseTimestamp.monthId,
    baseTimestamp.day,
    totalHours,
  );

  return {
    timestamp,
    normalized,
    carriedDays: carriedDays !== 0 ? carriedDays : undefined,
    carriedHours: hours,
  };
}

function advanceByMinutes(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  minutes: number,
): AdvanceResult {
  const minutesPerHour = getMinutesPerHour(schema);
  const currentMinute = current.minute ?? 0;
  const currentHour = current.hour ?? 0;

  let totalMinutes = currentMinute + minutes;
  let carriedHours = 0;
  let normalized = false;

  if (totalMinutes >= minutesPerHour) {
    carriedHours = Math.floor(totalMinutes / minutesPerHour);
    totalMinutes %= minutesPerHour;
    normalized = true;
  } else if (totalMinutes < 0) {
    const hoursNeeded = Math.ceil(Math.abs(totalMinutes) / minutesPerHour);
    carriedHours = -hoursNeeded;
    totalMinutes += hoursNeeded * minutesPerHour;
    normalized = true;
  }

  let baseTimestamp: CalendarTimestamp = current;
  if (carriedHours !== 0) {
    const hourResult = advanceByHours(schema, current, carriedHours);
    baseTimestamp = hourResult.timestamp;
    normalized = normalized || hourResult.normalized;
  }

  const timestamp = createMinuteTimestamp(
    baseTimestamp.calendarId,
    baseTimestamp.year,
    baseTimestamp.monthId,
    baseTimestamp.day,
    baseTimestamp.hour ?? 0,
    totalMinutes,
  );

  return { timestamp, normalized };
}

function getNextMonth(schema: CalendarSchema, currentMonthId: string) {
  const index = getMonthIndex(schema, currentMonthId);
  if (index === -1) {
    throw new Error(`Month not found: ${currentMonthId}`);
  }
  if (index === schema.months.length - 1) {
    return null;
  }
  return getMonthByIndex(schema, index + 1);
}

function getPreviousMonth(schema: CalendarSchema, currentMonthId: string) {
  const index = getMonthIndex(schema, currentMonthId);
  if (index === -1) {
    throw new Error(`Month not found: ${currentMonthId}`);
  }
  if (index === 0) {
    return null;
  }
  return getMonthByIndex(schema, index - 1);
}
