/**
 * Route Utilities
 *
 * Pure functions for route building and manipulation.
 *
 * @module utils/travel/route
 */

import { line, axialDistance } from '../hex';
import type { AxialCoord } from '../../schemas';
import type { Route, Waypoint } from '../../schemas/travel';
import { EMPTY_ROUTE } from '../../schemas/travel';

/**
 * Baut Route aus Waypoint-Koordinaten.
 * Berechnet Pfad zwischen allen Waypoints via line().
 */
export function buildRoute(waypoints: AxialCoord[]): Route {
    if (waypoints.length === 0) return EMPTY_ROUTE;

    if (waypoints.length === 1) {
        return {
            waypoints: [{ coord: waypoints[0], index: 0 }],
            path: [waypoints[0]],
            totalDistance: 0,
        };
    }

    const path: AxialCoord[] = [];
    let totalDistance = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
        const segment = line(waypoints[i], waypoints[i + 1]);
        // Erstes Segment komplett, danach ohne Startpunkt (vermeidet Duplikate)
        path.push(...(i === 0 ? segment : segment.slice(1)));
        totalDistance += axialDistance(waypoints[i], waypoints[i + 1]);
    }

    return {
        waypoints: waypoints.map((coord, index) => ({ coord, index })),
        path,
        totalDistance,
    };
}

/**
 * Fügt Waypoint an Ende der Route hinzu.
 */
export function appendWaypoint(route: Route, coord: AxialCoord): Route {
    const coords = route.waypoints.map(w => w.coord);
    coords.push(coord);
    return buildRoute(coords);
}

/**
 * Entfernt Waypoint an Index (außer Start bei index 0).
 */
export function removeWaypoint(route: Route, index: number): Route {
    if (index <= 0 || index >= route.waypoints.length) return route;
    const coords = route.waypoints.map(w => w.coord);
    coords.splice(index, 1);
    return buildRoute(coords);
}

/**
 * Verschiebt Waypoint zu neuer Position.
 */
export function moveWaypoint(route: Route, index: number, newCoord: AxialCoord): Route {
    if (index < 0 || index >= route.waypoints.length) return route;
    const coords = route.waypoints.map(w => w.coord);
    coords[index] = newCoord;
    return buildRoute(coords);
}

/**
 * Findet Waypoint an einer Koordinate (für Hit-Testing).
 */
export function findWaypointAt(route: Route, coord: AxialCoord): Waypoint | null {
    return route.waypoints.find(w =>
        w.coord.q === coord.q && w.coord.r === coord.r
    ) ?? null;
}
