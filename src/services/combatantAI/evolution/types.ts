// Ziel: TypeScript-Typen für NEAT Evolution System
// Siehe: docs/services/combatantAI/combatantAI.md

// ============================================================================
// NEAT GENOME TYPES
// ============================================================================

/**
 * Activation function types for neural network nodes.
 */
export type ActivationFunction = 'sigmoid' | 'tanh' | 'relu';

/**
 * Node types in NEAT genome.
 * - input: Receives features from the environment
 * - hidden: Internal processing nodes (added via mutation)
 * - output: Produces action scores
 */
export type NodeType = 'input' | 'hidden' | 'output';

/**
 * A single node gene in the NEAT genome.
 */
export interface NodeGene {
  /** Unique node identifier within the genome */
  id: number;
  /** Type of node (input, hidden, output) */
  type: NodeType;
  /** Activation function for this node */
  activation: ActivationFunction;
  /** Bias value added before activation */
  bias: number;
}

/**
 * A connection gene in the NEAT genome.
 * Connections can be enabled/disabled and have weights.
 */
export interface ConnectionGene {
  /** Global innovation number - enables crossover between different topologies */
  innovation: number;
  /** Source node ID */
  inNode: number;
  /** Target node ID */
  outNode: number;
  /** Connection weight */
  weight: number;
  /** Whether this connection is active */
  enabled: boolean;
}

/**
 * Complete NEAT genome representing a neural network topology.
 */
export interface NEATGenome {
  /** Unique genome identifier */
  id: string;
  /** All nodes in the network */
  nodes: NodeGene[];
  /** All connections between nodes */
  connections: ConnectionGene[];
  /** Fitness score from evaluation */
  fitness: number;
  /** Species this genome belongs to */
  species: number;
  /** Generation this genome was created in */
  generation: number;
}

// ============================================================================
// NETWORK TYPES
// ============================================================================

/**
 * A node in the built feedforward network, ready for evaluation.
 */
export interface NetworkNode {
  /** Node ID (matches NodeGene.id) */
  id: number;
  /** Node type */
  type: NodeType;
  /** Activation function */
  activation: ActivationFunction;
  /** Bias value */
  bias: number;
  /** Current activation value during forward pass */
  value: number;
}

/**
 * A connection in the built network.
 */
export interface NetworkConnection {
  /** Source node ID */
  inNode: number;
  /** Target node ID */
  outNode: number;
  /** Connection weight */
  weight: number;
}

/**
 * Built feedforward network ready for forward passes.
 * Nodes are topologically sorted for correct evaluation order.
 */
export interface FeedForwardNetwork {
  /** All nodes, topologically sorted (inputs first, then hidden, then outputs) */
  nodes: NetworkNode[];
  /** Active connections only */
  connections: NetworkConnection[];
  /** Node IDs that are inputs */
  inputIds: number[];
  /** Node IDs that are outputs */
  outputIds: number[];
  /** Map from node ID to index in nodes array for fast lookup */
  nodeIndex: Map<number, number>;
}

// ============================================================================
// INNOVATION TYPES
// ============================================================================

/**
 * Innovation tracker for consistent innovation numbers across genomes.
 * Ensures structural mutations get unique, consistent innovation numbers.
 */
export interface InnovationTracker {
  /** Get or create innovation number for a connection */
  getInnovation(inNode: number, outNode: number): number;
  /** Get the next node ID for a new node mutation */
  getNextNodeId(): number;
  /** Reset tracker for a new generation (optional - depends on NEAT variant) */
  reset(): void;
  /** Get current innovation count (for debugging/serialization) */
  getInnovationCount(): number;
  /** Get current node count (for debugging/serialization) */
  getNodeCount(): number;
}

// ============================================================================
// SERIALIZATION TYPES
// ============================================================================

/**
 * Serialized genome format for JSON persistence.
 */
export interface SerializedGenome {
  id: string;
  nodes: NodeGene[];
  connections: ConnectionGene[];
  fitness: number;
  species: number;
  generation: number;
}

/**
 * Serialized innovation tracker state.
 */
export interface SerializedInnovationState {
  innovations: Array<{ key: string; value: number }>;
  currentInnovation: number;
  currentNodeId: number;
}
