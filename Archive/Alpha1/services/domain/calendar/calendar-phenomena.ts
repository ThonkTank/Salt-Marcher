/**
 * Calendar Phenomena Types and Logic
 *
 * Phenomenon definitions and occurrence calculations.
 * These types are shared across all workmodes and features.
 *
 * @module services/domain/calendar/calendar-phenomena
 */

import type { CalendarSchema } from './calendar-schema';
import type { CalendarTimestamp } from './calendar-timestamp';
import type { RepeatRule, RepeatRuleServices, OccurrenceQueryOptions, OccurrencesInRangeOptions } from './repeat-rules';
import type { HookDescriptor } from './calendar-events';
import {
  calculateNextOccurrence,
  calculateOccurrencesInRange,
} from './repeat-rules';
import {
  compareTimestampsWithSchema,
  createMinuteTimestamp,
  advanceTime,
} from './calendar-timestamp';
import { getTimeDefinition } from './calendar-schema';
import { sortHooksByPriority } from './calendar-events';

/**
 * Phenomena domain & engine
 */
export type PhenomenonCategory = 'season' | 'astronomy' | 'weather' | 'tide' | 'holiday' | 'custom';
export type PhenomenonVisibility = 'all_calendars' | 'selected';
export type PhenomenonTimePolicy = 'all_day' | 'fixed' | 'offset';

export interface PhenomenonEffect {
  readonly type: 'weather' | 'narrative' | 'mechanical';
  readonly payload: Record<string, unknown>;
  readonly appliesTo?: ReadonlyArray<string>;
}

export interface Phenomenon {
  readonly id: string;
  readonly name: string;
  readonly category: PhenomenonCategory;
  readonly visibility: PhenomenonVisibility;
  readonly appliesToCalendarIds: ReadonlyArray<string>;
  readonly rule: RepeatRule;
  readonly timePolicy: PhenomenonTimePolicy;
  readonly startTime?: PhenomenonStartTime;
  readonly offsetMinutes?: number;
  readonly durationMinutes?: number;
  readonly effects?: ReadonlyArray<PhenomenonEffect>;
  readonly priority: number;
  readonly tags?: ReadonlyArray<string>;
  readonly notes?: string;
  readonly hooks?: ReadonlyArray<HookDescriptor>;
  readonly schemaVersion: string;
}

export interface PhenomenonStartTime {
  readonly hour: number;
  readonly minute: number;
  readonly second?: number;
}

export interface PhenomenonOccurrence {
  readonly phenomenonId: string;
  readonly name: string;
  readonly calendarId: string;
  readonly timestamp: CalendarTimestamp;
  readonly endTimestamp: CalendarTimestamp;
  readonly category: PhenomenonCategory;
  readonly priority: number;
  readonly durationMinutes: number;
  readonly hooks: ReadonlyArray<HookDescriptor>;
  readonly effects: ReadonlyArray<PhenomenonEffect>;
}

export function isPhenomenonVisibleForCalendar(
  phenomenon: Phenomenon,
  calendarId: string,
): boolean {
  if (phenomenon.visibility === 'all_calendars') {
    return true;
  }
  return phenomenon.appliesToCalendarIds.includes(calendarId);
}

export function getEffectiveStartTime(phenomenon: Phenomenon): PhenomenonStartTime | null {
  if (phenomenon.timePolicy !== 'fixed') {
    return null;
  }
  return phenomenon.startTime ?? { hour: 0, minute: 0 };
}

export class UnsupportedTimePolicyError extends Error {
  constructor(policy: string) {
    super(`Phenomenon time policy "${policy}" is not supported yet.`);
    this.name = 'UnsupportedTimePolicyError';
  }
}

export interface PhenomenonOccurrenceOptions extends OccurrenceQueryOptions {
  readonly services?: RepeatRuleServices;
}

export interface PhenomenonOccurrencesRangeOptions extends OccurrencesInRangeOptions {
  readonly services?: RepeatRuleServices;
}

export function computeNextPhenomenonOccurrence(
  phenomenon: Phenomenon,
  schema: CalendarSchema,
  calendarId: string,
  start: CalendarTimestamp,
  options: PhenomenonOccurrenceOptions = {},
): PhenomenonOccurrence | null {
  const { services, ...ruleOptions } = options;
  const baseTimestamp = calculateNextOccurrence(
    schema,
    calendarId,
    phenomenon.rule,
    start,
    ruleOptions,
    services,
  );
  if (!baseTimestamp) {
    return null;
  }

  return buildPhenomenonOccurrence(phenomenon, schema, calendarId, baseTimestamp);
}

