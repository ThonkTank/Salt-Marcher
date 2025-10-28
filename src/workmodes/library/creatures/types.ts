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

// ============================================================================
// CREATURE ENTRY TYPES (Traits, Actions, Legendary Actions, etc.)
// ============================================================================

export type DamageInstance = {
    dice?: string;      // e.g. "2d8"
    bonus?: number;     // Flat bonus
    type: string;       // "Slashing", "Fire", "Lightning", etc.
    average?: number;   // Pre-calculated average (optional)
};

// ============================================================================
// TARGETING & AREA OF EFFECT
// ============================================================================

export type AoeShape = "line" | "cone" | "sphere" | "cube" | "cylinder" | "emanation";

export type AreaTarget = {
    shape: AoeShape;
    size: string;           // "90 ft.", "30 ft.", etc.
    width?: string;         // For line: "5 ft."
    origin?: "self" | "point" | "creature";
    description?: string;   // Full text for complex cases
};

export type SingleTarget = {
    type: "single";
    count?: number;         // Default 1, can be "up to 3", etc.
    range?: string;         // "30 ft.", "within 5 feet", etc.
    restrictions?: {
        size?: string[];            // ["Medium", "Small", "smaller"]
        conditions?: string[];       // ["Charmed", "Grappled", "Prone"]
        creatureTypes?: string[];    // ["Humanoid", "Giant"]
        visibility?: boolean;        // "can see"
        other?: string[];           // Any other restrictions
    };
};

export type SpecialTarget = {
    type: "special";
    description: string;    // "creature in swarm's space", "destination space", etc.
};

export type Targeting = AreaTarget | SingleTarget | SpecialTarget;

// ============================================================================
// DURATION & TIMING
// ============================================================================

export type DurationTiming =
    | { type: "instant" }
    | { type: "rounds"; count: number }
    | { type: "minutes"; count: number }
    | { type: "hours"; count: number }
    | { type: "until"; trigger: string }       // "until target takes damage", "until caster dies"
    | { type: "start-of-turn"; whose: "target" | "source" }
    | { type: "end-of-turn"; whose: "target" | "source" };

export type SaveToEnd = {
    timing: "start-of-turn" | "end-of-turn" | "when-damage" | "custom";
    dc?: number;            // If different from initial DC
    description?: string;   // Additional context
};

// ============================================================================
// CONDITIONS & EFFECTS
// ============================================================================

export type ConditionEffect = {
    condition: string;      // "Grappled", "Prone", "Charmed", "Frightened", etc.
    duration?: DurationTiming;
    escape?: {
        type: "dc" | "contest";
        dc?: number;        // Escape DC
        ability?: AbilityScoreKey;
    };
    restrictions?: {
        size?: string;      // "Large or smaller"
        while?: string;     // "While Grappled, also Restrained"
    };
    saveToEnd?: SaveToEnd;
    additionalText?: string;  // Complex behavior that can't be structured
};

export type MovementEffect = {
    type: "push" | "pull" | "teleport" | "compelled";
    distance?: string;      // "60 feet", "half speed"
    direction?: string;     // "straight away", "toward caster"
    description?: string;   // For complex movement
};

export type DamageOverTime = {
    damage: DamageInstance[];
    timing: DurationTiming;
    saveToEnd?: SaveToEnd;
};

export type MechanicalEffect = {
    type: "damage-modifier" | "penalty" | "advantage" | "disadvantage" | "other";
    target: string;         // What it affects: "AC", "attack rolls", "damage rolls", "Strength checks"
    modifier?: number | string;  // -1, -5, "half", etc.
    duration?: DurationTiming;
    description: string;
};

export type EffectBlock = {
    conditions?: ConditionEffect[];
    movement?: MovementEffect;
    damageOverTime?: DamageOverTime;
    mechanical?: MechanicalEffect[];
    knowledge?: string;     // Sprite's "knows emotions and alignment"
    other?: string;         // Fallback for complex effects
};

