// src/apps/almanac/domain/phenomenon-engine.ts
// Calculates phenomenon occurrences based on repeat rules and time policies.

/**
 * Phenomenon Engine
 *
 * Bridges repeat rules with phenomenon-specific time policies to calculate
 * upcoming and in-range occurrences. The engine intentionally focuses on
 * day/minute precision to match the current Almanac MVP scope.
 */

import type { CalendarSchema } from './calendar-schema';
import { getTimeDefinition } from './calendar-schema';
import type { CalendarTimestamp } from './calendar-timestamp';
import { compareTimestampsWithSchema, createMinuteTimestamp } from './calendar-timestamp';
import type { Phenomenon, PhenomenonOccurrence } from './phenomenon';
import { requiresOffsetComputation } from './phenomenon';
import type { OccurrenceQueryOptions, OccurrencesInRangeOptions, RepeatRule } from './repeat-rule';
import { calculateNextOccurrence, calculateOccurrencesInRange } from './repeat-rule';

export class UnsupportedTimePolicyError extends Error {
  constructor(policy: string) {
    super(`Phenomenon time policy "${policy}" is not supported yet.`);
    this.name = 'UnsupportedTimePolicyError';
  }
}

export interface PhenomenonOccurrenceOptions extends OccurrenceQueryOptions {}

export interface PhenomenonOccurrencesRangeOptions extends OccurrencesInRangeOptions {}

export function computeNextPhenomenonOccurrence(
  phenomenon: Phenomenon,
  schema: CalendarSchema,
  calendarId: string,
  start: CalendarTimestamp,
  options: PhenomenonOccurrenceOptions = {}
): PhenomenonOccurrence | null {
  const baseTimestamp = calculateNextOccurrence(schema, calendarId, phenomenon.rule, start, options);
  if (!baseTimestamp) {
    return null;
  }

  const timestamp = applyTimePolicy(phenomenon, schema, calendarId, baseTimestamp);

  return {
    phenomenonId: phenomenon.id,
    name: phenomenon.name,
    calendarId,
    timestamp,
    category: phenomenon.category,
    priority: phenomenon.priority,
  };
}

export function computePhenomenonOccurrencesInRange(
  phenomenon: Phenomenon,
  schema: CalendarSchema,
  calendarId: string,
  rangeStart: CalendarTimestamp,
  rangeEnd: CalendarTimestamp,
  options: PhenomenonOccurrencesRangeOptions = {}
): PhenomenonOccurrence[] {
  const baseOccurrences = calculateOccurrencesInRange(
    schema,
    calendarId,
    phenomenon.rule,
    rangeStart,
    rangeEnd,
    options,
  );

  return baseOccurrences.map(timestamp => ({
    phenomenonId: phenomenon.id,
    name: phenomenon.name,
    calendarId,
    timestamp: applyTimePolicy(phenomenon, schema, calendarId, timestamp),
    category: phenomenon.category,
    priority: phenomenon.priority,
  }));
}

function applyTimePolicy(
  phenomenon: Phenomenon,
  schema: CalendarSchema,
  calendarId: string,
  baseTimestamp: CalendarTimestamp,
): CalendarTimestamp {
  if (requiresOffsetComputation(phenomenon)) {
    throw new UnsupportedTimePolicyError(phenomenon.timePolicy);
  }

  if (phenomenon.timePolicy === 'all_day') {
    return baseTimestamp;
  }

  const startTime = phenomenon.startTime ?? { hour: 0, minute: 0 };
  const { hoursPerDay, minutesPerHour } = getTimeDefinition(schema);

  const hour = clamp(startTime.hour, 0, Math.max(0, hoursPerDay - 1));
  const minute = clamp(startTime.minute ?? 0, 0, Math.max(0, minutesPerHour - 1));

  return createMinuteTimestamp(
    calendarId,
    baseTimestamp.year,
    baseTimestamp.monthId,
    baseTimestamp.day,
    hour,
    minute,
  );
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
