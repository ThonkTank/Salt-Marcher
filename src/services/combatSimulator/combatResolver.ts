// Ziel: Combat State-Management und Action-Resolution
// Siehe: docs/services/combatSimulator/combatResolver.md
//
// Generisches Helper-Repository für:
// - Combat-Tracker (manuell): GM/Spieler lösen Aktionen aus
// - Difficulty-Simulation (autonom): difficulty.ts nutzt diese Funktionen
//
// KEINE autonome Simulation hier - nur State + Resolution!
//
// Funktionen:
// - createCombatState(): State aus Party + Groups initialisieren
// - resolveAttack(): Einzelnen Angriff auflösen (PMF-basiert)
// - updateCombatantHP/Position(): State-Updates für Combat-Tracker

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Default-Actions für Characters/Creatures ohne actions
// - getDefaultPartyAction() generiert level-skalierte Weapon-Attack
// - getDefaultCreatureAction() generiert CR-skalierte Natural-Attack
// - Creatures können actionIds[] verwenden für Vault-basierte Actions
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
import type { CreatureDefinition, Action, Character } from '@/types/entities';
import { vault } from '@/infrastructure/vault/vaultInstance';
import {
  type ProbabilityDistribution,
  createSingleValue,
  calculateEffectiveDamage,
  applyDamageToHP,
  calculateDeathProbability,
  getExpectedValue,
  type GridPosition,
  type GridConfig,
  createGrid,
  feetToCell,
  spreadFormation as gridSpreadFormation,
} from '@/utils';
import {
  calculateHitChance,
  calculateMultiattackDamage,
  isAllied,
  isHostile,
  type CombatProfile,
  type SimulationState as AISimulationState,
} from './combatantAI';
import { calculateBaseDamagePMF } from './combatHelpers';

// Re-export ProbabilityDistribution for consumers
export type { ProbabilityDistribution } from '@/utils';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[combatResolver]', ...args);
  }
};

// ============================================================================
// CONSTANTS
// ============================================================================

const GRID_MARGIN_CELLS = 20;
export const DEFAULT_ENCOUNTER_DISTANCE_FEET = 60;
export const DEFAULT_ENCOUNTER_DISTANCE_CELLS = feetToCell(DEFAULT_ENCOUNTER_DISTANCE_FEET);

// ============================================================================
// EXPORTED TYPES
// ============================================================================

// Re-export types from combatantAI and grid for consumers
export type { CombatProfile, ConditionState, SpeedBlock } from './combatantAI';
export type { GridPosition, GridConfig } from '@/utils';

/** Surprise-State für Runde 1. */
export interface SurpriseState {
  partyHasSurprise: boolean;
  enemyHasSurprise: boolean;
}

/** Simulation State für Runden-Tracking. */
export interface SimulationState extends AISimulationState {
  grid: GridConfig;
  roundNumber: number;
  surprise: SurpriseState;
  resourceBudget: number;
}

/** Ergebnis einer einzelnen Runde. */
export interface RoundResult {
  round: number;
  partyDPR: number;
  enemyDPR: number;
  partyHPRemaining: number;
  enemyHPRemaining: number;
}

/** Input-Typ für Party (inline, nicht exportiert). */
export interface PartyInput {
  level: number;
  size: number;
  members: { id: string; level: number; hp: number; ac: number }[];
}

// ============================================================================
// TURN BUDGET SYSTEM
// ============================================================================

/**
 * Action-Budget pro Zug. D&D 5e Aktionsökonomie.
 * Siehe: Plan cosmic-tinkering-unicorn.md#Step-1
 */
export interface TurnBudget {
  movementCells: number;      // Verbleibende Movement-Cells
  baseMovementCells: number;  // Ursprüngliche Speed in Cells (für Dash)
  hasAction: boolean;         // 1 Action (kann Multi-Attack sein)
  hasDashed: boolean;         // Dash bereits verwendet in diesem Zug
  hasBonusAction: boolean;    // TODO: Stub, immer false (siehe Header)
  hasReaction: boolean;       // TODO: Stub, für OA später (siehe Header)
}

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
  // Noch Movement oder Action übrig?
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
  budget.movementCells += budget.baseMovementCells;  // Fügt Basis-Speed hinzu
  budget.hasAction = false;                          // Dash verbraucht die Action
  budget.hasDashed = true;                           // Markiert dass Dash verwendet wurde
}

