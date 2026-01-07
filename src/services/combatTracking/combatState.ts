// Ziel: Zentraler Combat State-Container
// Siehe: docs/services/combatTracking.md
//
// Enthält:
// - Creature Cache (getResolvedCreature, preloadCreatures, clearCreatureCache)
// - CombatStateWithScoring Interface (erweitert CombatStateWithLayers mit baseValuesCache)
// - Combatant Accessors (getHP, getAC, getSpeed, etc.)
// - Combatant Setters (setHP, setPosition, setConditions, etc.)
// - Turn Management (advanceTurn, getCurrentCombatant, isCombatOver)
// - Turn Budget (createTurnBudget, consumeMovement, consumeAction, etc.)

import type { Action, CreatureDefinition } from '@/types/entities';
import type { AbilityScores } from '@/types/entities/creature';
import {
  calculateDeathProbability,
} from '@/utils';
import { vault } from '@/infrastructure/vault/vaultInstance';

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
  TurnBudget,
} from '@/types/combat';
import { isNPC } from '@/types/combat';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[combatState]', ...args);
  }
};

// ============================================================================
// CREATURE CACHE
// ============================================================================

/** Cache-Entry mit CreatureDefinition + resolved Actions. */
export interface ResolvedCreature {
  definition: CreatureDefinition;
  actions: Action[];  // Resolved: creature.actions + actionIds aus Vault
}

const creatureCache = new Map<string, ResolvedCreature>();

/**
 * Resolved Actions aus creature.actions + actionIds.
 * Falls keine Actions vorhanden: Default-Action basierend auf CR.
 */
function resolveActions(creature: CreatureDefinition): Action[] {
  const actions: Action[] = [...(creature.actions ?? [])];

  // Lade referenzierte Actions aus Vault
  if (creature.actionIds?.length) {
    for (const actionId of creature.actionIds) {
      try {
        const action = vault.getEntity<Action>('action', actionId);
        actions.push(action);
        debug('resolved actionId:', actionId);
      } catch {
        debug('actionId not found, skipping:', actionId);
      }
    }
  }

  // Fallback: Default-Action wenn keine Actions vorhanden
  if (actions.length === 0) {
    debug('no actions, using default for CR:', creature.cr);
    actions.push(getDefaultCreatureAction(creature.cr));
  }

  return actions;
}

/**
 * Generiert Default-Action für Creature ohne Actions.
 * CR-skalierte Natural Attack.
 */
function getDefaultCreatureAction(cr: number): Action {
  const attackBonus = Math.max(2, Math.floor(cr) + 3);
  const damageBonus = Math.max(1, Math.floor(cr));
  const diceCount = Math.max(1, Math.floor(cr / 3));

  return {
    name: 'Natural Attack',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single' },
    attack: { bonus: attackBonus },
    damage: { dice: `${diceCount}d6`, modifier: damageBonus, type: 'bludgeoning' },
  } as unknown as Action;
}

/**
 * Lädt CreatureDefinition mit resolved Actions (gecached).
 * Wiederverwendbar für NPCs mit gleichem Creature-Typ.
 */
export function getResolvedCreature(creatureId: string): ResolvedCreature {
  const cached = creatureCache.get(creatureId);
  if (cached) {
    debug('cache hit:', creatureId);
    return cached;
  }

  debug('cache miss, loading:', creatureId);
  const definition = vault.getEntity<CreatureDefinition>('creature', creatureId);
  const actions = resolveActions(definition);

  const resolved: ResolvedCreature = { definition, actions };
  creatureCache.set(creatureId, resolved);

  debug('cached:', creatureId, { actionsCount: actions.length });
  return resolved;
}

/**
 * Lädt mehrere CreatureDefinitions auf einmal (batch).
 * Optimiert für Encounter mit mehreren Creature-Typen.
 */
export function preloadCreatures(creatureIds: string[]): void {
  const uniqueIds = [...new Set(creatureIds)];
  for (const id of uniqueIds) {
    if (!creatureCache.has(id)) {
      getResolvedCreature(id);
    }
  }
  debug('preloaded:', uniqueIds.length, 'creatures');
}

/** Cache leeren (z.B. bei Session-Ende oder Vault-Änderung). */
export function clearCreatureCache(): void {
  const size = creatureCache.size;
  creatureCache.clear();
  debug('cleared cache:', size, 'entries');
}

/** Cache-Statistiken für Debugging. */
export function getCreatureCacheStats(): { size: number; ids: string[] } {
  return {
    size: creatureCache.size,
    ids: [...creatureCache.keys()],
  };
}

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
// DEAD COMBATANT MANAGEMENT (Zentrale Stelle für Death-Checks)
// ============================================================================
//
// Diese Funktionen sind die EINZIGE Stelle im Code, die mit isDead arbeitet.
// Alle anderen Stellen verwenden getAliveCombatants() oder isAlive().

/**
 * Markiert Combatants als tot wenn deathProb >= 0.95.
 * EINZIGE Stelle wo isDead gesetzt wird.
 * Aufrufen nach jeder Schadensanwendung in executeAction().
 * Akzeptiert CombatState, CombatantSimulationState, und *WithLayers Varianten.
 */
