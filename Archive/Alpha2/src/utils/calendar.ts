/**
 * Calendar Utilities
 *
 * Pure functions for date manipulation, formatting, and calendar configuration.
 * Consolidated from date-math.ts, format.ts, and constants/calendar.ts.
 *
 * @module utils/calendar
 */

import type {
	CalendarDate,
	CalendarConfig,
	TravelDuration,
} from '../schemas/calendar';
import type { Season } from '../schemas/weather';
import { formatCount } from './common/string';

// ============================================================================
// Calendar Configuration (Constants)
// ============================================================================

/** Gregorian calendar configuration */
export const GREGORIAN_CALENDAR: CalendarConfig = {
	id: 'gregorian',
	name: 'Gregorian Calendar',
	daysPerWeek: 7,
	dayNames: [
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
	],
	months: [
		{ name: 'January', days: 31, season: 'winter' as Season },
		{ name: 'February', days: 28, season: 'winter' as Season },
		{ name: 'March', days: 31, season: 'spring' as Season },
		{ name: 'April', days: 30, season: 'spring' as Season },
		{ name: 'May', days: 31, season: 'spring' as Season },
		{ name: 'June', days: 30, season: 'summer' as Season },
		{ name: 'July', days: 31, season: 'summer' as Season },
		{ name: 'August', days: 31, season: 'summer' as Season },
		{ name: 'September', days: 30, season: 'autumn' as Season },
		{ name: 'October', days: 31, season: 'autumn' as Season },
		{ name: 'November', days: 30, season: 'autumn' as Season },
		{ name: 'December', days: 31, season: 'winter' as Season },
	],
};

/** All available calendar configurations */
export const CALENDAR_CONFIGS: Record<string, CalendarConfig> = {
	gregorian: GREGORIAN_CALENDAR,
};

/** Default calendar ID */
export const DEFAULT_CALENDAR_ID = 'gregorian';

/** Default starting date */
export const DEFAULT_START_DATE: CalendarDate = { day: 1, month: 1, year: 1 };

// ============================================================================
// Date Math
// ============================================================================

/**
 * Check if a year is a leap year (Gregorian calendar).
 */
export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get the number of days in a month for a given calendar.
 * Handles leap years for Gregorian calendar.
 */
export function daysInMonth(
	month: number,
	year: number,
	config: CalendarConfig
): number {
	if (month < 1 || month > config.months.length) {
		throw new Error(`Invalid month: ${month}`);
	}

	const monthDef = config.months[month - 1];

	// Handle February leap year for Gregorian
	if (config.id === 'gregorian' && month === 2 && isLeapYear(year)) {
		return 29;
	}

	return monthDef.days;
}

/**
 * Get total days in a year for a calendar.
 */
export function daysInYear(year: number, config: CalendarConfig): number {
	return config.months.reduce((sum, _, index) => {
		return sum + daysInMonth(index + 1, year, config);
	}, 0);
}

/**
 * Add days to a date.
 * Returns new date without mutating input.
 */
export function addDays(
	date: CalendarDate,
	days: number,
	config: CalendarConfig
): CalendarDate {
	const wholeDays = Math.floor(days);

	let { day, month, year } = date;
	let remaining = wholeDays;

	// Handle negative days
	if (remaining < 0) {
		while (remaining < 0) {
			day--;
			if (day < 1) {
				month--;
				if (month < 1) {
					year--;
					month = config.months.length;
				}
				day = daysInMonth(month, year, config);
			}
			remaining++;
		}
	} else {
		// Handle positive days
		while (remaining > 0) {
			const monthDays = daysInMonth(month, year, config);
			const daysLeftInMonth = monthDays - day;

			if (remaining <= daysLeftInMonth) {
				day += remaining;
				remaining = 0;
			} else {
				remaining -= daysLeftInMonth + 1;
				month++;
				day = 1;

				if (month > config.months.length) {
					month = 1;
					year++;
				}
			}
		}
	}

	return { day, month, year };
}

/**
 * Compare two dates.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
	if (a.year !== b.year) return a.year - b.year;
	if (a.month !== b.month) return a.month - b.month;
	return a.day - b.day;
}

/**
 * Check if two dates are equal.
 */
export function datesEqual(a: CalendarDate, b: CalendarDate): boolean {
	return a.day === b.day && a.month === b.month && a.year === b.year;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a date for display.
 * Example: "15 March, 1472"
 */
export function formatDate(date: CalendarDate, config: CalendarConfig): string {
	const monthName =
		config.months[date.month - 1]?.name ?? `Month ${date.month}`;
	return `${date.day} ${monthName}, ${date.year}`;
}

/**
 * Format a date in short form.
 * Example: "15/03/1472"
 */
export function formatDateShort(date: CalendarDate): string {
	const day = String(date.day).padStart(2, '0');
	const month = String(date.month).padStart(2, '0');
	return `${day}/${month}/${date.year}`;
}

/**
 * Format travel duration for display.
 * Examples: "2 days, 4 hours" or "Less than 1 hour"
 */
export function formatTravelDuration(duration: TravelDuration): string {
	if (duration.days === 0 && duration.hours === 0) {
		return 'Less than 1 hour';
	}

	const parts: string[] = [];
	if (duration.days > 0) {
		parts.push(formatCount(duration.days, 'day'));
	}
	if (duration.hours > 0) {
		parts.push(formatCount(duration.hours, 'hour'));
	}

	return parts.join(', ');
}

/**
 * Get month name from a calendar config.
 */
export function getMonthName(month: number, config: CalendarConfig): string {
	return config.months[month - 1]?.name ?? `Month ${month}`;
}
