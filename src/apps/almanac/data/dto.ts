// src/apps/almanac/data/dto.ts
// Shared DTO definitions bridging Almanac domain models with persistence contracts.

import type {
  CalendarEvent,
  CalendarSchema,
  CalendarTimestamp,
  HookDescriptor,
  Phenomenon,
} from "../domain";

export type CalendarSchemaDTO = CalendarSchema & {
  readonly description?: string;
  readonly leapRules?: ReadonlyArray<LeapRuleDTO>;
  readonly weeksPerMonth?: number;
  readonly hoursPerDay?: number;
  readonly minutesPerHour?: number;
  readonly secondsPerMinute?: number;
  readonly minuteStep?: number;
  readonly defaultTravelIds?: ReadonlyArray<string>;
};

export interface LeapRuleDTO {
  readonly interval: number;
  readonly addDayToMonthId: string;
}

export type CalendarDateDTO = CalendarTimestamp;

export interface CalendarRangeDTO {
  readonly calendarId: string;
  readonly start: CalendarDateDTO;
  readonly end: CalendarDateDTO;
  readonly zoom?: "month" | "week" | "day" | "hour" | "upcoming";
  readonly timeSlice?: "day" | "hour" | "minute";
}

export type CalendarEventDTO = CalendarEvent;

export type PhenomenonDTO = Phenomenon & { readonly template?: boolean };

export interface PhenomenonOccurrenceDTO {
  readonly calendarId: string;
  readonly occurrence: CalendarDateDTO;
  readonly timeLabel: string;
}

export interface PhenomenonSummaryDTO {
  readonly id: string;
  readonly name: string;
  readonly category: PhenomenonDTO["category"];
  readonly nextOccurrence?: PhenomenonOccurrenceDTO;
  readonly linkedCalendars: ReadonlyArray<string>;
  readonly badge?: string;
}

export type HookDescriptorDTO = HookDescriptor;

export interface PhenomenonLinkUpdate {
  readonly phenomenonId: string;
  readonly calendarLinks: ReadonlyArray<{
    readonly calendarId: string;
    readonly priority: number;
    readonly hook?: HookDescriptorDTO;
  }>;
}

export type PhenomenonTemplateDTO = Pick<PhenomenonDTO, "id" | "name" | "category" | "rule" | "effects">;

export type EventsSort = "next_occurrence" | "priority_desc" | "category_asc";

export interface EventsPaginationState {
  readonly cursor?: string;
  readonly limit: number;
}

export interface EventsDataBatchDTO {
  readonly items: ReadonlyArray<PhenomenonSummaryDTO>;
  readonly pagination: { readonly cursor?: string; readonly hasMore: boolean };
  readonly generatedAt: string;
}
