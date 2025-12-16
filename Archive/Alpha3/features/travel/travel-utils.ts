/**
 * Travel Feature - Utility Functions
 *
 * Pure functions for calculating travel routes and durations.
 * Uses hex-geometry from core for path calculations.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import type { Duration } from '@core/schemas/time';
import type { TerrainConfig } from '@core/schemas/terrain';
import { hexLine, hexToPixel } from '@core/schemas/hex-geometry';
import type { Waypoint, RouteSegment, Route, TravelConfig } from './types';

// ═══════════════════════════════════════════════════════════════
// Waypoint Management
// ═══════════════════════════════════════════════════════════════

let waypointCounter = 0;

export function createWaypoint(coord: HexCoordinate, order: number): Waypoint {
  waypointCounter++;
  return {
    id: `waypoint-${waypointCounter}`,
    coord,
    order,
  };
}

export function resetWaypointCounter(): void {
  waypointCounter = 0;
}

// ═══════════════════════════════════════════════════════════════
// Route Segment Calculation
// ═══════════════════════════════════════════════════════════════

export function calculateSegment(
  from: Waypoint,
  to: Waypoint,
  getTerrainAt: (coord: HexCoordinate) => TerrainConfig | null,
  config: TravelConfig
): RouteSegment {
  const path = hexLine(from.coord, to.coord);
  const distance = path.length - 1;

  let totalMultiplier = 0;
  for (const coord of path) {
    const terrain = getTerrainAt(coord);
    totalMultiplier += terrain?.travelMultiplier ?? config.defaultTerrainMultiplier;
  }
  const terrainMultiplier = path.length > 0 ? totalMultiplier / path.length : 1;

  const duration = calculateDuration(distance, terrainMultiplier, config);

  return {
    from,
    to,
    path,
    distance,
    duration,
    terrainMultiplier,
  };
}

// ═══════════════════════════════════════════════════════════════
// Duration Calculation
// ═══════════════════════════════════════════════════════════════

export function calculateDuration(
  distanceInHexes: number,
  terrainMultiplier: number,
  config: TravelConfig
): Duration {
  const effectiveDistance = distanceInHexes * terrainMultiplier;
  const hours = effectiveDistance / config.baseSpeedHexesPerHour;

  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  return {
    hours: wholeHours,
    minutes: minutes,
  };
}

export function addDurations(a: Duration, b: Duration): Duration {
  const totalMinutes =
    (a.minutes ?? 0) +
    (b.minutes ?? 0) +
    (a.hours ?? 0) * 60 +
    (b.hours ?? 0) * 60 +
    (a.days ?? 0) * 24 * 60 +
    (b.days ?? 0) * 24 * 60;

  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutes = totalMinutes - days * 24 * 60;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes - hours * 60;

  return {
    days: days > 0 ? days : undefined,
    hours: hours > 0 ? hours : undefined,
    minutes: minutes > 0 ? minutes : undefined,
  };
}

export function durationToMinutes(duration: Duration): number {
  return (
    (duration.minutes ?? 0) +
    (duration.hours ?? 0) * 60 +
    (duration.days ?? 0) * 24 * 60 +
    (duration.weeks ?? 0) * 7 * 24 * 60
  );
}

export function minutesToDuration(totalMinutes: number): Duration {
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutes = totalMinutes - days * 24 * 60;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes - hours * 60;

  return {
    days: days > 0 ? days : undefined,
    hours: hours > 0 ? hours : undefined,
    minutes: minutes > 0 ? minutes : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// Full Route Calculation
// ═══════════════════════════════════════════════════════════════

let routeCounter = 0;

export function calculateRoute(
  startPosition: HexCoordinate,
  waypoints: Waypoint[],
  getTerrainAt: (coord: HexCoordinate) => TerrainConfig | null,
  config: TravelConfig
): Route {
  routeCounter++;

  const startWaypoint = createWaypoint(startPosition, -1);

  const segments: RouteSegment[] = [];
  let previousWaypoint = startWaypoint;
  let totalDistance = 0;
  let totalDuration: Duration = {};

  for (const waypoint of waypoints) {
    const segment = calculateSegment(previousWaypoint, waypoint, getTerrainAt, config);
    segments.push(segment);
    totalDistance += segment.distance;
    totalDuration = addDurations(totalDuration, segment.duration);
    previousWaypoint = waypoint;
  }

  return {
    id: `route-${routeCounter}`,
    waypoints,
    segments,
    totalDistance,
    totalDuration,
  };
}

export function resetRouteCounter(): void {
  routeCounter = 0;
}

// ═══════════════════════════════════════════════════════════════
// Position Interpolation
// ═══════════════════════════════════════════════════════════════

export function interpolatePosition(
  segment: RouteSegment,
  progress: number,
  hexSize: number
): { coord: HexCoordinate; pixelPosition: { x: number; y: number } } {
  const { path } = segment;

  if (path.length === 0) {
    return {
      coord: segment.from.coord,
      pixelPosition: hexToPixel(segment.from.coord, hexSize),
    };
  }

  const clampedProgress = Math.max(0, Math.min(1, progress));

  const pathProgress = clampedProgress * (path.length - 1);
  const pathIndex = Math.floor(pathProgress);
  const localProgress = pathProgress - pathIndex;

  const currentHex = path[Math.min(pathIndex, path.length - 1)];
  const nextHex = path[Math.min(pathIndex + 1, path.length - 1)];

  const currentPixel = hexToPixel(currentHex, hexSize);
  const nextPixel = hexToPixel(nextHex, hexSize);

  const pixelPosition = {
    x: currentPixel.x + (nextPixel.x - currentPixel.x) * localProgress,
    y: currentPixel.y + (nextPixel.y - currentPixel.y) * localProgress,
  };

  return {
    coord: currentHex,
    pixelPosition,
  };
}

export function interpolateRoutePosition(
  route: Route,
  startPosition: HexCoordinate,
  overallProgress: number,
  hexSize: number
): {
  coord: HexCoordinate;
  pixelPosition: { x: number; y: number };
  currentSegmentIndex: number;
  segmentProgress: number;
} {
  if (route.segments.length === 0) {
    return {
      coord: startPosition,
      pixelPosition: hexToPixel(startPosition, hexSize),
      currentSegmentIndex: 0,
      segmentProgress: 0,
    };
  }

  const totalMinutes = durationToMinutes(route.totalDuration);
  const elapsedMinutes = totalMinutes * overallProgress;

  let accumulatedMinutes = 0;
  let currentSegmentIndex = 0;

  for (let i = 0; i < route.segments.length; i++) {
    const segmentMinutes = durationToMinutes(route.segments[i].duration);
    if (accumulatedMinutes + segmentMinutes >= elapsedMinutes) {
      currentSegmentIndex = i;
      break;
    }
    accumulatedMinutes += segmentMinutes;
    currentSegmentIndex = i;
  }

  const currentSegment = route.segments[currentSegmentIndex];
  const segmentMinutes = durationToMinutes(currentSegment.duration);
  const minutesIntoSegment = elapsedMinutes - accumulatedMinutes;
  const segmentProgress = segmentMinutes > 0 ? minutesIntoSegment / segmentMinutes : 1;

  const { coord, pixelPosition } = interpolatePosition(
    currentSegment,
    segmentProgress,
    hexSize
  );

  return {
    coord,
    pixelPosition,
    currentSegmentIndex,
    segmentProgress,
  };
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

export function formatDuration(duration: Duration): string {
  const parts: string[] = [];

  if (duration.weeks) {
    parts.push(`${duration.weeks}w`);
  }
  if (duration.days) {
    parts.push(`${duration.days}d`);
  }
  if (duration.hours) {
    parts.push(`${duration.hours}h`);
  }
  if (duration.minutes) {
    parts.push(`${duration.minutes}m`);
  }

  return parts.length > 0 ? parts.join(' ') : '0m';
}
