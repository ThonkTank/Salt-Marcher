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
} from '@core/index';
import {
  ok,
  err,
  createError,
  hexAdjacent,
  isNone,
  isSome,
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
import type { TravelFeaturePort, TravelResult } from './types';
import { calculateHexTraversalTime } from './types';
import type {
  TimeAdvanceRequestedPayload,
  TravelPositionChangedPayload,
  TravelMoveRequestedPayload,
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
 * Create the travel service (implements TravelFeaturePort).
 */
export function createTravelService(deps: TravelServiceDeps): TravelFeaturePort {
  const { mapFeature, partyFeature, timeFeature, weatherFeature, eventBus } =
    deps;

  // Track subscriptions for cleanup
  const subscriptions: Unsubscribe[] = [];

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

    // Calculate time cost (including weather factor)
    const transport = partyFeature.getActiveTransport();
    const baseSpeed = TRANSPORT_BASE_SPEEDS[transport];
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

    // Handle travel:move-requested
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
  }

  // Set up event handlers immediately if eventBus is provided
  setupEventHandlers();

  return {
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

      // Calculate time (including weather factor)
      const transport = partyFeature.getActiveTransport();
      const baseSpeed = TRANSPORT_BASE_SPEEDS[transport];
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
    // Lifecycle
    // =========================================================================

    dispose(): void {
      // Clean up all EventBus subscriptions
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
    },
  };
}
