// Ziel: Terrain-aware Pathfinding für Combat AI
// Siehe: docs/services/combatTracking.md (Phase 3)
//
// Dijkstra-basiertes Pathfinding mit:
// - blocksMovement: Infinity-Kosten
// - movementCostMultiplier: 1 oder 2 (Difficult Terrain)
// - size-restricted: Infinity wenn Combatant zu groß
// - occupied cells: Blockiert durch feindliche Combatants

import type { GridPosition, Combatant, CombatantSimulationState } from '@/types/combat';
import type { CombatCellProperties } from '@/types/combatTerrain';
import type { CreatureSize } from '@/constants/creature';
import { DEFAULT_CELL_PROPERTIES } from '@/types/combatTerrain';
import { getNeighbors, positionToKey, positionsEqual } from '@/utils/squareSpace/grid';
import { isNPC } from '@/types/combat';
import { getResolvedCreature } from '../combatTracking/combatState';
import { isHostile } from '../combatantAI/helpers/combatHelpers';

// ============================================================================
// TYPES
// ============================================================================

/** Erreichbare Cell mit Movement-Kosten. */
export interface ReachableCell {
  position: GridPosition;
  cost: number;  // Akkumulierte Movement-Kosten um diese Cell zu erreichen
}

/** Priority Queue Entry für Dijkstra. */
interface QueueEntry {
  position: GridPosition;
  cost: number;
}

// ============================================================================
// SIZE HELPERS
// ============================================================================

/** Mapping CreatureSize → numerischer Index (1-6). */
const SIZE_INDEX: Record<CreatureSize, number> = {
  tiny: 1,
  small: 2,
  medium: 3,
  large: 4,
  huge: 5,
  gargantuan: 6,
};

/**
 * Gibt die Size eines Combatants als numerischen Index zurück (1-6).
 * Default: 3 (medium) wenn nicht definiert.
 */
export function getCombatantSizeIndex(combatant: Combatant): number {
  if (isNPC(combatant)) {
    const creature = getResolvedCreature(combatant.creature.id).definition;
    const size = creature.size as CreatureSize;
    return SIZE_INDEX[size] ?? 3;
  }
  // Characters sind immer Medium (Size 3) - kann später erweitert werden
  return 3;
}

// ============================================================================
// MOVEMENT COST
// ============================================================================

/**
 * Berechnet Movement-Kosten von einer Cell zur nächsten.
 *
 * @param from Ausgangs-Cell
 * @param to Ziel-Cell
 * @param terrainMap Terrain-Map (sparse: nur nicht-default Cells)
 * @param combatant Der sich bewegende Combatant (für Size-Check)
 * @returns Movement-Kosten: 1 (normal), 2 (difficult), Infinity (blockiert)
 */
export function getMovementCost(
  from: GridPosition,
  to: GridPosition,
  terrainMap: Map<string, CombatCellProperties>,
  combatant: Combatant
): number {
  const key = positionToKey(to);
  const props = terrainMap.get(key) ?? DEFAULT_CELL_PROPERTIES;

  // 1. Blockiert Movement komplett
  if (props.blocksMovement) {
    return Infinity;
  }

  // 2. Size-Restricted Check
  for (const effect of props.effects) {
    if (effect.type === 'size-restricted') {
      const combatantSize = getCombatantSizeIndex(combatant);
      const maxSize = effect.params?.maxSize ?? 6;
      if (combatantSize > maxSize) {
        return Infinity;
      }
    }
    // Impassable Effect (explizit blockiert)
    if (effect.type === 'impassable') {
      return Infinity;
    }
  }

  // 3. Movement-Kosten Multiplier (Difficult Terrain = 2)
  return props.movementCostMultiplier;
}

/**
 * Prüft ob eine Cell von einem feindlichen Combatant besetzt ist.
 *
 * @param position Position zu prüfen
 * @param combatant Der sich bewegende Combatant
 * @param state Simulation State mit allen Combatants
 * @returns true wenn Cell von einem Feind blockiert wird
 */
