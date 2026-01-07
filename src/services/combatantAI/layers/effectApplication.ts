// Ziel: Dynamische Effect-Anwendung auf Base-Resolution
// Siehe: docs/services/combatantAI/scoreAction.md
//
// Dynamisch: Situative Modifier werden bei jeder Evaluation neu berechnet
// (Pack Tactics, Long Range, Cover, etc.)

import type {
  GridPosition,
  Combatant,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  BaseResolvedData,
  FinalResolvedData,
  ActionWithLayer,
  EffectLayerData,
} from '@/types/combat';
import { getExpectedValue, calculateEffectiveDamage } from '@/utils';
import { getBaseResolution } from './baseResolution';
import {
  evaluateSituationalModifiers,
  type ModifierContext,
  type CombatantContext,
} from '../situationalModifiers';
import { calculateHitChance } from '../helpers/combatHelpers';
import { getGroupId, getPosition, getAC, getConditions, getHP } from '../../combatTracking';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[layers/effectApplication]', ...args);
  }
};

// ============================================================================
// EFFECT APPLICATION (Dynamisch - nie gecacht)
// ============================================================================

/**
 * Wendet situative Modifier auf Base-Resolution an.
 * Dynamisch berechnet bei jeder Evaluation.
 */
export function applyEffectsToBase(
  base: BaseResolvedData,
  action: ActionWithLayer,
  attacker: CombatantWithLayers,
  target: Combatant | CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): FinalResolvedData {
  const attackerPosition = getPosition(attacker);
  const targetPosition = getPosition(target);

  // Situational Modifiers evaluieren
  const attackerContext: CombatantContext = {
    position: attackerPosition,
    groupId: getGroupId(attacker),
    participantId: attacker.id,
    conditions: getConditions(attacker),
    ac: getAC(attacker),
    hp: getExpectedValue(getHP(attacker)),
  };
  const targetContext: CombatantContext = {
    position: targetPosition,
    groupId: getGroupId(target),
    participantId: target.id,
    conditions: getConditions(target),
    ac: getAC(target),
    hp: getExpectedValue(getHP(target)),
  };

  const modifierContext: ModifierContext = {
    attacker: attackerContext,
    target: targetContext,
    action,
    state: {
      profiles: state.combatants.map(c => ({
        position: getPosition(c),
        groupId: getGroupId(c),
        participantId: c.id,
        conditions: getConditions(c),
      })),
      alliances: state.alliances,
    },
  };

  const modifiers = evaluateSituationalModifiers(modifierContext);

  // Effect Layers pruefen (Pack Tactics etc.)
  const activeEffects: string[] = [...modifiers.sources];
  const effectLayers = attacker.combatState.effectLayers ?? [];
  for (const effectLayer of effectLayers) {
    if (effectLayer.isActiveAt(attackerPosition, targetPosition, state)) {
      activeEffects.push(effectLayer.effectId);
    }
  }

  // Final Hit-Chance mit Advantage/Disadvantage
  const finalHitChance = calculateHitChance(base.attackBonus, getAC(target), modifiers);

  // Effective Damage PMF
  const effectiveDamagePMF = calculateEffectiveDamage(base.baseDamagePMF, finalHitChance);

  const result: FinalResolvedData = {
    targetId: target.id,
    base,
    finalHitChance,
    effectiveDamagePMF,
    netAdvantage: modifiers.netAdvantage,
    activeEffects,
  };

  debug('applyEffectsToBase:', {
    sourceKey: action._layer.sourceKey,
    targetId: target.id,
    baseHitChance: base.baseHitChance,
    finalHitChance,
    netAdvantage: modifiers.netAdvantage,
    activeEffects,
  });

  return result;
}

/**
 * Kombinierte Funktion: Base Resolution + Effect Application.
 * Nutzt Cache fuer Base, berechnet Effects dynamisch.
 */
export function getFullResolution(
  action: ActionWithLayer,
  attacker: CombatantWithLayers,
  target: Combatant | CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): FinalResolvedData {
  const base = getBaseResolution(action, target);
  return applyEffectsToBase(base, action, attacker, target, state);
}

// ============================================================================
// EFFECT EVALUATION
// ============================================================================

/**
 * Sammelt alle aktiven Effects fuer einen Attack.
 * Prueft Effect-Layer-Conditions (Pack Tactics, Flanking, Cover).
 */
export function collectActiveEffects(
  attacker: CombatantWithLayers,
  attackerPosition: GridPosition,
  targetPosition: GridPosition,
  state: CombatantSimulationStateWithLayers
): {
  advantages: string[];
  disadvantages: string[];
  acBonuses: { source: string; value: number }[];
  attackBonuses: { source: string; value: number }[];
} {
  const advantages: string[] = [];
  const disadvantages: string[] = [];
  const acBonuses: { source: string; value: number }[] = [];
  const attackBonuses: { source: string; value: number }[] = [];

  const effectLayers = attacker.combatState.effectLayers ?? [];
  for (const effectLayer of effectLayers) {
    if (effectLayer.isActiveAt(attackerPosition, targetPosition, state)) {
      switch (effectLayer.effectType) {
        case 'advantage':
          advantages.push(effectLayer.effectId);
          break;
        case 'disadvantage':
          disadvantages.push(effectLayer.effectId);
          break;
        case 'ac-bonus':
          acBonuses.push({
            source: effectLayer.effectId,
            value: effectLayer.effectValue ?? 0,
          });
          break;
        case 'attack-bonus':
          attackBonuses.push({
            source: effectLayer.effectId,
            value: effectLayer.effectValue ?? 0,
          });
          break;
      }
    }
  }

  debug('collectActiveEffects:', {
    attackerId: attacker.id,
    advantages,
    disadvantages,
    acBonuses,
    attackBonuses,
  });

  return { advantages, disadvantages, acBonuses, attackBonuses };
}

/**
 * Prueft ob ein Effect an einer Position aktiv ist.
 */
export function isEffectActiveAt(
  effect: EffectLayerData,
  attackerPosition: GridPosition,
  targetPosition: GridPosition,
  state: CombatantSimulationStateWithLayers
): boolean {
  return effect.isActiveAt(attackerPosition, targetPosition, state);
}
