// Ziel: Turn-Planung und Ausfuehrung fuer Combat-AI
// Siehe: docs/services/combatSimulator/turnExploration.md
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

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: sameTarget in matchesRequirement() ignoriert
// - matchesRequirement() prueft nur actionType und properties
// - sameTarget bleibt im Schema fuer zukuenftige Features (z.B. Monk Stunning Strike)
// - Korrekt waere: Target-Tracking in priorActions + sameTarget-Pruefung
//
// [HACK]: hasDisengage nicht aus prior Actions erkannt
// - wouldTriggerOA() erwartet hasDisengage als Parameter
// - executeTurn() trackt Disengage-State nicht aus prior Actions
// - Korrekt waere: Pruefe ob Disengage-Action in priorActions enthalten
//
// [HACK]: OA-Schaden nur geschaetzt, nicht ausgefuehrt
// - calculateExpectedOADamage() berechnet erwarteten Schaden als Penalty
// - Keine tatsaechliche HP-Reduktion am bewegenden Combatant
// - Korrekt waere: resolveAttack() in Combat-Tracking mit OA aufrufen
//
// [HACK]: Enemy Reaction-State nicht vollstaendig getrackt
// - calculateExpectedOADamage() nimmt optionales budgetMap an
// - Meiste Aufrufer uebergeben kein budgetMap
// - Korrekt waere: Globales Reaction-Tracking pro Combat-Runde
//
// [DONE]: TWF-Potential via Iterative Pruning
// - Attack mit Light-Weapon → Off-Hand folgt wird durch Expansion erkannt
// - Kein expliziter Lookahead noetig, Pruning erhaelt beste Kombinationen
//
// [TODO]: Disengage-State aus prior Actions erkennen
// - executeTurn() sollte pruefen ob Disengage-Action in priorActions
// - wouldTriggerOA() dann automatisch hasDisengage ableiten
// - Alternativ: TurnState-Objekt mit hasDisengaged Flag
//
// --- Phase 6: Reaction System ---
//
// [HACK]: executeOA() berechnet nur expected damage, keine HP-Reduktion
// - Nutzt estimateOADamage() statt resolveAttack()
// - Ziel-HP wird nicht tatsaechlich reduziert
// - Ideal: resolveAttack() aufrufen und HP im State aktualisieren
//
// [HACK]: executeOA() waehlt immer erste passende OA-Action
// - Keine Vergleichsbewertung wenn mehrere OA-faehige Actions vorhanden
// - Ideal: Alle OA-Optionen scoren und beste waehlen
//
// --- Phase 4: Resource Management ---
//
// [HACK]: Recharge-Timer startet immer bei 0 (verfuegbar)
// - initializeResources() setzt Timer auf 0 fuer alle Recharge-Abilities
// - Realistischer waere: resourceBudget-skalierte Wahrscheinlichkeit ob verfuegbar
// - z.B. resourceBudget=0.5 → 50% Chance dass Ability auf Cooldown
//
// [HACK]: Recharge-Timer nutzt deterministischen expectedTurns statt Wuerfel
// - consumeActionResource() setzt Timer auf Math.ceil(1/probability)
// - z.B. Recharge 5-6 (33%) → 3 Runden Cooldown
// - Realistischer waere: Wuerfelwurf am Anfang jedes Zuges
//
// [HACK]: Spell Slot Skalierung kann 0 ergeben bei niedrigem Budget
// - Math.floor(maxSlots * resourceBudget) → 0 bei budget < 1/maxSlots
// - z.B. 2 Slots × 0.3 Budget = 0 Slots verfuegbar
// - Alternativ: Math.ceil() oder Minimum 1 wenn maxSlots > 0
//
// [HACK]: Nur Enemy-Profiles bekommen Resources initialisiert
// - createEnemyProfiles() ruft initializeResources() auf
// - createPartyProfiles() initialisiert keine Resources
// - Party-Spell-Tracking fehlt vollstaendig
//
// [HACK]: Legendary Action Points nicht getrackt
// - isActionAvailable() prueft nicht auf legendary cost
// - consumeActionResource() dekrementiert keine legendary points
// - Actions mit recharge.type='legendary' immer verfuegbar
//
// [TODO]: shouldUseResource() Heuristik implementieren
// - Spec: crystalline-herding-nygaard.md Phase 4.2
// - RESOURCE_THRESHOLD = 0.6 (nur nutzen wenn >= 60% max value)
// - Input: action, currentScore, maxPossibleScore
// - Output: boolean ob Resource genutzt werden soll
//
// [TODO]: Material Component Costs pruefen
// - isActionAvailable() ignoriert action.components.materialCost
// - Kein Gold-Tracking im Combat-State
// - Ideal: components.consumed=true → Gold abziehen und tracken
//
// [TODO]: Party-Resources initialisieren
// - createPartyProfiles() sollte Character.spellSlots nutzen
// - Requires: spellSlots Feld auf Character Entity
// - Alternativ: Inferenz aus Character-Level und Class
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
  CombatProfile,
  CombatResources,
  SimulationState,
  TurnBudget,
  TurnAction,
  TurnExplorationResult,
  ActionTargetScore,
  TurnCandidate,
  GlobalBestByType,
} from '@/types/combat';
import {
  diceExpressionToPMF,
  getExpectedValue,
  addConstant,
  feetToCell,
  positionToKey,
  positionsEqual,
} from '@/utils';
import {
  getActionMaxRangeCells,
  getDistance,
  isHostile,
  calculateHitChance,
} from './combatHelpers';
import {
  hasBudgetRemaining,
  consumeMovement,
  consumeAction,
  consumeBonusAction,
  consumeReaction,
  applyDash,
} from '../combatTracking';
import {
  getCandidates,
  calculatePairScore,
  getActionIntent,
  isConcentrationSpell,
  findMatchingReactions,
  shouldUseReaction,
  type ReactionContext,
} from './actionScoring';
import {
  getRelevantCells,
  buildSourceMaps,
  calculateAttractionFromSourceMap,
  calculateScoreFromSourceMap,
  calculateDangerScore,
  calculateAllyScore,
  buildEscapeDangerMap,
  type SourceMapEntry,
} from './cellPositioning';

