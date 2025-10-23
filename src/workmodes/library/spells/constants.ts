// src/workmodes/library/entities/spells/presets.ts
// Constants and types for spell creation UI

// Spell schools (Zauberschulen)
export const SPELL_SCHOOLS = [
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation",
] as const;
export type SpellSchool = (typeof SPELL_SCHOOLS)[number];

// Attack types
export const SPELL_ATTACK_TYPES = [
  "Melee Spell Attack",
  "Ranged Spell Attack",
  "Melee Weapon Attack",
  "Ranged Weapon Attack",
] as const;
export type SpellAttackType = (typeof SPELL_ATTACK_TYPES)[number];

// Save abilities
export const SPELL_SAVE_ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
export type SpellSaveAbility = (typeof SPELL_SAVE_ABILITIES)[number];

// Class suggestions
export const SPELL_CLASS_SUGGESTIONS = [
  "Bard",
  "Cleric",
  "Druid",
  "Paladin",
  "Ranger",
  "Sorcerer",
  "Warlock",
  "Wizard",
  "Artificer",
] as const;
export type SpellClass = (typeof SPELL_CLASS_SUGGESTIONS)[number];
