// devkit/testing/fixtures/creatures.ts
// Reusable creature test data

/**
 * Minimal creature for basic testing
 */
export const minimalCreature = {
  name: "Test Goblin",
  size: "Small",
  type: "humanoid",
  ac: 15,
  hp: 7,
  abilities: {
    str: { score: 8, mod: -1 },
    dex: { score: 14, mod: 2 },
    con: { score: 10, mod: 0 },
    int: { score: 10, mod: 0 },
    wis: { score: 8, mod: -1 },
    cha: { score: 8, mod: -1 },
  },
  cr: 0.25,
};

/**
 * Simple creature with basic combat stats
 */
export const simpleCreature = {
  name: "Test Orc",
  size: "Medium",
  type: "humanoid",
  typeTags: ["orc"],
  alignmentLawChaos: "chaotic",
  alignmentGoodEvil: "evil",
  ac: 13,
  hp: 15,
  hitDice: "2d8 + 6",
  speeds: [
    { type: "walk", value: "30" },
  ],
  abilities: {
    str: { score: 16, mod: 3 },
    dex: { score: 12, mod: 1 },
    con: { score: 16, mod: 3 },
    int: { score: 7, mod: -2 },
    wis: { score: 11, mod: 0 },
    cha: { score: 10, mod: 0 },
  },
  skills: [
    { skill: "Intimidation", bonus: 2 },
  ],
  sensesList: [
    { sense: "darkvision", distance: "60" },
  ],
  languagesList: [
    { language: "Common" },
    { language: "Orc" },
  ],
  cr: 0.5,
  xp: 100,
};

/**
 * Complex creature with full stats, abilities, and spellcasting
 */
export const complexCreature = {
  name: "Test Dragon",
  size: "Huge",
  type: "dragon",
  typeTags: ["chromatic"],
  alignmentLawChaos: "chaotic",
  alignmentGoodEvil: "evil",
  ac: 19,
  initiative: 0,
  hp: 200,
  hitDice: "16d12 + 96",
  speeds: [
    { type: "walk", value: "40" },
    { type: "fly", value: "80" },
    { type: "swim", value: "40" },
  ],
  abilities: {
    str: { score: 23, mod: 6, saveProf: true, saveMod: 11 },
    dex: { score: 10, mod: 0, saveProf: true, saveMod: 5 },
    con: { score: 23, mod: 6, saveProf: true, saveMod: 11 },
    int: { score: 16, mod: 3, saveProf: false, saveMod: 3 },
    wis: { score: 15, mod: 2, saveProf: true, saveMod: 7 },
    cha: { score: 19, mod: 4, saveProf: true, saveMod: 9 },
  },
  pb: 5,
  skills: [
    { skill: "Perception", bonus: 12 },
    { skill: "Stealth", bonus: 5 },
  ],
  sensesList: [
    { sense: "blindsight", distance: "60" },
    { sense: "darkvision", distance: "120" },
  ],
  passivesList: [
    { skill: "Perception", value: "22" },
  ],
  languagesList: [
    { language: "Common" },
    { language: "Draconic" },
  ],
  damageImmunitiesList: [
    { type: "fire" },
  ],
  damageResistancesList: [
    { type: "cold" },
  ],
  conditionImmunitiesList: [
    { condition: "charmed" },
    { condition: "frightened" },
  ],
  cr: 17,
  xp: 18000,
  entries: [
    {
      type: "trait",
      name: "Legendary Resistance",
      description: "If the dragon fails a saving throw, it can choose to succeed instead.",
      uses: 3,
    },
    {
      type: "action",
      name: "Multiattack",
      description: "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.",
    },
    {
      type: "action",
      name: "Bite",
      description: "+11 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage plus 9 (2d8) fire damage.",
    },
    {
      type: "legendary",
      name: "Tail Attack",
      description: "The dragon makes a tail attack.",
    },
  ],
  spellcasting: [
    {
      name: "Innate Spellcasting",
      headerEntries: [
        "The dragon's spellcasting ability is Charisma (spell save DC 17). It can innately cast the following spells, requiring no material components:",
      ],
      will: ["detect magic", "identify"],
      daily: {
        "3": ["dispel magic", "counterspell"],
      },
    },
  ],
};

/**
 * Creature with token fields for testing chip rendering
 */
export const creatureWithTokens = {
  name: "Test Wizard",
  size: "Medium",
  type: "humanoid",
  typeTags: ["human"],
  ac: 12,
  hp: 40,
  abilities: {
    str: { score: 9, mod: -1 },
    dex: { score: 14, mod: 2 },
    con: { score: 12, mod: 1 },
    int: { score: 18, mod: 4 },
    wis: { score: 13, mod: 1 },
    cha: { score: 11, mod: 0 },
  },
  skills: [
    { skill: "Arcana", bonus: 8 },
    { skill: "History", bonus: 8 },
  ],
  sensesList: [
    { sense: "darkvision", distance: "60" },
    { sense: "truesight", distance: "10" },
  ],
  passivesList: [
    { skill: "Perception", value: "11" },
    { skill: "Investigation", value: "14" },
  ],
  languagesList: [
    { language: "Common" },
    { language: "Elvish" },
    { language: "Draconic" },
  ],
  speeds: [
    { type: "walk", value: "30" },
    { type: "fly", value: "30", comment: "via spell" },
  ],
  cr: 6,
};

/**
 * Creature with save proficiencies for testing
 */
export const creatureWithSaves = {
  name: "Test Fighter",
  size: "Medium",
  type: "humanoid",
  ac: 18,
  hp: 50,
  abilities: {
    str: { score: 18, mod: 4, saveProf: true, saveMod: 7 },
    dex: { score: 14, mod: 2, saveProf: false, saveMod: 2 },
    con: { score: 16, mod: 3, saveProf: true, saveMod: 6 },
    int: { score: 10, mod: 0, saveProf: false, saveMod: 0 },
    wis: { score: 11, mod: 0, saveProf: false, saveMod: 0 },
    cha: { score: 10, mod: 0, saveProf: false, saveMod: 0 },
  },
  pb: 3,
  cr: 5,
};

/**
 * All creature fixtures for easy import
 */
export const creatures = {
  minimal: minimalCreature,
  simple: simpleCreature,
  complex: complexCreature,
  withTokens: creatureWithTokens,
  withSaves: creatureWithSaves,
};
