// Modifier-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Enthält AI-spezifische Modifier als Schema-Definitionen.
// Standard D&D 5e Modifier (Long Range, Prone, Restrained, etc.) werden
// von gatherModifiers.ts (Single Source of Truth) gehandhabt.
//
// Actions können via modifierRefs auf diese Presets referenzieren.

import { z } from 'zod';
import { schemaModifierSchema, type SchemaModifier } from '../../src/types/entities/conditionExpression';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const modifierPresetSchema = schemaModifierSchema;
export const modifierPresetsSchema = z.array(modifierPresetSchema);

// ============================================================================
// SPATIAL MODIFIERS
// ============================================================================

/**
 * Half Cover: +2 AC when creature provides cover.
 * D&D 5e PHB: "A target with half cover has a +2 bonus to AC and Dexterity saving throws."
 *
 * NOTE: Cover is NOT implemented in core gatherModifiers.ts (requires LOS),
 * so this plugin provides the functionality.
 *
 * HACK: Only implements creature-based half cover (+2 AC).
 * Three-quarters and total cover require terrain data.
 */
export const halfCoverModifier: SchemaModifier = {
  id: 'half-cover',
  name: 'Half Cover',
  description: '+2 AC when creature provides cover',
  condition: {
    type: 'exists',
    entity: { type: 'quantified', quantifier: 'any', filter: 'any-creature', relativeTo: 'attacker' },
    where: { type: 'in-line-between', entity: 'self', from: 'attacker', to: 'target' },
  },
  effect: { acBonus: 2 },
  priority: 9,
};

// ============================================================================
// CREATURE-SPECIFIC MODIFIERS
// ============================================================================

/**
 * Bloodied Frenzy: Advantage when attacker is below 50% HP (bloodied).
 * Used by: Berserker creature stat block.
 */
export const bloodiedFrenzyModifier: SchemaModifier = {
  id: 'bloodied-frenzy',
  name: 'Bloodied Frenzy',
  description: 'Advantage on attacks when bloodied (< 50% HP)',
  condition: { type: 'hp-threshold', entity: 'attacker', comparison: 'below', threshold: 50 },
  effect: { advantage: true },
  priority: 7,
};

/**
 * Aura of Authority: Advantage when allied Hobgoblin Captain is within 10ft.
 * Used by: Hobgoblin Captain creature stat block.
 * D&D 5e: "10ft emanation - Allies have advantage on attack rolls and saves."
 */
export const auraOfAuthorityModifier: SchemaModifier = {
  id: 'aura-of-authority',
  name: 'Aura of Authority',
  description: 'Advantage when allied Hobgoblin Captain within 10ft',
  condition: {
    type: 'exists',
    entity: { type: 'quantified', quantifier: 'any', filter: 'ally', relativeTo: 'attacker' },
    where: {
      type: 'and',
      conditions: [
        { type: 'within-range', subject: 'attacker', object: 'self', range: 10 },
        { type: 'is-creature-type', entity: 'self', creatureId: 'hobgoblin-captain' },
      ],
    },
  },
  effect: { advantage: true },
  priority: 7,
};

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * AI-specific combat modifiers as schema definitions.
 *
 * NOTE: Standard D&D 5e modifiers (long range, prone, restrained, etc.)
 * are handled by gatherModifiers.ts and NOT duplicated here.
 *
 * Use modifierRefs in Actions to reference these by ID.
 */
export const modifierPresets = modifierPresetsSchema.parse([
  // Spatial (Priority 9) - Not in core
  halfCoverModifier,
  // Creature-specific (Priority 7)
  bloodiedFrenzyModifier,
  auraOfAuthorityModifier,
]);

/**
 * Lookup map for fast ID-based resolution.
 */
export const modifierPresetsMap = new Map<string, SchemaModifier>(
  modifierPresets.map((mod) => [mod.id, mod])
);

// Default-Export für CLI-Loading
export default modifierPresets;
