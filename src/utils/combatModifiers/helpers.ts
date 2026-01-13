// Ziel: Gemeinsame Hilfsfunktionen fuer Combat-Modifier-Evaluation
// Siehe: docs/services/combatTracking/gatherModifiers.md
//
// Pure Functions ohne Service-Dependencies:
// - getDistance: Chebyshev-Distanz mit PHB-Variant
// - isAllied/isHostile: Alliance-Checks
// - feetToCell: Re-export aus squareSpace
//
// Wird verwendet von:
// - combatTracking/resolution/gatherModifiers.ts
// - utils/combatModifiers/expressionEvaluator.ts
// - combatantAI/situationalModifiers.ts (via Re-Import)

import type { GridPosition } from '@/utils/squareSpace';
import { getDistance as gridGetDistance, feetToCell as baseFeetToCell } from '@/utils/squareSpace';

// ============================================================================
// DISTANCE CALCULATION
// ============================================================================

/**
 * Berechnet Distanz zwischen zwei Positionen (in Cells).
 * Verwendet PHB-Variant: Diagonalen kosten 1 Cell (Chebyshev-Distanz).
 *
 * @param a Erste Position
 * @param b Zweite Position
 * @returns Distanz in Cells
 */
export function getDistance(a: GridPosition, b: GridPosition): number {
  return gridGetDistance(a, b, 'phb-variant');
}

/**
 * Konvertiert Feet zu Cells.
 * Re-export aus squareSpace fuer konsistente Imports.
 */
export const feetToCell = baseFeetToCell;

// ============================================================================
// ALLIANCE HELPERS
// ============================================================================

/**
 * Prueft ob zwei Gruppen verbuendet sind.
 * Gleiche Gruppe = automatisch verbuendet.
 *
 * @param groupA Erste Gruppe
 * @param groupB Zweite Gruppe
 * @param alliances Alliance-Map (groupId → verbuendete groupIds)
 * @returns true wenn verbuendet
 */
export function isAllied(
  groupA: string,
  groupB: string,
  alliances: Record<string, string[]>
): boolean {
  if (groupA === groupB) return true;
  return alliances[groupA]?.includes(groupB) ?? false;
}

/**
 * Prueft ob zwei Gruppen Feinde sind (nicht verbuendet).
 *
 * @param groupA Erste Gruppe
 * @param groupB Zweite Gruppe
 * @param alliances Alliance-Map (groupId → verbuendete groupIds)
 * @returns true wenn Feinde
 */
export function isHostile(
  groupA: string,
  groupB: string,
  alliances: Record<string, string[]>
): boolean {
  return !isAllied(groupA, groupB, alliances);
}
