// Ziel: Turn-Planung und Ausfuehrung fuer Combat-AI
// Siehe: docs/services/combatantAI/turnExecution.md
//
// Iteratives Pruning mit 50%-Threshold:
// 1. Root-Kandidat erstellen (aktuelle Position, volles Budget)
// 2. Expand: Alle Follow-up-Aktionen generieren (Move, Action, Bonus, Pass)
// 3. Prune: Kandidaten unter 50% des besten projectedValue eliminieren
// 4. Wiederhole 2-3 bis alle Kandidaten terminiert sind
// 5. Besten terminalen Kandidaten waehlen
//
// Vorteile gegenueber Greedy:
// - Erkennt komplexe Kombinationen (Rogue: Cunning Dash → Attack → Retreat)
// - TWF: Attack → Off-Hand wird korrekt bewertet
// - Kiting: Move in → Attack → Move out
//
// Pipeline-Position:
// - Aufgerufen von: difficulty.simulateTurn()
// - Nutzt: actionScoring.calculatePairScore() (via expandAndPrune)
// - Nutzt: influenceMaps.buildEscapeDangerMap(), getThreatAt()
// - Output: TurnExplorationResult (beste Action-Sequenz)

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [DONE]: TWF-Potential via Iterative Pruning
// - Attack mit Light-Weapon → Off-Hand folgt wird durch Expansion erkannt
// - Kein expliziter Lookahead noetig, Pruning erhaelt beste Kombinationen
//
// --- Phase 8: Pruning-Algorithmus ---
//
// [HACK]: computeGlobalBestByType() Bonus-Action Requirements ignoriert
// - bestBonusAction nimmt an dass Requirements erfuellt werden
// - Konservativ: Ueberschaetzt maxGain, verhindert zu aggressives Pruning
// - Korrekt waere: Nur Requirements-erfuellbare Bonus-Actions zaehlen
//
// [HACK]: Dash-Value hardcoded auf 0.1
// - generateFollowups() gibt Dash minimalen Score (0.1)
// - Hauptnutzen kommt durch Expansion (mehr Cells erreichbar)
// - Korrekt waere: Dynamischer Score basierend auf erreichbaren Optionen
//
// [HACK]: generateFollowups() generiert nur Enemy-Targets
// - Healing/Buff Actions gegen Allies werden nicht generiert
// - Combatants attackieren immer, heilen nie Allies
// - Korrekt waere: getCandidates() fuer Healing/Buff mit Ally-Targeting
//
// [HACK]: Reachable Cells ignorieren Difficult Terrain
// - getRelevantCells() × getDistance() berechnen nur Euclidean Distance
// - Difficult Terrain verdoppelt Movement-Kosten nicht
// - Korrekt waere: TerrainCost-Map integrieren
//
// [HACK]: maxIterations=20 als Safety Limit
// - expandAndPrune() bricht nach 20 Iterationen ab
// - Bei komplexen Szenarien koennten mehr noetig sein
// - Korrekt waere: Dynamisches Limit basierend auf Budget-Komplexitaet
//
// [HACK]: PRUNING_THRESHOLD hardcoded auf 0.5
// - Konstante ohne Konfigurationsmoeglichkeit
// - 50% ist heuristisch gewaehlt, nicht empirisch validiert
// - Korrekt waere: Konfigurierbarer Parameter oder adaptive Anpassung
//

import type { Action } from '@/types/entities';
import type {
  GridPosition,
  TurnBudget,
  TurnAction,
  TurnExplorationResult,
  TurnCandidate,
  GlobalBestByType,
  Combatant,
  // Layer System Types
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
} from '@/types/combat';
import {
  getExpectedValue,
  feetToCell,
  positionToKey,
  positionsEqual,
} from '@/utils';
import {
  getActionMaxRangeCells,
  getDistance,
  isHostile,
} from './combatHelpers';
import {
  getGroupId,
  getPosition,
  getSpeed,
} from '../combatTracking';
import {
  calculatePairScore,
  isConcentrationSpell,
} from './actionScoring';
import { getRelevantCells } from '@/utils';
import {
  buildEscapeDangerMap,
  getThreatAt,
  getAvailableActionsAt,
  getFullResolution,
  calculateExpectedReactionCost,
} from './influenceMaps';
// Standard-Actions (Dash, Disengage, Dodge) - verfuegbar fuer alle Combatants
import { standardActions } from '../../../presets/actions';

