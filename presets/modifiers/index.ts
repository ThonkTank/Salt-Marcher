// Modifier-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/services/combatTracking/gatherModifiers.md
//
// Single Source of Truth für alle SchemaModifier:
// - D&D 5e Conditions (blinded, grappled, prone, etc.)
// - Spatial Modifiers (cover)
// - Creature-specific Modifiers (pack tactics, auras)
//
// Unified System: Alle Modifier nutzen contextualEffects.
// - passive: Immer aktiv (Speed, AC, etc.)
// - whenAttacking: Beim Angreifen
// - whenDefending: Beim Verteidigen
// - whenDefendingMelee/Ranged: Melee/Ranged-spezifisch

import { z } from 'zod';
import { schemaModifierSchema, type SchemaModifier } from '../../src/types/entities/combatEvent';

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
  contextualEffects: {
    passive: { acBonus: 2 },
  },
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
  contextualEffects: {
    whenAttacking: { advantage: true },
  },
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
  contextualEffects: {
    whenAttacking: { advantage: true },
  },
  priority: 7,
};

// ============================================================================
// D&D 5e CONDITION MODIFIERS (Unified contextualEffects)
// ============================================================================
// Single Source of Truth für Condition-Effekte gemäß D&D 5e PHB.
// Jede Condition hat EINEN Modifier mit contextualEffects:
// - passive: Immer aktiv (speedOverride, speedMultiplier)
// - whenAttacking: Effekt wenn der Condition-Owner angreift
// - whenDefending: Effekt wenn der Condition-Owner angegriffen wird
// - whenDefendingMelee: Zusätzlicher Effekt bei Melee-Angriffen (adjacent)
// - whenDefendingRanged: Zusätzlicher Effekt bei Ranged-Angriffen (nicht adjacent)
//
// Priority 10: Condition-Modifier evaluieren vor anderen Modifiern.
// Naming-Pattern: condition-{name}

/**
 * Blinded: Disadvantage when attacking, advantage when attacked.
 * D&D 5e PHB: "Attack rolls against the creature have advantage,
 * and the creature's attack rolls have disadvantage."
 */
export const blindedModifier: SchemaModifier = {
  id: 'condition-blinded',
  name: 'Blinded',
  description: 'D&D 5e Blinded condition',
  condition: { type: 'always' },
  contextualEffects: {
    whenAttacking: { disadvantage: true },
    whenDefending: { advantage: true },
  },
  priority: 10,
};

/**
 * Frightened: Disadvantage when attacking.
 * D&D 5e PHB: "The creature has disadvantage on ability checks and attack rolls
 * while the source of its fear is within line of sight."
 * HACK: Simplified - always applies disadvantage (no LOS check to source).
 */
export const frightenedModifier: SchemaModifier = {
  id: 'condition-frightened',
  name: 'Frightened',
  description: 'D&D 5e Frightened condition',
  condition: { type: 'always' },
  contextualEffects: {
    whenAttacking: { disadvantage: true },
  },
  priority: 10,
};

/**
 * Grappled: Speed is 0.
 * D&D 5e PHB: "A grappled creature's speed becomes 0."
 *
 * Lifecycle:
 * - linkedToSource: When grappled is applied, 'grappling' is applied to the grappler
 * - onSourceDeath: When grappler dies, grappled targets are freed
 * - positionSync: Grappled targets follow the grappler when moved
 */
export const grappledModifier: SchemaModifier = {
  id: 'condition-grappled',
  name: 'Grappled',
  description: 'D&D 5e Grappled condition - speed is 0',
  condition: { type: 'always' },
  contextualEffects: {
    passive: { speedOverride: 0 },
  },
  priority: 10,
  lifecycle: {
    linkedToSource: {
      conditionId: 'grappling',
      onlyIfNew: true,
      removeWhenNoTargets: true,
    },
    onSourceDeath: 'remove-from-targets',
    positionSync: {
      followSource: true,
      requiresSourceCondition: 'grappling',
    },
  },
};

/**
 * Grappling: Speed halved while dragging grappled creature.
 * D&D 5e PHB: "Moving a Grappled Creature. When you move, you can drag or carry
 * the grappled creature with you, but your speed is halved."
 *
 * Applied to the grappler when they have grappled targets.
 */
