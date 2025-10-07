// src/apps/almanac/domain/calendar-event.ts
// Expanded calendar event domain model with recurrence and conflict helpers.

import type { CalendarSchema } from './calendar-schema';
import { getTimeDefinition } from './calendar-schema';
import type { CalendarTimestamp } from './calendar-timestamp';
import { compareTimestampsWithSchema, createMinuteTimestamp } from './calendar-timestamp';
import type {
  OccurrenceQueryOptions,
  OccurrencesInRangeOptions,
  RepeatRule,
  RepeatRuleServices,
} from './repeat-rule';
import { calculateNextOccurrence, calculateOccurrencesInRange } from './repeat-rule';
import { advanceTime } from './time-arithmetic';
import type { HookDescriptor } from './hook-descriptor';
import { sortHooksByPriority } from './hook-descriptor';

export type CalendarEvent = CalendarEventSingle | CalendarEventRecurring;

export type CalendarEventKind = CalendarEvent['kind'];

export type CalendarEventTimePrecision = 'day' | 'hour' | 'minute';

export interface CalendarTimeOfDay {
  readonly hour: number;
  readonly minute: number;
  readonly second?: number;
}

export interface CalendarEventBase {
  readonly id: string;
  readonly calendarId: string;
  readonly title: string;
  readonly description?: string;
  readonly note?: string;
  readonly category?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly priority?: number;
  readonly followUpPolicy?: 'auto' | 'manual';
  readonly hooks?: ReadonlyArray<HookDescriptor>;
  /** Representative timestamp (for single events the exact start, for recurring events the preview anchor). */
  readonly date: CalendarTimestamp;
  readonly allDay: boolean;
}

export interface CalendarEventSingle extends CalendarEventBase {
  readonly kind: 'single';
  readonly timePrecision: CalendarEventTimePrecision;
  readonly startTime?: CalendarTimeOfDay;
  readonly endTime?: CalendarTimeOfDay;
  readonly durationMinutes?: number;
}

export interface CalendarEventBounds {
  readonly start?: CalendarTimestamp;
  readonly end?: CalendarTimestamp;
}

export interface CalendarEventRecurring extends CalendarEventBase {
  readonly kind: 'recurring';
  readonly rule: RepeatRule;
  readonly timePolicy: 'all_day' | 'fixed' | 'offset';
  readonly startTime?: CalendarTimeOfDay;
  readonly offsetMinutes?: number;
  readonly durationMinutes?: number;
  readonly bounds?: CalendarEventBounds;
}

export interface CalendarEventOccurrence {
  readonly eventId: string;
  readonly calendarId: string;
  readonly eventType: CalendarEventKind;
  readonly title: string;
  readonly category?: string;
  readonly start: CalendarTimestamp;
  readonly end: CalendarTimestamp;
  readonly durationMinutes: number;
  readonly allDay: boolean;
  readonly priority: number;
  readonly hooks: ReadonlyArray<HookDescriptor>;
  readonly source: CalendarEvent;
}

export interface EventOccurrenceOptions extends OccurrenceQueryOptions {
  readonly services?: RepeatRuleServices;
}

export interface EventOccurrencesRangeOptions extends OccurrencesInRangeOptions {
  readonly services?: RepeatRuleServices;
}

export function isSingleEvent(event: CalendarEvent): event is CalendarEventSingle {
  return event.kind === 'single';
}

export function isRecurringEvent(event: CalendarEvent): event is CalendarEventRecurring {
  return event.kind === 'recurring';
}

export function createSingleEvent(
  id: string,
  calendarId: string,
  title: string,
  date: CalendarTimestamp,
  options: {
    description?: string;
    note?: string;
    allDay?: boolean;
    category?: string;
    tags?: ReadonlyArray<string>;
    priority?: number;
    followUpPolicy?: 'auto' | 'manual';
    hooks?: ReadonlyArray<HookDescriptor>;
    startTime?: CalendarTimeOfDay;
    endTime?: CalendarTimeOfDay;
    durationMinutes?: number;
    timePrecision?: CalendarEventTimePrecision;
  } = {}
): CalendarEventSingle {
  return {
    kind: 'single',
    id,
    calendarId,
    title,
    description: options.description,
    note: options.note,
    category: options.category,
    tags: options.tags,
    priority: options.priority,
    followUpPolicy: options.followUpPolicy,
    hooks: options.hooks,
    date,
    allDay: options.allDay ?? date.precision === 'day',
    startTime: options.startTime,
    endTime: options.endTime,
    durationMinutes: options.durationMinutes,
    timePrecision: options.timePrecision ?? normalisePrecision(date.precision),
  };
}

export function getEventAnchorTimestamp(event: CalendarEvent): CalendarTimestamp | null {
  if (isSingleEvent(event)) {
    return event.date;
  }
  return event.bounds?.start ?? event.date ?? null;
}

