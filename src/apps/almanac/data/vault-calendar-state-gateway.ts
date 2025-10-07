// src/apps/almanac/data/vault-calendar-state-gateway.ts
// Vault-backed implementation of the Almanac calendar state gateway.

import type { CalendarEvent } from "../domain/calendar-event";
import { getEventAnchorTimestamp } from "../domain/calendar-event";
import type { CalendarSchema } from "../domain/calendar-schema";
import { getMonthById } from "../domain/calendar-schema";
import type { CalendarTimestamp } from "../domain/calendar-timestamp";
import { createDayTimestamp, compareTimestampsWithSchema } from "../domain/calendar-timestamp";
import type { Phenomenon, PhenomenonOccurrence } from "../domain/phenomenon";
import { isPhenomenonVisibleForCalendar } from "../domain/phenomenon";
import {
  computeNextPhenomenonOccurrence,
  computePhenomenonOccurrencesInRange,
  sortOccurrencesByTimestamp,
} from "../domain/phenomenon-engine";
import { advanceTime } from "../domain/time-arithmetic";
import type { TimeUnit } from "../domain/time-arithmetic";
import type {
  CalendarDefaultsRepository,
  CalendarRepository,
} from "./calendar-repository";
import type { EventRepository } from "./event-repository";
import type { AlmanacRepository } from "./almanac-repository";
import type {
  AdvanceTimeResult,
  CalendarStateGateway,
  CalendarStateSnapshot,
  HookDispatchGateway,
  HookDispatchContext,
  TravelLeafPreferencesSnapshot,
} from "./calendar-state-gateway";
import type { AlmanacPreferencesSnapshot } from "../mode/contracts";
import { JsonStore, type VaultLike } from "./json-store";

const GLOBAL_SCOPE = "__global__";
const STATE_STORE_VERSION = "1.0.0";
const STATE_STORE_PATH = "SaltMarcher/Almanac/state.json";

interface ScopeRecord {
  activeCalendarId: string | null;
  currentTimestamp: CalendarTimestamp | null;
}

interface GatewayStoreData {
  scopes: Record<string, ScopeRecord>;
  preferences: AlmanacPreferencesSnapshot;
  travelLeaf: Record<string, TravelLeafPreferencesSnapshot>;
}

export class VaultCalendarStateGateway implements CalendarStateGateway {
  private readonly store: JsonStore<GatewayStoreData>;
  private cache: GatewayStoreData = createInitialStore();
  private ready: Promise<void> | null;
  private initialised = false;

  constructor(
    private readonly calendarRepo: CalendarRepository & CalendarDefaultsRepository,
    private readonly eventRepo: EventRepository,
    private readonly phenomenonRepo: AlmanacRepository,
    vault: VaultLike,
    private readonly hookDispatcher?: HookDispatchGateway,
  ) {
    this.store = new JsonStore<GatewayStoreData>(vault, {
      path: STATE_STORE_PATH,
      currentVersion: STATE_STORE_VERSION,
      initialData: () => createInitialStore(),
    });
    this.ready = this.store.read().then(data => {
      this.cache = normaliseStore(data);
      this.initialised = true;
    }).catch(error => {
      console.warn("[almanac] Failed to load calendar state store", error);
      this.initialised = true;
    });
  }

