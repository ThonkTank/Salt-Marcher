// src/apps/library/create/spell/presets.ts

export const SPELL_GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type SpellGrade = typeof SPELL_GRADES[number];

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
export type SpellSchool = typeof SPELL_SCHOOLS[number];

export const SPELL_ATTACK_OPTIONS = [
    "",
    "Melee Spell Attack",
    "Ranged Spell Attack",
    "Melee Weapon Attack",
    "Ranged Weapon Attack",
] as const;
export type SpellAttackOption = typeof SPELL_ATTACK_OPTIONS[number];

export const SPELL_SAVE_ABILITIES = [
    "",
    "STR",
    "DEX",
    "CON",
    "INT",
    "WIS",
    "CHA",
] as const;
export type SpellSaveAbility = typeof SPELL_SAVE_ABILITIES[number];
