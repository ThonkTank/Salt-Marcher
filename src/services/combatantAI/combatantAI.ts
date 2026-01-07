// Ziel: Entscheidungslogik fuer Combat-AI: Action/Target-Auswahl, Movement, Preference
// Siehe: docs/services/combatantAI/combatantAI.md (Hub)
//        docs/services/combatantAI/actionScoring.md (DPR-Scoring, Caching, Modifiers)
//        docs/services/combatantAI/turnExecution.md (Turn-Planung, Movement, Resources)
//
// Diese Datei ist der Index fuer das Combat-AI Modul.
// Implementierung ist aufgeteilt in:
// - actionScoring.ts: DPR-basierte Bewertungslogik
// - influenceMaps.ts: Layer-System fuer Action/Effect Evaluation (inkl. Base-Value Caching)
// - turnExecution.ts: Turn-Planung und Ausfuehrung
//
// Combatant-Initialisierung (inkl. AI-Layers) erfolgt in combatTracking/initialiseCombat.ts
//
// Pipeline-Position (Index-Modul):
// - Re-exportiert: actionScoring, turnExecution, influenceMaps
// - Eigene Funktionen: getOptimalRangeVsTarget(), determineCombatPreference()
// - Aufgerufen von: difficulty.ts (via Re-Exports)

// ============================================================================
// HACK & TODO
// ============================================================================
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
  Combatant,
  RangeCache,
  CombatPreference,
} from '@/types/combat';
import { getActions, getAC, getPosition } from '../combatTracking';

// ============================================================================
// RE-EXPORTS (Backward Compatibility)
// ============================================================================

