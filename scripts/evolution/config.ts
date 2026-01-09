// Ziel: Konfiguration für NEAT Evolution Training
// Siehe: docs/services/combatantAI/algorithm-approaches.md

import * as os from 'os';

import {
  DEFAULT_MUTATION_RATES,
  DEFAULT_SPECIATION_CONFIG,
  type MutationRates,
  type SpeciationConfig,
} from './neat';
import { DEFAULT_TOURNAMENT_CONFIG, type TournamentConfig } from './tournament';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Vollständige Konfiguration für den NEAT Evolution Loop.
 */
export interface NEATConfig {
  // Population
  populationSize: number;
  generations: number;
  inputSize: number;
  outputSize: number;

  // NEAT-specific (von SpeciationConfig)
  speciation: SpeciationConfig;

  // Mutation rates (von MutationRates)
  mutation: MutationRates;

  // Tournament (von TournamentConfig)
  tournament: Partial<TournamentConfig>;

  // Reproduction
  elitismCount: number; // Anzahl Champions pro Species die überleben
  crossoverRate: number; // Wahrscheinlichkeit für Crossover vs Mutation-only

  // Parallelization (für Phase 7)
  workerCount: number;

  // Checkpointing
  checkpointInterval: number;
  checkpointDir: string;

  // Logging
  verbose: boolean;
  logFile: string | null;

  // Dashboard
  dashboard: boolean;
  dashboardPort: number;
  openBrowser: boolean;
}

/**
 * CLI-Argumente (Subset von NEATConfig für Kommandozeile).
 */
export interface CLIArgs {
  population?: number;
  generations?: number;
  resume?: string;
  config?: string;
  checkpoint?: number;
  workers?: number;
  verbose?: boolean;
  output?: string;
  watch?: boolean;
  dashboard?: boolean;
  port?: number;
  openBrowser?: boolean;
}

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Standard-Konfiguration für NEAT Evolution.
 */
export const DEFAULT_NEAT_CONFIG: NEATConfig = {
  // Population
  populationSize: 150,
  generations: 500,
  inputSize: 86, // FEATURE_DIMENSIONS.total
  outputSize: 1, // Single score output

  // NEAT-specific
  speciation: { ...DEFAULT_SPECIATION_CONFIG },

  // Mutation rates
  mutation: { ...DEFAULT_MUTATION_RATES },

  // Tournament
  tournament: {
    ...DEFAULT_TOURNAMENT_CONFIG,
    selfPlayRatio: 0.5,
    fightsPerGenome: 5,
  },

  // Reproduction
  elitismCount: 1, // 1 Champion pro Species überlebt
  crossoverRate: 0.75, // 75% Crossover, 25% Mutation-only

  // Parallelization
  workerCount: os.cpus().length,

  // Checkpointing
  checkpointInterval: 25,
  checkpointDir: 'evolution-checkpoints',

  // Logging
  verbose: true,
  logFile: 'evolution-log.csv',

  // Dashboard
  dashboard: true,
  dashboardPort: 3456,
  openBrowser: true,
};

/**
 * Schnelle Test-Konfiguration (weniger Population, weniger Generationen).
 */
export const QUICK_TEST_CONFIG: Partial<NEATConfig> = {
  populationSize: 20,
  generations: 10,
  checkpointInterval: 5,
  tournament: {
    ...DEFAULT_TOURNAMENT_CONFIG,
    fightsPerGenome: 3,
  },
};

// ============================================================================
// CONFIG LOADING
// ============================================================================

/**
 * Merged CLI-Argumente mit Default-Config.
 */
export function mergeConfig(
  args: CLIArgs,
  defaults: NEATConfig = DEFAULT_NEAT_CONFIG
): NEATConfig {
  const config = { ...defaults };

  if (args.population !== undefined) config.populationSize = args.population;
  if (args.generations !== undefined) config.generations = args.generations;
  if (args.workers !== undefined) config.workerCount = args.workers;
  if (args.checkpoint !== undefined) config.checkpointInterval = args.checkpoint;
  if (args.verbose !== undefined) config.verbose = args.verbose;
  if (args.output !== undefined) config.checkpointDir = args.output;
  if (args.dashboard !== undefined) config.dashboard = args.dashboard;
  if (args.port !== undefined) config.dashboardPort = args.port;
  if (args.openBrowser !== undefined) config.openBrowser = args.openBrowser;

  return config;
}

/**
 * Lädt Konfiguration aus JSON-Datei.
 */
export async function loadConfigFromFile(
  path: string
): Promise<Partial<NEATConfig>> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(path, 'utf-8');
  return JSON.parse(content) as Partial<NEATConfig>;
}

/**
 * Parsed CLI-Argumente.
 */
export function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--population':
      case '-p':
        args.population = parseInt(next, 10);
        i++;
        break;
      case '--generations':
      case '-g':
        args.generations = parseInt(next, 10);
        i++;
        break;
      case '--resume':
      case '-r':
        args.resume = next;
        i++;
        break;
      case '--config':
      case '-c':
        args.config = next;
        i++;
        break;
      case '--checkpoint':
        args.checkpoint = parseInt(next, 10);
        i++;
        break;
      case '--workers':
      case '-w':
        args.workers = parseInt(next, 10);
        i++;
        break;
      case '--verbose':
      case '-v':
        args.verbose = true;
        break;
      case '--output':
      case '-o':
        args.output = next;
        i++;
        break;
      case '--watch':
        args.watch = true;
        break;
      case '--dashboard':
        args.dashboard = true;
        break;
      case '--no-dashboard':
        args.dashboard = false;
        break;
      case '--port':
        args.port = parseInt(next, 10);
        i++;
        break;
      case '--no-browser':
        args.openBrowser = false;
        break;
    }
  }

  return args;
}

/**
 * Validiert Konfiguration.
 */
export function validateConfig(config: NEATConfig): string[] {
  const errors: string[] = [];

  if (config.populationSize < 2) {
    errors.push('populationSize must be at least 2');
  }
  if (config.generations < 1) {
    errors.push('generations must be at least 1');
  }
  if (config.workerCount < 1) {
    errors.push('workerCount must be at least 1');
  }
  if (config.checkpointInterval < 1) {
    errors.push('checkpointInterval must be at least 1');
  }
  if (config.elitismCount < 0) {
    errors.push('elitismCount cannot be negative');
  }
  if (config.crossoverRate < 0 || config.crossoverRate > 1) {
    errors.push('crossoverRate must be between 0 and 1');
  }

  return errors;
}
