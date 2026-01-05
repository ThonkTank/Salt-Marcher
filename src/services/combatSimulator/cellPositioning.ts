// Ziel: Cell-basiertes Positioning-System fuer Combat-AI
// Siehe: docs/services/combatSimulator/actionScoring.md#score-komponenten
//
// Ersetzt das Vektor-basierte Attraction/Repulsion-System.
// Jeder Cell wird explizit bewertet statt Richtungsvektoren zu summieren.
// Alle Scores sind auf DPR-Skala normalisiert fuer faire Vergleiche.

import type { Action } from '@/types/entities';
import type {
  GridPosition,
  CombatProfile,
  SimulationState,
  ActionTargetScore,
  CellScore,
  CellEvaluation,
} from '@/types/combat';
import {
  feetToCell,
  positionToKey,
  getExpectedValue,
} from '@/utils';
import {
  getActionMaxRangeCells,
  getDistance,
  isAllied,
} from './combatHelpers';
import {
  getCandidates,
  calculatePairScore,
  estimateEffectiveDamagePotential,
  getMaxAttackRange,
} from './actionScoring';
import { getRelativeAttackCells } from './baseValuesCache';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[cellPositioning]', ...args);
  }
};

// ============================================================================
// CELL-BASED POSITIONING SYSTEM
// ============================================================================

/**
 * Gibt alle relevanten Cells innerhalb der Bewegungsreichweite zurueck.
 * Performance-Optimierung: Limitiert auf erreichbare Cells.
 */
export function getRelevantCells(
  center: GridPosition,
  movementCells: number
): GridPosition[] {
  const range = movementCells;
  const cells: GridPosition[] = [];

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      // TODO: 3D Movement fuer fliegende Kreaturen - siehe Header
      cells.push({ x: center.x + dx, y: center.y + dy, z: center.z });
    }
  }

  debug('getRelevantCells:', { center, movementCells, range, cellCount: cells.length });
  return cells;
}

/**
 * Berechnet Movement-basiertes Decay fuer Attraction und Danger Scores.
 * Kombiniert diskrete Baender (50% pro Runde) mit leichtem Intra-Band Decay.
 *
 * @param distanceToTarget - Cells bis zum Ziel/Feind
 * @param targetReach - Reichweite zum Ziel (Attack Range fuer Attraction, Range + Movement fuer Danger)
 * @param movement - Movement pro Runde
 * @returns Decay-Multiplikator (1.0 = voller Wert, 0.5 = halber Wert, etc.)
 */
export function calculateMovementDecay(
  distanceToTarget: number,
  targetReach: number,
  movement: number
): number {
  if (distanceToTarget <= targetReach) {
    // Band 0: Jetzt erreichbar - voller Wert
    return 1.0;
  }

  const excessDistance = distanceToTarget - targetReach;

  // Band-Nummer: 1 = naechste Runde, 2 = uebernaechste, etc.
  const bandNumber = Math.ceil(excessDistance / Math.max(1, movement));

  // Haupt-Multiplikator: 50% pro Runde
  const bandMultiplier = Math.pow(0.5, bandNumber);

  // Intra-Band Position: 0.0 (Band-Start) bis 1.0 (Band-Ende)
  const positionInBand = movement > 0
    ? (excessDistance % movement) / movement
    : 0;

  // Leichtes Decay innerhalb des Bands: 100% -> 90% ueber das Band
  // Incentiviert Bewegung in Richtung Band-Grenze
  const intraBandDecay = 1.0 - (positionInBand * 0.1);

  return bandMultiplier * intraBandDecay;
}

// ============================================================================
// SOURCE MAP & LAZY EVALUATION
// ============================================================================

/**
 * Source Map Entry: Geometrie-basierte Attack-Moeglichkeit ohne Score-Berechnung.
 * Score wird erst bei Query berechnet (Lazy Evaluation).
 */
export interface SourceMapEntry {
  action: Action;
  target: CombatProfile;
  distanceToTarget: number;  // Distanz von dieser Cell zum Target
}

/**
 * Phase 1: Baut Source-Map mit ALLEN Attack-Moeglichkeiten (nur Geometrie).
 * Keine Score-Berechnung oder Modifier-Evaluation - das ist guenstig!
 *
 * Performance: ~12.800 Cells bei Long Range 320ft, aber nur O(1) pro Cell.
 */
