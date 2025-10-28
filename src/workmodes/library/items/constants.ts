// src/workmodes/library/entities/items/presets.ts
// Constants and types for magic item creation UI

// Item categories
export const ITEM_CATEGORIES = [
  "Armor",
  "Potion",
  "Ring",
  "Rod",
  "Scroll",
  "Staff",
  "Wand",
  "Weapon",
  "Wondrous Item",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

// Item rarities
export const ITEM_RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Very Rare",
  "Legendary",
  "Artifact",
] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

// Recharge times
export const RECHARGE_TIMES = [
  "Dawn",
  "Dusk",
  "Long Rest",
  "Short Rest",
] as const;
export type RechargeTime = (typeof RECHARGE_TIMES)[number];

// Item tags (for classification and filtering)
// Based on docs/TAGS.md
export const ITEM_TAGS = [
  "Armor",
  "Potion",
  "Ring",
  "Rod",
  "Scroll",
  "Staff",
  "Wand",
  "Weapon",
  "Wondrous",
] as const;
export type ItemTag = (typeof ITEM_TAGS)[number];
