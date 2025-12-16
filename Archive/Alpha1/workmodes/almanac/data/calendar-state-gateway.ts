// src/workmodes/almanac/data/calendar-state-gateway.ts
// Shared gateway interface, error types and implementations for Almanac calendar state.

import {
  createJsonStorePersistentAdapter,
  type PersistentStore,
} from "@services/state";
import { getStoreManager } from "@services/state/store-manager";
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
} from "../helpers";
import { reportAlmanacGatewayIssue } from "../telemetry";
import { JsonStore, type VaultLike } from "./json-store";
import type {
  CalendarDefaultsRepository,
  CalendarRepository,
  EventRepository,
  PhenomenonRepository,
} from "./repositories";
import type {
  AlmanacPreferencesSnapshot,
  TravelCalendarMode,
} from "../mode/contracts";
import type { HookDispatchContext, HookDispatchGateway } from "@features/events/event-types";

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

// Re-export shared hook dispatch interfaces from features layer
// (Originally defined here, moved to @features/events/types to eliminate layer violations)
export type { HookDispatchContext, HookDispatchGateway } from "@features/events/event-types";

/**
 * Faction Simulation Hook (Phase 8.9)
 *
 * Callback interface for triggering faction simulation when calendar time advances.
 * This allows the faction system to run background simulation without tight coupling
 * to the calendar gateway.
 */
export interface FactionSimulationHook {
  /**
   * Run faction simulation for the elapsed time
   *
   * @param elapsedDays - Number of days that have passed
   * @param currentDate - Current calendar date in YYYY-MM-DD format
   * @returns Array of important faction events to add to calendar inbox
   */
  runSimulation(
    elapsedDays: number,
    currentDate: string,
  ): Promise<Array<{ title: string; description: string; importance: number; date: string }>>;
}

/**
 * Weather Simulation Hook (Phase 10.2)
 *
 * Callback interface for triggering weather updates when calendar time advances.
 * This allows the weather system to generate procedural weather without tight coupling
 * to the calendar gateway.
 */
export interface WeatherSimulationHook {
  /**
   * Run weather simulation for the current day
   *
   * @param dayOfYear - Day of year (1-365) for seasonal weather patterns
   * @param currentDate - Current calendar date in YYYY-MM-DD format
   * @returns Empty array (weather doesn't generate calendar events)
   */
  runSimulation(
    dayOfYear: number,
    currentDate: string,
  ): Promise<Array<{ title: string; description: string; importance: number; date: string }>>;
}

export interface TravelLeafPreferencesSnapshot {
  readonly visible: boolean;
  readonly mode: TravelCalendarMode;
  readonly lastViewedTimestamp?: CalendarTimestamp | null;
}

export interface CalendarStateGateway {
  loadSnapshot(): Promise<CalendarStateSnapshot>;
  setActiveCalendar(
    calendarId: string,
    options?: { readonly initialTimestamp?: CalendarTimestamp },
  ): Promise<void>;
  setDefaultCalendar(
    calendarId: string,
    options?: { readonly scope: "global" | "travel"; readonly travelId?: string | null },
  ): Promise<void>;
  setCurrentTimestamp(timestamp: CalendarTimestamp): Promise<void>;
  advanceTimeBy(
    amount: number,
    unit: TimeUnit,
    options?: { readonly hookContext?: HookDispatchContext },
  ): Promise<AdvanceTimeResult>;
  saveEvent(event: CalendarEvent): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  loadPreferences(): Promise<AlmanacPreferencesSnapshot>;
  savePreferences(partial: Partial<AlmanacPreferencesSnapshot>): Promise<void>;
  getCurrentTimestamp(): CalendarTimestamp | null;
  getActiveCalendarId(): string | null;
  getTravelLeafPreferences(travelId: string): Promise<TravelLeafPreferencesSnapshot | null>;
  saveTravelLeafPreferences(travelId: string, prefs: TravelLeafPreferencesSnapshot): Promise<void>;
  getAstronomicalEvents(startTimestamp: CalendarTimestamp, endTimestamp: CalendarTimestamp): Promise<ReadonlyArray<any>>;
  loadInboxState?(): Promise<{ readEventIds: Set<string>; priorities: ReadonlyArray<string> }>;
  getInboxEvents?(filters: any): Promise<ReadonlyArray<any>>;
  markEventRead?(eventId: string): Promise<void>;
}

