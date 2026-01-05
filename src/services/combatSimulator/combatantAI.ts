// Ziel: Entscheidungslogik fuer Combat-AI: Action/Target-Auswahl, Movement, Preference
// Siehe: docs/services/combatSimulator/combatantAI.md (Hub)
//        docs/services/combatSimulator/actionScoring.md (DPR-Scoring, Caching, Modifiers)
//        docs/services/combatSimulator/turnExploration.md (Turn-Planung, Movement, Resources)
//
// Diese Datei ist der Index fuer das Combat-AI Modul.
// Implementierung ist aufgeteilt in:
// - baseValuesCache.ts: Caching-Infrastruktur
// - actionScoring.ts: DPR-basierte Bewertungslogik
// - cellPositioning.ts: Cell-basiertes Positioning-System
// - turnExecution.ts: Turn-Planung und Ausfuehrung

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Tank-Erkennung vereinfacht auf AC >= 16
// - calculateAllyScore() nutzt AC als Proxy fuer Tank-Rolle
// - Korrekt waere: Rolle aus Character/Creature-Schema oder explizites Tag
//
// [HACK]: Healing-Range nutzt getMaxAttackRange()
// - calculateAllyScore() behandelt Healing wie Angriff fuer Range
// - Korrekt waere: Separate healing.range Eigenschaft im Action-Schema
//
// [HACK]: Keine Resistenz-Mitigation bei Danger-Berechnung
// - calculateDangerScore() ignoriert eigene Resistenzen
// - Korrekt waere: applyResistances(enemyDamage, profile, enemy)
//
// [TODO]: Immunities/Resistances in Danger-Berechnung
// - Spec: difficulty.md - "Beruecksichtige Schadenstyp-Immunitaet"
// - Input: profile.resistances/immunities, enemy.actions[].damage.type
// - Output: mitigatedDamage = enemyDamage x resistanceFactor
//
// [TODO]: Terrain-Modifier fuer Danger/Attraction
// - calculateDangerScore() ignoriert Cover-Positionen
// - calculateAttractionScore() ignoriert Difficult Terrain
// - Spec: (zukuenftig) terrain.md
//
// [TODO]: AoE-Aktionen bewerten (Fireball etc.)
// - calculateAttractionScore() bewertet nur Single-Target
// - Cells die mehrere Gegner treffen sollten hoeher scoren
//
// [TODO]: 3D Movement (Fly, Climb)
// - getRelevantCells() ignoriert z-Achse
// - Kreaturen mit Fly sollten vertikale Positionen evaluieren
//
// [TODO]: Erweitere TurnAction fuer vollstaendige D&D 5e Aktionsoekonomie
// - Standard-Actions (Dash, Disengage, Dodge): Via Effect-Felder (grantMovement, movementBehavior, incomingModifiers)
// - Bonus Actions (benoetigt Feature-Detection)
// - Legendary Actions (benoetigt legendaryActionCost in Action-Schema)
// NOTE: Reactions implementiert in Phase 6 (actionScoring.ts, combatTracking.ts)

import { z } from 'zod';
import type { Action } from '@/types/entities';
import {
  diceExpressionToPMF,
  getExpectedValue,
  addConstant,
  feetToCell,
} from '@/utils';
import {
  resolveMultiattackRefs,
  calculateHitChance,
} from './combatHelpers';

// Types aus @/types/combat (Single Source of Truth)
import type {
  CombatProfile,
  SimulationState,
  RangeCache,
  CombatPreference,
} from '@/types/combat';

// ============================================================================
// RE-EXPORTS (Backward Compatibility)
// ============================================================================

// Types re-exported from @/types/combat
export type {
  CombatProfile,
  CombatResources,
  SimulationState,
  ConditionState,
  RangeCache,
  ActionIntent,
  CombatPreference,
  ActionTargetScore,
  CellScore,
  CellEvaluation,
  TurnAction,
  TurnExplorationResult,
} from '@/types/combat';
export { createRangeCache } from '@/types/combat';

// From baseValuesCache.ts
export {
  getRelativeAttackCells,
  getBaseValuesCacheKey,
  computeRelevantStatHash,
  getCachedBaseValues,
  setCachedBaseValues,
  resetBaseValuesCache,
  resetCombatCaches,
} from './baseValuesCache';

// From actionScoring.ts
export {
  CONDITION_DURATION,
  DEFAULT_CONDITION_DURATION,
  getTypicalSaveBonus,
  calculateSaveFailChance,
  estimateIncomingDPR,
  estimateDamagePotential,
  estimateEffectiveDamagePotential,
  estimateHealPotential,
  estimateControlPotential,
  estimateCombatantValue,
  // Concentration Management (Phase 5)
  isConcentrationSpell,
  estimateRemainingConcentrationValue,
  getActionIntent,
  getCandidates,
  calculatePairScore,
  selectBestActionAndTarget,
  getMaxAttackRange,
  calculateAndCacheBaseValues,
  computeScoreFromBaseValues,
  // Reaction System (Phase 6)
  REACTION_THRESHOLD,
  getAvailableReactions,
  matchesTrigger,
  findMatchingReactions,
  evaluateReaction,
  estimateExpectedReactionValue,
  shouldUseReaction,
} from './actionScoring';
export type { ReactionContext, ReactionResult } from './actionScoring';

// From cellPositioning.ts
export {
  getRelevantCells,
  calculateMovementDecay,
  buildSourceMaps,
  calculateScoreFromSourceMap,
  calculateAttractionFromSourceMap,
  buildAttractionMap,
  calculateAttractionScoreFromMap,
  calculateDangerScore,
  calculateAllyScore,
  evaluateAllCells,
  buildEscapeDangerMap,
} from './cellPositioning';
export type { SourceMapEntry, AttractionMapEntry } from './cellPositioning';

// From turnExecution.ts
export {
  hasGrantMovementEffect,
  getAvailableActions,
  matchesRequirement,
  generateBonusActions,
  wouldTriggerOA,
  getEnemyReachCells,
  estimateOADamage,
  calculateExpectedOADamage,
  executeTurn,
  // Resource Management (Phase 4)
  isActionAvailable,
  initializeResources,
  consumeActionResource,
  tickRechargeTimers,
  // Reaction System (Phase 6)
  executeOA,
} from './turnExecution';

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
// Zod-Schemas fuer dynamische Fehlermeldungen bei CLI-Tests.
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

/** Action Schema (minimal fuer CLI-Validierung). */
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
 * CombatProfile Schema fuer CLI-Validierung.
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
 * SimulationState Schema fuer CLI-Validierung.
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
 * CLI-Generator erkennt diesen Export automatisch fuer dynamische Validierung.
 */
export const functionSchemas = {
  evaluateAllCells: [combatProfileSchema, simulationStateSchema, z.number()],
} as const;

// ============================================================================
// OPTIMAL RANGE & PREFERENCE
// ============================================================================

/**
 * Berechnet optimale Angriffsreichweite fuer ein spezifisches Matchup.
 * Beruecksichtigt: Gegner-AC, eigene Actions, Hit-Chance.
 * Cached Ergebnisse fuer Performance (5 Goblins vs 4 PCs = 4 Berechnungen, nicht 20).
 *
 * @param attacker Angreifendes Profil
 * @param target Ziel-Profil
 * @param cache Optional: Cache fuer wiederholte Matchups
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

/** Bestimmt Combat-Praeferenz (melee/ranged/hybrid). */
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
      // Multiattack: Refs zaehlen
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
