/**
 * Almanac Handlers Module
 *
 * Exports all handler functions for the Almanac state machine.
 * Each handler is a pure function that receives context and updates state.
 *
 * @module workmodes/almanac/handlers
 */

// Types
export type {
	AlmanacHandlerContext,
	EventHandlerContext,
	PhenomenonHandlerContext,
	TimeHandlerContext,
	TravelHandlerContext,
	PhenomenonViewModel,
	PhenomenaListingOptions,
	StateUpdater,
} from './calendar-types';

// Calendar Handlers
export {
	handleCalendarCreate,
	handleCalendarEditRequested,
	handleCalendarEditCancelled,
	handleCalendarEditFormUpdated,
	handleCalendarUpdate,
	handleCalendarDeleteRequested,
	handleCalendarDeleteCancelled,
	handleCalendarDeleteConfirmed,
	handleCalendarSelect,
	handleCalendarDefault,
	handleConflictDismissed,
	handleCreateFormUpdated,
	handleManagerSelectionChanged,
	handleManagerNavigation,
} from "./calendar-handlers";

// Event Handlers
export {
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
} from "./event-handlers";

// Phenomenon Handlers
export {
	handleEventsViewMode,
	handleEventsFilterChange,
	handlePhenomenonSelected,
	handlePhenomenonDetailClosed,
	handleEventsBulkSelection,
	handlePhenomenonEditRequest,
	handlePhenomenonEditCancelled,
	handlePhenomenonSave,
} from "./phenomenon-handlers";

// Time Handlers
export {
	handleTimeAdvance,
	handleTimeJump,
	handleTimeJumpPreview,
} from "./time-handlers";

// Travel Handlers
export {
	handleTravelLeafMounted,
	handleTravelModeChanged,
} from "./travel-handlers";
