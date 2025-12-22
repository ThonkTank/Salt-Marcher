/**
 * Layer-Control Panel Component.
 *
 * Task #2564: Panel skeleton with placeholders for subtasks.
 * Spec: Cartographer.md#layer-control
 *
 * Subtasks:
 * - #2565: Overland Layers Liste
 * - #2566: Dungeon Layers Liste
 * - #2567: Visibility Toggle
 * - #2568: Lock Toggle
 * - #2569: Opacity Slider
 * - #2570: Show All / Hide All
 */

import type { CartographerState, LayerId } from '../types';

// ============================================================================
// Panel Interface
// ============================================================================

/**
 * Layer-Control panel interface.
 * Follows panel pattern from session-runner/panels/.
 */
export interface LayerControlPanel {
  /**
   * Update the panel with new state.
   * Called when CartographerState changes with 'layers' hint.
   */
  update(state: Readonly<CartographerState>): void;

  /**
   * Dispose the panel and clean up event listeners.
   */
  dispose(): void;
}

/**
 * Callbacks for user interactions with the Layer-Control panel.
 * Implementation delegated to subtasks.
 */
export interface LayerControlPanelCallbacks {
  /** Toggle layer visibility (#2567) */
  onToggleVisibility: (layerId: LayerId) => void;
  /** Toggle layer lock (#2568) */
  onToggleLock: (layerId: LayerId) => void;
  /** Set layer opacity (#2569) */
  onSetOpacity: (layerId: LayerId, opacity: number) => void;
  /** Show all layers (#2570) */
  onShowAll: () => void;
  /** Hide all layers (#2570) */
  onHideAll: () => void;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Layer-Control panel.
 *
 * @param container - Parent element to mount the panel in
 * @param callbacks - Callbacks for user interactions
 * @returns LayerControlPanel instance
 */
export function createLayerControlPanel(
  container: HTMLElement,
  _callbacks: LayerControlPanelCallbacks
): LayerControlPanel {
  // Create main panel element
  const panelEl = document.createElement('div');
  panelEl.className = 'layer-control-panel';
  panelEl.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
  `;
  container.appendChild(panelEl);

  // Create header
  const headerEl = document.createElement('div');
  headerEl.className = 'layer-control-header';
  headerEl.style.cssText = `
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
  `;
  headerEl.textContent = 'LAYERS';
  panelEl.appendChild(headerEl);

  // Create placeholder for layer list (#2565/#2566)
  const layerListEl = document.createElement('div');
  layerListEl.className = 'layer-list-placeholder';
  layerListEl.style.cssText = `
    flex: 1;
    color: var(--text-muted);
    font-size: 10px;
  `;
  layerListEl.textContent = 'Layer list (#2565/#2566)';
  panelEl.appendChild(layerListEl);

  // Create placeholder for opacity slider (#2569)
  const opacityEl = document.createElement('div');
  opacityEl.className = 'layer-opacity-placeholder';
  opacityEl.style.cssText = `
    color: var(--text-muted);
    font-size: 10px;
  `;
  opacityEl.textContent = 'Opacity (#2569)';
  panelEl.appendChild(opacityEl);

  // Create placeholder for bulk actions (#2570)
  const bulkActionsEl = document.createElement('div');
  bulkActionsEl.className = 'layer-bulk-actions-placeholder';
  bulkActionsEl.style.cssText = `
    color: var(--text-muted);
    font-size: 10px;
  `;
  bulkActionsEl.textContent = 'Show/Hide All (#2570)';
  panelEl.appendChild(bulkActionsEl);

  // Return panel interface
  return {
    update(state: Readonly<CartographerState>): void {
      // Update header based on map type
      const title = state.mapType === 'dungeon' ? 'DUNGEON LAYERS' : 'LAYERS';
      headerEl.textContent = title;

      // Update layer list placeholder with context
      if (state.mapType === 'overworld') {
        layerListEl.textContent = `Overland layers (${state.visibleLayers.length} visible) (#2565)`;
      } else if (state.mapType === 'dungeon') {
        layerListEl.textContent = `Dungeon layers (${state.visibleLayers.length} visible) (#2566)`;
      } else {
        layerListEl.textContent = 'No map loaded';
      }
    },

    dispose(): void {
      // Remove panel from DOM
      panelEl.remove();
    },
  };
}
