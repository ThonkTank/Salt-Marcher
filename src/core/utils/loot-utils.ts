/**
 * Loot Distribution Utility Functions
 *
 * Pure functions for distributing loot to characters:
 * - Currency distribution
 * - Item assignment
 * - Magic item tracking
 *
 * Note: These functions return new Character objects (immutable updates).
 *
 * @see docs/architecture/Core.md#entity-spezifische-utils
 * @see docs/features/Loot-Feature.md
 */

import type { Character, Item, Rarity } from '@core/schemas';
import type { EntityId } from '@core/types/common';
import { addItemToCharacter, addGoldToCharacter, GOLD_PIECE_ID } from './inventory-utils';

// ============================================================================
// Types
// ============================================================================

/**
 * A selected loot item with quantity.
 */
export interface SelectedItem {
  item: Item;
  quantity: number;
}

/**
 * Magic item tracking per character.
 * Tracks fractional items received (Party-Anteil system).
 */
export interface MagicItemTracking {
  common: number;
  uncommon: number;
  rare: number;
  very_rare: number;
  legendary: number;
  artifact: number;
}

/**
 * Default empty magic item tracking.
 */
export const EMPTY_MAGIC_ITEM_TRACKING: Readonly<MagicItemTracking> = {
  common: 0,
  uncommon: 0,
  rare: 0,
  very_rare: 0,
  legendary: 0,
  artifact: 0,
} as const;

// ============================================================================
// Currency Distribution
// ============================================================================

/**
 * Distribute currency evenly among characters.
 * Returns new Character objects with updated gold.
 *
 * Uses floor division, so 10 gold / 3 characters = 3 gold each (1 remainder).
 * Remainder is not distributed (stays in loot pool or is discarded).
 *
 * @param characters - Characters to receive gold
 * @param totalAmount - Total gold to distribute
 * @returns Array of updated Characters with added gold
 */
export function distributeCurrencyEvenly(
  characters: readonly Character[],
  totalAmount: number
): Character[] {
  if (characters.length === 0 || totalAmount <= 0) {
    return [...characters];
  }

  const amountPerCharacter = Math.floor(totalAmount / characters.length);

  if (amountPerCharacter <= 0) {
    return [...characters];
  }

  return characters.map((character) =>
    addGoldToCharacter(character, amountPerCharacter)
  );
}

// ============================================================================
// Item Distribution
// ============================================================================

/**
 * Distribute selected items to a character.
 * Returns a new Character with updated inventory.
 *
 * @param character - Character to receive items
 * @param items - Items with quantities to add
 * @param itemLookup - Function to look up items (for stackable check)
 * @returns Updated Character with items added
 */
export function distributeToCharacter(
  character: Character,
  items: readonly SelectedItem[],
  itemLookup?: (id: EntityId<'item'>) => Item | undefined
): Character {
  let updatedCharacter = character;

  for (const { item, quantity } of items) {
    updatedCharacter = addItemToCharacter(
      updatedCharacter,
      item.id,
      quantity,
      itemLookup
    );
  }

  return updatedCharacter;
}

/**
 * Quick-assign a single item to a character.
 * Convenience wrapper for addItemToCharacter.
 *
 * @param character - Character to receive item
 * @param itemId - Item ID to add
 * @param quantity - Number of items to add (default: 1)
 * @param itemLookup - Function to look up items (for stackable check)
 * @returns Updated Character with item added
 */
export function quickAssign(
  character: Character,
  itemId: EntityId<'item'>,
  quantity: number = 1,
  itemLookup?: (id: EntityId<'item'>) => Item | undefined
): Character {
  return addItemToCharacter(character, itemId, quantity, itemLookup);
}

// ============================================================================
// Magic Item Tracking
// ============================================================================

/**
 * Track magic item received by party (Party-Anteil system).
 *
 * When ONE character receives a magic item, ALL characters get
 * a fractional share tracked (1 / partySize).
 *
 * This prevents exploitation where a character "under quota" gets
 * items generated for them, but another character takes them.
 *
 * Note: This function requires characters to have a `magicItemsReceived`
 * field. If not present, a warning is logged and tracking is skipped.
 *
 * @param characters - All party characters
 * @param item - The magic item that was received
 * @returns Updated Characters with tracking incremented
 *
 * @example
 * // 4 characters, one takes a Potion of Healing (common)
 * // → All 4 get +0.25 to their "common" tracking
 */
export function trackMagicItemReceived(
  characters: readonly Character[],
  item: Item
): Character[] {
  // Only track items with rarity
  if (!item.rarity) {
    return [...characters];
  }

  const partySize = characters.length;
  if (partySize === 0) {
    return [];
  }

  const sharePerCharacter = 1 / partySize;
  const rarity = item.rarity as Rarity;

  return characters.map((character) => {
    // Check if character has magicItemsReceived tracking
    // This field is added in Task #743
    const existingTracking = (character as Character & {
      magicItemsReceived?: MagicItemTracking;
    }).magicItemsReceived;

    if (!existingTracking) {
      // Character schema doesn't have tracking yet (Task #743)
      // Return unchanged for now
      return character;
    }

    const updatedTracking: MagicItemTracking = {
      ...existingTracking,
      [rarity]: (existingTracking[rarity] ?? 0) + sharePerCharacter,
    };

    return {
      ...character,
      magicItemsReceived: updatedTracking,
    } as Character;
  });
}

/**
 * Get magic item tracking for a character.
 * Returns empty tracking if not present.
 *
 * @param character - Character to check
 * @returns MagicItemTracking (empty if not tracked)
 */
export function getMagicItemTracking(character: Character): MagicItemTracking {
  const tracking = (character as Character & {
    magicItemsReceived?: MagicItemTracking;
  }).magicItemsReceived;

  return tracking ?? { ...EMPTY_MAGIC_ITEM_TRACKING };
}

/**
 * Calculate total magic items received by a character.
 *
 * @param character - Character to check
 * @returns Total number of magic items (fractional)
 */
export function getTotalMagicItemsReceived(character: Character): number {
  const tracking = getMagicItemTracking(character);
  return (
    tracking.common +
    tracking.uncommon +
    tracking.rare +
    tracking.very_rare +
    tracking.legendary +
    tracking.artifact
  );
}
