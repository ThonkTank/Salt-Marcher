// Ziel: Konsolidierte Action-Availability-Logik fuer Combat-AI
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Funktionen:
// - isActionAvailable(): Resource-Check (Spell Slots, Recharge, Per-Day)
// - matchesRequirement(): Prior-Action Match (TWF, Flurry)
// - isActionUsable(): Kombiniert alle Checks (Resources + Requirements + Conditions)
// - hasIncapacitatingCondition(): Condition-Check (Stunned, Paralyzed, etc.)
// - getAvailableActionsForCombatant(): Gefilterte Actions fuer einen Combatant
//
// Resource-Management (initializeResources, consumeActionResource, tickRechargeTimers)
// ist nach combatTracking/initialiseCombat.ts ausgelagert.
//
// Pipeline-Position:
// - Aufgerufen von: planNextAction.selectNextAction(), planNextAction.generateFollowups()
// - Nutzt: Action.spellSlot, Action.recharge, Action.requires, Combatant.combatState
// - Output: boolean (Verfuegbarkeit)

// ============================================================================
// HACK & TODO
// ============================================================================
//
// --- Requirement Matching HACKs ---
//
// [HACK]: sameTarget in matchesRequirement() ignoriert
// - matchesRequirement() prueft nur actionType und properties
// - sameTarget bleibt im Schema fuer zukuenftige Features (z.B. Monk Stunning Strike)
// - Korrekt waere: Target-Tracking in priorActions + sameTarget-Pruefung
//
// --- Condition Check HACKs ---
//
// [HACK]: hasIncapacitatingCondition() prueft nur 4 Conditions
// - Nur: incapacitated, unconscious, paralyzed, stunned
// - Weitere Einschraenkungen (frightened, charmed) nicht geprueft
// - Spell-spezifische Einschraenkungen (silenced → verbal) nicht geprueft
//
// --- TODOs ---
//
// [TODO]: shouldUseResource() Heuristik implementieren
// - Spec: crystalline-herding-nygaard.md Phase 4.2
// - RESOURCE_THRESHOLD = 0.6 (nur nutzen wenn >= 60% max value)
// - Input: action, currentScore, maxPossibleScore
// - Output: boolean ob Resource genutzt werden soll
//
// [TODO]: Material Component Costs pruefen
// - isActionAvailable() ignoriert action.components.materialCost
// - Kein Gold-Tracking im Combat-State
// - Ideal: components.consumed=true → Gold abziehen und tracken
//
// [HACK]: itemTag-basierte Kosten nicht vollstaendig implementiert
// - isCostAffordable() unterstuetzt nur itemId, nicht itemTag
// - itemTag erfordert Item-Entity Lookup um Tags zu pruefen
// - Fuer MVP: itemId direkter Match, itemTag ignoriert
//
// [TODO]: Party-Resources initialisieren
// - createPartyCombatants() sollte Character.spellSlots nutzen
// - Requires: spellSlots Feld auf Character Entity
// - Alternativ: Inferenz aus Character-Level und Class

import type {
  CombatEvent,
  SchemaModifier,
  PropertyModifier,
  Cost,
  AbilityType,
  SkillType,
  SkillOrAbility,
  Check,
} from '@/types/entities/combatEvent';
import type { Combatant, CombatResources, CombatInventoryItem } from '@/types/combat';
import { getCombatEvents } from '../../combatTracking';
// Standard-Actions (Dash, Disengage, Dodge) - verfuegbar fuer alle Combatants
import { standardActions } from '../../../../presets/actions';

// Re-export Resource Management from combatTracking (canonical location)
export {
  initializeResources,
  consumeActionResource,
  tickRechargeTimers,
} from '../../combatTracking';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[actionAvailability]', ...args);
  }
};

// ============================================================================
// INCAPACITATING CONDITIONS
// ============================================================================

/** Conditions die alle Actions verhindern. */
const INCAPACITATING_CONDITIONS = [
  'incapacitated',
  'unconscious',
  'paralyzed',
  'stunned',
] as const;

/**
 * Prueft ob ein Combatant eine Condition hat die Actions verhindert.
 * HACK: Nur 4 Conditions geprueft - siehe Header.
 *
 * @param combatant Der zu pruefende Combatant
 * @returns true wenn Combatant incapacitated ist
 */
export function hasIncapacitatingCondition(combatant: Combatant): boolean {
  const conditions = combatant.combatState.conditions ?? [];
  return conditions.some(c =>
    INCAPACITATING_CONDITIONS.includes(c.name as typeof INCAPACITATING_CONDITIONS[number])
  );
}

