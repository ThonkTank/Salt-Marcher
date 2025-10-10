// src/apps/almanac/data/calendar-state-gateway.ts
// Shared gateway interface and types for persisting Almanac calendar state.

import type { CalendarSchema, CalendarTimestamp, TimeUnit } from "../domain/calendar-core";
import type { CalendarEvent, PhenomenonOccurrence } from "../domain/scheduling";
import type {
  AlmanacPreferencesSnapshot,
  TravelCalendarMode,
} from "../mode/contracts";

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
