// devkit/testing/fixtures/spells.ts
// Reusable spell test data

/**
 * Minimal spell for basic testing
 */
export const minimalSpell = {
  name: "Test Cantrip",
  level: 0,
  school: "evocation",
  castingTime: "1 action",
  range: "60 feet",
  components: "V, S",
  duration: "Instantaneous",
  description: "A simple test cantrip.",
};

/**
 * Simple low-level spell
 */
export const simpleSpell = {
  name: "Test Magic Missile",
  level: 1,
  school: "evocation",
  castingTime: "1 action",
  range: "120 feet",
  components: "V, S",
  duration: "Instantaneous",
  description: "You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several.",
  higherLevels: "When you cast this spell using a spell slot of 2nd level or higher, the spell creates one more dart for each slot level above 1st.",
  classes: ["wizard", "sorcerer"],
};

/**
 * Complex spell with multiple components
 */
export const complexSpell = {
  name: "Test Fireball",
  level: 3,
  school: "evocation",
  castingTime: "1 action",
  range: "150 feet",
  components: "V, S, M (a tiny ball of bat guano and sulfur)",
  duration: "Instantaneous",
  description: "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.\n\nThe fire spreads around corners. It ignites flammable objects in the area that aren't being worn or carried.",
  higherLevels: "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
  classes: ["wizard", "sorcerer"],
  savingThrow: "Dexterity",
  damage: "8d6",
  damageType: "fire",
  areaOfEffect: "20-foot radius sphere",
};

/**
 * Ritual spell
 */
export const ritualSpell = {
  name: "Test Detect Magic",
  level: 1,
  school: "divination",
  ritual: true,
  castingTime: "1 action",
  range: "Self",
  components: "V, S",
  duration: "Concentration, up to 10 minutes",
  description: "For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic, and you learn its school of magic, if any.",
  classes: ["bard", "cleric", "druid", "paladin", "ranger", "wizard"],
};

/**
 * Concentration spell
 */
export const concentrationSpell = {
  name: "Test Haste",
  level: 3,
  school: "transmutation",
  castingTime: "1 action",
  range: "30 feet",
  components: "V, S, M (a shaving of licorice root)",
  duration: "Concentration, up to 1 minute",
  description: "Choose a willing creature that you can see within range. Until the spell ends, the target's speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action on each of its turns. That action can be used only to take the Attack (one weapon attack only), Dash, Disengage, Hide, or Use an Object action.\n\nWhen the spell ends, the target can't move or take actions until after its next turn, as a wave of lethargy sweeps over it.",
  classes: ["wizard", "sorcerer"],
};

/**
 * Spell with material components
 */
export const materialSpell = {
  name: "Test Revivify",
  level: 3,
  school: "necromancy",
  castingTime: "1 action",
  range: "Touch",
  components: "V, S, M (diamonds worth 300 gp, which the spell consumes)",
  duration: "Instantaneous",
  description: "You touch a creature that has died within the last minute. That creature returns to life with 1 hit point. This spell can't return to life a creature that has died of old age, nor can it restore any missing body parts.",
  classes: ["cleric", "paladin"],
  materialCost: 300,
};

/**
 * Cantrip with scaling
 */
export const scalingCantrip = {
  name: "Test Eldritch Blast",
  level: 0,
  school: "evocation",
  castingTime: "1 action",
  range: "120 feet",
  components: "V, S",
  duration: "Instantaneous",
  description: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage.",
  higherLevels: "The spell creates more than one beam when you reach higher levels: two beams at 5th level, three beams at 11th level, and four beams at 17th level. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.",
  classes: ["warlock"],
  damage: "1d10",
  damageType: "force",
  attackType: "ranged",
};

/**
 * All spell fixtures for easy import
 */
export const spells = {
  minimal: minimalSpell,
  simple: simpleSpell,
  complex: complexSpell,
  ritual: ritualSpell,
  concentration: concentrationSpell,
  material: materialSpell,
  scalingCantrip: scalingCantrip,
};
