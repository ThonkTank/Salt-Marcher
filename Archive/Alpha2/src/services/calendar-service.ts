/**
 * Calendar Service
 *
 * Manages calendar state with subscription pattern.
 * Extends BaseService for consistent subscription pattern.
 *
 * @module services/calendar-service
 */

import type {
	CalendarDate,
	CalendarConfig,
	CalendarState,
	CalendarServiceState,
	TravelDuration,
} from '../schemas/calendar';
import type { TimePeriod, Season } from '../schemas/weather';
import { BaseService } from './base-service';
import {
	addDays,
	CALENDAR_CONFIGS,
	DEFAULT_CALENDAR_ID,
	DEFAULT_START_DATE,
} from '../utils/calendar';
import { getTimePeriodFromHour } from '../constants/weather';

// Re-export type for backward compatibility
export type { CalendarServiceState } from '../schemas/calendar';

// ============================================================================
// CalendarService
// ============================================================================

export class CalendarService extends BaseService<CalendarServiceState> {
	private currentDate: CalendarDate;
	private config: CalendarConfig;

	constructor(
		initialDate: CalendarDate = DEFAULT_START_DATE,
		calendarId: string = DEFAULT_CALENDAR_ID
	) {
		super();
		this.currentDate = { ...initialDate };
		this.config =
			CALENDAR_CONFIGS[calendarId] ?? CALENDAR_CONFIGS[DEFAULT_CALENDAR_ID];
	}

	// ========================================================================
	// State Access
	// ========================================================================

	/**
	 * Get current calendar state.
	 */
	getState(): CalendarServiceState {
		return {
			currentDate: { ...this.currentDate },
			config: this.config,
			timePeriod: this.getTimePeriod(),
			season: this.getSeason(),
		};
	}

	/**
	 * Get current time period based on hour.
	 */
	getTimePeriod(): TimePeriod {
		const hour = this.currentDate.hour ?? 8; // Default to morning (8:00)
		return getTimePeriodFromHour(hour);
	}

	/**
	 * Get current season based on month.
	 */
	getSeason(): Season {
		const monthDef = this.config.months[this.currentDate.month - 1];
		return monthDef?.season ?? 'summer'; // Fallback to summer
	}

	// ========================================================================
	// Calendar Operations
	// ========================================================================

	/**
	 * Advance time by a number of days.
	 */
	advanceTime(days: number): void {
		this.currentDate = addDays(
			this.currentDate,
			Math.floor(days),
			this.config
		);
		this.notify();
	}

	/**
	 * Advance time by a travel duration.
	 */
	advanceByDuration(duration: TravelDuration): void {
		// Advance by whole days first
		if (duration.days > 0) {
			this.currentDate = addDays(
				this.currentDate,
				duration.days,
				this.config
			);
		}
		// Then advance by remaining hours
		if (duration.hours > 0) {
			this.advanceHours(duration.hours);
		} else {
			this.notify();
		}
	}

	/**
	 * Advance time by hours.
	 */
	advanceHours(hours: number): void {
		let currentHour = this.currentDate.hour ?? 8; // Default to 8:00
		let daysToAdd = 0;

		currentHour += hours;

		// Handle day overflow
		while (currentHour >= 24) {
			currentHour -= 24;
			daysToAdd++;
		}
		// Handle negative hours (going back in time)
		while (currentHour < 0) {
			currentHour += 24;
			daysToAdd--;
		}

		this.currentDate.hour = currentHour;

		if (daysToAdd !== 0) {
			this.currentDate = addDays(this.currentDate, daysToAdd, this.config);
		}

		this.notify();
	}

	/**
	 * Set hour directly.
	 */
	setHour(hour: number): void {
		this.currentDate.hour = Math.max(0, Math.min(23, hour));
		this.notify();
	}

	/**
	 * Set date directly.
	 */
	setDate(date: CalendarDate): void {
		this.currentDate = { ...date };
		this.notify();
	}

	/**
	 * Change calendar system.
	 */
	setCalendar(calendarId: string): void {
		const newConfig = CALENDAR_CONFIGS[calendarId];
		if (newConfig) {
			this.config = newConfig;
			this.notify();
		}
	}

	/**
	 * Get serializable state for persistence.
	 */
	toCalendarState(): CalendarState {
		return {
			currentDate: { ...this.currentDate },
			calendarId: this.config.id,
		};
	}

	/**
	 * Restore from persisted state.
	 */
	fromCalendarState(state: CalendarState): void {
		this.currentDate = { ...state.currentDate };
		this.config =
			CALENDAR_CONFIGS[state.calendarId] ??
			CALENDAR_CONFIGS[DEFAULT_CALENDAR_ID];
		this.notify();
	}
}