// Action Availability (direct imports for internal use)
import {
  isActionUsable,
  getAvailableActionsForCombatant,
  consumeActionResource,
  tickRechargeTimers,
} from './actionAvailability';

// ============================================================================
// RE-EXPORTS
// ============================================================================

export {
  isActionAvailable,
  isActionUsable,
  matchesRequirement,
  hasIncapacitatingCondition,
  getAvailableActionsForCombatant,
  initializeResources,
  consumeActionResource,
  tickRechargeTimers,
} from './actionAvailability';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[turnExecution]', ...args);
  }
};

// ============================================================================
// LOCAL TYPES
// ============================================================================

/**
 * TurnAction mit Score fuer Unified Action Selection.
 * Ermoeglicht Vergleich von Attack vs Move vs Pass auf derselben Skala.
 */
type ScoredAction = TurnAction & { score: number };

/** Pruning-Threshold: Kandidaten unter 30% des Besten werden eliminiert. HACK: siehe Header */
const PRUNING_THRESHOLD = 0.3;

/** Beam Width: Maximale Anzahl Kandidaten pro Iteration (Beam Search). */
const BEAM_WIDTH = 50;  // Reduziert von 100 für bessere Performance

/** Active Limit: Maximale Anzahl Kandidaten die pro Iteration expandiert werden. */
const ACTIVE_LIMIT = 10;  // Reduziert von 20 für bessere Performance

/** Maximale Move-Kandidaten pro Expansion (nur beste Cells behalten). */
const MAX_MOVE_CANDIDATES = 10;  // Reduziert von 20 für bessere Performance

/** Prefilter Ratio: Evaluiere 2× mehr Cells als behalten werden (Quick-Filter). */
const PREFILTER_RATIO = 2;

// ============================================================================
// GLOBAL BEST COMPUTATION
// ============================================================================

/**
 * Berechnet globale Best-Scores pro ActionSlot fuer Pruning-Schaetzung.
 * Ermoeglicht aggressive Elimination: Wenn cumulativeValue + maxGain < bestValue * threshold,
 * kann der Kandidat nicht mehr gewinnen und wird eliminiert.
 * HACK: Bonus-Action Requirements ignoriert - siehe Header.
 *
 * @param combatant Eigener Combatant (mit Layer-Daten)
 * @param state CombatantSimulationStateWithLayers (mit Layer-Daten)
 * @param escapeDangerMap Map mit Escape-Danger pro Cell
 * @returns GlobalBestByType mit besten Scores pro Slot
 */
export function computeGlobalBestByType(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  escapeDangerMap: Map<string, number>
): GlobalBestByType {
  let bestAction = 0;
  let bestBonusAction = 0;
  let bestMovement = 0;

  // 1. Beste Action-Scores via Layer-System ermitteln
  // Iteriere über alle Damage-Actions und berechne den besten Score gegen alle Enemies
  const enemies = state.combatants.filter(c =>
    isHostile(getGroupId(combatant), getGroupId(c), state.alliances)
  );

  for (const action of combatant._layeredActions) {
    if (!action.damage) continue;

    const rangeCells = action._layer?.rangeCells ?? feetToCell(action.range?.long ?? action.range?.normal ?? 5);

    for (const enemy of enemies) {
      const distance = getDistance(getPosition(combatant), getPosition(enemy));

      // Pruning-Heuristik: Nehme an, dass wir optimal positioniert werden können
      // (Movement Budget bereits separat berücksichtigt)
      if (distance <= rangeCells) {
        const resolved = getFullResolution(action, combatant, enemy, state);
        const score = getExpectedValue(resolved.effectiveDamagePMF);
        if (score > bestAction) {
          bestAction = score;
        }
      }
    }
  }

  // 2. Beste Bonus-Action-Scores ermitteln
  // Bonus Actions koennen Requirements haben - wir nehmen konservativ den besten
  // Score unter der Annahme dass Requirements erfuellt werden
  const bonusActions = getAvailableActionsForCombatant(combatant)
    .filter(a => a.timing.type === 'bonus');

  for (const action of bonusActions) {
    // Fuer jede Bonus-Action: Finde besten Score gegen alle Enemies
    const enemies = state.combatants.filter(c =>
      isHostile(getGroupId(combatant), getGroupId(c), state.alliances)
    );

    for (const enemy of enemies) {
      const distance = getDistance(getPosition(combatant), getPosition(enemy));
      const maxRange = getActionMaxRangeCells(action, combatant._layeredActions);
      if (distance <= maxRange) {
        const result = calculatePairScore(combatant, action, enemy, distance, state);
        if (result && result.score > bestBonusAction) {
          bestBonusAction = result.score;
        }
      }
    }
  }

  // 3. Beste Movement-Score (Danger-Reduktion)
  // Die beste Position ist die mit der niedrigsten Escape-Danger
  // Movement-Value = aktuelle Danger - beste erreichbare Danger
  const currentDanger = escapeDangerMap.get(positionToKey(getPosition(combatant))) ?? 0;
  let minDanger = currentDanger;
  for (const danger of escapeDangerMap.values()) {
    if (danger < minDanger) {
      minDanger = danger;
    }
  }
  bestMovement = Math.max(0, currentDanger - minDanger);

  debug('computeGlobalBestByType:', {
    bestAction,
    bestBonusAction,
    bestMovement,
  });

  return {
    action: bestAction,
    bonusAction: bestBonusAction,
    movement: bestMovement,
  };
}

