// Ziel: Zentraler Combat State-Container
// Siehe: docs/services/combatTracking.md
//
// Enthält:
// - CombatStateWithScoring Interface (erweitert CombatStateWithLayers mit baseValuesCache)
// - Combatant Accessors (getHP, getAC, getSpeed, etc.)
// - Combatant Setters (setHP, setPosition, setConditions, etc.)
// - Turn Management (advanceTurn, getCurrentCombatant, isCombatOver)

import type { Action } from '@/types/entities';
import type { AbilityScores } from '@/types/entities/creature';
import {
  calculateDeathProbability,
} from '@/utils';

// Types aus @/types/combat (Single Source of Truth)
import type {
  ProbabilityDistribution,
  GridPosition,
  SpeedBlock,
  CombatResources,
  ConditionState,
  Combatant,
  CombatState,
  CombatStateWithLayers,
  ActionBaseValues,
} from '@/types/combat';
import { isNPC } from '@/types/combat';

import { getResolvedCreature } from './creatureCache';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[combatState]', ...args);
  }
};

// ============================================================================
// COMBAT STATE WITH SCORING
// ============================================================================

/**
 * Extended Combat State mit Scoring-Daten für combatantAI.
 * combatantAI ist pure Mathematik - alle Daten kommen aus diesem State.
 */
export interface CombatStateWithScoring extends CombatStateWithLayers {
  /** Base Values Cache: `{casterType}-{actionId}:{targetType}` → ActionBaseValues */
  baseValuesCache: Map<string, ActionBaseValues>;
}

// Re-exports für Convenience
export type { CombatState, CombatStateWithLayers, Combatant, ActionBaseValues };

// ============================================================================
// COMBATANT ACCESSORS
// ============================================================================
//
// Unified accessors für Combatant-Daten.
// NPCs laden statische Werte via CreatureDefinition.
// Characters verwenden direkte Felder.

/**
 * Gibt HP des Combatants zurück.
 * HP ist direkt auf der Entity als ProbabilityDistribution.
 */
export function getHP(c: Combatant): ProbabilityDistribution {
  return c.currentHp;
}

/**
 * Gibt AC des Combatants zurück.
 * NPC: via CreatureDefinition, Character: direktes Feld.
 */
export function getAC(c: Combatant): number {
  if (isNPC(c)) {
    return getResolvedCreature(c.creature.id).definition.ac;
  }
  return c.ac;
}

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
 * Gibt Actions des Combatants zurück.
 * NPC: resolved Actions via CreatureDefinition.
 * Character: character.actions (muss definiert sein).
 */
export function getActions(c: Combatant): Action[] {
  if (isNPC(c)) {
    return getResolvedCreature(c.creature.id).actions;
  }
  if (!c.actions || c.actions.length === 0) {
    throw new Error(`Character "${c.name}" (${c.id}) hat keine Actions definiert`);
  }
  return c.actions;
}

/**
 * Gibt Abilities des Combatants zurück.
 * NPC: via CreatureDefinition.
 * Character: direkt aus abilities-Feld.
 */
export function getAbilities(c: Combatant): AbilityScores {
  if (isNPC(c)) {
    return getResolvedCreature(c.creature.id).definition.abilities;
  }
  return c.abilities;
}

/**
 * Gibt Save-Proficiencies des Combatants zurück.
 * NPC: via CreatureDefinition.
 * Character: direkt aus saveProficiencies-Feld.
 */
export function getSaveProficiencies(c: Combatant): string[] {
  if (isNPC(c)) {
    return getResolvedCreature(c.creature.id).definition.saveProficiencies ?? [];
  }
  return c.saveProficiencies ?? [];
}

/**
 * Gibt CR des Combatants zurück.
 * NPC: via CreatureDefinition.
 * Character: level / 2 Approximation.
 */
export function getCR(c: Combatant): number {
  if (isNPC(c)) {
    return getResolvedCreature(c.creature.id).definition.cr;
  }
  return c.level / 2;
}

/**
 * Gibt combatantType zurück (für Cache-Keys).
 * NPC: creature.id, Character: id.
 */
export function getCombatantType(c: Combatant): string {
  if (isNPC(c)) {
    return c.creature.id;
  }
  return c.id;
}

/**
 * Gibt groupId des Combatants zurück.
 * Aus combatState wenn vorhanden.
 */
export function getGroupId(c: Combatant): string {
  return c.combatState.groupId;
}

/**
 * Gibt Position des Combatants zurück.
 * Aus combatState.
 */
export function getPosition(c: Combatant): GridPosition {
  return c.combatState.position;
}

/**
 * Gibt Conditions des Combatants zurück.
 * Aus combatState.
 */
export function getConditions(c: Combatant): ConditionState[] {
  return c.combatState.conditions;
}

/**
 * Berechnet deathProbability aus currentHp.
 * P(HP <= 0) basierend auf PMF.
 */
export function getDeathProbability(c: Combatant): number {
  return calculateDeathProbability(c.currentHp);
}

