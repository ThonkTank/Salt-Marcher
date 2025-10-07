// src/apps/almanac/mode/contracts.ts
// Shared Almanac state contracts, enums and DTO definitions.

/**
 * Almanac Workmode Contracts
 *
 * Centralises shared enums, state slices and DTOs used by the Almanac workmode
 * state machine, controller and persistence gateways.
 */

import type { CalendarSchema } from "../domain/calendar-schema";
import type { CalendarTimestamp } from "../domain/calendar-timestamp";
import type { CalendarEvent } from "../domain/calendar-event";
import type { PhenomenonOccurrence } from "../domain/phenomenon";

export type AlmanacMode = "dashboard" | "manager" | "events";
export type CalendarManagerViewMode = "calendar" | "overview";
export type CalendarViewZoom = "month" | "week" | "day" | "hour";
export type EventsViewMode = "timeline" | "table" | "map";
export type TravelCalendarMode = "month" | "week" | "day" | "upcoming";

export interface AlmanacBreadcrumb {
    readonly label: string;
    readonly mode: AlmanacMode;
}

export interface AlmanacStatusSummary {
    readonly zoomLabel?: string;
    readonly filterCount?: number;
}

export interface TravelPresenceSummary {
    readonly isActive: boolean;
    readonly hasPendingFollowUps: boolean;
    readonly label: string;
}

export interface CalendarStateSlice {
    readonly calendars: ReadonlyArray<CalendarSchema>;
    readonly activeCalendarId: string | null;
    readonly defaultCalendarId: string | null;
    readonly travelDefaultCalendarId: string | null;
    readonly currentTimestamp: CalendarTimestamp | null;
    readonly timeDefinition?: {
        readonly hoursPerDay: number;
        readonly minutesPerHour: number;
        readonly minuteStep: number;
    };
    readonly lastAdvanceStep?: {
        readonly amount: number;
        readonly unit: "day" | "hour" | "minute";
    };
    readonly upcomingEvents: ReadonlyArray<CalendarEvent>;
    readonly triggeredEvents: ReadonlyArray<CalendarEvent>;
    readonly upcomingPhenomena: ReadonlyArray<PhenomenonOccurrence>;
    readonly triggeredPhenomena: ReadonlyArray<PhenomenonOccurrence>;
    readonly isPersisting: boolean;
}

export interface AlmanacUiStateSlice {
    readonly mode: AlmanacMode;
    readonly modeHistory: ReadonlyArray<AlmanacMode>;
    readonly statusSummary?: AlmanacStatusSummary;
    readonly drawerOpen: boolean;
    readonly lastZoomByMode: Partial<Record<AlmanacMode, CalendarViewZoom>>;
    readonly lastFiltersByMode: Partial<Record<AlmanacMode, number>>;
    readonly isLoading: boolean;
    readonly error?: string;
}

export interface ManagerUiStateSlice {
    readonly viewMode: CalendarManagerViewMode;
    readonly zoom: CalendarViewZoom;
    readonly isLoading: boolean;
    readonly error?: string;
    readonly selection: ReadonlyArray<string>;
    readonly anchorTimestamp: CalendarTimestamp | null;
    readonly agendaItems: ReadonlyArray<CalendarEvent>;
    readonly jumpPreview: ReadonlyArray<CalendarEvent>;
}

export interface EventsUiStateSlice {
    readonly viewMode: EventsViewMode;
    readonly isLoading: boolean;
    readonly filterCount: number;
    readonly error?: string;
    readonly filters: EventsFilterState;
    readonly availableCategories: ReadonlyArray<string>;
    readonly availableCalendars: ReadonlyArray<{ readonly id: string; readonly name: string }>;
    readonly phenomena: ReadonlyArray<{
        readonly id: string;
        readonly title: string;
        readonly category?: string;
        readonly nextOccurrence?: string;
        readonly linkedCalendars?: ReadonlyArray<string>;
    }>;
    readonly selectedPhenomenonId?: string | null;
    readonly selectedPhenomenonDetail?: PhenomenonDetailView | null;
    readonly isDetailLoading: boolean;
}

export interface EventsFilterState {
    readonly categories: ReadonlyArray<string>;
    readonly calendarIds: ReadonlyArray<string>;
}

export interface PhenomenonDetailView {
    readonly id: string;
    readonly name: string;
    readonly category?: string;
    readonly notes?: string;
    readonly linkedCalendars: ReadonlyArray<{ readonly id: string; readonly name: string }>;
    readonly upcomingOccurrences: ReadonlyArray<{
        readonly calendarId: string;
        readonly calendarName: string;
        readonly nextLabel: string;
        readonly nextTimestamp: CalendarTimestamp;
        readonly subsequent: ReadonlyArray<string>;
    }>;
}

export interface TravelLeafStateSlice {
    readonly visible: boolean;
    readonly mode: TravelCalendarMode;
    readonly isLoading: boolean;
    readonly error?: string;
}

export interface TelemetryStateSlice {
    readonly lastEvents: ReadonlyArray<string>;
}

