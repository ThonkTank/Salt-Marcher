// src/apps/almanac/data/in-memory-gateway.ts
// In-memory implementation of the Almanac calendar state gateway for tests and previews.

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
import {
  CalendarGatewayError,
  createGatewayValidationError,
  type AdvanceTimeResult,
  type CalendarStateGateway,
  type CalendarStateSnapshot,
  type HookDispatchGateway,
  type HookDispatchContext,
  type TravelLeafPreferencesSnapshot,
} from "./calendar-state-gateway";
import type { AlmanacPreferencesSnapshot } from "../mode/contracts";
import { reportAlmanacGatewayIssue } from "../telemetry";

const GLOBAL_SCOPE = "__global__";

interface ScopeState {
  activeCalendarId: string | null;
  currentTimestamp: CalendarTimestamp | null;
}

export class InMemoryStateGateway implements CalendarStateGateway {
  private readonly scopeState = new Map<string, ScopeState>([
    [GLOBAL_SCOPE, { activeCalendarId: null, currentTimestamp: null }],
  ]);
  private readonly travelLeafPrefs = new Map<string, TravelLeafPreferencesSnapshot>();
  private preferences: AlmanacPreferencesSnapshot = {};

  constructor(
    private readonly calendarRepo: CalendarRepository & CalendarDefaultsRepository,
    private readonly eventRepo: EventRepository,
    private readonly phenomenonRepo: AlmanacRepository,
    private readonly hookDispatcher?: HookDispatchGateway,
  ) {}

  async loadSnapshot(options?: { readonly travelId?: string | null }): Promise<CalendarStateSnapshot> {
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

    const scope = this.ensureScope(options?.travelId ?? null);
    scope.activeCalendarId = calendarId;

    if (options?.initialTimestamp) {
      scope.currentTimestamp = { ...options.initialTimestamp };
      return;
    }

    if (scope.currentTimestamp && scope.currentTimestamp.calendarId === calendarId) {
      return;
    }

    const firstMonth = calendar.months[0] ?? getMonthById(calendar, calendar.epoch.monthId);
    const fallback = createDayTimestamp(
      calendar.id,
      calendar.epoch.year,
      firstMonth?.id ?? calendar.epoch.monthId,
      calendar.epoch.day,
    );
    scope.currentTimestamp = fallback;
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
    const scope = this.ensureScope(options?.travelId ?? null);
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
  }

  async advanceTimeBy(
    amount: number,
    unit: TimeUnit,
    options?: { readonly travelId?: string | null; readonly hookContext?: HookDispatchContext },
  ): Promise<AdvanceTimeResult> {
    const scopeId = options?.travelId ?? null;
    const scope = this.ensureScope(scopeId);
    if (!scope.activeCalendarId || !scope.currentTimestamp) {
      const error = createGatewayValidationError("No active calendar or current timestamp set", {
        travelId: scopeId,
        activeCalendarId: scope.activeCalendarId,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.advanceTimeBy",
        scope: scopeId ? "travel" : "calendar",
        code: error.code,
        error,
        context: error.context,
      });
      throw error;
    }

    const calendar = await this.calendarRepo.getCalendar(scope.activeCalendarId);
    if (!calendar) {
      const error = createGatewayValidationError(`Calendar ${scope.activeCalendarId} not found`, {
        travelId: scopeId,
        calendarId: scope.activeCalendarId,
      });
      reportAlmanacGatewayIssue({
        operation: "calendar.gateway.advanceTimeBy",
        scope: scopeId ? "travel" : "calendar",
        code: error.code,
        error,
        context: error.context,
      });
      throw error;
    }

    const visiblePhenomena = await this.listVisiblePhenomena(calendar);

    const previousTimestamp = { ...scope.currentTimestamp };
    const result = advanceTime(calendar, previousTimestamp, amount, unit);
    scope.currentTimestamp = result.timestamp;

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

    if (this.hookDispatcher && (relevantEvents.length > 0 || triggeredPhenomena.length > 0)) {
      try {
        await this.hookDispatcher.dispatchHooks(relevantEvents, triggeredPhenomena, {
          scope: scopeId ? "travel" : "global",
          travelId: scopeId,
          reason: "advance",
          ...options?.hookContext,
        });
      } catch (error) {
        const causeMessage = error instanceof Error && error.message ? `: ${error.message}` : "";
        const gatewayError = new CalendarGatewayError(
          "io_error",
          `Failed to dispatch hooks for time advance${causeMessage}`,
          {
            travelId: scopeId,
            scope: scopeId ? "travel" : "global",
          },
        );
        reportAlmanacGatewayIssue({
          operation: "calendar.gateway.advanceTimeBy",
          scope: scopeId ? "travel" : "calendar",
          code: gatewayError.code,
          error,
          context: gatewayError.context,
        });
        throw gatewayError;
      }
    }

    return { timestamp: result.timestamp, triggeredEvents: relevantEvents, triggeredPhenomena, upcomingPhenomena };
  }

  async loadPreferences(): Promise<AlmanacPreferencesSnapshot> {
    return clonePreferences(this.preferences);
  }

  async savePreferences(partial: Partial<AlmanacPreferencesSnapshot>): Promise<void> {
    const next: AlmanacPreferencesSnapshot = {
      ...this.preferences,
      ...partial,
    };

    if (partial.lastZoomByMode) {
      next.lastZoomByMode = {
        ...(this.preferences.lastZoomByMode ?? {}),
        ...partial.lastZoomByMode,
      };
    }

    if (partial.eventsFilters) {
      next.eventsFilters = {
        categories: [...(partial.eventsFilters.categories ?? [])],
        calendarIds: [...(partial.eventsFilters.calendarIds ?? [])],
      };
    }

    this.preferences = next;
  }

  getCurrentTimestamp(options?: { readonly travelId?: string | null }): CalendarTimestamp | null {
    const scope = this.ensureScope(options?.travelId ?? null);
    return scope.currentTimestamp ? { ...scope.currentTimestamp } : null;
  }

  getActiveCalendarId(options?: { readonly travelId?: string | null }): string | null {
    const scope = this.ensureScope(options?.travelId ?? null);
    return scope.activeCalendarId;
  }

  async getTravelLeafPreferences(travelId: string): Promise<TravelLeafPreferencesSnapshot | null> {
    return this.travelLeafPrefs.get(travelId) ?? null;
  }

  async saveTravelLeafPreferences(
    travelId: string,
    prefs: TravelLeafPreferencesSnapshot,
  ): Promise<void> {
    this.travelLeafPrefs.set(travelId, { ...prefs });
  }

  private ensureScope(travelId: string | null): ScopeState {
    const key = travelId ?? GLOBAL_SCOPE;
    if (!this.scopeState.has(key)) {
      this.scopeState.set(key, { activeCalendarId: null, currentTimestamp: null });
    }
    return this.scopeState.get(key)!;
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

function clonePreferences(preferences: AlmanacPreferencesSnapshot): AlmanacPreferencesSnapshot {
  return {
    ...preferences,
    lastZoomByMode: preferences.lastZoomByMode ? { ...preferences.lastZoomByMode } : undefined,
    eventsFilters: preferences.eventsFilters
      ? {
          categories: [...preferences.eventsFilters.categories],
          calendarIds: [...preferences.eventsFilters.calendarIds],
        }
      : undefined,
  };
}
