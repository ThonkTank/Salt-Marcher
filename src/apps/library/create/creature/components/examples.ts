// src/apps/library/create/creature/components/examples.ts
// Example usage of the component-based entry system

import type { ComponentBasedEntry } from "./types";
import {
  createAttackComponent,
  createDamageComponent,
  createSaveComponent,
  createConditionComponent,
  createAreaComponent,
  createRechargeComponent,
  createUsesComponent,
  createTriggerComponent,
  createMeleeAttackEntry,
  createBreathWeaponEntry,
  createMultiattackEntry,
} from "./types";

// ============================================================================
// BASIC EXAMPLES
// ============================================================================

/**
 * Example 1: Simple melee attack (Claw)
 * Components: Attack + Damage
 */
export const clawAttackExample: ComponentBasedEntry = {
  category: "action",
  name: "Claw",
  components: [
    createAttackComponent({
      reach: "5 ft.",
      target: "one target",
      attackType: "Melee Weapon Attack",
      autoCalc: {
        ability: "str",
        proficient: true,
      },
    }),
    createDamageComponent("1d6", {
      abilityMod: { ability: "str" },
      damageType: "slashing",
    }),
  ],
  enabled: true,
};

/**
 * Example 2: Ranged attack with multiple damage types (Flaming Arrow)
 * Components: Attack + Damage + Damage
 */
export const flamingArrowExample: ComponentBasedEntry = {
  category: "action",
  name: "Flaming Arrow",
  components: [
    createAttackComponent({
      reach: "range 150/600 ft.",
      target: "one target",
      attackType: "Ranged Weapon Attack",
      autoCalc: {
        ability: "dex",
        proficient: true,
      },
    }),
    createDamageComponent("1d8", {
      abilityMod: { ability: "dex" },
      damageType: "piercing",
    }),
    createDamageComponent("1d6", {
      damageType: "fire",
      notes: "fire damage from enchantment",
    }),
  ],
  description: "The arrow is magically ignited as it leaves the bow.",
  enabled: true,
};

// ============================================================================
// SAVE-BASED EFFECTS
// ============================================================================

/**
 * Example 3: Poison sting with save and condition
 * Components: Attack + Damage + Save + Condition
 */
export const poisonStingExample: ComponentBasedEntry = {
  category: "action",
  name: "Poison Sting",
  components: [
    createAttackComponent({
      reach: "5 ft.",
      target: "one creature",
      attackType: "Melee Weapon Attack",
      autoCalc: {
        ability: "dex",
        proficient: true,
      },
    }),
    createDamageComponent("1d4", {
      abilityMod: { ability: "dex" },
      damageType: "piercing",
    }),
    createSaveComponent("con", 12, {
      onSuccess: "negates poisoned condition",
    }),
    createConditionComponent("poisoned", {
      duration: { amount: 1, unit: "minute" },
      escape: {
        type: "save",
        ability: "con",
        dc: 12,
        description: "at the end of each of its turns",
      },
    }),
  ],
  description:
    "The target must make a DC 12 Constitution saving throw or become poisoned for 1 minute.",
  enabled: true,
};

// ============================================================================
// AREA OF EFFECT ABILITIES
// ============================================================================

/**
 * Example 4: Dragon breath weapon (classic example)
 * Components: Uses + Area + Save + Damage
 */
export const fireBreathExample: ComponentBasedEntry = {
  category: "action",
  name: "Fire Breath",
  components: [
    createRechargeComponent(5, { timing: "start of turn" }),
    createAreaComponent("cone", "15", {
      origin: "self",
    }),
    createSaveComponent("dex", 15, {
      onSuccess: "half damage",
    }),
    createDamageComponent("6d6", {
      damageType: "fire",
    }),
  ],
  description:
    "The dragon exhales fire in a 15-foot cone. Each creature in that area must make a DC 15 Dexterity saving throw, taking 6d6 fire damage on a failed save, or half as much damage on a successful one.",
  enabled: true,
};

/**
 * Example 5: Limited-use area effect (Frightful Presence)
 * Components: Uses + Area + Save + Condition
 */
export const frightfulPresenceExample: ComponentBasedEntry = {
  category: "action",
  name: "Frightful Presence",
  components: [
    createUsesComponent(1, "day"),
    createAreaComponent("emanation", "60", {
      origin: "self",
      notes: "creatures of dragon's choice",
    }),
    createSaveComponent("wis", 17, {
      onSuccess: "immune for 24 hours",
      onFailure: "frightened for 1 minute",
    }),
    createConditionComponent("frightened", {
      duration: { amount: 1, unit: "minute" },
      escape: {
        type: "save",
        ability: "wis",
        dc: 17,
        description: "at the end of each turn",
      },
    }),
  ],
  description:
    "Each creature of the dragon's choice that is within 60 feet of the dragon and aware of it must succeed on a DC 17 Wisdom saving throw or become frightened for 1 minute.",
  enabled: true,
};

// ============================================================================
// MULTIATTACK EXAMPLES
// ============================================================================

/**
 * Example 6: Simple multiattack
 * Components: Trigger
 */
