/**
 * Inventory Feature types and interfaces.
 *
 * @see docs/features/Inventory-System.md
 */

import type { Result, AppError, CharacterId, EntityId } from '@core/index';
import type { Character, Item } from '@core/schemas';

// ============================================================================
// Encumbrance Types
// ============================================================================

/**
 * D&D 5e Variant Rule encumbrance levels.
 * Each level applies a speed reduction.
 */
export type EncumbranceLevel = 'light' | 'encumbered' | 'heavily' | 'over_capacity';

/**
 * Complete encumbrance state for a character.
 */
export interface EncumbranceState {
  /** Total weight carried in pounds */
  totalWeight: number;

  /** Maximum carry capacity (strength × 15 lb) */
  carryCapacity: number;

  /** Current encumbrance level */
  level: EncumbranceLevel;

  /**
   * Speed reduction as percentage (0-0.75).
   * 0.25 = 75% speed, 0.5 = 50% speed, 0.75 = 25% speed (minimum).
   */
  speedReduction: number;

  /** Percentage of capacity used (0-100+) */
  percentUsed: number;
}

// ============================================================================
// Inventory Errors
// ============================================================================

/**
 * Inventory-specific error codes.
 */
export type InventoryErrorCode =
  | 'CHARACTER_NOT_FOUND'
  | 'ITEM_NOT_FOUND'
  | 'INSUFFICIENT_QUANTITY'
  | 'INVALID_QUANTITY'
  | 'SLOT_NOT_FOUND';

/**
 * Inventory-specific error type.
 */
export interface InventoryError extends AppError {
  code: InventoryErrorCode;
}

// ============================================================================
// Inventory Feature Port
// ============================================================================

/**
 * Public interface for the Inventory Feature.
 * Used by ViewModels and other Features (e.g., Party, Travel).
 */
export interface InventoryFeaturePort {
  // === Encumbrance Queries ===

  /**
   * Calculate encumbrance state for a character.
   * @param character - The character to calculate encumbrance for
   * @param itemLookup - Function to look up items by ID
   * @returns Encumbrance state including weight, capacity, level, and speed reduction
   */
  getEncumbrance(
    character: Character,
    itemLookup: (id: EntityId<'item'>) => Item | undefined
  ): EncumbranceState;

  /**
   * Get the worst encumbrance level across all party members.
   * Used to determine party travel speed reduction.
   * @param characters - Party members
   * @param itemLookup - Function to look up items by ID
   * @returns Worst encumbrance level and corresponding speed reduction
   */
  getPartyEncumbrance(
    characters: readonly Character[],
    itemLookup: (id: EntityId<'item'>) => Item | undefined
  ): { worst: EncumbranceLevel; speedReduction: number };

  /**
   * Calculate effective speed for a character after encumbrance.
   * @param character - The character
   * @param itemLookup - Function to look up items by ID
   * @returns Effective speed in feet (base speed - reduction, minimum 0)
   */
  getEffectiveSpeed(
    character: Character,
    itemLookup: (id: EntityId<'item'>) => Item | undefined
  ): number;

  // === Inventory Operations ===

  /**
   * Add an item to a character's inventory.
   * If the item is stackable and already exists, increases quantity.
   * @param character - The character to add the item to
   * @param itemId - The item ID to add
   * @param quantity - How many to add (default: 1)
   * @param itemLookup - Function to look up items by ID
   * @returns Updated character or error
   */
  addItem(
    character: Character,
    itemId: EntityId<'item'>,
    quantity: number,
    itemLookup: (id: EntityId<'item'>) => Item | undefined
  ): Result<Character, InventoryError>;

  /**
   * Remove an item from a character's inventory.
   * @param character - The character to remove the item from
   * @param itemId - The item ID to remove
   * @param quantity - How many to remove (default: 1)
   * @returns Updated character or error
   */
  removeItem(
    character: Character,
    itemId: EntityId<'item'>,
    quantity: number
  ): Result<Character, InventoryError>;

  /**
   * Transfer an item between two characters.
   * @param from - Source character
   * @param to - Target character
   * @param itemId - The item ID to transfer
   * @param quantity - How many to transfer
   * @param itemLookup - Function to look up items by ID
   * @returns Updated characters [from, to] or error
   */
  transferItem(
    from: Character,
    to: Character,
    itemId: EntityId<'item'>,
    quantity: number,
    itemLookup: (id: EntityId<'item'>) => Item | undefined
  ): Result<[Character, Character], InventoryError>;

  // === Ration Queries ===

  /**
   * Count total rations in a character's inventory.
   * @param character - The character
   * @param itemLookup - Function to look up items by ID
   * @returns Total number of rations
   */
  countRations(
    character: Character,
    itemLookup: (id: EntityId<'item'>) => Item | undefined
  ): number;

  /**
   * Count total rations across all party members.
   * @param characters - Party members
   * @param itemLookup - Function to look up items by ID
   * @returns Total number of rations in party
   */
  countPartyRations(
    characters: readonly Character[],
    itemLookup: (id: EntityId<'item'>) => Item | undefined
  ): number;

  // === Gold Convenience ===

  /**
   * Add gold to a character's inventory.
   * Convenience wrapper that adds gold-piece items.
   * @param character - The character to add gold to
   * @param amount - Amount of gold pieces to add
   * @param itemLookup - Function to look up items by ID
   * @returns Updated character or error
   */
  addGold(
    character: Character,
    amount: number,
    itemLookup: (id: EntityId<'item'>) => Item | undefined
  ): Result<Character, InventoryError>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * D&D 5e carrying capacity multiplier.
 * Carry capacity = STR × 15 lb
 */
export const CARRY_CAPACITY_MULTIPLIER = 15;

/**
 * Encumbrance thresholds as percentages of carry capacity.
 */
export const ENCUMBRANCE_THRESHOLDS = {
  /** Light: 0-33% capacity */
  LIGHT_MAX: 0.33,
  /** Encumbered: 34-66% capacity */
  ENCUMBERED_MAX: 0.66,
  /** Heavily Encumbered: 67-100% capacity */
  HEAVILY_MAX: 1.0,
  // Over Capacity: > 100%
} as const;

/**
 * Speed reduction percentages for each encumbrance level.
 * Values are 0-1 where 0.25 means 25% slower (75% of base speed).
 * Maximum reduction is 75% (quarter speed) at 'over_capacity'.
 */
export const ENCUMBRANCE_SPEED_REDUCTIONS: Record<EncumbranceLevel, number> = {
  light: 0,         // 100% speed
  encumbered: 0.25, // 75% speed
  heavily: 0.5,     // 50% speed
  over_capacity: 0.75, // 25% speed (minimum)
} as const;

/**
 * Order of encumbrance levels for comparison.
 */
export const ENCUMBRANCE_ORDER: Record<EncumbranceLevel, number> = {
  light: 0,
  encumbered: 1,
  heavily: 2,
  over_capacity: 3,
} as const;
