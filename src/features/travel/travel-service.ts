/**
 * Travel Feature service.
 *
 * Provides minimal travel operations: move to neighbor hex with time cost.
 * Uses EventBus for time:advance-requested and travel:position-changed.
 * Implements TravelFeaturePort interface.
 */

import type {
  Result,
  AppError,
  EventBus,
  Unsubscribe,
  Option,
} from '@core/index';
import {
  ok,
  err,
  createError,
  hexAdjacent,
  hexDistance,
  hexNeighbors,
  hexEquals,
  isNone,
  isSome,
  some,
  none,
  createEvent,
  newCorrelationId,
  now,
  EventTypes,
} from '@core/index';
import type { HexCoordinate, Duration } from '@core/schemas';
import { TRANSPORT_BASE_SPEEDS } from '@core/schemas';
import type { MapFeaturePort } from '../map';
import type { PartyFeaturePort } from '../party';
import type { TimeFeaturePort } from '../time';
import type { WeatherFeaturePort } from '../weather';
import type {
  TravelFeaturePort,
  TravelResult,
  TravelState,
  TravelStatus,
  Route,
  RouteSegment,
  PauseReason,
} from './types';
import { calculateHexTraversalTime, createInitialTravelState } from './types';
import { createTravelStore } from './travel-store';
import { addDuration as addDurationToTime } from '../time/time-utils';
import {
  calculateEncounterChance,
  rollEncounter,
  DEFAULT_POPULATION,
} from '../encounter/encounter-chance';
import type {
  TimeAdvanceRequestedPayload,
  TravelPositionChangedPayload,
  TravelMoveRequestedPayload,
  TravelPlanRequestedPayload,
  TravelStartRequestedPayload,
  TravelPauseRequestedPayload,
  TravelResumeRequestedPayload,
  TravelCancelRequestedPayload,
  TravelStateChangedPayload,
  TravelRoutePlannedPayload,
  TravelStartedPayload,
  TravelPausedPayload,
  TravelResumedPayload,
  TravelCompletedPayload,
} from '@core/events/domain-events';

// ============================================================================
// Travel Service
// ============================================================================

export interface TravelServiceDeps {
  mapFeature: MapFeaturePort;
  partyFeature: PartyFeaturePort;
  timeFeature: TimeFeaturePort;
  weatherFeature?: WeatherFeaturePort; // Optional: provides weather speed factor
  eventBus?: EventBus; // Optional during migration
}

/**
 * Generate a unique route ID.
 */
