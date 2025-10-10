// src/apps/almanac/data/vault-repositories.ts
// Vault-backed repositories for Almanac calendars, events and phenomena.

import { compareTimestampsWithSchema, createDayTimestamp, formatTimestamp } from '../domain/calendar-timestamp';
import { getEventAnchorTimestamp } from '../domain/calendar-event';
import { computeNextPhenomenonOccurrence } from '../domain/phenomenon-engine';
import { isPhenomenonVisibleForCalendar } from '../domain/phenomenon';
import type { EventsFilterState } from '../mode/contracts';
import type { CalendarTimestamp } from '../domain/calendar-timestamp';
import type {
  CalendarSchemaDTO,
  CalendarEventDTO,
  CalendarRangeDTO,
  EventsDataBatchDTO,
  EventsPaginationState,
  EventsSort,
  PhenomenonDTO,
  PhenomenonLinkUpdate,
  PhenomenonOccurrenceDTO,
  PhenomenonSummaryDTO,
  PhenomenonTemplateDTO,
} from './dto';
import {
  AlmanacRepositoryError,
  type AlmanacRepository,
  type CalendarDefaultSnapshot,
  type CalendarDefaultsRepository,
  type CalendarRepository,
  type CalendarDefaultUpdate,
  PHENOMENON_PAGE_SIZE,
  findDuplicateCalendarIds,
  matchesPhenomenonFilters,
  paginatePhenomena,
  sortPhenomenonSummaries,
  type EventRepository,
  type PhenomenonRepository,
  type PhenomenonSummaryEntry,
} from './repositories';
import { JsonStore, type VaultLike, type VersionedPayload } from './json-store';
import { reportAlmanacGatewayIssue } from '../telemetry';

interface CalendarStoreData {
  readonly calendars: CalendarSchemaDTO[];
  readonly defaults: CalendarDefaultSnapshot;
}

interface EventStoreData {
  readonly eventsByCalendar: Record<string, CalendarEventDTO[]>;
}

interface PhenomenaStoreData {
  readonly phenomena: PhenomenonDTO[];
}

type TelemetryMeta = {
  readonly operation: string;
  readonly scope: string;
  readonly context?: Record<string, unknown>;
};

type ErrorClassifier = (error: unknown) => string;

const CALENDAR_STORE_VERSION = '1.4.0';
const CALENDAR_STORE_PATH = 'SaltMarcher/Almanac/calendars.json';
const EVENT_STORE_VERSION = '1.4.0';
const EVENT_STORE_PATH = 'SaltMarcher/Almanac/events.json';
const PHENOMENA_STORE_VERSION = '1.4.0';
const PHENOMENA_STORE_PATH = 'SaltMarcher/Almanac/phenomena.json';

export class VaultCalendarRepository implements CalendarRepository, CalendarDefaultsRepository {
  private readonly store: JsonStore<CalendarStoreData>;

  constructor(vault: VaultLike) {
    this.store = new JsonStore<CalendarStoreData>(vault, {
      path: CALENDAR_STORE_PATH,
      currentVersion: CALENDAR_STORE_VERSION,
      initialData: () => ({ calendars: [], defaults: { global: null, travel: {} } }),
      migrations: {
        '0.0.0': payload => migrateLegacyCalendars(payload),
      },
    });
  }

  async listCalendars(): Promise<ReadonlyArray<CalendarSchemaDTO>> {
    const { calendars, defaults } = await this.store.read();
    return calendars.map(calendar => ({
      ...calendar,
      isDefaultGlobal: defaults.global === calendar.id,
      defaultTravelIds: computeDefaultTravelIds(calendar.id, defaults.travel),
    }));
  }

  async getCalendar(id: string): Promise<CalendarSchemaDTO | null> {
    const { calendars, defaults } = await this.store.read();
    const calendar = calendars.find(entry => entry.id === id);
    if (!calendar) {
      return null;
    }
    return {
      ...calendar,
      isDefaultGlobal: defaults.global === calendar.id,
      defaultTravelIds: computeDefaultTravelIds(calendar.id, defaults.travel),
    };
  }

  async createCalendar(input: CalendarSchemaDTO & { readonly isDefaultGlobal?: boolean }): Promise<void> {
    await mutateJsonStore(
      this.store,
      state => {
        if (state.calendars.some(calendar => calendar.id === input.id)) {
          throw new Error(`Calendar with ID ${input.id} already exists`);
        }
        const calendars = [...state.calendars, { ...input }];
        const defaults = ensureDefaultsState(state.defaults);
        if (input.isDefaultGlobal) {
          defaults.global = input.id;
        }
        return { calendars, defaults };
      },
      {
        operation: 'calendar.repository.createCalendar',
        scope: 'calendar',
        context: { calendarId: input.id },
      },
      classifyWithPattern(/already exists|not found|required/i),
    );
  }

