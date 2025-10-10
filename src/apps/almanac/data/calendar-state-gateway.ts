// src/apps/almanac/data/calendar-state-gateway.ts
// Shared gateway interface, error types and implementations for Almanac calendar state.

import {
  advanceTime,
  compareTimestampsWithSchema,
  computeNextPhenomenonOccurrence,
  computePhenomenonOccurrencesInRange,
  createDayTimestamp,
  getEventAnchorTimestamp,
  getMonthById,
  isPhenomenonVisibleForCalendar,
  sortOccurrencesByTimestamp,
  type CalendarEvent,
  type CalendarSchema,
  type CalendarTimestamp,
  type Phenomenon,
  type PhenomenonOccurrence,
  type TimeUnit,
} from "../domain";
import type {
  AlmanacPreferencesSnapshot,
  TravelCalendarMode,
} from "../mode/contracts";
import { reportAlmanacGatewayIssue } from "../telemetry";
import type {
  CalendarDefaultsRepository,
  CalendarRepository,
  EventRepository,
  PhenomenonRepository,
} from "./repositories";
import { JsonStore, type VaultLike } from "./json-store";

export type CalendarGatewayErrorCode = "validation_error" | "io_error";

export class CalendarGatewayError extends Error {
  readonly code: CalendarGatewayErrorCode;
  readonly context?: Record<string, unknown>;

  constructor(code: CalendarGatewayErrorCode, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "CalendarGatewayError";
    this.code = code;
    this.context = context;
  }
}

export function createGatewayValidationError(
  message: string,
  context?: Record<string, unknown>,
): CalendarGatewayError {
  return new CalendarGatewayError("validation_error", message, context);
}

export function createGatewayIoError(
  message: string,
  context?: Record<string, unknown>,
): CalendarGatewayError {
  return new CalendarGatewayError("io_error", message, context);
}

export function isCalendarGatewayError(error: unknown): error is CalendarGatewayError {
  return error instanceof CalendarGatewayError;
}

export interface CalendarStateSnapshot {
  readonly activeCalendar: CalendarSchema | null;
  readonly currentTimestamp: CalendarTimestamp | null;
  readonly upcomingEvents: ReadonlyArray<CalendarEvent>;
  readonly upcomingPhenomena: ReadonlyArray<PhenomenonOccurrence>;
  readonly defaultCalendarId: string | null;
  readonly travelDefaultCalendarId: string | null;
  readonly isGlobalDefault: boolean;
  readonly wasAutoSelected: boolean;
}

export interface AdvanceTimeResult {
  readonly timestamp: CalendarTimestamp;
  readonly triggeredEvents: ReadonlyArray<CalendarEvent>;
  readonly triggeredPhenomena: ReadonlyArray<PhenomenonOccurrence>;
  readonly upcomingPhenomena: ReadonlyArray<PhenomenonOccurrence>;
}

export interface HookDispatchContext {
  readonly scope: "global" | "travel";
  readonly travelId?: string | null;
  readonly reason: "advance" | "jump";
}

export interface HookDispatchGateway {
  dispatchHooks(
    events: ReadonlyArray<CalendarEvent>,
    phenomena: ReadonlyArray<PhenomenonOccurrence>,
    context: HookDispatchContext,
  ): Promise<void>;
}

export interface TravelLeafPreferencesSnapshot {
  readonly visible: boolean;
  readonly mode: TravelCalendarMode;
  readonly lastViewedTimestamp?: CalendarTimestamp | null;
}

