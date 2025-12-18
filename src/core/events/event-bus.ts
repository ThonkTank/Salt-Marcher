/**
 * EventBus for cross-feature communication.
 * Publish/Subscribe pattern with typed events and correlation tracking.
 */

import type { DomainEvent } from './domain-events';
import { TimeoutError } from './timeout-error';

// ============================================================================
// Types
// ============================================================================

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => void;

export type Unsubscribe = () => void;

/**
 * Options for publishing events.
 */
export interface PublishOptions {
  /**
   * If true, the event will be stored and replayed to late subscribers.
   * Use for UI-context events (e.g., combat:started, encounter:generated).
   * @see EventBus.md#sticky-events
   */
  sticky?: boolean;
}

/**
 * Options for subscribing to events.
 */
export interface SubscribeOptions {
  /**
   * If true, the subscriber will immediately receive the last sticky event
   * of this type (if one exists). Use for late-joining Views.
   * @see EventBus.md#sticky-events
   */
  replay?: boolean;
}

// ============================================================================
// EventBus Interface
// ============================================================================

export interface EventBus {
  /**
   * Publish an event to all subscribers.
   * @param event The domain event to publish
   * @param options Optional publish options (e.g., { sticky: true })
   */
  publish<T>(event: DomainEvent<T>, options?: PublishOptions): void;

  /**
   * Subscribe to events of a specific type.
   * @param eventType The event type to listen for (e.g., 'travel:started')
   * @param handler The callback to invoke when event is published
   * @param options Optional subscribe options (e.g., { replay: true })
   * @returns Unsubscribe function
   */
  subscribe<T>(
    eventType: string,
    handler: EventHandler<T>,
    options?: SubscribeOptions
  ): Unsubscribe;

  /**
   * Subscribe to all events (for logging/debugging).
   * @param handler The callback to invoke for every event
   * @returns Unsubscribe function
   */
  subscribeAll(handler: EventHandler): Unsubscribe;

  /**
   * Get count of subscribers for a specific event type.
   * Useful for debugging.
   */
  subscriberCount(eventType: string): number;

  /**
   * Clear all subscriptions and sticky events.
   * Useful for testing and cleanup.
   */
  clear(): void;

  /**
   * Clear a sticky event from the cache.
   * Call this when a workflow completes (e.g., combat:completed clears combat:started).
   * @param eventType The event type to clear from sticky cache
   */
  clearSticky(eventType: string): void;

  /**
   * Request/Response pattern: Send a request event and wait for a response.
   * Matches response by correlationId.
   *
   * @param requestEvent The request event to publish
   * @param responseType The event type to wait for (e.g., 'encounter:generated')
   * @param timeoutMs Maximum time to wait (default: 5000ms)
   * @returns Promise that resolves with the response event
   * @throws TimeoutError if no matching response arrives within timeout
   *
   * @example
   * ```typescript
   * const response = await eventBus.request(
   *   createEvent('encounter:generate-requested', { terrainId, partyLevel }),
   *   'encounter:generated',
   *   5000
   * );
   * ```
   */
  request<TReq, TRes>(
    requestEvent: DomainEvent<TReq>,
    responseType: string,
    timeoutMs?: number
  ): Promise<DomainEvent<TRes>>;
}

// ============================================================================
// EventBus Implementation
// ============================================================================

/**
 * Create a new EventBus instance.
 */
export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<EventHandler>>();
  const globalHandlers = new Set<EventHandler>();
  const stickyEvents = new Map<string, DomainEvent>();

  return {
    publish<T>(event: DomainEvent<T>, options?: PublishOptions): void {
      // Store sticky event
      if (options?.sticky) {
        stickyEvents.set(event.type, event as DomainEvent);
      }

      // Notify global handlers first
      for (const handler of globalHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(
            `[EventBus] Global handler error for ${event.type}:`,
            error
          );
        }
      }

      // Notify type-specific handlers
      const typeHandlers = handlers.get(event.type);
      if (typeHandlers) {
        for (const handler of typeHandlers) {
          try {
            handler(event as DomainEvent);
          } catch (error) {
            console.error(
              `[EventBus] Handler error for ${event.type}:`,
              error
            );
          }
        }
      }
    },

    subscribe<T>(
      eventType: string,
      handler: EventHandler<T>,
      options?: SubscribeOptions
    ): Unsubscribe {
      if (!handlers.has(eventType)) {
        handlers.set(eventType, new Set());
      }
      const typeHandlers = handlers.get(eventType)!;
      typeHandlers.add(handler as EventHandler);

      // Replay sticky event to new subscriber if requested
      if (options?.replay) {
        const sticky = stickyEvents.get(eventType);
        if (sticky) {
          try {
            handler(sticky as DomainEvent<T>);
          } catch (error) {
            console.error(
              `[EventBus] Replay handler error for ${eventType}:`,
              error
            );
          }
        }
      }

      return () => {
        typeHandlers.delete(handler as EventHandler);
        if (typeHandlers.size === 0) {
          handlers.delete(eventType);
        }
      };
    },

    subscribeAll(handler: EventHandler): Unsubscribe {
      globalHandlers.add(handler);
      return () => {
        globalHandlers.delete(handler);
      };
    },

    subscriberCount(eventType: string): number {
      return handlers.get(eventType)?.size ?? 0;
    },

    clear(): void {
      handlers.clear();
      globalHandlers.clear();
      stickyEvents.clear();
    },

    clearSticky(eventType: string): void {
      stickyEvents.delete(eventType);
    },

    request<TReq, TRes>(
      requestEvent: DomainEvent<TReq>,
      responseType: string,
      timeoutMs: number = 5000
    ): Promise<DomainEvent<TRes>> {
      return new Promise((resolve, reject) => {
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let unsubscribe: Unsubscribe | undefined;

        const cleanup = () => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = undefined;
          }
          if (unsubscribe) {
            unsubscribe();
            unsubscribe = undefined;
          }
        };

        // Subscribe to response events
        unsubscribe = this.subscribe<TRes>(
          responseType,
          (event: DomainEvent<TRes>) => {
            // Only accept responses with matching correlationId
            if (event.correlationId === requestEvent.correlationId) {
              cleanup();
              resolve(event);
            }
          }
        );

        // Set up timeout
        timeoutHandle = setTimeout(() => {
          cleanup();
          reject(
            new TimeoutError(
              `Request ${requestEvent.type} timed out waiting for ${responseType}`,
              timeoutMs
            )
          );
        }, timeoutMs);

        // Publish the request event
        this.publish(requestEvent);
      });
    },
  };
}