export function buildSourceMaps(
  profile: CombatProfile,
  state: SimulationState
): Map<string, SourceMapEntry[]> {
  const sourceMap = new Map<string, SourceMapEntry[]>();
  const enemies = getCandidates(profile, state, 'damage');

  // Besetzte Cells (alle Combatants ausser sich selbst)
  const occupiedCells = new Set<string>(
    state.profiles
      .filter(p => p.participantId !== profile.participantId)
      .map(p => positionToKey(p.position))
  );

  // Fuer jede Action: Berechne Range und hole gecachtes Pattern
  const actionPatterns = new Map<string, { range: number; relativeCells: GridPosition[] }>();
  for (const action of profile.actions) {
    if (!action.damage && !action.healing) continue;
    const range = getActionMaxRangeCells(action, profile.actions);
    actionPatterns.set(action.name ?? action.id, {
      range,
      relativeCells: getRelativeAttackCells(range),
    });
  }

  // Fuer jeden Enemy: Markiere alle Cells in Range (ohne Score-Berechnung!)
  for (const enemy of enemies) {
    for (const action of profile.actions) {
      if (!action.damage && !action.healing) continue;

      const pattern = actionPatterns.get(action.name ?? action.id);
      if (!pattern) continue;

      for (const relativeCell of pattern.relativeCells) {
        const globalCell: GridPosition = {
          x: enemy.position.x + relativeCell.x,
          y: enemy.position.y + relativeCell.y,
          z: enemy.position.z + relativeCell.z,
        };
        const key = positionToKey(globalCell);

        // Ueberspringe besetzte Cells
        if (occupiedCells.has(key)) continue;

        // Distanz von dieser Cell zum Target (fuer spaetere Modifier-Evaluation)
        const distanceToTarget = getDistance(globalCell, enemy.position);

        // Alle Entries fuer diese Cell sammeln (spaeter wird bester ausgewaehlt)
        const entries = sourceMap.get(key) ?? [];
        entries.push({ action, target: enemy, distanceToTarget });
        sourceMap.set(key, entries);
      }
    }
  }

  debug('buildSourceMaps:', {
    profileId: profile.participantId,
    enemyCount: enemies.length,
    actionCount: actionPatterns.size,
    mapSize: sourceMap.size,
  });

  return sourceMap;
}

/**
 * Phase 2: Berechnet Score fuer eine spezifische Cell aus der Source-Map.
 * Evaluiert Modifiers nur fuer diese Cell - das ist teuer, aber nur ~100 Cells!
 */
export function calculateScoreFromSourceMap(
  cell: GridPosition,
  sourceMap: Map<string, SourceMapEntry[]>,
  profile: CombatProfile,
  state: SimulationState
): { score: number; bestAction: ActionTargetScore | null } {
  const key = positionToKey(cell);
  const entries = sourceMap.get(key);

  if (!entries || entries.length === 0) {
    return { score: 0, bestAction: null };
  }

  // Evaluiere alle Entries und waehle den besten Score
  let bestScore = 0;
  let bestAction: ActionTargetScore | null = null;

  const virtualProfile = { ...profile, position: cell };

  for (const entry of entries) {
    const pairScore = calculatePairScore(
      virtualProfile,
      entry.action,
      entry.target,
      entry.distanceToTarget,
      state
    );

    if (pairScore && pairScore.score > bestScore) {
      bestScore = pairScore.score;
      bestAction = pairScore;
    }
  }

  return { score: bestScore, bestAction };
}

/**
 * Berechnet Attraction-Score aus Source-Map mit Decay fuer Cells ausserhalb Attack-Range.
 * Kombiniert Phase 2 Score-Berechnung mit Movement-Decay.
 *
 * @param cell - Die zu bewertende Position
 * @param sourceMap - Source-Map mit Attack-Moeglichkeiten (nur Geometrie)
 * @param profile - Profil fuer Modifier-Evaluation
 * @param state - SimulationState fuer Modifier-Evaluation
 * @param profileMovement - Bewegungsreichweite in Cells (fuer Decay)
 * @param options - Optionen fuer Decay-Berechnung
 * @param options.minBand - Minimum Band fuer Decay (fuer Dash: 1 = Aktionen erst naechste Runde)
 */
