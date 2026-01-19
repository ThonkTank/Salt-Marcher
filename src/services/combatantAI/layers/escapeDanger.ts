// Ziel: Batch-optimierte Danger-Berechnung fuer Escape-Analyse
// Siehe: docs/services/combatantAI/buildThreatMap.md
//
// Optimierung: Enemy-Daten werden einmal vorberechnet und wiederverwendet
// O(C x E) statt O(C x E x P)

import type {
  GridPosition,
  Combatant,
  CombatantSimulationState,
} from '@/types/combat';
import {
  positionToKey,
  feetToCell,
  getRelevantCells,
  getOffsetPattern,
  calculateMovementDecay,
} from '@/utils';
import { getDistance, isHostile, calculateEffectiveDamagePotential } from '../helpers/combatHelpers';
import { getMaxAttackRange } from '../core/actionScoring';
import { getEnemies } from '../helpers/actionSelection';
import { getGroupId, getPosition, getSpeed, getAC, getCombatEvents } from '../../combatTracking';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[layers/escapeDanger]', ...args);
  }
};

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Vorberechnete Enemy-Daten fuer Batch-Danger-Berechnung.
 * Alle Felder sind invariant pro Turn (aendern sich nicht pro Cell).
 */
interface CachedEnemyData {
  position: GridPosition;
  damage: number;         // calculateEffectiveDamagePotential
  maxRange: number;       // getMaxAttackRange
  movement: number;       // feetToCell(speed.walk)
  targetingProb: number;  // 1 / validTargetsForEnemy
}

// ============================================================================
// ESCAPE DANGER CALCULATION
// ============================================================================

/**
 * Berechnet Danger-Scores fuer alle Cells in einem Batch.
 * Optimierung: Enemy-Daten werden einmal vorberechnet und wiederverwendet.
 *
 * @param cells Alle Cells fuer die Danger berechnet werden soll
 * @param combatant Eigener Combatant (fuer AC)
 * @param state CombatantSimulationState
 * @returns Map von Cell-Key zu Danger-Score
 */
export function calculateDangerScoresBatch(
  cells: GridPosition[],
  combatant: Combatant,
  state: CombatantSimulationState
): Map<string, number> {
  const dangerMap = new Map<string, number>();

  // Phase 1: Enemy-Daten einmal vorberechnen (O(E))
  const enemies = getEnemies(combatant, state);
  const cachedEnemies: CachedEnemyData[] = enemies.map(enemy => {
    const damage = calculateEffectiveDamagePotential(getCombatEvents(enemy), getAC(combatant));
    const maxRange = getMaxAttackRange(enemy);
    const movement = feetToCell(getSpeed(enemy).walk ?? 30);

    // validTargetsForEnemy: Anzahl Targets in Reichweite (invariant)
    const validTargets = state.combatants.filter(c =>
      isHostile(getGroupId(enemy), getGroupId(c), state.alliances) &&
      getDistance(getPosition(enemy), getPosition(c)) <= maxRange
    ).length;
    const targetingProb = 1 / Math.max(1, validTargets);

    return {
      position: getPosition(enemy),
      damage,
      maxRange,
      movement,
      targetingProb,
    };
  });

  // Phase 2: Danger fuer alle Cells berechnen (O(C x E) mit O(1) pro Enemy)
  for (const cell of cells) {
    let totalDanger = 0;

    for (const enemy of cachedEnemies) {
      const distanceToEnemy = getDistance(cell, enemy.position);
      const dangerMultiplier = calculateMovementDecay(
        distanceToEnemy,
        enemy.maxRange,
        enemy.movement
      );
      totalDanger += enemy.damage * dangerMultiplier * enemy.targetingProb;
    }

    dangerMap.set(positionToKey(cell), totalDanger);
  }

  debug('calculateDangerScoresBatch:', {
    cellCount: cells.length,
    enemyCount: cachedEnemies.length,
  });

  return dangerMap;
}

/**
 * Berechnet Escape-Danger fuer alle relevanten Cells.
 * Optimiert: Danger-Scores werden einmal vorberechnet und gecached (O(M^2) statt O(M^4)).
 *
 * Fuer jede Cell: Was ist die minimale Danger, wenn wir optimal fluechten?
 * Ermoeglicht "Move in -> Attack -> Move out" Kiting-Pattern.
 *
 * @param combatant Eigener Combatant
 * @param state Simulation State
 * @param maxMovement Maximales Movement (fuer Escape-Radius)
 * @returns Map von Cell-Key zu Escape-Danger
 */
export function buildEscapeDangerMap(
  combatant: Combatant,
  state: CombatantSimulationState,
  maxMovement: number
): Map<string, number> {
  const escapeDangerMap = new Map<string, number>();
  const position = getPosition(combatant);

  // Alle Cells im erweiterten Bewegungsbereich (Movement + max Escape)
  const extendedRange = maxMovement * 2;  // Move + Escape
  const allCells = getRelevantCells(position, extendedRange);

  // Phase 1: Danger-Scores via Batch-Funktion (O(C x E) statt O(C x E x P))
  const dangerCache = calculateDangerScoresBatch(allCells, combatant, state);

  // Phase 2: Escape-Danger aus Cache berechnen
  // Radius-Filter: Nur erreichbare Cells evaluieren (Bug-Fix fuer korrekte Pruning-Schaetzung)
  // computeGlobalBestByType() soll nur erreichbare Cells fuer minDanger betrachten
  const reachableCells: GridPosition[] = [];
  const distanceFromStart = new Map<string, number>();
  for (const cell of allCells) {
    const distance = getDistance(position, cell);
    const key = positionToKey(cell);
    distanceFromStart.set(key, distance);
    if (distance <= maxMovement) {
      reachableCells.push(cell);
    }
  }

  for (const cell of reachableCells) {
    const cellKey = positionToKey(cell);
    const baseDanger = dangerCache.get(cellKey) ?? 0;

    // Wie weit koennen wir von hier fluechten? (aus Cache lesen)
    const distance = distanceFromStart.get(cellKey) ?? 0;
    const remainingMovement = Math.max(0, maxMovement - distance);

    if (remainingMovement <= 0) {
      // Kein Escape moeglich - volle Danger
      escapeDangerMap.set(cellKey, baseDanger);
      continue;
    }

    // Offset-Pattern statt getRelevantCells() - gecachtes Pattern wiederverwenden
    const offsets = getOffsetPattern(remainingMovement);
    let minDanger = baseDanger;

    for (const offset of offsets) {
      const escapeKey = `${cell.x + offset.dx},${cell.y + offset.dy},${cell.z}`;
      const danger = dangerCache.get(escapeKey);
      if (danger !== undefined && danger < minDanger) {
        minDanger = danger;
      }
    }

    escapeDangerMap.set(cellKey, minDanger);
  }

  debug('buildEscapeDangerMap:', {
    combatantId: combatant.id,
    maxMovement,
    dangerCacheSize: dangerCache.size,
    reachableCells: reachableCells.length,
    mapSize: escapeDangerMap.size,
  });

  return escapeDangerMap;
}