  async updateCalendar(id: string, input: Partial<CalendarSchemaDTO>): Promise<void> {
    await mutateJsonStore(
      this.store,
      state => {
        const index = state.calendars.findIndex(calendar => calendar.id === id);
        if (index === -1) {
          throw new Error(`Calendar with ID ${id} not found`);
        }
        const calendars = [...state.calendars];
        calendars[index] = { ...calendars[index], ...input };
        return { calendars, defaults: ensureDefaultsState(state.defaults) };
      },
      {
        operation: 'calendar.repository.updateCalendar',
        scope: 'calendar',
        context: { calendarId: id },
      },
      classifyWithPattern(/already exists|not found|required/i),
    );
  }

  async deleteCalendar(id: string): Promise<void> {
    await mutateJsonStore(
      this.store,
      state => {
        if (!state.calendars.some(calendar => calendar.id === id)) {
          throw new Error(`Calendar with ID ${id} not found`);
        }
        const calendars = state.calendars.filter(calendar => calendar.id !== id);
        const defaults = ensureDefaultsState(state.defaults);
        if (defaults.global === id) {
          defaults.global = null;
        }
        for (const [travelId, calendarId] of Object.entries(defaults.travel)) {
          if (calendarId === id) {
            defaults.travel[travelId] = null;
          }
        }
        return { calendars, defaults };
      },
      {
        operation: 'calendar.repository.deleteCalendar',
        scope: 'calendar',
        context: { calendarId: id },
      },
      classifyWithPattern(/already exists|not found|required/i),
    );
  }

  async setDefault(input: CalendarDefaultUpdate): Promise<void> {
    await mutateJsonStore(
      this.store,
      state => {
        if (!state.calendars.some(calendar => calendar.id === input.calendarId)) {
          throw new Error(`Calendar with ID ${input.calendarId} not found`);
        }
        const defaults = ensureDefaultsState(state.defaults);
        if (input.scope === 'global') {
          defaults.global = input.calendarId;
        } else if (input.scope === 'travel' && input.travelId) {
          defaults.travel[input.travelId] = input.calendarId;
        }
        return { calendars: state.calendars, defaults };
      },
      {
        operation: 'calendar.repository.setDefault',
        scope: input.scope === 'travel' ? 'travel' : 'default',
        context: { calendarId: input.calendarId, travelId: input.travelId ?? null },
      },
      classifyWithPattern(/already exists|not found|required/i),
    );
  }

  async getDefaults(): Promise<CalendarDefaultSnapshot> {
    const { defaults } = await this.store.read();
    return ensureDefaultsState(defaults);
  }

  async getGlobalDefault(): Promise<string | null> {
    const { defaults } = await this.store.read();
    return ensureDefaultsState(defaults).global;
  }

  async getTravelDefault(travelId: string): Promise<string | null> {
    const { defaults } = await this.store.read();
    const snapshot = ensureDefaultsState(defaults);
    return snapshot.travel[travelId] ?? null;
  }

  async clearTravelDefault(travelId: string): Promise<void> {
    await mutateJsonStore(
      this.store,
      state => {
        const defaults = ensureDefaultsState(state.defaults);
        if (defaults.travel[travelId]) {
          defaults.travel[travelId] = null;
        }
        return { calendars: state.calendars, defaults };
      },
      {
        operation: 'calendar.repository.clearTravelDefault',
        scope: 'travel',
        context: { travelId },
      },
      classifyWithPattern(/already exists|not found|required/i),
    );
  }
}

export class VaultEventRepository implements EventRepository {
  private readonly store: JsonStore<EventStoreData>;

  constructor(private readonly calendars: CalendarRepository, vault: VaultLike) {
    this.store = new JsonStore<EventStoreData>(vault, {
      path: EVENT_STORE_PATH,
      currentVersion: EVENT_STORE_VERSION,
      initialData: () => ({ eventsByCalendar: {} }),
    });
  }

