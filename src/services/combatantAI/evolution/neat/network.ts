// Ziel: Network-Aufbau und Forward-Pass für NEAT Genomes
// Siehe: docs/services/combatantAI/combatantAI.md
//
// buildNetwork: Topologische Sortierung (Kahn's Algorithmus) für korrekten Forward-Pass
// forward: Propagiert Inputs durch das Netzwerk und liefert Outputs

import type {
  NEATGenome,
  FeedForwardNetwork,
  NetworkNode,
  NetworkConnection,
  ActivationFunction,
} from '../types';

// ============================================================================
// ACTIVATION FUNCTIONS
// ============================================================================

/**
 * Applies activation function to a value.
 */
function activate(x: number, fn: ActivationFunction): number {
  switch (fn) {
    case 'sigmoid':
      // Clamp input to prevent overflow
      const clampedSig = Math.max(-500, Math.min(500, x));
      return 1 / (1 + Math.exp(-clampedSig));
    case 'tanh':
      return Math.tanh(x);
    case 'relu':
      return Math.max(0, x);
  }
}

// ============================================================================
// NETWORK BUILDING
// ============================================================================

/**
 * Builds a feedforward network from a NEAT genome.
 *
 * Uses Kahn's algorithm for topological sorting to ensure nodes are
 * evaluated in the correct order (dependencies before dependents).
 *
 * Only enabled connections are included in the built network.
 *
 * @param genome - The NEAT genome to build from
 * @returns A FeedForwardNetwork ready for forward passes
 */
export function buildNetwork(genome: NEATGenome): FeedForwardNetwork {
  // 1. Filter to enabled connections only
  const activeConnections = genome.connections.filter(c => c.enabled);

  // 2. Build in-degree map for topological sort
  const inDegree = new Map<number, number>();
  const outgoing = new Map<number, number[]>();

  // Initialize all nodes
  for (const node of genome.nodes) {
    inDegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  // Count incoming edges from enabled connections
  for (const conn of activeConnections) {
    inDegree.set(conn.outNode, (inDegree.get(conn.outNode) ?? 0) + 1);
    outgoing.get(conn.inNode)!.push(conn.outNode);
  }

  // 3. Kahn's algorithm for topological sort
  const sorted: number[] = [];
  const queue: number[] = [];

  // Start with nodes that have no incoming edges (inputs and isolated nodes)
  for (const node of genome.nodes) {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeId);

    // Reduce in-degree of all nodes this one connects to
    for (const outNodeId of outgoing.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(outNodeId) ?? 1) - 1;
      inDegree.set(outNodeId, newDegree);
      if (newDegree === 0) {
        queue.push(outNodeId);
      }
    }
  }

  // If we didn't sort all nodes, there's a cycle (shouldn't happen in valid NEAT)
  if (sorted.length !== genome.nodes.length) {
    console.warn(
      `[network] Cycle detected in genome ${genome.id}. ` +
      `Sorted ${sorted.length}/${genome.nodes.length} nodes.`
    );
  }

  // 4. Build the network structure
  const nodeMap = new Map(genome.nodes.map(n => [n.id, n]));
  const nodeIndex = new Map<number, number>();

  const nodes: NetworkNode[] = sorted.map((id, index) => {
    nodeIndex.set(id, index);
    const gene = nodeMap.get(id)!;
    return {
      id: gene.id,
      type: gene.type,
      activation: gene.activation,
      bias: gene.bias,
      value: 0,
    };
  });

  const connections: NetworkConnection[] = activeConnections.map(c => ({
    inNode: c.inNode,
    outNode: c.outNode,
    weight: c.weight,
  }));

  // 5. Collect input and output node IDs
  const inputIds = genome.nodes.filter(n => n.type === 'input').map(n => n.id);
  const outputIds = genome.nodes.filter(n => n.type === 'output').map(n => n.id);

  return {
    nodes,
    connections,
    inputIds,
    outputIds,
    nodeIndex,
  };
}

// ============================================================================
// FORWARD PASS
// ============================================================================

/**
 * Performs a forward pass through the network.
 *
 * Algorithm:
 * 1. Reset all node values to 0
 * 2. Set input node values from inputs array
 * 3. For each node (in topological order):
 *    - Sum weighted inputs from all incoming connections
 *    - Add bias
 *    - Apply activation function
 * 4. Return output node values
 *
 * @param network - The built network to evaluate
 * @param inputs - Input values (must match inputIds length)
 * @returns Output values (matches outputIds length)
 */
export function forward(network: FeedForwardNetwork, inputs: number[]): number[] {
  // 1. Reset all values
  for (const node of network.nodes) {
    node.value = 0;
  }

  // 2. Set input values
  for (let i = 0; i < network.inputIds.length; i++) {
    const inputId = network.inputIds[i];
    const nodeIdx = network.nodeIndex.get(inputId);
    if (nodeIdx !== undefined) {
      network.nodes[nodeIdx].value = inputs[i] ?? 0;
    }
  }

  // 3. Group connections by output node for efficient lookup
  const incomingConnections = new Map<number, NetworkConnection[]>();
  for (const conn of network.connections) {
    const existing = incomingConnections.get(conn.outNode) ?? [];
    existing.push(conn);
    incomingConnections.set(conn.outNode, existing);
  }

  // 4. Forward propagation (nodes already topologically sorted)
  for (const node of network.nodes) {
    if (node.type === 'input') {
      // Input nodes: just apply activation to pass-through value
      // (typically sigmoid of 0 + input value)
      continue;
    }

    // Sum weighted inputs
    let sum = node.bias;
    const incoming = incomingConnections.get(node.id) ?? [];
    for (const conn of incoming) {
      const inNodeIdx = network.nodeIndex.get(conn.inNode);
      if (inNodeIdx !== undefined) {
        sum += network.nodes[inNodeIdx].value * conn.weight;
      }
    }

    // Apply activation function
    node.value = activate(sum, node.activation);
  }

  // 5. Collect output values
  return network.outputIds.map(id => {
    const idx = network.nodeIndex.get(id);
    return idx !== undefined ? network.nodes[idx].value : 0;
  });
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Gets the complexity of a network (nodes + connections).
 * Useful for tracking structural evolution.
 */
export function getNetworkComplexity(network: FeedForwardNetwork): {
  nodeCount: number;
  connectionCount: number;
  hiddenCount: number;
} {
  return {
    nodeCount: network.nodes.length,
    connectionCount: network.connections.length,
    hiddenCount: network.nodes.filter(n => n.type === 'hidden').length,
  };
}

/**
 * Creates a deep copy of a network for independent evaluation.
 * Useful when running multiple forward passes in parallel.
 */
export function cloneNetwork(network: FeedForwardNetwork): FeedForwardNetwork {
  return {
    nodes: network.nodes.map(n => ({ ...n })),
    connections: network.connections.map(c => ({ ...c })),
    inputIds: [...network.inputIds],
    outputIds: [...network.outputIds],
    nodeIndex: new Map(network.nodeIndex),
  };
}

/**
 * Resets all node values to 0.
 * Call before a new forward pass if reusing the network.
 */
export function resetNetwork(network: FeedForwardNetwork): void {
  for (const node of network.nodes) {
    node.value = 0;
  }
}
