// Ziel: CLI Tool für Genome-Evaluation gegen Baselines
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Evaluiert trainierte NEAT-Genomes gegen Baseline-Selectors (greedy, random)
// und zeigt detaillierte Statistiken als Markdown-Tabellen.

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
import { deserializeGenome } from '../../src/services/combatantAI/evolution';
import type { ActionSelector } from '../../src/services/combatantAI/selectors/types';
import { createEvolvedSelector } from '../../src/services/combatantAI/selectors/evolvedSelector';
import {
  getSelector,
  registerCoreModifiers,
} from '../../src/services/combatantAI';

import { SCENARIOS, QUICK_SCENARIOS, type ScenarioConfig } from './tournament/scenarios';
import { runFight, type FightResult } from './tournament/fight';
import {
  aggregateResults,
  calculateFitnessFromResults,
  DEFAULT_FITNESS_WEIGHTS,
} from './tournament/fitness';

// Register core D&D 5e modifiers
registerCoreModifiers();

// ============================================================================
// TYPES
// ============================================================================

interface EvaluateConfig {
  genomePath?: string;
  vsPath?: string;
  opponent?: 'greedy' | 'random' | 'all';
  fights: number;
  scenarios: ScenarioConfig[];
  verbose: boolean;
  compareAll: boolean;
  quick: boolean;
}

interface EvaluationResult {
  name: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgRounds: number;
  damageDealt: number;
  damageReceived: number;
  avgSurvivors: number;
  fitness: number;
  timeMs: number;
}

