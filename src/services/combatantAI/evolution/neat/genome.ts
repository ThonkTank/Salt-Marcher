// Ziel: NEAT Genome Erstellung und Serialisierung
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Genome repräsentiert die komplette Netzwerk-Topologie + Gewichte.
// Minimale Genomes starten mit direkten Input→Output Verbindungen.

import type {
  NEATGenome,
  NodeGene,
  ConnectionGene,
  InnovationTracker,
  SerializedGenome,
} from '../types';

// ============================================================================
// RANDOM UTILITIES
// ============================================================================

/**
 * Generates a random weight in range [-1, 1].
 */
function randomWeight(): number {
  return Math.random() * 2 - 1;
}

/**
 * Generates a unique genome ID.
 */
function generateGenomeId(): string {
  return `genome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// GENOME CREATION
// ============================================================================

/**
 * Creates a minimal NEAT genome with fully connected input→output topology.
 *
 * The minimal genome has:
 * - inputSize input nodes (IDs: 0 to inputSize-1)
 * - outputSize output nodes (IDs: inputSize to inputSize+outputSize-1)
 * - inputSize × outputSize connections (all enabled)
 *
 * This is the starting point for NEAT evolution - structural complexity
 * is added via mutations over generations.
 *
 * @param inputSize - Number of input features
 * @param outputSize - Number of output values (action scores)
 * @param innovation - Innovation tracker for consistent numbering
 */
export function createMinimalGenome(
  inputSize: number,
  outputSize: number,
  innovation: InnovationTracker
): NEATGenome {
  const nodes: NodeGene[] = [];
  const connections: ConnectionGene[] = [];

  // Create input nodes
  const inputNodeIds: number[] = [];
  for (let i = 0; i < inputSize; i++) {
    const nodeId = innovation.getNextNodeId();
    inputNodeIds.push(nodeId);
    nodes.push({
      id: nodeId,
      type: 'input',
      activation: 'sigmoid', // Input nodes pass through unchanged anyway
      bias: 0,
    });
  }

  // Create output nodes
  const outputNodeIds: number[] = [];
  for (let o = 0; o < outputSize; o++) {
    const nodeId = innovation.getNextNodeId();
    outputNodeIds.push(nodeId);
    nodes.push({
      id: nodeId,
      type: 'output',
      activation: 'sigmoid',
      bias: randomWeight(),
    });
  }

  // Create full connections: every input → every output
  for (const inNodeId of inputNodeIds) {
    for (const outNodeId of outputNodeIds) {
      connections.push({
        innovation: innovation.getInnovation(inNodeId, outNodeId),
        inNode: inNodeId,
        outNode: outNodeId,
        weight: randomWeight(),
        enabled: true,
      });
    }
  }

  return {
    id: generateGenomeId(),
    nodes,
    connections,
    fitness: 0,
    species: 0,
    generation: 0,
  };
}

/**
 * Creates a deep copy of a genome.
 * Useful for mutations that shouldn't affect the original.
 */
export function cloneGenome(genome: NEATGenome): NEATGenome {
  return {
    id: generateGenomeId(),
    nodes: genome.nodes.map(n => ({ ...n })),
    connections: genome.connections.map(c => ({ ...c })),
    fitness: 0, // Reset fitness for new genome
    species: genome.species,
    generation: genome.generation,
  };
}

// ============================================================================
// GENOME QUERIES
// ============================================================================

/**
 * Gets all node IDs of a specific type.
 */
export function getNodesByType(genome: NEATGenome, type: NodeGene['type']): number[] {
  return genome.nodes.filter(n => n.type === type).map(n => n.id);
}

/**
 * Gets the maximum node ID in the genome.
 */
export function getMaxNodeId(genome: NEATGenome): number {
  return Math.max(...genome.nodes.map(n => n.id));
}

/**
 * Gets the maximum innovation number in the genome.
 */
export function getMaxInnovation(genome: NEATGenome): number {
  if (genome.connections.length === 0) return -1;
  return Math.max(...genome.connections.map(c => c.innovation));
}

/**
 * Checks if a connection already exists between two nodes.
 */
export function hasConnection(genome: NEATGenome, inNode: number, outNode: number): boolean {
  return genome.connections.some(c => c.inNode === inNode && c.outNode === outNode);
}

/**
 * Gets a node by ID.
 */
export function getNodeById(genome: NEATGenome, id: number): NodeGene | undefined {
  return genome.nodes.find(n => n.id === id);
}

/**
 * Gets a connection by innovation number.
 */
export function getConnectionByInnovation(
  genome: NEATGenome,
  innovation: number
): ConnectionGene | undefined {
  return genome.connections.find(c => c.innovation === innovation);
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serializes a genome to JSON string.
 * Genome structure is already JSON-compatible.
 */
export function serializeGenome(genome: NEATGenome): string {
  const serialized: SerializedGenome = {
    id: genome.id,
    nodes: genome.nodes,
    connections: genome.connections,
    fitness: genome.fitness,
    species: genome.species,
    generation: genome.generation,
  };
  return JSON.stringify(serialized, null, 2);
}

/**
 * Deserializes a genome from JSON string.
 */
export function deserializeGenome(json: string): NEATGenome {
  const parsed = JSON.parse(json) as SerializedGenome;
  return {
    id: parsed.id,
    nodes: parsed.nodes,
    connections: parsed.connections,
    fitness: parsed.fitness,
    species: parsed.species,
    generation: parsed.generation,
  };
}

/**
 * Validates genome structure integrity.
 * Returns array of error messages (empty if valid).
 */
export function validateGenome(genome: NEATGenome): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(genome.nodes.map(n => n.id));

  // Check for duplicate node IDs
  if (nodeIds.size !== genome.nodes.length) {
    errors.push('Duplicate node IDs found');
  }

  // Check connection references
  for (const conn of genome.connections) {
    if (!nodeIds.has(conn.inNode)) {
      errors.push(`Connection references non-existent inNode: ${conn.inNode}`);
    }
    if (!nodeIds.has(conn.outNode)) {
      errors.push(`Connection references non-existent outNode: ${conn.outNode}`);
    }
  }

  // Check for required node types
  const inputNodes = genome.nodes.filter(n => n.type === 'input');
  const outputNodes = genome.nodes.filter(n => n.type === 'output');

  if (inputNodes.length === 0) {
    errors.push('Genome has no input nodes');
  }
  if (outputNodes.length === 0) {
    errors.push('Genome has no output nodes');
  }

  return errors;
}
