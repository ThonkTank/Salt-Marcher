// Ziel: Target-Selection fuer Resolution Pipeline
// Siehe: docs/services/combatTracking/findTargets.md
//
// Pipeline-Schritt 1: Bestimmt welche Combatants von einer Aktion getroffen werden.
// - Single-Target: Validiert explizit gewaehltes Target
// - AoE: Findet alle Combatants im Radius
// - Self: Returned nur Actor

import type { Combatant, CombatState, CombatantSimulationState, GridPosition } from '../../../types/combat';
import type { Action } from '#entities/action';
import type { ValidTargets } from '../../../constants/action';
import {
  getAliveCombatants,
  getGroupId,
  getPosition,
} from '../combatState';
import {
  isHostile,
  isAllied,
  getDistance,
} from '../../combatantAI/helpers/combatHelpers';

// ============================================================================
// Types
// ============================================================================

/**
 * Ergebnis der Target-Selection.
 */
export interface TargetResult {
  /** Alle getroffenen Targets. */
  targets: Combatant[];
  /** True wenn AoE (mehrere Targets moeglich). */
  isAoE: boolean;
  /** Bei Single-Target: das primaere Target. */
  primaryTarget?: Combatant;
}

/**
 * Kontext fuer Target-Selection.
 */
export interface FindTargetsContext {
  /** Der Combatant der die Aktion ausfuehrt. */
  actor: Combatant;
  /** Die auszufuehrende Aktion. */
  action: Action;
  /** Von AI/UI explizit gewaehltes Target (bei Single-Target). */
  explicitTarget?: Combatant;
  /** Zentrum fuer AoE-Effekte. */
  position?: GridPosition;
  /** Combat-State (READ-ONLY). */
  state: Readonly<CombatState>;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Bestimmt die Targets fuer eine Aktion.
 *
 * Bei Single-Target: Validiert explicitTarget
 * Bei AoE: Findet alle Combatants im Radius
 * Bei Self: Returned nur Actor
 */
export function findTargets(context: FindTargetsContext): TargetResult {
  const { actor, action, explicitTarget, position, state } = context;
  const targeting = action.targeting;

  // Self-Target: Nur der Actor selbst
  if (targeting.validTargets === 'self') {
    return {
      targets: [actor],
      isAoE: false,
      primaryTarget: actor,
    };
  }

  // AoE mit Radius
  if (targeting.type === 'area' && targeting.aoe?.size && position) {
    const targets = findAoETargets(actor, position, targeting, state);
    return {
      targets,
      isAoE: true,
    };
  }

  // Single-Target (explizit gewaehlt)
  if (explicitTarget) {
    if (isValidTarget(actor, explicitTarget, action, state)) {
      return {
        targets: [explicitTarget],
        isAoE: false,
        primaryTarget: explicitTarget,
      };
    }
    // Invalid target
    return {
      targets: [],
      isAoE: false,
    };
  }

  // Alle validen Targets (fuer AI-Enumeration)
  const candidates = getValidCandidates(actor, action, state);
  return {
    targets: candidates,
    isAoE: false,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Findet alle Targets im AoE-Radius.
 */
function findAoETargets(
  actor: Combatant,
  center: GridPosition,
  targeting: Action['targeting'],
  state: Readonly<CombatState>
): Combatant[] {
  const radiusFeet = targeting.aoe?.size ?? 0;
  const radiusCells = Math.floor(radiusFeet / 5);
  const alive = getAliveCombatants(state);

  return alive.filter((c) => {
    // Distanz-Check
    const pos = getPosition(c);
    if (getDistance(center, pos) > radiusCells) return false;

    // ValidTargets-Filter
    return matchesValidTargets(actor, c, targeting.validTargets, state);
  });
}

/**
 * Prueft ob ein spezifisches Target valide ist.
 */
export function isValidTarget(
  actor: Combatant,
  target: Combatant,
  action: Action,
  state: Readonly<CombatState>
): boolean {
  // ValidTargets-Filter
  if (!matchesValidTargets(actor, target, action.targeting.validTargets, state)) {
    return false;
  }

  // Range-Check (basierend auf direkter Action-Range)
  if (!isInRange(actor, target, action)) {
    return false;
  }

  return true;
}


/**
 * Prueft ValidTargets-Filter (enemies, allies, self, any).
 */
function matchesValidTargets(
  actor: Combatant,
  target: Combatant,
  validTargets: ValidTargets,
  state: CombatantSimulationState
): boolean {
  const actorGroup = getGroupId(actor);
  const targetGroup = getGroupId(target);
  const alliances = state.alliances ?? {};

  switch (validTargets) {
    case 'enemies':
      return isHostile(actorGroup, targetGroup, alliances);
    case 'allies':
      return isAllied(actorGroup, targetGroup, alliances) && actor.id !== target.id;
    case 'self':
      return actor.id === target.id;
    case 'any':
      return true;
    default:
      return false;
  }
}

/**
 * Prueft ob Target in Reichweite ist.
 *
 * Verwendet direkte Action-Range (nicht Multiattack-aware).
 * Fuer Multiattack-Range: AI-Layer verwendet getActionMaxRangeCells().
 */
export function isInRange(
  actor: Combatant,
  target: Combatant,
  action: Action
): boolean {
  const actorPos = getPosition(actor);
  const targetPos = getPosition(target);

  // Direkte Range aus Action (long range oder normal range, default 5ft)
  const rangeFeet = action.range?.long ?? action.range?.normal ?? 5;
  const maxRangeCells = Math.floor(rangeFeet / 5);

  const distance = getDistance(actorPos, targetPos);
  return distance <= maxRangeCells;
}

/**
 * Alle validen Candidates basierend auf ValidTargets-Filter.
 *
 * NICHT Range-gefiltert - das macht der AI-Layer separat.
 * Akzeptiert CombatState und CombatantSimulationState (via Subtype-Kompatibilität).
 */
export function getValidCandidates(
  actor: Combatant,
  action: Action,
  state: CombatantSimulationState
): Combatant[] {
  const alive = getAliveCombatants(state);

  return alive.filter((c) =>
    matchesValidTargets(actor, c, action.targeting.validTargets, state)
  );
}
