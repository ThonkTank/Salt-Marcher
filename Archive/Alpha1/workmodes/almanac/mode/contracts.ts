// src/workmodes/almanac/mode/contracts.ts
// Shared Almanac state contracts, enums and DTO definitions.

/**
 * Almanac Workmode Contracts
 *
 * Centralises shared enums, state slices and DTOs used by the Almanac workmode
 * state machine, controller and persistence gateways.
 */

import type {
    CalendarEvent,
    CalendarSchema,
    CalendarTimestamp,
    PhenomenonOccurrence,
} from "../helpers";

export const ALMANAC_MODE_METADATA = {
    dashboard: {
        label: "Dashboard",
        description: "Current date, quick actions and upcoming events",
        icon: "layout-dashboard",
    },
    manager: {
        label: "Manager",
        description: "Manage calendars, zoom levels and defaults",
        icon: "settings",
    },
    events: {
        label: "Events",
        description: "Cross-calendar phenomena overview and filters",
        icon: "calendar-search",
    },
} as const satisfies Record<string, { readonly label: string; readonly description: string; readonly icon: string }>;

export type AlmanacMode = keyof typeof ALMANAC_MODE_METADATA;

export const ALMANAC_MODE_ORDER = Object.keys(ALMANAC_MODE_METADATA) as ReadonlyArray<AlmanacMode>;

export type CalendarViewZoom = "month" | "week" | "day" | "hour";

export const CALENDAR_VIEW_MODE_METADATA = {
    month: { label: "Month", icon: "calendar-days", defaultZoom: "month" },
    week: { label: "Week", icon: "calendar-range", defaultZoom: "week" },
    day: { label: "Day", icon: "calendar-clock", defaultZoom: "day" },
    upcoming: { label: "Next", icon: "list-ordered", defaultZoom: null },
} as const satisfies Record<
    string,
    {
        readonly label: string;
        readonly icon: string;
        readonly defaultZoom: CalendarViewZoom | null;
    }
>;

export type CalendarViewMode = keyof typeof CALENDAR_VIEW_MODE_METADATA;

export const CALENDAR_VIEW_MODE_ORDER = Object.keys(CALENDAR_VIEW_MODE_METADATA) as ReadonlyArray<CalendarViewMode>;

export const EVENTS_VIEW_MODE_METADATA = {
    timeline: { label: "Timeline" },
    table: { label: "Table" },
    map: { label: "Map" },
} as const satisfies Record<string, { readonly label: string }>;

export type EventsViewMode = keyof typeof EVENTS_VIEW_MODE_METADATA;

export const EVENTS_VIEW_MODE_ORDER = Object.keys(EVENTS_VIEW_MODE_METADATA) as ReadonlyArray<EventsViewMode>;

export type TravelCalendarMode = CalendarViewMode;

export interface AlmanacStatusSummary {
    zoomLabel?: string;
    filterCount?: number;
}

export interface TravelPresenceSummary {
    isActive: boolean;
    hasPendingFollowUps: boolean;
    label: string;
}

export interface CalendarStateSlice {
    calendars: CalendarSchema[];
    activeCalendarId: string | null;
    defaultCalendarId: string | null;
    travelDefaultCalendarId: string | null;
    currentTimestamp: CalendarTimestamp | null;
    timeDefinition?: {
        hoursPerDay: number;
        minutesPerHour: number;
        minuteStep: number;
    };
    lastAdvanceStep?: {
        amount: number;
        unit: "day" | "hour" | "minute";
    };
    upcomingEvents: CalendarEvent[];
    triggeredEvents: CalendarEvent[];
    upcomingPhenomena: PhenomenonOccurrence[];
    triggeredPhenomena: PhenomenonOccurrence[];
    isPersisting: boolean;
}

export interface AlmanacUiStateSlice {
    mode: AlmanacMode;
    modeHistory: AlmanacMode[];
    statusSummary?: AlmanacStatusSummary;
    drawerOpen: boolean;
    lastFiltersByMode: Partial<Record<AlmanacMode, number>>;
    isLoading: boolean;
    error?: string;
}

