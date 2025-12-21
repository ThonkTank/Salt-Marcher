/**
 * SessionRunner View.
 *
 * Obsidian ItemView that hosts the SessionRunner panels.
 * Layout: Header (top) + Sidebar (left) + Map (center)
 */

import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { MapId, PartyId } from '@core/index';
import type { TerrainStoragePort } from '@/features/map';
import { EventTypes, createEvent, newCorrelationId } from '@core/events';
import { now } from '@core/types';
import { VIEW_TYPE_SESSION_RUNNER } from './types';
import {
  createSessionRunnerViewModel,
  type SessionRunnerViewModelDeps,
} from './viewmodel';
import {
  createMapCanvas,
  createHeaderPanel,
  createSidebarPanel,
} from './panels';
import type {
  MapCanvasPanel,
  HeaderPanel,
  HeaderPanelCallbacks,
  SidebarPanel,
  SidebarPanelCallbacks,
} from './panels';

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
  private headerPanel: HeaderPanel | null = null;
  private sidebarPanel: SidebarPanel | null = null;
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
    contentEl.addClass('salt-marcher-session-runner');

    // CSS Grid Layout
    contentEl.style.cssText = `
      display: grid;
      grid-template-areas:
        "header header"
        "sidebar map";
      grid-template-rows: auto 1fr;
      grid-template-columns: auto 1fr;
      height: 100%;
      overflow: hidden;
    `;

    // Create ViewModel
    this.viewModel = createSessionRunnerViewModel({
      mapFeature: this.deps.mapFeature,
      partyFeature: this.deps.partyFeature,
      travelFeature: this.deps.travelFeature,
      timeFeature: this.deps.timeFeature,
      notificationService: this.deps.notificationService,
      eventBus: this.deps.eventBus,
      weatherFeature: this.deps.weatherFeature,
      encounterFeature: this.deps.encounterFeature,
      questFeature: this.deps.questFeature,
    });

    // === Header ===
    const headerContainer = contentEl.createDiv('header-container');
    headerContainer.style.gridArea = 'header';
    this.headerPanel = createHeaderPanel(
      headerContainer,
      this.createHeaderCallbacks()
    );

    // === Sidebar ===
    const sidebarContainer = contentEl.createDiv('sidebar-container');
    sidebarContainer.style.gridArea = 'sidebar';
    this.sidebarPanel = createSidebarPanel(
      sidebarContainer,
      this.createSidebarCallbacks()
    );

    // === Map ===
    const mapContainer = contentEl.createDiv('map-container');
    mapContainer.style.cssText = `
      grid-area: map;
      position: relative;
      overflow: hidden;
    `;
    this.mapCanvas = createMapCanvas(mapContainer, {
      terrainStorage: this.deps.terrainStorage,
      callbacks: {
        onTileClick: (coord) => this.viewModel?.onTileClick(coord),
        onTileHover: (coord) => this.viewModel?.onTileHover(coord),
        onPan: (dx, dy) => this.viewModel?.onPan(dx, dy),
        onZoom: (delta) => this.viewModel?.onZoom(delta),
      },
    });

    // Subscribe to ViewModel updates
    this.unsubscribe = this.viewModel.subscribe((state, hints) => {
      // Update all panels based on hints
      if (hints.includes('full') || hints.includes('header')) {
        this.headerPanel?.update(state);
      }
      if (hints.includes('full') || hints.includes('sidebar')) {
        this.sidebarPanel?.update(state);
      }
      // Map canvas handles its own hint filtering
      this.mapCanvas?.render(state, hints);
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
    this.headerPanel?.dispose();
    this.sidebarPanel?.dispose();
    this.viewModel?.dispose();

    this.unsubscribe = null;
    this.mapCanvas = null;
    this.headerPanel = null;
    this.sidebarPanel = null;
    this.viewModel = null;
  }

  // =========================================================================
  // Callbacks
  // =========================================================================

  /**
   * Create header panel callbacks.
   */
  private createHeaderCallbacks(): HeaderPanelCallbacks {
    return {
      onMenuClick: () => {
        this.viewModel?.onToggleSidebar();
        const collapsed = this.viewModel?.getState().sidebarCollapsed ?? false;
        this.sidebarPanel?.setCollapsed(collapsed);
      },

      onTimePrev: () => {
        this.viewModel?.onTimeAdvance(-1);
      },

      onTimeNext: () => {
        this.viewModel?.onTimeAdvance(1);
      },

      onSettingsClick: () => {
        // Placeholder for settings
        console.log('Settings clicked');
      },
    };
  }

  /**
   * Create sidebar panel callbacks.
   */
  private createSidebarCallbacks(): SidebarPanelCallbacks {
    const eventBus = this.deps.eventBus;

    const eventOptions = () => ({
      correlationId: newCorrelationId(),
      timestamp: now(),
      source: 'session-runner-view',
    });

    return {
      // Travel Planning
      onToggleTravelMode: () => {
        this.viewModel?.toggleTravelMode();
      },

      onStartTravel: () => {
        this.viewModel?.startPlannedTravel();
      },

      onPauseTravel: () => {
        this.viewModel?.pauseTravel();
      },

      onResumeTravel: () => {
        this.viewModel?.resumeTravel();
      },

      onCancelTravel: () => {
        this.viewModel?.cancelTravel();
      },

      // Actions
      onGenerateEncounter: () => {
        const partyPosition = this.viewModel?.getState().partyPosition;
        if (!partyPosition) return;

        eventBus?.publish(
          createEvent(
            EventTypes.ENCOUNTER_GENERATE_REQUESTED,
            {
              position: partyPosition,
              trigger: 'manual' as const,
            },
            eventOptions()
          )
        );
      },

      onTeleport: () => {
        // Placeholder for teleport mode
        console.log('Teleport clicked');
      },

      // Party Management
      onManageParty: () => {
        // Show "Coming soon" notification
        this.deps.notificationService.info('Party Management coming soon!');
      },

      // Quest Management
      onQuestStatusFilterChange: (filter) => {
        this.viewModel?.onStatusFilterChange(filter);
      },

      onActivateQuest: (questId) => {
        this.viewModel?.onActivateQuest(questId);
      },

      onCompleteQuest: (questId) => {
        this.viewModel?.onCompleteQuest(questId);
      },

      onFailQuest: (questId) => {
        this.viewModel?.onFailQuest(questId);
      },

      onToggleObjective: (questId, objectiveId) => {
        this.viewModel?.onToggleObjective(questId, objectiveId);
      },
    };
  }
}

/**
 * Factory function for view registration.
 */
export function createSessionRunnerViewFactory(deps: SessionRunnerViewDeps) {
  return (leaf: WorkspaceLeaf) => new SessionRunnerView(leaf, deps);
}
