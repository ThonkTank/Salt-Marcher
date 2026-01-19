// Ziel: Candidate/Target-Filterung fuer Combat-AI
// Siehe: docs/services/combatantAI/actionScoring.md#candidate-selection
//
// Funktionen:
// - getCandidates(): Delegiert zu getValidCandidates() aus findTargets.ts (Single Source of Truth)
// - getEnemies(): Alle lebenden Feinde eines Combatants
// - getAllies(): Alle lebenden Verbuendeten eines Combatants (ohne sich selbst)
//
// Pipeline-Position:
// - Aufgerufen von: actionScoring.*, influenceMaps.*
// - Delegiert zu: resolution/findTargets.ts
// - Output: Combatant[] (gefilterte Listen)

import type { CombatEvent } from '@/types/entities/combatEvent';
import type { Combatant, CombatantSimulationState } from '@/types/combat';
import {
  getGroupId,
  getAliveCombatants,
} from '../../combatTracking';
import { isHostile, isAllied } from './combatHelpers';
import { getValidCandidates } from '../../combatTracking/resolution/findTargets';

// ============================================================================
// CANDIDATE FILTERING
// ============================================================================

/**
 * Filtert moegliche Ziele basierend auf action.targeting.filter.
 * Delegiert zu getValidCandidates() aus findTargets.ts (Single Source of Truth).
 */
export function getCandidates(
  attacker: Combatant,
  state: CombatantSimulationState,
  action: CombatEvent
): Combatant[] {
  return getValidCandidates(attacker, action, state);
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
