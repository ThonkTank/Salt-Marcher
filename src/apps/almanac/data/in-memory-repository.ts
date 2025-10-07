// src/apps/almanac/data/in-memory-repository.ts
// Lightweight in-memory repositories for calendars, events and phenomena.

/**
 * In-Memory Calendar Repository
 *
 * Simple map-based repository for MVP testing.
 * Stores calendars and events in memory without file persistence.
 */

import type { CalendarSchema } from "../domain/calendar-schema";
import type { CalendarEvent } from "../domain/calendar-event";
import { getEventAnchorTimestamp } from "../domain/calendar-event";
import type { CalendarTimestamp } from "../domain/calendar-timestamp";
import { compareTimestampsWithSchema } from "../domain/calendar-timestamp";
import type { EventsFilterState } from "../mode/contracts";
import type {
  CalendarSchemaDTO,
  CalendarEventDTO,
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
  CalendarDefaultsRepository,
  CalendarRepository as CalendarRepositoryContract,
  CalendarDefaultSnapshot,
  CalendarDefaultUpdate,
} from "./calendar-repository";
import type { EventRepository as EventRepositoryContract } from "./event-repository";
import {
  AlmanacRepositoryError,
  type AlmanacRepository,
} from "./almanac-repository";

function cloneCalendar(schema: CalendarSchemaDTO, defaults: CalendarDefaultSnapshot): CalendarSchemaDTO {
  return {
    ...schema,
    isDefaultGlobal: defaults.global === schema.id,
    defaultTravelIds: Object.entries(defaults.travel)
      .filter(([, calendarId]) => calendarId === schema.id)
      .map(([travelId]) => travelId),
  };
}

function toDefaultsSnapshot(global: string | null, travelDefaults: Map<string, string | null>): CalendarDefaultSnapshot {
  const travel: Record<string, string | null> = {};
  for (const [travelId, calendarId] of travelDefaults.entries()) {
    if (calendarId) {
      travel[travelId] = calendarId;
    }
  }
  return { global, travel };
}

export class InMemoryCalendarRepository
  implements CalendarRepositoryContract, CalendarDefaultsRepository
{
  private calendars: Map<string, CalendarSchemaDTO> = new Map();
  private globalDefault: string | null = null;
  private travelDefaults: Map<string, string | null> = new Map();

  async listCalendars(): Promise<ReadonlyArray<CalendarSchemaDTO>> {
    const snapshot = toDefaultsSnapshot(this.globalDefault, this.travelDefaults);
    return Array.from(this.calendars.values()).map(calendar => cloneCalendar(calendar, snapshot));
  }

  async getCalendar(id: string): Promise<CalendarSchemaDTO | null> {
    const calendar = this.calendars.get(id);
    if (!calendar) {
      return null;
    }
    const snapshot = toDefaultsSnapshot(this.globalDefault, this.travelDefaults);
    return cloneCalendar(calendar, snapshot);
  }

  async createCalendar(input: CalendarSchemaDTO & { readonly isDefaultGlobal?: boolean }): Promise<void> {
    if (this.calendars.has(input.id)) {
      throw new Error(`Calendar with ID ${input.id} already exists`);
    }
    this.calendars.set(input.id, { ...input });
    if (input.isDefaultGlobal) {
      this.globalDefault = input.id;
    }
  }

  async updateCalendar(id: string, updates: Partial<CalendarSchemaDTO>): Promise<void> {
    const existing = this.calendars.get(id);
    if (!existing) {
      throw new Error(`Calendar with ID ${id} not found`);
    }
    this.calendars.set(id, { ...existing, ...updates });
    if (updates.isDefaultGlobal) {
      this.globalDefault = id;
    } else if (updates.isDefaultGlobal === false && this.globalDefault === id) {
      this.globalDefault = null;
    }
  }

  async deleteCalendar(id: string): Promise<void> {
    if (!this.calendars.delete(id)) {
      throw new Error(`Calendar with ID ${id} not found`);
    }
    if (this.globalDefault === id) {
      this.globalDefault = null;
    }
    for (const [travelId, calendarId] of this.travelDefaults.entries()) {
      if (calendarId === id) {
        this.travelDefaults.delete(travelId);
      }
    }
  }

  async setDefault(input: CalendarDefaultUpdate): Promise<void> {
    if (!this.calendars.has(input.calendarId)) {
      throw new Error(`Calendar with ID ${input.calendarId} not found`);
    }
    if (input.scope === "global") {
      this.globalDefault = input.calendarId;
      return;
    }
    if (!input.travelId) {
      throw new Error("Travel ID required for travel scope");
    }
    this.travelDefaults.set(input.travelId, input.calendarId);
  }

  async getDefaults(): Promise<CalendarDefaultSnapshot> {
    return toDefaultsSnapshot(this.globalDefault, this.travelDefaults);
  }

  async getGlobalDefault(): Promise<string | null> {
    return this.globalDefault;
  }

  async getTravelDefault(travelId: string): Promise<string | null> {
    return this.travelDefaults.get(travelId) ?? null;
  }

  async clearTravelDefault(travelId: string): Promise<void> {
    this.travelDefaults.delete(travelId);
  }

  async setGlobalDefault(calendarId: string): Promise<void> {
    await this.setDefault({ calendarId, scope: "global" });
  }

  async setTravelDefault(travelId: string, calendarId: string): Promise<void> {
    await this.setDefault({ calendarId, scope: "travel", travelId });
  }

  async getGlobalDefaultCalendar(): Promise<CalendarSchemaDTO | null> {
    const id = await this.getGlobalDefault();
    return id ? this.getCalendar(id) : null;
  }

  seed(schemas: CalendarSchema[]): void {
    schemas.forEach(schema => {
      this.calendars.set(schema.id, schema);
      if (schema.isDefaultGlobal) {
        this.globalDefault = schema.id;
      }
    });
  }

  clear(): void {
    this.calendars.clear();
    this.travelDefaults.clear();
    this.globalDefault = null;
  }
}

