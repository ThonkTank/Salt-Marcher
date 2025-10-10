// src/apps/almanac/data/memory-backend.ts
// Shared in-memory storage backing Almanac calendar, event and phenomenon repositories.

import { compareTimestampsWithSchema, type CalendarSchema, type CalendarTimestamp } from '../domain/calendar-core';
import { getEventAnchorTimestamp, type CalendarEvent } from '../domain/scheduling';
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
import type { CalendarDefaultSnapshot, CalendarDefaultUpdate } from './repositories';
import {
  AlmanacRepositoryError,
  PHENOMENON_PAGE_SIZE,
  findDuplicateCalendarIds,
  matchesPhenomenonFilters,
  paginatePhenomena,
  sortPhenomenonSummaries,
  type PhenomenonSummaryEntry,
} from './repositories';

type CalendarRecord = CalendarSchemaDTO & { readonly id: string };
type EventRecord = CalendarEventDTO & { readonly id: string };
type PhenomenonRecord = PhenomenonDTO & { readonly id: string };

interface DefaultState {
  global: string | null;
  travel: Map<string, string | null>;
}

interface AlmanacMemoryState {
  calendars: Map<string, CalendarRecord>;
  eventsByCalendar: Map<string, Map<string, EventRecord>>;
  eventsById: Map<string, EventRecord>;
  phenomena: Map<string, PhenomenonRecord>;
  defaults: DefaultState;
}

function cloneCalendar(
  schema: CalendarRecord,
  defaults: CalendarDefaultSnapshot,
): CalendarSchemaDTO {
  return {
    ...schema,
    isDefaultGlobal: defaults.global === schema.id,
    defaultTravelIds: Object.keys(defaults.travel)
      .filter(travelId => defaults.travel[travelId] === schema.id)
      .map(travelId => travelId),
  };
}

function snapshotDefaults(
  defaults: DefaultState,
): CalendarDefaultSnapshot {
  const travel: Record<string, string | null> = {};
  for (const [travelId, calendarId] of defaults.travel.entries()) {
    if (calendarId) {
      travel[travelId] = calendarId;
    }
  }
  return { global: defaults.global, travel };
}

function toPhenomenonSummary(phenomenon: PhenomenonDTO): PhenomenonSummaryDTO {
  return {
    id: phenomenon.id,
    name: phenomenon.name,
    category: phenomenon.category,
    linkedCalendars: phenomenon.appliesToCalendarIds,
    badge: phenomenon.tags?.[0],
  };
}

export class AlmanacMemoryBackend {
  private readonly state: AlmanacMemoryState = {
    calendars: new Map(),
    eventsByCalendar: new Map(),
    eventsById: new Map(),
    phenomena: new Map(),
    defaults: { global: null, travel: new Map() },
  };

  listCalendars(): CalendarSchemaDTO[] {
    const defaults = snapshotDefaults(this.state.defaults);
    return Array.from(this.state.calendars.values()).map(schema => cloneCalendar(schema, defaults));
  }

  getCalendar(id: string): CalendarSchemaDTO | null {
    const schema = this.state.calendars.get(id);
    if (!schema) {
      return null;
    }
    const defaults = snapshotDefaults(this.state.defaults);
    return cloneCalendar(schema, defaults);
  }

  createCalendar(schema: CalendarSchemaDTO & { readonly isDefaultGlobal?: boolean }): void {
    if (this.state.calendars.has(schema.id)) {
      throw new Error(`Calendar with ID ${schema.id} already exists`);
    }
    this.state.calendars.set(schema.id, { ...schema });
    if (schema.isDefaultGlobal) {
      this.state.defaults.global = schema.id;
    }
  }

  updateCalendar(id: string, updates: Partial<CalendarSchemaDTO>): void {
    const existing = this.state.calendars.get(id);
    if (!existing) {
      throw new Error(`Calendar with ID ${id} not found`);
    }
    const next: CalendarRecord = { ...existing, ...updates };
    this.state.calendars.set(id, next);

    if (updates.isDefaultGlobal === true) {
      this.state.defaults.global = id;
    } else if (updates.isDefaultGlobal === false && this.state.defaults.global === id) {
      this.state.defaults.global = null;
    }
  }

  deleteCalendar(id: string): void {
    if (!this.state.calendars.delete(id)) {
      throw new Error(`Calendar with ID ${id} not found`);
    }
    if (this.state.defaults.global === id) {
      this.state.defaults.global = null;
    }
    for (const [travelId, calendarId] of Array.from(this.state.defaults.travel.entries())) {
      if (calendarId === id) {
        this.state.defaults.travel.delete(travelId);
      }
    }
    const bucket = this.state.eventsByCalendar.get(id);
    if (bucket) {
      for (const eventId of bucket.keys()) {
        this.state.eventsById.delete(eventId);
      }
      this.state.eventsByCalendar.delete(id);
    }
  }