export interface CalendarStateGateway {
  loadSnapshot(options?: { readonly travelId?: string | null }): Promise<CalendarStateSnapshot>;
  setActiveCalendar(
    calendarId: string,
    options?: { readonly travelId?: string | null; readonly initialTimestamp?: CalendarTimestamp },
  ): Promise<void>;
  setDefaultCalendar(
    calendarId: string,
    options?: { readonly scope: "global" | "travel"; readonly travelId?: string | null },
  ): Promise<void>;
  setCurrentTimestamp(
    timestamp: CalendarTimestamp,
    options?: { readonly travelId?: string | null },
  ): Promise<void>;
  advanceTimeBy(
    amount: number,
    unit: TimeUnit,
    options?: { readonly travelId?: string | null; readonly hookContext?: HookDispatchContext },
  ): Promise<AdvanceTimeResult>;
  loadPreferences(): Promise<AlmanacPreferencesSnapshot>;
  savePreferences(partial: Partial<AlmanacPreferencesSnapshot>): Promise<void>;
  getCurrentTimestamp(options?: { readonly travelId?: string | null }): CalendarTimestamp | null;
  getActiveCalendarId(options?: { readonly travelId?: string | null }): string | null;
  getTravelLeafPreferences(travelId: string): Promise<TravelLeafPreferencesSnapshot | null>;
  saveTravelLeafPreferences(travelId: string, prefs: TravelLeafPreferencesSnapshot): Promise<void>;
}

const GLOBAL_SCOPE = "__global__";

interface ScopeState {
  activeCalendarId: string | null;
  currentTimestamp: CalendarTimestamp | null;
}

interface GatewayState {
  scopes: Map<string, ScopeState>;
  preferences: AlmanacPreferencesSnapshot;
  travelLeaf: Map<string, TravelLeafPreferencesSnapshot>;
}

type StateMutator = (state: GatewayState) => void;

interface GatewayStoreData {
  readonly scopes: Record<string, ScopeRecordPayload>;
  readonly preferences: AlmanacPreferencesSnapshot;
  readonly travelLeaf: Record<string, TravelLeafPreferencesSnapshot>;
}

interface ScopeRecordPayload {
  readonly activeCalendarId: string | null;
  readonly currentTimestamp: CalendarTimestamp | null;
}

function createInitialGatewayState(): GatewayState {
  return {
    scopes: new Map([[GLOBAL_SCOPE, { activeCalendarId: null, currentTimestamp: null }]]),
    preferences: {},
    travelLeaf: new Map(),
  };
}

function ensureScope(state: GatewayState, travelId: string | null): ScopeState {
  const key = travelId ?? GLOBAL_SCOPE;
  let scope = state.scopes.get(key);
  if (!scope) {
    scope = { activeCalendarId: null, currentTimestamp: null };
    state.scopes.set(key, scope);
  }
  return scope;
}

function cloneTimestamp(timestamp: CalendarTimestamp | null): CalendarTimestamp | null {
  return timestamp ? { ...timestamp } : null;
}

function clonePreferences(preferences: AlmanacPreferencesSnapshot | undefined): AlmanacPreferencesSnapshot {
  const base = preferences ?? {};
  return {
    ...base,
    eventsFilters: base.eventsFilters
      ? {
          categories: [...(base.eventsFilters.categories ?? [])],
          calendarIds: [...(base.eventsFilters.calendarIds ?? [])],
        }
      : undefined,
  };
}

function cloneTravelLeafMap(
  source: Map<string, TravelLeafPreferencesSnapshot>,
): Map<string, TravelLeafPreferencesSnapshot> {
  const clone = new Map<string, TravelLeafPreferencesSnapshot>();
  for (const [key, value] of source.entries()) {
    clone.set(key, { ...value });
  }
  return clone;
}

function normaliseStore(data: GatewayStoreData | null | undefined): GatewayState {
  const state = createInitialGatewayState();
  if (!data) {
    return state;
  }

  state.scopes.clear();
  const records = data.scopes ?? {};
  for (const [key, payload] of Object.entries(records)) {
    state.scopes.set(key, {
      activeCalendarId: payload?.activeCalendarId ?? null,
      currentTimestamp: payload?.currentTimestamp ? { ...payload.currentTimestamp } : null,
    });
  }
  if (!state.scopes.has(GLOBAL_SCOPE)) {
    state.scopes.set(GLOBAL_SCOPE, { activeCalendarId: null, currentTimestamp: null });
  }

  state.preferences = clonePreferences(data.preferences);

  state.travelLeaf.clear();
  for (const [key, value] of Object.entries(data.travelLeaf ?? {})) {
    state.travelLeaf.set(key, { ...value });
  }

  return state;
}

