/**
 * Almanac Unified Store
 *
 * Single source of truth for all Almanac state.
 * Follows the Cartographer pattern for consistency across workmodes.
 *
 * Benefits:
 * - All state in one place - easy to debug and serialize
 * - Derived state via selectors - no stale computed values
 * - Reactive updates via subscriptions
 * - Clear state transitions through update()
 *
 * @module workmodes/almanac/store
 */

import { writable, type WritableStore } from "@services/state/writable-store";
import { configurableLogger } from "@services/logging/configurable-logger";
import type { AlmanacState } from "../mode/contracts";
import { createInitialAlmanacState } from "../mode/contracts";
import type { CalendarSchema, CalendarTimestamp, PhenomenonOccurrence } from "../helpers";

const logger = configurableLogger.forModule("almanac-store");

// ============================================================================
// Initial State
// ============================================================================

/**
 * Default initial state for a fresh Almanac session
 */
export const INITIAL_STATE: AlmanacState = createInitialAlmanacState();

// ============================================================================
// Store Creation
// ============================================================================

/**
 * AlmanacStore interface extending WritableStore with convenience methods
 */
export interface AlmanacStore extends WritableStore<AlmanacState> {
	/** Reset to initial state */
	reset(): void;

	/** Partial update (merges with current state) */
	patch(partial: Partial<AlmanacState>): void;
}

/**
 * Create a new Almanac store instance
 */
export function createAlmanacStore(initialState?: Partial<AlmanacState>): AlmanacStore {
	const store = writable<AlmanacState>(
		{ ...INITIAL_STATE, ...initialState },
		{ debug: false, name: "almanac-store" }
	);

	return {
		...store,

		reset(): void {
			logger.debug("Store reset to initial state");
			store.set(INITIAL_STATE);
		},

		patch(partial: Partial<AlmanacState>): void {
			store.update((state) => ({ ...state, ...partial }));
		},
	};
}

// ============================================================================
// Selectors (Derived State)
// ============================================================================

/**
 * Selector functions for deriving state
 * Use these instead of accessing state properties directly for computed values
 */
export const selectors = {
	/** Is there an active calendar? */
	hasActiveCalendar: (state: AlmanacState): boolean =>
		state.calendarState.activeCalendarId !== null &&
		state.calendarState.calendars.some((cal) => cal.id === state.calendarState.activeCalendarId),

	/** Get the active calendar (if any) */
	activeCalendar: (state: AlmanacState): CalendarSchema | undefined =>
		state.calendarState.calendars.find((cal) => cal.id === state.calendarState.activeCalendarId),

	/** Get the current timestamp */
	currentTimestamp: (state: AlmanacState): CalendarTimestamp | null => state.calendarState.currentTimestamp,

	/** Is any slice currently loading? */
	isLoading: (state: AlmanacState): boolean =>
		state.almanacUiState.isLoading ||
		state.calendarViewState.isLoading ||
		state.managerUiState.isLoading ||
		state.eventsUiState.isLoading ||
		state.travelLeafState.isLoading,

	/** Does any slice have an error? */
	hasError: (state: AlmanacState): boolean =>
		!!state.almanacUiState.error ||
		!!state.calendarViewState.error ||
		!!state.managerUiState.error ||
		!!state.eventsUiState.error ||
		!!state.travelLeafState.error,

	/** Get visible phenomena based on current filters */
	visiblePhenomena: (state: AlmanacState): ReadonlyArray<PhenomenonOccurrence> => {
		const { filters } = state.eventsUiState;
		const phenomena = state.calendarState.upcomingPhenomena;

		// No filters = show all
		if (filters.categories.length === 0 && filters.calendarIds.length === 0) {
			return phenomena;
		}

		return phenomena.filter((phenomenon) => {
			// Filter by category if specified
			if (filters.categories.length > 0) {
				const phenomenonCategory = phenomenon.category || "";
				if (!filters.categories.includes(phenomenonCategory)) {
					return false;
				}
			}

			// Filter by calendar if specified
			if (filters.calendarIds.length > 0) {
				const phenomenonCalendarId = phenomenon.calendarId || "";
				if (!filters.calendarIds.includes(phenomenonCalendarId)) {
					return false;
				}
			}

			return true;
		});
	},

	/** Get default calendar (if any) */
	defaultCalendar: (state: AlmanacState): CalendarSchema | undefined =>
		state.calendarState.calendars.find((cal) => cal.id === state.calendarState.defaultCalendarId),

	/** Get travel default calendar (if any) */
	travelDefaultCalendar: (state: AlmanacState): CalendarSchema | undefined =>
		state.calendarState.calendars.find((cal) => cal.id === state.calendarState.travelDefaultCalendarId),

	/** Is currently persisting data? */
	isPersisting: (state: AlmanacState): boolean => state.calendarState.isPersisting,

	/** Get filter count for Events view */
	eventsFilterCount: (state: AlmanacState): number => {
		const { filters } = state.eventsUiState;
		return filters.categories.length + filters.calendarIds.length;
	},

	/** Is the drawer open? */
	isDrawerOpen: (state: AlmanacState): boolean => state.almanacUiState.drawerOpen,

	/** Get current almanac mode */
	currentMode: (state: AlmanacState) => state.almanacUiState.mode,

	/** Get calendar view mode */
	calendarViewMode: (state: AlmanacState) => state.calendarViewState.mode,

	/** Is travel leaf visible? */
	isTravelLeafVisible: (state: AlmanacState): boolean => state.travelLeafState.visible,
};

// ============================================================================
// Action Helpers
// ============================================================================

/**
 * Helper functions for common state transitions
 * These return partial state objects for use with store.patch()
 */
