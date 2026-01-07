// Ziel: Layer-Erweiterung für Action/Effect Schemas
// Siehe: docs/research/influence-maps.md
//
// Architektur:
// - Bestehende Action/Trait Schemas mit _layer-Daten erweitern
// - Layer-Daten bei Combat-Start initialisieren
// - Target-Resolved Data on-demand berechnen und cachen
//
// Pipeline-Position:
// - Aufgerufen von: difficulty.simulatePMF() → initializeLayers()
// - Aufgerufen von: turnExecution.executeTurn() → buildEscapeDangerMap(), getThreatAt()
// - Aufgerufen von: actionScoring.ts → getAvailableActionsAt()
// - Output: CombatStateWithLayers, DangerMap, Threat-Scores

import type { Action } from '@/types/entities';
import type { TriggerEvent } from '@/constants/action';
import type {
  GridPosition,
  ProbabilityDistribution,
  // Combatant Types
  Combatant,
  CombatantSimulationState,
  CombatState,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  CombatStateWithLayers,
  // Layer System Types
  CellRangeData,
  BaseResolvedData,
  FinalResolvedData,
  ActionLayerData,
  ActionWithLayer,
  EffectCondition,
  EffectLayerData,
  LayerFilter,
  // Reaction Types
  ReactionContext,
  ReactionResult,
} from '@/types/combat';
import {
  hasLayerData,
  combatantHasLayers,
} from '@/types/combat';
import {
  feetToCell,
  positionToKey,
  getExpectedValue,
  diceExpressionToPMF,
  addConstant,
  calculateEffectiveDamage,
  getRelevantCells,
  getOffsetPattern,
  calculateMovementDecay,
} from '@/utils';
import {
  getDistance,
  isHostile,
  isAllied,
  calculateHitChance,
  getActionMaxRangeCells,
} from './combatHelpers';
import {
  evaluateSituationalModifiers,
  type ModifierContext,
  type CombatantContext,
} from './situationalModifiers';
import { getEnemies } from './actionSelection';
import { calculateEffectiveDamagePotential } from './combatHelpers';
import { getMaxAttackRange } from './actionScoring';
import {
  getGroupId,
  getPosition,
  getActions,
  getSpeed,
  getAC,
  getHP,
  getConditions,
  getCombatantType,
} from '../combatTracking';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[influenceMaps]', ...args);
  }
};

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Layer System Types sind jetzt in @/types/combat definiert
export type {
  CellRangeData,
  BaseResolvedData,
  FinalResolvedData,
  ActionLayerData,
  ActionWithLayer,
  EffectCondition,
  EffectLayerData,
  LayerFilter,
  // Combatant Types
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  CombatStateWithLayers,
} from '@/types/combat';
export { hasLayerData, combatantHasLayers } from '@/types/combat';

// ============================================================================
// LAYER INITIALIZATION (Combat-Start)
// ============================================================================

/**
 * Erweitert alle Combatants mit Layer-Daten.
 * @returns State mit Layer-erweiterten Combatants (erhält alle anderen Felder)
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
 * Fügt _layeredActions und combatState.effectLayers hinzu.
 */