export const multiattackSimpleExample: ComponentBasedEntry = {
  category: "action",
  name: "Multiattack",
  components: [
    createTriggerComponent("multiattack", [
      { name: "Claw", count: 2 },
      { name: "Bite", count: 1 },
    ]),
  ],
  description: "The creature makes two claw attacks and one bite attack.",
  enabled: true,
};

/**
 * Example 7: Multiattack with conditions
 * Components: Trigger
 */
export const multiattackConditionalExample: ComponentBasedEntry = {
  category: "action",
  name: "Multiattack",
  components: [
    createTriggerComponent("multiattack", [
      { name: "Longsword", count: 2 },
      {
        name: "Shield Bash",
        count: 1,
        condition: "if wielding a shield",
      },
    ]),
  ],
  description:
    "The knight makes two longsword attacks. If it is wielding a shield, it can also make one shield bash attack.",
  enabled: true,
};

// ============================================================================
// UTILITY BUILDER EXAMPLES
// ============================================================================

/**
 * Example 8: Using builder functions for common patterns
 */
export const builtMeleeAttackExample = createMeleeAttackEntry(
  "Greataxe",
  "1d12",
  "slashing",
  {
    description: "A powerful two-handed weapon attack.",
  }
);

/**
 * Example 9: Using breath weapon builder
 */
export const builtBreathWeaponExample = createBreathWeaponEntry(
  "Lightning Breath",
  "line",
  "60",
  "dex",
  14,
  "8d6",
  "lightning",
  {
    description:
      "The dragon exhales lightning in a 60-foot line that is 5 feet wide.",
  }
);

/**
 * Example 10: Using multiattack builder
 */
export const builtMultiattackExample = createMultiattackEntry([
  { name: "Bite", count: 1 },
  { name: "Claw", count: 2 },
  { name: "Tail", count: 1 },
]);

// ============================================================================
// COMPLEX EXAMPLES
// ============================================================================

/**
 * Example 11: Tentacle attack with grapple
 * Components: Attack + Damage + Condition
 */
export const tentacleGrappleExample: ComponentBasedEntry = {
  category: "action",
  name: "Tentacle",
  components: [
    createAttackComponent({
      reach: "15 ft.",
      target: "one creature",
      attackType: "Melee Weapon Attack",
      autoCalc: {
        ability: "str",
        proficient: true,
      },
    }),
    createDamageComponent("2d6", {
      abilityMod: { ability: "str" },
      damageType: "bludgeoning",
    }),
    createConditionComponent("grappled", {
      escape: {
        type: "action",
        description: "DC 16 Strength (Athletics) or Dexterity (Acrobatics) check",
      },
      notes: "escape DC 16",
    }),
  ],
  description:
    "The target is grappled (escape DC 16). Until this grapple ends, the target is restrained, and the creature can't use this tentacle on another target.",
  enabled: true,
};

/**
 * Example 12: Petrifying gaze
 * Components: Save + Condition
 */
export const petrifyingGazeExample: ComponentBasedEntry = {
  category: "action",
  name: "Petrifying Gaze",
  components: [
    createSaveComponent("con", 14, {
      onSuccess: "unaffected",
      onFailure: "begins to turn to stone",
    }),
    createConditionComponent("restrained", {
      duration: { amount: 1, unit: "round" },
      notes: "first failed save - restrained",
    }),
    createConditionComponent("petrified", {
      duration: { amount: 1, unit: "permanent" },
      notes: "second failed save - petrified",
    }),
  ],
  description:
    "The creature targets one creature it can see within 30 feet of it. If the target can see the creature, it must succeed on a DC 14 Constitution saving throw or be magically restrained and begin to turn to stone.",
  enabled: true,
};

/**
 * Example 13: Healing ability
 * Components: Uses + Heal
 */
export const layOnHandsExample: ComponentBasedEntry = {
  category: "action",
  name: "Lay on Hands",
  components: [
    createUsesComponent(5, "long", {
      notes: "pool of 25 hit points",
    }),
    {
      type: "heal",
      amount: 5,
      target: "hp",
      notes: "can use 5 points to cure one disease or neutralize one poison",
    },
  ],
  description:
    "The paladin touches a creature and channels divine energy to restore hit points or cure disease/poison.",
  enabled: true,
};

/**
 * Example 14: Legendary action with movement
 * Components: Effect
 */
export const legendaryMoveExample: ComponentBasedEntry = {
  category: "legendary",
  name: "Detect",
  components: [
    {
      type: "effect",
      name: "Enhanced Senses",
      description:
        "The creature makes a Wisdom (Perception) check.",
    },
  ],
  description: "The creature makes a Wisdom (Perception) check.",
  enabled: true,
};

/**
 * Example 15: Reaction ability
 * Components: Trigger + Save + Damage
 */
export const retaliationExample: ComponentBasedEntry = {
  category: "reaction",
  name: "Retaliation",
  components: [
    createTriggerComponent("reaction", [
      { name: "Claw", count: 1 },
    ], {
      restrictions: "when hit by a melee attack",
    }),
  ],
  description:
    "When the creature takes damage from a melee attack, it can make one claw attack against the attacker.",
  enabled: true,
};
