// Ziel: NEAT Mutations - Gewichts- und Struktur-Mutationen
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Mutationen sind der primäre Mechanismus für Evolution in NEAT:
// - Gewichts-Mutation (~80%) - Perturbiert oder ersetzt Gewichte
// - Node-Addition (~3%) - Fügt Hidden Node ein (splittet Connection)
// - Connection-Addition (~5%) - Fügt neue Connection hinzu
// - Toggle (~1%) - Aktiviert/Deaktiviert Connection

import type {
  NEATGenome,
  NodeGene,
  ConnectionGene,
  InnovationTracker,
} from '../../../src/services/combatantAI/evolution/types';
import {
  cloneGenome,
  getNodesByType,
  hasConnection,
} from '../../../src/services/combatantAI/evolution/neat/genome';

// ============================================================================
// MUTATION RATES
// ============================================================================

/**
 * Standard NEAT mutation rates.
 */
export interface MutationRates {
  /** Chance that weights are mutated (default: 0.8) */
  weightMutation: number;
  /** Chance of perturbation vs replacement during weight mutation (default: 0.9) */
  weightPerturbChance: number;
  /** Standard deviation for weight perturbation (default: 0.5) */
  weightPerturbStdDev: number;
  /** Chance that a new node is added (default: 0.03) */
  addNode: number;
  /** Chance that a new connection is added (default: 0.05) */
  addConnection: number;
  /** Chance that a connection is toggled (default: 0.01) */
  toggleConnection: number;
}

/**
 * Default mutation rates based on NEAT paper recommendations.
 */
export const DEFAULT_MUTATION_RATES: MutationRates = {
  weightMutation: 0.8,
  weightPerturbChance: 0.9,
  weightPerturbStdDev: 0.5,
  addNode: 0.03,
  addConnection: 0.05,
  toggleConnection: 0.01,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a random weight in range [-1, 1].
 */
function randomWeight(): number {
  return Math.random() * 2 - 1;
}

/**
 * Generates a Gaussian-distributed random number.
 * Uses Box-Muller transform.
 */
function gaussianRandom(mean = 0, stdDev = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * stdDev + mean;
}

/**
 * Clamps a value to [-maxAbs, maxAbs].
 */
function clampWeight(weight: number, maxAbs = 4): number {
  return Math.max(-maxAbs, Math.min(maxAbs, weight));
}

// ============================================================================
// WEIGHT MUTATION
// ============================================================================

/**
 * Mutates weights of connections in the genome.
 *
 * For each connection:
 * - With perturbChance: Add Gaussian noise to existing weight
 * - Otherwise: Replace with new random weight
 *
 * @param genome - Genome to mutate (cloned, original not modified)
 * @param perturbChance - Probability of perturbation vs replacement
 * @param stdDev - Standard deviation for perturbation
 * @returns New mutated genome
 */
export function mutateWeights(
  genome: NEATGenome,
  perturbChance = 0.9,
  stdDev = 0.5
): NEATGenome {
  const mutated = cloneGenome(genome);

  for (const conn of mutated.connections) {
    if (Math.random() < perturbChance) {
      // Perturb: add Gaussian noise
      conn.weight = clampWeight(conn.weight + gaussianRandom(0, stdDev));
    } else {
      // Replace: new random weight
      conn.weight = randomWeight();
    }
  }

  // Also mutate biases
  for (const node of mutated.nodes) {
    if (node.type !== 'input') {
      if (Math.random() < perturbChance) {
        node.bias = clampWeight(node.bias + gaussianRandom(0, stdDev));
      } else {
        node.bias = randomWeight();
      }
    }
  }

  return mutated;
}

// ============================================================================
// STRUCTURAL MUTATIONS
// ============================================================================

/**
 * Adds a new node by splitting an existing connection.
 *
 * Process:
 * 1. Select random enabled connection
 * 2. Disable the old connection
 * 3. Create new hidden node
 * 4. Create two new connections: old.in → new → old.out
 *    - First connection has weight 1.0 (preserves input)
 *    - Second connection has old weight (preserves behavior initially)
 *
 * @param genome - Genome to mutate
 * @param tracker - Innovation tracker for consistent numbering
 * @returns New genome with added node, or original if no valid connection
 */
export function addNode(
  genome: NEATGenome,
  tracker: InnovationTracker
): NEATGenome {
  const mutated = cloneGenome(genome);

  // Find enabled connections to split
  const enabledConnections = mutated.connections.filter(c => c.enabled);
  if (enabledConnections.length === 0) {
    return mutated; // No connections to split
  }

  // Select random connection
  const conn = enabledConnections[Math.floor(Math.random() * enabledConnections.length)];

  // Disable old connection
  conn.enabled = false;

  // Create new hidden node
  const newNodeId = tracker.getNextNodeId();
  const newNode: NodeGene = {
    id: newNodeId,
    type: 'hidden',
    activation: 'sigmoid',
    bias: 0, // Start with no bias
  };
  mutated.nodes.push(newNode);

  // Create two new connections
  // inNode → newNode (weight 1.0 to preserve input)
  const conn1: ConnectionGene = {
    innovation: tracker.getInnovation(conn.inNode, newNodeId),
    inNode: conn.inNode,
    outNode: newNodeId,
    weight: 1.0,
    enabled: true,
  };

  // newNode → outNode (old weight to preserve behavior)
  const conn2: ConnectionGene = {
    innovation: tracker.getInnovation(newNodeId, conn.outNode),
    inNode: newNodeId,
    outNode: conn.outNode,
    weight: conn.weight,
    enabled: true,
  };

  mutated.connections.push(conn1, conn2);

  return mutated;
}

/**
 * Adds a new connection between two previously unconnected nodes.
 *
 * Rules:
 * - Cannot connect input to input
 * - Cannot connect output to anything (outputs are sinks)
 * - Cannot create self-loops
 * - Connection must not already exist
 *
 * @param genome - Genome to mutate
 * @param tracker - Innovation tracker for consistent numbering
 * @param maxAttempts - Maximum attempts to find valid connection
 * @returns New genome with added connection, or original if none found
 */
export function addConnection(
  genome: NEATGenome,
  tracker: InnovationTracker,
  maxAttempts = 20
): NEATGenome {
  const mutated = cloneGenome(genome);

  // Get node IDs by type
  const inputIds = getNodesByType(mutated, 'input');
  const hiddenIds = getNodesByType(mutated, 'hidden');
  const outputIds = getNodesByType(mutated, 'output');

  // Valid source nodes: input, hidden
  const sourceIds = [...inputIds, ...hiddenIds];
  // Valid target nodes: hidden, output
  const targetIds = [...hiddenIds, ...outputIds];

  if (sourceIds.length === 0 || targetIds.length === 0) {
    return mutated; // No valid nodes
  }

  // Try to find a valid connection
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const inNode = sourceIds[Math.floor(Math.random() * sourceIds.length)];
    const outNode = targetIds[Math.floor(Math.random() * targetIds.length)];

    // Skip self-loops
    if (inNode === outNode) continue;

    // Skip existing connections
    if (hasConnection(mutated, inNode, outNode)) continue;

    // Check for cycles (simplified: prevent hidden→input, output→anything)
    const inNodeType = mutated.nodes.find(n => n.id === inNode)?.type;
    const outNodeType = mutated.nodes.find(n => n.id === outNode)?.type;

    // Hidden can connect to hidden or output, but watch for cycles
    // Simplified check: ensure outNode is not "earlier" than inNode
    // In practice, feedforward networks process input→hidden→output
    if (outNodeType === 'input') continue;

    // Create new connection
    const newConn: ConnectionGene = {
      innovation: tracker.getInnovation(inNode, outNode),
      inNode,
      outNode,
      weight: randomWeight(),
      enabled: true,
    };

    mutated.connections.push(newConn);
    return mutated;
  }

  // No valid connection found
  return mutated;
}

