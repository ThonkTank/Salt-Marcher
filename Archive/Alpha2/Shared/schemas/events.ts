/**
 * Session Events Schema
 *
 * Defines event types for inter-service communication via EventBus.
 * Services communicate ONLY through events - never direct imports.
 *
 * @module Shared/schemas/events
 */

// ============================================================================
// Event Types
// ============================================================================

/**
 * Built-in session event types.
 * Use `custom:${string}` for plugin-specific events.
 */
export type SessionEventType =
	// Time events
	| 'time:advanced'
	| 'time:changed'
	// Weather events
	| 'weather:updated'
	| 'weather:rerolled'
	// Encounter events
	| 'encounter:triggered'
	| 'encounter:dismissed'
	// Party events
	| 'party:memberAdded'
	| 'party:memberRemoved'
	// Custom events (extensible)
	| `custom:${string}`;

// ============================================================================
// Event Interface
// ============================================================================

/**
 * Session event structure.
 * All inter-service communication uses this format.
 */
export interface SessionEvent<T = unknown> {
	/** Event type identifier */
	type: SessionEventType;
	/** Source service ID that emitted the event */
	source: string;
	/** Unix timestamp when event was created */
	timestamp: number;
	/** Event payload data */
	data: T;
}
