// src/workmodes/library/create/creature/presets.ts

export const CREATURE_SIZES = [
  "Tiny",
  "Small",
  "Medium",
  "Large",
  "Huge",
  "Gargantuan",
] as const;
export type CreatureSize = (typeof CREATURE_SIZES)[number];

export const CREATURE_DIFFICULTY_TIERS = [
  {
    id: "tier1",
    label: "Tier 1 (CR 0–4)",
    description: "Standard-Gegner, Scouts und Begleiter mit begrenzter Magie.",
  },
  {
    id: "tier2",
    label: "Tier 2 (CR 5–10)",
    description: "Veteranen, Elite-Wachen und Zauberwirker mit flexiblen Ressourcen.",
  },
  {
    id: "tier3",
    label: "Tier 3 (CR 11–16)",
    description: "Anführer und große Bedrohungen mit signifikanten defensiven Reserven.",
  },
  {
    id: "tier4",
    label: "Tier 4 (CR 17+)",
    description: "Legendäre Gegner, die Encounter-Building und Skalierung beeinflussen.",
  },
] as const;
export type CreatureDifficultyTier = (typeof CREATURE_DIFFICULTY_TIERS)[number];

export const CREATURE_TYPES = [
  "Aberration",
  "Beast",
  "Celestial",
  "Construct",
  "Dragon",
  "Elemental",
  "Fey",
  "Fiend",
  "Giant",
  "Humanoid",
  "Monstrosity",
  "Ooze",
  "Plant",
  "Undead",
] as const;
export type CreatureType = (typeof CREATURE_TYPES)[number];

export const CREATURE_ALIGNMENT_LAW_CHAOS = [
  "Lawful",
  "Neutral",
  "Chaotic",
] as const;
export type CreatureAlignmentLawChaos = (typeof CREATURE_ALIGNMENT_LAW_CHAOS)[number];

export const CREATURE_ALIGNMENT_GOOD_EVIL = [
  "Good",
  "Neutral",
  "Evil",
] as const;
export type CreatureAlignmentGoodEvil = (typeof CREATURE_ALIGNMENT_GOOD_EVIL)[number];

export const CREATURE_ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type CreatureAbilityKey = (typeof CREATURE_ABILITY_KEYS)[number];

export const CREATURE_ABILITY_LABELS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
export type CreatureAbilityLabel = (typeof CREATURE_ABILITY_LABELS)[number];

export type CreatureAbilityDefinition = Readonly<{ key: CreatureAbilityKey; label: CreatureAbilityLabel }>;
export const CREATURE_ABILITIES = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
] as const satisfies readonly CreatureAbilityDefinition[];
export type CreatureAbilityDef = (typeof CREATURE_ABILITIES)[number];

export const CREATURE_SKILLS = [
  ["Athletics", "str"],
  ["Acrobatics", "dex"],
  ["Sleight of Hand", "dex"],
  ["Stealth", "dex"],
  ["Arcana", "int"],
  ["History", "int"],
  ["Investigation", "int"],
  ["Nature", "int"],
  ["Religion", "int"],
  ["Animal Handling", "wis"],
  ["Insight", "wis"],
  ["Medicine", "wis"],
  ["Perception", "wis"],
  ["Survival", "wis"],
  ["Deception", "cha"],
  ["Intimidation", "cha"],
  ["Performance", "cha"],
  ["Persuasion", "cha"],
] as const satisfies readonly (readonly [string, CreatureAbilityKey])[];
export type CreatureSkillEntry = (typeof CREATURE_SKILLS)[number];
export type CreatureSkillName = CreatureSkillEntry[0];

export const CREATURE_ENTRY_CATEGORIES = [
  ["trait", "Eigenschaft"],
  ["action", "Aktion"],
  ["bonus", "Bonusaktion"],
  ["reaction", "Reaktion"],
  ["legendary", "Legendäre Aktion"],
] as const;
export type CreatureEntryCategory = (typeof CREATURE_ENTRY_CATEGORIES)[number][0];

export const CREATURE_ABILITY_SELECTIONS = [
  "",
  "best_of_str_dex",
  ...CREATURE_ABILITY_KEYS,
] as const;
export type CreatureAbilitySelection = (typeof CREATURE_ABILITY_SELECTIONS)[number];

export const CREATURE_SAVE_OPTIONS = [
  "",
  ...CREATURE_ABILITY_LABELS,
] as const;
export type CreatureSaveOption = (typeof CREATURE_SAVE_OPTIONS)[number];

export const CREATURE_MOVEMENT_TYPES = [
  ["walk", "Gehen"],
  ["climb", "Klettern"],
  ["fly", "Fliegen"],
  ["swim", "Schwimmen"],
  ["burrow", "Graben"],
] as const;
export type CreatureMovementType = (typeof CREATURE_MOVEMENT_TYPES)[number][0];

export const CREATURE_DAMAGE_PRESETS = [
  "Acid",
  "Bludgeoning",
  "Bludgeoning (magisch)",
  "Bludgeoning (nichtmagisch)",
  "Cold",
  "Fire",
  "Force",
  "Lightning",
  "Necrotic",
  "Piercing",
  "Piercing (magisch)",
  "Piercing (nichtmagisch)",
  "Poison",
  "Psychic",
  "Radiant",
  "Slashing",
  "Slashing (magisch)",
  "Slashing (nichtmagisch)",
  "Thunder",
  "Alle außer Force",
  "Alle außer Psychic",
  "Nichtmagische Angriffe",
  "Magische Angriffe",
  "Nichtmagische Waffen",
  "Nichtmagische Angriffe (nicht versilbert)",
  "Nichtmagische Angriffe (nicht aus Adamantit)",
] as const;
export type CreatureDamagePreset = (typeof CREATURE_DAMAGE_PRESETS)[number];

export const CREATURE_CONDITION_PRESETS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
] as const;
export type CreatureConditionPreset = (typeof CREATURE_CONDITION_PRESETS)[number];

export const CREATURE_SENSE_PRESETS = [
  "Blindsight",
  "Darkvision",
  "Tremorsense",
  "Truesight",
  "Passive Perception",
  "Telepathy",
] as const;
export type CreatureSensePreset = (typeof CREATURE_SENSE_PRESETS)[number];

// Sense types for structured tokens (lowercase, with key-label pairs)
export const CREATURE_SENSE_TYPES = [
  { key: "blindsight", label: "Blindsight" },
  { key: "darkvision", label: "Darkvision" },
  { key: "tremorsense", label: "Tremorsense" },
  { key: "truesight", label: "Truesight" },
] as const;
export type CreatureSenseType = (typeof CREATURE_SENSE_TYPES)[number];

export const CREATURE_PASSIVE_PRESETS = [
  "Passive Perception",
  "Passive Insight",
  "Passive Investigation",
] as const;
export type CreaturePassivePreset = (typeof CREATURE_PASSIVE_PRESETS)[number];

export const CREATURE_LANGUAGE_PRESETS = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Aquan",
  "Auran",
  "Ignan",
  "Terran",
  "Sylvan",
  "Undercommon",
  "Druidic",
  "Thieves' Cant",
] as const;
export type CreatureLanguagePreset = (typeof CREATURE_LANGUAGE_PRESETS)[number];