/**
 * Berechnet die kombinierte Wahrscheinlichkeit, dass ein Combatant
 * durch incapacitating Conditions handlungsunfaehig ist.
 *
 * Verwendet Inklusions-Exklusions-Prinzip vereinfacht:
 * P(any) = 1 - P(none) = 1 - Π(1 - P(condition_i))
 *
 * @param combatant Der zu pruefende Combatant
 * @returns Wahrscheinlichkeit (0-1) dass Combatant incapacitated ist
 */
export function getIncapacitatingProbability(combatant: Combatant): number {
  const conditions = combatant.combatState.conditions ?? [];
  const incapConditions = conditions.filter(c =>
    INCAPACITATING_CONDITIONS.includes(c.name as typeof INCAPACITATING_CONDITIONS[number])
  );

  if (incapConditions.length === 0) return 0;

  // P(mindestens eine aktiv) = 1 - P(alle inaktiv)
  const allInactiveProb = incapConditions.reduce(
    (prob, c) => prob * (1 - c.probability),
    1
  );

  return 1 - allInactiveProb;
}

// ============================================================================
// RESOURCE AVAILABILITY
// ============================================================================

/**
 * Prueft ob eine Action Resource-maessig verfuegbar ist (Spell Slots, Recharge, Uses).
 * HACK: Legendary Actions und Material Costs nicht geprueft - siehe Header.
 *
 * @param action Die zu pruefende Action
 * @param resources Die aktuellen Combat-Resources (optional)
 * @returns true wenn Action ausgefuehrt werden kann
 */
export function isActionAvailable(
  action: CombatEvent,
  resources: CombatResources | undefined
): boolean {
  // Kein Resource-Tracking = alles verfuegbar
  if (!resources) return true;

  // 1. Spell Slot Check
  if (action.spellSlot) {
    const level = action.spellSlot.level;
    const available = resources.spellSlots?.[level] ?? 0;
    if (available <= 0) {
      debug('isActionAvailable: no spell slots', { action: action.id, level });
      return false;
    }
  }

  // 2. Recharge Timer Check (Timer muss 0 sein = bereit)
  if (action.recharge?.type === 'recharge') {
    const timer = resources.rechargeTimers?.[action.id] ?? 0;
    if (timer > 0) {
      debug('isActionAvailable: on cooldown', { action: action.id, timer });
      return false;
    }
  }

  // 3. Per-Day / Per-Rest Check
  if (action.recharge?.type === 'per-day' || action.recharge?.type === 'per-rest') {
    const remaining = resources.perDayUses?.[action.id] ?? 0;
    if (remaining <= 0) {
      debug('isActionAvailable: no uses remaining', { action: action.id });
      return false;
    }
  }

  // 4. At-will, legendary, lair, mythic: immer verfuegbar
  return true;
}

// ============================================================================
// COST AFFORDABILITY (consume-item)
// ============================================================================

/**
 * Findet ein Item im Combat-Inventory anhand itemId oder itemTag.
 * HACK: itemTag nicht vollstaendig implementiert - siehe Header.
 *
 * @param inventory Das Combat-Inventory des Combatants
 * @param itemId Optionale exakte Item-ID
 * @param itemTag Optionales Item-Tag (nicht implementiert)
 * @returns Das gefundene Item oder undefined
 */
function findInventoryItem(
  inventory: CombatInventoryItem[],
  itemId?: string,
  itemTag?: string
): CombatInventoryItem | undefined {
  // 1. itemId Match: Exakter ID-Match
  if (itemId) {
    return inventory.find(item => item.id === itemId);
  }

  // 2. itemTag Match: HACK - nur wenn Item tags hat
  // Vollstaendige Implementierung erfordert Item-Entity Lookup
  if (itemTag) {
    return inventory.find(item => item.tags?.includes(itemTag));
  }

  return undefined;
}

/**
 * Prueft ob ein einzelner Cost bezahlt werden kann.
 *
 * @param cost Der zu pruefende Cost
 * @param inventory Das Combat-Inventory des Combatants
 * @param resources Die Combat-Resources des Combatants
 * @returns true wenn Cost bezahlt werden kann
 */
