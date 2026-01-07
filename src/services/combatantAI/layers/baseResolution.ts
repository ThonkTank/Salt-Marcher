// Ziel: Base-Resolution Cache fuer Action-Target Kombinationen
// Siehe: docs/services/combatantAI/buildBaseActionLayer.md
//
// Cache-Strategie:
// - Key: combatantType (z.B. "goblin" - alle Goblins teilen eine Resolution)
// - Cache lebt in: action._layer.againstTarget Map
// - Invariant: Nur deterministische Werte (keine situativen Modifier)

import type {
  ProbabilityDistribution,
  Combatant,
  CombatantWithLayers,
  CombatStateWithLayers,
  BaseResolvedData,
  ActionWithLayer,
} from '@/types/combat';
import { diceExpressionToPMF, addConstant } from '@/utils';
import { getAC, getCombatantType } from '../../combatTracking';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[layers/baseResolution]', ...args);
  }
};

// ============================================================================
// BASE RESOLUTION (Cached by combatantType - keine situativen Modifier)
// ============================================================================

/**
 * Berechnet Base-Resolution fuer Action gegen Target-Typ.
 * Enthaelt nur deterministische Werte - keine situativen Modifier.
 * Cached in action._layer.againstTarget mit combatantType als Key.
 */
export function resolveBaseAgainstTarget(
  action: ActionWithLayer,
  target: Combatant | CombatantWithLayers
): BaseResolvedData {
  const targetType = getCombatantType(target);
  const targetAC = getAC(target);
  const attackBonus = action.attack?.bonus ?? 0;

  // Base Hit-Chance: d20-Mathe ohne Advantage/Disadvantage
  // Formel: (21 - (targetAC - attackBonus)) / 20, clamped [0.05, 0.95]
  const neededRoll = targetAC - attackBonus;
  const baseHitChance = Math.min(0.95, Math.max(0.05, (21 - neededRoll) / 20));

  // Base Damage PMF (Wuerfel ohne Hit-Chance)
  let baseDamagePMF: ProbabilityDistribution;
  if (action.damage) {
    baseDamagePMF = addConstant(
      diceExpressionToPMF(action.damage.dice),
      action.damage.modifier
    );
  } else {
    baseDamagePMF = new Map([[0, 1]]);
  }

  const resolved: BaseResolvedData = {
    targetType,
    targetAC,
    baseHitChance,
    baseDamagePMF,
    attackBonus,
  };

  debug('resolveBaseAgainstTarget:', {
    sourceKey: action._layer.sourceKey,
    targetType,
    targetAC,
    baseHitChance,
    attackBonus,
  });

  return resolved;
}

/**
 * Holt gecachte oder berechnet neue Base-Resolution.
 * Key: target.combatantType (z.B. "goblin" - alle Goblins teilen eine Resolution)
 */
export function getBaseResolution(
  action: ActionWithLayer,
  target: Combatant | CombatantWithLayers
): BaseResolvedData {
  const targetType = getCombatantType(target);
  const cached = action._layer.againstTarget.get(targetType);
  if (cached) {
    debug('getBaseResolution: cache hit', {
      sourceKey: action._layer.sourceKey,
      targetType,
    });
    return cached;
  }

  const resolved = resolveBaseAgainstTarget(action, target);
  action._layer.againstTarget.set(targetType, resolved);

  debug('getBaseResolution: cache miss, computed', {
    sourceKey: action._layer.sourceKey,
    targetType,
  });

  return resolved;
}

/**
 * Pre-Computed alle Base Resolutions fuer schnelleren Zugriff.
 * Iteriert ueber alle (CombatantType, Action, TargetType) Kombinationen.
 * Identische CombatantTypes (z.B. alle Goblins) teilen Cache-Eintraege.
 *
 * @param state State mit Layer-erweiterten Combatants
 */
export function precomputeBaseResolutions(
  state: CombatStateWithLayers
): void {
  // 1. Unique Target-Types sammeln (combatantType -> Representative Combatant)
  const targetTypes = new Map<string, CombatantWithLayers>();
  for (const combatant of state.combatants) {
    const type = getCombatantType(combatant);
    if (!targetTypes.has(type)) {
      targetTypes.set(type, combatant);
    }
  }

  // 2. Fuer jede Action jedes Combatants: Resolve gegen alle Target-Types
  let resolutionCount = 0;
  for (const combatant of state.combatants) {
    for (const action of combatant._layeredActions) {
      for (const representative of targetTypes.values()) {
        // getBaseResolution() befuellt action._layer.againstTarget Cache
        getBaseResolution(action, representative);
        resolutionCount++;
      }
    }
  }

  debug('precomputeBaseResolutions:', {
    combatantCount: state.combatants.length,
    uniqueTargetTypes: targetTypes.size,
    totalResolutions: resolutionCount,
  });
}
