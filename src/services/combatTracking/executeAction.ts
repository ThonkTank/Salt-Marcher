// Ziel: Action-Ausführung und Protocol-Logging
// Siehe: docs/services/combatTracking.md
//
// Single Source of Truth für Action-Execution.
// KEINE AI-Logik - nur State-Mutation basierend auf übergebener Aktion.
//
// Datenfluss:
// combatantAI.selectNextAction() → wählt nächste Aktion
// executeAction()                → mutiert State + Budget, gibt ActionResult zurück
// Bei 'pass'                     → advanceTurn()

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: resolveHealing() für Healing-Actions
// - Aktuell: nur damage Actions implementiert
// - Spec: difficulty.md#5.1.b (healing intent)
//
// [TODO]: damageReceived von Reactions tracken
// - Aktuell: Hellish Rebuke etc. nicht auf Angreifer angewendet
//
// [HACK]: Save-Bonus bei Damage-Reactions via HP approximiert
// - processReactionTrigger() nutzt HP/30 + 2 statt echtem Save-Bonus
//
// [HACK]: Shield AC-Bonus nicht persistent
// - resolveAttackWithReactions() erhoeht AC nur fuer diese Resolution
// - RAW: Shield AC-Bonus gilt bis Start des naechsten eigenen Zuges
//
// [HACK]: Erster Combatant's Turn-Start Terrain-Effects nicht angewendet
// - applyTerrainEffects('on-start-turn') wird nur nach advanceTurn() aufgerufen
// - Der erste Combatant in Runde 0 bekommt keine Turn-Start-Effects
// - Workaround: manuell nach initialiseCombat() aufrufen wenn noetig
//
// [HACK]: Counterspell-Ketten nicht unterstuetzt
// - resolveReactionTurn() prueft nicht ob Spell-Cast durch Counterspell getriggert wird
// - RAW: Counterspell auf Counterspell ist erlaubt (rekursiv)
// - Implementierung wuerde rekursive Reaction-Resolution erfordern

import type { Action, ResourceCost, ActionEffect } from '@/types/entities';
import type {
  TurnAction,
  CombatProtocolEntry,
  Combatant,
  CombatantWithLayers,
  GridPosition,
  ProbabilityDistribution,
  CombatantSimulationState,
  CombatState,
  CombatStateWithLayers,
  TurnBudget,
  AttackResolution,
  ReactionTurn,
  ReactionTurnResult,
  ReactionEffect,
  ReactionProtocolEntry,
  HPChange,
  AppliedModifier,
  ConditionState,
} from '@/types/combat';
import { combatantHasLayers } from '@/types/combat';
import type { TriggerEvent } from '@/constants/action';
import type { ReactionContext, ReactionResult } from '@/types/combat';

import {
  calculateEffectiveDamage,
  applyDamageToHP,
  calculateDeathProbability,
  getExpectedValue,
  diceExpressionToPMF,
  addConstant,
  multiplyConstant,
  createSingleValue,
} from '@/utils';

import {
  getPosition,
  setPosition,
  setHP,
  advanceTurn,
  getCurrentCombatant,
  getHP,
  getAC,
  getAbilities,
  getDeathProbability,
  markDeadCombatants,
  addCondition,
  removeCondition,
  processConditionsOnTurnEnd,
  getResolvedCreature,
} from './combatState';
import type { CreatureSize } from '@/constants/creature';
// Verwendet CombatState statt CombatStateWithScoring - baseValuesCache nicht benötigt
import { getActions, calculateGrantedMovement } from './combatState';
import {
  calculateBaseDamagePMF,
  calculateHitChance,
  calculateMultiattackDamage,
  getDistance,
  findMatchingReactions,
  shouldUseReaction,
  evaluateReaction,
  isHostile,
  resolveActionWithBase,
  calculateSaveFailChance,
} from '@/services/combatantAI';
import { getIncapacitatingProbability } from '@/services/combatantAI/helpers/actionAvailability';
import { wouldTriggerReaction, findReactionLayers } from '@/services/combatantAI/layers/reactionLayers';
import { getReachableCellsWithTerrain } from '../combatTerrain/terrainMovement';
import { applyTerrainEffects } from '../combatTerrain/terrainEffects';
import { positionsEqual } from '@/utils/squareSpace/grid';
import {
  applyZoneEffects,
  resetZoneTriggersForCombatant,
  createActiveZone,
  activateZone,
} from './zoneEffects';
import { setConcentration } from './combatState';
import {
  gatherModifiers,
  type ModifierSet,
  type GatherModifiersContext,
} from './resolution/gatherModifiers';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[executeAction]', ...args);
  }
};

// ============================================================================
// SIZE COMPARISON HELPERS
// ============================================================================

/** Size-Index für Vergleiche (0=tiny, 5=gargantuan) */
const SIZE_INDEX: Record<CreatureSize, number> = {
  tiny: 0, small: 1, medium: 2, large: 3, huge: 4, gargantuan: 5,
};

/** Prüft ob size <= maxSize (D&D 5e Size-Hierarchie) */
export function isSizeAtMost(size: CreatureSize, maxSize: CreatureSize): boolean {
  return SIZE_INDEX[size] <= SIZE_INDEX[maxSize];
}

