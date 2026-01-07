// Ziel: ThreatMap-Queries fuer Position-Bewertung
// Siehe: docs/services/combatantAI/buildThreatMap.md
//
// Kombiniert:
// - Threat: getThreatAt() + OA-Kosten fuer den Pfad
// - Support: getSupportAt() fuer Ally-Healing

import type {
  GridPosition,
  Combatant,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  FinalResolvedData,
  ActionWithLayer,
  ThreatMapEntry,
  LayerFilter,
} from '@/types/combat';
import { positionToKey, getExpectedValue, diceExpressionToPMF, addConstant } from '@/utils';
import { getFullResolution } from './effectApplication';
import { calculateExpectedReactionCost } from './reactionLayers';
import { isHostile, isAllied, getDistance } from '../helpers/combatHelpers';
import { getGroupId, getPosition, getHP, getMaxHP } from '../../combatTracking';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[layers/threatMap]', ...args);
  }
};

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Berechnet Threat-Score fuer eine Cell.
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
 * Findet die gefaehrlichste Action fuer eine Cell.
 * Fuer Debugging und taktische Analyse.
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
 * Prueft welche Actions von einer Cell aus moeglich sind.
 * Inkl. Target-Resolution fuer alle erreichbaren Ziele.
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
// THREAT MAP API
// ============================================================================

/**
 * Berechnet Support-Score fuer eine Cell (Ally-Heilung/Buff-Potential).
 * Analog zu getThreatAt(), aber fuer positive Effekte von Allies.
 *
 * @param cell Ziel-Cell
 * @param viewer Der Combatant fuer den Support berechnet wird
 * @param state Combat State mit Layer-Daten
 * @returns Support-Score (positiv = gut)
 */
export function getSupportAt(
  cell: GridPosition,
  viewer: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number {
  let totalSupport = 0;
  const cellKey = positionToKey(cell);
  const viewerGroupId = getGroupId(viewer);
  const viewerHP = getExpectedValue(getHP(viewer));
  const viewerMaxHP = getMaxHP(viewer);
  const hpRatio = viewerHP / Math.max(1, viewerMaxHP);

  for (const combatant of state.combatants) {
    // Nur Allies
    const combatantGroupId = getGroupId(combatant);
    if (!isAllied(viewerGroupId, combatantGroupId, state.alliances)) continue;
    if (combatant.id === viewer.id) continue; // Skip self

    for (const action of combatant._layeredActions) {
      // Healing-Actions
      if (action.healing) {
        const rangeData = action._layer.grid.get(cellKey);
        if (!rangeData?.inRange) continue;

        // Healing-Potential gewichtet nach HP-Verlust
        const healDice = diceExpressionToPMF(action.healing.dice);
        const expectedHeal = getExpectedValue(addConstant(healDice, action.healing.modifier ?? 0));

        // Hoehere Prioritaet bei niedrigerer HP
        const hpWeighting = 1 - hpRatio;
        totalSupport += expectedHeal * hpWeighting;
      }

      // TODO: Buff-Auren (effects mit targetAlly)
    }
  }

  return totalSupport;
}

/**
 * Berechnet ThreatMap fuer alle erreichbaren Cells.
 * Kombiniert:
 * - Threat: getThreatAt() + OA-Kosten fuer den Pfad
 * - Support: getSupportAt() fuer Ally-Healing
 *
 * Wird einmal pro Turn am Start berechnet.
 *
 * @param combatant Der aktive Combatant
 * @param state Combat State mit Layer-Daten
 * @param reachableCells Alle erreichbaren Positionen
 * @param currentPos Aktuelle Position (fuer Pfad-Kosten)
 * @returns Map von Cell-Key zu ThreatMapEntry
 */
export function buildThreatMap(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  reachableCells: GridPosition[],
  currentPos: GridPosition
): Map<string, ThreatMapEntry> {
  const threatMap = new Map<string, ThreatMapEntry>();

  for (const cell of reachableCells) {
    const cellKey = positionToKey(cell);

    // 1. Base Threat (Gegner-Schaden an dieser Position)
    const baseThreat = getThreatAt(cell, combatant, state);

    // 2. Pfad-Kosten (OA-Risiko von currentPos zu dieser Cell)
    const isCurrentPos = cell.x === currentPos.x && cell.y === currentPos.y && cell.z === currentPos.z;
    const pathCost = isCurrentPos
      ? 0
      : calculateExpectedReactionCost(combatant, currentPos, cell, state);

    // 3. Gesamte Threat (negativ)
    const threat = -(baseThreat + pathCost);

    // 4. Support (positiv)
    const support = getSupportAt(cell, combatant, state);

    // 5. Net Score
    const net = threat + support;

    threatMap.set(cellKey, { threat, support, net });
  }

  debug('buildThreatMap:', {
    combatantId: combatant.id,
    cellCount: reachableCells.length,
    mapSize: threatMap.size,
  });

  return threatMap;
}
