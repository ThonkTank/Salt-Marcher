// src/workmodes/library/entities/creatures/types.ts
// Type definitions for creature data structures
// Moved from storage layer for better organization

/**
 * Normalised creature data used for persistence and Markdown export.
 * The structure intentionally mirrors the reference stat blocks in
 * `References/rulebooks/Statblocks/Creatures/Monsters`, covering:
 * - identity (name, size, type, alignment)
 * - initiative, defenses, hit points and movement (`speeds` bündelt Standard-Arten und zusätzliche Spezialbewegungen)
 * - abilities, saving throws, skills and passive perceptions
 * - languages, gear and any resistances/immunities
 * - trait/action style entries including bonus & reaction sections
 * - spellcasting lists grouped by level or usage frequency
 */

// Legacy object-based format (deprecated, will be migrated to array format)
export type CreatureSpeedValue = {
    distance?: string;
    hover?: boolean;
    note?: string;
};

export type CreatureSpeedExtra = CreatureSpeedValue & {
    label: string;
};

export type CreatureSpeeds = {
    walk?: CreatureSpeedValue;
    swim?: CreatureSpeedValue;
    fly?: CreatureSpeedValue;
    burrow?: CreatureSpeedValue;
    climb?: CreatureSpeedValue;
    extras?: CreatureSpeedExtra[];
};

// New array-based format (preferred)
export type SpeedEntry = {
    type: string;      // "walk", "fly", "swim", "burrow", "climb", or custom
    value: string;     // e.g. "30 ft."
    hover?: boolean;   // Only for fly speed
    note?: string;     // Additional notes
};

export type SpeedArray = SpeedEntry[];

// Structured token types for creature fields
export type SenseToken = {
    type?: string;      // "darkvision", "blindsight", "tremorsense", "truesight"
    range?: string;     // e.g. "120"
    value?: string;     // Fallback for freeform text
};

export type LanguageToken = {
    value?: string;     // e.g. "Common", "Draconic"
    type?: string;      // "telepathy"
    range?: string;     // e.g. "120" (for telepathy)
};

export type SimpleValueToken = {
    value: string;      // Freeform text value
};

export type AbilityScoreKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type SpellcastingAbility = AbilityScoreKey;

export type SpellcastingSpell = {
    name: string;
    notes?: string;
    prepared?: boolean;
};

export type SpellcastingGroupAtWill = {
    type: "at-will";
    title?: string;
    spells: SpellcastingSpell[];
};

export type SpellcastingGroupPerDay = {
    type: "per-day";
    uses: string;
    title?: string;
    note?: string;
    spells: SpellcastingSpell[];
};

export type SpellcastingGroupLevel = {
    type: "level";
    level: number;
    title?: string;
    slots?: number | string;
    note?: string;
    spells: SpellcastingSpell[];
};

export type SpellcastingGroupCustom = {
    type: "custom";
    title: string;
    description?: string;
    spells?: SpellcastingSpell[];
};

export type SpellcastingGroup =
    | SpellcastingGroupAtWill
    | SpellcastingGroupPerDay
    | SpellcastingGroupLevel
    | SpellcastingGroupCustom;

export type SpellcastingComputedValues = {
    abilityMod?: number | null;
    proficiencyBonus?: number | null;
    saveDc?: number | null;
    attackBonus?: number | null;
};

export type SpellcastingData = {
    title?: string;
    summary?: string;
    ability?: SpellcastingAbility;
    saveDcOverride?: number;
    attackBonusOverride?: number;
    notes?: string[];
    groups: SpellcastingGroup[];
    computed?: SpellcastingComputedValues;
};

/**
 * Ability score with value
 */
export type AbilityScore = {
    ability: AbilityScoreKey;
    score: number;
};

/**
 * New format for saving throws with explicit bonuses
 * Replaces boolean-only saveProf to support custom modifiers
 */
export type SaveBonus = {
    ability: AbilityScoreKey;
    bonus: number;
};

/**
 * New format for skills with explicit bonuses
 * Replaces skillsProf/skillsExpertise to support custom modifiers
 */
export type SkillBonus = {
    name: string;
    bonus: number;
};

export type StatblockData = {
    name: string;
    size?: string;
    type?: string;
    typeTags?: string[];
    alignmentLawChaos?: string;
    alignmentGoodEvil?: string;
    alignmentOverride?: string;
    ac?: string;
    initiative?: string;
    hp?: string;
    hitDice?: string;
    speeds?: CreatureSpeeds | SpeedArray;  // Accept both old and new formats
    abilities?: AbilityScore[];
    pb?: string;
    saves?: SaveBonus[];
    skills?: SkillBonus[];

    sensesList?: SenseToken[];
    languagesList?: LanguageToken[];
    passivesList?: SimpleValueToken[];
    damageVulnerabilitiesList?: SimpleValueToken[];
    damageResistancesList?: SimpleValueToken[];
    damageImmunitiesList?: SimpleValueToken[];
    conditionImmunitiesList?: SimpleValueToken[];
    gearList?: SimpleValueToken[];
    cr?: string;
    xp?: string;
    traits?: string;
    actions?: string;
    legendary?: string;
    entries?: Array<{
        category: 'trait'|'action'|'bonus'|'reaction'|'legendary';
        name: string;
        kind?: string;
        to_hit?: string;
        to_hit_from?: {
            ability: 'str'|'dex'|'con'|'int'|'wis'|'cha'|'best_of_str_dex';
            proficient?: boolean
        };
        range?: string;
        target?: string;
        save_ability?: string;
        save_dc?: number;
        save_effect?: string;
        damage?: string;
        damage_from?: {
            dice: string;
            ability?: 'str'|'dex'|'con'|'int'|'wis'|'cha'|'best_of_str_dex';
            bonus?: string
        };
        recharge?: string;
        text?: string;
    }>;
    actionsList?: Array<{
        name: string;
        kind?: string;
        to_hit?: string;
        range?: string;
        target?: string;
        save_ability?: string;
        save_dc?: number;
        save_effect?: string;
        damage?: string;
        recharge?: string;
        text?: string;
    }>;
    spellcasting?: SpellcastingData;
};
