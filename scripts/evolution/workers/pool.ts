// Ziel: Worker Pool für parallele Genome-Evaluation
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Verwaltet N Worker Threads für parallele Fight-Ausführung.
// Jeder Worker lädt Presets und führt evaluateGenome() aus.
//
// ============================================================================
// WORKER PATH RESOLUTION
// ============================================================================
// Worker Threads benötigen kompiliertes JavaScript (tsx funktioniert nicht).
// Das Build-Script (npm run build:evolution) kompiliert zu dist/evolution/.
// Der Pool verwendet automatisch die kompilierte Version wenn vorhanden.

import { Worker } from 'node:worker_threads';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// WORKER PATH RESOLUTION
// ============================================================================

/**
 * Ermittelt den Pfad zum Worker-Script.
 * Verwendet kompiliertes JS wenn vorhanden, sonst TypeScript-Fallback.
 *
 * Pfad-Logik:
 * - Wenn aus dist/evolution/ ausgeführt → evaluationWorker.mjs im selben Verzeichnis
 * - Wenn TypeScript via tsx → dist/evolution/evaluationWorker.mjs relativ zu Projekt-Root
 */
function getWorkerPath(): { path: string; isCompiled: boolean } {
  // Option 1: Im selben Verzeichnis wie aktuelles Script (für kompilierte Version)
  const sameDir = path.resolve(__dirname, 'evaluationWorker.mjs');

  // Option 2: Relativ zu Projekt-Root (für TypeScript-Ausführung aus scripts/evolution/workers/)
  const fromProjectRoot = path.resolve(__dirname, '../../../dist/evolution/evaluationWorker.mjs');

  // TypeScript-Fallback (funktioniert nur mit child_process, nicht worker_threads)
  const tsPath = path.resolve(__dirname, 'worker-loader.mjs');

  // Priorisiere same-directory (wenn aus dist/evolution/ ausgeführt)
  if (fs.existsSync(sameDir)) {
    return { path: sameDir, isCompiled: true };
  }

  // Fallback: Projekt-Root-relativer Pfad (wenn TypeScript via tsx)
  if (fs.existsSync(fromProjectRoot)) {
    return { path: fromProjectRoot, isCompiled: true };
  }

  return { path: tsPath, isCompiled: false };
}

/**
 * Prüft ob kompilierte Worker verfügbar sind.
 */
export function hasCompiledWorker(): boolean {
  const { isCompiled } = getWorkerPath();
  return isCompiled;
}

import type { NEATGenome } from '../../../src/services/combatantAI/evolution';
import { serializeGenome } from '../../../src/services/combatantAI/evolution';
import type { GenomeEvaluation, TournamentConfig } from '../tournament/tournament';
import type { ScenarioConfig } from '../tournament/scenarios';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Serialized genome (JSON string).
 */
export type SerializedGenome = string;

/**
 * Opponent specification for worker.
 */
export type SerializedOpponent = SerializedGenome | 'greedy' | 'random';

/**
 * Job sent to worker.
 */
export interface EvaluationJob {
  /** Job ID for tracking */
  jobId: number;
  /** Genome to evaluate (serialized JSON string) */
  genome: SerializedGenome;
  /** Opponents (serialized genomes or baseline names) */
  opponents: SerializedOpponent[];
  /** Tournament configuration subset */
  config: {
    scenarios: ScenarioConfig[];
    fightsPerGenome: number;
    maxRounds: number;
    selfPlayRatio: number;
    verbose: boolean;
  };
}

/**
 * Result from worker.
 */
export interface EvaluationResult {
  /** Job ID for matching */
  jobId: number;
  /** Evaluation result */
  evaluation: GenomeEvaluation;
}

/**
 * Worker message types.
 */
export type WorkerMessage =
  | { type: 'ready' }
  | { type: 'result'; data: EvaluationResult }
  | { type: 'error'; jobId: number; error: string };

/**
 * Main thread message types.
 */
export type MainMessage =
  | { type: 'job'; data: EvaluationJob }
  | { type: 'shutdown' };

/**
 * Progress callback for individual genome evaluations.
 */
export type EvalProgressCallback = (progress: {
  current: number;
  total: number;
  genomeId: string;
  fitness: number;
}) => void;

