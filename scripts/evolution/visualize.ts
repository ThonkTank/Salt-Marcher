// Ziel: CLI Tool für Checkpoint-Visualisierung und Evolution-Progress
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Visualisiert:
// - Checkpoint-Inhalte (Species, Genome-Verteilung, Top Fitness)
// - Evolution-Log (Fitness-Kurve als ASCII-Art)
// - Netzwerk-Struktur (Node/Connection-Statistiken)

import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';

import type { NEATGenome, NodeGene, ConnectionGene } from '../../src/services/combatantAI/evolution';

// ============================================================================
// TYPES
// ============================================================================

interface Species {
  id: number;
  representative: NEATGenome;
  members: NEATGenome[];
  staleness: number;
  bestFitness: number;
}

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
  config: {
    populationSize: number;
    generations: number;
    [key: string]: unknown;
  };
}

interface LogEntry {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  speciesCount: number;
  avgNodes: number;
  avgConnections: number;
  timeMs: number;
}

interface VisualizeConfig {
  checkpointPath?: string;
  logPath?: string;
  genomePath?: string;
  showNetwork: boolean;
  width: number;
  height: number;
}

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs(argv: string[]): VisualizeConfig {
  const config: VisualizeConfig = {
    showNetwork: false,
    width: 80,
    height: 20,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--checkpoint':
      case '-c':
        config.checkpointPath = next;
        i++;
        break;
      case '--log':
      case '-l':
        config.logPath = next;
        i++;
        break;
      case '--genome':
      case '-g':
        config.genomePath = next;
        i++;
        break;
      case '--network':
      case '-n':
        config.showNetwork = true;
        break;
      case '--width':
      case '-w':
        config.width = parseInt(next, 10);
        i++;
        break;
      case '--height':
      case '-h':
        if (next && !next.startsWith('-')) {
          config.height = parseInt(next, 10);
          i++;
        }
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
NEAT Evolution Visualization Tool

Usage:
  npx tsx scripts/evolution/visualize.ts [options]

Options:
  --checkpoint, -c <path>  Path to checkpoint JSON file
  --log, -l <path>         Path to evolution-log.csv file
  --genome, -g <path>      Path to genome JSON file
  --network, -n            Show network structure (with --genome)
  --width, -w <n>          Chart width (default: 80)
  --height <n>             Chart height (default: 20)
  --help                   Show this help message

Examples:
  # View checkpoint summary
  npx tsx scripts/evolution/visualize.ts --checkpoint evolution-checkpoints/gen-100.json

  # View evolution progress as ASCII graph
  npx tsx scripts/evolution/visualize.ts --log evolution-log.csv

  # View genome network structure
  npx tsx scripts/evolution/visualize.ts --genome champion.json --network
`);
}

// ============================================================================
// CHECKPOINT VISUALIZATION
// ============================================================================

async function loadCheckpoint(checkpointPath: string): Promise<Checkpoint> {
  const fullPath = path.resolve(checkpointPath);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content) as Checkpoint;
}

function visualizeCheckpoint(checkpoint: Checkpoint): void {
  console.log('\n' + '='.repeat(60));
  console.log(' CHECKPOINT SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Generation: ${checkpoint.generation}`);
  console.log(`Population Size: ${checkpoint.population.length}`);
  console.log(`Species Count: ${checkpoint.species.length}`);
  console.log(`Best Fitness: ${checkpoint.bestFitness.toFixed(1)}`);
  console.log(`Best Genome ID: ${checkpoint.bestGenomeId}`);
  console.log('');

  // Species breakdown
  console.log('Species Distribution:');
  console.log('-'.repeat(60));
  console.log('| ID | Members | Best Fit | Staleness | Avg Nodes | Avg Conn |');
  console.log('|' + '-'.repeat(58) + '|');

  const sortedSpecies = [...checkpoint.species].sort((a, b) => b.bestFitness - a.bestFitness);

  for (const species of sortedSpecies) {
    const avgNodes = species.members.reduce((sum, g) => sum + g.nodes.length, 0) / species.members.length;
    const avgConns = species.members.reduce((sum, g) => sum + g.connections.length, 0) / species.members.length;

    console.log(
      `| ${species.id.toString().padStart(2)} | ${species.members.length.toString().padStart(7)} | ${species.bestFitness.toFixed(1).padStart(8)} | ${species.staleness.toString().padStart(9)} | ${avgNodes.toFixed(1).padStart(9)} | ${avgConns.toFixed(1).padStart(8)} |`
    );
  }
  console.log('');

  // Top genomes
  console.log('Top 10 Genomes:');
  console.log('-'.repeat(60));
  console.log('| Rank | Genome ID | Species | Fitness | Nodes | Conns |');
  console.log('|' + '-'.repeat(58) + '|');

  const sortedGenomes = [...checkpoint.population].sort((a, b) => b.fitness - a.fitness);

  for (let i = 0; i < Math.min(10, sortedGenomes.length); i++) {
    const genome = sortedGenomes[i];
    console.log(
      `| ${(i + 1).toString().padStart(4)} | ${genome.id.slice(0, 15).padEnd(15)} | ${genome.species.toString().padStart(7)} | ${genome.fitness.toFixed(1).padStart(7)} | ${genome.nodes.length.toString().padStart(5)} | ${genome.connections.length.toString().padStart(5)} |`
    );
  }
  console.log('');

  // Complexity distribution
  const nodeCounts = checkpoint.population.map(g => g.nodes.length);
  const connCounts = checkpoint.population.map(g => g.connections.length);

  console.log('Complexity Distribution:');
  console.log(`  Nodes: min=${Math.min(...nodeCounts)}, max=${Math.max(...nodeCounts)}, avg=${(nodeCounts.reduce((a, b) => a + b, 0) / nodeCounts.length).toFixed(1)}`);
  console.log(`  Connections: min=${Math.min(...connCounts)}, max=${Math.max(...connCounts)}, avg=${(connCounts.reduce((a, b) => a + b, 0) / connCounts.length).toFixed(1)}`);
  console.log('');

  // Innovation state
  console.log(`Innovation Counter: ${checkpoint.innovationState.nextInnovation}`);
  console.log(`Structural Innovations: ${checkpoint.innovationState.history.length}`);
  console.log('');
}

