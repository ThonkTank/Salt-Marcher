// Ziel: Combat-spezifische Movement-Logik (READ-ONLY)
// Siehe: docs/services/combatTracking/movement.md
//
// Enthält (alle READ-ONLY):
// - Speed-Berechnung (getSpeed, getEffectiveSpeed)
// - TurnBudget Erstellung (createTurnBudget, calculateGrantedMovement)
// - (REMOVED: Grapple-Queries now handled by conditionLifecycle.ts)
// - CombatEvent-Helpers (hasGrantMovementEffect, hasToTargetMovementCost, getMovementRange)
//
// NICHT enthalten:
// - Pathfinding → terrainMovement.ts (wiederverwendbar für Dungeon)
// - State-Mutation → combatState.ts, executeCombatEvent.ts

import type { CombatEvent } from '@/types/entities/combatEvent';
import type {
  SpeedBlock,
  Combatant,
  CombatantSimulationState,
  CombatState,
  TurnBudget,
  CombatantWithLayers,
} from '@/types/combat';
import { isNPC } from '@/types/combat';
import { getResolvedCreature, getCombatEvents } from './combatState';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[movement]', ...args);
  }
};

// ============================================================================
// SPEED & BUDGET (READ-ONLY)
// ============================================================================

/**
 * Gibt Speed des Combatants zurück.
 * NPC: via CreatureDefinition, Character: nur walk (speed-Feld).
 */
export function getSpeed(c: Combatant): SpeedBlock {
  if (isNPC(c)) {
    const creature = getResolvedCreature(c.creature.id).definition;
    return {
      walk: creature.speed?.walk ?? 30,
      fly: creature.speed?.fly,
      swim: creature.speed?.swim,
      climb: creature.speed?.climb,
      burrow: creature.speed?.burrow,
    };
  }
  return { walk: c.speed };
}

/**
 * Prüft ob ein Combatant Bonus CombatEvents hat.
 * Uses new schema: cost.economy === 'bonus-action'.
 */
export function hasAnyBonusCombatEvent(combatant: Combatant): boolean {
  return getCombatEvents(combatant).some(a =>
    a.cost?.type === 'action-economy' && a.cost.economy === 'bonus-action'
  );
}

/**
 * Berechnet effektive Speed unter Berücksichtigung von Modifiers und Zones.
 *
 * Speed-Modifikation über einheitliches Modifier-System:
 * - speedOverride: Absoluter Wert (0 für grappled, paralyzed, etc.)
 * - speedMultiplier: Multiplikator (0.5 für grappling)
 *
 * Zone Speed-Modifier (Spirit Guardians, etc.):
 * Zones mit speedModifier reduzieren Movement (z.B. 0.5 für halbe Speed).
 *
 * @param combatant Der Combatant
 * @param state Optional: State mit combatants Array für Zone Check
 * @returns Effektive Speed in Feet
 */
export function getEffectiveSpeed(combatant: Combatant, state?: CombatantSimulationState): number {
  const baseSpeed = getSpeed(combatant).walk ?? 30;
  const modifiers = combatant.combatState.modifiers ?? [];

  // 1. Prüfe speedOverride (grappled, paralyzed, etc.)
  // First speedOverride wins (modifiers are priority-sorted)
  for (const am of modifiers) {
    const speedOverride = am.modifier.contextualEffects?.passive?.speedOverride;
    if (speedOverride !== undefined) {
      debug('getEffectiveSpeed:', {
        id: combatant.id,
        modifier: am.modifier.id,
        speedOverride,
      });
      return speedOverride;
    }
  }

  let effectiveSpeed = baseSpeed;

  // 2. Prüfe speedMultiplier (grappling)
  // First multiplier wins (modifiers are priority-sorted)
  for (const am of modifiers) {
    const speedMultiplier = am.modifier.contextualEffects?.passive?.speedMultiplier;
    if (speedMultiplier !== undefined) {
      effectiveSpeed = Math.floor(effectiveSpeed * speedMultiplier);
      debug('getEffectiveSpeed:', {
        id: combatant.id,
        modifier: am.modifier.id,
        speedMultiplier,
        newSpeed: effectiveSpeed,
      });
      break;
    }
  }

  // 3. Zone Speed-Modifier (Spirit Guardians, etc.)
  // Prüfe ob Combatant in einer Zone mit speedModifier steht
  const combatState = state as CombatState | undefined;
  if (combatState?.activeZones && combatState.activeZones.length > 0) {
    const combatantPos = combatant.combatState.position;

    for (const zone of combatState.activeZones) {
      // Skip own zones
      if (zone.ownerId === combatant.id) continue;

      // Check if effect type is create-zone and has speedModifier
      if (zone.effect.type !== 'create-zone' || !zone.effect.zone?.speedModifier) continue;

      // Check target filter (inline version of isValidZoneTarget)
      const owner = combatState.combatants.find(c => c.id === zone.ownerId);
      if (!owner) continue;

      const filter = zone.effect.zone.targetFilter ?? 'all';
      const ownerGroup = owner.combatState.groupId;
      const combatantGroup = combatant.combatState.groupId;
      const ownerAllies = combatState.alliances[ownerGroup] ?? [];
      const isAlly = combatantGroup === ownerGroup || ownerAllies.includes(combatantGroup);
      const isEnemy = !isAlly;

      if (filter === 'enemies' && !isEnemy) continue;
      if (filter === 'allies' && !isAlly) continue;

      // Check if in radius (inline version of isInZoneRadius)
      const ownerPos = owner.combatState.position;
      const dx = Math.abs(combatantPos.x - ownerPos.x);
      const dy = Math.abs(combatantPos.y - ownerPos.y);
      const distanceFeet = Math.max(dx, dy) * (combatState.grid?.cellSizeFeet ?? 5);

      if (distanceFeet <= zone.effect.zone.radius) {
        effectiveSpeed = Math.floor(effectiveSpeed * zone.effect.zone.speedModifier);
        debug('getEffectiveSpeed: zone modifier applied', {
          id: combatant.id,
          zone: zone.sourceActionId,
          speedModifier: zone.effect.zone.speedModifier,
          newSpeed: effectiveSpeed,
        });
      }
    }
  }

  return effectiveSpeed;
}

