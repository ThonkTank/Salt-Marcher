// Ziel: Entscheidungslogik für Combat-AI: Action/Target-Auswahl, Movement, Preference
// Siehe: docs/services/combatSimulator/combatantAI.md
//
// Standalone-callable für Encounter-Runner:
// - selectBestActionAndTarget(): "Was soll diese Kreatur tun?"
// - evaluateAllCells(): Cell-basierte Positionsbewertung
// - executeTurn(): Iterative Movement + Action Ausführung
//
// Cell-basiertes Positioning System:
// - buildAttractionMap(): Baut Map aus allen Action/Enemy Kombinationen
// - calculateAttractionScoreFromMap(): Attraction-Score mit Exponential Decay
// - calculateDangerScore(): Wie gefährlich ist dieser Cell?
// - calculateAllyScore(): Ally-Positioning (Healer, Tank)
// - evaluateAllCells(): Kombinierte Bewertung aller erreichbaren Cells

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Tank-Erkennung vereinfacht auf AC >= 16
// - calculateAllyScore() nutzt AC als Proxy für Tank-Rolle
// - Korrekt wäre: Rolle aus Character/Creature-Schema oder explizites Tag
//
// [HACK]: Healing-Range nutzt getMaxAttackRange()
// - calculateAllyScore() behandelt Healing wie Angriff für Range
// - Korrekt wäre: Separate healing.range Eigenschaft im Action-Schema
//
// [HACK]: Keine Resistenz-Mitigation bei Danger-Berechnung
// - calculateDangerScore() ignoriert eigene Resistenzen
// - Korrekt wäre: applyResistances(enemyDamage, profile, enemy)
//
// [TODO]: Immunities/Resistances in Danger-Berechnung
// - Spec: difficulty.md - "Berücksichtige Schadenstyp-Immunität"
// - Input: profile.resistances/immunities, enemy.actions[].damage.type
// - Output: mitigatedDamage = enemyDamage × resistanceFactor
//
// [TODO]: Terrain-Modifier für Danger/Attraction
// - calculateDangerScore() ignoriert Cover-Positionen
// - calculateAttractionScore() ignoriert Difficult Terrain
// - Spec: (zukünftig) terrain.md
//
// [TODO]: AoE-Aktionen bewerten (Fireball etc.)
// - calculateAttractionScore() bewertet nur Single-Target
// - Cells die mehrere Gegner treffen sollten höher scoren
//
// [TODO]: 3D Movement (Fly, Climb)
// - getRelevantCells() ignoriert z-Achse
// - Kreaturen mit Fly sollten vertikale Positionen evaluieren
//
// [TODO]: Erweitere TurnAction für vollständige D&D 5e Aktionsökonomie
// - Dash: ✅ Implementiert als dashMove (minBand:1 für Attraction-Decay)
// - disengage, dodge, help, ready Actions (noch offen)
// - Bonus Actions (benötigt Feature-Detection)
// - Reactions (benötigt Trigger-Detection)
// - Legendary Actions (benötigt legendaryActionCost in Action-Schema)

import { z } from 'zod';
import type { Action } from '@/types/entities';
import {
  diceExpressionToPMF,
  getExpectedValue,
  addConstant,
  calculateEffectiveDamage,
  feetToCell,
  positionToKey,
  positionsEqual,
} from '@/utils';
import {
  resolveMultiattackRefs,
  getActionMaxRangeCells,
  getDistance,
  isAllied,
  isHostile,
  calculateHitChance,
  calculateMultiattackDamage,
} from './combatHelpers';
import {
  hasBudgetRemaining,
  consumeMovement,
  consumeAction,
  applyDash,
} from '../combatTracking';
import {
  evaluateSituationalModifiers,
  type ModifierContext,
  type CombatantContext,
} from './situationalModifiers';
// Bootstrap: Registriert alle Modifier-Plugins
import './modifiers';

// Standard-Actions (Dash, Disengage, Dodge) - verfügbar für alle Combatants
import { standardActions } from '../../../presets/actions';

// Types aus @/types/combat (Single Source of Truth)
import type {
  ProbabilityDistribution,
  GridPosition,
  SpeedBlock,
  CombatProfile,
  SimulationState,
  ConditionState,
  RangeCache,
  TurnBudget,
  ActionIntent,
  CombatPreference,
  ActionTargetScore,
  CellScore,
  CellEvaluation,
  TurnAction,
} from '@/types/combat';
import { createRangeCache } from '@/types/combat';

// Re-exports für Consumer
export type {
  CombatProfile,
  SimulationState,
  ConditionState,
  RangeCache,
  ActionIntent,
  CombatPreference,
  ActionTargetScore,
  CellScore,
  CellEvaluation,
  TurnAction,
} from '@/types/combat';
export { createRangeCache } from '@/types/combat';


// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[combatantAI]', ...args);
  }
};