function isSingleCostAffordable(
  cost: Cost,
  inventory: CombatInventoryItem[],
  resources: CombatResources | undefined
): boolean {
  switch (cost.type) {
    case 'consume-item': {
      const item = findInventoryItem(inventory, cost.itemId, cost.itemTag);
      if (!item || item.quantity < cost.quantity) {
        debug('isSingleCostAffordable: not enough items', {
          costItemId: cost.itemId,
          costItemTag: cost.itemTag,
          required: cost.quantity,
          available: item?.quantity ?? 0,
        });
        return false;
      }
      return true;
    }

    case 'action-economy':
      // Action-Economy wird separat ueber TurnBudget geprueft
      return true;

    case 'spell-slot': {
      const level = cost.level as number;
      const available = resources?.spellSlots?.[level] ?? 0;
      return available > 0;
    }

    case 'hp':
      // HP-Kosten koennten gegen currentHp geprueft werden
      // Fuer MVP: Immer erlauben (AI entscheidet ob lohnend)
      return true;

    case 'composite':
      // Rekursiv alle Sub-Costs pruefen
      return cost.costs.every(subCost =>
        isSingleCostAffordable(subCost, inventory, resources)
      );

    default:
      // Unbekannte Costs: Erlauben (fail-open)
      return true;
  }
}

/**
 * Prueft ob ein Combatant die Kosten einer Action bezahlen kann.
 * Unterstuetzt alle Cost-Typen inkl. composite und consume-item.
 *
 * @param action Die zu pruefende Action
 * @param combatant Der Combatant der die Action ausfuehren will
 * @returns true wenn alle Costs bezahlt werden koennen
 */
export function isCostAffordable(
  action: CombatEvent,
  combatant: Combatant
): boolean {
  // Keine Costs = immer erschwinglich
  if (!action.cost) return true;

  const inventory = combatant.combatState.inventory ?? [];
  const resources = combatant.combatState.resources;

  return isSingleCostAffordable(action.cost, inventory, resources);
}

/**
 * Konsumiert Items aus dem Combat-Inventory.
 * Mutiert das Inventory direkt.
 *
 * @param inventory Das Combat-Inventory (wird mutiert)
 * @param itemId Optionale exakte Item-ID
 * @param itemTag Optionales Item-Tag
 * @param quantity Anzahl zu konsumieren
 */
function consumeInventoryItem(
  inventory: CombatInventoryItem[],
  itemId?: string,
  itemTag?: string,
  quantity: number = 1
): void {
  const item = findInventoryItem(inventory, itemId, itemTag);
  if (item) {
    item.quantity -= quantity;
    debug('consumeInventoryItem:', {
      itemId: item.id,
      consumed: quantity,
      remaining: item.quantity,
    });
  }
}

/**
 * Konsumiert einen einzelnen Cost.
 * Mutiert Inventory und Resources.
 */
function consumeSingleCost(
  cost: Cost,
  inventory: CombatInventoryItem[],
  resources: CombatResources | undefined
): void {
  switch (cost.type) {
    case 'consume-item':
      consumeInventoryItem(inventory, cost.itemId, cost.itemTag, cost.quantity);
      break;

    case 'spell-slot': {
      const level = cost.level as number;
      if (resources?.spellSlots && resources.spellSlots[level] > 0) {
        resources.spellSlots[level]--;
        debug('consumeSingleCost: spell slot', { level });
      }
      break;
    }

    case 'hp':
      // HP-Kosten werden ueber damage resolution abgehandelt, nicht hier
      break;

    case 'composite':
      for (const subCost of cost.costs) {
        consumeSingleCost(subCost, inventory, resources);
      }
      break;

    case 'action-economy':
      // Action-Economy wird ueber TurnBudget verwaltet, nicht hier
      break;
  }
}

/**
 * Konsumiert die Kosten einer Action nach erfolgreicher Ausfuehrung.
 * Mutiert combatState.inventory und combatState.resources.
 *
 * @param action Die ausgefuehrte Action
 * @param combatant Der Combatant (combatState wird mutiert)
 */
export function consumeActionCost(
  action: CombatEvent,
  combatant: Combatant
): void {
  if (!action.cost) return;

  const inventory = combatant.combatState.inventory ?? [];
  const resources = combatant.combatState.resources;

  consumeSingleCost(action.cost, inventory, resources);
}

// ============================================================================
// REQUIREMENT MATCHING
// ============================================================================

/**
 * Prueft ob eine zuvor ausgefuehrte Action die Requirements einer Action erfuellt.
 * Fuer TWF: priorAction muss actionType 'melee-weapon' UND property 'light' haben.
 * Gilt fuer alle Action-Typen (nicht nur Bonus Actions).
 * HACK: sameTarget ignoriert - siehe Header.
 *
 * @param prior Die zuvor ausgefuehrte Action
 * @param requirement Die zu pruefenden Requirements
 * @returns true wenn alle Requirements erfuellt sind
 */
