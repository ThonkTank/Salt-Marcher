// src/workmodes/almanac/data/repositories.ts
// Unified Almanac persistence layer for calendars, events and phenomena.
// All repository implementations consolidated here after Wave 2.D cleanup.

// Re-export interfaces and types
export type {
  CalendarDefaultSnapshot,
  CalendarDefaultScope,
  CalendarDefaultUpdate,
  CalendarRepository,
  CalendarDefaultsRepository,
  EventRepository,
  AlmanacRepositoryErrorCode,
  AlmanacRepositoryErrorDetails,
  AlmanacRepository,
  PhenomenonRepository,
  PhenomenonSummaryEntry,
  PhenomenonSummaryComparator,
  PhenomenonFilterOptions,
  PhenomenonSortOptions,
} from "./repository-interfaces";

export { AlmanacRepositoryError } from "./repository-interfaces";

// For now, keep the original file content until we fully split it
// TODO: Complete the split by extracting implementations

import {
  compareTimestampsWithSchema,
  computeNextPhenomenonOccurrence,
  createDayTimestamp,
  formatTimestamp,
  getEventAnchorTimestamp,
  isPhenomenonVisibleForCalendar,
  type CalendarEvent,
  type CalendarSchema,
  type CalendarTimestamp,
} from "../helpers";
import type { CalendarSchemaDTO } from "./dto";
import { reportAlmanacGatewayIssue } from "../telemetry";
import { JsonStore, type VaultLike } from "./json-store";
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
import type {
  AlmanacPreferencesSnapshot,
  EventsFilterState,
} from "../mode/contracts";
import type {
  AlmanacRepository as IAlmanacRepository,
  CalendarDefaultSnapshot,
  CalendarDefaultUpdate,
  CalendarDefaultsRepository,
  CalendarRepository,
  EventRepository,
  PhenomenonFilterOptions,
  PhenomenonRepository as IPhenomenonRepository,
  PhenomenonSortOptions,
  PhenomenonSummaryEntry,
} from "./repository-interfaces";

const PHENOMENON_PAGE_SIZE = 50;

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

    const tieBreak = options.fallbackComparator?.(a, b) ?? 0;
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
    preferences: {},
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
    // Only include non-null values - deleted defaults should not appear in snapshot
    if (calendarId !== null) {
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
  const calendar = ensureCalendar(state, id);
  Object.assign(calendar, updates);
}

function applyCalendarDeletion(state: AlmanacStoreState, id: string): void {
  const index = state.calendars.findIndex(calendar => calendar.id === id);
  if (index === -1) {
    throw new Error(`Calendar with ID ${id} not found`);
  }
  state.calendars.splice(index, 1);
  if (state.defaults.global === id) {
    state.defaults.global = null;
  }
  for (const travelId of Object.keys(state.defaults.travel)) {
    if (state.defaults.travel[travelId] === id) {
      state.defaults.travel[travelId] = null;
    }
  }
  delete state.eventsByCalendar[id];
  for (let i = 0; i < state.phenomena.length; i++) {
    const phenomenon = state.phenomena[i];
    state.phenomena[i] = {
      ...phenomenon,
      appliesToCalendarIds: phenomenon.appliesToCalendarIds.filter(cid => cid !== id),
    };
  }
}

function applyDefaultUpdate(state: AlmanacStoreState, input: CalendarDefaultUpdate): void {
  if (input.scope === "global") {
    state.defaults.global = input.calendarId;
  } else if (input.scope === "travel" && input.travelId) {
    state.defaults.travel[input.travelId] = input.calendarId;
  }
}

function getEvents(state: AlmanacStoreState, calendarId: string): EventDTO[] {
  return state.eventsByCalendar[calendarId] ?? [];
}

function setEvents(state: AlmanacStoreState, calendarId: string, events: EventDTO[]): void {
  state.eventsByCalendar[calendarId] = events;
}

function applyEventCreation(state: AlmanacStoreState, event: EventDTO): void {
  const events = getEvents(state, event.calendarId);
  if (events.some(existing => existing.id === event.id)) {
    throw new Error(`Event with ID ${event.id} already exists`);
  }
  setEvents(state, event.calendarId, [...events, event]);
}

