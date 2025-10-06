import { describe, it, expect } from 'vitest';
import type { CalendarSchema } from '../calendar-schema';
import { createDayTimestamp, createHourTimestamp, createMinuteTimestamp } from '../calendar-timestamp';
import { advanceTime } from '../time-arithmetic';

// Simple test schema: 2 months (30 days each), 7 days/week, 24 hours/day
const testSchema: CalendarSchema = {
  id: 'test-cal',
  name: 'Test Calendar',
  daysPerWeek: 7,
  hoursPerDay: 24,
  minutesPerHour: 60,
  months: [
    { id: 'month1', name: 'First', length: 30 },
    { id: 'month2', name: 'Second', length: 30 },
  ],
  epoch: { year: 1, monthId: 'month1', day: 1 },
  schemaVersion: '1.0.0',
};

describe('advanceTime - days', () => {
  it('should advance by days within a month', () => {
    const start = createDayTimestamp('test-cal', 100, 'month1', 10);
    const result = advanceTime(testSchema, start, 5, 'day');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(15);
    expect(result.normalized).toBe(false);
  });

  it('should advance across month boundary', () => {
    const start = createDayTimestamp('test-cal', 100, 'month1', 28);
    const result = advanceTime(testSchema, start, 5, 'day');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month2');
    expect(result.timestamp.day).toBe(3);
    expect(result.normalized).toBe(false);
  });

  it('should advance across year boundary', () => {
    const start = createDayTimestamp('test-cal', 100, 'month2', 28);
    const result = advanceTime(testSchema, start, 5, 'day');

    expect(result.timestamp.year).toBe(101);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(3);
    expect(result.normalized).toBe(true);
  });

  it('should go backward within a month', () => {
    const start = createDayTimestamp('test-cal', 100, 'month1', 15);
    const result = advanceTime(testSchema, start, -5, 'day');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(10);
    expect(result.normalized).toBe(false);
  });

  it('should go backward across month boundary', () => {
    const start = createDayTimestamp('test-cal', 100, 'month2', 3);
    const result = advanceTime(testSchema, start, -5, 'day');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(28);
    expect(result.normalized).toBe(false);
  });

  it('should go backward across year boundary', () => {
    const start = createDayTimestamp('test-cal', 101, 'month1', 3);
    const result = advanceTime(testSchema, start, -5, 'day');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month2');
    expect(result.timestamp.day).toBe(28);
    expect(result.normalized).toBe(true);
  });
});

describe('advanceTime - hours', () => {
  it('should advance by hours within a day', () => {
    const start = createHourTimestamp('test-cal', 100, 'month1', 10, 5);
    const result = advanceTime(testSchema, start, 3, 'hour');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(10);
    expect(result.timestamp.hour).toBe(8);
    expect(result.normalized).toBe(false);
  });

  it('should roll over to next day at 24 hours', () => {
    const start = createHourTimestamp('test-cal', 100, 'month1', 10, 20);
    const result = advanceTime(testSchema, start, 6, 'hour');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(11);
    expect(result.timestamp.hour).toBe(2);
    expect(result.normalized).toBe(true);
    expect(result.carriedDays).toBe(1);
  });

  it('should advance multiple days via hours', () => {
    const start = createHourTimestamp('test-cal', 100, 'month1', 10, 12);
    const result = advanceTime(testSchema, start, 48, 'hour'); // +2 days

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(12);
    expect(result.timestamp.hour).toBe(12);
    expect(result.normalized).toBe(true);
    expect(result.carriedDays).toBe(2);
  });

  it('should go backward by hours within a day', () => {
    const start = createHourTimestamp('test-cal', 100, 'month1', 10, 10);
    const result = advanceTime(testSchema, start, -5, 'hour');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(10);
    expect(result.timestamp.hour).toBe(5);
    expect(result.normalized).toBe(false);
  });

  it('should roll back to previous day', () => {
    const start = createHourTimestamp('test-cal', 100, 'month1', 10, 2);
    const result = advanceTime(testSchema, start, -5, 'hour');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(9);
    expect(result.timestamp.hour).toBe(21);
    expect(result.normalized).toBe(true);
    expect(result.carriedDays).toBe(-1);
  });

  it('should handle hour advance across month boundary', () => {
    const start = createHourTimestamp('test-cal', 100, 'month1', 30, 20);
    const result = advanceTime(testSchema, start, 6, 'hour');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month2');
    expect(result.timestamp.day).toBe(1);
    expect(result.timestamp.hour).toBe(2);
    expect(result.normalized).toBe(true);
  });

  it('should handle hour advance across year boundary', () => {
    const start = createHourTimestamp('test-cal', 100, 'month2', 30, 20);
    const result = advanceTime(testSchema, start, 6, 'hour');

    expect(result.timestamp.year).toBe(101);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(1);
    expect(result.timestamp.hour).toBe(2);
    expect(result.normalized).toBe(true);
  });
});

