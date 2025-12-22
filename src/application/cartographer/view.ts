/**
 * Cartographer View.
 *
 * Obsidian ItemView that hosts the Cartographer map editor.
 * Layout: Tools (left) + Canvas (center) + Options (bottom) + Layers (bottom-right)
 *
 * Panels are implemented in subsequent tasks:
 * - #2502: Tool-Palette Panel
 * - #2534: Inspector Tool ✅
 * - #2564: Layer-Control Panel ✅
 * - #2517: Map-Canvas Panel
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { Unsubscribe } from '@core/events';
import { VIEW_TYPE_CARTOGRAPHER, type CartographerViewDeps, type CartographerState, type CartographerRenderHint } from './types';
import { createCartographerViewModel, type CartographerViewModel } from './viewmodel';
import { createLayerControlPanel, type LayerControlPanel } from './panels';
import {
  createInspectorToolPanel,
  type InspectorToolPanel,
  createTokenPlacerPanel,
  type TokenPlacerPanel,
} from './tools';

// ============================================================================
// View
// ============================================================================

export class CartographerView extends ItemView {
  private deps: CartographerViewDeps;
  private viewModel: CartographerViewModel | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private layerPanel: LayerControlPanel | null = null;
  private inspectorPanel: InspectorToolPanel | null = null;
  private tokenPlacerPanel: TokenPlacerPanel | null = null;
  private toolsContentEl: HTMLElement | null = null;
  private currentActiveTool: string | null = null;

  constructor(leaf: WorkspaceLeaf, deps: CartographerViewDeps) {
    super(leaf);
    this.deps = deps;
  }

  /**
   * Get the ViewModel instance.
   * Available after onOpen() is called.
   */
  getViewModel(): CartographerViewModel | null {
    return this.viewModel;
  }

  getViewType(): string {
    return VIEW_TYPE_CARTOGRAPHER;
  }

  getDisplayText(): string {
    return 'Cartographer';
  }

  getIcon(): string {
    return 'edit';
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('salt-marcher-cartographer');

    // Create ViewModel
    this.viewModel = createCartographerViewModel({
      eventBus: this.deps.eventBus,
      mapFeature: this.deps.mapFeature,
      notificationService: this.deps.notificationService,
    });

    // Subscribe to state changes
    this.unsubscribe = this.viewModel.subscribe(this.onStateChange.bind(this));

    // Initialize with default map if provided
    if (this.deps.defaultMapId) {
      await this.viewModel.initialize(this.deps.defaultMapId);
    }

    // CSS Grid Layout (based on Cartographer.md wireframe)
    // Layout:
    // ┌──────────┬────────────────────────────┐
    // │  TOOLS   │          CANVAS            │
    // │          │                            │
    // │          ├────────────────┬───────────┤
    // │          │   OPTIONS      │  LAYERS   │
    // └──────────┴────────────────┴───────────┘
    contentEl.style.cssText = `
      display: grid;
      grid-template-areas:
        "tools canvas"
        "tools bottom";
      grid-template-rows: 1fr auto;
      grid-template-columns: auto 1fr;
      height: 100%;
      overflow: hidden;
    `;

    // Create placeholder containers
    this.createToolsContainer(contentEl);
    this.createCanvasContainer(contentEl);
    this.createBottomContainer(contentEl);
  }

  /**
   * Handle state changes from ViewModel.
   * Renders panels based on RenderHints.
   */
  private onStateChange(state: CartographerState, hints: CartographerRenderHint[]): void {
    // Update Layer-Control Panel on 'layers' or 'full' hint
    if (hints.includes('layers') || hints.includes('full')) {
      this.layerPanel?.update(state);
    }

    // Handle tool changes
    if (hints.includes('tool') || hints.includes('full')) {
      this.updateToolPanel(state);
    }

    // Update Inspector on selection changes
    if (hints.includes('selection') || hints.includes('full')) {
      this.inspectorPanel?.update(state);
    }

    if (hints.includes('full')) {
      // Full re-render needed
      this.updatePlaceholders(state);
    }
  }

  /**
   * Update the tool panel based on active tool.
   * Mounts/unmounts tool-specific panels as needed.
   */
  private updateToolPanel(state: CartographerState): void {
    // Skip if tool hasn't changed
    if (this.currentActiveTool === state.activeTool) {
      // Still update the panel if it exists (for option changes)
      this.inspectorPanel?.update(state);
      this.tokenPlacerPanel?.update(state);
      return;
    }

    // Dispose current tool panels
    if (this.inspectorPanel) {
      this.inspectorPanel.dispose();
      this.inspectorPanel = null;
    }
    if (this.tokenPlacerPanel) {
      this.tokenPlacerPanel.dispose();
      this.tokenPlacerPanel = null;
    }

    // Mount new tool panel
    if (state.activeTool === 'inspector' && this.toolsContentEl) {
      this.inspectorPanel = createInspectorToolPanel(
        this.toolsContentEl,
        {
          onChangeTerrain: () => {
            this.deps.notificationService.info('Change Terrain: Coming soon...');
          },
          onEditElevation: () => {
            this.deps.notificationService.info('Edit Elevation: Coming soon...');
          },
          onEditClimateOverride: () => {
            this.deps.notificationService.info('Edit Climate Override: Coming soon...');
          },
          onAddFeature: () => {
            this.deps.notificationService.info('Add Feature: Coming soon...');
          },
          onRemoveFeature: () => {
            this.deps.notificationService.info('Remove Feature: Coming soon...');
          },
          onNavigateToLocation: (locationId) => {
            this.deps.notificationService.info(`Navigate to Location ${locationId}: Coming soon...`);
          },
        },
        {
          mapFeature: this.deps.mapFeature,
        }
      );

      // Initial update with current state
      this.inspectorPanel.update(state);
    } else if (state.activeTool === 'token-placer' && this.toolsContentEl && this.deps.entityRegistry) {
      this.tokenPlacerPanel = createTokenPlacerPanel(
        this.toolsContentEl,
        {
          onTokenTypeChange: (type) => {
            this.viewModel?.setToolOption('tokenType', type);
          },
          onCreatureSelect: (creatureId) => {
            this.viewModel?.setToolOption('selectedCreatureId', creatureId);
          },
          onCreatureSearch: () => {
            // Search is handled internally by the panel
          },
          onSizeChange: (size) => {
            this.viewModel?.setToolOption('selectedCreatureSize', size);
          },
          onObjectSelect: (objectType) => {
            this.viewModel?.setToolOption('selectedObjectType', objectType);
          },
          onLightSourceChange: (source) => {
            this.viewModel?.setToolOption('lightSource', source);
          },
          onLightRadiusChange: (radius) => {
            this.viewModel?.setToolOption('lightRadius', radius);
          },
          onLightColorSelect: (color) => {
            this.viewModel?.setToolOption('lightColor', color);
          },
          onFlickerToggle: (enabled) => {
            this.viewModel?.setToolOption('lightFlicker', enabled);
          },
          onBrowseLibrary: () => {
            this.deps.notificationService.info('Browse Library: Coming soon...');
          },
        },
        {
          entityRegistry: this.deps.entityRegistry,
        }
      );

      // Initial update with current state
      this.tokenPlacerPanel.update(state);
    }

    this.currentActiveTool = state.activeTool;
  }

  /**
   * Update placeholder content with current state.
   * Will be replaced by real panels in subsequent tasks.
   */
  private updatePlaceholders(state: CartographerState): void {
    const canvasPlaceholder = this.contentEl.querySelector('.cartographer-canvas span');
    if (canvasPlaceholder) {
      if (state.activeMapId) {
        canvasPlaceholder.textContent = `Map: ${state.activeMapId} (${state.mapType ?? 'unknown'})`;
      } else {
        canvasPlaceholder.textContent = 'No map loaded - Map canvas will be implemented in #2517';
      }
    }
  }

  async onClose(): Promise<void> {
    // Unsubscribe from state changes
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Dispose Inspector Tool Panel
    if (this.inspectorPanel) {
      this.inspectorPanel.dispose();
      this.inspectorPanel = null;
    }

    // Dispose Token-Placer Tool Panel
    if (this.tokenPlacerPanel) {
      this.tokenPlacerPanel.dispose();
      this.tokenPlacerPanel = null;
    }

    // Dispose Layer-Control Panel
    if (this.layerPanel) {
      this.layerPanel.dispose();
      this.layerPanel = null;
    }

    // Dispose ViewModel
    if (this.viewModel) {
      this.viewModel.dispose();
      this.viewModel = null;
    }

    // Reset state
    this.toolsContentEl = null;
    this.currentActiveTool = null;

    // Clear content
    const { contentEl } = this;
    contentEl.empty();
  }

  // ============================================================================
  // Container Creation (Placeholders)
  // ============================================================================

  private createToolsContainer(parent: HTMLElement): HTMLElement {
    const container = parent.createDiv('cartographer-tools');
    container.style.cssText = `
      grid-area: tools;
      width: 200px;
      border-right: 1px solid var(--background-modifier-border);
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
    `;

    // Tool Palette Header (placeholder for #2502)
    const paletteHeader = container.createDiv('tool-palette-header');
    paletteHeader.style.cssText = `
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
    `;
    paletteHeader.createEl('span', {
      text: 'Tool palette: #2502',
      cls: 'mod-muted',
    });

    // Tool Content Area (where tool-specific panels are mounted)
    const toolContent = container.createDiv('tool-content');
    toolContent.style.cssText = `
      flex: 1;
    `;
    this.toolsContentEl = toolContent;

    return container;
  }

  private createCanvasContainer(parent: HTMLElement): HTMLElement {
    const container = parent.createDiv('cartographer-canvas');
    container.style.cssText = `
      grid-area: canvas;
      position: relative;
      overflow: hidden;
      background: var(--background-secondary);
    `;

    // Placeholder content
    const placeholder = container.createDiv();
    placeholder.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-muted);
    `;
    placeholder.createEl('span', {
      text: 'Map canvas will be implemented in #2517',
    });

    return container;
  }

  private createBottomContainer(parent: HTMLElement): HTMLElement {
    const container = parent.createDiv('cartographer-bottom');
    container.style.cssText = `
      grid-area: bottom;
      display: grid;
      grid-template-columns: 1fr auto;
      border-top: 1px solid var(--background-modifier-border);
    `;

    // Options section
    const options = container.createDiv('cartographer-options');
    options.style.cssText = `
      padding: 8px;
      border-right: 1px solid var(--background-modifier-border);
    `;
    options.createEl('span', {
      text: 'Tool options - context dependent',
      cls: 'mod-muted',
    });

    // Layers section - Layer-Control Panel (#2564)
    const layers = container.createDiv('cartographer-layers');
    layers.style.cssText = `
      padding: 8px;
      width: 150px;
    `;

    // Mount Layer-Control Panel
    this.layerPanel = createLayerControlPanel(layers, {
      // Callbacks prepared for subtasks - no-op implementations for now
      onToggleVisibility: () => {
        // #2567: Will call this.viewModel?.toggleLayerVisibility(id)
      },
      onToggleLock: () => {
        // #2568: Will call this.viewModel?.toggleLayerLock(id)
      },
      onSetOpacity: () => {
        // #2569: Will call this.viewModel?.setLayerOpacity(id, opacity)
      },
      onShowAll: () => {
        // #2570: Will call this.viewModel?.showAllLayers()
      },
      onHideAll: () => {
        // #2570: Will call this.viewModel?.hideAllLayers()
      },
    });

    return container;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Factory function for view registration.
 * Enables dependency injection when registering with Obsidian.
 */
export function createCartographerViewFactory(deps: CartographerViewDeps) {
  return (leaf: WorkspaceLeaf) => new CartographerView(leaf, deps);
}
