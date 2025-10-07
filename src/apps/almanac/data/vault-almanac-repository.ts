// src/apps/almanac/data/vault-almanac-repository.ts
// Vault-backed Almanac repository handling phenomena with filtering and pagination.

import { compareTimestampsWithSchema, createDayTimestamp, formatTimestamp } from "../domain/calendar-timestamp";
import { computeNextPhenomenonOccurrence } from "../domain/phenomenon-engine";
import { isPhenomenonVisibleForCalendar } from "../domain/phenomenon";
import type { EventsFilterState } from "../mode/contracts";
import type {
  CalendarSchemaDTO,
  EventsDataBatchDTO,
  EventsPaginationState,
  EventsSort,
  PhenomenonDTO,
  PhenomenonLinkUpdate,
  PhenomenonOccurrenceDTO,
  PhenomenonSummaryDTO,
  PhenomenonTemplateDTO,
} from "./dto";
import { AlmanacRepositoryError, type AlmanacRepository } from "./almanac-repository";
import type { CalendarDefaultsRepository, CalendarRepository } from "./calendar-repository";
import { JsonStore } from "./json-store";
import type { VaultLike } from "./json-store";

interface PhenomenaStoreData {
  readonly phenomena: PhenomenonDTO[];
}

const PHENOMENA_STORE_VERSION = "1.4.0";
const PHENOMENA_STORE_PATH = "SaltMarcher/Almanac/phenomena.json";
const DEFAULT_PAGE_SIZE = 25;

export class VaultAlmanacRepository implements AlmanacRepository {
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

  async listPhenomena(input: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<EventsDataBatchDTO> {
    const state = await this.store.read();
    const calendars = await this.calendars.listCalendars();
    const calendarMap = new Map(calendars.map(calendar => [calendar.id, calendar]));
    const visible = state.phenomena.filter(phenomenon => matchesFilters(phenomenon, input.filters, calendarMap));

    const decorated = await Promise.all(
      visible.map(async phenomenon => ({
        phenomenon,
        summary: await this.buildSummary(phenomenon, calendars),
      })),
    );

    const sorted = sortSummaries(decorated, input.sort);
    const { items, nextCursor } = paginate(sorted, input.pagination ?? { limit: DEFAULT_PAGE_SIZE });

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
    await this.store.update(state => {
      const phenomena = [...state.phenomena];
      const index = phenomena.findIndex(entry => entry.id === draft.id);
      if (index === -1) {
        phenomena.push({ ...draft });
      } else {
        phenomena[index] = { ...phenomena[index], ...draft };
      }
      return { phenomena };
    });
    const stored = await this.getPhenomenon(draft.id);
    if (!stored) {
      throw new Error(`Failed to persist phenomenon ${draft.id}`);
    }
    return stored;
  }

  async deletePhenomenon(id: string): Promise<void> {
    await this.store.update(state => {
      const remaining = state.phenomena.filter(entry => entry.id !== id);
      if (remaining.length === state.phenomena.length) {
        throw new Error(`Phenomenon with ID ${id} not found`);
      }
      return { phenomena: remaining };
    });
  }

  async updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO> {
    const phenomenon = await this.getPhenomenon(update.phenomenonId);
    if (!phenomenon) {
      throw new AlmanacRepositoryError("validation_error", `Phenomenon ${update.phenomenonId} not found`);
    }

    const calendars = await this.calendars.listCalendars();
    const calendarSet = new Set(calendars.map(calendar => calendar.id));

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
        throw new AlmanacRepositoryError("astronomy_source_missing", "Astronomical phenomena require a reference calendar");
      }
    }

    await this.store.update(state => {
      const phenomena = [...state.phenomena];
      const index = phenomena.findIndex(entry => entry.id === phenomenon.id);
      if (index === -1) {
        throw new AlmanacRepositoryError("validation_error", `Phenomenon ${phenomenon.id} disappeared during update`);
      }
      const appliesToCalendarIds = update.calendarLinks.map(link => link.calendarId);
      const visibility = appliesToCalendarIds.length === 0 ? "all_calendars" : "selected";
      const hooks = buildHooksFromLinks(update.calendarLinks, phenomenon);
      const priority = update.calendarLinks.reduce((max, link) => Math.max(max, link.priority), phenomenon.priority);
      phenomena[index] = {
        ...phenomena[index],
        appliesToCalendarIds,
        visibility,
        hooks,
        priority,
      };
      return { phenomena };
    });

