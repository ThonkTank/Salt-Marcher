// src/apps/almanac/data/repositories.ts
// Central Almanac repository contracts, shared helpers and unified persistence for calendars, events and phenomena.

import {
  compareTimestampsWithSchema,
  createDayTimestamp,
  formatTimestamp,
  type CalendarSchema,
  type CalendarSchemaDTO,
  type CalendarTimestamp,
} from "../domain/calendar-core";
import {
  computeNextPhenomenonOccurrence,
  getEventAnchorTimestamp,
  isPhenomenonVisibleForCalendar,
  type CalendarEvent,
  type CalendarEventDTO,
} from "../domain/scheduling";
import type {
  AlmanacPreferencesSnapshot,
  EventsFilterState,
  TravelCalendarMode,
} from "../mode/contracts";
import { reportAlmanacGatewayIssue } from "../telemetry";
import type { TravelLeafPreferencesSnapshot } from "./calendar-state-gateway";
import type {
  CalendarEventDTO as EventDTO,
  CalendarRangeDTO,
  EventsDataBatchDTO,
  EventsPaginationState,
  EventsSort,
  PhenomenonDTO,
  PhenomenonLinkUpdate,
  PhenomenonOccurrenceDTO,
  PhenomenonSummaryDTO,
  PhenomenonTemplateDTO,
} from "./dto";
import { JsonStore, type VaultLike } from "./json-store";

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

  if (phenomenon.visibility === "all_calendars" && !options.resolveVisibleCalendars) {
    return true;
  }

  const calendars = options.resolveVisibleCalendars?.(phenomenon) ?? phenomenon.appliesToCalendarIds;
  if (phenomenon.visibility === "all_calendars" && calendars.length === 0) {
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
    if (sort === "priority_desc") {
      return b.phenomenon.priority - a.phenomenon.priority || a.summary.name.localeCompare(b.summary.name);
    }

    if (sort === "category_asc") {
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
  const nextCursor = nextOffset < entries.length ? String(nextOffset) : undefined;
  return { items: slice, nextCursor };
}

export function findDuplicateCalendarIds(
  links: ReadonlyArray<PhenomenonLinkUpdate["calendarLinks"][number]>,
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const link of links) {
    if (seen.has(link.calendarId)) {
      duplicates.add(link.calendarId);
    }
    seen.add(link.calendarId);
  }
  return [...duplicates];
}


// -- Unified data store ------------------------------------------------------

type CalendarDefaultsState = {
  global: string | null;
  travel: Record<string, string | null>;
};

type AlmanacStoreState = {
  calendars: CalendarSchemaDTO[];
  defaults: CalendarDefaultsState;
  eventsByCalendar: Record<string, EventDTO[]>;
  phenomena: PhenomenonDTO[];
  preferences: AlmanacPreferencesSnapshot;
  travelLeaf: Record<string, TravelLeafPreferencesSnapshot>;
};

const STORE_VERSION = "2.0.0";
const STORE_PATH = "SaltMarcher/Almanac/data.json";

function createInitialState(): AlmanacStoreState {
  return {
    calendars: [],
    defaults: { global: null, travel: {} },
    eventsByCalendar: {},
    phenomena: [],
    preferences: {
      defaultCalendarId: null,
      travelDefaultCalendarId: null,
      travelMode: "local" satisfies TravelCalendarMode,
    },
    travelLeaf: {},
  };
}

function cloneState(state: AlmanacStoreState): AlmanacStoreState {
  return {
    calendars: state.calendars.map(calendar => ({ ...calendar })),
    defaults: {
      global: state.defaults.global,
      travel: { ...state.defaults.travel },
    },
    eventsByCalendar: Object.fromEntries(
      Object.entries(state.eventsByCalendar).map(([calendarId, events]) => [
        calendarId,
        events.map(event => ({ ...event })),
      ]),
    ),
    phenomena: state.phenomena.map(phenomenon => ({ ...phenomenon })),
    preferences: { ...state.preferences },
    travelLeaf: Object.fromEntries(
      Object.entries(state.travelLeaf).map(([travelId, prefs]) => [travelId, { ...prefs }]),
    ),
  };
}

class InMemoryStore {
  private state: AlmanacStoreState = createInitialState();

  read(): AlmanacStoreState {
    return cloneState(this.state);
  }

  update(mutator: (draft: AlmanacStoreState) => void): AlmanacStoreState {
    const draft = cloneState(this.state);
    mutator(draft);
    this.state = draft;
    return cloneState(this.state);
  }
}

class VaultStore {
  private readonly store: JsonStore<AlmanacStoreState>;

  constructor(vault: VaultLike) {
    this.store = new JsonStore<AlmanacStoreState>(vault, {
      path: STORE_PATH,
      currentVersion: STORE_VERSION,
      initialData: createInitialState,
    });
  }

  async read(): Promise<AlmanacStoreState> {
    return this.store.read();
  }

  async update(mutator: (draft: AlmanacStoreState) => void): Promise<AlmanacStoreState> {
    return this.store.update(draft => {
      mutator(draft);
      return draft;
    });
  }
}

// -- Domain helpers over the unified state ----------------------------------

function sanitiseDefaults(defaults: CalendarDefaultsState): CalendarDefaultSnapshot {
  const travel: Record<string, string | null> = {};
  for (const [travelId, calendarId] of Object.entries(defaults.travel)) {
    if (calendarId) {
      travel[travelId] = calendarId;
    }
  }
  return { global: defaults.global, travel };
}