/**
 * State for the persistent calendar view (upper section in split-view layout).
 * This view is always visible and shows month/week/day/upcoming events.
 */
export interface CalendarViewState {
    mode: CalendarViewMode;
    anchorTimestamp: CalendarTimestamp | null;
    events: CalendarEvent[];
    isLoading: boolean;
    error?: string;
}

export interface CalendarCreateDraft {
    id: string;
    name: string;
    description: string;
    daysPerWeek: string;
    monthCount: string;
    monthLength: string;
    hoursPerDay: string;
    minutesPerHour: string;
    minuteStep: string;
    epochYear: string;
    epochDay: string;
}

export type CalendarCreateField = keyof CalendarCreateDraft;

export interface CalendarEditState {
    draft: CalendarCreateDraft;
    errors: string[];
    warnings: string[];
    isSaving: boolean;
}

export interface CalendarDeleteDialogState {
    calendarId: string;
    calendarName: string;
    requiresFallback: boolean;
    linkedTravelIds: string[];
    linkedPhenomena: string[];
    isDeleting: boolean;
    error?: string;
}

export interface CalendarConflictDialogState {
    calendarId: string;
    kind: "update" | "delete";
    message: string;
    details: string[];
}

/**
 * State for the Manager content tab (lower section in split-view layout).
 * Now only handles calendar overview (list/grid), not calendar view.
 */
export interface ManagerUiStateSlice {
    isLoading: boolean;
    error?: string;
    selection: string[];
    layout: "grid" | "list";
    anchorTimestamp: CalendarTimestamp | null;
    agendaItems: CalendarEvent[];
    jumpPreview: CalendarEvent[];
    createDraft: CalendarCreateDraft;
    createErrors: string[];
    isCreating: boolean;
    editStateById: Record<string, CalendarEditState>;
    deleteDialog: CalendarDeleteDialogState | null;
    conflictDialog: CalendarConflictDialogState | null;
}

export interface EventsUiStateSlice {
    viewMode: EventsViewMode;
    isLoading: boolean;
    filterCount: number;
    error?: string;
    filters: EventsFilterState;
    availableCategories: string[];
    availableCalendars: { id: string; name: string }[];
    mapMarkers: EventsMapMarker[];
    phenomena: {
        id: string;
        title: string;
        category?: string;
        nextOccurrence?: string;
        linkedCalendars?: string[];
    }[];
    selectedPhenomenonId?: string | null;
    selectedPhenomenonDetail?: PhenomenonDetailView | null;
    isDetailLoading: boolean;
    isEditorOpen: boolean;
    editorDraft: PhenomenonEditorDraft | null;
    isSaving: boolean;
    editorError?: string;
    bulkSelection: string[];
    lastExportPayload?: string;
    isImportDialogOpen: boolean;
    importError?: string;
    importSummary?: ImportSummary | null;
    isEventEditorOpen: boolean;
    eventEditorMode: EventEditorMode | null;
    eventEditorDraft: EventEditorDraft | null;
    eventEditorErrors: string[];
    eventEditorPreview: EventEditorPreviewItem[];
    isEventSaving: boolean;
    eventEditorError?: string;
}

export type EventEditorMode = "single" | "recurring";

export interface EventEditorPreviewItem {
    id: string;
    timestamp: CalendarTimestamp;
    label: string;
}

export interface EventEditorBaseDraft {
    id: string;
    calendarId: string;
    title: string;
    category: string;
    note: string;
    allDay: boolean;
    year: string;
    monthId: string;
    day: string;
    hour: string;
    minute: string;
    durationMinutes: string;
}

export interface SingleEventEditorDraft extends EventEditorBaseDraft {
    kind: "single";
    timePrecision: "day" | "hour" | "minute";
}

export interface RecurringEventEditorDraft extends EventEditorBaseDraft {
    kind: "recurring";
    ruleType: "weekly_dayIndex" | "monthly_position" | "annual_offset";
    ruleDayIndex: string;
    ruleInterval: string;
    ruleMonthId: string;
    ruleDay: string;
    timePolicy: "all_day" | "fixed" | "offset";
    boundsEndYear: string;
    boundsEndMonthId: string;
    boundsEndDay: string;
}

