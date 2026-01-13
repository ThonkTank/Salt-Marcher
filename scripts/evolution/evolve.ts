// Ziel: Main NEAT Evolution Loop
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Orchestriert den vollständigen NEAT-Algorithmus:
// 1. Population initialisieren (minimal genomes)
// 2. Pro Generation: Tournament → Speciation → Reproduction
// 3. Checkpoints speichern
// 4. Champion exportieren

// ============================================================================
// INFRASTRUCTURE SETUP (vor allen anderen Imports!)
// ============================================================================

import { PresetVaultAdapter } from '../../src/infrastructure/vault/PresetVaultAdapter';
import { setVault } from '../../src/infrastructure/vault/vaultInstance';

// Presets importieren
import actionsPresets from '../../presets/actions/index';
import creaturesPresets from '../../presets/creatures/index';
import factionsPresets from '../../presets/factions/index';
import npcsPresets from '../../presets/npcs/index';
import charactersPresets from '../../presets/characters/index';

// Vault initialisieren BEVOR andere Module geladen werden
const vaultAdapter = new PresetVaultAdapter();
vaultAdapter.register('action', actionsPresets);
vaultAdapter.register('creature', creaturesPresets);
vaultAdapter.register('faction', factionsPresets);
vaultAdapter.register('npc', npcsPresets);
vaultAdapter.register('character', charactersPresets);
setVault(vaultAdapter);

// ============================================================================
// IMPORTS (nach Vault-Initialisierung)
// ============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';

import type { NEATGenome } from '../../src/services/combatantAI/evolution';
import {
  createInnovationTracker,
  createMinimalGenome,
  cloneGenome,
  serializeGenome,
  deserializeGenome,
  FEATURE_DIMENSIONS,
  type InnovationTracker,
} from '../../src/services/combatantAI/evolution';
import { registerCoreModifiers } from '../../src/services/combatantAI';

import {
  type Species,
  speciate,
  adjustAllFitness,
  calculateOffspringCounts,
  pruneStaleSpecies,
  adjustThreshold,
  selectParent,
  getChampion,
  getAllChampions,
  resetSpeciesIdCounter,
  mutate,
  crossover,
  crossoverByFitness,
} from './neat';

import {
  runTournament,
  runTournamentParallel,
  type TournamentResult,
  type GenomeEvaluation,
  QUICK_SCENARIOS,
} from './tournament';

import {
  createWorkerPool,
  createSequentialPool,
  hasCompiledWorker,
  type WorkerPool,
} from './workers';

// Re-export for reference
export { createSequentialPool };

import {
  type NEATConfig,
  type CLIArgs,
  DEFAULT_NEAT_CONFIG,
  QUICK_TEST_CONFIG,
  mergeConfig,
  parseArgs,
  validateConfig,
  loadConfigFromFile,
} from './config';

import {
  startDashboard,
  type DashboardServer,
  type EvalProgress,
} from './dashboard';

// Register core D&D 5e modifiers
registerCoreModifiers();

// ============================================================================
// TYPES
// ============================================================================

/**
 * Checkpoint-Daten für Speicherung/Wiederherstellung.
 */
interface Checkpoint {
  generation: number;
  population: NEATGenome[];
  species: Species[];
  innovationState: {
    nextInnovation: number;
    history: [number, number, number][];
  };
  bestFitness: number;
  bestGenomeId: string;
  config: NEATConfig;
}

/**
 * Combat-Statistiken eines einzelnen Genomes.
 */
interface GenomeCombatStats {
  hitRate: number;
  totalKills: number;
  totalDeaths: number;
  avgHPLostPercent: number;
  wins: number;
  losses: number;
  draws: number;
}

/**
 * Statistiken für eine Generation.
 */
interface GenerationStats {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  speciesCount: number;
  avgNodes: number;
  avgConnections: number;
  bestGenomeId: string;
  evalTimeMs: number;

  // === Combat-Statistiken des BESTEN Genomes ===
  bestGenomeStats: GenomeCombatStats;
}

// ============================================================================
// POPULATION INITIALIZATION
// ============================================================================

