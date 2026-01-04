// Hex-Grid Utilities
// Siehe: docs/features/Map-Feature.md

import type { HexCoordinate } from '@/types/hexCoordinate';

/**
 * Konvertiert Hex-Koordinaten zu einem String-Key für Vault-Lookup.
 */
export function coordToKey(coord: HexCoordinate): string {
  return `${coord.q},${coord.r}`;
}

/**
 * Berechnet die Distanz zwischen zwei Hex-Koordinaten.
 * Verwendet axiale Koordinaten (q, r) und Manhattan-Distanz.
 *
 * @see https://www.redblobgames.com/grids/hexagons/#distances
 */
export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return (
    Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)
  ) / 2;
}
