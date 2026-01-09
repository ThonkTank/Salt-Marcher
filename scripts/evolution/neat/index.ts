// Ziel: Public API für NEAT Evolution Operators
// Siehe: docs/services/combatantAI/algorithm-approaches.md

// ============================================================================
// MUTATIONS
// ============================================================================

export type { MutationRates } from './mutations';
export {
  DEFAULT_MUTATION_RATES,
  mutateWeights,
  addNode,
  addConnection,
  toggleConnection,
  mutate,
} from './mutations';

// ============================================================================
// CROSSOVER
// ============================================================================

export type { CompatibilityCoefficients } from './crossover';
export {
  DEFAULT_COMPATIBILITY_COEFFICIENTS,
  calculateCompatibility,
  crossover,
  crossoverByFitness,
} from './crossover';

// ============================================================================
// SPECIATION
// ============================================================================

export type { Species, SpeciationConfig } from './speciation';
export {
  DEFAULT_SPECIATION_CONFIG,
  resetSpeciesIdCounter,
  speciate,
  adjustFitness,
  adjustAllFitness,
  calculateOffspringCounts,
  pruneStaleSpecies,
  adjustThreshold,
  selectParent,
  getChampion,
  getAllChampions,
} from './speciation';
