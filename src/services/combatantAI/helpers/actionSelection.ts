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
  getAliveCombatants,
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
  const alive = getAliveCombatants(state);

  switch (action.targeting.validTargets) {
    case 'enemies':
      return alive.filter(c =>
        isHostile(getGroupId(attacker), getGroupId(c), state.alliances)
      );
    case 'allies':
      return alive.filter(c =>
        isAllied(getGroupId(attacker), getGroupId(c), state.alliances) &&
        c.id !== attacker.id
      );
    case 'self':
      return [attacker];
    case 'any':
      return alive;
  }
}

/** Helper: Alle lebenden Feinde (via getAliveCombatants). */
export function getEnemies(
  combatant: Combatant,
  state: CombatantSimulationState
): Combatant[] {
  return getAliveCombatants(state).filter(c =>
    isHostile(getGroupId(combatant), getGroupId(c), state.alliances)
  );
}

/** Helper: Alle lebenden Verbuendeten ohne sich selbst (via getAliveCombatants). */
export function getAllies(
  combatant: Combatant,
  state: CombatantSimulationState
): Combatant[] {
  return getAliveCombatants(state).filter(c =>
    isAllied(getGroupId(combatant), getGroupId(c), state.alliances) &&
    c.id !== combatant.id
  );
}
