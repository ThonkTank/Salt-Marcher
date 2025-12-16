/**
 * Calendar Schemas
 *
 * Types for calendar dates, configuration, and state management.
 * Consolidated from date.ts and config.ts.
 *
 * @module schemas/calendar
 */

import type { Season, TimePeriod } from './weather';

// ============================================================================
// Date Types
// ============================================================================

/** A specific date in a calendar system */
export type CalendarDate = {
	/** Day of the month (1-indexed) */
	day: number;
	/** Month of the year (1-indexed) */
	month: number;
	/** Year number */
	year: number;
	/** Hour of the day (0-23), optional for backward compatibility */
	hour?: number;
};

/** Travel duration breakdown */
export type TravelDuration = {
	/** Total days including fractional */
	totalDays: number;
	/** Whole days */
	days: number;
	/** Remaining hours after whole days */
	hours: number;
};

// ============================================================================
// Calendar Configuration
// ============================================================================

/** Month definition */
export type MonthDefinition = {
	/** Month name */
	name: string;
	/** Number of days in the month */
	days: number;
	/** Season for this month */
	season?: Season;
};

/** Calendar system configuration */
export type CalendarConfig = {
	/** Calendar system identifier */
	id: string;
	/** Display name */
	name: string;
	/** Months in order */
	months: MonthDefinition[];
	/** Days per week (for display purposes) */
	daysPerWeek: number;
	/** Day names (optional, for display) */
	dayNames?: string[];
};

// ============================================================================
// State Types
// ============================================================================

/** Persisted calendar state */
export type CalendarState = {
	/** Current date */
	currentDate: CalendarDate;
	/** Calendar system ID */
	calendarId: string;
};

/** Full calendar service state (exposed to subscribers) */
export type CalendarServiceState = {
	currentDate: CalendarDate;
	config: CalendarConfig;
	timePeriod: TimePeriod;
	season: Season;
};
