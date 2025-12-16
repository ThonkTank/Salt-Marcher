/**
 * Token Schema
 *
 * Types for travel tokens on the map.
 *
 * @module schemas/travel/token
 */

import type { AxialCoord } from '../geometry';

/** Zustand des Tokens auf der Map */
export type TokenState = {
    /** Aktuelle Position (Hex-Koordinate) */
    position: AxialCoord;
    /** Name/Label des Tokens */
    name: string;
    /** Farbe für Rendering (CSS color) */
    color: string;
};
