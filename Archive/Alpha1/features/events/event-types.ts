/**
 * Public type definitions for Events feature
 */

// Re-export calendar types from global types
export type { CalendarEvent, CalendarTimestamp, PhenomenonOccurrence } from '@services/domain/calendar';

// Re-export event history types
export type {
	TriggeredEventEntry,
	TriggeredPhenomenonEntry,
	TimelineEntry,
	InboxItem,
	TimelineFilter,
	TimelineSortField,
	TimelineSortOrder,
	TimelineSortOptions,
} from './event-history-types';

// Re-export type guards
export { isTriggeredEvent, isTriggeredPhenomenon } from './event-history-types';

// Re-export helper functions
export {
	createTriggeredEventEntry,
	createTriggeredPhenomenonEntry,
	createInboxItem,
} from './event-history-types';

// ============================================================================
// HOOK DISPATCH TYPES
// ============================================================================
// HookDispatch interfaces extracted from almanac workmode to eliminate layer violations
//
// These interfaces define the contract for dispatching hooks when calendar events
// or phenomena are triggered. Originally defined in calendar-state-gateway.ts,
// they are now shared types to allow features layer to import them without
// violating layer architecture (features cannot import from workmodes).

/**
 * Context for hook dispatch operations
 *
 * Provides metadata about the circumstances under which hooks are being dispatched,
 * allowing handlers to differentiate between global time advances vs travel-specific
 * events, and between manual jumps vs automatic progression.
 */
export interface HookDispatchContext {
	/** Scope of the time change: global calendar or travel-specific */
	readonly scope: "global" | "travel";
	/** Travel ID if scope is "travel", otherwise null */
	readonly travelId?: string | null;
	/** Reason for hook dispatch: time advance or manual jump */
	readonly reason: "advance" | "jump";
}

/**
 * Gateway interface for dispatching calendar event hooks
 *
 * Implemented by ExecutingHookGateway in features/events layer.
 * Used by CalendarStateGateway in almanac workmode to trigger hooks
 * when calendar time advances or events occur.
 */
export interface HookDispatchGateway {
	/**
	 * Dispatch hooks for triggered events and phenomena
	 *
	 * @param events - Calendar events that were triggered
	 * @param phenomena - Phenomenon occurrences that were triggered
	 * @param context - Context about the dispatch (scope, reason, etc.)
	 */
	dispatchHooks(
		events: ReadonlyArray<CalendarEvent>,
		phenomena: ReadonlyArray<PhenomenonOccurrence>,
		context: HookDispatchContext,
	): Promise<void>;
}
