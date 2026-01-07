// Ziel: Schema-basierte Core Combat Modifiers
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Enthält alle D&D 5e Standard-Modifier als Schema-Definitionen.
// Diese ersetzen die vorherigen hardcoded TypeScript-Implementierungen.
//
// Modifier-Kategorien:
// - Range-Based: long-range, ranged-in-melee
// - Condition-Based: prone-target-close/far, restrained
// - Tactical: pack-tactics
// - Spatial: half-cover

import type { SchemaModifier } from '@/types/entities';

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

/**
 * Pack Tactics: Advantage when non-incapacitated ally is adjacent to target.
 * D&D 5e SRD: "The creature has advantage on an attack roll against a creature
 * if at least one of the creature's allies is within 5 feet of the creature
 * and the ally isn't incapacitated."
 */
export const packTacticsModifier: SchemaModifier = {
  id: 'pack-tactics',
  name: 'Pack Tactics',
  description: 'Advantage if non-incapacitated ally is adjacent to target',
  condition: {
    type: 'exists',
    entity: { type: 'quantified', quantifier: 'any', filter: 'ally', relativeTo: 'attacker' },
    where: {
      type: 'and',
      conditions: [
        { type: 'adjacent-to', subject: 'self', object: 'target' },
        { type: 'is-incapacitated', entity: 'self', negate: true },
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
 * Register these via registerCoreModifiers() in modifiers/index.ts.
 */
export const CORE_MODIFIERS: SchemaModifier[] = [
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
  packTacticsModifier,
];
