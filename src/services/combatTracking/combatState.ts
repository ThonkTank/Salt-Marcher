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

import type { CombatEvent } from '@/types/entities/combatEvent';
import type { CreatureDefinition } from '@/types/entities';
import type { AbilityScores } from '@/types/entities/creature';
import {
  calculateDeathProbability,
} from '@/utils';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { modifierPresetsMap } from '../../../presets/modifiers';
import {
  handleLinkedConditionOnApply,
  handleLinkedConditionOnRemove,
  handleSourceDeath,
  handlePositionSync,
} from './conditionLifecycle';

// Types aus @/types/combat (Single Source of Truth)
import type {
  ProbabilityDistribution,
  GridPosition,
  CombatResources,
  ConditionState,
  Combatant,
  CombatState,
  CombatantSimulationState,
  CombatStateWithLayers,
  CombatEventBaseValues,
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

/** Cache-Entry mit CreatureDefinition + resolved CombatEvents. */
export interface ResolvedCreature {
  definition: CreatureDefinition;
  actions: CombatEvent[];  // Resolved: creature.actions + actionIds aus Vault
}

const creatureCache = new Map<string, ResolvedCreature>();

/**
 * Resolved CombatEvents aus creature.actions + actionIds + standardCombatEvents.
 * Falls keine creature-spezifischen CombatEvents vorhanden: Default-CombatEvent basierend auf CR.
 *
 * StandardCombatEvents (Move, Dash, Disengage, Dodge, Opportunity Attack) werden
 * automatisch hinzugefügt wenn sie im Vault mit 'std-' Prefix registriert sind.
 */
function resolveCombatEvents(creature: CreatureDefinition): CombatEvent[] {
  const actions: CombatEvent[] = [...(creature.actions ?? [])];

  // Lade referenzierte CombatEvents aus Vault
  if (creature.actionIds?.length) {
    for (const actionId of creature.actionIds) {
      try {
        const action = vault.getEntity<CombatEvent>('action', actionId);
        actions.push(action);
        debug('resolved actionId:', actionId);
      } catch {
        debug('actionId not found, skipping:', actionId);
      }
    }
  }

  // Fallback: Default-CombatEvent wenn keine creature-spezifischen CombatEvents vorhanden
  if (actions.length === 0) {
    debug('no actions, using default for CR:', creature.cr);
    actions.push(getDefaultCreatureCombatEvent(creature.cr));
  }

  // StandardCombatEvents hinzufügen (Move, Dash, Disengage, Dodge, Opportunity Attack)
  // Diese sind für alle Combatants verfügbar, gefiltert durch requires.hasCombatEvent
  try {
    const allCombatEvents = vault.getAllEntities<CombatEvent>('action');
    const standardCombatEvents = allCombatEvents.filter(a => a.id?.startsWith('std-'));
    for (const stdCombatEvent of standardCombatEvents) {
      // Nur hinzufügen wenn noch nicht vorhanden (verhindert Duplikate)
      if (!actions.some(a => a.id === stdCombatEvent.id)) {
        actions.push(stdCombatEvent);
        debug('added standardCombatEvent:', stdCombatEvent.id);
      }
    }
  } catch {
    debug('could not load standardCombatEvents from vault');
  }

  return actions;
}

/**
 * Generiert Default-CombatEvent für Creature ohne CombatEvents.
 * CR-skalierte Natural Attack.
 */
function getDefaultCreatureCombatEvent(cr: number): CombatEvent {
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
  } as unknown as CombatEvent;
}

/**
 * Lädt CreatureDefinition mit resolved CombatEvents (gecached).
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
  const actions = resolveCombatEvents(definition);

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
  /** Base Values Cache: `{casterType}-{actionId}:{targetType}` → CombatEventBaseValues */
  baseValuesCache: Map<string, CombatEventBaseValues>;
}

// Re-exports für Convenience
export type { CombatState, CombatStateWithLayers, Combatant, CombatEventBaseValues };

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

// getSpeed moved to movement.ts - re-exported below

/**
 * Gibt CombatEvents des Combatants zurück.
 * NPC: resolved CombatEvents via CreatureDefinition.
 * Character: character.actions (muss definiert sein).
 */
