// src/workmodes/almanac/almanac-types.ts
/**
 * Public type definitions for Almanac workmode
 */

// Re-export public types from controller
export type { AlmanacContext } from './almanac-controller';

// Re-export domain types
export type {
  CalendarSchema,
  CalendarTimestamp,
  CalendarEvent,
  CalendarEventSingle,
  CalendarEventRecurring,
  CalendarMonth,
  TimeDefinition,
  TimestampPrecision,
  TimeUnit,
  RepeatRule,
  HookDescriptor,
  HookType,
  Phenomenon,
  PhenomenonOccurrence,
  CalendarEventOccurrence,
} from './helpers';

// Re-export data types
export type { CalendarStateGateway } from './data/calendar-state-gateway';
