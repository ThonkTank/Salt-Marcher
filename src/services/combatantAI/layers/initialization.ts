// Ziel: Layer-Initialisierung bei Combat-Start
// Siehe: docs/services/combatantAI/buildBaseActionLayer.md
//
// Pipeline-Position:
// - Aufgerufen von: difficulty.simulatePMF() -> initializeLayers()
// - Aufgerufen von: planNextAction.selectNextAction() -> initializeLayers()
// - Output: CombatStateWithLayers, CombatantWithLayers

import type { CombatEvent } from '@/types/entities/combatEvent';
import type { TriggerEvent } from '@/constants/action';
import type {
  GridPosition,
  Combatant,
  CombatantSimulationState,
  CombatState,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  CombatStateWithLayers,
  CellRangeData,
  ActionLayerData,
  ActionWithLayer,
  EffectLayerData,
} from '@/types/combat';
import { feetToCell, positionToKey } from '@/utils';
import { getDistance, isAllied } from '../helpers/combatHelpers';
import { getGroupId, getPosition, getCombatEvents } from '../../combatTracking';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[layers/initialization]', ...args);
  }
};

// ============================================================================
// LAYER INITIALIZATION (Combat-Start)
// ============================================================================

/**
 * Erweitert alle Combatants mit Layer-Daten.
 * @returns State mit Layer-erweiterten Combatants (erhaelt alle anderen Felder)
 */
export function initializeLayers(state: CombatState): CombatStateWithLayers;
export function initializeLayers(state: CombatantSimulationState): CombatantSimulationStateWithLayers;
export function initializeLayers(
  state: CombatantSimulationState | CombatState
): CombatantSimulationStateWithLayers | CombatStateWithLayers {
  const combatantsWithLayers = state.combatants.map(combatant =>
    augmentWithLayers(combatant, state.alliances)
  );

  debug('initializeLayers:', {
    combatantCount: combatantsWithLayers.length,
    totalActions: combatantsWithLayers.reduce((sum, c) => sum + c._layeredActions.length, 0),
  });

  return {
    ...state,
    combatants: combatantsWithLayers,
  };
}

/**
 * Erweitert einen einzelnen Combatant mit Layer-Daten.
 * Fuegt _layeredActions und combatState.effectLayers hinzu.
 */
export function augmentWithLayers(
  combatant: Combatant,
  alliances: Record<string, string[]>
): CombatantWithLayers {
  const position = getPosition(combatant);
  const actions = getCombatEvents(combatant);

  const layeredActions = actions.map(action => {
    const layerData = buildActionLayerData(
      combatant.id,
      action,
      position
    );
    return { ...action, _layer: layerData } as ActionWithLayer;
  });

  const effectLayers = buildEffectLayers(combatant, alliances);

  debug('augmentWithLayers:', {
    combatantId: combatant.id,
    actionCount: layeredActions.length,
    effectLayerCount: effectLayers.length,
  });

  return {
    ...combatant,
    _layeredActions: layeredActions,
    combatState: {
      ...combatant.combatState,
      effectLayers,
    },
  } as CombatantWithLayers;
}

/**
 * Erstellt ActionLayerData fuer eine einzelne CombatEvent.
 * Berechnet Range, Grid-Coverage (keine Target-Resolution).
 */
export function buildActionLayerData(
  participantId: string,
  action: CombatEvent,
  position: GridPosition
): ActionLayerData {
  const actionId = action.id ?? action.name ?? 'unknown';
  const sourceKey = `${participantId}:${actionId}`;

  // Range-Berechnung aus targeting.range (neues Schema)
  const targetingRange = action.targeting?.range;
  const maxRangeFeet = targetingRange?.type === 'ranged'
    ? targetingRange.long ?? targetingRange.normal ?? 5
    : targetingRange?.distance ?? 5;
  const normalRangeFeet = targetingRange?.type === 'ranged'
    ? targetingRange.normal ?? 5
    : targetingRange?.distance ?? 5;
  const rangeCells = feetToCell(maxRangeFeet);
  const normalRangeCells = feetToCell(normalRangeFeet);

  // Grid-Coverage (Cells die von dieser Position aus erreichbar sind)
  const grid = new Map<string, CellRangeData>();
  for (let dx = -rangeCells; dx <= rangeCells; dx++) {
    for (let dy = -rangeCells; dy <= rangeCells; dy++) {
      const cell: GridPosition = {
        x: position.x + dx,
        y: position.y + dy,
        z: position.z,
      };
      const distance = getDistance(position, cell);

      if (distance <= rangeCells) {
        const inNormalRange = distance <= normalRangeCells;
        grid.set(positionToKey(cell), {
          inRange: true,
          inNormalRange,
          distance,
        });
      }
    }
  }

  return {
    sourceKey,
    rangeCells,
    normalRangeCells: normalRangeCells !== rangeCells ? normalRangeCells : undefined,
    sourcePosition: { ...position },
    grid,
    againstTarget: new Map(),
  };
}

/**
 * Erstellt Effect-Layers basierend auf Combatant-Traits.
 * Z.B. Pack Tactics fuer Goblins, Sneak Attack Conditions.
 *
 * NOTE: Die meisten Effects (Pack Tactics, Long Range, Cover) werden bereits
 * durch das situationalModifiers Plugin-System gehandhabt. Diese Funktion
 * dient als zusaetzliche Layer fuer Combatant-spezifische Effects die nicht
 * durch die globalen Modifier abgedeckt sind.
 */
