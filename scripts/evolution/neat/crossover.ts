// Ziel: NEAT Crossover - Innovation-aligned gene recombination
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// NEAT Crossover verwendet Innovation Numbers um Gene zu alignieren:
// - Matching Genes (gleiche Innovation#): Zufällig von Elternteil auswählen
// - Disjoint Genes (in Lücken): Vom fitteren Elternteil
// - Excess Genes (über max Innovation): Vom fitteren Elternteil

import type {
  NEATGenome,
  NodeGene,
  ConnectionGene,
} from '../../../src/services/combatantAI/evolution/types';

// ============================================================================
// COMPATIBILITY COEFFICIENTS
// ============================================================================

/**
 * Coefficients for compatibility distance calculation.
 */
export interface CompatibilityCoefficients {
  /** Weight for excess genes (default: 1.0) */
  c1: number;
  /** Weight for disjoint genes (default: 1.0) */
  c2: number;
  /** Weight for average weight difference (default: 0.4) */
  c3: number;
}

/**
 * Default compatibility coefficients from NEAT paper.
 */
export const DEFAULT_COMPATIBILITY_COEFFICIENTS: CompatibilityCoefficients = {
  c1: 1.0,
  c2: 1.0,
  c3: 0.4,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a map from innovation number to connection gene.
 */
function createInnovationMap(genome: NEATGenome): Map<number, ConnectionGene> {
  const map = new Map<number, ConnectionGene>();
  for (const conn of genome.connections) {
    map.set(conn.innovation, conn);
  }
  return map;
}

/**
 * Gets the maximum innovation number in a genome.
 */
function getMaxInnovation(genome: NEATGenome): number {
  if (genome.connections.length === 0) return -1;
  return Math.max(...genome.connections.map(c => c.innovation));
}

/**
 * Creates a map from node ID to node gene.
 */
function createNodeMap(genome: NEATGenome): Map<number, NodeGene> {
  const map = new Map<number, NodeGene>();
  for (const node of genome.nodes) {
    map.set(node.id, node);
  }
  return map;
}

/**
 * Generates a new genome ID.
 */
function generateGenomeId(): string {
  return `genome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// COMPATIBILITY DISTANCE
// ============================================================================

/**
 * Calculates the compatibility distance between two genomes.
 *
 * Formula: δ = (c1 × E / N) + (c2 × D / N) + (c3 × W̄)
 *
 * Where:
 * - E = number of excess genes
 * - D = number of disjoint genes
 * - N = number of genes in larger genome (normalized, min 1)
 * - W̄ = average weight difference of matching genes
 *
 * @param genomeA - First genome
 * @param genomeB - Second genome
 * @param coefficients - Compatibility coefficients
 * @returns Compatibility distance (lower = more similar)
 */
export function calculateCompatibility(
  genomeA: NEATGenome,
  genomeB: NEATGenome,
  coefficients: Partial<CompatibilityCoefficients> = {}
): number {
  const c = { ...DEFAULT_COMPATIBILITY_COEFFICIENTS, ...coefficients };

  const mapA = createInnovationMap(genomeA);
  const mapB = createInnovationMap(genomeB);

  const maxA = getMaxInnovation(genomeA);
  const maxB = getMaxInnovation(genomeB);
  const maxShared = Math.min(maxA, maxB);

  let matching = 0;
  let disjoint = 0;
  let excess = 0;
  let weightDiffSum = 0;

  // Collect all innovation numbers
  const allInnovations = new Set([...mapA.keys(), ...mapB.keys()]);

  for (const innovation of allInnovations) {
    const connA = mapA.get(innovation);
    const connB = mapB.get(innovation);

    if (connA && connB) {
      // Matching gene
      matching++;
      weightDiffSum += Math.abs(connA.weight - connB.weight);
    } else if (innovation > maxShared) {
      // Excess gene (beyond the shorter genome's max)
      excess++;
    } else {
      // Disjoint gene (within shared range but missing from one)
      disjoint++;
    }
  }

  // Normalize by larger genome size (min 1 to avoid division by zero)
  const N = Math.max(1, Math.max(genomeA.connections.length, genomeB.connections.length));

  // Average weight difference
  const avgWeightDiff = matching > 0 ? weightDiffSum / matching : 0;

  // Calculate compatibility distance
  const distance = (c.c1 * excess / N) + (c.c2 * disjoint / N) + (c.c3 * avgWeightDiff);

  return distance;
}

// ============================================================================
// CROSSOVER
// ============================================================================

/**
 * Performs NEAT crossover between two parent genomes.
 *
 * Process:
 * 1. Align genes by innovation number
 * 2. Matching genes: randomly inherit from either parent
 * 3. Disjoint/Excess genes: inherit from fitter parent
 * 4. Disabled genes: 75% chance to stay disabled if disabled in either parent
 *
 * The fitter parent is parentA (convention: caller ensures this).
 * If fitness is equal, genes are inherited from both parents.
 *
 * @param parentA - First parent (should be fitter or equal)
 * @param parentB - Second parent (should be less fit or equal)
 * @param equalFitness - Whether parents have equal fitness (default: false)
 * @returns Offspring genome combining traits from both parents
 */
export function crossover(
  parentA: NEATGenome,
  parentB: NEATGenome,
  equalFitness = false
): NEATGenome {
  const mapA = createInnovationMap(parentA);
  const mapB = createInnovationMap(parentB);
  const nodeMapA = createNodeMap(parentA);
  const nodeMapB = createNodeMap(parentB);

  const offspringConnections: ConnectionGene[] = [];
  const neededNodeIds = new Set<number>();

  // Collect all innovation numbers from both parents
  const allInnovations = new Set([...mapA.keys(), ...mapB.keys()]);

  for (const innovation of allInnovations) {
    const connA = mapA.get(innovation);
    const connB = mapB.get(innovation);

    let chosenConn: ConnectionGene | undefined;

    if (connA && connB) {
      // Matching gene: randomly choose from either parent
      chosenConn = Math.random() < 0.5 ? connA : connB;

      // Handle disabled status: 75% chance to stay disabled if either parent has it disabled
      if (!connA.enabled || !connB.enabled) {
        if (Math.random() < 0.75) {
          chosenConn = { ...chosenConn, enabled: false };
        }
      }
    } else if (connA) {
      // Only in parentA (fitter or equal)
      if (equalFitness) {
        // Equal fitness: 50% chance to include disjoint/excess from A
        if (Math.random() < 0.5) {
          chosenConn = connA;
        }
      } else {
        // A is fitter: always include
        chosenConn = connA;
      }
    } else if (connB) {
      // Only in parentB
      if (equalFitness) {
        // Equal fitness: 50% chance to include disjoint/excess from B
        if (Math.random() < 0.5) {
          chosenConn = connB;
        }
      }
      // If A is fitter, don't include genes only in B
    }

    if (chosenConn) {
      offspringConnections.push({ ...chosenConn });
      neededNodeIds.add(chosenConn.inNode);
      neededNodeIds.add(chosenConn.outNode);
    }
  }

  // Collect nodes needed for connections + all input/output nodes
  const offspringNodes: NodeGene[] = [];

  // Always include all input and output nodes from fitter parent
  for (const node of parentA.nodes) {
    if (node.type === 'input' || node.type === 'output') {
      offspringNodes.push({ ...node });
      neededNodeIds.delete(node.id);
    }
  }

  // Include hidden nodes needed for connections
  for (const nodeId of neededNodeIds) {
    // Try to get from A first, then B
    const nodeA = nodeMapA.get(nodeId);
    const nodeB = nodeMapB.get(nodeId);
    const node = nodeA ?? nodeB;

    if (node && node.type === 'hidden') {
      // If both parents have this hidden node, randomly choose
      if (nodeA && nodeB && nodeA.type === 'hidden' && nodeB.type === 'hidden') {
        const chosen = Math.random() < 0.5 ? nodeA : nodeB;
        offspringNodes.push({ ...chosen });
      } else if (node) {
        offspringNodes.push({ ...node });
      }
    }
  }

  // Sort nodes: inputs first, then hidden, then outputs
  offspringNodes.sort((a, b) => {
    const typeOrder = { input: 0, hidden: 1, output: 2 };
    return typeOrder[a.type] - typeOrder[b.type];
  });

  return {
    id: generateGenomeId(),
    nodes: offspringNodes,
    connections: offspringConnections,
    fitness: 0, // Reset fitness for new offspring
    species: 0, // Will be assigned during speciation
    generation: Math.max(parentA.generation, parentB.generation) + 1,
  };
}

/**
 * Performs crossover ensuring the fitter parent is first.
 *
 * @param parentA - First parent
 * @param parentB - Second parent
 * @returns Offspring genome
 */
export function crossoverByFitness(
  parentA: NEATGenome,
  parentB: NEATGenome
): NEATGenome {
  const equalFitness = Math.abs(parentA.fitness - parentB.fitness) < 0.001;

  if (equalFitness) {
    return crossover(parentA, parentB, true);
  }

  // Ensure fitter parent is first
  if (parentA.fitness >= parentB.fitness) {
    return crossover(parentA, parentB, false);
  } else {
    return crossover(parentB, parentA, false);
  }
}
