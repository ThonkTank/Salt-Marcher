// Ziel: Line of Sight utilities für square-cell Maps (Combat, Dungeon)
// Siehe: docs/utils/grid.md#line-of-sight
//
// ============================================================================
// TODO
// ============================================================================
//
// [TODO]: Implementiere getVisibleCells()
// - Spec: Dungeon-System.md#fog-of-war
// - Input: origin: GridPosition, range: number, isOpaque: (pos) => boolean
// - Output: Set<string> (cell keys)
// - Algorithmus: Shadowcasting oder Raycast-basiert

import type { GridPosition } from './grid';
import { positionToKey, keyToPosition } from './grid';
import type { CombatCellProperties } from '@/types/combatTerrain';

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
// RAY CASTING & COVER
// ============================================================================

/**
 * Wirft einen Strahl zwischen zwei Positionen.
 * Nutzt Bresenham-Linie und prüft Blocking zwischen Start und End.
 */
export function rayCast(
  from: GridPosition,
  to: GridPosition,
  isBlocked: CellBlocker
): RayCastResult {
  const path = getLineCells(from, to);

  // Skip Start- und End-Cell (nur dazwischenliegende Cells prüfen)
  for (let i = 1; i < path.length - 1; i++) {
    if (isBlocked(path[i])) {
      return {
        hit: true,
        path: path.slice(0, i + 1),
        blockedAt: path[i],
      };
    }
  }

  return {
    hit: false,
    path,
  };
}

/**
 * Berechnet Cover-Level zwischen Angreifer und Ziel.
 * Vereinfachte Corners-Methode: 4 Rays von Attacker-Center zu Target-Corners.
 * Per D&D 5e PHB p.196.
 */
export function calculateCover(
  attacker: GridPosition,
  target: GridPosition,
  isBlocking: CellBlocker
): CoverLevel {
  // Target-Ecken (±0.5 vom Zentrum)
  const targetCorners = [
    { x: target.x - 0.5, y: target.y - 0.5 }, // NW
    { x: target.x + 0.5, y: target.y - 0.5 }, // NE
    { x: target.x - 0.5, y: target.y + 0.5 }, // SW
    { x: target.x + 0.5, y: target.y + 0.5 }, // SE
  ];

  let blockedCount = 0;

  for (const corner of targetCorners) {
    // Raycasting von Attacker-Center zu Target-Corner
    // Runde Ecken zur nächsten Cell für Blocking-Check
    const cornerCell: GridPosition = {
      x: Math.round(corner.x),
      y: Math.round(corner.y),
      z: target.z,
    };

    // Wenn Corner-Cell == Attacker oder Target, kein Ray nötig
    if (
      (cornerCell.x === attacker.x && cornerCell.y === attacker.y) ||
      (cornerCell.x === target.x && cornerCell.y === target.y)
    ) {
      continue;
    }

    const result = rayCast(attacker, cornerCell, isBlocking);
    if (result.hit) {
      blockedCount++;
    }
  }

  // Cover-Level basierend auf blockierten Ecken
  if (blockedCount === 4) return 'full';
  if (blockedCount >= 2) return 'three-quarters';
  if (blockedCount >= 1) return 'half';
  return 'none';
}

/** Cover-Level Ranking für Vergleiche. */
const COVER_RANK: Record<CoverLevel, number> = {
  'none': 0,
  'half': 1,
  'three-quarters': 2,
  'full': 3,
};

/**
 * Gibt das höhere Cover-Level zurück.
 * Nützlich um Terrain-Cover mit Raycast-Cover zu kombinieren.
 */
export function maxCover(a: CoverLevel, b: CoverLevel): CoverLevel {
  return COVER_RANK[a] >= COVER_RANK[b] ? a : b;
}

// ============================================================================
// HELPER FUNCTIONS (Implementiert)
// ============================================================================

/**
 * Prüft ob direkte Sichtlinie existiert.
 * Kombiniert Distanz-Check mit optionalem Terrain-Blocking.
 *
 * @param terrainMap Optional: Wenn übergeben, wird LoS-Blocking geprüft.
 *                   Backward-compatible: ohne terrainMap nur Distanz-Check.
 */
export function hasLineOfSight(
  from: GridPosition,
  to: GridPosition,
  maxRange: number,
  terrainMap?: Map<string, CombatCellProperties>
): boolean {
  // 1. Distanz-Check (Chebyshev)
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const dz = Math.abs(to.z - from.z);
  const distance = Math.max(dx, dy, dz);

  if (distance > maxRange) return false;

  // 2. Blocking-Check (nur wenn terrainMap übergeben)
  if (!terrainMap) return true;

  const result = rayCast(from, to, (pos) => {
    const key = positionToKey(pos);
    const props = terrainMap.get(key);
    return props?.blocksLoS ?? false;
  });

  return !result.hit;
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

// ============================================================================
// STUB FUNCTIONS (Nicht Teil von Phase 2)
// ============================================================================

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
