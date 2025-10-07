// src/apps/almanac/domain/__tests__/phenomenon-engine.test.ts
// Validates phenomenon occurrence calculations for fixed and ranged rules.

import { describe, it, expect } from 'vitest';

import { computeNextPhenomenonOccurrence, computePhenomenonOccurrencesInRange } from '../phenomenon-engine';
import type { CalendarSchema } from '../calendar-schema';
import { createDayTimestamp } from '../calendar-timestamp';
import type { Phenomenon } from '../phenomenon';

const schema: CalendarSchema = {
  id: 'simple',
  name: 'Simple Calendar',
  daysPerWeek: 7,
  hoursPerDay: 24,
  minutesPerHour: 60,
  minuteStep: 15,
  months: [
    { id: 'jan', name: 'January', length: 30 },
    { id: 'feb', name: 'February', length: 30 },
  ],
  epoch: { year: 1, monthId: 'jan', day: 1 },
  schemaVersion: '1.0.0',
};

const phenomenon: Phenomenon = {
  id: 'phen-aurora',
  name: 'Aurora Event',
  category: 'astronomy',
  visibility: 'selected',
  appliesToCalendarIds: ['simple'],
  rule: { type: 'monthly_position', monthId: 'jan', day: 15 },
  timePolicy: 'fixed',
  startTime: { hour: 22, minute: 30 },
  priority: 4,
  schemaVersion: '1.0.0',
};

describe('phenomenon-engine', () => {
  it('computes next occurrence with minute precision', () => {
    const start = createDayTimestamp('simple', 3, 'jan', 10);

    const next = computeNextPhenomenonOccurrence(phenomenon, schema, 'simple', start);
    expect(next).not.toBeNull();
    expect(next?.timestamp.monthId).toBe('jan');
    expect(next?.timestamp.day).toBe(15);
    expect(next?.timestamp.hour).toBe(22);
    expect(next?.timestamp.minute).toBe(30);
  });

  it('collects range occurrences across years', () => {
    const start = createDayTimestamp('simple', 1, 'jan', 1);
    const end = createDayTimestamp('simple', 3, 'feb', 1);

    const occurrences = computePhenomenonOccurrencesInRange(
      phenomenon,
      schema,
      'simple',
      start,
      end,
      { includeStart: true, limit: 5 },
    );

    expect(occurrences).toHaveLength(3);
    expect(occurrences[0].timestamp.year).toBe(1);
    expect(occurrences[1].timestamp.year).toBe(2);
    expect(occurrences[2].timestamp.year).toBe(3);
  });
});
