// src/workmodes/library/entities/equipment/types.ts
// Type definitions for equipment data structures

/**
 * Equipment type categories
 */
export type EquipmentType = "weapon" | "armor" | "tool" | "gear";

/**
 * Comprehensive equipment data structure covering all D&D 5e standard equipment
 */
export type EquipmentData = {
    // === Basic Information ===
    name: string;
    type: EquipmentType;
    tags?: Array<{ value: string }>;  // Classification tags: Armor, Weapon, Tool, Gear, Mount, Trade Goods
    cost?: string;              // e.g. "15 GP", "2 SP"
    weight?: string;            // e.g. "3 lb.", "1/4 lb.", "—"
    description?: string;       // General description

    // === Weapon Properties ===
    weapon_category?: "Simple" | "Martial";
    weapon_type?: "Melee" | "Ranged";
    damage?: string;            // e.g. "1d8 Slashing", "2d6 Bludgeoning"
    properties?: string[];      // e.g. ["Finesse", "Light", "Thrown (Range 20/60)"]
    mastery?: string;           // e.g. "Sap", "Vex", "Nick"

    // === Armor Properties ===
    armor_category?: "Light" | "Medium" | "Heavy" | "Shield";
    ac?: string;                // e.g. "11 + Dex modifier", "18", "+2"
    strength_requirement?: string;  // e.g. "Str 13", "Str 15"
    stealth_disadvantage?: boolean;
    don_time?: string;          // e.g. "1 Minute", "5 Minutes"
    doff_time?: string;         // e.g. "1 Minute", "5 Minutes"

    // === Tool Properties ===
    tool_category?: "Artisan" | "Gaming" | "Musical" | "Other";
    ability?: string;           // e.g. "Intelligence", "Dexterity", "Wisdom"
    utilize?: string[];         // e.g. ["Identify a substance (DC 15)"]
    craft?: string[];           // e.g. ["Acid", "Alchemist's Fire", "Oil"]
    variants?: string[];        // e.g. ["Dice (1 SP)", "Playing cards (5 SP)"]

    // === Adventuring Gear Properties ===
    gear_category?: string;     // e.g. "Container", "Light Source", "Utility"
    special_use?: string;       // Special usage description (e.g., for Acid, Alchemist's Fire)
    capacity?: string;          // Container capacity
    duration?: string;          // Duration for consumables
};
