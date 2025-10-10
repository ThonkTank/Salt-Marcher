// src/apps/almanac/domain/__tests__/recurring-event.test.ts
// Verifies recurring event helpers including astronomical delegates.

import { describe, it, expect } from 'vitest';

import {
  computeEventOccurrencesInRange,
  computeNextEventOccurrence,
  createDayTimestamp,
  type AstronomicalEventCalculator,
  type CalendarEvent,
  type CalendarSchema,
} from '..';

const schema: CalendarSchema = {
  id: 'lunar',
  name: 'Lunar Cycle',
  daysPerWeek: 5,
  hoursPerDay: 20,
  minutesPerHour: 60,
  minuteStep: 10,
  months: [
    { id: 'phase-a', name: 'Phase A', length: 20 },
    { id: 'phase-b', name: 'Phase B', length: 20 },
  ],
  epoch: { year: 1, monthId: 'phase-a', day: 1 },
  schemaVersion: '1.0.0',
};

const recurringEvent: CalendarEvent = {
  kind: 'recurring',
  id: 'evt-recurring',
  calendarId: 'lunar',
  title: 'Council Assembly',
  description: 'Recurring council every 5th day',
  date: createDayTimestamp('lunar', 3, 'phase-a', 5),
  allDay: false,
  rule: { type: 'weekly_dayIndex', dayIndex: 2 },
  timePolicy: 'fixed',
  startTime: { hour: 10, minute: 0 },
  durationMinutes: 120,
  bounds: {
    start: createDayTimestamp('lunar', 3, 'phase-a', 1),
    end: createDayTimestamp('lunar', 3, 'phase-b', 10),
  },
};

const astronomicalEvent: CalendarEvent = {
  kind: 'recurring',
  id: 'evt-eclipse',
  calendarId: 'lunar',
  title: 'Solar Eclipse',
  description: 'Occurs when orbit aligns',
  date: createDayTimestamp('lunar', 3, 'phase-a', 10),
  allDay: false,
  rule: { type: 'astronomical', source: 'eclipse' },
  timePolicy: 'offset',
  offsetMinutes: 30,
  durationMinutes: 60,
  bounds: {
    start: createDayTimestamp('lunar', 3, 'phase-a', 8),
    end: createDayTimestamp('lunar', 3, 'phase-b', 10),
  },
};

describe('calendar-event recurring helpers', () => {
  it('computes the next recurring occurrence with bounds and duration', () => {
    const start = createDayTimestamp('lunar', 3, 'phase-a', 1);

    const occurrence = computeNextEventOccurrence(recurringEvent, schema, 'lunar', start);

    expect(occurrence).not.toBeNull();
    expect(occurrence?.start.hour).toBe(10);
    expect(occurrence?.durationMinutes).toBe(120);
    expect(occurrence?.end.hour).toBe(12);
  });

  it('generates occurrences within the configured range', () => {
    const start = createDayTimestamp('lunar', 3, 'phase-a', 1);
    const end = createDayTimestamp('lunar', 3, 'phase-b', 1);

    const occurrences = computeEventOccurrencesInRange(recurringEvent, schema, 'lunar', start, end, {
      includeStart: true,
      limit: 4,
    });

    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences[0].start.hour).toBe(10);
    expect(occurrences[0].calendarId).toBe('lunar');
  });

  it('delegates astronomical rules through the calculator service', () => {
    const calculator: AstronomicalEventCalculator = {
      resolveNextOccurrence: (_, calendarId, __, base) =>
        createDayTimestamp(calendarId, base.year, 'phase-b', 4),
      resolveOccurrencesInRange: (_, calendarId) => [
        createDayTimestamp(calendarId, 3, 'phase-b', 4),
        createDayTimestamp(calendarId, 3, 'phase-b', 8),
      ],
    };

    const next = computeNextEventOccurrence(astronomicalEvent, schema, 'lunar', astronomicalEvent.bounds!.start!, {
      services: { astronomicalCalculator: calculator },
    });

    expect(next?.start.monthId).toBe('phase-b');
    expect(next?.start.minute).toBe(30);

    const range = computeEventOccurrencesInRange(
      astronomicalEvent,
      schema,
      'lunar',
      astronomicalEvent.bounds!.start!,
      astronomicalEvent.bounds!.end!,
      { services: { astronomicalCalculator: calculator } },
    );

    expect(range).toHaveLength(2);
    expect(range[1].start.monthId).toBe('phase-b');
  });
});
