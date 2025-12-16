/**
 * Encounter Feature - Public API
 *
 * Provides automatic combat encounter generation during travel.
 */

// Types
export type {
  EncounterFeaturePort,
  EncounterState,
  EncounterStateListener,
  EncounterConfig,
  EncounterStatus,
  GeneratedEncounter,
  EncounterCreatureGroup,
  EncounterCheckTriggeredPayload,
  EncounterGeneratedPayload,
  EncounterSkippedPayload,
  EncounterResolvedPayload,
} from './types';

export { DEFAULT_ENCOUNTER_CONFIG } from './types';

// Factory
export { createEncounterOrchestrator } from './orchestrator';

// Utilities (pure functions for testing and external use)
export {
  calculatePartyThresholds,
  getAveragePartyLevel,
  getXpForCR,
  crToString,
  getEncounterMultiplier,
  calculateAdjustedXP,
  determineDifficulty,
  filterCreaturesForEncounter,
  generateEncounter,
  rollEncounterCheck,
  type PartyThresholds,
  type FilterParams,
  type GenerateParams,
} from './encounter-utils';
