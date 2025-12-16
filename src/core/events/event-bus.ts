/**
 * EventBus for cross-feature communication.
 * Publish/Subscribe pattern with typed events and correlation tracking.
 */

import type { DomainEvent } from './domain-events';

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
  };
}