export function isCellOccupiedByEnemy(
  position: GridPosition,
  combatant: Combatant,
  state: CombatantSimulationState
): boolean {
  const myGroupId = combatant.combatState.groupId;

  for (const other of state.combatants) {
    if (other.id === combatant.id) continue;
    if (other.combatState.isDead) continue;

    if (positionsEqual(other.combatState.position, position)) {
      // Feindlich? → Blockiert
      if (isHostile(myGroupId, other.combatState.groupId, state.alliances)) {
        return true;
      }
      // Ally auf gleicher Cell → D&D 5e erlaubt Durchqueren, aber nicht Stoppen
      // Für jetzt: Allies blockieren auch (kann in Phase 5 erweitert werden)
      return true;
    }
  }

  return false;
}

// ============================================================================
// DIJKSTRA PATHFINDING
// ============================================================================

/**
 * Berechnet alle erreichbaren Cells mit Dijkstra-Algorithmus.
 * Berücksichtigt Terrain-Kosten, blockierte Cells und besetzte Cells.
 *
 * @param start Startposition
 * @param movementBudget Verfügbare Bewegungs-Cells
 * @param terrainMap Terrain-Map (sparse)
 * @param combatant Der sich bewegende Combatant
 * @param state Simulation State mit allen Combatants
 * @returns Array von erreichbaren Cells mit Kosten, sortiert nach cost
 */
export function getReachableCellsWithTerrain(
  start: GridPosition,
  movementBudget: number,
  terrainMap: Map<string, CombatCellProperties>,
  combatant: Combatant,
  state: CombatantSimulationState
): ReachableCell[] {
  if (movementBudget <= 0) {
    return [{ position: start, cost: 0 }];
  }

  // Priority Queue (simple sorted array - could optimize with MinHeap for large maps)
  const queue: QueueEntry[] = [{ position: start, cost: 0 }];
  const visited = new Map<string, number>();  // key → best cost to reach
  const result: ReachableCell[] = [];

  while (queue.length > 0) {
    // Pop lowest cost entry
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const currentKey = positionToKey(current.position);

    // Skip wenn bereits mit besseren Kosten besucht
    const existingCost = visited.get(currentKey);
    if (existingCost !== undefined && existingCost <= current.cost) {
      continue;
    }

    visited.set(currentKey, current.cost);
    result.push({ position: current.position, cost: current.cost });

    // Expand neighbors
    const neighbors = getNeighbors(current.position);
    for (const neighbor of neighbors) {
      const neighborKey = positionToKey(neighbor);

      // Skip wenn bereits mit besseren Kosten besucht
      const neighborExistingCost = visited.get(neighborKey);
      if (neighborExistingCost !== undefined) {
        continue;
      }

      // Berechne Step-Kosten
      const stepCost = getMovementCost(current.position, neighbor, terrainMap, combatant);
      if (!isFinite(stepCost)) {
        continue;  // Blockiert
      }

      // Prüfe besetzte Cells
      if (isCellOccupiedByEnemy(neighbor, combatant, state)) {
        continue;  // Blockiert durch Combatant
      }

      // Berechne totale Kosten
      const totalCost = current.cost + stepCost;
      if (totalCost <= movementBudget) {
        queue.push({ position: neighbor, cost: totalCost });
      }
    }
  }

  // Sortiere nach Kosten (niedrigste zuerst)
  result.sort((a, b) => a.cost - b.cost);

  return result;
}

/**
 * Vereinfachte Variante: Gibt nur die Positionen zurück (ohne Kosten).
 * Für Backward-Compatibility mit bestehendem Code.
 */
export function getReachablePositionsWithTerrain(
  start: GridPosition,
  movementBudget: number,
  terrainMap: Map<string, CombatCellProperties>,
  combatant: Combatant,
  state: CombatantSimulationState
): GridPosition[] {
  return getReachableCellsWithTerrain(start, movementBudget, terrainMap, combatant, state)
    .map(cell => cell.position);
}
