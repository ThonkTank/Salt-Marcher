/**
 * Inventory utility functions.
 *
 * Pure functions for encumbrance calculation, weight sums, and ration counting.
 *
 * @see docs/features/Inventory-System.md
 */

import type { Character, Item, InventorySlot } from '@core/schemas';
import type { EntityId } from '@core/index';
import type { EncumbranceLevel, EncumbranceState } from './types';
import {
  CARRY_CAPACITY_MULTIPLIER,
  ENCUMBRANCE_THRESHOLDS,
  ENCUMBRANCE_SPEED_REDUCTIONS,
  ENCUMBRANCE_ORDER,
} from './types';

// ============================================================================
// Weight Calculations
// ============================================================================

/**
 * Calculate total weight of all items in an inventory.
 *
 * @param slots - Inventory slots to sum
 * @param itemLookup - Function to look up items by ID
 * @returns Total weight in pounds
 */
export function sumInventoryWeight(
  slots: readonly InventorySlot[],
  itemLookup: (id: EntityId<'item'>) => Item | undefined
): number {
  return slots.reduce((total, slot) => {
    const item = itemLookup(slot.itemId);
    if (!item) return total;
    return total + item.weight * slot.quantity;
  }, 0);
}

/**
 * Calculate carry capacity for a character.
 *
 * @param strength - Character's strength score (1-30)
 * @returns Carry capacity in pounds
 */
export function calculateCarryCapacity(strength: number): number {
  return strength * CARRY_CAPACITY_MULTIPLIER;
}

// ============================================================================
// Encumbrance Calculations
// ============================================================================

/**
 * Determine encumbrance level based on weight percentage.
 *
 * @param percentUsed - Percentage of carry capacity used (0-100+)
 * @returns Encumbrance level
 */
export function determineEncumbranceLevel(percentUsed: number): EncumbranceLevel {
  const ratio = percentUsed / 100;

  if (ratio <= ENCUMBRANCE_THRESHOLDS.LIGHT_MAX) {
    return 'light';
  }
  if (ratio <= ENCUMBRANCE_THRESHOLDS.ENCUMBERED_MAX) {
    return 'encumbered';
  }
  if (ratio <= ENCUMBRANCE_THRESHOLDS.HEAVILY_MAX) {
    return 'heavily';
  }
  return 'over_capacity';
}

/**
 * Get speed reduction percentage for an encumbrance level.
 *
 * @param level - Encumbrance level
 * @returns Speed reduction as percentage (0-1), where 0.5 = 50% reduction (half speed)
 */
export function getSpeedReduction(level: EncumbranceLevel): number {
  return ENCUMBRANCE_SPEED_REDUCTIONS[level];
}

/**
 * Calculate complete encumbrance state for a character.
 *
 * @param character - The character
 * @param itemLookup - Function to look up items by ID
 * @returns Complete encumbrance state
 */
export function calculateEncumbrance(
  character: Character,
  itemLookup: (id: EntityId<'item'>) => Item | undefined
): EncumbranceState {
  const totalWeight = sumInventoryWeight(character.inventory, itemLookup);
  const carryCapacity = calculateCarryCapacity(character.strength);
  const percentUsed = carryCapacity > 0 ? (totalWeight / carryCapacity) * 100 : 0;
  const level = determineEncumbranceLevel(percentUsed);
  const speedReduction = getSpeedReduction(level);

  return {
    totalWeight,
    carryCapacity,
    level,
    speedReduction,
    percentUsed,
  };
}

/**
 * Calculate effective speed after encumbrance.
 *
 * @param baseSpeed - Character's base speed in feet
 * @param encumbranceLevel - Current encumbrance level
 * @returns Effective speed (base × (1 - reduction%), minimum 25% of base)
 */
export function calculateEffectiveSpeed(
  baseSpeed: number,
  encumbranceLevel: EncumbranceLevel
): number {
  const reductionPercent = getSpeedReduction(encumbranceLevel);
  return Math.max(0, baseSpeed * (1 - reductionPercent));
}

/**
 * Compare two encumbrance levels.
 *
 * @param a - First level
 * @param b - Second level
 * @returns The worse (higher) level
 */
export function worseEncumbrance(
  a: EncumbranceLevel,
  b: EncumbranceLevel
): EncumbranceLevel {
  return ENCUMBRANCE_ORDER[a] > ENCUMBRANCE_ORDER[b] ? a : b;
}

/**
 * Find worst encumbrance across multiple characters.
 *
 * @param characters - Array of characters
 * @param itemLookup - Function to look up items by ID
 * @returns Worst encumbrance level and corresponding speed reduction
 */
export function findWorstEncumbrance(
  characters: readonly Character[],
  itemLookup: (id: EntityId<'item'>) => Item | undefined
): { worst: EncumbranceLevel; speedReduction: number } {
  if (characters.length === 0) {
    return { worst: 'light', speedReduction: 0 };
  }

  let worst: EncumbranceLevel = 'light';

  for (const character of characters) {
    const state = calculateEncumbrance(character, itemLookup);
    worst = worseEncumbrance(worst, state.level);
  }

  return {
    worst,
    speedReduction: getSpeedReduction(worst),
  };
}

// ============================================================================
// Ration Counting
// ============================================================================

/**
 * Count rations in an inventory.
 *
 * @param slots - Inventory slots to count
 * @param itemLookup - Function to look up items by ID
 * @returns Total number of rations
 */
export function countRationsInInventory(
  slots: readonly InventorySlot[],
  itemLookup: (id: EntityId<'item'>) => Item | undefined
): number {
  return slots.reduce((total, slot) => {
    const item = itemLookup(slot.itemId);
    if (!item || !item.isRation) return total;
    return total + slot.quantity;
  }, 0);
}

/**
 * Count total rations across all party members.
 *
 * @param characters - Party members
 * @param itemLookup - Function to look up items by ID
 * @returns Total rations in party
 */
export function countPartyRations(
  characters: readonly Character[],
  itemLookup: (id: EntityId<'item'>) => Item | undefined
): number {
  return characters.reduce(
    (total, character) => total + countRationsInInventory(character.inventory, itemLookup),
    0
  );
}

// ============================================================================
// Inventory Slot Helpers
// ============================================================================

/**
 * Find an inventory slot by item ID.
 *
 * @param slots - Inventory slots to search
 * @param itemId - Item ID to find
 * @returns Slot index or -1 if not found
 */
export function findSlotIndex(
  slots: readonly InventorySlot[],
  itemId: EntityId<'item'>
): number {
  return slots.findIndex((slot) => slot.itemId === itemId);
}

/**
 * Check if an item exists in inventory.
 *
 * @param slots - Inventory slots to search
 * @param itemId - Item ID to find
 * @returns True if item exists
 */
export function hasItem(
  slots: readonly InventorySlot[],
  itemId: EntityId<'item'>
): boolean {
  return findSlotIndex(slots, itemId) !== -1;
}

/**
 * Get quantity of an item in inventory.
 *
 * @param slots - Inventory slots to search
 * @param itemId - Item ID to find
 * @returns Quantity (0 if not found)
 */
export function getItemQuantity(
  slots: readonly InventorySlot[],
  itemId: EntityId<'item'>
): number {
  const slot = slots.find((s) => s.itemId === itemId);
  return slot?.quantity ?? 0;
}