// Standard-Actions (Dash, Disengage, Dodge) - verfuegbar fuer alle Combatants
import { standardActions } from '../../../presets/actions';

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

/** Pruning-Threshold: Kandidaten unter 50% des Besten werden eliminiert. HACK: siehe Header */
const PRUNING_THRESHOLD = 0.5;

// ============================================================================
// GLOBAL BEST COMPUTATION
// ============================================================================

/**
 * Berechnet globale Best-Scores pro ActionSlot fuer Pruning-Schaetzung.
 * Ermoeglicht aggressive Elimination: Wenn cumulativeValue + maxGain < bestValue * threshold,
 * kann der Kandidat nicht mehr gewinnen und wird eliminiert.
 * HACK: Bonus-Action Requirements ignoriert - siehe Header.
 *
 * @param profile Eigenes Profil
 * @param state SimulationState
 * @param sourceMap Source-Map mit Attack-Moeglichkeiten
 * @param escapeDangerMap Map mit Escape-Danger pro Cell
 * @returns GlobalBestByType mit besten Scores pro Slot
 */
export function computeGlobalBestByType(
  profile: CombatProfile,
  state: SimulationState,
  sourceMap: Map<string, SourceMapEntry[]>,
  escapeDangerMap: Map<string, number>
): GlobalBestByType {
  let bestAction = 0;
  let bestBonusAction = 0;
  let bestMovement = 0;

  // 1. Beste Action-Scores aus SourceMap ermitteln
  for (const key of sourceMap.keys()) {
    const { score } = calculateScoreFromSourceMap(
      keyToPosition(key),
      sourceMap,
      profile,
      state
    );
    if (score > bestAction) {
      bestAction = score;
    }
  }

  // 2. Beste Bonus-Action-Scores ermitteln
  // Bonus Actions koennen Requirements haben - wir nehmen konservativ den besten
  // Score unter der Annahme dass Requirements erfuellt werden
  const bonusActions = getAvailableActions(profile)
    .filter(a => a.timing.type === 'bonus');

  for (const action of bonusActions) {
    // Fuer jede Bonus-Action: Finde besten Score gegen alle Enemies
    const enemies = state.profiles.filter(p =>
      isHostile(profile.groupId, p.groupId, state.alliances)
    );

    for (const enemy of enemies) {
      const distance = getDistance(profile.position, enemy.position);
      const maxRange = getActionMaxRangeCells(action, profile.actions);
      if (distance <= maxRange) {
        const result = calculatePairScore(profile, action, enemy, distance, state);
        if (result && result.score > bestBonusAction) {
          bestBonusAction = result.score;
        }
      }
    }
  }

  // 3. Beste Movement-Score (Danger-Reduktion)
  // Die beste Position ist die mit der niedrigsten Escape-Danger
  // Movement-Value = aktuelle Danger - beste erreichbare Danger
  const currentDanger = escapeDangerMap.get(positionToKey(profile.position)) ?? 0;
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
    sourceMapSize: sourceMap.size,
  });

  return {
    action: bestAction,
    bonusAction: bestBonusAction,
    movement: bestMovement,
  };
}

