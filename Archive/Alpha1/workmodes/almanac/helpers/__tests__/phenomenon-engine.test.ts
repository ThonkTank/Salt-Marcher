// src/workmodes/almanac/domain/__tests__/phenomenon-engine.test.ts
// Validates phenomenon occurrence calculations for fixed and ranged rules.

import { describe, it, expect } from 'vitest';
import {
  computeNextPhenomenonOccurrence,
  computePhenomenonOccurrencesInRange,
  createDayTimestamp,
  type CalendarSchema,
  type Phenomenon,
} from '..';

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
  durationMinutes: 90,
  hooks: [{ id: 'hook-aurora', type: 'script', config: { action: 'notify' }, priority: 2 }],
  priority: 4,
  schemaVersion: '1.0.0',
};

const offsetPhenomenon: Phenomenon = {
  id: 'phen-offset',
  name: 'Deep Tide',
  category: 'tide',
  visibility: 'selected',
  appliesToCalendarIds: ['simple'],
  rule: { type: 'monthly_position', monthId: 'jan', day: 16 },
  timePolicy: 'offset',
  offsetMinutes: 45,
  durationMinutes: 30,
  priority: 2,
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
    expect(next?.durationMinutes).toBe(90);
    expect(next?.endTimestamp.hour).toBe(0);
    expect(next?.hooks[0].id).toBe('hook-aurora');
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
    expect(occurrences[0].durationMinutes).toBe(90);
  });

  it('applies offset policy using minute arithmetic', () => {
    const start = createDayTimestamp('simple', 2, 'jan', 14);

    const next = computeNextPhenomenonOccurrence(offsetPhenomenon, schema, 'simple', start);

    expect(next).not.toBeNull();
    expect(next?.timestamp.hour).toBe(0);
    expect(next?.timestamp.minute).toBe(45);
    expect(next?.durationMinutes).toBe(30);
    expect(next?.endTimestamp.minute).toBe(15);
  });
});
