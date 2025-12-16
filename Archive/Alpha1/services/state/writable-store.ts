// src/services/state/writable-store.ts
// Basic writable store implementation following the defined interfaces
// Provides pub/sub pattern with synchronous value access

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('state-writable-store');
import type {
    WritableStore,
    Subscriber,
    Unsubscriber,
    Updater,
    StoreOptions,
    StoreEventPayload,
    StoreEvent,
} from "./store.interface";

/**
 * Creates a writable store with the given initial value
 * @param initialValue Initial store value
 * @param options Optional store configuration
 * @returns WritableStore instance
 */
export function writable<T>(initialValue: T, options?: StoreOptions): WritableStore<T> {
    const { debug = false, name = "unnamed-store" } = options || {};

    let value: T = initialValue;
    const subscribers = new Set<Subscriber<T>>();

    const log = (event: StoreEvent, payload?: Partial<StoreEventPayload<T>>) => {
        if (!debug) return;
        logger.info(`${event}`, {
            ...payload,
            storeName: name,
            event,
            timestamp: new Date().toISOString(),
        });
    };

    const notifySubscribers = (previousValue?: T) => {
        log("value_changed", { value, previousValue });
        subscribers.forEach((subscriber) => {
            try {
                subscriber(value);
            } catch (error) {
                logger.error(`Subscriber error:`, error);
            }
        });
    };

    const subscribe = (subscriber: Subscriber<T>): Unsubscriber => {
        subscribers.add(subscriber);
        log("subscribed", { metadata: { subscriberCount: subscribers.size } });

        // Call subscriber immediately with current value
        try {
            subscriber(value);
        } catch (error) {
            logger.error(`Initial subscriber call error:`, error);
        }

        // Return unsubscriber function
        return () => {
            subscribers.delete(subscriber);
            log("unsubscribed", { metadata: { subscriberCount: subscribers.size } });
        };
    };

    const get = (): T => {
        return value;
    };

    const set = (newValue: T): void => {
        if (value === newValue) return; // Skip if value hasn't changed
        const previousValue = value;
        value = newValue;
        notifySubscribers(previousValue);
    };

    const update = (updater: Updater<T>): void => {
        const newValue = updater(value);
        set(newValue);
    };

    log("initialized", { value: initialValue });

    return {
        subscribe,
        get,
        set,
        update,
    };
}

/**
 * Creates a derived store that computes its value from one or more other stores
 * @param stores Array of stores to derive from
 * @param deriveFn Function that computes derived value from store values
 * @param initialValue Optional initial value before first derivation
 * @returns Readable store with derived value
 */
export function derived<S extends ReadonlyArray<any>, T>(
    stores: S,
    deriveFn: (...values: {
        [K in keyof S]: S[K] extends { get(): infer U } ? U : never
    }) => T,
    initialValue?: T
): ReadableStore<T> {
    type StoreValues = {
        [K in keyof S]: S[K] extends { get(): infer U } ? U : never
    };

    let value: T = initialValue as T;
    const subscribers = new Set<Subscriber<T>>();
    let unsubscribers: Unsubscriber[] = [];
    let isSubscribed = false;

    const updateValue = () => {
        const storeValues = stores.map(store => store.get()) as StoreValues;
        const newValue = deriveFn(...storeValues);

        if (value !== newValue) {
            value = newValue;
            subscribers.forEach(subscriber => {
                try {
                    subscriber(value);
                } catch (error) {
                    logger.error("Subscriber error:", error);
                }
            });
        }
    };

    const startSubscriptions = () => {
        if (isSubscribed) return;
        isSubscribed = true;

        // Subscribe to all source stores
        unsubscribers = stores.map(store =>
            store.subscribe(() => updateValue())
        );

        // Initial update
        updateValue();
    };

    const stopSubscriptions = () => {
        if (!isSubscribed) return;
        isSubscribed = false;

        unsubscribers.forEach(unsub => unsub());
        unsubscribers = [];
    };

    const subscribe = (subscriber: Subscriber<T>): Unsubscriber => {
        subscribers.add(subscriber);

        if (subscribers.size === 1) {
            startSubscriptions();
        }

        // Call subscriber with current value
        try {
            subscriber(value);
        } catch (error) {
            logger.error("Initial subscriber call error:", error);
        }

        return () => {
            subscribers.delete(subscriber);
            if (subscribers.size === 0) {
                stopSubscriptions();
            }
        };
    };

    const get = (): T => {
        if (!isSubscribed && stores.length > 0) {
            // If not subscribed, compute current value on demand
            const storeValues = stores.map(store => store.get()) as StoreValues;
            return deriveFn(...storeValues);
        }
        return value;
    };

    return {
        subscribe,
        get,
    };
}

// Re-export interface for convenience
export type { ReadableStore, WritableStore } from "./store.interface";