function serialiseState(state: GatewayState): GatewayStoreData {
  const scopes: Record<string, ScopeRecordPayload> = {};
  for (const [key, value] of state.scopes.entries()) {
    scopes[key] = {
      activeCalendarId: value.activeCalendarId,
      currentTimestamp: cloneTimestamp(value.currentTimestamp),
    };
  }
  return {
    scopes,
    preferences: clonePreferences(state.preferences),
    travelLeaf: Object.fromEntries(Array.from(state.travelLeaf.entries()).map(([key, value]) => [key, { ...value }])),
  };
}

function createInitialStore(): GatewayStoreData {
  return { scopes: { [GLOBAL_SCOPE]: { activeCalendarId: null, currentTimestamp: null } }, preferences: {}, travelLeaf: {} };
}

abstract class BaseCalendarStateGateway implements CalendarStateGateway {
  protected readonly state: GatewayState = createInitialGatewayState();

  private pendingMutations: StateMutator[] = [];
  private pendingFlushPromise: Promise<void> | null = null;
  private pendingFlushResolve: (() => void) | null = null;
  private pendingFlushReject: ((error: unknown) => void) | null = null;
  private pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private activeFlush: Promise<void> | null = null;

  constructor(
    protected readonly calendarRepo: CalendarRepository & CalendarDefaultsRepository,
    protected readonly eventRepo: EventRepository,
    protected readonly phenomenonRepo: PhenomenonRepository,
    protected readonly hookDispatcher?: HookDispatchGateway,
  ) {}

