/**
 * Calendar Event Types and Logic
 *
 * Event definitions and occurrence calculations.
 * These types are shared across all workmodes and features.
 *
 * @module services/domain/calendar/calendar-events
 */

import type { CalendarSchema } from './calendar-schema';
import type { CalendarTimestamp, TimestampPrecision } from './calendar-timestamp';
import type { RepeatRule, RepeatRuleServices, OccurrenceQueryOptions, OccurrencesInRangeOptions } from './repeat-rules';
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

/**
 * Hook descriptors shared across events and phenomena
 */
export type HookType =
  | 'webhook'
  | 'script'
  | 'cartographer_event'
  | 'notification'
  | 'weather_update'
  | 'faction_update'
  | 'location_update';

export interface HookDescriptor {
  readonly id: string;
  readonly type: HookType;
  readonly config: Readonly<Record<string, unknown>>;
  readonly priority?: number;
}

export function sortHooksByPriority(hooks: ReadonlyArray<HookDescriptor>): HookDescriptor[] {
  return [...hooks].sort((a, b) => {
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Calendar event domain
 */
export type CalendarEvent = CalendarEventSingle | CalendarEventRecurring;
export type CalendarEventKind = CalendarEvent['kind'];
export type CalendarEventTimePrecision = TimestampPrecision;

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

export function isRecurringEvent(event: CalendarEvent): event is CalendarEventRecurring {
  return event.kind === 'recurring';
}

/**
 * Check if an event is a single (non-recurring) event
 */
export function isSingleEvent(event: CalendarEvent): event is CalendarEventSingle {
  return event.kind === 'single';
}

/**
 * Get the anchor timestamp for an event
 * For single events, returns the date
 * For recurring events, returns the start bound if available
 *
 * @param event - Calendar event
 * @returns Anchor timestamp or null
 */
export function getEventAnchorTimestamp(event: CalendarEvent): CalendarTimestamp | null {
  if (isSingleEvent(event)) {
    return event.date;
  }
  return event.bounds?.start ?? event.date ?? null;
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
  } = {},
): CalendarEventSingle {
  const {
    description,
    note,
    allDay = date.precision === 'day',
    category,
    tags,
    priority,
    followUpPolicy,
    hooks,
    startTime,
    endTime,
    durationMinutes,
    timePrecision = normalisePrecision(date.precision),
  } = options;

  return {
    kind: 'single',
    id,
    calendarId,
    title,
    description,
    note,
    category,
    tags,
    priority,
    followUpPolicy,
    hooks,
    date,
    allDay,
    startTime,
    endTime,
    durationMinutes,
    timePrecision,
  };
}

export function computeNextEventOccurrence(
  event: CalendarEvent,
  schema: CalendarSchema,
  calendarId: string,
  start: CalendarTimestamp,
  options: EventOccurrenceOptions = {},
): CalendarEventOccurrence | null {
  // Note: isSingleEvent is imported from types/calendar-utils.ts at the workmode level
  // Here we use kind check directly
  if (event.kind === 'single') {
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
  options: EventOccurrencesRangeOptions = {},
): CalendarEventOccurrence[] {
  if (event.kind === 'single') {
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
  const hooks = event.hooks ? sortHooksByPriority(event.hooks) : [];
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
    priority: event.priority ?? 0,
    hooks,
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
  const hooks = event.hooks ? sortHooksByPriority(event.hooks) : [];
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
    priority: event.priority ?? 0,
    hooks,
    source: event,
  };
}

function resolveSingleEventWindow(event: CalendarEventSingle, schema: CalendarSchema) {
  const { minutesPerHour, hoursPerDay } = getTimeDefinition(schema);
  const minutesPerDay = hoursPerDay * minutesPerHour;

  const base = event.date;
  const start = event.allDay
    ? base
    : createMinuteTimestamp(
        base.calendarId,
        base.year,
        base.monthId,
        base.day,
        event.startTime?.hour ?? base.hour ?? 0,
        event.startTime?.minute ?? base.minute ?? 0,
      );

  const requestedDuration = event.endTime
    ? Math.max(
        event.durationMinutes ?? 0,
        calculateDurationFromTimes(event.startTime, event.endTime, minutesPerHour, hoursPerDay),
      )
    : event.durationMinutes ?? 0;

  const duration = resolveDuration(requestedDuration, event.allDay ? minutesPerDay : 0);
  return createWindow(schema, start, duration);
}

function applyRecurringTimePolicy(
  event: CalendarEventRecurring,
  schema: CalendarSchema,
  calendarId: string,
  baseTimestamp: CalendarTimestamp,
) {
  const { minutesPerHour, hoursPerDay } = getTimeDefinition(schema);
  const minutesPerDay = hoursPerDay * minutesPerHour;

  switch (event.timePolicy) {
    case 'all_day':
      return createWindow(schema, baseTimestamp, resolveDuration(event.durationMinutes, minutesPerDay));
    case 'fixed': {
      const start = createMinuteTimestamp(
        calendarId,
        baseTimestamp.year,
        baseTimestamp.monthId,
        baseTimestamp.day,
        event.startTime?.hour ?? 0,
        event.startTime?.minute ?? 0,
      );
      return createWindow(schema, start, resolveDuration(event.durationMinutes, 0));
    }
    case 'offset': {
      const start = advanceTime(schema, baseTimestamp, event.offsetMinutes ?? 0, 'minute').timestamp;
      return createWindow(schema, start, resolveDuration(event.durationMinutes, 0));
    }
    default: {
      const _never: never = event.timePolicy;
      return _never;
    }
  }
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
    return dailyMinutes + raw;
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
