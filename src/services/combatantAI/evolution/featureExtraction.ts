// Ziel: Feature Extraction für NEAT Neural Network Inputs
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Extrahiert normalisierte Features aus Combat-State und Actions.
// Features werden für Network-Inputs verwendet (86 Dimensionen total).

import type { CombatEvent } from '@/types/entities/combatEvent';
import type {
  Combatant,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
} from '@/types/combat';
import {
  getExpectedValue,
  feetToCell,
} from '@/utils';
import {
  getHP,
  getAC,
  getMaxHP,
  getPosition,
  getConditions,
  getCombatEvents,
  getSpeed,
  getResources,
  getGroupId,
  getAliveCombatants,
} from '../../combatTracking';
import {
  getDistance,
  isAllied,
  isHostile,
  calculateEffectiveDamagePotential,
  calculateBaseDamagePMF,
  calculateBaseHealingPMF,
} from '../helpers/combatHelpers';

// ============================================================================
// FEATURE DIMENSIONS
// ============================================================================

/** Feature-Dimensionen für Network-Initialisierung */
export const FEATURE_DIMENSIONS = {
  self: 15,
  enemies: 32,      // 8 × 4
  allies: 12,       // 4 × 3
  action: 10,
  target: 9,
  context: 8,
  total: 86,
} as const;

/** Maximale Anzahl Feinde/Allies für Feature-Slots */
const MAX_ENEMIES = 8;
const MAX_ALLIES = 4;
const FEATURES_PER_ENEMY = 4;
const FEATURES_PER_ALLY = 3;

/** Conditions die als One-Hot encodiert werden */
const TRACKED_CONDITIONS = [
  'prone',
  'restrained',
  'frightened',
  'poisoned',
  'incapacitated',
  'stunned',
] as const;

