/**
 * LifecycleManager - Centralized cleanup management for plugin components
 *
 * Purpose: Prevent memory leaks by tracking and coordinating cleanup of:
 * - Store subscriptions
 * - Event listeners
 * - Timers and intervals
 * - Async operations (AbortController)
 *
 * Usage:
 * ```typescript
 * const lifecycle = new LifecycleManager();
 *
 * // Track a subscription cleanup
 * const unsubscribe = store.subscribe(...);
 * lifecycle.add(unsubscribe);
 *
 * // Track a timer
 * const timer = setTimeout(...);
 * lifecycle.addTimer(timer);
 *
 * // Track async operations
 * const controller = new AbortController();
 * lifecycle.addAbortController(controller);
 *
 * // When done, clean everything up
 * lifecycle.cleanup();
 * ```
 */
export class LifecycleManager {
    private unsubscribers: Set<() => void> = new Set();
    private timers: Set<NodeJS.Timeout> = new Set();
    private intervals: Set<NodeJS.Timeout> = new Set();
    private abortControllers: Set<AbortController> = new Set();
    private eventListeners: Array<{
        target: EventTarget;
        event: string;
        handler: EventListener;
    }> = [];

    /**
     * Register a cleanup function to be called during cleanup()
     * @returns The same cleanup function for immediate use if needed
     */
    add(cleanup: () => void): () => void {
        if (cleanup) {
            this.unsubscribers.add(cleanup);
        }
        return cleanup;
    }

    /**
     * Register a timeout to be cleared during cleanup()
     */
    addTimer(timer: NodeJS.Timeout): void {
        if (timer) {
            this.timers.add(timer);
        }
    }

    /**
     * Register an interval to be cleared during cleanup()
     */
    addInterval(interval: NodeJS.Timeout): void {
        if (interval) {
            this.intervals.add(interval);
        }
    }

    /**
     * Register an AbortController to be aborted during cleanup()
     * @returns The same controller for immediate use
     */
    addAbortController(controller: AbortController): AbortController {
        if (controller) {
            this.abortControllers.add(controller);
        }
        return controller;
    }

    /**
     * Register an event listener for automatic removal during cleanup()
     */
    addEventListener(
        target: EventTarget,
        event: string,
        handler: EventListener
    ): void {
        target.addEventListener(event, handler);
        this.eventListeners.push({ target, event, handler });
    }

    /**
     * Execute all registered cleanup functions
     * Clears all tracking sets after cleanup
     */
    cleanup(): void {
        // Abort all async operations first (highest priority)
        this.abortControllers.forEach(controller => {
            try {
                controller.abort();
            } catch (err) {
                // Silently ignore errors from abort
            }
        });

        // Clear all timers and intervals
        this.timers.forEach(timer => {
            try {
                clearTimeout(timer);
            } catch (err) {
                // Silently ignore errors from clearTimeout
            }
        });

        this.intervals.forEach(interval => {
            try {
                clearInterval(interval);
            } catch (err) {
                // Silently ignore errors from clearInterval
            }
        });

        // Remove all event listeners
        this.eventListeners.forEach(({ target, event, handler }) => {
            try {
                target.removeEventListener(event, handler);
            } catch (err) {
                // Silently ignore errors from removeEventListener
            }
        });

        // Call all cleanup functions in reverse order (LIFO)
        // This ensures dependencies are cleaned up in correct order
        const cleanupArray = Array.from(this.unsubscribers);
        for (let i = cleanupArray.length - 1; i >= 0; i--) {
            try {
                cleanupArray[i]();
            } catch (err) {
                // Silently ignore errors from cleanup functions
                // They should handle their own errors
            }
        }

        // Clear all tracking sets
        this.clear();
    }

    /**
     * Check if manager has been cleaned up
     */
    isCleanedUp(): boolean {
        return (
            this.unsubscribers.size === 0 &&
            this.timers.size === 0 &&
            this.intervals.size === 0 &&
            this.abortControllers.size === 0 &&
            this.eventListeners.length === 0
        );
    }

    /**
     * Clear all tracking sets without executing cleanup
     * Used internally after cleanup() completes
     */
    private clear(): void {
        this.unsubscribers.clear();
        this.timers.clear();
        this.intervals.clear();
        this.abortControllers.clear();
        this.eventListeners = [];
    }
}