  setDefault(update: CalendarDefaultUpdate): void {
    if (!this.state.calendars.has(update.calendarId)) {
      throw new Error(`Calendar with ID ${update.calendarId} not found`);
    }
    if (update.scope === 'global') {
      this.state.defaults.global = update.calendarId;
      return;
    }
    if (!update.travelId) {
      throw new Error('Travel ID required for travel scope');
    }
    this.state.defaults.travel.set(update.travelId, update.calendarId);
  }

  getDefaults(): CalendarDefaultSnapshot {
    return snapshotDefaults(this.state.defaults);
  }

  getGlobalDefault(): string | null {
    return this.state.defaults.global;
  }

  getTravelDefault(travelId: string): string | null {
    return this.state.defaults.travel.get(travelId) ?? null;
  }

  clearTravelDefault(travelId: string): void {
    this.state.defaults.travel.delete(travelId);
  }

  setGlobalDefault(calendarId: string): void {
    this.setDefault({ calendarId, scope: 'global' });
  }

  setTravelDefault(travelId: string, calendarId: string): void {
    this.setDefault({ calendarId, scope: 'travel', travelId });
  }

  getGlobalDefaultCalendar(): CalendarSchemaDTO | null {
    const id = this.state.defaults.global;
    return id ? this.getCalendar(id) : null;
  }

  seedCalendars(calendars: CalendarSchema[]): void {
    for (const calendar of calendars) {
      this.state.calendars.set(calendar.id, { ...calendar });
      if (calendar.isDefaultGlobal) {
        this.state.defaults.global = calendar.id;
      }
    }
  }

  clearCalendars(): void {
    this.state.calendars.clear();
    this.state.defaults.global = null;
    this.state.defaults.travel.clear();
  }

