/**
 * Orchestration Service
 *
 * Provides cross-workmode communication and data access without direct coupling.
 * This service layer allows workmodes to interact with each other indirectly,
 * maintaining proper architectural boundaries.
 *
 * @module services/orchestration
 */

// ============================================================================
// Types
// ============================================================================

export type { TimeUnit } from "./orchestration-types";

// ============================================================================
// Calendar Orchestration
// ============================================================================

export {
	createAlmanacGateway,
	getCurrentTimestamp,
	getActiveCalendarId,
	compareTimestampsWithSchema,
	formatTimestamp,
	timestampToAbsoluteDay,
	createMinuteTimestamp,
	createDayTimestamp,
} from "./calendar-orchestrator";

export type {
	CalendarStateGateway,
	CalendarStateSnapshot,
	AdvanceTimeResult,
	TravelLeafPreferencesSnapshot,
} from "./calendar-orchestrator";

// ============================================================================
// Library Data Access
// ============================================================================

export {
	LIBRARY_DATA_SOURCES,
} from "./library-orchestrator";

export type {
	FilterableLibraryMode,
	LibraryEntry,
	LibraryDataSourceMap,
} from "./library-orchestrator";

// ============================================================================
// Cartographer Service (Cross-Workmode Bridge)
// ============================================================================

export {
	getCartographerBridge,
	getCartographerHookGateway,
	registerCartographerBridgeProvider,
	registerCartographerHookGateway,
	isCartographerServiceAvailable,
	resetCartographerService,
} from "./cartographer-service";

export type {
	CartographerBridgeHandle,
	CartographerHookGateway,
	TravelPanelSnapshot,
} from "./cartographer-service";