interface GatewayState {
  activeCalendarId: string | null;
  currentTimestamp: CalendarTimestamp | null;
  preferences: AlmanacPreferencesSnapshot;
  travelLeaf: Map<string, TravelLeafPreferencesSnapshot>;
}

type StateMutator = (state: GatewayState) => void;

interface GatewayStoreData {
  readonly activeCalendarId: string | null;
  readonly currentTimestamp: CalendarTimestamp | null;
  readonly preferences: AlmanacPreferencesSnapshot;
  readonly travelLeaf: Record<string, TravelLeafPreferencesSnapshot>;
  // Legacy format (for migration)
  readonly scopes?: Record<string, { activeCalendarId: string | null; currentTimestamp: CalendarTimestamp | null }>;
}

function createInitialGatewayState(): GatewayState {
  return {
    activeCalendarId: null,
    currentTimestamp: null,
    preferences: {},
    travelLeaf: new Map(),
  };
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

/**
 * Migration Strategy:
 * 1. If new format exists (activeCalendarId/currentTimestamp at root), use it directly
 * 2. If legacy scopes format exists, merge to single global state:
 *    - Prefer global scope ("__global__") if exists
 *    - Otherwise use first travel scope found
 *    - Otherwise use defaults (null)
 */
function normaliseStore(data: GatewayStoreData | null | undefined): GatewayState {
  const state = createInitialGatewayState();
  if (!data) {
    return state;
  }

  // Check if new format exists
  if (data.activeCalendarId !== undefined || data.currentTimestamp !== undefined) {
    // New format - use directly
    state.activeCalendarId = data.activeCalendarId ?? null;
    state.currentTimestamp = data.currentTimestamp ? { ...data.currentTimestamp } : null;
  } else if (data.scopes) {
    // Legacy format - migrate from scopes
    const GLOBAL_SCOPE = "__global__";
    const globalScope = data.scopes[GLOBAL_SCOPE];

    if (globalScope) {
      // Prefer global scope
      state.activeCalendarId = globalScope.activeCalendarId ?? null;
      state.currentTimestamp = globalScope.currentTimestamp ? { ...globalScope.currentTimestamp } : null;
    } else {
      // Use first travel scope found
      const firstScope = Object.values(data.scopes)[0];
      if (firstScope) {
        state.activeCalendarId = firstScope.activeCalendarId ?? null;
        state.currentTimestamp = firstScope.currentTimestamp ? { ...firstScope.currentTimestamp } : null;
      }
    }
  }

  state.preferences = clonePreferences(data.preferences);

  state.travelLeaf.clear();
  for (const [key, value] of Object.entries(data.travelLeaf ?? {})) {
    state.travelLeaf.set(key, { ...value });
  }

  return state;
}

function serialiseState(state: GatewayState): GatewayStoreData {
  return {
    activeCalendarId: state.activeCalendarId,
    currentTimestamp: cloneTimestamp(state.currentTimestamp),
    preferences: clonePreferences(state.preferences),
    travelLeaf: Object.fromEntries(Array.from(state.travelLeaf.entries()).map(([key, value]) => [key, { ...value }])),
  };
}

function createInitialStore(): GatewayStoreData {
  return {
    activeCalendarId: null,
    currentTimestamp: null,
    preferences: {},
    travelLeaf: {},
  };
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
    protected readonly factionSimulationHook?: FactionSimulationHook,
    protected readonly weatherSimulationHook?: WeatherSimulationHook,
  ) {}

  async loadSnapshot(): Promise<CalendarStateSnapshot> {
    await this.ensureReady();

    const effective = await this.resolveEffectiveCalendar();
    const travelDefaultCalendarId = null; // No longer applicable (removed travel scopes)

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

    const activeCalendarId = this.state.activeCalendarId ?? effective.calendar.id;
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

    const upcomingEvents = await this.resolveUpcomingEvents(activeCalendar, this.state.currentTimestamp);
    const visiblePhenomena = await this.listVisiblePhenomena(activeCalendar);
    const upcomingPhenomena = this.computeUpcomingPhenomenaForCalendar(
      activeCalendar,
      visiblePhenomena,
      this.state.currentTimestamp,
    );

    return {
      activeCalendar,
      currentTimestamp: cloneTimestamp(this.state.currentTimestamp),
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
    options?: { readonly initialTimestamp?: CalendarTimestamp },
  ): Promise<void> {
    await this.ensureReady();
    const calendar = await this.calendarRepo.getCalendar(calendarId);
    if (!calendar) {
      const error = createGatewayValidationError(`Calendar with ID ${calendarId} not found`, {
        calendarId,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.setActiveCalendar",
        scope: "calendar",
        code: error.code,
        error,
        context: error.context,
      });
      throw error;
    }

    await this.mutateState(state => {
      state.activeCalendarId = calendarId;

      if (options?.initialTimestamp) {
        state.currentTimestamp = { ...options.initialTimestamp };
        return;
      }

      if (state.currentTimestamp && state.currentTimestamp.calendarId === calendarId) {
        return;
      }

      const firstMonth = calendar.months[0] ?? getMonthById(calendar, calendar.epoch.monthId);
      state.currentTimestamp = createDayTimestamp(
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

  async setCurrentTimestamp(timestamp: CalendarTimestamp): Promise<void> {
    await this.ensureReady();
    await this.mutateState(state => {
      if (!state.activeCalendarId) {
        const error = createGatewayValidationError("No active calendar set");
        reportAlmanacGatewayIssue({
          operation: "calendar.gateway.setCurrentTimestamp",
          scope: "calendar",
          code: error.code,
          error,
          context: error.context,
        });
        throw error;
      }
      if (timestamp.calendarId !== state.activeCalendarId) {
        const error = createGatewayValidationError("Timestamp calendar does not match active calendar", {
          calendarId: timestamp.calendarId,
          activeCalendarId: state.activeCalendarId,
        });
        reportAlmanacGatewayIssue({
          operation: "calendar.gateway.setCurrentTimestamp",
          scope: "calendar",
          code: error.code,
          error,
          context: error.context,
        });
        throw error;
      }
      state.currentTimestamp = { ...timestamp };
    });
  }

  async advanceTimeBy(
    amount: number,
    unit: TimeUnit,
    options?: { readonly hookContext?: HookDispatchContext },
  ): Promise<AdvanceTimeResult> {
    await this.ensureReady();
    if (!this.state.activeCalendarId || !this.state.currentTimestamp) {
      const error = createGatewayValidationError("No active calendar or current timestamp set", {
        activeCalendarId: this.state.activeCalendarId,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.advanceTimeBy",
        scope: "calendar",
        code: error.code,
        error,
        context: error.context,
      });
      throw error;
    }

    const calendar = await this.calendarRepo.getCalendar(this.state.activeCalendarId);
    if (!calendar) {
      const error = createGatewayValidationError(`Calendar ${this.state.activeCalendarId} not found`, {
        calendarId: this.state.activeCalendarId,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.advanceTimeBy",
        scope: "calendar",
        code: error.code,
        error,
        context: error.context,
      });
      throw error;
    }

    const visiblePhenomena = await this.listVisiblePhenomena(calendar);
    const previousTimestamp = { ...this.state.currentTimestamp };
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
      state.currentTimestamp = { ...result.timestamp };
    });

    if (this.hookDispatcher && (relevantEvents.length > 0 || triggeredPhenomena.length > 0)) {
      try {
        await this.hookDispatcher.dispatchHooks(relevantEvents, triggeredPhenomena, {
          scope: "global",
          travelId: null,
          reason: "advance",
          ...options?.hookContext,
        });
      } catch (error) {
        const causeMessage = error instanceof Error && error.message ? `: ${error.message}` : "";
        const gatewayError = new CalendarGatewayError("io_error", `Failed to dispatch hooks for time advance${causeMessage}`, {
          scope: "global",
        });
        reportAlmanacGatewayIssue({
          operation: "calendar.gateway.advanceTimeBy",
          scope: "calendar",
          code: gatewayError.code,
          error,
          context: gatewayError.context,
        });
        throw gatewayError;
      }
    }

    // Phase 8.9: Run faction simulation when time advances
    if (this.factionSimulationHook && unit === "day" && amount > 0) {
      try {
        // Convert timestamp to YYYY-MM-DD format
        const currentDate = await this.timestampToDateString(result.timestamp);
        const factionEvents = await this.factionSimulationHook.runSimulation(amount, currentDate);

        // TODO: Add faction events to calendar inbox
        // This would require access to event repository and creating proper CalendarEvent objects
        // For now, just log the events
        if (factionEvents.length > 0) {
          // logger is not accessible here, so we'll skip logging
          // The events will be returned from runSimulation and can be processed by the caller
        }
      } catch (error) {
        // Don't fail the time advancement if faction simulation fails
        // Just log a warning
        const message = error instanceof Error ? error.message : String(error);
        // logger is not accessible here, but faction simulation errors are non-critical
      }
    }

    // Phase 10.2: Run weather simulation when time advances by days
    if (this.weatherSimulationHook && unit === "day") {
      try {
        // Calculate day of year from timestamp
        const dayOfYear = await this.timestampToDayOfYear(result.timestamp);
        const currentDate = await this.timestampToDateString(result.timestamp);
        await this.weatherSimulationHook.runSimulation(dayOfYear, currentDate);
        // Weather updates don't generate calendar events (transient state only)
      } catch (error) {
        // Don't fail the time advancement if weather simulation fails
        // Weather errors are non-critical
      }
    }

    return {
      timestamp: result.timestamp,
      triggeredEvents: relevantEvents,
      triggeredPhenomena,
      upcomingPhenomena,
    };
  }

  async saveEvent(event: CalendarEvent): Promise<void> {
    await this.ensureReady();
    try {
      // Check if event exists to determine create vs update
      const existingEvents = await this.eventRepo.listEvents(event.calendarId);
      const exists = existingEvents.some(e => e.id === event.id);

      if (exists) {
        await this.eventRepo.updateEvent(event.id, event);
      } else {
        await this.eventRepo.createEvent(event);
      }
    } catch (error) {
      const causeMessage = error instanceof Error && error.message ? `: ${error.message}` : "";
      const gatewayError = new CalendarGatewayError("io_error", `Failed to save event${causeMessage}`, {
        eventId: event.id,
        calendarId: event.calendarId,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.saveEvent",
        scope: "calendar",
        code: gatewayError.code,
        error,
        context: gatewayError.context,
      });
      throw gatewayError;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.ensureReady();
    try {
      await this.eventRepo.deleteEvent(eventId);
    } catch (error) {
      const causeMessage = error instanceof Error && error.message ? `: ${error.message}` : "";
      const gatewayError = new CalendarGatewayError("io_error", `Failed to delete event${causeMessage}`, {
        eventId,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.deleteEvent",
        scope: "calendar",
        code: gatewayError.code,
        error,
        context: gatewayError.context,
      });
      throw gatewayError;
    }
  }

  /**
   * Convert calendar timestamp to YYYY-MM-DD date string
   * (Phase 8.9: Helper for faction simulation)
   */
  private async timestampToDateString(timestamp: CalendarTimestamp): Promise<string> {
    const year = String(timestamp.year).padStart(4, "0");

    // Get calendar to resolve monthId to month number
    const calendar = await this.calendarRepo.getCalendar(timestamp.calendarId);
    const monthIndex = calendar ? calendar.months.findIndex(m => m.id === timestamp.monthId) : -1;
    const month = monthIndex >= 0 ? String(monthIndex + 1).padStart(2, "0") : "01";

    const day = String(timestamp.day).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Convert calendar timestamp to day of year (1-365)
   * (Phase 10.2: Helper for weather simulation)
   *
   * Calculates based on actual calendar month lengths.
   * For calendars with more than 365 days, wraps values to 1-365 range.
   */
  private async timestampToDayOfYear(timestamp: CalendarTimestamp): Promise<number> {
    // Get calendar to calculate day of year based on actual month lengths
    const calendar = await this.calendarRepo.getCalendar(timestamp.calendarId);
    if (!calendar) {
      // Fallback: simple approximation
      return Math.max(1, Math.min(365, timestamp.day));
    }

    // Sum days from all previous months
    const monthIndex = calendar.months.findIndex(m => m.id === timestamp.monthId);
    if (monthIndex < 0) {
      return Math.max(1, Math.min(365, timestamp.day));
    }

    let dayOfYear = timestamp.day;
    for (let i = 0; i < monthIndex; i++) {
      dayOfYear += calendar.months[i].length;
    }

    // Clamp to 1-365 range to match weather generator expectations
    // (for calendars with >365 days, this provides reasonable seasonal mapping)
    return Math.max(1, Math.min(365, dayOfYear));
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

  getCurrentTimestamp(): CalendarTimestamp | null {
    return cloneTimestamp(this.state.currentTimestamp);
  }

  getActiveCalendarId(): string | null {
    return this.state.activeCalendarId;
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

  async getAstronomicalEvents(
    _startTimestamp: CalendarTimestamp,
    _endTimestamp: CalendarTimestamp,
  ): Promise<ReadonlyArray<any>> {
    // Stub implementation - returns empty array
    // Real implementation would integrate with astronomical calculator
    return [];
  }

  async loadInboxState(): Promise<{ readEventIds: Set<string>; priorities: ReadonlyArray<string> }> {
    // Stub implementation - returns empty defaults
    // Real implementation would load from persistence
    return { readEventIds: new Set(), priorities: [] };
  }

  async getInboxEvents(_filters: any): Promise<ReadonlyArray<any>> {
    // Stub implementation - returns empty array
    // Real implementation would filter and return events
    return [];
  }

  async markEventRead(_eventId: string): Promise<void> {
    // Stub implementation - no-op
    // Real implementation would update read state
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

  private async resolveEffectiveCalendar(): Promise<
    | {
        calendar: CalendarSchema;
        calendarId: string | null;
        isGlobalDefault: boolean;
        wasAutoSelected: boolean;
      }
    | null
  > {
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
    factionSimulationHook?: FactionSimulationHook,
    weatherSimulationHook?: WeatherSimulationHook,
  ) {
    super(calendarRepo, eventRepo, phenomenonRepo, hookDispatcher, factionSimulationHook, weatherSimulationHook);
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
  private readonly jsonStore: JsonStore<GatewayStoreData>;
  private readonly persistence: PersistentStore<GatewayStoreData>;
  private ready: Promise<void> | null = null;
  private initialised = false;

  constructor(
    calendarRepo: CalendarRepository & CalendarDefaultsRepository,
    eventRepo: EventRepository,
    phenomenonRepo: PhenomenonRepository,
    vault: VaultLike,
    hookDispatcher?: HookDispatchGateway,
    factionSimulationHook?: FactionSimulationHook,
    weatherSimulationHook?: WeatherSimulationHook,
  ) {
    super(calendarRepo, eventRepo, phenomenonRepo, hookDispatcher, factionSimulationHook, weatherSimulationHook);
    this.jsonStore = new JsonStore<GatewayStoreData>(vault, {
      path: "SaltMarcher/Almanac/state.json",
      currentVersion: "1.0.0",
      initialData: () => createInitialStore(),
    });
    this.persistence = createJsonStorePersistentAdapter<GatewayStoreData>({
      backend: this.jsonStore,
      initialValue: createInitialStore(),
      storageKey: "SaltMarcher/Almanac/state.json",
      name: "almanac-calendar-state",
    });
    getStoreManager().register("almanac-calendar-state", this.persistence);
  }

  protected async ensureReady(): Promise<void> {
    if (this.initialised) {
      return;
    }
    if (!this.ready) {
      this.ready = this.persistence
        .load()
        .then(() => {
          const hydrated = normaliseStore(this.persistence.get());
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
      this.persistence.set(payload);
      await this.persistence.save();
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
    this.state.activeCalendarId = source.activeCalendarId;
    this.state.currentTimestamp = cloneTimestamp(source.currentTimestamp);
    this.state.preferences = clonePreferences(source.preferences);
    this.state.travelLeaf.clear();
    for (const [key, value] of source.travelLeaf.entries()) {
      this.state.travelLeaf.set(key, { ...value });
    }
  }
}