/**
 * Gibt maxHp des Combatants zurück.
 * Direktes Feld auf beiden Entity-Typen.
 */
export function getMaxHP(c: Combatant): number {
  return c.maxHp;
}

/**
 * Gibt Resources des Combatants zurück.
 * Aus combatState wenn vorhanden.
 */
export function getResources(c: Combatant): CombatResources | undefined {
  return c.combatState.resources;
}

// ============================================================================
// COMBATANT SETTERS (für Mutationen während Simulation)
// ============================================================================

/**
 * Setzt HP des Combatants.
 * Mutiert currentHp auf der Entity.
 */
export function setHP(c: Combatant, hp: ProbabilityDistribution): void {
  c.currentHp = hp;
}

/**
 * Setzt Position des Combatants.
 * Mutiert combatState.position.
 */
export function setPosition(c: Combatant, pos: GridPosition): void {
  c.combatState.position = pos;
}

/**
 * Setzt Conditions des Combatants.
 * Ersetzt alle Conditions.
 */
export function setConditions(c: Combatant, conditions: ConditionState[]): void {
  c.combatState.conditions = conditions;
}

/**
 * Fügt eine Condition hinzu.
 */
export function addCondition(c: Combatant, condition: ConditionState): void {
  c.combatState.conditions.push(condition);
}

/**
 * Entfernt eine Condition nach Name.
 */
export function removeCondition(c: Combatant, conditionName: string): void {
  c.combatState.conditions = c.combatState.conditions.filter(
    cond => cond.name !== conditionName
  );
}

/**
 * Setzt den aktiven Konzentrations-Spell.
 */
export function setConcentration(c: Combatant, actionId: string | undefined): void {
  c.combatState.concentratingOn = actionId;
}

/**
 * Setzt Resources des Combatants.
 * Ersetzt alle Resources.
 */
export function setResources(c: Combatant, resources: CombatResources): void {
  c.combatState.resources = resources;
}

// ============================================================================
// TURN MANAGEMENT
// ============================================================================

/**
 * Wechselt zum nächsten Combatant in der Initiative-Reihenfolge.
 * Erhöht roundNumber wenn alle Combatants an der Reihe waren.
 *
 * @param state CombatState mit turnOrder und currentTurnIndex
 */
export function advanceTurn(state: CombatState): void {
  state.currentTurnIndex++;
  if (state.currentTurnIndex >= state.turnOrder.length) {
    state.currentTurnIndex = 0;
    state.roundNumber++;
  }

  debug('advanceTurn:', {
    newIndex: state.currentTurnIndex,
    roundNumber: state.roundNumber,
    currentCombatantId: state.turnOrder[state.currentTurnIndex],
  });
}

/**
 * Gibt den aktuellen Combatant in der Initiative-Reihenfolge zurück.
 *
 * @param state CombatState mit turnOrder und combatants
 * @returns Aktueller Combatant oder undefined wenn turnOrder leer
 */
export function getCurrentCombatant(state: CombatState): Combatant | undefined {
  if (state.turnOrder.length === 0) return undefined;
  const id = state.turnOrder[state.currentTurnIndex];
  return state.combatants.find(c => c.id === id);
}

/**
 * Prüft ob der Combat beendet ist (eine Seite ist besiegt).
 * Eine Seite gilt als besiegt wenn die Todeswahrscheinlichkeit >95% ist.
 *
 * @param state CombatState mit combatants und alliances
 * @returns true wenn Combat beendet ist
 */
export function isCombatOver(state: CombatState): boolean {
  // Berechne Todeswahrscheinlichkeit für Party-Allianz
  const partyAllied = state.combatants.filter(c =>
    isAlliedToParty(c.combatState.groupId, state.alliances)
  );
  const partyDeathProb = partyAllied.length === 0
    ? 1
    : partyAllied.reduce((prob, c) => prob * getDeathProbability(c), 1.0);

  // Berechne Todeswahrscheinlichkeit für Feinde
  const enemies = state.combatants.filter(c =>
    isHostileToParty(c.combatState.groupId, state.alliances)
  );
  const enemyDeathProb = enemies.length === 0
    ? 1
    : enemies.reduce((prob, c) => prob * getDeathProbability(c), 1.0);

  const isOver = partyDeathProb > 0.95 || enemyDeathProb > 0.95;

  debug('isCombatOver:', {
    partyDeathProb,
    enemyDeathProb,
    isOver,
  });

  return isOver;
}

// Helper: Prüft ob groupId mit Party verbündet ist
function isAlliedToParty(groupId: string, alliances: Record<string, string[]>): boolean {
  if (groupId === 'party') return true;
  const partyAllies = alliances['party'] ?? [];
  return partyAllies.includes(groupId);
}

// Helper: Prüft ob groupId feindlich zur Party ist
function isHostileToParty(groupId: string, alliances: Record<string, string[]>): boolean {
  if (groupId === 'party') return false;
  const partyAllies = alliances['party'] ?? [];
  return !partyAllies.includes(groupId);
}
