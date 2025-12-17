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

// ============================================================================
// EventBus Interface
// ============================================================================

export interface EventBus {
  /**
   * Publish an event to all subscribers.
   * @param event The domain event to publish
   */
  publish<T>(event: DomainEvent<T>): void;

  /**
   * Subscribe to events of a specific type.
   * @param eventType The event type to listen for (e.g., 'travel:started')
   * @param handler The callback to invoke when event is published
   * @returns Unsubscribe function
   */
  subscribe<T>(eventType: string, handler: EventHandler<T>): Unsubscribe;

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
   * Clear all subscriptions.
   * Useful for testing and cleanup.
   */
  clear(): void;

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

  return {
    publish<T>(event: DomainEvent<T>): void {
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

    subscribe<T>(eventType: string, handler: EventHandler<T>): Unsubscribe {
      if (!handlers.has(eventType)) {
        handlers.set(eventType, new Set());
      }
      const typeHandlers = handlers.get(eventType)!;
      typeHandlers.add(handler as EventHandler);

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