export class InMemoryEventRepository implements EventRepositoryContract {
  private events: Map<string, CalendarEventDTO> = new Map();
  private resolveSchema: (calendarId: string) => Promise<CalendarSchema | null> | CalendarSchema | null;

  constructor(
    resolver?: (calendarId: string) => Promise<CalendarSchema | null> | CalendarSchema | null,
  ) {
    this.resolveSchema = resolver ?? (() => null);
  }

  bindCalendarRepository(repository: { getCalendar(id: string): Promise<CalendarSchemaDTO | null> }): void {
    this.resolveSchema = async (id: string) => {
      const calendar = await repository.getCalendar(id);
      return calendar ?? null;
    };
  }

  async listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<CalendarEventDTO>> {
    const schema = await this.requireSchema(calendarId);
    const events = this.collectForCalendar(calendarId, schema);
    if (!range) {
      return events;
    }
    const start = range.start;
    const end = range.end;
    const rangeStart = compareTimestampsWithSchema(schema, start, end) <= 0 ? start : end;
    const rangeEnd = rangeStart === start ? end : start;
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const afterStart = compareTimestampsWithSchema(schema, anchor, rangeStart) >= 0;
      const beforeEnd = compareTimestampsWithSchema(schema, anchor, rangeEnd) <= 0;
      return afterStart && beforeEnd;
    });
  }

  async listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<CalendarEventDTO>> {
    const schema = await this.requireSchema(calendarId);
    return this.collectForCalendar(calendarId, schema).slice(0, limit);
  }

  async createEvent(event: CalendarEventDTO): Promise<void> {
    if (this.events.has(event.id)) {
      throw new Error(`Event with ID ${event.id} already exists`);
    }
    this.events.set(event.id, event);
  }

  async updateEvent(id: string, updates: Partial<CalendarEventDTO>): Promise<void> {
    const existing = this.events.get(id);
    if (!existing) {
      throw new Error(`Event with ID ${id} not found`);
    }
    this.events.set(id, { ...existing, ...updates });
  }

  async deleteEvent(id: string): Promise<void> {
    if (!this.events.delete(id)) {
      throw new Error(`Event with ID ${id} not found`);
    }
  }

  async getEventsInRange(
    calendarId: string,
    schema: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<CalendarEventDTO[]> {
    const range: CalendarRangeDTO = { calendarId, start, end };
    return this.listEvents(calendarId, range);
  }

  async getUpcomingEvents(
    calendarId: string,
    schema: CalendarSchema,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<CalendarEventDTO[]> {
    const events = await this.listEvents(calendarId);
    return events
      .filter(event => compareTimestampsWithSchema(schema, getEventAnchorTimestamp(event) ?? event.date, from) >= 0)
      .slice(0, limit);
  }

  seed(events: CalendarEvent[]): void {
    events.forEach(event => {
      this.events.set(event.id, event);
    });
  }

  clear(): void {
    this.events.clear();
  }

  private async requireSchema(calendarId: string): Promise<CalendarSchema> {
    const resolved = await this.resolveSchema(calendarId);
    if (!resolved) {
      throw new Error(`Calendar schema for ${calendarId} not available`);
    }
    return resolved;
  }

  private collectForCalendar(calendarId: string, schema: CalendarSchema): CalendarEventDTO[] {
    return Array.from(this.events.values())
      .filter(event => event.calendarId === calendarId)
      .sort((a, b) => {
        const left = getEventAnchorTimestamp(a) ?? a.date;
        const right = getEventAnchorTimestamp(b) ?? b.date;
        return compareTimestampsWithSchema(schema, left, right);
      });
  }
}

export interface PhenomenonRepository {
  listPhenomena(): Promise<PhenomenonDTO[]>;
  getPhenomenon(id: string): Promise<PhenomenonDTO | null>;
  upsertPhenomenon(phenomenon: PhenomenonDTO): Promise<void>;
  deletePhenomenon(id: string): Promise<void>;
}

const DEFAULT_PAGE_SIZE = 25;

export class InMemoryPhenomenonRepository implements AlmanacRepository, PhenomenonRepository {
  private phenomena: Map<string, PhenomenonDTO> = new Map();

  async listPhenomena(): Promise<PhenomenonDTO[]>;
  async listPhenomena(input: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<EventsDataBatchDTO>;
  async listPhenomena(input?: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<PhenomenonDTO[] | EventsDataBatchDTO> {
    if (!input) {
      return Array.from(this.phenomena.values()).map(phenomenon => ({ ...phenomenon }));
    }
    const filters = input.filters;
    const filtered = Array.from(this.phenomena.values()).filter(phenomenon => matchesPhenomenonFilters(phenomenon, filters));
    const summaries = filtered.map(phenomenon => toSummary(phenomenon));
    const sorted = sortSummariesForInMemory(filtered, summaries, input.sort);
    const { items, nextCursor } = paginate(sorted, input.pagination ?? { limit: DEFAULT_PAGE_SIZE });

    return {
      items: items.map(entry => entry.summary),
      pagination: { cursor: nextCursor, hasMore: nextCursor !== undefined },
      generatedAt: new Date().toISOString(),
    };
  }

  async getPhenomenon(id: string): Promise<PhenomenonDTO | null> {
    const phenomenon = this.phenomena.get(id);
    return phenomenon ? { ...phenomenon } : null;
  }

  async upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO> {
    this.phenomena.set(draft.id, { ...draft });
    const stored = this.phenomena.get(draft.id);
    if (!stored) {
      throw new Error(`Failed to upsert phenomenon ${draft.id}`);
    }
    return { ...stored };
  }

  async deletePhenomenon(id: string): Promise<void> {
    if (!this.phenomena.delete(id)) {
      throw new Error(`Phenomenon with ID ${id} not found`);
    }
  }

  async updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO> {
    const existing = this.phenomena.get(update.phenomenonId);
    if (!existing) {
      throw new AlmanacRepositoryError("validation_error", `Phenomenon ${update.phenomenonId} not found`);
    }
    const duplicates = findDuplicateCalendarIds(update.calendarLinks);
    if (duplicates.length) {
      throw new AlmanacRepositoryError("phenomenon_conflict", "Duplicate calendar links", { duplicates });
    }
    if (existing.rule.type === "astronomical") {
      const hasReference = Boolean(existing.rule.astronomical?.referenceCalendarId);
      const hasHookReference = update.calendarLinks.some(link =>
        typeof link.hook?.config?.referenceCalendarId === "string",
      );
      if (!hasReference && !hasHookReference) {
        throw new AlmanacRepositoryError(
          "astronomy_source_missing",
          "Astronomical phenomena require a reference calendar",
        );
      }
    }
    const appliesToCalendarIds = update.calendarLinks.map(link => link.calendarId);
    const visibility = appliesToCalendarIds.length ? "selected" : "all_calendars";
    const hooks = update.calendarLinks
      .filter(link => Boolean(link.hook))
      .map(link => ({ ...link.hook!, priority: link.priority }));
    const priority = update.calendarLinks.reduce((max, link) => Math.max(max, link.priority), existing.priority);
    const updated: PhenomenonDTO = {
      ...existing,
      appliesToCalendarIds,
      visibility,
      hooks: hooks.length ? hooks : existing.hooks,
      priority,
    };
    this.phenomena.set(existing.id, updated);
    return { ...updated };
  }

  async listTemplates(): Promise<ReadonlyArray<PhenomenonTemplateDTO>> {
    return Array.from(this.phenomena.values())
      .filter(phenomenon => phenomenon.template)
      .map(phenomenon => ({
        id: phenomenon.id,
        name: phenomenon.name,
        category: phenomenon.category,
        rule: phenomenon.rule,
        effects: phenomenon.effects,
      }));
  }

  seed(phenomena: PhenomenonDTO[]): void {
    phenomena.forEach(phenomenon => {
      this.phenomena.set(phenomenon.id, { ...phenomenon });
    });
  }

  clear(): void {
    this.phenomena.clear();
  }
}

function matchesPhenomenonFilters(phenomenon: PhenomenonDTO, filters: EventsFilterState): boolean {
  if (filters.categories?.length && !filters.categories.includes(phenomenon.category)) {
    return false;
  }
  if (filters.calendarIds?.length) {
    if (phenomenon.visibility === "selected") {
      return phenomenon.appliesToCalendarIds.some(id => filters.calendarIds.includes(id));
    }
    return true;
  }
  return true;
}

function toSummary(phenomenon: PhenomenonDTO): PhenomenonSummaryDTO {
  return {
    id: phenomenon.id,
    name: phenomenon.name,
    category: phenomenon.category,
    linkedCalendars: phenomenon.appliesToCalendarIds,
    badge: phenomenon.tags?.[0],
  };
}

function sortSummariesForInMemory(
  phenomena: ReadonlyArray<PhenomenonDTO>,
  summaries: ReadonlyArray<PhenomenonSummaryDTO>,
  sort: EventsSort,
): Array<{ phenomenon: PhenomenonDTO; summary: PhenomenonSummaryDTO }> {
  const paired = phenomena.map((phenomenon, index) => ({ phenomenon, summary: summaries[index]! }));
  paired.sort((a, b) => {
    if (sort === "priority_desc") {
      return b.phenomenon.priority - a.phenomenon.priority || a.summary.name.localeCompare(b.summary.name);
    }
    if (sort === "category_asc") {
      return a.summary.category.localeCompare(b.summary.category) || a.summary.name.localeCompare(b.summary.name);
    }
    return a.summary.name.localeCompare(b.summary.name);
  });
  return paired;
}

function paginate<T>(entries: ReadonlyArray<T>, pagination: EventsPaginationState): {
  items: ReadonlyArray<T>;
  nextCursor?: string;
} {
  const offset = pagination.cursor ? Number.parseInt(pagination.cursor, 10) || 0 : 0;
  const limit = pagination.limit ?? DEFAULT_PAGE_SIZE;
  const slice = entries.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  const hasMore = nextOffset < entries.length;
  return { items: slice, nextCursor: hasMore ? String(nextOffset) : undefined };
}

function findDuplicateCalendarIds(links: ReadonlyArray<PhenomenonLinkUpdate["calendarLinks"][number]>): string[] {
  const counts = new Map<string, number>();
  for (const link of links) {
    counts.set(link.calendarId, (counts.get(link.calendarId) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([calendarId]) => calendarId);
}