  async loadSnapshot(options?: { readonly travelId?: string | null }): Promise<CalendarStateSnapshot> {
    await this.ensureReady();
    const travelId = options?.travelId ?? null;
    const scope = this.ensureScope(travelId);

    const effective = await this.resolveEffectiveCalendar(travelId);
    const travelDefaultCalendarId = travelId
      ? await this.calendarRepo.getTravelDefault(travelId)
      : null;

    if (!effective?.calendar) {
      return {
        activeCalendar: null,
        currentTimestamp: null,
        upcomingEvents: [],
        upcomingPhenomena: [],
        defaultCalendarId: effective?.isGlobalDefault ? effective.calendarId ?? null : null,
        travelDefaultCalendarId,
        isGlobalDefault: effective?.isGlobalDefault ?? false,
        wasAutoSelected: effective?.wasAutoSelected ?? false,
      };
    }

    const activeCalendar = scope.activeCalendarId
      ? await this.calendarRepo.getCalendar(scope.activeCalendarId)
      : effective.calendar;

    if (!activeCalendar) {
      return {
        activeCalendar: null,
        currentTimestamp: null,
        upcomingEvents: [],
        upcomingPhenomena: [],
        defaultCalendarId: effective.isGlobalDefault ? effective.calendar.id : null,
        travelDefaultCalendarId,
        isGlobalDefault: effective.isGlobalDefault,
        wasAutoSelected: effective.wasAutoSelected,
      };
    }

    const upcomingEvents = scope.currentTimestamp
      ? await this.eventRepo.getUpcomingEvents(
          activeCalendar.id,
          activeCalendar,
          scope.currentTimestamp,
          5,
        )
      : [];

    const visiblePhenomena = await this.listVisiblePhenomena(activeCalendar);
    const upcomingPhenomena = this.computeUpcomingPhenomenaForCalendar(
      activeCalendar,
      visiblePhenomena,
      scope.currentTimestamp,
    );

    return {
      activeCalendar,
      currentTimestamp: scope.currentTimestamp,
      upcomingEvents,
      upcomingPhenomena,
      defaultCalendarId: effective.isGlobalDefault ? effective.calendar.id : null,
      travelDefaultCalendarId,
      isGlobalDefault: effective.isGlobalDefault,
      wasAutoSelected: effective.wasAutoSelected,
    };
  }

  async setActiveCalendar(
    calendarId: string,
    options?: { readonly travelId?: string | null; readonly initialTimestamp?: CalendarTimestamp },
  ): Promise<void> {
    await this.ensureReady();
    const calendar = await this.calendarRepo.getCalendar(calendarId);
    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    await this.persistState(state => {
      const scope = this.ensureScope(options?.travelId ?? null, state);
      scope.activeCalendarId = calendarId;

      if (options?.initialTimestamp) {
        scope.currentTimestamp = cloneTimestamp(options.initialTimestamp);
        return;
      }

      if (scope.currentTimestamp && scope.currentTimestamp.calendarId === calendarId) {
        return;
      }

      const firstMonth = calendar.months[0] ?? getMonthById(calendar, calendar.epoch.monthId);
      scope.currentTimestamp = createDayTimestamp(
        calendar.id,
        calendar.epoch.year,
        firstMonth?.id ?? calendar.epoch.monthId,
        calendar.epoch.day,
      );
    });
  }

  async setDefaultCalendar(
    calendarId: string,
    options?: { readonly scope: "global" | "travel"; readonly travelId?: string | null },
  ): Promise<void> {
    const scope = options?.scope ?? "global";
    if (scope === "travel") {
      const travelId = options?.travelId;
      if (!travelId) {
        throw new Error("Travel ID required when persisting travel default");
      }
      await this.calendarRepo.setDefault({ calendarId, scope: "travel", travelId });
      return;
    }
    await this.calendarRepo.setDefault({ calendarId, scope: "global" });
  }

  async setCurrentTimestamp(
    timestamp: CalendarTimestamp,
    options?: { readonly travelId?: string | null },
  ): Promise<void> {
    await this.ensureReady();
    await this.persistState(state => {
      const scope = this.ensureScope(options?.travelId ?? null, state);
      if (!scope.activeCalendarId) {
        throw new Error("No active calendar set");
      }
      if (timestamp.calendarId !== scope.activeCalendarId) {
        throw new Error("Timestamp calendar does not match active calendar");
      }
      scope.currentTimestamp = cloneTimestamp(timestamp);
    });
  }