// ============================================================================
// LOG VISUALIZATION
// ============================================================================

async function loadLog(logPath: string): Promise<LogEntry[]> {
  const fullPath = path.resolve(logPath);
  const content = await fs.readFile(fullPath, 'utf-8');
  const lines = content.trim().split('\n');

  // Skip header
  const entries: LogEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 7) {
      entries.push({
        generation: parseInt(parts[0], 10),
        bestFitness: parseFloat(parts[1]),
        avgFitness: parseFloat(parts[2]),
        speciesCount: parseInt(parts[3], 10),
        avgNodes: parseFloat(parts[4]),
        avgConnections: parseFloat(parts[5]),
        timeMs: parseFloat(parts[6]),
      });
    }
  }

  return entries;
}

function renderAsciiChart(
  data: number[],
  width: number,
  height: number,
  label: string
): string[] {
  const lines: string[] = [];

  if (data.length === 0) {
    return ['No data'];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Create chart
  const chartWidth = width - 10; // Leave room for labels
  const chartHeight = height - 2;

  // Scale data to chart dimensions
  const scaledData = data.map(v => Math.floor(((v - min) / range) * (chartHeight - 1)));

  // Sample if too many data points
  let sampledData = scaledData;
  if (scaledData.length > chartWidth) {
    sampledData = [];
    for (let i = 0; i < chartWidth; i++) {
      const idx = Math.floor((i / chartWidth) * scaledData.length);
      sampledData.push(scaledData[idx]);
    }
  }

  // Build chart rows
  for (let row = chartHeight - 1; row >= 0; row--) {
    const value = min + (row / (chartHeight - 1)) * range;
    const valueStr = value.toFixed(0).padStart(8);
    let line = valueStr + ' |';

    for (let col = 0; col < sampledData.length; col++) {
      if (sampledData[col] >= row) {
        line += '#';
      } else {
        line += ' ';
      }
    }

    lines.push(line);
  }

  // Add x-axis
  lines.push(' '.repeat(9) + '+' + '-'.repeat(sampledData.length));
  lines.push(' '.repeat(9) + '0' + ' '.repeat(Math.max(0, sampledData.length - 10)) + data.length.toString());

  // Add label
  lines.unshift('');
  lines.unshift(label);

  return lines;
}

function visualizeLog(entries: LogEntry[], width: number, height: number): void {
  console.log('\n' + '='.repeat(60));
  console.log(' EVOLUTION PROGRESS');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Generations: ${entries.length}`);
  console.log(`Final Best Fitness: ${entries[entries.length - 1]?.bestFitness.toFixed(1) || 'N/A'}`);
  console.log(`Final Avg Fitness: ${entries[entries.length - 1]?.avgFitness.toFixed(1) || 'N/A'}`);
  console.log('');

  // Best fitness chart
  const bestFitness = entries.map(e => e.bestFitness);
  const bestChart = renderAsciiChart(bestFitness, width, height, 'Best Fitness:');
  for (const line of bestChart) {
    console.log(line);
  }
  console.log('');

  // Average fitness chart
  const avgFitness = entries.map(e => e.avgFitness);
  const avgChart = renderAsciiChart(avgFitness, width, height, 'Average Fitness:');
  for (const line of avgChart) {
    console.log(line);
  }
  console.log('');

  // Species count chart
  const speciesCounts = entries.map(e => e.speciesCount);
  const speciesChart = renderAsciiChart(speciesCounts, width, Math.floor(height / 2), 'Species Count:');
  for (const line of speciesChart) {
    console.log(line);
  }
  console.log('');

  // Statistics summary
  console.log('Statistics:');
  console.log('-'.repeat(40));
  console.log(`  Best Fitness: ${Math.max(...bestFitness).toFixed(1)} (gen ${entries[bestFitness.indexOf(Math.max(...bestFitness))]?.generation || 0})`);
  console.log(`  Avg Fitness Range: ${Math.min(...avgFitness).toFixed(1)} - ${Math.max(...avgFitness).toFixed(1)}`);
  console.log(`  Species Range: ${Math.min(...speciesCounts)} - ${Math.max(...speciesCounts)}`);

  const totalTime = entries.reduce((sum, e) => sum + e.timeMs, 0);
  console.log(`  Total Time: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);
  console.log(`  Avg Time per Gen: ${(totalTime / entries.length / 1000).toFixed(1)}s`);
  console.log('');
}