/**
 * Toggles the enabled state of a random connection.
 *
 * @param genome - Genome to mutate
 * @returns New genome with toggled connection
 */
export function toggleConnection(genome: NEATGenome): NEATGenome {
  const mutated = cloneGenome(genome);

  if (mutated.connections.length === 0) {
    return mutated;
  }

  // Select random connection
  const conn = mutated.connections[Math.floor(Math.random() * mutated.connections.length)];
  conn.enabled = !conn.enabled;

  return mutated;
}

// ============================================================================
// COMBINED MUTATION
// ============================================================================

/**
 * Applies all mutations to a genome based on configured rates.
 *
 * @param genome - Genome to mutate
 * @param tracker - Innovation tracker
 * @param rates - Mutation rates (default: DEFAULT_MUTATION_RATES)
 * @returns New mutated genome
 */
export function mutate(
  genome: NEATGenome,
  tracker: InnovationTracker,
  rates: Partial<MutationRates> = {}
): NEATGenome {
  const r = { ...DEFAULT_MUTATION_RATES, ...rates };
  let mutated = cloneGenome(genome);

  // Weight mutation (most common)
  if (Math.random() < r.weightMutation) {
    mutated = mutateWeights(mutated, r.weightPerturbChance, r.weightPerturbStdDev);
    // Keep same ID since cloneGenome generates new one
    mutated.id = genome.id + '-m';
  }

  // Structural mutations (rare)
  if (Math.random() < r.addNode) {
    mutated = addNode(mutated, tracker);
  }

  if (Math.random() < r.addConnection) {
    mutated = addConnection(mutated, tracker);
  }

  if (Math.random() < r.toggleConnection) {
    mutated = toggleConnection(mutated);
  }

  return mutated;
}