export function calculateAttractionFromSourceMap(
  cell: GridPosition,
  sourceMap: Map<string, SourceMapEntry[]>,
  profile: CombatProfile,
  state: SimulationState,
  profileMovement: number = 6,
  options?: { minBand?: number }
): { score: number; bestAction: ActionTargetScore | null } {
  const key = positionToKey(cell);
  const entries = sourceMap.get(key);

  // Fall 1: Direkt auf einer Attack-Cell - voller Score mit Modifiers
  // Bei minBand > 0: Decay anwenden (z.B. Dash = naechste Runde erst angreifen)
  if (entries && entries.length > 0) {
    const { score: rawScore, bestAction } = calculateScoreFromSourceMap(cell, sourceMap, profile, state);

    // minBand Decay: Band 0 Aktionen zu minBand verschieben
    const minBandDecay = options?.minBand ? Math.pow(0.5, options.minBand) : 1.0;
    const score = rawScore * minBandDecay;

    debug('calculateAttractionFromSourceMap:', {
      cell,
      onAttackCell: true,
      rawScore,
      minBand: options?.minBand,
      minBandDecay,
      score,
      action: bestAction?.action.name,
    });

    return { score, bestAction: options?.minBand ? null : bestAction };
  }

  // Fall 2: Nicht auf Attack-Cell - finde naechste und wende Decay an
  let minDistance = Infinity;
  let nearestKey: string | null = null;

  for (const mapKey of sourceMap.keys()) {
    const [x, y, z] = mapKey.split(',').map(Number);
    const attackCell = { x, y, z };
    const dist = getDistance(cell, attackCell);
    if (dist < minDistance) {
      minDistance = dist;
      nearestKey = mapKey;
    }
  }

  if (!nearestKey || minDistance === Infinity) {
    return { score: 0, bestAction: null };
  }

  // Parse nearest cell position
  const [nx, ny, nz] = nearestKey.split(',').map(Number);
  const nearestCell = { x: nx, y: ny, z: nz };

  // Berechne Score fuer nearest cell (mit Modifiers)
  const { score: nearestScore } = calculateScoreFromSourceMap(nearestCell, sourceMap, profile, state);

  // Movement-basiertes Decay
  let decay = calculateMovementDecay(minDistance, 0, profileMovement);

  // minBand: Wenn Decay 1.0 waere (Band 0), stattdessen minBand Decay anwenden
  // Aktionen die bereits in Band 1+ sind (decay < 1.0) bleiben unveraendert
  if (options?.minBand && decay === 1.0) {
    decay = Math.pow(0.5, options.minBand);
  }

  const decayedScore = nearestScore * decay;

  debug('calculateAttractionFromSourceMap:', {
    cell,
    onAttackCell: false,
    minDistanceToAttackCell: minDistance,
    nearestScore,
    decay,
    minBand: options?.minBand,
    decayedScore,
  });

  return {
    score: decayedScore,
    bestAction: null,  // Kann von hier nicht angreifen
  };
}

// ============================================================================
// ATTRACTION MAP BUILDING
// ============================================================================

/** Entry mit bereits berechnetem Score (fuer Rueckwaertskompatibilitaet) */
export interface AttractionMapEntry {
  score: number;
  action: Action;
  target: CombatProfile;
}

/**
 * Baut eine Attraction-Map fuer alle Action/Enemy Kombinationen.
 * Jede globale Cell enthaelt den besten Score der dort moeglich ist.
 *
 * Optimierung: Attack-Cell-Patterns werden gecached (Geometrie konstant),
 * nur Scores werden pro Enemy berechnet (dynamisch).
 */