// ============================================================================
// GENOME VISUALIZATION
// ============================================================================

async function loadGenome(genomePath: string): Promise<NEATGenome> {
  const fullPath = path.resolve(genomePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  const data = JSON.parse(content);

  // Check if this is a checkpoint file
  if (data.champion) {
    return data.champion as NEATGenome;
  }
  if (data.population) {
    const population = data.population as NEATGenome[];
    population.sort((a, b) => b.fitness - a.fitness);
    return population[0];
  }

  return data as NEATGenome;
}

function visualizeGenome(genome: NEATGenome, showNetwork: boolean): void {
  console.log('\n' + '='.repeat(60));
  console.log(' GENOME STRUCTURE');
  console.log('='.repeat(60));
  console.log('');
  console.log(`ID: ${genome.id}`);
  console.log(`Generation: ${genome.generation}`);
  console.log(`Species: ${genome.species}`);
  console.log(`Fitness: ${genome.fitness.toFixed(1)}`);
  console.log('');

  // Node statistics
  const inputNodes = genome.nodes.filter(n => n.type === 'input');
  const hiddenNodes = genome.nodes.filter(n => n.type === 'hidden');
  const outputNodes = genome.nodes.filter(n => n.type === 'output');

  console.log('Nodes:');
  console.log(`  Input: ${inputNodes.length}`);
  console.log(`  Hidden: ${hiddenNodes.length}`);
  console.log(`  Output: ${outputNodes.length}`);
  console.log(`  Total: ${genome.nodes.length}`);
  console.log('');

  // Connection statistics
  const enabledConns = genome.connections.filter(c => c.enabled);
  const disabledConns = genome.connections.filter(c => !c.enabled);

  console.log('Connections:');
  console.log(`  Enabled: ${enabledConns.length}`);
  console.log(`  Disabled: ${disabledConns.length}`);
  console.log(`  Total: ${genome.connections.length}`);
  console.log('');

  // Weight statistics
  const weights = genome.connections.map(c => c.weight);
  if (weights.length > 0) {
    console.log('Weight Distribution:');
    console.log(`  Min: ${Math.min(...weights).toFixed(3)}`);
    console.log(`  Max: ${Math.max(...weights).toFixed(3)}`);
    console.log(`  Avg: ${(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(3)}`);
    console.log('');
  }

  // Activation function distribution
  const activations = new Map<string, number>();
  for (const node of genome.nodes) {
    const count = activations.get(node.activation) || 0;
    activations.set(node.activation, count + 1);
  }

  console.log('Activation Functions:');
  for (const [activation, count] of activations) {
    console.log(`  ${activation}: ${count}`);
  }
  console.log('');

  // Network topology (if requested)
  if (showNetwork) {
    console.log('Network Topology:');
    console.log('-'.repeat(60));

    // Group by layers
    const layers: Map<number, NodeGene[]> = new Map();
    layers.set(0, inputNodes);

    // Assign hidden nodes to layers based on connections
    // (simplified: just show all hidden as layer 1)
    if (hiddenNodes.length > 0) {
      layers.set(1, hiddenNodes);
    }

    layers.set(hiddenNodes.length > 0 ? 2 : 1, outputNodes);

    for (const [layer, nodes] of layers) {
      const layerName = layer === 0 ? 'INPUT' : layer === layers.size - 1 ? 'OUTPUT' : `HIDDEN ${layer}`;
      console.log(`\n${layerName} (${nodes.length} nodes):`);

      // Show first few nodes
      const showCount = Math.min(5, nodes.length);
      for (let i = 0; i < showCount; i++) {
        const node = nodes[i];
        const inConns = genome.connections.filter(c => c.outNode === node.id && c.enabled);
        const outConns = genome.connections.filter(c => c.inNode === node.id && c.enabled);
        console.log(`  Node ${node.id}: ${node.activation}, bias=${node.bias.toFixed(2)}, in=${inConns.length}, out=${outConns.length}`);
      }

      if (nodes.length > showCount) {
        console.log(`  ... and ${nodes.length - showCount} more`);
      }
    }
    console.log('');

    // Show most important connections (by absolute weight)
    console.log('Top 10 Connections (by weight magnitude):');
    const sortedConns = [...genome.connections]
      .filter(c => c.enabled)
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

    for (let i = 0; i < Math.min(10, sortedConns.length); i++) {
      const conn = sortedConns[i];
      const inNode = genome.nodes.find(n => n.id === conn.inNode);
      const outNode = genome.nodes.find(n => n.id === conn.outNode);
      console.log(`  ${conn.inNode}(${inNode?.type || '?'}) -> ${conn.outNode}(${outNode?.type || '?'}): ${conn.weight.toFixed(3)}`);
    }
    console.log('');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));

  if (config.checkpointPath) {
    const checkpoint = await loadCheckpoint(config.checkpointPath);
    visualizeCheckpoint(checkpoint);
  }

  if (config.logPath) {
    const entries = await loadLog(config.logPath);
    visualizeLog(entries, config.width, config.height);
  }

  if (config.genomePath) {
    const genome = await loadGenome(config.genomePath);
    visualizeGenome(genome, config.showNetwork);
  }

  if (!config.checkpointPath && !config.logPath && !config.genomePath) {
    printHelp();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
