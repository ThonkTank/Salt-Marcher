// src/apps/almanac/fixtures/gregorian.fixture.ts
// Provides the baseline Gregorian calendar schema and sample events for tests.

/**
 * Gregorian Calendar Fixture
 *
 * Standard 12-month calendar with 24-hour days for testing.
 */

import type { CalendarSchema } from '../domain/calendar-core';
import { createDayTimestamp, createHourTimestamp, createMinuteTimestamp } from '../domain/calendar-core';
import type { CalendarEvent } from '../domain/scheduling';
import { createSingleEvent } from '../domain/scheduling';

export const GREGORIAN_CALENDAR_ID = 'gregorian-standard';

/**
 * Standard Gregorian calendar schema
 */
export const gregorianSchema: CalendarSchema = {
  id: GREGORIAN_CALENDAR_ID,
  name: 'Gregorian Calendar',
  description: 'Standard Earth calendar with 12 months (24-hour days)',
  daysPerWeek: 7,
  hoursPerDay: 24,
  minutesPerHour: 60,
  secondsPerMinute: 60,
  minuteStep: 15,
  months: [
    { id: 'jan', name: 'January', length: 31 },
    { id: 'feb', name: 'February', length: 28 }, // Simplified: no leap years for MVP
    { id: 'mar', name: 'March', length: 31 },
    { id: 'apr', name: 'April', length: 30 },
    { id: 'may', name: 'May', length: 31 },
    { id: 'jun', name: 'June', length: 30 },
    { id: 'jul', name: 'July', length: 31 },
    { id: 'aug', name: 'August', length: 31 },
    { id: 'sep', name: 'September', length: 30 },
    { id: 'oct', name: 'October', length: 31 },
    { id: 'nov', name: 'November', length: 30 },
    { id: 'dec', name: 'December', length: 31 },
  ],
  epoch: {
    year: 2024,
    monthId: 'jan',
    day: 1,
  },
  schemaVersion: '1.0.0',
};

/**
 * Sample events for testing
 */
export function createSampleEvents(year: number = 2024): CalendarEvent[] {
  return [
    createSingleEvent(
      'evt-1',
      GREGORIAN_CALENDAR_ID,
      'New Year\'s Day',
      createDayTimestamp(GREGORIAN_CALENDAR_ID, year, 'jan', 1),
      {
        description: 'Start of the new year',
        allDay: true,
        category: 'holiday',
        tags: ['holiday', 'celebration'],
      }
    ),
    createSingleEvent(
      'evt-2',
      GREGORIAN_CALENDAR_ID,
      'Team Meeting',
      createHourTimestamp(GREGORIAN_CALENDAR_ID, year, 'jan', 15, 10),
      {
        description: 'Weekly team sync',
        allDay: false,
        category: 'work',
        tags: ['meeting'],
      }
    ),
    createSingleEvent(
      'evt-3',
      GREGORIAN_CALENDAR_ID,
      'Valentine\'s Day',
      createDayTimestamp(GREGORIAN_CALENDAR_ID, year, 'feb', 14),
      {
        description: 'Day of love',
        allDay: true,
        category: 'holiday',
        tags: ['holiday'],
      }
    ),
    createSingleEvent(
      'evt-4',
      GREGORIAN_CALENDAR_ID,
      'Spring Equinox',
      createDayTimestamp(GREGORIAN_CALENDAR_ID, year, 'mar', 20),
      {
        description: 'First day of spring',
        allDay: true,
        category: 'season',
        tags: ['season', 'astronomy'],
      }
    ),
    createSingleEvent(
      'evt-5',
      GREGORIAN_CALENDAR_ID,
      'Project Deadline',
      createHourTimestamp(GREGORIAN_CALENDAR_ID, year, 'mar', 31, 17),
      {
        description: 'Q1 project deliverable',
        allDay: false,
        category: 'work',
        tags: ['deadline', 'important'],
      }
    ),
    createSingleEvent(
      'evt-6',
      GREGORIAN_CALENDAR_ID,
      'Daily Standup',
      createMinuteTimestamp(GREGORIAN_CALENDAR_ID, year, 'jan', 2, 9, 30),
      {
        description: 'Daily team standup meeting',
        allDay: false,
        category: 'work',
        tags: ['meeting', 'daily'],
      }
    ),
  ];
}

/**
 * Get a default "current" timestamp for testing
 */
export function getDefaultCurrentTimestamp(year: number = 2024) {
  return createMinuteTimestamp(GREGORIAN_CALENDAR_ID, year, 'jan', 1, 0, 0);
}