/**
 * Konvertiert einen Position-Key zurueck zu GridPosition.
 * Format: "x,y,z" → { x, y, z }
 */
function keyToPosition(key: string): GridPosition {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
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
  profile: CombatProfile,
  budget: TurnBudget
): TurnCandidate {
  return {
    cell: { ...profile.position },
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
  profile: CombatProfile,
  state: SimulationState,
  sourceMap: Map<string, SourceMapEntry[]>,
  escapeDangerMap: Map<string, number>
): ScoredAction[] {
  const followups: ScoredAction[] = [];
  const budget = candidate.budgetRemaining;
  const currentCell = candidate.cell;

  // Virtuelles Profil an aktueller Kandidaten-Position
  const virtualProfile = { ...profile, position: currentCell };
  const profileMovement = feetToCell(profile.speed?.walk ?? 30);

  // 1. Attack-Aktionen (wenn Action verfuegbar)
  if (budget.hasAction) {
    const availableActions = getAvailableActions(profile)
      .filter(a => a.timing.type !== 'bonus' && !hasGrantMovementEffect(a));

    for (const action of availableActions) {
      // Finde beste Target fuer diese Action an aktueller Position
      const enemies = state.profiles.filter(p =>
        isHostile(profile.groupId, p.groupId, state.alliances)
      );

      for (const enemy of enemies) {
        const distance = getDistance(currentCell, enemy.position);
        const maxRange = getActionMaxRangeCells(action, profile.actions);

        if (distance <= maxRange) {
          const result = calculatePairScore(virtualProfile, action, enemy, distance, state);
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
    const dashAction = getAvailableActions(profile).find(a => hasGrantMovementEffect(a));
    if (dashAction && !budget.hasDashed) {
      // Dash-Value: Ermoeglichung besserer Cells
      // Konservativ: Value ist die zusaetzliche Movement-Option
      const dashValue = 0.1; // Kleiner Wert, Hauptnutzen kommt durch Expansion
      followups.push({
        type: 'action',
        action: dashAction,
        score: dashValue,
      });
    }
  }

  // 2. Bonus-Aktionen (wenn Bonus verfuegbar)
  if (budget.hasBonusAction) {
    const bonusActions = generateBonusActions(virtualProfile, candidate.priorActions, state);
    followups.push(...bonusActions);

    // Cunning Action Dash (Bonus) - Rogue kann Dash als Bonus nutzen
    const bonusDash = getAvailableActions(profile).find(a =>
      a.timing.type === 'bonus' && hasGrantMovementEffect(a)
    );
    if (bonusDash && !budget.hasDashed) {
      followups.push({
        type: 'action',
        action: bonusDash,
        score: 0.1, // Kleiner Wert, Hauptnutzen durch Expansion
      });
    }
  }

  // 3. Move-Aktionen (wenn Movement verfuegbar)
  if (budget.movementCells > 0) {
    const reachableCells = getRelevantCells(currentCell, budget.movementCells)
      .filter(cell => !positionsEqual(cell, currentCell))
      .filter(cell => getDistance(currentCell, cell) <= budget.movementCells);

    for (const cell of reachableCells) {
      // Combined Score = attractionScore - escapeDanger + allyScore - OA
      const { score: attractionScore } = calculateAttractionFromSourceMap(
        cell,
        sourceMap,
        virtualProfile,
        state,
        profileMovement
      );
      const escapeDanger = escapeDangerMap.get(positionToKey(cell))
        ?? calculateDangerScore(cell, profile, state);
      const allyScore = calculateAllyScore(cell, profile, state);
      const expectedOA = calculateExpectedOADamage(virtualProfile, currentCell, cell, state);

      const moveScore = attractionScore + allyScore - escapeDanger - expectedOA;

      followups.push({
        type: 'move',
        targetCell: cell,
        score: moveScore,
      });
    }
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

  // Finde besten projectedValue
  const bestProjected = Math.max(...scored.map(s => s.projectedValue));
  const cutoff = bestProjected * threshold;

  // Filtere
  const survivors = scored
    .filter(s => s.projectedValue >= cutoff)
    .map(s => s.candidate);

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
  profile: CombatProfile,
  state: SimulationState,
  sourceMap: Map<string, SourceMapEntry[]>,
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

    // Expand: Generiere Follow-ups fuer alle aktiven Kandidaten
    const expanded: TurnCandidate[] = [...terminated];

    for (const candidate of active) {
      const followups = generateFollowups(candidate, profile, state, sourceMap, escapeDangerMap);
      totalEvaluated += followups.length;

      for (const followup of followups) {
        const priorAction = followup.type === 'action' ? followup.action : undefined;
        expanded.push(applyActionToCandidate(candidate, followup, followup.score, priorAction));
      }

      // Pass ist immer eine Option
      expanded.push(applyActionToCandidate(candidate, { type: 'pass' }, 0));
    }

    // Prune: Entferne schwache Kandidaten
    const { survivors, pruned } = pruneByThreshold(expanded, PRUNING_THRESHOLD, globalBest);
    totalPruned += pruned;

    debug('expandAndPrune: iteration', {
      iteration,
      activeBefore: active.length,
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
 * Kombiniert Creature-spezifische Actions mit Standard-Actions.
 * Standard-Actions (Dash, Disengage, Dodge) sind fuer alle Combatants verfuegbar.
 * Filtert Actions die nicht verfuegbar sind (keine Spell Slots, auf Cooldown, etc.)
 */
export function getAvailableActions(profile: CombatProfile): Action[] {
  const allActions = [...profile.actions, ...standardActions];
  return allActions.filter(a => isActionAvailable(a, profile.resources));
}

// ============================================================================
// RESOURCE MANAGEMENT
// ============================================================================

/**
 * Prueft ob eine Action aktuell verfuegbar ist (Ressourcen vorhanden).
 * HACK: Legendary Actions und Material Costs nicht geprueft - siehe Header.
 *
 * @param action Die zu pruefende Action
 * @param resources Die aktuellen Combat-Resources (optional)
 * @returns true wenn Action ausgefuehrt werden kann
 */
export function isActionAvailable(
  action: Action,
  resources: CombatResources | undefined
): boolean {
  // Kein Resource-Tracking = alles verfuegbar
  if (!resources) return true;

  // 1. Spell Slot Check
  if (action.spellSlot) {
    const level = action.spellSlot.level;
    const available = resources.spellSlots?.[level] ?? 0;
    if (available <= 0) {
      debug('isActionAvailable: no spell slots', { action: action.id, level });
      return false;
    }
  }

  // 2. Recharge Timer Check (Timer muss 0 sein = bereit)
  if (action.recharge?.type === 'recharge') {
    const timer = resources.rechargeTimers?.[action.id] ?? 0;
    if (timer > 0) {
      debug('isActionAvailable: on cooldown', { action: action.id, timer });
      return false;
    }
  }

  // 3. Per-Day / Per-Rest Check
  if (action.recharge?.type === 'per-day' || action.recharge?.type === 'per-rest') {
    const remaining = resources.perDayUses?.[action.id] ?? 0;
    if (remaining <= 0) {
      debug('isActionAvailable: no uses remaining', { action: action.id });
      return false;
    }
  }

  // 4. At-will, legendary, lair, mythic: immer verfuegbar
  return true;
}

/**
 * Initialisiert Combat-Resources fuer einen Combatant.
 * Skaliert Spell Slots und Per-Day Uses basierend auf resourceBudget.
 * HACK: Recharge-Timer startet bei 0, Spell Slots koennen 0 werden - siehe Header.
 *
 * @param actions Die Actions des Combatants
 * @param spellSlots Optionale Spell Slot Konfiguration (aus CreatureDefinition)
 * @param resourceBudget Budget 0-1 (1 = volle Ressourcen, 0.5 = 50%)
 * @returns Initialisierte CombatResources
 */
export function initializeResources(
  actions: Action[],
  spellSlots: Record<string, number> | undefined,
  resourceBudget: number
): CombatResources {
  const resources: CombatResources = {};

  // 1. Spell Slots (skaliert mit resourceBudget)
  if (spellSlots && Object.keys(spellSlots).length > 0) {
    resources.spellSlots = {};
    for (const [levelStr, maxSlots] of Object.entries(spellSlots)) {
      const level = Number(levelStr);
      resources.spellSlots[level] = Math.floor(maxSlots * resourceBudget);
    }
    debug('initializeResources: spellSlots', resources.spellSlots);
  }

  // 2. Recharge Abilities (Timer startet bei 0 = verfuegbar)
  const rechargeActions = actions.filter(a => a.recharge?.type === 'recharge');
  if (rechargeActions.length > 0) {
    resources.rechargeTimers = {};
    for (const action of rechargeActions) {
      resources.rechargeTimers[action.id] = 0;  // Startet verfuegbar
    }
    debug('initializeResources: rechargeTimers', resources.rechargeTimers);
  }

  // 3. Per-Day / Per-Rest Uses (skaliert mit resourceBudget)
  const limitedActions = actions.filter(a =>
    a.recharge?.type === 'per-day' || a.recharge?.type === 'per-rest'
  );
  if (limitedActions.length > 0) {
    resources.perDayUses = {};
    for (const action of limitedActions) {
      const recharge = action.recharge as { type: 'per-day' | 'per-rest'; uses: number };
      resources.perDayUses[action.id] = Math.floor(recharge.uses * resourceBudget);
    }
    debug('initializeResources: perDayUses', resources.perDayUses);
  }

  return resources;
}

/**
 * Konsumiert Ressourcen nach Ausfuehrung einer Action.
 * Dekrementiert Spell Slots, setzt Recharge Timer, oder dekrementiert Uses.
 * HACK: Recharge-Timer deterministisch, Legendary Points nicht getrackt - siehe Header.
 *
 * @param action Die ausgefuehrte Action
 * @param resources Die zu aktualisierenden Resources (mutiert!)
 */
export function consumeActionResource(
  action: Action,
  resources: CombatResources | undefined
): void {
  if (!resources) return;

  // 1. Spell Slot
  if (action.spellSlot && resources.spellSlots) {
    const level = action.spellSlot.level;
    if (resources.spellSlots[level] > 0) {
      resources.spellSlots[level]--;
      debug('consumeActionResource: spell slot', { action: action.id, level, remaining: resources.spellSlots[level] });
    }
  }

  // 2. Recharge (setzt Timer auf erwartete Runden bis Recharge)
  if (action.recharge?.type === 'recharge' && resources.rechargeTimers) {
    const [min, max] = action.recharge.range;
    const prob = (max - min + 1) / 6;  // z.B. [5,6] = 2/6 = 33%
    const expectedTurns = Math.ceil(1 / prob);  // z.B. 33% = 3 Runden
    resources.rechargeTimers[action.id] = expectedTurns;
    debug('consumeActionResource: recharge timer', { action: action.id, timer: expectedTurns });
  }

  // 3. Per-Day / Per-Rest
  if (
    (action.recharge?.type === 'per-day' || action.recharge?.type === 'per-rest') &&
    resources.perDayUses
  ) {
    if (resources.perDayUses[action.id] > 0) {
      resources.perDayUses[action.id]--;
      debug('consumeActionResource: per-day use', { action: action.id, remaining: resources.perDayUses[action.id] });
    }
  }
}

/**
 * Dekrementiert alle Recharge-Timer um 1 (zu Beginn eines Zuges aufrufen).
 * Timer bei 0 bleiben bei 0 (Action ist verfuegbar).
 *
 * @param resources Die zu aktualisierenden Resources (mutiert!)
 */
export function tickRechargeTimers(resources: CombatResources | undefined): void {
  if (!resources?.rechargeTimers) return;

  for (const actionId of Object.keys(resources.rechargeTimers)) {
    if (resources.rechargeTimers[actionId] > 0) {
      resources.rechargeTimers[actionId]--;
      debug('tickRechargeTimers:', { actionId, newTimer: resources.rechargeTimers[actionId] });
    }
  }
}

// ============================================================================
// BONUS ACTION HELPERS
// ============================================================================

/**
 * Prueft ob eine zuvor ausgefuehrte Action die Requirements einer Bonus Action erfuellt.
 * Fuer TWF: priorAction muss actionType 'melee-weapon' UND property 'light' haben.
 * HACK: sameTarget ignoriert - siehe Header.
 *
 * @param prior Die zuvor ausgefuehrte Action
 * @param requirement Die zu pruefenden Requirements
 * @returns true wenn alle Requirements erfuellt sind
 */
export function matchesRequirement(
  prior: Action,
  requirement: { actionType?: string[]; properties?: string[]; sameTarget?: boolean }
): boolean {
  // actionType Match: prior.actionType muss in requirement.actionType enthalten sein
  if (requirement.actionType && requirement.actionType.length > 0) {
    if (!requirement.actionType.includes(prior.actionType)) {
      return false;
    }
  }

  // properties Match: ALLE required properties muessen in prior.properties enthalten sein
  if (requirement.properties && requirement.properties.length > 0) {
    const priorProps = prior.properties ?? [];
    const hasAllProperties = requirement.properties.every(reqProp =>
      priorProps.includes(reqProp)
    );
    if (!hasAllProperties) {
      return false;
    }
  }

  // sameTarget: Nicht implementiert (RAW TWF erfordert kein gleiches Target)
  // Wird ignoriert - bleibt fuer zukuenftige Features im Schema

  return true;
}

/**
 * Generiert scored Bonus Actions basierend auf priorActions.
 * Filtert Actions mit timing.type === 'bonus' und prueft requires.priorAction.
 *
 * @param profile Der aktuelle Combatant
 * @param priorActions Actions die in diesem Turn bereits ausgefuehrt wurden
 * @param state Aktueller Combat-State
 * @returns Array von scored Bonus Actions
 */
export function generateBonusActions(
  profile: CombatProfile,
  priorActions: Action[],
  state: SimulationState
): ScoredAction[] {
  const bonusActions: ScoredAction[] = [];

  // Alle Bonus Actions des Profiles
  const availableBonusActions = getAvailableActions(profile)
    .filter(a => a.timing.type === 'bonus');

  for (const action of availableBonusActions) {
    // Pruefe Requirements
    if (action.requires?.priorAction) {
      const hasMatchingPrior = priorActions.some(prior =>
        matchesRequirement(prior, action.requires!.priorAction!)
      );
      if (!hasMatchingPrior) {
        continue;  // Skip - Requirements nicht erfuellt
      }
    }

    // Finde passendes Target fuer diese spezifische Bonus Action
    const enemies = state.profiles.filter(p =>
      isHostile(profile.groupId, p.groupId, state.alliances)
    );
    let bestScore = 0;
    let bestTarget: CombatProfile | undefined;

    for (const enemy of enemies) {
      const distance = getDistance(profile.position, enemy.position);
      const maxRange = getActionMaxRangeCells(action, profile.actions);

      if (distance <= maxRange) {
        const result = calculatePairScore(profile, action, enemy, distance, state);
        if (result && result.score > bestScore) {
          bestScore = result.score;
          bestTarget = enemy;
        }
      }
    }

    if (bestTarget && bestScore > 0) {
      bonusActions.push({
        type: 'action',
        action,
        target: bestTarget,
        score: bestScore,
      });
    }
  }

  return bonusActions;
}

// ============================================================================
// OPPORTUNITY ATTACK HELPERS
// ============================================================================

/**
 * Prueft ob Bewegung von fromCell nach toCell einen Opportunity Attack eines Feindes triggert.
 * OA wird getriggert wenn:
 * - fromCell ist in Reach des Feindes
 * - toCell ist ausserhalb der Reach des Feindes (Verlassen des Bereichs)
 * - Feind hat noch Reaction verfuegbar
 * HACK: hasDisengage nicht automatisch aus prior Actions erkannt - siehe Header.
 *
 * @param profile Der sich bewegende Combatant
 * @param fromCell Startposition
 * @param toCell Zielposition
 * @param enemy Der potentielle OA-Angreifer
 * @param state SimulationState
 * @param hasDisengage Ob Disengage aktiv ist
 * @returns true wenn OA getriggert wird
 */
export function wouldTriggerOA(
  profile: CombatProfile,
  fromCell: GridPosition,
  toCell: GridPosition,
  enemy: CombatProfile,
  state: SimulationState,
  hasDisengage: boolean = false
): boolean {
  // Disengage verhindert alle OAs
  if (hasDisengage) {
    return false;
  }

  // Feind muss hostile sein
  if (!isHostile(profile.groupId, enemy.groupId, state.alliances)) {
    return false;
  }

  // Reach des Feindes ermitteln (Standard: 5ft = 1 Cell)
  // Melee-Actions mit Range > 5 haben erweiterte Reach
  const enemyReachCells = getEnemyReachCells(enemy);

  // Pruefe ob wir im Reach waren und ihn verlassen
  const distanceFromEnemy = getDistance(fromCell, enemy.position);
  const distanceToEnemy = getDistance(toCell, enemy.position);

  // OA nur wenn wir IN der Reach waren und sie VERLASSEN
  return distanceFromEnemy <= enemyReachCells && distanceToEnemy > enemyReachCells;
}

/**
 * Ermittelt die Reach eines Feindes in Cells.
 * Standard ist 5ft (1 Cell), Reach-Weapons haben 10ft (2 Cells).
 */
export function getEnemyReachCells(enemy: CombatProfile): number {
  let maxReachFeet = 5;  // Default

  for (const action of enemy.actions) {
    // Nur Melee-Actions beruecksichtigen
    if (action.actionType !== 'melee-weapon' && action.actionType !== 'melee-spell') {
      continue;
    }

    // Reach-Type Actions
    if (action.range.type === 'reach') {
      maxReachFeet = Math.max(maxReachFeet, action.range.normal);
    }
  }

  return feetToCell(maxReachFeet);
}

/**
 * Schaetzt den erwarteten OA-Schaden eines Feindes gegen einen Combatant.
 * Verwendet die beste Melee-Action des Feindes.
 *
 * @param enemy Der OA-Angreifer
 * @param target Das OA-Ziel
 * @returns Erwarteter Schaden (DPR x hitChance x (1 - deathProb))
 */
export function estimateOADamage(
  enemy: CombatProfile,
  target: CombatProfile
): number {
  // Feind tot? Kein OA moeglich
  if (enemy.deathProbability >= 1) {
    return 0;
  }

  // Finde beste Melee-Action des Feindes
  let bestDamage = 0;

  for (const action of enemy.actions) {
    // Nur Melee-Actions koennen OA sein
    if (action.actionType !== 'melee-weapon' && action.actionType !== 'melee-spell') {
      continue;
    }

    // Keine Multiattacks fuer OA (nur ein einzelner Attack)
    if (action.multiattack) {
      continue;
    }

    // Attack-basierte Actions
    if (action.attack && action.damage) {
      const hitChance = calculateHitChance(action.attack.bonus, target.ac);
      const damagePMF = diceExpressionToPMF(action.damage.dice);
      const baseDamage = getExpectedValue(damagePMF) + action.damage.modifier;
      const expectedDamage = hitChance * baseDamage * (1 - enemy.deathProbability);

      bestDamage = Math.max(bestDamage, expectedDamage);
    }
  }

  return bestDamage;
}

/**
 * Berechnet den erwarteten OA-Schaden fuer eine Bewegung.
 * Summiert OA-Schaden aller Feinde die getriggert werden.
 * HACK: budgetMap optional, OA nur geschaetzt nicht ausgefuehrt - siehe Header.
 *
 * @param profile Der sich bewegende Combatant
 * @param fromCell Startposition
 * @param toCell Zielposition
 * @param state SimulationState
 * @param hasDisengage Ob Disengage aktiv ist
 * @param budgetMap Optional: Map von participantId zu TurnBudget fuer Reaction-Tracking
 * @returns Erwarteter Gesamtschaden durch OAs
 */
export function calculateExpectedOADamage(
  profile: CombatProfile,
  fromCell: GridPosition,
  toCell: GridPosition,
  state: SimulationState,
  hasDisengage: boolean = false,
  budgetMap?: Map<string, TurnBudget>
): number {
  let totalOADamage = 0;

  for (const potentialAttacker of state.profiles) {
    // Nur Feinde
    if (!isHostile(profile.groupId, potentialAttacker.groupId, state.alliances)) {
      continue;
    }

    // Pruefe ob Reaction verfuegbar ist
    if (budgetMap) {
      const attackerBudget = budgetMap.get(potentialAttacker.participantId);
      if (attackerBudget && !attackerBudget.hasReaction) {
        debug('calculateExpectedOADamage: skipping - no reaction available', {
          attacker: potentialAttacker.participantId,
        });
        continue;
      }
    }

    // Pruefe ob OA getriggert wird
    if (wouldTriggerOA(profile, fromCell, toCell, potentialAttacker, state, hasDisengage)) {
      totalOADamage += estimateOADamage(potentialAttacker, profile);
    }
  }

  return totalOADamage;
}

/**
 * Fuehrt einen Opportunity Attack aus wenn lohnend.
 * Wird aufgerufen wenn ein Feind die Reichweite verlaesst.
 *
 * @param attacker Der OA-Angreifer
 * @param target Das OA-Ziel (der Fliehende)
 * @param state SimulationState
 * @param attackerBudget TurnBudget des Angreifers (wird mutiert bei Reaction-Verbrauch)
 * @returns Ergebnis: ob ausgefuehrt und Schaden
 */
export function executeOA(
  attacker: CombatProfile,
  target: CombatProfile,
  state: SimulationState,
  attackerBudget: TurnBudget
): { executed: boolean; damage: number; action?: Action } {
  // Keine Reaction verfuegbar
  if (!attackerBudget.hasReaction) {
    debug('executeOA: no reaction available', { attacker: attacker.participantId });
    return { executed: false, damage: 0 };
  }

  // Finde passende OA-Reaktion (Melee-Attack mit leaves-reach Trigger)
  const oaReactions = findMatchingReactions(attacker, 'leaves-reach');

  if (oaReactions.length === 0) {
    debug('executeOA: no matching OA reaction', { attacker: attacker.participantId });
    return { executed: false, damage: 0 };
  }

  // Waehle beste OA-Action (meist nur eine)
  const bestOA = oaReactions[0];

  // Erstelle Reaction-Context
  const context: ReactionContext = {
    event: 'leaves-reach',
    source: target,  // Der Fliehende ist der Source des Triggers
    target: attacker,
  };

  // Pruefe ob OA genutzt werden soll (Value vs Opportunity Cost)
  if (!shouldUseReaction(bestOA, context, attacker, state, attackerBudget)) {
    debug('executeOA: reaction not worth using', {
      attacker: attacker.participantId,
      target: target.participantId,
    });
    return { executed: false, damage: 0 };
  }

  // OA ausfuehren und Reaction verbrauchen
  consumeReaction(attackerBudget);

  // Schaden berechnen (via estimateOADamage da wir expected damage wollen)
  const damage = estimateOADamage(attacker, target);

  debug('executeOA: executed', {
    attacker: attacker.participantId,
    target: target.participantId,
    action: bestOA.name,
    damage,
  });

  return { executed: true, damage, action: bestOA };
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
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget
): TurnExplorationResult {
  // Resource Management: Recharge-Timer zu Beginn des Zuges dekrementieren
  tickRechargeTimers(profile.resources);

  // Phase 1: Maps einmalig berechnen
  const sourceMap = buildSourceMaps(profile, state);

  // Escape-Danger Map mit erweitertem Radius fuer Dash-Szenarien
  const maxMovement = budget.movementCells + budget.baseMovementCells; // Mit Dash
  const escapeDangerMap = buildEscapeDangerMap(profile, state, maxMovement);

  // Phase 2: Global-Best fuer Pruning-Schaetzung berechnen
  const globalBest = computeGlobalBestByType(profile, state, sourceMap, escapeDangerMap);

  // Phase 3: Root-Kandidat erstellen
  const rootCandidate = createRootCandidate(profile, budget);

  // Phase 4: Iteratives Expand + Prune
  const { terminalCandidates, totalPruned, totalEvaluated } = expandAndPrune(
    [rootCandidate],
    profile,
    state,
    sourceMap,
    escapeDangerMap,
    globalBest
  );

  // Phase 5: Besten terminalen Kandidaten waehlen
  if (terminalCandidates.length === 0) {
    debug('executeTurn: no terminal candidates, returning pass');
    return {
      actions: [{ type: 'pass' }],
      finalCell: profile.position,
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
      consumeActionResource(action.action, profile.resources);

      // Concentration-Tracking
      if (isConcentrationSpell(action.action)) {
        profile.concentratingOn = action.action;
        debug('executeTurn: concentration set', { spell: action.action.name });
      }
    }
  }

  debug('executeTurn: complete', {
    profileId: profile.participantId,
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
