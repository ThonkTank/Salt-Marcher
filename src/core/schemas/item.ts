/**
 * Item schema definitions.
 *
 * Items are the Single Source of Truth for all physical objects:
 * - Inventory (weight, encumbrance)
 * - Loot (tag-matching, value budget)
 * - Equipment (damage, armor class)
 * - Commerce (value in GP)
 *
 * @see docs/domain/Item.md
 */

import { z } from 'zod';
import { entityIdSchema } from './common';

// ============================================================================
// Item Category
// ============================================================================

/**
 * Item categories for filtering and behavior.
 */
export const itemCategorySchema = z.enum([
  'weapon', // Weapons of all types
  'armor', // Armor pieces
  'shield', // Shields (separate for AC calculation)
  'consumable', // Potions, scrolls, expendable items
  'gear', // Equipment, tools, adventuring supplies
  'treasure', // Gems, art, valuables
  'currency', // Coins (Gold, Silver, Copper, Platinum)
]);

export type ItemCategory = z.infer<typeof itemCategorySchema>;

// ============================================================================
// Rarity
// ============================================================================

/**
 * D&D 5e item rarity levels.
 */
export const raritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'very_rare',
  'legendary',
  'artifact',
]);

export type Rarity = z.infer<typeof raritySchema>;

// ============================================================================
// Item Schema
// ============================================================================

/**
 * Schema for Item entity.
 *
 * Used for:
 * - Loot generation (tags, value)
 * - Inventory management (weight)
 * - Equipment (damage, armorClass)
 * - Commerce (value)
 */
export const itemSchema = z.object({
  /** Unique item identifier */
  id: entityIdSchema('item'),

  /** Display name */
  name: z.string().min(1),

  // === Physical Properties ===

  /** Weight in pounds (lb) for encumbrance calculation */
  weight: z.number().nonnegative(),

  // === Categorization ===

  /** Item category */
  category: itemCategorySchema,

  /**
   * Tags for loot matching.
   * More matching tags = higher chance of appearing in loot.
   * Examples: "weapons", "tribal", "humanoid", "magic"
   */
  tags: z.array(z.string()).default([]),

  // === Value ===

  /** Value in GP for loot budgeting and commerce */
  value: z.number().nonnegative(),

  /** Optional rarity for magic items */
  rarity: raritySchema.optional(),

  // === Special Flags ===

  /** Is this item a ration (consumed during travel)? */
  isRation: z.boolean().optional(),

  /**
   * Can multiple instances stack in one inventory slot?
   * Default: true for consumable, gear, currency
   */
  stackable: z.boolean().optional(),

  // === Category-specific Properties ===

  /** Weapon damage (e.g., "1d8 slashing") */
  damage: z.string().optional(),

  /** Armor AC value or AC bonus */
  armorClass: z.number().int().optional(),

  /** D&D properties (e.g., "finesse", "versatile (1d10)", "heavy") */
  properties: z.array(z.string()).optional(),

  // === Metadata ===

  /** Optional description */
  description: z.string().optional(),
});

export type Item = z.infer<typeof itemSchema>;

// ============================================================================
// Inventory Slot Schema
// ============================================================================

/**
 * Schema for an inventory slot (item reference with quantity).
 * Used in Character.inventory array.
 */
export const inventorySlotSchema = z.object({
  /** Reference to item entity */
  itemId: entityIdSchema('item'),

  /** Quantity of items in this slot */
  quantity: z.number().int().positive(),

  /** Is this item currently equipped? (weapons, armor) */
  equipped: z.boolean().optional(),
});

export type InventorySlot = z.infer<typeof inventorySlotSchema>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Currency conversion rates (to GP).
 */
export const CURRENCY_RATES = {
  'copper-piece': 0.01,
  'silver-piece': 0.1,
  'gold-piece': 1,
  'platinum-piece': 10,
} as const;

/**
 * Standard coin weight (50 coins = 1 lb per D&D rules).
 */
export const COIN_WEIGHT = 0.02;

/**
 * Currency item IDs.
 */
export const CURRENCY_IDS = [
  'copper-piece',
  'silver-piece',
  'gold-piece',
  'platinum-piece',
] as const;

export type CurrencyId = (typeof CURRENCY_IDS)[number];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if an item is stackable based on category.
 * Currency, consumables, and gear are stackable by default.
 */
export function isStackable(item: Item): boolean {
  if (item.stackable !== undefined) {
    return item.stackable;
  }
  // Default stackability by category
  return ['currency', 'consumable', 'gear'].includes(item.category);
}

/**
 * Check if an item is a currency type.
 */
export function isCurrency(item: Item): boolean {
  return item.category === 'currency';
}

/**
 * Calculate total value of items in GP.
 */
export function calculateTotalValue(
  items: Array<{ item: Item; quantity: number }>
): number {
  return items.reduce((sum, { item, quantity }) => sum + item.value * quantity, 0);
}

/**
 * Calculate total weight of items in pounds.
 */
export function calculateTotalWeight(
  items: Array<{ item: Item; quantity: number }>
): number {
  return items.reduce(
    (sum, { item, quantity }) => sum + item.weight * quantity,
    0
  );
}
