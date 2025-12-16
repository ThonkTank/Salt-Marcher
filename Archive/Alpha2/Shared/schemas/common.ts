/**
 * Common Schema Types
 *
 * Shared type definitions used across multiple plugins.
 *
 * @module Shared/schemas/common
 */

// ============================================================================
// Callback Types
// ============================================================================

/** Generic unsubscribe function */
export type Unsubscribe = () => void;

/** Service callback for state updates */
export type ServiceCallback<T> = (state: T) => void;
