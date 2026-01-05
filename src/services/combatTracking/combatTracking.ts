// Ziel: Combat State-Management und Action-Resolution
// Siehe: docs/services/combatTracking.md
//
// UI-orientierter Service für Combat-Tracker:
// - "Combatant X macht Combatant Y Z Schaden" → Service übernimmt State-Updates
// - Profile-Erstellung aus Party und Encounter-Gruppen
// - Turn Budget Tracking (D&D 5e Action Economy)
//
// Wird von combatSimulator (AI) und Workflows genutzt.

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Default-Actions für Characters ohne actions
// - getDefaultPartyAction() generiert level-skalierte Weapon-Attack
// - Creatures: Default-Action in creatureCache.ts (getDefaultCreatureAction)
// - Spec: difficulty.md#5.0.1 erwartet Character.actions
//
// [HACK]: Keine Surprise-Prüfung
// - checkSurprise() liefert immer keine Surprise
// - Spec: difficulty.md#5.0.5 prüft Activity.awareness
//
// [HACK]: Keine Condition-Tracking
// - conditionProb immer 0 in resolveAttack()
// - Spec: difficulty.md#5.1.d beschreibt Condition-Wahrscheinlichkeiten
//
// [TODO]: Implementiere resolveHealing() für Healing-Actions
// - Spec: difficulty.md#5.1.b (healing intent)
//
// [TODO]: Implementiere resolveCondition() für Control-Actions
// - Spec: difficulty.md#5.1.b (control intent)
//
// [TODO]: Implementiere checkSurprise() mit Activity.awareness
// - Spec: difficulty.md#5.0.5
//
// [TODO]: Bonus Actions Requirement-Prüfung (requires.priorAction)
// - generateBonusActions() in combatantAI.ts prüft Requirements
// - Spec: turnExploration.md#bonus-action-requirements
//
// --- Phase 4: Resource Management ---
//
// [HACK]: Party-Resources nicht initialisiert
// - createPartyProfiles() ruft NICHT initializeResources() auf
// - Party-Member haben keine resources auf CombatProfile
// - Spell-Slot-Tracking fuer PCs fehlt vollstaendig
// - Ideal: Character.spellSlots nutzen oder aus Class/Level ableiten
//
// --- Phase 6: Reaction System ---
//
// [HACK]: Save-Bonus bei Damage-Reactions via HP approximiert
// - processReactionTrigger() nutzt HP/30 + 2 statt echtem Save-Bonus
// - CombatProfile hat kein saves-Feld
// - Ideal: Save-Boni aus Creature/Character-Schema extrahieren
//
// [HACK]: Counterspell Success nur via counter-Feld geprueft
// - processReactionTrigger() setzt spellCountered wenn reaction.counter existiert
// - Keine DC-Pruefung bei hoeherem Spell-Level
// - Ideal: DC-Check implementieren wenn counterspellLevel < spellLevel
//
// [HACK]: Shield AC-Bonus nicht persistent
// - resolveAttackWithReactions() erhoeht AC nur fuer diese Resolution
// - RAW: Shield AC-Bonus gilt bis Start des naechsten eigenen Zuges
// - Ideal: ConditionState mit temporaerem AC-Modifier tracken
//
// [TODO]: Damage-Reactions gegen Angreifer anwenden
// - processReactionTrigger() berechnet Hellish Rebuke Schaden
// - Schaden wird nicht auf Angreifer-HP angewendet
// - Benoetigt: Rueckgabe und Application in Combat-Flow
//

import type { EncounterGroup } from '@/types/encounterTypes';
import type { Action, Character } from '@/types/entities';
import { vault } from '@/infrastructure/vault/vaultInstance';
import {
  createSingleValue,
  calculateEffectiveDamage,
  applyDamageToHP,
  calculateDeathProbability,
  getExpectedValue,
  feetToCell,
  diceExpressionToPMF,
  addConstant,
} from '@/utils';
import {
  initializeGrid,
  calculateInitialPositions,
  DEFAULT_ENCOUNTER_DISTANCE_FEET,
} from '../gridSpace';
import { calculateBaseDamagePMF } from '../combatSimulator/combatHelpers';
import { initializeResources } from '../combatSimulator/turnExecution';
import { getResolvedCreature } from './creatureCache';
import {
  findMatchingReactions,
  shouldUseReaction,
  evaluateReaction,
  type ReactionContext,
  type ReactionResult,
} from '../combatSimulator/actionScoring';
import type { TriggerEvent } from '@/constants/action';

