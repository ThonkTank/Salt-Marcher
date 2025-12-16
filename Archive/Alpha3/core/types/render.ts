/**
 * Render Types
 *
 * Shared render hint types for optimized UI updates.
 * Used by Cartographer and SessionRunner ViewModels.
 */

import type { CoordKey } from '../schemas/hex-geometry';

// ═══════════════════════════════════════════════════════════════
// Render Hints
// ═══════════════════════════════════════════════════════════════

/**
 * Hint for optimized rendering
 *
 * ViewModels emit render hints to tell Views what needs updating.
 * This enables efficient partial re-renders instead of full redraws.
 */
export type RenderHint =
  | { type: 'none' } // No render needed
  | { type: 'full' } // Full redraw required
  | { type: 'camera' } // Only camera transform changed
  | { type: 'tiles'; coords: CoordKey[] } // Specific tiles changed
  | { type: 'colors' } // Color mode changed (all tiles need color update)
  | { type: 'brush' } // Brush preview changed
  | { type: 'selection' } // Selection changed
  | { type: 'token' } // Token position changed (SessionRunner)
  | { type: 'route' } // Route overlay changed (SessionRunner)
  | { type: 'ui' }; // UI-only update (no canvas changes)

/**
 * Default render hint (no render)
 */
export const NO_RENDER: RenderHint = { type: 'none' };

/**
 * Full render hint
 */
export const FULL_RENDER: RenderHint = { type: 'full' };

/**
 * Camera-only render hint
 */
export const CAMERA_RENDER: RenderHint = { type: 'camera' };

/**
 * UI-only render hint
 */
export const UI_RENDER: RenderHint = { type: 'ui' };