/** Ermittelt die Size eines Combatant */
export function getCombatantSize(combatant: Combatant): CreatureSize {
  // NPC: Size aus CreatureDefinition
  if ('creature' in combatant && combatant.creature) {
    const resolved = getResolvedCreature(combatant.creature.id);
    return resolved.definition.size;
  }
  // Character: Default Medium (PCs sind typischerweise Medium)
  return 'medium';
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Ergebnis einer ausgeführten Aktion.
 */
export interface ActionResult {
  damageDealt: number;
  damageReceived: number;  // Von Reactions (Hellish Rebuke etc.)
  healingDone: number;
  notes: string[];         // "Critical hit", "Killed Goblin", etc.
}

/**
 * Interface für Reaction-Trigger-Events.
 */
export interface ReactionTrigger {
  event: TriggerEvent;
  source: Combatant;
  target?: Combatant;
  action?: Action;
  damage?: number;
  spellLevel?: number;
}

/**
 * Erweitertes AttackResolution mit Reaction-Informationen.
 */
export interface AttackResolutionWithReactions extends AttackResolution {
  attackedReactions: ReactionResult[];
  damagedReactions: ReactionResult[];
  attackHit: boolean;
  targetACBonus: number;
}

/**
 * Protokoll-Eintrag für Condition-Änderungen.
 */
export interface ConditionChange {
  combatantId: string;
  combatantName: string;
  condition: string;
  action: 'inflicted' | 'removed' | 'triggered';
  source?: string;
  saveDC?: number;
  saveResult?: 'failed' | 'succeeded';
}

/**
 * Ergebnis einer Condition-Resolution.
 */
export interface ConditionResolution {
  applied: boolean;
  condition: string;
  saveDC?: number;
  saveFailChance?: number;
}

// ============================================================================
// TURN BUDGET HELPERS (importiert für lokale Verwendung)
// ============================================================================

/** Verbraucht die Reaction. */
function consumeReaction(budget: TurnBudget): void {
  budget.hasReaction = false;
}

/**
 * Wendet budgetCosts aus dem Action-Schema auf das TurnBudget an.
 * Für 'movement.toTarget': Bewegt Combatant zu targetCell und zieht Dijkstra-Kosten ab.
 *
 * Verwendet terrain-aware Dijkstra wenn terrainMap vorhanden, sonst geometrische Distanz.
 * Wirft Error wenn targetCell nicht erreichbar ist (Bug in Kandidaten-Generierung).
 */
function applyBudgetCosts(
  costs: ResourceCost[] | undefined,
  budget: TurnBudget,
  combatant: Combatant,
  targetCell: GridPosition | undefined,
  state: CombatantSimulationState
): void {
  if (!costs) return;

  for (const { resource, cost } of costs) {
    switch (resource) {
      case 'movement':
        if (cost.type === 'toTarget' && targetCell) {
          const currentPos = getPosition(combatant);

          // Dijkstra-Kosten berechnen wenn terrainMap vorhanden
          let actualCost: number;
          if (state.terrainMap) {
            const reachable = getReachableCellsWithTerrain(
              currentPos,
              budget.movementCells,
              state.terrainMap,
              combatant,
              state
            );
            const targetEntry = reachable.find(r => positionsEqual(r.position, targetCell));
            if (!targetEntry) {
              throw new Error(
                `Target cell (${targetCell.x},${targetCell.y}) not reachable from ` +
                `(${currentPos.x},${currentPos.y}) with budget ${budget.movementCells}. ` +
                `This indicates a bug in candidate generation.`
              );
            }
            actualCost = targetEntry.cost;
          } else {
            // Fallback: geometrische Distanz
            actualCost = getDistance(currentPos, targetCell);
          }

          if (actualCost > budget.movementCells) {
            throw new Error(
              `Movement cost ${actualCost} exceeds budget ${budget.movementCells}. ` +
              `This indicates a bug in candidate generation.`
            );
          }

          setPosition(combatant, targetCell, state);
          budget.movementCells -= actualCost;
        } else if (cost.type === 'fixed') {
          budget.movementCells = Math.max(0, budget.movementCells - cost.value);
        } else if (cost.type === 'all') {
          budget.movementCells = 0;
        }
        break;

      case 'action':
        if (cost.type === 'all' || cost.type === 'fixed') {
          budget.hasAction = false;
        }
        break;

      case 'bonusAction':
        if (cost.type === 'all' || cost.type === 'fixed') {
          budget.hasBonusAction = false;
        }
        break;

      case 'reaction':
        if (cost.type === 'all' || cost.type === 'fixed') {
          budget.hasReaction = false;
        }
        break;
    }
  }

  debug('applyBudgetCosts:', { costs, budgetAfter: budget, targetCell });
}

// ============================================================================
// ACTION RESOLUTION
// ============================================================================

/**
 * Resolves a single attack action against a target.
 * Supports both single attacks and multiattack.
 * Resolves baseAction references (OA etc.) before processing.
 *
 * @param modifiers Optional ModifierSet from gatherModifiers()
 */
export function resolveAttack(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  modifiers?: ModifierSet
): AttackResolution | null {
  // Resolve baseAction (für OA etc.) - übernimmt attack/damage von Basis-Action
  const resolvedAction = resolveActionWithBase(action, getActions(attacker));

  let effectiveDamage: ProbabilityDistribution;
  const targetAC = getAC(target) + (modifiers?.targetACBonus ?? 0);
  const attackBonus = (resolvedAction.attack?.bonus ?? 0) + (modifiers?.attackBonus ?? 0);
  const damageBonus = modifiers?.damageBonus ?? 0;

  if (resolvedAction.multiattack) {
    // Note: multiattack damage calculation already considers hit chance internally
    // We add attackBonus but AC is already passed in
    const multiDamage = calculateMultiattackDamage(resolvedAction, getActions(attacker), targetAC);
    if (!multiDamage) {
      debug('resolveAttack: multiattack has no valid refs', { actionName: resolvedAction.name });
      return null;
    }
    effectiveDamage = multiDamage;
    // Add damage bonus if any
    if (damageBonus !== 0) {
      effectiveDamage = addConstant(effectiveDamage, damageBonus);
    }
  } else {
    if (!resolvedAction.attack) {
      debug('resolveAttack: action has no attack', { actionName: resolvedAction.name });
      return null;
    }

    let baseDamage = calculateBaseDamagePMF(resolvedAction);
    if (!baseDamage) {
      debug('resolveAttack: action has no damage', { actionName: resolvedAction.name });
      return null;
    }

    // Add damage bonus from modifiers
    if (damageBonus !== 0) {
      baseDamage = addConstant(baseDamage, damageBonus);
    }

    // Calculate hit chance with attack bonus from modifiers
    let hitChance = calculateHitChance(attackBonus, targetAC);

    // Apply advantage/disadvantage effect on hit chance
    if (modifiers?.attackAdvantage === 'advantage') {
      // P(hit with adv) = 1 - (1 - P(hit))^2
      hitChance = 1 - Math.pow(1 - hitChance, 2);
    } else if (modifiers?.attackAdvantage === 'disadvantage') {
      // P(hit with disadv) = P(hit)^2
      hitChance = Math.pow(hitChance, 2);
    }

    // Auto-crit handling (hits on hit, always crits)
    if (modifiers?.hasAutoCrit) {
      // For simplicity, treat auto-crit as guaranteed hit with double dice
      // Full crit implementation would double damage dice only
      hitChance = 1.0;
    }

    // Auto-miss handling
    if (modifiers?.hasAutoMiss) {
      hitChance = 0.0;
    }

    const conditionProb = getIncapacitatingProbability(attacker);
    effectiveDamage = calculateEffectiveDamage(
      baseDamage,
      hitChance,
      0, // attackerDeathProb: nicht relevant für Runde-für-Runde Simulation
      conditionProb
    );
  }

  // Damage Immunity/Vulnerability Check (D&D 5e)
  // Immunity hat Vorrang vor Vulnerability
  const damageType = resolvedAction.damage?.type;
  if (damageType && 'creature' in target && target.creature) {
    const creatureDef = getResolvedCreature(target.creature.id);
    if (creatureDef?.definition?.damageImmunities?.includes(damageType)) {
      // Immune: Schaden = 0
      debug('resolveAttack: target immune to damage type', {
        damageType,
        targetId: target.id,
        immunities: creatureDef.definition.damageImmunities,
      });
      effectiveDamage = createSingleValue(0);
    } else if (creatureDef?.definition?.vulnerabilities?.includes(damageType)) {
      // Vulnerable: Schaden × 2
      debug('resolveAttack: target vulnerable to damage type', {
        damageType,
        targetId: target.id,
        vulnerabilities: creatureDef.definition.vulnerabilities,
      });
      effectiveDamage = multiplyConstant(effectiveDamage, 2);
    }
  }

  const currentHP = getHP(target);
  const newTargetHP = applyDamageToHP(currentHP, effectiveDamage);
  const newDeathProbability = calculateDeathProbability(newTargetHP);
  const damageDealt = getExpectedValue(effectiveDamage);

  // HP des Targets aktualisieren
  setHP(target, newTargetHP);

  debug('resolveAttack:', {
    attacker: attacker.id,
    target: target.id,
    action: resolvedAction.name,
    isMultiattack: !!resolvedAction.multiattack,
    hasBaseAction: !!action.baseAction,
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
// CONDITION RESOLUTION
// ============================================================================

/**
 * Resolves conditions from action effects.
 * Prüft Save-DC wenn vorhanden, wendet Condition auf Target an.
 *
 * @param attacker Der Angreifer
 * @param target Das Ziel der Condition
 * @param action Die ausgeführte Action (für Save-DC)
 * @param effect Der Effect mit der Condition
 * @returns ConditionResolution mit Ergebnis
 */
export function resolveCondition(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  effect: ActionEffect
): ConditionResolution {
  if (!effect.condition) {
    return { applied: false, condition: '' };
  }

  // Size-Limit Check: Effekt nur anwenden wenn Target klein genug
  // Beispiel: Wolf Bite → Prone nur bei Medium oder kleiner
  if (effect.targetSizeMax) {
    const targetSize = getCombatantSize(target);
    if (!isSizeAtMost(targetSize, effect.targetSizeMax)) {
      debug('resolveCondition: target size exceeds limit', {
        condition: effect.condition,
        targetSize,
        maxSize: effect.targetSizeMax,
      });
      return { applied: false, condition: effect.condition };
    }
  }

  const condition = effect.condition;

  // Condition Immunity Check: Prüfe ob Target immun gegen diese Condition ist
  // Beispiel: Skeleton ist immun gegen 'poisoned' und 'exhaustion'
  if ('creature' in target && target.creature) {
    const creatureDef = getResolvedCreature(target.creature.id);
    if (creatureDef?.definition?.conditionImmunities?.includes(condition)) {
      debug('resolveCondition: target immune to condition', {
        condition,
        targetId: target.id,
        immunities: creatureDef.definition.conditionImmunities,
      });
      return { applied: false, condition };
    }
  }
  let applied = true;
  let saveFailChance: number | undefined;

  // Prüfe Save wenn Action einen Save-DC hat
  if (action.save) {
    saveFailChance = calculateSaveFailChance(action.save.dc, target, action.save.ability);

    // Probabilistisch entscheiden (für deterministische Simulation nutzen wir die Wahrscheinlichkeit)
    // In einer echten Simulation würde hier gewürfelt werden
    // Für AI-Scoring: Wir wenden die Condition immer an mit probability = saveFailChance
    applied = true; // Immer anwenden, aber mit Wahrscheinlichkeit

    debug('resolveCondition: save check', {
      condition,
      dc: action.save.dc,
      ability: action.save.ability,
      saveFailChance,
    });
  }

  if (applied) {
    // Condition auf Target anwenden
    const conditionState: ConditionState = {
      name: condition,
      probability: saveFailChance ?? 1.0, // Bei Save: fail chance, sonst 100%
      effect: mapConditionToEffect(condition),
      // value: undefined - keine numerischen Buffs bei Standard-Conditions
      duration: effect.duration ? { ...effect.duration } : undefined,  // Duration aus Effect übernehmen
      sourceId: attacker.id,  // Für contested escape checks
      endingSave: effect.endingSave,  // Optional: Save am Turn-Ende
    };

    addCondition(target, conditionState);

    debug('resolveCondition: applied', {
      target: target.id,
      targetName: target.name,
      condition,
      probability: conditionState.probability,
      effect: conditionState.effect,
      duration: conditionState.duration,
      sourceId: conditionState.sourceId,
      endingSave: conditionState.endingSave,
    });
  }

  return {
    applied,
    condition,
    saveDC: action.save?.dc,
    saveFailChance,
  };
}

// ============================================================================
// CONTESTED CHECK RESOLUTION
// ============================================================================

/**
 * Skill-to-Ability Mapping für D&D 5e.
 */
const SKILL_ABILITY_MAP: Record<string, keyof import('@/types/entities/creature').AbilityScores> = {
  athletics: 'str',
  acrobatics: 'dex',
  stealth: 'dex',
  sleightOfHand: 'dex',
  arcana: 'int',
  history: 'int',
  investigation: 'int',
  nature: 'int',
  religion: 'int',
  animalHandling: 'wis',
  insight: 'wis',
  medicine: 'wis',
  perception: 'wis',
  survival: 'wis',
  deception: 'cha',
  intimidation: 'cha',
  performance: 'cha',
  persuasion: 'cha',
};

/**
 * Ergebnis eines Contested Checks.
 */
export interface ContestedCheckResolution {
  success: boolean;
  successProbability: number;
  attackerSkill: string;
  defenderSkill: string;
  attackerBonus: number;
  defenderBonus: number;
}

/**
 * Berechnet Skill-Bonus für einen Combatant.
 * Vereinfachte Version: Ability Modifier + Proficiency (wenn angenommen).
 */
function getSkillBonus(c: Combatant, skill: string): number {
  const ability = SKILL_ABILITY_MAP[skill] ?? 'str';
  const abilities = getAbilities(c);
  const abilityScore = abilities[ability];
  const modifier = Math.floor((abilityScore - 10) / 2);

  // CR-basierte Proficiency
  const cr = c.cr ?? 0;
  const profBonus = Math.floor(cr / 4) + 2;

  // HACK: Annahme dass Monster mit hohem STR/DEX auch Athletics/Acrobatics haben
  // In einer vollständigen Implementierung würde man skillProficiencies vom Creature-Schema nutzen
  const assumeProficient = skill === 'athletics' || skill === 'acrobatics';

  return modifier + (assumeProficient ? profBonus : 0);
}

/**
 * Resolves a contested check (e.g., Grapple: Athletics vs Athletics/Acrobatics).
 * Berechnet Erfolgswahrscheinlichkeit basierend auf Skill-Boni.
 *
 * D&D 5e: Contested Check = beide würfeln d20 + Skill, höherer gewinnt.
 * Wahrscheinlichkeitsformel: P(attacker wins) ≈ 0.5 + (attackerBonus - defenderBonus) * 0.025
 * (Approximation, exakte Berechnung wäre komplexer)
 *
 * @param attacker Der initiierende Combatant
 * @param defender Der verteidigende Combatant
 * @param attackerSkill Skill des Angreifers
 * @param defenderChoice Array von Skills die der Verteidiger wählen kann
 * @returns ContestedCheckResolution mit Erfolgswahrscheinlichkeit
 */
export function resolveContestedCheck(
  attacker: Combatant,
  defender: Combatant,
  attackerSkill: string,
  defenderChoice: string[]
): ContestedCheckResolution {
  const attackerBonus = getSkillBonus(attacker, attackerSkill);

  // Defender wählt den besten Skill
  let bestDefenderSkill = defenderChoice[0];
  let bestDefenderBonus = getSkillBonus(defender, defenderChoice[0]);

  for (const skill of defenderChoice.slice(1)) {
    const bonus = getSkillBonus(defender, skill);
    if (bonus > bestDefenderBonus) {
      bestDefenderBonus = bonus;
      bestDefenderSkill = skill;
    }
  }

  // Erfolgswahrscheinlichkeit berechnen
  // Bei gleichem Bonus: 50%
  // Pro +1 Differenz: ca. +5% (vereinfacht)
  const bonusDiff = attackerBonus - bestDefenderBonus;
  const successProbability = Math.max(0.05, Math.min(0.95, 0.5 + bonusDiff * 0.05));

  // Für probabilistische Simulation: success = true bedeutet "mit dieser Wahrscheinlichkeit"
  const success = true;  // Wir verwenden probability-based resolution wie bei Saves

  debug('resolveContestedCheck:', {
    attacker: attacker.name,
    defender: defender.name,
    attackerSkill,
    attackerBonus,
    defenderSkill: bestDefenderSkill,
    defenderBonus: bestDefenderBonus,
    successProbability,
  });

  return {
    success,
    successProbability,
    attackerSkill,
    defenderSkill: bestDefenderSkill,
    attackerBonus,
    defenderBonus: bestDefenderBonus,
  };
}

// ============================================================================
// ESCAPE RESOLUTION
// ============================================================================

/** Result of an escape attempt. */
export interface EscapeAttemptResult {
  success: boolean;
  successProbability: number;
  escapeeBonus?: number;
  defenderBonus?: number;
  dc?: number;
}

/**
 * Resolves an escape attempt from a condition with until-escape duration.
 * Supports both 'dc' (fixed DC, e.g., Bugbear Grab) and 'contested' (skill vs skill).
 *
 * @param escapee Der Combatant der entkommen will
 * @param condition Die Condition von der entkommen werden soll
 * @param state State mit combatants für Zugriff auf den Grappler (bei contested)
 * @returns EscapeAttemptResult mit Erfolgswahrscheinlichkeit
 */
export function resolveEscapeAttempt(
  escapee: Combatant,
  condition: ConditionState,
  state: { combatants: Combatant[] }
): EscapeAttemptResult {
  const escapeCheck = condition.duration?.escapeCheck;

  if (!escapeCheck) {
    debug('resolveEscapeAttempt: No escapeCheck defined', { condition: condition.name });
    return { success: false, successProbability: 0 };
  }

  if (escapeCheck.type === 'dc') {
    // Fixed DC escape (e.g., Bugbear Grab DC 12)
    const ability = escapeCheck.ability;
    const abilities = getAbilities(escapee);
    const abilityScore = abilities[ability];
    const modifier = Math.floor((abilityScore - 10) / 2);

    // Erfolgswahrscheinlichkeit: (21 - DC + bonus) / 20
    // Clamp zwischen 5% und 95%
    const successProb = Math.max(0.05, Math.min(0.95, (21 - escapeCheck.dc + modifier) / 20));

    debug('resolveEscapeAttempt (DC):', {
      escapee: escapee.name,
      condition: condition.name,
      dc: escapeCheck.dc,
      ability,
      modifier,
      successProbability: successProb,
    });

    return {
      success: true,  // Probability-based
      successProbability: successProb,
      escapeeBonus: modifier,
      dc: escapeCheck.dc,
    };
  }

  if (escapeCheck.type === 'contested') {
    // Contested escape (e.g., Standard Grapple: Athletics vs Athletics/Acrobatics)
    // Grappler wird via sourceId auf der Condition identifiziert
    const grapplerState = condition.sourceId
      ? state.combatants.find(c => c.id === condition.sourceId)
      : null;

    if (!grapplerState) {
      // Grappler nicht mehr da (tot, geflohen) → automatisches Entkommen
      debug('resolveEscapeAttempt: Grappler not found, auto-escape', {
        escapee: escapee.name,
        sourceId: condition.sourceId,
      });
      return { success: true, successProbability: 1.0 };
    }

    const defenderBonus = getSkillBonus(grapplerState, escapeCheck.defenderSkill);

    // Escapee wählt den besten Skill
    let bestEscaperSkill = escapeCheck.escaperChoice[0];
    let bestEscaperBonus = getSkillBonus(escapee, escapeCheck.escaperChoice[0]);

    for (const skill of escapeCheck.escaperChoice.slice(1)) {
      const bonus = getSkillBonus(escapee, skill);
      if (bonus > bestEscaperBonus) {
        bestEscaperBonus = bonus;
        bestEscaperSkill = skill;
      }
    }

    // Erfolgswahrscheinlichkeit wie bei resolveContestedCheck
    const bonusDiff = bestEscaperBonus - defenderBonus;
    const successProb = Math.max(0.05, Math.min(0.95, 0.5 + bonusDiff * 0.05));

    debug('resolveEscapeAttempt (Contested):', {
      escapee: escapee.name,
      grappler: grapplerState.name,
      escaperSkill: bestEscaperSkill,
      escaperBonus: bestEscaperBonus,
      defenderSkill: escapeCheck.defenderSkill,
      defenderBonus,
      successProbability: successProb,
    });

    return {
      success: true,  // Probability-based
      successProbability: successProb,
      escapeeBonus: bestEscaperBonus,
      defenderBonus,
    };
  }

  if (escapeCheck.type === 'automatic') {
    // Automatic escape (e.g., standing up from Prone costs movement)
    // Keine Wahrscheinlichkeit - immer erfolgreich wenn Movement-Kosten bezahlt
    return { success: true, successProbability: 1.0 };
  }

  return { success: false, successProbability: 0 };
}

/**
 * Mappt Condition-Namen zu Effect-Typen für situative Modifier.
 * Die meisten Conditions sind self-descriptive, aber einige haben spezifische Effekte.
 */
function mapConditionToEffect(condition: string): string {
  const effectMap: Record<string, string> = {
    prone: 'prone',
    restrained: 'restrained',
    grappled: 'grappled',
    paralyzed: 'incapacitated',
    stunned: 'incapacitated',
    unconscious: 'incapacitated',
    incapacitated: 'incapacitated',
    petrified: 'incapacitated',
    blinded: 'disadvantage-attacks',
    frightened: 'disadvantage-attacks',
    poisoned: 'disadvantage-attacks',
    charmed: 'charmed',
    deafened: 'deafened',
    invisible: 'invisible',
    exhaustion: 'exhaustion',
  };

  return effectMap[condition] ?? condition;
}

/**
 * Resolves all conditions from action effects after successful attack.
 * Iteriert alle Effects und wendet Conditions an.
 *
 * @param attacker Der Angreifer
 * @param target Das Ziel
 * @param action Die ausgeführte Action
 * @param attackHit Ob der Angriff getroffen hat
 * @returns Array von ConditionResolutions
 */
export function resolveActionConditions(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  attackHit: boolean
): { resolutions: ConditionResolution[]; conditionChanges: ConditionChange[] } {
  const resolutions: ConditionResolution[] = [];
  const conditionChanges: ConditionChange[] = [];

  if (!action.effects || !attackHit) {
    return { resolutions, conditionChanges };
  }

  for (const effect of action.effects) {
    // Nur Conditions auf Feinde (affectsTarget: 'enemy')
    if (!effect.condition || effect.affectsTarget !== 'enemy') {
      continue;
    }

    const resolution = resolveCondition(attacker, target, action, effect);
    resolutions.push(resolution);

    if (resolution.applied) {
      conditionChanges.push({
        combatantId: target.id,
        combatantName: target.name,
        condition: resolution.condition,
        action: 'inflicted',
        source: action.name,
        saveDC: resolution.saveDC,
        saveResult: resolution.saveDC ? 'failed' : undefined,
      });
    }
  }

  return { resolutions, conditionChanges };
}

// ============================================================================
// REACTION PROCESSING
// ============================================================================

/**
 * Prueft und fuehrt Reactions fuer alle relevanten Combatants aus.
 */
export function processReactionTrigger(
  trigger: ReactionTrigger,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): ReactionResult[] {
  const results: ReactionResult[] = [];

  debug('processReactionTrigger:', {
    event: trigger.event,
    source: trigger.source.id,
    target: trigger.target?.id,
  });

  for (const combatant of state.combatants) {
    if (combatant.id === trigger.source.id) continue;
    if (getDeathProbability(combatant) >= 0.95) continue;

    const budget = budgets.get(combatant.id);
    if (!budget?.hasReaction) continue;

    const matchingReactions = findMatchingReactions(combatant, trigger.event);
    if (matchingReactions.length === 0) continue;

    const context: ReactionContext = {
      event: trigger.event,
      source: trigger.source,
      target: trigger.target,
      action: trigger.action,
      damage: trigger.damage,
      spellLevel: trigger.spellLevel,
    };

    let bestReaction = matchingReactions[0];
    let bestScore = evaluateReaction(bestReaction, context, combatant, state);

    for (let i = 1; i < matchingReactions.length; i++) {
      const score = evaluateReaction(matchingReactions[i], context, combatant, state);
      if (score > bestScore) {
        bestScore = score;
        bestReaction = matchingReactions[i];
      }
    }

    if (!shouldUseReaction(bestReaction, context, combatant, state, budget)) {
      debug('processReactionTrigger: reaction not worth using', {
        combatant: combatant.id,
        reaction: bestReaction.name,
      });
      results.push({ reactor: combatant, reaction: bestReaction, executed: false });
      continue;
    }

    consumeReaction(budget);

    const result: ReactionResult = {
      reactor: combatant,
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
      }
    }

    // Counterspell
    if (trigger.event === 'spell-cast' && bestReaction.counter) {
      result.effect!.spellCountered = true;
    }

    // Hellish Rebuke / Damage-Reactions
    if (trigger.event === 'damaged' && bestReaction.damage) {
      const damagePMF = diceExpressionToPMF(bestReaction.damage.dice);
      let damage = getExpectedValue(addConstant(damagePMF, bestReaction.damage.modifier));

      if (bestReaction.save) {
        const saveBonus = Math.floor(getExpectedValue(getHP(trigger.source)) / 30) + 2;
        const dc = bestReaction.save.dc;
        const failChance = Math.min(0.95, Math.max(0.05, (dc - saveBonus - 1) / 20));

        if (bestReaction.save.onSave === 'half') {
          damage = damage * failChance + (damage * 0.5) * (1 - failChance);
        } else {
          damage = damage * failChance;
        }
      }

      result.effect!.damage = damage;
    }

    results.push(result);
  }

  return results;
}

/**
 * Loest einen Angriff auf inklusive Reaction-Verarbeitung.
 */
export function resolveAttackWithReactions(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): AttackResolutionWithReactions | null {
  // Phase 1: 'attacked' Trigger
  const attackedTrigger: ReactionTrigger = {
    event: 'attacked',
    source: attacker,
    target,
    action,
  };
  const attackedReactions = processReactionTrigger(attackedTrigger, state, budgets);

  // Collect AC bonus from reactions (e.g., Shield)
  const reactionACBonus = attackedReactions.reduce((total, result) => {
    if (result.executed && result.effect?.acBonus) {
      return total + result.effect.acBonus;
    }
    return total;
  }, 0);

  // Gather all modifiers from combatTracking
  const gatherCtx: GatherModifiersContext = {
    actor: attacker,
    action,
    state: state as unknown as CombatState,
  };
  const targetResult = {
    targets: [target],
    isAoE: false,
    primaryTarget: target,
  };
  const modifierSets = gatherModifiers(gatherCtx, targetResult);
  const baseModifiers = modifierSets[0] ?? {
    attackAdvantage: 'none' as const,
    attackBonus: 0,
    targetACBonus: 0,
    saveAdvantage: 'none' as const,
    saveBonus: 0,
    damageBonus: 0,
    hasAutoCrit: false,
    hasAutoMiss: false,
    sources: [],
  };

  // Merge reaction AC bonus with gathered modifiers
  const reactionSources = attackedReactions
    .filter(r => r.executed && r.reaction)
    .map(r => `reaction:${r.reaction!.id}`);
  const mergedModifiers: ModifierSet = {
    ...baseModifiers,
    targetACBonus: baseModifiers.targetACBonus + reactionACBonus,
    sources: [...baseModifiers.sources, ...reactionSources],
  };

  // Phase 2: Attack Resolution with full modifiers
  const baseResolution = resolveAttack(attacker, target, action, mergedModifiers);
  if (!baseResolution) return null;

  const attackHit = baseResolution.damageDealt > 0;

  // Phase 3: 'damaged' Trigger
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

  return {
    ...baseResolution,
    attackedReactions,
    damagedReactions,
    attackHit,
    targetACBonus: mergedModifiers.targetACBonus,
  };
}

/**
 * Prueft ob ein Spell durch Counterspell aufgehoben wird.
 */
export function checkCounterspell(
  caster: Combatant,
  spell: Action,
  state: CombatantSimulationState,
  budgets: Map<string, TurnBudget>
): { countered: boolean; reactions: ReactionResult[] } {
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
  const countered = reactions.some(r => r.executed && r.effect?.spellCountered);

  return { countered, reactions };
}

// ============================================================================
// REACTION TURN SYSTEM (Mini-Turns für Reaction-Entscheidungen)
// ============================================================================

/**
 * Ergebnis einer Bewegung mit OA-Checks.
 */
export interface MovementResult {
  /** Ob Bewegung durch Reaction unterbrochen wurde (z.B. Sentinel) */
  interrupted: boolean;
  /** Position an der gestoppt wurde (bei Interrupt) */
  stoppedAt?: GridPosition;
  /** Alle Reactions die während der Bewegung auftraten */
  reactions: ReactionTurnResult[];
  /** Schaden der durch OAs erhalten wurde */
  damageReceived: number;
}

/**
 * Führt Bewegung mit Opportunity Attack Checks aus.
 * Prüft für jeden feindlichen Combatant ob 'leaves-reach' getriggert wird.
 * Bei Trigger: Reactor bekommt Mini-Turn um OA auszuführen oder zu passen.
 *
 * Reactors werden in Initiative-Reihenfolge abgearbeitet.
 *
 * @param mover Der sich bewegende Combatant
 * @param targetPosition Zielposition der Bewegung
 * @param state Combat State
 * @param hasDisengage Ob Disengage aktiv ist (verhindert OAs)
 * @returns MovementResult mit Reactions und Interrupt-Status
 */
export function executeMovement(
  mover: Combatant,
  targetPosition: GridPosition,
  state: CombatState,
  hasDisengage: boolean = false
): MovementResult {
  const currentPos = getPosition(mover);

  // Keine Bewegung nötig?
  if (positionsEqual(currentPos, targetPosition)) {
    return { interrupted: false, reactions: [], damageReceived: 0 };
  }

  // Disengage verhindert OAs
  if (hasDisengage) {
    debug('executeMovement: Disengage aktiv, keine OA-Checks');
    return { interrupted: false, reactions: [], damageReceived: 0 };
  }

  const reactions: ReactionTurnResult[] = [];
  let damageReceived = 0;

  // Potentielle Reactors finden (feindlich, in Reichweite, lebend)
  // Sortiert nach Initiative-Reihenfolge
  const potentialReactors = state.turnOrder
    .map(id => state.combatants.find(c => c.id === id))
    .filter((c): c is CombatantWithLayers =>
      c !== undefined &&
      c.id !== mover.id &&
      !c.combatState.isDead &&
      combatantHasLayers(c) &&
      isHostile(mover.combatState.groupId, c.combatState.groupId, state.alliances)
    );

  for (const reactor of potentialReactors) {
    // Hat dieser Reactor eine Reaction verfügbar?
    const reactionBudget = state.reactionBudgets?.get(reactor.id);
    if (!reactionBudget?.hasReaction) {
      continue;
    }

    // Würde Bewegung eine Reaction triggern?
    if (!wouldTriggerReaction(mover, currentPos, targetPosition, reactor, state as CombatStateWithLayers, 'leaves-reach', hasDisengage)) {
      continue;
    }

    // Finde passende Reactions (OA-Actions)
    const oaReactions = findReactionLayers(reactor, 'leaves-reach')
      .filter(layer => layer.reactionAction)
      .map(layer => layer.reactionAction!);

    if (oaReactions.length === 0) {
      continue;
    }

    // Reactor bekommt Mini-Turn
    const reactionTurn: ReactionTurn = {
      reactor,
      availableReactions: oaReactions,
      context: {
        event: 'leaves-reach',
        source: mover,
        movement: { from: currentPos, to: targetPosition },
      },
    };

    const result = resolveReactionTurn(reactionTurn, state);
    reactions.push(result);

    if (result.executed && result.effect?.damage) {
      damageReceived += result.effect.damage;
      debug('executeMovement: OA hit', {
        reactor: reactor.name,
        damage: result.effect.damage,
      });
    }

    // Sentinel-artige Effects: Bewegung stoppen
    if (result.executed && result.effect?.stopsMovement) {
      debug('executeMovement: Bewegung durch Sentinel gestoppt');
      return {
        interrupted: true,
        stoppedAt: currentPos,
        reactions,
        damageReceived,
      };
    }
  }

  return { interrupted: false, reactions, damageReceived };
}

/**
 * Löst einen Reaction Mini-Turn für einen Combatant auf.
 * AI-Combatants entscheiden automatisch via shouldUseReaction().
 *
 * HACK: Counterspell-Ketten nicht unterstützt - siehe Header.
 *
 * @param turn Der Reaction Turn mit Reactor und verfügbaren Reactions
 * @param state Combat State
 * @returns ReactionTurnResult mit Effekten
 */
export function resolveReactionTurn(
  turn: ReactionTurn,
  state: CombatState
): ReactionTurnResult {
  const { reactor, availableReactions, context } = turn;

  // Budget prüfen
  const reactionBudget = state.reactionBudgets?.get(reactor.id);
  if (!reactionBudget?.hasReaction) {
    debug('resolveReactionTurn: keine Reaction verfügbar', { reactor: reactor.id });
    return { executed: false };
  }

  // Keine verfügbaren Reactions
  if (availableReactions.length === 0) {
    debug('resolveReactionTurn: keine passenden Reactions', { reactor: reactor.id });
    return { executed: false };
  }

  // Beste Reaction finden (existierende AI-Logik)
  let bestReaction = availableReactions[0];
  let bestScore = evaluateReaction(bestReaction, context, reactor, state);

  for (let i = 1; i < availableReactions.length; i++) {
    const score = evaluateReaction(availableReactions[i], context, reactor, state);
    if (score > bestScore) {
      bestScore = score;
      bestReaction = availableReactions[i];
    }
  }

  // Soll die Reaction genutzt werden? (opportunityCost-Prüfung)
  // Erstelle temporären TurnBudget für shouldUseReaction
  const tempBudget: TurnBudget = {
    movementCells: 0,
    baseMovementCells: 0,
    hasAction: false,
    hasBonusAction: false,
    hasReaction: true,
  };

  if (!shouldUseReaction(bestReaction, context, reactor, state, tempBudget)) {
    debug('resolveReactionTurn: Reaction nicht lohnenswert', {
      reactor: reactor.id,
      reaction: bestReaction.name,
      score: bestScore,
    });
    return { executed: false };
  }

  // Reaction ausführen!
  reactionBudget.hasReaction = false;
  const effect = executeReactionEffect(bestReaction, context, reactor, state);

  debug('resolveReactionTurn: Reaction ausgeführt', {
    reactor: reactor.name,
    reaction: bestReaction.name,
    effect,
  });

  return {
    executed: true,
    reaction: bestReaction,
    effect,
  };
}

/**
 * Führt den Effekt einer Reaction aus und mutiert State.
 *
 * @param reaction Die auszuführende Reaction
 * @param context Kontext des Triggers
 * @param reactor Der Reactor
 * @param state Combat State
 * @returns ReactionEffect mit angewendeten Effekten
 */
function executeReactionEffect(
  reaction: Action,
  context: ReactionContext,
  reactor: Combatant,
  state: CombatState
): ReactionEffect {
  const effect: ReactionEffect = {};

  // Resolve baseAction falls vorhanden (für OA: übernimmt attack/damage von Melee-Action)
  const resolvedReaction = resolveActionWithBase(reaction, getActions(reactor));

  // OA: Schaden zufügen
  // Prüft resolvedReaction.damage (nach baseAction-Resolution)
  if (context.event === 'leaves-reach' && resolvedReaction.damage && context.source) {
    const resolution = resolveAttack(reactor, context.source, resolvedReaction);
    if (resolution) {
      effect.damage = resolution.damageDealt;

      // Sentinel-Check: Hat die Action ein stopsMovement flag oder Sentinel property?
      // Note: Die genaue Sentinel-Implementation hängt vom Action-Schema ab
      const actionProps = (resolvedReaction as unknown as { properties?: string[] }).properties;
      if (actionProps?.includes('sentinel')) {
        effect.stopsMovement = true;
      }
    }
  }

  // Shield: AC-Bonus
  if (context.event === 'attacked' && reaction.effects) {
    const acBonus = reaction.effects.reduce((total, e) => {
      const acMod = e.statModifiers?.find(m => m.stat === 'ac');
      return total + (acMod?.value ?? 0);
    }, 0);
    if (acBonus > 0) {
      effect.acBonus = acBonus;
    }
  }

  // Counterspell: Spell countern
  if (context.event === 'spell-cast' && reaction.counter) {
    effect.spellCountered = true;
  }

  // Hellish Rebuke / Damage-Reactions: Schaden zurück
  if (context.event === 'damaged' && reaction.damage && context.source) {
    const damagePMF = diceExpressionToPMF(reaction.damage.dice);
    let damage = getExpectedValue(addConstant(damagePMF, reaction.damage.modifier));

    if (reaction.save) {
      // HACK: Save-Bonus via HP approximiert - siehe Header
      const saveBonus = Math.floor(getExpectedValue(getHP(context.source)) / 30) + 2;
      const dc = reaction.save.dc;
      const failChance = Math.min(0.95, Math.max(0.05, (dc - saveBonus - 1) / 20));

      if (reaction.save.onSave === 'half') {
        damage = damage * failChance + (damage * 0.5) * (1 - failChance);
      } else {
        damage = damage * failChance;
      }
    }

    effect.damage = damage;

    // Schaden auf Angreifer anwenden
    const currentHP = getHP(context.source);
    const damageDist = diceExpressionToPMF(`${Math.round(damage)}d1`);
    const newHP = applyDamageToHP(currentHP, damageDist);
    setHP(context.source, newHP);
  }

  return effect;
}

// ============================================================================
// PROTOCOL WRITING
// ============================================================================

/**
 * Schreibt einen Protocol-Eintrag für die ausgeführte Aktion.
 */
function writeProtocolEntry(
  state: CombatState,
  combatant: Combatant,
  action: TurnAction,
  positionBefore: GridPosition,
  result: ActionResult,
  reactionEntries?: ReactionProtocolEntry[],
  hpChanges?: HPChange[],
  modifiersApplied?: AppliedModifier[],
  targetDeathProbability?: number
): void {
  const entry: CombatProtocolEntry = {
    round: state.roundNumber,
    combatantId: combatant.id,
    combatantName: combatant.name,
    action,
    damageDealt: result.damageDealt,
    damageReceived: result.damageReceived,
    healingDone: result.healingDone,
    positionBefore,
    positionAfter: getPosition(combatant),
    notes: result.notes,
    reactionEntries: reactionEntries?.length ? reactionEntries : undefined,
    hpChanges: hpChanges ?? [],
    modifiersApplied: modifiersApplied ?? [],
    targetDeathProbability,
  };

  state.protocol.push(entry);

  debug('writeProtocolEntry:', {
    round: entry.round,
    combatant: entry.combatantName,
    actionType: action.type,
    damageDealt: entry.damageDealt,
    reactionCount: reactionEntries?.length ?? 0,
  });
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Führt eine einzelne Aktion aus und mutiert State.
 * KEINE AI-Logik - nur Ausführung.
 *
 * Budget wird aus state.currentTurnBudget gelesen und mutiert.
 * DPR wird automatisch zu state.partyDPR/enemyDPR addiert.
 * Bei 'pass': Ruft advanceTurn() auf um zum nächsten Combatant zu wechseln.
 *
 * @param combatant Der aktive Combatant
 * @param action Die auszuführende Aktion
 * @param state Combat State (wird mutiert)
 * @returns ActionResult mit Zusammenfassung
 */
export function executeAction(
  combatant: Combatant,
  action: TurnAction,
  state: CombatState
): ActionResult {
  const budget = state.currentTurnBudget;
  const positionBefore = { ...getPosition(combatant) };
  let damageDealt = 0;
  let damageReceived = 0;
  const healingDone = 0;  // TODO: Healing Actions implementieren
  const notes: string[] = [];
  const reactionEntries: ReactionProtocolEntry[] = [];
  const hpChanges: HPChange[] = [];
  const modifiersApplied: AppliedModifier[] = [];
  let targetDeathProbability: number | undefined;

  // Reaction-Budgets aus state.reactionBudgets (persistiert über Turns)
  // Fallback für Legacy-Code: erstelle temporäre Map
  const budgets = new Map<string, TurnBudget>();
  for (const c of state.combatants) {
    const hasReaction = state.reactionBudgets?.get(c.id)?.hasReaction ?? true;
    budgets.set(c.id, {
      movementCells: 0,
      baseMovementCells: 0,
      hasAction: false,
      hasBonusAction: false,
      hasReaction,
    });
  }

  switch (action.type) {
    case 'action': {
      // 1. Movement zu position (wenn unterschiedlich) - MIT OA-CHECKS
      const currentPos = getPosition(combatant);
      const needsMovement = action.position.x !== currentPos.x ||
          action.position.y !== currentPos.y ||
          action.position.z !== currentPos.z;

      if (needsMovement) {
        // Prüfe ob Disengage aktiv ist (noOpportunityAttacks aus movementBehavior)
        const hasDisengage = action.action.effects?.some(e =>
          e.movementBehavior?.noOpportunityAttacks === true
        ) ?? false;

        // === OA-CHECKS vor Bewegung ===
        const movementResult = executeMovement(combatant, action.position, state, hasDisengage);

        // OA-Schaden tracken
        if (movementResult.damageReceived > 0) {
          damageReceived += movementResult.damageReceived;

          // Protocol-Einträge für OAs erstellen
          for (const reaction of movementResult.reactions) {
            if (reaction.executed && reaction.reaction) {
              notes.push(`${reaction.reaction.name} von Gegner (OA)`);
              reactionEntries.push({
                type: 'reaction',
                round: state.roundNumber,
                reactorId: 'unknown', // TODO: Reactor-ID in ReactionTurnResult speichern
                reactorName: 'Gegner',
                reaction: reaction.reaction,
                trigger: 'leaves-reach',
                triggeredBy: combatant.name,
                damageDealt: reaction.effect?.damage,
                notes: ['Opportunity Attack'],
              });

              // HP-Change für OA-Schaden
              if (reaction.effect?.damage) {
                hpChanges.push({
                  combatantId: combatant.id,
                  combatantName: combatant.name,
                  delta: -Math.round(reaction.effect.damage),
                  source: 'reaction',
                  sourceDetail: `OA: ${reaction.reaction.name}`,
                });
              }
            }
          }
        }

        // Bewegung unterbrochen? (Sentinel)
        if (movementResult.interrupted) {
          debug('executeAction: Bewegung durch Reaction unterbrochen');
          // Bewegung wurde nicht durchgeführt, aber OA-Schaden wurde erhalten
          // Trotzdem Protocol-Eintrag schreiben
          const result: ActionResult = {
            damageDealt: 0,
            damageReceived,
            healingDone: 0,
            notes: [...notes, 'Bewegung durch Reaction gestoppt'],
          };
          writeProtocolEntry(state, combatant, action, positionBefore, result, reactionEntries, hpChanges);
          return result;
        }

        // === TERRAIN EFFECTS: on-leave ===
        const leaveResult = applyTerrainEffects(combatant, currentPos, 'on-leave', state);
        hpChanges.push(...leaveResult.hpChanges);

        const moveCost = getDistance(currentPos, action.position);
        setPosition(combatant, action.position, state);
        budget.movementCells = Math.max(0, budget.movementCells - moveCost);

        // === TERRAIN EFFECTS: on-enter ===
        const enterResult = applyTerrainEffects(combatant, action.position, 'on-enter', state);
        hpChanges.push(...enterResult.hpChanges);

        // === ZONE EFFECTS: on-enter (Spirit Guardians, etc.) ===
        const zoneEnterResult = applyZoneEffects(combatant, 'on-enter', state);
        hpChanges.push(...zoneEnterResult.hpChanges);
        if (zoneEnterResult.conditionsApplied.length > 0) {
          notes.push(`Zone-Conditions: ${zoneEnterResult.conditionsApplied.join(', ')}`);
        }
      }

      // 2. Budget konsumieren (Legacy-Pfad für Actions ohne budgetCosts)
      if (!action.action.budgetCosts) {
        if (action.action.timing.type === 'bonus') {
          budget.hasBonusAction = false;
        } else {
          budget.hasAction = false;
          // Dash/Extra/Teleport: Extra Movement hinzufügen via zentrale Funktion
          const grant = action.action.effects?.find(e => e.grantMovement)?.grantMovement;
          if (grant) {
            budget.movementCells += calculateGrantedMovement(grant, budget);
          }
        }
      } else {
        // Neuer Pfad: Schema-driven Budget Costs
        // Bei grantMovement erst Movement hinzufügen, dann budgetCosts anwenden
        const grant = action.action.effects?.find(e => e.grantMovement)?.grantMovement;
        if (grant) {
          budget.movementCells += calculateGrantedMovement(grant, budget);
        }
        // targetCell wird aus target.combatState.position abgeleitet wenn vorhanden
        const targetCell = action.target ? getPosition(action.target) : undefined;
        applyBudgetCosts(action.action.budgetCosts, budget, combatant, targetCell, state);
      }

      // 3. Action Resolution basierend auf Typ

      // 3.0 Escape Actions (dynamisch generiert für until-escape Conditions)
      if (action.action.id.startsWith('escape-') && action.action._escapeCondition) {
        const conditionName = action.action._escapeCondition;
        const condition = combatant.combatState.conditions?.find(c => c.name === conditionName);

        if (!condition) {
          // Condition bereits entfernt (z.B. Grappler tot)
          notes.push(`${conditionName} nicht mehr vorhanden`);
        } else {
          const escapeResult = resolveEscapeAttempt(combatant, condition, state);

          debug('executeAction: escape attempt', {
            combatant: combatant.name,
            condition: conditionName,
            successProbability: escapeResult.successProbability,
          });

          // Bei probabilistischer Simulation: Condition entfernen mit Wahrscheinlichkeit
          // Hier vereinfacht: Wenn successProbability > 0.5, Erfolg annehmen
          // Für vollständige Implementierung: condition.probability reduzieren
          if (escapeResult.successProbability > 0.5) {
            removeCondition(combatant, conditionName);
            notes.push(
              `${combatant.name} entkommt ${conditionName} ` +
              `(${Math.round(escapeResult.successProbability * 100)}%)`
            );
          } else {
            notes.push(
              `${combatant.name} scheitert beim Entkommen von ${conditionName} ` +
              `(${Math.round(escapeResult.successProbability * 100)}% Chance)`
            );
          }
        }

        // Escape Action abgeschlossen - keine weitere Resolution nötig
        break;
      }

      if (action.target) {
        // 3a. Attack mit Damage
        if (action.action.damage && (action.action.attack || action.action.autoHit)) {
          const resolution = resolveAttackWithReactions(
            combatant,
            action.target,
            action.action,
            state,
            budgets
          );

          if (resolution) {
            damageDealt += resolution.damageDealt;

            // HP-Change für Target (Angriffs-Schaden)
            if (resolution.damageDealt > 0) {
              hpChanges.push({
                combatantId: action.target.id,
                combatantName: action.target.name,
                delta: -Math.round(resolution.damageDealt),
                source: 'attack',
                sourceDetail: action.action.name,
              });
            }

            // Damage von Reactions (Hellish Rebuke etc.) tracken
            for (const reaction of resolution.damagedReactions) {
              if (reaction.executed && reaction.effect?.damage) {
                damageReceived += reaction.effect.damage;
                notes.push(`${reaction.reactor.name} reagiert mit ${reaction.reaction?.name}`);

                // HP-Change für Attacker (Reaction-Schaden)
                hpChanges.push({
                  combatantId: combatant.id,
                  combatantName: combatant.name,
                  delta: -Math.round(reaction.effect.damage),
                  source: 'reaction',
                  sourceDetail: reaction.reaction?.name,
                });
              }
            }

            // Death Probability tracken
            targetDeathProbability = resolution.newDeathProbability;

            // Hit/Miss-Tracking
            const attackerGroupId = combatant.combatState.groupId;
            const attackerIsPartyAlly = attackerGroupId === 'party' ||
              (state.alliances['party']?.includes(attackerGroupId) ?? false);
            if (attackerIsPartyAlly) {
              if (resolution.attackHit) state.partyHits++;
              else state.partyMisses++;
            } else {
              if (resolution.attackHit) state.enemyHits++;
              else state.enemyMisses++;
            }

            // Kill-Note und Kill-Tracking
            if (resolution.newDeathProbability > 0.95) {
              notes.push(`${action.target.name} besiegt`);

              // Kill-Tracking: Wer wurde getötet?
              const targetGroupId = action.target.combatState.groupId;
              const targetIsPartyAlly = targetGroupId === 'party' ||
                (state.alliances['party']?.includes(targetGroupId) ?? false);
              if (targetIsPartyAlly) {
                state.enemyKills++;  // Enemy hat Party-Member getötet
              } else {
                state.partyKills++;  // Party hat Enemy getötet
              }
            }

            // === CONDITION RESOLUTION ===
            debug('condition resolution check:', {
              attacker: combatant.name,
              target: action.target.name,
              actionName: action.action.name,
              attackHit: resolution.attackHit,
              damageDealt: resolution.damageDealt,
              hasEffects: !!action.action.effects,
              effectsCount: action.action.effects?.length ?? 0,
            });

            const { conditionChanges } = resolveActionConditions(
              combatant,
              action.target,
              action.action,
              resolution.attackHit
            );

            for (const cc of conditionChanges) {
              const saveInfo = cc.saveDC ? ` (DC ${cc.saveDC})` : '';
              notes.push(`${cc.combatantName} erhält ${cc.condition}${saveInfo}`);
            }
          }
        }
        // 3b. Contested Check (Grapple, Shove)
        else if (action.action.contested) {
          const contestedResolution = resolveContestedCheck(
            combatant,
            action.target,
            action.action.contested.attackerSkill,
            action.action.contested.defenderChoice
          );

          debug('contested check resolution:', {
            attacker: combatant.name,
            target: action.target.name,
            actionName: action.action.name,
            successProbability: contestedResolution.successProbability,
            attackerBonus: contestedResolution.attackerBonus,
            defenderBonus: contestedResolution.defenderBonus,
          });

          // Contested Check Note
          notes.push(
            `${combatant.name} vs ${action.target.name} (${contestedResolution.attackerSkill}): ` +
            `${Math.round(contestedResolution.successProbability * 100)}% Erfolg`
          );

          // Conditions anwenden mit Erfolgswahrscheinlichkeit
          if (action.action.effects) {
            for (const effect of action.action.effects) {
              if (effect.condition && effect.affectsTarget === 'enemy') {
                const conditionState: ConditionState = {
                  name: effect.condition,
                  probability: contestedResolution.successProbability,
                  effect: mapConditionToEffect(effect.condition),
                  duration: effect.duration ? { ...effect.duration } : undefined,
                  sourceId: combatant.id,
                };
                addCondition(action.target, conditionState);

                notes.push(`${action.target.name} erhält ${effect.condition} (${Math.round(contestedResolution.successProbability * 100)}%)`);

                debug('contested: condition applied', {
                  target: action.target.name,
                  condition: effect.condition,
                  probability: contestedResolution.successProbability,
                });
              }
            }
          }
        }
        // 3c. AutoHit ohne Damage (z.B. reine Buff/Debuff Actions)
        else if (action.action.autoHit && action.action.effects) {
          const { conditionChanges } = resolveActionConditions(
            combatant,
            action.target,
            action.action,
            true  // autoHit = immer "getroffen"
          );

          for (const cc of conditionChanges) {
            const saveInfo = cc.saveDC ? ` (DC ${cc.saveDC})` : '';
            notes.push(`${cc.combatantName} erhält ${cc.condition}${saveInfo}`);
          }

          // 3d. Break Concentration (Dispel Magic)
          for (const effect of action.action.effects) {
            if (effect.breakConcentration && action.target.combatState.concentratingOn) {
              const prevSpell = action.target.combatState.concentratingOn;
              setConcentration(action.target, undefined, state);
              notes.push(`${action.target.name}: Concentration gebrochen (${prevSpell})`);

              debug('breakConcentration:', {
                target: action.target.name,
                prevSpell,
              });
            }
          }
        }
      }

      // 4. Zone Activation (Spirit Guardians, etc.)
      // Wenn Action Zone-Effects hat, aktiviere diese als Active Zone
      if (action.action.effects) {
        for (const effect of action.action.effects) {
          if (effect.zone) {
            // Concentration-Check: Vorherige Concentration beenden
            if (action.action.concentration) {
              setConcentration(combatant, action.action.id, state);
            }

            // Zone aktivieren
            const zone = createActiveZone(combatant.id, action.action.id ?? 'unknown', effect);
            activateZone(state, zone);
            notes.push(`${action.action.name}: Zone aktiviert (${effect.zone.radius}ft Radius)`);

            debug('zone activated:', {
              combatant: combatant.name,
              action: action.action.name,
              radius: effect.zone.radius,
              trigger: effect.trigger,
              targetFilter: effect.zone.targetFilter,
            });
          }
        }
      }
      break;
    }

    case 'pass': {
      // === TERRAIN EFFECTS: on-end-turn ===
      const endTurnResult = applyTerrainEffects(combatant, getPosition(combatant), 'on-end-turn', state);
      hpChanges.push(...endTurnResult.hpChanges);

      // === CONDITION SAVES: on-end-turn ===
      const endTurnConditionResult = processConditionsOnTurnEnd(combatant);
      if (endTurnConditionResult.saved.length > 0) {
        for (const conditionName of endTurnConditionResult.saved) {
          notes.push(`${combatant.name} saves vs ${conditionName}`);
        }
      }

      // Turn beenden - zum nächsten Combatant wechseln
      advanceTurn(state);

      // === TERRAIN EFFECTS & ZONE EFFECTS: on-start-turn (für nächsten Combatant) ===
      // NOTE: Diese Effects gehören zum nächsten Combatant, nicht zu diesem Protocol-Eintrag
      const nextCombatant = getCurrentCombatant(state);
      if (nextCombatant && !nextCombatant.combatState.isDead) {
        // Reset Zone-Triggers für neuen Combatant (erlaubt neuen Trigger pro Turn)
        resetZoneTriggersForCombatant(state, nextCombatant.id);

        // Terrain Effects
        applyTerrainEffects(nextCombatant, getPosition(nextCombatant), 'on-start-turn', state);

        // Zone Effects (Spirit Guardians etc.)
        const zoneStartResult = applyZoneEffects(nextCombatant, 'on-start-turn', state);
        // hpChanges für start-turn werden im nächsten executeAction geloggt
        // Aber Zone-Damage ist sofort relevant - wird hier nicht geloggt (TODO: separate Protocol-Entry)
        debug('zone effects on turn start:', {
          combatant: nextCombatant.name,
          damage: zoneStartResult.hpChanges.reduce((sum, c) => sum + Math.abs(c.delta), 0),
          conditions: zoneStartResult.conditionsApplied,
        });
      }
      break;
    }
  }

  // ZENTRAL: Nach jeder Action tote Combatants markieren
  markDeadCombatants(state);

  // Sync Reaction-Budgets zurück zu state.reactionBudgets
  if (state.reactionBudgets) {
    for (const [id, budget] of budgets) {
      const existing = state.reactionBudgets.get(id);
      if (existing && !budget.hasReaction) {
        existing.hasReaction = false;
      }
    }
  }

  // DPR-Tracking: Party vs Enemies
  const groupId = combatant.combatState.groupId;
  const isPartyAlly = groupId === 'party' || (state.alliances['party']?.includes(groupId) ?? false);
  if (isPartyAlly) {
    state.partyDPR += damageDealt;
  } else {
    state.enemyDPR += damageDealt;
  }

  const result: ActionResult = {
    damageDealt,
    damageReceived,
    healingDone,
    notes,
  };

  // Protocol-Eintrag schreiben (mit Reaction-Einträgen und HP-Änderungen)
  writeProtocolEntry(
    state,
    combatant,
    action,
    positionBefore,
    result,
    reactionEntries,
    hpChanges,
    modifiersApplied,
    targetDeathProbability
  );

  return result;
}
