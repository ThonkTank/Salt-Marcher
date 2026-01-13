// Ziel: Adapter von Schema-defined Modifiers zu ModifierEvaluator Interface
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Konvertiert SchemaModifier (Vault-persistierte Definition) zu
// ModifierEvaluator (Runtime-Interface für ModifierRegistry).
//
// Ermöglicht:
// - Schema-defined Modifiers in der bestehenden Pipeline nutzen
// - Keine Änderung am ModifierRegistry Interface nötig
// - Seamless Integration mit hardcoded Modifiers

import type { SchemaModifier, SchemaModifierEffect } from '@/types/entities/conditionExpression';
import type { ModifierContext, ModifierEvaluator, ModifierEffect } from './situationalModifiers';
import { evaluateCondition, createEvaluationContext } from '@/utils/combatModifiers';
import { diceExpressionToPMF, getExpectedValue } from '@/utils/probability';

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[schemaModifierAdapter]', ...args);
  }
};

// ============================================================================
// EFFECT CONVERSION
// ============================================================================

/**
 * Converts SchemaModifierEffect to ModifierEffect.
 * Handles dice expressions in damageBonus if needed.
 */
function convertEffect(schemaEffect: SchemaModifierEffect): ModifierEffect {
  const effect: ModifierEffect = {};

  if (schemaEffect.advantage !== undefined) {
    effect.advantage = schemaEffect.advantage;
  }
  if (schemaEffect.disadvantage !== undefined) {
    effect.disadvantage = schemaEffect.disadvantage;
  }
  if (schemaEffect.attackBonus !== undefined) {
    effect.attackBonus = schemaEffect.attackBonus;
  }
  if (schemaEffect.acBonus !== undefined) {
    effect.acBonus = schemaEffect.acBonus;
  }
  if (schemaEffect.damageBonus !== undefined) {
    // Handle both number and dice expression
    if (typeof schemaEffect.damageBonus === 'number') {
      effect.damageBonus = schemaEffect.damageBonus;
    } else {
      // Parse dice expression and use expected value for scoring
      try {
        const pmf = diceExpressionToPMF(schemaEffect.damageBonus);
        effect.damageBonus = getExpectedValue(pmf);
        debug('damageBonus dice expression:', schemaEffect.damageBonus, '→ avg:', effect.damageBonus);
      } catch (e) {
        debug('Failed to parse damageBonus dice expression:', schemaEffect.damageBonus, e);
      }
    }
  }
  if (schemaEffect.autoCrit !== undefined) {
    effect.autoCrit = schemaEffect.autoCrit;
  }
  if (schemaEffect.autoMiss !== undefined) {
    effect.autoMiss = schemaEffect.autoMiss;
  }

  // Pass through property modifiers directly
  if (schemaEffect.propertyModifiers !== undefined) {
    effect.propertyModifiers = schemaEffect.propertyModifiers;
  }

  return effect;
}

// ============================================================================
// ADAPTER FUNCTION
// ============================================================================

/**
 * Creates a ModifierEvaluator from a SchemaModifier definition.
 *
 * This allows schema-defined modifiers to be used with the existing
 * ModifierRegistry system without any changes to the core evaluation logic.
 *
 * @param schemaMod The schema-defined modifier
 * @returns A ModifierEvaluator that can be registered with ModifierRegistry
 */
export function createSchemaModifierEvaluator(schemaMod: SchemaModifier): ModifierEvaluator {
  // Pre-convert the effect since it's static
  const effect = convertEffect(schemaMod.effect);

  // Define functions separately to avoid potential esbuild transformation issues
  function isActive(modCtx: ModifierContext): boolean {
    const evalCtx = createEvaluationContext(modCtx);

    try {
      const result = evaluateCondition(schemaMod.condition, evalCtx);
      debug(`isActive[${schemaMod.id}]:`, result);
      return result;
    } catch (error) {
      console.error(`[schemaModifierAdapter] Error evaluating ${schemaMod.id}:`, error);
      return false;
    }
  }

  function getEffect(): ModifierEffect {
    return effect;
  }

  return {
    id: schemaMod.id,
    name: schemaMod.name,
    description: schemaMod.description ?? '',
    priority: schemaMod.priority,
    isActive,
    getEffect,
  };
}

// ============================================================================
// BULK REGISTRATION
// ============================================================================

/**
 * Creates ModifierEvaluators from an array of SchemaModifiers.
 *
 * @param schemaModifiers Array of schema-defined modifiers
 * @returns Array of ModifierEvaluators ready for registration
 */
export function createSchemaModifierEvaluators(
  schemaModifiers: SchemaModifier[]
): ModifierEvaluator[] {
  return schemaModifiers.map(createSchemaModifierEvaluator);
}