function computeDefaultTravelIds(defaults: CalendarDefaultsState, calendarId: string): string[] {
  return Object.entries(defaults.travel)
    .filter(([, linkedId]) => linkedId === calendarId)
    .map(([travelId]) => travelId);
}

function decorateCalendar(
  calendar: CalendarSchemaDTO,
  defaults: CalendarDefaultsState,
): CalendarSchemaDTO {
  return {
    ...calendar,
    isDefaultGlobal: defaults.global === calendar.id,
    defaultTravelIds: computeDefaultTravelIds(defaults, calendar.id),
  };
}

function ensureCalendar(state: AlmanacStoreState, id: string): CalendarSchemaDTO {
  const calendar = state.calendars.find(entry => entry.id === id);
  if (!calendar) {
    throw new Error(`Calendar with ID ${id} not found`);
  }
  return calendar;
}

function listCalendars(state: AlmanacStoreState): CalendarSchemaDTO[] {
  return state.calendars.map(calendar => decorateCalendar(calendar, state.defaults));
}

function getCalendar(state: AlmanacStoreState, id: string): CalendarSchemaDTO | null {
  const calendar = state.calendars.find(entry => entry.id === id);
  if (!calendar) {
    return null;
  }
  return decorateCalendar(calendar, state.defaults);
}

function applyCalendarCreation(state: AlmanacStoreState, input: CalendarSchemaDTO & { isDefaultGlobal?: boolean }): void {
  if (state.calendars.some(calendar => calendar.id === input.id)) {
    throw new Error(`Calendar with ID ${input.id} already exists`);
  }
  state.calendars.push({ ...input });
  if (input.isDefaultGlobal) {
    state.defaults.global = input.id;
  }
}

function applyCalendarUpdate(state: AlmanacStoreState, id: string, updates: Partial<CalendarSchemaDTO>): void {
  const index = state.calendars.findIndex(calendar => calendar.id === id);
  if (index === -1) {
    throw new Error(`Calendar with ID ${id} not found`);
  }
  state.calendars[index] = { ...state.calendars[index], ...updates };
  if (updates.isDefaultGlobal === true) {
    state.defaults.global = id;
  } else if (updates.isDefaultGlobal === false && state.defaults.global === id) {
    state.defaults.global = null;
  }
}

function applyCalendarDeletion(state: AlmanacStoreState, id: string): void {
  const index = state.calendars.findIndex(calendar => calendar.id === id);
  if (index === -1) {
    throw new Error(`Calendar with ID ${id} not found`);
  }
  state.calendars.splice(index, 1);
  delete state.eventsByCalendar[id];
  if (state.defaults.global === id) {
    state.defaults.global = null;
  }
  for (const [travelId, calendarId] of Object.entries(state.defaults.travel)) {
    if (calendarId === id) {
      delete state.defaults.travel[travelId];
    }
  }
}

function applyCalendarDefault(state: AlmanacStoreState, update: CalendarDefaultUpdate): void {
  ensureCalendar(state, update.calendarId);
  if (update.scope === "global") {
    state.defaults.global = update.calendarId;
    return;
  }
  if (!update.travelId) {
    throw new Error("Travel ID required for travel scope");
  }
  state.defaults.travel[update.travelId] = update.calendarId;
}

function clearTravelDefault(state: AlmanacStoreState, travelId: string): void {
  delete state.defaults.travel[travelId];
}

function listEvents(state: AlmanacStoreState, calendarId: string): EventDTO[] {
  ensureCalendar(state, calendarId);
  return (state.eventsByCalendar[calendarId] ?? []).map(event => ({ ...event }));
}

function findEventLocation(
  state: AlmanacStoreState,
  id: string,
): { calendarId: string; index: number } | null {
  for (const [calendarId, events] of Object.entries(state.eventsByCalendar)) {
    const index = events.findIndex(event => event.id === id);
    if (index !== -1) {
      return { calendarId, index };
    }
  }
  return null;
}

function applyEventCreation(state: AlmanacStoreState, event: EventDTO): void {
  ensureCalendar(state, event.calendarId);
  if (findEventLocation(state, event.id)) {
    throw new Error(`Event with ID ${event.id} already exists`);
  }
  const events = state.eventsByCalendar[event.calendarId] ?? [];
  events.push({ ...event });
  state.eventsByCalendar[event.calendarId] = events;
}

function applyEventUpdate(state: AlmanacStoreState, id: string, updates: Partial<EventDTO>): void {
  const location = findEventLocation(state, id);
  if (!location) {
    throw new Error(`Event with ID ${id} not found`);
  }
  const current = state.eventsByCalendar[location.calendarId]![location.index]!;
  const next = { ...current, ...updates } as EventDTO;
  ensureCalendar(state, next.calendarId);
  if (next.calendarId !== location.calendarId) {
    const previousEvents = state.eventsByCalendar[location.calendarId] ?? [];
    previousEvents.splice(location.index, 1);
    const target = state.eventsByCalendar[next.calendarId] ?? [];
    target.push(next);
    state.eventsByCalendar[location.calendarId] = previousEvents;
    state.eventsByCalendar[next.calendarId] = target;
    return;
  }
  state.eventsByCalendar[location.calendarId]![location.index] = next;
}

