/**
 * Domain event types and interfaces.
 */

import type { Timestamp } from '../types';

// ============================================================================
// Domain Event Interface
// ============================================================================

/**
 * All domain events MUST follow this structure.
 * correlationId is mandatory for workflow tracing.
 */
export interface DomainEvent<T = unknown> {
  /** Event type (e.g., 'travel:started', 'map:loaded') */
  readonly type: string;
  /** Typed payload */
  readonly payload: T;
  /** Workflow correlation ID (mandatory) */
  readonly correlationId: string;
  /** When the event was created */
  readonly timestamp: Timestamp;
  /** Who sent the event (e.g., 'travel-orchestrator') */
  readonly source: string;
}

// ============================================================================
// Event Factory
// ============================================================================

/**
 * Create a domain event with required fields.
 */
export function createEvent<T>(
  type: string,
  payload: T,
  options: {
    correlationId: string;
    timestamp: Timestamp;
    source: string;
  }
): DomainEvent<T> {
  return {
    type,
    payload,
    correlationId: options.correlationId,
    timestamp: options.timestamp,
    source: options.source,
  };
}

/**
 * Generate a new correlation ID for starting a new workflow.
 */
export function newCorrelationId(): string {
  return crypto.randomUUID();
}
