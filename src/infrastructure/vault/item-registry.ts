/**
 * Item Registry - In-memory item definitions.
 *
 * Loads item definitions from presets and provides lookup.
 * Used by Inventory feature for weight/encumbrance calculation.
 */

import type { EntityId, Option } from '@core/index';
import { some, none } from '@core/index';
import type { Item } from '@core/schemas';

// ============================================================================
// Item Storage Port
// ============================================================================

/**
 * Storage port interface for item lookup.
 * Provides read-only access to item definitions.
 */
export interface ItemStoragePort {
  /** Get an item by ID */
  get(id: EntityId<'item'>): Option<Item>;

  /** Get all items */
  getAll(): readonly Item[];

  /** Lookup function for inventory calculations */
  lookup(id: EntityId<'item'>): Item | undefined;
}

// ============================================================================
// Item Registry
// ============================================================================

/**
 * Create an item registry from preset items.
 * All items (including currency) come from presets/items/base-items.json.
 */
export function createItemRegistry(items: Item[] = []): ItemStoragePort {
  // Build lookup map from preset items
  const itemMap = new Map<string, Item>();

  for (const item of items) {
    itemMap.set(String(item.id), item);
  }

  return {
    get(id: EntityId<'item'>): Option<Item> {
      const item = itemMap.get(String(id));
      return item ? some(item) : none();
    },

    getAll(): readonly Item[] {
      return Array.from(itemMap.values());
    },

    lookup(id: EntityId<'item'>): Item | undefined {
      return itemMap.get(String(id));
    },
  };
}
