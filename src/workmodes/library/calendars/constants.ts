// src/workmodes/library/calendars/constants.ts
// Constants and preset values for calendar creation UI

export const DEFAULT_HOURS_PER_DAY = 24;
export const DEFAULT_MINUTES_PER_HOUR = 60;
export const DEFAULT_SECONDS_PER_MINUTE = 60;
export const DEFAULT_MINUTE_STEP = 15;
export const DEFAULT_DAYS_PER_WEEK = 7;
export const DEFAULT_SCHEMA_VERSION = "1.0.0";

export const TIME_PRESETS = [
  { value: 24, label: "24 hours (Earth standard)" },
  { value: 20, label: "20 hours" },
  { value: 12, label: "12 hours" },
  { value: 10, label: "10 hours" },
] as const;

export const WEEK_LENGTH_PRESETS = [
  { value: 7, label: "7 days (Earth standard)" },
  { value: 5, label: "5 days" },
  { value: 10, label: "10 days" },
  { value: 8, label: "8 days" },
] as const;