export function augmentWithLayers(
  combatant: Combatant,
  alliances: Record<string, string[]>
): CombatantWithLayers {
  const position = getPosition(combatant);
  const actions = getActions(combatant);
  const groupId = getGroupId(combatant);

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
 * Erstellt ActionLayerData für eine einzelne Action.
 * Berechnet Range, Grid-Coverage (keine Target-Resolution).
 */
export function buildActionLayerData(
  participantId: string,
  action: Action,
  position: GridPosition
): ActionLayerData {
  const actionId = action.id ?? action.name ?? 'unknown';
  const sourceKey = `${participantId}:${actionId}`;

  // Range-Berechnung
  const maxRangeFeet = action.range?.long ?? action.range?.normal ?? 5;
  const normalRangeFeet = action.range?.normal ?? 5;
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
 * Z.B. Pack Tactics für Goblins, Sneak Attack Conditions.
 *
 * NOTE: Die meisten Effects (Pack Tactics, Long Range, Cover) werden bereits
 * durch das situationalModifiers Plugin-System gehandhabt. Diese Funktion
 * dient als zusätzliche Layer für Combatant-spezifische Effects die nicht
 * durch die globalen Modifier abgedeckt sind.
 */
export function buildEffectLayers(
  combatant: Combatant,
  alliances: Record<string, string[]>
): EffectLayerData[] {
  const effectLayers: EffectLayerData[] = [];
  const actions = getActions(combatant);
  const groupId = getGroupId(combatant);

  // Prüfe Actions auf spezielle Traits via Namen
  for (const action of actions) {
    const actionNameLower = action.name?.toLowerCase() ?? '';

    // Pack Tactics: Advantage wenn Ally adjacent zu Target
    // NOTE: Bereits in modifiers/packTactics.ts implementiert, aber hier
    // als Effect-Layer für direkten Zugriff via collectActiveEffects()
    if (actionNameLower.includes('pack tactics')) {
      effectLayers.push({
        effectId: 'pack-tactics',
        effectType: 'advantage',
        range: Infinity, // Unbegrenzt
        condition: { type: 'ally-adjacent-to-target' },
        isActiveAt: (attackerPos, targetPos, state) =>
          hasAllyAdjacentToTarget(attackerPos, targetPos, groupId, state),
      });
      break; // Nur einmal pro Combatant hinzufügen
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
      break; // Nur einmal pro Combatant hinzufügen
    }
  }

  // Reaction Effect Layers aus timing.type === 'reaction'
  for (const action of actions) {
    if (action.timing.type !== 'reaction') continue;

    const triggerEvent = action.timing.triggerCondition?.event;
    if (!triggerEvent) continue;

    const reactionLayer = buildReactionEffectLayer(combatant, action, triggerEvent);
    if (reactionLayer) {
      effectLayers.push(reactionLayer);
    }
  }

  return effectLayers;
}

/**
 * Erstellt ein Reaction Effect Layer aus einer Action mit timing.type === 'reaction'.
 * Leitet Range (Reach) und Trigger-Condition aus dem Action-Schema ab.
 */
function buildReactionEffectLayer(
  combatant: Combatant,
  action: Action,
  triggerEvent: TriggerEvent
): EffectLayerData | null {
  // Reach aus Action-Schema ableiten
  // Für Melee-Reactions (OA): range.normal ist die Reach in Feet
  // Für andere: Default 5ft (Adjacent)
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
      // Trigger-spezifische Prüfung:
      // - leaves-reach: Source muss in Reach sein (Distanz prüfen)
      // - attacked/spell-cast/damaged: Globale Trigger (immer true, wenn Event passt)
      switch (triggerEvent) {
        case 'leaves-reach':
        case 'enters-reach':
          // Prüfe ob Source in Reach des Reactors ist
          return getDistance(reactorPos, triggerSourcePos) <= rangeCells;
        case 'attacked':
        case 'damaged':
        case 'spell-cast':
        case 'ally-attacked':
        case 'ally-damaged':
          // Globale Trigger - keine Position-Prüfung nötig
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
 * Prüft ob ein Ally adjacent (innerhalb 1 Cell) zum Target ist.
 * Für Pack Tactics und Sneak Attack.
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

// ============================================================================
// BASE RESOLUTION (Cached by combatantType - keine situativen Modifier)
// ============================================================================

/**
 * Berechnet Base-Resolution für Action gegen Target-Typ.
 * Enthält nur deterministische Werte - keine situativen Modifier.
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

  // Base Damage PMF (Würfel ohne Hit-Chance)
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
 * Pre-Computed alle Base Resolutions für schnelleren Zugriff.
 * Iteriert über alle (CombatantType, Action, TargetType) Kombinationen.
 * Identische CombatantTypes (z.B. alle Goblins) teilen Cache-Einträge.
 *
 * @param state State mit Layer-erweiterten Combatants
 */
export function precomputeBaseResolutions(
  state: CombatStateWithLayers
): void {
  // 1. Unique Target-Types sammeln (combatantType → Representative Combatant)
  const targetTypes = new Map<string, CombatantWithLayers>();
  for (const combatant of state.combatants) {
    const type = getCombatantType(combatant);
    if (!targetTypes.has(type)) {
      targetTypes.set(type, combatant);
    }
  }

  // 2. Für jede Action jedes Combatants: Resolve gegen alle Target-Types
  let resolutionCount = 0;
  for (const combatant of state.combatants) {
    for (const action of combatant._layeredActions) {
      for (const representative of targetTypes.values()) {
        // getBaseResolution() befüllt action._layer.againstTarget Cache
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

  // Effect Layers prüfen (Pack Tactics etc.)
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
 * Nutzt Cache für Base, berechnet Effects dynamisch.
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
 * Sammelt alle aktiven Effects für einen Attack.
 * Prüft Effect-Layer-Conditions (Pack Tactics, Flanking, Cover).
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
 * Prüft ob ein Effect an einer Position aktiv ist.
 */
export function isEffectActiveAt(
  effect: EffectLayerData,
  attackerPosition: GridPosition,
  targetPosition: GridPosition,
  state: CombatantSimulationStateWithLayers
): boolean {
  return effect.isActiveAt(attackerPosition, targetPosition, state);
}

// ============================================================================
// POSITION UPDATES
// ============================================================================

/**
 * Aktualisiert Layer-Daten nach Combatant-Bewegung.
 * - Aktualisiert sourcePosition in allen action._layer
 * - Invalidiert action._layer.againstTarget (Positionen geändert)
 */
export function updateLayersForMovement(
  combatant: CombatantWithLayers,
  newPosition: GridPosition
): void {
  for (const action of combatant._layeredActions) {
    // Update source position
    action._layer.sourcePosition = { ...newPosition };

    // Rebuild grid coverage
    const rangeCells = action._layer.rangeCells;
    const normalRangeCells = action._layer.normalRangeCells ?? rangeCells;

    action._layer.grid.clear();
    for (let dx = -rangeCells; dx <= rangeCells; dx++) {
      for (let dy = -rangeCells; dy <= rangeCells; dy++) {
        const cell: GridPosition = {
          x: newPosition.x + dx,
          y: newPosition.y + dy,
          z: newPosition.z,
        };
        const distance = getDistance(newPosition, cell);

        if (distance <= rangeCells) {
          const inNormalRange = distance <= normalRangeCells;
          action._layer.grid.set(positionToKey(cell), {
            inRange: true,
            inNormalRange,
            distance,
          });
        }
      }
    }

    // Invalidate target cache
    action._layer.againstTarget.clear();
  }

  // Update combatant position
  combatant.combatState.position = { ...newPosition };

  debug('updateLayersForMovement:', {
    combatantId: combatant.id,
    newPosition,
    actionsUpdated: combatant._layeredActions.length,
  });
}

/**
 * Invalidiert alle Target-Resolved Caches für einen Combatant.
 * Rufen nach Bewegung oder Status-Änderung auf.
 */
export function invalidateTargetCache(
  combatant: CombatantWithLayers
): void {
  for (const action of combatant._layeredActions) {
    action._layer.againstTarget.clear();
  }

  debug('invalidateTargetCache:', {
    combatantId: combatant.id,
    actionsCleared: combatant._layeredActions.length,
  });
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Berechnet Threat-Score für eine Cell.
 * Summiert Damage-Potential aller feindlichen Actions die diese Cell erreichen.
 */
export function getThreatAt(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  filter?: LayerFilter
): number {
  let totalThreat = 0;
  const cellKey = positionToKey(cell);
  const viewerGroupId = getGroupId(viewer);

  for (const combatant of state.combatants) {
    // Skip Allies
    const combatantGroupId = getGroupId(combatant);
    if (isAllied(viewerGroupId, combatantGroupId, state.alliances)) continue;

    for (const action of combatant._layeredActions) {
      // Skip non-damage actions
      if (!action.damage) continue;

      // Apply filter
      if (filter && !filter(action)) continue;

      // Check if this action can reach the cell
      const rangeData = action._layer.grid.get(cellKey);
      if (!rangeData?.inRange) continue;

      // Get or resolve target data against viewer
      const resolved = getFullResolution(action, combatant, viewer, state);
      const expectedDamage = getExpectedValue(resolved.effectiveDamagePMF);

      totalThreat += expectedDamage;
    }
  }

  debug('getThreatAt:', {
    cell,
    viewerId: viewer.id,
    totalThreat,
  });

  return totalThreat;
}

/**
 * Findet die gefährlichste Action für eine Cell.
 * Für Debugging und taktische Analyse.
 */
export function getDominantThreat(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): { action: ActionWithLayer; attacker: CombatantWithLayers; resolved: FinalResolvedData } | null {
  let dominantThreat: { action: ActionWithLayer; attacker: CombatantWithLayers; resolved: FinalResolvedData } | null = null;
  let maxDamage = 0;
  const cellKey = positionToKey(cell);
  const viewerGroupId = getGroupId(viewer);

  for (const combatant of state.combatants) {
    // Skip Allies
    const combatantGroupId = getGroupId(combatant);
    if (isAllied(viewerGroupId, combatantGroupId, state.alliances)) continue;

    for (const action of combatant._layeredActions) {
      // Skip non-damage actions
      if (!action.damage) continue;

      // Check if this action can reach the cell
      const rangeData = action._layer.grid.get(cellKey);
      if (!rangeData?.inRange) continue;

      // Get or resolve target data against viewer
      const resolved = getFullResolution(action, combatant, viewer, state);
      const expectedDamage = getExpectedValue(resolved.effectiveDamagePMF);

      if (expectedDamage > maxDamage) {
        maxDamage = expectedDamage;
        dominantThreat = { action, attacker: combatant, resolved };
      }
    }
  }

  debug('getDominantThreat:', {
    cell,
    viewerId: viewer.id,
    dominant: dominantThreat ? {
      attacker: dominantThreat.attacker.id,
      action: dominantThreat.action.name,
      damage: maxDamage,
    } : null,
  });

  return dominantThreat;
}

/**
 * Prüft welche Actions von einer Cell aus möglich sind.
 * Inkl. Target-Resolution für alle erreichbaren Ziele.
 */
export function getAvailableActionsAt(
  cell: GridPosition,
  attacker: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): Array<{ action: ActionWithLayer; targets: FinalResolvedData[] }> {
  const result: Array<{ action: ActionWithLayer; targets: FinalResolvedData[] }> = [];
  const attackerGroupId = getGroupId(attacker);

  for (const action of attacker._layeredActions) {
    // Skip non-damage actions for now
    if (!action.damage) continue;

    const targets: FinalResolvedData[] = [];

    // Find all enemies in range from this cell
    for (const combatant of state.combatants) {
      // Skip Allies
      const combatantGroupId = getGroupId(combatant);
      if (isAllied(attackerGroupId, combatantGroupId, state.alliances)) continue;

      // Check distance from the hypothetical cell to target
      const targetPosition = getPosition(combatant);
      const distance = getDistance(cell, targetPosition);
      if (distance > action._layer.rangeCells) continue;

      // Create a temporary combatant with the new position for modifier evaluation
      const tempAttacker: CombatantWithLayers = {
        ...attacker,
        combatState: {
          ...attacker.combatState,
          position: cell,
        },
      };

      // Resolve against target
      const resolved = getFullResolution(action, tempAttacker, combatant, state);
      targets.push(resolved);
    }

    if (targets.length > 0) {
      result.push({ action, targets });
    }
  }

  debug('getAvailableActionsAt:', {
    cell,
    attackerId: attacker.id,
    actionCount: result.length,
    totalTargets: result.reduce((sum, r) => sum + r.targets.length, 0),
  });

  return result;
}

// ============================================================================
// DEBUG & VISUALIZATION
// ============================================================================

/**
 * ASCII-Heatmap für Action-Range.
 */
export function visualizeActionRange(
  action: ActionWithLayer,
  center: GridPosition,
  radius: number
): string {
  const lines: string[] = [];
  const sourcePos = action._layer.sourcePosition;

  lines.push(`Action: ${action.name ?? action.id} (Range: ${action._layer.rangeCells} cells)`);
  lines.push(`Source: (${sourcePos.x}, ${sourcePos.y})`);
  lines.push('');

  for (let dy = -radius; dy <= radius; dy++) {
    let line = '';
    for (let dx = -radius; dx <= radius; dx++) {
      const cell: GridPosition = {
        x: center.x + dx,
        y: center.y + dy,
        z: center.z,
      };
      const cellKey = positionToKey(cell);
      const rangeData = action._layer.grid.get(cellKey);

      if (cell.x === sourcePos.x && cell.y === sourcePos.y) {
        line += 'S '; // Source
      } else if (!rangeData?.inRange) {
        line += '. ';
      } else if (rangeData.inNormalRange) {
        line += '# '; // Normal range
      } else {
        line += 'o '; // Long range
      }
    }
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Debug-Ausgabe für Target-Resolution.
 */
export function explainTargetResolution(
  resolved: FinalResolvedData
): string {
  const lines: string[] = [];

  lines.push(`Target: ${resolved.targetId}`);
  lines.push(`Hit Chance: ${(resolved.finalHitChance * 100).toFixed(1)}%`);
  lines.push(`Base Hit Chance: ${(resolved.base.baseHitChance * 100).toFixed(1)}%`);
  lines.push(`Attack Bonus: +${resolved.base.attackBonus}`);
  lines.push(`Net Advantage: ${resolved.netAdvantage}`);
  lines.push(`Expected Damage: ${getExpectedValue(resolved.effectiveDamagePMF).toFixed(1)}`);
  lines.push(`Active Effects: ${resolved.activeEffects.join(', ') || 'none'}`);

  return lines.join('\n');
}

// ============================================================================
// ESCAPE DANGER CALCULATION
// ============================================================================

/**
 * Vorberechnete Enemy-Daten fuer Batch-Danger-Berechnung.
 * Alle Felder sind invariant pro Turn (aendern sich nicht pro Cell).
 */
interface CachedEnemyData {
  position: GridPosition;
  damage: number;         // calculateEffectiveDamagePotential
  maxRange: number;       // getMaxAttackRange
  movement: number;       // feetToCell(speed.walk)
  targetingProb: number;  // 1 / validTargetsForEnemy
}

/**
 * Berechnet Danger-Scores fuer alle Cells in einem Batch.
 * Optimierung: Enemy-Daten werden einmal vorberechnet und wiederverwendet.
 *
 * @param cells Alle Cells fuer die Danger berechnet werden soll
 * @param combatant Eigener Combatant (fuer AC)
 * @param state CombatantSimulationState
 * @returns Map von Cell-Key zu Danger-Score
 */
export function calculateDangerScoresBatch(
  cells: GridPosition[],
  combatant: Combatant,
  state: CombatantSimulationState
): Map<string, number> {
  const dangerMap = new Map<string, number>();

  // Phase 1: Enemy-Daten einmal vorberechnen (O(E))
  const enemies = getEnemies(combatant, state);
  const cachedEnemies: CachedEnemyData[] = enemies.map(enemy => {
    const damage = calculateEffectiveDamagePotential(getActions(enemy), getAC(combatant));
    const maxRange = getMaxAttackRange(enemy);
    const movement = feetToCell(getSpeed(enemy).walk ?? 30);

    // validTargetsForEnemy: Anzahl Targets in Reichweite (invariant)
    const validTargets = state.combatants.filter(c =>
      isHostile(getGroupId(enemy), getGroupId(c), state.alliances) &&
      getDistance(getPosition(enemy), getPosition(c)) <= maxRange
    ).length;
    const targetingProb = 1 / Math.max(1, validTargets);

    return {
      position: getPosition(enemy),
      damage,
      maxRange,
      movement,
      targetingProb,
    };
  });

  // Phase 2: Danger fuer alle Cells berechnen (O(C × E) mit O(1) pro Enemy)
  for (const cell of cells) {
    let totalDanger = 0;

    for (const enemy of cachedEnemies) {
      const distanceToEnemy = getDistance(cell, enemy.position);
      const dangerMultiplier = calculateMovementDecay(
        distanceToEnemy,
        enemy.maxRange,
        enemy.movement
      );
      totalDanger += enemy.damage * dangerMultiplier * enemy.targetingProb;
    }

    dangerMap.set(positionToKey(cell), totalDanger);
  }

  debug('calculateDangerScoresBatch:', {
    cellCount: cells.length,
    enemyCount: cachedEnemies.length,
  });

  return dangerMap;
}

/**
 * Berechnet Escape-Danger fuer alle relevanten Cells.
 * Optimiert: Danger-Scores werden einmal vorberechnet und gecached (O(M²) statt O(M⁴)).
 *
 * Fuer jede Cell: Was ist die minimale Danger, wenn wir optimal fluechten?
 * Ermoeglicht "Move in -> Attack -> Move out" Kiting-Pattern.
 *
 * @param combatant Eigener Combatant
 * @param state Simulation State
 * @param maxMovement Maximales Movement (fuer Escape-Radius)
 * @returns Map von Cell-Key zu Escape-Danger
 */
export function buildEscapeDangerMap(
  combatant: Combatant,
  state: CombatantSimulationState,
  maxMovement: number
): Map<string, number> {
  const escapeDangerMap = new Map<string, number>();
  const position = getPosition(combatant);

  // Alle Cells im erweiterten Bewegungsbereich (Movement + max Escape)
  const extendedRange = maxMovement * 2;  // Move + Escape
  const allCells = getRelevantCells(position, extendedRange);

  // Phase 1: Danger-Scores via Batch-Funktion (O(C × E) statt O(C × E × P))
  const dangerCache = calculateDangerScoresBatch(allCells, combatant, state);

  // Phase 2: Escape-Danger aus Cache berechnen
  // Radius-Filter: Nur erreichbare Cells evaluieren (Bug-Fix fuer korrekte Pruning-Schaetzung)
  // computeGlobalBestByType() soll nur erreichbare Cells fuer minDanger betrachten
  const reachableCells: GridPosition[] = [];
  const distanceFromStart = new Map<string, number>();
  for (const cell of allCells) {
    const distance = getDistance(position, cell);
    const key = positionToKey(cell);
    distanceFromStart.set(key, distance);
    if (distance <= maxMovement) {
      reachableCells.push(cell);
    }
  }

  for (const cell of reachableCells) {
    const cellKey = positionToKey(cell);
    const baseDanger = dangerCache.get(cellKey) ?? 0;

    // Wie weit koennen wir von hier fluechten? (aus Cache lesen)
    const distance = distanceFromStart.get(cellKey) ?? 0;
    const remainingMovement = Math.max(0, maxMovement - distance);

    if (remainingMovement <= 0) {
      // Kein Escape moeglich - volle Danger
      escapeDangerMap.set(cellKey, baseDanger);
      continue;
    }

    // Offset-Pattern statt getRelevantCells() - gecachtes Pattern wiederverwenden
    const offsets = getOffsetPattern(remainingMovement);
    let minDanger = baseDanger;

    for (const offset of offsets) {
      const escapeKey = `${cell.x + offset.dx},${cell.y + offset.dy},${cell.z}`;
      const danger = dangerCache.get(escapeKey);
      if (danger !== undefined && danger < minDanger) {
        minDanger = danger;
      }
    }

    escapeDangerMap.set(cellKey, minDanger);
  }

  debug('buildEscapeDangerMap:', {
    combatantId: combatant.id,
    maxMovement,
    dangerCacheSize: dangerCache.size,
    reachableCells: reachableCells.length,
    mapSize: escapeDangerMap.size,
  });

  return escapeDangerMap;
}

// ============================================================================
// REACTION LAYER API
// ============================================================================

/**
 * Findet alle Reaction-Layers die für einen Trigger-Event relevant sind.
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
 * Prüft ob Bewegung von fromCell nach toCell einen Reaction-Trigger auslöst.
 * Spezialisiert auf 'leaves-reach' Trigger (Opportunity Attacks).
 *
 * @param mover Der sich bewegende Combatant
 * @param fromCell Startposition
 * @param toCell Zielposition
 * @param reactor Der potentielle Reactor
 * @param state Combat State
 * @param hasDisengage Ob Disengage aktiv ist (verhindert leaves-reach)
 * @returns true wenn der Trigger ausgelöst wird
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

  // Prüfe ob Reactor hostile ist
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

  // Für leaves-reach: Prüfe ob wir IN der Reach waren und sie VERLASSEN
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

  // Für andere Trigger: Prüfe isActiveAt
  for (const layer of reactionLayers) {
    if (layer.isActiveAt(reactorPosition, fromCell, state)) {
      return true;
    }
  }

  return false;
}

/**
 * Berechnet erwartete Reaction-Kosten für eine Bewegung.
 * Summiert Schaden aller Feinde die 'leaves-reach' triggern könnten.
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

    // Prüfe ob Reaction getriggert wird
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

// Re-export Reaction Types
export type { ReactionContext, ReactionResult } from '@/types/combat';
