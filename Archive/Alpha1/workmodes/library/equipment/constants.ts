// src/workmodes/library/entities/equipment/presets.ts
// Constants and types for equipment creation UI

import type { EquipmentType } from "./equipment-types";

// Equipment types
export const EQUIPMENT_TYPES: EquipmentType[] = ["weapon", "armor", "tool", "gear"];

// Weapon constants
export const WEAPON_CATEGORIES = ["Simple", "Martial"] as const;
export type WeaponCategory = (typeof WEAPON_CATEGORIES)[number];

export const WEAPON_TYPES = ["Melee", "Ranged"] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export const WEAPON_PROPERTIES = [
  "Finesse",
  "Light",
  "Heavy",
  "Reach",
  "Thrown",
  "Two-Handed",
  "Versatile",
  "Loading",
  "Ammunition",
] as const;
export type WeaponProperty = (typeof WEAPON_PROPERTIES)[number];

// Armor constants
export const ARMOR_CATEGORIES = ["Light", "Medium", "Heavy", "Shield"] as const;
export type ArmorCategory = (typeof ARMOR_CATEGORIES)[number];

// Tool constants
export const TOOL_CATEGORIES = ["Artisan", "Gaming", "Musical", "Other"] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const CRAFT_SUGGESTIONS = [
  "Acid",
  "Alchemist's Fire",
  "Oil",
  "Perfume",
  "Soap",
] as const;
export type CraftSuggestion = (typeof CRAFT_SUGGESTIONS)[number];

// Equipment tags (for classification and filtering)
// Based on docs/TAGS.md
export const EQUIPMENT_TAGS = [
  "Armor",
  "Weapon",
  "Tool",
  "Gear",
  "Mount",
  "Trade Goods",
] as const;
export type EquipmentTag = (typeof EQUIPMENT_TAGS)[number];
