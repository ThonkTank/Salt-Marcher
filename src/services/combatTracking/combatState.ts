// Ziel: Zentraler Combat State-Container
// Siehe: docs/services/combatTracking.md
//
// Enthält:
// - Creature Cache (getResolvedCreature, preloadCreatures, clearCreatureCache)
// - CombatStateWithScoring Interface (erweitert CombatStateWithLayers mit baseValuesCache)
// - Combatant Accessors (getHP, getAC, getSpeed, etc.)
// - Combatant Setters (setHP, setPosition, setConditions, etc.)
// - Turn Management (advanceTurn, getCurrentCombatant, isCombatOver)
// - Turn Budget (createTurnBudget)

import type { Action, CreatureDefinition } from '@/types/entities';
import type { AbilityScores } from '@/types/entities/creature';
import {
  calculateDeathProbability,
} from '@/utils';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { CONDITION_EFFECTS, type ConditionEffectKey } from '@/constants/action';

// Types aus @/types/combat (Single Source of Truth)
import type {
  ProbabilityDistribution,
  GridPosition,
  SpeedBlock,
  CombatResources,
  ConditionState,
  Combatant,
  CombatState,
  CombatantSimulationState,
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
 * Resolved Actions aus creature.actions + actionIds + standardActions.
 * Falls keine creature-spezifischen Actions vorhanden: Default-Action basierend auf CR.
 *
 * StandardActions (Move, Dash, Disengage, Dodge, Opportunity Attack) werden
 * automatisch hinzugefügt wenn sie im Vault mit 'std-' Prefix registriert sind.
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

  // Fallback: Default-Action wenn keine creature-spezifischen Actions vorhanden
  if (actions.length === 0) {
    debug('no actions, using default for CR:', creature.cr);
    actions.push(getDefaultCreatureAction(creature.cr));
  }

  // StandardActions hinzufügen (Move, Dash, Disengage, Dodge, Opportunity Attack)
  // Diese sind für alle Combatants verfügbar, gefiltert durch requires.hasAction
  try {
    const allActions = vault.getAllEntities<Action>('action');
    const standardActions = allActions.filter(a => a.id?.startsWith('std-'));
    for (const stdAction of standardActions) {
      // Nur hinzufügen wenn noch nicht vorhanden (verhindert Duplikate)
      if (!actions.some(a => a.id === stdAction.id)) {
        actions.push(stdAction);
        debug('added standardAction:', stdAction.id);
      }
    }
  } catch {
    debug('could not load standardActions from vault');
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
 *
 * Grapple-Drag (D&D 5e PHB):
 * Wenn state übergeben wird und Combatant jemanden grappled,
 * werden die gegrappelten Targets mitbewegt.
 *
 * @param c Der Combatant der bewegt wird
 * @param pos Die neue Position
 * @param state Optional: State mit combatants Array für Grapple-Drag
 */
export function setPosition(c: Combatant, pos: GridPosition, state?: CombatantSimulationState): void {
  c.combatState.position = pos;

  // Grapple-Drag: Gegrappelte Targets mitbewegen
  if (state) {
    const grappledTargets = state.combatants.filter(target =>
      target.combatState.conditions.some(
        cond => cond.name === 'grappled' && cond.sourceId === c.id
      )
    );

    for (const target of grappledTargets) {
      target.combatState.position = pos;
      debug('setPosition: grapple-drag', {
        grappler: c.id,
        target: target.id,
        newPos: pos,
      });
    }
  }
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
 * Ergebnis der Condition-Verarbeitung am Turn-Start.
 */
export interface TurnStartConditionResult {
  expired: string[];  // Namen der abgelaufenen Conditions
  saved: string[];  // Namen der Conditions die durch Save beendet wurden
  remaining: string[];  // Namen der noch aktiven Conditions
}

/**
 * Berechnet Save-Erfolgswahrscheinlichkeit für einen Combatant.
 * Vereinfachte Version ohne combatantAI-Import um zirkuläre Dependencies zu vermeiden.
 *
 * Formel: (DC - saveBonus - 1) / 20, geclampt auf [0.05, 0.95]
 * saveBonus = abilityModifier + (isProficient ? profBonus : 0)
 */
function calculateSaveSuccessChance(
  c: Combatant,
  dc: number,
  ability: keyof AbilityScores
): number {
  const abilities = getAbilities(c);
  const abilityScore = abilities[ability];
  const modifier = Math.floor((abilityScore - 10) / 2);

  // Vereinfachte Proficiency-Berechnung (CR-basiert)
  const cr = c.cr ?? 0;
  const profBonus = Math.floor(cr / 4) + 2;

  // Prüfe Save-Proficiency
  const saveProficiencies = c.creature?.saveProficiencies ?? [];
  const isProficient = saveProficiencies.includes(ability);

  const saveBonus = modifier + (isProficient ? profBonus : 0);
  const successChance = (21 + saveBonus - dc) / 20;  // 21 = d20 average + 0.5 rounding

  // Clamp auf [0.05, 0.95] - Natural 1/20 haben keine Sonderbedeutung bei Saves
  return Math.max(0.05, Math.min(0.95, successChance));
}

/**
 * Verarbeitet Conditions am Turn-Start eines Combatants.
 * - Dekrementiert duration.value für Conditions mit type 'rounds'
 * - Entfernt abgelaufene Conditions (value <= 0)
 * - Prüft Start-of-Turn Saves (für until-save mit saveAt: 'start')
 *
 * @param c Der Combatant dessen Conditions verarbeitet werden
 * @returns Ergebnis mit abgelaufenen, gesaveten und verbleibenden Conditions
 */
export function processConditionsOnTurnStart(c: Combatant): TurnStartConditionResult {
  const expired: string[] = [];
  const saved: string[] = [];
  const remaining: string[] = [];

  // Iteriere über Kopie, da wir während der Iteration entfernen könnten
  const conditionsCopy = [...c.combatState.conditions];

  for (const condition of conditionsCopy) {
    if (!condition.duration) {
      // Keine Duration = permanent (z.B. Trait-Effekte)
      remaining.push(condition.name);
      continue;
    }

    if (condition.duration.type === 'rounds' && condition.duration.value !== undefined) {
      // Dekrementiere Duration
      condition.duration.value--;

      debug('processConditionsOnTurnStart: rounds decrement', {
        combatant: c.name,
        condition: condition.name,
        newValue: condition.duration.value,
      });

      if (condition.duration.value <= 0) {
        // Condition ist abgelaufen
        removeCondition(c, condition.name);
        expired.push(condition.name);
        debug('processConditionsOnTurnStart: expired', {
          combatant: c.name,
          condition: condition.name,
        });
      } else {
        remaining.push(condition.name);
      }
    } else if (condition.duration.type === 'until-save') {
      // Start-of-Turn Saves (z.B. Hold Person, Dominate)
      // Nur wenn saveAt === 'start' (default ist 'end')
      const saveAt = condition.duration.saveAt ?? 'end';

      if (saveAt === 'start' && condition.duration.saveDC && condition.duration.saveAbility) {
        const successChance = calculateSaveSuccessChance(
          c,
          condition.duration.saveDC,
          condition.duration.saveAbility
        );

        // Probabilistischer Save: Condition wird mit Erfolgswahrscheinlichkeit entfernt
        // Wir reduzieren die Condition-Probability um die Erfolgsrate
        condition.probability = condition.probability * (1 - successChance);

        debug('processConditionsOnTurnStart: start-of-turn save', {
          combatant: c.name,
          condition: condition.name,
          dc: condition.duration.saveDC,
          ability: condition.duration.saveAbility,
          successChance,
          newProbability: condition.probability,
        });

        // Wenn Probability unter Schwellwert, Condition entfernen
        if (condition.probability < 0.05) {
          removeCondition(c, condition.name);
          saved.push(condition.name);
          debug('processConditionsOnTurnStart: saved', {
            combatant: c.name,
            condition: condition.name,
          });
        } else {
          remaining.push(condition.name);
        }
      } else {
        // End-of-Turn Save oder keine Save-Info vorhanden
        remaining.push(condition.name);
      }
    } else if (condition.duration.type === 'until-escape') {
      // Escape erfordert Action, wird nicht automatisch geprüft
      remaining.push(condition.name);
    } else {
      // Andere Duration-Types (instant, concentration, etc.)
      remaining.push(condition.name);
    }
  }

  return { expired, saved, remaining };
}

/**
 * Ergebnis der Condition-Verarbeitung am Turn-Ende.
 */
export interface TurnEndConditionResult {
  saved: string[];  // Namen der Conditions die durch Save beendet wurden
  remaining: string[];  // Namen der noch aktiven Conditions
  expired: string[];  // Namen der abgelaufenen Conditions (für Konsistenz mit TurnStartConditionResult)
}

/**
 * Verarbeitet Conditions am Turn-Ende eines Combatants.
 * - Prüft endingSave (ActionEffect.endingSave - erlaubt Save am Turn-Ende)
 * - Prüft End-of-Turn Saves (für until-save mit saveAt: 'end', der Default)
 *
 * @param c Der Combatant dessen Conditions verarbeitet werden
 * @returns Ergebnis mit gesaveten und verbleibenden Conditions
 */
export function processConditionsOnTurnEnd(c: Combatant): TurnEndConditionResult {
  const saved: string[] = [];
  const remaining: string[] = [];
  const expired: string[] = [];

  // Iteriere über Kopie, da wir während der Iteration entfernen könnten
  const conditionsCopy = [...c.combatState.conditions];

  for (const condition of conditionsCopy) {
    // 1. Prüfe endingSave (unabhängig von Duration-Type)
    if (condition.endingSave) {
      const successChance = calculateSaveSuccessChance(
        c,
        condition.endingSave.dc,
        condition.endingSave.ability
      );

      condition.probability = condition.probability * (1 - successChance);

      debug('processConditionsOnTurnEnd: endingSave', {
        combatant: c.name,
        condition: condition.name,
        dc: condition.endingSave.dc,
        ability: condition.endingSave.ability,
        successChance,
        newProbability: condition.probability,
      });

      if (condition.probability < 0.05) {
        removeCondition(c, condition.name);
        saved.push(condition.name);
        debug('processConditionsOnTurnEnd: saved via endingSave', {
          combatant: c.name,
          condition: condition.name,
        });
        continue;  // Weiter zur nächsten Condition
      }
    }

    // 2. Duration-basierte Verarbeitung
    if (!condition.duration) {
      remaining.push(condition.name);
      continue;
    }

    if (condition.duration.type === 'until-save') {
      // End-of-Turn Saves (z.B. Hold Person, Dominate)
      // Default ist 'end', also saveAt undefined = end
      const saveAt = condition.duration.saveAt ?? 'end';

      if (saveAt === 'end' && condition.duration.saveDC && condition.duration.saveAbility) {
        const successChance = calculateSaveSuccessChance(
          c,
          condition.duration.saveDC,
          condition.duration.saveAbility
        );

        // Probabilistischer Save: Condition wird mit Erfolgswahrscheinlichkeit entfernt
        condition.probability = condition.probability * (1 - successChance);

        debug('processConditionsOnTurnEnd: end-of-turn save', {
          combatant: c.name,
          condition: condition.name,
          dc: condition.duration.saveDC,
          ability: condition.duration.saveAbility,
          successChance,
          newProbability: condition.probability,
        });

        // Wenn Probability unter Schwellwert, Condition entfernen
        if (condition.probability < 0.05) {
          removeCondition(c, condition.name);
          saved.push(condition.name);
          debug('processConditionsOnTurnEnd: saved', {
            combatant: c.name,
            condition: condition.name,
          });
        } else {
          remaining.push(condition.name);
        }
      } else {
        remaining.push(condition.name);
      }
    } else {
      remaining.push(condition.name);
    }
  }

  return { saved, remaining, expired };
}

/**
 * Setzt den aktiven Konzentrations-Spell.
 * Bei Concentration-Wechsel werden Zones des vorherigen Spells deaktiviert.
 *
 * @param c Der Combatant
 * @param actionId Die neue Concentration-Action (oder undefined zum Beenden)
 * @param state Optional: CombatState für Zone-Deaktivierung
 */
export function setConcentration(
  c: Combatant,
  actionId: string | undefined,
  state?: CombatState
): void {
  const prev = c.combatState.concentratingOn;
  c.combatState.concentratingOn = actionId;

  // Deaktiviere Zones bei Concentration-Wechsel
  if (state && prev && prev !== actionId && state.activeZones) {
    const before = state.activeZones.length;
    state.activeZones = state.activeZones.filter(z => z.ownerId !== c.id);
    const removed = before - state.activeZones.length;
    if (removed > 0) {
      debug('setConcentration: deactivated zones', { ownerId: c.id, removed });
    }
  }
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
    state.currentTurnBudget = createTurnBudget(nextCombatant, state);

    // Reaction Budget für diesen Combatant zurücksetzen (D&D 5e: Reset bei Turn-Start)
    if (state.reactionBudgets) {
      state.reactionBudgets.set(nextCombatant.id, { hasReaction: true });
    }

    // Condition Duration Processing (D&D 5e: Decrement at Turn Start)
    const conditionResult = processConditionsOnTurnStart(nextCombatant);
    if (conditionResult.expired.length > 0) {
      debug('advanceTurn: conditions expired', {
        combatant: nextCombatant.name,
        expired: conditionResult.expired,
      });
    }
    if (conditionResult.saved.length > 0) {
      debug('advanceTurn: conditions saved', {
        combatant: nextCombatant.name,
        saved: conditionResult.saved,
      });
    }
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

// ============================================================================
// GRAPPLE HELPERS
// ============================================================================

/**
 * Findet alle Combatants die von diesem Grappler gegrappled werden.
 * Sucht nach 'grappled' Conditions mit sourceId = grappler.id.
 *
 * @param grappler Der potentielle Grappler
 * @param state State mit combatants Array
 * @returns Array von gegrappelten Combatants
 */
export function getGrappledTargets(
  grappler: Combatant,
  state: CombatantSimulationState
): Combatant[] {
  return state.combatants.filter(c =>
    c.combatState.conditions.some(
      cond => cond.name === 'grappled' && cond.sourceId === grappler.id
    )
  );
}

/**
 * Prüft ob ein Combatant das Abduct-Trait hat.
 * Abduct: Keine Speed-Reduktion beim Ziehen gegrappelter Targets.
 *
 * @param combatant Der zu prüfende Combatant
 * @returns true wenn trait-abduct in Actions vorhanden
 */
export function hasAbductTrait(combatant: Combatant): boolean {
  return getActions(combatant).some(a => a.id === 'trait-abduct');
}

/**
 * Berechnet effektive Speed unter Berücksichtigung von Conditions und Zones.
 * Conditions wie 'grappled', 'restrained', 'paralyzed' setzen Speed auf 0.
 * Liest Effekte deklarativ aus CONDITION_EFFECTS.
 *
 * Grapple-Drag (D&D 5e PHB):
 * Wenn Combatant jemanden grappled, ist Speed halbiert beim Bewegen.
 * Ausnahme: Abduct-Trait entfernt diese Reduktion.
 *
 * Zone Speed-Modifier (Spirit Guardians, etc.):
 * Zones mit speedModifier reduzieren Movement (z.B. 0.5 für halbe Speed).
 *
 * @param combatant Der Combatant
 * @param state Optional: State mit combatants Array für Grapple-Drag und Zone Check
 * @returns Effektive Speed in Feet
 */
export function getEffectiveSpeed(combatant: Combatant, state?: CombatantSimulationState): number {
  const baseSpeed = getSpeed(combatant).walk ?? 30;
  const conditions = combatant.combatState.conditions ?? [];

  // Prüfe alle aktiven Conditions auf Speed-Modifikation
  for (const cond of conditions) {
    const condName = cond.name as ConditionEffectKey;
    const effects = CONDITION_EFFECTS[condName];
    if (effects && 'speed' in effects && effects.speed === 0) {
      debug('getEffectiveSpeed:', {
        id: combatant.id,
        condition: cond.name,
        speedOverride: 0,
      });
      return 0;
    }
  }

  let effectiveSpeed = baseSpeed;

  // Grapple-Drag: Speed halbieren wenn Target grappled (außer Abduct)
  if (state && getGrappledTargets(combatant, state).length > 0) {
    if (!hasAbductTrait(combatant)) {
      effectiveSpeed = Math.floor(effectiveSpeed / 2);
      debug('getEffectiveSpeed:', {
        id: combatant.id,
        grappling: true,
        hasAbduct: false,
        baseSpeed,
        halvedSpeed: effectiveSpeed,
      });
    } else {
      debug('getEffectiveSpeed:', {
        id: combatant.id,
        grappling: true,
        hasAbduct: true,
        speed: effectiveSpeed,
      });
    }
  }

  // Zone Speed-Modifier (Spirit Guardians, etc.)
  // Prüfe ob Combatant in einer Zone mit speedModifier steht
  const combatState = state as CombatState | undefined;
  if (combatState?.activeZones && combatState.activeZones.length > 0) {
    const combatantPos = combatant.combatState.position;

    for (const zone of combatState.activeZones) {
      // Skip own zones
      if (zone.ownerId === combatant.id) continue;

      // Skip if no speedModifier defined
      if (!zone.effect.zone?.speedModifier) continue;

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
    hasBonusAction: hasAnyBonusAction(combatant),
    hasReaction: true,
  };
}

/**
 * Calculates movement bonus from grantMovement effect.
 * Single source of truth for dash/extra/teleport calculations.
 *
 * Used by both candidate generation (actionEnumeration) and
 * execution (executeAction) to ensure consistent movement ranges.
 *
 * @param grant The grantMovement effect from an Action
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

// NOTE: Legacy budget functions (consumeMovement, consumeAction, consumeBonusAction,
// consumeReaction, applyDash, hasBudgetRemaining) wurden entfernt.
// Budget-Verbrauch wird jetzt über budgetCosts im Action-Schema gesteuert.
// Siehe: executeAction.ts applyBudgetCosts()
