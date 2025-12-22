/**
 * Cartographer types.
 *
 * The Cartographer is the map editor for Hex-Overland and Grid-Dungeon maps.
 * State structure defined in Cartographer.md#state-management
 */

import type { EntityId } from '@core/types';
import type { EventBus } from '@core/events';
import type { MapType, HexCoordinate, GridCoordinate } from '@core/schemas';
import type { MapFeaturePort } from '@/features/map';
import type { NotificationService } from '@/application/shared';

// ============================================================================
// View Types
// ============================================================================

/** View type identifier for Obsidian */
export const VIEW_TYPE_CARTOGRAPHER = 'salt-marcher-cartographer';

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Overland map tools.
 * From Cartographer.md#tool-typen
 */
export type OverlandTool =
  | 'terrain-brush'
  | 'elevation-brush'
  | 'climate-brush'
  | 'feature-brush'
  | 'path-tool'
  | 'location-marker'
  | 'inspector';

/**
 * Dungeon map tools.
 * From Cartographer.md#tool-typen
 */
export type DungeonTool =
  | 'wall-tool'
  | 'door-tool'
  | 'trap-tool'
  | 'token-placer'
  | 'inspector';

/**
 * All tool types.
 */
export type ToolType = OverlandTool | DungeonTool;

/**
 * Brush shape options.
 */
export type BrushShape = 'circle' | 'line' | 'fill';

/**
 * Feature category for feature-brush tool.
 * From Cartographer.md#feature-brush-overland
 */
export type FeatureCategory = 'natural' | 'ruins' | 'roads';

/**
 * Tool options that can be configured.
 * Extended by specific tools in subsequent tasks.
 */
export interface ToolOptions {
  /** Brush size (1-5) */
  brushSize: number;
  /** Brush shape */
  brushShape: BrushShape;
  /** Preview mode enabled */
  previewMode: boolean;
  /** Selected terrain ID for terrain brush */
  selectedTerrainId?: EntityId<'terrain'>;
  /** Auto-elevation: adjust elevation based on terrain type */
  autoElevation?: boolean;
  /** Elevation value for elevation brush */
  elevationValue?: number;
  /** Elevation strength (0-1) for elevation brush */
  elevationStrength?: number;
  /** Selected feature category for feature-brush (natural, ruins, roads) */
  selectedFeatureCategory?: FeatureCategory;
  /** Selected feature type for feature-brush (e.g., 'forest', 'rocks', 'ruins') */
  selectedFeatureType?: string;
  /** Feature density for feature-brush (0.0 = sparse, 1.0 = dense) */
  featureDensity?: number;
}

// ============================================================================
// Layer Types
// ============================================================================

/**
 * Layer identifiers for visibility/lock control.
 * From Cartographer.md#layer-control
 */
export type OverlandLayerId =
  | 'terrain'
  | 'elevation'
  | 'climate'
  | 'faction-territory'
  | 'features'
  | 'locations'
  | 'hex-grid';

export type DungeonLayerId =
  | 'walls'
  | 'doors'
  | 'traps'
  | 'tokens'
  | 'light-sources'
  | 'grid';

export type LayerId = OverlandLayerId | DungeonLayerId;

// ============================================================================
// Camera State
// ============================================================================

/**
 * Camera state for pan/zoom.
 */
export interface CameraState {
  /** X offset in pixels */
  offsetX: number;
  /** Y offset in pixels */
  offsetY: number;
  /** Zoom level (1.0 = 100%) */
  zoom: number;
}

// ============================================================================
// Coordinate Types
// ============================================================================

/**
 * Generic coordinate type for both hex and grid.
 */
export type Coordinate = HexCoordinate | GridCoordinate;

// ============================================================================
// Edit Actions (Undo/Redo)
// ============================================================================

/**
 * Base edit action for undo/redo stack.
 * Extended by specific edit types in subsequent tasks.
 */
export interface EditAction {
  /** Action type identifier */
  type: string;
  /** Timestamp when action was performed */
  timestamp: number;
  /** Data needed to undo the action */
  undoData: unknown;
  /** Data needed to redo the action */
  redoData: unknown;
}

// ============================================================================
// State
// ============================================================================

/**
 * Full Cartographer state.
 * From Cartographer.md#state-management (lines 654-681)
 */
export interface CartographerState {
  // Map
  /** Currently loaded map ID */
  activeMapId: EntityId<'map'> | null;
  /** Type of the active map (determines tool palette) */
  mapType: MapType | null;
  /** Camera state (pan, zoom) */
  camera: CameraState;

