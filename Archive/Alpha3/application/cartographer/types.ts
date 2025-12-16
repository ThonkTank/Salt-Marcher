/**
 * Cartographer Types
 *
 * UI-specific types for the Cartographer workmode.
 */

import type { EntityId } from '@core/types/common';
import type { HexCoordinate } from '@core/schemas/coordinates';
import type { CoordKey } from '@core/schemas/hex-geometry';
import type { FalloffType, BrushMode } from './utils/brush-math';
import type { ToolType } from './services/brush-service';

// Import shared toolview types for internal use
import type { CameraState, RenderHint } from '@/application/shared/types';
import { DEFAULT_CAMERA } from '@/application/shared/types';

// Re-export for consumers
export { type CameraState, DEFAULT_CAMERA, type RenderHint };

// Re-export for convenience
export type { ToolType } from './services/brush-service';
export type { FalloffType, BrushMode } from './utils/brush-math';

// ═══════════════════════════════════════════════════════════════
// Tool Mode
// ═══════════════════════════════════════════════════════════════

/**
 * Tool interaction mode
 */
export type ToolMode = 'brush' | 'inspector';

// ═══════════════════════════════════════════════════════════════
// Brush Configuration
// ═══════════════════════════════════════════════════════════════

/**
 * Brush settings exposed in UI
 */
export interface BrushSettings {
  /** Brush radius (1-10 hexes) */
  radius: number;

  /** Brush strength (0-100%) */
  strength: number;

  /** Falloff curve type */
  falloff: FalloffType;

  /** Brush operation mode */
  mode: BrushMode;

  /** Target value for numeric tools (elevation, climate) */
  value: number;

  /** Selected terrain ID for terrain tool */
  terrain: string;
}

/**
 * Default brush settings
 */
export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  radius: 1,
  strength: 100,
  falloff: 'smooth',
  mode: 'set',
  value: 6, // Middle value for climate (1-12)
  terrain: 'grassland',
};


// ═══════════════════════════════════════════════════════════════
// Cartographer State (for ViewModel)
// ═══════════════════════════════════════════════════════════════

/**
 * Complete cartographer state
 */
export interface CartographerState {
  // ─────────────────────────────────────────────────────────────
  // Map State
  // ─────────────────────────────────────────────────────────────

  /** Currently loaded map ID */
  mapId: EntityId<'map'> | null;

  /** Map display name */
  mapName: string;

  /** Whether map has unsaved changes */
  isDirty: boolean;

  // ─────────────────────────────────────────────────────────────
  // Tool State
  // ─────────────────────────────────────────────────────────────

  /** Current interaction mode */
  toolMode: ToolMode;

  /** Active brush tool */
  activeTool: ToolType;

  /** Brush settings */
  brushSettings: BrushSettings;

  // ─────────────────────────────────────────────────────────────
  // Selection/Hover
  // ─────────────────────────────────────────────────────────────

  /** Selected tile (for inspector) */
  selectedCoord: HexCoordinate | null;

  /** Hovered tile (for brush preview) */
  hoverCoord: HexCoordinate | null;

  // ─────────────────────────────────────────────────────────────
  // Camera
  // ─────────────────────────────────────────────────────────────

  /** Camera/viewport state */
  camera: CameraState;

  // ─────────────────────────────────────────────────────────────
  // Undo/Redo
  // ─────────────────────────────────────────────────────────────

  /** Can perform undo */
  canUndo: boolean;

  /** Can perform redo */
  canRedo: boolean;

  // ─────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────

  /** Hint for what needs to be re-rendered */
  renderHint: RenderHint;
}

/**
 * Initial cartographer state
 */
export const INITIAL_STATE: CartographerState = {
  mapId: null,
  mapName: '',
  isDirty: false,
  toolMode: 'brush',
  activeTool: 'terrain',
  brushSettings: { ...DEFAULT_BRUSH_SETTINGS },
  selectedCoord: null,
  hoverCoord: null,
  camera: { ...DEFAULT_CAMERA },
  canUndo: false,
  canRedo: false,
  renderHint: { type: 'none' },
};


// ═══════════════════════════════════════════════════════════════
// Event Types (for View communication)
// ═══════════════════════════════════════════════════════════════

/**
 * State change listener
 */
export type StateListener = (state: CartographerState) => void;

// ═══════════════════════════════════════════════════════════════
// Tool Configuration
// ═══════════════════════════════════════════════════════════════

/**
 * Tool metadata for UI
 */
export interface ToolInfo {
  type: ToolType;
  label: string;
  shortcut: string;
  icon: string;
  description: string;
}

/**
 * All available tools
 */
export const TOOLS: ToolInfo[] = [
  {
    type: 'terrain',
    label: 'Terrain',
    shortcut: '1',
    icon: 'mountain',
    description: 'Paint terrain types',
  },
  {
    type: 'elevation',
    label: 'Elevation',
    shortcut: '2',
    icon: 'trending-up',
    description: 'Adjust terrain height',
  },
  {
    type: 'temperature',
    label: 'Temperature',
    shortcut: '3',
    icon: 'thermometer',
    description: 'Edit climate temperature',
  },
  {
    type: 'precipitation',
    label: 'Precipitation',
    shortcut: '4',
    icon: 'cloud-rain',
    description: 'Edit precipitation levels',
  },
  {
    type: 'clouds',
    label: 'Clouds',
    shortcut: '5',
    icon: 'cloud',
    description: 'Edit cloud cover',
  },
  {
    type: 'wind',
    label: 'Wind',
    shortcut: '6',
    icon: 'wind',
    description: 'Edit wind strength',
  },
  {
    type: 'resize',
    label: 'Resize',
    shortcut: '7',
    icon: 'maximize-2',
    description: 'Add or remove tiles at edges',
  },
];

/**
 * Get tool info by type
 */
export function getToolInfo(type: ToolType): ToolInfo | undefined {
  return TOOLS.find((t) => t.type === type);
}
