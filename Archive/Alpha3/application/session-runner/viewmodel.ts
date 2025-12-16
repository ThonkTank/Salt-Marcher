/**
 * SessionRunner ViewModel
 *
 * Manages UI-specific state for SessionRunner.
 * Communicates with TravelOrchestrator via EventBus (MVVM compliant).
 */

import type { EntityId } from '@core/types/common';
import type { HexCoordinate } from '@core/schemas/coordinates';
import type { HexMapData } from '@core/schemas/map';
import { hexToPixel } from '@core/schemas/hex-geometry';
import type { EventBus } from '@core/events/event-bus';
import { createEvent } from '@core/events/event-bus';
import type { GeographyFeaturePort } from '@/features/geography';
import type {
  TimeFeaturePort,
  TimeChangeReason,
  TimeAdvanceResult,
} from '@/features/time';
import type { TravelState } from '@/features/travel';
import type { EncounterState } from '@/features/encounter';
import type { Duration } from '@core/schemas/time';
import { clampZoom, calculateWheelZoom, zoomAtPoint } from '@shared/map';
import type { SessionRunnerState, StateListener, RenderHint } from './types';
import { INITIAL_STATE, DEFAULT_CAMERA } from './types';

// ═══════════════════════════════════════════════════════════════
// SessionRunner ViewModel
// ═══════════════════════════════════════════════════════════════

export class SessionRunnerViewModel {
  private state: SessionRunnerState;
  private listeners: Set<StateListener> = new Set();

  // Features for READ-ONLY queries (architecture compliant)
  private readonly geographyFeature: GeographyFeaturePort;
  private readonly timeFeature: TimeFeaturePort;
  private readonly eventBus: EventBus;

  // Travel state received via EventBus from Orchestrator
  private travelState: TravelState = {
    status: 'idle',
    route: null,
    progress: null,
    partyPosition: { q: 0, r: 0 },
  };

  // Encounter state received via EventBus from Orchestrator
  private encounterState: EncounterState = {
    status: 'idle',
    activeEncounter: null,
    travelHoursElapsed: 0,
    lastCheckHour: 0,
  };

  constructor(
    geographyFeature: GeographyFeaturePort,
    timeFeature: TimeFeaturePort,
    eventBus: EventBus
  ) {
    // Features for READ-ONLY access only
    this.geographyFeature = geographyFeature;
    this.timeFeature = timeFeature;
    this.eventBus = eventBus;
    this.state = { ...INITIAL_STATE };

    // Encounter state starts with default and updates via EventBus
    // (no orchestrator reference needed - architecture compliant)

    this.setupEventListeners();
  }

  // ─────────────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    // Listen to map changes - update local state from event payload
    this.eventBus.subscribe('map:loaded', (event) => {
      this.setState({
        mapId: event.payload.mapId,
        mapName: event.payload.mapName,
        camera: { ...DEFAULT_CAMERA },
        hoveredCoord: null,
        selectedCoord: null,
      });
      this.notify({ type: 'full' });
    });

    // Travel State Changes (Orchestrator → ViewModel)
    // Note: Cast erforderlich da TravelStateChangedEvent 'unknown' für route/progress verwendet
    // (vermeidet zirkuläre Imports zwischen core/events und orchestration/travel)
    this.eventBus.subscribe('travel:state-changed', (event) => {
      this.travelState = event.payload.state as TravelState;
      // Choose render hint based on state
      if (this.travelState.progress) {
        this.notify({ type: 'token' });
      } else {
        this.notify({ type: 'route' });
      }
    });

    // Travel Status Events
    this.eventBus.subscribe('travel:started', () => {
      this.notify({ type: 'route' });
    });

    this.eventBus.subscribe('travel:completed', () => {
      this.notify({ type: 'route' });
    });

    this.eventBus.subscribe('travel:paused', () => {
      this.notify({ type: 'ui' });
    });

    this.eventBus.subscribe('travel:resumed', () => {
      this.notify({ type: 'ui' });
    });

    this.eventBus.subscribe('travel:stopped', () => {
      this.notify({ type: 'route' });
    });

    this.eventBus.subscribe('position:changed', () => {
      this.notify({ type: 'token' });
    });

