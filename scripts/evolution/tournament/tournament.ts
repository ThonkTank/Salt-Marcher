// Ziel: Tournament-System für NEAT Evolution
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Orchestriert Kämpfe zwischen NEAT-Genomes und berechnet Fitness.
// Unterstützt Self-Play (Genomes gegeneinander) und Baseline-Training.

// ============================================================================
// INFRASTRUCTURE SETUP (vor allen anderen Imports!)
// ============================================================================

import { PresetVaultAdapter } from '../../../src/infrastructure/vault/PresetVaultAdapter';
import { setVault } from '../../../src/infrastructure/vault/vaultInstance';

// Presets importieren
import actionsPresets from '../../../presets/actions/index';
import creaturesPresets from '../../../presets/creatures/index';
import factionsPresets from '../../../presets/factions/index';
import npcsPresets from '../../../presets/npcs/index';
import charactersPresets from '../../../presets/characters/index';
import encounterPresets from '../../../presets/encounters/index';

// Vault initialisieren BEVOR andere Module geladen werden
const vaultAdapter = new PresetVaultAdapter();
vaultAdapter.register('action', actionsPresets);
vaultAdapter.register('creature', creaturesPresets);
vaultAdapter.register('faction', factionsPresets);
vaultAdapter.register('npc', npcsPresets);
vaultAdapter.register('character', charactersPresets);
vaultAdapter.register('encounter', encounterPresets);
setVault(vaultAdapter);

// ============================================================================
// IMPORTS (nach Vault-Initialisierung)
// ============================================================================

import type { NEATGenome } from '../../../src/services/combatantAI/evolution';
import type { ActionSelector } from '../../../src/services/combatantAI/selectors/types';
import { createEvolvedSelector } from '../../../src/services/combatantAI/selectors/evolvedSelector';
import {
  getSelector,
  registerCoreModifiers,
} from '../../../src/services/combatantAI';

import type { EncounterPreset, AuthoredPreset } from '../../../src/types/entities/encounterPreset';
import {
  tournamentPresets,
  getTournamentPresetById,
} from '../../../presets/encounters';
import type { FightResult } from './fight';
import { runFight } from './fight';

// Quick-Szenarien für schnelle Evaluation (Subset der Tournament-Presets)
const QUICK_PRESETS = tournamentPresets.filter(p =>
  p.name === '1v1 Melee' || p.name === 'Aura-Cluster'
);
import {
  calculateFitnessFromResults,
  aggregateResults,
  DEFAULT_FITNESS_WEIGHTS,
  type FitnessWeights,
} from './fitness';

// Register core D&D 5e modifiers
registerCoreModifiers();

// ============================================================================
// TYPES
// ============================================================================

/**
 * Opponent specification: Either a genome or a named baseline selector.
 */
export type OpponentSpec = NEATGenome | 'greedy' | 'random';

/**
 * Konfiguration für ein Tournament.
 */
export interface TournamentConfig {
  /** Szenarien für Kämpfe (default: alle tournamentPresets) */
  scenarios: AuthoredPreset[];
  /** Anzahl Kämpfe pro Genome (default: 5) */
  fightsPerGenome: number;
  /** Maximale Runden pro Kampf (default: 50) */
  maxRounds: number;
  /** Anteil Self-Play vs Baselines: 0.5 = 50% Self-Play (default: 0.5) */
  selfPlayRatio: number;
  /** Baseline-Selektoren zum Testen (default: ['greedy', 'random']) */
  baselineNames: string[];
  /** Fitness-Gewichtungen (default: DEFAULT_FITNESS_WEIGHTS) */
  fitnessWeights: FitnessWeights;
  /** Debug-Output (default: false) */
  verbose: boolean;
}

/**
 * Standard-Tournament-Konfiguration.
 */
