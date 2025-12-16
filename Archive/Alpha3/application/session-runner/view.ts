/**
 * SessionRunner View
 *
 * Main Obsidian ItemView for running game sessions.
 * Displays hex map with travel route, party token, and sidebar panels.
 *
 * Extends BaseToolView for automatic subscription/component cleanup
 * and RenderHint dispatch system.
 */

import type { WorkspaceLeaf, Workspace } from 'obsidian';
import type { HexCoordinate } from '@core/schemas/coordinates';
import { hexToPixel } from '@core/schemas/hex-geometry';
import type { EventBus } from '@core/events/event-bus';
import type { GeographyFeaturePort } from '@/features/geography';
import type { TimeFeaturePort } from '@/features/time';
import { hitTestHex, getMousePosition, screenToWorld } from '@shared/map';
import {
  styleTopBar,
  createFlexContainer,
  styleMapContainer,
  createSidePanel,
} from '@shared/layout';
import { BaseToolView } from '@shared/view';

import { SESSION_RUNNER_VIEW_TYPE } from './types';
import type { SessionRunnerState } from './types';
import { SessionRunnerViewModel } from './viewmodel';

import { MapCanvas } from './components/map-canvas';
import { PartyToken } from './components/party-token';
import { RouteOverlay } from './components/route-overlay';
import { HeaderBar, type MapInfo } from './components/header-bar';
import { SidebarContainer, TravelPanel, CalendarPanel, type PanelContext } from './panels';
import { createEvent } from '@core/events/event-bus';
import { EventTypes } from '@core/events/domain-events';
import { DETAIL_VIEW_TYPE } from '../detail-view/types';

// ═══════════════════════════════════════════════════════════════
// CSS Classes
// ═══════════════════════════════════════════════════════════════

const CSS = {
  container: 'session-runner-container',
  main: 'session-runner-main',
  mapContainer: 'session-runner-map-container',
  sidebar: 'session-runner-sidebar',
} as const;

// ═══════════════════════════════════════════════════════════════
// View Dependencies
// ═══════════════════════════════════════════════════════════════

export interface SessionRunnerDependencies {
  geographyFeature: GeographyFeaturePort;
  timeFeature: TimeFeaturePort;
  eventBus: EventBus;
}

// ═══════════════════════════════════════════════════════════════
// SessionRunner View
// ═══════════════════════════════════════════════════════════════

export class SessionRunnerView extends BaseToolView<SessionRunnerState, SessionRunnerViewModel> {
  // ─────────────────────────────────────────────────────────────
  // BaseToolView Abstract Properties
  // ─────────────────────────────────────────────────────────────

  protected readonly viewType = SESSION_RUNNER_VIEW_TYPE;
  protected readonly displayText = 'Session Runner';
  protected readonly iconName = 'play-circle';
  protected viewModel!: SessionRunnerViewModel;

  // ─────────────────────────────────────────────────────────────
  // Dependencies
  // ─────────────────────────────────────────────────────────────

  private deps: SessionRunnerDependencies;

  // ─────────────────────────────────────────────────────────────
  // Components
  // ─────────────────────────────────────────────────────────────

  private headerBar!: HeaderBar;
  private mapCanvas!: MapCanvas;
  private partyToken!: PartyToken;
  private routeOverlay!: RouteOverlay;
  private sidebar!: SidebarContainer;

  // ─────────────────────────────────────────────────────────────
  // State Tracking
  // ─────────────────────────────────────────────────────────────

  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Animation loop state (drives travel animation via tick events)
  private animationId: number | null = null;
  private lastFrameTime: number = 0;

  // DetailView lifecycle management
  private detailViewLeaf: WorkspaceLeaf | null = null;

  constructor(leaf: WorkspaceLeaf, deps: SessionRunnerDependencies) {
    super(leaf);
    this.deps = deps;
  }

  // ─────────────────────────────────────────────────────────────
  // BaseToolView Abstract Hooks
  // ─────────────────────────────────────────────────────────────