  async listEvents(calendarId: string, range?: CalendarRangeDTO): Promise<ReadonlyArray<CalendarEventDTO>> {
    const schema = await this.requireCalendar(calendarId);
    const events = await this.readCalendarEvents(calendarId);
    if (!range) {
      return events;
    }
    const { start, end } = range;
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const afterStart = compareTimestampsWithSchema(schema, anchor, start) >= 0;
      const beforeEnd = compareTimestampsWithSchema(schema, anchor, end) <= 0;
      return afterStart && beforeEnd;
    });
  }

  async listUpcoming(calendarId: string, limit: number): Promise<ReadonlyArray<CalendarEventDTO>> {
    const schema = await this.requireCalendar(calendarId);
    const events = await this.readCalendarEvents(calendarId);
    return [...events]
      .sort((a, b) => {
        const aAnchor = getEventAnchorTimestamp(a) ?? a.date;
        const bAnchor = getEventAnchorTimestamp(b) ?? b.date;
        return compareTimestampsWithSchema(schema, aAnchor, bAnchor);
      })
      .slice(0, limit);
  }

  async createEvent(event: CalendarEventDTO): Promise<void> {
    await mutateJsonStore(
      this.store,
      state => {
        const eventsByCalendar = { ...state.eventsByCalendar };
        const events = [...(eventsByCalendar[event.calendarId] ?? [])];
        if (events.some(entry => entry.id === event.id)) {
          throw new Error(`Event with ID ${event.id} already exists`);
        }
        events.push(event);
        eventsByCalendar[event.calendarId] = events;
        return { eventsByCalendar };
      },
      {
        operation: 'event.repository.createEvent',
        scope: 'event',
        context: { calendarId: event.calendarId, eventId: event.id },
      },
      classifyWithPattern(/already exists|not found/i),
    );
  }

  async updateEvent(id: string, event: Partial<CalendarEventDTO>): Promise<void> {
    await mutateJsonStore(
      this.store,
      state => {
        const eventsByCalendar = { ...state.eventsByCalendar };
        let found = false;
        for (const [calendarId, events] of Object.entries(eventsByCalendar)) {
          const index = events.findIndex(entry => entry.id === id);
          if (index === -1) {
            continue;
          }
          events[index] = { ...events[index], ...event } as CalendarEventDTO;
          eventsByCalendar[calendarId] = [...events];
          found = true;
        }
        if (!found) {
          throw new Error(`Event with ID ${id} not found`);
        }
        return { eventsByCalendar };
      },
      {
        operation: 'event.repository.updateEvent',
        scope: 'event',
        context: { eventId: id },
      },
      classifyWithPattern(/already exists|not found/i),
    );
  }

  async deleteEvent(id: string): Promise<void> {
    await mutateJsonStore(
      this.store,
      state => {
        const eventsByCalendar: Record<string, CalendarEventDTO[]> = {};
        let found = false;
        for (const [calendarId, events] of Object.entries(state.eventsByCalendar)) {
          const remaining = events.filter(event => event.id !== id);
          if (remaining.length !== events.length) {
            found = true;
          }
          eventsByCalendar[calendarId] = remaining;
        }
        if (!found) {
          throw new Error(`Event with ID ${id} not found`);
        }
        return { eventsByCalendar };
      },
      {
        operation: 'event.repository.deleteEvent',
        scope: 'event',
        context: { eventId: id },
      },
      classifyWithPattern(/already exists|not found/i),
    );
  }

  async getEventsInRange(
    calendarId: string,
    schema: CalendarSchemaDTO,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<CalendarEventDTO[]> {
    const range: CalendarRangeDTO = { calendarId, start, end };
    return this.listEvents(calendarId, range);
  }

  async getUpcomingEvents(
    calendarId: string,
    schema: CalendarSchemaDTO,
    from: CalendarTimestamp,
    limit: number,
  ): Promise<CalendarEventDTO[]> {
    const events = await this.listEvents(calendarId);
    return events
      .filter(event => {
        const anchor = getEventAnchorTimestamp(event) ?? event.date;
        return compareTimestampsWithSchema(schema, anchor, from) >= 0;
      })
      .slice(0, limit);
  }

  private async readCalendarEvents(calendarId: string): Promise<CalendarEventDTO[]> {
    const state = await this.store.read();
    return [...(state.eventsByCalendar[calendarId] ?? [])];
  }

  private async requireCalendar(calendarId: string): Promise<CalendarSchemaDTO> {
    const calendar = await this.calendars.getCalendar(calendarId);
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }
    return calendar;
  }
}

export class VaultAlmanacRepository implements AlmanacRepository, PhenomenonRepository {
  private readonly store: JsonStore<PhenomenaStoreData>;

