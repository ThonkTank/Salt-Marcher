// src/apps/almanac/domain/index.ts
// Consolidated calendar schema, scheduling and phenomenon utilities.

/**
 * Calendar schema structures
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
  return compareTimestampParts(a, b, (left, right) => left.localeCompare(right));
}

export function compareTimestampsWithSchema(
  schema: CalendarSchema,
  a: CalendarTimestamp,
  b: CalendarTimestamp,
): number {
  return compareTimestampParts(a, b, (left, right) => {
    const aIndex = getMonthIndex(schema, left);
    const bIndex = getMonthIndex(schema, right);
    if (aIndex === -1 || bIndex === -1) {
      return left.localeCompare(right);
    }
    return aIndex - bIndex;
  });
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
  if (days === 0) {
    return { timestamp: current, normalized: false };
  }

  const startDay = timestampToAbsoluteDay(schema, current);
  const targetDay = startDay + days;
  const base = absoluteDayToTimestamp(schema, current.calendarId, targetDay);
  const timestamp = rebuildTimestamp(base, current);
  return { timestamp, normalized: base.year !== current.year };
}

function advanceByHours(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  hours: number,
): AdvanceResult {
  if (hours === 0) {
    return { timestamp: rebuildTimestamp(current, current), normalized: false };
  }

  const { hoursPerDay } = getTimeDefinition(schema);
  const currentHour = current.hour ?? 0;
  const totalHours = currentHour + hours;
  const wrappedHour = mod(totalHours, hoursPerDay);
  const dayShift = (totalHours - wrappedHour) / hoursPerDay;
  const baseDay = advanceByDays(schema, current, dayShift);
  const timestamp = current.minute !== undefined
    ? createMinuteTimestamp(
        current.calendarId,
        baseDay.timestamp.year,
        baseDay.timestamp.monthId,
        baseDay.timestamp.day,
        wrappedHour,
        current.minute,
      )
    : createHourTimestamp(
        current.calendarId,
        baseDay.timestamp.year,
        baseDay.timestamp.monthId,
        baseDay.timestamp.day,
        wrappedHour,
      );

  const normalized = dayShift !== 0 || baseDay.normalized;
  return {
    timestamp,
    normalized,
    carriedDays: dayShift !== 0 ? dayShift : undefined,
    carriedHours: hours,
  };
}

function advanceByMinutes(
  schema: CalendarSchema,
  current: CalendarTimestamp,
  minutes: number,
): AdvanceResult {
  if (minutes === 0) {
    return { timestamp: rebuildTimestamp(current, current), normalized: false };
  }

  const { hoursPerDay, minutesPerHour } = getTimeDefinition(schema);
  const minutesPerDay = hoursPerDay * minutesPerHour;
  const startDay = timestampToAbsoluteDay(schema, current);
  const originalHour = current.hour ?? 0;
  const startMinuteOfDay = originalHour * minutesPerHour + (current.minute ?? 0);
  let totalMinutes = startDay * minutesPerDay + startMinuteOfDay + minutes;

  let dayIndex = Math.floor(totalMinutes / minutesPerDay);
  let minuteOfDay = totalMinutes - dayIndex * minutesPerDay;
  if (minuteOfDay < 0) {
    minuteOfDay += minutesPerDay;
    dayIndex -= 1;
  }

  const hour = Math.floor(minuteOfDay / minutesPerHour);
  const minute = minuteOfDay - hour * minutesPerHour;
  const baseDay = absoluteDayToTimestamp(schema, current.calendarId, dayIndex);
  const timestamp = createMinuteTimestamp(
    current.calendarId,
    baseDay.year,
    baseDay.monthId,
    baseDay.day,
    hour,
    minute,
  );

  const normalized = hour !== originalHour || dayIndex !== startDay;
  return { timestamp, normalized };
}

function rebuildTimestamp(base: CalendarTimestamp, template: CalendarTimestamp): CalendarTimestamp {
  if (template.minute !== undefined) {
    return createMinuteTimestamp(
      template.calendarId,
      base.year,
      base.monthId,
      base.day,
      template.hour ?? 0,
      template.minute,
    );
  }
  if (template.hour !== undefined) {
    return createHourTimestamp(template.calendarId, base.year, base.monthId, base.day, template.hour);
  }
  return createDayTimestamp(template.calendarId, base.year, base.monthId, base.day);
}

function compareTimestampParts(
  a: CalendarTimestamp,
  b: CalendarTimestamp,
  compareMonth: (left: string, right: string) => number,
): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.monthId !== b.monthId) {
    const monthComparison = compareMonth(a.monthId, b.monthId);
    if (monthComparison !== 0) {
      return monthComparison;
    }
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

/**
 * Scheduling, repeat rules and temporal entities
 */