/**
 * Detailed status for a single worker.
 */
export interface WorkerDetailedStatus {
  id: number;
  busy: boolean;
  currentJobId: number | null;
  currentGenomeId: string | null;
  startTime: number | null;  // timestamp when job started
  jobsCompleted: number;
  totalTimeMs: number;  // for avg calculation
}

/**
 * Worker Pool interface.
 */
export interface WorkerPool {
  /**
   * Evaluates all genomes in parallel.
   * Returns when all evaluations are complete.
   * @param genomes - Genomes to evaluate
   * @param population - Full population (for self-play opponents)
   * @param config - Tournament configuration
   * @param onProgress - Optional callback for each completed evaluation
   */
  evaluateAll(
    genomes: NEATGenome[],
    population: NEATGenome[],
    config: TournamentConfig,
    onProgress?: EvalProgressCallback
  ): Promise<GenomeEvaluation[]>;

  /**
   * Gracefully shuts down all workers.
   */
  shutdown(): Promise<void>;

  /**
   * Number of workers in pool.
   */
  readonly workerCount: number;

  /**
   * Number of currently busy workers.
   */
  readonly activeWorkerCount: number;

  /**
   * Detailed status for each worker.
   */
  readonly detailedWorkerStatus: WorkerDetailedStatus[];
}

// ============================================================================
// WORKER POOL IMPLEMENTATION
// ============================================================================

interface WorkerState {
  worker: Worker;
  isReady: boolean;                 // Has worker completed initialization?
  busy: boolean;                    // Is worker currently processing a job?
  currentJobId: number | null;
  currentGenomeId: string | null;
  startTime: number | null;
  jobsCompleted: number;
  totalTimeMs: number;
}

/**
 * Creates a worker pool with the specified number of workers.
 * Requires compiled workers (npm run build:evolution).
 */
