// Ziel: Entscheidungslogik für Combat-AI: Action/Target-Auswahl, Movement, Preference
// Siehe: docs/services/encounter/difficulty.md#step-51-runden-simulation
//
// Standalone-callable für future Encounter-Runner:
// - selectBestActionAndTarget(): "Was soll diese Kreatur tun?"
// - calculateMovementVector(): Optimale Bewegungsrichtung (Vektor)
// - calculateMoveEV(): Bewertung einer Bewegung (Vektor-Alignment)
//
// Movement-System (implementiert):
// - calculateAttraction(): Faktoren die zur Annäherung führen
// - calculateRepulsion(): Faktoren die zur Entfernung führen
// - calculateMovementVector(): Summe aller Attraction/Repulsion-Vektoren
// - calculateMoveEV(): Alignment zwischen Bewegung und optimalem Vektor
//
// Dash-Integration (implementiert):
// - Dash erscheint nur als Option wenn movementCells = 0
// - calculateDashEV(): Vergleicht erreichbare Position mit Attack-Option

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: Ally-Support-Attraction basierend auf healing actions
// - calculateAttraction() enthält Stub für Ally-Support
// - Wenn profile.actions healing enthält, sollte Attraction zu verletzten Allies steigen
//
// [TODO]: Enemy-DPR-basierte Repulsion verfeinern
// - calculateRepulsion() enthält auskommentierten Code
// - Hoher Enemy-DPR sollte Repulsion erhöhen (Threshold kalibrieren)
//
// [TODO]: Erweitere TurnAction für vollständige D&D 5e Aktionsökonomie
// - disengage, dodge, help, ready Actions
// - Bonus Actions (benötigt Feature-Detection)
// - Reactions (benötigt Trigger-Detection)
// - Legendary Actions (benötigt legendaryActionCost in Action-Schema)

import type { Action } from '@/types/entities';
import type { TurnBudget } from './combatResolver';
import {
  type ProbabilityDistribution,
  diceExpressionToPMF,
  getExpectedValue,
  addConstant,
  calculateEffectiveDamage,
  applyDamageToHP,
  calculateDeathProbability,
  convolveDistributions,
  createSingleValue,
  type GridPosition,
  type SpeedBlock,
  feetToCell,
  getNeighbors,
} from '@/utils';
import {
  resolveMultiattackRefs,
  forEachResolvedAction,
  calculateBaseDamagePMF,
  calculateBaseHealingPMF,
  getActionMaxRangeFeet,
  getDistance,
  findNearestProfile,
  getMinDistanceToProfiles,
} from './combatHelpers';


// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[combatantAI]', ...args);
  }
};

// ============================================================================
// VECTOR UTILITIES (für Movement-System)
// ============================================================================

/** 3D-Vektor für Movement-Berechnungen. */
export interface MovementVector {
  x: number;
  y: number;
  z: number;
}

/** Gewichteter Vektor für Attraction/Repulsion-Berechnung. */
export interface WeightedVector {
  direction: MovementVector;
  magnitude: number;
}

/** Berechnet Richtungsvektor von a nach b (nicht normalisiert). */
export function getDirectionVector(from: GridPosition, to: GridPosition): MovementVector {
  return {
    x: to.x - from.x,
    y: to.y - from.y,
    z: to.z - from.z,
  };
}

/** Berechnet die Länge (Magnitude) eines Vektors. */
export function vectorMagnitude(v: MovementVector): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Normalisiert einen Vektor auf Einheitslänge. Gibt Nullvektor zurück wenn Magnitude = 0. */
export function normalizeVector(v: MovementVector): MovementVector {
  const mag = vectorMagnitude(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: v.x / mag,
    y: v.y / mag,
    z: v.z / mag,
  };
}

/** Skaliert einen Vektor mit einem Skalar. */
export function scaleVector(v: MovementVector, scalar: number): MovementVector {
  return {
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar,
  };
}

