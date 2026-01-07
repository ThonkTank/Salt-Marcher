// Ziel: Immutable State-Operationen für Look-Ahead Algorithmen
// Siehe: docs/services/combatantAI/simulationState.md
//
// Funktionen:
// - isBudgetExhausted() - Budget-Check (invertiert hasBudgetRemaining)
// - consumeBudget() - Immutable Budget-Update
// - cloneState() - Deep-Clone für Look-Ahead
// - projectState() - State nach hypothetischer Aktion

import type {
  TurnBudget,
  GridPosition,
  ProbabilityDistribution,
  ConditionState,
  CombatResources,
  CombatantSimulationStateWithLayers,
  CombatantWithLayers,
} from '@/types/combat';

// ============================================================================
// BUDGET OPERATIONS (Immutable)
// ============================================================================

/**
 * Prüft ob das Budget erschöpft ist (keine sinnvollen Aktionen mehr möglich).
 * Invertierte Logik von hasBudgetRemaining() in combatState.ts.
 */
export function isBudgetExhausted(budget: TurnBudget): boolean {
  return !budget.hasAction && !budget.hasBonusAction && budget.movementCells <= 0;
}

/**
 * Beschreibt welche Ressourcen verbraucht werden sollen.
 */
export interface BudgetConsumption {
  /** Anzahl Movement-Cells verbrauchen */
  movementCells?: number;
  /** Standard-Action verbrauchen */
  action?: boolean;
  /** Bonus-Action verbrauchen */
  bonusAction?: boolean;
  /** Reaction verbrauchen */
  reaction?: boolean;
  /** Dash anwenden (adds baseMovementCells, sets hasAction=false, hasDashed=true) */
  dash?: boolean;
}

/**
 * Immutable Budget-Update. Gibt neues TurnBudget zurück.
 *
 * Im Gegensatz zu consumeMovement(), consumeAction() etc. in combatState.ts
 * wird das Original-Budget nicht mutiert.
 */
export function consumeBudget(
  budget: TurnBudget,
  consumption: BudgetConsumption
): TurnBudget {
  const newBudget = { ...budget };

  if (consumption.movementCells) {
    newBudget.movementCells = Math.max(0, newBudget.movementCells - consumption.movementCells);
  }
  if (consumption.action) {
    newBudget.hasAction = false;
  }
  if (consumption.bonusAction) {
    newBudget.hasBonusAction = false;
  }
  if (consumption.reaction) {
    newBudget.hasReaction = false;
  }
  if (consumption.dash) {
    newBudget.movementCells += newBudget.baseMovementCells;
    newBudget.hasAction = false;
    newBudget.hasDashed = true;
  }

  return newBudget;
}

// ============================================================================
// STATE CLONING
// ============================================================================

/**
 * Deep-Clone einer ProbabilityDistribution (Map<number, number>).
 */
function clonePMF(pmf: ProbabilityDistribution): ProbabilityDistribution {
  return new Map(pmf);
}

/**
 * Clone von CombatResources.
 */
function cloneResources(res: CombatResources): CombatResources {
  return {
    spellSlots: res.spellSlots ? { ...res.spellSlots } : undefined,
    rechargeTimers: res.rechargeTimers ? { ...res.rechargeTimers } : undefined,
    perDayUses: res.perDayUses ? { ...res.perDayUses } : undefined,
  };
}

/**
 * Deep-Clone eines CombatantWithLayers.
 */
function cloneCombatant(c: CombatantWithLayers): CombatantWithLayers {
  return {
    ...c,
    currentHp: clonePMF(c.currentHp),
    combatState: {
      ...c.combatState,
      position: { ...c.combatState.position },
      conditions: [...c.combatState.conditions],
      resources: c.combatState.resources ? cloneResources(c.combatState.resources) : undefined,
      effectLayers: [...c.combatState.effectLayers],
    },
    _layeredActions: [...c._layeredActions],
  };
}

/**
 * Deep-Clone des gesamten Simulation-States.
 * Für Look-Ahead Algorithmen die den State hypothetisch verändern.
 *
 * rangeCache wird als Referenz beibehalten (read-only während Simulation).
 */
export function cloneState(
  state: CombatantSimulationStateWithLayers
): CombatantSimulationStateWithLayers {
  return {
    combatants: state.combatants.map(cloneCombatant),
    alliances: { ...state.alliances },
    rangeCache: state.rangeCache, // Read-only, kann referenziert bleiben
  };
}

// ============================================================================
// STATE PROJECTION
// ============================================================================

/**
 * Beschreibt hypothetische Änderungen an einem Combatant.
 */
export interface StateProjection {
  /** Neue Position */
  position?: GridPosition;
  /** Neue HP-Distribution */
  hp?: ProbabilityDistribution;
  /** Neue Conditions (ersetzt alle) */
  conditions?: ConditionState[];
  /** Neue Resources (ersetzt alle) */
  resources?: CombatResources;
}

/**
 * Erstellt einen neuen State mit hypothetischen Änderungen an einem Combatant.
 * Kombiniert cloneState() mit gezielten Updates.
 *
 * @param state Aktueller State
 * @param combatantId ID des zu ändernden Combatants
 * @param changes Gewünschte Änderungen
 * @returns Neuer State mit Änderungen (Original bleibt unverändert)
 */
export function projectState(
  state: CombatantSimulationStateWithLayers,
  combatantId: string,
  changes: StateProjection
): CombatantSimulationStateWithLayers {
  const newState = cloneState(state);
  const combatant = newState.combatants.find(c => c.id === combatantId);

  if (!combatant) return newState;

  if (changes.position) {
    combatant.combatState.position = changes.position;
  }
  if (changes.hp) {
    combatant.currentHp = changes.hp;
  }
  if (changes.conditions) {
    combatant.combatState.conditions = changes.conditions;
  }
  if (changes.resources) {
    combatant.combatState.resources = changes.resources;
  }

  return newState;
}
