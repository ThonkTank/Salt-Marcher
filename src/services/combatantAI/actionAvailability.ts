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
// - Aufgerufen von: turnExecution.executeTurn(), turnExecution.generateFollowups()
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
// [TODO]: Party-Resources initialisieren
// - createPartyCombatants() sollte Character.spellSlots nutzen
// - Requires: spellSlots Feld auf Character Entity
// - Alternativ: Inferenz aus Character-Level und Class

import type { Action } from '@/types/entities';
import type { Combatant, CombatResources } from '@/types/combat';
import { getActions } from '../combatTracking';
// Standard-Actions (Dash, Disengage, Dodge) - verfuegbar fuer alle Combatants
import { standardActions } from '../../../presets/actions';

// Re-export Resource Management from combatTracking (canonical location)
export {
  initializeResources,
  consumeActionResource,
  tickRechargeTimers,
} from '../combatTracking';

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
  action: Action,
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
  prior: Action,
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
 * 2. Prior-Action Requirements (fuer Bonus Actions wie TWF)
 * 3. Condition-Checks (Incapacitated kann keine Actions nehmen)
 *
 * @param action Die zu pruefende Action
 * @param combatant Der ausfuehrende Combatant
 * @param context Optionaler Kontext (priorActions fuer Bonus Action Requirements)
 * @returns true wenn Action ausgefuehrt werden kann
 */
export function isActionUsable(
  action: Action,
  combatant: Combatant,
  context: { priorActions?: Action[] } = {}
): boolean {
  const resources = combatant.combatState.resources;

  // 1. Resource Check
  if (!isActionAvailable(action, resources)) {
    return false;
  }

  // 2. Prior-Action Requirements (fuer Bonus Actions wie TWF)
  if (action.requires?.priorAction) {
    const hasMatch = context.priorActions?.some(prior =>
      matchesRequirement(prior, action.requires!.priorAction!)
    ) ?? false;
    if (!hasMatch) {
      debug('isActionUsable: prior action requirement not met', { action: action.id });
      return false;
    }
  }

  // 3. Condition Checks
  if (hasIncapacitatingCondition(combatant)) {
    debug('isActionUsable: combatant incapacitated', { combatant: combatant.id });
    return false;
  }

  return true;
}

// ============================================================================
// AVAILABLE ACTIONS
// ============================================================================

/**
 * Kombiniert Creature-spezifische Actions mit Standard-Actions.
 * Standard-Actions (Dash, Disengage, Dodge) sind fuer alle Combatants verfuegbar.
 * Filtert Actions die nicht verfuegbar sind (keine Spell Slots, auf Cooldown, etc.)
 *
 * @param combatant Der Combatant
 * @param context Optionaler Kontext (priorActions fuer Bonus Action Requirements)
 * @returns Gefilterte Actions die ausgefuehrt werden koennen
 */
export function getAvailableActionsForCombatant(
  combatant: Combatant,
  context: { priorActions?: Action[] } = {}
): Action[] {
  const combatantActions = getActions(combatant);
  const allActions = [...combatantActions, ...standardActions];
  return allActions.filter(a => isActionUsable(a, combatant, context));
}
