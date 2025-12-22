/**
 * Cartographer ViewModel.
 *
 * Coordinates between UI (View/Panels) and Features.
 * Manages editor state for map editing operations.
 *
 * Task #2501 - Cartographer ViewModel mit State-Management
 */

import type { EntityId } from '@core/types';
import type { Unsubscribe } from '@core/events';
import { EventTypes, isSome, isOk } from '@core/index';
import type { MapLoadedPayload, MapUnloadedPayload } from '@core/events/domain-events';
import type {
  CartographerState,
  CartographerRenderHint,
  CartographerRenderCallback,
  CartographerViewModelDeps,
  ToolType,
  ToolOptions,
  LayerId,
  Coordinate,
  EditAction,
} from './types';
import {
  createInitialCartographerState,
  createDefaultToolOptions,
  createDefaultCameraState,
  getDefaultOverlandLayers,
  getDefaultDungeonLayers,
} from './types';

// ============================================================================
// ViewModel Interface
// ============================================================================

export interface CartographerViewModel {
  // State
  getState(): Readonly<CartographerState>;

  // Subscriptions
  subscribe(callback: CartographerRenderCallback): Unsubscribe;

  // Initialization
  initialize(mapId?: EntityId<'map'>): Promise<void>;
  loadMap(mapId: EntityId<'map'>): Promise<void>;
  unloadMap(): void;

  // Tool Interactions
  setActiveTool(tool: ToolType): void;
  setToolOption<K extends keyof ToolOptions>(key: K, value: ToolOptions[K]): void;
  setBrushSize(size: number): void;

  // Layer Interactions
  toggleLayerVisibility(layerId: LayerId): void;
  toggleLayerLock(layerId: LayerId): void;
  setLayerOpacity(layerId: LayerId, opacity: number): void;

  // Camera Interactions
  pan(deltaX: number, deltaY: number): void;
  zoom(delta: number, centerX?: number, centerY?: number): void;
  resetCamera(): void;

  // Selection
  selectTiles(tiles: Coordinate[]): void;
  addToSelection(tiles: Coordinate[]): void;
  removeFromSelection(tiles: Coordinate[]): void;
  clearSelection(): void;
  onTileHover(tile: Coordinate | null): void;

  // Undo/Redo
  pushEdit(action: EditAction): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  clearHistory(): void;

  // UI
  toggleSidebar(): void;
  toggleInspector(): void;