/** Normalisierungs-Konstanten */
const NORM = {
  AC: 25,
  DAMAGE: 20,
  HEALING: 20,
  RANGE: 120,       // Max Range in feet
  GRID_SIZE: 20,    // Typische Grid-Größe
  MAX_ROUND: 20,
  MAX_TARGETS: 8,
  MAX_THREAT: 50,   // Max expected damage potential
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Berechnet HP% eines Combatants (0-1).
 */
function getHPPercent(c: Combatant): number {
  const currentHP = getExpectedValue(getHP(c));
  const maxHP = getMaxHP(c);
  return maxHP > 0 ? Math.max(0, currentHP / maxHP) : 0;
}

/**
 * Prüft ob Combatant eine bestimmte Condition hat.
 */
function hasCondition(c: Combatant, conditionName: string): boolean {
  return getConditions(c).some(cond =>
    cond.effect === conditionName || cond.name === conditionName
  );
}

/**
 * Prüft ob Combatant irgendeine negative Condition hat.
 */
function hasAnyNegativeCondition(c: Combatant): boolean {
  return TRACKED_CONDITIONS.some(cond => hasCondition(c, cond));
}

/**
 * Berechnet Threat-Level eines Combatants (0-1).
 * Basiert auf effektivem Damage-Potential gegen typische AC.
 */
function calculateThreatLevel(c: Combatant, targetAC: number = 15): number {
  const actions = getCombatEvents(c);
  const dmgPotential = calculateEffectiveDamagePotential(actions, targetAC);
  return Math.min(1, dmgPotential / NORM.MAX_THREAT);
}

/**
 * Prüft ob Combatant Healing-Actions hat.
 */
function hasHealingAction(c: Combatant): boolean {
  return getCombatEvents(c).some(a => a.healing != null);
}

/**
 * Prüft ob Combatant Spell Slots hat.
 */
function hasSpellSlots(c: Combatant): boolean {
  const resources = getResources(c);
  return resources?.spellSlots != null && Object.keys(resources.spellSlots).length > 0;
}

/**
 * Berechnet ob ein Feind den Combatant mit seinem Movement erreichen kann.
 */
function canReachWithMovement(enemy: Combatant, targetPos: { x: number; y: number; z: number }): boolean {
  const enemyPos = getPosition(enemy);
  const speed = getSpeed(enemy);
  const movementCells = feetToCell(speed.walk ?? 30);
  const distance = getDistance(enemyPos, targetPos);
  // +1 für Melee-Reichweite
  return distance <= movementCells + 1;
}

// ============================================================================
// EXTRACT STATE FEATURES
// ============================================================================

/**
 * Extrahiert Self-Features (15 Werte).
 */
function extractSelfFeatures(
  combatant: CombatantWithLayers,
  budget: TurnBudget
): number[] {
  const pos = getPosition(combatant);
  const conditions = getConditions(combatant);

  return [
    // HP & AC (2)
    getHPPercent(combatant),
    getAC(combatant) / NORM.AC,

    // Position (2)
    pos.x / NORM.GRID_SIZE,
    pos.y / NORM.GRID_SIZE,

    // Budget (4)
    budget.hasAction ? 1 : 0,
    budget.hasBonusAction ? 1 : 0,
    budget.hasReaction ? 1 : 0,
    budget.baseMovementCells > 0
      ? budget.movementCells / budget.baseMovementCells
      : 0,

    // Conditions One-Hot (6)
    ...TRACKED_CONDITIONS.map(cond =>
      conditions.some(c => c.effect === cond || c.name === cond) ? 1 : 0
    ),

    // Concentration (1)
    combatant.combatState.concentratingOn ? 1 : 0,
  ];
}

/**
 * Extrahiert Enemy-Features (32 Werte = 8 × 4).
 */
function extractEnemyFeatures(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number[] {
  const myGroupId = getGroupId(combatant);
  const myPos = getPosition(combatant);
  const myAC = getAC(combatant);

  // Finde alle lebenden Feinde
  const enemies = getAliveCombatants(state)
    .filter(c => c.id !== combatant.id && isHostile(myGroupId, getGroupId(c), state.alliances));

  // Sortiere nach Distanz
  const sortedEnemies = enemies
    .map(e => ({ enemy: e, distance: getDistance(myPos, getPosition(e)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_ENEMIES);

  const features: number[] = [];

  for (let i = 0; i < MAX_ENEMIES; i++) {
    if (i < sortedEnemies.length) {
      const { enemy, distance } = sortedEnemies[i];
      features.push(
        getHPPercent(enemy),
        distance / NORM.GRID_SIZE,
        canReachWithMovement(enemy, myPos) ? 1 : 0,
        calculateThreatLevel(enemy, myAC)
      );
    } else {
      // Padding für fehlende Feinde
      features.push(0, 0, 0, 0);
    }
  }

  return features;
}

/**
 * Extrahiert Ally-Features (12 Werte = 4 × 3).
 */
function extractAllyFeatures(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number[] {
  const myGroupId = getGroupId(combatant);
  const myPos = getPosition(combatant);

  // Finde alle lebenden Allies (außer sich selbst)
  const allies = getAliveCombatants(state)
    .filter(c => c.id !== combatant.id && isAllied(myGroupId, getGroupId(c), state.alliances));

  // Sortiere nach Distanz
  const sortedAllies = allies
    .map(a => ({ ally: a, distance: getDistance(myPos, getPosition(a)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_ALLIES);

  const features: number[] = [];

  for (let i = 0; i < MAX_ALLIES; i++) {
    if (i < sortedAllies.length) {
      const { ally, distance } = sortedAllies[i];
      const hpPercent = getHPPercent(ally);
      features.push(
        hpPercent,
        distance / NORM.GRID_SIZE,
        hpPercent < 0.5 ? 1 : 0  // needsHealing
      );
    } else {
      // Padding für fehlende Allies
      features.push(0, 0, 0);
    }
  }

  return features;
}

/**
 * Extrahiert Context-Features (8 Werte).
 */
function extractContextFeatures(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number[] {
  const myGroupId = getGroupId(combatant);
  const aliveCombatants = getAliveCombatants(state);

  // Zähle Allies und Feinde
  const allies = aliveCombatants.filter(c =>
    c.id !== combatant.id && isAllied(myGroupId, getGroupId(c), state.alliances)
  );
  const enemies = aliveCombatants.filter(c =>
    isHostile(myGroupId, getGroupId(c), state.alliances)
  );

  // Berechne Gruppen-HP%
  const calcGroupHP = (group: Combatant[]): number => {
    if (group.length === 0) return 0;
    const totalCurrent = group.reduce((sum, c) => sum + getExpectedValue(getHP(c)), 0);
    const totalMax = group.reduce((sum, c) => sum + getMaxHP(c), 0);
    return totalMax > 0 ? totalCurrent / totalMax : 0;
  };

  // Hole Round-Nummer (falls verfügbar im State)
  const roundNumber = 'roundNumber' in state ? (state as { roundNumber: number }).roundNumber : 1;

  // Initiative-Position (falls verfügbar)
  let initiativePos = 0.5;
  if ('turnOrder' in state && 'currentTurnIndex' in state) {
    const s = state as { turnOrder: string[]; currentTurnIndex: number };
    initiativePos = s.turnOrder.length > 0
      ? s.currentTurnIndex / s.turnOrder.length
      : 0.5;
  }

  return [
    roundNumber / NORM.MAX_ROUND,
    allies.length / MAX_ENEMIES,      // Normalisiert mit 8
    enemies.length / MAX_ENEMIES,
    initiativePos,
    calcGroupHP([combatant, ...allies]),  // Party HP%
    calcGroupHP(enemies),                  // Enemy HP%
    roundNumber === 1 ? 1 : 0,            // isFirstRound
    combatant.combatState.concentratingOn ? 1 : 0,
  ];
}

/**
 * Extrahiert State-Features (Self, Enemies, Allies, Context).
 * Total: 67 Werte (15 + 32 + 12 + 8)
 */
export function extractStateFeatures(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget
): number[] {
  return [
    ...extractSelfFeatures(combatant, budget),
    ...extractEnemyFeatures(combatant, state),
    ...extractAllyFeatures(combatant, state),
    ...extractContextFeatures(combatant, state),
  ];
}

// ============================================================================
// EXTRACT ACTION FEATURES
// ============================================================================

/**
 * Extrahiert CombatEvent-Properties (10 Werte).
 */
function extractActionProperties(action: CombatEvent): number[] {
  // Damage EV
  let damageEV = 0;
  const damagePMF = calculateBaseDamagePMF(action);
  if (damagePMF) {
    damageEV = getExpectedValue(damagePMF) / NORM.DAMAGE;
  }

  // Healing EV
  let healingEV = 0;
  const healingPMF = calculateBaseHealingPMF(action);
  if (healingPMF) {
    healingEV = getExpectedValue(healingPMF) / NORM.HEALING;
  }

  // Range
  const rangeNorm = (action.range?.normal ?? 5) / NORM.RANGE;

  // AoE
  const isAoE = action.targeting?.type === 'area' ? 1 : 0;

  // Target Count
  const targetCount = (action.targeting?.count ?? 1) / NORM.MAX_TARGETS;

  // Budget Costs
  let usesAction = 0;
  let usesBonus = 0;
  let usesMovement = 0;

  if (action.budgetCosts) {
    for (const cost of action.budgetCosts) {
      if (cost.resource === 'action') usesAction = 1;
      if (cost.resource === 'bonusAction') usesBonus = 1;
      if (cost.resource === 'movement') usesMovement = 1;
    }
  } else {
    // Default: CombatEvent-Timing bestimmt Budget
    if (action.timing?.type === 'action') usesAction = 1;
    if (action.timing?.type === 'bonus') usesBonus = 1;
  }

  // Condition
  const hasConditionEffect = action.effects?.some(e => e.condition != null) ? 1 : 0;

  // Concentration
  const requiresConcentration = action.concentration ? 1 : 0;

  return [
    damageEV,
    healingEV,
    rangeNorm,
    isAoE,
    targetCount,
    usesAction,
    usesBonus,
    usesMovement,
    hasConditionEffect,
    requiresConcentration,
  ];
}

/**
 * Extrahiert Target-Properties (9 Werte).
 */
function extractTargetProperties(
  target: Combatant | undefined,
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number[] {
  if (!target) {
    // Kein Target (z.B. Self-Buff, Dash)
    return [0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  const myPos = getPosition(combatant);
  const targetPos = getPosition(target);
  const myGroupId = getGroupId(combatant);
  const targetGroupId = getGroupId(target);

  return [
    getHPPercent(target),
    getAC(target) / NORM.AC,
    getDistance(myPos, targetPos) / NORM.GRID_SIZE,
    hasHealingAction(target) ? 1 : 0,
    hasSpellSlots(target) ? 1 : 0,
    target.combatState.isDead ? 1 : 0,
    isAllied(myGroupId, targetGroupId, state.alliances) ? 1 : 0,
    hasAnyNegativeCondition(target) ? 1 : 0,
    calculateThreatLevel(target, getAC(combatant)),
  ];
}

/**
 * Extrahiert CombatEvent/Target-Features.
 * Total: 19 Werte (10 + 9)
 */
export function extractActionFeatures(
  action: CombatEvent,
  target: Combatant | undefined,
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers
): number[] {
  return [
    ...extractActionProperties(action),
    ...extractTargetProperties(target, combatant, state),
  ];
}

// ============================================================================
// COMBINE FEATURES
// ============================================================================

/**
 * Kombiniert State + CombatEvent Features.
 * Total: 86 Werte (67 + 19)
 */
export function combineFeatures(
  stateFeatures: number[],
  actionFeatures: number[]
): number[] {
  if (process.env.NODE_ENV !== 'production') {
    const expectedState = FEATURE_DIMENSIONS.self + FEATURE_DIMENSIONS.enemies +
                          FEATURE_DIMENSIONS.allies + FEATURE_DIMENSIONS.context;
    const expectedAction = FEATURE_DIMENSIONS.action + FEATURE_DIMENSIONS.target;

    if (stateFeatures.length !== expectedState) {
      console.warn(
        `[featureExtraction] State features mismatch: got ${stateFeatures.length}, expected ${expectedState}`
      );
    }
    if (actionFeatures.length !== expectedAction) {
      console.warn(
        `[featureExtraction] CombatEvent features mismatch: got ${actionFeatures.length}, expected ${expectedAction}`
      );
    }
  }

  return [...stateFeatures, ...actionFeatures];
}
