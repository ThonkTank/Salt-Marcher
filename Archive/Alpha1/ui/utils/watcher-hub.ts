import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('ui-watcher-hub');
// src/ui/workmode/watcher-hub.ts
// Generic watcher hub for managing file system watchers across multiple consumers

/**
 * Factory function that creates a watcher and returns a cleanup function.
 * The onChange callback is called whenever the watched resource changes.
 */
export type WatchFactory = (onChange: () => void) => () => void;

interface WatchRegistryEntry {
    stop?: () => void;
    listeners: Set<() => void>;
}

/**
 * Generic watcher hub that manages file system watchers for multiple sources.
 * Prevents redundant watchers by allowing multiple consumers to share the same watch.
 *
 * @template K - The type of the watch key (e.g., source ID, file path, etc.)
 */
export class WatcherHub<K extends string = string> {
    private readonly registry = new Map<K, WatchRegistryEntry>();

    /**
     * Subscribe to changes for a specific source.
     *
     * @param key - The unique identifier for the watched resource
     * @param factory - Factory function that creates the watcher
     * @param listener - Callback to be invoked when changes occur
     * @returns Unsubscribe function
     */
    subscribe(key: K, factory: WatchFactory, listener: () => void): () => void {
        let entry = this.registry.get(key);

        if (!entry) {
            // Create new watch entry
            const listeners = new Set<() => void>();

            // Create the actual watcher
            const stop = factory(() => {
                // Notify all listeners when changes occur
                for (const cb of listeners) {
                    try {
                        cb();
                    } catch (err) {
                        logger.error(`Watcher listener failed for key ${key}:`, err);
                    }
                }
            });

            entry = { stop, listeners };
            this.registry.set(key, entry);
        }

        // Add listener to the set
        entry.listeners.add(listener);

        // Return unsubscribe function
        return () => {
            const current = this.registry.get(key);
            if (!current) return;

            // Remove listener
            current.listeners.delete(listener);

            // If no more listeners, clean up the watcher
            if (current.listeners.size === 0) {
                try {
                    current.stop?.();
                } catch (err) {
                    logger.error(`Failed to stop watcher for key ${key}:`, err);
                }
                this.registry.delete(key);
            }
        };
    }

    /**
     * Get the number of active watchers.
     */
    getActiveWatcherCount(): number {
        return this.registry.size;
    }

    /**
     * Get the number of listeners for a specific key.
     */
    getListenerCount(key: K): number {
        return this.registry.get(key)?.listeners.size ?? 0;
    }

    /**
     * Stop all watchers and clear all listeners.
     */
    destroy(): void {
        for (const [key, entry] of this.registry.entries()) {
            try {
                entry.stop?.();
            } catch (err) {
                logger.error(`Failed to stop watcher for key ${key}:`, err);
            }
        }
        this.registry.clear();
    }
}

/**
 * Create a new watcher hub instance.
 */
export function createWatcherHub<K extends string = string>(): WatcherHub<K> {
    return new WatcherHub<K>();
}