function generateRouteId(): string {
  return `route-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create the travel service (implements TravelFeaturePort).
 */
export function createTravelService(deps: TravelServiceDeps): TravelFeaturePort {
  const { mapFeature, partyFeature, timeFeature, weatherFeature, eventBus } =
    deps;

  // Track subscriptions for cleanup
  const subscriptions: Unsubscribe[] = [];

  // Create state store for state machine
  const store = createTravelStore();

  // ===========================================================================
  // Travel Loop (automatic segment-by-segment movement)
  // ===========================================================================

  let travelLoopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const TRAVEL_LOOP_DELAY_MS = 100; // Short delay for responsiveness

  /**
   * Start the automatic travel loop.
   * The loop advances segments until route complete, paused, or encounter.
   */
  function startTravelLoop(correlationId?: string): void {
    if (travelLoopTimeoutId !== null) return; // Already running

    function tick() {
      if (store.getStatus() !== 'traveling') {
        travelLoopTimeoutId = null;
        return;
      }

      const result = processNextTravelTick(correlationId);

      if (result.shouldContinue) {
        travelLoopTimeoutId = setTimeout(tick, TRAVEL_LOOP_DELAY_MS);
      } else {
        travelLoopTimeoutId = null;
      }
    }

    tick();
  }

  /**
   * Stop the travel loop (for pause, cancel, or dispose).
   */
  function stopTravelLoop(): void {
    if (travelLoopTimeoutId !== null) {
      clearTimeout(travelLoopTimeoutId);
      travelLoopTimeoutId = null;
    }
  }

  /**
   * Process one tick of the travel loop (advance one segment).
   * Returns whether the loop should continue.
   */
  function processNextTravelTick(
    correlationId?: string
  ): { shouldContinue: boolean } {
    const state = store.getState();
    const { route, currentSegmentIndex, hourProgress } = state;

    if (!route || currentSegmentIndex >= route.segments.length) {
      // Route complete
      finalizeTravelInternal(correlationId);
      return { shouldContinue: false };
    }

    const segment = route.segments[currentSegmentIndex];
    const timeCostHours = segment.timeCostHours;

    // Calculate hour boundaries for encounter checks
    const previousHourProgress = hourProgress;
    const newTotalProgress = previousHourProgress + timeCostHours;
    const hoursCrossed =
      Math.floor(newTotalProgress) - Math.floor(previousHourProgress);

    // Encounter checks for each full hour crossed
    for (let i = 0; i < hoursCrossed; i++) {
      const encounterTriggered = checkForEncounter(segment.to, correlationId);
      if (encounterTriggered) {
        // Travel will be paused by encounter:generated event handler
        return { shouldContinue: false };
      }
    }

    // Execute segment move (position + time)
    const moveResult = executeMove(segment.to, correlationId);
    if (!moveResult.ok) {
      return { shouldContinue: false };
    }

    // Update hour progress
    store.setHourProgress(newTotalProgress % 1);
    store.incrementTotalHours(timeCostHours);

    // Advance to next segment
    const hasMore = store.advanceToNextSegment();

    if (!hasMore) {
      finalizeTravelInternal(correlationId);
      return { shouldContinue: false };
    }

    return { shouldContinue: true };
  }

  /**
   * Finalize travel (route complete).
   */
  function finalizeTravelInternal(correlationId?: string): void {
    const state = store.getState();
    const route = state.route;

    if (route) {
      store.setArrived();
      publishStateChanged(correlationId);
      publishTravelCompleted(
        route.waypoints[route.waypoints.length - 1],
        route.totalDuration,
        correlationId
      );
    }
  }

  /**
   * Check for encounter at position (called at hour boundaries).
   * Returns true if encounter was triggered.
   */
  function checkForEncounter(
    position: HexCoordinate,
    correlationId?: string
  ): boolean {
    if (!eventBus) return false;

    // Get population from map tile
    const population = getPopulationAt(position);

    // Calculate chance for 1 hour
    const chance = calculateEncounterChance(1, population);

    // Roll for encounter
    if (!rollEncounter(chance)) {
      return false;
    }

    // Generate encounter (will pause travel via existing event handler)
    eventBus.publish(
      createEvent(
        EventTypes.ENCOUNTER_GENERATE_REQUESTED,
        {
          position,
          trigger: 'travel' as const,
        },
        {
          correlationId: correlationId ?? newCorrelationId(),
          timestamp: now(),
          source: 'travel-feature',
        }
      )
    );

    return true;
  }

  /**
   * Get population at a hex coordinate for encounter chance calculation.
   * TODO: Integrate with faction presence when available (post-MVP).
   */
  function getPopulationAt(_position: HexCoordinate): number {
    // MVP: Use default population (50 = normal density)
    // Post-MVP: Derive from tile.factionPresence
    return DEFAULT_POPULATION;
  }

  // ===========================================================================
  // Event Publishing Helpers
  // ===========================================================================

  function publishTimeAdvance(
    hours: number,
    minutes: number,
    correlationId?: string
  ): void {
    if (!eventBus) {
      // Fallback to direct call during migration
      timeFeature.advanceTime({ hours, minutes });
      return;
    }

    const duration: Duration = { hours, minutes };
    const payload: TimeAdvanceRequestedPayload = {
      duration,
      reason: 'travel',
    };

    eventBus.publish(
      createEvent(EventTypes.TIME_ADVANCE_REQUESTED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'travel-feature',
      })
    );
  }

  function publishPositionChanged(
    from: HexCoordinate,
    to: HexCoordinate,
    timeCostHours: number,
    terrainId: string,
    correlationId?: string
  ): void {
    if (!eventBus) return;

    // For minimal travel, progress is always 1.0 (complete)
    // and remaining duration is 0
    const payload: TravelPositionChangedPayload = {
      position: to,
      from,
      progress: 1.0,
      remainingDuration: { hours: 0, minutes: 0 },
      terrainId,
      timeCostHours,
    };

    eventBus.publish(
      createEvent(EventTypes.TRAVEL_POSITION_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'travel-feature',
      })
    );
  }

  function publishStateChanged(correlationId?: string): void {
    if (!eventBus) return;

    const payload: TravelStateChangedPayload = {
      state: store.getState(),
    };

    eventBus.publish(
      createEvent(EventTypes.TRAVEL_STATE_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'travel-feature',
      })
    );
  }

  function publishRoutePlanned(route: Route, correlationId?: string): void {
    if (!eventBus) return;

    const payload: TravelRoutePlannedPayload = {
      routeId: route.id,
      route,
      estimatedDuration: route.totalDuration,
    };

    eventBus.publish(
      createEvent(EventTypes.TRAVEL_ROUTE_PLANNED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'travel-feature',
      })
    );
  }

  function publishTravelStarted(route: Route, correlationId?: string): void {
    if (!eventBus) return;

    const currentTime = timeFeature.getCurrentTime();
    const calendar = timeFeature.getActiveCalendar();

    // Calculate estimated arrival time
    let arrivalTime = currentTime;
    if (isSome(calendar)) {
      arrivalTime = addDurationToTime(currentTime, route.totalDuration, calendar.value);
    }

    const payload: TravelStartedPayload = {
      routeId: route.id,
      from: route.waypoints[0],
      to: route.waypoints[route.waypoints.length - 1],
      estimatedArrival: arrivalTime,
    };

    eventBus.publish(
      createEvent(EventTypes.TRAVEL_STARTED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'travel-feature',
      })
    );
  }

  function publishTravelPaused(
    position: HexCoordinate,
    reason: PauseReason,
    correlationId?: string
  ): void {
    if (!eventBus) return;

    const payload: TravelPausedPayload = {
      position,
      reason,
    };

    eventBus.publish(
      createEvent(EventTypes.TRAVEL_PAUSED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'travel-feature',
      })
    );
  }

  function publishTravelResumed(
    position: HexCoordinate,
    correlationId?: string
  ): void {
    if (!eventBus) return;

    const payload: TravelResumedPayload = {
      position,
    };

    eventBus.publish(
      createEvent(EventTypes.TRAVEL_RESUMED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'travel-feature',
      })
    );
  }

  function publishTravelCompleted(
    destination: HexCoordinate,
    totalDuration: Duration,
    correlationId?: string
  ): void {
    if (!eventBus) return;

    const payload: TravelCompletedPayload = {
      destination,
      totalDuration,
    };

    eventBus.publish(
      createEvent(EventTypes.TRAVEL_COMPLETED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'travel-feature',
      })
    );
  }

  // ===========================================================================
  // Weather Helper
  // ===========================================================================

  /**
   * Get weather speed factor from weather feature (defaults to 1.0 if unavailable).
   */
  function getWeatherSpeedFactor(): number {
    return weatherFeature?.getWeatherSpeedFactor() ?? 1.0;
  }

  // ===========================================================================
  // Validation Helpers
  // ===========================================================================

  /**
   * Get current party position or error.
   */
  function getPartyPosition(): Result<HexCoordinate, AppError> {
    const position = partyFeature.getPosition();
    if (isNone(position)) {
      return err(createError('NO_PARTY_POSITION', 'Party has no position'));
    }
    return ok(position.value);
  }

  /**
   * Validate that target is adjacent to current position.
   */
  function validateAdjacent(
    current: HexCoordinate,
    target: HexCoordinate
  ): Result<void, AppError> {
    if (!hexAdjacent(current, target)) {
      return err(
        createError(
          'NOT_ADJACENT',
          `Target (${target.q},${target.r}) is not adjacent to current position (${current.q},${current.r})`
        )
      );
    }
    return ok(undefined);
  }

  /**
   * Validate that target is a valid, traversable tile.
   */
  function validateTraversable(target: HexCoordinate): Result<void, AppError> {
    if (!mapFeature.isValidCoordinate(target)) {
      return err(
        createError(
          'INVALID_COORDINATE',
          `Target (${target.q},${target.r}) is not a valid map coordinate`
        )
      );
    }

    const terrain = mapFeature.getTerrainAt(target);
    if (isNone(terrain)) {
      return err(
        createError('NO_TERRAIN', `No terrain at (${target.q},${target.r})`)
      );
    }

    const transport = partyFeature.getActiveTransport();
    const terrainDef = terrain.value;

    // Check transport restrictions
    if (terrainDef.requiresBoat && transport !== 'boat') {
      return err(
        createError(
          'REQUIRES_BOAT',
          `${terrainDef.name} requires a boat to traverse`
        )
      );
    }

    if (terrainDef.blocksMounted && transport === 'mounted') {
      return err(
        createError(
          'BLOCKS_MOUNTED',
          `${terrainDef.name} cannot be traversed while mounted`
        )
      );
    }

    if (terrainDef.blocksCarriage && transport === 'carriage') {
      return err(
        createError(
          'BLOCKS_CARRIAGE',
          `${terrainDef.name} cannot be traversed by carriage`
        )
      );
    }

    return ok(undefined);
  }

  // ===========================================================================
  // Pathfinding (Greedy MVP)
  // ===========================================================================

  /**
   * Get base speed in mph for current transport mode.
   *
   * For 'foot' transport: Uses party's effective speed (after encumbrance)
   * converted from feet to mph (30 ft = 3 mph).
   *
   * For other transports: Uses standard transport speeds.
   */
  function getBaseSpeed(): number {
    const transport = partyFeature.getActiveTransport();

    if (transport === 'foot') {
      // Use character speed (feet) converted to mph
      // D&D: 30 feet walking speed ≈ 3 mph
      const effectiveSpeedFeet = partyFeature.getEffectivePartySpeed();
      return effectiveSpeedFeet / 10;
    }

    // For mounted, carriage, boat - use transport base speeds
    return TRANSPORT_BASE_SPEEDS[transport];
  }

  /**
   * Check if a hex is traversable with current transport.
   */
  function isTraversable(coord: HexCoordinate): boolean {
    return validateTraversable(coord).ok;
  }

  /**
   * Calculate time cost for a single hex transition.
   */
  function calculateSegmentTime(target: HexCoordinate): number {
    const baseSpeed = getBaseSpeed();
    const movementCost = mapFeature.getMovementCost(target);
    const weatherFactor = getWeatherSpeedFactor();
    return calculateHexTraversalTime(baseSpeed, movementCost, weatherFactor);
  }

  /**
   * Get terrain ID for a hex.
   */
  function getTerrainIdAt(coord: HexCoordinate): string {
    const tile = mapFeature.getTile(coord);
    return isSome(tile) ? String(tile.value.terrain) : 'unknown';
  }

  /**
   * Find path from start to destination using greedy neighbor selection.
   * MVP pathfinding: always pick the traversable neighbor closest to destination.
   *
   * @param start - Starting position
   * @param destination - Target position
   * @returns Array of waypoints including start and destination, or null if no path
   */
  function findPathGreedy(
    start: HexCoordinate,
    destination: HexCoordinate
  ): HexCoordinate[] | null {
    // Already at destination
    if (hexEquals(start, destination)) {
      return [start];
    }

    const path: HexCoordinate[] = [start];
    let current = start;
    const visited = new Set<string>();
    visited.add(`${current.q},${current.r}`);

    const maxIterations = 100; // Prevent infinite loops
    let iterations = 0;

    while (!hexEquals(current, destination) && iterations < maxIterations) {
      iterations++;

      // Get all neighbors
      const neighbors = hexNeighbors(current);

      // Find the best traversable neighbor (closest to destination)
      let bestNeighbor: HexCoordinate | null = null;
      let bestDistance = Infinity;

      for (const neighbor of neighbors) {
        const key = `${neighbor.q},${neighbor.r}`;
        if (visited.has(key)) continue;
        if (!isTraversable(neighbor)) continue;

        const dist = hexDistance(neighbor, destination);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestNeighbor = neighbor;
        }
      }

      // No valid neighbor found - path blocked
      if (!bestNeighbor) {
        return null;
      }

      // Move to best neighbor
      path.push(bestNeighbor);
      visited.add(`${bestNeighbor.q},${bestNeighbor.r}`);
      current = bestNeighbor;
    }

    // Check if we reached the destination
    if (!hexEquals(current, destination)) {
      return null;
    }

    return path;
  }

  /**
   * Build a Route from waypoints.
   */
  function buildRoute(waypoints: HexCoordinate[]): Route {
    const transport = partyFeature.getActiveTransport();
    const segments: RouteSegment[] = [];
    let totalHours = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      const timeCostHours = calculateSegmentTime(to);
      const terrainId = getTerrainIdAt(to);

      segments.push({
        from,
        to,
        terrainId,
        timeCostHours,
      });

      totalHours += timeCostHours;
    }

    const totalMinutes = Math.round(totalHours * 60);
    const durationHours = Math.floor(totalMinutes / 60);
    const durationMinutes = totalMinutes % 60;

    return {
      id: generateRouteId(),
      waypoints,
      transport,
      segments,
      totalDuration: { hours: durationHours, minutes: durationMinutes },
    };
  }

  // ===========================================================================
  // Move Operations
  // ===========================================================================

  /**
   * Execute the actual move operation.
   */
  function executeMove(
    target: HexCoordinate,
    correlationId?: string
  ): Result<TravelResult, AppError> {
    // Get current position
    const posResult = getPartyPosition();
    if (!posResult.ok) return posResult;
    const current = posResult.value;

    // Validate adjacency
    const adjResult = validateAdjacent(current, target);
    if (!adjResult.ok) return adjResult;

    // Validate traversable
    const travResult = validateTraversable(target);
    if (!travResult.ok) return travResult;

    // Calculate time cost (including weather factor and encumbrance for foot travel)
    const transport = partyFeature.getActiveTransport();
    const baseSpeed = getBaseSpeed();
    const movementCost = mapFeature.getMovementCost(target);
    const weatherFactor = getWeatherSpeedFactor();
    const timeCostHours = calculateHexTraversalTime(
      baseSpeed,
      movementCost,
      weatherFactor
    );

    // Get terrain ID for result
    const tile = mapFeature.getTile(target);
    const terrainId = isSome(tile) ? String(tile.value.terrain) : 'unknown';

    // Move party
    partyFeature.setPosition(target);

    // Advance game time based on travel duration (via EventBus)
    const hours = Math.floor(timeCostHours);
    const minutes = Math.round((timeCostHours % 1) * 60);
    publishTimeAdvance(hours, minutes, correlationId);

    // Publish position changed event
    publishPositionChanged(current, target, timeCostHours, terrainId, correlationId);

    return ok({
      from: current,
      to: target,
      timeCostHours,
      transport,
      terrainId,
    });
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  function setupEventHandlers(): void {
    if (!eventBus) return;

    // Handle travel:move-requested (single hex)
    subscriptions.push(
      eventBus.subscribe<TravelMoveRequestedPayload>(
        EventTypes.TRAVEL_MOVE_REQUESTED,
        (event) => {
          const { target } = event.payload;
          const correlationId = event.correlationId;

          // Execute the move - result handling is internal
          // In a full implementation, we'd publish success/failure events
          executeMove(target, correlationId);
        }
      )
    );

    // Handle travel:plan-requested (multi-hex route)
    subscriptions.push(
      eventBus.subscribe<TravelPlanRequestedPayload>(
        EventTypes.TRAVEL_PLAN_REQUESTED,
        (event) => {
          const { to } = event.payload;
          const correlationId = event.correlationId;

          // Plan the route
          const result = planRouteInternal(to, correlationId);
          if (!result.ok) {
            // Could publish travel:failed here
            console.warn('Route planning failed:', result.error);
          }
        }
      )
    );

    // Handle travel:start-requested
    subscriptions.push(
      eventBus.subscribe<TravelStartRequestedPayload>(
        EventTypes.TRAVEL_START_REQUESTED,
        (event) => {
          const correlationId = event.correlationId;
          startTravelInternal(correlationId);
        }
      )
    );

    // Handle travel:pause-requested
    subscriptions.push(
      eventBus.subscribe<TravelPauseRequestedPayload>(
        EventTypes.TRAVEL_PAUSE_REQUESTED,
        (event) => {
          const { reason } = event.payload;
          const correlationId = event.correlationId;
          pauseTravelInternal(reason, correlationId);
        }
      )
    );

    // Handle travel:resume-requested
    subscriptions.push(
      eventBus.subscribe<TravelResumeRequestedPayload>(
        EventTypes.TRAVEL_RESUME_REQUESTED,
        (event) => {
          const correlationId = event.correlationId;
          resumeTravelInternal(correlationId);
        }
      )
    );

    // Handle travel:cancel-requested
    subscriptions.push(
      eventBus.subscribe<TravelCancelRequestedPayload>(
        EventTypes.TRAVEL_CANCEL_REQUESTED,
        (event) => {
          const correlationId = event.correlationId;
          cancelTravelInternal(correlationId);
        }
      )
    );

    // Auto-pause on encounter:generated
    subscriptions.push(
      eventBus.subscribe(
        EventTypes.ENCOUNTER_GENERATED,
        (event) => {
          if (store.getStatus() === 'traveling') {
            pauseTravelInternal('encounter', event.correlationId);
          }
        }
      )
    );
  }

  // ===========================================================================
  // State Machine Operations (Internal)
  // ===========================================================================

  function planRouteInternal(
    destination: HexCoordinate,
    correlationId?: string
  ): Result<Route, AppError> {
    // Can only plan from idle state
    if (store.getStatus() !== 'idle') {
      return err(
        createError(
          'INVALID_STATE',
          `Cannot plan route while in '${store.getStatus()}' state`
        )
      );
    }

    // Get current position
    const posResult = getPartyPosition();
    if (!posResult.ok) return posResult;
    const start = posResult.value;

    // Validate destination is traversable
    const travResult = validateTraversable(destination);
    if (!travResult.ok) return travResult;

    // Find path
    const waypoints = findPathGreedy(start, destination);
    if (!waypoints) {
      return err(
        createError(
          'NO_PATH',
          `No traversable path from (${start.q},${start.r}) to (${destination.q},${destination.r})`
        )
      );
    }

    // Build route
    const route = buildRoute(waypoints);

    // Update state
    store.setPlanning(route);
    publishStateChanged(correlationId);
    publishRoutePlanned(route, correlationId);

    return ok(route);
  }

  /**
   * Plan a route through multiple user-specified waypoints.
   * This differs from planRouteInternal in that it:
   * 1. Takes an array of waypoints (not including start)
   * 2. Finds paths between each consecutive pair
   * 3. Stores user waypoints in Route.waypoints (for UI visualization)
   */
  function planRouteWithWaypointsInternal(
    userWaypoints: HexCoordinate[],
    correlationId?: string
  ): Result<Route, AppError> {
    // Validate we have at least one waypoint
    if (userWaypoints.length === 0) {
      return err(
        createError('NO_WAYPOINTS', 'At least one waypoint is required')
      );
    }

    // Can only plan from idle state
    if (store.getStatus() !== 'idle') {
      return err(
        createError(
          'INVALID_STATE',
          `Cannot plan route while in '${store.getStatus()}' state`
        )
      );
    }

    // Get current position
    const posResult = getPartyPosition();
    if (!posResult.ok) return posResult;
    const start = posResult.value;

    // Validate all waypoints are traversable
    for (const waypoint of userWaypoints) {
      const travResult = validateTraversable(waypoint);
      if (!travResult.ok) {
        return err(
          createError(
            'INVALID_WAYPOINT',
            `Waypoint (${waypoint.q},${waypoint.r}) is not traversable: ${travResult.error.message}`
          )
        );
      }
    }

    // Build complete path through all waypoints
    const allUserWaypoints = [start, ...userWaypoints];
    const completePath: HexCoordinate[] = [start];

    for (let i = 0; i < allUserWaypoints.length - 1; i++) {
      const segmentStart = allUserWaypoints[i];
      const segmentEnd = allUserWaypoints[i + 1];

      // Find path for this segment
      const pathSegment = findPathGreedy(segmentStart, segmentEnd);
      if (!pathSegment) {
        return err(
          createError(
            'NO_PATH',
            `No traversable path from (${segmentStart.q},${segmentStart.r}) to (${segmentEnd.q},${segmentEnd.r})`
          )
        );
      }

      // Add path segment (skip first point as it's already in completePath)
      for (let j = 1; j < pathSegment.length; j++) {
        completePath.push(pathSegment[j]);
      }
    }

    // Build route segments from complete path
    const transport = partyFeature.getActiveTransport();
    const segments: RouteSegment[] = [];
    let totalHours = 0;

    for (let i = 0; i < completePath.length - 1; i++) {
      const from = completePath[i];
      const to = completePath[i + 1];
      const timeCostHours = calculateSegmentTime(to);
      const terrainId = getTerrainIdAt(to);

      segments.push({
        from,
        to,
        terrainId,
        timeCostHours,
      });

      totalHours += timeCostHours;
    }

    const totalMinutes = Math.round(totalHours * 60);
    const durationHours = Math.floor(totalMinutes / 60);
    const durationMinutes = totalMinutes % 60;

    // Create route with user waypoints (for visualization) and all segments
    const route: Route = {
      id: generateRouteId(),
      waypoints: allUserWaypoints, // User-specified waypoints for UI
      transport,
      segments, // All hex-to-hex transitions
      totalDuration: { hours: durationHours, minutes: durationMinutes },
    };

    // Update state
    store.setPlanning(route);
    publishStateChanged(correlationId);
    publishRoutePlanned(route, correlationId);

    return ok(route);
  }

  function startTravelInternal(correlationId?: string): Result<void, AppError> {
    // Can only start from planning state
    if (store.getStatus() !== 'planning') {
      return err(
        createError(
          'INVALID_STATE',
          `Cannot start travel while in '${store.getStatus()}' state`
        )
      );
    }

    const route = store.getState().route;
    if (!route) {
      return err(createError('NO_ROUTE', 'No route planned'));
    }

    // Transition to traveling
    store.setTraveling();

    // Initialize hour tracking for encounter checks
    store.resetTravelProgress();

    publishStateChanged(correlationId);
    publishTravelStarted(route, correlationId);

    // Start automatic segment movement
    startTravelLoop(correlationId);

    return ok(undefined);
  }

  function pauseTravelInternal(
    reason: PauseReason,
    correlationId?: string
  ): Result<void, AppError> {
    // Stop the travel loop first
    stopTravelLoop();

    // Can only pause from traveling state
    if (store.getStatus() !== 'traveling') {
      return err(
        createError(
          'INVALID_STATE',
          `Cannot pause while in '${store.getStatus()}' state`
        )
      );
    }

    // Get current position
    const posResult = getPartyPosition();
    if (!posResult.ok) return posResult;
    const position = posResult.value;

    // Transition to paused
    store.setPaused(reason);
    publishStateChanged(correlationId);
    publishTravelPaused(position, reason, correlationId);

    return ok(undefined);
  }

  function resumeTravelInternal(correlationId?: string): Result<void, AppError> {
    // Can only resume from paused state
    if (store.getStatus() !== 'paused') {
      return err(
        createError(
          'INVALID_STATE',
          `Cannot resume while in '${store.getStatus()}' state`
        )
      );
    }

    // Get current position
    const posResult = getPartyPosition();
    if (!posResult.ok) return posResult;
    const position = posResult.value;

    // Transition to traveling
    store.setResumed();
    publishStateChanged(correlationId);
    publishTravelResumed(position, correlationId);

    // Restart automatic segment movement
    startTravelLoop(correlationId);

    return ok(undefined);
  }

  function cancelTravelInternal(correlationId?: string): Result<void, AppError> {
    // Stop the travel loop first
    stopTravelLoop();

    const status = store.getStatus();

    // Can cancel from planning, traveling, or paused
    if (status === 'idle' || status === 'arrived') {
      return err(
        createError(
          'INVALID_STATE',
          `Cannot cancel while in '${status}' state`
        )
      );
    }

    // Reset to idle
    store.setIdle();
    publishStateChanged(correlationId);

    return ok(undefined);
  }

  function advanceSegmentInternal(
    correlationId?: string
  ): Result<TravelResult | null, AppError> {
    // Can only advance while traveling
    if (store.getStatus() !== 'traveling') {
      return err(
        createError(
          'INVALID_STATE',
          `Cannot advance segment while in '${store.getStatus()}' state`
        )
      );
    }

    const state = store.getState();
    const route = state.route;
    if (!route) {
      return err(createError('NO_ROUTE', 'No route active'));
    }

    const segmentIndex = state.currentSegmentIndex;
    if (segmentIndex >= route.segments.length) {
      // Already at end
      return ok(null);
    }

    const segment = route.segments[segmentIndex];

    // Execute move for this segment
    const moveResult = executeMove(segment.to, correlationId);
    if (!moveResult.ok) return moveResult;

    // Check if there are more segments
    const hasMore = store.advanceToNextSegment();

    if (!hasMore) {
      // Route complete
      store.setArrived();
      publishStateChanged(correlationId);
      publishTravelCompleted(
        route.waypoints[route.waypoints.length - 1],
        route.totalDuration,
        correlationId
      );
    }

    return ok(moveResult.value);
  }

  // Set up event handlers immediately if eventBus is provided
  setupEventHandlers();

  return {
    // =========================================================================
    // Single-Hex Movement (Minimal)
    // =========================================================================

    moveToNeighbor(target: HexCoordinate): Result<TravelResult, AppError> {
      return executeMove(target);
    },

    calculateTimeCost(target: HexCoordinate): Result<number, AppError> {
      // Get current position
      const posResult = getPartyPosition();
      if (!posResult.ok) return posResult;
      const current = posResult.value;

      // Validate adjacency
      const adjResult = validateAdjacent(current, target);
      if (!adjResult.ok) return adjResult;

      // Validate traversable
      const travResult = validateTraversable(target);
      if (!travResult.ok) return travResult;

      // Calculate time (including weather factor and encumbrance for foot travel)
      const baseSpeed = getBaseSpeed();
      const movementCost = mapFeature.getMovementCost(target);
      const weatherFactor = getWeatherSpeedFactor();

      return ok(
        calculateHexTraversalTime(baseSpeed, movementCost, weatherFactor)
      );
    },

    canMoveTo(target: HexCoordinate): boolean {
      const posResult = getPartyPosition();
      if (!posResult.ok) return false;

      const adjResult = validateAdjacent(posResult.value, target);
      if (!adjResult.ok) return false;

      const travResult = validateTraversable(target);
      return travResult.ok;
    },

    // =========================================================================
    // State Machine (Multi-Hex Routes)
    // =========================================================================

    getState(): Readonly<TravelState> {
      return store.getState();
    },

    getStatus(): TravelStatus {
      return store.getStatus();
    },

    getRoute(): Option<Readonly<Route>> {
      const route = store.getState().route;
      return route ? some(route) : none();
    },

    planRoute(destination: HexCoordinate): Result<Route, AppError> {
      return planRouteInternal(destination);
    },

    planRouteWithWaypoints(waypoints: HexCoordinate[]): Result<Route, AppError> {
      return planRouteWithWaypointsInternal(waypoints);
    },

    startTravel(): Result<void, AppError> {
      return startTravelInternal();
    },

    pauseTravel(reason: PauseReason): Result<void, AppError> {
      return pauseTravelInternal(reason);
    },

    resumeTravel(): Result<void, AppError> {
      return resumeTravelInternal();
    },

    cancelTravel(): Result<void, AppError> {
      return cancelTravelInternal();
    },

    advanceSegment(): Result<TravelResult | null, AppError> {
      return advanceSegmentInternal();
    },

    // =========================================================================
    // Lifecycle
    // =========================================================================

    dispose(): void {
      // Stop travel loop to prevent orphan timeouts
      stopTravelLoop();

      // Clean up all EventBus subscriptions
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
      store.clear();
    },
  };
}
