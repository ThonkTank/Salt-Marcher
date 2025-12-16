/**
 * Almanac State Machine (Refactored)
 *
 * Thin coordinator that delegates to handler functions.
 * All state lives in AlmanacStore, all business logic in handlers.
 *
 * This is a simplified version of the original state-machine.ts that:
 * - Uses AlmanacStore instead of internal state management
 * - Delegates all business logic to handler functions
 * - Provides context objects to handlers instead of direct access
 * - Keeps helper methods as private methods (accessed via context binding)
 *
 * @module workmodes/almanac/mode
 */

import { configurableLogger } from "@services/logging/configurable-logger";
import { createAlmanacStore, type AlmanacStore } from "../store";
import type {
	CalendarStateGateway,
	TravelLeafPreferencesSnapshot,
} from "../data/calendar-state-gateway";
import { isCalendarGatewayError } from "../data/calendar-state-gateway";
import type {
	CalendarRepository,
	EventRepository,
	PhenomenonRepository,
	CalendarDefaultsRepository,
} from "../data/repositories";
import { AlmanacRepositoryError } from "../data/repositories";
import {
	cartographerHookGateway as defaultCartographerGateway,
	type CartographerHookGateway,
} from "./cartographer-gateway";
import type {
	AlmanacEvent,
	AlmanacState,
	AlmanacStateListener,
	AlmanacPreferencesSnapshot,
	AlmanacInitOverrides,
	AlmanacMode,
	CalendarViewMode,
	CalendarViewZoom,
	CalendarCreateDraft,
	CalendarCreateField,
	EventEditorDraft,
	EventEditorMode,
	EventEditorPreviewItem,
	EventsFilterState,
	EventsMapMarker,
	PhenomenonDetailView,
	PhenomenonEditorDraft,
	TravelCalendarMode,
} from "./contracts";
import {
	createInitialAlmanacState,
	createDefaultCalendarDraft,
	createCalendarDraftFromSchema,
	CALENDAR_VIEW_MODE_METADATA,
} from "./contracts";
import type { PhenomenonDTO } from "../data/dto";
import type {
	CalendarEvent,
	CalendarSchema,
	CalendarTimestamp,
	Phenomenon,
	CalendarTimeOfDay,
} from "../helpers";
import {
	advanceTime,
	createDayTimestamp,
	getMonthById,
	getMonthIndex,
	formatTimestamp,
	computeNextPhenomenonOccurrence,
	isSingleEvent,
	isRecurringEvent,
} from "../helpers";
import { emitAlmanacEvent, reportAlmanacGatewayIssue } from "../telemetry";

// Import all handlers
import {
	handleCalendarCreate,
	handleCalendarEditRequested,
	handleCalendarEditCancelled,
	handleCalendarEditFormUpdated,
	handleCalendarUpdate,
	handleCalendarDeleteRequested,
	handleCalendarDeleteConfirmed,
	handleCalendarDeleteCancelled,
	handleConflictDismissed,
	handleManagerNavigation,
	handleManagerSelectionChanged,
	handleCreateFormUpdated,
	handleCalendarSelect,
	handleCalendarDefault,
	handleCalendarViewMode,
} from "../handlers/calendar-handlers";
import {
	handleEventCreateRequested,
	handleEventEditRequested,
	handleEventEditorUpdated,
	handleEventEditorCancelled,
	handleEventEditorSave,
	handleEventDelete,
	handleEventBulkAction,
	handleEventExportCleared,
	handleEventImportRequested,
	handleEventImportCancelled,
	handleEventImportSubmitted,
} from "../handlers/event-handlers";
import {
	handleEventsViewMode,
	handleEventsFilterChange,
	handlePhenomenonSelected,
	handlePhenomenonDetailClosed,
	handleEventsBulkSelection,
	handlePhenomenonEditRequest,
	handlePhenomenonEditCancelled,
	handlePhenomenonSave,
} from "../handlers/phenomenon-handlers";
import { handleTimeAdvance, handleTimeJump, handleTimeJumpPreview } from "../handlers/time-handlers";
import { handleTravelLeafMounted, handleTravelModeChanged } from "../handlers/travel-handlers";