/**
 * Schaetzt den maximalen Gewinn der mit verbleibendem Budget noch moeglich ist.
 * Fuer aggressives Pruning: Wenn current + maxGain < best * threshold → eliminieren.
 */
export function estimateMaxFollowUpGain(
  budget: TurnBudget,
  globalBest: GlobalBestByType
): number {
  let maxGain = 0;
  if (budget.hasAction) maxGain += globalBest.action;
  if (budget.hasBonusAction) maxGain += globalBest.bonusAction;
  if (budget.movementCells > 0) maxGain += globalBest.movement;
  return maxGain;
}

// ============================================================================
// TURN CANDIDATE GENERATION & PRUNING
// ============================================================================

/**
 * Prueft ob ein Kandidat terminiert ist (kein weiteres Budget oder Pass gewaehlt).
 */
function isTerminated(candidate: TurnCandidate): boolean {
  const lastAction = candidate.actions[candidate.actions.length - 1];
  if (lastAction?.type === 'pass') return true;

  const b = candidate.budgetRemaining;
  return !b.hasAction && !b.hasBonusAction && b.movementCells <= 0;
}

/**
 * Klont ein TurnBudget fuer immutable Updates.
 */
function cloneBudget(budget: TurnBudget): TurnBudget {
  return { ...budget };
}

/**
 * Generiert den Root-Kandidaten als Startpunkt der Exploration.
 */
function createRootCandidate(
  combatant: Combatant,
  budget: TurnBudget
): TurnCandidate {
  return {
    cell: { ...getPosition(combatant) },
    budgetRemaining: cloneBudget(budget),
    actions: [],
    cumulativeValue: 0,
    priorActions: [],
  };
}

/**
 * Wendet eine Aktion auf einen Kandidaten an und erzeugt neuen Kandidaten.
 * Mutiert den Original-Kandidaten NICHT.
 */
function applyActionToCandidate(
  candidate: TurnCandidate,
  action: TurnAction,
  value: number,
  priorAction?: Action
): TurnCandidate {
  const newBudget = cloneBudget(candidate.budgetRemaining);
  let newCell = { ...candidate.cell };

  switch (action.type) {
    case 'move':
      // Movement-Kosten berechnen
      const moveCost = getDistance(candidate.cell, action.targetCell);
      newBudget.movementCells = Math.max(0, newBudget.movementCells - moveCost);
      newCell = action.targetCell;
      break;

    case 'action':
      if (action.action.timing.type === 'bonus') {
        newBudget.hasBonusAction = false;
      } else {
        newBudget.hasAction = false;
        // Dash: Extra Movement hinzufuegen
        if (hasGrantMovementEffect(action.action)) {
          newBudget.movementCells += newBudget.baseMovementCells;
          newBudget.hasDashed = true;
        }
      }
      // Bewegung bei targetCell
      if (action.targetCell) {
        const moveCost = getDistance(candidate.cell, action.targetCell);
        newBudget.movementCells = Math.max(0, newBudget.movementCells - moveCost);
        newCell = action.targetCell;
      }
      break;

    case 'pass':
      // Alles auf 0 setzen um Terminierung zu signalisieren
      newBudget.hasAction = false;
      newBudget.hasBonusAction = false;
      newBudget.movementCells = 0;
      break;
  }

  return {
    cell: newCell,
    budgetRemaining: newBudget,
    actions: [...candidate.actions, action],
    cumulativeValue: candidate.cumulativeValue + value,
    priorActions: priorAction
      ? [...candidate.priorActions, priorAction]
      : [...candidate.priorActions],
  };
}

