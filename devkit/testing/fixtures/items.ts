// devkit/testing/fixtures/items.ts
// Reusable item test data

/**
 * Minimal item for basic testing
 */
export const minimalItem = {
  name: "Test Potion",
  rarity: "common",
  type: "potion",
  description: "A simple test potion.",
};

/**
 * Simple magic item
 */
export const simpleItem = {
  name: "Test +1 Sword",
  rarity: "uncommon",
  type: "weapon",
  requiresAttunement: false,
  description: "You have a +1 bonus to attack and damage rolls made with this magic weapon.",
  properties: [
    { property: "bonus", value: "+1" },
  ],
};

/**
 * Complex magic item with charges
 */
export const complexItem = {
  name: "Test Wand of Fireballs",
  rarity: "rare",
  type: "wand",
  requiresAttunement: true,
  attunementRequirements: "spellcaster",
  description: "This wand has 7 charges. While holding it, you can use an action to expend 1 or more of its charges to cast the fireball spell (save DC 15) from it. For 1 charge, you cast the 3rd-level version of the spell. You can increase the spell slot level by one for each additional charge you expend.\n\nThe wand regains 1d6 + 1 expended charges daily at dawn. If you expend the wand's last charge, roll a d20. On a 1, the wand crumbles into ashes and is destroyed.",
  charges: 7,
  recharge: "1d6 + 1 at dawn",
  spells: ["fireball"],
  saveDC: 15,
};

/**
 * Consumable item
 */
export const consumableItem = {
  name: "Test Potion of Healing",
  rarity: "common",
  type: "potion",
  description: "You regain 2d4 + 2 hit points when you drink this potion. The potion's red liquid glimmers when agitated.",
  consumable: true,
  effect: "Restore 2d4 + 2 HP",
};

/**
 * Wondrous item
 */
export const wondrousItem = {
  name: "Test Bag of Holding",
  rarity: "uncommon",
  type: "wondrous item",
  requiresAttunement: false,
  description: "This bag has an interior space considerably larger than its outside dimensions, roughly 2 feet in diameter at the mouth and 4 feet deep. The bag can hold up to 500 pounds, not exceeding a volume of 64 cubic feet. The bag weighs 15 pounds, regardless of its contents. Retrieving an item from the bag requires an action.\n\nIf the bag is overloaded, pierced, or torn, it ruptures and is destroyed, and its contents are scattered in the Astral Plane. If the bag is turned inside out, its contents spill forth, unharmed, but the bag must be put right before it can be used again. Breathing creatures inside the bag can survive up to a number of minutes equal to 10 divided by the number of creatures (minimum 1 minute), after which time they begin to suffocate.\n\nPlacing a bag of holding inside an extradimensional space created by a handy haversack, portable hole, or similar item instantly destroys both items and opens a gate to the Astral Plane. The gate originates where the one item was placed inside the other. Any creature within 10 feet of the gate is sucked through it to a random location on the Astral Plane. The gate then closes. The gate is one-way only and can't be reopened.",
  capacity: "500 pounds / 64 cubic feet",
  weight: 15,
};

/**
 * Artifact
 */
export const artifactItem = {
  name: "Test Vorpal Sword",
  rarity: "legendary",
  type: "weapon",
  requiresAttunement: true,
  description: "You gain a +3 bonus to attack and damage rolls made with this magic weapon. In addition, the weapon ignores resistance to slashing damage.\n\nWhen you attack a creature that has at least one head with this weapon and roll a 20 on the attack roll, you cut off one of the creature's heads. The creature dies if it can't survive without the lost head. A creature is immune to this effect if it is immune to slashing damage, doesn't have or need a head, has legendary actions, or the DM decides that the creature is too big for its head to be cut off with this weapon. Such a creature instead takes an extra 6d8 slashing damage from the hit.",
  properties: [
    { property: "bonus", value: "+3" },
    { property: "ignores resistance", value: "slashing" },
    { property: "vorpal", value: "decapitation on nat 20" },
  ],
};

/**
 * Cursed item
 */
export const cursedItem = {
  name: "Test Berserker Axe",
  rarity: "rare",
  type: "weapon",
  requiresAttunement: true,
  cursed: true,
  description: "You gain a +1 bonus to attack and damage rolls made with this magic weapon. In addition, while you are attuned to this weapon, your hit point maximum increases by 1 for each level you have attained.\n\nCurse. This axe is cursed, and becoming attuned to it extends the curse to you. As long as you remain cursed, you are unwilling to part with the axe, keeping it within reach at all times. You also have disadvantage on attack rolls with weapons other than this one, unless no foe is within 60 feet of you that you can see or hear.\n\nWhenever a hostile creature damages you while the axe is in your possession, you must succeed on a DC 15 Wisdom saving throw or go berserk. While berserk, you must use your action each round to attack the creature nearest to you with the axe. If you can make extra attacks as part of the Attack action, you use those extra attacks, moving to attack the next nearest creature after you fell your current target. If you have multiple possible targets, you attack one at random. You are berserk until you start your turn with no creatures within 60 feet of you that you can see or hear.",
  properties: [
    { property: "bonus", value: "+1" },
    { property: "hp bonus", value: "+1 per level" },
  ],
};

/**
 * All item fixtures for easy import
 */
export const items = {
  minimal: minimalItem,
  simple: simpleItem,
  complex: complexItem,
  consumable: consumableItem,
  wondrous: wondrousItem,
  artifact: artifactItem,
  cursed: cursedItem,
};
