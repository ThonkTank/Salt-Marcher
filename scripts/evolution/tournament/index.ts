// Ziel: Public API für Tournament System
// Siehe: docs/services/combatantAI/algorithm-approaches.md

// ============================================================================
// PRESETS (from centralized presets/encounters/)
// ============================================================================

export type { EncounterPreset, AuthoredPreset } from '../../../src/types/entities/encounterPreset';
export {
  tournamentPresets,
  getTournamentPresetById,
  getTournamentPresetByName,
} from '../../../presets/encounters';

// ============================================================================
// FIGHT
// ============================================================================

export type { FightConfig, FightResult } from './fight';
export { runFight, runFights, aggregateFightResults } from './fight';

// ============================================================================
// FITNESS
// ============================================================================

export type { FightStatistics, FitnessWeights } from './fitness';
export {
  DEFAULT_FITNESS_WEIGHTS,
  aggregateResults,
  calculateFitness,
  calculateFitnessFromResults,
  normalizeFitness,
  rankFitness,
} from './fitness';

// ============================================================================
// TOURNAMENT
// ============================================================================

export type {
  OpponentSpec,
  TournamentConfig,
  GenomeEvaluation,
  TournamentResult,
} from './tournament';
export {
  DEFAULT_TOURNAMENT_CONFIG,
  evaluateGenome,
  runTournament,
  runTournamentParallel,
  quickEvaluate,
} from './tournament';
