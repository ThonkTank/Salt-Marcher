/**
 * Inventory Feature public API.
 *
 * Provides encumbrance calculation and inventory operations.
 *
 * @see docs/features/Inventory-System.md
 */

// Types
export type {
  EncumbranceLevel,
  EncumbranceState,
  InventoryError,
  InventoryErrorCode,
  InventoryFeaturePort,
} from './types';

// Constants
export {
  CARRY_CAPACITY_MULTIPLIER,
  ENCUMBRANCE_THRESHOLDS,
  ENCUMBRANCE_SPEED_REDUCTIONS,
  ENCUMBRANCE_ORDER,
} from './types';

// Service factory
export { createInventoryService } from './inventory-service';

// Utils (for direct use without service)
export {
  sumInventoryWeight,
  calculateCarryCapacity,
  determineEncumbranceLevel,
  getSpeedReduction,
  calculateEncumbrance,
  calculateEffectiveSpeed,
  worseEncumbrance,
  findWorstEncumbrance,
  countRationsInInventory,
  countPartyRations,
  findSlotIndex,
  hasItem,
  getItemQuantity,
} from './inventory-utils';