function applyEventUpdate(state: AlmanacStoreState, id: string, updates: Partial<EventDTO>): void {
  let found = false;
  for (const [calendarId, events] of Object.entries(state.eventsByCalendar)) {
    const event = events.find(e => e.id === id);
    if (event) {
      Object.assign(event, updates);
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error(`Event with ID ${id} not found`);
  }
}

function applyEventDeletion(state: AlmanacStoreState, id: string): void {
  let found = false;
  for (const [calendarId, events] of Object.entries(state.eventsByCalendar)) {
    const index = events.findIndex(e => e.id === id);
    if (index !== -1) {
      events.splice(index, 1);
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error(`Event with ID ${id} not found`);
  }
}

function applyPhenomenonUpsert(state: AlmanacStoreState, draft: PhenomenonDTO): void {
  const index = state.phenomena.findIndex(p => p.id === draft.id);
  if (index !== -1) {
    state.phenomena[index] = draft;
  } else {
    state.phenomena.push(draft);
  }
}

function applyPhenomenonDeletion(state: AlmanacStoreState, id: string): void {
  const index = state.phenomena.findIndex(p => p.id === id);
  if (index === -1) {
    throw new Error(`Phenomenon with ID ${id} not found`);
  }
  state.phenomena.splice(index, 1);
}

// --  Almanac Memory Backend -------------------------------------------------

export class AlmanacMemoryBackend {
  private readonly store = new InMemoryStore();

  async getPreferences(): Promise<AlmanacPreferencesSnapshot> {
    const state = this.store.read();
    return state.preferences;
  }

  async savePreferences(partial: Partial<AlmanacPreferencesSnapshot>): Promise<void> {
    this.store.update(state => {
      Object.assign(state.preferences, partial);
    });
  }

  async getTravelLeafPreferences(travelId: string): Promise<TravelLeafPreferencesSnapshot | null> {
    const state = this.store.read();
    return state.travelLeaf[travelId] ?? null;
  }

  async saveTravelLeafPreferences(travelId: string, prefs: TravelLeafPreferencesSnapshot): Promise<void> {
    this.store.update(state => {
      state.travelLeaf[travelId] = prefs;
    });
  }

  async listCalendars(): Promise<CalendarSchemaDTO[]> {
    const state = this.store.read();
    return listCalendars(state);
  }

  async getCalendar(id: string): Promise<CalendarSchemaDTO | null> {
    const state = this.store.read();
    return getCalendar(state, id);
  }

  async createCalendar(input: CalendarSchemaDTO & { isDefaultGlobal?: boolean }): Promise<void> {
    this.store.update(state => {
      applyCalendarCreation(state, input);
    });
  }

  async updateCalendar(id: string, updates: Partial<CalendarSchemaDTO>): Promise<void> {
    this.store.update(state => {
      applyCalendarUpdate(state, id, updates);
    });
  }

  async deleteCalendar(id: string): Promise<void> {
    this.store.update(state => {
      applyCalendarDeletion(state, id);
    });
  }

  async setDefault(input: CalendarDefaultUpdate): Promise<void> {
    this.store.update(state => {
      applyDefaultUpdate(state, input);
    });
  }

  async getDefaults(): Promise<CalendarDefaultSnapshot> {
    const state = this.store.read();
    return sanitiseDefaults(state.defaults);
  }

  async getGlobalDefault(): Promise<string | null> {
    const state = this.store.read();
    return state.defaults.global;
  }

  async getTravelDefault(travelId: string): Promise<string | null> {
    const state = this.store.read();
    return state.defaults.travel[travelId] ?? null;
  }

  async clearTravelDefault(travelId: string): Promise<void> {
    this.store.update(state => {
      state.defaults.travel[travelId] = null;
    });
  }

  async listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<EventDTO[]> {
    const state = this.store.read();
    const events = getEvents(state, calendarId);
    if (!range) {
      return events;
    }
    const calendar = getCalendar(state, calendarId);
    if (!calendar) {
      return [];
    }
    const start = createDayTimestamp(calendar.id, range.start.year, range.start.monthId, range.start.day);
    const end = createDayTimestamp(calendar.id, range.end.year, range.end.monthId, range.end.day);
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event);
      if (!anchor) return false;
      return compareTimestampsWithSchema(calendar, anchor, start) >= 0 &&
             compareTimestampsWithSchema(calendar, anchor, end) <= 0;
    });
  }

  async listUpcoming(calendarId: string, limit: number): Promise<EventDTO[]> {
    const state = this.store.read();
    const events = getEvents(state, calendarId);
    return events.slice(0, limit);
  }

  async createEvent(event: EventDTO): Promise<void> {
    this.store.update(state => {
      applyEventCreation(state, event);
    });
  }

  async updateEvent(id: string, updates: Partial<EventDTO>): Promise<void> {
    this.store.update(state => {
      applyEventUpdate(state, id, updates);
    });
  }

  async deleteEvent(id: string): Promise<void> {
    this.store.update(state => {
      applyEventDeletion(state, id);
    });
  }

  async listPhenomena(): Promise<PhenomenonDTO[]> {
    const state = this.store.read();
    return state.phenomena;
  }

  async getPhenomenon(id: string): Promise<PhenomenonDTO | null> {
    const state = this.store.read();
    return state.phenomena.find(p => p.id === id) ?? null;
  }

  async upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO> {
    this.store.update(state => {
      applyPhenomenonUpsert(state, draft);
    });
    return draft;
  }

  async deletePhenomenon(id: string): Promise<void> {
    this.store.update(state => {
      applyPhenomenonDeletion(state, id);
    });
  }

  /**
   * Seed calendar data for testing
   * @param calendars - Array of calendar schemas to seed
   */
  seedCalendars(calendars: CalendarSchema[]): void {
    this.store.update(state => {
      state.calendars = calendars.map(calendar => ({ ...calendar }));
    });
  }

  /**
   * Seed event data for testing
   * @param events - Array of calendar events to seed
   */
  seedEvents(events: CalendarEvent[]): void {
    this.store.update(state => {
      state.eventsByCalendar = {};
      for (const event of events) {
        applyEventCreation(state, event);
      }
    });
  }

  /**
   * Seed phenomenon data for testing
   * @param phenomena - Array of phenomena to seed
   */
  seedPhenomena(phenomena: PhenomenonDTO[]): void {
    this.store.update(state => {
      state.phenomena = phenomena.map(p => ({ ...p }));
    });
  }
}