    const stored = await this.getPhenomenon(update.phenomenonId);
    if (!stored) {
      throw new Error(`Failed to update phenomenon ${update.phenomenonId}`);
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

  private async buildSummary(phenomenon: PhenomenonDTO, calendars: ReadonlyArray<CalendarSchemaDTO>): Promise<PhenomenonSummaryDTO> {
    const nextOccurrence = await this.computeNextOccurrence(phenomenon, calendars);
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

function matchesFilters(
  phenomenon: PhenomenonDTO,
  filters: EventsFilterState,
  calendars: Map<string, CalendarSchemaDTO>,
): boolean {
  if (filters.categories?.length) {
    if (!filters.categories.includes(phenomenon.category)) {
      return false;
    }
  }
  if (filters.calendarIds?.length) {
    const visibleCalendars = phenomenon.visibility === "all_calendars"
      ? Array.from(calendars.keys())
      : phenomenon.appliesToCalendarIds;
    const hasOverlap = filters.calendarIds.some(calendarId => visibleCalendars.includes(calendarId));
    if (!hasOverlap) {
      return false;
    }
  }
  return true;
}

function sortSummaries(
  summaries: ReadonlyArray<{ phenomenon: PhenomenonDTO; summary: PhenomenonSummaryDTO }>,
  sort: EventsSort,
): Array<{ phenomenon: PhenomenonDTO; summary: PhenomenonSummaryDTO }> {
  const copy = [...summaries];
  copy.sort((a, b) => {
    if (sort === "priority_desc") {
      return b.phenomenon.priority - a.phenomenon.priority || a.summary.name.localeCompare(b.summary.name);
    }
    if (sort === "category_asc") {
      return a.summary.category.localeCompare(b.summary.category) || a.summary.name.localeCompare(b.summary.name);
    }
    const aTime = a.summary.nextOccurrence?.occurrence;
    const bTime = b.summary.nextOccurrence?.occurrence;
    if (!aTime && !bTime) {
      return a.summary.name.localeCompare(b.summary.name);
    }
    if (!aTime) {
      return 1;
    }
    if (!bTime) {
      return -1;
    }
    return compareTimestampTuples(aTime, bTime);
  });
  return copy;
}

function paginate<T>(
  entries: ReadonlyArray<T>,
  pagination: EventsPaginationState,
): { items: ReadonlyArray<T>; nextCursor?: string } {
  const offset = pagination.cursor ? Number.parseInt(pagination.cursor, 10) || 0 : 0;
  const limit = pagination.limit ?? DEFAULT_PAGE_SIZE;
  const slice = entries.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  const hasMore = nextOffset < entries.length;
  return {
    items: slice,
    nextCursor: hasMore ? String(nextOffset) : undefined,
  };
}

function compareTimestampTuples(a: PhenomenonOccurrenceDTO["occurrence"], b: PhenomenonOccurrenceDTO["occurrence"]): number {
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

function findDuplicateCalendarIds(links: ReadonlyArray<PhenomenonLinkUpdate["calendarLinks"][number]>): string[] {
  const counts = new Map<string, number>();
  for (const link of links) {
    counts.set(link.calendarId, (counts.get(link.calendarId) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([calendarId]) => calendarId);
}

function buildHooksFromLinks(
  links: ReadonlyArray<PhenomenonLinkUpdate["calendarLinks"][number]>,
  phenomenon: PhenomenonDTO,
) {
  const existing = phenomenon.hooks ?? [];
  const linkedHooks = links
    .filter(link => Boolean(link.hook))
    .map(link => ({ ...link.hook!, priority: link.priority }));
  if (linkedHooks.length === 0) {
    return existing;
  }
  return linkedHooks;
}
