/**
 * Loot Service implementation.
 *
 * Stateless service that generates tag-matched loot for encounters.
 * Follows the pattern from inventory-service.ts.
 *
 * @see docs/features/Loot-Feature.md
 */

import { ok, err } from '@core/types/result';
import type { Result } from '@core/types/result';
import type { Item, CreatureDefinition } from '@core/schemas';
import type {
  LootContext,
  GeneratedLoot,
  LootError,
  LootFeaturePort,
  SelectedItem,
} from './types';
import { GOLD_PIECE_ID } from './types';
import {
  calculateLootValue,
  scoreItems,
  filterAffordable,
  selectWeightedItem,
  mergeLootTags,
  findGoldItem,
  addToSelection,
} from './loot-utils';

// ============================================================================
// Loot Service Factory
// ============================================================================

/**
 * Create the Loot Service.
 *
 * Stateless service - generates loot based on provided context.
 * Does NOT maintain state or handle events directly.
 *
 * @returns LootFeaturePort implementation
 */
export function createLootService(): LootFeaturePort {
  return {
    calculateLootValue,
    mergeLootTags,
    generateLoot,
  };
}

// ============================================================================
// Loot Generation
// ============================================================================

/**
 * Generate loot for an encounter.
 *
 * Algorithm:
 * 1. Calculate target value from XP
 * 2. Score items by tag matching
 * 3. Select items using weighted random until budget exhausted
 * 4. Fill remainder with gold
 *
 * @param context - Loot generation context (XP, tags)
 * @param items - Available items to select from
 * @returns Generated loot or error
 */
function generateLoot(
  context: LootContext,
  items: readonly Item[]
): Result<GeneratedLoot, LootError> {
  const { totalXP, lootTags } = context;

  // Validate context
  if (totalXP < 0) {
    return err({
      code: 'INVALID_CONTEXT',
      message: 'Total XP cannot be negative',
    });
  }

  // Calculate target value
  const targetValue = calculateLootValue(totalXP);
  if (targetValue <= 0) {
    return ok({ items: [], totalValue: 0 });
  }

  // Find gold item for budget filling
  const goldItem = findGoldItem(items);

  // Score items by tag matching
  const scoredItems = scoreItems(items, lootTags);

  // If no matching items, return gold only (if available)
  if (scoredItems.length === 0) {
    if (!goldItem) {
      return err({
        code: 'NO_ITEMS_AVAILABLE',
        message: 'No matching items and no gold pieces available',
      });
    }
    return ok({
      items: [{ item: goldItem, quantity: Math.round(targetValue) }],
      totalValue: targetValue,
    });
  }

  // Select items until budget exhausted
  const selectedItems: SelectedItem[] = [];
  let currentValue = 0;

  // Limit iterations to prevent infinite loops
  const maxIterations = 100;
  let iterations = 0;

  while (currentValue < targetValue && iterations < maxIterations) {
    iterations++;

    const remainingBudget = targetValue - currentValue;
    const affordable = filterAffordable(scoredItems, remainingBudget);

    if (affordable.length === 0) {
      break;
    }

    const selected = selectWeightedItem(affordable);
    if (!selected) {
      break;
    }

    addToSelection(selectedItems, selected, 1);
    currentValue += selected.value;
  }

  // Fill remainder with gold
  const remaining = targetValue - currentValue;
  if (remaining > 0 && goldItem) {
    addToSelection(selectedItems, goldItem, Math.round(remaining));
    currentValue += remaining;
  }

  return ok({
    items: selectedItems,
    totalValue: Math.round(currentValue),
  });
}