export function buildAttractionMap(
  profile: CombatProfile,
  state: SimulationState
): Map<string, AttractionMapEntry> {
  const attractionMap = new Map<string, AttractionMapEntry>();
  const enemies = getCandidates(profile, state, 'damage');

  // Besetzte Cells (alle Combatants ausser sich selbst)
  const occupiedCells = new Set<string>(
    state.profiles
      .filter(p => p.participantId !== profile.participantId)
      .map(p => positionToKey(p.position))
  );

  // Fuer jede Action: Berechne Range und hole gecachtes Pattern
  const actionPatterns = new Map<string, { range: number; relativeCells: GridPosition[] }>();
  for (const action of profile.actions) {
    if (!action.damage && !action.healing) continue;
    const range = getActionMaxRangeCells(action, profile.actions);
    actionPatterns.set(action.name ?? action.id, {
      range,
      relativeCells: getRelativeAttackCells(range),
    });
  }

  // Fuer jeden Enemy: Berechne Score und lege auf globale Cells
  for (const enemy of enemies) {
    for (const action of profile.actions) {
      if (!action.damage && !action.healing) continue;

      const pattern = actionPatterns.get(action.name ?? action.id);
      if (!pattern) continue;

      // Transformiere relative Cells zu globalen Koordinaten
      // Score wird pro Cell berechnet wegen positionsabhaengiger Modifiers (Long Range etc.)
      for (const relativeCell of pattern.relativeCells) {
        const globalCell: GridPosition = {
          x: enemy.position.x + relativeCell.x,
          y: enemy.position.y + relativeCell.y,
          z: enemy.position.z + relativeCell.z,
        };
        const key = `${globalCell.x},${globalCell.y},${globalCell.z}`;

        // Ueberspringe besetzte Cells (Kollision)
        if (occupiedCells.has(key)) continue;

        // Score ist positionsabhaengig (Long Range, Cover, etc.)
        // Berechne Distanz von potentieller Position zum Ziel
        const distanceFromCell = getDistance(globalCell, enemy.position);

        // Erstelle virtuelles Profil mit potentieller Position fuer Modifier-Evaluation
        const virtualProfile = { ...profile, position: globalCell };
        const pairScore = calculatePairScore(virtualProfile, action, enemy, distanceFromCell, state);
        if (!pairScore) continue;

        // Behalte den hoechsten Score fuer diese Cell
        const existing = attractionMap.get(key);
        if (!existing || pairScore.score > existing.score) {
          attractionMap.set(key, {
            score: pairScore.score,
            action,
            target: enemy,
          });
        }
      }
    }
  }

  debug('buildAttractionMap:', {
    profileId: profile.participantId,
    enemyCount: enemies.length,
    actionCount: actionPatterns.size,
    mapSize: attractionMap.size,
  });

  return attractionMap;
}

/**
 * Berechnet Attraction-Score basierend auf der vorberechneten Attraction-Map.
 * Nutzt Movement-basiertes Decay (Baender + Intra-Band) fuer Cells ausserhalb der Attack-Reichweite.
 *
 * @param cell - Die zu bewertende Position
 * @param attractionMap - Vorberechnete Map mit besten Scores pro Cell
 * @param profileMovement - Bewegungsreichweite des Profils in Cells
 */
export function calculateAttractionScoreFromMap(
  cell: GridPosition,
  attractionMap: Map<string, AttractionMapEntry>,
  profileMovement: number = 6
): { score: number; bestAction: ActionTargetScore | null } {
  const key = `${cell.x},${cell.y},${cell.z}`;
  const entry = attractionMap.get(key);

  if (entry) {
    // Direkt auf einem Attack Cell - voller Score
    debug('calculateAttractionScoreFromMap:', {
      cell,
      onAttackCell: true,
      score: entry.score,
      action: entry.action.name,
    });

    return {
      score: entry.score,
      bestAction: {
        action: entry.action,
        target: entry.target,
        score: entry.score,
        intent: 'damage',
      },
    };
  }

  // Nicht auf einem Attack Cell - finde naechste Attack Cell fuer Decay
  let minDistance = Infinity;
  let nearestEntry: AttractionMapEntry | null = null;

  for (const [mapKey, mapEntry] of attractionMap) {
    const [x, y, z] = mapKey.split(',').map(Number);
    const attackCell = { x, y, z };
    const dist = getDistance(cell, attackCell);
    if (dist < minDistance) {
      minDistance = dist;
      nearestEntry = mapEntry;
    }
  }

  if (!nearestEntry || minDistance === Infinity) {
    return { score: 0, bestAction: null };
  }

  // Movement-basiertes Decay: Baender + Intra-Band Decay
  // targetReach = 0 weil wir die Distanz zur naechsten Attack-Cell messen
  const decay = calculateMovementDecay(minDistance, 0, profileMovement);
  const decayedScore = nearestEntry.score * decay;

  debug('calculateAttractionScoreFromMap:', {
    cell,
    onAttackCell: false,
    minDistanceToAttackCell: minDistance,
    rawScore: nearestEntry.score,
    decay,
    decayedScore,
  });

  return {
    score: decayedScore,
    bestAction: null,
  };
}

// ============================================================================
// DANGER & ALLY SCORING
// ============================================================================

/**
 * Bewertet wie gefaehrlich ein Cell ist basierend auf Gegner-Positionen.
 * Beruecksichtigt: Melee-Reichweite, Ranged-Reichweite, Damage-Potential.
 *
 * Returns: DPR-Score (raw DPR, gleiche Skala wie Attraction).
 * Ermoeglicht fairen Vergleich: combinedScore = attractionScore - dangerScore
 */
