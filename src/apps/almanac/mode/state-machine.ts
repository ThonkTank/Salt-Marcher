// src/apps/almanac/mode/state-machine.ts
// State machine coordinating Almanac repositories, gateway and UI reducers.

/**
 * Almanac State Machine
 *
 * Light-weight presenter layer that coordinates repositories, gateways and UI state
 * for the Almanac workmode. Implements a minimal subset of the state machine
 * described in the design documents to support mode switching, calendar refreshes
 * and time advancement.
 */

import {
    createDefaultCalendarDraft,
    createCalendarDraftFromSchema,
    createEmptyRecurringEventDraft,
    createEmptySingleEventDraft,
    createInitialAlmanacState,
    DEFAULT_ALMANAC_MODE,
    DEFAULT_EVENTS_VIEW_MODE,
    DEFAULT_MANAGER_VIEW_MODE,
    DEFAULT_MANAGER_ZOOM,
    type AlmanacEvent,
    type AlmanacMode,
    type AlmanacPreferencesSnapshot,
    type AlmanacState,
    type AlmanacStateListener,
    type CalendarCreateDraft,
    type CalendarCreateField,
    type CalendarConflictDialogState,
    type CalendarDeleteDialogState,
    type CalendarEditState,
    type CalendarManagerViewMode,
    type CalendarStateSlice,
    type CalendarViewZoom,
    type EventEditorDraft,
    type EventEditorMode,
    type EventEditorPreviewItem,
    type EventsFilterState,
    type EventsMapMarker,
    type ImportSummary,
    type PhenomenonDetailView,
    type PhenomenonEditorDraft,
    type TravelCalendarMode,
} from "./contracts";
import type { CalendarDefaultsRepository, CalendarRepository } from "../data/calendar-repository";
import type { EventRepository } from "../data/event-repository";
import type { PhenomenonRepository } from "../data/in-memory-repository";
import {
    isCalendarGatewayError,
    type CalendarStateGateway,
    type TravelLeafPreferencesSnapshot,
} from "../data/calendar-state-gateway";
import type { PhenomenonDTO } from "../data/dto";
import { formatPhenomenaExport, parsePhenomenaImport } from "../data/phenomena-serialization";
import { getMonthById, getMonthIndex, getTimeDefinition, type CalendarSchema } from "../domain/calendar-schema";
import {
    computeNextEventOccurrence,
    createSingleEvent,
    isRecurringEvent,
    isSingleEvent,
    type CalendarEvent,
    type CalendarEventRecurring,
    type CalendarEventSingle,
    type CalendarTimeOfDay,
} from "../domain/calendar-event";
import {
    createDayTimestamp,
    createHourTimestamp,
    createMinuteTimestamp,
    formatTimestamp,
    type CalendarTimestamp,
} from "../domain/calendar-timestamp";
import { computeNextPhenomenonOccurrence } from "../domain/phenomenon-engine";
import type { Phenomenon, PhenomenonOccurrence } from "../domain/phenomenon";
import { advanceTime } from "../domain/time-arithmetic";
import type { RepeatRule } from "../domain/repeat-rule";
import {
    cartographerHookGateway as defaultCartographerGateway,
    type CartographerHookGateway,
    type TravelPanelUpdateInput,
} from "./cartographer-gateway";
import { emitAlmanacEvent, reportAlmanacGatewayIssue } from "../telemetry";
import { AlmanacRepositoryError } from "../data/almanac-repository";

const MAX_TRIGGERED_EVENTS = 10;
const MAX_TRIGGERED_PHENOMENA = 10;

type PhenomenonViewModel = {
    readonly id: string;
    readonly title: string;
    readonly category?: string;
    readonly linkedCalendars: ReadonlyArray<string>;
    readonly nextOccurrence?: string;
};

type PhenomenaListingOptions = {
    readonly bulkSelection?: ReadonlyArray<string>;
    readonly exportPayload?: string | null;
    readonly importSummary?: ImportSummary | null;
};

const ZOOM_LABEL: Record<CalendarViewZoom, string> = {
    month: "Month view",
    week: "Week view",
    day: "Day view",
    hour: "Hour view",
};

export class AlmanacStateMachine {
    private state: AlmanacState = createInitialAlmanacState();
    private readonly listeners = new Set<AlmanacStateListener>();
    private initialised = false;
    private phenomenaSource: PhenomenonViewModel[] = [];
    private phenomenaDefinitions: Phenomenon[] = [];
    private phenomenonIdCounter = 0;
    private eventIdCounter = 0;
    private travelId: string | null = null;
    private travelLeafPreferences: TravelLeafPreferencesSnapshot | null = null;
    private readonly cartographerGateway: CartographerHookGateway;

    constructor(
        private readonly calendarRepo: CalendarRepository,
        private readonly eventRepo: EventRepository,
        private readonly gateway: CalendarStateGateway,
        private readonly phenomenonRepo: PhenomenonRepository,
        cartographerGateway: CartographerHookGateway = defaultCartographerGateway,
    ) {
        this.cartographerGateway = cartographerGateway;
    }

    getState(): AlmanacState {
        return this.state;
    }

    subscribe(listener: AlmanacStateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    async dispatch(event: AlmanacEvent): Promise<void> {
        switch (event.type) {
            case "INIT_ALMANAC":
                await this.handleInit(event.travelId ?? null);
                break;
            case "ALMANAC_MODE_SELECTED":
                await this.handleModeSelected(event.mode);
                break;
            case "MANAGER_VIEW_MODE_CHANGED":
                await this.handleManagerViewMode(event.viewMode);
                break;
            case "MANAGER_ZOOM_CHANGED":
                await this.handleManagerZoom(event.zoom);
                break;
            case "MANAGER_NAVIGATION_REQUESTED":
                this.handleManagerNavigation(event.direction);
                break;
            case "MANAGER_CREATE_FORM_UPDATED":
                this.handleCreateFormUpdated(event.field, event.value);
                break;
            case "CALENDAR_CREATE_REQUESTED":
                await this.handleCalendarCreate();
                break;
            case "CALENDAR_EDIT_REQUESTED":
                this.handleCalendarEditRequested(event.calendarId);
                break;
            case "CALENDAR_EDIT_CANCELLED":
                this.handleCalendarEditCancelled(event.calendarId);
                break;
            case "CALENDAR_EDIT_FORM_UPDATED":
                this.handleCalendarEditFormUpdated(event.calendarId, event.field, event.value);
                break;
            case "CALENDAR_UPDATE_REQUESTED":
                await this.handleCalendarUpdate(event.calendarId);
                break;
            case "CALENDAR_DELETE_REQUESTED":
                await this.handleCalendarDeleteRequested(event.calendarId);
                break;
            case "CALENDAR_DELETE_CONFIRMED":
                await this.handleCalendarDeleteConfirmed(event.calendarId);
                break;
            case "CALENDAR_DELETE_CANCELLED":
                this.handleCalendarDeleteCancelled();
                break;
            case "CALENDAR_CONFLICT_DISMISSED":
                this.handleConflictDismissed();
                break;
            case "TIME_JUMP_PREVIEW_REQUESTED":
                await this.handleTimeJumpPreview(event.timestamp);
                break;
            case "EVENTS_VIEW_MODE_CHANGED":
                await this.handleEventsViewMode(event.viewMode);
                break;
            case "EVENTS_FILTER_CHANGED":
                this.handleEventsFilterChange(event.filters);
                break;
            case "EVENTS_PHENOMENON_SELECTED":
                await this.handlePhenomenonSelected(event.phenomenonId);
                break;
            case "EVENTS_PHENOMENON_DETAIL_CLOSED":
                this.handlePhenomenonDetailClosed();
                break;
            case "EVENTS_BULK_SELECTION_UPDATED":
                this.handleEventsBulkSelection(event.selection);
                break;
            case "PHENOMENON_EDIT_REQUESTED":
                await this.handlePhenomenonEditRequest(event.phenomenonId ?? null);
                break;
            case "PHENOMENON_EDIT_CANCELLED":
                this.handlePhenomenonEditCancelled();
                break;
            case "PHENOMENON_SAVE_REQUESTED":
                await this.handlePhenomenonSave(event.draft);
                break;
            case "EVENT_BULK_ACTION_REQUESTED":
                await this.handleEventBulkAction(event.action, event.ids);
                break;
            case "EVENT_EXPORT_CLEARED":
                this.handleEventExportCleared();
                break;
            case "EVENT_IMPORT_REQUESTED":
                this.handleEventImportRequested();
                break;
            case "EVENT_IMPORT_CANCELLED":
                this.handleEventImportCancelled();
                break;
            case "EVENT_IMPORT_SUBMITTED":
                await this.handleEventImportSubmitted(event.payload);
                break;
            case "EVENT_CREATE_REQUESTED":
                await this.handleEventCreateRequested(event.mode, event.calendarId);
                break;
            case "EVENT_EDIT_REQUESTED":
                await this.handleEventEditRequested(event.eventId);
                break;
            case "EVENT_EDITOR_UPDATED":
                this.handleEventEditorUpdated(event.update);
                break;
            case "EVENT_EDITOR_CANCELLED":
                this.handleEventEditorCancelled();
                break;
            case "EVENT_EDITOR_SAVE_REQUESTED":
                await this.handleEventEditorSave();
                break;
            case "EVENT_DELETE_REQUESTED":
                await this.handleEventDelete(event.eventId);
                break;
            case "MANAGER_SELECTION_CHANGED":
                this.handleManagerSelectionChanged(event.selection);
                break;
            case "CALENDAR_SELECT_REQUESTED":
                await this.handleCalendarSelect(event.calendarId);
                break;
            case "CALENDAR_DEFAULT_SET_REQUESTED":
                await this.handleCalendarDefault(event.calendarId);
                break;
            case "TIME_ADVANCE_REQUESTED":
                await this.handleTimeAdvance(event.amount, event.unit);
                break;
            case "TIME_JUMP_REQUESTED":
                await this.handleTimeJump(event.timestamp);
                break;
            case "CALENDAR_DATA_REFRESH_REQUESTED":
                await this.refreshCalendarData();
                break;
            case "TRAVEL_LEAF_MOUNTED":
                await this.handleTravelLeafMounted(event.travelId);
                break;
            case "TRAVEL_MODE_CHANGED":
                await this.handleTravelModeChanged(event.mode);
                break;
            case "TRAVEL_TIME_ADVANCE_REQUESTED":
                await this.handleTimeAdvance(event.amount, event.unit, "travel");
                break;
            case "ERROR_OCCURRED":
                this.setState(draft => {
                    if (event.scope === "almanac") {
                        draft.almanacUiState = {
                            ...draft.almanacUiState,
                            isLoading: false,
                            error: event.message,
                        };
                    } else if (event.scope === "manager") {
                        draft.managerUiState = {
                            ...draft.managerUiState,
                            isLoading: false,
                            error: event.message,
                        };
                    } else if (event.scope === "events") {
                        draft.eventsUiState = {
                            ...draft.eventsUiState,
                            isLoading: false,
                            error: event.message,
                        };
                    } else {
                        draft.travelLeafState = {
                            ...draft.travelLeafState,
                            isLoading: false,
                            error: event.message,
                        };
                    }
                });
                break;
            default:
                // Exhaustiveness safeguard
                const _never: never = event;
                return _never;
        }
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    private setState(mutator: (draft: AlmanacState) => void): void {
        const next = cloneState(this.state);
        mutator(next);
        next.almanacUiState = {
            ...next.almanacUiState,
            statusSummary: this.computeStatusSummary(next),
        };
        this.state = next;
        this.notify();
    }

    private computeStatusSummary(state: AlmanacState) {
        switch (state.almanacUiState.mode) {
            case "dashboard": {
                const upcoming = state.calendarState.upcomingEvents.length;
                return upcoming === 0
                    ? undefined
                    : { filterCount: upcoming };
            }
            case "manager": {
                const zoomLabel = ZOOM_LABEL[state.managerUiState.zoom];
                const filterCount = state.managerUiState.selection.length;
                return { zoomLabel, filterCount: filterCount > 0 ? filterCount : undefined };
            }
            case "events": {
                const filterCount = state.eventsUiState.filterCount;
                return filterCount > 0 ? { filterCount } : undefined;
            }
            default:
                return undefined;
        }
    }

    private async handleInit(travelId: string | null): Promise<void> {
        this.travelId = travelId;

        if (this.initialised) {
            await this.refreshCalendarData();
            return;
        }

        this.setState(draft => {
            draft.almanacUiState = {
                ...draft.almanacUiState,
                isLoading: true,
                error: undefined,
            };
        });

        try {
            const [calendars, snapshot, preferences, phenomena, travelPreferences] = await Promise.all([
                this.calendarRepo.listCalendars(),
                this.gateway.loadSnapshot(travelId ? { travelId } : undefined),
                this.gateway.loadPreferences(),
                this.phenomenonRepo.listPhenomena(),
                travelId ? this.gateway.getTravelLeafPreferences(travelId) : Promise.resolve(null),
            ]);
            this.travelLeafPreferences = travelPreferences;
            this.phenomenaDefinitions = phenomena.map(item => this.toPhenomenon(item));
            this.phenomenaSource = this.buildPhenomenonViewModels(
                this.phenomenaDefinitions,
                calendars,
                snapshot.activeCalendar?.id ?? null,
                snapshot.currentTimestamp,
            );
            const filters = preferences.eventsFilters ?? { categories: [], calendarIds: [] };
            const filteredPhenomena = this.applyPhenomenaFilters(filters);
            const availableCategories = getUniqueCategories(this.phenomenaSource);
            const filterCount = filters.categories.length + filters.calendarIds.length;
            const preferredPhenomenonId = preferences.lastSelectedPhenomenonId ?? null;
            let initialSelectedId: string | null = null;
            let initialDetail: PhenomenonDetailView | null = null;

            if (preferredPhenomenonId && filteredPhenomena.some(item => item.id === preferredPhenomenonId)) {
                initialDetail = this.buildPhenomenonDetailForId(
                    preferredPhenomenonId,
                    calendars,
                    snapshot.currentTimestamp,
                );
                initialSelectedId = initialDetail ? preferredPhenomenonId : null;
            }

            if (!initialSelectedId && filteredPhenomena.length > 0) {
                const firstId = filteredPhenomena[0].id;
                initialDetail = this.buildPhenomenonDetailForId(firstId, calendars, snapshot.currentTimestamp);
                initialSelectedId = initialDetail ? firstId : null;
            }

            const mode = preferences.lastMode ?? DEFAULT_ALMANAC_MODE;
            const managerViewMode = preferences.managerViewMode ?? DEFAULT_MANAGER_VIEW_MODE;
            const eventsViewMode = preferences.eventsViewMode ?? DEFAULT_EVENTS_VIEW_MODE;
            const zoom = (preferences.lastZoomByMode?.["manager"] ?? DEFAULT_MANAGER_ZOOM) as CalendarViewZoom;

            const activeCalendarId = snapshot.activeCalendar?.id ?? null;
            const timeDefinition = snapshot.activeCalendar
                ? (() => {
                      const { hoursPerDay, minutesPerHour, minuteStep } = getTimeDefinition(
                          snapshot.activeCalendar,
                      );
                      return { hoursPerDay, minutesPerHour, minuteStep };
                  })()
                : undefined;

            const defaultCalendarId = snapshot.defaultCalendarId
                ?? calendars.find(schema => schema.isDefaultGlobal)?.id
                ?? null;

            const calendarSlice: CalendarStateSlice = {
                calendars,
                activeCalendarId,
                defaultCalendarId,
                travelDefaultCalendarId: snapshot.travelDefaultCalendarId ?? null,
                currentTimestamp: snapshot.currentTimestamp,
                timeDefinition,
                lastAdvanceStep: undefined,
                upcomingEvents: snapshot.upcomingEvents,
                triggeredEvents: [],
                upcomingPhenomena: snapshot.upcomingPhenomena,
                triggeredPhenomena: [],
                isPersisting: false,
            };

            const mapMarkers = this.buildPhenomenonMapMarkers(filteredPhenomena, calendars);

            this.setState(draft => {
                draft.calendarState = calendarSlice;
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    mode,
                    modeHistory: [mode],
                    isLoading: false,
                    error: undefined,
                    lastZoomByMode: preferences.lastZoomByMode ?? {},
                };
                draft.managerUiState = {
                    ...draft.managerUiState,
                    viewMode: managerViewMode,
                    zoom,
                    isLoading: false,
                    error: undefined,
                    selection: [],
                    anchorTimestamp: calendarSlice.currentTimestamp,
                    agendaItems: calendarSlice.currentTimestamp
                        ? this.collectAgendaItems(calendarSlice.currentTimestamp, zoom, calendarSlice.upcomingEvents)
                        : [],
                };
                draft.eventsUiState = {
                    ...draft.eventsUiState,
                    viewMode: eventsViewMode,
                    isLoading: false,
                    error: undefined,
                    filterCount,
                    filters: { ...filters },
                    availableCategories,
                    availableCalendars: calendars.map(schema => ({ id: schema.id, name: schema.name })),
                    mapMarkers,
                    phenomena: filteredPhenomena,
                    selectedPhenomenonId: initialSelectedId,
                    selectedPhenomenonDetail: initialDetail,
                    isDetailLoading: false,
                };
                draft.travelLeafState = {
                    ...draft.travelLeafState,
                    travelId,
                    visible: travelPreferences?.visible ?? false,
                    mode: travelPreferences?.mode ?? draft.travelLeafState.mode,
                    currentTimestamp: calendarSlice.currentTimestamp,
                    minuteStep: calendarSlice.timeDefinition?.minuteStep ?? draft.travelLeafState.minuteStep,
                    lastQuickStep: undefined,
                    isLoading: false,
                    error: undefined,
                };
            });

            const initialPanel: TravelPanelUpdateInput = {
                travelId: this.travelId,
                currentTimestamp: snapshot.currentTimestamp,
                triggeredEvents: [],
                triggeredPhenomena: [],
                skippedEvents: [],
                skippedPhenomena: [],
                reason: "init",
            };
            await this.cartographerGateway.notifyTravelPanel(initialPanel);

            this.initialised = true;
            this.ensurePhenomenonSelection();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unbekannter Fehler beim Initialisieren";
            this.setState(draft => {
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    isLoading: false,
                    error: message,
                };
            });
            throw error;
        }
    }

