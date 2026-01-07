// Ziel: Candidate/Target-Filterung fuer Combat-AI
// Siehe: docs/services/combatantAI/actionScoring.md#candidate-selection
//
// Funktionen:
// - getCandidates(): Filtert moegliche Ziele basierend auf action.targeting.validTargets
// - getEnemies(): Alle lebenden Feinde eines Combatants
// - getAllies(): Alle lebenden Verbuendeten eines Combatants (ohne sich selbst)
//
// Pipeline-Position:
// - Aufgerufen von: actionScoring.*, influenceMaps.*
// - Nutzt: combatHelpers.isHostile(), isAllied()
// - Output: Combatant[] (gefilterte Listen)

import type { Action } from '@/types/entities';
import type { Combatant, CombatantSimulationState } from '@/types/combat';
import {
  getGroupId,
  getDeathProbability,
} from '../../combatTracking';
import { isHostile, isAllied } from './combatHelpers';

// ============================================================================
// CANDIDATE FILTERING
// ============================================================================

/** Filtert moegliche Ziele basierend auf action.targeting.validTargets. */
export function getCandidates(
  attacker: Combatant,
  state: CombatantSimulationState,
  action: Action
): Combatant[] {
  const alive = (c: Combatant) => getDeathProbability(c) < 0.95;

  switch (action.targeting.validTargets) {
    case 'enemies':
      return state.combatants.filter(c =>
        isHostile(getGroupId(attacker), getGroupId(c), state.alliances) &&
        alive(c)
      );
    case 'allies':
      return state.combatants.filter(c =>
        isAllied(getGroupId(attacker), getGroupId(c), state.alliances) &&
        c.id !== attacker.id &&
        alive(c)
      );
    case 'self':
      return [attacker];
    case 'any':
      return state.combatants.filter(alive);
  }
}

/** Helper: Alle lebenden Feinde. */
export function getEnemies(
  combatant: Combatant,
  state: CombatantSimulationState
): Combatant[] {
  const alive = (c: Combatant) => getDeathProbability(c) < 0.95;
  return state.combatants.filter(c =>
    isHostile(getGroupId(combatant), getGroupId(c), state.alliances) && alive(c)
  );
}

/** Helper: Alle lebenden Verbuendeten (ohne sich selbst). */
export function getAllies(
  combatant: Combatant,
  state: CombatantSimulationState
): Combatant[] {
  const alive = (c: Combatant) => getDeathProbability(c) < 0.95;
  return state.combatants.filter(c =>
    isAllied(getGroupId(combatant), getGroupId(c), state.alliances) &&
    c.id !== combatant.id &&
    alive(c)
  );
}