function applyEventDeletion(state: AlmanacStoreState, id: string): void {
  const location = findEventLocation(state, id);
  if (!location) {
    throw new Error(`Event with ID ${id} not found`);
  }
  const events = state.eventsByCalendar[location.calendarId] ?? [];
  events.splice(location.index, 1);
  state.eventsByCalendar[location.calendarId] = events;
}

function applyPhenomenonUpsert(state: AlmanacStoreState, draft: PhenomenonDTO): PhenomenonDTO {
  const existingIndex = state.phenomena.findIndex(entry => entry.id === draft.id);
  if (existingIndex === -1) {
    state.phenomena.push({ ...draft });
    return { ...draft };
  }
  state.phenomena[existingIndex] = { ...state.phenomena[existingIndex], ...draft };
  return { ...state.phenomena[existingIndex] };
}

function applyPhenomenonDeletion(state: AlmanacStoreState, id: string): void {
  const next = state.phenomena.filter(entry => entry.id !== id);
  if (next.length === state.phenomena.length) {
    throw new AlmanacRepositoryError("validation_error", `Phenomenon ${id} not found`);
  }
  state.phenomena = next;
}

function listPhenomenaRaw(state: AlmanacStoreState): PhenomenonDTO[] {
  return state.phenomena.map(phenomenon => ({ ...phenomenon }));
}

function listPhenomenaBatch(
  state: AlmanacStoreState,
  calendars: ReadonlyArray<CalendarSchemaDTO>,
  input: {
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  },
): EventsDataBatchDTO {
  const calendarMap = new Map(calendars.map(calendar => [calendar.id, calendar]));
  const allCalendarIds = Array.from(calendarMap.keys());
  const visible = state.phenomena.filter(phenomenon =>
    matchesPhenomenonFilters(phenomenon, input.filters, {
      resolveVisibleCalendars: current =>
        current.visibility === "all_calendars" ? allCalendarIds : current.appliesToCalendarIds,
    }),
  );

  const summaries: PhenomenonSummaryEntry[] = visible.map(phenomenon => ({
    phenomenon,
    summary: buildPhenomenonSummary(phenomenon, calendars),
  }));
  const sorted = sortPhenomenonSummaries(summaries, input.sort, {
    tieBreaker: compareSummariesByNextOccurrence,
  });
  const { items, nextCursor } = paginatePhenomena(sorted, input.pagination);
  return {
    items: items.map(entry => entry.summary),
    nextCursor,
  };
}

function buildPhenomenonSummary(
  phenomenon: PhenomenonDTO,
  calendars: ReadonlyArray<CalendarSchemaDTO>,
): PhenomenonSummaryDTO {
  const nextOccurrence = computeNextOccurrenceAcrossCalendars(phenomenon, calendars);
  const linkedCalendars = phenomenon.visibility === "all_calendars"
    ? calendars.map(calendar => calendar.id)
    : phenomenon.appliesToCalendarIds;
  return {
    id: phenomenon.id,
    name: phenomenon.name,
    category: phenomenon.category,
    nextOccurrence,
    linkedCalendars,
    badge: phenomenon.tags?.[0],
  };
}


function computeNextOccurrenceAcrossCalendars(
  phenomenon: PhenomenonDTO,
  calendars: ReadonlyArray<CalendarSchemaDTO>,
): PhenomenonOccurrenceDTO | undefined {
  const candidates: Array<{ occurrence: PhenomenonOccurrenceDTO; calendar: CalendarSchemaDTO }> = [];
  for (const calendar of calendars) {
    if (!isPhenomenonVisibleForCalendar(phenomenon, calendar.id)) {
      continue;
    }
    const start = createDayTimestamp(
      calendar.id,
      calendar.epoch.year,
      calendar.epoch.monthId,
      calendar.epoch.day,
    );
    const occurrence = computeNextPhenomenonOccurrence(phenomenon, calendar, calendar.id, start);
    if (!occurrence) {
      continue;
    }
    candidates.push({
      calendar,
      occurrence: {
        calendarId: occurrence.calendarId,
        occurrence: occurrence.timestamp,
        timeLabel: formatTimestamp(
          occurrence.timestamp,
          calendar.months.find(month => month.id === occurrence.timestamp.monthId)?.name,
        ),
      },
    });
  }
  candidates.sort((a, b) => compareOccurrencesWithSchema(a, b));
  return candidates[0]?.occurrence;
}

function compareSummariesByNextOccurrence(a: PhenomenonSummaryEntry, b: PhenomenonSummaryEntry): number {
  const aTime = a.summary.nextOccurrence?.occurrence;
  const bTime = b.summary.nextOccurrence?.occurrence;
  if (!aTime && !bTime) {
    return 0;
  }
  if (!aTime) {
    return 1;
  }
  if (!bTime) {
    return -1;
  }
  return compareTimestampTuples(aTime, bTime);
}

function compareTimestampTuples(
  a: PhenomenonOccurrenceDTO["occurrence"],
  b: PhenomenonOccurrenceDTO["occurrence"],
): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.monthId !== b.monthId) {
    return a.monthId.localeCompare(b.monthId);
  }
  if (a.day !== b.day) {
    return a.day - b.day;
  }
  if ((a.hour ?? 0) !== (b.hour ?? 0)) {
    return (a.hour ?? 0) - (b.hour ?? 0);
  }
  return (a.minute ?? 0) - (b.minute ?? 0);
}