    private async refreshCalendarData(): Promise<void> {
        this.setState(draft => {
            draft.almanacUiState = {
                ...draft.almanacUiState,
                isLoading: true,
            };
        });

        try {
            const [calendars, snapshot, phenomena] = await Promise.all([
                this.calendarRepo.listCalendars(),
                this.gateway.loadSnapshot(this.travelId ? { travelId: this.travelId } : undefined),
                this.phenomenonRepo.listPhenomena(),
            ]);
            this.phenomenaDefinitions = phenomena.map(item => this.toPhenomenon(item));
            this.phenomenaSource = this.buildPhenomenonViewModels(
                this.phenomenaDefinitions,
                calendars,
                snapshot.activeCalendar?.id ?? null,
                snapshot.currentTimestamp,
            );

            const filters: EventsFilterState = {
                categories: [...this.state.eventsUiState.filters.categories],
                calendarIds: [...this.state.eventsUiState.filters.calendarIds],
            };
            const filteredPhenomena = this.applyPhenomenaFilters(filters);
            const availableCategories = getUniqueCategories(this.phenomenaSource);
            const filterCount = filters.categories.length + filters.calendarIds.length;
            const currentSelectedId = this.state.eventsUiState.selectedPhenomenonId ?? null;
            let nextSelectedId: string | null = null;
            let nextDetail: PhenomenonDetailView | null = null;

            if (currentSelectedId && filteredPhenomena.some(item => item.id === currentSelectedId)) {
                nextDetail = this.buildPhenomenonDetailForId(
                    currentSelectedId,
                    calendars,
                    snapshot.currentTimestamp,
                );
                nextSelectedId = nextDetail ? currentSelectedId : null;
            }

            if (!nextSelectedId && filteredPhenomena.length > 0) {
                const firstId = filteredPhenomena[0].id;
                nextDetail = this.buildPhenomenonDetailForId(firstId, calendars, snapshot.currentTimestamp);
                nextSelectedId = nextDetail ? firstId : null;
            }

            const activeCalendarId = snapshot.activeCalendar?.id ?? null;
            const timeDefinition = snapshot.activeCalendar
                ? (() => {
                      const { hoursPerDay, minutesPerHour, minuteStep } = getTimeDefinition(
                          snapshot.activeCalendar,
                      );
                      return { hoursPerDay, minutesPerHour, minuteStep };
                  })()
                : undefined;

            const anchor = this.state.managerUiState.anchorTimestamp ?? snapshot.currentTimestamp ?? this.getAnchorFallback();
            const agendaItems = anchor
                ? this.collectAgendaItems(anchor, this.state.managerUiState.zoom, snapshot.upcomingEvents)
                : [];

            const defaultCalendarId = snapshot.defaultCalendarId
                ?? calendars.find(schema => schema.isDefaultGlobal)?.id
                ?? null;

            const mapMarkers = this.buildPhenomenonMapMarkers(filteredPhenomena, calendars);

            this.setState(draft => {
                const anchor = draft.managerUiState.anchorTimestamp ?? snapshot.currentTimestamp ?? this.getAnchorFallback();
                const agendaItems = anchor
                    ? this.collectAgendaItems(anchor, draft.managerUiState.zoom, snapshot.upcomingEvents)
                    : [];
                draft.calendarState = {
                    ...draft.calendarState,
                    calendars,
                    activeCalendarId,
                    defaultCalendarId,
                    travelDefaultCalendarId: snapshot.travelDefaultCalendarId ?? null,
                    currentTimestamp: snapshot.currentTimestamp,
                    timeDefinition,
                    upcomingEvents: snapshot.upcomingEvents,
                    upcomingPhenomena: snapshot.upcomingPhenomena,
                    isPersisting: false,
                };
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    isLoading: false,
                    error: undefined,
                };
                draft.managerUiState = {
                    ...draft.managerUiState,
                    anchorTimestamp: draft.managerUiState.anchorTimestamp ?? snapshot.currentTimestamp,
                    agendaItems,
                    jumpPreview: [],
                };
                draft.eventsUiState = {
                    ...draft.eventsUiState,
                    filterCount,
                    filters: { ...filters },
                    availableCategories,
                    availableCalendars: calendars.map(schema => ({ id: schema.id, name: schema.name })),
                    mapMarkers,
                    phenomena: filteredPhenomena,
                    selectedPhenomenonId: nextSelectedId,
                    selectedPhenomenonDetail: nextDetail,
                    isDetailLoading: false,
                };
                draft.travelLeafState = {
                    ...draft.travelLeafState,
                    travelId: this.travelId,
                    currentTimestamp: snapshot.currentTimestamp,
                    minuteStep: timeDefinition?.minuteStep ?? draft.travelLeafState.minuteStep,
                };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Kalenderdaten konnten nicht geladen werden";
            this.setState(draft => {
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    isLoading: false,
                    error: message,
                };
                draft.calendarState = {
                    ...draft.calendarState,
                    isPersisting: false,
                };
            });
        }
    }

    private async handleModeSelected(mode: AlmanacMode): Promise<void> {
        if (mode === this.state.almanacUiState.mode) {
            return;
        }

        const previousMode = this.state.almanacUiState.mode;
        this.setState(draft => {
            draft.almanacUiState = {
                ...draft.almanacUiState,
                mode,
                modeHistory: [...draft.almanacUiState.modeHistory, mode].slice(-5),
                error: undefined,
            };
        });

        emitAlmanacEvent({
            type: "calendar.almanac.mode_change",
            mode,
            previousMode,
            history: this.state.almanacUiState.modeHistory,
        });

        await this.persistPreferences({ lastMode: mode });

        if (mode === "events") {
            this.ensurePhenomenonSelection();
        }
    }