export function buildEffectLayers(
  combatant: Combatant,
  alliances: Record<string, string[]>
): EffectLayerData[] {
  const effectLayers: EffectLayerData[] = [];
  const actions = getCombatEvents(combatant);
  const groupId = getGroupId(combatant);

  // Pruefe Actions auf spezielle Traits via Namen
  for (const action of actions) {
    const actionNameLower = action.name?.toLowerCase() ?? '';

    // Pack Tactics: Advantage wenn Ally adjacent zu Target
    // NOTE: Bereits in modifiers/packTactics.ts implementiert, aber hier
    // als Effect-Layer fuer direkten Zugriff via collectActiveEffects()
    if (actionNameLower.includes('pack tactics')) {
      effectLayers.push({
        effectId: 'pack-tactics',
        effectType: 'advantage',
        range: Infinity, // Unbegrenzt
        condition: { type: 'ally-adjacent-to-target' },
        isActiveAt: (attackerPos, targetPos, state) =>
          hasAllyAdjacentToTarget(attackerPos, targetPos, groupId, state),
      });
      break; // Nur einmal pro Combatant hinzufuegen
    }

    // Sneak Attack: Advantage wenn Ally adjacent ODER Advantage from other source
    if (actionNameLower.includes('sneak attack')) {
      effectLayers.push({
        effectId: 'sneak-attack',
        effectType: 'advantage',
        range: Infinity,
        condition: { type: 'ally-adjacent-to-target' },
        isActiveAt: (attackerPos, targetPos, state) =>
          hasAllyAdjacentToTarget(attackerPos, targetPos, groupId, state),
      });
      break; // Nur einmal pro Combatant hinzufuegen
    }
  }

  // Reaction Effect Layers aus trigger.type === 'reaction' (neues Schema)
  for (const action of actions) {
    const isReaction = action.trigger?.type === 'reaction';
    if (!isReaction) continue;

    const triggerEvent = action.trigger.event;
    if (!triggerEvent) continue;

    const reactionLayer = buildReactionEffectLayer(combatant, action, triggerEvent);
    if (reactionLayer) {
      effectLayers.push(reactionLayer);
    }
  }

  return effectLayers;
}

/**
 * Erstellt ein Reaction Effect Layer aus einer CombatEvent mit trigger.type === 'reaction'.
 * Leitet Range (Reach) und Trigger-Condition aus dem CombatEvent-Schema ab.
 */
function buildReactionEffectLayer(
  combatant: Combatant,
  action: CombatEvent,
  triggerEvent: TriggerEvent
): EffectLayerData | null {
  // Reach aus CombatEvent-Schema ableiten
  // Fuer Melee-Reactions (OA): range.normal ist die Reach in Feet
  // Fuer andere: Default 5ft (Adjacent)
  const rangeFeet = action.range.type === 'reach'
    ? action.range.normal
    : 5;
  const rangeCells = feetToCell(rangeFeet);

  debug('buildReactionEffectLayer:', {
    combatantId: combatant.id,
    actionId: action.id,
    triggerEvent,
    rangeCells,
  });

  return {
    effectId: `reaction:${action.id}`,
    effectType: 'reaction',
    range: rangeCells,
    condition: { type: 'trigger', event: triggerEvent },
    reactionAction: action,
    isActiveAt: (reactorPos, triggerSourcePos, _state) => {
      // Trigger-spezifische Pruefung:
      // - leaves-reach: Source muss in Reach sein (Distanz pruefen)
      // - attacked/spell-cast/damaged: Globale Trigger (immer true, wenn Event passt)
      switch (triggerEvent) {
        case 'leaves-reach':
        case 'enters-reach':
          // Pruefe ob Source in Reach des Reactors ist
          return getDistance(reactorPos, triggerSourcePos) <= rangeCells;
        case 'attacked':
        case 'damaged':
        case 'spell-cast':
        case 'ally-attacked':
        case 'ally-damaged':
          // Globale Trigger - keine Position-Pruefung noetig
          // (Die eigentliche Event-Detection passiert extern)
          return true;
        default:
          return false;
      }
    },
  };
}

// ============================================================================
// EFFECT HELPER FUNCTIONS
// ============================================================================

/**
 * Prueft ob ein Ally adjacent (innerhalb 1 Cell) zum Target ist.
 * Fuer Pack Tactics und Sneak Attack.
 * Note: Accepts LayerStateBase for callback compatibility, casts internally.
 */
function hasAllyAdjacentToTarget(
  _attackerPos: GridPosition,
  targetPos: GridPosition,
  attackerGroupId: string,
  state: { alliances: Record<string, string[]>; combatants?: CombatantWithLayers[] }
): boolean {
  // State must have combatants for this check
  if (!state.combatants) return false;

  for (const combatant of state.combatants) {
    const combatantGroupId = getGroupId(combatant);
    if (!isAllied(attackerGroupId, combatantGroupId, state.alliances)) continue;

    const combatantPos = getPosition(combatant);
    const distance = getDistance(combatantPos, targetPos);
    if (distance <= 1) {
      debug('hasAllyAdjacentToTarget:', {
        allyId: combatant.id,
        targetPos,
        distance,
        result: true,
      });
      return true;
    }
  }
  return false;
}
