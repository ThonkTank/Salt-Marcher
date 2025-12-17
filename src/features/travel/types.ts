/**
 * Travel Feature types and interfaces.
 *
 * Travel-Minimal: Simple hex-to-hex movement with time cost.
 */

import type { Result, AppError } from '@core/index';
import type { HexCoordinate, TransportMode } from '@core/schemas';

// ============================================================================
// Travel Feature Port
// ============================================================================

/**
 * Public interface for the Travel Feature (Minimal).
 */
export interface TravelFeaturePort {
  /**
   * Move party to an adjacent hex.
   * Returns the time cost in hours.
   */
  moveToNeighbor(target: HexCoordinate): Result<TravelResult, AppError>;

  /**
   * Calculate time cost to move to a target hex.
   * Does not perform the move.
   */
  calculateTimeCost(target: HexCoordinate): Result<number, AppError>;

  /**
   * Check if a move to target is valid (adjacent and traversable).
   */
  canMoveTo(target: HexCoordinate): boolean;

  /**
   * Clean up subscriptions and resources.
   */
  dispose(): void;
}

// ============================================================================
// Travel Result
// ============================================================================

/**
 * Result of a successful travel move.
 */
export interface TravelResult {
  /** Starting position */
  from: HexCoordinate;

  /** Destination position */
  to: HexCoordinate;

  /** Time cost in hours */
  timeCostHours: number;

  /** Transport mode used */
  transport: TransportMode;

  /** Terrain at destination */
  terrainId: string;
}

// ============================================================================
// Time Calculation
// ============================================================================

/**
 * Calculate travel time for one hex based on transport and terrain.
 *
 * Formula: baseTime / (terrainMovementCost)
 * Where baseTime = 1 / transportBaseSpeed (hours per mile)
 *
 * Assumptions for Travel-Minimal:
 * - 1 hex = 6 miles (standard D&D hex)
 * - Time = distance / (baseSpeed * terrainFactor)
 */
export const HEX_SIZE_MILES = 6;

/**
 * Calculate time to traverse one hex in hours.
 *
 * @param transportBaseSpeedMph - Base speed of transport mode (mph)
 * @param terrainMovementCost - Terrain movement cost multiplier (0-1)
 * @param weatherSpeedFactor - Weather speed factor multiplier (0-1), default 1.0
 */
export function calculateHexTraversalTime(
  transportBaseSpeedMph: number,
  terrainMovementCost: number,
  weatherSpeedFactor: number = 1.0
): number {
  // Effective speed = base speed * terrain factor * weather factor
  const effectiveSpeed =
    transportBaseSpeedMph * terrainMovementCost * weatherSpeedFactor;

  // Time = distance / speed
  return HEX_SIZE_MILES / effectiveSpeed;
}
