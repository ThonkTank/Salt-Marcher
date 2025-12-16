/**
 * SessionRunner types.
 */

import type { HexCoordinate, OverworldMap, TransportMode } from '@core/schemas';

// ============================================================================
// View Types
// ============================================================================

/** View type identifier for Obsidian */
export const VIEW_TYPE_SESSION_RUNNER = 'salt-marcher-session-runner';

// ============================================================================
// Render State
// ============================================================================

/**
 * State needed for rendering the map.
 */
export interface RenderState {
  /** Currently loaded map */
  map: OverworldMap | null;

  /** Party position */
  partyPosition: HexCoordinate | null;

  /** Active transport mode */
  activeTransport: TransportMode;

  /** Hovered tile (for highlighting) */
  hoveredTile: HexCoordinate | null;

  /** Selected tile (for info display) */
  selectedTile: HexCoordinate | null;

  /** Camera offset for panning */
  cameraOffset: { x: number; y: number };

  /** Zoom level */
  zoom: number;
}

/**
 * Create initial render state.
 */
export function createInitialRenderState(): RenderState {
  return {
    map: null,
    partyPosition: null,
    activeTransport: 'foot',
    hoveredTile: null,
    selectedTile: null,
    cameraOffset: { x: 0, y: 0 },
    zoom: 1.0,
  };
}

// ============================================================================
// Render Hints
// ============================================================================

/**
 * Hints for optimized rendering.
 */
export type RenderHint =
  | 'full' // Full re-render
  | 'tiles' // Only tiles changed
  | 'party' // Party position changed
  | 'hover' // Hover state changed
  | 'camera' // Camera/zoom changed
  | 'selection'; // Selection changed

// ============================================================================
// ViewModel Events
// ============================================================================

/** Callback for render updates */
export type RenderCallback = (state: RenderState, hints: RenderHint[]) => void;

// ============================================================================
// Travel Info
// ============================================================================

/**
 * Info about last travel move (for display).
 */
export interface TravelInfo {
  from: HexCoordinate;
  to: HexCoordinate;
  timeCostHours: number;
  terrainName: string;
}
