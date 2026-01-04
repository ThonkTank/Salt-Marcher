// Ziel: Line of Sight utilities für square-cell Maps (Combat, Dungeon)
// Siehe: docs/utils/grid.md#line-of-sight
//
// ============================================================================
// TODO
// ============================================================================
//
// [TODO]: Implementiere rayCast()
// - Spec: Dungeon-System.md#simulation
// - Input: from: GridPosition, to: GridPosition, isBlocked: (pos) => boolean
// - Output: { hit: boolean; path: GridPosition[]; blockedAt?: GridPosition }
// - Algorithmus: Bresenham-Linie oder DDA
//
// [TODO]: Implementiere getVisibleCells()
// - Spec: Dungeon-System.md#fog-of-war
// - Input: origin: GridPosition, range: number, isOpaque: (pos) => boolean
// - Output: Set<string> (cell keys)
// - Algorithmus: Shadowcasting oder Raycast-basiert
//
// [TODO]: Implementiere calculateCover()
// - Spec: PHB p.196 (Cover rules)
// - Input: attacker: GridPosition, target: GridPosition, isBlocking: (pos) => boolean
// - Output: 'none' | 'half' | 'three-quarters' | 'full'
// - Logik: Anzahl blockierter Ecken-zu-Ecken-Linien

import type { GridPosition } from './grid';
import { positionToKey, keyToPosition } from './grid';

// Re-export für Convenience
export { positionToKey, keyToPosition };

// ============================================================================
// TYPES
// ============================================================================

/** Ergebnis eines Ray-Cast. */
export interface RayCastResult {
  hit: boolean;
  path: GridPosition[];
  blockedAt?: GridPosition;
}

/** Cover-Level per D&D 5e PHB. */
export type CoverLevel = 'none' | 'half' | 'three-quarters' | 'full';

/** Callback zum Prüfen ob eine Zelle blockiert. */
export type CellBlocker = (pos: GridPosition) => boolean;

// ============================================================================
// STUB FUNCTIONS
// ============================================================================

/**
 * Wirft einen Strahl zwischen zwei Positionen.
 * TODO: siehe Header
 */
export function rayCast(
  _from: GridPosition,
  _to: GridPosition,
  _isBlocked: CellBlocker
): RayCastResult {
  throw new Error('Not implemented: rayCast');
}

/**
 * Gibt alle sichtbaren Zellen von einem Ursprung zurück.
 * Nutzt Shadowcasting oder ähnlichen Algorithmus.
 * TODO: siehe Header
 */
export function getVisibleCells(
  _origin: GridPosition,
  _range: number,
  _isOpaque: CellBlocker
): Set<string> {
  throw new Error('Not implemented: getVisibleCells');
}

/**
 * Berechnet Cover-Level zwischen Angreifer und Ziel.
 * TODO: siehe Header
 */
export function calculateCover(
  _attacker: GridPosition,
  _target: GridPosition,
  _isBlocking: CellBlocker
): CoverLevel {
  throw new Error('Not implemented: calculateCover');
}

// ============================================================================
// HELPER FUNCTIONS (Implementiert)
// ============================================================================

/**
 * Prüft ob direkte Sichtlinie existiert (vereinfacht).
 * Nutzt nur Distanz-Check, keine Blockierung.
 */
export function hasLineOfSight(
  from: GridPosition,
  to: GridPosition,
  maxRange: number
): boolean {
  // Vereinfachte Version: nur Distanz-Check
  // Volle Implementierung würde rayCast nutzen
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const dz = Math.abs(to.z - from.z);
  const distance = Math.max(dx, dy, dz); // Chebyshev für einfache Prüfung
  return distance <= maxRange;
}

/**
 * Gibt Zellen auf einer Linie zwischen zwei Punkten zurück.
 * Nutzt Bresenham-artigen Algorithmus.
 */
export function getLineCells(
  from: GridPosition,
  to: GridPosition
): GridPosition[] {
  const cells: GridPosition[] = [];

  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const dz = Math.abs(to.z - from.z);

  const sx = Math.sign(to.x - from.x);
  const sy = Math.sign(to.y - from.y);
  const sz = Math.sign(to.z - from.z);

  const steps = Math.max(dx, dy, dz);

  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    cells.push({
      x: from.x + Math.round(t * (to.x - from.x)),
      y: from.y + Math.round(t * (to.y - from.y)),
      z: from.z + Math.round(t * (to.z - from.z)),
    });
  }

  return cells;
}