  listEvents(calendarId: string, range?: CalendarRangeDTO): CalendarEventDTO[] {
    const schema = this.requireCalendar(calendarId);
    const events = this.collectEvents(calendarId, schema);
    if (!range) {
      return events;
    }
    const start = range.start;
    const end = range.end;
    const [rangeStart, rangeEnd] =
      compareTimestampsWithSchema(schema, start, end) <= 0 ? [start, end] : [end, start];
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const afterStart = compareTimestampsWithSchema(schema, anchor, rangeStart) >= 0;
      const beforeEnd = compareTimestampsWithSchema(schema, anchor, rangeEnd) <= 0;
      return afterStart && beforeEnd;
    });
  }

  listUpcomingEvents(
    calendarId: string,
    from: CalendarTimestamp,
    limit: number,
  ): CalendarEventDTO[] {
    const schema = this.requireCalendar(calendarId);
    return this.collectEvents(calendarId, schema)
      .filter(event => compareTimestampsWithSchema(schema, getEventAnchorTimestamp(event) ?? event.date, from) >= 0)
      .slice(0, limit);
  }

  createEvent(event: CalendarEventDTO): void {
    this.requireCalendar(event.calendarId);
    if (this.state.eventsById.has(event.id)) {
      throw new Error(`Event with ID ${event.id} already exists`);
    }
    const record: EventRecord = { ...event };
    this.getOrCreateEventBucket(record.calendarId).set(record.id, record);
    this.state.eventsById.set(record.id, record);
  }

  updateEvent(id: string, updates: Partial<CalendarEventDTO>): void {
    const existing = this.state.eventsById.get(id);
    if (!existing) {
      throw new Error(`Event with ID ${id} not found`);
    }
    const previousCalendarId = existing.calendarId;
    const next: EventRecord = { ...existing, ...updates };
    this.requireCalendar(next.calendarId);
    if (next.calendarId !== previousCalendarId) {
      const previousBucket = this.state.eventsByCalendar.get(previousCalendarId);
      previousBucket?.delete(id);
      this.getOrCreateEventBucket(next.calendarId).set(id, next);
    } else {
      this.getOrCreateEventBucket(next.calendarId).set(id, next);
    }
    this.state.eventsById.set(id, next);
  }

  deleteEvent(id: string): void {
    const event = this.state.eventsById.get(id);
    if (!event) {
      throw new Error(`Event with ID ${id} not found`);
    }
    const bucket = this.state.eventsByCalendar.get(event.calendarId);
    bucket?.delete(id);
    if (bucket?.size === 0) {
      this.state.eventsByCalendar.delete(event.calendarId);
    }
    this.state.eventsById.delete(id);
  }

  seedEvents(events: CalendarEvent[]): void {
    for (const event of events) {
      this.requireCalendar(event.calendarId);
      const record: EventRecord = { ...event };
      this.getOrCreateEventBucket(record.calendarId).set(record.id, record);
      this.state.eventsById.set(record.id, record);
    }
  }

  clearEvents(): void {
    this.state.eventsByCalendar.clear();
    this.state.eventsById.clear();
  }

  listPhenomenaRaw(): PhenomenonDTO[] {
    return Array.from(this.state.phenomena.values()).map(item => ({ ...item }));
  }

  listPhenomenaBatch(input: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): EventsDataBatchDTO {
    const filtered = this.listPhenomenaRaw().filter(phenomenon =>
      matchesPhenomenonFilters(phenomenon, input.filters),
    );
    const summaries = filtered.map(toPhenomenonSummary);
    const decorated: PhenomenonSummaryEntry[] = summaries.map((summary, index) => ({
      summary,
      phenomenon: filtered[index]!,
    }));
    const sorted = sortPhenomenonSummaries(decorated, input.sort);
    const { items, nextCursor } = paginatePhenomena(sorted, input.pagination, PHENOMENON_PAGE_SIZE);

    return {
      items: items.map(entry => entry.summary),
      pagination: { cursor: nextCursor, hasMore: nextCursor !== undefined },
      generatedAt: new Date().toISOString(),
    };
  }

  getPhenomenon(id: string): PhenomenonDTO | null {
    const phenomenon = this.state.phenomena.get(id);
    return phenomenon ? { ...phenomenon } : null;
  }

  upsertPhenomenon(draft: PhenomenonDTO): PhenomenonDTO {
    this.state.phenomena.set(draft.id, { ...draft });
    const stored = this.state.phenomena.get(draft.id);
    if (!stored) {
      throw new Error(`Failed to upsert phenomenon ${draft.id}`);
    }
    return { ...stored };
  }

  deletePhenomenon(id: string): void {
    if (!this.state.phenomena.delete(id)) {
      throw new Error(`Phenomenon with ID ${id} not found`);
    }
  }

  updateLinks(update: PhenomenonLinkUpdate): PhenomenonDTO {
    const existing = this.state.phenomena.get(update.phenomenonId);
    if (!existing) {
      throw new AlmanacRepositoryError('validation_error', `Phenomenon ${update.phenomenonId} not found`);
    }
    const duplicates = findDuplicateCalendarIds(update.calendarLinks);
    if (duplicates.length) {
      throw new AlmanacRepositoryError('phenomenon_conflict', 'Duplicate calendar links', { duplicates });
    }
    if (existing.rule.type === 'astronomical') {
      const hasReference = Boolean(existing.rule.referenceCalendarId);
      const hasHookReference = update.calendarLinks.some(link =>
        typeof link.hook?.config?.referenceCalendarId === 'string',
      );
      if (!hasReference && !hasHookReference) {
        throw new AlmanacRepositoryError(
          'astronomy_source_missing',
          'Astronomical phenomena require a reference calendar',
        );
      }
    }
    const appliesToCalendarIds = update.calendarLinks.map(link => link.calendarId);
    const visibility = appliesToCalendarIds.length ? 'selected' : 'all_calendars';
    const hooks = update.calendarLinks
      .filter(link => Boolean(link.hook))
      .map(link => ({ ...link.hook!, priority: link.priority }));
    const priority = update.calendarLinks.reduce(
      (max, link) => Math.max(max, link.priority),
      existing.priority,
    );
    const updated: PhenomenonRecord = {
      ...existing,
      appliesToCalendarIds,
      visibility,
      hooks: hooks.length ? hooks : existing.hooks,
      priority,
    };
    this.state.phenomena.set(existing.id, updated);
    return { ...updated };
  }

  listTemplates(): ReadonlyArray<PhenomenonTemplateDTO> {
    return this.listPhenomenaRaw()
      .filter(phenomenon => phenomenon.template)
      .map(phenomenon => ({
        id: phenomenon.id,
        name: phenomenon.name,
        category: phenomenon.category,
        rule: phenomenon.rule,
        effects: phenomenon.effects,
      }));
  }

  seedPhenomena(phenomena: PhenomenonDTO[]): void {
    for (const phenomenon of phenomena) {
      this.state.phenomena.set(phenomenon.id, { ...phenomenon });
    }
  }

  clearPhenomena(): void {
    this.state.phenomena.clear();
  }

  private requireCalendar(calendarId: string): CalendarSchema {
    const calendar = this.state.calendars.get(calendarId);
    if (!calendar) {
      throw new Error(`Calendar schema for ${calendarId} not available`);
    }
    return calendar;
  }

  private collectEvents(calendarId: string, schema: CalendarSchema): CalendarEventDTO[] {
    const bucket = this.state.eventsByCalendar.get(calendarId);
    if (!bucket) {
      return [];
    }
    return Array.from(bucket.values())
      .sort((a, b) => {
        const left = getEventAnchorTimestamp(a) ?? a.date;
        const right = getEventAnchorTimestamp(b) ?? b.date;
        return compareTimestampsWithSchema(schema, left, right);
      })
      .map(event => ({ ...event }));
  }

  private getOrCreateEventBucket(calendarId: string): Map<string, EventRecord> {
    let bucket = this.state.eventsByCalendar.get(calendarId);
    if (!bucket) {
      bucket = new Map();
      this.state.eventsByCalendar.set(calendarId, bucket);
    }
    return bucket;
  }
}
