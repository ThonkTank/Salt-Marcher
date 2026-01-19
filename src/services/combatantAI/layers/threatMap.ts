// Ziel: ThreatMap-Queries fuer Position-Bewertung
// Siehe: docs/services/combatantAI/buildThreatMap.md
//
// Kombiniert:
// - Threat: getThreatAt() + OA-Kosten fuer den Pfad
// - Support: getSupportAt() fuer Ally-Healing

import type {
  GridPosition,
  Combatant,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  CombatStateWithLayers,
  FinalResolvedData,
  ActionWithLayer,
  ThreatMapEntry,
  LayerFilter,
  TurnBudget,
} from '@/types/combat';
import type { CombatEvent } from '@/types/entities/combatEvent';
import type { ActionTimingType } from '@/constants/action';
import { positionToKey, keyToPosition, getExpectedValue, diceExpressionToPMF, addConstant } from '@/utils';
import { hasLineOfSight, calculateCover, type CoverLevel } from '@/utils/squareSpace/gridLineOfSight';
import { getFullResolution } from './effectApplication';
import { calculateExpectedReactionCost } from './reactionLayers';
import {
  isHostile,
  isAllied,
  getDistance,
  getTurnsUntilNextTurn,
  getMovementBands,
  applyDistanceDecay,
  DECAY_CONSTANTS,
} from '../helpers/combatHelpers';
import { getGroupId, getPosition, getHP, getMaxHP } from '../../combatTracking';
import { calculatePairScore } from '../core/actionScoring';
import { getAvailableCombatEventsWithLayers } from '../core/actionEnumeration';
import { getEnemies, getAllies } from '../helpers/actionSelection';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[layers/threatMap]', ...args);
  }
};

// ============================================================================
// TERRAIN COVER HELPERS
// ============================================================================

/** Cover-Multiplikator für Damage-Reduktion (heuristisch). */
function getCoverDamageMultiplier(cover: CoverLevel): number {
  switch (cover) {
    case 'full': return 0;           // Kein Damage möglich
    case 'three-quarters': return 0.5; // ~50% Reduktion
    case 'half': return 0.75;          // ~25% Reduktion
    default: return 1;
  }
}

// ============================================================================
// TIMING GROUP HELPERS
// ============================================================================

/**
 * Gruppiert Actions nach timing.type für Aggregation.
 * @param actions Array von Actions mit Layer-Daten
 * @returns Map von TimingType zu Actions
 */
function groupActionsByTiming(
  actions: ActionWithLayer[]
): Map<ActionTimingType, ActionWithLayer[]> {
  const groups = new Map<ActionTimingType, ActionWithLayer[]>();

  for (const action of actions) {
    const timing = action.timing?.type ?? 'action';
    const existing = groups.get(timing) ?? [];
    existing.push(action);
    groups.set(timing, existing);
  }

  return groups;
}

/**
 * Berechnet Threat eines einzelnen Gegners für eine Cell.
 * Gruppiert Actions nach Timing, mittelt pro Gruppe, wendet Turn-Decay an.
 * Berücksichtigt Cover und Line of Sight wenn terrainMap vorhanden.
 *
 * @param cell Ziel-Cell
 * @param viewer Der Combatant der die Bedrohung bewertet
 * @param enemy Der feindliche Combatant
 * @param turnsUntil Runden bis zum nächsten Turn des Feindes
 * @param state Combat State mit Layer-Daten
 * @returns Threat-Score für diesen Gegner
 */
