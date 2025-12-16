/**
 * Base Service
 *
 * Abstract base class for stateful services with subscription pattern.
 * Eliminates duplicate subscribe/notify implementations across services.
 *
 * @module Shared/base-service
 */

import type { ServiceCallback } from './schemas/common';

/**
 * Abstract base class for services with state management and subscriptions.
 *
 * Services can use the protected `state` field and `updateAndNotify()` helper
 * for simple state updates, or override `getState()` for computed state.
 *
 * @example
 * class MyService extends BaseService<MyState> {
 *     constructor() {
 *         super();
 *         this.state = { count: 0 };
 *     }
 *
 *     increment(): void {
 *         this.updateAndNotify(s => ({ ...s, count: s.count + 1 }));
 *     }
 * }
 */
export abstract class BaseService<T> {
	protected subscribers = new Set<ServiceCallback<T>>();

	/**
	 * Internal state. Subclasses should initialize in constructor.
	 * Use updateAndNotify() for state changes, or set directly and call notify().
	 */
	protected state!: T;

	/**
	 * Returns the current state.
	 * Default implementation returns a shallow copy.
	 * Override for computed state or deep copying.
	 */
	getState(): T {
		return { ...this.state };
	}

	/**
	 * Subscribe to state changes.
	 * Callback is invoked immediately with current state, then on each change.
	 * @returns Unsubscribe function
	 */
	subscribe(callback: ServiceCallback<T>): () => void {
		this.subscribers.add(callback);
		callback(this.getState());
		return () => this.subscribers.delete(callback);
	}

	/**
	 * Notify all subscribers of state change.
	 * Call this after modifying internal state.
	 */
	protected notify(): void {
		const state = this.getState();
		for (const callback of this.subscribers) {
			callback(state);
		}
	}

	/**
	 * Update state using an updater function and notify subscribers.
	 * Combines state update + notify into a single call.
	 *
	 * @example
	 * this.updateAndNotify(s => ({ ...s, count: s.count + 1 }));
	 */
	protected updateAndNotify(updater: (current: T) => T): void {
		this.state = updater(this.state);
		this.notify();
	}

	/**
	 * Set a single state field and notify subscribers.
	 * Convenience method for common single-field updates.
	 *
	 * @example
	 * this.setField('count', this.state.count + 1);
	 */
	protected setField<K extends keyof T>(key: K, value: T[K]): void {
		this.state = { ...this.state, [key]: value };
		this.notify();
	}

	/**
	 * Cleanup when service is destroyed.
	 * Clears all subscribers. Override to add additional cleanup
	 * (animations, DOM refs, timers) - call super.destroy().
	 *
	 * @example
	 * destroy(): void {
	 *     clearInterval(this.timer);
	 *     super.destroy();
	 * }
	 */
	destroy(): void {
		this.subscribers.clear();
	}
}