/** Addiert zwei Vektoren. */
export function addVectors(a: MovementVector, b: MovementVector): MovementVector {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

/** Summiert gewichtete Vektoren zu einem Ergebnis-Vektor. */
export function sumWeightedVectors(vectors: WeightedVector[]): MovementVector {
  let result: MovementVector = { x: 0, y: 0, z: 0 };

  for (const { direction, magnitude } of vectors) {
    const normalized = normalizeVector(direction);
    const scaled = scaleVector(normalized, magnitude);
    result = addVectors(result, scaled);
  }

  return result;
}

/** Berechnet Skalarprodukt (dot product) zweier Vektoren. */
export function dotProduct(a: MovementVector, b: MovementVector): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// ============================================================================
// ATTRACTION / REPULSION SYSTEM
// ============================================================================

/**
 * Berechnet Attraction-Faktor für einen anderen Combatant.
 * Positiver Wert = ich will näher an dieses Ziel.
 *
 * Faktoren (aus difficulty.md#5.1.a):
 * - Enemy nicht im Sweet-Spot: +0.5
 * - Melee-Präferenz und Distanz > 2 Cells: +0.8
 * - Ally mit healing actions und Distanz > 6 Cells: +0.3 (TODO: Stub)
 */
export function calculateAttraction(
  profile: CombatProfile,
  _other: CombatProfile,  // TODO: Für Ally-Support-Attraction
  distance: number,
  isEnemy: boolean
): number {
  let attraction = 0;

  if (isEnemy) {
    // Will ich dort Schaden machen?
    const sweetSpot = calculateSweetSpot(profile.actions);
    const inSweetSpot = Math.abs(distance - sweetSpot) < 2; // 2 Cells = 10ft
    if (!inSweetSpot) {
      attraction += 0.5;
    }

    // Melee-Präferenz: Will ich nah ran?
    const pref = determineCombatPreference(profile.actions);
    if (pref === 'melee' && distance > 2) {
      attraction += 0.8;
    }
  } else {
    // TODO: Ally-Support-Attraction basierend auf healing actions
    // Stub: Allies ziehen nicht an (noch nicht implementiert)
  }

  return attraction;
}

/**
 * Berechnet Repulsion-Faktor für einen anderen Combatant.
 * Positiver Wert = ich will weg von diesem Ziel.
 *
 * Faktoren (aus difficulty.md#5.1.a):
 * - Ranged-Präferenz und Distanz < 3 Cells: +0.6
 * - Hoher Enemy-DPR (>20) und Distanz < 6 Cells: +0.4 (TODO: Stub)
 */
export function calculateRepulsion(
  profile: CombatProfile,
  _other: CombatProfile,  // TODO: Für Enemy-DPR-basierte Repulsion
  distance: number,
  isEnemy: boolean
): number {
  let repulsion = 0;

  if (isEnemy) {
    // Ranged: Will Abstand halten
    const pref = determineCombatPreference(profile.actions);
    if (pref === 'ranged' && distance < 3) {
      repulsion += 0.6;
    }

    // TODO: Gefahr-basierte Repulsion (Enemy-DPR > 20)
    // Stub: estimateDamagePotential() existiert, aber DPR-Threshold nicht kalibriert
    // const enemyDPR = estimateDamagePotential(other.actions);
    // if (enemyDPR > 20 && distance < 6) {
    //   repulsion += 0.4;
    // }
  }

  return repulsion;
}

/**
 * Berechnet den optimalen Movement-Vektor für einen Combatant.
 * Summiert Attraction/Repulsion für alle anderen Combatants.
 *
 * Returns: Vektor der optimalen Bewegungsrichtung (nicht normalisiert).
 * Die Magnitude des Vektors repräsentiert die "Dringlichkeit" der Bewegung.
 */
export function calculateMovementVector(
  profile: CombatProfile,
  state: SimulationState
): MovementVector {
  const vectors: WeightedVector[] = [];

  for (const other of state.profiles) {
    if (other.participantId === profile.participantId) continue;

    const distance = getDistance(profile.position, other.position);
    const isEnemy = isHostile(profile.groupId, other.groupId, state.alliances);

    const attraction = calculateAttraction(profile, other, distance, isEnemy);
    const repulsion = calculateRepulsion(profile, other, distance, isEnemy);

    // Netto-Kraft: Attraction zieht an, Repulsion stößt ab
    const netMagnitude = attraction - repulsion;

    if (netMagnitude !== 0) {
      const direction = getDirectionVector(profile.position, other.position);
      vectors.push({
        direction,
        magnitude: netMagnitude, // Positiv = hin, negativ = weg
      });
    }
  }

  const result = sumWeightedVectors(vectors);

  debug('calculateMovementVector:', {
    participantId: profile.participantId,
    vectorCount: vectors.length,
    result,
    magnitude: vectorMagnitude(result),
  });

  return result;
}

// ============================================================================
// INLINE TYPES (per Services.md convention)
// ============================================================================

export type { SpeedBlock } from '@/utils';

/** Condition-State für Incapacitation-Layer. */
export interface ConditionState {
  name: string;
  probability: number;
  effect: 'incapacitated' | 'disadvantage' | 'other';
}

/** Combat Profile für einen Kampfteilnehmer (minimal für AI). */
export interface CombatProfile {
  participantId: string;
  groupId: string;  // 'party' für PCs, UUID für Encounter-Gruppen
  hp: ProbabilityDistribution;
  deathProbability: number;
  ac: number;
  speed: SpeedBlock;
  actions: Action[];
  conditions?: ConditionState[];
  position: GridPosition;  // Cell-Indizes, nicht Feet
  environmentBonus?: number;
}

/** Simulation State (minimal für AI). */
export interface SimulationState {
  profiles: CombatProfile[];
  alliances: Record<string, string[]>;  // groupId → verbündete groupIds
}

/** Intent einer Action: damage, healing, oder control. */
export type ActionIntent = 'damage' | 'healing' | 'control';

/** Combat-Präferenz für Positioning. */
export type CombatPreference = 'melee' | 'ranged' | 'hybrid';

/** Score-Ergebnis für eine (Action, Target)-Kombination. */
export interface ActionTargetScore {
  action: Action;
  target: CombatProfile;
  score: number;
  intent: ActionIntent;
}

// ============================================================================
// TURN ACTION TYPES
// ============================================================================

/**
 * Union Type für alle möglichen Zug-Aktionen.
 * Wird von generateActionCandidates erzeugt und von simulateTurn konsumiert.
 * Siehe: Plan cosmic-tinkering-unicorn.md#Step-2
 */
export type TurnAction =
  | { type: 'move'; targetCell: GridPosition }
  | { type: 'attack'; action: Action; target: CombatProfile }
  | { type: 'dash' }           // Verdoppelt Movement für diesen Zug
  | { type: 'pass' };          // Zug beenden
  // TODO: Stubs für später (siehe Header)
  // | { type: 'disengage' }   // Kein Opportunity Attack
  // | { type: 'dodge' }       // Vorteil auf Saves
  // | { type: 'help' }        // Verbündeter bekommt Vorteil
  // | { type: 'ready' }       // Reaction für Trigger
  // | { type: 'bonus'; action: Action; target?: CombatProfile }
  // | { type: 'reaction'; trigger: string; action: Action }

/** Scored TurnAction für EV-basierte Selektion. */
export interface ScoredTurnAction {
  action: TurnAction;
  score: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Berechnet Hit-Chance (5%-95% Range). */
export function calculateHitChance(attackBonus: number, targetAC: number): number {
  const neededRoll = targetAC - attackBonus;
  // Natural 1 immer Miss, Natural 20 immer Hit
  return Math.max(0.05, Math.min(0.95, (21 - neededRoll) / 20));
}

// ============================================================================
// ALLIANCE HELPERS
// ============================================================================

/** Prüft ob zwei Gruppen verbündet sind. */
export function isAllied(
  groupA: string,
  groupB: string,
  alliances: Record<string, string[]>
): boolean {
  if (groupA === groupB) return true;
  return alliances[groupA]?.includes(groupB) ?? false;
}

/** Prüft ob zwei Gruppen Feinde sind (nicht verbündet). */
export function isHostile(
  groupA: string,
  groupB: string,
  alliances: Record<string, string[]>
): boolean {
  return !isAllied(groupA, groupB, alliances);
}

// ============================================================================
// SWEET-SPOT & PREFERENCE
// ============================================================================

/** Berechnet Sweet-Spot (optimale Kampfdistanz in Cells). */
export function calculateSweetSpot(actions: Action[]): number {
  // Vereinfacht: Durchschnitt der Normal-Ranges (konvertiert zu Cells)
  let totalRangeFeet = 0;
  let count = 0;

  for (const action of actions) {
    if (action.multiattack) {
      // Multiattack: Range aus referenzierten Actions
      const refs = resolveMultiattackRefs(action, actions);
      for (const ref of refs) {
        if (ref.damage && ref.range) {
          totalRangeFeet += ref.range.normal;
          count++;
        }
      }
    } else if (action.damage && action.range) {
      totalRangeFeet += action.range.normal;
      count++;
    }
  }

  // Konvertiere zu Cells (5ft = 1 Cell)
  const avgRangeFeet = count > 0 ? totalRangeFeet / count : 30;
  const sweetSpotCells = feetToCell(avgRangeFeet);
  debug('calculateSweetSpot:', { totalRangeFeet, count, sweetSpotCells });
  return sweetSpotCells;
}

/** Bestimmt Combat-Präferenz (melee/ranged/hybrid). */
export function determineCombatPreference(actions: Action[]): CombatPreference {
  let meleeCount = 0;
  let rangedCount = 0;

  const countRange = (act: Action) => {
    if (!act.damage || !act.range) return;
    if (act.range.type === 'reach' || act.range.type === 'touch') {
      meleeCount++;
    } else {
      rangedCount++;
    }
  };

  for (const action of actions) {
    if (action.multiattack) {
      // Multiattack: Refs zählen
      const refs = resolveMultiattackRefs(action, actions);
      refs.forEach(countRange);
    } else {
      countRange(action);
    }
  }

  const total = meleeCount + rangedCount;
  if (total === 0) return 'melee';

  const rangedRatio = rangedCount / total;
  const preference: CombatPreference =
    rangedRatio >= 0.7 ? 'ranged' :
    rangedRatio <= 0.3 ? 'melee' : 'hybrid';

  debug('determineCombatPreference:', { meleeCount, rangedCount, preference });
  return preference;
}

// ============================================================================
// POTENTIAL ESTIMATION
// ============================================================================

/** Schätzt Damage-Potential (ohne AC, reiner Würfel-EV). */
export function estimateDamagePotential(actions: Action[]): number {
  return actions.reduce((maxDmg, action) => {
    if (action.multiattack) {
      // Multiattack: Summe aller referenzierten Actions
      const refs = resolveMultiattackRefs(action, actions);
      const totalDmg = refs.reduce((sum, ref) => {
        if (!ref.damage) return sum;
        const dmgPMF = diceExpressionToPMF(ref.damage.dice);
        return sum + getExpectedValue(addConstant(dmgPMF, ref.damage.modifier));
      }, 0);
      return Math.max(maxDmg, totalDmg);
    }

    if (!action.damage) return maxDmg;
    const dmgPMF = diceExpressionToPMF(action.damage.dice);
    const expectedDmg = getExpectedValue(addConstant(dmgPMF, action.damage.modifier));
    return Math.max(maxDmg, expectedDmg);
  }, 0);
}

/** Schätzt Heal-Potential (reiner Würfel-EV). */
export function estimateHealPotential(actions: Action[]): number {
  return actions.reduce((maxHeal, action) => {
    if (!action.healing) return maxHeal;
    const healPMF = diceExpressionToPMF(action.healing.dice);
    const expectedHeal = getExpectedValue(addConstant(healPMF, action.healing.modifier));
    return Math.max(maxHeal, expectedHeal);
  }, 0);
}

/**
 * Schätzt Control-Potential basierend auf Save DC.
 * Höherer DC = effektivere Control (analog zu höherem Damage).
 */
export function estimateControlPotential(actions: Action[]): number {
  return actions.reduce((maxDC, action) => {
    // Nur Actions mit Conditions zählen
    if (!action.effects?.some(e => e.condition)) return maxDC;

    // DC als Maß für Effektivität (analog zu Damage-Würfel)
    if (action.save) {
      return Math.max(maxDC, action.save.dc);
    } else if (action.autoHit) {
      return Math.max(maxDC, 20); // Auto-Hit = maximale Effektivität
    }

    return maxDC;
  }, 0);
}

/**
 * Gesamtwert eines Combatants (AC-unabhängig).
 * Für Vergleich: "Wie wertvoll ist dieser Ally für das Team?"
 */
export function estimateCombatantValue(profile: CombatProfile): number {
  const dmg = estimateDamagePotential(profile.actions);
  const heal = estimateHealPotential(profile.actions);
  const controlDC = estimateControlPotential(profile.actions); // 0-20

  // Gewichtung: Alle auf "Damage-äquivalenter" Skala
  // - Damage direkt
  // - Heal als "geretteter Damage" (~50%)
  // - Control-DC skaliert (DC 15 ≈ 10 Damage-Äquivalent)
  const value = dmg + (heal * 0.5) + (controlDC * 0.7);
  debug('estimateCombatantValue:', { participantId: profile.participantId, dmg, heal, controlDC, value });
  return value;
}

// ============================================================================
// ACTION INTENT & CANDIDATES
// ============================================================================

/** Erkennt Intent einer Action: damage, healing, oder control. */
export function getActionIntent(action: Action): ActionIntent {
  if (action.healing) return 'healing';
  if (action.effects?.some(e => e.condition)) return 'control';
  return 'damage';
}

/** Filtert mögliche Ziele basierend auf Intent und Allianzen. */
export function getCandidates(
  attacker: CombatProfile,
  state: SimulationState,
  intent: ActionIntent
): CombatProfile[] {
  const alive = (p: CombatProfile) => p.deathProbability < 0.95;

  switch (intent) {
    case 'healing':
      // Verbündete (außer sich selbst)
      return state.profiles.filter(p =>
        isAllied(attacker.groupId, p.groupId, state.alliances) &&
        p.participantId !== attacker.participantId &&
        alive(p)
      );
    case 'damage':
    case 'control':
      // Feinde (nicht verbündet)
      return state.profiles.filter(p =>
        isHostile(attacker.groupId, p.groupId, state.alliances) &&
        alive(p)
      );
  }
}

// ============================================================================
// MULTIATTACK DAMAGE CALCULATION
// ============================================================================

/**
 * Berechnet kombinierte Damage-PMF für Multiattack.
 * Konvolviert alle referenzierten Actions (jeweils mit Hit-Chance).
 *
 * REINE BERECHNUNG - nutzt calculateEffectiveDamage() pro Attack.
 *
 * @param action Die Multiattack-Action
 * @param allActions Alle verfügbaren Actions des Attackers (für Ref-Lookup)
 * @param targetAC AC des Ziels für Hit-Chance-Berechnung
 * @returns Kombinierte Damage-PMF oder null wenn keine gültigen Refs
 */
export function calculateMultiattackDamage(
  action: Action,
  allActions: Action[],
  targetAC: number
): ProbabilityDistribution | null {
  if (!action.multiattack?.attacks?.length) {
    debug('calculateMultiattackDamage: no attacks defined', { actionName: action.name });
    return null;
  }

  let totalDamage = createSingleValue(0);
  let validAttacksFound = false;

  for (const entry of action.multiattack.attacks) {
    // 1. Referenzierte Action finden (via Name-Match)
    const refAction = allActions.find(a => a.name === entry.actionRef);
    if (!refAction) {
      debug('calculateMultiattackDamage: actionRef not found', { actionRef: entry.actionRef });
      continue;
    }

    if (!refAction.damage || !refAction.attack) {
      debug('calculateMultiattackDamage: ref has no damage/attack', { actionRef: entry.actionRef });
      continue;
    }

    validAttacksFound = true;

    // 2. Base Damage PMF
    const baseDamage = addConstant(
      diceExpressionToPMF(refAction.damage.dice),
      refAction.damage.modifier
    );

    // 3. Effective Damage (mit Hit-Chance)
    const hitChance = calculateHitChance(refAction.attack.bonus, targetAC);
    const effectiveDamage = calculateEffectiveDamage(baseDamage, hitChance);

    // 4. count-mal convolven (z.B. 2× Scimitar)
    for (let i = 0; i < entry.count; i++) {
      totalDamage = convolveDistributions(totalDamage, effectiveDamage);
    }

    debug('calculateMultiattackDamage: added attack', {
      actionRef: entry.actionRef,
      count: entry.count,
      hitChance,
      expectedDmg: getExpectedValue(effectiveDamage),
    });
  }

  if (!validAttacksFound) {
    debug('calculateMultiattackDamage: no valid attacks found', { actionName: action.name });
    return null;
  }

  debug('calculateMultiattackDamage: total', {
    actionName: action.name,
    expectedTotal: getExpectedValue(totalDamage),
  });

  return totalDamage;
}

// ============================================================================
// ACTION/TARGET SCORING
// ============================================================================

/**
 * Berechnet Score für eine (Action, Target)-Kombination.
 * Score ist auf einer "Value-Skala" normalisiert.
 * @param distanceCells Distanz in Cells
 */
export function calculatePairScore(
  attacker: CombatProfile,
  action: Action,
  target: CombatProfile,
  distanceCells: number
): ActionTargetScore | null {
  const intent = getActionIntent(action);

  // Range-Check (action.range ist in Feet, konvertiere zu Cells)
  // Multiattack: Max-Range aus referenzierten Actions
  let maxRangeFeet: number;
  if (action.multiattack) {
    const refs = resolveMultiattackRefs(action, attacker.actions);
    maxRangeFeet = refs.reduce((max, ref) => {
      if (!ref.range) return max;
      const refRange = ref.range.long ?? ref.range.normal;
      return Math.max(max, refRange);
    }, 0);
  } else {
    maxRangeFeet = action.range.long ?? action.range.normal;
  }

  const maxRangeCells = feetToCell(maxRangeFeet);
  if (distanceCells > maxRangeCells) {
    debug('calculatePairScore: out of range', { actionName: action.name, distanceCells, maxRangeCells });
    return null;
  }

  let score: number;

  switch (intent) {
    case 'damage': {
      let effectiveDamage: ProbabilityDistribution;

      if (action.multiattack) {
        // Multiattack: Kombinierte PMF (Hit-Chance bereits eingerechnet)
        const multiDamage = calculateMultiattackDamage(action, attacker.actions, target.ac);
        if (!multiDamage) return null;
        effectiveDamage = multiDamage;
      } else {
        // Einzelangriff
        if (!action.damage || !action.attack) return null;
        const baseDamage = addConstant(
          diceExpressionToPMF(action.damage.dice),
          action.damage.modifier
        );
        const hitChance = calculateHitChance(action.attack.bonus, target.ac);
        effectiveDamage = calculateEffectiveDamage(baseDamage, hitChance);
      }

      // Volle PMF-Konvolution für Kill-Wahrscheinlichkeit
      const projectedHP = applyDamageToHP(target.hp, effectiveDamage);
      const killProbability = calculateDeathProbability(projectedHP);

      // Score kombiniert Kill-Chance + Damage-Ratio
      const expectedDmg = getExpectedValue(effectiveDamage);
      const targetHp = getExpectedValue(target.hp);
      const damageRatio = expectedDmg / Math.max(1, targetHp);

      // Gewichtung: Kill hat Priorität, dann Damage-Ratio (gedämpft)
      score = killProbability + (1 - killProbability) * damageRatio * 0.5;

      debug('calculatePairScore (damage):', {
        actionName: action.name,
        isMultiattack: !!action.multiattack,
        killProbability,
        damageRatio,
        score,
      });
      break;
    }

    case 'healing': {
      if (!action.healing) return null;

      // 1. Gesamtwert des Allys (AC-unabhängig)
      const allyValue = estimateCombatantValue(target);

      // 2. Wie kritisch ist die Heilung? (Niedrigere HP = kritischer)
      const targetHp = getExpectedValue(target.hp);
      const maxHp = Math.max(...target.hp.keys()); // Approximation für maxHp
      const hpRatio = targetHp / Math.max(1, maxHp);
      const urgency = 1 - hpRatio; // 0 = voll, 1 = fast tot

      // 3. Wie effektiv ist die Heilung?
      const healPMF = diceExpressionToPMF(action.healing.dice);
      const expectedHeal = getExpectedValue(addConstant(healPMF, action.healing.modifier));

      // Score: "Wieviel Team-Value retten wir?"
      score = allyValue * urgency * Math.min(1, expectedHeal / Math.max(1, targetHp));
      debug('calculatePairScore (healing):', { actionName: action.name, allyValue, urgency, expectedHeal, score });
      break;
    }

    case 'control': {
      // Ziel: Wertvollsten Feind disablen (Damage + Heal + Control)
      const targetValue = estimateCombatantValue(target);
      score = targetValue;
      debug('calculatePairScore (control):', { actionName: action.name, targetValue, score });
      break;
    }
  }

  return { action, target, score, intent };
}

/**
 * Wählt beste (Action, Target)-Kombination basierend auf EV-Score.
 * Standalone aufrufbar für Encounter-Runner: "Was soll diese Kreatur tun?"
 */
export function selectBestActionAndTarget(
  attacker: CombatProfile,
  state: SimulationState
): ActionTargetScore | null {
  const scores: ActionTargetScore[] = [];

  for (const action of attacker.actions) {
    const intent = getActionIntent(action);
    const candidates = getCandidates(attacker, state, intent);

    for (const target of candidates) {
      const distance = getDistance(attacker.position, target.position);
      const pairScore = calculatePairScore(attacker, action, target, distance);
      if (pairScore) scores.push(pairScore);
    }
  }

  if (scores.length === 0) {
    debug('selectBestActionAndTarget: no valid actions for', attacker.participantId);
    return null;
  }

  // Beste Kombination nach Score
  const best = scores.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  debug('selectBestActionAndTarget:', {
    attacker: attacker.participantId,
    bestAction: best.action.name,
    bestTarget: best.target.participantId,
    bestScore: best.score,
    intent: best.intent,
  });

  return best;
}

// ============================================================================
// TURN ACTION CANDIDATES
// ============================================================================

/**
 * Gibt alle gültigen Ziele für eine Action zurück (in Reichweite).
 * Nutzt getCandidates für Allianz-Filter und prüft Range.
 */
export function getValidTargets(
  attacker: CombatProfile,
  action: Action,
  state: SimulationState
): CombatProfile[] {
  const intent = getActionIntent(action);
  const candidates = getCandidates(attacker, state, intent);

  // Range-Check
  const maxRangeFeet = action.range?.long ?? action.range?.normal ?? 5;
  const maxRangeCells = feetToCell(maxRangeFeet);

  return candidates.filter(target => {
    const distance = getDistance(attacker.position, target.position);
    return distance <= maxRangeCells;
  });
}

/**
 * Findet nächsten Feind für Movement-Entscheidungen.
 */
export function getNearestEnemy(
  profile: CombatProfile,
  state: SimulationState
): CombatProfile | null {
  const enemies = getCandidates(profile, state, 'damage');
  if (enemies.length === 0) return null;

  let nearest = enemies[0];
  let nearestDist = getDistance(profile.position, nearest.position);

  for (const enemy of enemies) {
    const dist = getDistance(profile.position, enemy.position);
    if (dist < nearestDist) {
      nearest = enemy;
      nearestDist = dist;
    }
  }

  return nearest;
}

/**
 * Berechnet maximale Angriffsreichweite eines Profils (in Cells).
 */
export function getMaxAttackRange(profile: CombatProfile): number {
  let maxRange = 0;

  const updateMaxRange = (act: Action) => {
    if (act.damage && act.range) {
      const rangeFeet = act.range.long ?? act.range.normal;
      maxRange = Math.max(maxRange, feetToCell(rangeFeet));
    }
  };

  for (const action of profile.actions) {
    if (action.multiattack) {
      // Multiattack: Max-Range aus Refs
      const refs = resolveMultiattackRefs(action, profile.actions);
      refs.forEach(updateMaxRange);
    } else {
      updateMaxRange(action);
    }
  }
  return maxRange || 1;  // Default: Melee (1 Cell = 5ft)
}

/**
 * Generiert alle möglichen TurnActions basierend auf Budget.
 * Siehe: Plan cosmic-tinkering-unicorn.md#Step-3
 */
export function generateActionCandidates(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget
): TurnAction[] {
  const candidates: TurnAction[] = [];

  // 1. Movement-Optionen (alle 6 Richtungen)
  if (budget.movementCells > 0) {
    const neighbors = getNeighbors(profile.position);
    for (const targetCell of neighbors) {
      candidates.push({ type: 'move', targetCell });
    }
  }

  // 2. Attack-Optionen (wenn Action noch nicht verbraucht)
  if (budget.hasAction) {
    for (const action of profile.actions) {
      const validTargets = getValidTargets(profile, action, state);
      for (const target of validTargets) {
        candidates.push({ type: 'attack', action, target });
      }
    }
  }

  // 3. Dash (nur wenn Movement aufgebraucht, Action verfügbar, noch nicht gedashed)
  if (budget.movementCells === 0 && budget.hasAction && !budget.hasDashed) {
    candidates.push({ type: 'dash' });
  }

  // 4. Immer pass als Option
  candidates.push({ type: 'pass' });

  debug('generateActionCandidates:', {
    participantId: profile.participantId,
    movementCells: budget.movementCells,
    hasAction: budget.hasAction,
    candidateCount: candidates.length,
    types: [...new Set(candidates.map(c => c.type))],
  });

  return candidates;
}

// ============================================================================
// TURN ACTION EV CALCULATION
// ============================================================================

/**
 * Berechnet EV für eine Bewegung zu einer Zielzelle.
 * Nutzt Vektor-Alignment: Wie gut passt diese Bewegung zum optimalen Movement-Vektor?
 */
export function calculateMoveEV(
  from: GridPosition,
  to: GridPosition,
  profile: CombatProfile,
  state: SimulationState
): number {
  const enemies = getCandidates(profile, state, 'damage');
  if (enemies.length === 0) return 0;

  // 1. Optimaler Movement-Vektor (Attraction/Repulsion)
  const optimalVector = calculateMovementVector(profile, state);
  const optimalMagnitude = vectorMagnitude(optimalVector);

  // Wenn kein klarer optimaler Vektor, ist Bewegung neutral
  if (optimalMagnitude < 0.1) return 0;

  // 2. Bewegungs-Vektor (von from nach to)
  const moveVector = getDirectionVector(from, to);

  // 3. Alignment berechnen (wie gut passt die Richtung?)
  const normalizedOptimal = normalizeVector(optimalVector);
  const normalizedMove = normalizeVector(moveVector);
  const alignment = dotProduct(normalizedOptimal, normalizedMove);
  // alignment: -1 (entgegengesetzt) bis +1 (perfekt aligned)

  // 4. Base-EV: Alignment * Dringlichkeit
  // optimalMagnitude repräsentiert wie "dringend" Bewegung ist
  const baseEV = alignment * Math.min(optimalMagnitude, 1.0);

  // 5. Attack-Bonus wenn Zielposition Attack ermöglicht
  const maxAttackRange = getMaxAttackRange(profile);
  const currentDist = getMinDistanceToProfiles(from, enemies);
  const newDist = getMinDistanceToProfiles(to, enemies);
  const couldAttackBefore = currentDist <= maxAttackRange;
  const canAttackAfter = newDist <= maxAttackRange;
  const attackBonus = (!couldAttackBefore && canAttackAfter) ? 0.5 : 0;

  const ev = baseEV + attackBonus;

  debug('calculateMoveEV:', {
    from, to,
    optimalVector, optimalMagnitude,
    alignment, baseEV, attackBonus, ev,
  });

  return ev;
}

/**
 * Berechnet EV für einen Angriff.
 * Nutzt calculatePairScore-Logik.
 */
export function calculateAttackEV(
  action: Action,
  target: CombatProfile,
  attacker: CombatProfile,
  _state: SimulationState
): number {
  const distance = getDistance(attacker.position, target.position);
  const pairScore = calculatePairScore(attacker, action, target, distance);

  // pairScore.score ist bereits auf einer Value-Skala normalisiert
  // Wir skalieren es um es mit Movement-EV vergleichbar zu machen
  // Ein Kill sollte deutlich mehr wert sein als Movement
  const ev = pairScore ? pairScore.score * 2 : 0;

  debug('calculateAttackEV:', {
    action: action.name,
    target: target.participantId,
    pairScore: pairScore?.score,
    ev,
  });

  return ev;
}

/**
 * Evaluiert den Wert einer Position für einen Combatant.
 * Berücksichtigt: Angriffsreichweite und Sweet-Spot-Nähe.
 */
export function evaluatePosition(
  pos: GridPosition,
  profile: CombatProfile,
  state: SimulationState
): number {
  const enemies = getCandidates(profile, state, 'damage');
  if (enemies.length === 0) return 0;

  const maxAttackRange = getMaxAttackRange(profile);
  const sweetSpot = calculateSweetSpot(profile.actions);

  // 1. Kann ich von hier angreifen?
  const minDist = getMinDistanceToProfiles(pos, enemies);
  const canAttack = minDist <= maxAttackRange;
  const attackBonus = canAttack ? 1.0 : 0;

  // 2. Wie nah am Sweet-Spot?
  // Score ist höher wenn näher am Sweet-Spot
  const deviation = Math.abs(minDist - sweetSpot);
  const maxDeviation = Math.max(sweetSpot, 10); // Normalisierung
  const sweetSpotScore = Math.max(0, 1 - deviation / maxDeviation) * 0.5;

  return attackBonus + sweetSpotScore;
}

/**
 * Findet die beste erreichbare Position in Richtung eines Vektors.
 * Simuliert schrittweise Bewegung und wählt Position mit höchstem EV.
 */
export function findBestPositionInDirection(
  start: GridPosition,
  direction: MovementVector,
  maxCells: number,
  profile: CombatProfile,
  state: SimulationState
): GridPosition {
  const normalizedDir = normalizeVector(direction);

  // Wenn kein klarer Vektor, bleib wo du bist
  if (vectorMagnitude(direction) < 0.1) return start;

  let bestPosition = start;
  let bestScore = evaluatePosition(start, profile, state);

  // Simuliere Bewegung Schritt für Schritt
  let currentPos = start;
  for (let i = 0; i < maxCells; i++) {
    // Nächste Position in Richtung des Vektors
    const nextPos: GridPosition = {
      x: Math.round(currentPos.x + normalizedDir.x),
      y: Math.round(currentPos.y + normalizedDir.y),
      z: Math.round(currentPos.z + normalizedDir.z),
    };

    // Wenn keine Bewegung mehr möglich (gleiche Position), abbrechen
    if (nextPos.x === currentPos.x && nextPos.y === currentPos.y && nextPos.z === currentPos.z) {
      break;
    }

    const score = evaluatePosition(nextPos, profile, state);
    if (score > bestScore) {
      bestScore = score;
      bestPosition = nextPos;
    }

    currentPos = nextPos;
  }

  return bestPosition;
}

/**
 * Berechnet EV für Dash-Aktion.
 * Vergleicht den Wert der durch Dash erreichbaren Position mit der besten Attack-Option.
 *
 * Dash wird nur evaluiert wenn movementCells = 0 (siehe generateActionCandidates).
 * Dash lohnt sich wenn die neue Position wertvoller ist als ein Attack.
 */
export function calculateDashEV(
  profile: CombatProfile,
  state: SimulationState
): number {
  const enemies = getCandidates(profile, state, 'damage');
  if (enemies.length === 0) return 0;

  // 1. Wohin könnte ich mit Dash kommen?
  const dashCells = feetToCell(profile.speed.walk ?? 30);
  const optimalVector = calculateMovementVector(profile, state);
  const dashTargetPos = findBestPositionInDirection(
    profile.position,
    optimalVector,
    dashCells,
    profile,
    state
  );

  // 2. Wie wertvoll ist diese Position?
  const dashPositionEV = evaluatePosition(dashTargetPos, profile, state);
  const currentPositionEV = evaluatePosition(profile.position, profile, state);
  const positionImprovement = dashPositionEV - currentPositionEV;

  // 3. Was würde ich aufgeben? (Beste Attack-Option)
  const bestAttack = selectBestActionAndTarget(profile, state);
  const attackEV = bestAttack ? bestAttack.score : 0;

  // 4. Dash lohnt sich wenn Position-Improvement > Attack-EV
  // Skaliert, weil Attack-Score auf anderer Skala
  const ev = positionImprovement - attackEV * 0.5;

  debug('calculateDashEV:', {
    dashCells,
    dashTargetPos,
    currentPositionEV,
    dashPositionEV,
    positionImprovement,
    attackEV,
    ev,
  });

  return ev;
}

/**
 * Berechnet EV für eine TurnAction.
 * Haupteinstiegspunkt für EV-basierte Selektion.
 * Siehe: Plan cosmic-tinkering-unicorn.md#Step-4
 */
export function calculateTurnActionEV(
  turnAction: TurnAction,
  profile: CombatProfile,
  state: SimulationState
): number {
  switch (turnAction.type) {
    case 'move':
      return calculateMoveEV(profile.position, turnAction.targetCell, profile, state);
    case 'attack':
      return calculateAttackEV(turnAction.action, turnAction.target, profile, state);
    case 'dash':
      return calculateDashEV(profile, state);
    case 'pass':
      return 0;  // Neutral
  }
}