/**
 * Erstellt initiale Population mit minimalen Genomes.
 */
function initializePopulation(
  size: number,
  inputSize: number,
  outputSize: number,
  tracker: InnovationTracker
): NEATGenome[] {
  const population: NEATGenome[] = [];

  for (let i = 0; i < size; i++) {
    const genome = createMinimalGenome(inputSize, outputSize, tracker);
    // Leicht unterschiedliche Gewichte für Diversität
    for (const conn of genome.connections) {
      conn.weight += (Math.random() - 0.5) * 0.2;
    }
    population.push(genome);
  }

  return population;
}

// ============================================================================
// REPRODUCTION
// ============================================================================

/**
 * Erstellt Offspring für eine Species.
 */
function reproduceSpecies(
  species: Species,
  offspringCount: number,
  elitismCount: number,
  crossoverRate: number,
  tracker: InnovationTracker,
  config: NEATConfig
): NEATGenome[] {
  const offspring: NEATGenome[] = [];

  // Elitismus: Champion(s) überleben unverändert
  const elite = Math.min(elitismCount, species.members.length);
  const sorted = [...species.members].sort((a, b) => b.fitness - a.fitness);

  for (let i = 0; i < elite && offspring.length < offspringCount; i++) {
    offspring.push(cloneGenome(sorted[i]));
  }

  // Rest durch Crossover/Mutation
  while (offspring.length < offspringCount) {
    let child: NEATGenome;

    if (species.members.length === 1) {
      // Nur ein Member: Mutation-only
      child = mutate(cloneGenome(species.members[0]), tracker, config.mutation);
    } else if (Math.random() < crossoverRate) {
      // Crossover
      const parentA = selectParent(species);
      const parentB = selectParent(species);
      child = crossoverByFitness(parentA, parentB);
      child = mutate(child, tracker, config.mutation);
    } else {
      // Mutation-only (kein Crossover)
      const parent = selectParent(species);
      child = mutate(cloneGenome(parent), tracker, config.mutation);
    }

    offspring.push(child);
  }

  return offspring;
}

/**
 * Führt Reproduction für alle Species durch.
 */
function reproduce(
  speciesList: Species[],
  populationSize: number,
  tracker: InnovationTracker,
  config: NEATConfig
): NEATGenome[] {
  // Offspring-Counts berechnen
  const offspringCounts = calculateOffspringCounts(speciesList, populationSize);

  const nextGeneration: NEATGenome[] = [];

  for (const species of speciesList) {
    const count = offspringCounts.get(species.id) || 0;
    if (count === 0) continue;

    const offspring = reproduceSpecies(
      species,
      count,
      config.elitismCount,
      config.crossoverRate,
      tracker,
      config
    );
    nextGeneration.push(...offspring);
  }

  return nextGeneration;
}

// ============================================================================
// LOGGING & CHECKPOINTING
// ============================================================================

/**
 * Berechnet Statistiken für eine Generation.
 */
function calculateStats(
  generation: number,
  population: NEATGenome[],
  evaluations: GenomeEvaluation[],
  speciesCount: number,
  evalTimeMs: number
): GenerationStats {
  const fitnessValues = population.map(g => g.fitness);
  const bestFitness = Math.max(...fitnessValues);
  const avgFitness = fitnessValues.reduce((a, b) => a + b, 0) / population.length;

  const avgNodes = population.reduce((sum, g) => sum + g.nodes.length, 0) / population.length;
  const avgConnections = population.reduce((sum, g) => sum + g.connections.length, 0) / population.length;

  // Finde die Evaluation des besten Genomes
  const bestEval = evaluations.reduce((best, e) =>
    e.fitness > best.fitness ? e : best,
    evaluations[0]
  );
  const bestGenomeId = bestEval?.genomeId || population.find(g => g.fitness === bestFitness)?.id || 'unknown';

  // Combat-Statistiken des besten Genomes
  const bestGenomeStats: GenomeCombatStats = bestEval ? {
    hitRate: bestEval.hitRate,
    totalKills: bestEval.totalKills,
    totalDeaths: bestEval.totalDeaths,
    avgHPLostPercent: bestEval.avgHPLostPercent,
    wins: bestEval.wins,
    losses: bestEval.losses,
    draws: bestEval.draws,
  } : {
    hitRate: 0,
    totalKills: 0,
    totalDeaths: 0,
    avgHPLostPercent: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  };

  return {
    generation,
    bestFitness,
    avgFitness,
    speciesCount,
    avgNodes,
    avgConnections,
    bestGenomeId,
    evalTimeMs,
    bestGenomeStats,
  };
}