export type EventEditorDraft = SingleEventEditorDraft | RecurringEventEditorDraft;

export interface EventsFilterState {
    categories: string[];
    calendarIds: string[];
}

export interface EventsMapMarker {
    id: string;
    title: string;
    category?: string;
    nextOccurrence?: string;
    coordinates: { x: number; y: number };
    calendars: { id: string; name: string }[];
}

export interface PhenomenonEditorDraft {
    id: string;
    name: string;
    category: string;
    visibility: "all_calendars" | "selected";
    appliesToCalendarIds: string[];
    notes?: string;
}

export interface PhenomenonDetailView {
    id: string;
    name: string;
    category?: string;
    notes?: string;
    linkedCalendars: { id: string; name: string }[];
    upcomingOccurrences: {
        calendarId: string;
        calendarName: string;
        nextLabel: string;
        nextTimestamp: CalendarTimestamp;
        subsequent: string[];
    }[];
}

export interface TravelLeafStateSlice {
    travelId: string | null;
    visible: boolean;
    mode: TravelCalendarMode;
    currentTimestamp: CalendarTimestamp | null;
    minuteStep: number;
    lastQuickStep?: { amount: number; unit: "day" | "hour" | "minute" };
    isLoading: boolean;
    error?: string;
}

export interface ImportSummary {
    imported: number;
    failed: number;
}

export interface AlmanacState {
    calendarState: CalendarStateSlice;
    almanacUiState: AlmanacUiStateSlice;
    calendarViewState: CalendarViewState;
    managerUiState: ManagerUiStateSlice;
    eventsUiState: EventsUiStateSlice;
    travelLeafState: TravelLeafStateSlice;
}

export type AlmanacStateListener = (state: AlmanacState) => void;

export interface AlmanacPreferencesSnapshot {
    lastMode?: AlmanacMode;
    calendarViewMode?: CalendarViewMode;
    eventsViewMode?: EventsViewMode;
    eventsFilters?: EventsFilterState;
    lastSelectedPhenomenonId?: string;
}

export interface AlmanacInitOverrides {
    travelId?: string | null;
    mode?: AlmanacMode;
    calendarViewMode?: CalendarViewMode;
    eventsView?: EventsViewMode;
    selectedPhenomenonId?: string | null;
}