export const grapplingModifier: SchemaModifier = {
  id: 'condition-grappling',
  name: 'Grappling',
  description: 'D&D 5e Grappling - speed halved while dragging',
  condition: { type: 'always' },
  contextualEffects: {
    passive: { speedMultiplier: 0.5 },
  },
  priority: 10,
};

/**
 * Incapacitated: Cannot take actions or reactions.
 * D&D 5e PHB: "An incapacitated creature can't take actions or reactions."
 * NOTE: No attack-roll modifiers, only action restrictions (handled elsewhere).
 */
export const incapacitatedModifier: SchemaModifier = {
  id: 'condition-incapacitated',
  name: 'Incapacitated',
  description: 'D&D 5e Incapacitated condition',
  condition: { type: 'always' },
  contextualEffects: {},
  priority: 10,
};

/**
 * Invisible: Advantage when attacking, disadvantage when attacked.
 * D&D 5e PHB: "Attack rolls against the creature have disadvantage,
 * and the creature's attack rolls have advantage."
 */
export const invisibleModifier: SchemaModifier = {
  id: 'condition-invisible',
  name: 'Invisible',
  description: 'D&D 5e Invisible condition',
  condition: { type: 'always' },
  contextualEffects: {
    whenAttacking: { advantage: true },
    whenDefending: { disadvantage: true },
  },
  priority: 10,
};

/**
 * Paralyzed: Speed 0, advantage when attacked, auto-crit on melee.
 * D&D 5e PHB: "A paralyzed creature is incapacitated and can't move or speak.
 * Attack rolls against the creature have advantage.
 * Any attack that hits is a critical hit if within 5 feet."
 */
export const paralyzedModifier: SchemaModifier = {
  id: 'condition-paralyzed',
  name: 'Paralyzed',
  description: 'D&D 5e Paralyzed condition',
  condition: { type: 'always' },
  contextualEffects: {
    passive: { speedOverride: 0 },
    whenDefending: { advantage: true },
    whenDefendingMelee: { autoCrit: true },
  },
  priority: 10,
};

/**
 * Petrified: Speed 0, advantage when attacked.
 * D&D 5e PHB: "A petrified creature is transformed into an inanimate substance.
 * Attack rolls against the creature have advantage."
 */
export const petrifiedModifier: SchemaModifier = {
  id: 'condition-petrified',
  name: 'Petrified',
  description: 'D&D 5e Petrified condition',
  condition: { type: 'always' },
  contextualEffects: {
    passive: { speedOverride: 0 },
    whenDefending: { advantage: true },
  },
  priority: 10,
};

/**
 * Poisoned: Disadvantage when attacking.
 * D&D 5e PHB: "A poisoned creature has disadvantage on attack rolls and ability checks."
 */
export const poisonedModifier: SchemaModifier = {
  id: 'condition-poisoned',
  name: 'Poisoned',
  description: 'D&D 5e Poisoned condition',
  condition: { type: 'always' },
  contextualEffects: {
    whenAttacking: { disadvantage: true },
  },
  priority: 10,
};

/**
 * Prone: Disadvantage when attacking, melee advantage/ranged disadvantage when attacked.
 * D&D 5e PHB: "The creature has disadvantage on attack rolls.
 * An attack roll against the creature has advantage if the attacker is within 5 feet.
 * Otherwise, the attack roll has disadvantage."
 */
export const proneModifier: SchemaModifier = {
  id: 'condition-prone',
  name: 'Prone',
  description: 'D&D 5e Prone condition',
  condition: { type: 'always' },
  contextualEffects: {
    whenAttacking: { disadvantage: true },
    whenDefendingMelee: { advantage: true },
    whenDefendingRanged: { disadvantage: true },
  },
  priority: 10,
};

/**
 * Restrained: Speed 0, disadvantage when attacking, advantage when attacked.
 * D&D 5e PHB: "A restrained creature's speed becomes 0.
 * The creature has disadvantage on attack rolls.
 * Attack rolls against the creature have advantage."
 */
export const restrainedModifier: SchemaModifier = {
  id: 'condition-restrained',
  name: 'Restrained',
  description: 'D&D 5e Restrained condition',
  condition: { type: 'always' },
  contextualEffects: {
    passive: { speedOverride: 0 },
    whenAttacking: { disadvantage: true },
    whenDefending: { advantage: true },
  },
  priority: 10,
};

