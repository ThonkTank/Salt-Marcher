// Ziel: Target-Selection fuer Resolution Pipeline
// Siehe: docs/services/combatTracking/findTargets.md
//
// Pipeline-Schritt 1: Bestimmt welche Combatants von einer Aktion getroffen werden.
// - Single-Target: Validiert explizit gewaehltes Target
// - AoE: Findet alle Combatants im Radius
// - Self: Returned nur Actor

import type { Combatant, CombatState, CombatantSimulationState, GridPosition } from '../../../types/combat';
import type { CombatEvent, TargetFilter } from '../../../types/entities/combatEvent';

import type { Targeting } from '../../../types/entities/combatEvent';

// Unified filter type: supports both legacy ('enemies') and new ('enemy') formats
type FilterValue = 'enemy' | 'ally' | 'self' | 'any' | 'enemies' | 'allies' | TargetFilter;

/**
 * Extracts filter from Targeting discriminated union.
 * Handles type-specific extraction:
 * - 'self' type → implicit 'self' filter
 * - 'single'/'multi' → required filter field
 * - 'area' → optional filter (defaults to defaultValue)
 * - 'chain' → uses primary's filter or defaultValue
 */
function getTargetFilter(
  targeting: Targeting | undefined,
  defaultValue: FilterValue = 'any'
): FilterValue {
  if (!targeting) return defaultValue;

  switch (targeting.type) {
    case 'self':
      return 'self';
    case 'single':
    case 'multi':
      // filter is required for single/multi but TS may infer as optional
      return targeting.filter ?? defaultValue;
    case 'area':
      return targeting.filter ?? defaultValue;
    case 'chain':
      // For chain targeting, use the primary's filter logic
      return getTargetFilter(targeting.primary, defaultValue);
    default:
      return defaultValue;
  }
}

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
  action: CombatEvent;
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

// DEBUG helper
const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[findTargets]', ...args);
  }
};

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

  // Early return for actions without targeting (self-actions or legacy format)
  if (!targeting) {
    return {
      targets: explicitTarget ? [explicitTarget] : [actor],
      isAoE: false,
      primaryTarget: explicitTarget ?? actor,
    };
  }

  debug('findTargets called:', {
    actorId: actor.id,
    actionId: action.id,
    hasExplicitTarget: !!explicitTarget,
    explicitTargetId: explicitTarget?.id,
    filter: getTargetFilter(targeting),
    targetingType: targeting.type,
  });

  // Self-Target: Nur der Actor selbst (either by type or filter)
  if (targeting.type === 'self') {
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
    const isValid = isValidTarget(actor, explicitTarget, action, state);
    debug('Single-target validation:', {
      explicitTargetId: explicitTarget.id,
      isValid,
    });
    if (isValid) {
      return {
        targets: [explicitTarget],
        isAoE: false,
        primaryTarget: explicitTarget,
      };
    }
    // Invalid target
    debug('Single-target REJECTED - returning empty targets');
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
  targeting: NonNullable<CombatEvent['targeting']>,
  state: Readonly<CombatState>
): Combatant[] {
  const radiusFeet = targeting.aoe?.size ?? 0;
  const radiusCells = Math.floor(radiusFeet / 5);
  const alive = getAliveCombatants(state);
  const filter = getTargetFilter(targeting, 'enemy');

  return alive.filter((c) => {
    // Distanz-Check
    const pos = getPosition(c);
    if (getDistance(center, pos) > radiusCells) return false;

    // Filter-Check
    return matchesFilter(actor, c, filter, state);
  });
}

/**
 * Prueft ob ein spezifisches Target valide ist.
 */