export type AttackData = {
    type: "melee" | "ranged";
    bonus: number;                  // Attack bonus (e.g. +12)
    reach?: string;                 // "10 ft." for melee
    range?: string;                 // "120 ft." or "30/120 ft." for ranged
    targeting?: Targeting;          // Structured targeting (NEW)
    target?: string;                // Legacy: "one target", "up to three targets", etc.
    damage: DamageInstance[];       // Primary + secondary damage
    onHit?: EffectBlock;            // Structured effects (NEW)
    additionalEffects?: string;     // Legacy: Any text-based effects
};

export type SavingThrowData = {
    ability: AbilityScoreKey;       // "str", "dex", "con", etc.
    dc: number;                     // Save DC
    targeting?: Targeting;          // Structured targeting (NEW)
    area?: string;                  // Legacy: "90-foot-long, 5-foot-wide Line"
    targets?: string;               // Legacy: "each creature in area", "one creature", etc.
    onFail?: {
        damage?: DamageInstance[];
        effects?: EffectBlock;      // Structured effects (NEW)
        legacyEffects?: string;     // Legacy: "target is grappled", etc.
    };
    onSuccess?: {
        damage?: "half" | "none";   // Structured (NEW)
        effects?: EffectBlock;      // Structured effects (NEW)
        legacyText?: string;        // Legacy: "Half damage", "no effect", etc.
    } | string;                     // Legacy: string format
};

export type LimitedUse = {
    count: number;              // Number of uses
    reset: "short-rest" | "long-rest" | "day" | "dawn" | "dusk";
    conditional?: {             // e.g. "4/Day in Lair"
        count: number;
        condition: string;
    };
};

export type MultiattackSubstitution = {
    replace: string;                // Which attack to replace
    with: {
        type: "attack" | "spellcasting" | "other";
        name?: string;              // Attack name
        spell?: string;             // Spell name (for spellcasting)
        text?: string;              // Full text (legacy/fallback)
    };
    count?: number;                 // How many can be replaced
};

export type MultiattackData = {
    attacks: Array<{
        name: string;               // Reference to another entry
        count: number;              // How many times
    }>;
    substitutions?: MultiattackSubstitution[];
};

export type SpellcastingEntryData = {
    ability: AbilityScoreKey;
    saveDC?: number;
    attackBonus?: number;
    excludeComponents?: Array<"V" | "S" | "M">;
    spellLists: Array<{
        frequency: "at-will" | "1/day" | "2/day" | "3/day" | string;
        spells: string[];       // Spell names
    }>;
};

// Base entry type with common fields
export type BaseEntry = {
    category: 'trait' | 'action' | 'bonus' | 'reaction' | 'legendary';
    name: string;
    text?: string;              // Always keep text for rendering/fallback
    recharge?: string;          // "5-6", "4-6", "6"
    limitedUse?: LimitedUse;
};

// Specific entry types
export type AttackEntry = BaseEntry & {
    entryType: "attack";
    attack: AttackData;
};

export type SaveEntry = BaseEntry & {
    entryType: "save";
    save: SavingThrowData;
};

export type MultiattackEntry = BaseEntry & {
    entryType: "multiattack";
    multiattack: MultiattackData;
};

export type SpellcastingEntry = BaseEntry & {
    entryType: "spellcasting";
    spellcasting: SpellcastingEntryData;
};

export type SpecialEntry = BaseEntry & {
    entryType: "special";
    // Just uses text field
};

// Legacy entry format (for backwards compatibility during migration)
export type LegacyEntry = BaseEntry & {
    entryType?: undefined;
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
};

// Union type for all entry types
export type CreatureEntry =
    | AttackEntry
    | SaveEntry
    | MultiattackEntry
    | SpellcastingEntry
    | SpecialEntry
    | LegacyEntry;

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
    entries?: CreatureEntry[];
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
