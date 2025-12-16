/**
 * Route Schema
 *
 * Types for travel routes and waypoints.
 *
 * @module schemas/travel/route
 */

import type { AxialCoord } from '../geometry';

/** Ein Punkt auf der Route */
export type Waypoint = {
    /** Hex-Koordinate des Waypoints */
    coord: AxialCoord;
    /** Index in der Route (0 = Start) */
    index: number;
};

/** Komplette Route mit Waypoints und berechnetem Pfad */
export type Route = {
    /** Alle Waypoints von Start bis Ziel */
    waypoints: Waypoint[];
    /** Berechneter Pfad (alle Hexe zwischen Waypoints) */
    path: AxialCoord[];
    /** Gesamtdistanz in Hexen */
    totalDistance: number;
};

/** Leere Route als Initialwert */
export const EMPTY_ROUTE: Route = {
    waypoints: [],
    path: [],
    totalDistance: 0,
};