export type AlmanacEvent =
    | {
          readonly type: "INIT_ALMANAC";
          readonly travelId?: string | null;
          readonly overrides?: AlmanacInitOverrides | null;
      }
    | { readonly type: "ALMANAC_MODE_SELECTED"; readonly mode: AlmanacMode }
    | { readonly type: "CALENDAR_VIEW_MODE_CHANGED"; readonly mode: CalendarViewMode }
    | { readonly type: "MANAGER_NAVIGATION_REQUESTED"; readonly direction: 'prev' | 'next' | 'today' }
    | { readonly type: "MANAGER_CREATE_FORM_UPDATED"; readonly field: CalendarCreateField; readonly value: string }
    | { readonly type: "TIME_JUMP_PREVIEW_REQUESTED"; readonly timestamp: CalendarTimestamp }
    | { readonly type: "MANAGER_AGENDA_REFRESH_REQUESTED" }
    | { readonly type: "EVENTS_VIEW_MODE_CHANGED"; readonly viewMode: EventsViewMode }
    | { readonly type: "EVENTS_FILTER_CHANGED"; readonly filters: EventsFilterState }
    | { readonly type: "EVENTS_PHENOMENON_SELECTED"; readonly phenomenonId: string }
    | { readonly type: "EVENTS_PHENOMENON_DETAIL_CLOSED" }
    | { readonly type: "EVENTS_BULK_SELECTION_UPDATED"; readonly selection: ReadonlyArray<string> }
    | { readonly type: "PHENOMENON_EDIT_REQUESTED"; readonly phenomenonId?: string | null }
    | { readonly type: "PHENOMENON_EDIT_CANCELLED" }
    | { readonly type: "PHENOMENON_SAVE_REQUESTED"; readonly draft: PhenomenonEditorDraft }
    | {
          readonly type: "EVENT_BULK_ACTION_REQUESTED";
          readonly action: "delete" | "export";
          readonly ids?: ReadonlyArray<string>;
      }
    | { readonly type: "EVENT_EXPORT_CLEARED" }
    | { readonly type: "EVENT_IMPORT_REQUESTED" }
    | { readonly type: "EVENT_IMPORT_CANCELLED" }
    | { readonly type: "EVENT_IMPORT_SUBMITTED"; readonly payload: string }
    | {
          readonly type: "EVENT_CREATE_REQUESTED";
          readonly mode: EventEditorMode;
          readonly calendarId?: string;
          readonly timestamp?: CalendarTimestamp;
      }
    | { readonly type: "EVENT_EDIT_REQUESTED"; readonly eventId: string }
    | { readonly type: "EVENT_EDITOR_UPDATED"; readonly update: Partial<EventEditorDraft> }
    | { readonly type: "EVENT_EDITOR_CANCELLED" }
    | { readonly type: "EVENT_EDITOR_SAVE_REQUESTED" }
    | { readonly type: "EVENT_DELETE_REQUESTED"; readonly eventId: string }
    | { readonly type: "MANAGER_SELECTION_CHANGED"; readonly selection: ReadonlyArray<string> }
    | { readonly type: "CALENDAR_SELECT_REQUESTED"; readonly calendarId: string }
    | { readonly type: "CALENDAR_DEFAULT_SET_REQUESTED"; readonly calendarId: string }
    | { readonly type: "CALENDAR_EDIT_REQUESTED"; readonly calendarId: string }
    | { readonly type: "CALENDAR_EDIT_CANCELLED"; readonly calendarId: string }
    | {
          readonly type: "CALENDAR_EDIT_FORM_UPDATED";
          readonly calendarId: string;
          readonly field: CalendarCreateField;
          readonly value: string;
      }
    | { readonly type: "CALENDAR_UPDATE_REQUESTED"; readonly calendarId: string }
    | { readonly type: "CALENDAR_DELETE_REQUESTED"; readonly calendarId: string }
    | { readonly type: "CALENDAR_DELETE_CONFIRMED"; readonly calendarId: string }
    | { readonly type: "CALENDAR_DELETE_CANCELLED" }
    | { readonly type: "CALENDAR_CONFLICT_DISMISSED" }
    | { readonly type: "CALENDAR_CREATE_REQUESTED" }
    | { readonly type: "TIME_ADVANCE_REQUESTED"; readonly amount: number; readonly unit: "day" | "hour" | "minute" }
    | { readonly type: "TIME_JUMP_REQUESTED"; readonly timestamp: CalendarTimestamp }
    | { readonly type: "CALENDAR_DATA_REFRESH_REQUESTED" }
    | { readonly type: "TRAVEL_LEAF_MOUNTED"; readonly travelId: string }
    | { readonly type: "TRAVEL_MODE_CHANGED"; readonly mode: TravelCalendarMode }
    | { readonly type: "TRAVEL_TIME_ADVANCE_REQUESTED"; readonly amount: number; readonly unit: "day" | "hour" | "minute" }
    | { readonly type: "ERROR_OCCURRED"; readonly scope: "almanac" | "manager" | "events" | "travel"; readonly message: string };

export const DEFAULT_ALMANAC_MODE: AlmanacMode = ALMANAC_MODE_ORDER[0];
export const DEFAULT_CALENDAR_VIEW_MODE: CalendarViewMode = CALENDAR_VIEW_MODE_ORDER[0];
export const DEFAULT_EVENTS_VIEW_MODE: EventsViewMode = EVENTS_VIEW_MODE_ORDER[0];
export function createDefaultCalendarDraft(): CalendarCreateDraft {
    return {
        id: "",
        name: "",
        description: "",
        daysPerWeek: "7",
        monthCount: "12",
        monthLength: "30",
        hoursPerDay: "24",
        minutesPerHour: "60",
        minuteStep: "1",
        epochYear: "1",
        epochDay: "1",
    };
}

