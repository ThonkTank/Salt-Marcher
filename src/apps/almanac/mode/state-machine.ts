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
    type CalendarManagerViewMode,
    type CalendarStateSlice,
    type CalendarViewZoom,
    type EventsFilterState,
    type PhenomenonDetailView,
} from "./contracts";
import type {
    CalendarRepository,
    EventRepository,
    PhenomenonRepository,
} from "../data/in-memory-repository";
import { InMemoryStateGateway } from "../data/in-memory-gateway";
import { getMonthById, getMonthIndex, getTimeDefinition, type CalendarSchema } from "../domain/calendar-schema";
import type { CalendarEvent } from "../domain/calendar-event";
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

const MAX_TRIGGERED_EVENTS = 10;
const MAX_TRIGGERED_PHENOMENA = 10;

type PhenomenonViewModel = {
    readonly id: string;
    readonly title: string;
    readonly category?: string;
    readonly linkedCalendars: ReadonlyArray<string>;
    readonly nextOccurrence?: string;
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

    constructor(
        private readonly calendarRepo: CalendarRepository,
        private readonly eventRepo: EventRepository,
        private readonly gateway: InMemoryStateGateway,
        private readonly phenomenonRepo: PhenomenonRepository,
    ) {}

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
            const [calendars, snapshot, preferences, phenomena] = await Promise.all([
                this.calendarRepo.listCalendars(),
                this.gateway.loadSnapshot(travelId ?? undefined),
                this.gateway.loadPreferences(),
                this.phenomenonRepo.listPhenomena(),
            ]);
            this.phenomenaDefinitions = phenomena;
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
                    phenomena: filteredPhenomena,
                    selectedPhenomenonId: initialSelectedId,
                    selectedPhenomenonDetail: initialDetail,
                    isDetailLoading: false,
                };
                draft.telemetryState = {
                    lastEvents: [],
                };
            });

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
                this.gateway.loadSnapshot(),
                this.phenomenonRepo.listPhenomena(),
            ]);
            this.phenomenaDefinitions = phenomena;
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
                    phenomena: filteredPhenomena,
                    selectedPhenomenonId: nextSelectedId,
                    selectedPhenomenonDetail: nextDetail,
                    isDetailLoading: false,
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

        this.setState(draft => {
            draft.almanacUiState = {
                ...draft.almanacUiState,
                mode,
                modeHistory: [...draft.almanacUiState.modeHistory, mode].slice(-5),
                error: undefined,
            };
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

        this.setState(draft => {
            draft.eventsUiState = {
                ...draft.eventsUiState,
                filters: normalised,
                filterCount,
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
            const phenomenon = await this.phenomenonRepo.getPhenomenon(phenomenonId);
            if (!phenomenon) {
                throw new Error(`Phenomenon ${phenomenonId} not found`);
            }

            this.phenomenaDefinitions = [
                ...this.phenomenaDefinitions.filter(item => item.id !== phenomenon.id),
                phenomenon,
            ];

            const detail = this.buildPhenomenonDetailView(
                phenomenon,
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
            await this.gateway.setActiveCalendar(schema.id, initialTimestamp);
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
            this.setState(draftState => {
                draftState.managerUiState = {
                    ...draftState.managerUiState,
                    isCreating: false,
                    createErrors: [message],
                };
            });
        }
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
            await this.gateway.setActiveCalendar(calendarId, timestamp);
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
            await this.calendarRepo.setGlobalDefault(calendarId);
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
        } catch (error) {
            const message = error instanceof Error ? error.message : "Standardkalender konnte nicht aktualisiert werden";
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

    private async handleTimeAdvance(amount: number, unit: "day" | "hour" | "minute"): Promise<void> {
        const activeCalendarId = this.state.calendarState.activeCalendarId;
        if (!activeCalendarId) {
            return;
        }

        this.setState(draft => {
            draft.almanacUiState = {
                ...draft.almanacUiState,
                isLoading: true,
                error: undefined,
            };
            draft.calendarState = {
                ...draft.calendarState,
                lastAdvanceStep: { amount, unit },
            };
        });

        try {
            const result = await this.gateway.advanceTimeBy(amount, unit);
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
                this.phenomenaDefinitions = await this.phenomenonRepo.listPhenomena();
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
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    isLoading: false,
                };
                draft.telemetryState = {
                    lastEvents: ["calendar.time.advance", ...draft.telemetryState.lastEvents].slice(0, 5),
                };
                draft.eventsUiState = {
                    ...draft.eventsUiState,
                    filterCount,
                    filters: { ...filters },
                    availableCategories,
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

            void this.persistPreferences({
                lastSelectedPhenomenonId: nextSelectedId ?? undefined,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Zeitfortschritt fehlgeschlagen";
            this.setState(draft => {
                draft.almanacUiState = {
                    ...draft.almanacUiState,
                    isLoading: false,
                    error: message,
                };
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

            await this.gateway.setCurrentTimestamp(target);

            const snapshotAfterJump = await this.gateway.loadSnapshot();
            const upcoming = snapshotAfterJump.upcomingEvents;
            const upcomingPhenomena = snapshotAfterJump.upcomingPhenomena;

            if (this.phenomenaDefinitions.length === 0) {
                this.phenomenaDefinitions = await this.phenomenonRepo.listPhenomena();
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

            void this.persistPreferences({
                lastSelectedPhenomenonId: nextSelectedId ?? undefined,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Zeit konnte nicht gesetzt werden";
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

function getUniqueCategories(phenomena: ReadonlyArray<{ category?: string }>): string[] {
    const set = new Set<string>();
    for (const item of phenomena) {
        if (item.category) {
            set.add(item.category);
        }
    }
    return Array.from(set.values()).sort();
}
