// src/apps/almanac/domain/repeat-rule.ts
// Recurrence rule types and helpers for calendar events and phenomena.

/**
 * Repeat Rules
 *
 * Defines recurrence rules used by calendar events and phenomena. The first
 * iteration focuses on annual, monthly position and weekly patterns – the
 * remaining rule types are scaffolded for later implementation (astronomical,
 * custom scripts).
 */

import type { CalendarSchema } from './calendar-schema';
import type { CalendarTimestamp } from './calendar-timestamp';
import { createDayTimestamp, compareTimestampsWithSchema } from './calendar-timestamp';
import {
  absoluteDayToTimestamp,
  clampDayToMonth,
  createTimestampFromDayOfYear,
  getDayOfYear,
  mod,
  timestampToAbsoluteDay,
} from './calendar-math';

export type RepeatRule =
  | AnnualRepeatRule
  | MonthlyPositionRepeatRule
  | WeeklyDayIndexRepeatRule
  | AstronomicalRepeatRule
  | CustomRepeatRule;

export interface AnnualRepeatRule {
  readonly type: 'annual';
  readonly offsetDayOfYear: number; // 1-based
}

export interface MonthlyPositionRepeatRule {
  readonly type: 'monthly_position';
  /**
   * Month identifier. The rule targets the day within this month each year.
   */
  readonly monthId: string;
  /** 1-based day number. Values outside the month-length are clamped. */
  readonly day: number;
}

export interface WeeklyDayIndexRepeatRule {
  readonly type: 'weekly_dayIndex';
  /** Day index within the schema week (0..daysPerWeek-1). */
  readonly dayIndex: number;
  /**
   * Optional weekly interval multiplier (1 = every week, 2 = every second week).
   * Only positive integers are supported.
   */
  readonly interval?: number;
}

export interface AstronomicalRepeatRule {
  readonly type: 'astronomical';
  readonly source: 'sunrise' | 'sunset' | 'moon_phase' | 'eclipse';
  readonly referenceCalendarId?: string;
  readonly offsetMinutes?: number;
}

export interface CustomRepeatRule {
  readonly type: 'custom';
  readonly customRuleId: string;
}

export interface OccurrenceQueryOptions {
  /** Include the start timestamp itself if it matches the rule. Defaults to false. */
  readonly includeStart?: boolean;
}

export interface OccurrencesInRangeOptions extends OccurrenceQueryOptions {
  /** Maximum number of occurrences to return. Defaults to 12. */
  readonly limit?: number;
}

export class UnsupportedRepeatRuleError extends Error {
  constructor(ruleType: string) {
    super(`Repeat rule type "${ruleType}" is not supported yet.`);
    this.name = 'UnsupportedRepeatRuleError';
  }
}

export class InvalidRepeatRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRepeatRuleError';
  }
}

/**
 * Calculates the next occurrence (>= start) for the provided repeat rule.
 */
export function calculateNextOccurrence(
  schema: CalendarSchema,
  calendarId: string,
  rule: RepeatRule,
  start: CalendarTimestamp,
  options: OccurrenceQueryOptions = {}
): CalendarTimestamp | null {
  const includeStart = options.includeStart ?? false;

  switch (rule.type) {
    case 'annual':
      return resolveNextAnnualOccurrence(schema, calendarId, rule, start, includeStart);
    case 'monthly_position':
      return resolveNextMonthlyOccurrence(schema, calendarId, rule, start, includeStart);
    case 'weekly_dayIndex':
      return resolveNextWeeklyOccurrence(schema, calendarId, rule, start, includeStart);
    case 'astronomical':
    case 'custom':
      throw new UnsupportedRepeatRuleError(rule.type);
    default:
      // Exhaustiveness protection
      const _never: never = rule;
      return _never;
  }
}

/**
 * Generates occurrences for the inclusive range [rangeStart, rangeEnd].
 * The range boundaries are automatically normalised so `rangeStart <= rangeEnd`.
 */
