/**
 * Almanac Handler Types
 *
 * Shared type definitions for all Almanac handler functions.
 * Handlers are pure functions that receive context and update state.
 *
 * @module workmodes/almanac/handlers
 */

import type { AlmanacStore } from "../store";
import type { CalendarStateGateway, TravelLeafPreferencesSnapshot } from "../data/calendar-state-gateway";
import type {
	CalendarRepository,
	EventRepository,
	PhenomenonRepository,
	CalendarDefaultsRepository,
} from "../data/repositories";
import type { PhenomenonDTO } from "../data/dto";
import type { CartographerHookGateway } from "../mode/cartographer-gateway";
import type {
	AlmanacPreferencesSnapshot,
	AlmanacState,
	CalendarCreateDraft,
	CalendarViewMode,
	CalendarViewZoom,
	EventEditorDraft,
	EventEditorPreviewItem,
	EventsFilterState,
	EventsMapMarker,
	PhenomenonDetailView,
	PhenomenonEditorDraft,
} from "../mode/contracts";
import type {
	CalendarEvent,
	CalendarSchema,
	CalendarTimestamp,
	Phenomenon,
} from "../helpers";

// ============================================================================
// View Model Types
// ============================================================================

export interface PhenomenonViewModel {
	id: string;
	title: string;
	category?: string;
	linkedCalendars: string[];
	nextOccurrence?: string;
}

export interface PhenomenaListingOptions {
	bulkSelection?: string[];
	exportPayload?: string | null;
	importSummary?: { imported: number; failed: number } | null;
}

// ============================================================================
// Base Handler Context
// ============================================================================

/**
 * Base context shared by all handlers.
 * Contains repositories, gateway, and common helper functions.
 */
export interface AlmanacHandlerContext {
	/** The Almanac store instance */
	store: AlmanacStore;

	/** Calendar repository for CRUD operations */
	calendarRepo: CalendarRepository;

	/** Event repository for event operations */
	eventRepo: EventRepository;

	/** Calendar state gateway for persistence */
	gateway: CalendarStateGateway;

	/** Phenomenon repository for phenomenon operations */
	phenomenonRepo: PhenomenonRepository;

	/** Current travel ID (if in travel context) */
	travelId: string | null;

	// ==================== Helper Functions ====================

	/** Get calendar schema by ID */
	getCalendarSchema: (id: string) => CalendarSchema | undefined;

	/** Refresh all calendar data from repositories */
	refreshCalendarData: () => Promise<void>;

	/** Build calendar schema from create draft */
	buildCalendarSchemaFromDraft: (
		draft: CalendarCreateDraft
	) => Promise<{ schema: CalendarSchema | null; errors: string[] }>;

	/** Compute edit warnings for a draft */
	computeEditWarnings: (schema: CalendarSchema, draft: CalendarCreateDraft) => string[];

	/** Detect conflicts when updating a calendar */
	detectCalendarConflicts: (
		id: string,
		updates: Partial<CalendarSchema>
	) => Promise<string[]>;

	/** Collect travel IDs that use this calendar as default */
	collectTravelDefaultIds: (calendarId: string) => Promise<string[]>;

	/** Get calendar defaults repository */
	getCalendarDefaultsRepository: () => CalendarDefaultsRepository | null;

	/** Slugify a string value */
	slugify: (value: string) => string;

	/** Map calendar view mode to zoom level */
	mapCalendarViewModeToZoom: (mode: CalendarViewMode) => CalendarViewZoom | null;

	/** Collect agenda items for a timestamp and zoom */
	collectAgendaItems: (
		timestamp: CalendarTimestamp,
		zoom: CalendarViewZoom,
		events?: CalendarEvent[]
	) => CalendarEvent[];

	/** Persist almanac preferences */
	persistPreferences: (prefs: Partial<AlmanacPreferencesSnapshot>) => Promise<void>;

	/** Compute status summary for current state */
	computeStatusSummary: (state: AlmanacState) => AlmanacState["almanacUiState"]["statusSummary"];
}

// ============================================================================
// Extended Context Types
// ============================================================================

/**
 * Extended context for event handlers.
 */
export interface EventHandlerContext extends AlmanacHandlerContext {
	/** Current phenomenon definitions */
	phenomenaDefinitions: Phenomenon[];

	/** Generate unique event ID */
	generateEventId: () => string;

	/** Load event by ID */
	loadEventById: (eventId: string) => Promise<CalendarEvent | null>;

	/** Create draft from event */
	createDraftFromEvent: (event: CalendarEvent) => EventEditorDraft;

	/** Validate event draft */
	validateEventDraft: (draft: EventEditorDraft) => {
		errors: string[];
		event: CalendarEvent | null;
		schema: CalendarSchema | null;
	};

	/** Validate and preview draft */
	validateAndPreviewDraft: (draft: EventEditorDraft) => {
		errors: string[];
		preview: EventEditorPreviewItem[];
	};

	/** Compute event preview */
	computeEventPreview: (
		event: CalendarEvent,
		schema: CalendarSchema
	) => EventEditorPreviewItem[];

	/** Rebuild phenomena listing */
	rebuildPhenomenaListing: (
		selectedId: string | null,
		options: PhenomenaListingOptions
	) => void;

