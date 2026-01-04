// Ziel: Sightline- und Visibility-Berechnung fuer Overland-Maps
// Siehe: docs/features/Map-Feature.md#visibility-system-post-mvp
//
// ============================================================================
// TODO
// ============================================================================
//
// [TODO]: Implementiere calculateHorizonDistance()
// - Spec: Map-Feature.md#sichtweiten-berechnung
// - Input: observerElevation: number
// - Output: number (Hexes)
// - Formel: Basis + floor(sqrt(elevation / referenzhoehe))
//
// [TODO]: Implementiere checkSightlineBlocked()
// - Spec: Map-Feature.md#sicht-blockierung-line-of-sight
// - Input: from: HexCoordinate, to: HexCoordinate, getElevation, getBlockerHeight
// - Output: boolean
// - Algorithmus: Hex-Linienalgorithmus + Hoeheninterpolation
//
// [TODO]: Implementiere calculateVisibleTiles()
// - Spec: Map-Feature.md#visibility-system-post-mvp
// - Input: partyPosition: HexCoordinate, tiles: Map, weather: Weather, timeSegment: string
// - Output: Set<HexCoordinate>
// - Kombiniert: Horizont-Distanz x Weather-Modifier x Time-Modifier + Sightline-Blocking

import type { HexCoordinate } from '@/types/hexCoordinate';

// ============================================================================
// CONSTANTS (aus Map-Feature.md)
// ============================================================================

/** Basis-Sichtweite in Hexes bei flachem Terrain */
export const BASE_VISIBILITY_HEXES = 1;

/** Referenzhoehe fuer Wurzel-Formel (Elevation-Einheit pro Bonus-Hex) */
export const ELEVATION_REFERENCE = 1;

/** Hex-Groesse in Feet (3 Meilen = 15,840 ft) */
export const HEX_SIZE_FEET = 15_840;

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Konvertiert Hex-Distanz zu Feet.
 */
export function hexesToFeet(hexes: number): number {
  return hexes * HEX_SIZE_FEET;
}

/**
 * Konvertiert Feet zu Hex-Distanz.
 */
export function feetToHexes(feet: number): number {
  return feet / HEX_SIZE_FEET;
}

// ============================================================================
// STUB FUNCTIONS (fuer spaetere Implementierung)
// ============================================================================

/**
 * Berechnet Horizont-Distanz in Hexes basierend auf Elevation.
 * TODO: siehe Header
 */
export function calculateHorizonDistance(_observerElevation: number): number {
  // Formel: BASE_VISIBILITY_HEXES + floor(sqrt(elevation / ELEVATION_REFERENCE))
  throw new Error('Not implemented: calculateHorizonDistance');
}

/**
 * Prueft ob Sichtlinie zwischen zwei Hexes blockiert ist.
 * TODO: siehe Header
 */
export function checkSightlineBlocked(
  _from: HexCoordinate,
  _to: HexCoordinate,
  _getElevation: (coord: HexCoordinate) => number,
  _getBlockerHeight: (coord: HexCoordinate) => number
): boolean {
  throw new Error('Not implemented: checkSightlineBlocked');
}