export function getEventPriority(event: CalendarEvent): number {
  return event.priority ?? 0;
}

export function getEventHooks(event: CalendarEvent): ReadonlyArray<HookDescriptor> {
  return event.hooks ? sortHooksByPriority(event.hooks) : [];
}

export function computeNextEventOccurrence(
  event: CalendarEvent,
  schema: CalendarSchema,
  calendarId: string,
  start: CalendarTimestamp,
  options: EventOccurrenceOptions = {}
): CalendarEventOccurrence | null {
  if (isSingleEvent(event)) {
    const includeStart = options.includeStart ?? false;
    const comparison = compareTimestampsWithSchema(schema, event.date, start);
    if (comparison > 0 || (comparison === 0 && includeStart)) {
      return buildSingleEventOccurrence(event, schema);
    }
    return null;
  }

  const effectiveStart = resolveRecurringSearchStart(event, schema, start);
  if (!effectiveStart) {
    return null;
  }

  const { services, ...ruleOptions } = options;
  const includeStart = ruleOptions.includeStart ?? false;

  const next = calculateNextOccurrence(
    schema,
    calendarId,
    event.rule,
    effectiveStart,
    { ...ruleOptions, includeStart },
    services,
  );

  if (!next) {
    return null;
  }

  if (!isWithinBounds(event.bounds, schema, next)) {
    const nextCursor = advanceCursorBeyondBounds(event, schema, next, ruleOptions, services, calendarId);
    return nextCursor ? buildRecurringEventOccurrence(event, schema, calendarId, nextCursor) : null;
  }

  return buildRecurringEventOccurrence(event, schema, calendarId, next);
}

export function computeEventOccurrencesInRange(
  event: CalendarEvent,
  schema: CalendarSchema,
  calendarId: string,
  rangeStart: CalendarTimestamp,
  rangeEnd: CalendarTimestamp,
  options: EventOccurrencesRangeOptions = {}
): CalendarEventOccurrence[] {
  if (isSingleEvent(event)) {
    const occurrences: CalendarEventOccurrence[] = [];
    const inRange = isTimestampInRange(schema, event.date, rangeStart, rangeEnd, options.includeStart ?? false);
    if (inRange) {
      occurrences.push(buildSingleEventOccurrence(event, schema));
    }
    return occurrences;
  }

  const effectiveStart = resolveRecurringSearchStart(event, schema, rangeStart);
  if (!effectiveStart) {
    return [];
  }

  const { services, ...ruleOptions } = options;

  const baseOccurrences = calculateOccurrencesInRange(
    schema,
    calendarId,
    event.rule,
    effectiveStart,
    rangeEnd,
    ruleOptions,
    services,
  );

  return baseOccurrences
    .filter(timestamp => isWithinBounds(event.bounds, schema, timestamp))
    .map(timestamp => buildRecurringEventOccurrence(event, schema, calendarId, timestamp));
}

export function normalisePrecision(precision: CalendarTimestamp['precision']): CalendarEventTimePrecision {
  if (precision === 'hour' || precision === 'minute') {
    return precision;
  }
  return 'day';
}

function buildSingleEventOccurrence(event: CalendarEventSingle, schema: CalendarSchema): CalendarEventOccurrence {
  const { start, end, durationMinutes } = resolveSingleEventWindow(event, schema);
  return {
    eventId: event.id,
    calendarId: event.calendarId,
    eventType: 'single',
    title: event.title,
    category: event.category,
    start,
    end,
    durationMinutes,
    allDay: event.allDay,
    priority: getEventPriority(event),
    hooks: getEventHooks(event),
    source: event,
  };
}

function buildRecurringEventOccurrence(
  event: CalendarEventRecurring,
  schema: CalendarSchema,
  calendarId: string,
  baseTimestamp: CalendarTimestamp,
): CalendarEventOccurrence {
  const { start, end, durationMinutes } = applyRecurringTimePolicy(event, schema, calendarId, baseTimestamp);
  return {
    eventId: event.id,
    calendarId,
    eventType: 'recurring',
    title: event.title,
    category: event.category,
    start,
    end,
    durationMinutes,
    allDay: event.timePolicy === 'all_day',
    priority: getEventPriority(event),
    hooks: getEventHooks(event),
    source: event,
  };
}

function resolveSingleEventWindow(event: CalendarEventSingle, schema: CalendarSchema) {
  const { minutesPerHour, hoursPerDay } = getTimeDefinition(schema);
  const minutesPerDay = hoursPerDay * minutesPerHour;

  const base = event.date;
  let start = base;
  if (!event.allDay) {
    const hour = event.startTime?.hour ?? base.hour ?? 0;
    const minute = event.startTime?.minute ?? base.minute ?? 0;
    start = createMinuteTimestamp(base.calendarId, base.year, base.monthId, base.day, hour, minute);
  }

  let duration = event.durationMinutes ?? 0;
  if (event.endTime) {
    duration = Math.max(duration, calculateDurationFromTimes(event.startTime, event.endTime, minutesPerHour, hoursPerDay));
  }

  if (duration <= 0) {
    duration = event.allDay ? minutesPerDay : 0;
  }

  const end = duration > 0 ? advanceTime(schema, start, duration, 'minute').timestamp : start;
  return { start, end, durationMinutes: duration };
}

