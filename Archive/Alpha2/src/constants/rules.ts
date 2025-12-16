/**
 * Game Rules Constants
 *
 * D&D 5e mechanical constants and valid values.
 */

// Ability scores
export const ABILITY_SCORE_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

// Attack types
export const ATTACK_TYPES = ["melee", "ranged"] as const;

// Area of Effect shapes
export const AOE_SHAPES = ["line", "cone", "sphere", "cube", "cylinder", "emanation"] as const;

// Target types
export const TARGET_TYPES = ["single", "special"] as const;

// Duration timing types
export const DURATION_TYPES = ["instant", "rounds", "minutes", "hours", "until", "start-of-turn", "end-of-turn"] as const;

// Save-to-end timing
export const SAVE_TO_END_TIMINGS = ["start-of-turn", "end-of-turn", "when-damage", "custom"] as const;

// Escape types
export const ESCAPE_TYPES = ["dc", "contest"] as const;

// Limited use reset types
export const LIMITED_USE_RESETS = ["short-rest", "long-rest", "day", "dawn", "dusk"] as const;

// Spellcasting group types
export const SPELLCASTING_GROUP_TYPES = ["at-will", "per-day", "level", "custom"] as const;

// Spellcasting components
export const SPELL_COMPONENTS = ["V", "S", "M"] as const;

// Common spell frequencies
export const SPELL_FREQUENCIES = ["at-will", "1/day", "2/day", "3/day"] as const;

// Movement effect types
export const MOVEMENT_EFFECT_TYPES = ["push", "pull", "teleport", "compelled"] as const;

// Mechanical effect types
export const MECHANICAL_EFFECT_TYPES = ["damage-modifier", "penalty", "advantage", "disadvantage", "other"] as const;

// Creature entry categories (statblock sections)
export const CREATURE_ENTRY_CATEGORIES = ["trait", "action", "bonus", "reaction", "legendary"] as const;