export function calculateDangerScore(
  cell: GridPosition,
  profile: CombatProfile,
  state: SimulationState
): number {
  let totalDanger = 0;

  const enemies = getCandidates(profile, state, 'damage');

  for (const enemy of enemies) {
    const distanceToEnemy = getDistance(cell, enemy.position);
    // Effektiver Schaden unter Beruecksichtigung der Hit-Chance gegen eigene AC
    const enemyDamage = estimateEffectiveDamagePotential(enemy.actions, profile.ac);
    const enemyMaxRange = getMaxAttackRange(enemy);
    const enemyMovement = feetToCell(enemy.speed.walk ?? 30);

    // TODO: Beruecksichtige Immunities/Resistances des eigenen Profils - siehe Header
    // HACK: keine Resistenz-Mitigation

    // Unified Movement Decay: Baender (50% pro Runde) + Intra-Band Decay (10%)
    // enemyReach = wie weit der Feind angreifen kann (Range + 1 Runde Movement)
    const enemyReach = enemyMaxRange + enemyMovement;
    const dangerMultiplier = calculateMovementDecay(distanceToEnemy, enemyReach, enemyMovement);

    const dangerFromEnemy = enemyDamage * dangerMultiplier;
    totalDanger += dangerFromEnemy;
  }

  // Raw DPR - gleiche Skala wie Attraction
  // TODO: Terrain-Modifier (Cover reduziert Danger) - siehe Header

  debug('calculateDangerScore:', {
    cell,
    danger: totalDanger,
    enemyCount: enemies.length,
  });

  return totalDanger;
}

/**
 * Bewertet Cell basierend auf Ally-Positionen.
 * Heiler wollen zu verletzten Allies, Tanks wollen zwischen Gegner und Squishies.
 */
export function calculateAllyScore(
  cell: GridPosition,
  profile: CombatProfile,
  state: SimulationState
): number {
  let allyScore = 0;

  const allies = state.profiles.filter(p =>
    isAllied(profile.groupId, p.groupId, state.alliances) &&
    p.participantId !== profile.participantId
  );

  if (allies.length === 0) return 0;

  const hasHealingActions = profile.actions.some(a => a.healing);
  const hasTankAbilities = profile.ac >= 16; // HACK: siehe Header

  if (hasHealingActions) {
    // Heiler will zu verletzten Allies
    for (const ally of allies) {
      const allyHp = getExpectedValue(ally.hp);
      const allyMaxHp = Math.max(...ally.hp.keys());
      const allyHpRatio = allyMaxHp > 0 ? allyHp / allyMaxHp : 1;
      const urgency = 1 - allyHpRatio;

      // HACK: Healing-Range nutzt getMaxAttackRange() - siehe Header
      const healRange = getMaxAttackRange(profile);
      const distanceToAlly = getDistance(cell, ally.position);

      if (distanceToAlly <= healRange && urgency > 0.3) {
        allyScore += urgency * 0.5;
      }
    }
  }

  if (hasTankAbilities) {
    // Tank will zwischen Gegner und Squishies
    const squishies = allies.filter(a => a.ac < 14);
    const enemies = getCandidates(profile, state, 'damage');

    for (const squishy of squishies) {
      for (const enemy of enemies) {
        // Ist dieser Cell auf dem Weg vom Gegner zum Squishy?
        const enemyToSquishy = getDistance(enemy.position, squishy.position);
        const enemyToCell = getDistance(enemy.position, cell);
        const cellToSquishy = getDistance(cell, squishy.position);

        // Dreieck-Ungleichung: Cell liegt "dazwischen" wenn Summe = Direktweg
        if (enemyToCell + cellToSquishy <= enemyToSquishy + 2) {
          allyScore += 0.3;
        }
      }
    }
  }

  debug('calculateAllyScore:', {
    cell,
    allyScore,
    hasHealingActions,
    hasTankAbilities,
    allyCount: allies.length,
  });

  return allyScore;
}

/**
 * Evaluiert alle relevanten Cells und findet den besten.
 * Kombiniert Attraction, Danger und Ally-Scores.
 *
 * Baut eine vollstaendige Attraction-Map aus ALLEN Action/Enemy Kombinationen,
 * sodass jeder Cell die beste verfuegbare Action kennt.
 */