/**
 * Generiert alle moeglichen Follow-up-Aktionen fuer einen Kandidaten.
 * Gibt ScoredActions zurueck die dann auf den Kandidaten angewendet werden.
 * HACK: Dash-Value hardcoded, nur Enemy-Targets, kein Difficult Terrain - siehe Header.
 */
function generateFollowups(
  candidate: TurnCandidate,
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  escapeDangerMap: Map<string, number>
): ScoredAction[] {
  const followups: ScoredAction[] = [];
  const budget = candidate.budgetRemaining;
  const currentCell = candidate.cell;

  // Virtueller Combatant an aktueller Kandidaten-Position
  const virtualCombatant: CombatantWithLayers = {
    ...combatant,
    combatState: { ...combatant.combatState, position: currentCell },
  };
  const combatantMovement = feetToCell(getSpeed(combatant).walk ?? 30);

  // Alle verfuegbaren Actions mit priorActions-Kontext (fuer Requirements wie TWF)
  const allAvailableActions = getAvailableActionsWithLayers(combatant, {
    priorActions: candidate.priorActions,
  });

  // Enemies fuer Target-Suche
  const enemies = state.combatants.filter(c =>
    isHostile(getGroupId(combatant), getGroupId(c), state.alliances)
  );

  // 1. Standard-Aktionen (wenn Action verfuegbar)
  if (budget.hasAction) {
    const standardActions = allAvailableActions
      .filter(a => a.timing.type !== 'bonus' && !hasGrantMovementEffect(a));

    for (const action of standardActions) {
      for (const enemy of enemies) {
        const distance = getDistance(currentCell, getPosition(enemy));
        const maxRange = getActionMaxRangeCells(action, combatant._layeredActions);

        if (distance <= maxRange) {
          const result = calculatePairScore(virtualCombatant, action, enemy, distance, state);
          if (result && result.score > 0) {
            followups.push({
              type: 'action',
              action,
              target: enemy,
              score: result.score,
            });
          }
        }
      }
    }

    // Dash-Aktion (erhoehe Movement)
    const dashAction = allAvailableActions.find(a =>
      a.timing.type !== 'bonus' && hasGrantMovementEffect(a)
    );
    if (dashAction && !budget.hasDashed) {
      followups.push({
        type: 'action',
        action: dashAction,
        score: 0.1, // Kleiner Wert, Hauptnutzen kommt durch Expansion
      });
    }
  }

  // 2. Bonus-Aktionen (wenn Bonus verfuegbar)
  if (budget.hasBonusAction) {
    const bonusActions = allAvailableActions.filter(a => a.timing.type === 'bonus');

    for (const action of bonusActions) {
      // Dash als Bonus (Cunning Action) - separates Handling
      if (hasGrantMovementEffect(action)) {
        if (!budget.hasDashed) {
          followups.push({
            type: 'action',
            action,
            score: 0.1, // Kleiner Wert, Hauptnutzen durch Expansion
          });
        }
        continue;
      }

      // Normale Bonus Actions: Finde bestes Target
      for (const enemy of enemies) {
        const distance = getDistance(currentCell, getPosition(enemy));
        const maxRange = getActionMaxRangeCells(action, combatant._layeredActions);

        if (distance <= maxRange) {
          const result = calculatePairScore(virtualCombatant, action, enemy, distance, state);
          if (result && result.score > 0) {
            followups.push({
              type: 'action',
              action,
              target: enemy,
              score: result.score,
            });
          }
        }
      }
    }
  }

  // 3. Move-Aktionen (wenn Movement verfuegbar)
  if (budget.movementCells > 0) {
    const reachableCells = getRelevantCells(currentCell, budget.movementCells)
      .filter(cell => !positionsEqual(cell, currentCell))
      .filter(cell => getDistance(currentCell, cell) <= budget.movementCells);

    // Berechne minimale Distanz zum naechsten Feind (fuer Quick-Filter)
    const enemies = state.combatants.filter(c =>
      !state.alliances[getGroupId(combatant)]?.includes(getGroupId(c))
    );
    const getMinEnemyDistance = (cell: GridPosition) => {
      let min = Infinity;
      for (const enemy of enemies) {
        const d = getDistance(cell, getPosition(enemy));
        if (d < min) min = d;
      }
      return min;
    };

    // Layer-basierte Prüfung: Kann von dieser Cell aus angegriffen werden?
    const canAttackFromCell = (cell: GridPosition): boolean => {
      for (const action of combatant._layeredActions) {
        if (!action.damage) continue;
        const rangeCells = action._layer?.rangeCells ?? feetToCell(action.range?.long ?? action.range?.normal ?? 5);
        for (const enemy of enemies) {
          if (getDistance(cell, getPosition(enemy)) <= rangeCells) {
            return true;
          }
        }
      }
      return false;
    };

    // Early Move Filtering: Quick-Score fuer alle Cells
    // Layer-System ersetzt Source Map für Attack-Möglichkeiten
    const quickScored = reachableCells.map(cell => {
      const key = positionToKey(cell);
      return {
        cell,
        hasAttack: canAttackFromCell(cell),
        escapeDanger: escapeDangerMap.get(key) ?? Infinity,
        minEnemyDistance: getMinEnemyDistance(cell),
      };
    });

    // Prüfe ob Attack-Cells verfuegbar sind
    const hasAnyAttackCell = quickScored.some(s => s.hasAttack);

    // Sortiere: Cells mit Attacks zuerst, dann nach Danger ODER Distanz
    quickScored.sort((a, b) => {
      if (a.hasAttack !== b.hasAttack) return b.hasAttack ? 1 : -1;

      // Wenn Attack-Cells verfuegbar: Niedrige Danger bevorzugen (Kiting)
      // Wenn keine Attack-Cells: Niedrige Distanz bevorzugen (Approach)
      if (hasAnyAttackCell) {
        return a.escapeDanger - b.escapeDanger;
      } else {
        return a.minEnemyDistance - b.minEnemyDistance;
      }
    });

    // Nur Top-N voll evaluieren (2× MAX_MOVE_CANDIDATES, dann nach vollem Score filtern)
    const prefilterLimit = MAX_MOVE_CANDIDATES * PREFILTER_RATIO;
    const topCells = quickScored.slice(0, prefilterLimit);

    // Volle Evaluation nur fuer Pre-Filtered Cells
    const moveCandidates: ScoredAction[] = [];
    for (const { cell } of topCells) {
      // Combined Score = attractionScore - escapeDanger - OA
      // Layer-System: getAvailableActionsAt ersetzt calculateAttractionFromSourceMap
      const availableActions = getAvailableActionsAt(cell, combatant, state);
      const attractionScore = availableActions.length > 0
        ? Math.max(...availableActions.flatMap(a =>
            a.targets.map(t => getExpectedValue(t.effectiveDamagePMF))
          ))
        : 0;
      const escapeDanger = escapeDangerMap.get(positionToKey(cell))
        ?? getThreatAt(cell, combatant, state);
      const expectedOA = calculateExpectedReactionCost(virtualCombatant, currentCell, cell, state);

      const moveScore = attractionScore - escapeDanger - expectedOA;

      moveCandidates.push({
        type: 'move',
        targetCell: cell,
        score: moveScore,
      });
    }

    // Move Ordering: Sortiere nach Score und behalte nur beste Cells
    moveCandidates.sort((a, b) => b.score - a.score);
    const limitedMoves = moveCandidates.slice(0, MAX_MOVE_CANDIDATES);
    followups.push(...limitedMoves);
  }

  return followups;
}

