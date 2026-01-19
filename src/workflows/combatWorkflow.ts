// Ziel: State-Owner fuer Combat-Aktionen - orchestriert Resolution und wendet Ergebnisse an
// Siehe: docs/orchestration/CombatWorkflow.md
//
// ============================================================================
// ⚠️ ON HOLD - Combat-Implementierung ist vorübergehend pausiert.
// Diese Datei wird aktuell nicht verwendet.
// ============================================================================
//
// Architektur-Trennung (per CLAUDE.md):
// - combatTracking/ (READ-ONLY Service): findTargets, getModifiers, determineSuccess, resolveEffects
// - combatWorkflow (WRITE): runAction, applyResult
//
// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: Full Combat Workflow implementieren
// - startCombat(), endCombat(), nextTurn() etc.
// - Aktuell nur Action-Execution implementiert

import type { CombatEvent } from '@/types/entities/combatEvent';
import type {
  Combatant,
  CombatState,
  CombatStateWithLayers,
  CombatantWithLayers,
  ResolutionContext,
  ResolutionResult,
  TriggerType,
  GridPosition,
  TurnAction,
  ManualRollData,
} from '@/types/combat';
import { resolveAction } from '@/services/combatTracking/resolution';
import {
  setHP,
  setPosition,
  addCondition,
  removeCondition,
  setConcentration,
  markDeadCombatants,
  getPosition,
  advanceTurn,
  createTurnBudget,
} from '@/services/combatTracking';
import { createSingleValue } from '@/utils/probability/pmf';
import { selectNextAction } from '@/services/combatantAI';
import { consumeActionCost } from '@/services/combatantAI/helpers/actionAvailability';
import { loadEncounterPreset } from '@/services/encounterLoader';
import { getEncounterPresetById, encounterPresets } from 'presets/encounters';
import { getMapConfigForScenario } from 'presets/combatMaps';

// ============================================================================
// TYPES
// ============================================================================

