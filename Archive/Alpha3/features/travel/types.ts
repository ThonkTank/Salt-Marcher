/**
 * Travel Feature - Types
 * State types, configuration, and ports for travel coordination.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import type { Duration } from '@core/schemas/time';
import type { Result, AppError } from '@core/types/result';

// ═══════════════════════════════════════════════════════════════
// Waypoint Types
// ═══════════════════════════════════════════════════════════════

/** A waypoint on a travel route */
export interface Waypoint {
  id: string;
  coord: HexCoordinate;
  order: number;
}

// ═══════════════════════════════════════════════════════════════
// Route Segment Types
// ═══════════════════════════════════════════════════════════════

/** A segment between two waypoints */
export interface RouteSegment {
  from: Waypoint;
  to: Waypoint;
  path: HexCoordinate[];
  distance: number;
  duration: Duration;
  terrainMultiplier: number;
}

// ═══════════════════════════════════════════════════════════════
// Route Types
// ═══════════════════════════════════════════════════════════════

/** A complete travel route with multiple waypoints */
export interface Route {
  id: string;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: Duration;
}

// ═══════════════════════════════════════════════════════════════
// Travel Status
// ═══════════════════════════════════════════════════════════════

export type TravelStatus =
  | 'idle'
  | 'planning'
  | 'traveling'
  | 'paused'
  | 'arrived';

// ═══════════════════════════════════════════════════════════════
// Travel Progress
// ═══════════════════════════════════════════════════════════════

export interface TravelProgress {
  overallProgress: number;
  currentSegmentIndex: number;
  segmentProgress: number;
  currentCoord: HexCoordinate;
  pixelPosition: { x: number; y: number };
  elapsedDuration: Duration;
  remainingDuration: Duration;
}

// ═══════════════════════════════════════════════════════════════
// Travel State
// ═══════════════════════════════════════════════════════════════

export interface TravelState {
  status: TravelStatus;
  route: Route | null;
  progress: TravelProgress | null;
  partyPosition: HexCoordinate;
}

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

export interface TravelConfig {
  baseSpeedHexesPerHour: number;
  animationSpeedMultiplier: number;
  advanceTime: boolean;
  defaultTerrainMultiplier: number;
}

export const DEFAULT_TRAVEL_CONFIG: TravelConfig = {
  baseSpeedHexesPerHour: 3,
  animationSpeedMultiplier: 60,
  advanceTime: true,
  defaultTerrainMultiplier: 1,
};

// ═══════════════════════════════════════════════════════════════
// Event Payloads
// ═══════════════════════════════════════════════════════════════

export interface TravelStartedPayload {
  routeId: string;
  from: HexCoordinate;
  to: HexCoordinate;
  estimatedDuration: Duration;
}

export interface TravelCompletedPayload {
  routeId: string;
  from: HexCoordinate;
  to: HexCoordinate;
  actualDuration: Duration;
}

export interface TravelPausedPayload {
  routeId: string;
  currentPosition: HexCoordinate;
  progress: number;
}

export interface TravelWaypointReachedPayload {
  routeId: string;
  waypointId: string;
  coord: HexCoordinate;
}

export interface PositionChangedPayload {
  previous: HexCoordinate;
  current: HexCoordinate;
  pixelPosition: { x: number; y: number };
}

// ═══════════════════════════════════════════════════════════════
// State Listener
// ═══════════════════════════════════════════════════════════════

export type TravelStateListener = (state: TravelState) => void;

// ═══════════════════════════════════════════════════════════════
// TravelFeaturePort (Inbound Port)
// ═══════════════════════════════════════════════════════════════

export interface TravelFeaturePort {
  // State Access
  getState(): Readonly<TravelState>;
  subscribe(listener: TravelStateListener): () => void;

  // Position Management
  setPartyPosition(coord: HexCoordinate): void;

  // Route Planning
  addWaypoint(coord: HexCoordinate): void;
  removeWaypoint(waypointId: string): Result<void, AppError>;
  moveWaypoint(waypointId: string, newCoord: HexCoordinate): Result<void, AppError>;
  clearRoute(): void;

  // Travel Execution
  startTravel(): Result<void, AppError>;
  pauseTravel(): Result<void, AppError>;
  resumeTravel(): Result<void, AppError>;
  stopTravel(): void;

  // Configuration
  setAnimationSpeed(multiplier: number): void;
  updateConfig(config: Partial<TravelConfig>): void;

  // Lifecycle
  initialize(): Promise<void>;
  dispose(): void;
}
