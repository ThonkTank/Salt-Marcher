// src/workmodes/almanac/helpers/index.ts
// Re-exports calendar domain types from services layer for backward compatibility.
// All calendar types are now defined in @services/domain/calendar.

// Re-export calendar utilities from services layer
export { getEventAnchorTimestamp, isSingleEvent } from '@services/domain/calendar';

// Re-export all calendar domain types from services layer
export type {
  // Calendar Schema
  CalendarSchema,
  CalendarMonth,
  TimeDefinition,
  DefaultCalendarConfig,

  // Calendar Timestamps
  CalendarTimestamp,
  TimestampPrecision,
  TimeUnit,
  AdvanceResult,

  // Repeat Rules
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

  // Calendar Events
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

  // Calendar Phenomena
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

  // Conflict Resolution
  OccurrenceSource,
  TemporalOccurrence,
  ConflictWindow,
  ConflictGroup,
  ConflictResolution,
} from '@services/domain/calendar';

// Re-export all calendar domain functions
export {
  // Calendar Schema
  getTotalDaysInYear,
  getMonthById,
  getMonthIndex,
  getTimeDefinition,
  getMonthLength,
  clampDayToMonth,
  mod,

  // Calendar Timestamps
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

  // Repeat Rules
  UnsupportedRepeatRuleError,
  InvalidRepeatRuleError,
  calculateNextOccurrence,
  calculateOccurrencesInRange,

  // Calendar Events
  sortHooksByPriority,
  isRecurringEvent,
  createSingleEvent,
  computeNextEventOccurrence,
  computeEventOccurrencesInRange,
  normalisePrecision,

  // Calendar Phenomena
  isPhenomenonVisibleForCalendar,
  getEffectiveStartTime,
  UnsupportedTimePolicyError,
  computeNextPhenomenonOccurrence,
  computePhenomenonOccurrencesInRange,
  sortOccurrencesByTimestamp,
  filterUpcomingOccurrences,

  // Conflict Resolution
  fromEventOccurrence,
  fromPhenomenonOccurrence,
  detectTemporalConflicts,
  resolveConflictsByPriority,
} from '@services/domain/calendar';

// Re-export astronomical calculator
export { DefaultAstronomicalCalculator } from './astronomical-calculator';
export type { MoonPhase, MoonPhaseDetails } from './astronomical-calculator';

// Re-export search engine
export { searchEvents } from './search-engine';
export type { SearchQuery, SearchMatch } from './search-engine';
