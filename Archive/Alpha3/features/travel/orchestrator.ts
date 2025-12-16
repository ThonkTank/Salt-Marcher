/**
 * Travel Feature - Orchestrator
 *
 * Coordinates Geography and Time features for overland travel.
 * Manages route planning and travel execution.
 * Animation loop is driven by View layer via tick events.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import type { EventBus } from '@core/events/event-bus';
import { createEvent } from '@core/events/event-bus';
import type { GeographyFeaturePort } from '@/features/geography';
import type { TimeFeaturePort, TimeAdvanceResult, TimeChangeReason } from '@/features/time';
import { hexToPixel } from '@core/schemas/hex-geometry';
import { ok, err, type Result, type AppError } from '@core/types/result';

import type {
  TravelFeaturePort,
  TravelState,
  TravelStateListener,
  TravelConfig,
  Route,
  Waypoint,
  TravelProgress,
  TravelStartedPayload,
  TravelCompletedPayload,
  TravelPausedPayload,
  TravelWaypointReachedPayload,
  PositionChangedPayload,
} from './types';
import { DEFAULT_TRAVEL_CONFIG } from './types';
import {
  createWaypoint,
  calculateRoute,
  interpolateRoutePosition,
  durationToMinutes,
  minutesToDuration,
} from './travel-utils';

// ═══════════════════════════════════════════════════════════════
// TravelOrchestrator Implementation
// ═══════════════════════════════════════════════════════════════

class TravelOrchestrator implements TravelFeaturePort {
  private state: TravelState;
  private listeners: Set<TravelStateListener> = new Set();
  private config: TravelConfig;

  private accumulatedMs: number = 0;
  private hoursAdvanced: number = 0;

  private unsubscribers: Array<() => void> = [];
  private arrivalTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private readonly geographyFeature: GeographyFeaturePort;
  private readonly timeFeature: TimeFeaturePort;
  private readonly eventBus: EventBus;

  constructor(
    geographyFeature: GeographyFeaturePort,
    timeFeature: TimeFeaturePort,
    eventBus: EventBus,
    config?: Partial<TravelConfig>
  ) {
    this.geographyFeature = geographyFeature;
    this.timeFeature = timeFeature;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_TRAVEL_CONFIG, ...config };

    this.state = {
      status: 'idle',
      route: null,
      progress: null,
      partyPosition: { q: 0, r: 0 },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // EventBus Command Subscriptions
  // ─────────────────────────────────────────────────────────────

  private setupEventSubscriptions(): void {
    this.unsubscribers.push(
      this.eventBus.subscribe('travel:start-requested', (event) => {
        const result = this.startTravel();
        if (!result.ok) {
          this.eventBus.publish(
            createEvent('travel:start-failed', { error: result.error }, 'travel', event.correlationId)
          );
        }
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:pause-requested', (event) => {
        const result = this.pauseTravel();
        if (!result.ok) {
          this.eventBus.publish(
            createEvent('travel:pause-failed', { error: result.error }, 'travel', event.correlationId)
          );
        }
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:resume-requested', (event) => {
        const result = this.resumeTravel();
        if (!result.ok) {
          this.eventBus.publish(
            createEvent('travel:resume-failed', { error: result.error }, 'travel', event.correlationId)
          );
        }
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:stop-requested', () => {
        this.stopTravel();
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:clear-requested', () => {
        this.clearRoute();
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:speed-changed', (event) => {
        this.setAnimationSpeed(event.payload.speed);
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:waypoint-add-requested', (event) => {
        this.addWaypoint(event.payload.coord);
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:waypoint-remove-requested', (event) => {
        const result = this.removeWaypoint(event.payload.waypointId);
        if (!result.ok) {
          this.eventBus.publish(
            createEvent('travel:waypoint-remove-failed', {
              error: result.error,
              waypointId: event.payload.waypointId,
            }, 'travel', event.correlationId)
          );
        }
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:waypoint-move-requested', (event) => {
        const result = this.moveWaypoint(event.payload.waypointId, event.payload.coord);
        if (!result.ok) {
          this.eventBus.publish(
            createEvent('travel:waypoint-move-failed', {
              error: result.error,
              waypointId: event.payload.waypointId,
            }, 'travel', event.correlationId)
          );
        }
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:position-set-requested', (event) => {
        this.setPartyPosition(event.payload.coord);
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('travel:tick-requested', (event) => {
        this.tick(event.payload.deltaMs);
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('encounter:generated', () => {
        this.pauseTravel();
      })
    );
  }

  // ─────────────────────────────────────────────────────────────
  // State Access
  // ─────────────────────────────────────────────────────────────

  getState(): Readonly<TravelState> {
    return this.state;
  }

  subscribe(listener: TravelStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }

    this.eventBus.publish(
      createEvent('travel:state-changed', { state: this.state }, 'travel')
    );
  }

  private setState(updates: Partial<TravelState>): void {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  // ─────────────────────────────────────────────────────────────
  // Position Management
  // ─────────────────────────────────────────────────────────────

  setPartyPosition(coord: HexCoordinate): void {
    if (this.state.status === 'traveling') {
      this.stopTravel();
    }

    this.state = { ...this.state, partyPosition: coord };

    if (this.state.route && this.state.route.waypoints.length > 0) {
      const route = this.calculateFullRoute(this.state.route.waypoints);
      this.setState({
        route,
        status: 'planning',
      });
    } else {
      this.setState({
        route: null,
        progress: null,
        status: 'idle',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Route Planning
  // ─────────────────────────────────────────────────────────────

  addWaypoint(coord: HexCoordinate): void {
    const existingWaypoints = this.state.route?.waypoints ?? [];
    const newWaypoint = createWaypoint(coord, existingWaypoints.length);

    const allWaypoints = [...existingWaypoints, newWaypoint];

    const route = this.calculateFullRoute(allWaypoints);

    this.setState({
      route,
      status: allWaypoints.length > 0 ? 'planning' : 'idle',
    });
  }

  removeWaypoint(waypointId: string): Result<void, AppError> {
    if (!this.state.route) {
      return err({ code: 'NO_ROUTE', message: 'Cannot remove waypoint: no route exists' });
    }

    const waypointExists = this.state.route.waypoints.some((wp) => wp.id === waypointId);
    if (!waypointExists) {
      return err({ code: 'WAYPOINT_NOT_FOUND', message: `Waypoint '${waypointId}' not found` });
    }

    const filteredWaypoints = this.state.route.waypoints.filter(
      (wp) => wp.id !== waypointId
    );

    const renumberedWaypoints = filteredWaypoints.map((wp, index) => ({
      ...wp,
      order: index,
    }));

    if (renumberedWaypoints.length === 0) {
      this.setState({
        route: null,
        status: 'idle',
      });
    } else {
      const route = this.calculateFullRoute(renumberedWaypoints);
      this.setState({ route });
    }

    return ok(undefined);
  }

  moveWaypoint(waypointId: string, newCoord: HexCoordinate): Result<void, AppError> {
    if (!this.state.route) {
      return err({ code: 'NO_ROUTE', message: 'Cannot move waypoint: no route exists' });
    }

    const waypointExists = this.state.route.waypoints.some((wp) => wp.id === waypointId);
    if (!waypointExists) {
      return err({ code: 'WAYPOINT_NOT_FOUND', message: `Waypoint '${waypointId}' not found` });
    }

    const updatedWaypoints = this.state.route.waypoints.map((wp) =>
      wp.id === waypointId ? { ...wp, coord: newCoord } : wp
    );

    const route = this.calculateFullRoute(updatedWaypoints);
    this.setState({ route });

    return ok(undefined);
  }

  clearRoute(): void {
    if (this.state.status === 'traveling') {
      this.stopTravel();
    }

    this.setState({
      route: null,
      progress: null,
      status: 'idle',
    });
  }

  private calculateFullRoute(waypoints: Waypoint[]): Route {
    return calculateRoute(
      this.state.partyPosition,
      waypoints,
      (coord) => this.geographyFeature.getTerrainAt(coord),
      this.config
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Travel Execution
  // ─────────────────────────────────────────────────────────────

  startTravel(): Result<void, AppError> {
    if (!this.state.route) {
      return err({ code: 'NO_ROUTE', message: 'Cannot start travel: no route planned' });
    }
    if (this.state.status === 'traveling') {
      return err({ code: 'ALREADY_TRAVELING', message: 'Travel already in progress' });
    }

    const route = this.state.route;
    const destination = route.waypoints[route.waypoints.length - 1];

    const hexSize = this.getHexSize();
    const initialPixelPos = hexToPixel(this.state.partyPosition, hexSize);

    const initialProgress: TravelProgress = {
      overallProgress: 0,
      currentSegmentIndex: 0,
      segmentProgress: 0,
      currentCoord: this.state.partyPosition,
      pixelPosition: initialPixelPos,
      elapsedDuration: {},
      remainingDuration: route.totalDuration,
    };

    this.setState({
      status: 'traveling',
      progress: initialProgress,
    });

    this.eventBus.publish(
      createEvent<'travel:started', TravelStartedPayload>(
        'travel:started',
        {
          routeId: route.id,
          from: this.state.partyPosition,
          to: destination.coord,
          estimatedDuration: route.totalDuration,
        },
        'travel'
      )
    );

    this.accumulatedMs = 0;
    this.hoursAdvanced = 0;

    return ok(undefined);
  }

  pauseTravel(): Result<void, AppError> {
    if (this.state.status !== 'traveling') {
      return err({ code: 'NOT_TRAVELING', message: 'Cannot pause: not currently traveling' });
    }

    this.setState({ status: 'paused' });

    if (this.state.route && this.state.progress) {
      this.eventBus.publish(
        createEvent<'travel:paused', TravelPausedPayload>(
          'travel:paused',
          {
            routeId: this.state.route.id,
            currentPosition: this.state.progress.currentCoord,
            progress: this.state.progress.overallProgress,
          },
          'travel'
        )
      );
    }

    return ok(undefined);
  }

  resumeTravel(): Result<void, AppError> {
    if (this.state.status !== 'paused') {
      return err({ code: 'NOT_PAUSED', message: 'Cannot resume: travel is not paused' });
    }

    this.setState({ status: 'traveling' });

    if (this.state.route) {
      this.eventBus.publish(
        createEvent('travel:resumed', { routeId: this.state.route.id }, 'travel')
      );
    }

    return ok(undefined);
  }

  stopTravel(): void {
    if (this.state.progress) {
      const finalPosition = this.state.progress.currentCoord;

      if (this.config.advanceTime) {
        const totalMinutes = durationToMinutes(this.state.progress.elapsedDuration);
        const minutesSinceLastHour = totalMinutes % 60;
        if (minutesSinceLastHour > 0) {
          const result = this.timeFeature.advanceTime({ minutes: minutesSinceLastHour }, 'travel');
          this.publishTimeEvents(result, 'travel');
        }
      }

      this.setState({
        partyPosition: finalPosition,
        status: 'idle',
        route: null,
        progress: null,
      });

      this.eventBus.publish(
        createEvent(
          'travel:stopped',
          {
            finalPosition,
            progress: this.state.progress?.overallProgress ?? 0,
          },
          'travel'
        )
      );
    } else {
      this.setState({
        status: 'idle',
        route: null,
        progress: null,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Tick
  // ─────────────────────────────────────────────────────────────

  private tick(deltaMs: number): void {
    if (this.state.status !== 'traveling') return;

    this.accumulatedMs += deltaMs;
    this.updateProgress(this.accumulatedMs);

    if (this.state.progress && this.state.progress.overallProgress >= 1) {
      this.completeTravel();
    }
  }

  private updateProgress(elapsedMs: number): void {
    if (!this.state.route || !this.state.progress) return;

    const route = this.state.route;
    const hexSize = this.getHexSize();

    const elapsedGameMinutes =
      (elapsedMs / 1000) * this.config.animationSpeedMultiplier;

    const totalGameMinutes = durationToMinutes(route.totalDuration);
    const overallProgress = Math.min(
      1,
      totalGameMinutes > 0 ? elapsedGameMinutes / totalGameMinutes : 1
    );

    const { coord, pixelPosition, currentSegmentIndex, segmentProgress } =
      interpolateRoutePosition(
        route,
        this.state.partyPosition,
        overallProgress,
        hexSize
      );

    const prevSegmentIndex = this.state.progress.currentSegmentIndex;
    if (currentSegmentIndex > prevSegmentIndex) {
      const reachedWaypoint = route.waypoints[prevSegmentIndex];
      if (reachedWaypoint) {
        this.eventBus.publish(
          createEvent<'travel:waypoint-reached', TravelWaypointReachedPayload>(
            'travel:waypoint-reached',
            {
              routeId: route.id,
              waypointId: reachedWaypoint.id,
              coord: reachedWaypoint.coord,
            },
            'travel'
          )
        );
      }
    }

    const prevCoord = this.state.progress.currentCoord;
    if (coord.q !== prevCoord.q || coord.r !== prevCoord.r) {
      this.eventBus.publish(
        createEvent<'position:changed', PositionChangedPayload>(
          'position:changed',
          {
            previous: prevCoord,
            current: coord,
            pixelPosition,
          },
          'travel'
        )
      );
    }

    const currentHours = Math.floor(elapsedGameMinutes / 60);
    if (this.config.advanceTime && currentHours > this.hoursAdvanced) {
      const hoursToAdvance = currentHours - this.hoursAdvanced;
      for (let i = 0; i < hoursToAdvance; i++) {
        const result = this.timeFeature.advanceTime({ hours: 1 }, 'travel');
        this.publishTimeEvents(result, 'travel');
      }
      this.hoursAdvanced = currentHours;
    }

    const elapsedDuration = minutesToDuration(Math.floor(elapsedGameMinutes));
    const remainingMinutes = Math.max(0, totalGameMinutes - elapsedGameMinutes);
    const remainingDuration = minutesToDuration(Math.floor(remainingMinutes));

    this.setState({
      progress: {
        overallProgress,
        currentSegmentIndex,
        segmentProgress,
        currentCoord: coord,
        pixelPosition,
        elapsedDuration,
        remainingDuration,
      },
    });
  }

  private completeTravel(): void {
    if (!this.state.route || !this.state.progress) return;

    const route = this.state.route;
    const finalWaypoint = route.waypoints[route.waypoints.length - 1];
    const startPosition = this.state.partyPosition;

    if (this.config.advanceTime) {
      const totalMinutes = durationToMinutes(route.totalDuration);
      const remainingMinutes = totalMinutes - (this.hoursAdvanced * 60);
      if (remainingMinutes > 0) {
        const result = this.timeFeature.advanceTime({ minutes: remainingMinutes }, 'travel');
        this.publishTimeEvents(result, 'travel');
      }
    }

    this.eventBus.publish(
      createEvent<'travel:completed', TravelCompletedPayload>(
        'travel:completed',
        {
          routeId: route.id,
          from: startPosition,
          to: finalWaypoint.coord,
          actualDuration: this.state.progress.elapsedDuration,
        },
        'travel'
      )
    );

    this.setState({
      partyPosition: finalWaypoint.coord,
      status: 'arrived',
      route: null,
      progress: null,
    });

    this.arrivalTimeoutId = setTimeout(() => {
      if (this.state.status === 'arrived') {
        this.setState({ status: 'idle' });
      }
      this.arrivalTimeoutId = null;
    }, 1000);
  }

  // ─────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────

  setAnimationSpeed(multiplier: number): void {
    this.config.animationSpeedMultiplier = Math.max(1, multiplier);
  }

  updateConfig(config: Partial<TravelConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.state.route && this.state.status === 'planning') {
      const route = this.calculateFullRoute(this.state.route.waypoints);
      this.setState({ route });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    this.setupEventSubscriptions();
  }

  dispose(): void {
    if (this.arrivalTimeoutId) {
      clearTimeout(this.arrivalTimeoutId);
      this.arrivalTimeoutId = null;
    }

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    this.listeners.clear();
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  private getHexSize(): number {
    const activeMap = this.geographyFeature.getActiveMap();
    return activeMap?.metadata.hexSize ?? 42;
  }

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
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

export function createTravelOrchestrator(
  geographyFeature: GeographyFeaturePort,
  timeFeature: TimeFeaturePort,
  eventBus: EventBus,
  config?: Partial<TravelConfig>
): TravelFeaturePort {
  return new TravelOrchestrator(geographyFeature, timeFeature, eventBus, config);
}