export function matchesRequirement(
  prior: CombatEvent,
  requirement: { actionType?: string[]; properties?: string[]; sameTarget?: boolean }
): boolean {
  // actionType Match: prior.actionType muss in requirement.actionType enthalten sein
  if (requirement.actionType && requirement.actionType.length > 0) {
    if (!requirement.actionType.includes(prior.actionType)) {
      return false;
    }
  }

  // properties Match: ALLE required properties muessen in prior.properties enthalten sein
  if (requirement.properties && requirement.properties.length > 0) {
    const priorProps = prior.properties ?? [];
    const hasAllProperties = requirement.properties.every(reqProp =>
      priorProps.includes(reqProp)
    );
    if (!hasAllProperties) {
      return false;
    }
  }

  // sameTarget: Nicht implementiert (RAW TWF erfordert kein gleiches Target)
  // Wird ignoriert - bleibt fuer zukuenftige Features im Schema

  return true;
}

// ============================================================================
// COMBINED USABILITY CHECK
// ============================================================================

/**
 * Prueft ob eine Action ausgefuehrt werden kann (kombiniert alle Checks).
 * 1. Resource-Verfuegbarkeit (Spell Slots, Recharge, Uses)
 * 2. Cost-Affordability (consume-item, composite costs)
 * 3. Prior-Action Requirements (fuer Bonus Actions wie TWF)
 * 4. hasAction Requirements (fuer OA: Combatant muss Melee-Action haben)
 * 5. Condition-Checks (Incapacitated kann keine Actions nehmen)
 *
 * @param action Die zu pruefende Action
 * @param combatant Der ausfuehrende Combatant
 * @param context Optionaler Kontext (priorActions fuer Bonus Action Requirements)
 * @returns true wenn Action ausgefuehrt werden kann
 */
export function isActionUsable(
  action: CombatEvent,
  combatant: Combatant,
  context: { priorActions?: CombatEvent[] } = {}
): boolean {
  const resources = combatant.combatState.resources;

  // 1. Resource Check (legacy: spellSlot, recharge, perDay)
  if (!isActionAvailable(action, resources)) {
    return false;
  }

  // 2. Cost Affordability (new: consume-item, composite)
  if (!isCostAffordable(action, combatant)) {
    debug('isActionUsable: cost not affordable', { action: action.id });
    return false;
  }

  // 3. Prior-Action Requirements (fuer Bonus Actions wie TWF)
  if (action.requires?.priorAction) {
    const hasMatch = context.priorActions?.some(prior =>
      matchesRequirement(prior, action.requires!.priorAction!)
    ) ?? false;
    if (!hasMatch) {
      debug('isActionUsable: prior action requirement not met', { action: action.id });
      return false;
    }
  }

  // 4. hasAction Requirements (fuer OA: Combatant muss passende Action haben)
  // Prueft ob der Combatant mindestens eine Action hat die den Kriterien entspricht
  if (action.requires?.hasAction) {
    const combatantActions = getCombatEvents(combatant);
    const hasMatch = combatantActions.some(a =>
      matchesRequirement(a, action.requires!.hasAction!)
    );
    if (!hasMatch) {
      debug('isActionUsable: hasAction requirement not met', {
        action: action.id,
        required: action.requires.hasAction,
      });
      return false;
    }
  }

  // 5. Condition Checks
  if (hasIncapacitatingCondition(combatant)) {
    debug('isActionUsable: combatant incapacitated', { combatant: combatant.id });
    return false;
  }

  return true;
}

// ============================================================================
// ESCAPE ACTIONS
// ============================================================================

/**
 * Generiert dynamische Escape-Actions für alle escapable Conditions eines Combatants.
 * Jede Condition mit `duration.type === 'until-escape'` bekommt eine eigene Action,
 * damit der Selector sie individuell scoren kann.
 *
 * Die generierten Actions haben:
 * - id: `escape-{conditionName}` (z.B. 'escape-grappled')
 * - timing basierend auf escapeCheck.timing
 * - budgetCosts entsprechend dem Escape-Timing
 * - _escapeCondition und _escapeCheck Meta-Felder
 *
 * @param combatant Der Combatant mit potentiellen escapable Conditions
 * @returns Array von dynamisch generierten Escape-Actions
 */
