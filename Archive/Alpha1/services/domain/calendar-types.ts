/**
 * Calendar Domain Types
 *
 * Shared calendar type definitions used across workmodes and features.
 * These types are now centralized in services/domain/calendar.
 *
 * This file provides backward compatibility by re-exporting from the calendar module.
 *
 * @module services/domain/calendar-types
 */

// Re-export calendar types from centralized calendar module
export type {
    // Calendar schema
    CalendarSchema,
    CalendarMonth,
    TimeDefinition,

    // Calendar timestamps
    CalendarTimestamp,
    TimestampPrecision,

    // Events (core types only)
    CalendarEvent,
    CalendarEventSingle,
    CalendarEventRecurring,
    CalendarEventKind,
    CalendarEventTimePrecision,
    CalendarTimeOfDay,
    CalendarEventBase,
    CalendarEventBounds,
    CalendarEventOccurrence,

    // Phenomena
    PhenomenonOccurrence,

    // Hooks
    HookType,
    HookDescriptor,
} from "./calendar";
