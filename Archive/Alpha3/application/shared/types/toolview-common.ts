/**
 * Toolview Common Types
 *
 * Shared types used across multiple toolview workmodes.
 * Re-exports core types for convenient access.
 */

// Re-export camera types from core
export type { CameraState } from '@core/types/camera';
export { DEFAULT_CAMERA } from '@core/types/camera';

// Re-export render types from core
export type { RenderHint } from '@core/types/render';

/**
 * Generic state listener for MVVM pattern
 */
export type StateListener<TState> = (state: TState) => void;