  // Cleanup
  dispose(): void;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum undo/redo stack size */
const MAX_HISTORY_SIZE = 50;

/** Minimum zoom level */
const MIN_ZOOM = 0.25;

/** Maximum zoom level */
const MAX_ZOOM = 4.0;

/** Minimum brush size */
const MIN_BRUSH_SIZE = 1;

/** Maximum brush size */
const MAX_BRUSH_SIZE = 5;

// ============================================================================
// Factory
// ============================================================================

/**
 * Create the Cartographer ViewModel.
 * Follows the factory pattern from SessionRunner.
 */
export function createCartographerViewModel(
  deps: CartographerViewModelDeps
): CartographerViewModel {
  const { eventBus, mapFeature, notificationService } = deps;

  // =========================================================================
  // Internal State
  // =========================================================================

  let state: CartographerState = createInitialCartographerState();
  const subscribers = new Set<CartographerRenderCallback>();
  const eventSubscriptions: Unsubscribe[] = [];

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Notify all subscribers of state change.
   */
  function notify(hints: CartographerRenderHint[]): void {
    for (const callback of subscribers) {
      callback(state, hints);
    }
  }

  /**
   * Update state and notify subscribers.
   */
  function updateState(
    partial: Partial<CartographerState>,
    hints: CartographerRenderHint[]
  ): void {
    state = { ...state, ...partial };
    notify(hints);
  }

  /**
   * Sync state from map feature.
   */
  function syncFromMapFeature(): void {
    const currentMap = mapFeature.getCurrentMap();
    if (isSome(currentMap)) {
      const map = currentMap.value;
      // MVP: Only OverworldMap is supported, so type is always 'overworld'
      // Post-MVP: When DungeonMap is added, check map.type for appropriate layers
      const mapType = map.type as 'overworld' | 'dungeon'; // Cast for future dungeon support
      const newLayers =
        mapType === 'dungeon'
          ? getDefaultDungeonLayers()
          : getDefaultOverlandLayers();

      updateState(
        {
          activeMapId: map.id,
          mapType: mapType,
          visibleLayers: newLayers,
          // Reset tool to inspector when map type changes
          activeTool: 'inspector',
        },
        ['full']
      );
    } else {
      updateState(
        {
          activeMapId: null,
          mapType: null,
        },
        ['full']
      );
    }
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  function setupEventHandlers(): void {
    // Map loaded - sync state
    eventSubscriptions.push(
      eventBus.subscribe<MapLoadedPayload>(EventTypes.MAP_LOADED, () => {
        syncFromMapFeature();
      })
    );

    // Map unloaded - reset state
    eventSubscriptions.push(
      eventBus.subscribe<MapUnloadedPayload>(EventTypes.MAP_UNLOADED, () => {
        updateState(
          {
            activeMapId: null,
            mapType: null,
            selectedTiles: [],
            hoveredTile: null,
            undoStack: [],
            redoStack: [],
          },
          ['full']
        );
      })
    );
  }

  // Initialize event handlers
  setupEventHandlers();

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    getState(): Readonly<CartographerState> {
      return state;
    },

    // -----------------------------------------------------------------------
    // Subscriptions
    // -----------------------------------------------------------------------

    subscribe(callback: CartographerRenderCallback): Unsubscribe {
      subscribers.add(callback);
      // Immediately call with current state (as per SessionRunner pattern)
      callback(state, ['full']);
      return () => subscribers.delete(callback);
    },

    // -----------------------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------------------

    async initialize(mapId?: EntityId<'map'>): Promise<void> {
      if (mapId) {
        await this.loadMap(mapId);
      }
    },

    async loadMap(mapId: EntityId<'map'>): Promise<void> {
      const result = await mapFeature.loadMap(mapId);
      if (!isOk(result)) {
        notificationService.errorFromResult(result.error);
        return;
      }

      // State will be synced via MAP_LOADED event
    },

    unloadMap(): void {
      mapFeature.unloadMap();
      // State will be synced via MAP_UNLOADED event
    },

    // -----------------------------------------------------------------------
    // Tool Interactions
    // -----------------------------------------------------------------------

    setActiveTool(tool: ToolType): void {
      if (state.activeTool === tool) return;

      // Validate tool is appropriate for current map type
      if (state.mapType === 'dungeon') {
        const dungeonTools = [
          'wall-tool',
          'door-tool',
          'trap-tool',
          'token-placer',
          'inspector',
        ];
        if (!dungeonTools.includes(tool)) {
          notificationService.warn(`Tool "${tool}" is not available for dungeon maps`);
          return;
        }
      } else if (state.mapType === 'overworld') {
        const overlandTools = [
          'terrain-brush',
          'elevation-brush',
          'climate-brush',
          'feature-brush',
          'path-tool',
          'location-marker',
          'inspector',
        ];
        if (!overlandTools.includes(tool)) {
          notificationService.warn(`Tool "${tool}" is not available for overland maps`);
          return;
        }
      }

      updateState(
        {
          activeTool: tool,
          // Reset tool options when switching tools
          toolOptions: createDefaultToolOptions(),
        },
        ['tool']
      );
    },

    setToolOption<K extends keyof ToolOptions>(key: K, value: ToolOptions[K]): void {
      updateState(
        {
          toolOptions: { ...state.toolOptions, [key]: value },
        },
        ['tool']
      );
    },

    setBrushSize(size: number): void {
      const clampedSize = Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, size));
      this.setToolOption('brushSize', clampedSize);
    },

    // -----------------------------------------------------------------------
    // Layer Interactions
    // -----------------------------------------------------------------------

    toggleLayerVisibility(layerId: LayerId): void {
      const isVisible = state.visibleLayers.includes(layerId);
      const newVisibleLayers = isVisible
        ? state.visibleLayers.filter((id) => id !== layerId)
        : [...state.visibleLayers, layerId];

      updateState({ visibleLayers: newVisibleLayers }, ['layers']);
    },

    toggleLayerLock(layerId: LayerId): void {
      const isLocked = state.lockedLayers.includes(layerId);
      const newLockedLayers = isLocked
        ? state.lockedLayers.filter((id) => id !== layerId)
        : [...state.lockedLayers, layerId];

      updateState({ lockedLayers: newLockedLayers }, ['layers']);
    },

    setLayerOpacity(layerId: LayerId, opacity: number): void {
      const clampedOpacity = Math.max(0, Math.min(1, opacity));
      updateState(
        {
          layerOpacity: { ...state.layerOpacity, [layerId]: clampedOpacity },
        },
        ['layers']
      );
    },

    // -----------------------------------------------------------------------
    // Camera Interactions
    // -----------------------------------------------------------------------

    pan(deltaX: number, deltaY: number): void {
      updateState(
        {
          camera: {
            ...state.camera,
            offsetX: state.camera.offsetX + deltaX,
            offsetY: state.camera.offsetY + deltaY,
          },
        },
        ['camera']
      );
    },