export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  scenarios: tournamentPresets,
  fightsPerGenome: 5,
  maxRounds: 50,
  selfPlayRatio: 0.5,
  baselineNames: ['greedy', 'random'],
  fitnessWeights: DEFAULT_FITNESS_WEIGHTS,
  verbose: false,
};

/**
 * Evaluation-Ergebnis für ein einzelnes Genome.
 */
export interface GenomeEvaluation {
  /** Genome-ID */
  genomeId: string;
  /** Berechnete Fitness */
  fitness: number;
  /** Anzahl Siege */
  wins: number;
  /** Anzahl Niederlagen */
  losses: number;
  /** Anzahl Unentschieden */
  draws: number;
  /** Durchschnittliche Rundenzahl */
  avgRounds: number;
  /** Gesamtschaden zugefügt */
  totalDamageDealt: number;
  /** Gesamtschaden erhalten */
  totalDamageReceived: number;
  /** Durchschnittliche Überlebende */
  avgSurvivors: number;
  /** Anzahl durchgeführter Kämpfe */
  totalFights: number;
  /** Zeit für Evaluation in ms */
  evalTimeMs: number;

  // === Erweiterte Statistiken ===

  /** Anzahl Treffer */
  totalHits: number;
  /** Anzahl Fehlschläge */
  totalMisses: number;
  /** Trefferquote (0-1) */
  hitRate: number;
  /** Anzahl Kills */
  totalKills: number;
  /** Anzahl Deaths */
  totalDeaths: number;
  /** Durchschnittlicher HP-Verlust (0-1) */
  avgHPLostPercent: number;
  /** Durchschnittlicher Enemy HP-Verlust (0-1) */
  avgEnemyHPLostPercent: number;
}

/**
 * Ergebnis eines vollständigen Tournaments.
 */