export function getEscapeActionsForCombatant(combatant: Combatant): CombatEvent[] {
  const conditions = combatant.combatState.conditions ?? [];
  const escapableConditions = conditions.filter(
    c => c.duration?.type === 'until-escape' && c.duration?.escapeCheck
  );

  if (escapableConditions.length === 0) return [];

  return escapableConditions.map(condition => {
    // Type assertion safe due to filter above (duration.type === 'until-escape')
    const duration = condition.duration as Extract<typeof condition.duration, { type: 'until-escape' }>;
    const escapeCheck = duration.escapeCheck;
    const conditionName = condition.name;

    // Timing zu Action-Timing mappen
    type ActionTimingType = 'action' | 'bonus' | 'free';
    const timingType: ActionTimingType = escapeCheck.timing === 'bonus'
      ? 'bonus'
      : escapeCheck.timing === 'movement'
        ? 'free'  // Movement-basiert, keine Action-Economy
        : 'action';

    // Budget-Costs basierend auf Escape-Timing
    const budgetCosts = escapeCheck.timing === 'action'
      ? [{ resource: 'action' as const, cost: { type: 'fixed' as const, value: 1 } }]
      : escapeCheck.timing === 'bonus'
        ? [{ resource: 'bonusAction' as const, cost: { type: 'fixed' as const, value: 1 } }]
        : [{
            resource: 'movement' as const,
            cost: {
              type: 'fixed' as const,
              value: Math.ceil(0.5 * 6), // Default: half movement
            },
          }];

    // Build unified check based on escapeCheck type
    // Unified Check Schema: roller, roll, against, onSuccess, onFailure
    let check: Check | undefined;

    if (escapeCheck.type === 'dc' && escapeCheck.ability && escapeCheck.dc != null) {
      // DC-based escape: Actor rolls ability check vs fixed DC
      check = {
        roller: 'actor' as const,
        roll: { type: 'ability' as const, ability: escapeCheck.ability as AbilityType },
        against: { type: 'fixed' as const, dc: escapeCheck.dc },
        onSuccess: 'effect-applies' as const,
        onFailure: 'no-effect' as const,
      };
    } else if (escapeCheck.type === 'contested' && escapeCheck.escaperChoice?.[0]) {
      // Contested escape: Actor rolls skill vs defender's choice
      check = {
        roller: 'actor' as const,
        roll: { type: 'skill' as const, skill: escapeCheck.escaperChoice[0] as SkillType },
        against: {
          type: 'contested' as const,
          choice: escapeCheck.defenderSkill
            ? [escapeCheck.defenderSkill as SkillOrAbility]
            : ['athletics', 'acrobatics'] as SkillOrAbility[],
        },
        onSuccess: 'effect-applies' as const,
        onFailure: 'no-effect' as const,
      };
    } else if (escapeCheck.type === 'automatic') {
      // Automatic escape: no check required
      check = { type: 'auto' as const };
    }

    const escapeAction: CombatEvent = {
      id: `escape-${conditionName}`,
      name: `Escape ${conditionName.charAt(0).toUpperCase() + conditionName.slice(1)}`,
      actionType: 'utility',
      timing: { type: timingType },
      range: { type: 'self', normal: 0 },
      targeting: { type: 'self' },
      check,
      // Effect: remove the condition when check succeeds
      effect: {
        type: 'remove-condition',
        condition: conditionName,
      },
      budgetCosts,
      description: `Attempt to escape from ${conditionName}.`,
      // Meta-Felder für Condition-Lookup (kept for debugging)
      _escapeCondition: conditionName,
      _escapeCheck: escapeCheck,
    };

    debug('Generated escape action:', {
      id: escapeAction.id,
      condition: conditionName,
      timing: timingType,
      escapeType: escapeCheck.type,
    });

    return escapeAction;
  });
}

// ============================================================================
// TIMING OVERRIDES (Property Modifiers)
// ============================================================================

/**
 * Prueft ob eine Action ID mit einem action-is-id Predicate matcht.
 * Unterstuetzt sowohl einzelne IDs als auch Arrays.
 */
function matchesActionId(
  condition: { type: string; actionId?: string | string[] },
  actionId: string
): boolean {
  if (condition.type !== 'action-is-id') return false;
  const ids = Array.isArray(condition.actionId) ? condition.actionId : [condition.actionId];
  return ids.includes(actionId);
}

