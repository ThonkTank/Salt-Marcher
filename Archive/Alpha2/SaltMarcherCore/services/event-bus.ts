/**
 * Event Bus
 *
 * Central event bus for inter-service communication.
 * Services communicate ONLY through events - never direct imports.
 *
 * @module SaltMarcherCore/session/event-bus
 */

import type { SessionEvent, SessionEventType } from '../../Shared/schemas/events';

type EventHandler<T = unknown> = (event: SessionEvent<T>) => void;

/**
 * Central event bus for Session Runner.
 * Handles pub/sub between services without direct coupling.
 */
export class EventBus {
	private handlers = new Map<SessionEventType, Set<EventHandler<unknown>>>();
	private history: SessionEvent[] = [];
	private maxHistorySize = 100;

	/**
	 * Subscribe to events of a specific type.
	 * @returns Unsubscribe function
	 */
	on<T>(type: SessionEventType, handler: EventHandler<T>): () => void {
		if (!this.handlers.has(type)) {
			this.handlers.set(type, new Set());
		}
		this.handlers.get(type)!.add(handler as EventHandler<unknown>);
		return () => this.handlers.get(type)?.delete(handler as EventHandler<unknown>);
	}

	/**
	 * Subscribe to an event once (auto-unsubscribes after first event).
	 * @returns Unsubscribe function
	 */
	once<T>(type: SessionEventType, handler: EventHandler<T>): () => void {
		const wrappedHandler: EventHandler<T> = (event) => {
			unsubscribe();
			handler(event);
		};
		const unsubscribe = this.on(type, wrappedHandler);
		return unsubscribe;
	}

	/**
	 * Emit an event to all subscribers.
	 */
	emit<T>(type: SessionEventType, source: string, data: T): void {
		const event: SessionEvent<T> = {
			type,
			source,
			timestamp: Date.now(),
			data,
		};

		// Store in history
		this.history.push(event);
		if (this.history.length > this.maxHistorySize) {
			this.history.shift();
		}

		// Notify handlers
		const typeHandlers = this.handlers.get(type);
		if (typeHandlers) {
			for (const handler of typeHandlers) {
				try {
					handler(event);
				} catch (error) {
					console.error(`[EventBus] Handler error for ${type}:`, error);
				}
			}
		}
	}

	/**
	 * Get event history, optionally filtered by type.
	 */
	getHistory(type?: SessionEventType): SessionEvent[] {
		if (type) {
			return this.history.filter((e) => e.type === type);
		}
		return [...this.history];
	}

	/**
	 * Clear all handlers and history.
	 */
	clear(): void {
		this.handlers.clear();
		this.history = [];
	}
}
