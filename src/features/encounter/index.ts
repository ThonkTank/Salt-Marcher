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
  EncounterHistoryEntry,
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
  calculateTypeWeights,
  createDefaultTypeMatrix,
  normalizeMatrix,
  populateEncounter,
  generateEncounterId,
  createCreatureInstance,
  generateActivity,
  generateGoal,
  generateDescription,
  calculateCreatureXP,
  calculateEncounterXP,
  // Creature grouping for UI
  groupCreaturesByDefinitionId,
  type GroupedCreature,
  type TypeProbabilityMatrix,
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

// Template loader and registry
export {
  createEncounterTemplateRegistry,
  getDefaultTemplateRegistry,
  resetDefaultTemplateRegistry,
  type EncounterTemplateRegistry,
} from './template-loader';

// Template matching (Task #2963)
export {
  matchTemplate,
  matchFactionTemplates,
  type TemplateMatchResult,
  // Utilities for testing
  calculateTemplateWeights,
  selectWeightedTemplate,
  HIGH_CR_TEMPLATE_IDS,
  MID_CR_TEMPLATE_IDS,
  LOW_CR_TEMPLATE_IDS,
} from './template-matcher';
