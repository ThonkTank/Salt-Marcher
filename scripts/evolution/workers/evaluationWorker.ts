// Ziel: Worker Thread für parallele Genome-Evaluation
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Lädt Presets einmalig beim Start, dann evaluiert Genomes in einer Schleife.

console.log('[Worker] Starting worker thread...');

import { parentPort } from 'node:worker_threads';

// ============================================================================
// ERROR HANDLERS (catch silent crashes)
// ============================================================================

process.on('unhandledRejection', (reason) => {
  console.error('[Worker] UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[Worker] UNCAUGHT EXCEPTION:', error);
});

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

// Vault initialisieren BEVOR andere Module geladen werden
console.log('[Worker] Initializing vault...');
const vaultAdapter = new PresetVaultAdapter();
vaultAdapter.register('action', actionsPresets);
vaultAdapter.register('creature', creaturesPresets);
vaultAdapter.register('faction', factionsPresets);
vaultAdapter.register('npc', npcsPresets);
vaultAdapter.register('character', charactersPresets);
setVault(vaultAdapter);
console.log('[Worker] Vault initialized');

// ============================================================================
// IMPORTS (nach Vault-Initialisierung)
// ============================================================================

import type { NEATGenome } from '../../../src/services/combatantAI/evolution';
import { deserializeGenome } from '../../../src/services/combatantAI/evolution';
import type { ActionSelector } from '../../../src/services/combatantAI/selectors/types';
import { createEvolvedSelector } from '../../../src/services/combatantAI/selectors/evolvedSelector';
import {
  getSelector,
  registerCoreModifiers,
} from '../../../src/services/combatantAI';

import type { FightResult } from '../tournament/fight';
import { runFight } from '../tournament/fight';
import {
  calculateFitnessFromResults,
  aggregateResults,
  DEFAULT_FITNESS_WEIGHTS,
} from '../tournament/fitness';

import type {
  EvaluationJob,
  EvaluationResult,
  MainMessage,
  WorkerMessage,
  SerializedOpponent,
} from './pool';

// Register core D&D 5e modifiers
console.log('[Worker] Registering modifiers...');
registerCoreModifiers();
console.log('[Worker] Modifiers registered');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates selector from opponent spec.
 * SerializedOpponent is either:
 * - 'greedy' or 'random' (baseline selector name)
 * - A JSON string (serialized genome)
 */
function getOpponentSelector(spec: SerializedOpponent): ActionSelector {
  // Check if it's a baseline selector name
  if (spec === 'greedy' || spec === 'random') {
    const selector = getSelector(spec);
    if (!selector) throw new Error(`Baseline selector not found: ${spec}`);
    return selector;
  }

  // Otherwise it's a serialized genome JSON string
  const genome = deserializeGenome(spec);
  return createEvolvedSelector(genome, genome.id);
}

/**
 * Evaluates a genome against opponents.
 * Same logic as tournament.ts evaluateGenome(), but with serialized inputs.
 */
function evaluateGenome(job: EvaluationJob): EvaluationResult {
  const startTime = performance.now();
  const { genome: serializedGenome, opponents, config } = job;

  // Deserialize genome
  console.log(`[Worker] Job ${job.jobId}: Deserializing genome...`);
  const genome = deserializeGenome(serializedGenome);

  // Create evolved selector for this genome
  console.log(`[Worker] Job ${job.jobId}: Creating selector for ${genome.id}...`);
  const genomeSelector = createEvolvedSelector(genome, genome.id);

  // Collect all fight results (1 fight per opponent with random scenario)
  console.log(`[Worker] Job ${job.jobId}: Starting ${opponents.length} fights...`);
  const allResults: FightResult[] = [];
  const totalFights = opponents.length;

  for (let i = 0; i < opponents.length; i++) {
    const opponent = opponents[i];
    const opponentSelector = getOpponentSelector(opponent);
    const opponentType = typeof opponent === 'string' ? opponent : 'genome';

    // Pick random scenario for this fight
    const scenario = config.scenarios[
      Math.floor(Math.random() * config.scenarios.length)
    ];

    // 50% as Party, 50% as Enemy (for symmetric training)
    const asParty = Math.random() < 0.5;

    console.log(`[Worker] Job ${job.jobId} Fight ${i + 1}/${totalFights}: vs ${opponentType} in "${scenario.name}" (${asParty ? 'party' : 'enemy'})`);

    const fightStart = performance.now();
    const result = runFight(scenario, {
      maxRounds: config.maxRounds,
      partySelector: asParty ? genomeSelector : opponentSelector,
      enemySelector: asParty ? opponentSelector : genomeSelector,
      verbose: config.verbose,
    });
    const fightTime = performance.now() - fightStart;

    // Adjust result from genome's perspective
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
        };

    console.log(`[Worker] Job ${job.jobId} Fight ${i + 1}: ${adjustedResult.winner} in ${result.rounds}R (${fightTime.toFixed(0)}ms)`);
    allResults.push(adjustedResult);
  }

  const stats = aggregateResults(allResults);
  const fitness = calculateFitnessFromResults(allResults, DEFAULT_FITNESS_WEIGHTS);
  const evalTimeMs = performance.now() - startTime;

  console.log(`[Worker] Job ${job.jobId}: Evaluation complete - ${stats.wins}W/${stats.losses}L/${stats.draws}D in ${evalTimeMs.toFixed(0)}ms`);

  return {
    jobId: job.jobId,
    evaluation: {
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
    },
  };
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

console.log('[Worker] Setting up message handler...');
if (parentPort) {
  const port = parentPort;

  // Signal ready
  console.log('[Worker] Sending ready signal...');
  port.postMessage({ type: 'ready' } as WorkerMessage);

  // Keep event loop alive - worker_threads in ESM bundles may exit otherwise
  const keepalive = setInterval(() => {}, 30000);
  console.log('[Worker] Event loop keepalive set, waiting for jobs...');

  port.on('message', (msg: MainMessage) => {
    console.log('[Worker] Received message:', msg.type);
    if (msg.type === 'shutdown') {
      clearInterval(keepalive);
      console.log('[Worker] Shutdown requested');
      process.exit(0);
    }

    if (msg.type === 'job') {
      console.log('[Worker] Processing job', msg.data.jobId);
      try {
        const result = evaluateGenome(msg.data);
        console.log('[Worker] Job', msg.data.jobId, 'complete, fitness:', result.evaluation.fitness.toFixed(1));
        port.postMessage({ type: 'result', data: result } as WorkerMessage);
      } catch (error) {
        console.error('[Worker] Job', msg.data.jobId, 'failed:', error);
        port.postMessage({
          type: 'error',
          jobId: msg.data.jobId,
          error: error instanceof Error ? error.message : String(error),
        } as WorkerMessage);
      }
    }
  });
} else {
  console.error('[Worker] No parentPort - running outside worker_threads?');
}