// Import context types
import type {
	AlmanacHandlerContext,
	EventHandlerContext,
	PhenomenonHandlerContext,
	TimeHandlerContext,
	TravelHandlerContext,
	PhenomenonViewModel,
} from "../handlers/handler-types";

const logger = configurableLogger.forModule("almanac-state-machine");

const MAX_TRIGGERED_EVENTS = 10;
const MAX_TRIGGERED_PHENOMENA = 10;

// ============================================================================
// Almanac State Machine (Refactored)
// ============================================================================

export class AlmanacStateMachine {
	private readonly store: AlmanacStore;
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
		cartographerGateway: CartographerHookGateway = defaultCartographerGateway
	) {
		this.store = createAlmanacStore();
		this.cartographerGateway = cartographerGateway;
	}

	getState(): AlmanacState {
		return this.store.get();
	}

	subscribe(listener: AlmanacStateListener): () => void {
		return this.store.subscribe(listener);
	}

	async dispatch(event: AlmanacEvent): Promise<void> {
		switch (event.type) {
			case "INIT_ALMANAC":
				await this.handleInit(event.travelId ?? null, event.overrides ?? null);
				break;
			case "ALMANAC_MODE_SELECTED":
				await this.handleModeSelected(event.mode);
				break;

			// Calendar handlers
			case "CALENDAR_CREATE_REQUESTED":
				await handleCalendarCreate(this.getBaseContext());
				break;
			case "CALENDAR_EDIT_REQUESTED":
				await handleCalendarEditRequested(this.getBaseContext(), event.calendarId);
				break;
			case "CALENDAR_EDIT_CANCELLED":
				handleCalendarEditCancelled(this.getBaseContext(), event.calendarId);
				break;
			case "CALENDAR_EDIT_FORM_UPDATED":
				handleCalendarEditFormUpdated(
					this.getBaseContext(),
					event.calendarId,
					event.field,
					event.value
				);
				break;
			case "CALENDAR_UPDATE_REQUESTED":
				await handleCalendarUpdate(this.getBaseContext(), event.calendarId);
				break;
			case "CALENDAR_DELETE_REQUESTED":
				await handleCalendarDeleteRequested(this.getBaseContext(), event.calendarId);
				break;
			case "CALENDAR_DELETE_CONFIRMED":
				await handleCalendarDeleteConfirmed(this.getBaseContext(), event.calendarId);
				break;
			case "CALENDAR_DELETE_CANCELLED":
				handleCalendarDeleteCancelled(this.getBaseContext());
				break;
			case "CALENDAR_CONFLICT_DISMISSED":
				handleConflictDismissed(this.getBaseContext());
				break;
			case "CALENDAR_VIEW_MODE_CHANGED":
				await handleCalendarViewMode(this.getBaseContext(), event.mode);
				break;
			case "MANAGER_NAVIGATION_REQUESTED":
				handleManagerNavigation(this.getBaseContext(), event.direction);
				break;
			case "MANAGER_SELECTION_CHANGED":
				handleManagerSelectionChanged(this.getBaseContext(), event.selection);
				break;
			case "MANAGER_CREATE_FORM_UPDATED":
				handleCreateFormUpdated(this.getBaseContext(), event.field, event.value);
				break;
			case "CALENDAR_SELECT_REQUESTED":
				await handleCalendarSelect(this.getBaseContext(), event.calendarId);
				break;
			case "CALENDAR_DEFAULT_SET_REQUESTED":
				await handleCalendarDefault(this.getBaseContext(), event.calendarId);
				break;
			case "CALENDAR_DATA_REFRESH_REQUESTED":
				await this.refreshCalendarData();
				break;

			// Event handlers
			case "EVENT_CREATE_REQUESTED":
				await handleEventCreateRequested(
					this.getEventContext(),
					event.mode,
					event.calendarId,
					event.timestamp
				);
				break;
			case "EVENT_EDIT_REQUESTED":
				await handleEventEditRequested(this.getEventContext(), event.eventId);
				break;
			case "EVENT_EDITOR_UPDATED":
				handleEventEditorUpdated(this.getEventContext(), event.update);
				break;
			case "EVENT_EDITOR_CANCELLED":
				handleEventEditorCancelled(this.getEventContext());
				break;
			case "EVENT_EDITOR_SAVE_REQUESTED":
				await handleEventEditorSave(this.getEventContext());
				break;
			case "EVENT_DELETE_REQUESTED":
				await handleEventDelete(this.getEventContext(), event.eventId);
				break;
			case "EVENT_BULK_ACTION_REQUESTED":
				await handleEventBulkAction(this.getEventContext(), event.action, event.ids);
				break;
			case "EVENT_EXPORT_CLEARED":
				handleEventExportCleared(this.getEventContext());
				break;
			case "EVENT_IMPORT_REQUESTED":
				handleEventImportRequested(this.getEventContext());
				break;
			case "EVENT_IMPORT_CANCELLED":
				handleEventImportCancelled(this.getEventContext());
				break;
			case "EVENT_IMPORT_SUBMITTED":
				await handleEventImportSubmitted(this.getEventContext(), event.payload);
				break;

			// Phenomenon handlers
			case "EVENTS_VIEW_MODE_CHANGED":
				await handleEventsViewMode(this.getPhenomenonContext(), event.viewMode);
				break;
			case "EVENTS_FILTER_CHANGED":
				handleEventsFilterChange(this.getPhenomenonContext(), event.filters);
				break;
			case "EVENTS_PHENOMENON_SELECTED":
				await handlePhenomenonSelected(this.getPhenomenonContext(), event.phenomenonId);
				break;
			case "EVENTS_PHENOMENON_DETAIL_CLOSED":
				handlePhenomenonDetailClosed(this.getPhenomenonContext());
				break;
			case "EVENTS_BULK_SELECTION_UPDATED":
				handleEventsBulkSelection(this.getPhenomenonContext(), event.selection);
				break;
			case "PHENOMENON_EDIT_REQUESTED":
				await handlePhenomenonEditRequest(
					this.getPhenomenonContext(),
					event.phenomenonId ?? null
				);
				break;
			case "PHENOMENON_EDIT_CANCELLED":
				handlePhenomenonEditCancelled(this.getPhenomenonContext());
				break;
			case "PHENOMENON_SAVE_REQUESTED":
				await handlePhenomenonSave(this.getPhenomenonContext(), event.draft);
				break;

			// Time handlers
			case "TIME_ADVANCE_REQUESTED":
				await handleTimeAdvance(this.getTimeContext(), event.amount, event.unit, "almanac");
				break;
			case "TIME_JUMP_REQUESTED":
				await handleTimeJump(this.getTimeContext(), event.timestamp);
				break;
			case "TIME_JUMP_PREVIEW_REQUESTED":
				await handleTimeJumpPreview(this.getTimeContext(), event.timestamp);
				break;

			// Travel handlers
			case "TRAVEL_LEAF_MOUNTED":
				await handleTravelLeafMounted(this.getTravelContext(), event.travelId);
				break;
			case "TRAVEL_MODE_CHANGED":
				await handleTravelModeChanged(this.getTravelContext(), event.mode);
				break;
			case "TRAVEL_TIME_ADVANCE_REQUESTED":
				await handleTimeAdvance(this.getTimeContext(), event.amount, event.unit, "travel");
				break;

			// Error handling
			case "ERROR_OCCURRED":
				this.store.update((draft) => {
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
				logger.warn("Unhandled event type", { type: (event as AlmanacEvent).type });
		}
	}

	// ==================== Context Builders ====================

	private getBaseContext(): AlmanacHandlerContext {
		return {
			store: this.store,
			calendarRepo: this.calendarRepo,
			eventRepo: this.eventRepo,
			gateway: this.gateway,
			phenomenonRepo: this.phenomenonRepo,
			travelId: this.travelId,
			getCalendarSchema: this.getCalendarSchema.bind(this),
			refreshCalendarData: this.refreshCalendarData.bind(this),
			buildCalendarSchemaFromDraft: this.buildCalendarSchemaFromDraft.bind(this),
			computeEditWarnings: this.computeEditWarnings.bind(this),
			detectCalendarConflicts: this.detectCalendarConflicts.bind(this),
			collectTravelDefaultIds: this.collectTravelDefaultIds.bind(this),
			getCalendarDefaultsRepository: this.getCalendarDefaultsRepository.bind(this),
			slugify: this.slugify.bind(this),
			mapCalendarViewModeToZoom: this.mapCalendarViewModeToZoom.bind(this),
			collectAgendaItems: this.collectAgendaItems.bind(this),
			persistPreferences: this.persistPreferences.bind(this),
			computeStatusSummary: this.computeStatusSummary.bind(this),
		};
	}

	private getEventContext(): EventHandlerContext {
		return {
			...this.getBaseContext(),
			phenomenaDefinitions: this.phenomenaDefinitions,
			generateEventId: this.generateEventId.bind(this),
			loadEventById: this.loadEventById.bind(this),
			createDraftFromEvent: this.createDraftFromEvent.bind(this),
			validateEventDraft: this.validateEventDraft.bind(this),
			validateAndPreviewDraft: this.validateAndPreviewDraft.bind(this),
			computeEventPreview: this.computeEventPreview.bind(this),
			rebuildPhenomenaListing: this.rebuildPhenomenaListing.bind(this),
		};
	}

	private getPhenomenonContext(): PhenomenonHandlerContext {
		return {
			...this.getBaseContext(),
			phenomenaDefinitions: this.phenomenaDefinitions,
			setPhenomenaDefinitions: (defs) => {
				this.phenomenaDefinitions = defs;
			},
			phenomenaSource: this.phenomenaSource,
			setPhenomenaSource: (source) => {
				this.phenomenaSource = source;
			},
			buildPhenomenonDetailForId: this.buildPhenomenonDetailForId.bind(this),
			buildPhenomenonViewModels: this.buildPhenomenonViewModels.bind(this),
			buildPhenomenonMapMarkers: this.buildPhenomenonMapMarkers.bind(this),
			applyPhenomenaFilters: this.applyPhenomenaFilters.bind(this),
			toPhenomenon: this.toPhenomenon.bind(this),
			buildPhenomenonFromDraft: this.buildPhenomenonFromDraft.bind(this),
			createEditorDraftFromPhenomenon: this.createEditorDraftFromPhenomenon.bind(this),
			createDefaultEditorDraft: this.createDefaultEditorDraft.bind(this),
			rebuildPhenomenaListing: this.rebuildPhenomenaListing.bind(this),
			getUniqueCategories: this.getUniqueCategories.bind(this),
		};
	}

	private getTimeContext(): TimeHandlerContext {
		return {
			...this.getBaseContext(),
			phenomenaDefinitions: this.phenomenaDefinitions,
			setPhenomenaDefinitions: (defs) => {
				this.phenomenaDefinitions = defs;
			},
			phenomenaSource: this.phenomenaSource,
			setPhenomenaSource: (source) => {
				this.phenomenaSource = source;
			},
			cartographerGateway: this.cartographerGateway,
			buildPhenomenonViewModels: this.buildPhenomenonViewModels.bind(this),
			buildPhenomenonDetailForId: this.buildPhenomenonDetailForId.bind(this),
			buildPhenomenonMapMarkers: this.buildPhenomenonMapMarkers.bind(this),
			applyPhenomenaFilters: this.applyPhenomenaFilters.bind(this),
			toPhenomenon: this.toPhenomenon.bind(this),
			getUniqueCategories: this.getUniqueCategories.bind(this),
			persistTravelLeafPreferences: this.persistTravelLeafPreferences.bind(this),
			clearJumpPreview: this.clearJumpPreview.bind(this),
		};
	}

	private getTravelContext(): TravelHandlerContext {
		return {
			...this.getBaseContext(),
			travelLeafPreferences: this.travelLeafPreferences,
			setTravelLeafPreferences: (prefs) => {
				this.travelLeafPreferences = prefs;
			},
			persistTravelLeafPreferences: this.persistTravelLeafPreferences.bind(this),
		};
	}

	// ==================== Complex Handlers (Keep Internal) ====================

	/**
	 * Initialize almanac - loads all data and sets initial state.
	 * This is complex initialization logic that stays in the state machine.
	 */
	private async handleInit(
		travelId: string | null,
		overrides: AlmanacInitOverrides | null
	): Promise<void> {
		if (this.initialised) {
			logger.debug("Almanac already initialized, skipping.");
			return;
		}

		this.travelId = travelId;

		try {
			// Load preferences
			const prefs = await this.gateway.loadPreferences();

			// Load travel leaf preferences if in travel context
			if (travelId) {
				try {
					this.travelLeafPreferences = await this.gateway.loadTravelLeafPreferences(travelId);
				} catch (error) {
					logger.warn("Failed to load travel leaf preferences", { travelId, error });
				}
			}

			// Load calendar data
			await this.refreshCalendarData();

			// Apply overrides or preferences
			const state = this.store.get();
			const activeCalendarId =
				overrides?.activeCalendarId ??
				state.calendarState.activeCalendarId ??
				prefs.activeCalendarId ??
				state.calendarState.calendars[0]?.id ??
				null;

			const currentTimestamp =
				overrides?.timestamp ??
				state.calendarState.currentTimestamp ??
				this.gateway.getCurrentTimestamp() ??
				null;

			// Set initial state
			this.store.update((s) => ({
				...s,
				almanacUiState: {
					...s.almanacUiState,
					mode: prefs.mode ?? "manager",
					isLoading: false,
				},
				calendarState: {
					...s.calendarState,
					activeCalendarId,
					currentTimestamp,
				},
				calendarViewState: {
					...s.calendarViewState,
					mode: prefs.calendarViewMode ?? "calendar",
				},
				eventsUiState: {
					...s.eventsUiState,
					viewMode: prefs.eventsViewMode ?? "timeline",
				},
			}));

			this.initialised = true;
			emitAlmanacEvent("init_success");
		} catch (error) {
			logger.error("Failed to initialize almanac", error);
			this.store.update((s) => ({
				...s,
				almanacUiState: {
					...s.almanacUiState,
					isLoading: false,
					error: "Failed to initialize almanac",
				},
			}));
			throw error;
		}
	}

	/**
	 * Handle mode selection - complex logic that coordinates multiple state slices.
	 * Kept internal due to complexity.
	 */
	private async handleModeSelected(mode: AlmanacMode): Promise<void> {
		const state = this.store.get();

		if (mode === state.almanacUiState.mode) {
			return;
		}

		this.store.update((s) => ({
			...s,
			almanacUiState: {
				...s.almanacUiState,
				mode,
				modeHistory: [...s.almanacUiState.modeHistory, mode],
			},
		}));

		await this.persistPreferences({ mode });

		// Mode-specific initialization
		if (mode === "events") {
			this.rebuildPhenomenaListing(null, {});
		}

		emitAlmanacEvent("mode_changed", { mode });
	}

	// ==================== Helper Methods ====================

	private getCalendarSchema(id: string): CalendarSchema | undefined {
		return this.store.get().calendarState.calendars.find((cal) => cal.id === id);
	}

	private async refreshCalendarData(): Promise<void> {
		try {
			const calendars = await this.calendarRepo.listCalendars();
			const phenomena = await this.phenomenonRepo.listPhenomena();

			this.phenomenaDefinitions = phenomena.map((dto) => this.toPhenomenon(dto));

			this.store.update((s) => ({
				...s,
				calendarState: {
					...s.calendarState,
					calendars,
				},
			}));
		} catch (error) {
			logger.error("Failed to refresh calendar data", error);
			throw error;
		}
	}

	private slugify(value: string): string {
		return value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9-]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.replace(/--+/g, "-");
	}

	private async buildCalendarSchemaFromDraft(
		draft: CalendarCreateDraft
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
			epoch: {
				year: safeEpochYear,
				monthId: epochMonthId,
				day: safeEpochDay,
			},
		};

		return { schema, errors: [] };
	}

	private computeEditWarnings(schema: CalendarSchema, draft: CalendarCreateDraft): string[] {
		const warnings: string[] = [];
		const currentHours = String(schema.hoursPerDay ?? 24);
		const currentMinutes = String(schema.minutesPerHour ?? 60);
		const currentStep = String(schema.minuteStep ?? 1);
		if (
			draft.hoursPerDay.trim() !== currentHours ||
			draft.minutesPerHour.trim() !== currentMinutes ||
			draft.minuteStep.trim() !== currentStep
		) {
			warnings.push("Updating the time definition may require migrating existing events.");
		}
		return warnings;
	}

	private async detectCalendarConflicts(
		calendarId: string,
		updates: Partial<CalendarSchema>
	): Promise<string[]> {
		if (
			!("hoursPerDay" in updates) &&
			!("minutesPerHour" in updates) &&
			!("minuteStep" in updates)
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

	private getCalendarDefaultsRepository(): CalendarDefaultsRepository | null {
		const candidate = this.calendarRepo as CalendarRepository &
			Partial<CalendarDefaultsRepository>;
		if (
			typeof candidate.getDefaults === "function" &&
			typeof candidate.setDefault === "function"
		) {
			return candidate as CalendarRepository & CalendarDefaultsRepository;
		}
		return null;
	}

	private mapCalendarViewModeToZoom(mode: CalendarViewMode): CalendarViewZoom | null {
		return CALENDAR_VIEW_MODE_METADATA[mode]?.defaultZoom ?? null;
	}

	private collectAgendaItems(
		anchor: CalendarTimestamp,
		zoom: CalendarViewZoom,
		eventsOverride?: ReadonlyArray<CalendarEvent>
	): CalendarEvent[] {
		const state = this.store.get();
		const events = [
			...(eventsOverride ?? state.calendarState.upcomingEvents),
			...state.calendarState.triggeredEvents,
		];
		if (events.length === 0) {
			return [];
		}

		if (zoom === "month") {
			return events.filter(
				(event) =>
					event.date.calendarId === anchor.calendarId &&
					event.date.year === anchor.year &&
					event.date.monthId === anchor.monthId
			);
		}

		if (zoom === "week") {
			const weekEvents: CalendarEvent[] = [];
			const schema = this.getCalendarSchema(anchor.calendarId);
			if (!schema) return weekEvents;
			for (let offset = 0; offset < schema.daysPerWeek; offset++) {
				const dayTs = advanceTime(schema, anchor, offset, "day").timestamp;
				weekEvents.push(
					...events.filter(
						(event) =>
							event.date.calendarId === dayTs.calendarId &&
							event.date.year === dayTs.year &&
							event.date.monthId === dayTs.monthId &&
							event.date.day === dayTs.day
					)
				);
			}
			return weekEvents;
		}

		return events.filter(
			(event) =>
				event.date.calendarId === anchor.calendarId &&
				event.date.year === anchor.year &&
				event.date.monthId === anchor.monthId &&
				event.date.day === anchor.day
		);
	}

	private async persistPreferences(partial: Partial<AlmanacPreferencesSnapshot>): Promise<void> {
		try {
			await this.gateway.savePreferences(partial);
		} catch (error) {
			logger.warn("Failed to persist Almanac preferences", error);
		}
	}

	private async persistTravelLeafPreferences(
		partial: Partial<TravelLeafPreferencesSnapshot>
	): Promise<void> {
		if (!this.travelId) {
			return;
		}

		const state = this.store.get();
		const base: TravelLeafPreferencesSnapshot = {
			visible: state.travelLeafState.visible,
			mode: state.travelLeafState.mode,
			lastViewedTimestamp: state.travelLeafState.currentTimestamp ?? null,
			...this.travelLeafPreferences,
		};

		const next: TravelLeafPreferencesSnapshot = {
			...base,
			...partial,
		};

		if (partial.lastViewedTimestamp === undefined) {
			next.lastViewedTimestamp =
				base.lastViewedTimestamp ?? state.travelLeafState.currentTimestamp ?? null;
		}

		try {
			await this.gateway.saveTravelLeafPreferences(this.travelId, next);
			this.travelLeafPreferences = next;
		} catch (error) {
			logger.warn("Failed to persist travel leaf preferences", error);
		}
	}

	private computeStatusSummary(state: AlmanacState) {
		// Placeholder - implement summary logic
		return state.almanacUiState.statusSummary;
	}

	private clearJumpPreview(): void {
		this.store.update((draft) => ({
			...draft,
			managerUiState: {
				...draft.managerUiState,
				jumpPreview: [],
			},
		}));
	}

	// ==================== Phenomenon Helper Methods ====================

	private buildPhenomenonViewModels(
		phenomena: ReadonlyArray<Phenomenon>,
		calendars: ReadonlyArray<CalendarSchema>,
		activeCalendarId: string | null,
		referenceTimestamp: CalendarTimestamp | null
	): PhenomenonViewModel[] {
		const calendarMap = new Map(calendars.map((schema) => [schema.id, schema] as const));

		return phenomena.map((phenomenon) => {
			const linkedIdsBase =
				phenomenon.visibility === "all_calendars"
					? calendars.map((schema) => schema.id)
					: phenomenon.appliesToCalendarIds;

			const linkedCalendars = Array.from(new Set(linkedIdsBase)).filter((id) =>
				calendarMap.has(id)
			);

			const occurrences = linkedCalendars.flatMap((calendarId) => {
				const schema = calendarMap.get(calendarId);
				if (!schema) return [] as Array<{ label: string; sortKey: string }>;

				const anchor =
					referenceTimestamp && referenceTimestamp.calendarId === calendarId
						? referenceTimestamp
						: createDayTimestamp(
								calendarId,
								schema.epoch.year,
								schema.epoch.monthId,
								schema.epoch.day
						  );

				try {
					const occurrence = computeNextPhenomenonOccurrence(
						phenomenon,
						schema,
						calendarId,
						anchor,
						{ includeStart: true }
					);

					if (!occurrence) {
						return [];
					}

					const monthName =
						getMonthById(schema, occurrence.timestamp.monthId)?.name ??
						occurrence.timestamp.monthId;
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
		calendars: ReadonlyArray<CalendarSchema>
	): EventsMapMarker[] {
		// Placeholder - implement map markers
		return [];
	}

	private buildPhenomenonDetailForId(
		id: string,
		calendars: ReadonlyArray<CalendarSchema>,
		timestamp: CalendarTimestamp | null
	): PhenomenonDetailView | null {
		// Placeholder - implement detail view
		return null;
	}

	private applyPhenomenaFilters(filters: EventsFilterState): PhenomenonViewModel[] {
		// Placeholder - implement filtering
		return this.phenomenaSource;
	}

	private toPhenomenon(dto: PhenomenonDTO): Phenomenon {
		// Placeholder - implement conversion
		return dto as unknown as Phenomenon;
	}

	private buildPhenomenonFromDraft(
		draft: PhenomenonEditorDraft,
		existing: Phenomenon | null
	): PhenomenonDTO {
		// Placeholder - implement draft conversion
		return {} as PhenomenonDTO;
	}

	private createEditorDraftFromPhenomenon(phenomenon: Phenomenon): PhenomenonEditorDraft {
		// Placeholder - implement draft creation
		return {} as PhenomenonEditorDraft;
	}

	private createDefaultEditorDraft(id: string | null): PhenomenonEditorDraft {
		// Placeholder - implement default draft
		return {} as PhenomenonEditorDraft;
	}

	private rebuildPhenomenaListing(
		selectedId: string | null,
		options: { bulkSelection?: ReadonlyArray<string> }
	): void {
		// Placeholder - implement rebuild
	}

	private getUniqueCategories(phenomena: PhenomenonViewModel[]): string[] {
		const set = new Set<string>();
		for (const item of phenomena) {
			if (item.category) {
				set.add(item.category);
			}
		}
		return Array.from(set.values()).sort();
	}

	// ==================== Event Helper Methods ====================

	private generateEventId(): string {
		this.eventIdCounter += 1;
		return `event-${Date.now()}-${this.eventIdCounter}`;
	}

	private async loadEventById(eventId: string): Promise<CalendarEvent | null> {
		// Placeholder - implement event loading
		return null;
	}

	private createDraftFromEvent(event: CalendarEvent): EventEditorDraft {
		// Placeholder - implement draft creation
		return {} as EventEditorDraft;
	}

	private validateEventDraft(draft: EventEditorDraft): {
		errors: string[];
		event: CalendarEvent | null;
		schema: CalendarSchema | null;
	} {
		// Placeholder - implement validation
		return { errors: [], event: null, schema: null };
	}

	private validateAndPreviewDraft(draft: EventEditorDraft): {
		errors: ReadonlyArray<string>;
		preview: ReadonlyArray<EventEditorPreviewItem>;
	} {
		// Placeholder - implement validation and preview
		return { errors: [], preview: [] };
	}

	private computeEventPreview(
		event: CalendarEvent,
		schema: CalendarSchema
	): EventEditorPreviewItem[] {
		// Placeholder - implement preview
		return [];
	}
}
