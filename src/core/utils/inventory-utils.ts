/**
 * Inventory Utility Functions
 *
 * Pure functions for inventory management:
 * - Add/remove items from character inventories
 * - Gold convenience functions
 * - Ration counting and consumption
 * - Weight calculation
 *
 * @see docs/architecture/Core.md#entity-spezifische-utils
 * @see docs/features/Inventory-System.md
 */

import type { Character, Item, InventorySlot } from '@core/schemas';
import { isStackable } from '@core/schemas';
import type { EntityId, AppError } from '@core/types/common';
import { err, ok, type Result } from '@core/types/result';

// ============================================================================
// Constants
// ============================================================================

/**
 * Gold piece item ID for currency functions.
 */
export const GOLD_PIECE_ID = 'gold-piece' as EntityId<'item'>;

// ============================================================================
// Error Types
// ============================================================================

export type InventoryErrorCode =
  | 'INSUFFICIENT_QUANTITY'
  | 'ITEM_NOT_FOUND'
  | 'INVALID_QUANTITY';

export interface InventoryError extends AppError {
  readonly code: InventoryErrorCode;
}

function inventoryError(code: InventoryErrorCode, message: string): InventoryError {
  return { code, message } as InventoryError;
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

// ============================================================================
// Add/Remove Item Functions
// ============================================================================

/**
 * Add an item to a character's inventory.
 * Returns a new Character with updated inventory.
 *
 * @param character - The character
 * @param itemId - Item ID to add
 * @param quantity - Number of items to add (default: 1)
 * @param itemLookup - Function to look up items (for stackable check)
 * @returns New Character with updated inventory
 */
export function addItemToCharacter(
  character: Character,
  itemId: EntityId<'item'>,
  quantity: number = 1,
  itemLookup?: (id: EntityId<'item'>) => Item | undefined
): Character {
  const inventory = [...character.inventory];
  const existingIndex = findSlotIndex(inventory, itemId);

  // Check if item is stackable
  const item = itemLookup?.(itemId);
  const canStack = !item || isStackable(item);

  if (existingIndex !== -1 && canStack) {
    // Stack with existing slot
    const existingSlot = inventory[existingIndex];
    inventory[existingIndex] = {
      ...existingSlot,
      quantity: existingSlot.quantity + quantity,
    };
  } else {
    // Add new slot
    inventory.push({
      itemId,
      quantity,
      equipped: false,
    });
  }

  return {
    ...character,
    inventory,
  };
}

/**
 * Remove an item from a character's inventory.
 * Returns a Result with the new Character or an error.
 *
 * @param character - The character
 * @param itemId - Item ID to remove
 * @param quantity - Number of items to remove (default: 1)
 * @returns Result with new Character or InventoryError
 */
export function removeItemFromCharacter(
  character: Character,
  itemId: EntityId<'item'>,
  quantity: number = 1
): Result<Character, InventoryError> {
  if (quantity <= 0) {
    return err(inventoryError('INVALID_QUANTITY', 'Quantity must be positive'));
  }

  const inventory = [...character.inventory];
  const existingIndex = findSlotIndex(inventory, itemId);

  if (existingIndex === -1) {
    return err(inventoryError('ITEM_NOT_FOUND', `Item ${itemId} not found in inventory`));
  }

  const existingSlot = inventory[existingIndex];

  if (existingSlot.quantity < quantity) {
    return err(
      inventoryError(
        'INSUFFICIENT_QUANTITY',
        `Not enough items: have ${existingSlot.quantity}, need ${quantity}`
      )
    );
  }

  if (existingSlot.quantity === quantity) {
    // Remove slot entirely
    inventory.splice(existingIndex, 1);
  } else {
    // Reduce quantity
    inventory[existingIndex] = {
      ...existingSlot,
      quantity: existingSlot.quantity - quantity,
    };
  }

  return ok({
    ...character,
    inventory,
  });
}

// ============================================================================
// Gold Convenience Functions
// ============================================================================

/**
 * Add gold to a character's inventory.
 * Convenience wrapper for addItemToCharacter with gold-piece.
 *
 * @param character - The character
 * @param amount - Amount of gold to add
 * @returns New Character with updated inventory
 */
export function addGoldToCharacter(
  character: Character,
  amount: number
): Character {
  if (amount <= 0) return character;
  return addItemToCharacter(character, GOLD_PIECE_ID, amount);
}

/**
 * Remove gold from a character's inventory.
 * Convenience wrapper for removeItemFromCharacter with gold-piece.
 *
 * @param character - The character
 * @param amount - Amount of gold to remove
 * @returns Result with new Character or InventoryError
 */
export function removeGoldFromCharacter(
  character: Character,
  amount: number
): Result<Character, InventoryError> {
  if (amount <= 0) {
    return err(inventoryError('INVALID_QUANTITY', 'Amount must be positive'));
  }
  return removeItemFromCharacter(character, GOLD_PIECE_ID, amount);
}

// ============================================================================
// Transfer Functions
// ============================================================================

/**
 * Transfer an item from one character to another.
 * Returns a Result with both updated Characters.
 *
 * @param from - Source character
 * @param to - Target character
 * @param itemId - Item ID to transfer
 * @param quantity - Number of items to transfer (default: 1)
 * @param itemLookup - Function to look up items (for stackable check)
 * @returns Result with [fromCharacter, toCharacter] or InventoryError
 */
export function transferItem(
  from: Character,
  to: Character,
  itemId: EntityId<'item'>,
  quantity: number = 1,
  itemLookup?: (id: EntityId<'item'>) => Item | undefined
): Result<[Character, Character], InventoryError> {
  // Remove from source
  const removeResult = removeItemFromCharacter(from, itemId, quantity);
  if (!removeResult.ok) {
    return removeResult;
  }

  // Add to target
  const updatedFrom = removeResult.value;
  const updatedTo = addItemToCharacter(to, itemId, quantity, itemLookup);

  return ok([updatedFrom, updatedTo]);
}

// ============================================================================
// Weight Calculation
// ============================================================================

/**
 * Calculate total weight of all items in an inventory.
 *
 * @param inventory - Inventory slots to sum
 * @param itemLookup - Function to look up items by ID
 * @returns Total weight in pounds
 */
export function sumInventoryWeight(
  inventory: readonly InventorySlot[],
  itemLookup: (id: EntityId<'item'>) => Item | undefined
): number {
  return inventory.reduce((total, slot) => {
    const item = itemLookup(slot.itemId);
    if (!item) return total;
    return total + item.weight * slot.quantity;
  }, 0);
}

// ============================================================================
// Ration Functions
// ============================================================================

/**
 * Count rations in an inventory.
 *
 * @param inventory - Inventory slots to count
 * @param itemLookup - Function to look up items by ID
 * @returns Total number of rations
 */
export function countRations(
  inventory: readonly InventorySlot[],
  itemLookup: (id: EntityId<'item'>) => Item | undefined
): number {
  return inventory.reduce((total, slot) => {
    const item = itemLookup(slot.itemId);
    if (!item || !item.isRation) return total;
    return total + slot.quantity;
  }, 0);
}

/**
 * Consume rations from a character's inventory.
 * Removes the specified number of rations, starting with the first found.
 *
 * @param character - The character
 * @param count - Number of rations to consume
 * @param itemLookup - Function to look up items by ID
 * @returns Result with new Character or InventoryError
 */
export function consumeRations(
  character: Character,
  count: number,
  itemLookup: (id: EntityId<'item'>) => Item | undefined
): Result<Character, InventoryError> {
  if (count <= 0) {
    return err(inventoryError('INVALID_QUANTITY', 'Count must be positive'));
  }

  // Find all ration slots
  const rationSlots = character.inventory
    .map((slot, index) => {
      const item = itemLookup(slot.itemId);
      return { slot, index, isRation: item?.isRation ?? false };
    })
    .filter((s) => s.isRation);

  // Check if we have enough rations
  const totalRations = rationSlots.reduce((sum, s) => sum + s.slot.quantity, 0);
  if (totalRations < count) {
    return err(
      inventoryError(
        'INSUFFICIENT_QUANTITY',
        `Not enough rations: have ${totalRations}, need ${count}`
      )
    );
  }

  // Consume rations from slots
  const inventory = [...character.inventory];
  let remaining = count;

  for (const { slot, index } of rationSlots) {
    if (remaining <= 0) break;

    if (slot.quantity <= remaining) {
      // Remove entire slot
      remaining -= slot.quantity;
      inventory[index] = { ...slot, quantity: 0 }; // Mark for removal
    } else {
      // Reduce quantity
      inventory[index] = { ...slot, quantity: slot.quantity - remaining };
      remaining = 0;
    }
  }

  // Filter out empty slots
  const filteredInventory = inventory.filter((slot) => slot.quantity > 0);

  return ok({
    ...character,
    inventory: filteredInventory,
  });
}
