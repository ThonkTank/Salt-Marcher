/**
 * SessionRunner View.
 *
 * Obsidian ItemView that hosts the SessionRunner panels.
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { MapId, PartyId } from '@core/index';
import type { TerrainStoragePort } from '@/features/map';
import { VIEW_TYPE_SESSION_RUNNER } from './types';
import {
  createSessionRunnerViewModel,
  type SessionRunnerViewModelDeps,
} from './viewmodel';
import { createMapCanvas, createControlsPanel } from './panels';
import type { MapCanvasPanel, ControlsPanel } from './panels';

// ============================================================================
// View Dependencies
// ============================================================================

export interface SessionRunnerViewDeps extends SessionRunnerViewModelDeps {
  terrainStorage: TerrainStoragePort;
  defaultMapId: MapId;
  defaultPartyId: PartyId;
}

// ============================================================================
// View
// ============================================================================

export class SessionRunnerView extends ItemView {
  private deps: SessionRunnerViewDeps;
  private viewModel: ReturnType<typeof createSessionRunnerViewModel> | null = null;
  private mapCanvas: MapCanvasPanel | null = null;
  private controlsPanel: ControlsPanel | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, deps: SessionRunnerViewDeps) {
    super(leaf);
    this.deps = deps;
  }

  getViewType(): string {
    return VIEW_TYPE_SESSION_RUNNER;
  }

  getDisplayText(): string {
    return 'Session Runner';
  }

  getIcon(): string {
    return 'map';
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    // Container setup
    contentEl.addClass('salt-marcher-session-runner');
    contentEl.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;

    // Create ViewModel
    this.viewModel = createSessionRunnerViewModel({
      mapFeature: this.deps.mapFeature,
      partyFeature: this.deps.partyFeature,
      travelFeature: this.deps.travelFeature,
    });

    // Create panels
    this.mapCanvas = createMapCanvas(contentEl, {
      terrainStorage: this.deps.terrainStorage,
      callbacks: {
        onTileClick: (coord) => this.viewModel?.onTileClick(coord),
        onTileHover: (coord) => this.viewModel?.onTileHover(coord),
        onPan: (dx, dy) => this.viewModel?.onPan(dx, dy),
        onZoom: (delta) => this.viewModel?.onZoom(delta),
      },
    });

    this.controlsPanel = createControlsPanel(contentEl, {
      terrainStorage: this.deps.terrainStorage,
    });

    // Subscribe to ViewModel updates
    this.unsubscribe = this.viewModel.subscribe((state, hints) => {
      this.mapCanvas?.render(state, hints);
      this.controlsPanel?.update(state, this.viewModel?.getLastTravel() ?? null);
    });

    // Initialize with default map and party
    await this.viewModel.initialize(
      this.deps.defaultMapId,
      this.deps.defaultPartyId
    );
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.mapCanvas?.dispose();
    this.controlsPanel?.dispose();
    this.viewModel?.dispose();

    this.unsubscribe = null;
    this.mapCanvas = null;
    this.controlsPanel = null;
    this.viewModel = null;
  }
}

/**
 * Factory function for view registration.
 */
export function createSessionRunnerViewFactory(deps: SessionRunnerViewDeps) {
  return (leaf: WorkspaceLeaf) => new SessionRunnerView(leaf, deps);
}