/**
 * Pruning: Entferne Kandidaten die unter dem Threshold liegen.
 * Gibt sowohl bereinigte Kandidaten als auch Anzahl geprunter zurueck.
 */
function pruneByThreshold(
  candidates: TurnCandidate[],
  threshold: number,
  globalBest: GlobalBestByType
): { survivors: TurnCandidate[]; pruned: number } {
  if (candidates.length === 0) {
    return { survivors: [], pruned: 0 };
  }

  // Berechne projectedValue = cumulativeValue + maxGain fuer jeden Kandidaten
  const scored = candidates.map(c => ({
    candidate: c,
    projectedValue: c.cumulativeValue + estimateMaxFollowUpGain(c.budgetRemaining, globalBest),
  }));

  // Finde besten projectedValue (ohne Spread um Stack Overflow zu vermeiden)
  const bestProjected = scored.reduce(
    (max, s) => s.projectedValue > max ? s.projectedValue : max,
    -Infinity
  );
  const cutoff = bestProjected * threshold;

  // Filtere
  const survivors = scored
    .filter(s => s.projectedValue >= cutoff)
    .map(s => s.candidate);

  debug('pruneByThreshold:', {
    candidateCount: candidates.length,
    bestProjected,
    cutoff,
    survivorCount: survivors.length,
  });

  return {
    survivors,
    pruned: candidates.length - survivors.length,
  };
}

