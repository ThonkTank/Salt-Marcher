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
  halfCoverModifier,
  bloodiedFrenzyModifier,
  auraOfAuthorityModifier,
  modifierPresetsMap,
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
// MODIFIER REF RESOLUTION
// ============================================================================

/**
 * Resolves modifier IDs to their SchemaModifier definitions from presets.
 * Unknown IDs are logged as warnings and skipped.
 *
 * @param refs Array of modifier IDs to resolve
 * @returns Array of resolved SchemaModifier definitions
 */
export function resolveModifierRefs(refs: string[]): SchemaModifier[] {
  const resolved: SchemaModifier[] = [];

  for (const id of refs) {
    const modifier = modifierPresetsMap.get(id);
    if (modifier) {
      resolved.push(modifier);
    } else {
      console.warn(`[modifiers] Unknown modifier ref: "${id}". Available: ${Array.from(modifierPresetsMap.keys()).join(', ')}`);
    }
  }

  return resolved;
}

/**
 * Gets a single modifier by ID from presets.
 *
 * @param id Modifier ID
 * @returns The SchemaModifier or undefined if not found
 */
export function getModifierById(id: string): SchemaModifier | undefined {
  return modifierPresetsMap.get(id);
}

// ============================================================================
// SCHEMA MODIFIER REGISTRATION
// ============================================================================

/**
 * Registers all schema-defined modifiers from an array of Actions.
 * Call this after loading Actions from Vault to activate their schemaModifiers.
 * Handles both inline schemaModifiers and modifierRefs (ID references to presets).
 *
 * @param actions Actions that may contain schemaModifiers or modifierRefs
 */
export function registerSchemaModifiers(actions: Action[]): void {
  for (const action of actions) {
    // Register inline schema modifiers
    if (action.schemaModifiers?.length) {
      for (const schemaMod of action.schemaModifiers) {
        const evaluator = createSchemaModifierEvaluator(schemaMod);
        modifierRegistry.register(evaluator);
      }
    }

    // Register referenced modifiers from presets
    if (action.modifierRefs?.length) {
      const resolved = resolveModifierRefs(action.modifierRefs);
      for (const schemaMod of resolved) {
        const evaluator = createSchemaModifierEvaluator(schemaMod);
        modifierRegistry.register(evaluator);
      }
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

// AI-specific modifier schemas (for testing/inspection)
// NOTE: Standard D&D 5e modifiers (long range, prone, restrained) are in gatherModifiers.ts
export {
  CORE_MODIFIERS,
  halfCoverModifier,
  bloodiedFrenzyModifier,
  auraOfAuthorityModifier,
  modifierPresetsMap,
} from './coreModifiers';

// Schema modifier utilities
export { createSchemaModifierEvaluator } from '../schemaModifierAdapter';
export { evaluateCondition, createEvaluationContext } from '@/utils/combatModifiers';