// ============================================================================
// GRID & POSITIONING
// ============================================================================

/** Initialisiert Grid für Kampfsimulation. */
export function initializeGrid(encounterDistanceCells: number = DEFAULT_ENCOUNTER_DISTANCE_CELLS): GridConfig {
  const gridSize = encounterDistanceCells + GRID_MARGIN_CELLS * 2;
  return createGrid({
    width: gridSize,
    height: gridSize,
    layers: 10,  // 0-9 = 0-45ft Höhe
    diagonalRule: 'phb-variant',
  });
}

/** Verteilt Combatants in Formation (2 Cells = 10ft Abstand). */
function spreadFormation(profiles: CombatProfile[], center: GridPosition): void {
  const spacingCells = 2;  // 10ft = 2 Cells
  const positions = gridSpreadFormation(profiles.length, center, spacingCells);
  profiles.forEach((profile, i) => {
    profile.position = positions[i];
  });
}

/** Setzt Initial-Positionen für alle Combatants basierend auf Allianzen. */
export function calculateInitialPositions(
  profiles: CombatProfile[],
  alliances: Record<string, string[]>,
  encounterDistanceCells: number = DEFAULT_ENCOUNTER_DISTANCE_CELLS
): void {
  // Party + Verbündete auf einer Seite
  const partyAllies = profiles.filter(p => isAllied('party', p.groupId, alliances));
  // Feinde auf der anderen Seite
  const enemies = profiles.filter(p => isHostile('party', p.groupId, alliances));

  // Party startet am Rand mit Margin
  const partyCenter: GridPosition = { x: GRID_MARGIN_CELLS, y: GRID_MARGIN_CELLS, z: 0 };
  // Feinde auf der gegenüberliegenden Seite
  const enemyCenter: GridPosition = { x: GRID_MARGIN_CELLS + encounterDistanceCells, y: GRID_MARGIN_CELLS, z: 0 };

  spreadFormation(partyAllies, partyCenter);
  spreadFormation(enemies, enemyCenter);

  debug('calculateInitialPositions:', {
    partyAllyCount: partyAllies.length,
    enemyCount: enemies.length,
    encounterDistanceCells,
    partyCenter,
    enemyCenter,
  });
}

// ============================================================================
// DEFAULT ACTIONS
// ============================================================================

