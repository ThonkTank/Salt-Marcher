// src/apps/almanac/domain/conflict-resolution.ts
// Utilities to detect overlapping occurrences and resolve them by priority.

import type { CalendarSchema } from './calendar-schema';
import { getTimeDefinition } from './calendar-schema';
import type { CalendarTimestamp } from './calendar-timestamp';
import { compareTimestampsWithSchema } from './calendar-timestamp';
import { timestampToAbsoluteDay } from './calendar-math';
import type { CalendarEventOccurrence } from './calendar-event';
import type { PhenomenonOccurrence, PhenomenonEffect } from './phenomenon';
import type { HookDescriptor } from './hook-descriptor';
import { sortHooksByPriority } from './hook-descriptor';

export type OccurrenceSource = 'event_single' | 'event_recurring' | 'phenomenon';

export interface TemporalOccurrence {
  readonly sourceType: OccurrenceSource;
  readonly sourceId: string;
  readonly calendarId: string;
  readonly label: string;
  readonly start: CalendarTimestamp;
  readonly end: CalendarTimestamp;
  readonly priority: number;
  readonly hooks: ReadonlyArray<HookDescriptor>;
  readonly effects: ReadonlyArray<PhenomenonEffect>;
}

export interface ConflictWindow {
  readonly start: CalendarTimestamp;
  readonly end: CalendarTimestamp;
}

export interface ConflictGroup {
  readonly window: ConflictWindow;
  readonly occurrences: ReadonlyArray<TemporalOccurrence>;
}

export interface ConflictResolution {
  readonly window: ConflictWindow;
  readonly ordered: ReadonlyArray<TemporalOccurrence>;
  readonly active: TemporalOccurrence;
  readonly suppressed: ReadonlyArray<TemporalOccurrence>;
  readonly triggeredHooks: ReadonlyArray<HookDescriptor>;
  readonly triggeredEffects: ReadonlyArray<PhenomenonEffect>;
}

export function fromEventOccurrence(occurrence: CalendarEventOccurrence): TemporalOccurrence {
  return {
    sourceType: occurrence.eventType === 'single' ? 'event_single' : 'event_recurring',
    sourceId: occurrence.eventId,
    calendarId: occurrence.calendarId,
    label: occurrence.title,
    start: occurrence.start,
    end: occurrence.end,
    priority: occurrence.priority,
    hooks: occurrence.hooks,
    effects: [],
  };
}

export function fromPhenomenonOccurrence(occurrence: PhenomenonOccurrence): TemporalOccurrence {
  return {
    sourceType: 'phenomenon',
    sourceId: occurrence.phenomenonId,
    calendarId: occurrence.calendarId,
    label: occurrence.name,
    start: occurrence.timestamp,
    end: occurrence.endTimestamp,
    priority: occurrence.priority,
    hooks: occurrence.hooks,
    effects: occurrence.effects,
  };
}

export function detectTemporalConflicts(
  schema: CalendarSchema,
  occurrences: ReadonlyArray<TemporalOccurrence>,
): ConflictGroup[] {
  if (occurrences.length === 0) {
    return [];
  }

  const sorted = [...occurrences].sort((a, b) => {
    const cmp = compareTimestampsWithSchema(schema, a.start, b.start);
    if (cmp !== 0) {
      return cmp;
    }
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return a.sourceId.localeCompare(b.sourceId);
  });

  const groups: ConflictGroup[] = [];
  let current: TemporalOccurrence[] = [];
  let currentEndMinutes = 0;

  for (const occurrence of sorted) {
    const startMinutes = toAbsoluteMinutes(schema, occurrence.start);
    const endMinutes = Math.max(startMinutes, toAbsoluteMinutes(schema, occurrence.end));

    if (current.length === 0) {
      current = [occurrence];
      currentEndMinutes = endMinutes;
      continue;
    }

    if (startMinutes < currentEndMinutes) {
      current.push(occurrence);
      currentEndMinutes = Math.max(currentEndMinutes, endMinutes);
      continue;
    }

    groups.push({
      window: {
        start: current[0].start,
        end: getWindowEnd(schema, current, currentEndMinutes),
      },
      occurrences: current,
    });

    current = [occurrence];
    currentEndMinutes = endMinutes;
  }

  if (current.length > 0) {
    groups.push({
      window: {
        start: current[0].start,
        end: getWindowEnd(schema, current, currentEndMinutes),
      },
      occurrences: current,
    });
  }

  return groups;
}

export function resolveConflictsByPriority(groups: ReadonlyArray<ConflictGroup>): ConflictResolution[] {
  return groups.map(group => {
    const ordered = [...group.occurrences].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      const cmp = compareTimestampsWithSchemaInternal(a.start, b.start);
      if (cmp !== 0) {
        return cmp;
      }
      return a.sourceId.localeCompare(b.sourceId);
    });

    const [active, ...suppressed] = ordered;
    const triggeredHooks = sortHooksByPriority(active.hooks);
    return {
      window: group.window,
      ordered,
      active,
      suppressed,
      triggeredHooks,
      triggeredEffects: active.effects,
    };
  });
}

function toAbsoluteMinutes(schema: CalendarSchema, timestamp: CalendarTimestamp): number {
  const { hoursPerDay, minutesPerHour } = getTimeDefinition(schema);
  const minutesPerDay = hoursPerDay * minutesPerHour;
  const absoluteDay = timestampToAbsoluteDay(schema, timestamp);
  const hour = timestamp.hour ?? 0;
  const minute = timestamp.minute ?? 0;
  return absoluteDay * minutesPerDay + hour * minutesPerHour + minute;
}

function getWindowEnd(
  schema: CalendarSchema,
  occurrences: ReadonlyArray<TemporalOccurrence>,
): CalendarTimestamp {
  const latest = occurrences.reduce((latestEnd, current) => {
    const comparison = compareTimestampsWithSchema(schema, current.end, latestEnd);
    return comparison > 0 ? current.end : latestEnd;
  }, occurrences[0].end);

  return latest;
}

function compareTimestampsWithSchemaInternal(a: CalendarTimestamp, b: CalendarTimestamp): number {
  if (a.calendarId !== b.calendarId) {
    return a.calendarId.localeCompare(b.calendarId);
  }
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.monthId !== b.monthId) {
    return a.monthId.localeCompare(b.monthId);
  }
  if (a.day !== b.day) {
    return a.day - b.day;
  }
  if ((a.hour ?? 0) !== (b.hour ?? 0)) {
    return (a.hour ?? 0) - (b.hour ?? 0);
  }
  return (a.minute ?? 0) - (b.minute ?? 0);
}
