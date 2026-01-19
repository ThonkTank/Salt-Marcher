// Ziel: Wuerfel-Resolution fuer Combat-Aktionen
// Siehe: docs/services/combatTracking/determineSuccess.md
//
// Pipeline-Schritt 3: Bestimmt ob eine Aktion trifft/wirkt
// - Attack Rolls: d20 + bonus vs AC
// - Save DCs: d20 + save bonus vs DC
// - Contested Checks: d20 + skill vs d20 + skill
//
// ============================================================================
// DESIGN DECISION: Duplicate Helper Functions
// ============================================================================
//
// getProficiencyBonus() und getSaveBonus() existieren auch in combatHelpers.ts.
// BEABSICHTIGT: Diese Versionen sind für die Resolution-Pipeline optimiert.
// - Hier: Arbeitet mit ModifierSet Input
// - combatHelpers.ts: Arbeitet mit direktem Combatant Input für AI-Scoring

import type { AbilityType, SkillType } from '@/constants/action';
import type {
  Combatant,
  ResolutionContext,
  SuccessResult,
} from '@/types/combat';
import type { CombatEvent, UnifiedCheck } from '@/types/entities/combatEvent';
import type { TargetResult } from './findTargets';
import type { ModifierSet, AdvantageState } from './getModifiers';
import {
  getAC,
  getAbilities,
  getSaveProficiencies,
  getCR,
} from '../combatState';
import { clamp } from '@/utils/math';

// DEBUG HELPER
const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[determineSuccess]', ...args);
  }
};

/**
 * Gets the attack bonus from a CombatEvent.
 * Handles both legacy check.type === 'attack' and unified check.roll.type === 'attack'.
 */
function getAttackBonus(action: CombatEvent): number {
  if (!action.check) return 0;

  // Legacy format: check.type === 'attack' with bonus field
  if ('type' in action.check && action.check.type === 'attack' && 'bonus' in action.check) {
    return (action.check as { bonus?: number }).bonus ?? 0;
  }

  // Unified format: check.roll.type === 'attack' with bonus field
  if ('roll' in action.check && action.check.roll.type === 'attack') {
    return action.check.roll.bonus ?? 0;
  }

  return 0;
}

/**
 * Checks if an action is an attack action (legacy format).
 * Used by legacy resolution path.
 */