  constructor(
    private readonly calendars: CalendarRepository & CalendarDefaultsRepository,
    vault: VaultLike,
  ) {
    this.store = new JsonStore<PhenomenaStoreData>(vault, {
      path: PHENOMENA_STORE_PATH,
      currentVersion: PHENOMENA_STORE_VERSION,
      initialData: () => ({ phenomena: [] }),
    });
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
      const state = await this.store.read();
      return state.phenomena.map(phenomenon => ({ ...phenomenon }));
    }
    const state = await this.store.read();
    const calendars = await this.calendars.listCalendars();
    const calendarMap = new Map(calendars.map(calendar => [calendar.id, calendar]));
    const allCalendarIds = Array.from(calendarMap.keys());
    const visible = state.phenomena.filter(phenomenon =>
      matchesPhenomenonFilters(phenomenon, input.filters, {
        resolveVisibleCalendars: current =>
          current.visibility === 'all_calendars' ? allCalendarIds : current.appliesToCalendarIds,
      }),
    );

    const decorated: PhenomenonSummaryEntry[] = await Promise.all(
      visible.map(async phenomenon => ({
        phenomenon,
        summary: await this.buildSummary(phenomenon, calendars),
      })),
    );

    const sorted = sortPhenomenonSummaries(decorated, input.sort, {
      tieBreaker: compareSummariesByNextOccurrence,
    });
    const { items, nextCursor } = paginatePhenomena(sorted, input.pagination, PHENOMENON_PAGE_SIZE);

