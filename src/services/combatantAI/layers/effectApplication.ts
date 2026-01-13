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
import { getExpectedValue, calculateEffectiveDamage, positionToKey } from '@/utils';
import { calculateCover, maxCover, type CoverLevel } from '@/utils/squareSpace/gridLineOfSight';
import { getBaseResolution } from './baseResolution';
import { evaluateSituationalModifiers } from '../situationalModifiers';
import { combatantToCombatantContext } from '@/utils/combatModifiers';
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
// TERRAIN COVER HELPERS
// ============================================================================

/** Konvertiert Cover-Level zu AC-Bonus per D&D 5e PHB p.196 */
function getCoverACBonus(cover: CoverLevel): number {
  switch (cover) {
    case 'half': return 2;
    case 'three-quarters': return 5;
    default: return 0;  // 'none' oder 'full' (full = autoMiss, kein AC-Bonus nötig)
  }
}

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
  const modifiers = evaluateSituationalModifiers({
    attacker: combatantToCombatantContext(attacker),
    target: combatantToCombatantContext(target),
    action,
    state: {
      combatants: state.combatants,
      alliances: state.alliances,
    },
  });

  // Terrain-based Cover berechnen (wenn terrainMap vorhanden)
  let terrainCoverBonus = 0;
  let hasTerrainFullCover = false;

  if (state.terrainMap) {
    // 1. Raycast-basiertes Cover (Wände/Säulen zwischen Attacker und Target)
    const raycastCover = calculateCover(attackerPosition, targetPosition, (pos) => {
      const key = positionToKey(pos);
      return state.terrainMap?.get(key)?.blocksLoS ?? false;
    });

    // 2. Terrain-Cell Cover (Target steht auf/hinter Cover-Terrain)
    const targetKey = positionToKey(targetPosition);
    const targetCell = state.terrainMap.get(targetKey);
    const cellCover: CoverLevel = targetCell?.cover ?? 'none';

    // 3. Höheres Cover gewinnt
    const effectiveCover = maxCover(raycastCover, cellCover);

    if (effectiveCover === 'full') {
      hasTerrainFullCover = true;
    } else {
      terrainCoverBonus = getCoverACBonus(effectiveCover);
    }
  }

  // Effect Layers pruefen (Pack Tactics etc.)
  const activeEffects: string[] = [...modifiers.sources];
  if (terrainCoverBonus > 0) {
    activeEffects.push(`terrain-cover-${terrainCoverBonus}`);
  }
  if (hasTerrainFullCover) {
    activeEffects.push('terrain-full-cover');
  }
  const effectLayers = attacker.combatState.effectLayers ?? [];
  for (const effectLayer of effectLayers) {
    if (effectLayer.isActiveAt(attackerPosition, targetPosition, state)) {
      activeEffects.push(effectLayer.effectId);
    }
  }

  // Effektive Modifiers mit Terrain-Cover
  const effectiveModifiers = {
    ...modifiers,
    totalACBonus: modifiers.totalACBonus + terrainCoverBonus,
    hasAutoMiss: modifiers.hasAutoMiss || hasTerrainFullCover,
  };

  // Final Hit-Chance mit Advantage/Disadvantage + Terrain Cover
  const finalHitChance = calculateHitChance(base.attackBonus, getAC(target), effectiveModifiers);

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
    targetPos: positionToKey(targetPosition),
    baseHitChance: base.baseHitChance,
    finalHitChance,
    netAdvantage: modifiers.netAdvantage,
    terrainCoverBonus,
    hasTerrainFullCover,
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