    private async handleManagerViewMode(viewMode: CalendarManagerViewMode): Promise<void> {
        if (viewMode === this.state.managerUiState.viewMode) {
            return;
        }

        const anchorBase = this.getAnchorBase();
        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                viewMode,
                isLoading: false,
                error: undefined,
                anchorTimestamp: anchorBase ?? draft.managerUiState.anchorTimestamp,
                agendaItems: anchorBase ? this.collectAgendaItems(anchorBase, draft.managerUiState.zoom) : [],
            };
        });

        await this.persistPreferences({ managerViewMode: viewMode });
    }

    private async handleManagerZoom(zoom: CalendarViewZoom): Promise<void> {
        if (zoom === this.state.managerUiState.zoom) {
            return;
        }

        const anchorBase = this.getAnchorBase();
        const agendaItems = anchorBase ? this.collectAgendaItems(anchorBase, zoom) : [];

        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                zoom,
                anchorTimestamp: anchorBase ?? draft.managerUiState.anchorTimestamp,
                agendaItems,
                jumpPreview: [],
            };
            draft.almanacUiState = {
                ...draft.almanacUiState,
                lastZoomByMode: {
                    ...draft.almanacUiState.lastZoomByMode,
                    manager: zoom,
                },
            };
        });

        await this.persistPreferences({
            lastZoomByMode: {
                ...this.state.almanacUiState.lastZoomByMode,
                manager: zoom,
            },
        });
    }

    private handleManagerNavigation(direction: 'prev' | 'next' | 'today'): void {
        const activeCalendarId = this.state.calendarState.activeCalendarId;
        if (!activeCalendarId) {
            return;
        }

        const schema = this.getCalendarSchema(activeCalendarId);
        if (!schema) {
            return;
        }

        const baseAnchor = this.state.managerUiState.anchorTimestamp
            ?? this.state.calendarState.currentTimestamp
            ?? createDayTimestamp(activeCalendarId, schema.epoch.year, schema.epoch.monthId, schema.epoch.day);

        const nextAnchor = direction === 'today'
            ? (this.state.calendarState.currentTimestamp ?? baseAnchor)
            : this.shiftAnchorTimestamp(schema, baseAnchor, this.state.managerUiState.zoom, direction);

        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                anchorTimestamp: nextAnchor,
                agendaItems: this.collectAgendaItems(nextAnchor, draft.managerUiState.zoom),
                jumpPreview: [],
            };
        });
    }

    private async handleEventsViewMode(viewMode: "timeline" | "table" | "map"): Promise<void> {
        if (viewMode === this.state.eventsUiState.viewMode) {
            return;
        }

        this.setState(draft => {
            draft.eventsUiState = {
                ...draft.eventsUiState,
                viewMode,
                error: undefined,
            };
        });

        await this.persistPreferences({ eventsViewMode: viewMode });

        if (this.state.almanacUiState.mode === "events") {
            this.ensurePhenomenonSelection();
        }
    }

    private handleEventsFilterChange(filters: EventsFilterState): void {
        const normalised: EventsFilterState = {
            categories: Array.from(new Set(filters.categories.filter(Boolean))),
            calendarIds: Array.from(new Set(filters.calendarIds.filter(Boolean))),
        };

        const filteredPhenomena = this.applyPhenomenaFilters(normalised);
        const filterCount = normalised.categories.length + normalised.calendarIds.length;
        const selectedCandidate = this.state.eventsUiState.selectedPhenomenonId ?? null;
        const calendars = this.state.calendarState.calendars;
        const referenceTimestamp = this.state.calendarState.currentTimestamp;
        let nextSelectedId: string | null = null;
        let nextDetail: PhenomenonDetailView | null = null;

        if (selectedCandidate && filteredPhenomena.some(item => item.id === selectedCandidate)) {
            nextDetail = this.buildPhenomenonDetailForId(selectedCandidate, calendars, referenceTimestamp);
            nextSelectedId = nextDetail ? selectedCandidate : null;
        }

        if (!nextSelectedId && filteredPhenomena.length > 0) {
            const firstId = filteredPhenomena[0].id;
            nextDetail = this.buildPhenomenonDetailForId(firstId, calendars, referenceTimestamp);
            nextSelectedId = nextDetail ? firstId : null;
        }

        const mapMarkers = this.buildPhenomenonMapMarkers(filteredPhenomena, calendars);

        this.setState(draft => {
            draft.eventsUiState = {
                ...draft.eventsUiState,
                filters: normalised,
                filterCount,
                mapMarkers,
                phenomena: filteredPhenomena,
                selectedPhenomenonId: nextSelectedId,
                selectedPhenomenonDetail: nextDetail,
                isDetailLoading: false,
            };
        });

        void this.persistPreferences({
            eventsFilters: normalised,
            lastSelectedPhenomenonId: nextSelectedId ?? undefined,
        });
    }

    private async handlePhenomenonSelected(phenomenonId: string): Promise<void> {
        this.setState(draft => {
            draft.eventsUiState = {
                ...draft.eventsUiState,
                selectedPhenomenonId: phenomenonId,
                isDetailLoading: true,
                error: undefined,
            };
        });

        try {
            const phenomenonDto = await this.phenomenonRepo.getPhenomenon(phenomenonId);
            if (!phenomenonDto) {
                throw new Error(`Phenomenon ${phenomenonId} not found`);
            }

            const normalised = this.toPhenomenon(phenomenonDto);
            this.phenomenaDefinitions = [
                ...this.phenomenaDefinitions.filter(item => item.id !== normalised.id),
                normalised,
            ];

            const detail = this.buildPhenomenonDetailView(
                normalised,
                this.state.calendarState.calendars,
                this.state.calendarState.currentTimestamp,
            );

            this.setState(draft => {
                draft.eventsUiState = {
                    ...draft.eventsUiState,
                    selectedPhenomenonId: phenomenonId,
                    selectedPhenomenonDetail: detail,
                    isDetailLoading: false,
                };
            });

            await this.persistPreferences({ lastSelectedPhenomenonId: phenomenonId });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Phenomenon could not be loaded";
            this.setState(draft => {
                draft.eventsUiState = {
                    ...draft.eventsUiState,
                    selectedPhenomenonId: null,
                    selectedPhenomenonDetail: null,
                    isDetailLoading: false,
                    error: message,
                };
            });

            await this.persistPreferences({ lastSelectedPhenomenonId: undefined });
        }
    }

    private handlePhenomenonDetailClosed(): void {
        this.setState(draft => {
            draft.eventsUiState = {
                ...draft.eventsUiState,
                selectedPhenomenonId: null,
                selectedPhenomenonDetail: null,
                isDetailLoading: false,
            };
        });

        void this.persistPreferences({ lastSelectedPhenomenonId: undefined });
    }

    private handleEventsBulkSelection(selection: ReadonlyArray<string>): void {
        const validIds = new Set(this.phenomenaDefinitions.map(item => item.id));
        const unique = Array.from(new Set(selection)).filter(id => validIds.has(id));
        this.setState(draft => {
            draft.eventsUiState = {
                ...draft.eventsUiState,
                bulkSelection: unique,
            };
        });
    }

    private async handlePhenomenonEditRequest(phenomenonId: string | null): Promise<void> {
        const base = phenomenonId
            ? this.phenomenaDefinitions.find(item => item.id === phenomenonId) ?? null
            : null;
        const draft = base
            ? this.createEditorDraftFromPhenomenon(base)
            : this.createDefaultEditorDraft(phenomenonId);

        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                isEditorOpen: true,
                editorDraft: draft,
                isSaving: false,
                editorError: undefined,
            };
        });

        if (phenomenonId && !base) {
            try {
                const loaded = await this.phenomenonRepo.getPhenomenon(phenomenonId);
                if (!loaded) {
                    throw new Error(`Phenomenon ${phenomenonId} not found`);
                }
                const normalised = this.toPhenomenon(loaded);
                this.phenomenaDefinitions = [
                    ...this.phenomenaDefinitions.filter(item => item.id !== normalised.id),
                    normalised,
                ];
                this.setState(next => {
                    next.eventsUiState = {
                        ...next.eventsUiState,
                        editorDraft: this.createEditorDraftFromPhenomenon(normalised),
                    };
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Editor konnte nicht geöffnet werden";
                this.setState(next => {
                    next.eventsUiState = {
                        ...next.eventsUiState,
                        editorError: message,
                    };
                });
            }
        }
    }

    private handlePhenomenonEditCancelled(): void {
        this.setState(draft => {
            draft.eventsUiState = {
                ...draft.eventsUiState,
                isEditorOpen: false,
                editorDraft: null,
                isSaving: false,
                editorError: undefined,
            };
        });
    }

    private async handlePhenomenonSave(draft: PhenomenonEditorDraft): Promise<void> {
        const trimmedName = draft.name.trim();
        if (!trimmedName) {
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    editorError: "Name darf nicht leer sein.",
                };
            });
            return;
        }

        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                isSaving: true,
                editorError: undefined,
            };
        });

        try {
            const existing = this.phenomenaDefinitions.find(item => item.id === draft.id) ?? null;
            const dto = this.buildPhenomenonFromDraft(draft, existing);
            const stored = await this.phenomenonRepo.upsertPhenomenon(dto);
            const normalised = this.toPhenomenon(stored);

            this.phenomenaDefinitions = [
                ...this.phenomenaDefinitions.filter(item => item.id !== normalised.id),
                normalised,
            ];

            this.rebuildPhenomenaListing(normalised.id, {
                bulkSelection: this.state.eventsUiState.bulkSelection,
                exportPayload: this.state.eventsUiState.lastExportPayload ?? undefined,
                importSummary: this.state.eventsUiState.importSummary ?? null,
            });

            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isEditorOpen: false,
                    editorDraft: null,
                    isSaving: false,
                    editorError: undefined,
                };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen";
            const code = error instanceof AlmanacRepositoryError ? error.code : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.phenomenon.save",
                scope: "phenomenon",
                code,
                error,
                context: { phenomenonId: draft.id },
            });
            if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
                emitAlmanacEvent({
                    type: "calendar.event.conflict",
                    code: "phenomenon",
                    message,
                    context: error.details,
                });
            }
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isSaving: false,
                    editorError: message,
                };
            });
        }
    }

    private async handleEventCreateRequested(
        mode: EventEditorMode,
        calendarId?: string,
    ): Promise<void> {
        const fallbackCalendarId =
            calendarId
            ?? this.state.calendarState.activeCalendarId
            ?? this.state.calendarState.defaultCalendarId
            ?? (this.state.calendarState.calendars[0]?.id ?? null);

        if (!fallbackCalendarId) {
            const message = "Kein Kalender verfügbar.";
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isEventEditorOpen: true,
                    eventEditorMode: mode,
                    eventEditorDraft: null,
                    eventEditorErrors: [message],
                    eventEditorPreview: [],
                    isEventSaving: false,
                    eventEditorError: message,
                };
            });
            return;
        }

        const schema = this.getCalendarSchema(fallbackCalendarId);
        const referenceTimestamp = this.state.calendarState.currentTimestamp;
        const reference = referenceTimestamp && referenceTimestamp.calendarId === fallbackCalendarId
            ? { year: referenceTimestamp.year, monthId: referenceTimestamp.monthId, day: referenceTimestamp.day }
            : schema
            ? { year: schema.epoch.year, monthId: schema.epoch.monthId, day: schema.epoch.day }
            : undefined;

        const draft = mode === "single"
            ? createEmptySingleEventDraft(fallbackCalendarId, reference)
            : createEmptyRecurringEventDraft(fallbackCalendarId, reference);

        const { errors, preview } = this.validateAndPreviewDraft(draft);

        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                isEventEditorOpen: true,
                eventEditorMode: mode,
                eventEditorDraft: draft,
                eventEditorErrors: errors,
                eventEditorPreview: preview,
                isEventSaving: false,
                eventEditorError: undefined,
            };
        });
    }

    private async handleEventEditRequested(eventId: string): Promise<void> {
        try {
            const event = await this.loadEventById(eventId);
            if (!event) {
                throw new Error(`Event ${eventId} konnte nicht gefunden werden.`);
            }
            const draft = this.createDraftFromEvent(event);
            const { errors, preview } = this.validateAndPreviewDraft(draft);

            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isEventEditorOpen: true,
                    eventEditorMode: draft.kind === "recurring" ? "recurring" : "single",
                    eventEditorDraft: draft,
                    eventEditorErrors: errors,
                    eventEditorPreview: preview,
                    isEventSaving: false,
                    eventEditorError: undefined,
                };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Ereignis konnte nicht geladen werden.";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.event.load",
                scope: "events",
                code: "io_error",
                error,
                context: { eventId },
            });
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isEventEditorOpen: false,
                    eventEditorMode: null,
                    eventEditorDraft: null,
                    eventEditorErrors: [message],
                    eventEditorPreview: [],
                    isEventSaving: false,
                    eventEditorError: message,
                };
            });
        }
    }

    private handleEventEditorUpdated(update: Partial<EventEditorDraft>): void {
        const current = this.state.eventsUiState.eventEditorDraft;
        if (!current) {
            return;
        }
        const nextDraft = { ...current, ...update } as EventEditorDraft;
        const { errors, preview } = this.validateAndPreviewDraft(nextDraft);
        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                eventEditorDraft: nextDraft,
                eventEditorMode: nextDraft.kind === "recurring" ? "recurring" : "single",
                eventEditorErrors: errors,
                eventEditorPreview: preview,
                eventEditorError: undefined,
            };
        });
    }

    private handleEventEditorCancelled(): void {
        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                isEventEditorOpen: false,
                eventEditorMode: null,
                eventEditorDraft: null,
                eventEditorErrors: [],
                eventEditorPreview: [],
                isEventSaving: false,
                eventEditorError: undefined,
            };
        });
    }

    private async handleEventEditorSave(): Promise<void> {
        const draft = this.state.eventsUiState.eventEditorDraft;
        if (!draft) {
            return;
        }

        const validation = this.validateEventDraft(draft);
        if (validation.errors.length > 0 || !validation.event) {
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    eventEditorErrors: validation.errors,
                    eventEditorPreview: [],
                    isEventSaving: false,
                    eventEditorError: validation.errors[0] ?? undefined,
                };
            });
            return;
        }

        const isNew = !draft.id;
        const targetId = isNew ? this.generateEventId() : draft.id;
        const event = validation.event;
        const payload = isSingleEvent(event)
            ? ({ ...event, id: targetId } as CalendarEventSingle)
            : ({ ...event, id: targetId } as CalendarEventRecurring);

        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                isEventSaving: true,
                eventEditorErrors: validation.errors,
                eventEditorPreview: validation.schema ? this.computeEventPreview(event, validation.schema) : [],
                eventEditorError: undefined,
            };
        });

        try {
            if (isNew) {
                await this.eventRepo.createEvent(payload);
            } else {
                await this.eventRepo.updateEvent(targetId, payload);
            }

            await this.refreshCalendarData();

            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isEventEditorOpen: false,
                    eventEditorMode: null,
                    eventEditorDraft: null,
                    eventEditorErrors: [],
                    eventEditorPreview: [],
                    isEventSaving: false,
                    eventEditorError: undefined,
                };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Ereignis konnte nicht gespeichert werden.";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.event.save",
                scope: "events",
                code: "io_error",
                error,
                context: { eventId: targetId, mode: isNew ? "create" : "update" },
            });
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isEventSaving: false,
                    eventEditorError: message,
                };
            });
        }
    }

    private async handleEventDelete(eventId: string): Promise<void> {
        try {
            await this.eventRepo.deleteEvent(eventId);
            await this.refreshCalendarData();
            this.setState(next => {
                const isEditingDeleted = next.eventsUiState.eventEditorDraft?.id === eventId;
                next.eventsUiState = {
                    ...next.eventsUiState,
                    bulkSelection: next.eventsUiState.bulkSelection.filter(id => id !== eventId),
                    ...(isEditingDeleted
                        ? {
                              isEventEditorOpen: false,
                              eventEditorMode: null,
                              eventEditorDraft: null,
                              eventEditorErrors: [],
                              eventEditorPreview: [],
                              isEventSaving: false,
                              eventEditorError: undefined,
                          }
                        : {}),
                };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Ereignis konnte nicht gelöscht werden.";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.event.delete",
                scope: "events",
                code: "io_error",
                error,
                context: { eventId },
            });
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    eventEditorError: message,
                };
            });
        }
    }

    private validateAndPreviewDraft(
        draft: EventEditorDraft,
    ): {
        readonly errors: ReadonlyArray<string>;
        readonly preview: ReadonlyArray<EventEditorPreviewItem>;
    } {
        const validation = this.validateEventDraft(draft);
        const preview = validation.event && validation.schema
            ? this.computeEventPreview(validation.event, validation.schema)
            : [];
        return { errors: validation.errors, preview };
    }

    private validateEventDraft(
        draft: EventEditorDraft,
    ): { readonly errors: string[]; readonly event: CalendarEvent | null; readonly schema: CalendarSchema | null } {
        const schema = this.getCalendarSchema(draft.calendarId);
        if (!schema) {
            return { errors: ["Kalender konnte nicht gefunden werden."], event: null, schema: null };
        }

        const errors: string[] = [];
        const title = draft.title.trim();
        if (!title) {
            errors.push("Titel darf nicht leer sein.");
        }
        if (!draft.calendarId) {
            errors.push("Kalender erforderlich.");
        }

        const year = Number.parseInt(draft.year, 10);
        if (Number.isNaN(year)) {
            errors.push("Jahr ist ungültig.");
        }

        const month = draft.monthId ? getMonthById(schema, draft.monthId) : null;
        if (!month) {
            errors.push("Monat ist ungültig.");
        }

        const day = Number.parseInt(draft.day, 10);
        if (Number.isNaN(day)) {
            errors.push("Tag ist ungültig.");
        } else if (month && (day < 1 || day > month.length)) {
            errors.push("Tag liegt außerhalb des Monats.");
        }

        const definition = getTimeDefinition(schema);
        const hoursPerDay = definition.hoursPerDay;
        const minutesPerHour = definition.minutesPerHour;
        const minuteStep = definition.minuteStep;

        let hourValue = 0;
        let minuteValue = 0;

        if (!draft.allDay) {
            hourValue = Number.parseInt(draft.hour, 10);
            if (Number.isNaN(hourValue)) {
                errors.push("Stunde ist ungültig.");
            } else if (hourValue < 0 || hourValue >= hoursPerDay) {
                errors.push(`Stunde muss zwischen 0 und ${hoursPerDay - 1} liegen.`);
            }

            minuteValue = Number.parseInt(draft.minute, 10);
            const requiresMinute = draft.kind === "single"
                ? draft.timePrecision === "minute" && !draft.allDay
                : !draft.allDay && draft.timePolicy !== "all_day";
            if (requiresMinute) {
                if (Number.isNaN(minuteValue)) {
                    errors.push("Minute ist ungültig.");
                } else if (minuteValue < 0 || minuteValue >= minutesPerHour) {
                    errors.push(`Minute muss zwischen 0 und ${minutesPerHour - 1} liegen.`);
                } else if (minuteValue % minuteStep !== 0) {
                    errors.push(`Minute muss im Schritt von ${minuteStep} liegen.`);
                }
            } else {
                minuteValue = 0;
            }
        }

        const duration = draft.durationMinutes.trim() ? Number.parseInt(draft.durationMinutes, 10) : undefined;
        if (duration !== undefined && (Number.isNaN(duration) || duration < 0)) {
            errors.push("Dauer muss eine positive Zahl sein.");
        }

        if (draft.kind === "recurring" && draft.timePolicy === "offset" && (duration === undefined || duration < 0)) {
            errors.push("Offset benötigt Minutenangabe.");
        }

        if (draft.kind === "recurring" && draft.allDay && draft.timePolicy !== "all_day") {
            errors.push("Ganztägige Ereignisse benötigen die Zeitstrategie 'Ganztägig'.");
        }

        if (errors.length > 0 || !month || Number.isNaN(year) || Number.isNaN(day)) {
            return { errors, event: null, schema };
        }

        const normalisedDay = Math.max(1, Math.min(day, month.length));

        const note = draft.note.trim() || undefined;
        const category = draft.category.trim() || undefined;
        const durationMinutes = duration !== undefined && duration >= 0 ? duration : undefined;

        if (draft.kind === "single") {
            let timestamp: CalendarTimestamp;
            if (draft.allDay || draft.timePrecision === "day") {
                timestamp = createDayTimestamp(draft.calendarId, year, draft.monthId, normalisedDay);
            } else if (draft.timePrecision === "hour") {
                timestamp = createHourTimestamp(draft.calendarId, year, draft.monthId, normalisedDay, hourValue);
            } else {
                timestamp = createMinuteTimestamp(
                    draft.calendarId,
                    year,
                    draft.monthId,
                    normalisedDay,
                    hourValue,
                    minuteValue,
                );
            }

            const startTime: CalendarTimeOfDay | undefined = draft.allDay
                ? undefined
                : {
                      hour: hourValue,
                      ...(draft.timePrecision === "minute" ? { minute: minuteValue } : {}),
                  };

            const event = createSingleEvent(draft.id || "__preview__", draft.calendarId, title, timestamp, {
                allDay: draft.allDay,
                category,
                note,
                durationMinutes,
                startTime,
                timePrecision: draft.timePrecision,
            });

            return { errors, event, schema };
        }

        let rule: RepeatRule | null = null;
        if (draft.ruleType === "weekly_dayIndex") {
            const dayIndex = Number.parseInt(draft.ruleDayIndex, 10);
            if (Number.isNaN(dayIndex) || dayIndex < 0 || dayIndex >= schema.daysPerWeek) {
                errors.push("Wochentag ist ungültig.");
            } else {
                const intervalValue = Number.parseInt(draft.ruleInterval, 10);
                rule = {
                    type: "weekly_dayIndex",
                    dayIndex,
                    ...(Number.isNaN(intervalValue) || intervalValue <= 1 ? {} : { interval: intervalValue }),
                };
            }
        } else if (draft.ruleType === "monthly_position") {
            const monthId = draft.ruleMonthId || draft.monthId;
            const monthForRule = getMonthById(schema, monthId);
            if (!monthForRule) {
                errors.push("Monat für Regel ist ungültig.");
            } else {
                const ruleDay = Number.parseInt(draft.ruleDay, 10);
                if (Number.isNaN(ruleDay) || ruleDay < 1) {
                    errors.push("Tag der Regel ist ungültig.");
                } else {
                    const clamped = Math.min(ruleDay, monthForRule.length);
                    rule = { type: "monthly_position", monthId, day: clamped };
                }
            }
        } else {
            const monthId = draft.ruleMonthId || draft.monthId;
            const monthForRule = getMonthById(schema, monthId);
            if (!monthForRule) {
                errors.push("Monat für Offset ist ungültig.");
            } else {
                const ruleDay = Number.parseInt(draft.ruleDay, 10);
                if (Number.isNaN(ruleDay) || ruleDay < 1) {
                    errors.push("Tag für Offset ist ungültig.");
                } else {
                    const clamped = Math.min(ruleDay, monthForRule.length);
                    const offset = this.getDayOfYearForMonth(schema, monthId, clamped);
                    rule = { type: "annual_offset", offsetDayOfYear: offset };
                }
            }
        }

        const endRequested = Boolean(
            draft.boundsEndYear || draft.boundsEndMonthId || draft.boundsEndDay,
        );
        let boundsEnd: CalendarTimestamp | undefined;
        if (endRequested) {
            if (!draft.boundsEndYear || !draft.boundsEndMonthId || !draft.boundsEndDay) {
                errors.push("Enddatum muss Jahr, Monat und Tag enthalten.");
            } else {
                const endMonth = getMonthById(schema, draft.boundsEndMonthId);
                const endYear = Number.parseInt(draft.boundsEndYear, 10);
                const endDay = Number.parseInt(draft.boundsEndDay, 10);
                if (!endMonth || Number.isNaN(endYear) || Number.isNaN(endDay)) {
                    errors.push("Enddatum ist ungültig.");
                } else {
                    const clampedEnd = Math.min(Math.max(endDay, 1), endMonth.length);
                    boundsEnd = createDayTimestamp(
                        draft.calendarId,
                        endYear,
                        draft.boundsEndMonthId,
                        clampedEnd,
                    );
                }
            }
        }

        if (!rule) {
            errors.push("Wiederholregel ist ungültig.");
            return { errors, event: null, schema };
        }

        const anchorTimestamp = draft.allDay
            ? createDayTimestamp(draft.calendarId, year, draft.monthId, normalisedDay)
            : minuteValue > 0
            ? createMinuteTimestamp(
                  draft.calendarId,
                  year,
                  draft.monthId,
                  normalisedDay,
                  hourValue,
                  minuteValue,
              )
            : createHourTimestamp(draft.calendarId, year, draft.monthId, normalisedDay, hourValue);

        const startTime: CalendarTimeOfDay | undefined = draft.allDay
            ? undefined
            : { hour: hourValue, minute: minuteValue };

        const recurring: CalendarEventRecurring = {
            kind: "recurring",
            id: draft.id || "__preview__",
            calendarId: draft.calendarId,
            title,
            note,
            category,
            date: anchorTimestamp,
            allDay: draft.allDay,
            rule,
            timePolicy: draft.timePolicy,
            startTime: draft.allDay ? undefined : startTime,
            offsetMinutes: draft.timePolicy === "offset" ? durationMinutes ?? 0 : undefined,
            durationMinutes: draft.timePolicy === "offset" ? undefined : durationMinutes,
            bounds: boundsEnd ? { start: anchorTimestamp, end: boundsEnd } : { start: anchorTimestamp },
        };

        return { errors, event: recurring, schema };
    }

    private computeEventPreview(event: CalendarEvent, schema: CalendarSchema): EventEditorPreviewItem[] {
        const occurrences: EventEditorPreviewItem[] = [];
        const reference =
            this.state.calendarState.currentTimestamp &&
            this.state.calendarState.currentTimestamp.calendarId === event.calendarId
                ? this.state.calendarState.currentTimestamp
                : event.date;

        let cursor = reference;
        let includeStart = true;

        for (let index = 0; index < 5; index += 1) {
            const next = computeNextEventOccurrence(event, schema, event.calendarId, cursor, { includeStart });
            if (!next) {
                break;
            }
            const monthName = getMonthById(schema, next.start.monthId)?.name ?? next.start.monthId;
            occurrences.push({
                id: `${event.id}-${index}`,
                timestamp: next.start,
                label: formatTimestamp(next.start, monthName),
            });
            includeStart = false;
            const precision = next.start.precision;
            const unit = precision === "minute" ? "minute" : precision === "hour" ? "hour" : "day";
            cursor = advanceTime(schema, next.start, 1, unit).timestamp;
        }

        if (occurrences.length === 0 && isSingleEvent(event)) {
            const monthName = getMonthById(schema, event.date.monthId)?.name ?? event.date.monthId;
            occurrences.push({
                id: `${event.id}-0`,
                timestamp: event.date,
                label: formatTimestamp(event.date, monthName),
            });
        }

        return occurrences.slice(0, 5);
    }

    private createDraftFromEvent(event: CalendarEvent): EventEditorDraft {
        const schema = this.getCalendarSchema(event.calendarId);
        if (isSingleEvent(event)) {
            const draft = createEmptySingleEventDraft(event.calendarId, {
                year: event.date.year,
                monthId: event.date.monthId,
                day: event.date.day,
            });
            return {
                ...draft,
                id: event.id,
                title: event.title,
                category: event.category ?? "",
                note: event.note ?? "",
                allDay: event.allDay,
                hour: String(event.startTime?.hour ?? event.date.hour ?? 0),
                minute: String(event.startTime?.minute ?? event.date.minute ?? 0),
                durationMinutes: event.durationMinutes != null ? String(event.durationMinutes) : "",
                timePrecision: event.timePrecision,
            };
        }

        const draft = createEmptyRecurringEventDraft(event.calendarId, {
            year: event.date.year,
            monthId: event.date.monthId,
            day: event.date.day,
        });

        let ruleDayIndex = draft.ruleDayIndex;
        let ruleInterval = draft.ruleInterval;
        let ruleMonthId = draft.ruleMonthId;
        let ruleDay = draft.ruleDay;

        if (event.rule.type === "weekly_dayIndex") {
            ruleDayIndex = String(event.rule.dayIndex);
            ruleInterval = event.rule.interval ? String(event.rule.interval) : "1";
        } else if (event.rule.type === "monthly_position") {
            ruleMonthId = event.rule.monthId;
            ruleDay = String(event.rule.day);
        } else if (event.rule.type === "annual_offset" && schema) {
            const months = schema.months;
            let remaining = event.rule.offsetDayOfYear;
            for (const monthSchema of months) {
                if (remaining <= monthSchema.length) {
                    ruleMonthId = monthSchema.id;
                    ruleDay = String(remaining);
                    break;
                }
                remaining -= monthSchema.length;
            }
        }

        const boundsEnd = event.bounds?.end;
        return {
            ...draft,
            id: event.id,
            title: event.title,
            category: event.category ?? "",
            note: event.note ?? "",
            allDay: event.allDay,
            hour: String(event.startTime?.hour ?? event.date.hour ?? 0),
            minute: String(event.startTime?.minute ?? event.date.minute ?? 0),
            durationMinutes:
                event.timePolicy === "offset"
                    ? String(event.offsetMinutes ?? 0)
                    : event.durationMinutes != null
                    ? String(event.durationMinutes)
                    : "",
            ruleType: event.rule.type,
            ruleDayIndex,
            ruleInterval,
            ruleMonthId: ruleMonthId || draft.ruleMonthId,
            ruleDay,
            timePolicy: event.timePolicy,
            boundsEndYear: boundsEnd ? String(boundsEnd.year) : "",
            boundsEndMonthId: boundsEnd ? boundsEnd.monthId : "",
            boundsEndDay: boundsEnd ? String(boundsEnd.day) : "",
        };
    }

    private async loadEventById(eventId: string): Promise<CalendarEvent | null> {
        const known = [
            ...this.state.calendarState.upcomingEvents,
            ...this.state.calendarState.triggeredEvents,
            ...this.state.managerUiState.agendaItems,
        ].find(event => event.id === eventId);
        if (known) {
            return known;
        }

        for (const calendar of this.state.calendarState.calendars) {
            const events = await this.eventRepo.listEvents(calendar.id);
            const found = events.find(event => event.id === eventId);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private generateEventId(): string {
        this.eventIdCounter += 1;
        return `event-${this.eventIdCounter}`;
    }

    private getDayOfYearForMonth(schema: CalendarSchema, monthId: string, day: number): number {
        const index = getMonthIndex(schema, monthId);
        if (index === -1) {
            return day;
        }
        let total = 0;
        for (let i = 0; i < index; i += 1) {
            total += schema.months[i]?.length ?? 0;
        }
        return total + day;
    }

    private async handleEventBulkAction(
        action: "delete" | "export",
        ids?: ReadonlyArray<string>,
    ): Promise<void> {
        const selection = ids && ids.length ? Array.from(ids) : [...this.state.eventsUiState.bulkSelection];
        const unique = Array.from(new Set(selection));
        if (unique.length === 0) {
            return;
        }

        if (action === "export") {
            const entries = this.phenomenaDefinitions.filter(item => unique.includes(item.id));
            const payload = formatPhenomenaExport(entries as PhenomenonDTO[]);
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    lastExportPayload: payload,
                    error: undefined,
                };
            });
            return;
        }

        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                isLoading: true,
                error: undefined,
            };
        });

        try {
            for (const id of unique) {
                await this.phenomenonRepo.deletePhenomenon(id);
            }
            this.phenomenaDefinitions = this.phenomenaDefinitions.filter(item => !unique.includes(item.id));
            this.rebuildPhenomenaListing(null, {
                bulkSelection: [],
                exportPayload: this.state.eventsUiState.lastExportPayload ?? undefined,
                importSummary: this.state.eventsUiState.importSummary ?? null,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Bulk-Aktion fehlgeschlagen";
            const code = error instanceof AlmanacRepositoryError ? error.code : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.phenomenon.bulk",
                scope: "phenomenon",
                code,
                error,
                context: { ids: unique },
            });
            if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
                emitAlmanacEvent({
                    type: "calendar.event.conflict",
                    code: "phenomenon",
                    message,
                    context: error.details,
                });
            }
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    error: message,
                };
            });
        } finally {
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isLoading: false,
                };
            });
        }
    }

    private handleEventExportCleared(): void {
        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                lastExportPayload: undefined,
            };
        });
    }

    private handleEventImportRequested(): void {
        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                isImportDialogOpen: true,
                importError: undefined,
            };
        });
    }

    private handleEventImportCancelled(): void {
        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                isImportDialogOpen: false,
                importError: undefined,
            };
        });
    }

    private async handleEventImportSubmitted(payload: string): Promise<void> {
        this.setState(next => {
            next.eventsUiState = {
                ...next.eventsUiState,
                isLoading: true,
                importError: undefined,
            };
        });

        try {
            const parsed = parsePhenomenaImport(payload);
            let imported = 0;
            for (const entry of parsed) {
                const stored = await this.phenomenonRepo.upsertPhenomenon(entry);
                const normalised = this.toPhenomenon(stored);
                this.phenomenaDefinitions = [
                    ...this.phenomenaDefinitions.filter(item => item.id !== normalised.id),
                    normalised,
                ];
                imported += 1;
            }

            const summary: ImportSummary = { imported, failed: 0 };
            this.rebuildPhenomenaListing(null, {
                bulkSelection: this.state.eventsUiState.bulkSelection,
                exportPayload: this.state.eventsUiState.lastExportPayload ?? undefined,
                importSummary: summary,
            });

            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isImportDialogOpen: false,
                };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Import fehlgeschlagen";
            const code = error instanceof AlmanacRepositoryError ? error.code : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.phenomenon.import",
                scope: "phenomenon",
                code,
                error,
                context: { imported: payload.slice(0, 32) },
            });
            if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
                emitAlmanacEvent({
                    type: "calendar.event.conflict",
                    code: "phenomenon",
                    message,
                    context: error.details,
                });
            }
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    importError: message,
                };
            });
        } finally {
            this.setState(next => {
                next.eventsUiState = {
                    ...next.eventsUiState,
                    isLoading: false,
                };
            });
        }
    }

    private handleManagerSelectionChanged(selection: ReadonlyArray<string>): void {
        const unique = Array.from(new Set(selection));
        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                selection: unique,
            };
        });
    }

    private handleCreateFormUpdated(field: CalendarCreateField, value: string): void {
        const numericFields: CalendarCreateField[] = [
            "daysPerWeek",
            "monthCount",
            "monthLength",
            "hoursPerDay",
            "minutesPerHour",
            "minuteStep",
            "epochYear",
            "epochDay",
        ];

        let nextValue = value;
        if (field === "id") {
            nextValue = this.slugify(value);
        } else if (numericFields.includes(field)) {
            nextValue = value.replace(/[^0-9]/g, "");
        }

        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                createDraft: {
                    ...draft.managerUiState.createDraft,
                    [field]: nextValue,
                },
                createErrors: [],
            };
        });
    }

    private async handleCalendarCreate(): Promise<void> {
        const draft = this.state.managerUiState.createDraft;

        this.setState(draftState => {
            draftState.managerUiState = {
                ...draftState.managerUiState,
                isCreating: true,
                createErrors: [],
            };
        });

        const { schema, errors } = await this.buildCalendarSchemaFromDraft(draft);

        if (!schema || errors.length > 0) {
            this.setState(draftState => {
                draftState.managerUiState = {
                    ...draftState.managerUiState,
                    isCreating: false,
                    createErrors: errors.length > 0 ? errors : ["Unable to create calendar with current data."],
                };
            });
            return;
        }

        try {
            const initialTimestamp = createDayTimestamp(
                schema.id,
                schema.epoch.year,
                schema.epoch.monthId,
                schema.epoch.day,
            );

            await this.calendarRepo.createCalendar(schema);
            await this.gateway.setActiveCalendar(schema.id, { initialTimestamp });
            await this.refreshCalendarData();

            const currentTimestamp = this.state.calendarState.currentTimestamp ?? initialTimestamp;

            this.setState(draftState => {
                draftState.managerUiState = {
                    ...draftState.managerUiState,
                    isCreating: false,
                    createErrors: [],
                    createDraft: createDefaultCalendarDraft(),
                    anchorTimestamp: currentTimestamp,
                    selection: [],
                };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create calendar";
            const code = isCalendarGatewayError(error) ? error.code : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.createCalendar",
                scope: "calendar",
                code,
                error,
                context: { calendarId: schema.id },
            });
            this.setState(draftState => {
                draftState.managerUiState = {
                    ...draftState.managerUiState,
                    isCreating: false,
                    createErrors: [message],
                };
            });
        }
    }

    private handleCalendarEditRequested(calendarId: string): void {
        const schema = this.getCalendarSchema(calendarId);
        if (!schema) {
            return;
        }

        const draft = createCalendarDraftFromSchema(schema);
        const warnings = this.computeEditWarnings(schema, draft);

        this.setState(draftState => {
            const current = draftState.managerUiState.editStateById[calendarId];
            const nextState: CalendarEditState = {
                draft,
                errors: [],
                warnings,
                isSaving: false,
            };
            draftState.managerUiState = {
                ...draftState.managerUiState,
                editStateById: {
                    ...draftState.managerUiState.editStateById,
                    [calendarId]: current ? { ...current, ...nextState } : nextState,
                },
                conflictDialog:
                    draftState.managerUiState.conflictDialog?.calendarId === calendarId
                        ? null
                        : draftState.managerUiState.conflictDialog,
            };
        });
    }

    private handleCalendarEditCancelled(calendarId: string): void {
        this.setState(draft => {
            const { [calendarId]: _removed, ...rest } = draft.managerUiState.editStateById;
            draft.managerUiState = {
                ...draft.managerUiState,
                editStateById: rest,
            };
        });
    }

    private handleCalendarEditFormUpdated(
        calendarId: string,
        field: CalendarCreateField,
        value: string,
    ): void {
        const editableFields: CalendarCreateField[] = [
            "name",
            "description",
            "hoursPerDay",
            "minutesPerHour",
            "minuteStep",
        ];

        if (!editableFields.includes(field)) {
            return;
        }

        const existing = this.state.managerUiState.editStateById[calendarId];
        if (!existing) {
            return;
        }

        const numericFields: CalendarCreateField[] = ["hoursPerDay", "minutesPerHour", "minuteStep"];
        let nextValue = value;
        if (numericFields.includes(field)) {
            nextValue = value.replace(/[^0-9]/g, "");
        }

        const nextDraft: CalendarCreateDraft = {
            ...existing.draft,
            [field]: nextValue,
        } as CalendarCreateDraft;

        const schema = this.getCalendarSchema(calendarId);
        const warnings = schema ? this.computeEditWarnings(schema, nextDraft) : [];

        this.setState(draftState => {
            const current = draftState.managerUiState.editStateById[calendarId];
            if (!current) {
                return;
            }
            draftState.managerUiState = {
                ...draftState.managerUiState,
                editStateById: {
                    ...draftState.managerUiState.editStateById,
                    [calendarId]: {
                        ...current,
                        draft: nextDraft,
                        warnings,
                        errors: [],
                    },
                },
            };
        });
    }

    private async handleCalendarUpdate(calendarId: string): Promise<void> {
        const editState = this.state.managerUiState.editStateById[calendarId];
        const schema = this.getCalendarSchema(calendarId);
        if (!editState || !schema) {
            return;
        }

        const errors: string[] = [];
        const trimmedName = editState.draft.name.trim();
        if (!trimmedName) {
            errors.push("Name is required.");
        }

        const description = editState.draft.description.trim();
        const hoursPerDay = Number(editState.draft.hoursPerDay || String(schema.hoursPerDay ?? 24));
        const minutesPerHour = Number(editState.draft.minutesPerHour || String(schema.minutesPerHour ?? 60));
        const minuteStep = Number(editState.draft.minuteStep || String(schema.minuteStep ?? 1));

        if (!Number.isFinite(hoursPerDay) || hoursPerDay < 1) {
            errors.push("Hours per day must be at least 1.");
        }
        if (!Number.isFinite(minutesPerHour) || minutesPerHour < 1) {
            errors.push("Minutes per hour must be at least 1.");
        }
        if (!Number.isFinite(minuteStep) || minuteStep < 1) {
            errors.push("Minute step must be at least 1.");
        } else if (minuteStep > minutesPerHour) {
            errors.push("Minute step must not exceed minutes per hour.");
        }

        if (errors.length > 0) {
            this.setState(draftState => {
                const current = draftState.managerUiState.editStateById[calendarId];
                if (!current) {
                    return;
                }
                draftState.managerUiState = {
                    ...draftState.managerUiState,
                    editStateById: {
                        ...draftState.managerUiState.editStateById,
                        [calendarId]: { ...current, errors, isSaving: false },
                    },
                };
            });
            return;
        }

        const updates: Partial<CalendarSchema> = {};
        if (trimmedName !== schema.name) {
            updates.name = trimmedName;
        }
        if ((schema.description ?? "") !== description) {
            updates.description = description || undefined;
        }

        const safeHoursPerDay = Math.max(1, Math.floor(hoursPerDay));
        const safeMinutesPerHour = Math.max(1, Math.floor(minutesPerHour));
        const safeMinuteStep = Math.max(1, Math.floor(minuteStep));

        if ((schema.hoursPerDay ?? 24) !== safeHoursPerDay) {
            updates.hoursPerDay = safeHoursPerDay;
        }
        if ((schema.minutesPerHour ?? 60) !== safeMinutesPerHour) {
            updates.minutesPerHour = safeMinutesPerHour;
        }
        if ((schema.minuteStep ?? 1) !== safeMinuteStep) {
            updates.minuteStep = safeMinuteStep;
        }

        if (Object.keys(updates).length === 0) {
            const warnings = this.computeEditWarnings(schema, editState.draft);
            this.setState(draftState => {
                const current = draftState.managerUiState.editStateById[calendarId];
                if (!current) {
                    return;
                }
                draftState.managerUiState = {
                    ...draftState.managerUiState,
                    editStateById: {
                        ...draftState.managerUiState.editStateById,
                        [calendarId]: { ...current, warnings, errors: [], isSaving: false },
                    },
                };
            });
            return;
        }

        const conflicts = await this.detectCalendarConflicts(calendarId, updates);
        if (conflicts.length > 0) {
            this.setState(draftState => {
                const current = draftState.managerUiState.editStateById[calendarId];
                if (!current) {
                    return;
                }
                const conflictDialog: CalendarConflictDialogState = {
                    calendarId,
                    kind: "update",
                    message: "Existing events conflict with the new time definition.",
                    details: conflicts,
                };
                draftState.managerUiState = {
                    ...draftState.managerUiState,
                    conflictDialog,
                    editStateById: {
                        ...draftState.managerUiState.editStateById,
                        [calendarId]: { ...current, errors: conflicts, isSaving: false },
                    },
                };
            });
            return;
        }

        this.setState(draftState => {
            const current = draftState.managerUiState.editStateById[calendarId];
            if (!current) {
                return;
            }
            draftState.managerUiState = {
                ...draftState.managerUiState,
                conflictDialog:
                    draftState.managerUiState.conflictDialog?.calendarId === calendarId
                        ? null
                        : draftState.managerUiState.conflictDialog,
                editStateById: {
                    ...draftState.managerUiState.editStateById,
                    [calendarId]: { ...current, errors: [], isSaving: true },
                },
            };
        });

        try {
            await this.calendarRepo.updateCalendar(calendarId, updates);
            await this.refreshCalendarData();

            const updatedSchema = this.getCalendarSchema(calendarId) ?? schema;
            const nextDraft = createCalendarDraftFromSchema(updatedSchema);
            const warnings = this.computeEditWarnings(updatedSchema, nextDraft);

            this.setState(draftState => {
                const current = draftState.managerUiState.editStateById[calendarId];
                if (!current) {
                    return;
                }
                draftState.managerUiState = {
                    ...draftState.managerUiState,
                    editStateById: {
                        ...draftState.managerUiState.editStateById,
                        [calendarId]: {
                            draft: nextDraft,
                            warnings,
                            errors: [],
                            isSaving: false,
                        },
                    },
                };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update calendar";
            const code = isCalendarGatewayError(error) ? error.code : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.updateCalendar",
                scope: "calendar",
                code,
                error,
                context: { calendarId },
            });
            this.setState(draftState => {
                const current = draftState.managerUiState.editStateById[calendarId];
                if (!current) {
                    return;
                }
                draftState.managerUiState = {
                    ...draftState.managerUiState,
                    editStateById: {
                        ...draftState.managerUiState.editStateById,
                        [calendarId]: { ...current, errors: [message], isSaving: false },
                    },
                };
            });
        }
    }

    private async handleCalendarDeleteRequested(calendarId: string): Promise<void> {
        const schema = this.getCalendarSchema(calendarId);
        if (!schema) {
            return;
        }

        const linkedPhenomena = this.phenomenaDefinitions
            .filter(phenomenon => phenomenon.appliesToCalendarIds.includes(calendarId))
            .map(phenomenon => phenomenon.name);
        const linkedTravelIds = await this.collectTravelDefaultIds(calendarId);
        const requiresFallback = this.state.calendarState.defaultCalendarId === calendarId;

        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                deleteDialog: {
                    calendarId,
                    calendarName: schema.name,
                    requiresFallback,
                    linkedTravelIds,
                    linkedPhenomena,
                    isDeleting: false,
                    error: undefined,
                },
            };
        });
    }

    private handleCalendarDeleteCancelled(): void {
        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                deleteDialog: null,
            };
        });
    }

    private async handleCalendarDeleteConfirmed(calendarId: string): Promise<void> {
        const dialog = this.state.managerUiState.deleteDialog;
        if (!dialog || dialog.calendarId !== calendarId) {
            return;
        }

        if (dialog.linkedPhenomena.length > 0) {
            const message = "Calendar is linked to phenomena and cannot be deleted.";
            this.setState(draft => {
                draft.managerUiState = {
                    ...draft.managerUiState,
                    conflictDialog: {
                        calendarId,
                        kind: "delete",
                        message,
                        details: dialog.linkedPhenomena,
                    },
                    deleteDialog: { ...dialog, error: message },
                };
            });
            return;
        }

        const fallbackCandidate = this.state.calendarState.calendars.find(schema => schema.id !== calendarId)?.id ?? null;
        if (dialog.requiresFallback && !fallbackCandidate) {
            const message = "Cannot delete the last remaining calendar.";
            this.setState(draft => {
                draft.managerUiState = {
                    ...draft.managerUiState,
                    conflictDialog: {
                        calendarId,
                        kind: "delete",
                        message,
                        details: [],
                    },
                    deleteDialog: { ...dialog, error: message },
                };
            });
            return;
        }

        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                deleteDialog: { ...dialog, isDeleting: true, error: undefined },
            };
        });

        try {
            const defaultsRepo = this.getCalendarDefaultsRepository();
            if (defaultsRepo) {
                for (const travelId of dialog.linkedTravelIds) {
                    await defaultsRepo.clearTravelDefault(travelId);
                }
            }

            await this.calendarRepo.deleteCalendar(calendarId);

            if (dialog.requiresFallback && fallbackCandidate) {
                await this.gateway.setDefaultCalendar(fallbackCandidate, { scope: "global" });
            }

            if (this.state.calendarState.activeCalendarId === calendarId && fallbackCandidate) {
                await this.gateway.setActiveCalendar(fallbackCandidate);
            }

            await this.refreshCalendarData();

            this.setState(draft => {
                const { [calendarId]: _removed, ...rest } = draft.managerUiState.editStateById;
                draft.managerUiState = {
                    ...draft.managerUiState,
                    deleteDialog: null,
                    conflictDialog: null,
                    selection: draft.managerUiState.selection.filter(id => id !== calendarId),
                    editStateById: rest,
                };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete calendar";
            const code = isCalendarGatewayError(error) ? error.code : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.deleteCalendar",
                scope: "calendar",
                code,
                error,
                context: { calendarId },
            });
            this.setState(draft => {
                const currentDialog: CalendarDeleteDialogState | null = draft.managerUiState.deleteDialog;
                if (!currentDialog || currentDialog.calendarId !== calendarId) {
                    return;
                }
                draft.managerUiState = {
                    ...draft.managerUiState,
                    deleteDialog: { ...currentDialog, isDeleting: false, error: message },
                };
            });
        }
    }

    private handleConflictDismissed(): void {
        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                conflictDialog: null,
            };
        });
    }

    private async handleCalendarSelect(calendarId: string): Promise<void> {
        if (calendarId === this.state.calendarState.activeCalendarId) {
            return;
        }

        const previousActive = this.state.calendarState.activeCalendarId;

        this.setState(draft => {
            draft.calendarState = {
                ...draft.calendarState,
                activeCalendarId: calendarId,
                isPersisting: true,
            };
            draft.almanacUiState = {
                ...draft.almanacUiState,
                error: undefined,
            };
        });

        try {
            const existingTimestamp = this.state.calendarState.currentTimestamp;
            const timestamp = existingTimestamp?.calendarId === calendarId ? existingTimestamp : undefined;
            await this.gateway.setActiveCalendar(calendarId, { initialTimestamp: timestamp ?? undefined });
            await this.refreshCalendarData();
            const currentTimestamp = this.state.calendarState.currentTimestamp;
            if (currentTimestamp) {
                this.setState(draft => {
                    draft.managerUiState = {
                        ...draft.managerUiState,
                        anchorTimestamp: currentTimestamp,
                        agendaItems: this.collectAgendaItems(currentTimestamp, draft.managerUiState.zoom),
                        jumpPreview: [],
                    };
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Kalender konnte nicht gesetzt werden";
            const code = isCalendarGatewayError(error) ? error.code : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.setActiveCalendar",
                scope: this.travelId ? "travel" : "calendar",
                code,
                error,
                context: { calendarId, travelId: this.travelId },
            });
            this.setState(draft => {
                draft.calendarState = {
                    ...draft.calendarState,
                    activeCalendarId: previousActive ?? null,
                    isPersisting: false,
                };
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    error: message,
                };
            });
        }
    }

    private async handleCalendarDefault(calendarId: string): Promise<void> {
        const previousDefault = this.state.calendarState.defaultCalendarId ?? null;
        this.setState(draft => {
            draft.calendarState = {
                ...draft.calendarState,
                isPersisting: true,
            };
            draft.almanacUiState = {
                ...draft.almanacUiState,
                error: undefined,
            };
        });

        try {
            await this.gateway.setDefaultCalendar(calendarId, { scope: "global" });
            await this.refreshCalendarData();
            this.setState(draft => {
                draft.calendarState = {
                    ...draft.calendarState,
                    defaultCalendarId: calendarId,
                    calendars: draft.calendarState.calendars.map(schema =>
                        schema.id === calendarId
                            ? { ...schema, isDefaultGlobal: true }
                            : { ...schema, isDefaultGlobal: false }
                    ),
                };
            });
            emitAlmanacEvent({
                type: "calendar.default.change",
                scope: "global",
                calendarId,
                previousDefaultId: previousDefault,
                travelId: this.travelId,
                wasAutoSelected: false,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Standardkalender konnte nicht aktualisiert werden";
            const code = isCalendarGatewayError(error) ? error.code : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.setDefault",
                scope: "default",
                code,
                error,
                context: { calendarId, travelId: this.travelId },
            });
            this.setState(draft => {
                draft.calendarState = {
                    ...draft.calendarState,
                    isPersisting: false,
                };
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    error: message,
                };
            });
        }
    }

    private async handleTravelLeafMounted(travelId: string): Promise<void> {
        this.travelId = travelId;
        this.setState(draft => {
            draft.travelLeafState = {
                ...draft.travelLeafState,
                travelId,
                visible: true,
                isLoading: true,
                error: undefined,
            };
        });

        try {
            const prefs = await this.gateway.getTravelLeafPreferences(travelId);
            this.travelLeafPreferences = prefs;
            this.setState(draft => {
                draft.travelLeafState = {
                    ...draft.travelLeafState,
                    travelId,
                    visible: true,
                    mode: prefs?.mode ?? draft.travelLeafState.mode,
                    currentTimestamp: draft.calendarState.currentTimestamp,
                    minuteStep:
                        draft.calendarState.timeDefinition?.minuteStep ?? draft.travelLeafState.minuteStep,
                    isLoading: false,
                    error: undefined,
                };
            });

            await this.persistTravelLeafPreferences({
                visible: true,
                mode: this.state.travelLeafState.mode,
                lastViewedTimestamp: this.state.calendarState.currentTimestamp ?? null,
            });

            emitAlmanacEvent({
                type: "calendar.travel.lifecycle",
                phase: "mount",
                travelId,
                visible: true,
                mode: this.state.travelLeafState.mode,
                timestamp: this.state.calendarState.currentTimestamp,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Travel-Leaf konnte nicht initialisiert werden";
            const code = isCalendarGatewayError(error) ? error.code : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.travelLeaf.mount",
                scope: "travel",
                code,
                error,
                context: { travelId },
            });
            this.setState(draft => {
                draft.travelLeafState = {
                    ...draft.travelLeafState,
                    isLoading: false,
                    error: message,
                };
            });
        }
    }

    private async handleTravelModeChanged(mode: TravelCalendarMode): Promise<void> {
        if (mode === this.state.travelLeafState.mode) {
            return;
        }
        this.setState(draft => {
            draft.travelLeafState = {
                ...draft.travelLeafState,
                mode,
            };
        });
        emitAlmanacEvent({
            type: "calendar.travel.lifecycle",
            phase: "mode-change",
            travelId: this.state.travelLeafState.travelId,
            visible: this.state.travelLeafState.visible,
            mode,
            timestamp: this.state.travelLeafState.currentTimestamp,
        });
        await this.persistTravelLeafPreferences({ mode });
    }

    private async handleTimeAdvance(
        amount: number,
        unit: "day" | "hour" | "minute",
        source: "global" | "travel" = "global",
    ): Promise<void> {
        const activeCalendarId = this.state.calendarState.activeCalendarId;
        if (!activeCalendarId) {
            return;
        }

        this.setState(draft => {
            draft.calendarState = {
                ...draft.calendarState,
                lastAdvanceStep: { amount, unit },
            };
            if (source === "global") {
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    isLoading: true,
                    error: undefined,
                };
            } else {
                draft.travelLeafState = {
                    ...draft.travelLeafState,
                    isLoading: true,
                    error: undefined,
                    lastQuickStep: { amount, unit },
                };
            }
        });

        try {
            const advanceOptions = this.travelId
                ? {
                      travelId: this.travelId,
                      hookContext: { scope: "travel" as const, travelId: this.travelId, reason: "advance" as const },
                  }
                : { hookContext: { scope: "global" as const, reason: "advance" as const } };
            const result = await this.gateway.advanceTimeBy(amount, unit, advanceOptions);
            const schema = this.getCalendarSchema(activeCalendarId);
            let upcoming: CalendarEvent[] = this.state.calendarState.upcomingEvents;
            if (schema) {
                upcoming = await this.eventRepo.getUpcomingEvents(
                    activeCalendarId,
                    schema,
                    result.timestamp,
                    5,
                );
            }

            if (this.phenomenaDefinitions.length === 0) {
                const freshPhenomena = await this.phenomenonRepo.listPhenomena();
                this.phenomenaDefinitions = freshPhenomena.map(item => this.toPhenomenon(item));
            }
            this.phenomenaSource = this.buildPhenomenonViewModels(
                this.phenomenaDefinitions,
                this.state.calendarState.calendars,
                activeCalendarId,
                result.timestamp,
            );
            const filters = this.state.eventsUiState.filters;
            const filteredPhenomena = this.applyPhenomenaFilters(filters);
            const availableCategories = getUniqueCategories(this.phenomenaSource);
            const filterCount = filters.categories.length + filters.calendarIds.length;
            const calendars = this.state.calendarState.calendars;
            const currentSelectedId = this.state.eventsUiState.selectedPhenomenonId ?? null;
            let nextSelectedId: string | null = null;
            let nextDetail: PhenomenonDetailView | null = null;

            if (currentSelectedId && filteredPhenomena.some(item => item.id === currentSelectedId)) {
                nextDetail = this.buildPhenomenonDetailForId(currentSelectedId, calendars, result.timestamp);
                nextSelectedId = nextDetail ? currentSelectedId : null;
            }

            if (!nextSelectedId && filteredPhenomena.length > 0) {
                const firstId = filteredPhenomena[0].id;
                nextDetail = this.buildPhenomenonDetailForId(firstId, calendars, result.timestamp);
                nextSelectedId = nextDetail ? firstId : null;
            }

            const mapMarkers = this.buildPhenomenonMapMarkers(filteredPhenomena, calendars);

            this.setState(draft => {
                const mergedTriggered = [
                    ...result.triggeredEvents,
                    ...draft.calendarState.triggeredEvents,
                ].slice(0, MAX_TRIGGERED_EVENTS);

                const mergedPhenomena = [
                    ...result.triggeredPhenomena,
                    ...draft.calendarState.triggeredPhenomena,
                ].slice(0, MAX_TRIGGERED_PHENOMENA);

                draft.calendarState = {
                    ...draft.calendarState,
                    currentTimestamp: result.timestamp,
                    upcomingEvents: upcoming,
                    triggeredEvents: mergedTriggered,
                    upcomingPhenomena: result.upcomingPhenomena,
                    triggeredPhenomena: mergedPhenomena,
                };
                if (source === "global") {
                    draft.almanacUiState = {
                        ...draft.almanacUiState,
                        isLoading: false,
                    };
                }
                const minuteStep = draft.calendarState.timeDefinition?.minuteStep ?? draft.travelLeafState.minuteStep;
                draft.travelLeafState = {
                    ...draft.travelLeafState,
                    travelId: this.travelId,
                    currentTimestamp: result.timestamp,
                    minuteStep,
                    ...(source === "travel"
                        ? { isLoading: false, error: undefined, lastQuickStep: { amount, unit } }
                        : {}),
                };
                draft.eventsUiState = {
                    ...draft.eventsUiState,
                    filterCount,
                    filters: { ...filters },
                    availableCategories,
                    mapMarkers,
                    phenomena: filteredPhenomena,
                    selectedPhenomenonId: nextSelectedId,
                    selectedPhenomenonDetail: nextDetail,
                    isDetailLoading: false,
                };
                draft.managerUiState = {
                    ...draft.managerUiState,
                    anchorTimestamp: result.timestamp,
                    agendaItems: this.collectAgendaItems(result.timestamp, draft.managerUiState.zoom, upcoming),
                    jumpPreview: [],
                };
            });

            await this.cartographerGateway.notifyTravelPanel({
                travelId: this.travelId,
                currentTimestamp: result.timestamp,
                triggeredEvents: result.triggeredEvents,
                triggeredPhenomena: result.triggeredPhenomena,
                skippedEvents: [],
                skippedPhenomena: [],
                lastAdvanceStep: { amount, unit },
                reason: "advance",
            });

            emitAlmanacEvent({
                type: "calendar.time.advance",
                scope: source,
                reason: "advance",
                unit,
                amount,
                triggeredEvents: result.triggeredEvents.length,
                triggeredPhenomena: result.triggeredPhenomena.length,
                skippedEvents: 0,
                travelId: source === "travel" ? this.travelId : null,
                timestamp: result.timestamp,
            });

            void this.persistPreferences({
                lastSelectedPhenomenonId: nextSelectedId ?? undefined,
            });
            if (this.travelId) {
                void this.persistTravelLeafPreferences({ lastViewedTimestamp: result.timestamp });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Zeitfortschritt fehlgeschlagen";
            const code = error instanceof AlmanacRepositoryError
                ? error.code
                : isCalendarGatewayError(error)
                ? error.code
                : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.timeAdvance",
                scope: source === "travel" ? "travel" : "calendar",
                code,
                error,
                context: { amount, unit, travelId: this.travelId },
            });
            if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
                emitAlmanacEvent({
                    type: "calendar.event.conflict",
                    code: "phenomenon",
                    message,
                    context: error.details,
                });
            }
            this.setState(draft => {
                if (source === "global") {
                    draft.almanacUiState = {
                        ...draft.almanacUiState,
                        isLoading: false,
                        error: message,
                    };
                } else {
                    draft.travelLeafState = {
                        ...draft.travelLeafState,
                        isLoading: false,
                        error: message,
                    };
                }
            });
        }
    }

    private async handleTimeJumpPreview(target: CalendarTimestamp): Promise<void> {
        const activeCalendarId = this.state.calendarState.activeCalendarId;
        if (!activeCalendarId) {
            this.clearJumpPreview();
            return;
        }

        if (target.calendarId !== activeCalendarId) {
            target = { ...target, calendarId: activeCalendarId };
        }

        const schema = this.getCalendarSchema(activeCalendarId) ?? await this.calendarRepo.getCalendar(activeCalendarId);
        const currentTimestamp = this.state.calendarState.currentTimestamp;
        if (!schema || !currentTimestamp) {
            this.clearJumpPreview();
            return;
        }

        const preview = await this.eventRepo.getEventsInRange(activeCalendarId, schema, currentTimestamp, target);
        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                jumpPreview: preview,
            };
        });
    }

    private async handleTimeJump(target: CalendarTimestamp): Promise<void> {
        const activeCalendarId = this.state.calendarState.activeCalendarId;
        if (!activeCalendarId) {
            return;
        }

        if (target.calendarId !== activeCalendarId) {
            target = { ...target, calendarId: activeCalendarId };
        }

        this.setState(draft => {
            draft.almanacUiState = {
                ...draft.almanacUiState,
                isLoading: true,
                error: undefined,
            };
        });

        try {
            let schema = this.getCalendarSchema(activeCalendarId) ?? await this.calendarRepo.getCalendar(activeCalendarId);
            const currentTimestamp = this.state.calendarState.currentTimestamp;
            let preview: CalendarEvent[] = [];
            if (schema && currentTimestamp) {
                preview = await this.eventRepo.getEventsInRange(activeCalendarId, schema, currentTimestamp, target);
            }

            const setOptions = this.travelId ? { travelId: this.travelId } : undefined;
            await this.gateway.setCurrentTimestamp(target, setOptions);

            const snapshotAfterJump = await this.gateway.loadSnapshot(
                this.travelId ? { travelId: this.travelId } : undefined,
            );
            const upcoming = snapshotAfterJump.upcomingEvents;
            const upcomingPhenomena = snapshotAfterJump.upcomingPhenomena;

            if (this.phenomenaDefinitions.length === 0) {
                const freshPhenomena = await this.phenomenonRepo.listPhenomena();
                this.phenomenaDefinitions = freshPhenomena.map(item => this.toPhenomenon(item));
            }
            this.phenomenaSource = this.buildPhenomenonViewModels(
                this.phenomenaDefinitions,
                this.state.calendarState.calendars,
                activeCalendarId,
                target,
            );
            const filters = this.state.eventsUiState.filters;
            const filteredPhenomena = this.applyPhenomenaFilters(filters);
            const availableCategories = getUniqueCategories(this.phenomenaSource);
            const filterCount = filters.categories.length + filters.calendarIds.length;
            const calendars = this.state.calendarState.calendars;
            const currentSelectedId = this.state.eventsUiState.selectedPhenomenonId ?? null;
            let nextSelectedId: string | null = null;
            let nextDetail: PhenomenonDetailView | null = null;

            if (currentSelectedId && filteredPhenomena.some(item => item.id === currentSelectedId)) {
                nextDetail = this.buildPhenomenonDetailForId(currentSelectedId, calendars, target);
                nextSelectedId = nextDetail ? currentSelectedId : null;
            }

            if (!nextSelectedId && filteredPhenomena.length > 0) {
                const firstId = filteredPhenomena[0].id;
                nextDetail = this.buildPhenomenonDetailForId(firstId, calendars, target);
                nextSelectedId = nextDetail ? firstId : null;
            }

            const mapMarkers = this.buildPhenomenonMapMarkers(filteredPhenomena, calendars);

            this.setState(draft => {
                draft.calendarState = {
                    ...draft.calendarState,
                    currentTimestamp: target,
                    upcomingEvents: upcoming,
                    triggeredEvents: preview,
                    upcomingPhenomena,
                };
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    isLoading: false,
                };
                draft.eventsUiState = {
                    ...draft.eventsUiState,
                    filterCount,
                    filters: { ...filters },
                    availableCategories,
                    mapMarkers,
                    phenomena: filteredPhenomena,
                    selectedPhenomenonId: nextSelectedId,
                    selectedPhenomenonDetail: nextDetail,
                    isDetailLoading: false,
                };
                draft.managerUiState = {
                    ...draft.managerUiState,
                    anchorTimestamp: target,
                    agendaItems: this.collectAgendaItems(target, draft.managerUiState.zoom, upcoming),
                    jumpPreview: [],
                };
            });

            await this.cartographerGateway.notifyTravelPanel({
                travelId: this.travelId,
                currentTimestamp: target,
                triggeredEvents: [],
                triggeredPhenomena: [],
                skippedEvents: preview,
                skippedPhenomena: [],
                reason: "jump",
            });

            emitAlmanacEvent({
                type: "calendar.time.advance",
                scope: this.travelId ? "travel" : "global",
                reason: "jump",
                unit: "day",
                amount: 0,
                triggeredEvents: 0,
                triggeredPhenomena: 0,
                skippedEvents: preview.length,
                travelId: this.travelId,
                timestamp: target,
            });

            void this.persistPreferences({
                lastSelectedPhenomenonId: nextSelectedId ?? undefined,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Zeit konnte nicht gesetzt werden";
            const code = error instanceof AlmanacRepositoryError
                ? error.code
                : isCalendarGatewayError(error)
                ? error.code
                : "io_error";
            reportAlmanacGatewayIssue({
                operation: "stateMachine.timeJump",
                scope: this.travelId ? "travel" : "calendar",
                code,
                error,
                context: { travelId: this.travelId },
            });
            if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
                emitAlmanacEvent({
                    type: "calendar.event.conflict",
                    code: "phenomenon",
                    message,
                    context: error.details,
                });
            }
            this.setState(draft => {
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    isLoading: false,
                    error: message,
                };
            });
        }
    }

    private getCalendarSchema(id: string): CalendarSchema | null {
        return this.state.calendarState.calendars.find(calendar => calendar.id === id) ?? null;
    }

    private buildPhenomenonViewModels(
        phenomena: ReadonlyArray<Phenomenon>,
        calendars: ReadonlyArray<CalendarSchema>,
        activeCalendarId: string | null,
        referenceTimestamp: CalendarTimestamp | null,
    ): PhenomenonViewModel[] {
        const calendarMap = new Map(calendars.map(schema => [schema.id, schema] as const));

        return phenomena.map(phenomenon => {
            const linkedIdsBase =
                phenomenon.visibility === "all_calendars"
                    ? calendars.map(schema => schema.id)
                    : phenomenon.appliesToCalendarIds;

            const linkedCalendars = Array.from(new Set(linkedIdsBase)).filter(id => calendarMap.has(id));

            const occurrences = linkedCalendars.flatMap(calendarId => {
                const schema = calendarMap.get(calendarId);
                if (!schema) return [] as Array<{ label: string; sortKey: string }>;

                const anchor =
                    referenceTimestamp && referenceTimestamp.calendarId === calendarId
                        ? referenceTimestamp
                        : createDayTimestamp(
                              calendarId,
                              schema.epoch.year,
                              schema.epoch.monthId,
                              schema.epoch.day,
                          );

                try {
                    const occurrence = computeNextPhenomenonOccurrence(
                        phenomenon,
                        schema,
                        calendarId,
                        anchor,
                        { includeStart: true },
                    );

                    if (!occurrence) {
                        return [];
                    }

                    const monthName = getMonthById(schema, occurrence.timestamp.monthId)?.name ?? occurrence.timestamp.monthId;
                    const label = `${formatTimestamp(occurrence.timestamp, monthName)} • ${schema.name}`;
                    const monthIndex = Math.max(0, getMonthIndex(schema, occurrence.timestamp.monthId));
                    const sortKey = [
                        occurrence.timestamp.year.toString().padStart(6, "0"),
                        monthIndex.toString().padStart(2, "0"),
                        occurrence.timestamp.day.toString().padStart(2, "0"),
                        String(occurrence.timestamp.hour ?? 0).padStart(2, "0"),
                        String(occurrence.timestamp.minute ?? 0).padStart(2, "0"),
                    ].join("-");

                    return [{ label, sortKey }];
                } catch {
                    return [];
                }
            });

            occurrences.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

            return {
                id: phenomenon.id,
                title: phenomenon.name,
                category: phenomenon.category,
                linkedCalendars,
                nextOccurrence: occurrences[0]?.label,
            } satisfies PhenomenonViewModel;
        });
    }

    private buildPhenomenonMapMarkers(
        phenomena: ReadonlyArray<PhenomenonViewModel>,
        calendars: ReadonlyArray<CalendarSchema>,
    ): EventsMapMarker[] {
        if (phenomena.length === 0) {
            return [];
        }

        const calendarNames = new Map(calendars.map(schema => [schema.id, schema.name] as const));
        const total = phenomena.length;
        const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
        const rows = Math.max(1, Math.ceil(total / columns));

        return phenomena.map((phenomenon, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = clampCoordinate((column + 0.5) / columns);
            const y = clampCoordinate((row + 0.5) / rows);

            return {
                id: phenomenon.id,
                title: phenomenon.title,
                category: phenomenon.category,
                nextOccurrence: phenomenon.nextOccurrence,
                coordinates: { x, y },
                calendars: phenomenon.linkedCalendars.map(calendarId => ({
                    id: calendarId,
                    name: calendarNames.get(calendarId) ?? calendarId,
                })),
            } satisfies EventsMapMarker;
        });
    }

    private buildPhenomenonDetailForId(
        phenomenonId: string,
        calendars: ReadonlyArray<CalendarSchema>,
        referenceTimestamp: CalendarTimestamp | null,
    ): PhenomenonDetailView | null {
        const phenomenon = this.phenomenaDefinitions.find(item => item.id === phenomenonId);
        if (!phenomenon) {
            return null;
        }
        return this.buildPhenomenonDetailView(phenomenon, calendars, referenceTimestamp);
    }

    private buildPhenomenonDetailView(
        phenomenon: Phenomenon,
        calendars: ReadonlyArray<CalendarSchema>,
        referenceTimestamp: CalendarTimestamp | null,
    ): PhenomenonDetailView {
        const calendarMap = new Map(calendars.map(schema => [schema.id, schema] as const));
        const linkedIdsBase =
            phenomenon.visibility === "all_calendars"
                ? calendars.map(schema => schema.id)
                : phenomenon.appliesToCalendarIds;
        const linkedCalendars = Array.from(new Set(linkedIdsBase))
            .map(id => {
                const schema = calendarMap.get(id);
                return schema ? { id, name: schema.name } : null;
            })
            .filter(Boolean) as Array<{ id: string; name: string }>;

        const upcomingOccurrences = linkedCalendars.flatMap(link => {
            const schema = calendarMap.get(link.id);
            if (!schema) return [] as PhenomenonDetailView["upcomingOccurrences"];

            const anchor =
                referenceTimestamp && referenceTimestamp.calendarId === link.id
                    ? referenceTimestamp
                    : createDayTimestamp(link.id, schema.epoch.year, schema.epoch.monthId, schema.epoch.day);

            const occurrences = this.collectUpcomingOccurrences(phenomenon, schema, link.id, anchor, 3);
            if (occurrences.length === 0) {
                return [] as PhenomenonDetailView["upcomingOccurrences"];
            }

            const [first, ...rest] = occurrences;
            const nextMonthName = getMonthById(schema, first.timestamp.monthId)?.name ?? first.timestamp.monthId;
            const nextLabel = formatTimestamp(first.timestamp, nextMonthName);

            const subsequent = rest.map(item => {
                const monthName = getMonthById(schema, item.timestamp.monthId)?.name ?? item.timestamp.monthId;
                return formatTimestamp(item.timestamp, monthName);
            });

            return [
                {
                    calendarId: link.id,
                    calendarName: link.name,
                    nextLabel,
                    nextTimestamp: first.timestamp,
                    subsequent,
                },
            ] as PhenomenonDetailView["upcomingOccurrences"];
        });

        return {
            id: phenomenon.id,
            name: phenomenon.name,
            category: phenomenon.category,
            notes: phenomenon.notes,
            linkedCalendars,
            upcomingOccurrences,
        };
    }

    private collectUpcomingOccurrences(
        phenomenon: Phenomenon,
        schema: CalendarSchema,
        calendarId: string,
        start: CalendarTimestamp,
        limit: number,
    ): PhenomenonOccurrence[] {
        const occurrences: PhenomenonOccurrence[] = [];
        let anchor = start;
        let includeStart = true;

        for (let index = 0; index < limit; index++) {
            let occurrence: PhenomenonOccurrence | null = null;
            try {
                occurrence = computeNextPhenomenonOccurrence(
                    phenomenon,
                    schema,
                    calendarId,
                    anchor,
                    { includeStart },
                );
            } catch {
                break;
            }
            if (!occurrence) {
                break;
            }
            occurrences.push(occurrence);
            anchor = advanceTime(schema, occurrence.timestamp, 1, "minute").timestamp;
            includeStart = false;
        }

        return occurrences;
    }

    private ensurePhenomenonSelection(): void {
        if (this.state.eventsUiState.selectedPhenomenonId && this.state.eventsUiState.selectedPhenomenonDetail) {
            return;
        }
        const first = this.state.eventsUiState.phenomena[0];
        if (first) {
            void this.handlePhenomenonSelected(first.id);
        }
    }

    private applyPhenomenaFilters(filters: EventsFilterState) {
        return this.phenomenaSource.filter(phenomenon => {
            const categoryMatch =
                filters.categories.length === 0 ||
                (phenomenon.category ? filters.categories.includes(phenomenon.category) : false);
            const calendarMatch =
                filters.calendarIds.length === 0 ||
                phenomenon.linkedCalendars.some(calendarId => filters.calendarIds.includes(calendarId));
            return categoryMatch && calendarMatch;
        });
    }

    private rebuildPhenomenaListing(
        preferredId: string | null = null,
        options: PhenomenaListingOptions = {},
    ): void {
        const calendars = this.state.calendarState.calendars;
        const activeCalendarId = this.state.calendarState.activeCalendarId;
        const referenceTimestamp = this.state.calendarState.currentTimestamp;
        this.phenomenaSource = this.buildPhenomenonViewModels(
            this.phenomenaDefinitions,
            calendars,
            activeCalendarId,
            referenceTimestamp,
        );
        const filters = this.state.eventsUiState.filters;
        const filtered = this.applyPhenomenaFilters(filters);
        const availableCategories = getUniqueCategories(this.phenomenaSource);
        const filterCount = filters.categories.length + filters.calendarIds.length;
        const validIds = new Set(this.phenomenaDefinitions.map(item => item.id));

        let nextSelectedId = preferredId ?? this.state.eventsUiState.selectedPhenomenonId ?? null;
        if (nextSelectedId && !validIds.has(nextSelectedId)) {
            nextSelectedId = filtered[0]?.id ?? null;
        }

        const nextDetail = nextSelectedId
            ? this.buildPhenomenonDetailForId(nextSelectedId, calendars, referenceTimestamp)
            : null;

        const selectionSource =
            options.bulkSelection !== undefined
                ? options.bulkSelection
                : this.state.eventsUiState.bulkSelection;
        const nextSelection = selectionSource.filter(id => validIds.has(id));

        const exportPayload =
            options.exportPayload !== undefined
                ? options.exportPayload === null
                    ? undefined
                    : options.exportPayload
                : this.state.eventsUiState.lastExportPayload;

        const importSummary =
            options.importSummary !== undefined
                ? options.importSummary
                : this.state.eventsUiState.importSummary ?? null;

        const mapMarkers = this.buildPhenomenonMapMarkers(filtered, calendars);

        this.setState(draft => {
            draft.eventsUiState = {
                ...draft.eventsUiState,
                availableCategories,
                mapMarkers,
                phenomena: filtered,
                filterCount,
                selectedPhenomenonId: nextSelectedId,
                selectedPhenomenonDetail: nextDetail,
                bulkSelection: nextSelection,
                lastExportPayload: exportPayload,
                importSummary,
            };
        });

        void this.persistPreferences({
            lastSelectedPhenomenonId: nextSelectedId ?? undefined,
        });
    }

    private createEditorDraftFromPhenomenon(phenomenon: Phenomenon): PhenomenonEditorDraft {
        return {
            id: phenomenon.id,
            name: phenomenon.name,
            category: phenomenon.category,
            visibility: phenomenon.visibility,
            appliesToCalendarIds: [...phenomenon.appliesToCalendarIds],
            notes: phenomenon.notes ?? "",
        };
    }

    private createDefaultEditorDraft(seedId?: string | null): PhenomenonEditorDraft {
        const id = seedId && seedId.trim().length > 0 ? seedId : this.generatePhenomenonId();
        const activeCalendarId = this.state.calendarState.activeCalendarId;
        const appliesTo = activeCalendarId ? [activeCalendarId] : [];
        return {
            id,
            name: "",
            category: "custom",
            visibility: appliesTo.length ? "selected" : "all_calendars",
            appliesToCalendarIds: appliesTo,
            notes: "",
        };
    }

    private generatePhenomenonId(): string {
        this.phenomenonIdCounter += 1;
        return `phen-${Date.now().toString(36)}-${this.phenomenonIdCounter.toString(36)}`;
    }

    private buildPhenomenonFromDraft(
        draft: PhenomenonEditorDraft,
        base: Phenomenon | null,
    ): PhenomenonDTO {
        const trimmedName = draft.name.trim();
        const category = this.normaliseCategory(draft.category);
        const appliesTo =
            draft.visibility === "all_calendars"
                ? []
                : Array.from(new Set(draft.appliesToCalendarIds.filter(Boolean)));

        const defaults: Phenomenon = base ?? {
            id: draft.id,
            name: trimmedName,
            category,
            visibility: draft.visibility,
            appliesToCalendarIds: appliesTo,
            rule: { type: "annual", offsetDayOfYear: 0 },
            timePolicy: "all_day",
            priority: 0,
            schemaVersion: "1.0.0",
        };

        const notes = draft.notes?.trim() ?? "";

        return {
            ...defaults,
            id: draft.id,
            name: trimmedName,
            category,
            visibility: draft.visibility,
            appliesToCalendarIds: appliesTo,
            notes: notes.length ? notes : undefined,
        };
    }

    private normaliseCategory(value: string): Phenomenon["category"] {
        const allowed: ReadonlyArray<Phenomenon["category"]> = [
            "season",
            "astronomy",
            "weather",
            "tide",
            "holiday",
            "custom",
        ];
        return allowed.includes(value as Phenomenon["category"])
            ? (value as Phenomenon["category"])
            : "custom";
    }

    private toPhenomenon(dto: PhenomenonDTO): Phenomenon {
        const { template: _template, ...rest } = dto;
        const base = rest as Phenomenon;
        return {
            ...base,
            appliesToCalendarIds: [...base.appliesToCalendarIds],
            hooks: base.hooks ? base.hooks.map(hook => ({ ...hook })) : base.hooks,
            effects: base.effects
                ? base.effects.map(effect => ({ ...effect, payload: { ...effect.payload } }))
                : base.effects,
            tags: base.tags ? [...base.tags] : base.tags,
        };
    }

    private shiftAnchorTimestamp(
        schema: CalendarSchema,
        anchor: CalendarTimestamp,
        zoom: CalendarViewZoom,
        direction: 'prev' | 'next',
    ): CalendarTimestamp {
        const step = direction === 'next' ? 1 : -1;

        if (zoom === 'month') {
            let monthIndex = getMonthIndex(schema, anchor.monthId);
            if (monthIndex === -1) {
                monthIndex = 0;
            }
            monthIndex += step;
            let year = anchor.year;
            if (monthIndex < 0) {
                monthIndex = schema.months.length - 1;
                year -= 1;
            } else if (monthIndex >= schema.months.length) {
                monthIndex = 0;
                year += 1;
            }
            const month = schema.months[monthIndex];
            const day = Math.min(anchor.day, month.length);
            return {
                ...anchor,
                year,
                monthId: month.id,
                day,
            };
        }

        if (zoom === 'week') {
            return advanceTime(schema, anchor, step * 7, 'day').timestamp;
        }

        if (zoom === 'day') {
            return advanceTime(schema, anchor, step, 'day').timestamp;
        }

        return advanceTime(schema, anchor, step * 6, 'hour').timestamp;
    }

    private collectAgendaItems(
        anchor: CalendarTimestamp,
        zoom: CalendarViewZoom,
        eventsOverride?: ReadonlyArray<CalendarEvent>,
    ): CalendarEvent[] {
        const events = [
            ...(eventsOverride ?? this.state.calendarState.upcomingEvents),
            ...this.state.calendarState.triggeredEvents,
        ];
        if (events.length === 0) {
            return [];
        }

        if (zoom === 'month') {
            return events.filter(event =>
                event.date.calendarId === anchor.calendarId &&
                event.date.year === anchor.year &&
                event.date.monthId === anchor.monthId,
            );
        }

        if (zoom === 'week') {
            const weekEvents: CalendarEvent[] = [];
            const schema = this.getCalendarSchema(anchor.calendarId);
            if (!schema) return weekEvents;
            for (let offset = 0; offset < schema.daysPerWeek; offset++) {
                const dayTs = advanceTime(schema, anchor, offset, 'day').timestamp;
                weekEvents.push(...events.filter(event =>
                    event.date.calendarId === dayTs.calendarId &&
                    event.date.year === dayTs.year &&
                    event.date.monthId === dayTs.monthId &&
                    event.date.day === dayTs.day,
                ));
            }
            return weekEvents;
        }

        return events.filter(event =>
            event.date.calendarId === anchor.calendarId &&
            event.date.year === anchor.year &&
            event.date.monthId === anchor.monthId &&
            event.date.day === anchor.day,
        );
    }

    private getAnchorBase(): CalendarTimestamp | null {
        return this.state.managerUiState.anchorTimestamp
            ?? this.state.calendarState.currentTimestamp
            ?? this.gateway.getCurrentTimestamp()
            ?? this.getAnchorFallback();
    }

    private clearJumpPreview(): void {
        this.setState(draft => {
            draft.managerUiState = {
                ...draft.managerUiState,
                jumpPreview: [],
            };
        });
    }

    private getAnchorFallback(): CalendarTimestamp | null {
        const activeId = this.state.calendarState.activeCalendarId
            ?? this.gateway.getActiveCalendarId()
            ?? this.state.calendarState.calendars[0]?.id;
        if (!activeId) {
            return null;
        }
        const schema = this.getCalendarSchema(activeId) ?? this.state.calendarState.calendars.find(c => c.id === activeId);
        if (!schema) {
            return null;
        }
        const firstMonth = schema.months[0] ?? { id: schema.epoch.monthId, length: schema.months[0]?.length ?? 30 };
        return createDayTimestamp(activeId, schema.epoch.year, firstMonth.id, schema.epoch.day);
    }

    private computeEditWarnings(schema: CalendarSchema, draft: CalendarCreateDraft): string[] {
        const warnings: string[] = [];
        const currentHours = String(schema.hoursPerDay ?? 24);
        const currentMinutes = String(schema.minutesPerHour ?? 60);
        const currentStep = String(schema.minuteStep ?? 1);
        if (
            draft.hoursPerDay.trim() !== currentHours
            || draft.minutesPerHour.trim() !== currentMinutes
            || draft.minuteStep.trim() !== currentStep
        ) {
            warnings.push("Updating the time definition may require migrating existing events.");
        }
        return warnings;
    }

    private async detectCalendarConflicts(
        calendarId: string,
        updates: Partial<CalendarSchema>,
    ): Promise<string[]> {
        if (
            !("hoursPerDay" in updates)
            && !("minutesPerHour" in updates)
            && !("minuteStep" in updates)
        ) {
            return [];
        }

        const schema = this.getCalendarSchema(calendarId);
        if (!schema) {
            return [];
        }

        const hoursPerDay = updates.hoursPerDay ?? schema.hoursPerDay ?? 24;
        const minutesPerHour = updates.minutesPerHour ?? schema.minutesPerHour ?? 60;
        const minuteStep = updates.minuteStep ?? schema.minuteStep ?? 1;

        const events = await this.eventRepo.listEvents(calendarId);
        const conflicts = new Set<string>();

        const checkTime = (label: string, time: CalendarTimeOfDay | undefined, title: string) => {
            if (!time) {
                return;
            }
            if (time.hour >= hoursPerDay) {
                conflicts.add(`${title}: ${label} hour ${time.hour} exceeds ${hoursPerDay - 1}.`);
            }
            if (time.minute >= minutesPerHour) {
                conflicts.add(`${title}: ${label} minute ${time.minute} exceeds ${minutesPerHour - 1}.`);
            }
        };

        for (const event of events) {
            const title = event.title ?? event.id;
            if (isSingleEvent(event)) {
                checkTime("start", event.startTime, title);
                checkTime("end", event.endTime, title);
                const timestamp = event.date;
                if (timestamp.precision === "hour" || timestamp.precision === "minute") {
                    if (timestamp.hour >= hoursPerDay) {
                        conflicts.add(`${title}: hour ${timestamp.hour} exceeds ${hoursPerDay - 1}.`);
                    }
                    if (timestamp.minute >= minutesPerHour) {
                        conflicts.add(`${title}: minute ${timestamp.minute} exceeds ${minutesPerHour - 1}.`);
                    }
                    if (timestamp.precision === "minute" && timestamp.minute % minuteStep !== 0) {
                        conflicts.add(`${title}: start time is not aligned with the new minute step.`);
                    }
                }
                if (event.durationMinutes && event.durationMinutes % minuteStep !== 0) {
                    conflicts.add(`${title}: duration is not aligned with the new minute step.`);
                }
            } else if (isRecurringEvent(event)) {
                checkTime("start", event.startTime, title);
                if (event.offsetMinutes && event.offsetMinutes % minuteStep !== 0) {
                    conflicts.add(`${title}: offset is not aligned with the new minute step.`);
                }
                if (event.durationMinutes && event.durationMinutes % minuteStep !== 0) {
                    conflicts.add(`${title}: duration is not aligned with the new minute step.`);
                }
            }
        }

        return Array.from(conflicts);
    }

    private getCalendarDefaultsRepository(): (CalendarRepository & CalendarDefaultsRepository) | null {
        const candidate = this.calendarRepo as CalendarRepository & Partial<CalendarDefaultsRepository>;
        if (
            typeof candidate.getDefaults === "function"
            && typeof candidate.clearTravelDefault === "function"
        ) {
            return candidate as CalendarRepository & CalendarDefaultsRepository;
        }
        return null;
    }

    private async collectTravelDefaultIds(calendarId: string): Promise<string[]> {
        const defaultsRepo = this.getCalendarDefaultsRepository();
        if (!defaultsRepo) {
            return [];
        }
        try {
            const defaults = await defaultsRepo.getDefaults();
            return Object.entries(defaults.travel)
                .filter(([, linkedId]) => linkedId === calendarId)
                .map(([travelId]) => travelId);
        } catch {
            return [];
        }
    }

    private async buildCalendarSchemaFromDraft(
        draft: CalendarCreateDraft,
    ): Promise<{ schema: CalendarSchema | null; errors: string[] }> {
        const errors: string[] = [];

        const rawId = draft.id.trim();
        const id = this.slugify(rawId);
        if (!id) {
            errors.push("Identifier is required.");
        }

        const name = draft.name.trim();
        if (!name) {
            errors.push("Name is required.");
        }

        const daysPerWeek = Number(draft.daysPerWeek || "0");
        if (!Number.isFinite(daysPerWeek) || daysPerWeek < 1) {
            errors.push("Days per week must be at least 1.");
        }

        const monthCount = Number(draft.monthCount || "0");
        if (!Number.isFinite(monthCount) || monthCount < 1) {
            errors.push("Month count must be at least 1.");
        }

        const monthLength = Number(draft.monthLength || "0");
        if (!Number.isFinite(monthLength) || monthLength < 1) {
            errors.push("Month length must be at least 1.");
        }

        const hoursPerDay = Number(draft.hoursPerDay || "24");
        if (!Number.isFinite(hoursPerDay) || hoursPerDay < 1) {
            errors.push("Hours per day must be at least 1.");
        }

        const minutesPerHour = Number(draft.minutesPerHour || "60");
        if (!Number.isFinite(minutesPerHour) || minutesPerHour < 1) {
            errors.push("Minutes per hour must be at least 1.");
        }

        const minuteStep = Number(draft.minuteStep || "1");
        if (!Number.isFinite(minuteStep) || minuteStep < 1) {
            errors.push("Minute step must be at least 1.");
        } else if (minuteStep > minutesPerHour) {
            errors.push("Minute step must not exceed minutes per hour.");
        }

        const epochYear = Number(draft.epochYear || "1");
        if (!Number.isFinite(epochYear) || epochYear < 1) {
            errors.push("Epoch year must be at least 1.");
        }

        const epochDay = Number(draft.epochDay || "1");
        if (!Number.isFinite(epochDay) || epochDay < 1) {
            errors.push("Epoch day must be at least 1.");
        } else if (epochDay > monthLength) {
            errors.push("Epoch day must not exceed the chosen month length.");
        }

        if (errors.length > 0) {
            return { schema: null, errors };
        }

        const existing = await this.calendarRepo.getCalendar(id);
        if (existing) {
            return { schema: null, errors: [`Calendar with id "${id}" already exists.`] };
        }

        const safeMonthCount = Math.max(1, Math.floor(monthCount));
        const safeMonthLength = Math.max(1, Math.floor(monthLength));
        const safeDaysPerWeek = Math.max(1, Math.floor(daysPerWeek));
        const safeHoursPerDay = Math.max(1, Math.floor(hoursPerDay));
        const safeMinutesPerHour = Math.max(1, Math.floor(minutesPerHour));
        const safeMinuteStep = Math.max(1, Math.floor(minuteStep));
        const safeEpochYear = Math.max(1, Math.floor(epochYear));
        const safeEpochDay = Math.max(1, Math.min(Math.floor(epochDay), safeMonthLength));

        const monthPrefix = this.slugify(name || id) || "month";
        const months = Array.from({ length: safeMonthCount }, (_, index) => ({
            id: `${monthPrefix}-m${index + 1}`,
            name: `Month ${index + 1}`,
            length: safeMonthLength,
        }));

        if (months.length === 0) {
            return { schema: null, errors: ["Calendar must include at least one month."] };
        }

        const epochMonthId = months[0]?.id ?? `${monthPrefix}-m1`;

        const schema: CalendarSchema = {
            id,
            name,
            description: draft.description.trim() || undefined,
            daysPerWeek: safeDaysPerWeek,
            months,
            hoursPerDay: safeHoursPerDay,
            minutesPerHour: safeMinutesPerHour,
            minuteStep: safeMinuteStep,
            secondsPerMinute: 60,
            epoch: {
                year: safeEpochYear,
                monthId: epochMonthId,
                day: safeEpochDay,
            },
            isDefaultGlobal: false,
            schemaVersion: "1.0.0",
        };

        return { schema, errors: [] };
    }

    private slugify(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .replace(/--+/g, "-");
    }

    private async persistTravelLeafPreferences(
        partial: Partial<TravelLeafPreferencesSnapshot>,
    ): Promise<void> {
        if (!this.travelId) {
            return;
        }

        const base: TravelLeafPreferencesSnapshot = {
            visible: this.state.travelLeafState.visible,
            mode: this.state.travelLeafState.mode,
            lastViewedTimestamp: this.state.travelLeafState.currentTimestamp ?? null,
            ...this.travelLeafPreferences,
        };

        const next: TravelLeafPreferencesSnapshot = {
            ...base,
            ...partial,
        };

        if (partial.lastViewedTimestamp === undefined) {
            next.lastViewedTimestamp =
                base.lastViewedTimestamp ?? this.state.travelLeafState.currentTimestamp ?? null;
        }

        try {
            await this.gateway.saveTravelLeafPreferences(this.travelId, next);
            this.travelLeafPreferences = next;
        } catch (error) {
            console.warn("Failed to persist travel leaf preferences", error);
        }
    }

    private async persistPreferences(partial: Partial<AlmanacPreferencesSnapshot>): Promise<void> {
        try {
            await this.gateway.savePreferences(partial);
        } catch (error) {
            console.warn("Failed to persist Almanac preferences", error);
        }
    }
}

function cloneState<T>(value: T): T {
    try {
        return structuredClone(value);
    } catch (error) {
        return JSON.parse(JSON.stringify(value)) as T;
    }
}

function clampCoordinate(value: number): number {
    const clamped = Math.min(0.95, Math.max(0.05, value));
    return Number(clamped.toFixed(4));
}

function getUniqueCategories(phenomena: ReadonlyArray<{ category?: string }>): string[] {
    const set = new Set<string>();
    for (const item of phenomena) {
        if (item.category) {
            set.add(item.category);
        }
    }
    return Array.from(set.values()).sort();
}