export function getCombatEvents(c: Combatant): CombatEvent[] {
  if (isNPC(c)) {
    return getResolvedCreature(c.creature.id).actions;
  }
  if (!c.actions || c.actions.length === 0) {
    throw new Error(`Character "${c.name}" (${c.id}) hat keine CombatEvents definiert`);
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
 * Aufrufen nach jeder Schadensanwendung in executeCombatEvent().
 * Akzeptiert CombatState, CombatantSimulationState, und *WithLayers Varianten.
 *
 * Lifecycle: When a combatant dies, handles death triggers for conditions
 * where the dead combatant was the source (e.g., frees grappled targets).
 * Requires CombatState with lifecycleRegistry for lifecycle handling.
 */
export function markDeadCombatants(state: CombatState | { combatants: Combatant[] }): void {
  for (const c of state.combatants) {
    if (!c.combatState.isDead && getDeathProbability(c) >= 0.95) {
      c.combatState.isDead = true;
      debug('combatant marked dead:', c.name, c.id, 'deathProb:', getDeathProbability(c));

      // Lifecycle: Handle death triggers (e.g., free grappled targets when grappler dies)
      if ('lifecycleRegistry' in state && state.lifecycleRegistry) {
        handleSourceDeath(c, state, state.lifecycleRegistry);
      }
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
export function setPosition(c: Combatant, pos: GridPosition, state?: CombatantSimulationState | CombatState): void {
  c.combatState.position = pos;

  // Lifecycle: Position sync for linked conditions (e.g., grappled targets follow grappler)
  // Only CombatState has lifecycleRegistry - skip for CombatantSimulationState
  if (state && 'lifecycleRegistry' in state && state.lifecycleRegistry) {
    const synced = handlePositionSync(c, pos, state, state.lifecycleRegistry);
    if (synced.length > 0) {
      debug('setPosition: position sync', {
        mover: c.id,
        synced: synced.map(s => s.id),
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
 * Gibt die Modifier-ID für eine Condition zurück.
 * Naming-Pattern: condition-{name} (exakte Übereinstimmung)
 */
function getModifierIdForCondition(conditionName: string): string {
  return `condition-${conditionName}`;
}

/**
 * Options for addCondition lifecycle handling.
 */
export interface AddConditionOptions {
  /** The combatant who applied this condition (for linked conditions) */
  source?: Combatant;
  /** Combat state for lifecycle registry access */
  state?: CombatState;
}

/**
 * Fügt eine Condition hinzu.
 * Registriert automatisch den zugehörigen SchemaModifier auf combatState.modifiers[].
 * Uses unified Duration schema directly (no conversion needed).
 *
 * Lifecycle: If source and state are provided, handles linked conditions
 * (e.g., applying 'grappling' to source when 'grappled' is applied to target).
 */
export function addCondition(
  c: Combatant,
  condition: ConditionState,
  options?: AddConditionOptions
): void {
  // 1. Condition auf conditions[] speichern
  c.combatState.conditions.push(condition);

  // 2. SchemaModifier auf modifiers[] registrieren (exakte ID: condition-{name})
  const modifierId = getModifierIdForCondition(condition.name);
  const modifier = modifierPresetsMap.get(modifierId);
  if (modifier) {
    c.combatState.modifiers.push({
      modifier,
      source: { type: 'condition', sourceId: condition.sourceId },
      duration: condition.duration,  // Unified Duration schema
      probability: condition.probability,
    });
    debug('addCondition: registered modifier', {
      combatant: c.id,
      condition: condition.name,
      modifierId,
    });
  }

  // 3. Lifecycle: Handle linked conditions (e.g., grappled → grappling on source)
  if (options?.source && options?.state?.lifecycleRegistry) {
    handleLinkedConditionOnApply(
      c,
      condition,
      options.source,
      options.state.lifecycleRegistry
    );
  }
}

/**
 * Options for removeCondition lifecycle handling.
 */
export interface RemoveConditionOptions {
  /** Combat state for lifecycle registry access */
  state?: CombatState;
}

/**
 * Entfernt eine Condition nach Name.
 * Entfernt automatisch den zugehörigen SchemaModifier von combatState.modifiers[].
 *
 * Lifecycle: If state is provided, handles linked condition removal
 * (e.g., removing 'grappling' from source when last 'grappled' target is freed).
 */
export function removeCondition(
  c: Combatant,
  conditionName: string,
  options?: RemoveConditionOptions
): void {
  // 0. Store sourceId before removal for lifecycle handling
  const condition = c.combatState.conditions.find(cond => cond.name === conditionName);
  const sourceId = condition?.sourceId;

  // 1. Condition von conditions[] entfernen
  c.combatState.conditions = c.combatState.conditions.filter(
    cond => cond.name !== conditionName
  );

  // 2. Zugehörigen Modifier von modifiers[] entfernen (exakte ID: condition-{name})
  const modifierId = getModifierIdForCondition(conditionName);
  const beforeCount = c.combatState.modifiers.length;
  c.combatState.modifiers = c.combatState.modifiers.filter(
    am => am.modifier.id !== modifierId
  );
  const removedCount = beforeCount - c.combatState.modifiers.length;

  if (removedCount > 0) {
    debug('removeCondition: removed modifier', {
      combatant: c.id,
      condition: conditionName,
      modifierId,
    });
  }

  // 3. Lifecycle: Handle linked condition removal (e.g., grappling when no more grappled targets)
  if (options?.state?.lifecycleRegistry && sourceId) {
    handleLinkedConditionOnRemove(
      c,
      conditionName,
      sourceId,
      options.state,
      options.state.lifecycleRegistry
    );
  }
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
      // Escape erfordert CombatEvent, wird nicht automatisch geprüft
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
 * - Prüft endingSave (CombatEventEffect.endingSave - erlaubt Save am Turn-Ende)
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
 * @param actionId Die neue Concentration-CombatEvent (oder undefined zum Beenden)
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
// IMPORT FROM movement.ts (für lokale Verwendung)
// ============================================================================

// advanceTurn braucht createTurnBudget
import { createTurnBudget } from './movement';

// NOTE: Alle Movement-Funktionen (getSpeed, getEffectiveSpeed, createTurnBudget,
// calculateGrantedMovement, hasAnyBonusCombatEvent, getGrappledTargets, hasAbductTrait)
// werden jetzt aus combatTracking/movement.ts exportiert.
// Konsumenten importieren via combatTracking/index.ts
