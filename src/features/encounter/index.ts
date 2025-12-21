/**
 * Encounter Feature - Public API
 *
 * Exports the encounter generation and management functionality.
 *
 * @see docs/features/Encounter-System.md
 */

// Types
export type {
  EncounterFeaturePort,
  GenerationContext,
  InternalEncounterState,
  CreatureSelectionResult,
  TypeDerivationResult,
  VarietyValidationResult,
  NpcSelectionResult,
  FactionWeight,
  CreatureWeight,
} from './types';

// Store
export {
  createEncounterStore,
  type EncounterStore,
} from './encounter-store';

// Service
export {
  createEncounterService,
  type EncounterServiceDeps,
} from './encounter-service';

// Pipeline utilities (for testing/extension)
export {
  filterEligibleCreatures,
  selectWeightedCreature,
  calculateCreatureWeight,
  deriveEncounterType,
  validateVariety,
  populateEncounter,
  generateEncounterId,
  createCreatureInstance,
  generateActivity,
  generateGoal,
  generateDescription,
  calculateCreatureXP,
  calculateEncounterXP,
} from './encounter-utils';

// NPC generation utilities (for testing/extension)
export {
  resolveFactionCulture,
  generateNpcName,
  generatePersonality,
  rollQuirkFromCulture,
  generatePersonalGoal,
  selectOrGenerateNpc,
  generateNewNpc,
  createEncounterLeadNpc,
  calculateNpcMatchScore,
  calculateDaysBetween,
} from './npc-generator';

// Encounter chance utilities (for travel integration)
export {
  calculateEncounterChance,
  rollEncounter,
  getPopulationFactor,
  derivePopulation,
  BASE_ENCOUNTER_CHANCE_PER_HOUR,
  POPULATION_FACTORS,
  DEFAULT_POPULATION,
} from './encounter-chance';