function compareOccurrencesWithSchema(
  a: { occurrence: PhenomenonOccurrenceDTO; calendar: CalendarSchemaDTO },
  b: { occurrence: PhenomenonOccurrenceDTO; calendar: CalendarSchemaDTO },
): number {
  const first = a.occurrence.occurrence;
  const second = b.occurrence.occurrence;
  if (first.calendarId === second.calendarId) {
    return compareTimestampsWithSchema(a.calendar, first, second);
  }
  return compareTimestampTuples(first, second);
}

function buildHooksFromLinks(
  links: ReadonlyArray<PhenomenonLinkUpdate["calendarLinks"][number]>,
  phenomenon: PhenomenonDTO,
): PhenomenonDTO["hooks"] | undefined {
  const existing = phenomenon.hooks ?? [];
  const linkedHooks = links
    .filter(link => Boolean(link.hook))
    .map(link => ({ ...link.hook!, priority: link.priority }));
  if (linkedHooks.length === 0) {
    return existing;
  }
  return linkedHooks;
}

// -- Memory-backed repositories ---------------------------------------------

export class AlmanacMemoryBackend {
  private readonly store = new InMemoryStore();

  listCalendars(): CalendarSchemaDTO[] {
    return listCalendars(this.store.read());
  }

  getCalendar(id: string): CalendarSchemaDTO | null {
    return getCalendar(this.store.read(), id);
  }

  createCalendar(input: CalendarSchemaDTO & { readonly isDefaultGlobal?: boolean }): void {
    this.store.update(state => applyCalendarCreation(state, input));
  }

  updateCalendar(id: string, updates: Partial<CalendarSchemaDTO>): void {
    this.store.update(state => applyCalendarUpdate(state, id, updates));
  }

  deleteCalendar(id: string): void {
    this.store.update(state => applyCalendarDeletion(state, id));
  }

  setDefault(update: CalendarDefaultUpdate): void {
    this.store.update(state => applyCalendarDefault(state, update));
  }

  getDefaults(): CalendarDefaultSnapshot {
    return sanitiseDefaults(this.store.read().defaults);
  }

  getGlobalDefault(): string | null {
    return this.store.read().defaults.global;
  }

  getTravelDefault(travelId: string): string | null {
    return this.store.read().defaults.travel[travelId] ?? null;
  }

  clearTravelDefault(travelId: string): void {
    this.store.update(state => clearTravelDefault(state, travelId));
  }

  setGlobalDefault(calendarId: string): void {
    this.setDefault({ calendarId, scope: "global" });
  }

  setTravelDefault(travelId: string, calendarId: string): void {
    this.setDefault({ calendarId, scope: "travel", travelId });
  }

  getGlobalDefaultCalendar(): CalendarSchemaDTO | null {
    const state = this.store.read();
    const id = state.defaults.global;
    return id ? getCalendar(state, id) : null;
  }

  seedCalendars(calendars: CalendarSchema[]): void {
    this.store.update(state => {
      state.calendars = calendars.map(calendar => ({ ...calendar }));
    });
  }

  clearCalendars(): void {
    this.store.update(state => {
      state.calendars = [];
      state.defaults = { global: null, travel: {} };
    });
  }