	/** Convert DTO to Phenomenon */
	toPhenomenon: (dto: PhenomenonDTO) => Phenomenon;
}

/**
 * Extended context for phenomenon handlers.
 */
export interface PhenomenonHandlerContext extends AlmanacHandlerContext {
	/** Current phenomenon definitions */
	phenomenaDefinitions: Phenomenon[];

	/** Update phenomenon definitions */
	setPhenomenaDefinitions: (definitions: Phenomenon[]) => void;

	/** Current phenomenon view models */
	phenomenaSource: PhenomenonViewModel[];

	/** Update phenomenon view models */
	setPhenomenaSource: (source: PhenomenonViewModel[]) => void;

	/** Build phenomenon detail for ID */
	buildPhenomenonDetailForId: (
		id: string,
		calendars: CalendarSchema[],
		timestamp: CalendarTimestamp | null
	) => PhenomenonDetailView | null;

	/** Build phenomenon view models */
	buildPhenomenonViewModels: (
		definitions: Phenomenon[],
		calendars: CalendarSchema[],
		activeId: string | null,
		timestamp: CalendarTimestamp | null
	) => PhenomenonViewModel[];

	/** Build phenomenon map markers */
	buildPhenomenonMapMarkers: (
		phenomena: PhenomenonViewModel[],
		calendars: CalendarSchema[]
	) => EventsMapMarker[];

	/** Apply phenomena filters */
	applyPhenomenaFilters: (filters: EventsFilterState) => PhenomenonViewModel[];

	/** Convert DTO to Phenomenon */
	toPhenomenon: (dto: PhenomenonDTO) => Phenomenon;

	/** Build phenomenon from editor draft */
	buildPhenomenonFromDraft: (
		draft: PhenomenonEditorDraft,
		existing: Phenomenon | null
	) => PhenomenonDTO;

	/** Create editor draft from phenomenon */
	createEditorDraftFromPhenomenon: (phenomenon: Phenomenon) => PhenomenonEditorDraft;

	/** Create default editor draft */
	createDefaultEditorDraft: (id: string | null) => PhenomenonEditorDraft;

	/** Rebuild phenomena listing */
	rebuildPhenomenaListing: (
		selectedId: string | null,
		options: PhenomenaListingOptions
	) => void;

	/** Get unique categories from phenomena */
	getUniqueCategories: (phenomena: PhenomenonViewModel[]) => string[];
}

/**
 * Extended context for time handlers.
 */
export interface TimeHandlerContext extends AlmanacHandlerContext {
	/** Current phenomenon definitions */
	phenomenaDefinitions: Phenomenon[];

	/** Update phenomenon definitions */
	setPhenomenaDefinitions: (definitions: Phenomenon[]) => void;

	/** Current phenomenon view models */
	phenomenaSource: PhenomenonViewModel[];

	/** Update phenomenon view models */
	setPhenomenaSource: (source: PhenomenonViewModel[]) => void;

	/** Cartographer gateway for notifications */
	cartographerGateway: CartographerHookGateway;

	/** Build phenomenon view models */
	buildPhenomenonViewModels: (
		definitions: Phenomenon[],
		calendars: CalendarSchema[],
		activeId: string | null,
		timestamp: CalendarTimestamp | null
	) => PhenomenonViewModel[];

	/** Build phenomenon detail for ID */
	buildPhenomenonDetailForId: (
		id: string,
		calendars: CalendarSchema[],
		timestamp: CalendarTimestamp | null
	) => PhenomenonDetailView | null;

	/** Build phenomenon map markers */
	buildPhenomenonMapMarkers: (
		phenomena: PhenomenonViewModel[],
		calendars: CalendarSchema[]
	) => EventsMapMarker[];

	/** Apply phenomena filters */
	applyPhenomenaFilters: (filters: EventsFilterState) => PhenomenonViewModel[];

	/** Convert DTO to Phenomenon */
	toPhenomenon: (dto: PhenomenonDTO) => Phenomenon;

	/** Get unique categories from phenomena */
	getUniqueCategories: (phenomena: PhenomenonViewModel[]) => string[];

	/** Persist travel leaf preferences */
	persistTravelLeafPreferences: (
		prefs: Partial<TravelLeafPreferencesSnapshot>
	) => Promise<void>;

	/** Clear jump preview */
	clearJumpPreview: () => void;
}

/**
 * Extended context for travel handlers.
 */
export interface TravelHandlerContext extends AlmanacHandlerContext {
	/** Current travel leaf preferences */
	travelLeafPreferences: TravelLeafPreferencesSnapshot | null;

	/** Update travel leaf preferences */
	setTravelLeafPreferences: (prefs: TravelLeafPreferencesSnapshot | null) => void;

	/** Persist travel leaf preferences */
	persistTravelLeafPreferences: (
		prefs: Partial<TravelLeafPreferencesSnapshot>
	) => Promise<void>;
}

// ============================================================================
// State Update Helper
// ============================================================================

/**
 * Helper type for state update functions.
 * Used to create immutable state updates.
 */
export type StateUpdater<T> = (state: T) => T;