describe('advanceTime - edge cases', () => {
  it('should handle zero advancement', () => {
    const start = createDayTimestamp('test-cal', 100, 'month1', 10);
    const result = advanceTime(testSchema, start, 0, 'day');

    expect(result.timestamp).toEqual(start);
    expect(result.normalized).toBe(false);
  });

  it('should preserve hour when advancing days', () => {
    const start = createHourTimestamp('test-cal', 100, 'month1', 10, 15);
    const result = advanceTime(testSchema, start, 3, 'day');

    expect(result.timestamp.year).toBe(100);
    expect(result.timestamp.monthId).toBe('month1');
    expect(result.timestamp.day).toBe(13);
    expect(result.timestamp.hour).toBe(15);
    expect(result.timestamp.minute).toBe(0);
  });
});

describe('advanceTime - minutes', () => {
  it('should advance minutes within the same hour', () => {
    const start = createMinuteTimestamp('test-cal', 100, 'month1', 5, 10, 15);
    const result = advanceTime(testSchema, start, 20, 'minute');

    expect(result.timestamp.day).toBe(5);
    expect(result.timestamp.hour).toBe(10);
    expect(result.timestamp.minute).toBe(35);
    expect(result.normalized).toBe(false);
    expect(result.carriedMinutes).toBe(35);
  });

  it('should roll minutes into the next hour', () => {
    const start = createMinuteTimestamp('test-cal', 100, 'month1', 5, 10, 50);
    const result = advanceTime(testSchema, start, 20, 'minute');

    expect(result.timestamp.hour).toBe(11);
    expect(result.timestamp.minute).toBe(10);
    expect(result.carriedHours).toBe(1);
    expect(result.normalized).toBe(true);
  });

  it('should roll minutes across day boundary', () => {
    const start = createMinuteTimestamp('test-cal', 100, 'month1', 5, 23, 45);
    const result = advanceTime(testSchema, start, 30, 'minute');

    expect(result.timestamp.day).toBe(6);
    expect(result.timestamp.hour).toBe(0);
    expect(result.timestamp.minute).toBe(15);
    expect(result.carriedDays).toBe(1);
    expect(result.carriedHours).toBe(1);
    expect(result.carriedMinutes).toBe(15);
    expect(result.normalized).toBe(true);
  });

  it('should go backwards in minutes', () => {
    const start = createMinuteTimestamp('test-cal', 100, 'month1', 5, 0, 30);
    const result = advanceTime(testSchema, start, -45, 'minute');

    expect(result.timestamp.day).toBe(4);
    expect(result.timestamp.hour).toBe(23);
    expect(result.timestamp.minute).toBe(45);
    expect(result.carriedDays).toBe(-1);
    expect(result.carriedHours).toBe(-1);
    expect(result.carriedMinutes).toBe(45);
    expect(result.normalized).toBe(true);
  });
});
