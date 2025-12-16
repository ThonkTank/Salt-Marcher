// src/workmodes/library/entities/items/types.ts
// Type definitions for magic item data structures

/**
 * Comprehensive item data structure covering all D&D 5e magic item mechanics
 */
export type ItemData = {
    // === Basic Information ===
    name: string;
    category?: string;          // Armor, Potion, Ring, Rod, Scroll, Staff, Wand, Weapon, Wondrous Item
    tags?: Array<{ value: string }>;  // Classification tags: Armor, Potion, Ring, Rod, Scroll, Staff, Wand, Weapon, Wondrous
    type?: string;              // e.g. "Armor (Plate)", "Weapon (Longsword)", "Any Medium Armor"
    rarity?: string;            // Common, Uncommon, Rare, Very Rare, Legendary, Artifact

    // === Attunement ===
    attunement?: boolean;
    attunement_req?: string;    // e.g. "by a Cleric", "by a Druid, Sorcerer, Warlock, or Wizard"

    // === Charges System ===
    max_charges?: number;       // e.g. 10
    recharge_formula?: string;  // e.g. "1d6 + 4", "1d3"
    recharge_time?: string;     // "Dawn", "Long Rest", etc.
    destruction_risk?: string;  // e.g. "On 1, turns to water and is destroyed"

    // === Spells ===
    spells?: Array<{
        name: string;
        charge_cost?: number;     // Cost in charges
        level?: number;           // Spell level
        save_dc?: number;         // Fixed DC (e.g. Gust of Wind DC 13)
        uses_caster_dc?: boolean; // Uses wearer's DC
    }>;

    // === Spell Storage (Ring of Spell Storing) ===
    spell_storage_capacity?: number;  // Max spell levels

    // === Bonuses ===
    bonuses?: Array<{
        type: string;             // "AC", "attack", "damage", "ability_score", "skill", "save"
        value: string | number;   // "+1", "+2", "21" (for ability scores)
        applies_to?: string;      // Optional: "Longbow and Shortbow", "Fire spells", etc.
    }>;

    // === Resistances & Immunities ===
    resistances?: string[];     // ["Fire", "Force"]
    immunities?: string[];      // ["damage from Magic Missile spell"]

    // === Ability Score Modifications ===
    ability_changes?: Array<{
        ability: string;          // "str", "con", "dex", "int", "wis", "cha"
        value: number;            // Score (e.g. 19, 21, 29)
        condition?: string;       // Optional: "while wearing", "maximum of 20"
    }>;

    // === Speed Modifications ===
    speed_changes?: Array<{
        type: string;             // "walk", "swim", "fly", "burrow", "climb"
        value: string;            // "30 feet", "40 feet"
        condition?: string;       // Optional conditions
    }>;

    // === Special Properties/Effects ===
    properties?: Array<{
        name: string;             // e.g. "Darkvision", "Alarm", "Cold Resistance"
        description: string;
        range?: string;           // e.g. "30 feet", "60 feet"
    }>;

    // === Usage Limits (non-charge based) ===
    usage_limit?: {
        amount: string;           // "10 minutes", "3 times", "once"
        reset: string;            // "Long Rest", "Dawn", "per day"
        cumulative_failure?: {    // Wind Fan style
            chance_per_use: number;
            on_failure: string;
        };
    };

    // === Curse ===
    cursed?: boolean;
    curse_description?: string;

    // === Variants (for +1/+2/+3 Items) ===
    has_variants?: boolean;
    variant_info?: string;      // Description of variants

    // === Tables (Bag of Tricks, Deck of Many Things) ===
    tables?: Array<{
        name: string;             // "Gray Bag of Tricks", "Deck of Many Things"
        description?: string;
        entries: Array<{
            roll: string;           // "1d8", "1-10", "01-15"
            result: string;
        }>;
    }>;

    // === Sentient Item Properties ===
    sentient?: boolean;
    sentient_props?: {
        intelligence?: number;
        wisdom?: number;
        charisma?: number;
        alignment?: string;
        languages?: string[];
        senses?: string;          // "Hearing and Darkvision 120 ft"
        communication?: string;   // "telepathy", "speaks Common and Elvish"
        purpose?: string;
    };

    // === Description & Notes ===
    description?: string;       // Main description
    notes?: string;             // Additional notes

    // === Weight & Value ===
    weight?: string;            // "5 pounds", "2 to 5 pounds"
    value?: string;             // "2,000 GP", "varies"
};
