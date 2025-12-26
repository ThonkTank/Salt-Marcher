/**
 * Pipeline Functions
 *
 * Re-exports all pipeline step implementations.
 */

export {
  createContext,
  isValidTimeSegment,
  isValidTrigger,
  getAvailableTimeSegments,
  getAvailableTriggers,
  type InitiationOptions,
  type InitiationResult,
} from './initiation.js';

export {
  populateEncounter,
  getEligibleCreatures,
  selectSeedCreature,
  selectTemplate,
  getCompanionPool,
  fillTemplateSlots,
  createEncounterDraft,
  type PopulationOptions,
  type PopulationResult,
} from './population.js';

export {
  flavourEncounter,
  type FlavourResult,
  type FlavourOptions,
} from './flavour.js';

export {
  calculateDifficulty,
  CR_TO_XP,
  XP_THRESHOLDS,
  getXPFromCR,
  getGroupMultiplier,
  type DifficultyCalcResult,
} from './difficulty.js';

export {
  rollTargetDifficulty,
  getTargetWinProbability,
  collectAdjustmentOptions,
  adjustForFeasibility,
  calculateAdjustments,
  type AdjustmentResult,
  type AdjustmentOptions,
} from './adjustments.js';