  protected getContainerClass(): string {
    return CSS.container;
  }

  protected onCreateViewModel(): void {
    this.viewModel = new SessionRunnerViewModel(
      this.deps.geographyFeature,
      this.deps.timeFeature,
      this.deps.eventBus
    );
  }

  protected createLayout(container: HTMLElement): void {
    // Header
    const headerEl = container.createDiv({ cls: 'session-runner-header-container' });
    styleTopBar(headerEl);
    this.headerBar = this.registerComponent(new HeaderBar(headerEl, { title: 'Session Runner' }));
    this.headerBar.setMapSelectHandler((mapId) => this.viewModel.loadMap(mapId));

    // Main content (sidebar + map) - flex row
    const mainEl = createFlexContainer(container, CSS.main, 'row');

    // Sidebar (left) - fixed width panel
    const sidebarEl = createSidePanel(mainEl, CSS.sidebar, 280, 'left');
    this.sidebar = this.registerComponent(new SidebarContainer(sidebarEl));

    // Register panels with callbacks
    this.sidebar.register(new TravelPanel({
      onStartTravel: () => this.viewModel.startTravel(),
      onPauseTravel: () => this.viewModel.pauseTravel(),
      onResumeTravel: () => this.viewModel.resumeTravel(),
      onStopTravel: () => this.viewModel.stopTravel(),
      onClearRoute: () => this.viewModel.clearRoute(),
      onSetAnimationSpeed: (speed) => this.viewModel.setAnimationSpeed(speed),
    }));
    this.sidebar.register(new CalendarPanel({
      onAdvanceTime: (duration, reason) => this.viewModel.advanceTime(duration, reason),
    }));
    // Note: EncounterPanel is now in DetailView (right sidebar)

    // Map container (right) - takes remaining space
    const mapContainerEl = mainEl.createDiv({ cls: CSS.mapContainer });
    styleMapContainer(mapContainerEl);
    this.mapCanvas = this.registerComponent(new MapCanvas(mapContainerEl));

    // Get hex size from map or default
    const map = this.viewModel.getMapData();
    const hexSize = map?.metadata.hexSize ?? 42;

    // Setup terrain registry
    this.updateTerrainRegistry();

    // Party token (on token layer)
    this.partyToken = this.registerComponent(
      new PartyToken(this.mapCanvas.getTokenGroup(), hexSize)
    );

    // Route overlay (on route layer)
    this.routeOverlay = this.registerComponent(
      new RouteOverlay(this.mapCanvas.getRouteGroup(), hexSize)
    );

    // Setup event handlers
    this.setupEventHandlers();
  }

  protected setupSubscriptions(): void {
    // Subscribe to ViewModel state changes
    // ViewModel receives travel state via EventBus and notifies us
    this.registerSubscription(
      this.viewModel.subscribe((state) => this.onStateChange(state))
    );
  }

  protected async onInitialize(): Promise<void> {
    // Initialize ViewModel
    await this.viewModel.initialize();

    // Load available maps
    const maps = await this.viewModel.getAvailableMaps();
    this.headerBar.setAvailableMaps(maps as MapInfo[]);

    // Open DetailView in right sidebar
    await this.openDetailView();
  }

  // ─────────────────────────────────────────────────────────────
  // DetailView Lifecycle Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Open DetailView in right sidebar.
   * Called during SessionRunner initialization.
   */
  private async openDetailView(): Promise<void> {
    const workspace = this.app.workspace;

    // Check if already open
    const existingLeaves = workspace.getLeavesOfType(DETAIL_VIEW_TYPE);
    if (existingLeaves.length > 0) {
      this.detailViewLeaf = existingLeaves[0];
      return;
    }

    // Open in right sidebar
    const rightLeaf = workspace.getRightLeaf(false);
    if (rightLeaf) {
      await rightLeaf.setViewState({
        type: DETAIL_VIEW_TYPE,
        active: true,
      });
      this.detailViewLeaf = rightLeaf;

      // Reveal the right sidebar
      workspace.revealLeaf(rightLeaf);
    }
  }