/**
 * Iteratives Expand + Prune bis alle Kandidaten terminiert sind.
 * Kernelement des Turn-Exploration-Algorithmus.
 * HACK: maxIterations=20 als Safety Limit - siehe Header.
 */
function expandAndPrune(
  candidates: TurnCandidate[],
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  escapeDangerMap: Map<string, number>,
  globalBest: GlobalBestByType
): { terminalCandidates: TurnCandidate[]; totalPruned: number; totalEvaluated: number } {
  let current = candidates;
  let totalPruned = 0;
  let totalEvaluated = 0;
  let iteration = 0;
  const maxIterations = 20; // Safety limit

  while (iteration < maxIterations) {
    iteration++;

    // Separiere terminierte und nicht-terminierte Kandidaten
    const terminated: TurnCandidate[] = [];
    const active: TurnCandidate[] = [];

    for (const candidate of current) {
      if (isTerminated(candidate)) {
        terminated.push(candidate);
      } else {
        active.push(candidate);
      }
    }

    // Wenn keine aktiven Kandidaten mehr: fertig
    if (active.length === 0) {
      debug('expandAndPrune: all terminated', { iteration, terminalCount: terminated.length });
      return { terminalCandidates: terminated, totalPruned, totalEvaluated };
    }

    // Active Limit: Sortiere und begrenze aktive Kandidaten VOR Expansion
    // Reduziert Anzahl der teuren generateFollowups() Aufrufe drastisch
    active.sort((a, b) => b.cumulativeValue - a.cumulativeValue);
    const toExpand = active.length > ACTIVE_LIMIT ? active.slice(0, ACTIVE_LIMIT) : active;

    // Expand: Generiere Follow-ups nur fuer Top-Kandidaten
    const expanded: TurnCandidate[] = [...terminated];

    for (const candidate of toExpand) {
      const followups = generateFollowups(candidate, combatant, state, escapeDangerMap);
      totalEvaluated += followups.length;

      for (const followup of followups) {
        const priorAction = followup.type === 'action' ? followup.action : undefined;
        expanded.push(applyActionToCandidate(candidate, followup, followup.score, priorAction));
      }

      // Pass ist immer eine Option
      expanded.push(applyActionToCandidate(candidate, { type: 'pass' }, 0));
    }

    // Beam Search: Begrenze Kandidaten auf BEAM_WIDTH vor Pruning
    if (expanded.length > BEAM_WIDTH) {
      expanded.sort((a, b) => b.cumulativeValue - a.cumulativeValue);
      expanded.length = BEAM_WIDTH;
      debug('expandAndPrune: beam search applied', { beforeBeam: expanded.length + (expanded.length - BEAM_WIDTH), afterBeam: BEAM_WIDTH });
    }

    // Prune: Entferne schwache Kandidaten
    const { survivors, pruned } = pruneByThreshold(expanded, PRUNING_THRESHOLD, globalBest);
    totalPruned += pruned;

    debug('expandAndPrune: iteration', {
      iteration,
      activeBefore: active.length,
      activeExpanded: toExpand.length,
      expanded: expanded.length,
      survivors: survivors.length,
      pruned,
    });

    current = survivors;
  }

  // Safety: Max Iterations erreicht
  debug('expandAndPrune: max iterations reached', { iteration: maxIterations });
  return {
    terminalCandidates: current.filter(isTerminated),
    totalPruned,
    totalEvaluated,
  };
}

// ============================================================================
// ACTION EFFECT HELPERS
// ============================================================================

