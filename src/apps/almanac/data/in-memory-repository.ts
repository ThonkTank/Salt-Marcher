// src/apps/almanac/data/in-memory-repository.ts
// Lightweight wrappers around the shared AlmanacMemoryBackend for tests and previews.

import type { CalendarSchema } from '../domain/calendar-schema';
import type { CalendarTimestamp } from '../domain/calendar-timestamp';
import type { CalendarEvent } from '../domain/calendar-event';
import type { EventsFilterState } from '../mode/contracts';
import type {
  CalendarSchemaDTO,
  CalendarEventDTO,
  CalendarRangeDTO,
  EventsDataBatchDTO,
  EventsPaginationState,
  EventsSort,
  PhenomenonDTO,
  PhenomenonLinkUpdate,
  PhenomenonTemplateDTO,
} from './dto';
import type {
  CalendarDefaultsRepository,
  CalendarRepository as CalendarRepositoryContract,
  CalendarDefaultSnapshot,
  CalendarDefaultUpdate,
  EventRepository as EventRepositoryContract,
  PhenomenonRepository,
  AlmanacRepository,
} from './repositories';
import { AlmanacMemoryBackend } from './memory-backend';

export class InMemoryCalendarRepository
  implements CalendarRepositoryContract, CalendarDefaultsRepository
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

  async updateCalendar(id: string, updates: Partial<CalendarSchemaDTO>): Promise<void> {
    this.backend.updateCalendar(id, updates);
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

export class InMemoryEventRepository implements EventRepositoryContract {
  constructor(private readonly backend: AlmanacMemoryBackend = new AlmanacMemoryBackend()) {}

  async listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<CalendarEventDTO>> {
    return this.backend.listEvents(calendarId, range);
  }

  async listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<CalendarEventDTO>> {
    return this.backend.listEvents(calendarId).slice(0, limit);
  }

  async createEvent(event: CalendarEventDTO): Promise<void> {
    this.backend.createEvent(event);
  }

  async updateEvent(id: string, updates: Partial<CalendarEventDTO>): Promise<void> {
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
  ): Promise<ReadonlyArray<CalendarEventDTO>> {
    return this.backend.listEvents(calendarId, { calendarId, start, end });
  }

  async getUpcomingEvents(
    calendarId: string,
    schema: CalendarSchema,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<ReadonlyArray<CalendarEventDTO>> {
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
  async listPhenomena(input?: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<PhenomenonDTO[] | EventsDataBatchDTO> {
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
