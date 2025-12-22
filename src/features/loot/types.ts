/**
 * Loot Feature types and interfaces.
 *
 * Loot generation uses tag-matching to select items based on creature
 * lootTags. More matching tags = higher selection probability.
 *
 * @see docs/features/Loot-Feature.md
 */

import type { Result, AppError, EntityId } from '@core/index';
import type { Item, CreatureDefinition } from '@core/schemas';

// ============================================================================
// Budget Tracking State
// ============================================================================

/**
 * State for background budget tracking.
 * Tracks accumulated gold budget from XP gains and distributed loot.
 *
 * The budget system ensures loot distribution follows DMG wealth guidelines.
 * Balance can go negative when creatures have expensive defaultLoot.
 *
 * @see docs/features/Loot-Feature.md#lootbudgetstate
 */
export interface LootBudgetState {
  /** Accumulated budget from XP gains (in GP) */
  accumulated: number;

  /** Already distributed loot value (in GP) */
  distributed: number;

  /** Current balance: accumulated - distributed (can be negative!) */
  balance: number;

  /** Debt from expensive defaultLoot exceeding budget */
  debt: number;
}

// ============================================================================
// Loot Context
// ============================================================================

/**
 * Context for loot generation.
 * Built from encounter data (XP, creatures).
 */
export interface LootContext {
  /** Total encounter XP for budget calculation */
  totalXP: number;

  /** Merged loot tags from all creatures in encounter */
  lootTags: readonly string[];
}

// ============================================================================
// Generated Loot Types
// ============================================================================

/**
 * A selected item with quantity.
 * Currency items (gold-piece, etc.) use quantity for the amount.
 */
export interface SelectedItem {
  /** The selected item */
  item: Item;

  /** Quantity of this item */
  quantity: number;
}

/**
 * Result of loot generation.
 * Contains selected items and their total value.
 */
export interface GeneratedLoot {
  /** Selected items (including currency) */
  items: readonly SelectedItem[];

  /** Total value in GP */
  totalValue: number;
}

/**
 * Scored item for weighted selection.
 * Score = number of matching tags (0 means excluded).
 */
export interface ScoredItem {
  /** The item */
  item: Item;

  /** Tag match score (count of matching tags) */
  score: number;
}

// ============================================================================
// Loot Errors
// ============================================================================

/**
 * Loot-specific error codes.
 */
export type LootErrorCode =
  | 'NO_ITEMS_AVAILABLE'
  | 'NO_MATCHING_TAGS'
  | 'INVALID_CONTEXT';

/**
 * Loot-specific error type.
 */
export interface LootError extends AppError {
  code: LootErrorCode;
}

// ============================================================================
// Loot Feature Port
// ============================================================================

/**
 * Public interface for the Loot Feature.
 * Stateless service - operates on provided context and items.
 */
export interface LootFeaturePort {
  /**
   * Generate loot for an encounter.
   * Uses tag-matching to select items that fit the XP-based budget.
   *
   * @param context - Loot generation context (XP, tags)
   * @param items - Available items to select from
   * @returns Generated loot or error
   */
  generateLoot(
    context: LootContext,
    items: readonly Item[]
  ): Result<GeneratedLoot, LootError>;

  /**
   * Calculate target loot value from XP.
   * Uses LOOT_MULTIPLIER (0.5 GP per XP).
   *
   * @param totalXP - Total encounter XP
   * @returns Target gold value for loot
   */
  calculateLootValue(totalXP: number): number;

  /**
   * Merge loot tags from multiple creatures.
   * Returns deduplicated array of all loot tags.
   *
   * @param creatures - Creature definitions with lootTags
   * @returns Merged, deduplicated tag array
   */
  mergeLootTags(creatures: readonly CreatureDefinition[]): string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Loot value multiplier (GP per XP).
 * From Loot-Feature.md: 0.5 GP per 1 XP.
 */
export const LOOT_MULTIPLIER = 0.5;

/**
 * Default gold piece item ID for budget filling.
 */
export const GOLD_PIECE_ID = 'gold-piece' as EntityId<'item'>;
