/**
 * Time utility functions for formatting and feature-specific operations.
 *
 * Core time math functions are in @core/utils/time-math.ts.
 * This file provides re-exports for backwards compatibility
 * and formatting functions that belong in the feature layer.
 *
 * @see docs/features/Time-System.md
 */

import type { GameDateTime, CalendarDefinition } from '@core/schemas';

// ============================================================================
// Re-exports from @core/utils/time-math (backwards compatibility)
// ============================================================================

export {
  getTimeSegment,
  getTimeOfDay,
  addDuration,
  diffInHours,
  getCurrentSeason,
  getMoonPhase,
} from '@core/utils/time-math';

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a game datetime as a human-readable string.
 */
export function formatGameDateTime(
  time: GameDateTime,
  calendar: CalendarDefinition
): string {
  const monthName = calendar.months[time.month - 1]?.name ?? `Month ${time.month}`;
  const hourStr = time.hour.toString().padStart(2, '0');
  const minuteStr = time.minute.toString().padStart(2, '0');

  return `${time.day}. ${monthName} ${time.year}, ${hourStr}:${minuteStr}`;
}

/**
 * Format time only (hour:minute).
 */
export function formatTime(time: GameDateTime): string {
  const hourStr = time.hour.toString().padStart(2, '0');
  const minuteStr = time.minute.toString().padStart(2, '0');
  return `${hourStr}:${minuteStr}`;
}

/**
 * Format date only (day. month year).
 */
export function formatDate(
  time: GameDateTime,
  calendar: CalendarDefinition
): string {
  const monthName = calendar.months[time.month - 1]?.name ?? `Month ${time.month}`;
  return `${time.day}. ${monthName} ${time.year}`;
}
