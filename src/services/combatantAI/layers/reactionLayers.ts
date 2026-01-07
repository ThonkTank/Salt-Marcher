// Ziel: Reaction/OA Evaluation und Kosten-Berechnung
// Siehe: docs/services/combatantAI/buildThreatMap.md
//
// Trigger-Events:
// - Position-based: 'leaves-reach', 'enters-reach'
// - Global: 'attacked', 'damaged', 'spell-cast', 'ally-attacked', 'ally-damaged'

import type { TriggerEvent } from '@/constants/action';
import type {
  GridPosition,
  Combatant,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  EffectLayerData,
} from '@/types/combat';
import { diceExpressionToPMF, getExpectedValue, addConstant } from '@/utils';
import { getDistance, isHostile, calculateHitChance } from '../helpers/combatHelpers';
import { getGroupId, getPosition, getAC } from '../../combatTracking';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[layers/reactionLayers]', ...args);
  }
};

// ============================================================================
// REACTION LAYER API
// ============================================================================

/**
 * Findet alle Reaction-Layers die fuer einen Trigger-Event relevant sind.
 * Nutzt die bei Combat-Start gebauten Effect Layers.
 */
export function findReactionLayers(
  combatant: CombatantWithLayers,
  trigger: TriggerEvent
): EffectLayerData[] {
  const effectLayers = combatant.combatState.effectLayers ?? [];
  return effectLayers.filter(layer => {
    if (layer.effectType !== 'reaction') return false;
    if (layer.condition.type !== 'trigger') return false;
    return layer.condition.event === trigger;
  });
}

/**
 * Prueft ob Bewegung von fromCell nach toCell einen Reaction-Trigger ausloest.
 * Spezialisiert auf 'leaves-reach' Trigger (Opportunity Attacks).
 *
 * @param mover Der sich bewegende Combatant
 * @param fromCell Startposition
 * @param toCell Zielposition
 * @param reactor Der potentielle Reactor
 * @param state Combat State
 * @param trigger Trigger-Event (default: 'leaves-reach')
 * @param hasDisengage Ob Disengage aktiv ist (verhindert leaves-reach)
 * @returns true wenn der Trigger ausgeloest wird
 */
export function wouldTriggerReaction(
  mover: Combatant,
  fromCell: GridPosition,
  toCell: GridPosition,
  reactor: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  trigger: TriggerEvent = 'leaves-reach',
  hasDisengage: boolean = false
): boolean {
  // Disengage verhindert leaves-reach Trigger
  if (hasDisengage && trigger === 'leaves-reach') {
    return false;
  }

  // Pruefe ob Reactor hostile ist
  const moverGroupId = getGroupId(mover);
  const reactorGroupId = getGroupId(reactor);
  if (!isHostile(moverGroupId, reactorGroupId, state.alliances)) {
    return false;
  }

  // Finde passende Reaction-Layers
  const reactionLayers = findReactionLayers(reactor, trigger);
  if (reactionLayers.length === 0) {
    return false;
  }

  const reactorPosition = getPosition(reactor);

  // Fuer leaves-reach: Pruefe ob wir IN der Reach waren und sie VERLASSEN
  if (trigger === 'leaves-reach') {
    for (const layer of reactionLayers) {
      const distanceFrom = getDistance(fromCell, reactorPosition);
      const distanceTo = getDistance(toCell, reactorPosition);

      // OA nur wenn wir IN der Reach waren und sie VERLASSEN
      if (distanceFrom <= layer.range && distanceTo > layer.range) {
        debug('wouldTriggerReaction: leaves-reach triggered', {
          mover: mover.id,
          reactor: reactor.id,
          range: layer.range,
          distanceFrom,
          distanceTo,
        });
        return true;
      }
    }
    return false;
  }

  // Fuer andere Trigger: Pruefe isActiveAt
  for (const layer of reactionLayers) {
    if (layer.isActiveAt(reactorPosition, fromCell, state)) {
      return true;
    }
  }

  return false;
}

/**
 * Berechnet erwartete Reaction-Kosten fuer eine Bewegung.
 * Summiert Schaden aller Feinde die 'leaves-reach' triggern koennten.
 *
 * @param mover Der sich bewegende Combatant
 * @param fromCell Startposition
 * @param toCell Zielposition
 * @param state Combat State
 * @param hasDisengage Ob Disengage aktiv ist
 * @returns Erwarteter Gesamtschaden durch Reactions
 */
export function calculateExpectedReactionCost(
  mover: CombatantWithLayers,
  fromCell: GridPosition,
  toCell: GridPosition,
  state: CombatantSimulationStateWithLayers,
  hasDisengage: boolean = false
): number {
  let totalCost = 0;

  for (const combatant of state.combatants) {
    // Skip self and allies
    if (!isHostile(getGroupId(mover), getGroupId(combatant), state.alliances)) {
      continue;
    }

    // Pruefe ob Reaction getriggert wird
    if (!wouldTriggerReaction(mover, fromCell, toCell, combatant, state, 'leaves-reach', hasDisengage)) {
      continue;
    }

    // Finde passende Reaction-Layers und berechne erwarteten Schaden
    const reactionLayers = findReactionLayers(combatant, 'leaves-reach');
    for (const layer of reactionLayers) {
      if (!layer.reactionAction) continue;

      const action = layer.reactionAction;
      if (!action.damage) continue;

      // Basis-Schaden berechnen
      const damagePMF = diceExpressionToPMF(action.damage.dice);
      const baseDamage = getExpectedValue(addConstant(damagePMF, action.damage.modifier));

      // Hit-Chance berechnen
      const attackBonus = action.attack?.bonus ?? 0;
      const targetAC = getAC(mover);
      const hitChance = calculateHitChance(attackBonus, targetAC);

      totalCost += hitChance * baseDamage;
    }
  }

  debug('calculateExpectedReactionCost:', {
    mover: mover.id,
    fromCell,
    toCell,
    hasDisengage,
    totalCost,
  });

  return totalCost;
}
