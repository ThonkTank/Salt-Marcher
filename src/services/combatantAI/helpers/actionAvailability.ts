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
// [TODO]: Party-Resources initialisieren
// - createPartyCombatants() sollte Character.spellSlots nutzen
// - Requires: spellSlots Feld auf Character Entity
// - Alternativ: Inferenz aus Character-Level und Class

import type { Action } from '@/types/entities';
import type { Combatant, CombatResources } from '@/types/combat';
import { getActions } from '../../combatTracking';
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
 * 3. hasAction Requirements (fuer OA: Combatant muss Melee-Action haben)
 * 4. Condition-Checks (Incapacitated kann keine Actions nehmen)
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

  // 3. hasAction Requirements (fuer OA: Combatant muss passende Action haben)
  // Prueft ob der Combatant mindestens eine Action hat die den Kriterien entspricht
  if (action.requires?.hasAction) {
    const combatantActions = getActions(combatant);
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

  // 4. Condition Checks
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
export function getEscapeActionsForCombatant(combatant: Combatant): Action[] {
  const conditions = combatant.combatState.conditions ?? [];
  const escapableConditions = conditions.filter(
    c => c.duration?.type === 'until-escape' && c.duration?.escapeCheck
  );

  if (escapableConditions.length === 0) return [];

  return escapableConditions.map(condition => {
    const escapeCheck = condition.duration!.escapeCheck!;
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
              value: Math.ceil(('movementCost' in escapeCheck ? escapeCheck.movementCost ?? 0.5 : 0.5) * 6),
            },
          }];

    const escapeAction: Action = {
      id: `escape-${conditionName}`,
      name: `Escape ${conditionName.charAt(0).toUpperCase() + conditionName.slice(1)}`,
      actionType: 'utility',
      timing: { type: timingType },
      range: { type: 'self', normal: 0 },
      targeting: { type: 'single', validTargets: 'self' },
      autoHit: true,
      budgetCosts,
      description: `Attempt to escape from ${conditionName}.`,
      // Meta-Felder für executeAction
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
  context: { priorActions?: Action[] } = {}
): Action[] {
  const combatantActions = getActions(combatant);
  const escapeActions = getEscapeActionsForCombatant(combatant);
  const allActions = [...combatantActions, ...standardActions, ...escapeActions];
  return allActions.filter(a => isActionUsable(a, combatant, context));
}