// ============================================================================
// CLI VALIDATION SCHEMAS
// ============================================================================
// Zod-Schemas für dynamische Fehlermeldungen bei CLI-Tests.
// Erkennt fehlende Felder und falsche Formate mit hilfreichen Meldungen.

/** GridPosition Schema. */
const gridPositionSchema = z.object({
  x: z.number({ required_error: 'x ist erforderlich' }),
  y: z.number({ required_error: 'y ist erforderlich' }),
  z: z.number({ required_error: 'z ist erforderlich' }),
});

/** Speed Schema. */
const speedSchema = z.object({
  walk: z.number({ required_error: 'walk Speed ist erforderlich' }),
  fly: z.number().optional(),
  swim: z.number().optional(),
  climb: z.number().optional(),
  burrow: z.number().optional(),
});

/** Action Schema (minimal für CLI-Validierung). */
const actionSchema = z.object({
  name: z.string({ required_error: 'Action name ist erforderlich' }),
  attack: z.object({
    bonus: z.number({ required_error: 'attack.bonus ist erforderlich' }),
  }).optional(),
  damage: z.object({
    dice: z.string(),
    modifier: z.number(),
    type: z.string(),
  }).optional(),
  healing: z.object({
    dice: z.string(),
    modifier: z.number(),
  }).optional(),
  range: z.object({
    normal: z.number(),
    long: z.number().optional(),
  }).optional(),
});

/**
 * CombatProfile Schema für CLI-Validierung.
 * Wichtig: deathProbability hat Default 0 (fehlt oft in Test-Daten).
 */
export const combatProfileSchema = z.object({
  participantId: z.string({ required_error: 'participantId ist erforderlich' }),
  groupId: z.string({ required_error: 'groupId ist erforderlich' }),
  name: z.string({ required_error: 'name ist erforderlich' }),
  ac: z.number({ required_error: 'ac ist erforderlich' }),
  hp: z.record(z.string(), z.number(), {
    required_error: 'hp ist erforderlich (Format: {"7": 1})',
  }),
  speed: speedSchema,
  actions: z.array(actionSchema),
  position: gridPositionSchema,
  deathProbability: z.number().default(0),
});

/**
 * SimulationState Schema für CLI-Validierung.
 * Wichtig: alliances ist Record<string, string[]>, NICHT Array!
 */
export const simulationStateSchema = z.object({
  profiles: z.array(combatProfileSchema),
  alliances: z.record(z.string(), z.array(z.string()), {
    required_error: 'alliances ist erforderlich',
    invalid_type_error: 'alliances muss ein Record sein, kein Array. Format: {"party": ["party"], "enemies": ["enemies"]}',
  }),
});

/** Typen aus Schemas ableiten. */
export type ValidatedCombatProfile = z.infer<typeof combatProfileSchema>;
export type ValidatedSimulationState = z.infer<typeof simulationStateSchema>;

/**
 * functionSchemas: Mappt Funktionsnamen zu Parameter-Schema-Arrays.
 * CLI-Generator erkennt diesen Export automatisch für dynamische Validierung.
 */
export const functionSchemas = {
  evaluateAllCells: [combatProfileSchema, simulationStateSchema, z.number()],
} as const;

// ============================================================================
// LOCAL TYPES (not shared, service-specific)
// ============================================================================

/**
 * TurnAction mit Score für Unified Action Selection.
 * Ermöglicht Vergleich von Attack vs Move vs Pass auf derselben Skala.
 */
type ScoredAction = TurnAction & { score: number };

// ============================================================================
// ACTION EFFECT HELPERS
// ============================================================================

/**
 * Prüft ob eine Action Movement gewährt (Dash-ähnlich).
 * Effect-basierte Erkennung statt hardcodierter ActionType-Prüfung.
 */
function hasGrantMovementEffect(action: Action): boolean {
  return action.effects?.some(e => e.grantMovement != null) ?? false;
}

/**
 * Prüft ob eine Action ein Angriff ist (hat attack oder save oder damage).
 */
function isAttackAction(action: Action): boolean {
  return (action.attack != null || action.save != null) && action.damage != null;
}

/**
 * Kombiniert Creature-spezifische Actions mit Standard-Actions.
 * Standard-Actions (Dash, Disengage, Dodge) sind für alle Combatants verfügbar.
 */
function getAvailableActions(profile: CombatProfile): Action[] {
  return [...profile.actions, ...standardActions];
}

// ============================================================================
// OPTIMAL RANGE & PREFERENCE
// ============================================================================

/**
 * Berechnet optimale Angriffsreichweite für ein spezifisches Matchup.
 * Berücksichtigt: Gegner-AC, eigene Actions, Hit-Chance.
 * Cached Ergebnisse für Performance (5 Goblins vs 4 PCs = 4 Berechnungen, nicht 20).
 *
 * @param attacker Angreifendes Profil
 * @param target Ziel-Profil
 * @param cache Optional: Cache für wiederholte Matchups
 * @returns Optimale Reichweite in Cells
 */
