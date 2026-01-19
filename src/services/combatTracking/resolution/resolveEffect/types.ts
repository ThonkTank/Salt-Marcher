// Ziel: Shared Types für rekursiven Effect-Resolver
// Siehe: docs/services/combatTracking/resolveEffects.md
//
// PartialResolutionResult ist der Return-Typ für jeden Effect-Resolver.
// Wird vom Dispatcher gemerged zum finalen ResolutionResult.

import type {
  Combatant,
  CombatState,
  ResolutionHPChange,
  ConditionApplication,
  ConditionRemoval,
  ForcedMovementEntry,
  ZoneActivation,
  SuccessResult,
} from '@/types/combat';
import type { CombatEvent } from '@/types/entities/combatEvent';
import type { ModifierSet } from '../getModifiers';

// ============================================================================
// PARTIAL RESOLUTION RESULT
// ============================================================================

/**
 * Partial result from a single effect resolver.
 * All fields are optional - merge combines them.
 */
export interface PartialResolutionResult {
  hpChanges?: ResolutionHPChange[];
  conditionsToAdd?: ConditionApplication[];
  conditionsToRemove?: ConditionRemoval[];
  forcedMovement?: ForcedMovementEntry[];
  zoneActivation?: ZoneActivation;
  concentrationBreak?: string;
}

// ============================================================================
// EFFECT RESOLUTION CONTEXT
// ============================================================================

/**
 * Context passed to each effect resolver.
 * Contains everything needed to resolve a single effect.
 */
export interface EffectResolutionContext {
  /** The combatant performing the action */
  actor: Combatant;
  /** The target combatant */
  target: Combatant;
  /** The parent action (for metadata access) */
  action: CombatEvent;
  /** Combat state (READ-ONLY) */
  state: Readonly<CombatState>;
  /** Success result for this target */
  successResult: SuccessResult;
  /** Modifiers for this target */
  modifiers: ModifierSet;
  /** Akkumulierter Schaden für sequenzielle HP-Berechnung (all-Effects) */
  accumulatedDamage?: number;
}

// ============================================================================
// MERGE UTILITY
// ============================================================================

/**
 * Merges multiple PartialResolutionResults into one.
 * Arrays are concatenated, single values use first non-undefined.
 */
export function mergeResults(...results: PartialResolutionResult[]): PartialResolutionResult {
  const merged: PartialResolutionResult = {
    hpChanges: [],
    conditionsToAdd: [],
    conditionsToRemove: [],
    forcedMovement: [],
  };

  for (const result of results) {
    if (result.hpChanges) {
      merged.hpChanges!.push(...result.hpChanges);
    }
    if (result.conditionsToAdd) {
      merged.conditionsToAdd!.push(...result.conditionsToAdd);
    }
    if (result.conditionsToRemove) {
      merged.conditionsToRemove!.push(...result.conditionsToRemove);
    }
    if (result.forcedMovement) {
      merged.forcedMovement!.push(...result.forcedMovement);
    }
    if (result.zoneActivation && !merged.zoneActivation) {
      merged.zoneActivation = result.zoneActivation;
    }
    if (result.concentrationBreak && !merged.concentrationBreak) {
      merged.concentrationBreak = result.concentrationBreak;
    }
  }

  return merged;
}

/**
 * Creates an empty PartialResolutionResult.
 */
export function emptyResult(): PartialResolutionResult {
  return {
    hpChanges: [],
    conditionsToAdd: [],
    conditionsToRemove: [],
    forcedMovement: [],
  };
}
