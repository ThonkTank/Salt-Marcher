/**
 * Loot Feature public API.
 *
 * Provides tag-based loot generation for encounters.
 * Loot is generated at encounter creation time (not combat end),
 * allowing creatures to use their items during combat.
 *
 * @see docs/features/Loot-Feature.md
 */

// === Types ===
export type {
  LootContext,
  SelectedItem,
  GeneratedLoot,
  ScoredItem,
  LootError,
  LootErrorCode,
  LootFeaturePort,
} from './types';

// === Constants ===
export { LOOT_MULTIPLIER, GOLD_PIECE_ID } from './types';

// === Service Factory ===
export { createLootService } from './loot-service';

// === Utils (for direct use) ===
export {
  calculateLootValue,
  calculateTagScore,
  scoreItems,
  filterAffordable,
  selectWeightedItem,
  mergeLootTags,
  findGoldItem,
  createGoldFiller,
  addToSelection,
} from './loot-utils';
