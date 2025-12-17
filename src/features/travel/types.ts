/**
 * Travel Feature types and interfaces.
 *
 * Travel supports:
 * - Single hex-to-hex movement (moveToNeighbor)
 * - Multi-hex routes with state machine (planRoute, startTravel, pause, resume)
 *
 * State Machine: idle → planning → traveling ↔ paused → arrived
 */

import type { Result, AppError, Option } from '@core/index';
import type { HexCoordinate, TransportMode, Duration } from '@core/schemas';

// ============================================================================
// Travel Feature Port
// ============================================================================

/**
 * Public interface for the Travel Feature.
 */
export interface TravelFeaturePort {
  // ===========================================================================
  // Single-Hex Movement (Minimal)
  // ===========================================================================

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

  // ===========================================================================
  // State Machine (Multi-Hex Routes)
  // ===========================================================================

  /**
   * Get current travel state.
   */
  getState(): Readonly<TravelState>;

  /**
   * Get current travel status.
   */
  getStatus(): TravelStatus;

  /**
   * Get current route (if planning or traveling).
   */
  getRoute(): Option<Readonly<Route>>;

  /**
   * Plan a route from current position to destination.
   * Uses greedy neighbor selection (MVP pathfinding).
   */
  planRoute(destination: HexCoordinate): Result<Route, AppError>;

  /**
   * Plan a route through multiple user-specified waypoints.
   * Calculates path from current position through all waypoints.
   * @param waypoints - Array of waypoints (not including start position)
   */
  planRouteWithWaypoints(waypoints: HexCoordinate[]): Result<Route, AppError>;

  /**
   * Start traveling along the planned route.
   * Only valid when status is 'planning'.
   */
  startTravel(): Result<void, AppError>;

  /**
   * Pause current travel.
   * Only valid when status is 'traveling'.
   */
  pauseTravel(reason: PauseReason): Result<void, AppError>;

  /**
   * Resume paused travel.
   * Only valid when status is 'paused'.
   */
  resumeTravel(): Result<void, AppError>;

  /**
   * Cancel current travel/planning and reset to idle.
   */
  cancelTravel(): Result<void, AppError>;

  /**
   * Advance travel by one segment (called by time progression).
   * Only valid when status is 'traveling'.
   */
  advanceSegment(): Result<TravelResult | null, AppError>;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Clean up subscriptions and resources.
   */
  dispose(): void;
}

// ============================================================================
// Travel Result
// ============================================================================

/**
 * Result of a successful travel move (single hex).
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
// Travel State Machine
// ============================================================================

/**
 * Travel status for state machine.
 *
 * Transitions:
 * - idle → planning (planRoute)
 * - planning → traveling (startTravel) | idle (cancel)
 * - traveling → paused (pause) | arrived (completed)
 * - paused → traveling (resume) | idle (cancel)
 * - arrived → idle (reset)
 */
export type TravelStatus = 'idle' | 'planning' | 'traveling' | 'paused' | 'arrived';

/**
 * Reason why travel was paused.
 */
export type PauseReason = 'user' | 'encounter' | 'obstacle';

/**
 * Single segment of a route (one hex transition).
 */
export interface RouteSegment {
  /** Starting hex */
  from: HexCoordinate;

  /** Destination hex */
  to: HexCoordinate;

  /** Terrain at destination */
  terrainId: string;

  /** Time cost in hours */
  timeCostHours: number;
}

/**
 * Planned route for multi-hex travel.
 */
export interface Route {
  /** Unique route ID */
  id: string;

  /** All waypoints (including start and end) */
  waypoints: HexCoordinate[];

  /** Transport mode for this route */
  transport: TransportMode;

  /** Individual segments */
  segments: RouteSegment[];

  /** Total estimated duration */
  totalDuration: Duration;
}

/**
 * Travel state managed by the state machine.
 */
export interface TravelState {
  /** Current status */
  status: TravelStatus;

  /** Active route (if planning or traveling) */
  route: Route | null;

  /** Current segment index (0-based) */
  currentSegmentIndex: number;

  /** Progress within current segment (0.0 - 1.0) */
  segmentProgress: number;

  /** Reason if paused */
  pauseReason: PauseReason | null;
}

/**
 * Create initial idle travel state.
 */
export function createInitialTravelState(): TravelState {
  return {
    status: 'idle',
    route: null,
    currentSegmentIndex: 0,
    segmentProgress: 0,
    pauseReason: null,
  };
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
