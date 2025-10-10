// src/apps/almanac/data/repositories.ts
// Central Almanac repository contracts and shared helpers for calendars, events and phenomena.

import type { CalendarSchema, CalendarTimestamp } from '../domain/calendar-core';
import type { EventsFilterState } from '../mode/contracts';
import type {
  CalendarEventDTO,
  CalendarRangeDTO,
  CalendarSchemaDTO,
  EventsDataBatchDTO,
  EventsPaginationState,
  EventsSort,
  PhenomenonDTO,
  PhenomenonLinkUpdate,
  PhenomenonSummaryDTO,
  PhenomenonTemplateDTO,
} from './dto';

// -- Calendar repositories ---------------------------------------------------

export interface CalendarDefaultSnapshot {
  readonly global: string | null;
  readonly travel: Readonly<Record<string, string | null>>;
}

export type CalendarDefaultScope = 'global' | 'travel';

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
  listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<CalendarEventDTO>>;
  listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<CalendarEventDTO>>;
  createEvent(event: CalendarEventDTO): Promise<void>;
  updateEvent(id: string, event: Partial<CalendarEventDTO>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  getEventsInRange?(
    calendarId: string,
    schema: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<ReadonlyArray<CalendarEventDTO>>;
  getUpcomingEvents?(
    calendarId: string,
    schema: CalendarSchema,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<ReadonlyArray<CalendarEventDTO>>;
}

// -- Phenomenon repositories -------------------------------------------------

export type AlmanacRepositoryErrorCode =
  | 'validation_error'
  | 'phenomenon_conflict'
  | 'astronomy_source_missing';

export interface AlmanacRepositoryErrorDetails {
  readonly code: AlmanacRepositoryErrorCode;
  readonly scope: 'phenomenon';
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export class AlmanacRepositoryError extends Error implements AlmanacRepositoryErrorDetails {
  readonly code: AlmanacRepositoryErrorCode;
  readonly scope = 'phenomenon' as const;
  readonly details?: Record<string, unknown>;

  constructor(code: AlmanacRepositoryErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AlmanacRepositoryError';
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
  readonly tieBreaker?: PhenomenonSummaryComparator;
}

export const PHENOMENON_PAGE_SIZE = 25;

export function matchesPhenomenonFilters(
  phenomenon: PhenomenonDTO,
  filters: EventsFilterState,
  options: PhenomenonFilterOptions = {},
): boolean {
  if (filters.categories?.length && !filters.categories.includes(phenomenon.category)) {
    return false;
  }

  if (!filters.calendarIds?.length) {
    return true;
  }

  if (phenomenon.visibility === 'all_calendars' && !options.resolveVisibleCalendars) {
    return true;
  }

  const calendars = options.resolveVisibleCalendars?.(phenomenon) ?? phenomenon.appliesToCalendarIds;
  if (phenomenon.visibility === 'all_calendars' && calendars.length === 0) {
    return true;
  }

  return calendars.some(calendarId => filters.calendarIds!.includes(calendarId));
}

export function sortPhenomenonSummaries(
  entries: ReadonlyArray<PhenomenonSummaryEntry>,
  sort: EventsSort,
  options: PhenomenonSortOptions = {},
): Array<PhenomenonSummaryEntry> {
  const copy = [...entries];
  copy.sort((a, b) => {
    if (sort === 'priority_desc') {
      return b.phenomenon.priority - a.phenomenon.priority || a.summary.name.localeCompare(b.summary.name);
    }

    if (sort === 'category_asc') {
      return (
        a.summary.category.localeCompare(b.summary.category) ||
        a.summary.name.localeCompare(b.summary.name)
      );
    }

    const tieBreak = options.tieBreaker?.(a, b) ?? 0;
    if (tieBreak !== 0) {
      return tieBreak;
    }

    return a.summary.name.localeCompare(b.summary.name);
  });
  return copy;
}

export function paginatePhenomena<T>(
  entries: ReadonlyArray<T>,
  pagination?: EventsPaginationState,
  defaultLimit: number = PHENOMENON_PAGE_SIZE,
): { items: ReadonlyArray<T>; nextCursor?: string } {
  const offset = pagination?.cursor ? Number.parseInt(pagination.cursor, 10) || 0 : 0;
  const limit = pagination?.limit ?? defaultLimit;
  const slice = entries.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  return {
    items: slice,
    nextCursor: nextOffset < entries.length ? String(nextOffset) : undefined,
  };
}

export function findDuplicateCalendarIds(
  links: ReadonlyArray<PhenomenonLinkUpdate['calendarLinks'][number]>,
): string[] {
  const counts = new Map<string, number>();
  for (const link of links) {
    counts.set(link.calendarId, (counts.get(link.calendarId) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([calendarId]) => calendarId);
}