function getThreatFromCombatant(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  enemy: CombatantWithLayers,
  turnsUntil: number,
  state: CombatantSimulationStateWithLayers
): number {
  const cellKey = positionToKey(cell);
  const enemyPos = getPosition(enemy);
  const actionsByTiming = groupActionsByTiming(enemy._layeredActions);
  let totalThreat = 0;

  // Cover-Berechnung (wenn terrainMap vorhanden)
  const coverLevel = state.terrainMap
    ? calculateCover(enemyPos, cell, (pos) => {
        const key = positionToKey(pos);
        return state.terrainMap?.get(key)?.blocksLoS ?? false;
      })
    : 'none';

  const coverMultiplier = getCoverDamageMultiplier(coverLevel);
  if (coverMultiplier === 0) return 0;  // Full Cover = 0 Threat

  for (const [timing, actions] of actionsByTiming) {
    // Sammle Scores für alle Actions dieser Timing-Gruppe die die Cell erreichen
    const scores: number[] = [];

    for (const action of actions) {
      // Skip non-damage actions
      if (!action.damage) continue;

      // Check if this action can reach the cell
      const rangeData = action._layer.grid.get(cellKey);
      if (!rangeData?.inRange) continue;

      // LoS-Check für diese CombatEvent (wenn terrainMap vorhanden)
      if (state.terrainMap) {
        const maxRange = action._layer.rangeCells;
        if (!hasLineOfSight(enemyPos, cell, maxRange, state.terrainMap)) {
          continue;  // Keine LoS = kein Threat
        }
      }

      // Get or resolve target data against viewer
      const resolved = getFullResolution(action, enemy, viewer, state);
      const expectedDamage = getExpectedValue(resolved.effectiveDamagePMF);
      scores.push(expectedDamage * coverMultiplier);  // Cover-Reduktion anwenden
    }

    if (scores.length === 0) continue;

    // Durchschnitt der Gruppe
    const groupAvg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Reactions: voller Wert, Andere: Turn-Decay
    if (timing === 'reaction') {
      totalThreat += groupAvg;
    } else {
      totalThreat += groupAvg * Math.pow(DECAY_CONSTANTS.TURN_DECAY, turnsUntil);
    }
  }

  return totalThreat;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Typ-Guard: Prüft ob State Turn-Order Informationen hat.
 */
function hasTurnOrder(
  state: CombatantSimulationStateWithLayers
): state is CombatStateWithLayers {
  return 'turnOrder' in state && 'currentTurnIndex' in state;
}

/**
 * Berechnet Threat-Score fuer eine Cell.
 * Aggregiert pro Gegner mit Timing-Gruppierung und Turn-Decay.
 *
 * Timing-Gruppierung:
 * - Actions werden nach timing.type gruppiert (action, bonus, reaction, free)
 * - Pro Gruppe: Summe der Scores / Anzahl der Actions
 *
 * Turn-Decay:
 * - Reactions: voller Wert
 * - Andere Actions: value × 0.9^turnsUntilNextTurn
 *
 * @param cell Ziel-Cell
 * @param viewer Der Combatant der die Bedrohung bewertet
 * @param state Combat State mit Layer-Daten (optionale Turn-Order)
 * @param filter Optional: Filter für CombatEvent-Typen
 * @returns Threat-Score (höher = gefährlicher)
 */
export function getThreatAt(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  filter?: LayerFilter
): number {
  let totalThreat = 0;
  const viewerGroupId = getGroupId(viewer);

  for (const enemy of state.combatants) {
    // Skip Allies
    const combatantGroupId = getGroupId(enemy);
    if (isAllied(viewerGroupId, combatantGroupId, state.alliances)) continue;

    // Berechne turnsUntil wenn Turn-Order verfügbar
    const turnsUntil = hasTurnOrder(state)
      ? getTurnsUntilNextTurn(enemy, viewer, state)
      : 0;

    // Filter Actions wenn angegeben
    const filteredActions = filter
      ? enemy._layeredActions.filter(filter)
      : enemy._layeredActions;

    // Erstelle temporären Enemy mit gefilterten Actions für getThreatFromCombatant
    const filteredEnemy: CombatantWithLayers = filter
      ? { ...enemy, _layeredActions: filteredActions }
      : enemy;

    totalThreat += getThreatFromCombatant(cell, viewer, filteredEnemy, turnsUntil, state);
  }

  debug('getThreatAt:', {
    cell,
    viewerId: viewer.id,
    totalThreat,
  });

  return totalThreat;
}

/**
 * Findet die gefaehrlichste CombatEvent fuer eine Cell.
 * Fuer Debugging und taktische Analyse.
 */
export function getDominantThreat(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): { action: ActionWithLayer; attacker: CombatantWithLayers; resolved: FinalResolvedData } | null {
  let dominantThreat: { action: ActionWithLayer; attacker: CombatantWithLayers; resolved: FinalResolvedData } | null = null;
  let maxDamage = 0;
  const cellKey = positionToKey(cell);
  const viewerGroupId = getGroupId(viewer);

  for (const combatant of state.combatants) {
    // Skip Allies
    const combatantGroupId = getGroupId(combatant);
    if (isAllied(viewerGroupId, combatantGroupId, state.alliances)) continue;

    for (const action of combatant._layeredActions) {
      // Skip non-damage actions
      if (!action.damage) continue;

      // Check if this action can reach the cell
      const rangeData = action._layer.grid.get(cellKey);
      if (!rangeData?.inRange) continue;

      // Get or resolve target data against viewer
      const resolved = getFullResolution(action, combatant, viewer, state);
      const expectedDamage = getExpectedValue(resolved.effectiveDamagePMF);

      if (expectedDamage > maxDamage) {
        maxDamage = expectedDamage;
        dominantThreat = { action, attacker: combatant, resolved };
      }
    }
  }

  debug('getDominantThreat:', {
    cell,
    viewerId: viewer.id,
    dominant: dominantThreat ? {
      attacker: dominantThreat.attacker.id,
      action: dominantThreat.action.name,
      damage: maxDamage,
    } : null,
  });

  return dominantThreat;
}

/**
 * Prueft welche Actions von einer Cell aus moeglich sind.
 * Inkl. Target-Resolution fuer alle erreichbaren Ziele.
 */
export function getAvailableActionsAt(
  cell: GridPosition,
  attacker: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): Array<{ action: ActionWithLayer; targets: FinalResolvedData[] }> {
  const result: Array<{ action: ActionWithLayer; targets: FinalResolvedData[] }> = [];
  const attackerGroupId = getGroupId(attacker);

  for (const action of attacker._layeredActions) {
    // Skip non-damage actions for now
    if (!action.damage) continue;

    const targets: FinalResolvedData[] = [];

    // Find all enemies in range from this cell
    for (const combatant of state.combatants) {
      // Skip Allies
      const combatantGroupId = getGroupId(combatant);
      if (isAllied(attackerGroupId, combatantGroupId, state.alliances)) continue;

      // Check distance from the hypothetical cell to target
      const targetPosition = getPosition(combatant);
      const distance = getDistance(cell, targetPosition);
      if (distance > action._layer.rangeCells) continue;

      // Create a temporary combatant with the new position for modifier evaluation
      const tempAttacker: CombatantWithLayers = {
        ...attacker,
        combatState: {
          ...attacker.combatState,
          position: cell,
        },
      };

      // Resolve against target
      const resolved = getFullResolution(action, tempAttacker, combatant, state);
      targets.push(resolved);
    }

    if (targets.length > 0) {
      result.push({ action, targets });
    }
  }

  debug('getAvailableActionsAt:', {
    cell,
    attackerId: attacker.id,
    actionCount: result.length,
    totalTargets: result.reduce((sum, r) => sum + r.targets.length, 0),
  });

  return result;
}

// ============================================================================
// SUPPORT HELPERS
// ============================================================================

/**
 * Berechnet Support eines einzelnen Allies für eine Cell.
 * Gruppiert Actions nach Timing, mittelt pro Gruppe, wendet Turn-Decay an.
 *
 * @param cell Ziel-Cell
 * @param viewer Der Combatant der den Support bewertet
 * @param ally Der verbündete Combatant
 * @param turnsUntil Runden bis zum nächsten Turn des Allies
 * @param hpRatio HP-Verhältnis des Viewers (0-1)
 * @param state Combat State mit Layer-Daten
 * @returns Support-Score für diesen Ally
 */
function getSupportFromCombatant(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  ally: CombatantWithLayers,
  turnsUntil: number,
  hpRatio: number,
  state: CombatantSimulationStateWithLayers
): number {
  const cellKey = positionToKey(cell);
  const actionsByTiming = groupActionsByTiming(ally._layeredActions);
  let totalSupport = 0;

  // Gewichtung nach HP-Bedarf (1 bei 0 HP, 0 bei voller HP)
  const healingNeed = 1 - hpRatio;

  for (const [timing, actions] of actionsByTiming) {
    const scores: number[] = [];

    for (const action of actions) {
      // Healing-Actions
      if (action.healing) {
        const rangeData = action._layer.grid.get(cellKey);
        if (!rangeData?.inRange) continue;

        const healDice = diceExpressionToPMF(action.healing.dice);
        const expectedHeal = getExpectedValue(addConstant(healDice, action.healing.modifier ?? 0));
        scores.push(expectedHeal * healingNeed);
      }

      // TODO: Buff-Auren (effects mit targetAlly)
    }

    if (scores.length === 0) continue;

    // Durchschnitt der Gruppe
    const groupAvg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Reactions: voller Wert, Andere: Turn-Decay
    if (timing === 'reaction') {
      totalSupport += groupAvg;
    } else {
      totalSupport += groupAvg * Math.pow(DECAY_CONSTANTS.TURN_DECAY, turnsUntil);
    }
  }

  return totalSupport;
}

// ============================================================================
// THREAT MAP API
// ============================================================================

/**
 * Berechnet Support-Score fuer eine Cell (Ally-Heilung/Buff-Potential).
 * Aggregiert pro Ally mit Timing-Gruppierung und Turn-Decay.
 *
 * Timing-Gruppierung:
 * - Actions werden nach timing.type gruppiert (action, bonus, reaction, free)
 * - Pro Gruppe: Summe der Scores / Anzahl der Actions
 *
 * Turn-Decay:
 * - Reactions: voller Wert
 * - Andere Actions: value × 0.9^turnsUntilNextTurn
 *
 * @param cell Ziel-Cell
 * @param viewer Der Combatant fuer den Support berechnet wird
 * @param state Combat State mit Layer-Daten (optionale Turn-Order)
 * @returns Support-Score (positiv = gut)
 */
export function getSupportAt(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number {
  let totalSupport = 0;
  const viewerGroupId = getGroupId(viewer);
  const viewerHP = getExpectedValue(getHP(viewer));
  const viewerMaxHP = getMaxHP(viewer);
  const hpRatio = viewerHP / Math.max(1, viewerMaxHP);

  for (const ally of state.combatants) {
    // Nur Allies
    const allyGroupId = getGroupId(ally);
    if (!isAllied(viewerGroupId, allyGroupId, state.alliances)) continue;
    if (ally.id === viewer.id) continue; // Skip self

    // Berechne turnsUntil wenn Turn-Order verfügbar
    const turnsUntil = hasTurnOrder(state)
      ? getTurnsUntilNextTurn(ally, viewer, state)
      : 0;

    totalSupport += getSupportFromCombatant(cell, viewer, ally, turnsUntil, hpRatio, state);
  }

  return totalSupport;
}

/**
 * Berechnet ThreatMap fuer alle erreichbaren Cells.
 * Kombiniert:
 * - Threat: getThreatAt() + OA-Kosten fuer den Pfad
 * - Support: getSupportAt() fuer Ally-Healing
 *
 * Wird einmal pro Turn am Start berechnet.
 *
 * @param combatant Der aktive Combatant
 * @param state Combat State mit Layer-Daten
 * @param reachableCells Alle erreichbaren Positionen
 * @param currentPos Aktuelle Position (fuer Pfad-Kosten)
 * @returns Map von Cell-Key zu ThreatMapEntry
 */
export function buildThreatMap(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  reachableCells: GridPosition[],
  currentPos: GridPosition
): Map<string, ThreatMapEntry> {
  const threatMap = new Map<string, ThreatMapEntry>();

  for (const cell of reachableCells) {
    const cellKey = positionToKey(cell);

    // 1. Base Threat (Gegner-Schaden an dieser Position)
    const baseThreat = getThreatAt(cell, combatant, state);

    // 2. Pfad-Kosten (OA-Risiko von currentPos zu dieser Cell)
    const isCurrentPos = cell.x === currentPos.x && cell.y === currentPos.y && cell.z === currentPos.z;
    const pathCost = isCurrentPos
      ? 0
      : calculateExpectedReactionCost(combatant, currentPos, cell, state);

    // 3. Gesamte Threat (negativ)
    const threat = -(baseThreat + pathCost);

    // 4. Support (positiv)
    const support = getSupportAt(cell, combatant, state);

    // 5. Net Score
    const net = threat + support;

    threatMap.set(cellKey, { threat, support, net });
  }

  debug('buildThreatMap:', {
    combatantId: combatant.id,
    cellCount: reachableCells.length,
    mapSize: threatMap.size,
  });

  return threatMap;
}

// ============================================================================
// OPPORTUNITY MAP API
// ============================================================================

/**
 * Prüft ob eine CombatEvent mit dem aktuellen Budget ausgeführt werden kann.
 */
function canAffordAction(action: ActionWithLayer, budget: TurnBudget): boolean {
  switch (action.timing?.type ?? 'action') {
    case 'action':
      return budget.hasAction;
    case 'bonus':
      return budget.hasBonusAction;
    case 'reaction':
      return budget.hasReaction;
    case 'free':
    case 'passive':
      return true;
    default:
      return false;
  }
}

/**
 * Berechnet Opportunity-Score für eine Cell.
 * Bewertet alle möglichen Aktionen des Combatants von dieser Position aus.
 *
 * Aggregation:
 * - Gruppiere Actions nach timing.type (action, bonus, reaction, free)
 * - Pro Gruppe: Summe der Scores / Anzahl der Actions
 * - Gesamtscore = Summe aller Gruppen-Durchschnitte
 *
 * @param cell Hypothetische Position
 * @param combatant Der aktive Combatant
 * @param budget Aktuelles Turn-Budget
 * @param state Combat State mit Layer-Daten
 * @returns Opportunity-Score (höher = besser)
 */
export function getOpportunityAt(
  cell: GridPosition,
  combatant: CombatantWithLayers,
  budget: TurnBudget,
  state: CombatantSimulationStateWithLayers
): number {
  // Alle verfügbaren Actions (bereits mit Layers)
  const allActions = combatant._layeredActions;

  // Filtere auf ausführbare Actions basierend auf Budget
  const affordableActions = allActions.filter(a => canAffordAction(a, budget));

  // Gruppiere nach Timing
  const actionsByTiming = groupActionsByTiming(affordableActions);

  let totalOpportunity = 0;

  for (const [timing, actions] of actionsByTiming) {
    const scores: number[] = [];

    for (const action of actions) {
      // Finde alle möglichen Targets von dieser Cell aus
      const cellKey = positionToKey(cell);

      // Für Damage-Actions: Enemies targeten
      if (action.damage) {
        const enemies = getEnemies(combatant, state);

        for (const enemy of enemies) {
          // Prüfe ob CombatEvent das Target von dieser Cell aus erreichen kann
          const targetPosition = getPosition(enemy);
          const distance = getDistance(cell, targetPosition);

          // Range-Check über Layer-Daten
          const rangeData = action._layer.grid.get(positionToKey(targetPosition));
          if (!rangeData?.inRange && distance > action._layer.rangeCells) continue;

          // Berechne Score mit calculatePairScore
          // Erstelle temporären Combatant mit der hypothetischen Position
          const virtualCombatant: Combatant = {
            ...combatant,
            combatState: {
              ...combatant.combatState,
              position: cell,
            },
          };

          const pairScore = calculatePairScore(virtualCombatant, action, enemy, distance, state);
          if (pairScore && pairScore.score > 0) {
            scores.push(pairScore.score);
          }
        }
      }

      // Für Healing-Actions: Allies targeten
      if (action.healing) {
        const allies = getAllies(combatant, state);

        for (const ally of allies) {
          if (ally.id === combatant.id) continue; // Skip self

          const targetPosition = getPosition(ally);
          const distance = getDistance(cell, targetPosition);

          if (distance > action._layer.rangeCells) continue;

          const virtualCombatant: Combatant = {
            ...combatant,
            combatState: {
              ...combatant.combatState,
              position: cell,
            },
          };

          const pairScore = calculatePairScore(virtualCombatant, action, ally, distance, state);
          if (pairScore && pairScore.score > 0) {
            scores.push(pairScore.score);
          }
        }
      }
    }

    if (scores.length === 0) continue;

    // Durchschnitt der Gruppe
    const groupAvg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    totalOpportunity += groupAvg;
  }

  return totalOpportunity;
}

/**
 * Baut OpportunityMap für alle erreichbaren Cells.
 * Bewertet das Aktions-Potential des Combatants von jeder Position aus.
 *
 * @param combatant Der aktive Combatant
 * @param state Combat State mit Layer-Daten
 * @param reachableCells Alle erreichbaren Positionen
 * @param budget Aktuelles Turn-Budget
 * @returns Map von Cell-Key zu Opportunity-Score
 */
export function buildOpportunityMap(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  reachableCells: GridPosition[],
  budget: TurnBudget
): Map<string, number> {
  const opportunityMap = new Map<string, number>();

  for (const cell of reachableCells) {
    const cellKey = positionToKey(cell);
    const opportunity = getOpportunityAt(cell, combatant, budget, state);
    opportunityMap.set(cellKey, opportunity);
  }

  debug('buildOpportunityMap:', {
    combatantId: combatant.id,
    cellCount: reachableCells.length,
    mapSize: opportunityMap.size,
  });

  return opportunityMap;
}

// ============================================================================
// DISTANCE DECAY PROJECTION
// ============================================================================

/**
 * Projiziert Map-Werte auf umliegende Zellen mit Distance Decay.
 * Kombiniert Per-Step Decay (pro Cell) und Movement-Band Decay (bei Band-Grenzen).
 *
 * Für jede Ziel-Cell:
 * - Berechne projizierten Wert von jeder Quell-Cell
 * - Nimm den höchsten Wert (max von Original und allen projizierten)
 *
 * @param sourceMap Ursprüngliche Map mit Werten
 * @param combatant Der Combatant (für Movement-Band Berechnung)
 * @param allCells Alle Zellen die einen projizierten Wert erhalten sollen
 * @returns Neue Map mit projizierten Werten
 */
export function projectMapWithDecay(
  sourceMap: Map<string, number>,
  combatant: CombatantWithLayers,
  allCells: GridPosition[]
): Map<string, number> {
  const currentPos = getPosition(combatant);
  const bands = getMovementBands(currentPos, combatant, DECAY_CONSTANTS.MAX_BANDS);
  const projected = new Map<string, number>();

  for (const targetCell of allCells) {
    const targetKey = positionToKey(targetCell);

    // Starte mit dem Original-Wert (falls vorhanden)
    let maxValue = sourceMap.get(targetKey) ?? 0;

    // Finde den höchsten projizierten Wert von allen Quell-Cells
    for (const [sourceKey, sourceValue] of sourceMap) {
      if (sourceValue <= 0) continue; // Negative/Zero Werte nicht projizieren

      const sourceCell = keyToPosition(sourceKey);
      const decayedValue = applyDistanceDecay(sourceValue, sourceCell, targetCell, bands);

      maxValue = Math.max(maxValue, decayedValue);
    }

    projected.set(targetKey, maxValue);
  }

  debug('projectMapWithDecay:', {
    combatantId: combatant.id,
    sourceCells: sourceMap.size,
    projectedCells: projected.size,
  });

  return projected;
}

/**
 * Projiziert ThreatMap-Werte auf umliegende Zellen.
 * Nur der `net` Wert wird projiziert und in eine einfache Map konvertiert.
 *
 * @param threatMap Original ThreatMap
 * @param combatant Der Combatant
 * @param allCells Alle Zellen für Projektion
 * @returns Map von Cell-Key zu projiziertem Net-Score
 */
export function projectThreatMapWithDecay(
  threatMap: Map<string, ThreatMapEntry>,
  combatant: CombatantWithLayers,
  allCells: GridPosition[]
): Map<string, number> {
  // Extrahiere net-Werte für Projektion
  // Invertiere das Vorzeichen: ThreatMap.net ist bereits negativ für gefährlich
  // Für Projektion wollen wir positive Werte die abnehmen
  const absoluteThreatMap = new Map<string, number>();
  for (const [key, entry] of threatMap) {
    // Threat ist negativ, wir projizieren den absoluten Wert der Bedrohung
    absoluteThreatMap.set(key, Math.abs(entry.threat));
  }

  const projectedThreat = projectMapWithDecay(absoluteThreatMap, combatant, allCells);

  // Konvertiere zurück zu negativen Threat-Werten
  const result = new Map<string, number>();
  for (const [key, value] of projectedThreat) {
    result.set(key, -value);
  }

  return result;
}