/** Erstellt TurnBudget aus Combatant. */
export function createTurnBudget(combatant: Combatant, state?: CombatantSimulationState): TurnBudget {
  const walkSpeed = getEffectiveSpeed(combatant, state);  // Berücksichtigt Conditions + Grapple-Drag
  const movementCells = Math.floor(walkSpeed / 5);

  debug('createTurnBudget:', {
    id: combatant.id,
    walkSpeed,
    movementCells,
  });

  return {
    movementCells,
    baseMovementCells: movementCells,
    hasAction: true,
    hasBonusAction: hasAnyBonusCombatEvent(combatant),
    hasReaction: true,
  };
}

/**
 * Calculates movement bonus from grantMovement effect.
 * Single source of truth for dash/extra/teleport calculations.
 *
 * Used by both candidate generation (actionEnumeration) and
 * execution (executeCombatEvent) to ensure consistent movement ranges.
 *
 * @param grant The grantMovement effect from an CombatEvent
 * @param budget Current turn budget with baseMovementCells
 * @returns Number of cells to add to movement budget
 */
export function calculateGrantedMovement(
  grant: { type: 'dash' | 'extra' | 'teleport'; value?: number },
  budget: TurnBudget
): number {
  switch (grant.type) {
    case 'dash':
      return budget.baseMovementCells;  // Effective speed from budget
    case 'extra':
      return Math.floor((grant.value ?? 0) / 5);
    case 'teleport':
      return Math.floor((grant.value ?? 0) / 5);  // Independent of current budget
    default:
      return 0;
  }
}

// ============================================================================
// ACTION HELPERS (READ-ONLY)
// ============================================================================

/**
 * Prüft ob eine CombatEvent Movement gewährt (Dash-ähnlich).
 * Effect-basierte Erkennung statt hardcodierter CombatEventType-Prüfung.
 */
export function hasGrantMovementEffect(action: CombatEvent): boolean {
  return action.effects?.some(e => e.grantMovement != null) ?? false;
}

/**
 * Prüft ob eine CombatEvent movement.toTarget Kosten hat (Movement-CombatEvent wie std-move).
 * Diese CombatEvents brauchen ein targetCell für die Bewegung.
 */
export function hasToTargetMovementCost(action: CombatEvent): boolean {
  return action.budgetCosts?.some(
    c => c.resource === 'movement' && c.cost.type === 'toTarget'
  ) ?? false;
}

/**
 * Berechnet erreichbare Range für eine Movement-CombatEvent.
 * Berücksichtigt grantMovement Effects (Dash, Teleport, etc.)
 *
 * Verwendet calculateGrantedMovement() als Single Source of Truth
 * für die Berechnung, um Konsistenz mit executeCombatEvent() zu gewährleisten.
 */
export function getMovementRange(
  action: CombatEvent,
  budget: TurnBudget,
  _combatant: CombatantWithLayers  // Unused: Speed lookup now via budget.baseMovementCells
): number {
  const grant = action.effects?.find(e => e.grantMovement)?.grantMovement;

  if (!grant) {
    return budget.movementCells;
  }

  // Teleport ersetzt Budget komplett
  if (grant.type === 'teleport') {
    return calculateGrantedMovement(grant, budget);
  }

  // Dash/Extra addiert zum aktuellen Budget
  return budget.movementCells + calculateGrantedMovement(grant, budget);
}
