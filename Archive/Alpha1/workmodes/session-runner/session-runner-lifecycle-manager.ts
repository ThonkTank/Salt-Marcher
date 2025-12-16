// src/workmodes/session-runner/session-runner-lifecycle-manager.ts
// Shared lifecycle management for Session Runner and the Encounter Tracker
// Provides common initialization and cleanup patterns for subscriptions and event handlers

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-lifecycle");

/**
 * Lifecycle handle - cleanup function returned from initialization
 */
export type LifecycleHandle = () => void;

/**
 * Subscription configuration for shared lifecycle
 */
export interface SubscriptionConfig {
    /** Unique identifier for logging/debugging */
    readonly id: string;
    /** Subscription function that returns cleanup handle */
    readonly subscribe: () => LifecycleHandle | void;
}

/**
 * Event listener configuration for shared lifecycle
 */
export interface EventListenerConfig {
    /** Unique identifier for logging/debugging */
    readonly id: string;
    /** Target element to attach listener to */
    readonly target: EventTarget;
    /** Event type (e.g., "click", "hex:click") */
    readonly event: string;
    /** Event handler function */
    readonly handler: EventListener;
    /** Event listener options */
    readonly options?: boolean | AddEventListenerOptions;
}

/**
 * Lifecycle context for managing subscriptions and event listeners
 */
export interface LifecycleContext {
    /** Unique identifier for this lifecycle (for logging) */
    readonly name: string;
    /** Subscriptions to initialize */
    readonly subscriptions: readonly SubscriptionConfig[];
    /** Event listeners to register */
    readonly listeners: readonly EventListenerConfig[];
}

/**
 * Lifecycle handles returned from initialization
 */
export interface LifecycleHandles {
    /** All cleanup handles (subscriptions + listeners) */
    readonly handles: readonly LifecycleHandle[];
    /** Cleanup all subscriptions and listeners */
    readonly dispose: () => void;
}

/**
 * Initialize shared lifecycle (subscriptions + event listeners)
 *
 * @param ctx - Lifecycle configuration
 * @returns Cleanup handles for all subscriptions and listeners
 *
 * @example
 * ```ts
* const lifecycle = initializeSharedLifecycle({
*   name: "encounter-tracker",
 *   subscriptions: [
 *     {
 *       id: "presenter",
 *       subscribe: () => presenter.subscribe(handleStateChange)
 *     }
 *   ],
 *   listeners: [
 *     {
 *       id: "hex-click",
 *       target: stageEl,
 *       event: "hex:click",
 *       handler: handleHexClick
 *     }
 *   ]
 * });
 *
 * // Later cleanup:
 * lifecycle.dispose();
 * ```
 */
export function initializeSharedLifecycle(ctx: LifecycleContext): LifecycleHandles {
    const handles: LifecycleHandle[] = [];

    // Initialize subscriptions
    for (const sub of ctx.subscriptions) {
        try {
            const handle = sub.subscribe();
            if (handle) {
                handles.push(handle);
                logger.debug(`[${ctx.name}] Subscription registered: ${sub.id}`);
            }
        } catch (error) {
            logger.error(`[${ctx.name}] Failed to register subscription: ${sub.id}`, error);
        }
    }

    // Register event listeners
    for (const listener of ctx.listeners) {
        try {
            listener.target.addEventListener(listener.event, listener.handler, listener.options);

            // Create cleanup handle for this listener
            handles.push(() => {
                listener.target.removeEventListener(listener.event, listener.handler, listener.options);
            });

            logger.debug(`[${ctx.name}] Event listener registered: ${listener.id} (${listener.event})`);
        } catch (error) {
            logger.error(`[${ctx.name}] Failed to register event listener: ${listener.id}`, error);
        }
    }

    logger.info(`[${ctx.name}] Lifecycle initialized: ${ctx.subscriptions.length} subscriptions, ${ctx.listeners.length} listeners`);

    return {
        handles,
        dispose: () => disposeSharedLifecycle(ctx.name, handles),
    };
}

/**
 * Dispose all lifecycle handles (subscriptions + event listeners)
 *
 * @param name - Lifecycle name (for logging)
 * @param handles - Cleanup handles to execute
 *
 * @example
 * ```ts
 * // Direct usage (prefer lifecycle.dispose() from initializeSharedLifecycle)
 * disposeSharedLifecycle("encounter-tracker", handles);
 * ```
 */
export function disposeSharedLifecycle(name: string, handles: readonly LifecycleHandle[]): void {
    let disposed = 0;
    let failed = 0;

    for (const handle of handles) {
        try {
            handle();
            disposed++;
        } catch (error) {
            failed++;
            logger.error(`[${name}] Failed to dispose lifecycle handle`, error);
        }
    }

    logger.info(`[${name}] Lifecycle disposed: ${disposed} handles cleaned up, ${failed} failed`);
}

/**
 * Create AbortController with lifecycle integration
 * Useful for components that need signal-based cancellation
 *
 * @param name - Component name (for logging)
 * @returns AbortController with enhanced logging
 *
 * @example
 * ```ts
 * const controller = createAbortController("experience");
 * const signal = controller.signal;
 *
 * // Use signal for async operations
 * await fetchData({ signal });
 *
 * // Cleanup
 * controller.abort();
 * ```
 */
export function createAbortController(name: string): AbortController {
    const controller = new AbortController();

    // Log abort events for debugging
    controller.signal.addEventListener("abort", () => {
        logger.debug(`[${name}] AbortController aborted`);
    }, { once: true });

    return controller;
}