/** Input for runAction - wraps TurnAction with explicit actorId */
export interface RunActionInput {
  actorId: string;
  turnAction: TurnAction;
  /** Manual roll data from GM (bypasses probabilistic calculation) */
  manualRolls?: ManualRollData;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Finds a combatant by ID in state.
 */
function findCombatant(state: CombatState, id: string): Combatant | undefined {
  return state.combatants.find(c => c.id === id);
}

/**
 * Applies forced movement to a combatant.
 * Calculates new position based on movement type and direction.
 */
function applyForcedMovement(
  state: CombatState,
  targetId: string,
  type: 'push' | 'pull' | 'slide',
  distance: number,
  sourcePosition?: GridPosition
): void {
  const target = findCombatant(state, targetId);
  if (!target) return;

  const currentPos = getPosition(target);
  if (!sourcePosition) {
    // No source position - cannot calculate direction
    return;
  }

  // Calculate direction vector
  const dx = currentPos.x - sourcePosition.x;
  const dy = currentPos.y - sourcePosition.y;
  const magnitude = Math.max(Math.abs(dx), Math.abs(dy));

  if (magnitude === 0) return;

  // Normalize direction
  const dirX = dx / magnitude;
  const dirY = dy / magnitude;

  // Calculate movement in cells (distance is in feet, 1 cell = 5 feet)
  const cells = Math.floor(distance / 5);

  let newX = currentPos.x;
  let newY = currentPos.y;

  switch (type) {
    case 'push':
      // Move away from source
      newX = currentPos.x + Math.round(dirX * cells);
      newY = currentPos.y + Math.round(dirY * cells);
      break;
    case 'pull':
      // Move toward source
      newX = currentPos.x - Math.round(dirX * cells);
      newY = currentPos.y - Math.round(dirY * cells);
      break;
    case 'slide':
      // Perpendicular movement (default to positive perpendicular)
      newX = currentPos.x + Math.round(-dirY * cells);
      newY = currentPos.y + Math.round(dirX * cells);
      break;
  }

  setPosition(target, { x: newX, y: newY, z: currentPos.z }, state);
}

/**
 * Breaks concentration for a combatant.
 * Removes the concentration spell and any effects caused by it.
 */
function breakConcentration(combatant: Combatant, state: CombatState): void {
  const concentratingOn = combatant.combatState.concentratingOn;
  if (!concentratingOn) return;

  // Clear concentration
  setConcentration(combatant, undefined);

  // Remove conditions caused by this concentration
  // (Conditions with sourceId matching the caster and concentration duration)
  for (const target of state.combatants) {
    const conditionsToRemove = target.combatState.conditions
      .filter(c =>
        c.sourceId === combatant.id &&
        c.duration?.type === 'concentration'
      )
      .map(c => c.name);

    for (const condName of conditionsToRemove) {
      removeCondition(target, condName);
    }
  }
}

/**
 * Creates a protocol entry from ResolutionResult and adds it to state.
 * Adapts ResolutionProtocolData to CombatProtocolEntry format.
 */
function writeProtocolEntry(
  state: CombatState,
  result: ResolutionResult,
  actor: Combatant,
  turnAction: TurnAction
): void {
  const protocolData = result.protocolData;
  const actorPosition = getPosition(actor);

  // Build notes array
  const notes: string[] = [];
  if (protocolData.critical) {
    notes.push('Critical hit');
  }
  if (protocolData.conditionsApplied.length > 0) {
    notes.push(`Applied: ${protocolData.conditionsApplied.join(', ')}`);
  }

  // Convert hpChanges to HPChange format
  const hpChanges = result.hpChanges.map(hc => ({
    combatantId: hc.combatantId,
    combatantName: hc.combatantName,
    delta: hc.change,
    source: hc.source as 'attack' | 'terrain' | 'reaction' | 'heal' | 'effect' | 'zone',
    sourceDetail: hc.damageType,
  }));

  state.protocol.push({
    round: protocolData.roundNumber,
    combatantId: protocolData.actorId,
    combatantName: protocolData.actorName,
    action: turnAction,
    damageDealt: protocolData.damageDealt,
    damageReceived: 0, // Not tracked in this direction
    healingDone: protocolData.healingDone,
    positionBefore: actorPosition,
    positionAfter: actorPosition, // Movement not tracked here
    notes,
    hpChanges,
    modifiersApplied: [], // Could be populated from modifier sources
  });
}

// ============================================================================
// STATE MUTATION (applyResult)
// ============================================================================

/**
 * Applies a ResolutionResult to CombatState.
 * This is the WRITE side of the architecture - mutates state based on resolution.
 *
 * Order of operations (per CombatWorkflow.md):
 * 1. HP changes
 * 2. Conditions add
 * 3. Conditions remove
 * 4. Forced movement
 * 5. Zone activation
 * 6. Concentration break
 * 7. Mark dead
 * 8. Protocol write
 */
export function applyResult(
  result: ResolutionResult,
  state: CombatState,
  actor: Combatant,
  turnAction: TurnAction
): void {
  const actorPosition = getPosition(actor);

  // 0. Consume action costs (ammunition, spell slots, etc.)
  // Costs are consumed when action is used, not when it hits (missed arrow still uses ammo)
  if (turnAction.type === 'action') {
    consumeActionCost(turnAction.action, actor);
  }

  // 1. HP changes
  for (const hpChange of result.hpChanges) {
    const combatant = findCombatant(state, hpChange.combatantId);
    if (combatant) {
      // Create PMF from expected HP value
      setHP(combatant, createSingleValue(hpChange.newHP));
    }
  }

  // 2. Conditions to add
  for (const condApp of result.conditionsToAdd) {
    const combatant = findCombatant(state, condApp.targetId);
    if (combatant) {
      addCondition(combatant, {
        ...condApp.condition,
        probability: condApp.probability,
      });
    }
  }

  // 3. Conditions to remove
  for (const condRem of result.conditionsToRemove) {
    const combatant = findCombatant(state, condRem.targetId);
    if (combatant) {
      removeCondition(combatant, condRem.conditionName);
    }
  }

  // 4. Forced movement
  for (const movement of result.forcedMovement) {
    applyForcedMovement(
      state,
      movement.targetId,
      movement.type,
      movement.distance,
      actorPosition
    );
  }

  // 5. Zone activation
  if (result.zoneActivation) {
    // Create AreaEffect from ZoneActivation
    const zone = result.zoneActivation;
    state.areaEffects.push({
      id: `zone-${zone.actionId}-${Date.now()}`,
      ownerId: zone.ownerId,
      sourceActionId: zone.actionId,
      area: {
        type: 'sphere',
        radius: zone.radius,
        origin: 'self',
      },
      modifier: {
        id: `zone-modifier-${zone.actionId}`,
        name: `Zone: ${zone.actionId}`,
        condition: { type: 'always' },
        contextualEffects: {},
      },
      triggeredThisTurn: new Set(),
    });
  }

  // 6. Concentration break
  if (result.concentrationBreak) {
    const combatant = findCombatant(state, result.concentrationBreak);
    if (combatant) {
      breakConcentration(combatant, state);
    }
  }

  // 7. Mark dead combatants
  markDeadCombatants(state);

  // 8. Write protocol entry
  writeProtocolEntry(state, result, actor, turnAction);
}

// ============================================================================
// ACTION EXECUTION (runAction)
// ============================================================================

/**
 * Executes a combat action and applies the result to state.
 * Delegates to resolveAction() (READ-ONLY) then applyResult() (WRITE).
 *
 * Flow:
 * 1. resolveAction() - Calculate what would happen (READ-ONLY)
 * 2. applyResult() - Mutate state based on resolution
 */
export function runAction(
  input: RunActionInput,
  state: CombatState
): ResolutionResult | null {
  const { actorId, turnAction, manualRolls } = input;

  // Handle pass action
  if (turnAction.type === 'pass') {
    return null;
  }

  const actor = findCombatant(state, actorId);
  if (!actor) {
    console.warn(`[combatWorkflow] Actor not found: ${actorId}`);
    return null;
  }

  // Build resolution context
  const context: ResolutionContext = {
    actor,
    action: turnAction.action,
    state,
    trigger: 'active' as TriggerType,
    explicitTarget: turnAction.target,
    position: turnAction.position,
    manualRolls,
  };

  // Delegate to resolveAction (READ-ONLY pipeline orchestrator)
  const result = resolveAction(context);

  // Apply result to state (WRITE)
  applyResult(result, state, actor, turnAction);

  return result;
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Simplified action execution for direct action/target specification.
 * Creates a TurnAction internally and delegates to runAction.
 */
export function executeAction(
  actorId: string,
  action: CombatEvent,
  target: Combatant | undefined,
  targetPosition: GridPosition,
  state: CombatState
): ResolutionResult | null {
  const turnAction: TurnAction = {
    type: 'action',
    action,
    target,
    position: targetPosition,
  };

  return runAction({ actorId, turnAction }, state);
}

// ============================================================================
// TURN MANAGEMENT
// ============================================================================

/**
 * Skips the current turn without executing any action.
 */
export function skipTurn(state: CombatState): void {
  advanceTurn(state);
}

// Re-exports for convenience
export { advanceTurn, createTurnBudget };

// ============================================================================
// AI INTEGRATION
// ============================================================================

/**
 * Gets AI suggestion for the current combatant.
 * Pure function - no UI state mutation.
 */
export function requestAISuggestion(state: CombatStateWithLayers): TurnAction | null {
  const currentId = state.turnOrder[state.currentTurnIndex];
  const current = state.combatants.find(c => c.id === currentId) as CombatantWithLayers | undefined;
  if (!current) return null;

  const budget = createTurnBudget(current, state);
  return selectNextAction(current, state, budget);
}

/**
 * Executes AI suggestion and advances turn.
 * @returns ResolutionResult or null on pass
 */
export function executeAISuggestion(
  suggestion: TurnAction,
  state: CombatStateWithLayers
): ResolutionResult | null {
  const currentId = state.turnOrder[state.currentTurnIndex];
  const current = state.combatants.find(c => c.id === currentId);
  if (!current) return null;

  if (suggestion.type === 'pass') {
    advanceTurn(state);
    return null;
  }

  // Update position
  current.combatState.position = suggestion.position;

  // Execute action
  const result = runAction({ actorId: currentId, turnAction: suggestion }, state);

  // Advance turn
  advanceTurn(state);

  return result;
}

// ============================================================================
// SCENARIO MANAGEMENT
// ============================================================================

/**
 * Loads a scenario from encounter presets.
 * Pure function - no UI state mutation.
 */
export function loadScenario(scenarioId: string): CombatStateWithLayers | null {
  const preset = getEncounterPresetById(scenarioId);
  if (!preset) return null;

  return loadEncounterPreset(
    preset,
    { level: 1, size: 0, members: [] },
    { mapConfigLoader: getMapConfigForScenario }
  );
}

/**
 * Returns available scenarios from encounter presets.
 */
export function getAvailableScenarios(): Array<{ id: string; name: string }> {
  return encounterPresets.map(p => ({ id: p.id, name: p.name }));
}