/**
 * Hook descriptors shared across events and phenomena
 */
export type HookType = 'webhook' | 'script' | 'cartographer_event';

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
 * Repeat rule definitions and helpers
 */
export type RepeatRule =
  | AnnualOffsetRepeatRule
  | MonthlyPositionRepeatRule
  | WeeklyDayIndexRepeatRule
  | AstronomicalRepeatRule
  | CustomRepeatRule;

export interface AnnualOffsetRepeatRule {
  readonly type: 'annual' | 'annual_offset';
  readonly offsetDayOfYear: number;
}

export interface MonthlyPositionRepeatRule {
  readonly type: 'monthly_position';
  readonly monthId: string;
  readonly day: number;
}

export interface WeeklyDayIndexRepeatRule {
  readonly type: 'weekly_dayIndex';
  readonly dayIndex: number;
  readonly interval?: number;
}

export type AstronomicalSource = 'sunrise' | 'sunset' | 'moon_phase' | 'eclipse';

export interface AstronomicalRepeatRule {
  readonly type: 'astronomical';
  readonly source: AstronomicalSource;
  readonly referenceCalendarId?: string;
  readonly offsetMinutes?: number;
}

export interface CustomRepeatRule {
  readonly type: 'custom';
  readonly customRuleId: string;
}

export interface OccurrenceQueryOptions {
  readonly includeStart?: boolean;
}

export interface OccurrencesInRangeOptions extends OccurrenceQueryOptions {
  readonly limit?: number;
}

export interface AstronomicalEventCalculator {
  resolveNextOccurrence(
    schema: CalendarSchema,
    calendarId: string,
    rule: AstronomicalRepeatRule,
    start: CalendarTimestamp,
    options: OccurrenceQueryOptions,
  ): CalendarTimestamp | null;
  resolveOccurrencesInRange(
    schema: CalendarSchema,
    calendarId: string,
    rule: AstronomicalRepeatRule,
    rangeStart: CalendarTimestamp,
    rangeEnd: CalendarTimestamp,
    options: OccurrencesInRangeOptions,
  ): CalendarTimestamp[];
}

export interface RepeatRuleServices {
  readonly astronomicalCalculator?: AstronomicalEventCalculator;
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

export function calculateNextOccurrence(
  schema: CalendarSchema,
  calendarId: string,
  rule: RepeatRule,
  start: CalendarTimestamp,
  options: OccurrenceQueryOptions = {},
  services: RepeatRuleServices = {},
): CalendarTimestamp | null {
  const includeStart = options.includeStart ?? false;
  switch (rule.type) {
    case 'annual':
    case 'annual_offset':
      return resolveNextAnnualOccurrence(schema, calendarId, rule, start, includeStart);
    case 'monthly_position':
      return resolveNextMonthlyOccurrence(schema, calendarId, rule, start, includeStart);
    case 'weekly_dayIndex':
      return resolveNextWeeklyOccurrence(schema, calendarId, rule, start, includeStart);
    case 'astronomical':
      return resolveNextAstronomicalOccurrence(schema, calendarId, rule, start, options, services);
    case 'custom':
      throw new UnsupportedRepeatRuleError(rule.type);
    default: {
      const _never: never = rule;
      return _never;
    }
  }
}

export function calculateOccurrencesInRange(
  schema: CalendarSchema,
  calendarId: string,
  rule: RepeatRule,
  rangeStart: CalendarTimestamp,
  rangeEnd: CalendarTimestamp,
  options: OccurrencesInRangeOptions = {},
  services: RepeatRuleServices = {},
): CalendarTimestamp[] {
  const limit = options.limit ?? 12;
  if (limit <= 0) return [];

  const compare = compareTimestampsWithSchema(schema, rangeStart, rangeEnd);
  const [start, end] = compare <= 0 ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];