  async loadSnapshot(options?: { readonly travelId?: string | null }): Promise<CalendarStateSnapshot> {
    await this.ensureReady();
    const travelId = options?.travelId ?? null;
    const scope = ensureScope(this.state, travelId);

    const effective = await this.resolveEffectiveCalendar(travelId);
    const travelDefaultCalendarId = travelId ? await this.calendarRepo.getTravelDefault(travelId) : null;

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

    const activeCalendarId = scope.activeCalendarId ?? effective.calendar.id;
    const activeCalendar = await this.calendarRepo.getCalendar(activeCalendarId);
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

    const upcomingEvents = await this.resolveUpcomingEvents(activeCalendar, scope.currentTimestamp);
    const visiblePhenomena = await this.listVisiblePhenomena(activeCalendar);
    const upcomingPhenomena = this.computeUpcomingPhenomenaForCalendar(
      activeCalendar,
      visiblePhenomena,
      scope.currentTimestamp,
    );

    return {
      activeCalendar,
      currentTimestamp: cloneTimestamp(scope.currentTimestamp),
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
      const error = createGatewayValidationError(`Calendar with ID ${calendarId} not found`, {
        calendarId,
        travelId: options?.travelId ?? null,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.setActiveCalendar",
        scope: options?.travelId ? "travel" : "calendar",
        code: error.code,
        error,
        context: error.context,
      });
      throw error;
    }

    await this.mutateState(state => {
      const scope = ensureScope(state, options?.travelId ?? null);
      scope.activeCalendarId = calendarId;

      if (options?.initialTimestamp) {
        scope.currentTimestamp = { ...options.initialTimestamp };
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
        const error = createGatewayValidationError("Travel ID required when persisting travel default", {
          calendarId,
        });
        reportAlmanacGatewayIssue({
          operation: "calendar.gateway.setDefaultCalendar",
          scope: "travel",
          code: error.code,
          error,
          context: error.context,
        });
        throw error;
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
    await this.mutateState(state => {
      const scope = ensureScope(state, options?.travelId ?? null);
      if (!scope.activeCalendarId) {
        const error = createGatewayValidationError("No active calendar set", {
          travelId: options?.travelId ?? null,
        });
        reportAlmanacGatewayIssue({
          operation: "calendar.gateway.setCurrentTimestamp",
          scope: options?.travelId ? "travel" : "calendar",
          code: error.code,
          error,
          context: error.context,
        });
        throw error;
      }
      if (timestamp.calendarId !== scope.activeCalendarId) {
        const error = createGatewayValidationError("Timestamp calendar does not match active calendar", {
          travelId: options?.travelId ?? null,
          calendarId: timestamp.calendarId,
          activeCalendarId: scope.activeCalendarId,
        });
        reportAlmanacGatewayIssue({
          operation: "calendar.gateway.setCurrentTimestamp",
          scope: options?.travelId ? "travel" : "calendar",
          code: error.code,
          error,
          context: error.context,
        });
        throw error;
      }
      scope.currentTimestamp = { ...timestamp };
    });
  }

  async advanceTimeBy(
    amount: number,
    unit: TimeUnit,
    options?: { readonly travelId?: string | null; readonly hookContext?: HookDispatchContext },
  ): Promise<AdvanceTimeResult> {
    await this.ensureReady();
    const travelId = options?.travelId ?? null;
    const scope = ensureScope(this.state, travelId);
    if (!scope.activeCalendarId || !scope.currentTimestamp) {
      const error = createGatewayValidationError("No active calendar or current timestamp set", {
        travelId,
        activeCalendarId: scope.activeCalendarId,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.advanceTimeBy",
        scope: travelId ? "travel" : "calendar",
        code: error.code,
        error,
        context: error.context,
      });
      throw error;
    }

    const calendar = await this.calendarRepo.getCalendar(scope.activeCalendarId);
    if (!calendar) {
      const error = createGatewayValidationError(`Calendar ${scope.activeCalendarId} not found`, {
        travelId,
        calendarId: scope.activeCalendarId,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.advanceTimeBy",
        scope: travelId ? "travel" : "calendar",
        code: error.code,
        error,
        context: error.context,
      });
      throw error;
    }

    const visiblePhenomena = await this.listVisiblePhenomena(calendar);
    const previousTimestamp = { ...scope.currentTimestamp };
    const result = advanceTime(calendar, previousTimestamp, amount, unit);

    const [triggeredEvents, triggeredPhenomena] = await Promise.all([
      this.getEventsBetween(calendar, previousTimestamp, result.timestamp),
      Promise.resolve(
        this.computeTriggeredPhenomenaBetween(calendar, visiblePhenomena, previousTimestamp, result.timestamp),
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

    await this.mutateState(state => {
      const scoped = ensureScope(state, travelId);
      scoped.currentTimestamp = { ...result.timestamp };
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
        const causeMessage = error instanceof Error && error.message ? `: ${error.message}` : "";
        const gatewayError = new CalendarGatewayError("io_error", `Failed to dispatch hooks for time advance${causeMessage}`, {
          travelId,
          scope: travelId ? "travel" : "global",
        });
        reportAlmanacGatewayIssue({
          operation: "calendar.gateway.advanceTimeBy",
          scope: travelId ? "travel" : "calendar",
          code: gatewayError.code,
          error,
          context: gatewayError.context,
        });
        throw gatewayError;
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
    return clonePreferences(this.state.preferences);
  }

  async savePreferences(partial: Partial<AlmanacPreferencesSnapshot>): Promise<void> {
    await this.mutateState(state => {
      const next: AlmanacPreferencesSnapshot = {
        ...state.preferences,
        ...partial,
      };
      if (partial.eventsFilters) {
        next.eventsFilters = {
          categories: [...(partial.eventsFilters.categories ?? [])],
          calendarIds: [...(partial.eventsFilters.calendarIds ?? [])],
        };
      }
      state.preferences = next;
    }, { debounce: true });
  }

  getCurrentTimestamp(options?: { readonly travelId?: string | null }): CalendarTimestamp | null {
    const scope = ensureScope(this.state, options?.travelId ?? null);
    return cloneTimestamp(scope.currentTimestamp);
  }

  getActiveCalendarId(options?: { readonly travelId?: string | null }): string | null {
    const scope = ensureScope(this.state, options?.travelId ?? null);
    return scope.activeCalendarId;
  }

  async getTravelLeafPreferences(travelId: string): Promise<TravelLeafPreferencesSnapshot | null> {
    await this.ensureReady();
    const prefs = this.state.travelLeaf.get(travelId);
    return prefs ? { ...prefs } : null;
  }

  async saveTravelLeafPreferences(
    travelId: string,
    prefs: TravelLeafPreferencesSnapshot,
  ): Promise<void> {
    await this.mutateState(state => {
      state.travelLeaf.set(travelId, { ...prefs });
    }, { debounce: true });
  }

  async flushPendingPersistence(): Promise<void> {
    await this.ensureReady();
    await this.flushDebouncedPersist();
  }

  protected get persistenceDebounceMs(): number {
    return 25;
  }

  protected abstract ensureReady(): Promise<void>;
  protected abstract commitState(mutations: ReadonlyArray<StateMutator>): Promise<void>;

  protected async mutateState(mutator: StateMutator, options?: { readonly debounce?: boolean }): Promise<void> {
    await this.ensureReady();
    if (options?.debounce && this.persistenceDebounceMs > 0) {
      return this.enqueueDebouncedPersist(mutator);
    }
    await this.flushDebouncedPersist();
    await this.commitMutations([mutator]);
  }

  private enqueueDebouncedPersist(mutator: StateMutator): Promise<void> {
    this.pendingMutations.push(mutator);
    if (!this.pendingFlushPromise) {
      this.pendingFlushPromise = new Promise((resolve, reject) => {
        this.pendingFlushResolve = resolve;
        this.pendingFlushReject = reject;
      });
    }

    if (this.pendingFlushTimer) {
      clearTimeout(this.pendingFlushTimer);
    }

    this.pendingFlushTimer = setTimeout(() => {
      void this.flushDebouncedPersist();
    }, this.persistenceDebounceMs);

    return this.pendingFlushPromise;
  }

  private async flushDebouncedPersist(): Promise<void> {
    if (this.pendingFlushTimer) {
      clearTimeout(this.pendingFlushTimer);
      this.pendingFlushTimer = null;
    }

    if (this.activeFlush) {
      await this.activeFlush;
      return;
    }

    if (this.pendingMutations.length === 0) {
      if (this.pendingFlushPromise) {
        this.pendingFlushResolve?.();
        this.pendingFlushPromise = null;
        this.pendingFlushResolve = null;
        this.pendingFlushReject = null;
      }
      return;
    }

    const mutations = this.pendingMutations;
    this.pendingMutations = [];
    const resolve = this.pendingFlushResolve;
    const reject = this.pendingFlushReject;
    this.pendingFlushPromise = null;
    this.pendingFlushResolve = null;
    this.pendingFlushReject = null;

    const flushOperation = this.commitMutations(mutations)
      .then(() => {
        resolve?.();
      })
      .catch(error => {
        reject?.(error);
        throw error;
      })
      .finally(() => {
        this.activeFlush = null;
        if (this.pendingMutations.length > 0) {
          void this.flushDebouncedPersist();
        }
      });

    this.activeFlush = flushOperation;
    await flushOperation;
  }

  private async commitMutations(mutations: ReadonlyArray<StateMutator>): Promise<void> {
    if (!mutations.length) {
      return;
    }
    await this.commitState(mutations);
  }

  private async resolveUpcomingEvents(
    calendar: CalendarSchema,
    from: CalendarTimestamp | null,
  ): Promise<ReadonlyArray<CalendarEvent>> {
    if (!from) {
      return [];
    }
    if (typeof this.eventRepo.getUpcomingEvents === "function") {
      return this.eventRepo.getUpcomingEvents(calendar.id, calendar, from, 5);
    }
    const events = await this.eventRepo.listEvents(calendar.id);
    return events
      .filter(event =>
        compareTimestampsWithSchema(calendar, getEventAnchorTimestamp(event) ?? event.date, from) >= 0,
      )
      .slice(0, 5);
  }

  private async getEventsBetween(
    calendar: CalendarSchema,
    start: CalendarTimestamp,
    end: CalendarTimestamp,
  ): Promise<ReadonlyArray<CalendarEvent>> {
    if (typeof this.eventRepo.getEventsInRange === "function") {
      return this.eventRepo.getEventsInRange(calendar.id, calendar, start, end);
    }
    const events = await this.eventRepo.listEvents(calendar.id);
    const [rangeStart, rangeEnd] =
      compareTimestampsWithSchema(calendar, start, end) <= 0 ? [start, end] : [end, start];
    return events.filter(event => {
      const anchor = getEventAnchorTimestamp(event) ?? event.date;
      const afterStart = compareTimestampsWithSchema(calendar, anchor, rangeStart) >= 0;
      const beforeEnd = compareTimestampsWithSchema(calendar, anchor, rangeEnd) <= 0;
      return afterStart && beforeEnd;
    });
  }

  private async resolveEffectiveCalendar(
    travelId: string | null,
  ): Promise<
    | {
        calendar: CalendarSchema;
        calendarId: string | null;
        isGlobalDefault: boolean;
        wasAutoSelected: boolean;
      }
    | null
  > {
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

    const anchor =
      from ?? createDayTimestamp(calendar.id, calendar.epoch.year, calendar.epoch.monthId, calendar.epoch.day);

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

export class InMemoryStateGateway extends BaseCalendarStateGateway {
  constructor(
    calendarRepo: CalendarRepository & CalendarDefaultsRepository,
    eventRepo: EventRepository,
    phenomenonRepo: PhenomenonRepository,
    hookDispatcher?: HookDispatchGateway,
  ) {
    super(calendarRepo, eventRepo, phenomenonRepo, hookDispatcher);
  }

  protected get persistenceDebounceMs(): number {
    return 0;
  }

  protected async ensureReady(): Promise<void> {
    // No-op for in-memory state.
  }

  protected async commitState(mutations: ReadonlyArray<StateMutator>): Promise<void> {
    for (const mutate of mutations) {
      mutate(this.state);
    }
  }
}

export class VaultCalendarStateGateway extends BaseCalendarStateGateway {
  private readonly store: JsonStore<GatewayStoreData>;
  private ready: Promise<void> | null = null;
  private initialised = false;

  constructor(
    calendarRepo: CalendarRepository & CalendarDefaultsRepository,
    eventRepo: EventRepository,
    phenomenonRepo: PhenomenonRepository,
    vault: VaultLike,
    hookDispatcher?: HookDispatchGateway,
  ) {
    super(calendarRepo, eventRepo, phenomenonRepo, hookDispatcher);
    this.store = new JsonStore<GatewayStoreData>(vault, {
      path: "SaltMarcher/Almanac/state.json",
      currentVersion: "1.0.0",
      initialData: () => createInitialStore(),
    });
  }

  protected async ensureReady(): Promise<void> {
    if (this.initialised) {
      return;
    }
    if (!this.ready) {
      this.ready = this.store
        .read()
        .then(data => {
          const hydrated = normaliseStore(data);
          this.applyHydratedState(hydrated);
          this.initialised = true;
        })
        .catch(error => {
          const gatewayError = createGatewayIoError("Failed to load calendar state store");
          reportAlmanacGatewayIssue({
            operation: "calendar.gateway.bootstrap",
            scope: "calendar",
            code: gatewayError.code,
            error,
            context: gatewayError.context,
          });
          this.initialised = true;
        });
    }
    await this.ready;
  }

  protected async commitState(mutations: ReadonlyArray<StateMutator>): Promise<void> {
    for (const mutate of mutations) {
      mutate(this.state);
    }
    try {
      const payload = serialiseState(this.state);
      await this.store.update(() => payload);
    } catch (error) {
      const gatewayError = createGatewayIoError("Failed to persist calendar state");
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.persistState",
        scope: "calendar",
        code: gatewayError.code,
        error,
        context: gatewayError.context,
      });
      throw gatewayError;
    }
  }

  private applyHydratedState(source: GatewayState): void {
    this.state.scopes.clear();
    for (const [key, value] of source.scopes.entries()) {
      this.state.scopes.set(key, {
        activeCalendarId: value.activeCalendarId,
        currentTimestamp: cloneTimestamp(value.currentTimestamp),
      });
    }
    if (!this.state.scopes.has(GLOBAL_SCOPE)) {
      this.state.scopes.set(GLOBAL_SCOPE, { activeCalendarId: null, currentTimestamp: null });
    }
    this.state.preferences = clonePreferences(source.preferences);
    this.state.travelLeaf.clear();
    for (const [key, value] of source.travelLeaf.entries()) {
      this.state.travelLeaf.set(key, { ...value });
    }
  }
}
