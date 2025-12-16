// src/workmodes/almanac/data/repository-interfaces.ts
// Central Almanac repository contracts and types

import type {
  CalendarTimestamp,
  CalendarSchema,
} from "../helpers";
import type { CalendarSchemaDTO } from "./dto";
import type {
  CalendarEventDTO as EventDTO,
  CalendarRangeDTO,
  EventsDataBatchDTO,
  EventsPaginationState,
  EventsSort,
  PhenomenonDTO,
  PhenomenonLinkUpdate,
  PhenomenonSummaryDTO,
  PhenomenonTemplateDTO,
} from "./dto";
import type {
  EventsFilterState,
} from "../mode/contracts";

// -- Calendar repositories ---------------------------------------------------

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

// -- Event repositories ------------------------------------------------------

export interface EventRepository {
  listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<EventDTO>>;
  listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<EventDTO>>;
  createEvent(event: EventDTO): Promise<void>;
  updateEvent(id: string, event: Partial<EventDTO>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  getEventsInRange?(
    calendarId: string,
    schema: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<ReadonlyArray<EventDTO>>;
  getUpcomingEvents?(
    calendarId: string,
    schema: CalendarSchema,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<ReadonlyArray<EventDTO>>;
}

// -- Phenomenon repositories -------------------------------------------------

export type AlmanacRepositoryErrorCode =
  | "validation_error"
  | "phenomenon_conflict"
  | "astronomy_source_missing";

export interface AlmanacRepositoryErrorDetails {
  readonly code: AlmanacRepositoryErrorCode;
  readonly scope: "phenomenon";
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export class AlmanacRepositoryError extends Error implements AlmanacRepositoryErrorDetails {
  readonly code: AlmanacRepositoryErrorCode;
  readonly scope = "phenomenon" as const;
  readonly details?: Record<string, unknown>;

  constructor(code: AlmanacRepositoryErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AlmanacRepositoryError";
    this.code = code;
    this.details = details;
  }
}

export interface AlmanacRepository {
  listPhenomena(input: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<EventsDataBatchDTO>;
  getPhenomenon(id: string): Promise<PhenomenonDTO | null>;
  upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO>;
  deletePhenomenon(id: string): Promise<void>;
  updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO>;
  listTemplates(): Promise<ReadonlyArray<PhenomenonTemplateDTO>>;
}

export type PhenomenonRepository = AlmanacRepository & {
  listPhenomena(): Promise<ReadonlyArray<PhenomenonDTO>>;
};

// -- Shared helpers ----------------------------------------------------------

export interface PhenomenonSummaryEntry {
  readonly phenomenon: PhenomenonDTO;
  readonly summary: PhenomenonSummaryDTO;
}

export type PhenomenonSummaryComparator = (
  a: PhenomenonSummaryEntry,
  b: PhenomenonSummaryEntry,
) => number;

export interface PhenomenonFilterOptions {
  readonly resolveVisibleCalendars?: (phenomenon: PhenomenonDTO) => ReadonlyArray<string>;
}

export interface PhenomenonSortOptions {
  readonly sort?: EventsSort;
  readonly fallbackComparator?: PhenomenonSummaryComparator;
}