  if (rule.type === 'astronomical') {
    return resolveAstronomicalRange(schema, calendarId, rule, start, end, options, services).slice(0, limit);
  }

  const occurrences: CalendarTimestamp[] = [];
  let cursor = calculateNextOccurrence(schema, calendarId, rule, start, options, services);

  while (cursor && occurrences.length < limit && compareTimestampsWithSchema(schema, cursor, end) <= 0) {
    occurrences.push(cursor);
    cursor = calculateNextOccurrence(schema, calendarId, rule, cursor, { includeStart: false }, services);
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
  rule: AnnualOffsetRepeatRule,
  start: CalendarTimestamp,
  includeStart: boolean,
): CalendarTimestamp | null {
  const totalDays = getTotalDaysInYear(schema);
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
  includeStart: boolean,
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
  includeStart: boolean,
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

  const intervalDays = daysPerWeek * interval;
  if (delta % daysPerWeek !== 0 && interval > 1) {
    delta += mod(intervalDays - (delta % intervalDays), intervalDays);
  }

  const candidateAbsolute = absoluteStart + delta;
  return absoluteDayToTimestamp(schema, calendarId, candidateAbsolute);
}

function resolveNextAstronomicalOccurrence(
  schema: CalendarSchema,
  calendarId: string,
  rule: AstronomicalRepeatRule,
  start: CalendarTimestamp,
  options: OccurrenceQueryOptions,
  services: RepeatRuleServices,
): CalendarTimestamp | null {
  const calculator = services.astronomicalCalculator;
  if (!calculator) {
    throw new UnsupportedRepeatRuleError(rule.type);
  }
  return calculator.resolveNextOccurrence(schema, calendarId, rule, start, options);
}

function resolveAstronomicalRange(
  schema: CalendarSchema,
  calendarId: string,
  rule: AstronomicalRepeatRule,
  rangeStart: CalendarTimestamp,
  rangeEnd: CalendarTimestamp,
  options: OccurrencesInRangeOptions,
  services: RepeatRuleServices,
): CalendarTimestamp[] {
  const calculator = services.astronomicalCalculator;
  if (!calculator) {
    throw new UnsupportedRepeatRuleError(rule.type);
  }
  return calculator.resolveOccurrencesInRange(schema, calendarId, rule, rangeStart, rangeEnd, options);
}

/**
 * Calendar event domain
 */
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

export function getEventAnchorTimestamp(event: CalendarEvent): CalendarTimestamp | null {
  if (isSingleEvent(event)) {
    return event.date;
  }
  return event.bounds?.start ?? event.date ?? null;
}

export function computeNextEventOccurrence(
  event: CalendarEvent,
  schema: CalendarSchema,
  calendarId: string,
  start: CalendarTimestamp,
  options: EventOccurrenceOptions = {},
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
  options: EventOccurrencesRangeOptions = {},
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
  let start = base;
  if (!event.allDay) {
    const hour = event.startTime?.hour ?? base.hour ?? 0;
    const minute = event.startTime?.minute ?? base.minute ?? 0;
    start = createMinuteTimestamp(base.calendarId, base.year, base.monthId, base.day, hour, minute);
  }

  let duration = event.durationMinutes ?? 0;
  if (event.endTime) {
    duration = Math.max(
      duration,
      calculateDurationFromTimes(event.startTime, event.endTime, minutesPerHour, hoursPerDay),
    );
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

  if (phenomenon.timePolicy !== 'offset') {
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
  occurrences: ReadonlyArray<PhenomenonOccurrence>,
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

/**
 * Conflict resolution utilities
 */
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
        end: getWindowEnd(schema, current),
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
        end: getWindowEnd(schema, current),
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