export function evaluateAllCells(
  profile: CombatProfile,
  state: SimulationState,
  movementCells: number
): CellEvaluation {
  const relevantCells = getRelevantCells(profile.position, movementCells);
  const cellScores = new Map<string, CellScore>();

  // 1. Baue Attraction-Map aus ALLEN Action/Enemy Kombos
  // Jede Cell enthaelt den besten Score + zugehoerige Action/Target
  const attractionMap = buildAttractionMap(profile, state);

  let bestCell: CellScore | null = null;
  let bestAction: ActionTargetScore | null = null;

  const profileMovement = feetToCell(profile.speed?.walk ?? 30);

  for (const cell of relevantCells) {
    // 2. Attraction basierend auf der vollstaendigen Map
    const { score: attractionScore, bestAction: cellBestAction } =
      calculateAttractionScoreFromMap(cell, attractionMap, profileMovement);

    // 3. Danger und Ally Scores wie bisher
    const dangerScore = calculateDangerScore(cell, profile, state);
    const allyScore = calculateAllyScore(cell, profile, state);

    // Alle Scores auf gleicher Skala (% der HP) -> einfache Addition/Subtraktion
    const combinedScore = attractionScore + allyScore - dangerScore;

    const cellScore: CellScore = {
      position: cell,
      attractionScore,
      dangerScore,
      allyScore,
      combinedScore,
    };

    cellScores.set(positionToKey(cell), cellScore);

    // Nur erreichbare Cells als bestCell-Kandidaten (PHB-variant Distanz)
    const distanceToCell = getDistance(profile.position, cell);
    const isReachable = distanceToCell <= movementCells;

    if (isReachable && (!bestCell || combinedScore > bestCell.combinedScore)) {
      bestCell = cellScore;
      bestAction = cellBestAction;
    }
  }

  debug('evaluateAllCells:', {
    profileId: profile.participantId,
    cellCount: relevantCells.length,
    attractionMapSize: attractionMap.size,
    bestCell: bestCell?.position,
    bestCombinedScore: bestCell?.combinedScore,
  });

  return { cells: cellScores, bestCell, bestAction };
}

// ============================================================================
// ESCAPE DANGER CALCULATION
// ============================================================================

/**
 * Berechnet Escape-Danger fuer alle relevanten Cells.
 * Cached fuer die Dauer eines Zuges (Feind-Positionen aendern sich nicht).
 *
 * Fuer jede Cell: Was ist die minimale Danger, wenn wir optimal fluechten?
 * Ermoeglicht "Move in -> Attack -> Move out" Kiting-Pattern.
 *
 * @param profile Eigenes Profil
 * @param state Simulation State
 * @param maxMovement Maximales Movement (fuer Escape-Radius)
 * @returns Map von Cell-Key zu Escape-Danger
 */
export function buildEscapeDangerMap(
  profile: CombatProfile,
  state: SimulationState,
  maxMovement: number
): Map<string, number> {
  const escapeDangerMap = new Map<string, number>();

  // Alle Cells im erweiterten Bewegungsbereich (Movement + max Escape)
  const extendedRange = maxMovement * 2;  // Move + Escape
  const allCells = getRelevantCells(profile.position, extendedRange)
    .filter(c => getDistance(profile.position, c) <= extendedRange);

  for (const cell of allCells) {
    const baseDanger = calculateDangerScore(cell, profile, state);

    // Wie weit koennen wir von hier fluechten?
    const distanceFromStart = getDistance(profile.position, cell);
    const remainingMovement = Math.max(0, maxMovement - distanceFromStart);

    if (remainingMovement <= 0) {
      // Kein Escape moeglich - volle Danger
      escapeDangerMap.set(positionToKey(cell), baseDanger);
      continue;
    }

    // Finde sicherste Escape-Cell
    let minDanger = baseDanger;
    const escapeCells = getRelevantCells(cell, remainingMovement)
      .filter(c => getDistance(cell, c) <= remainingMovement);

    for (const escapeCell of escapeCells) {
      const danger = calculateDangerScore(escapeCell, profile, state);
      if (danger < minDanger) {
        minDanger = danger;
      }
    }

    escapeDangerMap.set(positionToKey(cell), minDanger);
  }

  debug('buildEscapeDangerMap:', {
    profileId: profile.participantId,
    maxMovement,
    mapSize: escapeDangerMap.size,
  });

  return escapeDangerMap;
}
