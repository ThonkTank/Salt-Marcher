// src/workmodes/almanac/data/time-advancement-service.ts
// Service for advancing calendar time and computing recurrence

import {
  advanceTime,
  createDayTimestamp,
} from "../helpers";
import type {
  CalendarSchema,
  CalendarTimestamp,
  TimeUnit,
} from "../helpers";

/**
 * Result of time advancement operation
 */
export interface TimeAdvancementResult {
  readonly timestamp: CalendarTimestamp;
  readonly previousTimestamp: CalendarTimestamp;
  readonly elapsedDays: number;
}

/**
 * Service for time advancement and recurrence calculations
 *
 * Handles calendar time progression and computes recurrence patterns
 */
export class TimeAdvancementService {
  /**
   * Advance time by specified amount
   *
   * @param calendar - Calendar schema
   * @param current - Current timestamp
   * @param amount - Amount to advance
   * @param unit - Time unit
   * @returns Advancement result with new timestamp and elapsed days
   */
  advanceTime(
    calendar: CalendarSchema,
    current: CalendarTimestamp,
    amount: number,
    unit: TimeUnit,
  ): TimeAdvancementResult {
    const result = advanceTime(calendar, current, amount, unit);

    // Calculate elapsed days for simulation hooks
    const elapsedDays = this.calculateElapsedDays(calendar, current, result.timestamp);

    return {
      timestamp: result.timestamp,
      previousTimestamp: current,
      elapsedDays,
    };
  }

  /**
   * Calculate elapsed days between two timestamps
   *
   * @param calendar - Calendar schema
   * @param start - Start timestamp
   * @param end - End timestamp
   * @returns Number of days elapsed
   */
  calculateElapsedDays(
    calendar: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): number {
    // Simple implementation: calculate day difference
    // This is an approximation; more accurate calculation would use absolute day conversion

    const startDayOfYear = this.getDayOfYear(calendar, start);
    const endDayOfYear = this.getDayOfYear(calendar, end);
    const yearDiff = end.year - start.year;

    if (yearDiff === 0) {
      return endDayOfYear - startDayOfYear;
    }

    // Calculate days across year boundaries
    const daysPerYear = this.getTotalDaysInYear(calendar);
    return yearDiff * daysPerYear + (endDayOfYear - startDayOfYear);
  }

  /**
   * Initialize timestamp from calendar epoch if not set
   *
   * @param calendar - Calendar schema
   * @param current - Current timestamp (may be null)
   * @returns Initialized timestamp
   */
  initializeTimestamp(
    calendar: CalendarSchema,
    current: CalendarTimestamp | null,
  ): CalendarTimestamp {
    if (current) {
      return current;
    }

    // Use calendar epoch as initial timestamp
    return createDayTimestamp(
      calendar.id,
      calendar.epoch.year,
      calendar.epoch.monthId,
      calendar.epoch.day,
    );
  }

  /**
   * Convert timestamp to YYYY-MM-DD date string
   *
   * @param calendar - Calendar schema
   * @param timestamp - Timestamp to convert
   * @returns ISO date string
   */
  timestampToDateString(calendar: CalendarSchema, timestamp: CalendarTimestamp): string {
    const year = String(timestamp.year).padStart(4, "0");

    // Get month number (1-based)
    const monthIndex = calendar.months.findIndex(m => m.id === timestamp.monthId);
    const month = monthIndex >= 0 ? String(monthIndex + 1).padStart(2, "0") : "01";

    const day = String(timestamp.day).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Convert timestamp to day of year (1-365)
   *
   * @param calendar - Calendar schema
   * @param timestamp - Timestamp to convert
   * @returns Day of year
   */
  timestampToDayOfYear(calendar: CalendarSchema, timestamp: CalendarTimestamp): number {
    const monthIndex = calendar.months.findIndex(m => m.id === timestamp.monthId);
    if (monthIndex < 0) {
      // Fallback: assume January
      return Math.max(1, Math.min(365, timestamp.day));
    }

    // Sum days from all previous months
    let dayOfYear = timestamp.day;
    for (let i = 0; i < monthIndex; i++) {
      dayOfYear += calendar.months[i].length;
    }

    // Clamp to 1-365 range (for calendars with >365 days)
    return Math.max(1, Math.min(365, dayOfYear));
  }

  // Private helper methods

  private getDayOfYear(calendar: CalendarSchema, timestamp: CalendarTimestamp): number {
    const monthIndex = calendar.months.findIndex(m => m.id === timestamp.monthId);
    if (monthIndex === -1) {
      return timestamp.day;
    }

    let days = timestamp.day;
    for (let i = 0; i < monthIndex; i++) {
      days += calendar.months[i].length;
    }
    return days;
  }

  private getTotalDaysInYear(calendar: CalendarSchema): number {
    return calendar.months.reduce((sum, month) => sum + month.length, 0);
  }
}