// Types aus @/types/combat (Single Source of Truth)
import type {
  ProbabilityDistribution,
  GridPosition,
  GridConfig,
  SpeedBlock,
  CombatProfile,
  SimulationState,
  CombatState,
  SurpriseState,
  TurnBudget,
  AttackResolution,
  RoundResult,
  ConditionState,
} from '@/types/combat';

// Re-exports für Consumer
export type {
  ProbabilityDistribution,
  GridPosition,
  GridConfig,
  SpeedBlock,
  CombatProfile,
  SimulationState,
  CombatState,
  SurpriseState,
  TurnBudget,
  AttackResolution,
  RoundResult,
  ConditionState,
} from '@/types/combat';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[combatTracking]', ...args);
  }
};

// ============================================================================
// TYPES (local, not in @/types/combat)
// ============================================================================

/** Input-Typ für Party. */
export interface PartyInput {
  level: number;
  size: number;
  members: { id: string; level: number; hp: number; ac: number }[];
}

// ============================================================================
// TURN BUDGET FUNCTIONS
// ============================================================================

/**
 * Prüft ob ein CombatProfile Bonus Actions hat.
 * Bonus Actions sind Actions mit timing.type === 'bonus'.
 */
export function hasAnyBonusAction(profile: CombatProfile): boolean {
  return profile.actions.some(a => a.timing.type === 'bonus');
}

