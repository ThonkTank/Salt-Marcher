// src/apps/almanac/domain/__tests__/calendar-timestamp.test.ts
// Ensures calendar timestamp helpers respect schema month ordering.

import { describe, it, expect } from 'vitest';
import type { CalendarSchema } from '../calendar-schema';
import { createDayTimestamp, compareTimestampsWithSchema } from '../calendar-timestamp';

const testSchema: CalendarSchema = {
  id: 'test-cal',
  name: 'Test Calendar',
  daysPerWeek: 7,
  months: [
    { id: 'jan', name: 'January', length: 31 },
    { id: 'feb', name: 'February', length: 28 },
    { id: 'mar', name: 'March', length: 31 },
    { id: 'apr', name: 'April', length: 30 },
  ],
  epoch: { year: 1, monthId: 'jan', day: 1 },
  schemaVersion: '1.0.0',
};

describe('compareTimestampsWithSchema', () => {
  it('should order months correctly by schema index, not alphabetically', () => {
    // Create timestamps - alphabetically "apr" < "feb" < "jan" < "mar"
    // But schema order is: jan (0), feb (1), mar (2), apr (3)
    const jan15 = createDayTimestamp('test-cal', 2024, 'jan', 15);
    const feb14 = createDayTimestamp('test-cal', 2024, 'feb', 14);
    const mar20 = createDayTimestamp('test-cal', 2024, 'mar', 20);
    const apr10 = createDayTimestamp('test-cal', 2024, 'apr', 10);

    // January should come before February
    expect(compareTimestampsWithSchema(testSchema, jan15, feb14)).toBeLessThan(0);

    // February should come before March
    expect(compareTimestampsWithSchema(testSchema, feb14, mar20)).toBeLessThan(0);

    // March should come before April
    expect(compareTimestampsWithSchema(testSchema, mar20, apr10)).toBeLessThan(0);

    // April should come after January
    expect(compareTimestampsWithSchema(testSchema, apr10, jan15)).toBeGreaterThan(0);
  });

  it('should sort events correctly across months', () => {
    const events = [
      createDayTimestamp('test-cal', 2024, 'mar', 20),
      createDayTimestamp('test-cal', 2024, 'jan', 1),
      createDayTimestamp('test-cal', 2024, 'feb', 14),
      createDayTimestamp('test-cal', 2024, 'apr', 30),
      createDayTimestamp('test-cal', 2024, 'jan', 15),
    ];

    const sorted = events.sort((a, b) => compareTimestampsWithSchema(testSchema, a, b));

    // Should be ordered: jan 1, jan 15, feb 14, mar 20, apr 30
    expect(sorted[0].monthId).toBe('jan');
    expect(sorted[0].day).toBe(1);

    expect(sorted[1].monthId).toBe('jan');
    expect(sorted[1].day).toBe(15);

    expect(sorted[2].monthId).toBe('feb');
    expect(sorted[2].day).toBe(14);

    expect(sorted[3].monthId).toBe('mar');
    expect(sorted[3].day).toBe(20);

    expect(sorted[4].monthId).toBe('apr');
    expect(sorted[4].day).toBe(30);
  });

  it('should handle same day across different months', () => {
    const jan10 = createDayTimestamp('test-cal', 2024, 'jan', 10);
    const feb10 = createDayTimestamp('test-cal', 2024, 'feb', 10);

    expect(compareTimestampsWithSchema(testSchema, jan10, feb10)).toBeLessThan(0);
    expect(compareTimestampsWithSchema(testSchema, feb10, jan10)).toBeGreaterThan(0);
  });

  it('should handle upcoming events filtering correctly', () => {
    const current = createDayTimestamp('test-cal', 2024, 'jan', 15);

    const events = [
      createDayTimestamp('test-cal', 2024, 'jan', 1),   // Past
      createDayTimestamp('test-cal', 2024, 'jan', 20),  // Future
      createDayTimestamp('test-cal', 2024, 'feb', 14),  // Future
      createDayTimestamp('test-cal', 2024, 'mar', 31),  // Future
    ];

    const upcoming = events
      .filter(e => compareTimestampsWithSchema(testSchema, e, current) >= 0)
      .sort((a, b) => compareTimestampsWithSchema(testSchema, a, b));

    // Should get jan 20, feb 14, mar 31 (in that order)
    expect(upcoming).toHaveLength(3);
    expect(upcoming[0].monthId).toBe('jan');
    expect(upcoming[0].day).toBe(20);

    expect(upcoming[1].monthId).toBe('feb');
    expect(upcoming[1].day).toBe(14);

    expect(upcoming[2].monthId).toBe('mar');
    expect(upcoming[2].day).toBe(31);
  });
});
