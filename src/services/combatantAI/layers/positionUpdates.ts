// Ziel: Layer-Cache Invalidierung bei Positions-Aenderungen
// Siehe: docs/services/combatantAI/buildBaseActionLayer.md
//
// Aufgaben:
// - Grid-Coverage nach Bewegung neu berechnen
// - againstTarget Cache invalidieren

import type {
  GridPosition,
  CombatantWithLayers,
} from '@/types/combat';
import { positionToKey } from '@/utils';
import { getDistance } from '../helpers/combatHelpers';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[layers/positionUpdates]', ...args);
  }
};

// ============================================================================
// POSITION UPDATES
// ============================================================================

/**
 * Aktualisiert Layer-Daten nach Combatant-Bewegung.
 * - Aktualisiert sourcePosition in allen action._layer
 * - Invalidiert action._layer.againstTarget (Positionen geaendert)
 */
export function updateLayersForMovement(
  combatant: CombatantWithLayers,
  newPosition: GridPosition
): void {
  for (const action of combatant._layeredActions) {
    // Update source position
    action._layer.sourcePosition = { ...newPosition };

    // Rebuild grid coverage
    const rangeCells = action._layer.rangeCells;
    const normalRangeCells = action._layer.normalRangeCells ?? rangeCells;

    action._layer.grid.clear();
    for (let dx = -rangeCells; dx <= rangeCells; dx++) {
      for (let dy = -rangeCells; dy <= rangeCells; dy++) {
        const cell: GridPosition = {
          x: newPosition.x + dx,
          y: newPosition.y + dy,
          z: newPosition.z,
        };
        const distance = getDistance(newPosition, cell);

        if (distance <= rangeCells) {
          const inNormalRange = distance <= normalRangeCells;
          action._layer.grid.set(positionToKey(cell), {
            inRange: true,
            inNormalRange,
            distance,
          });
        }
      }
    }

    // Invalidate target cache
    action._layer.againstTarget.clear();
  }

  // Update combatant position
  combatant.combatState.position = { ...newPosition };

  debug('updateLayersForMovement:', {
    combatantId: combatant.id,
    newPosition,
    actionsUpdated: combatant._layeredActions.length,
  });
}

/**
 * Invalidiert alle Target-Resolved Caches fuer einen Combatant.
 * Rufen nach Bewegung oder Status-Aenderung auf.
 */
export function invalidateTargetCache(
  combatant: CombatantWithLayers
): void {
  for (const action of combatant._layeredActions) {
    action._layer.againstTarget.clear();
  }

  debug('invalidateTargetCache:', {
    combatantId: combatant.id,
    actionsCleared: combatant._layeredActions.length,
  });
}