export interface TournamentResult {
  /** Evaluations für alle Genomes, sortiert nach Fitness */
  evaluations: GenomeEvaluation[];
  /** Gesamtzeit in ms */
  totalTimeMs: number;
  /** Anzahl durchgeführter Kämpfe */
  totalFights: number;
  /** Konfiguration die verwendet wurde */
  config: TournamentConfig;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Erstellt einen ActionSelector aus einer OpponentSpec.
 */
function getOpponentSelector(spec: OpponentSpec): ActionSelector {
  if (typeof spec === 'string') {
    const selector = getSelector(spec);
    if (!selector) throw new Error(`Baseline selector not found: ${spec}`);
    return selector;
  }
  // NEATGenome → Evolved Selector
  return createEvolvedSelector(spec, spec.id);
}

/**
 * Wählt Opponents für ein Genome.
 * Picks fightsPerGenome random opponents (self-play or baseline based on selfPlayRatio).
 */
function selectOpponents(
  genome: NEATGenome,
  population: NEATGenome[],
  config: TournamentConfig
): OpponentSpec[] {
  const opponents: OpponentSpec[] = [];
  const otherGenomes = population.filter(g => g.id !== genome.id);

  for (let i = 0; i < config.fightsPerGenome; i++) {
    // Self-Play vs Baseline based on selfPlayRatio
    if (Math.random() < config.selfPlayRatio && otherGenomes.length > 0) {
      // Random self-play opponent
      const idx = Math.floor(Math.random() * otherGenomes.length);
      opponents.push(otherGenomes[idx]);
    } else {
      // Random baseline opponent
      const baselineIdx = Math.floor(Math.random() * config.baselineNames.length);
      opponents.push(config.baselineNames[baselineIdx] as 'greedy' | 'random');
    }
  }

  return opponents;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Evaluiert ein einzelnes Genome gegen eine Liste von Opponents.
 *
 * @param genome - Zu evaluierendes Genome
 * @param opponents - Liste von Opponents (Genomes oder Baseline-Namen)
 * @param config - Tournament-Konfiguration
 * @returns GenomeEvaluation mit Fitness und Statistiken
 */
export function evaluateGenome(
  genome: NEATGenome,
  opponents: OpponentSpec[],
  config: Partial<TournamentConfig> = {}
): GenomeEvaluation {
  console.log('          [evaluateGenome] START genome:', genome.id);
  const fullConfig = { ...DEFAULT_TOURNAMENT_CONFIG, ...config };
  const startTime = performance.now();

  // Evolved Selector für dieses Genome erstellen
  console.log('          [evaluateGenome] Creating evolved selector...');
  const genomeSelector = createEvolvedSelector(genome, genome.id);
  console.log('          [evaluateGenome] Evolved selector created');

  // Alle Kampf-Ergebnisse sammeln
  const allResults: FightResult[] = [];
  const totalFights = opponents.length;

  console.log('          [evaluateGenome] Starting %d fights', totalFights);

  for (let fightIdx = 0; fightIdx < opponents.length; fightIdx++) {
    const opponent = opponents[fightIdx];
    const opponentSelector = getOpponentSelector(opponent);

    // Zufälliges Szenario für diesen Kampf
    const scenario = fullConfig.scenarios[
      Math.floor(Math.random() * fullConfig.scenarios.length)
    ];

    console.log('          [evaluateGenome] Fight %d/%d: %s vs %s in %s',
      fightIdx + 1, totalFights, genomeSelector.name.slice(0, 10),
      typeof opponent === 'string' ? opponent : 'genome', scenario.name);

    // 50% als Party, 50% als Enemy (für symmetrisches Training)
    const asParty = Math.random() < 0.5;

    const result = runFight(scenario, {
      maxRounds: fullConfig.maxRounds,
      partySelector: asParty ? genomeSelector : opponentSelector,
      enemySelector: asParty ? opponentSelector : genomeSelector,
      verbose: fullConfig.verbose,
    });

    // Ergebnis aus Genome-Perspektive anpassen
    const adjustedResult: FightResult = asParty
      ? result
      : {
          ...result,
          winner: result.winner === 'party' ? 'enemy'
                : result.winner === 'enemy' ? 'party'
                : 'draw',
          partyDamageDealt: result.partyDamageReceived,
          partyDamageReceived: result.partyDamageDealt,
          partySurvivors: result.enemySurvivors,
          enemySurvivors: result.partySurvivors,
          partyActions: result.enemyActions,
          enemyActions: result.partyActions,
          // Erweiterte Statistiken spiegeln
          partyHits: result.enemyHits,
          partyMisses: result.enemyMisses,
          enemyHits: result.partyHits,
          enemyMisses: result.partyMisses,
          partyKills: result.enemyKills,
          enemyKills: result.partyKills,
          partyStartHP: result.enemyStartHP,
          partyEndHP: result.enemyEndHP,
          enemyStartHP: result.partyStartHP,
          enemyEndHP: result.partyEndHP,
        };

    allResults.push(adjustedResult);
  }

  const stats = aggregateResults(allResults);
  const fitness = calculateFitnessFromResults(allResults, fullConfig.fitnessWeights);
  const evalTimeMs = performance.now() - startTime;

  return {
    genomeId: genome.id,
    fitness,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    avgRounds: stats.avgRounds,
    totalDamageDealt: stats.totalDamageDealt,
    totalDamageReceived: stats.totalDamageReceived,
    avgSurvivors: stats.avgSurvivors,
    totalFights: stats.totalFights,
    evalTimeMs,
    // Erweiterte Statistiken
    totalHits: stats.totalHits,
    totalMisses: stats.totalMisses,
    hitRate: stats.hitRate,
    totalKills: stats.totalKills,
    totalDeaths: stats.totalDeaths,
    avgHPLostPercent: stats.avgHPLostPercent,
    avgEnemyHPLostPercent: stats.avgEnemyHPLostPercent,
  };
}

/**
 * Führt ein vollständiges Tournament mit einer Population durch.
 *
 * @param population - Array von NEATGenomes
 * @param config - Tournament-Konfiguration (optional)
 * @returns TournamentResult mit Evaluations und Statistiken
 */
export function runTournament(
  population: NEATGenome[],
  config: Partial<TournamentConfig> = {}
): TournamentResult {
  const fullConfig = { ...DEFAULT_TOURNAMENT_CONFIG, ...config };
  const startTime = performance.now();

  if (fullConfig.verbose) {
    console.log('\n' + '='.repeat(60));
    console.log(' TOURNAMENT');
    console.log('='.repeat(60));
    console.log(`Population: ${population.length} genomes`);
    console.log(`Scenarios: ${fullConfig.scenarios.map(s => s.name).join(', ')}`);
    console.log(`Self-Play Ratio: ${fullConfig.selfPlayRatio * 100}%`);
    console.log('');
  }

  const evaluations: GenomeEvaluation[] = [];
  let totalFights = 0;

  for (let i = 0; i < population.length; i++) {
    const genome = population[i];
    const opponents = selectOpponents(genome, population, fullConfig);

    if (fullConfig.verbose) {
      process.stdout.write(`Evaluating ${genome.id} [${i + 1}/${population.length}]... `);
    }

    const evaluation = evaluateGenome(genome, opponents, fullConfig);
    evaluations.push(evaluation);
    totalFights += evaluation.totalFights;

    if (fullConfig.verbose) {
      console.log(
        `fitness=${evaluation.fitness.toFixed(1)} ` +
        `(W:${evaluation.wins} L:${evaluation.losses} D:${evaluation.draws}) ` +
        `${evaluation.evalTimeMs.toFixed(0)}ms`
      );
    }
  }

  // Nach Fitness sortieren (absteigend)
  evaluations.sort((a, b) => b.fitness - a.fitness);

  const totalTimeMs = performance.now() - startTime;

  if (fullConfig.verbose) {
    console.log('');
    console.log('='.repeat(60));
    console.log(' RESULTS');
    console.log('='.repeat(60));
    console.log(`Total fights: ${totalFights}`);
    console.log(`Total time: ${totalTimeMs.toFixed(0)}ms`);
    console.log('');
    console.log('Top 5 Genomes:');
    for (let i = 0; i < Math.min(5, evaluations.length); i++) {
      const e = evaluations[i];
      console.log(`  ${i + 1}. ${e.genomeId}: ${e.fitness.toFixed(1)} (${e.wins}W/${e.losses}L/${e.draws}D)`);
    }
    console.log('');
  }

  return {
    evaluations,
    totalTimeMs,
    totalFights,
    config: fullConfig,
  };
}

/**
 * Schnell-Evaluation: Testet ein Genome nur gegen Baselines.
 * Nützlich für schnelle Fitness-Checks während Evolution.
 */
export function quickEvaluate(
  genome: NEATGenome,
  baselineNames: string[] = ['greedy', 'random']
): GenomeEvaluation {
  return evaluateGenome(genome, baselineNames as OpponentSpec[], {
    scenarios: QUICK_PRESETS,
    fightsPerGenome: baselineNames.length,  // 1 fight per baseline
    selfPlayRatio: 0,  // Nur Baselines
    baselineNames,
  });
}

// ============================================================================
// PARALLEL TOURNAMENT (with Worker Pool)
// ============================================================================

import type { WorkerPool, EvalProgressCallback } from '../workers/pool';

/**
 * Führt ein Tournament mit Worker Pool für parallele Evaluation durch.
 *
 * @param population - Array von NEATGenomes
 * @param config - Tournament-Konfiguration
 * @param pool - Worker Pool für parallele Ausführung
 * @param onProgress - Optional callback for each completed evaluation
 * @returns TournamentResult mit Evaluations und Statistiken
 */
export async function runTournamentParallel(
  population: NEATGenome[],
  config: Partial<TournamentConfig> = {},
  pool: WorkerPool,
  onProgress?: EvalProgressCallback
): Promise<TournamentResult> {
  const fullConfig = { ...DEFAULT_TOURNAMENT_CONFIG, ...config };
  const startTime = performance.now();

  if (fullConfig.verbose) {
    console.log('\n' + '='.repeat(60));
    console.log(' TOURNAMENT (PARALLEL)');
    console.log('='.repeat(60));
    console.log(`Population: ${population.length} genomes`);
    console.log(`Workers: ${pool.workerCount}`);
    console.log(`Scenarios: ${fullConfig.scenarios.map(s => s.name).join(', ')}`);
    console.log(`Self-Play Ratio: ${fullConfig.selfPlayRatio * 100}%`);
    console.log('');
  }

  // Dispatch all genomes to worker pool
  console.log('      [Tournament] Calling pool.evaluateAll...');
  const evaluations = await pool.evaluateAll(population, population, fullConfig, onProgress);
  console.log('      [Tournament] pool.evaluateAll complete.');

  // Calculate total fights
  const totalFights = evaluations.reduce((sum, e) => sum + e.totalFights, 0);

  // Sort by fitness (descending)
  evaluations.sort((a, b) => b.fitness - a.fitness);

  const totalTimeMs = performance.now() - startTime;

  if (fullConfig.verbose) {
    console.log('');
    console.log('='.repeat(60));
    console.log(' RESULTS');
    console.log('='.repeat(60));
    console.log(`Total fights: ${totalFights}`);
    console.log(`Total time: ${totalTimeMs.toFixed(0)}ms`);
    console.log(`Avg time per genome: ${(totalTimeMs / population.length).toFixed(0)}ms`);
    console.log('');
    console.log('Top 5 Genomes:');
    for (let i = 0; i < Math.min(5, evaluations.length); i++) {
      const e = evaluations[i];
      console.log(`  ${i + 1}. ${e.genomeId}: ${e.fitness.toFixed(1)} (${e.wins}W/${e.losses}L/${e.draws}D)`);
    }
    console.log('');
  }

  return {
    evaluations,
    totalTimeMs,
    totalFights,
    config: fullConfig,
  };
}

// ============================================================================
// CLI ENTRY POINT (disabled when bundled)
// ============================================================================

// Guard: Only run CLI when executed directly as TypeScript (not bundled)
// esbuild bundles import.meta.url differently, so we check for tsx
const isDirectExecution = typeof process !== 'undefined' &&
  process.argv[1]?.endsWith('.ts') &&
  import.meta.url === `file://${process.argv[1]}`;

if (isDirectExecution) {
  import('../../../src/services/combatantAI/evolution').then(({
    createInnovationTracker,
    createMinimalGenome,
  }) => {
    const args = process.argv.slice(2);
    const populationSize = parseInt(args[0] ?? '5', 10);
    const fightsPerGenome = parseInt(args[1] ?? '5', 10);

    console.log('Creating test population...');

    // Test-Population erstellen
    const tracker = createInnovationTracker();
    const population: NEATGenome[] = [];

    for (let i = 0; i < populationSize; i++) {
      const genome = createMinimalGenome(86, 1, tracker);
      genome.id = `test-genome-${i}`;
      population.push(genome);
    }

    console.log(`Population: ${populationSize} minimal genomes`);
    console.log(`Fights per genome: ${fightsPerGenome}`);
    console.log('');

    // Tournament starten (verbose=false für schnellere Tests)
    const result = runTournament(population, {
      scenarios: QUICK_PRESETS,
      fightsPerGenome,
      verbose: false,
    });

    console.log('');
    console.log('Tournament completed!');
    console.log(`Total time: ${result.totalTimeMs.toFixed(0)}ms`);
    console.log(`Avg time per genome: ${(result.totalTimeMs / populationSize).toFixed(0)}ms`);
  });
}
