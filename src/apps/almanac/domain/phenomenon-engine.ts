// src/apps/almanac/domain/phenomenon-engine.ts
// Calculates phenomenon occurrences based on repeat rules and time policies.

import type { CalendarSchema } from './calendar-schema';
import { getTimeDefinition } from './calendar-schema';
import type { CalendarTimestamp } from './calendar-timestamp';
import { compareTimestampsWithSchema, createMinuteTimestamp } from './calendar-timestamp';
import type { Phenomenon, PhenomenonOccurrence } from './phenomenon';
import {
  getPhenomenonEffects,
  getPhenomenonHooks,
  getPhenomenonPriority,
  requiresOffsetComputation,
} from './phenomenon';
import type {
  OccurrenceQueryOptions,
  OccurrencesInRangeOptions,
  RepeatRule,
  RepeatRuleServices,
} from './repeat-rule';
import { calculateNextOccurrence, calculateOccurrencesInRange } from './repeat-rule';
import { advanceTime } from './time-arithmetic';
import { sortHooksByPriority } from './hook-descriptor';

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
  options: PhenomenonOccurrenceOptions = {}
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
  options: PhenomenonOccurrencesRangeOptions = {}
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
  const { start, end, durationMinutes } = applyTimePolicy(phenomenon, schema, calendarId, baseTimestamp);
  return {
    phenomenonId: phenomenon.id,
    name: phenomenon.name,
    calendarId,
    timestamp: start,
    endTimestamp: end,
    category: phenomenon.category,
    priority: getPhenomenonPriority(phenomenon),
    durationMinutes,
    hooks: sortHooksByPriority(getPhenomenonHooks(phenomenon)),
    effects: getPhenomenonEffects(phenomenon),
  };
}

function applyTimePolicy(
  phenomenon: Phenomenon,
  schema: CalendarSchema,
  calendarId: string,
  baseTimestamp: CalendarTimestamp,
): { start: CalendarTimestamp; end: CalendarTimestamp; durationMinutes: number } {
  const { hoursPerDay, minutesPerHour } = getTimeDefinition(schema);
  const minutesPerDay = hoursPerDay * minutesPerHour;

  if (phenomenon.timePolicy === 'all_day') {
    const duration = phenomenon.durationMinutes ?? minutesPerDay;
    const end = duration > 0 ? advanceTime(schema, baseTimestamp, duration, 'minute').timestamp : baseTimestamp;
    return { start: baseTimestamp, end, durationMinutes: duration };
  }

  if (phenomenon.timePolicy === 'fixed') {
    const startTime = phenomenon.startTime ?? { hour: 0, minute: 0 };
    const hour = clamp(startTime.hour, 0, Math.max(0, hoursPerDay - 1));
    const minute = clamp(startTime.minute ?? 0, 0, Math.max(0, minutesPerHour - 1));
    const start = createMinuteTimestamp(calendarId, baseTimestamp.year, baseTimestamp.monthId, baseTimestamp.day, hour, minute);
    const duration = phenomenon.durationMinutes ?? 0;
    const end = duration > 0 ? advanceTime(schema, start, duration, 'minute').timestamp : start;
    return { start, end, durationMinutes: duration };
  }

  if (!requiresOffsetComputation(phenomenon)) {
    throw new UnsupportedTimePolicyError(phenomenon.timePolicy);
  }

  const offset = phenomenon.offsetMinutes ?? 0;
  const start = advanceTime(schema, baseTimestamp, offset, 'minute').timestamp;
  const duration = phenomenon.durationMinutes ?? 0;
  const end = duration > 0 ? advanceTime(schema, start, duration, 'minute').timestamp : start;
  return { start, end, durationMinutes: duration };
}

function clamp(value: number | undefined, min: number, max: number): number {
  if (value === undefined || Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function sortOccurrencesByTimestamp(
  schema: CalendarSchema,
  occurrences: ReadonlyArray<PhenomenonOccurrence>
): PhenomenonOccurrence[] {
  return [...occurrences].sort((a, b) => compareTimestampsWithSchema(schema, a.timestamp, b.timestamp));
}

export function filterUpcomingOccurrences(
  schema: CalendarSchema,
  occurrences: ReadonlyArray<PhenomenonOccurrence>,
  from: CalendarTimestamp,
): PhenomenonOccurrence[] {
  return occurrences
    .filter(occurrence => compareTimestampsWithSchema(schema, occurrence.timestamp, from) >= 0)
    .sort((a, b) => compareTimestampsWithSchema(schema, a.timestamp, b.timestamp));
}

export type PhenomenonRule = RepeatRule;
