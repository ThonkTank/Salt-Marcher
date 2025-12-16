/**
 * Session Schema
 *
 * Interfaces for Session Services and Panels.
 * All extension plugins must implement these interfaces.
 *
 * @module Shared/schemas/session
 */

import type { SessionEvent, SessionEventType } from './events';

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Event emitter function type.
 * Services use this to emit events to the EventBus.
 */
export type EventEmitter = <T>(type: SessionEventType, data: T) => void;

/**
 * Session service interface.
 * All services registered with the Session Runner must implement this.
 */
export interface ISessionService<TState = unknown> {
	/** Unique service identifier */
	readonly id: string;
	/** Human-readable service name */
	readonly name: string;

	/** Get current state (immutable) */
	getState(): Readonly<TState>;

	/** Subscribe to state changes */
	subscribe(callback: (state: TState) => void): () => void;

	/** Set the event emitter (called by ServiceRegistry) */
	setEventEmitter(emitter: EventEmitter): void;

	/** Handle incoming events from other services */
	handleEvent(event: SessionEvent): void;

	/** Initialize the service (async operations) */
	initialize(): Promise<void>;

	/** Clean up resources */
	destroy(): void;
}

// ============================================================================
// Panel Interface
// ============================================================================

/**
 * Context provided to panels for interacting with the Session Runner.
 */
export interface PanelContext {
	/** Get a registered service by ID */
	getService<T>(id: string): T | undefined;

	/** Subscribe to events */
	onEvent<T>(type: SessionEventType, handler: (data: T) => void): () => void;

	/** Emit an action to a service */
	emitAction(serviceId: string, action: string, payload?: unknown): void;
}

/**
 * Session panel interface.
 * All UI panels registered with the Session Runner must implement this.
 */
export interface ISessionPanel {
	/** Unique panel identifier */
	readonly id: string;
	/** Human-readable panel name */
	readonly name: string;
	/** Lucide icon name */
	readonly icon: string;

	/** Render the panel into the container */
	render(container: HTMLElement, context: PanelContext): void;

	/** Update the panel (called on state changes) */
	update(context: PanelContext): void;

	/** Handle panel resize */
	onResize(width: number, height: number): void;

	/** Clean up resources */
	destroy(): void;
}

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Panel position in the grid layout.
 */
export interface PanelPosition {
	row: number;
	col: number;
	rowSpan: number;
	colSpan: number;
}

/**
 * Configuration for a panel instance in the layout.
 */
export interface LayoutPanelConfig {
	/** Unique instance ID */
	instanceId: string;
	/** Panel type ID */
	panelId: string;
	/** Position in grid */
	position: PanelPosition;
}

/**
 * Complete layout configuration.
 */
export interface LayoutConfig {
	/** Layout ID */
	id: string;
	/** Layout name */
	name: string;
	/** Grid columns */
	columns: number;
	/** Grid rows */
	rows: number;
	/** Panel configurations */
	panels: LayoutPanelConfig[];
}