  listEvents(calendarId: string, range?: CalendarRangeDTO): EventDTO[] {
    const state = this.store.read();
    const events = listEvents(state, calendarId);
    if (!range) {
      return events;
    }
    const schema = ensureCalendar(state, calendarId);
    const [start, end] =
      compareTimestampsWithSchema(schema, range.start, range.end) <= 0
        ? [range.start, range.end]
        : [range.end, range.start];
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const afterStart = compareTimestampsWithSchema(schema, anchor, start) >= 0;
      const beforeEnd = compareTimestampsWithSchema(schema, anchor, end) <= 0;
      return afterStart && beforeEnd;
    });
  }

  listUpcomingEvents(calendarId: string, from: CalendarTimestamp, limit: number): EventDTO[] {
    const state = this.store.read();
    const schema = ensureCalendar(state, calendarId);
    return listEvents(state, calendarId)
      .filter(event => compareTimestampsWithSchema(schema, getEventAnchorTimestamp(event) ?? event.date, from) >= 0)
      .slice(0, limit);
  }

  createEvent(event: EventDTO): void {
    this.store.update(state => applyEventCreation(state, event));
  }

  updateEvent(id: string, updates: Partial<EventDTO>): void {
    this.store.update(state => applyEventUpdate(state, id, updates));
  }

  deleteEvent(id: string): void {
    this.store.update(state => applyEventDeletion(state, id));
  }

  seedEvents(events: CalendarEvent[]): void {
    this.store.update(state => {
      state.eventsByCalendar = {};
      for (const event of events) {
        applyEventCreation(state, event);
      }
    });
  }

  clearEvents(): void {
    this.store.update(state => {
      state.eventsByCalendar = {};
    });
  }

  listPhenomenaRaw(): PhenomenonDTO[] {
    return listPhenomenaRaw(this.store.read());
  }

  listPhenomenaBatch(input: {
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): EventsDataBatchDTO {
    const state = this.store.read();
    return listPhenomenaBatch(state, listCalendars(state), input);
  }

  getPhenomenon(id: string): PhenomenonDTO | null {
    const state = this.store.read();
    return state.phenomena.find(entry => entry.id === id) ?? null;
  }

  upsertPhenomenon(draft: PhenomenonDTO): PhenomenonDTO {
    const state = this.store.update(current => {
      applyPhenomenonUpsert(current, draft);
    });
    return state.phenomena.find(entry => entry.id === draft.id) ?? draft;
  }

  deletePhenomenon(id: string): void {
    this.store.update(state => applyPhenomenonDeletion(state, id));
  }

  updateLinks(update: PhenomenonLinkUpdate): PhenomenonDTO {
    const calendars = this.listCalendars();
    const calendarSet = new Set(calendars.map(calendar => calendar.id));
    const phenomenon = this.getPhenomenon(update.phenomenonId);
    if (!phenomenon) {
      throw new AlmanacRepositoryError("validation_error", `Phenomenon ${update.phenomenonId} not found`);
    }
    const duplicates = findDuplicateCalendarIds(update.calendarLinks);
    if (duplicates.length > 0) {
      throw new AlmanacRepositoryError("phenomenon_conflict", "Calendar links contain duplicates", {
        duplicates,
      });
    }
    for (const link of update.calendarLinks) {
      if (!calendarSet.has(link.calendarId)) {
        throw new AlmanacRepositoryError("validation_error", `Calendar ${link.calendarId} not found`, {
          calendarId: link.calendarId,
        });
      }
    }
    if (phenomenon.rule.type === "astronomical") {
      const hasReference = Boolean(phenomenon.rule.referenceCalendarId);
      const hasHookReference = update.calendarLinks.some(link =>
        link.hook && typeof link.hook.config?.referenceCalendarId === "string",
      );
      if (!hasReference && !hasHookReference) {
        throw new AlmanacRepositoryError(
          "astronomy_source_missing",
          "Astronomical phenomena require a reference calendar",
        );
      }
    }
    const stored = this.store.update(state => {
      const next = applyPhenomenonUpsert(state, phenomenon);
      const appliesToCalendarIds = update.calendarLinks.map(link => link.calendarId);
      const visibility = appliesToCalendarIds.length === 0 ? "all_calendars" : "selected";
      next.appliesToCalendarIds = appliesToCalendarIds;
      next.visibility = visibility;
      next.hooks = buildHooksFromLinks(update.calendarLinks, next);
      next.priority = update.calendarLinks.reduce((max, link) => Math.max(max, link.priority), next.priority);
    });
    return stored.phenomena.find(entry => entry.id === update.phenomenonId)!;
  }

  listTemplates(): PhenomenonTemplateDTO[] {
    return this.store
      .read()
      .phenomena.filter(phenomenon => phenomenon.template)
      .map(phenomenon => ({
        id: phenomenon.id,
        name: phenomenon.name,
        category: phenomenon.category,
        rule: phenomenon.rule,
        effects: phenomenon.effects,
      }));
  }

  seedPhenomena(phenomena: PhenomenonDTO[]): void {
    this.store.update(state => {
      state.phenomena = phenomena.map(entry => ({ ...entry }));
    });
  }

  clearPhenomena(): void {
    this.store.update(state => {
      state.phenomena = [];
    });
  }

  loadPreferences(): AlmanacPreferencesSnapshot {
    return { ...this.store.read().preferences };
  }

  savePreferences(partial: Partial<AlmanacPreferencesSnapshot>): void {
    this.store.update(state => {
      state.preferences = { ...state.preferences, ...partial };
    });
  }

  getTravelLeafPreferences(travelId: string): TravelLeafPreferencesSnapshot | null {
    const prefs = this.store.read().travelLeaf[travelId];
    return prefs ? { ...prefs } : null;
  }

  saveTravelLeafPreferences(travelId: string, prefs: TravelLeafPreferencesSnapshot): void {
    this.store.update(state => {
      state.travelLeaf[travelId] = { ...prefs };
    });
  }
}


export class InMemoryCalendarRepository
  implements CalendarRepository, CalendarDefaultsRepository
{
  constructor(private readonly backend: AlmanacMemoryBackend = new AlmanacMemoryBackend()) {}

  async listCalendars(): Promise<ReadonlyArray<CalendarSchemaDTO>> {
    return this.backend.listCalendars();
  }

  async getCalendar(id: string): Promise<CalendarSchemaDTO | null> {
    return this.backend.getCalendar(id);
  }

  async createCalendar(input: CalendarSchemaDTO & { readonly isDefaultGlobal?: boolean }): Promise<void> {
    this.backend.createCalendar(input);
  }

  async updateCalendar(id: string, input: Partial<CalendarSchemaDTO>): Promise<void> {
    this.backend.updateCalendar(id, input);
  }

  async deleteCalendar(id: string): Promise<void> {
    this.backend.deleteCalendar(id);
  }

  async setDefault(input: CalendarDefaultUpdate): Promise<void> {
    this.backend.setDefault(input);
  }

  async getDefaults(): Promise<CalendarDefaultSnapshot> {
    return this.backend.getDefaults();
  }

  async getGlobalDefault(): Promise<string | null> {
    return this.backend.getGlobalDefault();
  }

  async getTravelDefault(travelId: string): Promise<string | null> {
    return this.backend.getTravelDefault(travelId);
  }

  async clearTravelDefault(travelId: string): Promise<void> {
    this.backend.clearTravelDefault(travelId);
  }

  async setGlobalDefault(calendarId: string): Promise<void> {
    this.backend.setGlobalDefault(calendarId);
  }

  async setTravelDefault(travelId: string, calendarId: string): Promise<void> {
    this.backend.setTravelDefault(travelId, calendarId);
  }

  async getGlobalDefaultCalendar(): Promise<CalendarSchemaDTO | null> {
    return this.backend.getGlobalDefaultCalendar();
  }

  seed(schemas: CalendarSchema[]): void {
    this.backend.seedCalendars(schemas);
  }

  clear(): void {
    this.backend.clearCalendars();
  }

  get memory(): AlmanacMemoryBackend {
    return this.backend;
  }
}