export const actions = {
	/** Set loading state for a specific scope */
	startLoading: (
		scope: "almanac" | "manager" | "events" | "travel" | "calendarView"
	): Partial<AlmanacState> => {
		const partial: Partial<AlmanacState> = {};

		switch (scope) {
			case "almanac":
				partial.almanacUiState = {
					...INITIAL_STATE.almanacUiState,
					isLoading: true,
				};
				break;
			case "manager":
				partial.managerUiState = {
					...INITIAL_STATE.managerUiState,
					isLoading: true,
				};
				break;
			case "events":
				partial.eventsUiState = {
					...INITIAL_STATE.eventsUiState,
					isLoading: true,
				};
				break;
			case "travel":
				partial.travelLeafState = {
					...INITIAL_STATE.travelLeafState,
					isLoading: true,
				};
				break;
			case "calendarView":
				partial.calendarViewState = {
					...INITIAL_STATE.calendarViewState,
					isLoading: true,
				};
				break;
		}

		return partial;
	},

	/** Clear loading state for a specific scope */
	stopLoading: (
		scope: "almanac" | "manager" | "events" | "travel" | "calendarView"
	): Partial<AlmanacState> => {
		const partial: Partial<AlmanacState> = {};

		switch (scope) {
			case "almanac":
				partial.almanacUiState = {
					...INITIAL_STATE.almanacUiState,
					isLoading: false,
					error: undefined,
				};
				break;
			case "manager":
				partial.managerUiState = {
					...INITIAL_STATE.managerUiState,
					isLoading: false,
					error: undefined,
				};
				break;
			case "events":
				partial.eventsUiState = {
					...INITIAL_STATE.eventsUiState,
					isLoading: false,
					error: undefined,
				};
				break;
			case "travel":
				partial.travelLeafState = {
					...INITIAL_STATE.travelLeafState,
					isLoading: false,
					error: undefined,
				};
				break;
			case "calendarView":
				partial.calendarViewState = {
					...INITIAL_STATE.calendarViewState,
					isLoading: false,
					error: undefined,
				};
				break;
		}

		return partial;
	},

	/** Set error state for a specific scope */
	setError: (scope: "almanac" | "manager" | "events" | "travel" | "calendarView", message: string) => {
		return (state: AlmanacState): AlmanacState => {
			const newState = { ...state };

			switch (scope) {
				case "almanac":
					newState.almanacUiState = {
						...state.almanacUiState,
						isLoading: false,
						error: message,
					};
					break;
				case "manager":
					newState.managerUiState = {
						...state.managerUiState,
						isLoading: false,
						error: message,
					};
					break;
				case "events":
					newState.eventsUiState = {
						...state.eventsUiState,
						isLoading: false,
						error: message,
					};
					break;
				case "travel":
					newState.travelLeafState = {
						...state.travelLeafState,
						isLoading: false,
						error: message,
					};
					break;
				case "calendarView":
					newState.calendarViewState = {
						...state.calendarViewState,
						isLoading: false,
						error: message,
					};
					break;
			}

			return newState;
		};
	},

	/** Clear error state for a specific scope */
	clearError: (scope: "almanac" | "manager" | "events" | "travel" | "calendarView") => {
		return (state: AlmanacState): AlmanacState => {
			const newState = { ...state };

			switch (scope) {
				case "almanac":
					newState.almanacUiState = {
						...state.almanacUiState,
						error: undefined,
					};
					break;
				case "manager":
					newState.managerUiState = {
						...state.managerUiState,
						error: undefined,
					};
					break;
				case "events":
					newState.eventsUiState = {
						...state.eventsUiState,
						error: undefined,
					};
					break;
				case "travel":
					newState.travelLeafState = {
						...state.travelLeafState,
						error: undefined,
					};
					break;
				case "calendarView":
					newState.calendarViewState = {
						...state.calendarViewState,
						error: undefined,
					};
					break;
			}

			return newState;
		};
	},

	/** Update almanac mode */
	modeChanged: (mode: AlmanacState["almanacUiState"]["mode"]) => {
		return (state: AlmanacState): AlmanacState => {
			const modeHistory = [...state.almanacUiState.modeHistory, mode];
			return {
				...state,
				almanacUiState: {
					...state.almanacUiState,
					mode,
					modeHistory,
				},
			};
		};
	},

	/** Update calendar view mode */
	calendarViewModeChanged: (mode: AlmanacState["calendarViewState"]["mode"]) => {
		return (state: AlmanacState): AlmanacState => ({
			...state,
			calendarViewState: {
				...state.calendarViewState,
				mode,
			},
		});
	},

	/** Update events view mode */
	eventsViewModeChanged: (viewMode: AlmanacState["eventsUiState"]["viewMode"]) => {
		return (state: AlmanacState): AlmanacState => ({
			...state,
			eventsUiState: {
				...state.eventsUiState,
				viewMode,
			},
		});
	},

	/** Toggle drawer open/closed */
	toggleDrawer: () => {
		return (state: AlmanacState): AlmanacState => ({
			...state,
			almanacUiState: {
				...state.almanacUiState,
				drawerOpen: !state.almanacUiState.drawerOpen,
			},
		});
	},

	/** Set active calendar */
	setActiveCalendar: (calendarId: string | null) => {
		return (state: AlmanacState): AlmanacState => ({
			...state,
			calendarState: {
				...state.calendarState,
				activeCalendarId: calendarId,
			},
		});
	},

	/** Set current timestamp */
	setCurrentTimestamp: (timestamp: CalendarTimestamp | null) => {
		return (state: AlmanacState): AlmanacState => ({
			...state,
			calendarState: {
				...state.calendarState,
				currentTimestamp: timestamp,
			},
		});
	},
};
