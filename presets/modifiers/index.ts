// Modifier-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Enthält alle D&D 5e Standard-Modifier als Schema-Definitionen.
// Actions können via modifierRefs auf diese Presets referenzieren.

import { z } from 'zod';
import { schemaModifierSchema, type SchemaModifier } from '../../src/types/entities/conditionExpression';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const modifierPresetSchema = schemaModifierSchema;
export const modifierPresetsSchema = z.array(modifierPresetSchema);

// ============================================================================
// RANGE-BASED MODIFIERS
// ============================================================================

/**
 * Long Range: Disadvantage when target is beyond normal range but within long range.
 * D&D 5e PHB: "Attacking at long range gives you disadvantage on the attack roll."
 */
export const longRangeModifier: SchemaModifier = {
  id: 'long-range',
  name: 'Long Range',
  description: 'Disadvantage when target is in long range',
  condition: { type: 'target-in-long-range' },
  effect: { disadvantage: true },
  priority: 10,
};

/**
 * Ranged in Melee: Disadvantage on ranged attacks when hostile creature is adjacent.
 * D&D 5e PHB: "When you make a ranged attack with a weapon, a spell, or some other
 * means, you have disadvantage on the attack roll if you are within 5 feet of a
 * hostile creature who can see you and who isn't incapacitated."
 *
 * HACK: Currently ignores "can see you" and "isn't incapacitated" conditions.
 */
export const rangedInMeleeModifier: SchemaModifier = {
  id: 'ranged-in-melee',
  name: 'Ranged Attack in Melee',
  description: 'Disadvantage on ranged attacks when hostile creature is adjacent',
  condition: {
    type: 'and',
    conditions: [
      { type: 'action-range-type', rangeType: 'ranged' },
      {
        type: 'exists',
        entity: { type: 'quantified', quantifier: 'any', filter: 'enemy', relativeTo: 'attacker' },
        where: { type: 'adjacent-to', subject: 'self', object: 'attacker' },
      },
    ],
  },
  effect: { disadvantage: true },
  priority: 10,
};

// ============================================================================
// CONDITION-BASED MODIFIERS
// ============================================================================

/**
 * Prone Target (Close): Advantage when attacking prone target from adjacent.
 * D&D 5e PHB: "An attack roll against the creature has advantage if the attacker
 * is within 5 feet of the creature."
 */
export const proneTargetCloseModifier: SchemaModifier = {
  id: 'prone-target-close',
  name: 'Prone Target (Close)',
  description: 'Advantage on attacks against prone target when adjacent',
  condition: {
    type: 'and',
    conditions: [
      { type: 'has-condition', entity: 'target', condition: 'prone' },
      { type: 'adjacent-to', subject: 'attacker', object: 'target' },
    ],
  },
  effect: { advantage: true },
  priority: 8,
};

/**
 * Prone Target (Far): Disadvantage when attacking prone target from range.
 * D&D 5e PHB: "Otherwise, the attack roll has disadvantage."
 */
export const proneTargetFarModifier: SchemaModifier = {
  id: 'prone-target-far',
  name: 'Prone Target (Far)',
  description: 'Disadvantage on attacks against prone target when not adjacent',
  condition: {
    type: 'and',
    conditions: [
      { type: 'has-condition', entity: 'target', condition: 'prone' },
      { type: 'not', condition: { type: 'adjacent-to', subject: 'attacker', object: 'target' } },
    ],
  },
  effect: { disadvantage: true },
  priority: 8,
};

/**
 * Restrained: Advantage on attacks against restrained target.
 * D&D 5e PHB: "Attack rolls against the creature have advantage."
 */
export const restrainedModifier: SchemaModifier = {
  id: 'restrained',
  name: 'Restrained Target',
  description: 'Advantage on attacks against restrained target',
  condition: { type: 'has-condition', entity: 'target', condition: 'restrained' },
  effect: { advantage: true },
  priority: 8,
};

// ============================================================================
// TACTICAL MODIFIERS
// ============================================================================

// DEPRECATED: Pack Tactics is now defined as a passive action (trait-pack-tactics)
// Kept for backwards compatibility with existing modifierRefs
// See: presets/actions/index.ts → passiveTraits

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
// SPATIAL MODIFIERS
// ============================================================================

/**
 * Half Cover: +2 AC when creature provides cover.
 * D&D 5e PHB: "A target with half cover has a +2 bonus to AC and Dexterity saving throws."
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
// EXPORTS
// ============================================================================

/**
 * All core D&D 5e combat modifiers as schema definitions.
 * Use modifierRefs in Actions to reference these by ID.
 */
export const modifierPresets = modifierPresetsSchema.parse([
  // Range-based (Priority 10)
  longRangeModifier,
  rangedInMeleeModifier,
  // Spatial (Priority 9)
  halfCoverModifier,
  // Condition-based (Priority 8)
  proneTargetCloseModifier,
  proneTargetFarModifier,
  restrainedModifier,
  // Tactical (Priority 7)
  // NOTE: packTacticsModifier removed - now defined as passive action
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
