/**
 * Cartographer ViewModel
 *
 * Central MVVM state management for the Cartographer workmode.
 * Coordinates between UI components, brush service, and geography domain.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import type { HexMapData, HexTileData } from '@core/schemas/map';
import type { CoordKey } from '@core/schemas/hex-geometry';
import { coordToKey } from '@core/schemas/hex-geometry';
import type { GeographyFeaturePort } from '@/features/geography';
import type { EventBus } from '@core/events/event-bus';
import type { EntityId } from '@core/types/common';

import {
  type CartographerState,
  type ToolMode,
  type BrushSettings,
  type CameraState,
  type RenderHint,
  type StateListener,
  INITIAL_STATE,
  DEFAULT_BRUSH_SETTINGS,
  DEFAULT_CAMERA,
} from './types';
import type { ToolType } from './services/brush-service';
import { createUndoService, UndoService } from './services/undo-service';
import { createBrushService, BrushService } from './services/brush-service';
import { clampZoom, calculateWheelZoom, zoomAtPoint } from '@shared/map';

// ═══════════════════════════════════════════════════════════════
// ViewModel
// ═══════════════════════════════════════════════════════════════

export class CartographerViewModel {
  private state: CartographerState;
  private listeners: Set<StateListener> = new Set();

  private readonly geographyFeature: GeographyFeaturePort;
  private readonly eventBus: EventBus;
  private readonly undoService: UndoService;
  private readonly brushService: BrushService;

  private mapData: HexMapData | null = null;

  constructor(geographyFeature: GeographyFeaturePort, eventBus: EventBus) {
    this.geographyFeature = geographyFeature;
    this.eventBus = eventBus;
    this.undoService = createUndoService();
    this.brushService = createBrushService(this.undoService);
    this.state = { ...INITIAL_STATE };
  }

  // ─────────────────────────────────────────────────────────────
  // State Access
  // ─────────────────────────────────────────────────────────────

  /**
   * Get current state (readonly)
   */
  getState(): Readonly<CartographerState> {
    return this.state;
  }

  /**
   * Get current map data (readonly)
   */
  getMapData(): Readonly<HexMapData> | null {
    return this.mapData;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /**
   * Update state and notify
   */
  private setState(
    updates: Partial<CartographerState>,
    renderHint: RenderHint = { type: 'ui' }
  ): void {
    this.state = { ...this.state, ...updates, renderHint };
    this.updateUndoRedoState();
    this.notify();
  }

  private updateUndoRedoState(): void {
    this.state.canUndo = this.undoService.canUndo();
    this.state.canRedo = this.undoService.canRedo();
  }

  // ─────────────────────────────────────────────────────────────
  // Map Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Load a map by ID
   */
  async loadMap(mapId: EntityId<'map'>): Promise<void> {
    const result = await this.geographyFeature.setActiveMap(mapId);
    this.mapData = result.map;

    this.undoService.clear();
    this.setState(
      {
        mapId: result.map.metadata.id,
        mapName: result.map.metadata.name,
        isDirty: false,
        camera: { ...DEFAULT_CAMERA },
      },
      { type: 'full' }
    );
  }

  /**
   * Create a new map
   */
  async createMap(
    name: string,
    radius: number,
    defaultTerrain?: string
  ): Promise<void> {
    const map = await this.geographyFeature.createMap(name, radius, {
      defaultTerrain,
    });

    await this.loadMap(map.metadata.id);
  }

  /**
   * Save the current map
   */
  async saveMap(): Promise<void> {
    if (!this.mapData) return;

    // Apply any pending tile changes
    await this.geographyFeature.saveActiveMap();

    this.setState({ isDirty: false }, { type: 'ui' });
  }

  /**
   * Delete the current map
   */
  async deleteMap(): Promise<void> {
    if (!this.state.mapId) return;

    await this.geographyFeature.deleteMap(this.state.mapId);

    this.mapData = null;
    this.undoService.clear();
    this.setState(
      {
        mapId: null,
        mapName: '',
        isDirty: false,
        selectedCoord: null,
        hoverCoord: null,
      },
      { type: 'full' }
    );
  }

  /**
   * Get list of available maps
   */
  async listMaps(): Promise<Array<{ id: EntityId<'map'>; name: string; type: string }>> {
    return this.geographyFeature.listMaps();
  }

  // ─────────────────────────────────────────────────────────────
  // Tool Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Set tool mode (brush/inspector)
   */
  setToolMode(mode: ToolMode): void {
    this.setState({ toolMode: mode }, { type: 'ui' });
  }

  /**
   * Set active tool
   */
  setActiveTool(tool: ToolType): void {
    this.brushService.setTool(tool);
    this.setState({ activeTool: tool }, { type: 'colors' });
  }

  /**
   * Update brush settings
   */
  setBrushSettings(settings: Partial<BrushSettings>): void {
    const newSettings = { ...this.state.brushSettings, ...settings };
    this.brushService.setBrushConfig(newSettings);

    // Slider values need 'brush' hint (no panel rebuild, keep focus)
    const isSliderChange =
      'value' in settings || 'radius' in settings || 'strength' in settings;

    // Buttons/dropdowns need 'ui' hint (panel rebuild for visual update)
    const hint: RenderHint = isSliderChange ? { type: 'brush' } : { type: 'ui' };

    this.setState({ brushSettings: newSettings }, hint);
  }

  // ─────────────────────────────────────────────────────────────
  // Brush Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Begin a brush stroke
   */
  beginBrushStroke(): void {
    this.brushService.beginStroke();
  }

  /**
   * Apply brush at a coordinate
   */
  applyBrush(coord: HexCoordinate): void {
    if (!this.mapData) return;

    const result = this.brushService.applyBrush(coord, this.mapData);

    if (result.modifiedKeys.length > 0) {
      // Apply updates to local map data
      for (const [key, update] of result.updatedTiles) {
        const tile = this.mapData.tiles[key];
        if (tile) {
          Object.assign(tile, update);
        }
      }

      this.setState(
        { isDirty: true },
        { type: 'tiles', coords: result.modifiedKeys }
      );
    }
  }

  /**
   * End the current brush stroke
   */
  async endBrushStroke(): Promise<void> {
    if (this.mapData) {
      // Pass current tiles for undo snapshot
      this.brushService.endStroke(this.mapData.tiles);
    }

    // Use setState to properly trigger UI update for undo/redo buttons
    this.setState({}, { type: 'ui' });
  }

  /**
   * Get brush preview coordinates
   */
  getBrushPreview(coord: HexCoordinate) {
    if (!this.mapData) return [];
    return this.brushService.getBrushPreview(coord, this.mapData);
  }

  // ─────────────────────────────────────────────────────────────
  // Inspector Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Select a tile for inspection
   */
  selectTile(coord: HexCoordinate | null): void {
    this.setState({ selectedCoord: coord }, { type: 'selection' });
  }

  /**
   * Set hovered tile (for preview)
   */
  setHoverCoord(coord: HexCoordinate | null): void {
    if (
      coord?.q === this.state.hoverCoord?.q &&
      coord?.r === this.state.hoverCoord?.r
    ) {
      return; // No change
    }
    this.setState({ hoverCoord: coord }, { type: 'brush' });
  }

  /**
   * Get tile data at coordinate
   */
  getTileAt(coord: HexCoordinate): HexTileData | null {
    if (!this.mapData) return null;
    const key = coordToKey(coord);
    return this.mapData.tiles[key] ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // Camera Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Pan the camera
   */
  pan(deltaX: number, deltaY: number): void {
    const camera: CameraState = {
      ...this.state.camera,
      panX: this.state.camera.panX + deltaX,
      panY: this.state.camera.panY + deltaY,
    };
    this.setState({ camera }, { type: 'camera' });
  }

  /**
   * Zoom the camera at a point
   */
  zoom(
    delta: number,
    anchorX: number,
    anchorY: number,
    viewportCenterX: number,
    viewportCenterY: number
  ): void {
    const newZoom = clampZoom(
      calculateWheelZoom(delta, this.state.camera.zoom)
    );

    const camera = zoomAtPoint(
      this.state.camera,
      newZoom,
      anchorX,
      anchorY,
      viewportCenterX,
      viewportCenterY
    );

    this.setState({ camera }, { type: 'camera' });
  }

  /**
   * Reset camera to default
   */
  resetCamera(): void {
    this.setState({ camera: { ...DEFAULT_CAMERA } }, { type: 'camera' });
  }

  // ─────────────────────────────────────────────────────────────
  // Undo/Redo
  // ─────────────────────────────────────────────────────────────

  /**
   * Undo last operation
   */
  undo(): void {
    const changes = this.undoService.undo();
    if (changes && this.mapData) {
      // Apply reverted changes
      for (const [key, tile] of changes) {
        this.mapData.tiles[key] = { ...tile };
      }

      // Use 'full' to update both tiles and UI buttons
      this.setState({ isDirty: true }, { type: 'full' });
    }
  }

  /**
   * Redo last undone operation
   */
  redo(): void {
    const changes = this.undoService.redo();
    if (changes && this.mapData) {
      // Apply changes
      for (const [key, tile] of changes) {
        this.mapData.tiles[key] = { ...tile };
      }

      // Use 'full' to update both tiles and UI buttons
      this.setState({ isDirty: true }, { type: 'full' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Terrain
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all available terrains
   */
  getTerrains() {
    return this.geographyFeature.listTerrains();
  }

  /**
   * Get terrain registry as record
   */
  getTerrainRegistry(): Record<string, { id: string; name: string; color: string }> {
    const terrains = this.geographyFeature.listTerrains();
    const registry: Record<string, { id: string; name: string; color: string }> = {};
    for (const t of terrains) {
      registry[t.id] = { id: t.id, name: t.name, color: t.color };
    }
    return registry;
  }

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.listeners.clear();
    this.undoService.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new viewmodel instance
 */
export function createCartographerViewModel(
  geographyFeature: GeographyFeaturePort,
  eventBus: EventBus
): CartographerViewModel {
  return new CartographerViewModel(geographyFeature, eventBus);
}