export function createWorkerPool(workerCount?: number): WorkerPool {
  const count = workerCount ?? Math.max(1, os.cpus().length - 1);
  const { path: workerPath, isCompiled } = getWorkerPath();

  if (!isCompiled) {
    throw new Error(
      'Compiled workers not found. Run "npm run build:evolution" first.\n' +
      'Expected file: dist/evolution/evaluationWorker.mjs'
    );
  }

  const workers: WorkerState[] = [];
  const pendingResults = new Map<number, {
    resolve: (result: GenomeEvaluation) => void;
    reject: (error: Error) => void;
  }>();

  let nextJobId = 0;
  let isShutdown = false;

  // Initialize workers with compiled JavaScript
  console.log(`  [Pool] Creating ${count} workers from: ${workerPath}`);
  for (let i = 0; i < count; i++) {
    console.log(`  [Pool] Creating worker ${i}...`);
    const worker = new Worker(workerPath);

    const state: WorkerState = {
      worker,
      isReady: false,               // Not ready until 'ready' message received
      busy: true,                   // Block dispatch until ready
      currentJobId: null,
      currentGenomeId: null,
      startTime: null,
      jobsCompleted: 0,
      totalTimeMs: 0,
    };

    worker.on('message', (msg: WorkerMessage) => {
      if (msg.type === 'ready') {
        console.log(`  [Pool] Worker ${i} ready`);
        if (!state.isReady) {
          state.isReady = true;
          state.busy = false;       // Only set false ONCE when ready
        }
        // Ignore duplicate 'ready' messages
      } else if (msg.type === 'result') {
        console.log(`  [Pool] Worker ${i} returned result for job ${msg.data.jobId}`);
        const pending = pendingResults.get(msg.data.jobId);
        if (pending) {
          pending.resolve(msg.data.evaluation);
          pendingResults.delete(msg.data.jobId);
        }
        // Track completion stats
        state.jobsCompleted++;
        if (state.startTime !== null) {
          state.totalTimeMs += Date.now() - state.startTime;
        }
        state.busy = false;
        state.currentJobId = null;
        state.currentGenomeId = null;
        state.startTime = null;
      } else if (msg.type === 'error') {
        const pending = pendingResults.get(msg.jobId);
        if (pending) {
          pending.reject(new Error(msg.error));
          pendingResults.delete(msg.jobId);
        }
        state.busy = false;
        state.currentJobId = null;
        state.currentGenomeId = null;
        state.startTime = null;
      }
    });

    worker.on('error', (err) => {
      console.error(`  [Pool] Worker ${i} ERROR:`, err.message);
      // Reject all pending jobs for this worker
      if (state.currentJobId !== null) {
        const pending = pendingResults.get(state.currentJobId);
        if (pending) {
          pending.reject(err);
          pendingResults.delete(state.currentJobId);
        }
      }
      state.busy = false;
      state.currentJobId = null;
      state.currentGenomeId = null;
      state.startTime = null;
    });

    workers.push(state);
  }

  /**
   * Finds an idle worker (ready and not busy).
   */
  function findIdleWorker(): WorkerState | null {
    return workers.find(w => w.isReady && !w.busy) ?? null;
  }

  /**
   * Waits for any worker to become idle.
   */
  function waitForIdleWorker(): Promise<WorkerState> {
    return new Promise((resolve) => {
      const check = () => {
        const idle = findIdleWorker();
        if (idle) {
          resolve(idle);
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  /**
   * Waits for all workers to complete initialization.
   */
  function waitForAllReady(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (workers.every(w => w.isReady)) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  /**
   * Dispatches a job to a worker.
   */
  function dispatchJob(
    workerState: WorkerState,
    job: EvaluationJob
  ): Promise<GenomeEvaluation> {
    const workerIdx = workers.indexOf(workerState);
    console.log(`  [Pool] Dispatching job ${job.jobId} to worker ${workerIdx}`);
    return new Promise((resolve, reject) => {
      workerState.busy = true;
      workerState.currentJobId = job.jobId;
      workerState.startTime = Date.now();
      // Extract genome ID from serialized JSON (first 50 chars for display)
      try {
        const parsed = JSON.parse(job.genome);
        workerState.currentGenomeId = parsed.id ?? null;
      } catch {
        workerState.currentGenomeId = null;
      }
      pendingResults.set(job.jobId, { resolve, reject });
      workerState.worker.postMessage({ type: 'job', data: job } as MainMessage);
    });
  }

  /**
   * Selects opponents for a genome.
   * Picks fightsPerGenome random opponents (self-play or baseline based on selfPlayRatio).
   */
  function selectOpponents(
    genome: NEATGenome,
    population: NEATGenome[],
    config: TournamentConfig
  ): SerializedOpponent[] {
    const opponents: SerializedOpponent[] = [];
    const otherGenomes = population.filter(g => g.id !== genome.id);

    for (let i = 0; i < config.fightsPerGenome; i++) {
      // Self-Play vs Baseline based on selfPlayRatio
      if (Math.random() < config.selfPlayRatio && otherGenomes.length > 0) {
        // Random self-play opponent
        const idx = Math.floor(Math.random() * otherGenomes.length);
        opponents.push(serializeGenome(otherGenomes[idx]));
      } else {
        // Random baseline opponent
        const baselineIdx = Math.floor(Math.random() * config.baselineNames.length);
        opponents.push(config.baselineNames[baselineIdx] as 'greedy' | 'random');
      }
    }

    return opponents;
  }

  return {
    workerCount: count,

    get activeWorkerCount() {
      return workers.filter(w => w.busy).length;
    },

    get detailedWorkerStatus(): WorkerDetailedStatus[] {
      return workers.map((w, i) => ({
        id: i,
        busy: w.busy,
        currentJobId: w.currentJobId,
        currentGenomeId: w.currentGenomeId,
        startTime: w.startTime,
        jobsCompleted: w.jobsCompleted,
        totalTimeMs: w.totalTimeMs,
      }));
    },

    async evaluateAll(
      genomes: NEATGenome[],
      population: NEATGenome[],
      config: TournamentConfig,
      onProgress?: EvalProgressCallback
    ): Promise<GenomeEvaluation[]> {
      if (isShutdown) {
        throw new Error('Worker pool is shut down');
      }

      // Wait for all workers to be ready before dispatching
      await waitForAllReady();

      const total = genomes.length;
      let completedCount = 0;

      // Create jobs for all genomes
      const jobs: EvaluationJob[] = genomes.map(genome => ({
        jobId: nextJobId++,
        genome: serializeGenome(genome),
        opponents: selectOpponents(genome, population, config),
        config: {
          scenarios: config.scenarios,
          fightsPerGenome: config.fightsPerGenome,
          maxRounds: config.maxRounds,
          selfPlayRatio: config.selfPlayRatio,
          verbose: config.verbose,
        },
      }));

      // Dispatch jobs as workers become available
      const resultPromises: Promise<GenomeEvaluation>[] = [];

      for (const job of jobs) {
        const workerState = findIdleWorker() ?? await waitForIdleWorker();
        // Wrap dispatch to call progress callback
        const promise = dispatchJob(workerState, job).then(result => {
          completedCount++;
          if (onProgress) {
            onProgress({
              current: completedCount,
              total,
              genomeId: result.genomeId,
              fitness: result.fitness,
            });
          }
          return result;
        });
        resultPromises.push(promise);
      }

      // Wait for all results
      const results = await Promise.all(resultPromises);

      // Sort by original genome order
      const resultMap = new Map(results.map(r => [r.genomeId, r]));
      return genomes.map(g => resultMap.get(g.id)!);
    },

    async shutdown(): Promise<void> {
      if (isShutdown) return;
      isShutdown = true;

      const terminationPromises = workers.map(({ worker }) =>
        new Promise<void>((resolve) => {
          worker.postMessage({ type: 'shutdown' } as MainMessage);
          worker.on('exit', () => resolve());
          // Force terminate after timeout
          setTimeout(() => {
            worker.terminate();
            resolve();
          }, 1000);
        })
      );

      await Promise.all(terminationPromises);
    },
  };
}

// Import evaluateGenome directly for sequential pool (bundled context)
import { evaluateGenome as evalGenome, type OpponentSpec } from '../tournament/tournament';

/**
 * Creates a pool that runs evaluations sequentially in main thread.
 * Useful for debugging or single-core systems.
 */
export function createSequentialPool(): WorkerPool {
  let isProcessing = false;
  let currentGenomeId: string | null = null;
  let startTime: number | null = null;
  let jobsCompleted = 0;
  let totalTimeMs = 0;

  return {
    workerCount: 1,

    get activeWorkerCount() {
      return isProcessing ? 1 : 0;
    },

    get detailedWorkerStatus(): WorkerDetailedStatus[] {
      return [{
        id: 0,
        busy: isProcessing,
        currentJobId: isProcessing ? 0 : null,
        currentGenomeId,
        startTime,
        jobsCompleted,
        totalTimeMs,
      }];
    },

    async evaluateAll(
      genomes: NEATGenome[],
      population: NEATGenome[],
      config: TournamentConfig,
      onProgress?: EvalProgressCallback
    ): Promise<GenomeEvaluation[]> {
      isProcessing = true;
      console.log('        [SequentialPool] evaluateAll called with', genomes.length, 'genomes');

      // Same opponent selection logic as tournament.ts
      const results: GenomeEvaluation[] = [];
      const total = genomes.length;

      for (let i = 0; i < genomes.length; i++) {
        console.log(`        [SequentialPool] Processing genome ${i + 1}/${total}...`);
        const genome = genomes[i];

        // Track current genome
        currentGenomeId = genome.id;
        startTime = Date.now();

        const opponents: (NEATGenome | 'greedy' | 'random')[] = [];
        const otherGenomes = population.filter(g => g.id !== genome.id);

        // Pick fightsPerGenome random opponents
        for (let j = 0; j < config.fightsPerGenome; j++) {
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

        console.log(`        [SequentialPool] Calling evalGenome with ${opponents.length} opponents...`);
        const evaluation = evalGenome(genome, opponents as OpponentSpec[], config);
        console.log(`        [SequentialPool] evalGenome returned, fitness: ${evaluation.fitness}`);
        results.push(evaluation);

        // Track completion
        jobsCompleted++;
        totalTimeMs += Date.now() - startTime;
        currentGenomeId = null;
        startTime = null;

        // Call progress callback
        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            genomeId: evaluation.genomeId,
            fitness: evaluation.fitness,
          });
        }
      }

      isProcessing = false;
      return results;
    },

    async shutdown(): Promise<void> {
      // Nothing to clean up
    },
  };
}