export function getOptimalRangeVsTarget(
  attacker: CombatProfile,
  target: CombatProfile,
  cache?: RangeCache
): number {
  // Cache-Check
  const cached = cache?.get(attacker.participantId, target.participantId);
  if (cached !== undefined) {
    debug('getOptimalRangeVsTarget: cache hit', { attacker: attacker.participantId, target: target.participantId, cached });
    return cached;
  }

  // Berechnung: Welche Reichweite maximiert meinen EV gegen dieses Ziel?
  let bestRange = 1;  // Default: Melee (1 Cell = 5ft)
  let bestEV = 0;

  for (const action of attacker.actions) {
    // Multiattack: Evaluate die Multiattack selbst, nicht einzelne Refs
    if (action.multiattack) {
      const refs = resolveMultiattackRefs(action, attacker.actions);
      let totalEV = 0;
      let maxRange = 0;

      for (const ref of refs) {
        if (!ref.damage || !ref.attack) continue;
        const rangeFeet = ref.range?.normal ?? 5;
        maxRange = Math.max(maxRange, rangeFeet);

        const hitChance = calculateHitChance(ref.attack.bonus, target.ac);
        const dmgPMF = diceExpressionToPMF(ref.damage.dice);
        const expectedDmg = getExpectedValue(addConstant(dmgPMF, ref.damage.modifier));
        totalEV += hitChance * expectedDmg;
      }

      if (totalEV > bestEV) {
        bestEV = totalEV;
        bestRange = feetToCell(maxRange);
      }
    } else if (action.damage && action.attack) {
      const rangeFeet = action.range?.normal ?? 5;
      const rangeCells = feetToCell(rangeFeet);

      const hitChance = calculateHitChance(action.attack.bonus, target.ac);
      const dmgPMF = diceExpressionToPMF(action.damage.dice);
      const expectedDmg = getExpectedValue(addConstant(dmgPMF, action.damage.modifier));
      const ev = hitChance * expectedDmg;

      if (ev > bestEV) {
        bestEV = ev;
        bestRange = rangeCells;
      }
    }
  }

  debug('getOptimalRangeVsTarget:', {
    attacker: attacker.participantId,
    target: target.participantId,
    targetAC: target.ac,
    bestRange,
    bestEV,
  });

  // Cache-Set
  cache?.set(attacker.participantId, target.participantId, bestRange);

  return bestRange;
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

/**
 * Schätzt effektives Damage-Potential unter Berücksichtigung von Hit-Chance.
 * Verwendet für Danger-Score Berechnung: Wie viel Schaden kann der Feind mir zufügen?
 */
export function estimateEffectiveDamagePotential(
  actions: Action[],
  targetAC: number
): number {
  return actions.reduce((maxDmg, action) => {
    if (action.multiattack) {
      const refs = resolveMultiattackRefs(action, actions);
      const totalEffective = refs.reduce((sum, ref) => {
        if (!ref.damage || !ref.attack) return sum;
        const baseDmg = getExpectedValue(addConstant(
          diceExpressionToPMF(ref.damage.dice),
          ref.damage.modifier
        ));
        const hitChance = calculateHitChance(ref.attack.bonus, targetAC);
        return sum + baseDmg * hitChance;
      }, 0);
      return Math.max(maxDmg, totalEffective);
    }

    if (!action.damage || !action.attack) return maxDmg;
    const baseDmg = getExpectedValue(addConstant(
      diceExpressionToPMF(action.damage.dice),
      action.damage.modifier
    ));
    const hitChance = calculateHitChance(action.attack.bonus, targetAC);
    return Math.max(maxDmg, baseDmg * hitChance);
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
  const alive = (p: CombatProfile) => (p.deathProbability ?? 0) < 0.95;

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
// ACTION/TARGET SCORING
// ============================================================================

/**
 * Berechnet Score für eine (Action, Target)-Kombination.
 * Score ist auf einer "Value-Skala" normalisiert.
 * @param distanceCells Distanz in Cells
 * @param state SimulationState für Modifier-Evaluation (Ally-Positionen etc.)
 */
export function calculatePairScore(
  attacker: CombatProfile,
  action: Action,
  target: CombatProfile,
  distanceCells: number,
  state?: SimulationState
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

  // Situational Modifiers evaluieren (wenn state vorhanden)
  let modifiers = undefined;
  if (state) {
    const attackerContext: CombatantContext = {
      position: attacker.position,
      groupId: attacker.groupId,
      participantId: attacker.participantId,
      conditions: attacker.conditions ?? [],
      ac: attacker.ac,
      hp: getExpectedValue(attacker.hp),
    };
    const targetContext: CombatantContext = {
      position: target.position,
      groupId: target.groupId,
      participantId: target.participantId,
      conditions: target.conditions ?? [],
      ac: target.ac,
      hp: getExpectedValue(target.hp),
    };
    const modifierContext: ModifierContext = {
      attacker: attackerContext,
      target: targetContext,
      action,
      state: {
        profiles: state.profiles.map(p => ({
          position: p.position,
          groupId: p.groupId,
          participantId: p.participantId,
          conditions: p.conditions,
        })),
        alliances: state.alliances,
      },
    };
    modifiers = evaluateSituationalModifiers(modifierContext);
  }

  let score: number;

  switch (intent) {
    case 'damage': {
      let effectiveDamage: ProbabilityDistribution;

      if (action.multiattack) {
        // Multiattack: Kombinierte PMF (Hit-Chance bereits eingerechnet)
        // TODO: Multiattack sollte auch Modifiers nutzen
        const multiDamage = calculateMultiattackDamage(action, attacker.actions, target.ac);
        if (!multiDamage) return null;
        effectiveDamage = multiDamage;
      } else {
        // Einzelangriff mit Situational Modifiers
        if (!action.damage || !action.attack) return null;
        const baseDamage = addConstant(
          diceExpressionToPMF(action.damage.dice),
          action.damage.modifier
        );
        const hitChance = calculateHitChance(action.attack.bonus, target.ac, modifiers);
        effectiveDamage = calculateEffectiveDamage(baseDamage, hitChance);
      }

      // Score = % der Target-HP die dieser Angriff entfernen kann
      // Normalisiert auf gleiche Skala wie dangerScore (% der HP)
      const expectedDmg = getExpectedValue(effectiveDamage);
      const targetHp = getExpectedValue(target.hp);
      score = expectedDmg / Math.max(1, targetHp);

      debug('calculatePairScore (damage):', {
        actionName: action.name,
        isMultiattack: !!action.multiattack,
        expectedDmg,
        targetHp,
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
      const pairScore = calculatePairScore(attacker, action, target, distance, state);
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







// ============================================================================
// CELL-BASED POSITIONING SYSTEM (NEU)
// ============================================================================
//
// Ersetzt das Vektor-basierte Attraction/Repulsion-System.
// Jeder Cell wird explizit bewertet statt Richtungsvektoren zu summieren.
// Alle Scores sind auf "% der HP" normalisiert für faire Vergleiche.

/**
 * Gibt alle relevanten Cells innerhalb der Bewegungsreichweite zurück.
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
      // TODO: 3D Movement für fliegende Kreaturen - siehe Header
      cells.push({ x: center.x + dx, y: center.y + dy, z: center.z });
    }
  }

  debug('getRelevantCells:', { center, movementCells, range, cellCount: cells.length });
  return cells;
}


/**
 * Berechnet Movement-basiertes Decay für Attraction und Danger Scores.
 * Kombiniert diskrete Bänder (50% pro Runde) mit leichtem Intra-Band Decay.
 *
 * @param distanceToTarget - Cells bis zum Ziel/Feind
 * @param targetReach - Reichweite zum Ziel (Attack Range für Attraction, Range + Movement für Danger)
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

  // Band-Nummer: 1 = nächste Runde, 2 = übernächste, etc.
  const bandNumber = Math.ceil(excessDistance / Math.max(1, movement));

  // Haupt-Multiplikator: 50% pro Runde
  const bandMultiplier = Math.pow(0.5, bandNumber);

  // Intra-Band Position: 0.0 (Band-Start) bis 1.0 (Band-Ende)
  const positionInBand = movement > 0
    ? (excessDistance % movement) / movement
    : 0;

  // Leichtes Decay innerhalb des Bands: 100% → 90% über das Band
  // Incentiviert Bewegung in Richtung Band-Grenze
  const intraBandDecay = 1.0 - (positionInBand * 0.1);

  return bandMultiplier * intraBandDecay;
}

/**
 * Cache für relative Attack-Cell-Patterns pro Action-Range.
 * Geometrie ist konstant - nur einmal berechnen.
 */
const attackPatternCache = new Map<number, GridPosition[]>();

/**
 * Gibt relative Attack-Cells für eine gegebene Range zurück (gecached).
 * Relative Cells sind zentriert auf Origin (0,0,0).
 */
function getRelativeAttackCells(rangeCells: number): GridPosition[] {
  const cached = attackPatternCache.get(rangeCells);
  if (cached) return cached;

  const cells: GridPosition[] = [];
  for (let dx = -rangeCells; dx <= rangeCells; dx++) {
    for (let dy = -rangeCells; dy <= rangeCells; dy++) {
      const cell = { x: dx, y: dy, z: 0 };
      // Nur Cells die tatsächlich in Reichweite sind (PHB-Variant Distanz)
      if (getDistance({ x: 0, y: 0, z: 0 }, cell) <= rangeCells) {
        cells.push(cell);
      }
    }
  }

  attackPatternCache.set(rangeCells, cells);
  return cells;
}

/**
 * Source Map Entry: Geometrie-basierte Attack-Möglichkeit ohne Score-Berechnung.
 * Score wird erst bei Query berechnet (Lazy Evaluation).
 */
interface SourceMapEntry {
  action: Action;
  target: CombatProfile;
  distanceToTarget: number;  // Distanz von dieser Cell zum Target
}

/** Entry mit bereits berechnetem Score (für Rückwärtskompatibilität) */
interface AttractionMapEntry {
  score: number;
  action: Action;
  target: CombatProfile;
}

/**
 * Phase 1: Baut Source-Map mit ALLEN Attack-Möglichkeiten (nur Geometrie).
 * Keine Score-Berechnung oder Modifier-Evaluation - das ist günstig!
 *
 * Performance: ~12.800 Cells bei Long Range 320ft, aber nur O(1) pro Cell.
 */
export function buildSourceMaps(
  profile: CombatProfile,
  state: SimulationState
): Map<string, SourceMapEntry[]> {
  const sourceMap = new Map<string, SourceMapEntry[]>();
  const enemies = getCandidates(profile, state, 'damage');

  // Besetzte Cells (alle Combatants außer sich selbst)
  const occupiedCells = new Set<string>(
    state.profiles
      .filter(p => p.participantId !== profile.participantId)
      .map(p => positionToKey(p.position))
  );

  // Für jede Action: Berechne Range und hole gecachtes Pattern
  const actionPatterns = new Map<string, { range: number; relativeCells: GridPosition[] }>();
  for (const action of profile.actions) {
    if (!action.damage && !action.healing) continue;
    const range = getActionMaxRangeCells(action, profile.actions);
    actionPatterns.set(action.name ?? action.id, {
      range,
      relativeCells: getRelativeAttackCells(range),
    });
  }

  // Für jeden Enemy: Markiere alle Cells in Range (ohne Score-Berechnung!)
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

        // Überspringe besetzte Cells
        if (occupiedCells.has(key)) continue;

        // Distanz von dieser Cell zum Target (für spätere Modifier-Evaluation)
        const distanceToTarget = getDistance(globalCell, enemy.position);

        // Alle Entries für diese Cell sammeln (später wird bester ausgewählt)
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
 * Phase 2: Berechnet Score für eine spezifische Cell aus der Source-Map.
 * Evaluiert Modifiers nur für diese Cell - das ist teuer, aber nur ~100 Cells!
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

  // Evaluiere alle Entries und wähle den besten Score
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
 * Berechnet Attraction-Score aus Source-Map mit Decay für Cells außerhalb Attack-Range.
 * Kombiniert Phase 2 Score-Berechnung mit Movement-Decay.
 *
 * @param cell - Die zu bewertende Position
 * @param sourceMap - Source-Map mit Attack-Möglichkeiten (nur Geometrie)
 * @param profile - Profil für Modifier-Evaluation
 * @param state - SimulationState für Modifier-Evaluation
 * @param profileMovement - Bewegungsreichweite in Cells (für Decay)
 * @param options - Optionen für Decay-Berechnung
 * @param options.minBand - Minimum Band für Decay (für Dash: 1 = Aktionen erst nächste Runde)
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
  // Bei minBand > 0: Decay anwenden (z.B. Dash = nächste Runde erst angreifen)
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

  // Fall 2: Nicht auf Attack-Cell - finde nächste und wende Decay an
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

  // Berechne Score für nearest cell (mit Modifiers)
  const { score: nearestScore } = calculateScoreFromSourceMap(nearestCell, sourceMap, profile, state);

  // Movement-basiertes Decay
  let decay = calculateMovementDecay(minDistance, 0, profileMovement);

  // minBand: Wenn Decay 1.0 wäre (Band 0), stattdessen minBand Decay anwenden
  // Aktionen die bereits in Band 1+ sind (decay < 1.0) bleiben unverändert
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

/**
 * Baut eine Attraction-Map für alle Action/Enemy Kombinationen.
 * Jede globale Cell enthält den besten Score der dort möglich ist.
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

  // Besetzte Cells (alle Combatants außer sich selbst)
  const occupiedCells = new Set<string>(
    state.profiles
      .filter(p => p.participantId !== profile.participantId)
      .map(p => positionToKey(p.position))
  );

  // Für jede Action: Berechne Range und hole gecachtes Pattern
  const actionPatterns = new Map<string, { range: number; relativeCells: GridPosition[] }>();
  for (const action of profile.actions) {
    if (!action.damage && !action.healing) continue;
    const range = getActionMaxRangeCells(action, profile.actions);
    actionPatterns.set(action.name ?? action.id, {
      range,
      relativeCells: getRelativeAttackCells(range),
    });
  }

  // Für jeden Enemy: Berechne Score und lege auf globale Cells
  for (const enemy of enemies) {
    for (const action of profile.actions) {
      if (!action.damage && !action.healing) continue;

      const pattern = actionPatterns.get(action.name ?? action.id);
      if (!pattern) continue;

      // Transformiere relative Cells zu globalen Koordinaten
      // Score wird pro Cell berechnet wegen positionsabhängiger Modifiers (Long Range etc.)
      for (const relativeCell of pattern.relativeCells) {
        const globalCell: GridPosition = {
          x: enemy.position.x + relativeCell.x,
          y: enemy.position.y + relativeCell.y,
          z: enemy.position.z + relativeCell.z,
        };
        const key = `${globalCell.x},${globalCell.y},${globalCell.z}`;

        // Überspringe besetzte Cells (Kollision)
        if (occupiedCells.has(key)) continue;

        // Score ist positionsabhängig (Long Range, Cover, etc.)
        // Berechne Distanz von potentieller Position zum Ziel
        const distanceFromCell = getDistance(globalCell, enemy.position);

        // Erstelle virtuelles Profil mit potentieller Position für Modifier-Evaluation
        const virtualProfile = { ...profile, position: globalCell };
        const pairScore = calculatePairScore(virtualProfile, action, enemy, distanceFromCell, state);
        if (!pairScore) continue;

        // Behalte den höchsten Score für diese Cell
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
 * Nutzt Movement-basiertes Decay (Bänder + Intra-Band) für Cells außerhalb der Attack-Reichweite.
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

  // Nicht auf einem Attack Cell - finde nächste Attack Cell für Decay
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

  // Movement-basiertes Decay: Bänder + Intra-Band Decay
  // targetReach = 0 weil wir die Distanz zur nächsten Attack-Cell messen
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


/**
 * Bewertet wie gefährlich ein Cell ist basierend auf Gegner-Positionen.
 * Berücksichtigt: Melee-Reichweite, Ranged-Reichweite, Damage-Potential.
 *
 * Returns: Normalisierter Danger-Score (0-1+ Skala, relativ zu eigenen HP).
 * Ein Score von 1.0 bedeutet "erwarteter Schaden = eigene HP".
 */
export function calculateDangerScore(
  cell: GridPosition,
  profile: CombatProfile,
  state: SimulationState
): number {
  let totalDanger = 0;

  const enemies = getCandidates(profile, state, 'damage');
  const profileHp = getExpectedValue(profile.hp);

  for (const enemy of enemies) {
    const distanceToEnemy = getDistance(cell, enemy.position);
    // Effektiver Schaden unter Berücksichtigung der Hit-Chance gegen eigene AC
    const enemyDamage = estimateEffectiveDamagePotential(enemy.actions, profile.ac);
    const enemyMaxRange = getMaxAttackRange(enemy);
    const enemyMovement = feetToCell(enemy.speed.walk ?? 30);

    // TODO: Berücksichtige Immunities/Resistances des eigenen Profils - siehe Header
    // HACK: keine Resistenz-Mitigation

    // Unified Movement Decay: Bänder (50% pro Runde) + Intra-Band Decay (10%)
    // enemyReach = wie weit der Feind angreifen kann (Range + 1 Runde Movement)
    const enemyReach = enemyMaxRange + enemyMovement;
    const dangerMultiplier = calculateMovementDecay(distanceToEnemy, enemyReach, enemyMovement);

    const dangerFromEnemy = enemyDamage * dangerMultiplier;
    totalDanger += dangerFromEnemy;
  }

  // Normalisiere Danger relativ zu eigenen HP (0-1+ Skala)
  // 1.0 = erwarteter Schaden entspricht eigenen HP
  const normalizedDanger = profileHp > 0 ? totalDanger / profileHp : 0;

  // TODO: Terrain-Modifier (Cover reduziert Danger) - siehe Header

  debug('calculateDangerScore:', {
    cell,
    rawDanger: totalDanger,
    profileHp,
    normalizedDanger,
    enemyCount: enemies.length,
  });

  return normalizedDanger;
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

        // Dreieck-Ungleichung: Cell liegt "dazwischen" wenn Summe ≈ Direktweg
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
 * Baut eine vollständige Attraction-Map aus ALLEN Action/Enemy Kombinationen,
 * sodass jeder Cell die beste verfügbare Action kennt.
 */
export function evaluateAllCells(
  profile: CombatProfile,
  state: SimulationState,
  movementCells: number
): CellEvaluation {
  const relevantCells = getRelevantCells(profile.position, movementCells);
  const cellScores = new Map<string, CellScore>();

  // 1. Baue Attraction-Map aus ALLEN Action/Enemy Kombos
  // Jede Cell enthält den besten Score + zugehörige Action/Target
  const attractionMap = buildAttractionMap(profile, state);

  let bestCell: CellScore | null = null;
  let bestAction: ActionTargetScore | null = null;

  const profileMovement = feetToCell(profile.speed?.walk ?? 30);

  for (const cell of relevantCells) {
    // 2. Attraction basierend auf der vollständigen Map
    const { score: attractionScore, bestAction: cellBestAction } =
      calculateAttractionScoreFromMap(cell, attractionMap, profileMovement);

    // 3. Danger und Ally Scores wie bisher
    const dangerScore = calculateDangerScore(cell, profile, state);
    const allyScore = calculateAllyScore(cell, profile, state);

    // Alle Scores auf gleicher Skala (% der HP) → einfache Addition/Subtraktion
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
 * Berechnet Escape-Danger für alle relevanten Cells.
 * Cached für die Dauer eines Zuges (Feind-Positionen ändern sich nicht).
 *
 * Für jede Cell: Was ist die minimale Danger, wenn wir optimal flüchten?
 * Ermöglicht "Move in → Attack → Move out" Kiting-Pattern.
 *
 * @param profile Eigenes Profil
 * @param state Simulation State
 * @param maxMovement Maximales Movement (für Escape-Radius)
 * @returns Map von Cell-Key zu Escape-Danger
 */
function buildEscapeDangerMap(
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

    // Wie weit können wir von hier flüchten?
    const distanceFromStart = getDistance(profile.position, cell);
    const remainingMovement = Math.max(0, maxMovement - distanceFromStart);

    if (remainingMovement <= 0) {
      // Kein Escape möglich - volle Danger
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

// ============================================================================
// UNIFIED ACTION SELECTION
// ============================================================================

/**
 * Generiert alle möglichen Aktionen mit Scores für Unified Action Selection.
 * Ermöglicht fairen Vergleich: Attack vs Move vs Pass auf derselben Skala.
 *
 * Phase 2: Berechnet Scores nur für erreichbare Cells (~100 statt ~12.800).
 * Modifier-Evaluation erfolgt lazy bei Bedarf.
 *
 * Score-Bedeutung:
 * - AttackAction: expectedDamage / targetHP (mit Modifiers)
 * - MoveAction: combinedScore = attractionScore + allyScore - escapeDanger
 * - PassAction: allyScore - escapeDanger at current position
 */
function generateScoredActions(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget,
  sourceMap: Map<string, SourceMapEntry[]>,
  escapeDangerMap: Map<string, number>
): ScoredAction[] {
  const actions: ScoredAction[] = [];
  const profileMovement = feetToCell(profile.speed?.walk ?? 30);

  // 1. Attack-Aktionen (wenn Action verfügbar)
  if (budget.hasAction) {
    // Attraction-Score an aktueller Position = "Wieviel Schaden kann ich JETZT machen?"
    // Verwendet Source-Map mit Lazy Modifier-Evaluation
    const { score: attackScore, bestAction } = calculateAttractionFromSourceMap(
      profile.position,
      sourceMap,
      profile,
      state,
      profileMovement
    );
    if (bestAction && attackScore > 0) {
      actions.push({
        type: 'action',
        action: bestAction.action,
        target: bestAction.target,
        score: attackScore,
      });
    }
  }

  // 2. Move-Aktionen (wenn Movement verfügbar)
  if (budget.movementCells > 0) {
    const reachableCells = getRelevantCells(profile.position, budget.movementCells)
      .filter(cell => !positionsEqual(cell, profile.position))  // Nicht stehen bleiben
      .filter(cell => getDistance(profile.position, cell) <= budget.movementCells);  // Nur erreichbare Cells

    for (const cell of reachableCells) {
      // Combined Score = attractionScore + allyScore - escapeDanger
      // Escape-Danger: Minimale Danger wenn wir optimal flüchten (gecached)
      // Ermöglicht "Move in → Attack → Move out" Kiting-Pattern
      const { score: attractionScore } = calculateAttractionFromSourceMap(
        cell,
        sourceMap,
        profile,
        state,
        profileMovement
      );
      // Escape-Danger aus Cache (berechnet am Anfang des Zuges)
      const escapeDanger = escapeDangerMap.get(positionToKey(cell))
        ?? calculateDangerScore(cell, profile, state);  // Fallback für nicht-gecachte Cells
      const allyScore = calculateAllyScore(cell, profile, state);
      const moveScore = attractionScore + allyScore - escapeDanger;

      actions.push({
        type: 'move',
        targetCell: cell,
        score: moveScore,
      });
    }
  }

  // 3. Movement-gewährende Aktionen (Dash etc.) - wenn Action verfügbar und noch nicht gedashed
  // Prüft Effect-Felder statt hardcodierter ActionTypes
  if (budget.hasAction && !budget.hasDashed) {
    // Finde Dash-Action (oder andere grantMovement-Actions) aus Standard-Actions
    const allActions = getAvailableActions(profile);
    const dashAction = allActions.find(a => hasGrantMovementEffect(a));

    if (dashAction) {
      const dashRange = budget.movementCells + budget.baseMovementCells;
      const dashReachableCells = getRelevantCells(profile.position, dashRange)
        .filter(cell => !positionsEqual(cell, profile.position))
        .filter(cell => getDistance(profile.position, cell) <= dashRange)
        .filter(cell => getDistance(profile.position, cell) > budget.movementCells);

      for (const cell of dashReachableCells) {
        // minBand: 1 = Aktionen erst nächste Runde (Action durch Dash verbraucht)
        const { score: attractionScore } = calculateAttractionFromSourceMap(
          cell,
          sourceMap,
          profile,
          state,
          profileMovement,
          { minBand: 1 }
        );
        const escapeDanger = escapeDangerMap.get(positionToKey(cell))
          ?? calculateDangerScore(cell, profile, state);
        const allyScore = calculateAllyScore(cell, profile, state);
        const dashMoveScore = attractionScore + allyScore - escapeDanger;

        actions.push({
          type: 'action',
          action: dashAction,
          targetCell: cell,
          score: dashMoveScore,
        });
      }
    }
  }

  // 4. Pass (Score = combined score at current position)
  // Nach Angriff: Retreat zu sicherer Position sollte mit "bleiben" vergleichbar sein
  const currentEscapeDanger = escapeDangerMap.get(positionToKey(profile.position))
    ?? calculateDangerScore(profile.position, profile, state);
  const currentAlly = calculateAllyScore(profile.position, profile, state);
  // attractionScore nicht inkludiert - Pass bedeutet wir greifen nicht an
  // Wenn hasAction=true wird Attack separat evaluiert
  const passScore = currentAlly - currentEscapeDanger;
  actions.push({ type: 'pass', score: passScore });

  return actions;
}

/**
 * Führt einen kompletten Zug aus: Movement + Action.
 * Unified Action Selection: Jede Iteration wählt die beste Aktion aus allen Möglichkeiten.
 *
 * Movement-Kosten werden kumulativ berechnet (PHB-variant):
 * Diagonale Schritte kosten abwechselnd 1-2 Cells (5-10-5-10 Regel).
 */
export function executeTurn(
  profile: CombatProfile,
  state: SimulationState,
  budget: TurnBudget
): TurnAction[] {
  const actions: TurnAction[] = [];
  let currentPosition = { ...profile.position };

  // Phase 1: Source-Map einmal berechnen (nur Geometrie, günstig)
  // Modifier-Evaluation erfolgt lazy in Phase 2 (nur für erreichbare Cells)
  const sourceMap = buildSourceMaps(
    { ...profile, position: currentPosition },
    state
  );

  // Phase 1b: Escape-Danger Map einmal berechnen (ändert sich nicht während des Zuges)
  // Ermöglicht "Move in → Attack → Move out" Kiting-Pattern
  const escapeDangerMap = buildEscapeDangerMap(
    profile,
    state,
    budget.movementCells
  );

  while (hasBudgetRemaining(budget)) {
    // Phase 2: Generiere Scores nur für erreichbare Cells (~100 statt ~12.800)
    const scoredActions = generateScoredActions(
      { ...profile, position: currentPosition },
      state,
      budget,
      sourceMap,
      escapeDangerMap
    );

    // Beste Aktion wählen
    const best = scoredActions.reduce((a, b) => a.score > b.score ? a : b);

    debug('executeTurn: best action', {
      type: best.type,
      score: best.score,
      position: currentPosition,
    });

    // Pass = Zug beenden
    if (best.type === 'pass') {
      actions.push({ type: 'pass' });
      break;
    }

    // Attack ausführen
    if (best.type === 'attack') {
      actions.push({
        type: 'attack',
        action: best.action,
        target: best.target,
      });
      consumeAction(budget);

      debug('executeTurn: attack', {
        action: best.action.name,
        target: best.target.participantId,
      });
      continue;
    }

    // Move ausführen
    if (best.type === 'move') {
      const moveCost = getDistance(currentPosition, best.targetCell);
      actions.push({ type: 'move', targetCell: best.targetCell });
      consumeMovement(budget, moveCost);
      currentPosition = best.targetCell;

      debug('executeTurn: move', {
        to: best.targetCell,
        cost: moveCost,
        remainingMovement: budget.movementCells,
      });
      continue;
    }

    // Dash-Move ausführen: Action für Dash verbrauchen, dann Movement
    if (best.type === 'dashMove') {
      applyDash(budget);  // Action verbrauchen, Movement verdoppeln
      const moveCost = getDistance(currentPosition, best.targetCell);
      actions.push({ type: 'dashMove', targetCell: best.targetCell });
      consumeMovement(budget, moveCost);
      currentPosition = best.targetCell;

      debug('executeTurn: dashMove', {
        to: best.targetCell,
        cost: moveCost,
        remainingMovement: budget.movementCells,
      });
      continue;
    }
  }

  debug('executeTurn: complete', {
    profileId: profile.participantId,
    actionCount: actions.length,
    actionTypes: actions.map(a => a.type),
  });

  return actions;
}