/**
 * Prueft ob eine Action Movement gewaehrt (Dash-aehnlich).
 * Effect-basierte Erkennung statt hardcodierter ActionType-Pruefung.
 */
export function hasGrantMovementEffect(action: Action): boolean {
  return action.effects?.some(e => e.grantMovement != null) ?? false;
}

/**
 * Version for CombatantWithLayers that uses _layeredActions.
 * Combines layered actions with standard actions and filters by availability.
 * Supports priorActions context for requirements checking (TWF, Flurry, etc.)
 */
export function getAvailableActionsWithLayers(
  combatant: CombatantWithLayers,
  context: { priorActions?: Action[] } = {}
): Action[] {
  const allActions = [...combatant._layeredActions, ...standardActions];
  return allActions.filter(a => isActionUsable(a, combatant, context));
}

// ============================================================================
// TURN EXECUTION
// ============================================================================

/**
 * Fuehrt einen kompletten Zug aus: Movement + Action.
 *
 * Iteratives Pruning mit 50%-Threshold:
 * 1. Root-Kandidat erstellen
 * 2. Iterativ expandieren (alle Follow-ups generieren)
 * 3. Pruning: Kandidaten unter 50% des Besten eliminieren
 * 4. Besten terminalen Kandidaten waehlen
 *
 * Vorteile gegenueber Greedy:
 * - Erkennt komplexe Kombinationen (Rogue: Cunning Dash → Attack → Retreat)
 * - TWF: Attack → Off-Hand korrekt bewertet
 * - Kiting: Move in → Attack → Move out
 *
 * @returns TurnExplorationResult mit Actions, finalCell und Metriken
 */
export function executeTurn(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget
): TurnExplorationResult {
  // Resource Management: Recharge-Timer zu Beginn des Zuges dekrementieren
  tickRechargeTimers(combatant.combatState.resources);

  // Escape-Danger Map mit erweitertem Radius fuer Dash-Szenarien
  const maxMovement = budget.movementCells + budget.baseMovementCells; // Mit Dash

  // Phase 1: Maps einmalig berechnen
  // Layer-System ersetzt SourceMap - Actions haben bereits _layer.grid mit Range-Daten
  const escapeDangerMap = buildEscapeDangerMap(combatant, state, maxMovement);

  // Phase 2: Global-Best fuer Pruning-Schaetzung berechnen
  const globalBest = computeGlobalBestByType(combatant, state, escapeDangerMap);

  // Phase 3: Root-Kandidat erstellen
  const rootCandidate = createRootCandidate(combatant, budget);

  // Phase 4: Iteratives Expand + Prune
  const { terminalCandidates, totalPruned, totalEvaluated } = expandAndPrune(
    [rootCandidate],
    combatant,
    state,
    escapeDangerMap,
    globalBest
  );

  // Phase 5: Besten terminalen Kandidaten waehlen
  if (terminalCandidates.length === 0) {
    debug('executeTurn: no terminal candidates, returning pass');
    return {
      actions: [{ type: 'pass' }],
      finalCell: getPosition(combatant),
      totalValue: 0,
      candidatesEvaluated: totalEvaluated,
      candidatesPruned: totalPruned,
    };
  }

  const bestCandidate = terminalCandidates.reduce((a, b) =>
    a.cumulativeValue > b.cumulativeValue ? a : b
  );

  // Phase 6: Resource-Verbrauch und Concentration fuer alle Actions im Pfad anwenden
  for (const action of bestCandidate.actions) {
    if (action.type === 'action') {
      consumeActionResource(action.action, combatant.combatState.resources);

      // Concentration-Tracking
      if (isConcentrationSpell(action.action)) {
        combatant.combatState.concentratingOn = action.action.id;
        debug('executeTurn: concentration set', { spell: action.action.name });
      }
    }
  }

  debug('executeTurn: complete', {
    combatantId: combatant.id,
    actionCount: bestCandidate.actions.length,
    actionTypes: bestCandidate.actions.map(a => a.type),
    candidatesEvaluated: totalEvaluated,
    candidatesPruned: totalPruned,
    totalValue: bestCandidate.cumulativeValue,
    finalCell: bestCandidate.cell,
  });

  return {
    actions: bestCandidate.actions,
    finalCell: bestCandidate.cell,
    totalValue: bestCandidate.cumulativeValue,
    candidatesEvaluated: totalEvaluated,
    candidatesPruned: totalPruned,
  };
}