/**
 * Loggt Statistiken einer Generation.
 */
function logGeneration(stats: GenerationStats, verbose: boolean): void {
  const line = `Gen ${stats.generation.toString().padStart(4)}: ` +
    `best=${stats.bestFitness.toFixed(1).padStart(6)}, ` +
    `avg=${stats.avgFitness.toFixed(1).padStart(6)}, ` +
    `species=${stats.speciesCount.toString().padStart(2)}, ` +
    `nodes=${stats.avgNodes.toFixed(1).padStart(5)}, ` +
    `conns=${stats.avgConnections.toFixed(1).padStart(5)}, ` +
    `time=${(stats.evalTimeMs / 1000).toFixed(1)}s`;

  console.log(line);
}

/**
 * Speichert Checkpoint.
 */
async function saveCheckpoint(
  checkpoint: Checkpoint,
  dir: string
): Promise<string> {
  await fs.mkdir(dir, { recursive: true });

  const filename = `gen-${checkpoint.generation}.json`;
  const filepath = path.join(dir, filename);

  // Genomes serialisieren
  const serialized = {
    ...checkpoint,
    population: checkpoint.population.map(serializeGenome),
    species: checkpoint.species.map(s => ({
      ...s,
      members: s.members.map(m => m.id),
      representative: s.representative.id,
    })),
  };

  await fs.writeFile(filepath, JSON.stringify(serialized, null, 2));
  return filepath;
}

/**
 * Speichert Champion separat.
 */
async function saveChampion(
  genome: NEATGenome,
  dir: string
): Promise<string> {
  await fs.mkdir(dir, { recursive: true });

  const filepath = path.join(dir, 'champion.json');
  const serialized = serializeGenome(genome);

  await fs.writeFile(filepath, JSON.stringify(serialized, null, 2));
  return filepath;
}

/**
 * Lädt Checkpoint.
 */
async function loadCheckpoint(filepath: string): Promise<Checkpoint> {
  const content = await fs.readFile(filepath, 'utf-8');
  const data = JSON.parse(content);

  // Genomes deserialisieren
  const population = data.population.map(deserializeGenome);

  // Species rekonstruieren
  const genomeMap = new Map(population.map((g: NEATGenome) => [g.id, g]));
  const species: Species[] = data.species.map((s: { id: number; members: string[]; representative: string; staleness: number; bestFitness: number; adjustedFitness: number }) => ({
    id: s.id,
    members: s.members.map((id: string) => genomeMap.get(id)).filter(Boolean) as NEATGenome[],
    representative: genomeMap.get(s.representative) || population[0],
    staleness: s.staleness,
    bestFitness: s.bestFitness,
    adjustedFitness: s.adjustedFitness,
  }));

  return {
    ...data,
    population,
    species,
  };
}

/**
 * Schreibt Log-Eintrag in CSV.
 */
async function appendLog(
  stats: GenerationStats,
  logFile: string
): Promise<void> {
  const line = [
    stats.generation,
    stats.bestFitness.toFixed(2),
    stats.avgFitness.toFixed(2),
    stats.speciesCount,
    stats.avgNodes.toFixed(1),
    stats.avgConnections.toFixed(1),
    stats.evalTimeMs.toFixed(0),
    stats.bestGenomeId,
  ].join(',');

  // Header schreiben falls Datei nicht existiert
  try {
    await fs.access(logFile);
  } catch {
    const header = 'generation,bestFitness,avgFitness,speciesCount,avgNodes,avgConnections,evalTimeMs,bestGenomeId\n';
    await fs.writeFile(logFile, header);
  }

  await fs.appendFile(logFile, line + '\n');
}

