// src/apps/almanac/data/calendar-state-gateway.ts
// Shared gateway interface and types for persisting Almanac calendar state.

import type { CalendarEvent } from "../domain/calendar-event";
import type { CalendarSchema } from "../domain/calendar-schema";
import type { CalendarTimestamp } from "../domain/calendar-timestamp";
import type { PhenomenonOccurrence } from "../domain/phenomenon";
import type { TimeUnit } from "../domain/time-arithmetic";
import type {
  AlmanacPreferencesSnapshot,
  TravelCalendarMode,
} from "../mode/contracts";

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