    return {
      items: items.map(entry => entry.summary),
      pagination: { cursor: nextCursor, hasMore: nextCursor !== undefined },
      generatedAt: new Date().toISOString(),
    };
  }

  async getPhenomenon(id: string): Promise<PhenomenonDTO | null> {
    const state = await this.store.read();
    return state.phenomena.find(entry => entry.id === id) ?? null;
  }

  async upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO> {
    await mutateJsonStore(
      this.store,
      state => {
        const phenomena = [...state.phenomena];
        const index = phenomena.findIndex(entry => entry.id === draft.id);
        if (index === -1) {
          phenomena.push({ ...draft });
        } else {
          phenomena[index] = { ...phenomena[index], ...draft };
        }
        return { phenomena };
      },
      {
        operation: 'phenomenon.repository.upsert',
        scope: 'phenomenon',
        context: { phenomenonId: draft.id },
      },
      classifyPhenomenonError,
    );

    const stored = await this.getPhenomenon(draft.id);
    if (!stored) {
      throw new AlmanacRepositoryError('validation_error', `Phenomenon ${draft.id} disappeared during update`);
    }
    return stored;
  }

  async deletePhenomenon(id: string): Promise<void> {
    await mutateJsonStore(
      this.store,
      state => {
        const remaining = state.phenomena.filter(entry => entry.id !== id);
        if (remaining.length === state.phenomena.length) {
          throw new AlmanacRepositoryError('validation_error', `Phenomenon ${id} not found`);
        }
        return { phenomena: remaining };
      },
      {
        operation: 'phenomenon.repository.delete',
        scope: 'phenomenon',
        context: { phenomenonId: id },
      },
      classifyPhenomenonError,
    );
  }

  async updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO> {
    const phenomenon = await this.getPhenomenon(update.phenomenonId);
    if (!phenomenon) {
      throw new AlmanacRepositoryError('validation_error', `Phenomenon ${update.phenomenonId} not found`);
    }

    const calendars = await this.calendars.listCalendars();
    const calendarSet = new Set(calendars.map(calendar => calendar.id));

    const duplicates = findDuplicateCalendarIds(update.calendarLinks);
    if (duplicates.length > 0) {
      throw new AlmanacRepositoryError('phenomenon_conflict', 'Calendar links contain duplicates', {
        duplicates,
      });
    }

    for (const link of update.calendarLinks) {
      if (!calendarSet.has(link.calendarId)) {
        throw new AlmanacRepositoryError('validation_error', `Calendar ${link.calendarId} not found`, {
          calendarId: link.calendarId,
        });
      }
    }

    if (phenomenon.rule.type === 'astronomical') {
      const hasReference = Boolean(phenomenon.rule.referenceCalendarId);
      const hasHookReference = update.calendarLinks.some(link =>
        link.hook && typeof link.hook.config?.referenceCalendarId === 'string',
      );
      if (!hasReference && !hasHookReference) {
        throw new AlmanacRepositoryError(
          'astronomy_source_missing',
          'Astronomical phenomena require a reference calendar',
        );
      }
    }

    await mutateJsonStore(
      this.store,
      state => {
        const phenomena = [...state.phenomena];
        const index = phenomena.findIndex(entry => entry.id === phenomenon.id);
        if (index === -1) {
          throw new AlmanacRepositoryError('validation_error', `Phenomenon ${phenomenon.id} disappeared during update`);
        }
        const appliesToCalendarIds = update.calendarLinks.map(link => link.calendarId);
        const visibility = appliesToCalendarIds.length === 0 ? 'all_calendars' : 'selected';
        const hooks = buildHooksFromLinks(update.calendarLinks, phenomenon);
        const priority = update.calendarLinks.reduce(
          (max, link) => Math.max(max, link.priority),
          phenomenon.priority,
        );
        phenomena[index] = {
          ...phenomena[index],
          appliesToCalendarIds,
          visibility,
          hooks,
          priority,
        };
        return { phenomena };
      },
      {
        operation: 'phenomenon.repository.updateLinks',
        scope: 'phenomenon',
        context: { phenomenonId: update.phenomenonId },
      },
      classifyPhenomenonError,
    );

    const stored = await this.getPhenomenon(update.phenomenonId);
    if (!stored) {
      throw new AlmanacRepositoryError(
        'validation_error',
        `Phenomenon ${update.phenomenonId} disappeared during update`,
      );
    }
    return stored;
  }

  async listTemplates(): Promise<ReadonlyArray<PhenomenonTemplateDTO>> {
    const state = await this.store.read();
    return state.phenomena
      .filter(phenomenon => phenomenon.template)
      .map(phenomenon => ({
        id: phenomenon.id,
        name: phenomenon.name,
        category: phenomenon.category,
        rule: phenomenon.rule,
        effects: phenomenon.effects,
      }));
  }

  private async buildSummary(
    phenomenon: PhenomenonDTO,
    calendars: ReadonlyArray<CalendarSchemaDTO>,
  ): Promise<PhenomenonSummaryDTO> {
    const nextOccurrence = await this.computeNextOccurrence(phenomenon, calendars);
    const linkedCalendars = phenomenon.visibility === 'all_calendars'
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

  private async computeNextOccurrence(
    phenomenon: PhenomenonDTO,
    calendars: ReadonlyArray<CalendarSchemaDTO>,
  ): Promise<PhenomenonOccurrenceDTO | undefined> {
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
}

function mutateJsonStore<T>(
  store: JsonStore<T>,
  mutate: (state: T) => T,
  telemetry: TelemetryMeta,
  classify: ErrorClassifier,
): Promise<void> {
  return store.update(mutate).catch(error => {
    reportAlmanacGatewayIssue({
      operation: telemetry.operation,
      scope: telemetry.scope,
      code: classify(error),
      error,
      context: telemetry.context ?? {},
    });
    throw error;
  });
}

function classifyWithPattern(pattern: RegExp): ErrorClassifier {
  return error => (error instanceof Error && pattern.test(error.message) ? 'validation_error' : 'io_error');
}

function classifyPhenomenonError(error: unknown): string {
  if (error instanceof AlmanacRepositoryError) {
    return error.code;
  }
  if (error instanceof Error && /not found|disappeared/i.test(error.message)) {
    return 'validation_error';
  }
  return 'io_error';
}

function ensureDefaultsState(snapshot: CalendarDefaultSnapshot | undefined): CalendarDefaultSnapshot {
  return {
    global: snapshot?.global ?? null,
    travel: { ...(snapshot?.travel ?? {}) },
  };
}

function computeDefaultTravelIds(calendarId: string, travel: Readonly<Record<string, string | null>>): string[] {
  return Object.entries(travel)
    .filter(([, linkedId]) => linkedId === calendarId)
    .map(([travelId]) => travelId);
}

function migrateLegacyCalendars(payload: VersionedPayload<CalendarStoreData>): VersionedPayload<CalendarStoreData> {
  const defaults = ensureDefaultsState(payload.data.defaults);
  return {
    version: CALENDAR_STORE_VERSION,
    data: {
      calendars: payload.data.calendars ?? [],
      defaults,
    },
  };
}

function compareSummariesByNextOccurrence(
  a: PhenomenonSummaryEntry,
  b: PhenomenonSummaryEntry,
): number {
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
  a: PhenomenonOccurrenceDTO['occurrence'],
  b: PhenomenonOccurrenceDTO['occurrence'],
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
  links: ReadonlyArray<PhenomenonLinkUpdate['calendarLinks'][number]>,
  phenomenon: PhenomenonDTO,
): PhenomenonDTO['hooks'] | undefined {
  const existing = phenomenon.hooks ?? [];
  const linkedHooks = links
    .filter(link => Boolean(link.hook))
    .map(link => ({ ...link.hook!, priority: link.priority }));
  if (linkedHooks.length === 0) {
    return existing;
  }
  return linkedHooks;
}

