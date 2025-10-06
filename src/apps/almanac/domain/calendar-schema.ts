/**
 * Calendar Schema Definition
 *
 * Represents the structure of a custom calendar system with configurable
 * months, week lengths, and time units (hours per day).
 */

export interface CalendarMonth {
  readonly id: string;
  readonly name: string;
  readonly length: number; // days in this month
}

export interface CalendarSchema {
  readonly id: string;
  readonly name: string;
  readonly description?: string;

  // Calendar structure
  readonly daysPerWeek: number;
  readonly hoursPerDay: number;
  readonly months: ReadonlyArray<CalendarMonth>;

  // Starting point (epoch)
  readonly epoch: {
    readonly year: number;
    readonly monthId: string;
    readonly day: number;
  };

  readonly schemaVersion: string;
}

/**
 * Helper: Get total days in a year for the given schema
 */
export function getTotalDaysInYear(schema: CalendarSchema): number {
  return schema.months.reduce((sum, month) => sum + month.length, 0);
}

/**
 * Helper: Get month by ID
 */
export function getMonthById(schema: CalendarSchema, monthId: string): CalendarMonth | null {
  return schema.months.find(m => m.id === monthId) ?? null;
}

/**
 * Helper: Get month index (0-based)
 */
export function getMonthIndex(schema: CalendarSchema, monthId: string): number {
  return schema.months.findIndex(m => m.id === monthId);
}

/**
 * Helper: Get month by index
 */
export function getMonthByIndex(schema: CalendarSchema, index: number): CalendarMonth | null {
  if (index < 0 || index >= schema.months.length) {
    return null;
  }
  return schema.months[index];
}