export class InMemoryEventRepository implements EventRepository {
  constructor(private readonly backend: AlmanacMemoryBackend = new AlmanacMemoryBackend()) {}

  async listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<EventDTO>> {
    return this.backend.listEvents(calendarId, range);
  }

  async listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<EventDTO>> {
    return this.backend.listEvents(calendarId).slice(0, limit);
  }

  async createEvent(event: EventDTO): Promise<void> {
    this.backend.createEvent(event);
  }

  async updateEvent(id: string, updates: Partial<EventDTO>): Promise<void> {
    this.backend.updateEvent(id, updates);
  }

  async deleteEvent(id: string): Promise<void> {
    this.backend.deleteEvent(id);
  }

  async getEventsInRange(
    calendarId: string,
    schema: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<ReadonlyArray<EventDTO>> {
    return this.backend.listEvents(calendarId, { calendarId, start, end });
  }

  async getUpcomingEvents(
    calendarId: string,
    schema: CalendarSchema,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<ReadonlyArray<EventDTO>> {
    return this.backend.listUpcomingEvents(calendarId, from, limit);
  }

  seed(events: CalendarEvent[]): void {
    this.backend.seedEvents(events);
  }

  clear(): void {
    this.backend.clearEvents();
  }

  get memory(): AlmanacMemoryBackend {
    return this.backend;
  }
}

export class InMemoryPhenomenonRepository implements AlmanacRepository, PhenomenonRepository {
  constructor(private readonly backend: AlmanacMemoryBackend = new AlmanacMemoryBackend()) {}

  async listPhenomena(): Promise<PhenomenonDTO[]>;
  async listPhenomena(input: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<EventsDataBatchDTO>;
  async listPhenomena(
    input?: {
      readonly viewMode: string;
      readonly filters: EventsFilterState;
      readonly sort: EventsSort;
      readonly pagination?: EventsPaginationState;
    },
  ): Promise<PhenomenonDTO[] | EventsDataBatchDTO> {
    if (!input) {
      return this.backend.listPhenomenaRaw();
    }
    return this.backend.listPhenomenaBatch(input);
  }

  async getPhenomenon(id: string): Promise<PhenomenonDTO | null> {
    return this.backend.getPhenomenon(id);
  }

  async upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO> {
    return this.backend.upsertPhenomenon(draft);
  }

  async deletePhenomenon(id: string): Promise<void> {
    this.backend.deletePhenomenon(id);
  }

  async updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO> {
    return this.backend.updateLinks(update);
  }

  async listTemplates(): Promise<ReadonlyArray<PhenomenonTemplateDTO>> {
    return this.backend.listTemplates();
  }

  seed(phenomena: PhenomenonDTO[]): void {
    this.backend.seedPhenomena(phenomena);
  }

  clear(): void {
    this.backend.clearPhenomena();
  }

  get memory(): AlmanacMemoryBackend {
    return this.backend;
  }
}


// -- Vault-backed repositories ----------------------------------------------

type TelemetryMeta = {
  readonly operation: string;
  readonly scope: string;
  readonly context?: Record<string, unknown>;
  readonly classify: (error: unknown) => string;
};

class VaultRepositoryBase {
  constructor(
    protected readonly store: VaultStore,
    private readonly report: typeof reportAlmanacGatewayIssue,
  ) {}

  protected async mutate(meta: TelemetryMeta, mutator: (draft: AlmanacStoreState) => void): Promise<void> {
    try {
      await this.store.update(state => {
        mutator(state);
      });
    } catch (error) {
      this.report({
        operation: meta.operation,
        scope: meta.scope,
        code: meta.classify(error),
        error,
        context: meta.context ?? {},
      });
      throw error;
    }
  }

  protected async read<T>(selector: (state: AlmanacStoreState) => T): Promise<T> {
    const state = await this.store.read();
    return selector(state);
  }
}

export class VaultCalendarRepository
  extends VaultRepositoryBase
  implements CalendarRepository, CalendarDefaultsRepository
{
  constructor(
    vault: VaultLike,
    report: typeof reportAlmanacGatewayIssue = reportAlmanacGatewayIssue,
  ) {
    super(new VaultStore(vault), report);
  }

  async listCalendars(): Promise<ReadonlyArray<CalendarSchemaDTO>> {
    return this.read(state => listCalendars(state));
  }

  async getCalendar(id: string): Promise<CalendarSchemaDTO | null> {
    return this.read(state => getCalendar(state, id));
  }

  async createCalendar(input: CalendarSchemaDTO & { readonly isDefaultGlobal?: boolean }): Promise<void> {
    await this.mutate(
      {
        operation: "calendar.repository.createCalendar",
        scope: "calendar",
        context: { calendarId: input.id },
        classify: classifyWithPattern(/already exists|not found|required/i),
      },
      state => applyCalendarCreation(state, input),
    );
  }

  async updateCalendar(id: string, input: Partial<CalendarSchemaDTO>): Promise<void> {
    await this.mutate(
      {
        operation: "calendar.repository.updateCalendar",
        scope: "calendar",
        context: { calendarId: id },
        classify: classifyWithPattern(/already exists|not found|required/i),
      },
      state => applyCalendarUpdate(state, id, input),
    );
  }

  async deleteCalendar(id: string): Promise<void> {
    await this.mutate(
      {
        operation: "calendar.repository.deleteCalendar",
        scope: "calendar",
        context: { calendarId: id },
        classify: classifyWithPattern(/already exists|not found|required/i),
      },
      state => applyCalendarDeletion(state, id),
    );
  }

  async setDefault(input: CalendarDefaultUpdate): Promise<void> {
    await this.mutate(
      {
        operation: "calendar.repository.setDefault",
        scope: input.scope === "travel" ? "travel" : "default",
        context: { calendarId: input.calendarId, travelId: input.travelId ?? null },
        classify: classifyWithPattern(/already exists|not found|required/i),
      },
      state => applyCalendarDefault(state, input),
    );
  }

  async getDefaults(): Promise<CalendarDefaultSnapshot> {
    return this.read(state => sanitiseDefaults(state.defaults));
  }

  async getGlobalDefault(): Promise<string | null> {
    return this.read(state => state.defaults.global);
  }

  async getTravelDefault(travelId: string): Promise<string | null> {
    return this.read(state => state.defaults.travel[travelId] ?? null);
  }

  async clearTravelDefault(travelId: string): Promise<void> {
    await this.mutate(
      {
        operation: "calendar.repository.clearTravelDefault",
        scope: "travel",
        context: { travelId },
        classify: classifyWithPattern(/already exists|not found|required/i),
      },
      state => clearTravelDefault(state, travelId),
    );
  }

  get internalStore(): VaultStore {
    return this.store;
  }
}

export class VaultEventRepository extends VaultRepositoryBase implements EventRepository {
  constructor(
    private readonly calendars: CalendarRepository,
    calendarRepository: VaultCalendarRepository,
    report: typeof reportAlmanacGatewayIssue = reportAlmanacGatewayIssue,
  ) {
    super(calendarRepository.internalStore, report);
  }

  async listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<EventDTO>> {
    const schema = await this.requireCalendar(calendarId);
    const events = await this.read(state => listEvents(state, calendarId));
    if (!range) {
      return events;
    }
    const [start, end] =
      compareTimestampsWithSchema(schema, range.start, range.end) <= 0
        ? [range.start, range.end]
        : [range.end, range.start];
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const afterStart = compareTimestampsWithSchema(schema, anchor, start) >= 0;
      const beforeEnd = compareTimestampsWithSchema(schema, anchor, end) <= 0;
      return afterStart && beforeEnd;
    });
  }

  async listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<EventDTO>> {
    const schema = await this.requireCalendar(calendarId);
    const events = await this.read(state => listEvents(state, calendarId));
    return [...events]
      .sort((a, b) => {
        const aAnchor = getEventAnchorTimestamp(a) ?? a.date;
        const bAnchor = getEventAnchorTimestamp(b) ?? b.date;
        return compareTimestampsWithSchema(schema, aAnchor, bAnchor);
      })
      .slice(0, limit);
  }

  async createEvent(event: EventDTO): Promise<void> {
    await this.mutate(
      {
        operation: "event.repository.createEvent",
        scope: "event",
        context: { calendarId: event.calendarId, eventId: event.id },
        classify: classifyWithPattern(/already exists|not found/i),
      },
      state => applyEventCreation(state, event),
    );
  }

  async updateEvent(id: string, updates: Partial<EventDTO>): Promise<void> {
    await this.mutate(
      {
        operation: "event.repository.updateEvent",
        scope: "event",
        context: { eventId: id },
        classify: classifyWithPattern(/already exists|not found/i),
      },
      state => applyEventUpdate(state, id, updates),
    );
  }

  async deleteEvent(id: string): Promise<void> {
    await this.mutate(
      {
        operation: "event.repository.deleteEvent",
        scope: "event",
        context: { eventId: id },
        classify: classifyWithPattern(/already exists|not found/i),
      },
      state => applyEventDeletion(state, id),
    );
  }

  async getEventsInRange(
    calendarId: string,
    schema: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<ReadonlyArray<EventDTO>> {
    return this.listEvents(calendarId, { calendarId, start, end });
  }

  async getUpcomingEvents(
    calendarId: string,
    schema: CalendarSchema,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<ReadonlyArray<EventDTO>> {
    const events = await this.listEvents(calendarId);
    return events
      .filter(event => {
        const anchor = getEventAnchorTimestamp(event) ?? event.date;
        return compareTimestampsWithSchema(schema, anchor, from) >= 0;
      })
      .slice(0, limit);
  }

  private async requireCalendar(calendarId: string): Promise<CalendarSchemaDTO> {
    const calendar = await this.calendars.getCalendar(calendarId);
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }
    return calendar;
  }
}

export class VaultAlmanacRepository
  extends VaultRepositoryBase
  implements AlmanacRepository, PhenomenonRepository
{
  constructor(
    private readonly calendars: CalendarRepository & CalendarDefaultsRepository,
    calendarRepository: VaultCalendarRepository,
    report: typeof reportAlmanacGatewayIssue = reportAlmanacGatewayIssue,
  ) {
    super(calendarRepository.internalStore, report);
  }

  async listPhenomena(): Promise<PhenomenonDTO[]>;
  async listPhenomena(input: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<EventsDataBatchDTO>;
  async listPhenomena(
    input?: {
      readonly viewMode: string;
      readonly filters: EventsFilterState;
      readonly sort: EventsSort;
      readonly pagination?: EventsPaginationState;
    },
  ): Promise<PhenomenonDTO[] | EventsDataBatchDTO> {
    if (!input) {
      return this.read(state => listPhenomenaRaw(state));
    }
    const calendars = await this.calendars.listCalendars();
    return this.read(state => listPhenomenaBatch(state, calendars, input));
  }

  async getPhenomenon(id: string): Promise<PhenomenonDTO | null> {
    return this.read(state => state.phenomena.find(entry => entry.id === id) ?? null);
  }

  async upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO> {
    await this.mutate(
      {
        operation: "phenomenon.repository.upsert",
        scope: "phenomenon",
        context: { phenomenonId: draft.id },
        classify: classifyPhenomenonError,
      },
      state => {
        applyPhenomenonUpsert(state, draft);
      },
    );
    const stored = await this.getPhenomenon(draft.id);
    if (!stored) {
      throw new AlmanacRepositoryError("validation_error", `Phenomenon ${draft.id} disappeared during upsert`);
    }
    return stored;
  }

  async deletePhenomenon(id: string): Promise<void> {
    await this.mutate(
      {
        operation: "phenomenon.repository.delete",
        scope: "phenomenon",
        context: { phenomenonId: id },
        classify: classifyPhenomenonError,
      },
      state => applyPhenomenonDeletion(state, id),
    );
  }

  async updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO> {
    const calendars = await this.calendars.listCalendars();
    const calendarSet = new Set(calendars.map(calendar => calendar.id));
    const phenomenon = await this.getPhenomenon(update.phenomenonId);
    if (!phenomenon) {
      throw new AlmanacRepositoryError("validation_error", `Phenomenon ${update.phenomenonId} not found`);
    }
    const duplicates = findDuplicateCalendarIds(update.calendarLinks);
    if (duplicates.length > 0) {
      throw new AlmanacRepositoryError("phenomenon_conflict", "Calendar links contain duplicates", {
        duplicates,
      });
    }
    for (const link of update.calendarLinks) {
      if (!calendarSet.has(link.calendarId)) {
        throw new AlmanacRepositoryError("validation_error", `Calendar ${link.calendarId} not found`, {
          calendarId: link.calendarId,
        });
      }
    }
    if (phenomenon.rule.type === "astronomical") {
      const hasReference = Boolean(phenomenon.rule.referenceCalendarId);
      const hasHookReference = update.calendarLinks.some(link =>
        link.hook && typeof link.hook.config?.referenceCalendarId === "string",
      );
      if (!hasReference && !hasHookReference) {
        throw new AlmanacRepositoryError(
          "astronomy_source_missing",
          "Astronomical phenomena require a reference calendar",
        );
      }
    }
    await this.mutate(
      {
        operation: "phenomenon.repository.updateLinks",
        scope: "phenomenon",
        context: { phenomenonId: update.phenomenonId },
        classify: classifyPhenomenonError,
      },
      state => {
        const next = applyPhenomenonUpsert(state, phenomenon);
        const appliesToCalendarIds = update.calendarLinks.map(link => link.calendarId);
        const visibility = appliesToCalendarIds.length === 0 ? "all_calendars" : "selected";
        next.appliesToCalendarIds = appliesToCalendarIds;
        next.visibility = visibility;
        next.hooks = buildHooksFromLinks(update.calendarLinks, next);
        next.priority = update.calendarLinks.reduce((max, link) => Math.max(max, link.priority), next.priority);
      },
    );
    const stored = await this.getPhenomenon(update.phenomenonId);
    if (!stored) {
      throw new AlmanacRepositoryError(
        "validation_error",
        `Phenomenon ${update.phenomenonId} disappeared during update`,
      );
    }
    return stored;
  }

  async listTemplates(): Promise<ReadonlyArray<PhenomenonTemplateDTO>> {
    return this.read(state =>
      state.phenomena
        .filter(phenomenon => phenomenon.template)
        .map(phenomenon => ({
          id: phenomenon.id,
          name: phenomenon.name,
          category: phenomenon.category,
          rule: phenomenon.rule,
          effects: phenomenon.effects,
        })),
    );
  }
}


function classifyWithPattern(pattern: RegExp): (error: unknown) => string {
  return error => (error instanceof Error && pattern.test(error.message) ? "validation_error" : "io_error");
}

function classifyPhenomenonError(error: unknown): string {
  if (error instanceof AlmanacRepositoryError) {
    return error.code;
  }
  if (error instanceof Error && /not found|disappeared/i.test(error.message)) {
    return "validation_error";
  }
  return "io_error";
}

