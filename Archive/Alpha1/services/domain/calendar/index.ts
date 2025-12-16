/**
 * Calendar Domain Module
 *
 * Centralized calendar domain types and utilities.
 * This module provides all calendar-related types that are shared across
 * workmodes and features, maintaining proper layer separation.
 *
 * Architecture:
 * - Types flow from services/domain → workmodes
 * - Workmodes can re-export these types for convenience
 * - Features import from @services/domain
 *
 * @module services/domain/calendar
 */

// Calendar Schema
export type {
  CalendarSchema,
  CalendarMonth,
  TimeDefinition,
  DefaultCalendarConfig,
} from './calendar-schema';

export {
  getTotalDaysInYear,
  getMonthById,
  getMonthIndex,
  getTimeDefinition,
  getMonthLength,
  clampDayToMonth,
  mod,
} from './calendar-schema';

// Calendar Timestamps
export type {
  CalendarTimestamp,
  TimestampPrecision,
  TimeUnit,
  AdvanceResult,
} from './calendar-timestamp';

export {
  createDayTimestamp,
  createHourTimestamp,
  createMinuteTimestamp,
  compareTimestamps,
  compareTimestampsWithSchema,
  formatTimestamp,
  getDayOfYear,
  resolveMonthAndDayByDayOfYear,
  createTimestampFromDayOfYear,
  timestampToAbsoluteDay,
  absoluteDayToTimestamp,
  getWeekdayForTimestamp,
  advanceTime,
} from './calendar-timestamp';

// Repeat Rules
export type {
  RepeatRule,
  AnnualOffsetRepeatRule,
  MonthlyPositionRepeatRule,
  WeeklyDayIndexRepeatRule,
  AstronomicalRepeatRule,
  CustomRepeatRule,
  AstronomicalSource,
  AstronomicalEventCalculator,
  RepeatRuleServices,
  OccurrenceQueryOptions,
  OccurrencesInRangeOptions,
} from './repeat-rules';

export {
  UnsupportedRepeatRuleError,
  InvalidRepeatRuleError,
  calculateNextOccurrence,
  calculateOccurrencesInRange,
} from './repeat-rules';

// Calendar Events
export type {
  HookType,
  HookDescriptor,
  CalendarEvent,
  CalendarEventKind,
  CalendarEventTimePrecision,
  CalendarTimeOfDay,
  CalendarEventBase,
  CalendarEventSingle,
  CalendarEventBounds,
  CalendarEventRecurring,
  CalendarEventOccurrence,
  EventOccurrenceOptions,
  EventOccurrencesRangeOptions,
} from './calendar-events';

export {
  sortHooksByPriority,
  isRecurringEvent,
  isSingleEvent,
  getEventAnchorTimestamp,
  createSingleEvent,
  computeNextEventOccurrence,
  computeEventOccurrencesInRange,
  normalisePrecision,
} from './calendar-events';

// Calendar Phenomena
export type {
  PhenomenonCategory,
  PhenomenonVisibility,
  PhenomenonTimePolicy,
  PhenomenonEffect,
  Phenomenon,
  PhenomenonStartTime,
  PhenomenonOccurrence,
  PhenomenonOccurrenceOptions,
  PhenomenonOccurrencesRangeOptions,
  PhenomenonRule,
} from './calendar-phenomena';

export {
  isPhenomenonVisibleForCalendar,
  getEffectiveStartTime,
  UnsupportedTimePolicyError,
  computeNextPhenomenonOccurrence,
  computePhenomenonOccurrencesInRange,
  sortOccurrencesByTimestamp,
  filterUpcomingOccurrences,
} from './calendar-phenomena';

// Conflict Resolution
export type {
  OccurrenceSource,
  TemporalOccurrence,
  ConflictWindow,
  ConflictGroup,
  ConflictResolution,
} from './conflict-resolution';

export {
  fromEventOccurrence,
  fromPhenomenonOccurrence,
  detectTemporalConflicts,
  resolveConflictsByPriority,
} from './conflict-resolution';
