// src/workmodes/library/calendars/create-spec.ts
// Declarative field specification for calendar creation using the global modal system

import {
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_MINUTES_PER_HOUR,
  DEFAULT_SECONDS_PER_MINUTE,
  DEFAULT_MINUTE_STEP,
  DEFAULT_DAYS_PER_WEEK,
} from "./constants";
// Removed: import { calendarToMarkdown } from "./serializer";
import type { CalendarData } from './calendar-types';
import type { CreateSpec, AnyFieldSpec, DataSchema } from "@features/data-manager/data-manager-types";

// ============================================================================
// SCHEMA WITH VALIDATION
// ============================================================================

const calendarSchema: DataSchema<CalendarData> = {
  parse: (data: unknown) => data as CalendarData,
  safeParse: (data: unknown) => {
    try {
      const calendar = data as CalendarData;

      // Validate required fields
      if (!calendar.name || typeof calendar.name !== "string") {
        return {
          success: false,
          error: new Error("Calendar name is required")
        };
      }

      if (!calendar.id || typeof calendar.id !== "string") {
        return {
          success: false,
          error: new Error("Calendar ID is required")
        };
      }

      if (!calendar.months || !Array.isArray(calendar.months) || calendar.months.length === 0) {
        return {
          success: false,
          error: new Error("Calendar must have at least one month")
        };
      }

      // Validate months
      for (const month of calendar.months) {
        if (!month.id || !month.name || typeof month.length !== "number") {
          return {
            success: false,
            error: new Error("Each month must have id, name, and length")
          };
        }
        if (month.length < 1 || month.length > 100) {
          return {
            success: false,
            error: new Error(`Month "${month.name}" length must be between 1 and 100 days`)
          };
        }
      }

      // Validate epoch
      if (!calendar.epoch || typeof calendar.epoch.year !== "number") {
        return {
          success: false,
          error: new Error("Epoch year is required")
        };
      }

      return { success: true, data: calendar };
    } catch (error) {
      return { success: false, error };
    }
  },
};

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

const fields: AnyFieldSpec[] = [
  {
    id: "name",
    label: "Calendar Name",
    type: "text",
    required: true,
    placeholder: "Gregorian Calendar",
    description: "Display name for the calendar",
  },
  {
    id: "id",
    label: "Calendar ID",
    type: "text",
    required: true,
    placeholder: "gregorian-standard",
    description: "Unique identifier (lowercase, hyphens allowed)",
  },
  {
    id: "description",
    label: "Description",
    type: "textarea",
    placeholder: "A calendar system for...",
    description: "Optional description of the calendar system",
  },
  {
    id: "daysPerWeek",
    label: "Days per Week",
    type: "number",
    min: 1,
    max: 30,
    default: DEFAULT_DAYS_PER_WEEK,
    description: "Number of days in a week",
  },
  {
    id: "hoursPerDay",
    label: "Hours per Day",
    type: "number",
    min: 1,
    max: 100,
    default: DEFAULT_HOURS_PER_DAY,
    description: "Number of hours in a day",
  },
  {
    id: "minutesPerHour",
    label: "Minutes per Hour",
    type: "number",
    min: 1,
    max: 100,
    default: DEFAULT_MINUTES_PER_HOUR,
    description: "Number of minutes in an hour",
  },
  {
    id: "secondsPerMinute",
    label: "Seconds per Minute",
    type: "number",
    min: 1,
    max: 100,
    default: DEFAULT_SECONDS_PER_MINUTE,
    description: "Number of seconds in a minute",
  },
  {
    id: "minuteStep",
    label: "Minute Step",
    type: "number",
    min: 1,
    max: 60,
    default: DEFAULT_MINUTE_STEP,
    description: "Step size for minute selection (e.g., 15 = 00, 15, 30, 45)",
  },
];

// ============================================================================
// SPEC
// ============================================================================

export const calendarSpec: CreateSpec<CalendarData> = {
  kind: "calendar",
  title: "Calendar erstellen",
  subtitle: "Neues Kalendersystem für deine Welt",
  schema: calendarSchema,
  fields,
  storage: {
    format: "md-frontmatter",
    pathTemplate: "SaltMarcher/Calendars/{name}.md",
    filenameFrom: "name",
    directory: "SaltMarcher/Calendars",
    frontmatter: [
      "name",
      "id",
      "description",
      "daysPerWeek",
      "months",
      "hoursPerDay",
      "minutesPerHour",
      "secondsPerMinute",
      "minuteStep",
      "epoch",
      "schemaVersion"
    ],
    // SQLite backend - removed:     bodyTemplate: (data) => calendarToMarkdown(data as CalendarData),
  },
  ui: {
    submitLabel: "Calendar erstellen",
    cancelLabel: "Abbrechen",
    enableNavigation: false,
  },
  // Browse configuration
  browse: {
    metadata: [
      {
        id: "daysPerWeek",
        cls: "sm-cc-item__type",
        getValue: (entry) => `${entry.daysPerWeek}-day week`,
      },
      {
        id: "months",
        cls: "sm-cc-item__cr",
        getValue: (entry) => `${entry.monthCount || 0} months`,
      },
    ],
    filters: [
      { id: "daysPerWeek", field: "daysPerWeek", label: "Days per Week", type: "number" },
    ],
    sorts: [
      { id: "name", label: "Name", field: "name" },
      { id: "daysPerWeek", label: "Days per Week", field: "daysPerWeek" },
    ],
    search: ["name", "id", "description"],
  },
  loader: {},
};
