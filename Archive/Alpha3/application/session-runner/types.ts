/**
 * SessionRunner Types
 *
 * UI-specific types for the SessionRunner workmode.
 */

import type { EntityId } from '@core/types/common';
import type { HexCoordinate } from '@core/schemas/coordinates';

// Import shared toolview types for internal use
import type { CameraState, RenderHint } from '@/application/shared/types';
import { DEFAULT_CAMERA } from '@/application/shared/types';

// Re-export for consumers
export { type CameraState, DEFAULT_CAMERA, type RenderHint };

// ═══════════════════════════════════════════════════════════════
// Drag State
// ═══════════════════════════════════════════════════════════════

/**
 * State for waypoint drag operation
 */
export interface WaypointDragState {
  type: 'waypoint';
  /** ID of the waypoint being dragged */
  waypointId: string;
  /** Current drag position (updates during drag) */
  currentCoord: HexCoordinate;
}

/**
 * State for party token drag operation
 */
export interface PartyTokenDragState {
  type: 'partyToken';
  /** Original party position before drag */
  originalCoord: HexCoordinate;
}

/**
 * Union type for all drag states
 */
export type DragState = WaypointDragState | PartyTokenDragState;

// ═══════════════════════════════════════════════════════════════
// Session Runner State
// ═══════════════════════════════════════════════════════════════

/**
 * UI-specific state for SessionRunner
 * (Travel state is managed by TravelOrchestrator)
 */
export interface SessionRunnerState {
  // ─────────────────────────────────────────────────────────────
  // Map State
  // ─────────────────────────────────────────────────────────────

  /** Currently loaded map ID */
  mapId: EntityId<'map'> | null;

  /** Map display name */
  mapName: string;

  // ─────────────────────────────────────────────────────────────
  // Camera State
  // ─────────────────────────────────────────────────────────────

  /** Camera/viewport state */
  camera: CameraState;

  // ─────────────────────────────────────────────────────────────
  // Interaction State
  // ─────────────────────────────────────────────────────────────

  /** Currently hovered hex coordinate */
  hoveredCoord: HexCoordinate | null;

  /** Currently selected hex coordinate */
  selectedCoord: HexCoordinate | null;

  /** Drag state (null when not dragging) */
  dragState: DragState | null;

  // ─────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────

  /** Hint for what needs to be re-rendered */
  renderHint: RenderHint;
}

/**
 * Initial state for SessionRunner
 */
export const INITIAL_STATE: SessionRunnerState = {
  mapId: null,
  mapName: '',
  camera: { ...DEFAULT_CAMERA },
  hoveredCoord: null,
  selectedCoord: null,
  dragState: null,
  renderHint: { type: 'none' },
};

// ═══════════════════════════════════════════════════════════════
// View Configuration
// ═══════════════════════════════════════════════════════════════

/**
 * View type identifier for Obsidian
 */
export const SESSION_RUNNER_VIEW_TYPE = 'session-runner-view';

/**
 * Configuration for SessionRunner view
 */
export interface SessionRunnerConfig {
  /** Default animation speed multiplier */
  defaultAnimationSpeed?: number;

  /** Whether to auto-center on party when map loads */
  autoCenterOnParty?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: SessionRunnerConfig = {
  defaultAnimationSpeed: 60,
  autoCenterOnParty: true,
};

// ═══════════════════════════════════════════════════════════════
// State Listener
// ═══════════════════════════════════════════════════════════════

/**
 * Listener for state changes
 */
export type StateListener = (state: SessionRunnerState) => void;