function isAttackAction(action: CombatEvent): boolean {
  if (!action.check) return false;

  // Legacy format: check.type === 'attack'
  if ('type' in action.check && action.check.type === 'attack') {
    return true;
  }

  return false;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates proficiency bonus from CR (monster) or level (character).
 * D&D 5e formula: floor((CR-1)/4) + 2, clamped to 2-9.
 * Uses getCR() which handles NPC vs Character distinction.
 */
function getProficiencyBonus(c: Combatant): number {
  const crOrLevel = getCR(c);
  return clamp(Math.floor((crOrLevel - 1) / 4) + 2, 2, 9);
}

/**
 * Calculates save bonus for a combatant.
 * Exported for use in resolveEffects.ts (secondary saves on conditions).
 */
export function getSaveBonus(target: Combatant, ability: AbilityType): number {
  const abilities = getAbilities(target);
  const abilityScore = abilities[ability as keyof typeof abilities] ?? 10;
  const modifier = Math.floor((abilityScore - 10) / 2);
  const proficiency = getProficiencyBonus(target);
  const saveProficiencies = getSaveProficiencies(target);
  const isProficient = saveProficiencies.includes(ability as never);
  return modifier + (isProficient ? proficiency : 0);
}

/**
 * Calculates ability modifier from ability score.
 * D&D 5e formula: floor((score - 10) / 2)
 */
function getAbilityModifier(c: Combatant, ability: AbilityType): number {
  const abilities = getAbilities(c);
  const score = abilities[ability as keyof typeof abilities] ?? 10;
  return Math.floor((score - 10) / 2);
}

/**
 * Gets skill bonus for a combatant.
 * For now simplified: uses ability modifier (skill proficiencies not tracked yet).
 * TODO: Add skill proficiency tracking to Combatant type.
 */
function getSkillBonus(c: Combatant, skill: SkillType): number {
  // Map skills to their governing abilities
  const skillAbilityMap: Record<SkillType, AbilityType> = {
    'acrobatics': 'dex',
    'animal-handling': 'wis',
    'arcana': 'int',
    'athletics': 'str',
    'deception': 'cha',
    'history': 'int',
    'insight': 'wis',
    'intimidation': 'cha',
    'investigation': 'int',
    'medicine': 'wis',
    'nature': 'int',
    'perception': 'wis',
    'performance': 'cha',
    'persuasion': 'cha',
    'religion': 'int',
    'sleight-of-hand': 'dex',
    'stealth': 'dex',
    'survival': 'wis',
  };

  const ability = skillAbilityMap[skill] ?? 'str';
  // For now, just use ability modifier (no proficiency tracking)
  return getAbilityModifier(c, ability);
}

/**
 * Gets the best bonus from a list of skill/ability choices.
 * Used for contested checks where defender can choose.
 */
function getBestBonus(c: Combatant, choices: (SkillType | AbilityType)[]): number {
  if (choices.length === 0) return 0;

  const skillTypes = [
    'acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception',
    'history', 'insight', 'intimidation', 'investigation', 'medicine',
    'nature', 'perception', 'performance', 'persuasion', 'religion',
    'sleight-of-hand', 'stealth', 'survival',
  ];

  return Math.max(...choices.map(choice => {
    if (skillTypes.includes(choice)) {
      return getSkillBonus(c, choice as SkillType);
    }
    return getAbilityModifier(c, choice as AbilityType);
  }));
}

/**
 * Checks if a check is a UnifiedCheck (not auto/none).
 */
function isUnifiedCheck(check: unknown): check is UnifiedCheck {
  return (
    typeof check === 'object' &&
    check !== null &&
    'roller' in check &&
    'roll' in check &&
    'against' in check
  );
}

// ============================================================================
// ATTACK RESOLUTION
// ============================================================================

/**
 * Calculates attack hit chance with advantage/disadvantage.
 *
 * @returns Object with hitChance and critChance
 */
function calculateAttackHitChance(
  attackBonus: number,
  targetAC: number,
  advantage: AdvantageState,
  flatBonus: number,
  hasAutoCrit: boolean,
  hasAutoMiss: boolean
): { hitChance: number; critChance: number } {
  if (hasAutoMiss) return { hitChance: 0, critChance: 0 };
  if (hasAutoCrit) return { hitChance: 1, critChance: 1 };

  const effectiveBonus = attackBonus + flatBonus;
  const neededRoll = targetAC - effectiveBonus;
  let baseChance = clamp((21 - neededRoll) / 20, 0.05, 0.95);
  let critChance = 0.05; // Natural 20

  switch (advantage) {
    case 'advantage':
      // P(at least one success) = 1 - P(both fail)
      baseChance = 1 - Math.pow(1 - baseChance, 2);
      critChance = 1 - Math.pow(0.95, 2); // ~0.0975
      break;
    case 'disadvantage':
      // P(both succeed)
      baseChance = Math.pow(baseChance, 2);
      critChance = Math.pow(0.05, 2); // 0.0025
      break;
  }

  return { hitChance: baseChance, critChance };
}

// ============================================================================
// SAVE RESOLUTION
// ============================================================================

/**
 * Calculates save failure chance with advantage/disadvantage.
 * Exported for use in resolveEffects.ts (secondary saves on conditions).
 */
export function calculateSaveFailChance(
  dc: number,
  saveBonus: number,
  saveAdvantage: AdvantageState
): number {
  const baseFailChance = clamp((dc - saveBonus - 1) / 20, 0.05, 0.95);

  switch (saveAdvantage) {
    case 'advantage':
      // Advantage on save means harder to fail
      return Math.pow(baseFailChance, 2);
    case 'disadvantage':
      // Disadvantage on save means easier to fail
      return 1 - Math.pow(1 - baseFailChance, 2);
    default:
      return baseFailChance;
  }
}

// ============================================================================
// UNIFIED CHECK RESOLUTION
// ============================================================================

/**
 * Resolves a UnifiedCheck - the new unified schema for all check types.
 * Handles: Attack, Save, Contested, Ability Check through one consistent path.
 *
 * @param check The unified check definition
 * @param context Resolution context with actor, action, state
 * @param target The target combatant
 * @param modifiers Modifier set for this target
 * @returns SuccessResult
 */
function resolveUnifiedCheck(
  check: UnifiedCheck,
  context: ResolutionContext,
  target: Combatant,
  modifiers: ModifierSet
): SuccessResult {
  const roller = check.roller === 'actor' ? context.actor : target;

  // 1. Calculate roll bonus based on roll type
  let rollBonus: number;
  let isAttack = false;

  switch (check.roll.type) {
    case 'attack':
      rollBonus = check.roll.bonus ?? 0;
      isAttack = true;
      break;
    case 'ability':
      rollBonus = getAbilityModifier(roller, check.roll.ability);
      break;
    case 'skill':
      rollBonus = getSkillBonus(roller, check.roll.skill);
      break;
  }

  // 2. Calculate DC based on against type
  let dc: number;
  const opponent = check.roller === 'actor' ? target : context.actor;

  switch (check.against.type) {
    case 'fixed':
      dc = check.against.dc;
      break;
    case 'ac':
      dc = getAC(target) + modifiers.targetACBonus;
      break;
    case 'ability-dc':
      // 8 + proficiency + ability modifier
      dc = 8 + getProficiencyBonus(opponent) +
           getAbilityModifier(opponent, check.against.ability);
      break;
    case 'contested':
      // Opposed check: both roll, attacker wins ties
      // Simplified: average roll (10.5) + best bonus as DC
      const defenderBonus = getBestBonus(opponent, check.against.choice as (SkillType | AbilityType)[]);
      dc = 10 + defenderBonus;
      break;
  }

  // 3. Apply modifiers
  rollBonus += modifiers.attackBonus; // General bonus modifier

  // 4. Calculate success probability
  // Base formula: P(success) = (21 + bonus - DC) / 20, clamped to 0.05-0.95
  let baseSuccessChance = clamp((21 + rollBonus - dc) / 20, 0.05, 0.95);

  // 4b. Apply advantage/disadvantage for attacks
  let successChance = baseSuccessChance;
  let critChance = 0;
  let critical = false;

  if (isAttack) {
    // Use calculateAttackHitChance for proper advantage/disadvantage handling
    const attackResult = calculateAttackHitChance(
      rollBonus - modifiers.attackBonus, // Base attack bonus (without general modifier)
      dc,
      modifiers.attackAdvantage,
      modifiers.attackBonus, // Flat bonus
      modifiers.hasAutoCrit ?? false,
      modifiers.hasAutoMiss ?? false
    );
    successChance = attackResult.hitChance;
    critChance = attackResult.critChance;
    critical = critChance >= 0.5;
  }

  debug('resolveUnifiedCheck:', {
    actionId: context.action.id,
    rollType: check.roll.type,
    rollBonus,
    dc,
    baseSuccessChance,
    successChance,
    attackAdvantage: modifiers.attackAdvantage,
    modifiersAttackBonus: modifiers.attackBonus,
  });
  const succeeded = successChance >= 0.5;

  // 6. Calculate damageMultiplier based on onSuccess/onFailure
  // NOTE: For attacks, damageMultiplier should be 1 because hitProbability
  // already encodes the chance to hit (damage.ts multiplies both).
  // For saves, hitProbability = 1 and damageMultiplier encodes save-half.
  let damageMultiplier: number;
  const onSuccess = check.onSuccess ?? 'effect-applies';
  const onFailure = check.onFailure ?? 'no-effect';

  if (isAttack) {
    // Attacks: hitProbability handles scaling, damageMultiplier = 1
    damageMultiplier = 1;
  } else if (onSuccess === 'half-effect' && onFailure === 'half-effect') {
    // Always half effect regardless of outcome
    damageMultiplier = 0.5;
  } else if (onSuccess === 'half-effect') {
    // Half on success, full on failure (rare, but possible)
    damageMultiplier = 0.5 * successChance + 1 * (1 - successChance);
  } else if (onFailure === 'half-effect') {
    // Full on success, half on failure (typical save for half)
    damageMultiplier = 1 * successChance + 0.5 * (1 - successChance);
  } else {
    // Full on success, none on failure (ability check or contested)
    damageMultiplier = successChance;
  }

  // 7. Determine checkSucceeded based on roller perspective
  // For actor checks (attacks, ability checks): success = roller succeeded
  // For target checks (saves): success = target FAILED (effect applies)
  let checkSucceeded: boolean;
  if (check.roller === 'actor') {
    // Actor rolled: effect applies if actor succeeded
    checkSucceeded = succeeded;
  } else {
    // Target rolled (save): effect applies if target FAILED
    checkSucceeded = !succeeded;
  }

  return {
    target,
    hit: checkSucceeded,
    critical,
    hitProbability: check.roller === 'actor' ? successChance : 1 - successChance,
    critProbability: critChance,
    saveSucceeded: check.roller === 'target' ? succeeded : undefined,
    contestWon: check.against.type === 'contested' ? checkSucceeded : undefined,
    checkSucceeded,
    damageMultiplier,
  };
}

// ============================================================================
// MANUAL SUCCESS DETERMINATION (GM enters dice results)
// ============================================================================

/**
 * Determines success from manual GM input.
 * Returns deterministic result instead of probability.
 */
function determineSuccessManual(
  context: ResolutionContext,
  target: Combatant,
  modifiers: ModifierSet
): SuccessResult {
  const { manualRolls, action } = context;

  // Direct result override takes precedence
  if (manualRolls?.resultOverride) {
    const isCrit = manualRolls.resultOverride === 'crit';
    const isHit = manualRolls.resultOverride !== 'miss';
    return {
      target,
      hit: isHit,
      critical: isCrit,
      hitProbability: isHit ? 1 : 0,
      critProbability: isCrit ? 1 : 0,
      checkSucceeded: isHit,
      damageMultiplier: isCrit ? 2 : (isHit ? 1 : 0),
      isManual: true,
    };
  }

  // Calculate from attack roll (d20 + bonus vs AC)
  if (manualRolls?.attackRoll !== undefined && isAttackAction(action)) {
    const natural = manualRolls.attackRoll;
    const total = natural + getAttackBonus(action) + modifiers.attackBonus;
    const targetAC = getAC(target) + modifiers.targetACBonus;

    const isCrit = natural === 20;
    const isCritMiss = natural === 1;
    const hit = isCrit || (!isCritMiss && total >= targetAC);

    return {
      target,
      hit,
      critical: isCrit,
      hitProbability: hit ? 1 : 0,
      critProbability: isCrit ? 1 : 0,
      checkSucceeded: hit,
      damageMultiplier: isCrit ? 2 : (hit ? 1 : 0),
      isManual: true,
      actualAttackRoll: total,
    };
  }

  // For saves with manual rolls, we could extend this later
  // For now, fall back to probabilistic calculation
  return determineSuccessProbabilistic(context, target, modifiers);
}

// ============================================================================
// PROBABILISTIC SUCCESS DETERMINATION (AI/Simulation)
// ============================================================================

/**
 * Determines success probabilistically for AI simulation.
 */
function determineSuccessProbabilistic(
  context: ResolutionContext,
  target: Combatant,
  modifiers: ModifierSet
): SuccessResult {
  const { action } = context;

  // Default result for auto-hit actions (healing, buffs)
  const defaultResult: SuccessResult = {
    target,
    hit: true,
    critical: false,
    hitProbability: 1,
    critProbability: 0,
    checkSucceeded: true,
    damageMultiplier: 1,
  };

  // Unified Check resolution (new schema)
  // Routes all check types through one consistent path
  if (action.check) {
    // Handle auto/none check types
    if ('type' in action.check) {
      if (action.check.type === 'auto') {
        return defaultResult;
      }
      if (action.check.type === 'none') {
        return defaultResult;
      }
    }

    // Handle UnifiedCheck
    if (isUnifiedCheck(action.check)) {
      return resolveUnifiedCheck(action.check, context, target, modifiers);
    }
  }

  // ============================================================================
  // LEGACY RESOLUTION (backwards compatibility)
  // TODO: Migrate all actions to UnifiedCheck, then remove legacy paths
  // ============================================================================

  // Attack-based resolution (legacy)
  if (isAttackAction(action)) {
    const targetAC = getAC(target) + modifiers.targetACBonus;
    const { hitChance, critChance } = calculateAttackHitChance(
      getAttackBonus(action),
      targetAC,
      modifiers.attackAdvantage,
      modifiers.attackBonus,
      modifiers.hasAutoCrit,
      modifiers.hasAutoMiss
    );

    // Binary hit/crit für Protocol-Anzeige, Probabilities für Schadensberechnung
    const hit = hitChance >= 0.5;
    return {
      target,
      hit,                              // Für Protocol-Anzeige (binary)
      critical: critChance >= 0.5,      // Für Protocol-Anzeige (binary)
      hitProbability: hitChance,        // Für Schadensberechnung
      critProbability: critChance,      // Für Crit-Dice-Berechnung
      checkSucceeded: hit,              // Effect applies if attack hits
      damageMultiplier: 1,              // Nicht verwendet für Attacks
    };
  }

  // Save-based resolution (legacy)
  // Note: Escape checks now use Unified Check with roller: 'actor'
  // This path only handles normal saves where Target rolls against Actor's DC
  if (action.save) {
    const saveBonus = getSaveBonus(target, action.save.ability as AbilityType);
    const failChance = calculateSaveFailChance(
      action.save.dc,
      saveBonus + modifiers.saveBonus,
      modifiers.saveAdvantage
    );

    // Probabilistische Berechnung statt binärer Save-Determination
    // E[damage] = P(fail) × 1 + P(save) × halfMultiplier
    // Für half: E = failChance + (1-failChance) × 0.5 = 0.5 + 0.5 × failChance
    // Für none: E = failChance
    const damageMultiplier = action.save.onSave === 'half'
      ? 0.5 + 0.5 * failChance
      : failChance;

    // checkSucceeded = true when target FAILS save (effect applies)
    const checkSucceeded = failChance >= 0.5;

    return {
      target,
      hit: checkSucceeded,              // Für Protocol-Anzeige (binary)
      critical: false,
      hitProbability: failChance,
      critProbability: 0,
      saveSucceeded: !checkSucceeded,   // Für Protocol-Anzeige (binary)
      checkSucceeded,                   // Effect applies if target fails save
      damageMultiplier,
    };
  }

  // Contested check resolution (grapple, shove)
  if (action.contested) {
    // Simplified: compare attacker skill vs defender skill
    // defenderChoice is an array - use first option for simplicity
    const attackerBonus = getSaveBonus(context.actor, action.contested.attackerSkill as AbilityType);
    const defenderSkill = action.contested.defenderChoice?.[0] ?? 'str';
    const defenderBonus = getSaveBonus(target, defenderSkill as AbilityType);

    // Difference determines win probability
    const bonusDiff = attackerBonus - defenderBonus;
    const winChance = clamp(0.5 + bonusDiff * 0.05, 0.05, 0.95);
    const contestWon = winChance >= 0.5;

    return {
      target,
      hit: contestWon,
      critical: false,
      hitProbability: winChance,
      critProbability: 0,
      contestWon,
      checkSucceeded: contestWon,       // Effect applies if contest won
      damageMultiplier: contestWon ? 1 : 0,
    };
  }

  // Auto-hit actions (healing, buffs, etc.)
  return defaultResult;
}

// ============================================================================
// SUCCESS DETERMINATION (Router)
// ============================================================================

/**
 * Determines success for a single target based on action type.
 * Routes to manual or probabilistic determination based on context.
 */
function determineSuccessForTarget(
  context: ResolutionContext,
  target: Combatant,
  modifiers: ModifierSet
): SuccessResult {
  // Manual mode: GM entered dice results
  if (context.manualRolls) {
    return determineSuccessManual(context, target, modifiers);
  }

  // Probabilistic mode: AI/Simulation
  return determineSuccessProbabilistic(context, target, modifiers);
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Determines success for all targets in a target result.
 * Pipeline Step 3: After findTargets and getModifiers, before resolveEffects.
 *
 * @param context Resolution context with actor, action, state
 * @param targetResult Result from findTargets
 * @param modifierSets ModifierSet for each target from getModifiers
 * @returns SuccessResult for each target
 */
export function determineSuccess(
  context: ResolutionContext,
  targetResult: TargetResult,
  modifierSets: ModifierSet[]
): SuccessResult[] {
  return targetResult.targets.map((target, index) => {
    const modifiers = modifierSets[index];
    return determineSuccessForTarget(context, target, modifiers);
  });
}
