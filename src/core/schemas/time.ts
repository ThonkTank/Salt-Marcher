/**
 * Time-related schemas for calendar, game datetime, and duration.
 *
 * Based on Time-System.md specification:
 * - TimeState: currentTime + activeCalendarId
 * - GameDateTime: year/month/day/hour/minute
 * - CalendarDefinition: Entity stored in EntityRegistry
 * - Duration: time interval for advance operations
 */

import { z } from 'zod';
import { entityIdSchema } from './common';

// ============================================================================
// Time Segment Schema
// ============================================================================

// Re-export from common.ts for convenience
export { timeSegmentSchema } from './common';
export type TimeSegment = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';

// ============================================================================
// GameDateTime Schema
// ============================================================================

/**
 * In-game date and time representation.
 * All fields are 1-indexed except hour (0-23) and minute (0-59).
 */
export const gameDateTimeSchema = z.object({
  year: z.number().int().min(1),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

export type GameDateTime = z.infer<typeof gameDateTimeSchema>;

// ============================================================================
// Duration Schema
// ============================================================================

/**
 * Time duration for advance operations.
 * All fields optional - unset means 0.
 */
export const durationSchema = z.object({
  years: z.number().int().min(0).optional(),
  months: z.number().int().min(0).optional(),
  days: z.number().int().min(0).optional(),
  hours: z.number().int().min(0).optional(),
  minutes: z.number().int().min(0).optional(),
});

export type Duration = z.infer<typeof durationSchema>;

// ============================================================================
// Calendar Month Schema
// ============================================================================

/**
 * Single month in a calendar.
 * From Time-System.md lines 115-119.
 */
export const calendarMonthSchema = z.object({
  name: z.string().min(1),
  days: z.number().int().min(1).max(31),
  /** Optional season association for this month */
  season: z.string().optional(),
});

export type CalendarMonth = z.infer<typeof calendarMonthSchema>;

// ============================================================================
// Calendar Season Schema
// ============================================================================

/**
 * Season definition with associated month indices.
 * From Time-System.md lines 121-124.
 */
export const calendarSeasonSchema = z.object({
  name: z.string().min(1),
  /** Month indices (0-indexed) that belong to this season */
  months: z.array(z.number().int().min(0)),
});

export type CalendarSeason = z.infer<typeof calendarSeasonSchema>;

// ============================================================================
// Time Segment Range Schema
// ============================================================================

/**
 * Hour range for a time segment.
 * Supports wrap-around (e.g., night: 20-5).
 */
export const timeSegmentRangeSchema = z.object({
  start: z.number().int().min(0).max(23),
  end: z.number().int().min(0).max(23),
});

export type TimeSegmentRange = z.infer<typeof timeSegmentRangeSchema>;

// ============================================================================
// Calendar Definition Schema
// ============================================================================

/**
 * Complete calendar definition.
 * Stored as entity in EntityRegistry (type: 'calendar').
 * From Time-System.md lines 91-113.
 */
export const calendarDefinitionSchema = z.object({
  id: entityIdSchema('calendar'),
  name: z.string().min(1),

  /** Calendar months with day counts */
  months: z.array(calendarMonthSchema),

  /** Weekday names in order */
  weekdays: z.array(z.string().min(1)),

  /** Season definitions with month associations */
  seasons: z.array(calendarSeasonSchema),

  /** Time segment hour ranges for day/night cycle */
  timeSegments: z.object({
    dawn: timeSegmentRangeSchema,
    morning: timeSegmentRangeSchema,
    midday: timeSegmentRangeSchema,
    afternoon: timeSegmentRangeSchema,
    dusk: timeSegmentRangeSchema,
    night: timeSegmentRangeSchema,
  }),
});

export type CalendarDefinition = z.infer<typeof calendarDefinitionSchema>;

// ============================================================================
// TimeState Schema
// ============================================================================

/**
 * Time feature state.
 * From Time-System.md lines 58-65.
 */
export const timeStateSchema = z.object({
  currentTime: gameDateTimeSchema,
  activeCalendarId: entityIdSchema('calendar'),
});

export type TimeState = z.infer<typeof timeStateSchema>;

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default game start time: Year 1, Month 1, Day 1, 8:00 AM
 */
export const DEFAULT_GAME_TIME: GameDateTime = {
  year: 1,
  month: 1,
  day: 1,
  hour: 8,
  minute: 0,
};

/**
 * Default calendar ID for bootstrap.
 */
export const DEFAULT_CALENDAR_ID = 'gregorian-001';
