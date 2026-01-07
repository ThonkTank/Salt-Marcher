// Ziel: Cover Modifier - Half Cover (+2 AC) durch Kreaturen in Sichtlinie
// Siehe: docs/services/combatantAI/actionScoring.md#situational-modifiers
//
// D&D 5e SRD Zeile 657:
// "Another creature or an object that covers at least half of the target"
// → Half Cover (+2 AC)
//
// WICHTIG: Kreaturen geben NUR Half Cover, nicht Three-Quarters oder Total!
//
// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Nur Half Cover (+2 AC) durch Kreaturen implementiert
// - Three-Quarters/Total Cover benötigen Terrain-Daten
// - Spec: SRD 5.2 Zeile 657-659 - Kreaturen geben nur Half Cover
// - Terrain-Info müsste aus GridSpace kommen (state.grid.cells)

import type { GridPosition } from '@/types/combat';
import type { ModifierEvaluator, ModifierSimulationState } from '../situationalModifiers';
import { modifierRegistry } from '../situationalModifiers';
import { getLineCells } from '@/utils/squareSpace/gridLineOfSight';

/**
 * Cover Modifier
 *
 * Aktiv wenn: Eine Kreatur steht zwischen Attacker und Target
 * Effekt: +2 AC (Half Cover)
 */
export const coverModifier: ModifierEvaluator = {
  id: 'cover',
  name: 'Cover',
  description: 'Target gains +2 AC from creature providing half cover',

  isActive: (ctx) => {
    return hasCreatureInLine(ctx.attacker.position, ctx.target.position, ctx.state);
  },

  getEffect: () => ({
    acBonus: 2, // Half Cover nur - Kreaturen geben kein Three-Quarters/Total
  }),

  priority: 9, // Höhere Priorität da fundamental für Targeting
};

/**
 * Prüft ob eine Kreatur zwischen Attacker und Target steht.
 * Nutzt getLineCells() für Bresenham-Linie.
 *
 * HACK: siehe Header - nur Creature-Blockierung, kein Terrain
 */
function hasCreatureInLine(
  attacker: GridPosition,
  target: GridPosition,
  state: ModifierSimulationState
): boolean {
  const lineCells = getLineCells(attacker, target);

  // Skip Start (Attacker) und Ende (Target)
  const middleCells = lineCells.slice(1, -1);

  // Prüfe ob eine Kreatur in einer der Zellen steht
  return middleCells.some((cell) =>
    state.profiles.some(
      (p) =>
        p.position.x === cell.x &&
        p.position.y === cell.y &&
        p.position.z === cell.z
    )
  );
}

// Auto-register beim Import
modifierRegistry.register(coverModifier);