/**
 * Wendet PropertyModifiers auf eine Action an.
 * Unterstuetzt 'set' Operation fuer timing.type Overrides.
 *
 * @param action Die urspruengliche Action
 * @param modifiers Die anzuwendenden PropertyModifiers
 * @returns Kopie der Action mit angewandten Modifiers
 */
function applyPropertyModifiers(action: CombatEvent, modifiers: PropertyModifier[] | undefined): CombatEvent {
  if (!modifiers || modifiers.length === 0) return action;

  // Shallow copy - wir modifizieren nur timing
  let modified = { ...action };

  for (const mod of modifiers) {
    // Nur timing.type wird aktuell unterstuetzt
    if (mod.path === 'timing.type' && mod.operation === 'set') {
      modified = {
        ...modified,
        timing: {
          ...modified.timing,
          type: mod.value as 'action' | 'bonus' | 'reaction' | 'legendary' | 'lair' | 'mythic' | 'free' | 'passive',
        },
      };
      debug('applyPropertyModifiers: timing override', {
        action: action.id,
        from: action.timing?.type,
        to: mod.value,
      });
    }
    // Weitere property paths koennen hier ergaenzt werden
  }

  return modified;
}

/**
 * Wendet Timing-Overrides von passiven Traits auf Actions an.
 * Passive Traits mit schemaModifiers koennen action-is-id Conditions nutzen
 * um z.B. Disengage/Hide zu Bonus Actions zu machen (Nimble Escape).
 *
 * @param actions Die zu modifizierenden Actions
 * @param allActions Alle Actions des Combatants (inkl. passive Traits)
 * @returns Actions mit angewandten Timing-Overrides
 */
function applyTimingOverrides(actions: CombatEvent[], allActions: CombatEvent[]): CombatEvent[] {
  // 1. Sammle alle schemaModifiers mit action-is-id condition aus passiven Traits
  const passiveTraits = allActions.filter(a => a.timing?.type === 'passive');
  const timingModifiers: { modifier: SchemaModifier; trait: CombatEvent }[] = [];

  for (const trait of passiveTraits) {
    if (!trait.schemaModifiers) continue;
    for (const mod of trait.schemaModifiers) {
      if (mod.condition.type === 'action-is-id' && mod.contextualEffects?.passive?.propertyModifiers) {
        timingModifiers.push({ modifier: mod, trait });
      }
    }
  }

  if (timingModifiers.length === 0) return actions;

  debug('applyTimingOverrides: found modifiers', {
    count: timingModifiers.length,
    traits: timingModifiers.map(m => m.trait.id),
  });

  // 2. Fuer jede Action pruefen ob ein Modifier matcht
  return actions.map(action => {
    const matchingMod = timingModifiers.find(({ modifier }) =>
      matchesActionId(modifier.condition, action.id)
    );

    if (!matchingMod) return action;

    // 3. propertyModifiers anwenden
    const propertyMods = matchingMod.modifier.contextualEffects.passive?.propertyModifiers;
    if (!propertyMods) return action;
    return applyPropertyModifiers(action, propertyMods);
  });
}

// ============================================================================
// AVAILABLE ACTIONS
// ============================================================================

/**
 * Kombiniert Creature-spezifische Actions mit Standard-Actions und dynamischen Escape-Actions.
 * Standard-Actions (Dash, Disengage, Dodge) sind fuer alle Combatants verfuegbar.
 * Escape-Actions werden dynamisch generiert wenn der Combatant escapable Conditions hat.
 * Filtert Actions die nicht verfuegbar sind (keine Spell Slots, auf Cooldown, etc.)
 *
 * @param combatant Der Combatant
 * @param context Optionaler Kontext (priorActions fuer Bonus Action Requirements)
 * @returns Gefilterte Actions die ausgefuehrt werden koennen
 */
export function getAvailableActionsForCombatant(
  combatant: Combatant,
  context: { priorActions?: CombatEvent[] } = {}
): CombatEvent[] {
  const combatantActions = getCombatEvents(combatant);
  const escapeActions = getEscapeActionsForCombatant(combatant);
  const allActions = [...combatantActions, ...standardActions, ...escapeActions];

  // Wende Timing-Overrides von passiven Traits an (z.B. Nimble Escape)
  const modifiedActions = applyTimingOverrides(allActions, combatantActions);

  return modifiedActions.filter(a => isActionUsable(a, combatant, context));
}

// Aliases for migration
export const isCombatEventUsable = isActionUsable;
export const getEscapeCombatEventsForCombatant = getEscapeActionsForCombatant;