export function createEmptySingleEventDraft(
    calendarId: string,
    reference?: { readonly year: number; readonly monthId: string; readonly day: number },
): SingleEventEditorDraft {
    return {
        kind: "single",
        id: "",
        calendarId,
        title: "",
        category: "",
        note: "",
        allDay: true,
        year: reference ? String(reference.year) : "",
        monthId: reference ? reference.monthId : "",
        day: reference ? String(reference.day) : "",
        hour: "0",
        minute: "0",
        durationMinutes: "",
        timePrecision: "day",
    };
}

export function createEmptyRecurringEventDraft(
    calendarId: string,
    reference?: { readonly year: number; readonly monthId: string; readonly day: number },
): RecurringEventEditorDraft {
    return {
        kind: "recurring",
        id: "",
        calendarId,
        title: "",
        category: "",
        note: "",
        allDay: true,
        year: reference ? String(reference.year) : "",
        monthId: reference ? reference.monthId : "",
        day: reference ? String(reference.day) : "",
        hour: "0",
        minute: "0",
        durationMinutes: "",
        ruleType: "weekly_dayIndex",
        ruleDayIndex: "0",
        ruleInterval: "1",
        ruleMonthId: reference ? reference.monthId : "",
        ruleDay: reference ? String(reference.day) : "1",
        timePolicy: "all_day",
        boundsEndYear: "",
        boundsEndMonthId: "",
        boundsEndDay: "",
    };
}

export function createCalendarDraftFromSchema(schema: CalendarSchema): CalendarCreateDraft {
    const firstMonthLength = schema.months[0]?.length ?? 30;
    return {
        id: schema.id,
        name: schema.name,
        description: schema.description ?? "",
        daysPerWeek: String(schema.daysPerWeek),
        monthCount: String(schema.months.length),
        monthLength: String(firstMonthLength),
        hoursPerDay: String(schema.hoursPerDay ?? 24),
        minutesPerHour: String(schema.minutesPerHour ?? 60),
        minuteStep: String(schema.minuteStep ?? 1),
        epochYear: String(schema.epoch.year),
        epochDay: String(schema.epoch.day),
    };
}

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
            lastFiltersByMode: {},
            isLoading: false,
            error: undefined,
        },
        calendarViewState: {
            mode: DEFAULT_CALENDAR_VIEW_MODE,
            anchorTimestamp: null,
            events: [],
            isLoading: false,
            error: undefined,
        },
        managerUiState: {
            isLoading: false,
            error: undefined,
            selection: [],
            layout: 'grid',
            anchorTimestamp: null,
            agendaItems: [],
            jumpPreview: [],
            createDraft: createDefaultCalendarDraft(),
            createErrors: [],
            isCreating: false,
            editStateById: {},
            deleteDialog: null,
            conflictDialog: null,
        },
        eventsUiState: {
            viewMode: DEFAULT_EVENTS_VIEW_MODE,
            isLoading: false,
            filterCount: 0,
            error: undefined,
            filters: { categories: [], calendarIds: [] },
            availableCategories: [],
            availableCalendars: [],
            mapMarkers: [],
            phenomena: [],
            selectedPhenomenonId: null,
            selectedPhenomenonDetail: null,
            isDetailLoading: false,
            isEditorOpen: false,
            editorDraft: null,
            isSaving: false,
            editorError: undefined,
            bulkSelection: [],
            lastExportPayload: undefined,
            isImportDialogOpen: false,
            importError: undefined,
            importSummary: null,
            isEventEditorOpen: false,
            eventEditorMode: null,
            eventEditorDraft: null,
            eventEditorErrors: [],
            eventEditorPreview: [],
            isEventSaving: false,
            eventEditorError: undefined,
        },
        travelLeafState: {
            travelId: null,
            visible: false,
            mode: "upcoming",
            currentTimestamp: null,
            minuteStep: 1,
            lastQuickStep: undefined,
            isLoading: false,
            error: undefined,
        },
    };
}