interface ScenarioBreakdown {
  scenario: string;
  wins: number;
  losses: number;
  draws: number;
}

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs(argv: string[]): EvaluateConfig {
  const config: EvaluateConfig = {
    fights: 10,
    scenarios: SCENARIOS,
    verbose: false,
    compareAll: false,
    quick: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--genome':
      case '-g':
        config.genomePath = next;
        i++;
        break;
      case '--vs':
        config.vsPath = next;
        i++;
        break;
      case '--opponent':
      case '-o':
        if (next === 'greedy' || next === 'random' || next === 'all') {
          config.opponent = next;
        }
        i++;
        break;
      case '--fights':
      case '-f':
        config.fights = parseInt(next, 10);
        i++;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--compare-all':
      case '-c':
        config.compareAll = true;
        break;
      case '--quick':
      case '-q':
        config.quick = true;
        config.scenarios = QUICK_SCENARIOS;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
NEAT Genome Evaluation Tool

Usage:
  npx tsx scripts/evolution/evaluate.ts [options]

Options:
  --genome, -g <path>    Path to genome JSON file (or checkpoint)
  --vs <path>            Path to second genome for head-to-head
  --opponent, -o <name>  Baseline to test against: greedy, random, or all
  --fights, -f <n>       Number of fights per opponent (default: 10)
  --compare-all, -c      Compare all baseline selectors against each other
  --quick, -q            Use quick scenarios (faster, less thorough)
  --verbose, -v          Show detailed fight results
  --help, -h             Show this help message

Examples:
  # Evaluate genome against all baselines
  npx tsx scripts/evolution/evaluate.ts --genome champion.json --fights 20

  # Evaluate genome against greedy only
  npx tsx scripts/evolution/evaluate.ts --genome champion.json --opponent greedy

  # Head-to-head between two genomes
  npx tsx scripts/evolution/evaluate.ts --genome a.json --vs b.json --fights 50

  # Compare baseline selectors
  npx tsx scripts/evolution/evaluate.ts --compare-all --fights 10
`);
}

// ============================================================================
// GENOME LOADING
// ============================================================================

async function loadGenome(genomePath: string): Promise<NEATGenome> {
  const fullPath = path.resolve(genomePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  const data = JSON.parse(content);

  // Check if this is a checkpoint file (has 'champion' key)
  if (data.champion) {
    console.log(`Loading champion from checkpoint: ${genomePath}`);
    return data.champion as NEATGenome;
  }

  // Check if this is a population checkpoint (has 'population' key)
  if (data.population && Array.isArray(data.population)) {
    console.log(`Loading best genome from population checkpoint: ${genomePath}`);
    const population = data.population as NEATGenome[];
    // Sort by fitness and return best
    population.sort((a, b) => b.fitness - a.fitness);
    return population[0];
  }

  // Assume it's a raw genome
  return deserializeGenome(content);
}

// ============================================================================
// EVALUATION FUNCTIONS
// ============================================================================

function runEvaluation(
  selector: ActionSelector,
  opponent: ActionSelector,
  scenarios: ScenarioConfig[],
  fightsPerScenario: number,
  verbose: boolean
): { results: FightResult[]; breakdown: ScenarioBreakdown[] } {
  const allResults: FightResult[] = [];
  const breakdown: ScenarioBreakdown[] = [];

  for (const scenario of scenarios) {
    const scenarioResults: FightResult[] = [];

    for (let i = 0; i < fightsPerScenario; i++) {
      // Alternate sides for fairness
      const asParty = i % 2 === 0;

      const result = runFight(scenario, {
        maxRounds: 50,
        partySelector: asParty ? selector : opponent,
        enemySelector: asParty ? opponent : selector,
        verbose: false,
      });

      // Adjust result from selector's perspective
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

      scenarioResults.push(adjustedResult);
      allResults.push(adjustedResult);
    }

    // Scenario breakdown
    const wins = scenarioResults.filter(r => r.winner === 'party').length;
    const losses = scenarioResults.filter(r => r.winner === 'enemy').length;
    const draws = scenarioResults.filter(r => r.winner === 'draw').length;

    breakdown.push({ scenario: scenario.name, wins, losses, draws });

    if (verbose) {
      console.log(`  ${scenario.name}: ${wins}W/${losses}L/${draws}D`);
    }
  }

  return { results: allResults, breakdown };
}

function calculateEvaluationResult(
  name: string,
  results: FightResult[],
  timeMs: number
): EvaluationResult {
  const stats = aggregateResults(results);
  const fitness = calculateFitnessFromResults(results, DEFAULT_FITNESS_WEIGHTS);
  const totalGames = stats.wins + stats.losses + stats.draws;

  return {
    name,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    winRate: totalGames > 0 ? (stats.wins / totalGames) * 100 : 0,
    avgRounds: stats.avgRounds,
    damageDealt: stats.totalDamageDealt,
    damageReceived: stats.totalDamageReceived,
    avgSurvivors: stats.avgSurvivors,
    fitness,
    timeMs,
  };
}

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

function formatResultTable(results: EvaluationResult[]): string {
  const lines: string[] = [];

  lines.push('| Selector | Wins | Losses | Draws | Win% | Avg Rounds | Fitness | Time |');
  lines.push('|----------|------|--------|-------|------|------------|---------|------|');

  for (const r of results) {
    lines.push(
      `| ${r.name.padEnd(8)} | ${r.wins.toString().padStart(4)} | ${r.losses.toString().padStart(6)} | ${r.draws.toString().padStart(5)} | ${r.winRate.toFixed(1).padStart(4)}% | ${r.avgRounds.toFixed(1).padStart(10)} | ${r.fitness.toFixed(0).padStart(7)} | ${(r.timeMs / 1000).toFixed(1).padStart(4)}s |`
    );
  }

  return lines.join('\n');
}

function formatBreakdownTable(breakdown: ScenarioBreakdown[]): string {
  const lines: string[] = [];

  lines.push('| Scenario | Wins | Losses | Draws | Win% |');
  lines.push('|----------|------|--------|-------|------|');

  for (const s of breakdown) {
    const total = s.wins + s.losses + s.draws;
    const winRate = total > 0 ? (s.wins / total) * 100 : 0;
    lines.push(
      `| ${s.scenario.padEnd(12)} | ${s.wins.toString().padStart(4)} | ${s.losses.toString().padStart(6)} | ${s.draws.toString().padStart(5)} | ${winRate.toFixed(0).padStart(4)}% |`
    );
  }

  return lines.join('\n');
}

function formatComparisonMatrix(
  selectors: string[],
  matrix: Map<string, Map<string, { wins: number; losses: number; draws: number }>>
): string {
  const lines: string[] = [];

  // Header
  const header = ['Selector', ...selectors.map(s => s.slice(0, 8))];
  lines.push('| ' + header.join(' | ') + ' |');
  lines.push('|' + header.map(() => '--------').join('|') + '|');

  // Rows
  for (const rowSelector of selectors) {
    const cells = [rowSelector.padEnd(8)];
    for (const colSelector of selectors) {
      if (rowSelector === colSelector) {
        cells.push('   -   ');
      } else {
        const result = matrix.get(rowSelector)?.get(colSelector);
        if (result) {
          const total = result.wins + result.losses + result.draws;
          const winRate = total > 0 ? (result.wins / total) * 100 : 0;
          cells.push(`${winRate.toFixed(0).padStart(3)}%   `);
        } else {
          cells.push('   ?   ');
        }
      }
    }
    lines.push('| ' + cells.join(' | ') + ' |');
  }

  return lines.join('\n');
}

// ============================================================================
// MAIN EVALUATION MODES
// ============================================================================

async function evaluateGenomeVsBaselines(config: EvaluateConfig): Promise<void> {
  if (!config.genomePath) {
    console.error('Error: --genome is required');
    process.exit(1);
  }

  const genome = await loadGenome(config.genomePath);
  const evolvedSelector = createEvolvedSelector(genome, genome.id);

  console.log('\n' + '='.repeat(60));
  console.log(' GENOME EVALUATION');
  console.log('='.repeat(60));
  console.log(`Genome: ${genome.id}`);
  console.log(`Generation: ${genome.generation}`);
  console.log(`Nodes: ${genome.nodes.length}, Connections: ${genome.connections.length}`);
  console.log(`Scenarios: ${config.scenarios.length}`);
  console.log(`Fights per scenario: ${config.fights}`);
  console.log('');

  const baselines = config.opponent === 'all' || !config.opponent
    ? ['greedy', 'random']
    : [config.opponent];

  const results: EvaluationResult[] = [];

  for (const baselineName of baselines) {
    const baseline = getSelector(baselineName);
    if (!baseline) {
      console.error(`Baseline selector not found: ${baselineName}`);
      continue;
    }

    console.log(`Evaluating vs ${baselineName}...`);
    const startTime = performance.now();

    const { results: fightResults, breakdown } = runEvaluation(
      evolvedSelector,
      baseline,
      config.scenarios,
      config.fights,
      config.verbose
    );

    const timeMs = performance.now() - startTime;
    const evalResult = calculateEvaluationResult(`vs ${baselineName}`, fightResults, timeMs);
    results.push(evalResult);

    console.log(`  Completed in ${(timeMs / 1000).toFixed(1)}s`);

    if (config.verbose) {
      console.log('\nScenario Breakdown:');
      console.log(formatBreakdownTable(breakdown));
      console.log('');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(' RESULTS');
  console.log('='.repeat(60));
  console.log('');
  console.log(formatResultTable(results));
  console.log('');
}

async function evaluateGenomeVsGenome(config: EvaluateConfig): Promise<void> {
  if (!config.genomePath || !config.vsPath) {
    console.error('Error: --genome and --vs are required for head-to-head');
    process.exit(1);
  }

  const genomeA = await loadGenome(config.genomePath);
  const genomeB = await loadGenome(config.vsPath);

  const selectorA = createEvolvedSelector(genomeA, genomeA.id);
  const selectorB = createEvolvedSelector(genomeB, genomeB.id);

  console.log('\n' + '='.repeat(60));
  console.log(' HEAD-TO-HEAD EVALUATION');
  console.log('='.repeat(60));
  console.log(`Genome A: ${genomeA.id} (Gen ${genomeA.generation})`);
  console.log(`Genome B: ${genomeB.id} (Gen ${genomeB.generation})`);
  console.log(`Scenarios: ${config.scenarios.length}`);
  console.log(`Fights per scenario: ${config.fights}`);
  console.log('');

  console.log('Running fights...');
  const startTime = performance.now();

  const { results: fightResults, breakdown } = runEvaluation(
    selectorA,
    selectorB,
    config.scenarios,
    config.fights,
    config.verbose
  );

  const timeMs = performance.now() - startTime;

  const stats = aggregateResults(fightResults);
  const totalGames = stats.wins + stats.losses + stats.draws;
  const winRateA = totalGames > 0 ? (stats.wins / totalGames) * 100 : 0;
  const winRateB = totalGames > 0 ? (stats.losses / totalGames) * 100 : 0;

  console.log('\n' + '='.repeat(60));
  console.log(' RESULTS');
  console.log('='.repeat(60));
  console.log('');
  console.log(`${genomeA.id}: ${stats.wins} wins (${winRateA.toFixed(1)}%)`);
  console.log(`${genomeB.id}: ${stats.losses} wins (${winRateB.toFixed(1)}%)`);
  console.log(`Draws: ${stats.draws}`);
  console.log(`Total time: ${(timeMs / 1000).toFixed(1)}s`);
  console.log('');

  if (config.verbose) {
    console.log('Scenario Breakdown:');
    console.log(formatBreakdownTable(breakdown));
    console.log('');
  }
}

async function compareAllBaselines(config: EvaluateConfig): Promise<void> {
  const selectorNames = ['greedy', 'random'];

  console.log('\n' + '='.repeat(60));
  console.log(' BASELINE COMPARISON');
  console.log('='.repeat(60));
  console.log(`Selectors: ${selectorNames.join(', ')}`);
  console.log(`Scenarios: ${config.scenarios.length}`);
  console.log(`Fights per matchup: ${config.fights}`);
  console.log('');

  // Build comparison matrix
  const matrix = new Map<string, Map<string, { wins: number; losses: number; draws: number }>>();

  for (const nameA of selectorNames) {
    matrix.set(nameA, new Map());
  }

  const results: EvaluationResult[] = [];

  for (let i = 0; i < selectorNames.length; i++) {
    for (let j = i + 1; j < selectorNames.length; j++) {
      const nameA = selectorNames[i];
      const nameB = selectorNames[j];

      const selectorA = getSelector(nameA);
      const selectorB = getSelector(nameB);

      if (!selectorA || !selectorB) {
        console.error(`Selector not found: ${!selectorA ? nameA : nameB}`);
        continue;
      }

      console.log(`${nameA} vs ${nameB}...`);
      const startTime = performance.now();

      const { results: fightResults } = runEvaluation(
        selectorA,
        selectorB,
        config.scenarios,
        config.fights,
        config.verbose
      );

      const timeMs = performance.now() - startTime;
      const stats = aggregateResults(fightResults);

      // Store in matrix (both directions)
      matrix.get(nameA)!.set(nameB, { wins: stats.wins, losses: stats.losses, draws: stats.draws });
      matrix.get(nameB)!.set(nameA, { wins: stats.losses, losses: stats.wins, draws: stats.draws });

      const evalResult = calculateEvaluationResult(`${nameA} vs ${nameB}`, fightResults, timeMs);
      results.push(evalResult);

      console.log(`  ${nameA}: ${stats.wins}W, ${nameB}: ${stats.losses}W, Draws: ${stats.draws} (${(timeMs / 1000).toFixed(1)}s)`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(' WIN RATE MATRIX');
  console.log('='.repeat(60));
  console.log('');
  console.log(formatComparisonMatrix(selectorNames, matrix));
  console.log('');
  console.log('(Rows show win rate against columns)');
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));

  if (config.compareAll) {
    await compareAllBaselines(config);
  } else if (config.vsPath) {
    await evaluateGenomeVsGenome(config);
  } else if (config.genomePath) {
    await evaluateGenomeVsBaselines(config);
  } else {
    // Default: compare baselines
    await compareAllBaselines(config);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