export interface AlmanacState {
    readonly calendarState: CalendarStateSlice;
    readonly almanacUiState: AlmanacUiStateSlice;
    readonly managerUiState: ManagerUiStateSlice;
    readonly eventsUiState: EventsUiStateSlice;
    readonly travelLeafState: TravelLeafStateSlice;
    readonly telemetryState: TelemetryStateSlice;
}

export type AlmanacStateListener = (state: AlmanacState) => void;

export interface AlmanacPreferencesSnapshot {
    readonly lastMode?: AlmanacMode;
    readonly managerViewMode?: CalendarManagerViewMode;
    readonly eventsViewMode?: EventsViewMode;
    readonly lastZoomByMode?: Partial<Record<AlmanacMode, CalendarViewZoom>>;
    readonly eventsFilters?: EventsFilterState;
    readonly lastSelectedPhenomenonId?: string;
}

export type AlmanacEvent =
    | { readonly type: "INIT_ALMANAC"; readonly travelId?: string | null }
    | { readonly type: "ALMANAC_MODE_SELECTED"; readonly mode: AlmanacMode }
    | { readonly type: "MANAGER_VIEW_MODE_CHANGED"; readonly viewMode: CalendarManagerViewMode }
    | { readonly type: "MANAGER_ZOOM_CHANGED"; readonly zoom: CalendarViewZoom }
    | { readonly type: "MANAGER_NAVIGATION_REQUESTED"; readonly direction: 'prev' | 'next' | 'today' }
    | { readonly type: "TIME_JUMP_PREVIEW_REQUESTED"; readonly timestamp: CalendarTimestamp }
    | { readonly type: "MANAGER_AGENDA_REFRESH_REQUESTED" }
    | { readonly type: "EVENTS_VIEW_MODE_CHANGED"; readonly viewMode: EventsViewMode }
    | { readonly type: "EVENTS_FILTER_CHANGED"; readonly filters: EventsFilterState }
    | { readonly type: "EVENTS_PHENOMENON_SELECTED"; readonly phenomenonId: string }
    | { readonly type: "EVENTS_PHENOMENON_DETAIL_CLOSED" }
    | { readonly type: "MANAGER_SELECTION_CHANGED"; readonly selection: ReadonlyArray<string> }
    | { readonly type: "CALENDAR_SELECT_REQUESTED"; readonly calendarId: string }
    | { readonly type: "CALENDAR_DEFAULT_SET_REQUESTED"; readonly calendarId: string }
    | { readonly type: "TIME_ADVANCE_REQUESTED"; readonly amount: number; readonly unit: "day" | "hour" | "minute" }
    | { readonly type: "TIME_JUMP_REQUESTED"; readonly timestamp: CalendarTimestamp }
    | { readonly type: "CALENDAR_DATA_REFRESH_REQUESTED" }
    | { readonly type: "ERROR_OCCURRED"; readonly scope: "almanac" | "manager" | "events" | "travel"; readonly message: string };

export const DEFAULT_ALMANAC_MODE: AlmanacMode = "dashboard";
export const DEFAULT_MANAGER_VIEW_MODE: CalendarManagerViewMode = "calendar";
export const DEFAULT_EVENTS_VIEW_MODE: EventsViewMode = "timeline";
export const DEFAULT_MANAGER_ZOOM: CalendarViewZoom = "month";

export function createInitialAlmanacState(): AlmanacState {
    return {
        calendarState: {
            calendars: [],
            activeCalendarId: null,
            defaultCalendarId: null,
            travelDefaultCalendarId: null,
            currentTimestamp: null,
            timeDefinition: undefined,
            lastAdvanceStep: undefined,
            upcomingEvents: [],
            triggeredEvents: [],
            upcomingPhenomena: [],
            triggeredPhenomena: [],
            isPersisting: false,
        },
        almanacUiState: {
            mode: DEFAULT_ALMANAC_MODE,
            modeHistory: [DEFAULT_ALMANAC_MODE],
            statusSummary: undefined,
            drawerOpen: false,
            lastZoomByMode: {},
            lastFiltersByMode: {},
            isLoading: false,
            error: undefined,
        },
        managerUiState: {
            viewMode: DEFAULT_MANAGER_VIEW_MODE,
            zoom: DEFAULT_MANAGER_ZOOM,
            isLoading: false,
            error: undefined,
            selection: [],
            anchorTimestamp: null,
            agendaItems: [],
            jumpPreview: [],
        },
        eventsUiState: {
            viewMode: DEFAULT_EVENTS_VIEW_MODE,
            isLoading: false,
            filterCount: 0,
            error: undefined,
            filters: { categories: [], calendarIds: [] },
            availableCategories: [],
            availableCalendars: [],
            phenomena: [],
            selectedPhenomenonId: null,
            selectedPhenomenonDetail: null,
            isDetailLoading: false,
        },
        travelLeafState: {
            visible: false,
            mode: "upcoming",
            isLoading: false,
            error: undefined,
        },
        telemetryState: {
            lastEvents: [],
        },
    };
}