/** Generiert Default-Action für Character ohne Actions. HACK: siehe Header */
function getDefaultPartyAction(level: number): Action {
  // Level-skalierter Weapon-Attack als Fallback
  const attackBonus = Math.floor(level / 4) + 4; // +4 bis +9
  const damageBonus = Math.floor(level / 4) + 3; // +3 bis +8

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

/** Generiert Default-Action für Creature ohne Actions. HACK: siehe Header */
function getDefaultCreatureAction(cr: number): Action {
  // CR-skalierter Natural-Attack als Fallback
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

// ============================================================================
// PROFILE CREATION
// ============================================================================

/** Erstellt Party-Profile. HACK: siehe Header (Default-Actions) */
export function createPartyProfiles(party: PartyInput): CombatProfile[] {
  return party.members.map((member) => {
    // Versuche Character aus Vault zu laden für Actions
    let actions: Action[] = [];
    try {
      const character = vault.getEntity<Character>('character', member.id);
      actions = character.actions ?? [];
    } catch {
      // Character nicht im Vault - verwende Default
    }

    // Fallback auf Default-Action
    if (actions.length === 0) {
      actions = [getDefaultPartyAction(member.level)];
    }

    debug('createPartyProfile:', { memberId: member.id, actionsCount: actions.length });

    return {
      participantId: member.id,
      groupId: 'party',  // Reservierte ID für Player Characters
      hp: createSingleValue(member.hp),
      deathProbability: 0,
      ac: member.ac,
      speed: { walk: 30 },
      actions,
      conditions: [],
      position: { x: 0, y: 0, z: 0 },  // Wird von calculateInitialPositions überschrieben
    };
  });
}

/** Erstellt Enemy-Profile aus Encounter-Gruppen. */
export function createEnemyProfiles(groups: EncounterGroup[]): CombatProfile[] {
  const profiles: CombatProfile[] = [];

  for (const group of groups) {
    for (const npcs of Object.values(group.slots)) {
      for (const npc of npcs) {
        const creature = vault.getEntity<CreatureDefinition>('creature', npc.creature.id);

        // 1. Inline actions (direkt im Creature definiert)
        let actions: Action[] = [...(creature.actions ?? [])];

        // 2. Action references (via actionIds → Vault lookup)
        if (creature.actionIds?.length) {
          for (const actionId of creature.actionIds) {
            try {
              const action = vault.getEntity<Action>('action', actionId);
              actions.push(action);
            } catch {
              debug('createEnemyProfile: action not found:', actionId);
            }
          }
        }

        // 3. Fallback auf Default-Action falls keine gefunden
        if (actions.length === 0) {
          actions = [getDefaultCreatureAction(creature.cr)];
        }

        debug('createEnemyProfile:', { npcId: npc.id, creatureId: npc.creature.id, actionsCount: actions.length });

        profiles.push({
          participantId: npc.id,
          groupId: group.groupId,  // UUID der Encounter-Gruppe
          hp: createSingleValue(creature.averageHp ?? Math.floor(creature.maxHp / 2)),
          deathProbability: 0,
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
          position: { x: 0, y: 0, z: 0 },  // Wird von calculateInitialPositions überschrieben
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
  // Vereinfacht: Keine Surprise (Activity-Lookup fehlt)
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
): SimulationState {
  const encounterDistanceCells = feetToCell(encounterDistanceFeet);
  const profiles = [...partyProfiles, ...enemyProfiles];
  const grid = initializeGrid(encounterDistanceCells);

  calculateInitialPositions(profiles, alliances, encounterDistanceCells);
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

/** Ergebnis einer Attack-Resolution. */
export interface AttackResolution {
  newTargetHP: ProbabilityDistribution;
  damageDealt: number;
  newDeathProbability: number;
}

/**
 * Resolves a single attack action against a target.
 * Supports incremental state updates for future encounter runner.
 * Unterstützt sowohl Einzelangriffe als auch Multiattack.
 */
export function resolveAttack(
  attacker: CombatProfile,
  target: CombatProfile,
  action: Action
): AttackResolution | null {
  let effectiveDamage: ProbabilityDistribution;

  if (action.multiattack) {
    // Multiattack: Kombinierte PMF (Hit-Chance bereits eingerechnet)
    const multiDamage = calculateMultiattackDamage(action, attacker.actions, target.ac);
    if (!multiDamage) {
      debug('resolveAttack: multiattack has no valid refs', { actionName: action.name });
      return null;
    }
    effectiveDamage = multiDamage;
  } else {
    // Einzelangriff
    if (!action.attack) {
      debug('resolveAttack: action has no attack', { actionName: action.name });
      return null;
    }

    // Base Damage PMF berechnen
    const baseDamage = calculateBaseDamagePMF(action);
    if (!baseDamage) {
      debug('resolveAttack: action has no damage', { actionName: action.name });
      return null;
    }

    // Hit-Chance berechnen und Effective Damage erstellen
    const hitChance = calculateHitChance(action.attack.bonus, target.ac);
    effectiveDamage = calculateEffectiveDamage(
      baseDamage,
      hitChance,
      attacker.deathProbability,
      0 // conditionProb - HACK: keine Conditions
    );
  }

  // Schaden auf Ziel anwenden (getrennte Berechnung + Anwendung)
  const newTargetHP = applyDamageToHP(target.hp, effectiveDamage);

  // Todeswahrscheinlichkeit aktualisieren
  const newDeathProbability = calculateDeathProbability(newTargetHP);

  // DPR tracken (Expected Value der Effective Damage PMF)
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
// STATE UPDATES (für Combat-Tracker)
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