    // Time Events
    this.eventBus.subscribe('time:changed', () => {
      this.notify({ type: 'ui' });
    });

    // Encounter State Changes (Orchestrator → ViewModel via EventBus)
    this.eventBus.subscribe('encounter:state-changed', (event) => {
      this.encounterState = event.payload.state as EncounterState;
      this.notify({ type: 'ui' });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Map Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Load a map by ID - direct domain call (CRUD operation)
   * State update happens in map:loaded event handler
   */
  async loadMap(mapId: EntityId<'map'>): Promise<void> {
    const result = await this.geographyFeature.setActiveMap(mapId);
    this.eventBus.publish(
      createEvent(
        'map:loaded',
        {
          mapId: result.map.metadata.id,
          mapName: result.map.metadata.name,
          previousMapId: result.previousMapId,
        },
        'geography'
      )
    );
  }

  /**
   * Get available maps
   */
  async getAvailableMaps(): Promise<Array<{ id: EntityId<'map'>; name: string }>> {
    const maps = await this.geographyFeature.listMaps();
    return maps.map((m) => ({ id: m.id, name: m.name }));
  }

  /**
   * Get currently loaded map data
   */
  getMapData(): HexMapData | null {
    return this.geographyFeature.getActiveMap();
  }

  // ─────────────────────────────────────────────────────────────
  // Camera Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Pan the camera
   */
  pan(deltaX: number, deltaY: number): void {
    const { camera } = this.state;
    this.setState({
      camera: {
        ...camera,
        panX: camera.panX + deltaX,
        panY: camera.panY + deltaY,
      },
    });
    this.notify({ type: 'camera' });
  }

  /**
   * Zoom at a specific point
   */
  zoom(delta: number, anchorX: number, anchorY: number, viewportCenter: { x: number; y: number }): void {
    const { camera } = this.state;
    const newZoom = clampZoom(calculateWheelZoom(delta, camera.zoom));

    if (newZoom === camera.zoom) return;

    const newCamera = zoomAtPoint(
      camera,
      newZoom,
      anchorX,
      anchorY,
      viewportCenter.x,
      viewportCenter.y
    );
    this.setState({ camera: newCamera });
    this.notify({ type: 'camera' });
  }

  /**
   * Reset camera to default
   */
  resetCamera(): void {
    this.setState({ camera: { ...DEFAULT_CAMERA } });
    this.notify({ type: 'camera' });
  }

  /**
   * Center camera on a coordinate
   */
  centerOn(coord: HexCoordinate): void {
    const map = this.getMapData();
    if (!map) return;

    const hexSize = map.metadata.hexSize ?? 42;
    const pixel = hexToPixel(coord, hexSize);

    this.setState({
      camera: {
        ...this.state.camera,
        panX: -pixel.x,
        panY: -pixel.y,
      },
    });
    this.notify({ type: 'camera' });
  }

  // ─────────────────────────────────────────────────────────────
  // Interaction
  // ─────────────────────────────────────────────────────────────

  /**
   * Handle hex hover
   */
  setHoveredCoord(coord: HexCoordinate | null): void {
    if (
      coord?.q === this.state.hoveredCoord?.q &&
      coord?.r === this.state.hoveredCoord?.r
    ) {
      return;
    }
    this.setState({ hoveredCoord: coord });
    this.notify({ type: 'brush' });
  }

  /**
   * Handle hex click - adds waypoint to travel route
   */
  onMapClick(coord: HexCoordinate): void {
    // Skip if currently dragging a waypoint
    if (this.state.dragState) return;

    // Add waypoint to travel route via EventBus
    this.eventBus.publish(
      createEvent('travel:waypoint-add-requested', { coord }, 'session-runner')
    );
    this.notify({ type: 'route' });
  }

  // ─────────────────────────────────────────────────────────────
  // Waypoint Drag Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Start dragging a waypoint
   */
  startWaypointDrag(waypointId: string, startCoord: HexCoordinate): void {
    this.setState({
      dragState: {
        type: 'waypoint',
        waypointId,
        currentCoord: startCoord,
      },
    });
    this.notify({ type: 'route' });
  }

  /**
   * Update waypoint drag position
   */
  updateWaypointDrag(coord: HexCoordinate): void {
    if (!this.state.dragState || this.state.dragState.type !== 'waypoint') return;

    this.setState({
      dragState: {
        ...this.state.dragState,
        currentCoord: coord,
      },
    });
    this.notify({ type: 'route' });
  }

  /**
   * End waypoint drag and move waypoint to new position
   */
  endWaypointDrag(): void {
    if (!this.state.dragState || this.state.dragState.type !== 'waypoint') return;

    const { waypointId, currentCoord } = this.state.dragState;
    this.eventBus.publish(
      createEvent('travel:waypoint-move-requested', { waypointId, coord: currentCoord }, 'session-runner')
    );

    this.setState({ dragState: null });
    this.notify({ type: 'route' });
  }

  /**
   * Cancel waypoint drag without moving
   */
  cancelWaypointDrag(): void {
    if (!this.state.dragState) return;

    this.setState({ dragState: null });
    this.notify({ type: 'route' });
  }

  // ─────────────────────────────────────────────────────────────
  // Party Token Drag Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Start dragging the party token
   */
  startPartyTokenDrag(coord: HexCoordinate): void {
    this.setState({
      dragState: {
        type: 'partyToken',
        originalCoord: coord,
      },
    });
    this.notify({ type: 'token' });
  }

  /**
   * End party token drag
   */
  endPartyTokenDrag(): void {
    this.setState({ dragState: null });
    this.notify({ type: 'token' });
  }

  /**
   * Set party position (via EventBus to Orchestrator)
   */
  setPartyPosition(coord: HexCoordinate): void {
    this.eventBus.publish(
      createEvent('travel:position-set-requested', { coord }, 'session-runner')
    );
  }

  /**
   * Delete a waypoint from the route
   */
  deleteWaypoint(waypointId: string): void {
    this.eventBus.publish(
      createEvent('travel:waypoint-remove-requested', { waypointId }, 'session-runner')
    );
    this.notify({ type: 'route' });
  }

  /**
   * Get waypoint at coordinate (if any)
   */
  getWaypointAtCoord(coord: HexCoordinate): { id: string; coord: HexCoordinate } | null {
    const route = this.travelState.route;
    if (!route) return null;

    const waypoint = route.waypoints.find(
      (wp) => wp.coord.q === coord.q && wp.coord.r === coord.r
    );

    return waypoint ? { id: waypoint.id, coord: waypoint.coord } : null;
  }

  /**
   * Handle hex selection (for inspector mode in future)
   */
  selectCoord(coord: HexCoordinate | null): void {
    this.setState({ selectedCoord: coord });
    this.notify({ type: 'selection' });
  }

  // ─────────────────────────────────────────────────────────────
  // Travel Controls (via EventBus → Orchestrator)
  // ─────────────────────────────────────────────────────────────

  /**
   * Start travel along planned route
   */
  startTravel(): void {
    this.eventBus.publish(createEvent('travel:start-requested', {}, 'session-runner'));
  }

  /**
   * Pause active travel
   */
  pauseTravel(): void {
    this.eventBus.publish(createEvent('travel:pause-requested', {}, 'session-runner'));
  }

  /**
   * Resume paused travel
   */
  resumeTravel(): void {
    this.eventBus.publish(createEvent('travel:resume-requested', {}, 'session-runner'));
  }

  /**
   * Stop travel completely
   */
  stopTravel(): void {
    this.eventBus.publish(createEvent('travel:stop-requested', {}, 'session-runner'));
  }

  /**
   * Clear route and waypoints
   */
  clearRoute(): void {
    this.eventBus.publish(createEvent('travel:clear-requested', {}, 'session-runner'));
  }

  /**
   * Set animation speed multiplier
   */
  setAnimationSpeed(speed: number): void {
    this.eventBus.publish(createEvent('travel:speed-changed', { speed }, 'session-runner'));
  }

  /**
   * Tick travel animation (called by View's animation loop)
   * Publishes tick event to orchestrator for progress calculation
   */
  tickTravel(deltaMs: number): void {
    this.eventBus.publish(createEvent('travel:tick-requested', { deltaMs }, 'session-runner'));
  }

  /**
   * Get current travel state (received via EventBus)
   */
  getTravelState(): Readonly<TravelState> {
    return this.travelState;
  }

  // ─────────────────────────────────────────────────────────────
  // Encounter Controls (via EventBus)
  // ─────────────────────────────────────────────────────────────

  /**
   * Resolve the active encounter
   */
  resolveEncounter(outcome: 'victory' | 'flee' | 'negotiated'): void {
    this.eventBus.publish(
      createEvent('encounter:resolve-requested', { outcome }, 'session-runner')
    );
  }

  /**
   * Dismiss the active encounter without resolution
   */
  dismissEncounter(): void {
    this.eventBus.publish(
      createEvent('encounter:dismiss-requested', {}, 'session-runner')
    );
  }

  /**
   * Get current encounter state (received via EventBus)
   */
  getEncounterState(): Readonly<EncounterState> {
    return this.encounterState;
  }

  // ─────────────────────────────────────────────────────────────
  // Time Operations (direct domain calls for CRUD operations)
  // ─────────────────────────────────────────────────────────────

  /**
   * Advance game time - direct domain call (CRUD operation)
   * ViewModel publishes events after domain call
   */
  advanceTime(duration: Duration, reason: TimeChangeReason): void {
    const result = this.timeFeature.advanceTime(duration, reason);
    this.publishTimeEvents(result, reason);
  }

  /**
   * Get current date/time
   */
  getCurrentDateTime() {
    return this.timeFeature.getCurrentDateTime();
  }

  /**
   * Get calendar configuration
   */
  getCalendar() {
    return this.timeFeature.getCalendar();
  }

  /**
   * Get current time of day
   */
  getTimeOfDay() {
    return this.timeFeature.getTimeOfDay();
  }

  /**
   * Get current season
   */
  getCurrentSeason() {
    return this.timeFeature.getCurrentSeason();
  }

  /**
   * Get moon phases
   */
  getMoonPhases() {
    return this.timeFeature.getMoonPhases();
  }

  // ─────────────────────────────────────────────────────────────
  // Geography (for View access)
  // ─────────────────────────────────────────────────────────────

  /**
   * List available terrains
   */
  listTerrains() {
    return this.geographyFeature.listTerrains();
  }

  // ─────────────────────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Get current state
   */
  getState(): Readonly<SessionRunnerState> {
    return this.state;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(updates: Partial<SessionRunnerState>): void {
    this.state = { ...this.state, ...updates };
  }

  private notify(hint: RenderHint): void {
    this.state = { ...this.state, renderHint: hint };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /**
   * Publish time events after domain call
   * Domain no longer publishes events - callers are responsible
   */
  private publishTimeEvents(result: TimeAdvanceResult, reason: TimeChangeReason): void {
    this.eventBus.publish(
      createEvent('time:changed', {
        previous: result.previous,
        current: result.current,
        reason,
      }, 'time')
    );

    if (result.dayChanged) {
      this.eventBus.publish(
        createEvent('time:dayChanged', {
          day: result.current.day,
          month: result.current.month,
          year: result.current.year,
        }, 'time')
      );
    }

    if (result.timeOfDayChange) {
      this.eventBus.publish(
        createEvent('time:timeOfDayChanged', {
          previous: result.timeOfDayChange.previous,
          current: result.timeOfDayChange.current,
        }, 'time')
      );
    }

    if (result.seasonChange) {
      this.eventBus.publish(
        createEvent('time:seasonChanged', {
          previous: result.seasonChange.previous,
          current: result.seasonChange.current,
        }, 'time')
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize viewmodel
   */
  async initialize(): Promise<void> {
    // Load first available map if any
    const maps = await this.getAvailableMaps();
    if (maps.length > 0) {
      await this.loadMap(maps[0].id);
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.listeners.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

export function createSessionRunnerViewModel(
  geographyFeature: GeographyFeaturePort,
  timeFeature: TimeFeaturePort,
  eventBus: EventBus
): SessionRunnerViewModel {
  return new SessionRunnerViewModel(
    geographyFeature,
    timeFeature,
    eventBus
  );
}