export function computePhenomenonOccurrencesInRange(
  phenomenon: Phenomenon,
  schema: CalendarSchema,
  calendarId: string,
  rangeStart: CalendarTimestamp,
  rangeEnd: CalendarTimestamp,
  options: PhenomenonOccurrencesRangeOptions = {},
): PhenomenonOccurrence[] {
  const { services, ...ruleOptions } = options;
  const baseOccurrences = calculateOccurrencesInRange(
    schema,
    calendarId,
    phenomenon.rule,
    rangeStart,
    rangeEnd,
    ruleOptions,
    services,
  );

  return baseOccurrences.map(timestamp => buildPhenomenonOccurrence(phenomenon, schema, calendarId, timestamp));
}

function buildPhenomenonOccurrence(
  phenomenon: Phenomenon,
  schema: CalendarSchema,
  calendarId: string,
  baseTimestamp: CalendarTimestamp,
): PhenomenonOccurrence {
  const { start, end, durationMinutes } = applyPhenomenonTimePolicy(phenomenon, schema, calendarId, baseTimestamp);
  return {
    phenomenonId: phenomenon.id,
    name: phenomenon.name,
    calendarId,
    timestamp: start,
    endTimestamp: end,
    category: phenomenon.category,
    priority: phenomenon.priority ?? 0,
    durationMinutes,
    hooks: sortHooksByPriority(phenomenon.hooks ?? []),
    effects: phenomenon.effects ?? [],
  };
}

function applyPhenomenonTimePolicy(
  phenomenon: Phenomenon,
  schema: CalendarSchema,
  calendarId: string,
  baseTimestamp: CalendarTimestamp,
): { start: CalendarTimestamp; end: CalendarTimestamp; durationMinutes: number } {
  const { hoursPerDay, minutesPerHour } = getTimeDefinition(schema);
  const minutesPerDay = hoursPerDay * minutesPerHour;

  switch (phenomenon.timePolicy) {
    case 'all_day':
      return createWindow(
        schema,
        baseTimestamp,
        resolveDuration(phenomenon.durationMinutes, minutesPerDay),
      );
    case 'fixed': {
      const startTime = clampTimeOfDay(phenomenon.startTime, hoursPerDay, minutesPerHour);
      const start = createMinuteTimestamp(
        calendarId,
        baseTimestamp.year,
        baseTimestamp.monthId,
        baseTimestamp.day,
        startTime.hour,
        startTime.minute,
      );
      return createWindow(schema, start, resolveDuration(phenomenon.durationMinutes, 0));
    }
    case 'offset': {
      const start = advanceTime(schema, baseTimestamp, phenomenon.offsetMinutes ?? 0, 'minute').timestamp;
      return createWindow(schema, start, resolveDuration(phenomenon.durationMinutes, 0));
    }
    default:
      throw new UnsupportedTimePolicyError(phenomenon.timePolicy);
  }
}

function clampTimeOfDay(
  time: PhenomenonStartTime | undefined,
  hoursPerDay: number,
  minutesPerHour: number,
): PhenomenonStartTime {
  const safeHour = clamp(time?.hour, 0, Math.max(0, hoursPerDay - 1));
  const safeMinute = clamp(time?.minute, 0, Math.max(0, minutesPerHour - 1));
  return { hour: safeHour, minute: safeMinute };
}

function clamp(value: number | undefined, min: number, max: number): number {
  if (value === undefined || Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function sortOccurrencesByTimestamp(
  schema: CalendarSchema,
  occurrences: ReadonlyArray<PhenomenonOccurrence>,
): PhenomenonOccurrence[] {
  return [...occurrences].sort((a, b) => compareTimestampsWithSchema(schema, a.timestamp, b.timestamp));
}

export function filterUpcomingOccurrences(
  schema: CalendarSchema,
  occurrences: ReadonlyArray<PhenomenonOccurrence>,
  from: CalendarTimestamp,
): PhenomenonOccurrence[] {
  const filtered = occurrences.filter(
    occurrence => compareTimestampsWithSchema(schema, occurrence.timestamp, from) >= 0,
  );
  return sortOccurrencesByTimestamp(schema, filtered);
}

export type PhenomenonRule = RepeatRule;

function resolveDuration(durationMinutes: number | undefined, fallback: number): number {
  if (durationMinutes === undefined || durationMinutes <= 0) {
    return fallback;
  }
  return durationMinutes;
}

function createWindow(
  schema: CalendarSchema,
  start: CalendarTimestamp,
  durationMinutes: number,
): { start: CalendarTimestamp; end: CalendarTimestamp; durationMinutes: number } {
  const duration = Math.max(0, durationMinutes);
  if (duration === 0) {
    return { start, end: start, durationMinutes: 0 };
  }
  const end = advanceTime(schema, start, duration, 'minute').timestamp;
  return { start, end, durationMinutes: duration };
}