// Types re-exported from @/types/combat
export type {
  // Combatant Types
  Combatant,
  NPCInCombat,
  CharacterInCombat,
  CombatantState,
  CombatantSimulationState,
  CombatState,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  CombatStateWithLayers,
  // Common Types
  CombatResources,
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
export { createRangeCache, isNPC, isCharacter, combatantHasLayers } from '@/types/combat';

// From actionScoring.ts (inkl. konsolidierte Reaction-Funktionen)
export {
  CONDITION_DURATION,
  DEFAULT_CONDITION_DURATION,
  calculateIncomingDPR,
  // Concentration Management (Phase 5)
  isConcentrationSpell,
  estimateRemainingConcentrationValue,
  getActionIntent,
  calculatePairScore,
  selectBestActionAndTarget,
  getMaxAttackRange,
  // Reaction Helpers
  REACTION_THRESHOLD,
  getAvailableReactions,
  matchesTrigger,
  findMatchingReactions,
  estimateExpectedReactionValue,
  shouldUseAction,
  evaluateReaction,
  shouldUseReaction,
} from './actionScoring';

// From combatHelpers.ts (Save + Potential calculations)
export {
  getSaveBonus,
  calculateSaveFailChance,
  calculateDamagePotential,
  calculateEffectiveDamagePotential,
  calculateHealPotential,
  calculateControlPotential,
  calculateCombatantValue,
} from './combatHelpers';

// From actionSelection.ts (direkt statt via actionScoring)
export {
  getCandidates,
  getEnemies,
  getAllies,
} from './actionSelection';

// Types sind jetzt in @/types/combat (Single Source of Truth)
export type { ReactionContext, ReactionResult } from '@/types/combat';

// From influenceMaps.ts (Layer-System)
export {
  buildEscapeDangerMap,
  calculateDangerScoresBatch,
  getThreatAt,
  getAvailableActionsAt,
  getBaseResolution,
  getFullResolution,
  applyEffectsToBase,
  initializeLayers,
  augmentWithLayers,
} from './influenceMaps';
export type {
  CellRangeData,
  BaseResolvedData,
  FinalResolvedData,
  ActionLayerData,
  ActionWithLayer,
  EffectCondition,
  EffectLayerData,
  LayerFilter,
} from '@/types/combat';
export { hasLayerData } from '@/types/combat';

// Movement utilities from @/utils
export {
  getRelevantCells,
  calculateMovementDecay,
} from '@/utils';

// From turnExecution.ts (includes re-exports from actionAvailability.ts)
export {
  hasGrantMovementEffect,
  getAvailableActionsWithLayers,
  executeTurn,
  // Action Availability (from actionAvailability.ts via turnExecution.ts)
  isActionAvailable,
  isActionUsable,
  matchesRequirement,
  hasIncapacitatingCondition,
  getAvailableActionsForCombatant,
  // Resource Management
  initializeResources,
  consumeActionResource,
  tickRechargeTimers,
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
 * CombatantState Schema fuer CLI-Validierung.
 * Transient state attached to NPC/Character during combat.
 */
const combatantStateSchema = z.object({
  position: gridPositionSchema,
  conditions: z.array(z.object({ name: z.string() })).default([]),
  groupId: z.string({ required_error: 'groupId ist erforderlich' }),
});

/**
 * Combatant Schema fuer CLI-Validierung.
 * Structure: NPCInCombat | CharacterInCombat with combatState.
 */
export const combatantSchema = z.object({
  id: z.string({ required_error: 'id ist erforderlich' }),
  name: z.string({ required_error: 'name ist erforderlich' }),
  currentHp: z.union([
    z.number(),
    z.record(z.string(), z.number()),
  ], {
    required_error: 'currentHp ist erforderlich',
  }),
  creature: z.object({
    id: z.string(),
    ac: z.number(),
    speed: speedSchema.optional(),
  }).optional(),
  combatState: combatantStateSchema,
});

/**
 * CombatantSimulationState Schema fuer CLI-Validierung.
 * Wichtig: alliances ist Record<string, string[]>, NICHT Array!
 */
export const combatantSimulationStateSchema = z.object({
  combatants: z.array(combatantSchema),
  alliances: z.record(z.string(), z.array(z.string()), {
    required_error: 'alliances ist erforderlich',
    invalid_type_error: 'alliances muss ein Record sein, kein Array. Format: {"party": ["party"], "enemies": ["enemies"]}',
  }),
});

/** Typen aus Schemas ableiten. */
export type ValidatedCombatant = z.infer<typeof combatantSchema>;
export type ValidatedCombatantSimulationState = z.infer<typeof combatantSimulationStateSchema>;

// ============================================================================
// OPTIMAL RANGE & PREFERENCE
// ============================================================================

/**
 * Berechnet optimale Angriffsreichweite fuer ein spezifisches Matchup.
 * Beruecksichtigt: Gegner-AC, eigene Actions, Hit-Chance.
 * Cached Ergebnisse fuer Performance (5 Goblins vs 4 PCs = 4 Berechnungen, nicht 20).
 *
 * @param attacker Angreifender Combatant
 * @param target Ziel-Combatant
 * @param cache Optional: Cache fuer wiederholte Matchups
 * @returns Optimale Reichweite in Cells
 */
export function getOptimalRangeVsTarget(
  attacker: Combatant,
  target: Combatant,
  cache?: RangeCache
): number {
  // Cache-Check
  const cached = cache?.get(attacker.id, target.id);
  if (cached !== undefined) {
    debug('getOptimalRangeVsTarget: cache hit', { attacker: attacker.id, target: target.id, cached });
    return cached;
  }

  const attackerActions = getActions(attacker);
  const targetAC = getAC(target);

  // Berechnung: Welche Reichweite maximiert meinen EV gegen dieses Ziel?
  let bestRange = 1;  // Default: Melee (1 Cell = 5ft)
  let bestEV = 0;

  for (const action of attackerActions) {
    // Multiattack: Evaluate die Multiattack selbst, nicht einzelne Refs
    if (action.multiattack) {
      const refs = resolveMultiattackRefs(action, attackerActions);
      let totalEV = 0;
      let maxRange = 0;

      for (const ref of refs) {
        if (!ref.damage || !ref.attack) continue;
        const rangeFeet = ref.range?.normal ?? 5;
        maxRange = Math.max(maxRange, rangeFeet);

        const hitChance = calculateHitChance(ref.attack.bonus, targetAC);
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

      const hitChance = calculateHitChance(action.attack.bonus, targetAC);
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
    attacker: attacker.id,
    target: target.id,
    targetAC,
    bestRange,
    bestEV,
  });

  // Cache-Set
  cache?.set(attacker.id, target.id, bestRange);

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
