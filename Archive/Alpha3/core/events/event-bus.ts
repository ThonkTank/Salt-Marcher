/**
 * Event Bus für Inter-Domain Kommunikation
 *
 * Features:
 * - Synchrones publish (Handler können intern async sein)
 * - Type-safe Event-Definitionen mit vollständiger Payload-Inferenz
 */

import type { Timestamp } from '../types/common';
import { now } from '../types/common';
import type { EventTypeMap, KnownEventType } from './domain-events';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/**
 * Basis-Interface für alle Domain Events
 */
export interface DomainEvent<T extends string = string, P = unknown> {
  /** Event-Typ, z.B. "time:changed" */
  type: T;
  /** Event-Payload */
  payload: P;
  /** Zeitstempel der Event-Erstellung */
  timestamp: Timestamp;
  /** Quelle-Domain, z.B. "time" */
  source: string;
  /** Workflow-Tracking ID - gleich für Request/Response Paare */
  correlationId: string;
}

/** Event Handler Funktion */
export type EventHandler<E extends DomainEvent = DomainEvent> = (
  event: E
) => void | Promise<void>;

/** Subscription mit Event-Type und Handler */
interface Subscription {
  type: string;
  handler: EventHandler;
}

// ═══════════════════════════════════════════════════════════════
// EventBus Interface
// ═══════════════════════════════════════════════════════════════

export interface EventBus {
  /**
   * Publish ein Event an alle passenden Subscriber
   * Synchron - Handler werden nacheinander aufgerufen
   */
  publish<E extends DomainEvent>(event: E): void;

  /**
   * Subscribe auf ein bekanntes Event
   * @param type - Event-Typ (z.B. 'travel:started')
   * @param handler - Typisierter Handler mit korrektem Payload
   * @returns Unsubscribe function
   */
  subscribe<K extends KnownEventType>(
    type: K,
    handler: (event: EventTypeMap[K]) => void | Promise<void>
  ): () => void;

  /**
   * Alle Subscriptions für einen Event-Typ entfernen
   * @param type - Optional: nur diesen Typ, sonst alle
   */
  unsubscribeAll(type?: string): void;
}

// ═══════════════════════════════════════════════════════════════
// Implementation
// ═══════════════════════════════════════════════════════════════

/**
 * Erstellt einen neuen Event Bus
 */
export function createEventBus(): EventBus {
  const subscriptions: Subscription[] = [];

  return {
    publish<E extends DomainEvent>(event: E): void {
      for (const sub of subscriptions) {
        if (sub.type === event.type) {
          try {
            // Handler kann async sein, aber wir warten nicht
            const result = sub.handler(event);
            if (result instanceof Promise) {
              result.catch((err) => {
                console.error(
                  `[EventBus] Error in async handler for "${event.type}":`,
                  err
                );
              });
            }
          } catch (err) {
            console.error(
              `[EventBus] Error in handler for "${event.type}":`,
              err
            );
          }
        }
      }
    },

    subscribe<K extends KnownEventType>(
      type: K,
      handler: (event: EventTypeMap[K]) => void | Promise<void>
    ): () => void {
      const subscription: Subscription = {
        type,
        handler: handler as EventHandler,
      };

      subscriptions.push(subscription);

      // Return unsubscribe function
      return () => {
        const index = subscriptions.indexOf(subscription);
        if (index !== -1) {
          subscriptions.splice(index, 1);
        }
      };
    },

    unsubscribeAll(type?: string): void {
      if (type === undefined) {
        subscriptions.length = 0;
      } else {
        for (let i = subscriptions.length - 1; i >= 0; i--) {
          if (subscriptions[i].type === type) {
            subscriptions.splice(i, 1);
          }
        }
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Erstellt ein Domain Event (generisch)
 *
 * @param type - Event-Typ
 * @param payload - Event-Daten
 * @param source - Quelle-Domain
 * @param correlationId - Optional: Übernehmen vom auslösenden Event für Workflow-Tracking
 */
export function createEvent<T extends string, P>(
  type: T,
  payload: P,
  source: string,
  correlationId?: string
): DomainEvent<T, P> {
  return {
    type,
    payload,
    timestamp: now(),
    source,
    correlationId: correlationId ?? crypto.randomUUID(),
  };
}

/**
 * Erstellt ein typisiertes Domain Event
 * Payload-Typ wird automatisch aus EventTypeMap inferiert
 *
 * @param type - Event-Typ (aus EventTypeMap)
 * @param payload - Event-Daten (typisiert)
 * @param source - Quelle-Domain
 * @param correlationId - Optional: Übernehmen vom auslösenden Event für Workflow-Tracking
 */
export function createTypedEvent<K extends KnownEventType>(
  type: K,
  payload: EventTypeMap[K]['payload'],
  source: string,
  correlationId?: string
): EventTypeMap[K] {
  return {
    type,
    payload,
    timestamp: now(),
    source,
    correlationId: correlationId ?? crypto.randomUUID(),
  } as EventTypeMap[K];
}

// ═══════════════════════════════════════════════════════════════
// Singleton Instance (optional)
// ═══════════════════════════════════════════════════════════════

let globalBus: EventBus | null = null;

/**
 * Holt den globalen Event Bus (Singleton)
 * Für einfache Verwendung ohne Dependency Injection
 */
export function getEventBus(): EventBus {
  if (!globalBus) {
    globalBus = createEventBus();
  }
  return globalBus;
}

/**
 * Reset global bus (für Tests)
 */
export function resetEventBus(): void {
  if (globalBus) {
    globalBus.unsubscribeAll();
  }
  globalBus = null;
}