// ============================================================================
// MAIN EVOLUTION LOOP
// ============================================================================

/**
 * Progress callback type for evaluation progress.
 */
type EvalProgressCallback = (progress: {
  current: number;
  total: number;
  genomeId: string;
  fitness: number;
  nodeCount: number;
  connectionCount: number;
  speciesId: number;
  // Combat-Stats des aktuellen Genomes (für "Last" Tab)
  hitRate: number;
  kills: number;
  deaths: number;
  hpLost: number;
  wins: number;
  losses: number;
  draws: number;
}) => void;

/**
 * Führt eine Generation des NEAT-Algorithmus aus.
 */
async function runGeneration(
  generation: number,
  population: NEATGenome[],
  speciesList: Species[],
  tracker: InnovationTracker,
  config: NEATConfig,
  pool: WorkerPool,
  onEvalProgress?: EvalProgressCallback
): Promise<{
  nextPopulation: NEATGenome[];
  nextSpecies: Species[];
  stats: GenerationStats;
  evaluations: GenomeEvaluation[];
}> {
  // 1. Tournament durchführen → Fitness berechnen
  const tournamentConfig = {
    ...config.tournament,
    scenarios: config.tournament.scenarios || QUICK_SCENARIOS,
    verbose: false,
  };

  const startTime = performance.now();

  console.log(`    [runGeneration] Starting tournament (workers: ${pool.workerCount})...`);

  // Always use parallel tournament with pool (pool can be sequential or parallel)
  const result: TournamentResult = await runTournamentParallel(population, tournamentConfig, pool, onEvalProgress);

  console.log(`    [runGeneration] Tournament complete.`);

  // Fitness auf Genomes übertragen
  for (const evaluation of result.evaluations) {
    const genome = population.find(g => g.id === evaluation.genomeId);
    if (genome) {
      genome.fitness = evaluation.fitness;
    }
  }

  const evalTimeMs = performance.now() - startTime;

  // 2. Speciation
  const nextSpecies = speciate(population, speciesList, config.speciation);

  // 3. Adjusted Fitness (Fitness Sharing)
  adjustAllFitness(nextSpecies);

  // 4. Stale Species entfernen
  const prunedSpecies = pruneStaleSpecies(nextSpecies, config.speciation);

  // 5. Threshold dynamisch anpassen (für nächste Generation)
  // Hinweis: adjustThreshold gibt neue Threshold zurück, nicht Species
  // Die Anpassung wird im Config-Objekt für die nächste Speciation verwendet
  const newThreshold = adjustThreshold(
    config.speciation.compatibilityThreshold,
    prunedSpecies.length,
    config.speciation.targetSpeciesCount
  );
  // Update config für nächste Generation (mutable)
  config.speciation.compatibilityThreshold = newThreshold;

  // 6. Reproduction
  const nextPopulation = reproduce(
    prunedSpecies,
    config.populationSize,
    tracker,
    config
  );

  // 7. Statistiken berechnen
  const stats = calculateStats(
    generation,
    population,
    result.evaluations,
    prunedSpecies.length,
    evalTimeMs
  );

  return {
    nextPopulation,
    nextSpecies: prunedSpecies,
    stats,
    evaluations: result.evaluations,
  };
}

/**
 * Haupt-Evolution-Loop.
 */
