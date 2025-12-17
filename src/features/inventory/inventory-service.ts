/**
 * Inventory Feature service.
 *
 * Provides inventory operations: add/remove items, encumbrance calculation.
 * Pure functions that operate on Character objects.
 * Implements InventoryFeaturePort interface.
 *
 * @see docs/features/Inventory-System.md
 */

import type { Result, EntityId } from '@core/index';
import { ok, err } from '@core/index';
import type { Character, Item, InventorySlot } from '@core/schemas';
import { isStackable } from '@core/schemas';
import type {
  InventoryFeaturePort,
  InventoryError,
  EncumbranceState,
  EncumbranceLevel,
} from './types';
import {
  calculateEncumbrance,
  calculateEffectiveSpeed,
  findWorstEncumbrance,
  countRationsInInventory,
  countPartyRations,
  findSlotIndex,
} from './inventory-utils';

// ============================================================================
// Error Helpers
// ============================================================================

function createInventoryError(
  code: InventoryError['code'],
  message: string
): InventoryError {
  return { code, message };
}

// ============================================================================
// Inventory Service
// ============================================================================

/**
 * Create the inventory service (implements InventoryFeaturePort).
 *
 * This is a stateless service - it operates on Character objects
 * and returns updated copies. The actual persistence is handled
 * by the Party feature's character storage.
 */
export function createInventoryService(): InventoryFeaturePort {
  return {
    // =========================================================================
    // Encumbrance Queries
    // =========================================================================

    getEncumbrance(
      character: Character,
      itemLookup: (id: EntityId<'item'>) => Item | undefined
    ): EncumbranceState {
      return calculateEncumbrance(character, itemLookup);
    },

    getPartyEncumbrance(
      characters: readonly Character[],
      itemLookup: (id: EntityId<'item'>) => Item | undefined
    ): { worst: EncumbranceLevel; speedReduction: number } {
      return findWorstEncumbrance(characters, itemLookup);
    },

    getEffectiveSpeed(
      character: Character,
      itemLookup: (id: EntityId<'item'>) => Item | undefined
    ): number {
      const encumbrance = calculateEncumbrance(character, itemLookup);
      return calculateEffectiveSpeed(character.speed, encumbrance.level);
    },

    // =========================================================================
    // Inventory Operations
    // =========================================================================

    addItem(
      character: Character,
      itemId: EntityId<'item'>,
      quantity: number,
      itemLookup: (id: EntityId<'item'>) => Item | undefined
    ): Result<Character, InventoryError> {
      // Validate quantity
      if (quantity <= 0 || !Number.isInteger(quantity)) {
        return err(
          createInventoryError('INVALID_QUANTITY', `Invalid quantity: ${quantity}`)
        );
      }

      // Validate item exists
      const item = itemLookup(itemId);
      if (!item) {
        return err(
          createInventoryError('ITEM_NOT_FOUND', `Item not found: ${itemId}`)
        );
      }

      // Check if item already exists in inventory
      const existingIndex = findSlotIndex(character.inventory, itemId);

      let newInventory: InventorySlot[];

      if (existingIndex !== -1 && isStackable(item)) {
        // Item exists and is stackable - increase quantity
        newInventory = character.inventory.map((slot, index) => {
          if (index === existingIndex) {
            return {
              ...slot,
              quantity: slot.quantity + quantity,
            };
          }
          return slot;
        });
      } else if (existingIndex !== -1) {
        // Item exists but not stackable - add new slot
        newInventory = [
          ...character.inventory,
          { itemId, quantity, equipped: false },
        ];
      } else {
        // Item doesn't exist - add new slot
        newInventory = [
          ...character.inventory,
          { itemId, quantity, equipped: false },
        ];
      }

      return ok({
        ...character,
        inventory: newInventory,
      });
    },

    removeItem(
      character: Character,
      itemId: EntityId<'item'>,
      quantity: number
    ): Result<Character, InventoryError> {
      // Validate quantity
      if (quantity <= 0 || !Number.isInteger(quantity)) {
        return err(
          createInventoryError('INVALID_QUANTITY', `Invalid quantity: ${quantity}`)
        );
      }

      // Find the item slot
      const slotIndex = findSlotIndex(character.inventory, itemId);
      if (slotIndex === -1) {
        return err(
          createInventoryError('SLOT_NOT_FOUND', `Item not in inventory: ${itemId}`)
        );
      }

      const slot = character.inventory[slotIndex];

      // Check sufficient quantity
      if (slot.quantity < quantity) {
        return err(
          createInventoryError(
            'INSUFFICIENT_QUANTITY',
            `Not enough items: have ${slot.quantity}, need ${quantity}`
          )
        );
      }

      let newInventory: InventorySlot[];

      if (slot.quantity === quantity) {
        // Remove entire slot
        newInventory = character.inventory.filter((_, index) => index !== slotIndex);
      } else {
        // Decrease quantity
        newInventory = character.inventory.map((s, index) => {
          if (index === slotIndex) {
            return {
              ...s,
              quantity: s.quantity - quantity,
            };
          }
          return s;
        });
      }

      return ok({
        ...character,
        inventory: newInventory,
      });
    },

    transferItem(
      from: Character,
      to: Character,
      itemId: EntityId<'item'>,
      quantity: number,
      itemLookup: (id: EntityId<'item'>) => Item | undefined
    ): Result<[Character, Character], InventoryError> {
      // Remove from source
      const removeResult = this.removeItem(from, itemId, quantity);
      if (!removeResult.ok) {
        return err(removeResult.error);
      }

      // Add to target
      const addResult = this.addItem(to, itemId, quantity, itemLookup);
      if (!addResult.ok) {
        return err(addResult.error);
      }

      return ok([removeResult.value, addResult.value]);
    },

    // =========================================================================
    // Ration Queries
    // =========================================================================

    countRations(
      character: Character,
      itemLookup: (id: EntityId<'item'>) => Item | undefined
    ): number {
      return countRationsInInventory(character.inventory, itemLookup);
    },

    countPartyRations(
      characters: readonly Character[],
      itemLookup: (id: EntityId<'item'>) => Item | undefined
    ): number {
      return countPartyRations(characters, itemLookup);
    },
  };
}