    zoom(delta: number, _centerX?: number, _centerY?: number): void {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.camera.zoom + delta));
      // TODO: Adjust offset to zoom towards center point in #2518
      updateState(
        {
          camera: { ...state.camera, zoom: newZoom },
        },
        ['camera']
      );
    },

    resetCamera(): void {
      updateState({ camera: createDefaultCameraState() }, ['camera']);
    },

    // -----------------------------------------------------------------------
    // Selection
    // -----------------------------------------------------------------------

    selectTiles(tiles: Coordinate[]): void {
      updateState({ selectedTiles: tiles }, ['selection']);
    },

    addToSelection(tiles: Coordinate[]): void {
      // Filter out duplicates
      const newTiles = tiles.filter(
        (tile) =>
          !state.selectedTiles.some(
            (selected) =>
              ('q' in tile && 'q' in selected && tile.q === selected.q && tile.r === selected.r) ||
              ('x' in tile && 'x' in selected && tile.x === selected.x && tile.y === selected.y && tile.z === selected.z)
          )
      );
      updateState({ selectedTiles: [...state.selectedTiles, ...newTiles] }, ['selection']);
    },

    removeFromSelection(tiles: Coordinate[]): void {
      const newSelection = state.selectedTiles.filter(
        (selected) =>
          !tiles.some(
            (tile) =>
              ('q' in tile && 'q' in selected && tile.q === selected.q && tile.r === selected.r) ||
              ('x' in tile && 'x' in selected && tile.x === selected.x && tile.y === selected.y && tile.z === selected.z)
          )
      );
      updateState({ selectedTiles: newSelection }, ['selection']);
    },

    clearSelection(): void {
      if (state.selectedTiles.length === 0) return;
      updateState({ selectedTiles: [] }, ['selection']);
    },

    onTileHover(tile: Coordinate | null): void {
      // Skip if same tile
      if (tile === null && state.hoveredTile === null) return;
      if (
        tile !== null &&
        state.hoveredTile !== null &&
        'q' in tile &&
        'q' in state.hoveredTile &&
        tile.q === state.hoveredTile.q &&
        tile.r === state.hoveredTile.r
      ) {
        return;
      }
      if (
        tile !== null &&
        state.hoveredTile !== null &&
        'x' in tile &&
        'x' in state.hoveredTile &&
        tile.x === state.hoveredTile.x &&
        tile.y === state.hoveredTile.y &&
        tile.z === state.hoveredTile.z
      ) {
        return;
      }

      updateState({ hoveredTile: tile }, ['selection']);
    },

    // -----------------------------------------------------------------------
    // Undo/Redo
    // -----------------------------------------------------------------------

    pushEdit(action: EditAction): void {
      // Add to undo stack
      const newUndoStack = [...state.undoStack, action];

      // Trim if too large
      if (newUndoStack.length > MAX_HISTORY_SIZE) {
        newUndoStack.shift();
      }

      // Clear redo stack when new edit is made
      updateState(
        {
          undoStack: newUndoStack,
          redoStack: [],
        },
        ['ui']
      );
    },

    undo(): void {
      if (state.undoStack.length === 0) return;

      const action = state.undoStack[state.undoStack.length - 1];
      const newUndoStack = state.undoStack.slice(0, -1);
      const newRedoStack = [...state.redoStack, action];

      updateState(
        {
          undoStack: newUndoStack,
          redoStack: newRedoStack,
        },
        ['full']
      );

      // TODO: Apply undo action in #2506
      // The actual undo logic will be implemented in the Undo/Redo task
    },

    redo(): void {
      if (state.redoStack.length === 0) return;

      const action = state.redoStack[state.redoStack.length - 1];
      const newRedoStack = state.redoStack.slice(0, -1);
      const newUndoStack = [...state.undoStack, action];

      updateState(
        {
          undoStack: newUndoStack,
          redoStack: newRedoStack,
        },
        ['full']
      );

      // TODO: Apply redo action in #2506
      // The actual redo logic will be implemented in the Undo/Redo task
    },

    canUndo(): boolean {
      return state.undoStack.length > 0;
    },

    canRedo(): boolean {
      return state.redoStack.length > 0;
    },

    clearHistory(): void {
      updateState(
        {
          undoStack: [],
          redoStack: [],
        },
        ['ui']
      );
    },

    // -----------------------------------------------------------------------
    // UI
    // -----------------------------------------------------------------------

    toggleSidebar(): void {
      updateState({ sidebarCollapsed: !state.sidebarCollapsed }, ['ui']);
    },

    toggleInspector(): void {
      updateState({ inspectorOpen: !state.inspectorOpen }, ['ui']);
    },

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    dispose(): void {
      // Clean up EventBus subscriptions
      for (const unsubscribe of eventSubscriptions) {
        unsubscribe();
      }
      eventSubscriptions.length = 0;

      // Clean up render subscribers
      subscribers.clear();
    },
  };
}