  /**
   * Close DetailView when SessionRunner closes.
   */
  private closeDetailView(): void {
    if (this.detailViewLeaf) {
      this.detailViewLeaf.detach();
      this.detailViewLeaf = null;
    }
  }

  protected onDispose(): void {
    this.stopAnimationLoop();
    this.closeDetailView();
    this.viewModel?.dispose();
  }

  // ─────────────────────────────────────────────────────────────
  // Animation Loop (drives travel via tick events to Orchestrator)
  // ─────────────────────────────────────────────────────────────

  private startAnimationLoop(): void {
    if (this.animationId !== null) return;

    this.lastFrameTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaMs = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      this.viewModel.tickTravel(deltaMs);

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  private stopAnimationLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RenderHint Handlers (Override BaseToolView)
  // ─────────────────────────────────────────────────────────────

  protected onRenderFull(state: SessionRunnerState): void {
    // Update header
    this.headerBar.setCurrentMap(state.mapId, state.mapName);

    // Update sidebar panels context
    this.updateSidebarContext(state);

    // Render map
    const map = this.viewModel.getMapData();
    if (!map) return;

    this.updateTerrainRegistry();
    this.mapCanvas.renderFull(map);
    this.onRenderCamera(state);

    // Update party token
    const travelState = this.viewModel.getTravelState();
    const hexSize = map.metadata.hexSize ?? 42;
    const pixel = hexToPixel(travelState.partyPosition, hexSize);
    this.partyToken.setPosition(pixel.x, pixel.y);
    this.partyToken.show();
  }

  protected onRenderCamera(state: SessionRunnerState): void {
    this.mapCanvas.applyCamera(state.camera);
  }

  protected onRenderToken(_state: SessionRunnerState): void {
    const travelState = this.viewModel.getTravelState();
    const map = this.viewModel.getMapData();
    if (!map) return;

    const hexSize = map.metadata.hexSize ?? 42;

    if (travelState.progress) {
      this.partyToken.setPosition(
        travelState.progress.pixelPosition.x,
        travelState.progress.pixelPosition.y
      );
      this.partyToken.setAnimating(travelState.status === 'traveling');
    } else {
      const pixel = hexToPixel(travelState.partyPosition, hexSize);
      this.partyToken.setPosition(pixel.x, pixel.y);
      this.partyToken.setAnimating(false);
    }
    this.partyToken.show();
  }

  protected onRenderRoute(_state: SessionRunnerState): void {
    const travelState = this.viewModel.getTravelState();

    // Update route overlay
    if (travelState.route) {
      this.routeOverlay.setRoute(travelState.route, travelState.partyPosition);
    } else {
      this.routeOverlay.clearRoute();
    }

    // Drag preview is handled directly in mouse events (pixel-based)
  }

  // ─────────────────────────────────────────────────────────────
  // Custom State Change Handler (extends base)
  // ─────────────────────────────────────────────────────────────

  protected onStateChange(state: SessionRunnerState): void {
    // Update UI elements that always need updating
    this.headerBar.setCurrentMap(state.mapId, state.mapName);
    this.updateSidebarContext(state);

    // Manage animation loop based on travel status
    const travelState = this.viewModel.getTravelState();
    if (travelState.status === 'traveling') {
      this.startAnimationLoop();
    } else {
      this.stopAnimationLoop();
    }

    // Delegate to base class for RenderHint dispatch
    super.onStateChange(state);
  }

  // ─────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────

  private setupEventHandlers(): void {
    const svg = this.mapCanvas.getSvgElement();

    // Mouse events
    svg.addEventListener('mousedown', this.onMouseDown.bind(this));
    svg.addEventListener('mousemove', this.onMouseMove.bind(this));
    svg.addEventListener('mouseup', this.onMouseUp.bind(this));
    svg.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    svg.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

    // Click (left click adds waypoint)
    svg.addEventListener('click', this.onClick.bind(this));

    // Context menu (right click deletes waypoint)
    svg.addEventListener('contextmenu', this.onContextMenu.bind(this));
  }

  private onMouseDown(e: MouseEvent): void {
    // Left button - check for party token or waypoint drag
    if (e.button === 0) {
      const worldPos = this.getWorldPositionAtMouse(e);

      // Check party token first (higher priority - smaller hit area)
      if (this.partyToken.containsPoint(worldPos.x, worldPos.y)) {
        e.preventDefault();
        this.routeOverlay.hidePreviewLine();
        const travelState = this.viewModel.getTravelState();
        this.viewModel.startPartyTokenDrag(travelState.partyPosition);
        this.partyToken.showDragGhost(worldPos.x, worldPos.y);
        return;
      }

      // Then check waypoints
      const coord = this.getHexAtMouse(e);
      if (coord) {
        const waypoint = this.viewModel.getWaypointAtCoord(coord);
        if (waypoint) {
          e.preventDefault();
          this.routeOverlay.hidePreviewLine();
          this.viewModel.startWaypointDrag(waypoint.id, waypoint.coord);
          // Show ghost immediately at cursor position
          this.routeOverlay.showDragPreviewAtPixel(waypoint.id, worldPos.x, worldPos.y);
          return;
        }
      }
    }

    // Middle/right button for panning
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      e.preventDefault();
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;
      this.viewModel.pan(deltaX, deltaY);
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    } else if (this.viewModel.getState().dragState) {
      const dragState = this.viewModel.getState().dragState!;
      const worldPos = this.getWorldPositionAtMouse(e);

      if (dragState.type === 'partyToken') {
        // Update party token ghost at pixel position
        this.partyToken.showDragGhost(worldPos.x, worldPos.y);
        this.routeOverlay.showPartyDragPreview(worldPos.x, worldPos.y);
      } else {
        // Update waypoint ghost at pixel position
        this.routeOverlay.showDragPreviewAtPixel(
          dragState.waypointId,
          worldPos.x,
          worldPos.y
        );
      }
    } else {
      // Update hover
      this.updateHoverCoord(e);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    this.isPanning = false;

    // End drag if active - snap to hex
    const dragState = this.viewModel.getState().dragState;
    if (dragState) {
      const coord = this.getHexAtMouse(e);

      if (dragState.type === 'partyToken') {
        // End party token drag - snap to hex
        this.partyToken.hideGhost();
        this.routeOverlay.hidePartyDragPreview();
        if (coord) {
          this.viewModel.setPartyPosition(coord);
        }
        this.viewModel.endPartyTokenDrag();
      } else {
        // End waypoint drag - snap to hex
        if (coord) {
          this.viewModel.updateWaypointDrag(coord);
        }
        this.viewModel.endWaypointDrag();
        this.routeOverlay.hideDragPreview();
      }
    }
  }

  private onMouseLeave(_e: MouseEvent): void {
    this.isPanning = false;
    this.viewModel.setHoveredCoord(null);
    this.mapCanvas.clearHoverHighlight();

    // Cancel drag if active
    const dragState = this.viewModel.getState().dragState;
    if (dragState) {
      if (dragState.type === 'partyToken') {
        this.partyToken.hideGhost();
        this.routeOverlay.hidePartyDragPreview();
        this.viewModel.endPartyTokenDrag();
      } else {
        this.routeOverlay.hideDragPreview();
        this.viewModel.cancelWaypointDrag();
      }
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const svg = this.mapCanvas.getSvgElement();
    const center = this.mapCanvas.getViewportCenter();

    const mousePos = getMousePosition(e, svg);
    this.viewModel.zoom(e.deltaY, mousePos.x, mousePos.y, center);
  }

  private onClick(e: MouseEvent): void {
    if (e.button !== 0) return;

    const coord = this.getHexAtMouse(e);
    if (!coord) return;

    // Skip if tile has waypoint (drag handled in mousedown)
    const waypoint = this.viewModel.getWaypointAtCoord(coord);
    if (waypoint) return;

    this.viewModel.onMapClick(coord);
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();

    const coord = this.getHexAtMouse(e);
    if (!coord) return;

    const waypoint = this.viewModel.getWaypointAtCoord(coord);
    if (waypoint) {
      this.viewModel.deleteWaypoint(waypoint.id);
    }
  }

  private updateHoverCoord(e: MouseEvent): void {
    const coord = this.getHexAtMouse(e);
    this.viewModel.setHoveredCoord(coord);

    if (coord) {
      this.mapCanvas.showHoverHighlight(coord);
      this.updatePreviewLine(coord);
    } else {
      this.mapCanvas.clearHoverHighlight();
      this.routeOverlay.hidePreviewLine();
    }
  }

  private updatePreviewLine(hoveredCoord: HexCoordinate): void {
    const travelState = this.viewModel.getTravelState();

    // Show preview from current position or last waypoint to hovered coord
    if (travelState.status === 'idle' || travelState.status === 'planning') {
      let fromCoord: HexCoordinate;

      if (travelState.route && travelState.route.waypoints.length > 0) {
        // From last waypoint
        fromCoord = travelState.route.waypoints[travelState.route.waypoints.length - 1].coord;
      } else {
        // From party position
        fromCoord = travelState.partyPosition;
      }

      this.routeOverlay.showPreviewLine(fromCoord, hoveredCoord);
    } else {
      this.routeOverlay.hidePreviewLine();
    }
  }

  private getHexAtMouse(e: MouseEvent): HexCoordinate | null {
    const map = this.viewModel.getMapData();
    if (!map) return null;

    const svg = this.mapCanvas.getSvgElement();
    const state = this.viewModel.getState();
    const hexSize = map.metadata.hexSize ?? 42;
    const center = this.mapCanvas.getViewportCenter();

    const mousePos = getMousePosition(e, svg);
    const result = hitTestHex(
      mousePos.x,
      mousePos.y,
      state.camera,
      hexSize,
      center.x,
      center.y
    );
    return result.coord;
  }

  private getWorldPositionAtMouse(e: MouseEvent): { x: number; y: number } {
    const svg = this.mapCanvas.getSvgElement();
    const state = this.viewModel.getState();
    const center = this.mapCanvas.getViewportCenter();

    const mousePos = getMousePosition(e, svg);
    return screenToWorld(mousePos.x, mousePos.y, state.camera, center.x, center.y);
  }

  // ─────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────

  private updateTerrainRegistry(): void {
    const terrains = this.viewModel.listTerrains();
    const registry: Record<string, (typeof terrains)[0]> = {};
    for (const terrain of terrains) {
      registry[terrain.id] = terrain;
    }
    this.mapCanvas.setTerrainRegistry(registry);
  }

  private updateSidebarContext(state: SessionRunnerState): void {
    const travelState = this.viewModel.getTravelState();
    const encounterState = this.viewModel.getEncounterState();
    const context: PanelContext = {
      mapId: state.mapId,
      mapName: state.mapName,
      partyPosition: travelState.partyPosition,
      travelState: travelState,
      currentDateTime: this.viewModel.getCurrentDateTime(),
      calendar: this.viewModel.getCalendar(),
      timeOfDay: this.viewModel.getTimeOfDay(),
      season: this.viewModel.getCurrentSeason(),
      moonPhases: this.viewModel.getMoonPhases(),
      encounterState: encounterState,
      activeEncounter: encounterState.activeEncounter,
    };

    // Update internal sidebar panels
    this.sidebar.updateAll(context);

    // Publish context for DetailView (right sidebar)
    this.deps.eventBus.publish(
      createEvent(EventTypes.SESSION_CONTEXT_CHANGED, { context }, 'session-runner')
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// View Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Create a view factory for Obsidian
 */
export function createSessionRunnerViewFactory(deps: SessionRunnerDependencies) {
  return (leaf: WorkspaceLeaf) => new SessionRunnerView(leaf, deps);
}
