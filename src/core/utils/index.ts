/**
 * Core Utilities - Public API
 *
 * Shared pure functions for all layers.
 */

// Hex Math
export {
  type HexCoord,
  type Point,
  hex,
  hexEquals,
  hexAdd,
  hexSubtract,
  hexScale,
  hexDistance,
  hexNeighbors,
  hexNeighbor,
  hexAdjacent,
  hexesInRadius,
  hexRing,
  coordToKey,
  keyToCoord,
  axialToPixel,
  pixelToAxial,
  axialRound,
  hexCorners,
  hexWidth,
  hexHeight,
  hexHorizontalSpacing,
  hexVerticalSpacing,
} from './hex-math';

// Creature Utils
export {
  CR_XP_TABLE,
  FRACTIONAL_CR_VALUES,
  parseCR,
  isValidCRRange,
  calculateXP,
  calculateCreatureXP,
  getEncounterMultiplier,
  getGroupMultiplier,
  calculateEffectiveXP,
} from './creature-utils';

// Inventory Utils
export {
  GOLD_PIECE_ID,
  type InventoryErrorCode,
  type InventoryError,
  findSlotIndex,
  hasItem,
  getItemQuantity,
  addItemToCharacter,
  removeItemFromCharacter,
  addGoldToCharacter,
  removeGoldFromCharacter,
  transferItem,
  sumInventoryWeight,
  countRations,
  consumeRations,
} from './inventory-utils';

// Loot Utils
export {
  type SelectedItem,
  type MagicItemTracking,
  EMPTY_MAGIC_ITEM_TRACKING,
  distributeCurrencyEvenly,
  distributeToCharacter,
  quickAssign,
  trackMagicItemReceived,
  getMagicItemTracking,
  getTotalMagicItemsReceived,
} from './loot-utils';

// Time Math Utils
export {
  getTimeSegment,
  getTimeOfDay,
  addDuration,
  diffInHours,
  getCurrentSeason,
  getMoonPhase,
} from './time-math';

// Encounter Utils
export {
  // Types
  type CRComparison,
  type EncounterDifficulty,
  type CreatureSelectionResult,
  type TypeDerivationResult,
  type VarietyValidationResult,
  type CreatureWeight,
  type FactionWeight,
  type CompanionSelectionResult,

  // Step 1: Tile-Eligibility
  filterEligibleCreatures,

  // Step 2: Weighted Selection
  calculateCreatureWeight,
  selectWeightedCreature,

  // Step 3: Type Derivation
  compareCR,
  rollDifficulty,
  deriveEncounterType,

  // Step 4: Variety Validation
  validateVariety,

  // Helper Functions
  generateEncounterId,
  generateActivity,
  generateGoal,
  generateDescription,

  // XP Functions
  calculateXPBudget,
  calculateEncounterXP,
  selectCompanions,

  // Trigger & Slot Resolution
  checkTriggers,
  resolveCreatureSlots,
} from './encounter-utils';

// Party Utils
export {
  type HealthCategory,
  type HealthSummary,
  getHealthCategory,
  calculateHealthSummary,
  createEmptyHealthSummary,
} from './party-utils';