export function isValidTarget(
  actor: Combatant,
  target: Combatant,
  action: CombatEvent,
  state: Readonly<CombatState>
): boolean {
  // Actions without targeting default to valid
  const targetFilter = getTargetFilter(action.targeting, 'any');

  // Filter-Check
  const matchesTargets = matchesFilter(actor, target, targetFilter, state);
  debug('isValidTarget - matchesFilter:', {
    actorGroup: getGroupId(actor),
    targetGroup: getGroupId(target),
    filter: targetFilter,
    alliances: state.alliances,
    result: matchesTargets,
  });
  if (!matchesTargets) {
    return false;
  }

  // Range-Check (basierend auf direkter Action-Range)
  const inRange = isInRange(actor, target, action);
  debug('isValidTarget - isInRange:', {
    actorPos: getPosition(actor),
    targetPos: getPosition(target),
    actionRange: action.range,
    result: inRange,
  });
  if (!inRange) {
    return false;
  }

  return true;
}


/**
 * Prueft Filter (enemy/enemies, ally/allies, self, any).
 * Unterstuetzt sowohl neues Schema (singular) als auch Legacy (plural).
 */
function matchesFilter(
  actor: Combatant,
  target: Combatant,
  filter: FilterValue,
  state: CombatantSimulationState
): boolean {
  const actorGroup = getGroupId(actor);
  const targetGroup = getGroupId(target);
  const alliances = state.alliances ?? {};

  // Handle object-based filters (TargetFilter from schema)
  if (typeof filter === 'object' && filter !== null) {
    // For complex TargetFilter objects, default to 'any' for now
    // TODO: Implement full TargetFilter evaluation
    return true;
  }

  // Handle string-based filters (both singular and plural forms)
  switch (filter) {
    case 'enemy':
    case 'enemies':
      return isHostile(actorGroup, targetGroup, alliances);
    case 'ally':
    case 'allies':
      return isAllied(actorGroup, targetGroup, alliances) && actor.id !== target.id;
    case 'self':
      return actor.id === target.id;
    case 'any':
    case 'other':
    case 'willing':
    case 'creature':
    case 'object':
      return true;
    default:
      return true;
  }
}

/**
 * Extracts range in feet from action.targeting.range.
 * Uses new schema: targeting.range with type 'reach' or 'ranged'.
 * Only 'single' and 'multi' targeting types have range.
 */
function getActionRangeFeet(action: CombatEvent): number {
  const targeting = action.targeting;
  if (!targeting) return 5; // Default melee

  // Only 'single' and 'multi' targeting types have range
  if (targeting.type !== 'single' && targeting.type !== 'multi') {
    return 5; // Default melee for area, self, chain
  }

  const targetingRange = targeting.range;
  if (!targetingRange) return 5;

  if (targetingRange.type === 'ranged') {
    return targetingRange.long ?? targetingRange.normal ?? 5;
  }
  if (targetingRange.type === 'reach') {
    return targetingRange.distance ?? 5;
  }
  // touch, self - default to melee range
  return 5;
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
  action: CombatEvent
): boolean {
  const actorPos = getPosition(actor);
  const targetPos = getPosition(target);

  const rangeFeet = getActionRangeFeet(action);
  const maxRangeCells = Math.floor(rangeFeet / 5);

  const distance = getDistance(actorPos, targetPos);

  debug('isInRange calculation:', {
    actorPos,
    targetPos,
    rangeFeet,
    maxRangeCells,
    distance,
    result: distance <= maxRangeCells,
  });

  return distance <= maxRangeCells;
}

/**
 * Alle validen Candidates basierend auf Filter.
 *
 * NICHT Range-gefiltert - das macht der AI-Layer separat.
 * Akzeptiert CombatState und CombatantSimulationState (via Subtype-Kompatibilität).
 */
export function getValidCandidates(
  actor: Combatant,
  action: CombatEvent,
  state: CombatantSimulationState
): Combatant[] {
  const alive = getAliveCombatants(state);
  const targetFilter = getTargetFilter(action.targeting, 'enemy');

  return alive.filter((c) =>
    matchesFilter(actor, c, targetFilter, state)
  );
}