/**
 * Stunned: Speed 0, advantage when attacked.
 * D&D 5e PHB: "A stunned creature is incapacitated, can't move, and can speak only falteringly.
 * Attack rolls against the creature have advantage."
 */
export const stunnedModifier: SchemaModifier = {
  id: 'condition-stunned',
  name: 'Stunned',
  description: 'D&D 5e Stunned condition',
  condition: { type: 'always' },
  contextualEffects: {
    passive: { speedOverride: 0 },
    whenDefending: { advantage: true },
  },
  priority: 10,
};

/**
 * Unconscious: Speed 0, advantage when attacked, auto-crit on melee.
 * D&D 5e PHB: "An unconscious creature is incapacitated, can't move or speak,
 * and is unaware of its surroundings. Attack rolls against the creature have advantage.
 * Any attack that hits is a critical hit if within 5 feet."
 */
export const unconsciousModifier: SchemaModifier = {
  id: 'condition-unconscious',
  name: 'Unconscious',
  description: 'D&D 5e Unconscious condition',
  condition: { type: 'always' },
  contextualEffects: {
    passive: { speedOverride: 0 },
    whenDefending: { advantage: true },
    whenDefendingMelee: { autoCrit: true },
  },
  priority: 10,
};

// ============================================================================
// RANGED ATTACK MODIFIERS (Priority 8)
// ============================================================================
// D&D 5e ranged attack disadvantage rules.
// Applied via modifierRefs on ranged actions.

/**
 * Long Range: Disadvantage on ranged attacks beyond normal range.
 * D&D 5e PHB: "Attacking at long range gives disadvantage on the attack roll."
 *
 * Uses target-beyond-normal-range precondition which checks:
 * - distance > normal range AND distance <= long range
 */
export const longRangeDisadvantageModifier: SchemaModifier = {
  id: 'ranged-long-range',
  name: 'Long Range',
  description: 'Disadvantage on ranged attacks beyond normal range',
  condition: { type: 'target-beyond-normal-range' },
  contextualEffects: {
    passive: { disadvantage: true },
  },
  priority: 8,
};

/**
 * Ranged Attack in Melee: Disadvantage when hostile creature is within 5ft.
 * D&D 5e PHB: "When you make a ranged attack with a weapon, a spell, or some
 * other means, you have disadvantage on the attack roll if you are within
 * 5 feet of a hostile creature who can see you and who isn't incapacitated."
 *
 * NOTE: Simplified - doesn't check if enemy can see or is incapacitated.
 * TODO: Add conditions: not-incapacitated, can-see-attacker
 */
export const rangedInMeleeDisadvantageModifier: SchemaModifier = {
  id: 'ranged-in-melee',
  name: 'Ranged Attack in Melee',
  description: 'Disadvantage when hostile creature is within 5ft',
  condition: {
    type: 'exists',
    entity: { type: 'quantified', quantifier: 'any', filter: 'enemy', relativeTo: 'attacker' },
    where: { type: 'adjacent-to', subject: 'self', object: 'attacker' },
  },
  contextualEffects: {
    passive: { disadvantage: true },
  },
  priority: 8,
};

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * All combat modifiers as schema definitions.
 * Single Source of Truth für:
 * - D&D 5e Conditions (Priority 10) - unified contextualEffects
 * - Spatial Modifiers (Priority 9)
 * - Ranged Modifiers (Priority 8)
 * - Creature-specific Modifiers (Priority 7)
 *
 * Use modifierRefs in Actions to reference these by ID.
 * Conditions are automatically registered via addCondition().
 */
export const modifierPresets = modifierPresetsSchema.parse([
  // D&D 5e Conditions (Priority 10) - unified contextualEffects
  blindedModifier,
  frightenedModifier,
  grappledModifier,
  grapplingModifier,
  incapacitatedModifier,
  invisibleModifier,
  paralyzedModifier,
  petrifiedModifier,
  poisonedModifier,
  proneModifier,
  restrainedModifier,
  stunnedModifier,
  unconsciousModifier,
  // Spatial (Priority 9)
  halfCoverModifier,
  // Ranged (Priority 8)
  longRangeDisadvantageModifier,
  rangedInMeleeDisadvantageModifier,
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