// -- In-memory repository implementations ------------------------------------

export class InMemoryCalendarRepository
  implements CalendarRepository, CalendarDefaultsRepository
{
  constructor(private readonly backend: AlmanacMemoryBackend) {}

  async listCalendars(): Promise<CalendarSchemaDTO[]> {
    return this.backend.listCalendars();
  }

  async getCalendar(id: string): Promise<CalendarSchemaDTO | null> {
    return this.backend.getCalendar(id);
  }

  async createCalendar(input: CalendarSchemaDTO & { isDefaultGlobal?: boolean }): Promise<void> {
    await this.backend.createCalendar(input);
  }

  async updateCalendar(id: string, updates: Partial<CalendarSchemaDTO>): Promise<void> {
    await this.backend.updateCalendar(id, updates);
  }

  async deleteCalendar(id: string): Promise<void> {
    await this.backend.deleteCalendar(id);
  }

  async setDefault(input: CalendarDefaultUpdate): Promise<void> {
    await this.backend.setDefault(input);
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
    await this.backend.clearTravelDefault(travelId);
  }

  /**
   * Convenience method: Set global default calendar
   * Wrapper around setDefault({ calendarId, scope: 'global' })
   */
  async setGlobalDefault(calendarId: string): Promise<void> {
    await this.setDefault({ calendarId, scope: "global" });
  }

  /**
   * Convenience method: Set travel-specific default calendar
   * Wrapper around setDefault({ calendarId, scope: 'travel', travelId })
   */
  async setTravelDefault(calendarId: string, travelId: string): Promise<void> {
    await this.setDefault({ calendarId, scope: "travel", travelId });
  }

  /**
   * Convenience method: Get global default calendar (alias for getGlobalDefault)
   * Returns calendar ID or null
   */
  async getGlobalDefaultCalendar(): Promise<string | null> {
    return this.getGlobalDefault();
  }

  /**
   * Seed calendar data for testing
   * @param calendars - Array of calendar schemas to seed
   */
  seed(calendars: CalendarSchema[]): void {
    this.backend.seedCalendars(calendars);
  }
}

