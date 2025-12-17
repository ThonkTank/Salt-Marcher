/**
 * Item Registry - In-memory item definitions.
 *
 * Loads item definitions from presets and provides lookup.
 * Used by Inventory feature for weight/encumbrance calculation.
 */

import type { EntityId, Option } from '@core/index';
import { some, none, toEntityId } from '@core/index';
import type { Item } from '@core/schemas';
import { COIN_WEIGHT } from '@core/schemas';

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
// Default Items (Currency)
// ============================================================================

/**
 * Built-in currency items.
 * Always available even without presets.
 */
const CURRENCY_ITEMS: Item[] = [
  {
    id: toEntityId<'item'>('copper-piece'),
    name: 'Copper Piece',
    weight: COIN_WEIGHT,
    category: 'currency',
    tags: ['currency', 'coin'],
    value: 0.01,
    stackable: true,
    description: 'A copper coin. 100 cp = 1 gp.',
  },
  {
    id: toEntityId<'item'>('silver-piece'),
    name: 'Silver Piece',
    weight: COIN_WEIGHT,
    category: 'currency',
    tags: ['currency', 'coin'],
    value: 0.1,
    stackable: true,
    description: 'A silver coin. 10 sp = 1 gp.',
  },
  {
    id: toEntityId<'item'>('gold-piece'),
    name: 'Gold Piece',
    weight: COIN_WEIGHT,
    category: 'currency',
    tags: ['currency', 'coin'],
    value: 1,
    stackable: true,
    description: 'A gold coin. Standard currency.',
  },
  {
    id: toEntityId<'item'>('platinum-piece'),
    name: 'Platinum Piece',
    weight: COIN_WEIGHT,
    category: 'currency',
    tags: ['currency', 'coin'],
    value: 10,
    stackable: true,
    description: 'A platinum coin. 1 pp = 10 gp.',
  },
];

// ============================================================================
// Item Registry
// ============================================================================

/**
 * Create an item registry.
 * Optionally accepts additional item definitions to merge with defaults.
 */
export function createItemRegistry(
  additionalItems: Item[] = []
): ItemStoragePort {
  // Build lookup map
  const itemMap = new Map<string, Item>();

  // Add default currency items
  for (const item of CURRENCY_ITEMS) {
    itemMap.set(String(item.id), item);
  }

  // Add additional items (can override defaults)
  for (const item of additionalItems) {
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