  // Tools
  /** Currently active tool */
  activeTool: ToolType;
  /** Tool-specific options */
  toolOptions: ToolOptions;

  // Layers
  /** Visible layer IDs */
  visibleLayers: LayerId[];
  /** Locked layer IDs (not editable) */
  lockedLayers: LayerId[];
  /** Layer opacity settings (0-1) */
  layerOpacity: Record<LayerId, number>;

  // Selection
  /** Currently selected tiles */
  selectedTiles: Coordinate[];
  /** Currently hovered tile */
  hoveredTile: Coordinate | null;

  // Undo/Redo
  /** Stack of actions that can be undone */
  undoStack: EditAction[];
  /** Stack of actions that can be redone */
  redoStack: EditAction[];

  // UI
  /** Whether sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Whether inspector panel is open */
  inspectorOpen: boolean;
}

// ============================================================================
// Render Hints
// ============================================================================

/**
 * Hints for optimized re-rendering.
 * From Application.md#render-hints
 */
export type CartographerRenderHint =
  | 'full'
  | 'tiles'
  | 'camera'
  | 'ui'
  | 'selection'
  | 'brush'
  | 'layers'
  | 'tool';

/**
 * Callback type for state change subscriptions.
 */
export type CartographerRenderCallback = (
  state: Readonly<CartographerState>,
  hints: CartographerRenderHint[]
) => void;

// ============================================================================
// Dependencies
// ============================================================================

/**
 * Dependencies required by CartographerView.
 * Used by factory function.
 */
export interface CartographerViewDeps {
  /** Default map to load on open (optional) */
  defaultMapId?: EntityId<'map'>;
  /** EventBus for cross-feature communication */
  eventBus: EventBus;
  /** Map feature for CRUD operations */
  mapFeature: MapFeaturePort;
  /** Notification service for user feedback */
  notificationService: NotificationService;
}

/**
 * Dependencies required by CartographerViewModel.
 * Subset of view deps needed for state management.
 */
export interface CartographerViewModelDeps {
  /** EventBus for cross-feature communication */
  eventBus: EventBus;
  /** Map feature for CRUD operations */
  mapFeature: MapFeaturePort;
  /** Notification service for user feedback */
  notificationService: NotificationService;
}

// ============================================================================
// Initial State Factory
// ============================================================================

/**
 * Default tool options.
 */
export function createDefaultToolOptions(): ToolOptions {
  return {
    brushSize: 1,
    brushShape: 'circle',
    previewMode: false,
  };
}

/**
 * Default camera state.
 */
export function createDefaultCameraState(): CameraState {
  return {
    offsetX: 0,
    offsetY: 0,
    zoom: 1.0,
  };
}

/**
 * Default visible layers for overland maps.
 */
export function getDefaultOverlandLayers(): OverlandLayerId[] {
  return ['terrain', 'elevation', 'features', 'locations'];
}

/**
 * Default visible layers for dungeon maps.
 */
export function getDefaultDungeonLayers(): DungeonLayerId[] {
  return ['walls', 'doors', 'tokens', 'light-sources'];
}

/**
 * Default layer opacity settings.
 */
export function createDefaultLayerOpacity(): Record<LayerId, number> {
  return {
    // Overland
    terrain: 1.0,
    elevation: 1.0,
    climate: 0.5,
    'faction-territory': 0.3,
    features: 1.0,
    locations: 1.0,
    'hex-grid': 0.3,
    // Dungeon
    walls: 1.0,
    doors: 1.0,
    traps: 1.0,
    tokens: 1.0,
    'light-sources': 0.8,
    grid: 0.3,
  };
}

/**
 * Create initial Cartographer state.
 */
export function createInitialCartographerState(): CartographerState {
  return {
    // Map
    activeMapId: null,
    mapType: null,
    camera: createDefaultCameraState(),

    // Tools
    activeTool: 'inspector',
    toolOptions: createDefaultToolOptions(),

    // Layers
    visibleLayers: getDefaultOverlandLayers(),
    lockedLayers: [],
    layerOpacity: createDefaultLayerOpacity(),

    // Selection
    selectedTiles: [],
    hoveredTile: null,

    // Undo/Redo
    undoStack: [],
    redoStack: [],

    // UI
    sidebarCollapsed: false,
    inspectorOpen: false,
  };
}