  async advanceTimeBy(
    amount: number,
    unit: TimeUnit,
    options?: { readonly travelId?: string | null; readonly hookContext?: HookDispatchContext },
  ): Promise<AdvanceTimeResult> {
    await this.ensureReady();
    const travelId = options?.travelId ?? null;
    const scope = this.ensureScope(travelId);
    if (!scope.activeCalendarId || !scope.currentTimestamp) {
      throw new Error("No active calendar or current timestamp set");
    }

    const calendar = await this.calendarRepo.getCalendar(scope.activeCalendarId);
    if (!calendar) {
      throw new Error(`Calendar ${scope.activeCalendarId} not found`);
    }

    const visiblePhenomena = await this.listVisiblePhenomena(calendar);
    const previousTimestamp = cloneTimestamp(scope.currentTimestamp);
    const result = advanceTime(calendar, previousTimestamp, amount, unit);

    const [triggeredEvents, triggeredPhenomena] = await Promise.all([
      this.eventRepo.getEventsInRange(
        scope.activeCalendarId,
        calendar,
        previousTimestamp,
        result.timestamp,
      ),
      Promise.resolve(
        this.computeTriggeredPhenomenaBetween(
          calendar,
          visiblePhenomena,
          previousTimestamp,
          result.timestamp,
        ),
      ),
    ]);

    const relevantEvents = triggeredEvents.filter(event =>
      compareTimestampsWithSchema(
        calendar,
        getEventAnchorTimestamp(event) ?? event.date,
        previousTimestamp,
      ) > 0,
    );

    const upcomingPhenomena = this.computeUpcomingPhenomenaForCalendar(
      calendar,
      visiblePhenomena,
      result.timestamp,
    );

    await this.persistState(state => {
      const scoped = this.ensureScope(travelId, state);
      scoped.currentTimestamp = cloneTimestamp(result.timestamp);
    });

    if (this.hookDispatcher && (relevantEvents.length > 0 || triggeredPhenomena.length > 0)) {
      try {
        await this.hookDispatcher.dispatchHooks(relevantEvents, triggeredPhenomena, {
          scope: travelId ? "travel" : "global",
          travelId,
          reason: "advance",
          ...options?.hookContext,
        });
      } catch (error) {
        throw new Error(`Failed to dispatch hooks for time advance: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      timestamp: result.timestamp,
      triggeredEvents: relevantEvents,
      triggeredPhenomena,
      upcomingPhenomena,
    };
  }

  async loadPreferences(): Promise<AlmanacPreferencesSnapshot> {
    await this.ensureReady();
    return clonePreferences(this.cache.preferences);
  }

  async savePreferences(partial: Partial<AlmanacPreferencesSnapshot>): Promise<void> {
    await this.ensureReady();
    await this.persistState(state => {
      const merged: AlmanacPreferencesSnapshot = {
        ...state.preferences,
        ...partial,
      };

      if (partial.lastZoomByMode) {
        merged.lastZoomByMode = {
          ...(state.preferences.lastZoomByMode ?? {}),
          ...partial.lastZoomByMode,
        };
      }

      if (partial.eventsFilters) {
        merged.eventsFilters = {
          categories: [...(partial.eventsFilters.categories ?? [])],
          calendarIds: [...(partial.eventsFilters.calendarIds ?? [])],
        };
      }

      state.preferences = merged;
    });
  }

  getCurrentTimestamp(options?: { readonly travelId?: string | null }): CalendarTimestamp | null {
    if (!this.initialised) {
      return null;
    }
    const scope = this.ensureScope(options?.travelId ?? null);
    return scope.currentTimestamp ? cloneTimestamp(scope.currentTimestamp) : null;
  }

  getActiveCalendarId(options?: { readonly travelId?: string | null }): string | null {
    if (!this.initialised) {
      return null;
    }
    const scope = this.ensureScope(options?.travelId ?? null);
    return scope.activeCalendarId ?? null;
  }

  async getTravelLeafPreferences(travelId: string): Promise<TravelLeafPreferencesSnapshot | null> {
    await this.ensureReady();
    const prefs = this.cache.travelLeaf[travelId];
    return prefs ? { ...prefs } : null;
  }

  async saveTravelLeafPreferences(travelId: string, prefs: TravelLeafPreferencesSnapshot): Promise<void> {
    await this.ensureReady();
    await this.persistState(state => {
      state.travelLeaf[travelId] = { ...prefs };
    });
  }

  private async ensureReady(): Promise<void> {
    if (this.initialised) {
      return;
    }
    await this.ready;
    this.initialised = true;
  }

  private ensureScope(travelId: string | null, state: GatewayStoreData = this.cache): ScopeRecord {
    const key = travelId ?? GLOBAL_SCOPE;
    if (!state.scopes[key]) {
      state.scopes[key] = { activeCalendarId: null, currentTimestamp: null };
    }
    if (state === this.cache) {
      this.cache.scopes[key] = state.scopes[key];
    }
    return state.scopes[key];
  }

  private async resolveEffectiveCalendar(
    travelId: string | null,
  ): Promise<{ calendar: CalendarSchema; isGlobalDefault: boolean; wasAutoSelected: boolean; calendarId: string | null } | null> {
    if (travelId) {
      const travelDefaultId = await this.calendarRepo.getTravelDefault(travelId);
      if (travelDefaultId) {
        const travelCalendar = await this.calendarRepo.getCalendar(travelDefaultId);
        if (travelCalendar) {
          return {
            calendar: travelCalendar,
            calendarId: travelDefaultId,
            isGlobalDefault: false,
            wasAutoSelected: false,
          };
        }
      }
    }

    const globalDefault = await this.calendarRepo.getGlobalDefault();
    if (globalDefault) {
      const calendar = await this.calendarRepo.getCalendar(globalDefault);
      if (calendar) {
        return {
          calendar,
          calendarId: globalDefault,
          isGlobalDefault: true,
          wasAutoSelected: false,
        };
      }
    }

    const calendars = await this.calendarRepo.listCalendars();
    if (calendars.length > 0) {
      return {
        calendar: calendars[0],
        calendarId: calendars[0].id,
        isGlobalDefault: false,
        wasAutoSelected: true,
      };
    }

    return null;
  }

  private async persistState(mutator: (state: GatewayStoreData) => void): Promise<void> {
    await this.store.update(state => {
      const draft = normaliseStore(state);
      mutator(draft);
      this.cache = normaliseStore(draft);
      return this.cache;
    });
  }

  private async listVisiblePhenomena(calendar: CalendarSchema): Promise<Phenomenon[]> {
    const phenomena = await this.phenomenonRepo.listPhenomena();
    return phenomena.filter(phenomenon => isPhenomenonVisibleForCalendar(phenomenon, calendar.id));
  }

  private computeUpcomingPhenomenaForCalendar(
    calendar: CalendarSchema,
    phenomena: ReadonlyArray<Phenomenon>,
    from: CalendarTimestamp | null,
    limit: number = 5,
  ): PhenomenonOccurrence[] {
    if (phenomena.length === 0) {
      return [];
    }

    const anchor = from
      ?? createDayTimestamp(calendar.id, calendar.epoch.year, calendar.epoch.monthId, calendar.epoch.day);

    const occurrences: PhenomenonOccurrence[] = [];
    for (const phenomenon of phenomena) {
      try {
        const occurrence = computeNextPhenomenonOccurrence(
          phenomenon,
          calendar,
          calendar.id,
          anchor,
          { includeStart: true },
        );
        if (occurrence) {
          occurrences.push(occurrence);
        }
      } catch {
        continue;
      }
    }

    return sortOccurrencesByTimestamp(calendar, occurrences).slice(0, limit);
  }

  private computeTriggeredPhenomenaBetween(
    calendar: CalendarSchema,
    phenomena: ReadonlyArray<Phenomenon>,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): PhenomenonOccurrence[] {
    if (phenomena.length === 0) {
      return [];
    }

    const occurrences: PhenomenonOccurrence[] = [];
    for (const phenomenon of phenomena) {
      try {
        const result = computePhenomenonOccurrencesInRange(
          phenomenon,
          calendar,
          calendar.id,
          start,
          end,
        );
        occurrences.push(...result);
      } catch {
        continue;
      }
    }

    return sortOccurrencesByTimestamp(calendar, occurrences);
  }
}

function clonePreferences(preferences: AlmanacPreferencesSnapshot | undefined): AlmanacPreferencesSnapshot {
  const base = preferences ?? {};
  return {
    ...base,
    lastZoomByMode: base.lastZoomByMode ? { ...base.lastZoomByMode } : undefined,
    eventsFilters: base.eventsFilters
      ? {
          categories: [...base.eventsFilters.categories],
          calendarIds: [...base.eventsFilters.calendarIds],
        }
      : undefined,
  };
}

function cloneTimestamp(timestamp: CalendarTimestamp): CalendarTimestamp {
  return { ...timestamp };
}

function normaliseStore(input: GatewayStoreData): GatewayStoreData {
  const scopes = { ...input.scopes };
  if (!scopes[GLOBAL_SCOPE]) {
    scopes[GLOBAL_SCOPE] = { activeCalendarId: null, currentTimestamp: null };
  }
  return {
    scopes,
    preferences: clonePreferences(input.preferences),
    travelLeaf: { ...(input.travelLeaf ?? {}) },
  };
}

function createInitialStore(): GatewayStoreData {
  return {
    scopes: { [GLOBAL_SCOPE]: { activeCalendarId: null, currentTimestamp: null } },
    preferences: {},
    travelLeaf: {},
  };
}
