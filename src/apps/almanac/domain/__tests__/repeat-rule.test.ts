// src/apps/almanac/domain/__tests__/repeat-rule.test.ts
// Covers annual, monthly and weekly recurrence helpers.

import { describe, it, expect } from 'vitest';

import {
  calculateNextOccurrence,
  calculateOccurrencesInRange,
  createDayTimestamp,
  type AstronomicalEventCalculator,
  type CalendarSchema,
} from '..';

const simpleSchema: CalendarSchema = {
  id: 'simple',
  name: 'Simple Calendar',
  daysPerWeek: 6,
  hoursPerDay: 18,
  minutesPerHour: 60,
  minuteStep: 10,
  months: [
    { id: 'alpha', name: 'Alpha', length: 20 },
    { id: 'beta', name: 'Beta', length: 20 },
    { id: 'gamma', name: 'Gamma', length: 20 },
  ],
  epoch: { year: 1, monthId: 'alpha', day: 1 },
  schemaVersion: '1.0.0',
};

describe('repeat-rule.calculateNextOccurrence', () => {
  it('handles annual offsets and respects includeStart', () => {
    const start = createDayTimestamp('simple', 5, 'alpha', 1);

    const sameDay = calculateNextOccurrence(
      simpleSchema,
      'simple',
      { type: 'annual_offset', offsetDayOfYear: 1 },
      start,
      { includeStart: true },
    );
    expect(sameDay).not.toBeNull();
    expect(sameDay?.year).toBe(5);

    const nextYear = calculateNextOccurrence(
      simpleSchema,
      'simple',
      { type: 'annual_offset', offsetDayOfYear: 1 },
      start,
      { includeStart: false },
    );
    expect(nextYear).not.toBeNull();
    expect(nextYear?.year).toBe(6);
  });

  it('wraps annual offsets exceeding the schema length', () => {
    const start = createDayTimestamp('simple', 2, 'alpha', 5);

    const occurrence = calculateNextOccurrence(
      simpleSchema,
      'simple',
      { type: 'annual_offset', offsetDayOfYear: 250 },
      start,
      { includeStart: false },
    );

    expect(occurrence).not.toBeNull();
    expect(occurrence?.monthId).toBe('alpha');
    expect(occurrence?.day).toBe(10);
  });

  it('clamps monthly position days to the month length', () => {
    const start = createDayTimestamp('simple', 10, 'alpha', 1);

    const occurrence = calculateNextOccurrence(
      simpleSchema,
      'simple',
      { type: 'monthly_position', monthId: 'alpha', day: 99 },
      start,
    );

    expect(occurrence).not.toBeNull();
    expect(occurrence?.monthId).toBe('alpha');
    expect(occurrence?.day).toBe(20);
  });

  it('advances weekly rules respecting custom week length', () => {
    const start = createDayTimestamp('simple', 1, 'alpha', 2); // absolute day index 1

    const occurrence = calculateNextOccurrence(
      simpleSchema,
      'simple',
      { type: 'weekly_dayIndex', dayIndex: 4 },
      start,
      { includeStart: false },
    );

    expect(occurrence).not.toBeNull();
    expect(occurrence?.monthId).toBe('alpha');
    expect(occurrence?.day).toBe(5);
  });
});

describe('repeat-rule.calculateOccurrencesInRange', () => {
  it('produces sequential annual occurrences across years', () => {
    const start = createDayTimestamp('simple', 1, 'alpha', 1);
    const end = createDayTimestamp('simple', 4, 'beta', 5);

    const occurrences = calculateOccurrencesInRange(
      simpleSchema,
      'simple',
      { type: 'annual_offset', offsetDayOfYear: 70 },
      start,
      end,
      { includeStart: true, limit: 5 },
    );

    expect(occurrences).toHaveLength(4);
    expect(occurrences[0].monthId).toBe('alpha');
    expect(occurrences[0].day).toBe(10);
    expect(occurrences[3].monthId).toBe('alpha');
    expect(occurrences[3].day).toBe(10);
  });
});

describe('repeat-rule astronomical support', () => {
  it('delegates astronomical occurrences to the provided calculator', () => {
    const start = createDayTimestamp('simple', 3, 'beta', 5);
    const calculator: AstronomicalEventCalculator = {
      resolveNextOccurrence: (_, calendarId, __, current) =>
        createDayTimestamp(calendarId, current.year, 'gamma', 10),
      resolveOccurrencesInRange: (_, calendarId) => [
        createDayTimestamp(calendarId, 3, 'gamma', 10),
        createDayTimestamp(calendarId, 3, 'gamma', 15),
      ],
    };

    const next = calculateNextOccurrence(
      simpleSchema,
      'simple',
      { type: 'astronomical', source: 'sunrise', offsetMinutes: 30 },
      start,
      { includeStart: true },
      { astronomicalCalculator: calculator },
    );

    expect(next?.monthId).toBe('gamma');
    expect(next?.day).toBe(10);

    const range = calculateOccurrencesInRange(
      simpleSchema,
      'simple',
      { type: 'astronomical', source: 'sunset' },
      createDayTimestamp('simple', 3, 'beta', 1),
      createDayTimestamp('simple', 3, 'gamma', 20),
      { limit: 5 },
      { astronomicalCalculator: calculator },
    );

    expect(range).toHaveLength(2);
    expect(range[1].day).toBe(15);
  });
});