export class InMemoryEventRepository implements EventRepository {
  constructor(private readonly backend: AlmanacMemoryBackend) {}

  async listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<EventDTO[]> {
    return this.backend.listEvents(calendarId, range);
  }

  async listUpcoming(calendarId: string, limit: number): Promise<EventDTO[]> {
    return this.backend.listUpcoming(calendarId, limit);
  }

  async createEvent(event: EventDTO): Promise<void> {
    await this.backend.createEvent(event);
  }

  async updateEvent(id: string, updates: Partial<EventDTO>): Promise<void> {
    await this.backend.updateEvent(id, updates);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.backend.deleteEvent(id);
  }

  /**
   * Get upcoming events from a starting point (domain layer method)
   * This method is called by AlmanacStateMachine and expects CalendarEvent domain objects
   */
  async getUpcomingEvents(
    calendarId: string,
    _calendar: import("../helpers").CalendarSchema,
    _from: import("../helpers").CalendarTimestamp,
    limit: number
  ): Promise<ReadonlyArray<import("../helpers").CalendarEvent>> {
    // Use listUpcoming which returns DTOs, then convert to domain objects
    const dtos = await this.listUpcoming(calendarId, limit);
    // DTOs are already domain-compatible for testing purposes
    return dtos as unknown as ReadonlyArray<import("../helpers").CalendarEvent>;
  }

  /**
   * Get events within a date range (domain layer method)
   * This method is called by AlmanacStateMachine and expects CalendarEvent domain objects
   */
  async getEventsInRange(
    calendarId: string,
    _calendar: import("../helpers").CalendarSchema,
    _start: import("../helpers").CalendarTimestamp,
    _end: import("../helpers").CalendarTimestamp
  ): Promise<ReadonlyArray<import("../helpers").CalendarEvent>> {
    // Use listEvents which returns all events (range filtering not implemented in mock)
    const dtos = await this.listEvents(calendarId);
    // DTOs are already domain-compatible for testing purposes
    return dtos as unknown as ReadonlyArray<import("../helpers").CalendarEvent>;
  }

  /**
   * Seed event data for testing
   * @param events - Array of calendar events to seed
   */
  seed(events: CalendarEvent[]): void {
    this.backend.seedEvents(events);
  }
}

export class InMemoryPhenomenonRepository implements IAlmanacRepository, IPhenomenonRepository {
  constructor(
    private readonly backend: AlmanacMemoryBackend,
    private readonly calendars: CalendarRepository,
  ) {}