export function markDeadCombatants(state: { combatants: Combatant[] }): void {
  for (const c of state.combatants) {
    if (!c.combatState.isDead && getDeathProbability(c) >= 0.95) {
      c.combatState.isDead = true;
      debug('combatant marked dead:', c.name, c.id, 'deathProb:', getDeathProbability(c));
    }
  }
}

/**
 * Gibt nur lebende Combatants zurück.
 * EINZIGER Accessor für Target-Selection, Turn-Order, etc.
 * Akzeptiert CombatState, CombatantSimulationState, und *WithLayers Varianten.
 */
export function getAliveCombatants<T extends Combatant>(
  state: { combatants: T[] }
): T[] {
  return state.combatants.filter(c => !c.combatState.isDead);
}

/**
 * Prüft ob Combatant lebt.
 * Convenience-Funktion für einzelne Combatants.
 */
export function isAlive(c: Combatant): boolean {
  return !c.combatState.isDead;
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
 * Wechselt zum nächsten LEBENDEN Combatant in der Initiative-Reihenfolge.
 * Überspringt automatisch tote Combatants (isDead === true).
 * Erhöht roundNumber wenn alle Combatants an der Reihe waren.
 * Erstellt neues TurnBudget für den nächsten Combatant.
 *
 * @param state CombatState mit turnOrder und currentTurnIndex
 */
export function advanceTurn(state: CombatState): void {
  const startIndex = state.currentTurnIndex;
  let loopCount = 0;
  const maxLoops = state.turnOrder.length + 1;

  // Zum nächsten LEBENDEN Combatant wechseln
  do {
    state.currentTurnIndex++;
    if (state.currentTurnIndex >= state.turnOrder.length) {
      state.currentTurnIndex = 0;
      state.roundNumber++;
    }
    loopCount++;

    // Safety: Verhindere Endlosschleife wenn alle tot sind
    if (loopCount > maxLoops) {
      debug('advanceTurn: alle Combatants tot, breche ab');
      break;
    }
  } while (
    state.combatants.find(c => c.id === state.turnOrder[state.currentTurnIndex])
      ?.combatState.isDead === true
  );

  // Neues Budget für nächsten Combatant
  const nextCombatant = getCurrentCombatant(state);
  if (nextCombatant && !nextCombatant.combatState.isDead) {
    state.currentTurnBudget = createTurnBudget(nextCombatant);
  }

  debug('advanceTurn:', {
    newIndex: state.currentTurnIndex,
    roundNumber: state.roundNumber,
    currentCombatantId: state.turnOrder[state.currentTurnIndex],
    skipped: loopCount - 1,
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
 * Prüft ob der Combat beendet ist (eine Seite hat keine Lebenden mehr).
 * Verwendet getAliveCombatants() - keine probabilistischen Berechnungen mehr.
 *
 * @param state CombatState mit combatants und alliances
 * @returns true wenn Combat beendet ist
 */
export function isCombatOver(state: CombatState): boolean {
  const alive = getAliveCombatants(state);

  const partyAlive = alive.filter(c =>
    isAlliedToParty(c.combatState.groupId, state.alliances)
  );
  const enemiesAlive = alive.filter(c =>
    isHostileToParty(c.combatState.groupId, state.alliances)
  );

  // Combat ist vorbei wenn eine Seite keine Lebenden mehr hat
  const isOver = partyAlive.length === 0 || enemiesAlive.length === 0;

  debug('isCombatOver:', {
    partyAlive: partyAlive.length,
    enemiesAlive: enemiesAlive.length,
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

// ============================================================================
// TURN BUDGET FUNCTIONS
// ============================================================================

/**
 * Prüft ob ein Combatant Bonus Actions hat.
 * Bonus Actions sind Actions mit timing.type === 'bonus'.
 */
export function hasAnyBonusAction(combatant: Combatant): boolean {
  return getActions(combatant).some(a => a.timing.type === 'bonus');
}

/** Erstellt TurnBudget aus Combatant. */
export function createTurnBudget(combatant: Combatant): TurnBudget {
  const speed = getSpeed(combatant);
  const walkSpeed = speed.walk ?? 30;
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
    hasDashed: false,
    hasBonusAction: hasAnyBonusAction(combatant),
    hasReaction: true,
  };
}

/** Prüft ob noch sinnvolle Aktionen möglich sind. */
export function hasBudgetRemaining(budget: TurnBudget): boolean {
  return budget.movementCells > 0 || budget.hasAction || budget.hasBonusAction;
}

/** Verbraucht Movement-Cells (1 Cell = 5ft). */
export function consumeMovement(budget: TurnBudget, cells: number = 1): void {
  budget.movementCells = Math.max(0, budget.movementCells - cells);
}

/** Verbraucht die Action für diesen Zug. */
export function consumeAction(budget: TurnBudget): void {
  budget.hasAction = false;
}

/** Verbraucht die Bonus Action für diesen Zug. */
export function consumeBonusAction(budget: TurnBudget): void {
  budget.hasBonusAction = false;
}

/** Verbraucht die Reaction. */
export function consumeReaction(budget: TurnBudget): void {
  budget.hasReaction = false;
}

/** Dash fügt die Basis-Bewegungsrate hinzu und verbraucht die Action. */
export function applyDash(budget: TurnBudget): void {
  budget.movementCells += budget.baseMovementCells;
  budget.hasAction = false;
  budget.hasDashed = true;
}