/** Erstellt TurnBudget aus CombatProfile. */
export function createTurnBudget(profile: CombatProfile): TurnBudget {
  const walkSpeed = profile.speed.walk ?? 30;
  const movementCells = Math.floor(walkSpeed / 5);

  debug('createTurnBudget:', {
    participantId: profile.participantId,
    walkSpeed,
    movementCells,
  });

  return {
    movementCells,
    baseMovementCells: movementCells,
    hasAction: true,
    hasDashed: false,
    hasBonusAction: hasAnyBonusAction(profile),
    hasReaction: true,      // Für OA-Detection später
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

/** Verbraucht die Reaction. TODO: OA-Trigger-Detection (siehe Header) */
export function consumeReaction(budget: TurnBudget): void {
  budget.hasReaction = false;
}

/** Dash fügt die Basis-Bewegungsrate hinzu und verbraucht die Action. */
export function applyDash(budget: TurnBudget): void {
  budget.movementCells += budget.baseMovementCells;
  budget.hasAction = false;
  budget.hasDashed = true;
}

// ============================================================================
// DEFAULT ACTIONS
// ============================================================================

/** Generiert Default-Action für Character ohne Actions. HACK: siehe Header */
function getDefaultPartyAction(level: number): Action {
  const attackBonus = Math.floor(level / 4) + 4;
  const damageBonus = Math.floor(level / 4) + 3;

  return {
    name: 'Weapon Attack',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single' },
    attack: { bonus: attackBonus },
    damage: { dice: '1d8', modifier: damageBonus, type: 'slashing' },
  } as unknown as Action;
}

// ============================================================================
// PROFILE CREATION
// ============================================================================

/** Erstellt Party-Profile. HACK: siehe Header (Default-Actions) */
export function createPartyProfiles(party: PartyInput): CombatProfile[] {
  return party.members.map((member) => {
    let actions: Action[] = [];
    try {
      const character = vault.getEntity<Character>('character', member.id);
      actions = character.actions ?? [];
    } catch {
      // Character nicht im Vault - verwende Default
    }

    if (actions.length === 0) {
      actions = [getDefaultPartyAction(member.level)];
    }

    debug('createPartyProfile:', { memberId: member.id, actionsCount: actions.length });

    return {
      participantId: member.id,
      groupId: 'party',
      hp: createSingleValue(member.hp),
      deathProbability: 0,
      ac: member.ac,
      speed: { walk: 30 },
      actions,
      conditions: [],
      position: { x: 0, y: 0, z: 0 },
    };
  });
}

/**
 * Erstellt Enemy-Profile aus Encounter-Gruppen.
 * Nutzt creatureCache für effizientes Laden (5 Goblins = 1 Lookup).
 * HP von NPC.currentHp (instanz-spezifisch), nicht creature.averageHp.
 *
 * @param groups Encounter-Gruppen mit NPCs
 * @param resourceBudget Budget 0-1 für Ressourcen (1 = volle Spell Slots etc.)
 */
export function createEnemyProfiles(
  groups: EncounterGroup[],
  resourceBudget: number = 1.0
): CombatProfile[] {
  const profiles: CombatProfile[] = [];

  for (const group of groups) {
    for (const npcs of Object.values(group.slots)) {
      for (const npc of npcs) {
        // Creature einmal laden (gecached für gleiche Creature-Typen)
        const { definition: creature, actions } = getResolvedCreature(npc.creature.id);

        // Resource-Initialisierung mit spellSlots aus Creature
        const resources = initializeResources(
          actions,
          creature.spellSlots,
          resourceBudget
        );

        debug('createEnemyProfile:', {
          npcId: npc.id,
          creatureId: npc.creature.id,
          actionsCount: actions.length,
          npcHp: npc.currentHp,
          hasResources: Object.keys(resources).length > 0,
        });

        profiles.push({
          participantId: npc.id,
          groupId: group.groupId,
          // HP von NPC (instanz-spezifisch), nicht creature.averageHp
          hp: createSingleValue(npc.currentHp),
          deathProbability: npc.currentHp <= 0 ? 1 : 0,
          // Combat-Stats von Creature (geteilt via Cache)
          ac: creature.ac,
          speed: {
            walk: creature.speed?.walk ?? 30,
            fly: creature.speed?.fly,
            swim: creature.speed?.swim,
            climb: creature.speed?.climb,
            burrow: creature.speed?.burrow,
          },
          actions,
          conditions: [],
          position: { x: 0, y: 0, z: 0 },
          resources,
        });
      }
    }
  }

  return profiles;
}

// ============================================================================
// SURPRISE
// ============================================================================

/** Prüft Surprise-State. HACK: siehe Header (Activity.awareness nicht geprüft) */
export function checkSurprise(): SurpriseState {
  return {
    partyHasSurprise: false,
    enemyHasSurprise: false,
  };
}

// ============================================================================
// STATE INITIALIZATION
// ============================================================================

/**
 * Erstellt vollständigen CombatState aus Party und Gruppen.
 * @param encounterDistanceFeet Distanz in Feet (wird zu Cells konvertiert)
 */
export function createCombatState(
  partyProfiles: CombatProfile[],
  enemyProfiles: CombatProfile[],
  alliances: Record<string, string[]>,
  encounterDistanceFeet: number = DEFAULT_ENCOUNTER_DISTANCE_FEET,
  resourceBudget: number = 0.5
): CombatState {
  const encounterDistanceCells = feetToCell(encounterDistanceFeet);
  const profiles = [...partyProfiles, ...enemyProfiles];
  const grid = initializeGrid({ encounterDistanceCells });

  calculateInitialPositions(profiles, alliances, { encounterDistanceCells });
  const surprise = checkSurprise();

  debug('createCombatState:', {
    partyCount: partyProfiles.length,
    enemyCount: enemyProfiles.length,
    encounterDistanceFeet,
    encounterDistanceCells,
    alliances,
    resourceBudget,
  });

  return {
    profiles,
    alliances,
    grid,
    roundNumber: 0,
    surprise,
    resourceBudget,
  };
}

// ============================================================================
// ACTION RESOLUTION
// ============================================================================

// Shared helpers for hit chance and multiattack damage
import {
  calculateHitChance,
  calculateMultiattackDamage,
} from '../combatSimulator/combatHelpers';

/**
 * Resolves a single attack action against a target.
 * Supports both single attacks and multiattack.
 */
export function resolveAttack(
  attacker: CombatProfile,
  target: CombatProfile,
  action: Action
): AttackResolution | null {
  let effectiveDamage: ProbabilityDistribution;

  if (action.multiattack) {
    const multiDamage = calculateMultiattackDamage(action, attacker.actions, target.ac);
    if (!multiDamage) {
      debug('resolveAttack: multiattack has no valid refs', { actionName: action.name });
      return null;
    }
    effectiveDamage = multiDamage;
  } else {
    if (!action.attack) {
      debug('resolveAttack: action has no attack', { actionName: action.name });
      return null;
    }

    const baseDamage = calculateBaseDamagePMF(action);
    if (!baseDamage) {
      debug('resolveAttack: action has no damage', { actionName: action.name });
      return null;
    }

    const hitChance = calculateHitChance(action.attack.bonus, target.ac);
    effectiveDamage = calculateEffectiveDamage(
      baseDamage,
      hitChance,
      attacker.deathProbability,
      0 // conditionProb - HACK: keine Conditions
    );
  }

  const newTargetHP = applyDamageToHP(target.hp, effectiveDamage);
  const newDeathProbability = calculateDeathProbability(newTargetHP);
  const damageDealt = getExpectedValue(effectiveDamage);

  debug('resolveAttack:', {
    attacker: attacker.participantId,
    target: target.participantId,
    action: action.name,
    isMultiattack: !!action.multiattack,
    damageDealt,
    newDeathProbability,
  });

  return {
    newTargetHP,
    damageDealt,
    newDeathProbability,
  };
}

// ============================================================================
// STATE UPDATES
// ============================================================================

/** Aktualisiert HP eines Combatants. */
export function updateCombatantHP(
  combatant: CombatProfile,
  newHP: ProbabilityDistribution
): void {
  combatant.hp = newHP;
  combatant.deathProbability = calculateDeathProbability(newHP);
}

/** Aktualisiert Position eines Combatants. */
export function updateCombatantPosition(
  combatant: CombatProfile,
  newPosition: GridPosition
): void {
  combatant.position = newPosition;
}

// ============================================================================
// REACTION PROCESSING
// ============================================================================

// Re-export fuer externe Nutzung
export type { ReactionContext, ReactionResult };

/**
 * Interface fuer Reaction-Trigger-Events.
 * Wird von Combat-Flow verwendet um Reactions auszuloesen.
 */
export interface ReactionTrigger {
  /** Das ausloesende Event */
  event: TriggerEvent;
  /** Der Ausloeser (Angreifer, Spell-Caster, etc.) */
  source: CombatProfile;
  /** Optional: Das Ziel des Triggers */
  target?: CombatProfile;
  /** Optional: Die ausloesende Action */
  action?: Action;
  /** Optional: Zugefuegter Schaden (bei 'damaged' Event) */
  damage?: number;
  /** Optional: Spell-Level (bei 'spell-cast' Event) */
  spellLevel?: number;
}

/**
 * Prueft und fuehrt Reactions fuer alle relevanten Profile aus.
 * Wird nach relevanten Events aufgerufen (attacked, damaged, spell-cast, etc.)
 *
 * @param trigger Der ausloesende Trigger
 * @param state SimulationState mit allen Profiles
 * @param budgets Map von participantId zu TurnBudget fuer Reaction-Tracking
 * @returns Array von ReactionResults (ausgefuehrte und abgelehnte Reactions)
 */
export function processReactionTrigger(
  trigger: ReactionTrigger,
  state: SimulationState,
  budgets: Map<string, TurnBudget>
): ReactionResult[] {
  const results: ReactionResult[] = [];

  debug('processReactionTrigger:', {
    event: trigger.event,
    source: trigger.source.participantId,
    target: trigger.target?.participantId,
  });

  // Finde alle Profile die auf dieses Event reagieren koennten
  for (const profile of state.profiles) {
    // Skip Source (kann nicht auf eigene Aktion reagieren)
    if (profile.participantId === trigger.source.participantId) {
      continue;
    }

    // Skip tote Profile
    if ((profile.deathProbability ?? 0) >= 0.95) {
      continue;
    }

    // Pruefe ob Reaction verfuegbar
    const budget = budgets.get(profile.participantId);
    if (!budget?.hasReaction) {
      continue;
    }

    // Finde passende Reactions fuer dieses Event
    const matchingReactions = findMatchingReactions(profile, trigger.event);

    if (matchingReactions.length === 0) {
      continue;
    }

    // Erstelle ReactionContext
    const context: ReactionContext = {
      event: trigger.event,
      source: trigger.source,
      target: trigger.target,
      action: trigger.action,
      damage: trigger.damage,
      spellLevel: trigger.spellLevel,
    };

    // Waehle beste Reaction basierend auf Score
    let bestReaction = matchingReactions[0];
    let bestScore = evaluateReaction(bestReaction, context, profile, state);

    for (let i = 1; i < matchingReactions.length; i++) {
      const score = evaluateReaction(matchingReactions[i], context, profile, state);
      if (score > bestScore) {
        bestScore = score;
        bestReaction = matchingReactions[i];
      }
    }

    // Pruefe ob Reaction genutzt werden soll
    if (!shouldUseReaction(bestReaction, context, profile, state, budget)) {
      debug('processReactionTrigger: reaction not worth using', {
        profile: profile.participantId,
        reaction: bestReaction.name,
        score: bestScore,
      });
      results.push({
        reactor: profile,
        reaction: bestReaction,
        executed: false,
      });
      continue;
    }

    // Reaction ausfuehren
    consumeReaction(budget);

    // Effekte basierend auf Event-Typ
    const result: ReactionResult = {
      reactor: profile,
      reaction: bestReaction,
      executed: true,
      effect: {},
    };

    // Shield: AC-Bonus
    if (trigger.event === 'attacked' && bestReaction.effects) {
      const acBonus = bestReaction.effects.reduce((total, effect) => {
        const acMod = effect.statModifiers?.find(m => m.stat === 'ac');
        return total + (acMod?.value ?? 0);
      }, 0);

      if (acBonus > 0) {
        result.effect!.acBonus = acBonus;
        debug('processReactionTrigger: Shield AC bonus', {
          profile: profile.participantId,
          acBonus,
        });
      }
    }

    // Counterspell: Spell gecountert
    if (trigger.event === 'spell-cast' && bestReaction.counter) {
      result.effect!.spellCountered = true;
      debug('processReactionTrigger: Counterspell', {
        profile: profile.participantId,
        counteredSpell: trigger.action?.name,
      });
    }

    // Hellish Rebuke / Damage-Reactions: Schaden
    if (trigger.event === 'damaged' && bestReaction.damage) {
      // Schaden wird als expected value berechnet
      const damagePMF = diceExpressionToPMF(bestReaction.damage.dice);
      let damage = getExpectedValue(addConstant(damagePMF, bestReaction.damage.modifier));

      // Save-basierte Reactions
      if (bestReaction.save) {
        const saveBonus = Math.floor(getExpectedValue(trigger.source.hp) / 30) + 2; // Approximation
        const dc = bestReaction.save.dc;
        const failChance = Math.min(0.95, Math.max(0.05, (dc - saveBonus - 1) / 20));

        if (bestReaction.save.onSave === 'half') {
          damage = damage * failChance + (damage * 0.5) * (1 - failChance);
        } else {
          damage = damage * failChance;
        }
      }

      result.effect!.damage = damage;
      debug('processReactionTrigger: Damage reaction', {
        profile: profile.participantId,
        damage,
      });
    }

    results.push(result);

    debug('processReactionTrigger: reaction executed', {
      profile: profile.participantId,
      reaction: bestReaction.name,
      effect: result.effect,
    });
  }

  return results;
}

// ============================================================================
// COMBAT FLOW INTEGRATION
// ============================================================================

/**
 * Erweitertes AttackResolution mit Reaction-Informationen.
 */
export interface AttackResolutionWithReactions extends AttackResolution {
  /** Reactions die auf 'attacked' getriggert wurden (z.B. Shield) */
  attackedReactions: ReactionResult[];
  /** Reactions die auf 'damaged' getriggert wurden (z.B. Hellish Rebuke) */
  damagedReactions: ReactionResult[];
  /** War der Angriff erfolgreich? (nach Shield etc.) */
  attackHit: boolean;
  /** AC-Bonus durch Reactions (z.B. Shield +5) */
  targetACBonus: number;
}

/**
 * Loest einen Angriff auf inklusive Reaction-Verarbeitung.
 *
 * Ablauf:
 * 1. 'attacked' Trigger → Shield-artige Reactions koennen AC erhoehen
 * 2. Attack Resolution mit modifiziertem AC
 * 3. Bei Schaden: 'damaged' Trigger → Hellish Rebuke etc. kann zurueckschlagen
 *
 * @param attacker Der angreifende Combatant
 * @param target Das Ziel des Angriffs
 * @param action Die Attack-Action
 * @param state SimulationState fuer Reaction-Evaluation
 * @param budgets Budget-Map fuer Reaction-Tracking
 * @returns AttackResolution mit Reaction-Informationen, null bei ungueltigem Attack
 */
export function resolveAttackWithReactions(
  attacker: CombatProfile,
  target: CombatProfile,
  action: Action,
  state: SimulationState,
  budgets: Map<string, TurnBudget>
): AttackResolutionWithReactions | null {
  // Phase 1: 'attacked' Trigger (vor Damage-Resolution)
  const attackedTrigger: ReactionTrigger = {
    event: 'attacked',
    source: attacker,
    target,
    action,
  };

  const attackedReactions = processReactionTrigger(attackedTrigger, state, budgets);

  // Berechne AC-Bonus aus Reactions (z.B. Shield)
  const targetACBonus = attackedReactions.reduce((total, result) => {
    if (result.executed && result.effect?.acBonus) {
      return total + result.effect.acBonus;
    }
    return total;
  }, 0);

  // Phase 2: Attack Resolution mit modifiziertem AC
  // Temporaer AC erhoehen fuer diese Resolution
  const originalAC = target.ac;
  target.ac += targetACBonus;

  const baseResolution = resolveAttack(attacker, target, action);

  // AC zuruecksetzen
  target.ac = originalAC;

  if (!baseResolution) {
    return null;
  }

  // Pruefe ob Angriff getroffen hat (basierend auf Damage > 0)
  const attackHit = baseResolution.damageDealt > 0;

  // Phase 3: 'damaged' Trigger (nur wenn Schaden zugefuegt)
  let damagedReactions: ReactionResult[] = [];

  if (attackHit && baseResolution.damageDealt > 0) {
    const damagedTrigger: ReactionTrigger = {
      event: 'damaged',
      source: attacker,
      target,
      action,
      damage: baseResolution.damageDealt,
    };

    damagedReactions = processReactionTrigger(damagedTrigger, state, budgets);
  }

  debug('resolveAttackWithReactions:', {
    attacker: attacker.participantId,
    target: target.participantId,
    action: action.name,
    targetACBonus,
    attackHit,
    damageDealt: baseResolution.damageDealt,
    attackedReactionsCount: attackedReactions.filter(r => r.executed).length,
    damagedReactionsCount: damagedReactions.filter(r => r.executed).length,
  });

  return {
    ...baseResolution,
    attackedReactions,
    damagedReactions,
    attackHit,
    targetACBonus,
  };
}

/**
 * Prueft ob ein Spell durch Counterspell aufgehoben wird.
 *
 * @param caster Der Spell-Caster
 * @param spell Die Spell-Action
 * @param state SimulationState fuer Reaction-Evaluation
 * @param budgets Budget-Map fuer Reaction-Tracking
 * @returns true wenn der Spell durch Counterspell aufgehoben wurde
 */
export function checkCounterspell(
  caster: CombatProfile,
  spell: Action,
  state: SimulationState,
  budgets: Map<string, TurnBudget>
): { countered: boolean; reactions: ReactionResult[] } {
  // Nur Spells mit spellSlot triggern Counterspell
  if (!spell.spellSlot) {
    return { countered: false, reactions: [] };
  }

  const trigger: ReactionTrigger = {
    event: 'spell-cast',
    source: caster,
    action: spell,
    spellLevel: spell.spellSlot.level,
  };

  const reactions = processReactionTrigger(trigger, state, budgets);

  // Pruefe ob irgendein Counterspell erfolgreich war
  const countered = reactions.some(r => r.executed && r.effect?.spellCountered);

  debug('checkCounterspell:', {
    caster: caster.participantId,
    spell: spell.name,
    spellLevel: spell.spellSlot.level,
    countered,
    reactionsCount: reactions.filter(r => r.executed).length,
  });

  return { countered, reactions };
}
