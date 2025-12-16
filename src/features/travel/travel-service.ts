/**
 * Travel Feature service.
 *
 * Provides minimal travel operations: move to neighbor hex with time cost.
 * Implements TravelFeaturePort interface.
 */

import type { Result, AppError } from '@core/index';
import {
  ok,
  err,
  createError,
  hexAdjacent,
  isNone,
  isSome,
} from '@core/index';
import type { HexCoordinate } from '@core/schemas';
import { TRANSPORT_BASE_SPEEDS } from '@core/schemas';
import type { MapFeaturePort } from '../map';
import type { PartyFeaturePort } from '../party';
import type { TravelFeaturePort, TravelResult } from './types';
import { calculateHexTraversalTime } from './types';

// ============================================================================
// Travel Service
// ============================================================================

export interface TravelServiceDeps {
  mapFeature: MapFeaturePort;
  partyFeature: PartyFeaturePort;
}

/**
 * Create the travel service (implements TravelFeaturePort).
 */
export function createTravelService(deps: TravelServiceDeps): TravelFeaturePort {
  const { mapFeature, partyFeature } = deps;

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

  return {
    moveToNeighbor(target: HexCoordinate): Result<TravelResult, AppError> {
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

      // Calculate time cost
      const transport = partyFeature.getActiveTransport();
      const baseSpeed = TRANSPORT_BASE_SPEEDS[transport];
      const movementCost = mapFeature.getMovementCost(target);
      const timeCostHours = calculateHexTraversalTime(baseSpeed, movementCost);

      // Get terrain ID for result
      const tile = mapFeature.getTile(target);
      const terrainId = isSome(tile) ? String(tile.value.terrain) : 'unknown';

      // Move party
      partyFeature.setPosition(target);

      return ok({
        from: current,
        to: target,
        timeCostHours,
        transport,
        terrainId,
      });
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

      // Calculate time
      const transport = partyFeature.getActiveTransport();
      const baseSpeed = TRANSPORT_BASE_SPEEDS[transport];
      const movementCost = mapFeature.getMovementCost(target);

      return ok(calculateHexTraversalTime(baseSpeed, movementCost));
    },

    canMoveTo(target: HexCoordinate): boolean {
      const posResult = getPartyPosition();
      if (!posResult.ok) return false;

      const adjResult = validateAdjacent(posResult.value, target);
      if (!adjResult.ok) return false;

      const travResult = validateTraversable(target);
      return travResult.ok;
    },
  };
}
