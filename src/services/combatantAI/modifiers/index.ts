// Ziel: Bootstrap für Modifier-Plugins
// Siehe: docs/services/combatantAI/actionScoring.md#situational-modifiers
//
// Registriert alle Core-Modifier beim Import via Schema-Definitionen.
// Hardcoded Modifier-Dateien wurden durch Schema-basierte Definitionen ersetzt.
//
// Neue Modifier hinzufügen:
// Option A (core): SchemaModifier zu CORE_MODIFIERS in coreModifiers.ts hinzufügen
// Option B (action): SchemaModifier in Action definieren, registerSchemaModifiers() rufen

import type { Action, SchemaModifier } from '@/types/entities';
import { modifierRegistry } from '../situationalModifiers';
import { createSchemaModifierEvaluator } from '../schemaModifierAdapter';

// ============================================================================
// CORE MODIFIERS (Schema-Based)
// ============================================================================

import {
  CORE_MODIFIERS,
  longRangeModifier,
  rangedInMeleeModifier,
  proneTargetCloseModifier,
  proneTargetFarModifier,
  restrainedModifier,
  packTacticsModifier,
  halfCoverModifier,
} from './coreModifiers';

// Track if core modifiers are registered
let coreModifiersRegistered = false;

/**
 * Registers all core D&D 5e modifiers.
 * Must be called explicitly after module initialization to avoid circular dependencies.
 *
 * @example
 * import { registerCoreModifiers } from '@/services/combatantAI/modifiers';
 * registerCoreModifiers(); // Call once at app startup
 */
export function registerCoreModifiers(): void {
  if (coreModifiersRegistered) return;
  coreModifiersRegistered = true;

  for (const schemaMod of CORE_MODIFIERS) {
    const evaluator = createSchemaModifierEvaluator(schemaMod);
    modifierRegistry.register(evaluator);
  }
}

// ============================================================================
// SCHEMA MODIFIER REGISTRATION
// ============================================================================

/**
 * Registers all schema-defined modifiers from an array of Actions.
 * Call this after loading Actions from Vault to activate their schemaModifiers.
 *
 * @param actions Actions that may contain schemaModifiers
 */
export function registerSchemaModifiers(actions: Action[]): void {
  for (const action of actions) {
    if (!action.schemaModifiers?.length) continue;

    for (const schemaMod of action.schemaModifiers) {
      const evaluator = createSchemaModifierEvaluator(schemaMod);
      modifierRegistry.register(evaluator);
    }
  }
}

/**
 * Registers a single schema-defined modifier.
 * Useful for testing or dynamic modifier addition.
 *
 * @param schemaMod The schema modifier definition
 */
export function registerSchemaModifier(schemaMod: SchemaModifier): void {
  const evaluator = createSchemaModifierEvaluator(schemaMod);
  modifierRegistry.register(evaluator);
}

/**
 * Unregisters a schema modifier by ID.
 *
 * @param id The modifier ID to unregister
 */
export function unregisterSchemaModifier(id: string): void {
  modifierRegistry.unregister(id);
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Core modifier schemas (for testing/inspection)
export {
  CORE_MODIFIERS,
  longRangeModifier,
  rangedInMeleeModifier,
  proneTargetCloseModifier,
  proneTargetFarModifier,
  restrainedModifier,
  packTacticsModifier,
  halfCoverModifier,
} from './coreModifiers';

// Schema modifier utilities
export { createSchemaModifierEvaluator } from '../schemaModifierAdapter';
export { evaluateCondition, createEvaluationContext } from '../expressionEvaluator';
