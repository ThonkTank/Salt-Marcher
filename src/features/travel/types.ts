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
 */
export function calculateHexTraversalTime(
  transportBaseSpeedMph: number,
  terrainMovementCost: number
): number {
  // Effective speed = base speed * terrain factor
  const effectiveSpeed = transportBaseSpeedMph * terrainMovementCost;

  // Time = distance / speed
  return HEX_SIZE_MILES / effectiveSpeed;
}