function applyRecurringTimePolicy(
  event: CalendarEventRecurring,
  schema: CalendarSchema,
  calendarId: string,
  baseTimestamp: CalendarTimestamp,
) {
  const { minutesPerHour, hoursPerDay } = getTimeDefinition(schema);
  const minutesPerDay = hoursPerDay * minutesPerHour;

  if (event.timePolicy === 'all_day') {
    const start = baseTimestamp;
    const duration = event.durationMinutes ?? minutesPerDay;
    const end = duration > 0 ? advanceTime(schema, start, duration, 'minute').timestamp : start;
    return { start, end, durationMinutes: duration };
  }

  if (event.timePolicy === 'fixed') {
    const hour = event.startTime?.hour ?? 0;
    const minute = event.startTime?.minute ?? 0;
    const start = createMinuteTimestamp(calendarId, baseTimestamp.year, baseTimestamp.monthId, baseTimestamp.day, hour, minute);
    const duration = event.durationMinutes ?? 0;
    const end = duration > 0 ? advanceTime(schema, start, duration, 'minute').timestamp : start;
    return { start, end, durationMinutes: duration };
  }

  // offset policy
  const offsetMinutes = event.offsetMinutes ?? 0;
  const start = advanceTime(schema, baseTimestamp, offsetMinutes, 'minute').timestamp;
  const duration = event.durationMinutes ?? 0;
  const end = duration > 0 ? advanceTime(schema, start, duration, 'minute').timestamp : start;
  return { start, end, durationMinutes: duration };
}

function calculateDurationFromTimes(
  startTime: CalendarTimeOfDay | undefined,
  endTime: CalendarTimeOfDay,
  minutesPerHour: number,
  hoursPerDay: number,
): number {
  const startMinutes = timeOfDayToMinutes(startTime ?? { hour: 0, minute: 0 }, minutesPerHour);
  const endMinutes = timeOfDayToMinutes(endTime, minutesPerHour);
  const dailyMinutes = hoursPerDay * minutesPerHour;

  const raw = endMinutes - startMinutes;
  if (raw <= 0) {
    return dailyMinutes + raw; // spans midnight
  }
  return raw;
}

function timeOfDayToMinutes(time: CalendarTimeOfDay, minutesPerHour: number): number {
  return time.hour * minutesPerHour + (time.minute ?? 0);
}

function isTimestampInRange(
  schema: CalendarSchema,
  timestamp: CalendarTimestamp,
  start: CalendarTimestamp,
  end: CalendarTimestamp,
  includeStart: boolean,
): boolean {
  const [rangeStart, rangeEnd] =
    compareTimestampsWithSchema(schema, start, end) <= 0 ? [start, end] : [end, start];
  const afterStart = compareTimestampsWithSchema(schema, timestamp, rangeStart);
  const beforeEnd = compareTimestampsWithSchema(schema, timestamp, rangeEnd);
  const startOk = includeStart ? afterStart >= 0 : afterStart > 0;
  return startOk && beforeEnd <= 0;
}

function resolveRecurringSearchStart(
  event: CalendarEventRecurring,
  schema: CalendarSchema,
  start: CalendarTimestamp,
): CalendarTimestamp | null {
  const boundsStart = event.bounds?.start;
  if (!boundsStart) {
    return start;
  }

  const comparison = compareTimestampsWithSchema(schema, start, boundsStart);
  if (comparison >= 0) {
    return start;
  }
  return boundsStart;
}

function isWithinBounds(
  bounds: CalendarEventBounds | undefined,
  schema: CalendarSchema,
  timestamp: CalendarTimestamp,
): boolean {
  if (!bounds) {
    return true;
  }
  if (bounds.start && compareTimestampsWithSchema(schema, timestamp, bounds.start) < 0) {
    return false;
  }
  if (bounds.end && compareTimestampsWithSchema(schema, timestamp, bounds.end) > 0) {
    return false;
  }
  return true;
}

function advanceCursorBeyondBounds(
  event: CalendarEventRecurring,
  schema: CalendarSchema,
  current: CalendarTimestamp,
  options: OccurrenceQueryOptions,
  services: RepeatRuleServices | undefined,
  calendarId: string,
): CalendarTimestamp | null {
  if (!event.bounds?.end) {
    return null;
  }

  if (compareTimestampsWithSchema(schema, current, event.bounds.end) >= 0) {
    return null;
  }

  return calculateNextOccurrence(
    schema,
    calendarId,
    event.rule,
    current,
    { ...options, includeStart: false },
    services,
  );
}