export function calculateOccurrencesInRange(
  schema: CalendarSchema,
  calendarId: string,
  rule: RepeatRule,
  rangeStart: CalendarTimestamp,
  rangeEnd: CalendarTimestamp,
  options: OccurrencesInRangeOptions = {}
): CalendarTimestamp[] {
  const limit = options.limit ?? 12;
  if (limit <= 0) return [];

  const compare = compareTimestampsWithSchema(schema, rangeStart, rangeEnd);
  const [start, end] = compare <= 0 ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];

  const occurrences: CalendarTimestamp[] = [];
  let cursor = calculateNextOccurrence(schema, calendarId, rule, start, options);

  while (cursor && occurrences.length < limit && compareTimestampsWithSchema(schema, cursor, end) <= 0) {
    occurrences.push(cursor);
    cursor = calculateNextOccurrence(schema, calendarId, rule, cursor, { includeStart: false });

    // Safety guard to avoid endless loops when an implementation accidentally
    // yields identical timestamps repeatedly (e.g. unsupported rule).
    if (cursor && occurrences.length > 0) {
      const prev = occurrences[occurrences.length - 1];
      if (compareTimestampsWithSchema(schema, cursor, prev) === 0) {
        break;
      }
    }
  }

  return occurrences;
}

function resolveNextAnnualOccurrence(
  schema: CalendarSchema,
  calendarId: string,
  rule: AnnualRepeatRule,
  start: CalendarTimestamp,
  includeStart: boolean
): CalendarTimestamp | null {
  const totalDays = getAnnualRange(schema);
  if (totalDays <= 0) {
    throw new InvalidRepeatRuleError(`Calendar schema ${schema.id} has no days configured.`);
  }

  const zeroBased = ((rule.offsetDayOfYear - 1) % totalDays + totalDays) % totalDays;
  const normalisedOffset = zeroBased + 1;

  const candidateCurrentYear = createTimestampFromDayOfYear(schema, calendarId, start.year, normalisedOffset);
  const comparison = compareTimestampsWithSchema(schema, candidateCurrentYear, start);

  if (comparison > 0 || (comparison === 0 && includeStart)) {
    return candidateCurrentYear;
  }

  return createTimestampFromDayOfYear(schema, calendarId, start.year + 1, normalisedOffset);
}

function resolveNextMonthlyOccurrence(
  schema: CalendarSchema,
  calendarId: string,
  rule: MonthlyPositionRepeatRule,
  start: CalendarTimestamp,
  includeStart: boolean
): CalendarTimestamp | null {
  const monthLength = clampDayToMonth(schema, rule.monthId, rule.day);
  const initialCandidate = createDayTimestamp(calendarId, start.year, rule.monthId, monthLength);
  const comparison = compareTimestampsWithSchema(schema, initialCandidate, start);

  if (comparison > 0 || (comparison === 0 && includeStart)) {
    return initialCandidate;
  }

  return createDayTimestamp(calendarId, start.year + 1, rule.monthId, monthLength);
}

function resolveNextWeeklyOccurrence(
  schema: CalendarSchema,
  calendarId: string,
  rule: WeeklyDayIndexRepeatRule,
  start: CalendarTimestamp,
  includeStart: boolean
): CalendarTimestamp {
  const daysPerWeek = schema.daysPerWeek;
  if (rule.dayIndex < 0 || rule.dayIndex >= daysPerWeek) {
    throw new InvalidRepeatRuleError(`dayIndex ${rule.dayIndex} is out of range for schema ${schema.id}`);
  }

  const interval = Math.max(1, rule.interval ?? 1);

  const absoluteStart = timestampToAbsoluteDay(schema, start);
  const currentDayIndex = mod(absoluteStart, daysPerWeek);
  let delta = mod(rule.dayIndex - currentDayIndex, daysPerWeek);

  if (delta === 0 && !includeStart) {
    delta = daysPerWeek * interval;
  }

  // Align with the requested interval (e.g. every second week)
  const intervalDays = daysPerWeek * interval;
  if (delta % daysPerWeek !== 0 && interval > 1) {
    delta += mod(intervalDays - (delta % intervalDays), intervalDays);
  }

  const candidateAbsolute = absoluteStart + delta;
  return absoluteDayToTimestamp(schema, calendarId, candidateAbsolute);
}

function getAnnualRange(schema: CalendarSchema): number {
  return schema.months.reduce((sum, month) => sum + month.length, 0);
}
