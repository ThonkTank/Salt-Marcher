// src/workmodes/almanac/domain/__tests__/conflict-resolution.test.ts
// Ensures conflict detection groups overlapping occurrences and resolves by priority.

import { describe, it, expect } from 'vitest';
import {
  advanceTime,
  createMinuteTimestamp,
  createSingleEvent,
  detectTemporalConflicts,
  fromEventOccurrence,
  fromPhenomenonOccurrence,
  resolveConflictsByPriority,
  type CalendarEventOccurrence,
  type CalendarSchema,
  type PhenomenonOccurrence,
} from '..';

const schema: CalendarSchema = {
  id: 'conflict',
  name: 'Conflict Calendar',
  daysPerWeek: 7,
  hoursPerDay: 24,
  minutesPerHour: 60,
  minuteStep: 15,
  months: [
    { id: 'jan', name: 'January', length: 30 },
  ],
  epoch: { year: 1, monthId: 'jan', day: 1 },
  schemaVersion: '1.0.0',
};

describe('conflict-resolution', () => {
  it('groups overlapping occurrences and resolves by priority', () => {
    const baseEvent = createSingleEvent(
      'evt-1',
      'conflict',
      'Heroic Duel',
      createMinuteTimestamp('conflict', 5, 'jan', 12, 9, 0),
      {
        allDay: false,
        category: 'combat',
        hooks: [{ id: 'hook-event', type: 'script', config: { notify: true }, priority: 1 }],
        durationMinutes: 60,
      },
    );

    const eventOccurrence: CalendarEventOccurrence = {
      eventId: baseEvent.id,
      calendarId: baseEvent.calendarId,
      eventType: 'single',
      title: baseEvent.title,
      category: baseEvent.category,
      start: baseEvent.date,
      end: advanceTime(schema, baseEvent.date, 60, 'minute').timestamp,
      durationMinutes: 60,
      allDay: false,
      priority: 2,
      hooks: baseEvent.hooks ?? [],
      source: baseEvent,
    };

    const rivalEvent = createSingleEvent(
      'evt-2',
      'conflict',
      'Rival Duel',
      createMinuteTimestamp('conflict', 5, 'jan', 12, 9, 30),
      { allDay: false, durationMinutes: 30, priority: 1 },
    );

    const rivalOccurrence: CalendarEventOccurrence = {
      eventId: rivalEvent.id,
      calendarId: rivalEvent.calendarId,
      eventType: 'single',
      title: rivalEvent.title,
      category: rivalEvent.category,
      start: rivalEvent.date,
      end: advanceTime(schema, rivalEvent.date, 30, 'minute').timestamp,
      durationMinutes: 30,
      allDay: false,
      priority: 1,
      hooks: rivalEvent.hooks ?? [],
      source: rivalEvent,
    };

    const phenomenonOccurrence: PhenomenonOccurrence = {
      phenomenonId: 'phen-storm',
      name: 'Storm Surge',
      calendarId: 'conflict',
      timestamp: createMinuteTimestamp('conflict', 5, 'jan', 12, 8, 45),
      endTimestamp: advanceTime(schema, createMinuteTimestamp('conflict', 5, 'jan', 12, 8, 45), 120, 'minute').timestamp,
      category: 'weather',
      priority: 4,
      durationMinutes: 120,
      hooks: [
        { id: 'hook-weather-high', type: 'webhook', config: { severity: 'high' }, priority: 5 },
        { id: 'hook-weather-low', type: 'webhook', config: { severity: 'low' }, priority: 1 },
      ],
      effects: [{ type: 'weather', payload: { severity: 'severe' } }],
    };

    const temporal = [
      fromEventOccurrence(eventOccurrence),
      fromEventOccurrence(rivalOccurrence),
      fromPhenomenonOccurrence(phenomenonOccurrence),
    ];

    const groups = detectTemporalConflicts(schema, temporal);
    expect(groups).toHaveLength(1);
    expect(groups[0].occurrences).toHaveLength(3);

    const resolutions = resolveConflictsByPriority(groups);
    expect(resolutions).toHaveLength(1);
    const [resolution] = resolutions;
    expect(resolution.active.sourceType).toBe('phenomenon');
    expect(resolution.suppressed).toHaveLength(2);
    expect(resolution.triggeredHooks.map(hook => hook.id)).toEqual(['hook-weather-high', 'hook-weather-low']);
    expect(resolution.triggeredEffects[0].payload).toEqual({ severity: 'severe' });
  });
});
