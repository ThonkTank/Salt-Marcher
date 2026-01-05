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
// [TODO]: Bonus Actions immer false (Stub)
// - hasBonusAction in createTurnBudget() immer false
// - Spec: Bonus-Actions benötigen Feature-Erkennung aus Character/Creature
//
// [TODO]: Reactions nicht verbraucht (OA nicht implementiert)
// - hasReaction wird nie auf false gesetzt
// - Spec: Opportunity Attacks benötigen Trigger-Detection

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
} from '@/utils';
import {
  initializeGrid,
  calculateInitialPositions,
  DEFAULT_ENCOUNTER_DISTANCE_FEET,
} from '../gridSpace';
import { calculateBaseDamagePMF } from '../combatSimulator/combatHelpers';
import { getResolvedCreature } from './creatureCache';

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

/** Erstellt TurnBudget aus CombatProfile. TODO: BonusAction-Detection (siehe Header) */
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
    hasBonusAction: false,  // TODO: Stub - Feature-Detection fehlt
    hasReaction: true,      // TODO: Stub - wird nie verbraucht (OA fehlt)
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

/** Verbraucht die Bonus Action für diesen Zug. TODO: siehe Header */
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
 */
export function createEnemyProfiles(groups: EncounterGroup[]): CombatProfile[] {
  const profiles: CombatProfile[] = [];

  for (const group of groups) {
    for (const npcs of Object.values(group.slots)) {
      for (const npc of npcs) {
        // Creature einmal laden (gecached für gleiche Creature-Typen)
        const { definition: creature, actions } = getResolvedCreature(npc.creature.id);

        debug('createEnemyProfile:', {
          npcId: npc.id,
          creatureId: npc.creature.id,
          actionsCount: actions.length,
          npcHp: npc.currentHp,
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
