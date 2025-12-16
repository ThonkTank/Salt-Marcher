/**
 * Cartographer View
 *
 * Obsidian ItemView that renders the hex map editor.
 * Extends BaseToolView for standardized lifecycle management.
 */

import type { WorkspaceLeaf } from 'obsidian';
import type { GeographyFeaturePort } from '@/features/geography';
import type { EventBus } from '@core/events/event-bus';
import type { ColorMode } from '@shared/map';
import type { CoordKey } from '@core/schemas/hex-geometry';
import {
  styleTopBar,
  createFlexContainer,
  styleMapContainer,
  createSidePanel,
} from '@shared/layout';
import { BaseToolView } from '@shared/view';

import { CartographerViewModel, createCartographerViewModel } from './viewmodel';
import { HexCanvas, createHexCanvas } from './panels/hex-canvas';
import { Toolbar, createToolbar } from './panels/toolbar';
import { ToolPanel, createToolPanel } from './panels/tool-panel';
import {
  showNewMapDialog,
  showOpenMapDialog,
  showDeleteMapDialog,
  showUnsavedChangesDialog,
} from './panels/map-dialogs';
import { hitTestHex, getMousePosition } from '@shared/map';
import type { CartographerState, ToolType } from './types';

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

export const CARTOGRAPHER_VIEW_TYPE = 'cartographer-view';

// ═══════════════════════════════════════════════════════════════
// Dependencies Interface
// ═══════════════════════════════════════════════════════════════

interface CartographerDeps {
  geographyFeature: GeographyFeaturePort;
  eventBus: EventBus;
}

// ═══════════════════════════════════════════════════════════════
// Cartographer View
// ═══════════════════════════════════════════════════════════════

export class CartographerView extends BaseToolView<CartographerState, CartographerViewModel> {
  // ─────────────────────────────────────────────────────────────
  // BaseToolView Abstract Properties
  // ─────────────────────────────────────────────────────────────

  protected readonly viewType = CARTOGRAPHER_VIEW_TYPE;
  protected readonly displayText = 'Cartographer';
  protected readonly iconName = 'map';
  protected viewModel!: CartographerViewModel;

  // ─────────────────────────────────────────────────────────────
  // View-Specific State
  // ─────────────────────────────────────────────────────────────

  private deps: CartographerDeps;
  private hexCanvas!: HexCanvas;
  private toolbar!: Toolbar;
  private toolPanel!: ToolPanel;

  // Mouse state
  private isPanning = false;
  private isPainting = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor(leaf: WorkspaceLeaf, deps: CartographerDeps) {
    super(leaf);
    this.deps = deps;
  }

  // ─────────────────────────────────────────────────────────────
  // BaseToolView Hooks
  // ─────────────────────────────────────────────────────────────

  protected getContainerClass(): string {
    return 'cartographer-container';
  }

  protected onCreateViewModel(): void {
    this.viewModel = createCartographerViewModel(
      this.deps.geographyFeature,
      this.deps.eventBus
    );
  }