  /**
   * List all phenomena (simple version for PhenomenonRepository interface)
   * @returns All phenomena without filtering or pagination
   */
  async listPhenomena(): Promise<ReadonlyArray<PhenomenonDTO>>;
  /**
   * List phenomena with filtering, sorting, and pagination (AlmanacRepository interface)
   */
  async listPhenomena(input: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<EventsDataBatchDTO>;
  /**
   * Implementation that handles both overloads
   */
  async listPhenomena(input?: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<ReadonlyArray<PhenomenonDTO> | EventsDataBatchDTO> {
    const allPhenomena = await this.backend.listPhenomena();

    // Simple version: return all phenomena without filtering/pagination
    if (!input) {
      return allPhenomena;
    }

    // Complex version: filter, sort, and paginate
    const allCalendars = await this.calendars.listCalendars();

    const resolveVisibleCalendars = (phenomenon: PhenomenonDTO): string[] => {
      if (phenomenon.visibility === "all_calendars") {
        return allCalendars.map(c => c.id);
      }
      return [...phenomenon.appliesToCalendarIds];
    };

    const filtered = allPhenomena
      .filter(p => matchesPhenomenonFilters(p, input.filters, { resolveVisibleCalendars }))
      .map(phenomenon => ({
        phenomenon,
        summary: {
          id: phenomenon.id,
          name: phenomenon.name,
          category: phenomenon.category,
        } as PhenomenonSummaryDTO,
      }));

    const sorted = sortPhenomenonSummaries(filtered, input.sort || "name_asc");
    const paginated = paginatePhenomena(sorted, input.pagination);

    return {
      items: paginated.items.map(entry => entry.summary),
      pagination: {
        cursor: paginated.nextCursor,
        hasMore: !!paginated.nextCursor,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getPhenomenon(id: string): Promise<PhenomenonDTO | null> {
    return this.backend.getPhenomenon(id);
  }

  async upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO> {
    return this.backend.upsertPhenomenon(draft);
  }

  async deletePhenomenon(id: string): Promise<void> {
    await this.backend.deletePhenomenon(id);
  }

  async updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO> {
    const phenomenon = await this.getPhenomenon(update.phenomenonId);
    if (!phenomenon) {
      throw new Error(`Phenomenon ${update.phenomenonId} not found`);
    }

    const duplicates = findDuplicateCalendarIds(update.calendarLinks);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate calendar IDs: ${duplicates.join(", ")}`);
    }

    const updated: PhenomenonDTO = {
      ...phenomenon,
      appliesToCalendarIds: update.calendarLinks.map(link => link.calendarId),
    };

    return this.backend.upsertPhenomenon(updated);
  }

  async listTemplates(): Promise<PhenomenonTemplateDTO[]> {
    return [];
  }

  /**
   * Seed phenomenon data for testing
   * @param phenomena - Array of phenomena to seed
   */
  seed(phenomena: PhenomenonDTO[]): void {
    this.backend.seedPhenomena(phenomena);
  }
}

// -- Vault repository implementations ----------------------------------------

export class VaultCalendarRepository implements CalendarRepository, CalendarDefaultsRepository {
  private readonly store: VaultStore;

  constructor(vault: VaultLike) {
    this.store = new VaultStore(vault);
  }

  /** Expose store for sharing with other repositories */
  get sharedStore(): VaultStore {
    return this.store;
  }

  async listCalendars(): Promise<CalendarSchemaDTO[]> {
    const state = await this.store.read();
    return listCalendars(state);
  }

  async getCalendar(id: string): Promise<CalendarSchemaDTO | null> {
    const state = await this.store.read();
    return getCalendar(state, id);
  }

  async createCalendar(input: CalendarSchemaDTO & { isDefaultGlobal?: boolean }): Promise<void> {
    await this.store.update(state => {
      applyCalendarCreation(state, input);
    });
  }

  async updateCalendar(id: string, updates: Partial<CalendarSchemaDTO>): Promise<void> {
    await this.store.update(state => {
      applyCalendarUpdate(state, id, updates);
    });
  }

  async deleteCalendar(id: string): Promise<void> {
    await this.store.update(state => {
      applyCalendarDeletion(state, id);
    });
  }

  async setDefault(input: CalendarDefaultUpdate): Promise<void> {
    await this.store.update(state => {
      applyDefaultUpdate(state, input);
    });
  }

  async getDefaults(): Promise<CalendarDefaultSnapshot> {
    const state = await this.store.read();
    return sanitiseDefaults(state.defaults);
  }

  async getGlobalDefault(): Promise<string | null> {
    const state = await this.store.read();
    return state.defaults.global;
  }

  async getTravelDefault(travelId: string): Promise<string | null> {
    const state = await this.store.read();
    return state.defaults.travel[travelId] ?? null;
  }

  async clearTravelDefault(travelId: string): Promise<void> {
    await this.store.update(state => {
      state.defaults.travel[travelId] = null;
    });
  }
}

export class VaultEventRepository implements EventRepository {
  private readonly store: VaultStore;

  constructor(calendarRepository: VaultCalendarRepository) {
    this.store = calendarRepository.sharedStore;
  }

  async listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<EventDTO[]> {
    const state = await this.store.read();
    const events = getEvents(state, calendarId);
    if (!range) {
      return events;
    }
    const calendar = getCalendar(state, calendarId);
    if (!calendar) {
      return [];
    }
    const start = createDayTimestamp(calendar.id, range.start.year, range.start.monthId, range.start.day);
    const end = createDayTimestamp(calendar.id, range.end.year, range.end.monthId, range.end.day);
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event);
      if (!anchor) return false;
      return compareTimestampsWithSchema(calendar, anchor, start) >= 0 &&
             compareTimestampsWithSchema(calendar, anchor, end) <= 0;
    });
  }

  async listUpcoming(calendarId: string, limit: number): Promise<EventDTO[]> {
    const state = await this.store.read();
    const events = getEvents(state, calendarId);
    return events.slice(0, limit);
  }

  async createEvent(event: EventDTO): Promise<void> {
    await this.store.update(state => {
      applyEventCreation(state, event);
    });
  }

  async updateEvent(id: string, updates: Partial<EventDTO>): Promise<void> {
    await this.store.update(state => {
      applyEventUpdate(state, id, updates);
    });
  }

  async deleteEvent(id: string): Promise<void> {
    await this.store.update(state => {
      applyEventDeletion(state, id);
    });
  }
}

export class VaultAlmanacRepository implements IAlmanacRepository {
  private readonly store: VaultStore;

  constructor(
    calendarRepository: VaultCalendarRepository,
    private readonly calendars: CalendarRepository,
  ) {
    this.store = calendarRepository.sharedStore;
  }

  async listPhenomena(input: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<EventsDataBatchDTO> {
    const state = await this.store.read();
    const allPhenomena = state.phenomena;
    const allCalendars = await this.calendars.listCalendars();

    const resolveVisibleCalendars = (phenomenon: PhenomenonDTO): string[] => {
      if (phenomenon.visibility === "all_calendars") {
        return allCalendars.map(c => c.id);
      }
      return [...phenomenon.appliesToCalendarIds];
    };

    const filtered = allPhenomena
      .filter(p => matchesPhenomenonFilters(p, input.filters, { resolveVisibleCalendars }))
      .map(phenomenon => ({
        phenomenon,
        summary: {
          id: phenomenon.id,
          name: phenomenon.name,
          category: phenomenon.category,
        } as PhenomenonSummaryDTO,
      }));

    const sorted = sortPhenomenonSummaries(filtered, input.sort);
    const paginated = paginatePhenomena(sorted, input.pagination);

    return {
      items: paginated.items.map(entry => entry.summary),
      pagination: {
        cursor: paginated.nextCursor,
        hasMore: !!paginated.nextCursor,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getPhenomenon(id: string): Promise<PhenomenonDTO | null> {
    const state = await this.store.read();
    return state.phenomena.find(p => p.id === id) ?? null;
  }

  async upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO> {
    await this.store.update(state => {
      applyPhenomenonUpsert(state, draft);
    });
    return draft;
  }

  async deletePhenomenon(id: string): Promise<void> {
    await this.store.update(state => {
      applyPhenomenonDeletion(state, id);
    });
  }

  async updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO> {
    const phenomenon = await this.getPhenomenon(update.phenomenonId);
    if (!phenomenon) {
      throw new Error(`Phenomenon ${update.phenomenonId} not found`);
    }

    const duplicates = findDuplicateCalendarIds(update.calendarLinks);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate calendar IDs: ${duplicates.join(", ")}`);
    }

    const updated: PhenomenonDTO = {
      ...phenomenon,
      appliesToCalendarIds: update.calendarLinks.map(link => link.calendarId),
    };

    await this.upsertPhenomenon(updated);
    return updated;
  }

  async listTemplates(): Promise<PhenomenonTemplateDTO[]> {
    return [];
  }
}
