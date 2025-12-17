/**
 * Loot utility functions.
 *
 * Pure functions for loot generation calculations.
 * Follows the pattern from inventory-utils.ts.
 *
 * @see docs/features/Loot-Feature.md
 */

import type { Item, CreatureDefinition } from '@core/schemas';
import type { SelectedItem, ScoredItem } from './types';
import { LOOT_MULTIPLIER, GOLD_PIECE_ID } from './types';

// ============================================================================
// Value Calculation
// ============================================================================

/**
 * Calculate target loot value from encounter XP.
 * Uses LOOT_MULTIPLIER (0.5 GP per XP) as per Loot-Feature.md.
 *
 * @param totalXP - Total encounter XP
 * @returns Target gold value for loot (rounded)
 */
export function calculateLootValue(totalXP: number): number {
  return Math.round(totalXP * LOOT_MULTIPLIER);
}

// ============================================================================
// Tag Matching
// ============================================================================

/**
 * Calculate tag match score between item tags and loot tags.
 * Score = number of matching tags.
 * A score of 0 means the item will be excluded from selection.
 *
 * @param itemTags - Tags on the item
 * @param lootTags - Tags from creatures (merged)
 * @returns Number of matching tags (0 = no match)
 */
export function calculateTagScore(
  itemTags: readonly string[],
  lootTags: readonly string[]
): number {
  return itemTags.filter((tag) => lootTags.includes(tag)).length;
}

/**
 * Score all items against loot tags.
 * Items with score 0 are filtered out (no matching tags).
 *
 * @param items - Available items
 * @param lootTags - Tags to match against
 * @returns Items with positive scores, sorted by score descending
 */
export function scoreItems(
  items: readonly Item[],
  lootTags: readonly string[]
): ScoredItem[] {
  return items
    .map((item) => ({
      item,
      score: calculateTagScore(item.tags, lootTags),
    }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Filter scored items to only those that fit within budget.
 *
 * @param scoredItems - Items with scores
 * @param maxValue - Maximum value allowed
 * @returns Filtered items that fit in budget
 */
export function filterAffordable(
  scoredItems: readonly ScoredItem[],
  maxValue: number
): ScoredItem[] {
  return scoredItems.filter((s) => s.item.value <= maxValue);
}

// ============================================================================
// Weighted Selection
// ============================================================================

/**
 * Select a random item using weighted selection.
 * Higher scores = higher probability of selection.
 *
 * Probability of selecting item i = score[i] / sum(all scores)
 *
 * @param scoredItems - Items with scores (pre-filtered to affordable ones)
 * @returns Selected item or null if none available
 */
export function selectWeightedItem(scoredItems: readonly ScoredItem[]): Item | null {
  if (scoredItems.length === 0) {
    return null;
  }

  const totalWeight = scoredItems.reduce((sum, s) => sum + s.score, 0);
  if (totalWeight === 0) {
    return null;
  }

  let random = Math.random() * totalWeight;

  for (const scored of scoredItems) {
    random -= scored.score;
    if (random <= 0) {
      return scored.item;
    }
  }

  // Fallback (should not reach here with valid input)
  return scoredItems[0].item;
}

// ============================================================================
// Tag Merging
// ============================================================================

/**
 * Merge loot tags from multiple creatures, removing duplicates.
 *
 * @param creatures - Creature definitions with lootTags
 * @returns Deduplicated array of all loot tags
 */
export function mergeLootTags(
  creatures: readonly CreatureDefinition[]
): string[] {
  const tagSet = new Set<string>();

  for (const creature of creatures) {
    const tags = creature.lootTags;
    if (tags) {
      for (const tag of tags) {
        tagSet.add(tag);
      }
    }
  }

  return Array.from(tagSet);
}

// ============================================================================
// Gold Filler
// ============================================================================

/**
 * Create a gold pieces item to fill remaining budget.
 *
 * @param remainingValue - Remaining budget value in GP
 * @param goldItem - The gold piece item definition
 * @returns SelectedItem with gold pieces
 */
export function createGoldFiller(
  remainingValue: number,
  goldItem: Item
): SelectedItem {
  return {
    item: goldItem,
    quantity: Math.round(remainingValue),
  };
}

/**
 * Find gold piece item from item pool.
 *
 * @param items - Available items
 * @returns Gold piece item or undefined
 */
export function findGoldItem(items: readonly Item[]): Item | undefined {
  return items.find((item) => item.id === GOLD_PIECE_ID);
}

// ============================================================================
// Item Stacking
// ============================================================================

/**
 * Add item to selected items array, stacking if same item exists.
 *
 * @param selectedItems - Current selected items (mutable)
 * @param item - Item to add
 * @param quantity - Quantity to add
 */
export function addToSelection(
  selectedItems: SelectedItem[],
  item: Item,
  quantity: number = 1
): void {
  const existing = selectedItems.find((si) => si.item.id === item.id);

  if (existing) {
    existing.quantity += quantity;
  } else {
    selectedItems.push({ item, quantity });
  }
}
