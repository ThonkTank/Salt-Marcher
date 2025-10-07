// src/apps/almanac/data/calendar-repository.ts
// Interfaces for persistent calendar storage aligned with Almanac contracts.

import type { CalendarSchemaDTO } from "./dto";

export interface CalendarDefaultSnapshot {
  readonly global: string | null;
  readonly travel: Readonly<Record<string, string | null>>;
}

export type CalendarDefaultScope = "global" | "travel";

export interface CalendarDefaultUpdate {
  readonly calendarId: string;
  readonly scope: CalendarDefaultScope;
  readonly travelId?: string;
}

export interface CalendarRepository {
  listCalendars(): Promise<ReadonlyArray<CalendarSchemaDTO>>;
  getCalendar(id: string): Promise<CalendarSchemaDTO | null>;
  createCalendar(input: CalendarSchemaDTO & { readonly isDefaultGlobal?: boolean }): Promise<void>;
  updateCalendar(id: string, input: Partial<CalendarSchemaDTO>): Promise<void>;
  deleteCalendar(id: string): Promise<void>;
  setDefault(input: CalendarDefaultUpdate): Promise<void>;
}

export interface CalendarDefaultsRepository {
  getDefaults(): Promise<CalendarDefaultSnapshot>;
  getGlobalDefault(): Promise<string | null>;
  getTravelDefault(travelId: string): Promise<string | null>;
  clearTravelDefault(travelId: string): Promise<void>;
}