async function evolve(config: NEATConfig, resumePath?: string): Promise<NEATGenome> {
  console.log('\n' + '='.repeat(60));
  console.log(' NEAT EVOLUTION');
  console.log('='.repeat(60));
  console.log(`Population: ${config.populationSize}`);
  console.log(`Generations: ${config.generations}`);
  console.log(`Input Size: ${config.inputSize} (FEATURE_DIMENSIONS.total)`);
  console.log(`Output Size: ${config.outputSize}`);
  console.log(`Workers: ${config.workerCount}`);
  console.log(`Checkpoint Interval: ${config.checkpointInterval}`);
  console.log(`Output Directory: ${config.checkpointDir}`);
  console.log(`Dashboard: ${config.dashboard ? `http://localhost:${config.dashboardPort}` : 'disabled'}`);
  console.log('');

  // Start dashboard server if enabled
  let dashboard: DashboardServer | null = null;
  const trainingStartTime = Date.now();

  if (config.dashboard) {
    try {
      dashboard = await startDashboard(config.dashboardPort, {
        openBrowser: config.openBrowser,
      });
      // Broadcast initial config
      dashboard.broadcast({
        type: 'config',
        data: {
          populationSize: config.populationSize,
          generations: config.generations,
          workerCount: config.workerCount,
        },
      });
    } catch (err) {
      console.error('Failed to start dashboard:', err);
      console.log('Continuing without dashboard...');
    }
  }

  // Parallel execution requires compiled workers (npm run build:evolution)
  const workersAvailable = hasCompiledWorker();
  let pool: WorkerPool;

  if (config.workerCount > 1 && !workersAvailable) {
    console.log('Note: Compiled workers not found.');
    console.log('Run "npm run build:evolution" first for parallel mode.');
    console.log('Running in sequential mode.');
    pool = createSequentialPool();
  } else if (config.workerCount > 1) {
    console.log(`Initializing worker pool with ${config.workerCount} workers...`);
    pool = createWorkerPool(config.workerCount);
    console.log('Worker pool ready.');
  } else {
    console.log('Running in sequential mode (workers=1).');
    pool = createSequentialPool();
  }

  let population: NEATGenome[];
  let speciesList: Species[] = [];
  let startGeneration = 1;
  let tracker: InnovationTracker;
  let globalBestFitness = -Infinity;
  let globalBestGenome: NEATGenome | null = null;

  // Resume von Checkpoint oder neu starten
  if (resumePath) {
    console.log(`Resuming from: ${resumePath}`);
    const checkpoint = await loadCheckpoint(resumePath);
    population = checkpoint.population;
    speciesList = checkpoint.species;
    startGeneration = checkpoint.generation + 1;
    globalBestFitness = checkpoint.bestFitness;
    globalBestGenome = population.find(g => g.id === checkpoint.bestGenomeId) || null;

    // Innovation Tracker rekonstruieren
    tracker = createInnovationTracker();
    // Hinweis: Full state restoration würde serializeInnovationState benötigen
    console.log(`Resumed at generation ${startGeneration}`);
  } else {
    // Neu starten
    resetSpeciesIdCounter();
    tracker = createInnovationTracker();
    population = initializePopulation(
      config.populationSize,
      config.inputSize,
      config.outputSize,
      tracker
    );
    console.log(`Initialized ${population.length} minimal genomes`);
  }

  console.log('\n--- Evolution Start ---\n');

  // Evolution Loop
  for (let gen = startGeneration; gen <= config.generations; gen++) {
    // Create progress callback if dashboard is active
    const onEvalProgress: EvalProgressCallback | undefined = dashboard
      ? (progress) => {
          console.log(`  [Eval] Gen ${gen}: ${progress.current}/${progress.total} (${progress.genomeId})`);
          dashboard!.broadcast({
            type: 'evalProgress',
            data: {
              current: progress.current,
              total: progress.total,
              genomeId: progress.genomeId,
              generation: gen,
              // Combat-Stats für "Last" Tab im Dashboard
              fitness: progress.fitness,
              hitRate: progress.hitRate,
              kills: progress.kills,
              deaths: progress.deaths,
              hpLost: progress.hpLost,
              wins: progress.wins,
              losses: progress.losses,
              draws: progress.draws,
            },
          });
          // Broadcast detailed worker status
          const workerDetails = pool.detailedWorkerStatus;
          const now = Date.now();
          dashboard!.broadcast({
            type: 'workerStatus',
            data: {
              workers: workerDetails.map(w => ({
                id: w.id,
                busy: w.busy,
                jobId: w.currentJobId,
                genomeId: w.currentGenomeId?.substring(0, 20) ?? null,
                durationMs: w.startTime ? now - w.startTime : null,
                jobsCompleted: w.jobsCompleted,
                avgTimeMs: w.jobsCompleted > 0 ? Math.round(w.totalTimeMs / w.jobsCompleted) : 0,
              })),
              summary: {
                active: pool.activeWorkerCount,
                total: pool.workerCount,
              },
            },
          });
        }
      : undefined;

    console.log(`  Starting generation ${gen}...`);
    const { nextPopulation, nextSpecies, stats, evaluations } = await runGeneration(
      gen,
      population,
      speciesList,
      tracker,
      config,
      pool,
      onEvalProgress
    );
    console.log(`  Generation ${gen} complete.`);

    // Logging
    logGeneration(stats, config.verbose);

    // Broadcast generation stats to dashboard
    if (dashboard) {
      dashboard.broadcast({ type: 'generation', data: stats });
    }

    // Global Best tracken
    if (stats.bestFitness > globalBestFitness) {
      globalBestFitness = stats.bestFitness;
      globalBestGenome = population.find(g => g.id === stats.bestGenomeId) || null;

      if (globalBestGenome) {
        console.log(`  -> New best! Fitness: ${globalBestFitness.toFixed(2)}`);

        // Broadcast new best to dashboard
        if (dashboard) {
          dashboard.broadcast({
            type: 'newBest',
            data: {
              fitness: globalBestFitness,
              generation: gen,
              genomeId: globalBestGenome.id,
            },
          });
        }
      }
    }

    // Log-Datei aktualisieren
    if (config.logFile) {
      await appendLog(stats, path.join(config.checkpointDir, config.logFile));
    }

    // Checkpoint speichern
    if (gen % config.checkpointInterval === 0 || gen === config.generations) {
      const checkpoint: Checkpoint = {
        generation: gen,
        population,
        species: speciesList,
        innovationState: {
          nextInnovation: 0, // TODO: proper serialization
          history: [],
        },
        bestFitness: globalBestFitness,
        bestGenomeId: globalBestGenome?.id || '',
        config,
      };

      const checkpointPath = await saveCheckpoint(checkpoint, config.checkpointDir);
      console.log(`  Checkpoint saved: ${checkpointPath}`);
    }

    // Nächste Generation vorbereiten
    population = nextPopulation;
    speciesList = nextSpecies;
  }

  console.log('\n--- Evolution Complete ---\n');

  // Broadcast completion to dashboard
  if (dashboard) {
    dashboard.broadcast({
      type: 'complete',
      data: {
        totalGenerations: config.generations,
        finalBestFitness: globalBestFitness,
        totalTimeMs: Date.now() - trainingStartTime,
      },
    });
  }

  // Shutdown worker pool
  if (pool) {
    console.log('Shutting down worker pool...');
    await pool.shutdown();
    console.log('Worker pool shut down.');
  }

  // Note: Dashboard server keeps running so user can view final results
  // It will be stopped when the process exits

  // Champion speichern
  if (globalBestGenome) {
    const championPath = await saveChampion(globalBestGenome, config.checkpointDir);
    console.log(`Champion saved: ${championPath}`);
    console.log(`Best Fitness: ${globalBestFitness.toFixed(2)}`);
    console.log(`Genome ID: ${globalBestGenome.id}`);
    console.log(`Nodes: ${globalBestGenome.nodes.length}`);
    console.log(`Connections: ${globalBestGenome.connections.length}`);
  }

  return globalBestGenome || population[0];
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Config laden/mergen
  let config = { ...DEFAULT_NEAT_CONFIG };

  // Config-Datei laden falls angegeben
  if (args.config) {
    const fileConfig = await loadConfigFromFile(args.config);
    config = { ...config, ...fileConfig } as NEATConfig;
  }

  // CLI-Args anwenden
  config = mergeConfig(args, config);

  // Validieren
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  // Evolution starten
  await evolve(config, args.resume);
}

// Nur ausführen wenn direkt aufgerufen
main().catch(err => {
  console.error('Evolution failed:', err);
  process.exit(1);
});
