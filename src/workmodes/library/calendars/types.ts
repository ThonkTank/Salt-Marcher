// src/workmodes/library/calendars/types.ts
// Type definitions for calendar entities

export interface CalendarMonth {
  id: string;
  name: string;
  length: number;
}

export interface CalendarEpoch {
  year: number;
  monthId: string;
  day: number;
}

export interface CalendarData {
  name: string;
  id: string;
  description?: string;
  daysPerWeek: number;
  months: CalendarMonth[];
  hoursPerDay?: number;
  minutesPerHour?: number;
  secondsPerMinute?: number;
  minuteStep?: number;
  epoch: CalendarEpoch;
  schemaVersion: string;
}