  protected createLayout(container: HTMLElement): void {
    // Header with toolbar
    const header = container.createDiv('cartographer-header');
    styleTopBar(header);
    this.toolbar = this.registerComponent(
      createToolbar(header, {
        onOpen: () => this.handleOpen(),
        onNew: () => this.handleNew(),
        onSave: () => this.handleSave(),
        onDelete: () => this.handleDelete(),
      })
    );

    // Main content area (flex row)
    const main = createFlexContainer(container, 'cartographer-main', 'row');

    // Canvas container (left side)
    const canvasContainer = main.createDiv('cartographer-canvas-container');
    styleMapContainer(canvasContainer);
    this.hexCanvas = this.registerComponent(createHexCanvas(canvasContainer));
    this.setupCanvasEvents(this.hexCanvas.getSvgElement());

    // Tool panel (right side, fixed width)
    const panelContainer = createSidePanel(main, 'cartographer-panel-container', 280, 'right');
    this.toolPanel = this.registerComponent(
      createToolPanel(panelContainer, {
        onModeChange: (mode) => this.viewModel.setToolMode(mode),
        onToolChange: (tool) => this.viewModel.setActiveTool(tool),
        onBrushSettingsChange: (settings) => this.viewModel.setBrushSettings(settings),
        onUndo: () => this.viewModel.undo(),
        onRedo: () => this.viewModel.redo(),
      })
    );

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  protected setupSubscriptions(): void {
    this.registerSubscription(
      this.viewModel.subscribe((state) => this.onStateChange(state))
    );
  }

  protected onDispose(): void {
    // Check for unsaved changes
    const state = this.viewModel.getState();
    if (state.isDirty) {
      console.warn('[Cartographer] Closing with unsaved changes');
    }
    this.viewModel.dispose();
  }

  // ─────────────────────────────────────────────────────────────
  // Override getDisplayText for dynamic title
  // ─────────────────────────────────────────────────────────────

  override getDisplayText(): string {
    const state = this.viewModel?.getState();
    return state?.mapName ? `Cartographer: ${state.mapName}` : 'Cartographer';
  }

  // ─────────────────────────────────────────────────────────────
  // RenderHint Handlers
  // ─────────────────────────────────────────────────────────────

  protected override onRenderFull(state: CartographerState): void {
    this.updateToolbar(state);
    this.updateToolPanel(state);
    const mapData = this.viewModel.getMapData();
    if (mapData) {
      this.hexCanvas.setTerrainRegistry(this.viewModel.getTerrainRegistry());
      this.hexCanvas.setColorMode(this.getColorMode(state.activeTool));
      this.hexCanvas.renderFull(mapData);
      this.hexCanvas.applyCamera(state.camera);
    }
  }

  protected override onRenderCamera(state: CartographerState): void {
    this.hexCanvas.applyCamera(state.camera);
  }

  protected override onRenderTiles(state: CartographerState, coords: CoordKey[]): void {
    const mapData = this.viewModel.getMapData();
    if (mapData) {
      this.hexCanvas.updateTiles(coords, mapData.tiles);
    }
  }

  protected override onRenderColors(state: CartographerState): void {
    this.updateToolPanel(state);
    const mapData = this.viewModel.getMapData();
    if (mapData) {
      this.hexCanvas.setColorMode(this.getColorMode(state.activeTool));
      this.hexCanvas.updateAllColors(mapData.tiles);
    }
  }

  protected override onRenderBrush(state: CartographerState): void {
    // NO tool panel update - user is dragging slider!
    const mapData = this.viewModel.getMapData();
    if (mapData && state.hoverCoord && state.toolMode === 'brush') {
      const preview = this.viewModel.getBrushPreview(state.hoverCoord);
      this.hexCanvas.updateBrushPreview(preview);
    } else {
      this.hexCanvas.clearOverlay();
    }
  }

  protected override onRenderSelection(state: CartographerState): void {
    this.hexCanvas.clearOverlay();
    if (state.selectedCoord) {
      this.hexCanvas.showSelectionHighlight(state.selectedCoord);
    }
  }

  protected override onRenderUI(state: CartographerState): void {
    this.updateToolbar(state);
    this.updateToolPanel(state);
  }

  // ─────────────────────────────────────────────────────────────
  // UI Update Helpers
  // ─────────────────────────────────────────────────────────────

  private updateToolbar(state: CartographerState): void {
    this.toolbar.update({
      mapName: state.mapName,
      isDirty: state.isDirty,
      hasMap: state.mapId !== null,
    });
    // Update display text (trigger header refresh via internal API)
    (this.leaf as { updateHeader?: () => void }).updateHeader?.();
  }

  private updateToolPanel(state: CartographerState): void {
    this.toolPanel.update({
      toolMode: state.toolMode,
      activeTool: state.activeTool,
      brushSettings: state.brushSettings,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      terrains: this.viewModel.getTerrains(),
    });
  }

  private getColorMode(tool: ToolType): ColorMode {
    const modeMap: Record<ToolType, ColorMode> = {
      terrain: 'terrain',
      elevation: 'elevation',
      temperature: 'temperature',
      precipitation: 'precipitation',
      clouds: 'clouds',
      wind: 'wind',
      resize: 'terrain',
    };
    return modeMap[tool];
  }

  // ─────────────────────────────────────────────────────────────
  // Event Handling
  // ─────────────────────────────────────────────────────────────

  private setupCanvasEvents(svg: SVGSVGElement): void {
    // Mouse down
    svg.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        // Middle click - start panning
        this.isPanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        e.preventDefault();
      } else if (e.button === 0) {
        // Left click
        const state = this.viewModel.getState();
        if (state.toolMode === 'brush') {
          this.isPainting = true;
          this.viewModel.beginBrushStroke();
          this.handleBrushAt(e);
        } else {
          this.handleInspectorClick(e);
        }
      }
    });

    // Mouse move
    svg.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        this.viewModel.pan(deltaX, deltaY);
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else if (this.isPainting) {
        this.handleHover(e);   // Update brush preview position
        this.handleBrushAt(e);
      } else {
        this.handleHover(e);
      }
    });

    // Mouse up
    svg.addEventListener('mouseup', async (e) => {
      if (e.button === 1) {
        this.isPanning = false;
      } else if (e.button === 0 && this.isPainting) {
        this.isPainting = false;
        await this.viewModel.endBrushStroke();
      }
    });

    // Mouse leave
    svg.addEventListener('mouseleave', async () => {
      if (this.isPanning) {
        this.isPanning = false;
      }
      if (this.isPainting) {
        this.isPainting = false;
        await this.viewModel.endBrushStroke();
      }
      this.viewModel.setHoverCoord(null);
    });

    // Wheel for zoom
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const pos = getMousePosition(e, svg);
      const { width, height } = this.hexCanvas.getViewportSize();
      this.viewModel.zoom(e.deltaY, pos.x, pos.y, width / 2, height / 2);
    });

    // Prevent context menu on middle click
    svg.addEventListener('contextmenu', (e) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    });
  }

  private setupKeyboardShortcuts(): void {
    this.registerDomEvent(document, 'keydown', (e) => {
      // Only handle if this view is active
      if (!this.containerEl.contains(document.activeElement)) return;

      // Undo/Redo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        this.viewModel.undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        this.viewModel.redo();
      }

      // Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.handleSave();
      }

      // Tool shortcuts
      const toolKeys: Record<string, ToolType> = {
        '1': 'terrain',
        '2': 'elevation',
        '3': 'temperature',
        '4': 'precipitation',
        '5': 'clouds',
        '6': 'wind',
        '7': 'resize',
      };
      if (toolKeys[e.key]) {
        this.viewModel.setActiveTool(toolKeys[e.key]);
      }

      // Mode shortcuts
      if (e.key === 'b') {
        this.viewModel.setToolMode('brush');
      }
      if (e.key === 'i') {
        this.viewModel.setToolMode('inspector');
      }
    });
  }

  private handleBrushAt(e: MouseEvent): void {
    const mapData = this.viewModel.getMapData();
    if (!mapData) return;

    const state = this.viewModel.getState();
    const svg = this.hexCanvas.getSvgElement();
    const pos = getMousePosition(e, svg);
    const { width, height } = this.hexCanvas.getViewportSize();

    const result = hitTestHex(
      pos.x,
      pos.y,
      state.camera,
      mapData.metadata.hexSize ?? 42,
      width / 2,
      height / 2
    );

    this.viewModel.applyBrush(result.coord);
  }

  private handleInspectorClick(e: MouseEvent): void {
    const mapData = this.viewModel.getMapData();
    if (!mapData) return;

    const state = this.viewModel.getState();
    const svg = this.hexCanvas.getSvgElement();
    const pos = getMousePosition(e, svg);
    const { width, height } = this.hexCanvas.getViewportSize();

    const result = hitTestHex(
      pos.x,
      pos.y,
      state.camera,
      mapData.metadata.hexSize ?? 42,
      width / 2,
      height / 2
    );

    // Check if tile exists
    const tile = this.viewModel.getTileAt(result.coord);
    if (tile) {
      this.viewModel.selectTile(result.coord);
    }
  }

  private handleHover(e: MouseEvent): void {
    const mapData = this.viewModel.getMapData();
    if (!mapData) return;

    const state = this.viewModel.getState();
    const svg = this.hexCanvas.getSvgElement();
    const pos = getMousePosition(e, svg);
    const { width, height } = this.hexCanvas.getViewportSize();

    const result = hitTestHex(
      pos.x,
      pos.y,
      state.camera,
      mapData.metadata.hexSize ?? 42,
      width / 2,
      height / 2
    );

    this.viewModel.setHoverCoord(result.coord);
  }

  // ─────────────────────────────────────────────────────────────
  // Dialog Handlers
  // ─────────────────────────────────────────────────────────────

  private async handleOpen(): Promise<void> {
    const state = this.viewModel.getState();

    // Check for unsaved changes
    if (state.isDirty) {
      showUnsavedChangesDialog(this.app, async (action) => {
        if (action === 'save') {
          await this.handleSave();
          this.doOpenDialog();
        } else if (action === 'discard') {
          this.doOpenDialog();
        }
        // cancel does nothing
      });
    } else {
      this.doOpenDialog();
    }
  }

  private async doOpenDialog(): Promise<void> {
    const maps = await this.viewModel.listMaps();
    showOpenMapDialog(this.app, maps, async (mapId) => {
      await this.viewModel.loadMap(mapId);
    });
  }

  private handleNew(): void {
    const state = this.viewModel.getState();

    // Check for unsaved changes
    if (state.isDirty) {
      showUnsavedChangesDialog(this.app, async (action) => {
        if (action === 'save') {
          await this.handleSave();
          this.doNewDialog();
        } else if (action === 'discard') {
          this.doNewDialog();
        }
      });
    } else {
      this.doNewDialog();
    }
  }

  private doNewDialog(): void {
    const terrains = this.viewModel.getTerrains();
    showNewMapDialog(
      this.app,
      terrains.map((t) => ({ id: t.id, name: t.name })),
      async (result) => {
        await this.viewModel.createMap(
          result.name,
          result.radius,
          result.defaultTerrain
        );
      }
    );
  }

  private async handleSave(): Promise<void> {
    await this.viewModel.saveMap();
  }

  private handleDelete(): void {
    const state = this.viewModel.getState();
    if (!state.mapId) return;

    showDeleteMapDialog(this.app, state.mapName, async () => {
      await this.viewModel.deleteMap();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Public Methods (for external command access)
  // ─────────────────────────────────────────────────────────────

  /**
   * Trigger undo from external command
   */
  triggerUndo(): void {
    this.viewModel.undo();
  }

  /**
   * Trigger redo from external command
   */
  triggerRedo(): void {
    this.viewModel.redo();
  }

  /**
   * Trigger save from external command
   */
  triggerSave(): void {
    this.handleSave();
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Create the view factory function for Obsidian
 */
export function createCartographerViewFactory(
  geographyFeature: GeographyFeaturePort,
  eventBus: EventBus
): (leaf: WorkspaceLeaf) => CartographerView {
  return (leaf: WorkspaceLeaf) =>
    new CartographerView(leaf, { geographyFeature, eventBus });
}
