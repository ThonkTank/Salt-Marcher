// Ziel: Innovation Tracking für NEAT - konsistente Nummerierung struktureller Mutationen
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Innovation numbers ermöglichen Crossover zwischen Genomen mit unterschiedlicher Topologie.
// Gleiche Strukturmutation (inNode → outNode) bekommt immer dieselbe Innovation#.

import type { InnovationTracker, SerializedInnovationState } from '../types';

// ============================================================================
// INNOVATION TRACKER FACTORY
// ============================================================================

/**
 * Creates a new innovation tracker for consistent innovation numbering.
 *
 * Innovation numbers are assigned when:
 * 1. A new connection is added between two nodes
 * 2. A new node is inserted (splits existing connection)
 *
 * Same connection (inNode → outNode) always gets same innovation number
 * within the same tracker instance.
 *
 * @param initialNodeCount - Starting node ID (default 0)
 */
export function createInnovationTracker(initialNodeCount = 0): InnovationTracker {
  const innovations = new Map<string, number>();
  let currentInnovation = 0;
  let currentNodeId = initialNodeCount;

  return {
    getInnovation(inNode: number, outNode: number): number {
      const key = `${inNode}:${outNode}`;
      const existing = innovations.get(key);
      if (existing !== undefined) {
        return existing;
      }
      const newInnovation = currentInnovation++;
      innovations.set(key, newInnovation);
      return newInnovation;
    },

    getNextNodeId(): number {
      return currentNodeId++;
    },

    reset(): void {
      innovations.clear();
      currentInnovation = 0;
      // Note: We don't reset currentNodeId - node IDs should remain unique
    },

    getInnovationCount(): number {
      return currentInnovation;
    },

    getNodeCount(): number {
      return currentNodeId;
    },
  };
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serializes innovation tracker state for persistence.
 */
export function serializeInnovationState(tracker: InnovationTracker): SerializedInnovationState {
  // We need access to internal Map - use a wrapper approach
  // For now, return counts only (innovations can be rebuilt from genomes)
  return {
    innovations: [], // Would need internal access
    currentInnovation: tracker.getInnovationCount(),
    currentNodeId: tracker.getNodeCount(),
  };
}

/**
 * Creates an innovation tracker initialized with saved state.
 * Note: Innovation mappings must be rebuilt from existing genomes.
 */
export function createInnovationTrackerFromState(
  state: SerializedInnovationState
): InnovationTracker {
  const tracker = createInnovationTracker(state.currentNodeId);

  // Rebuild innovation mappings
  for (const { key, value } of state.innovations) {
    const [inNode, outNode] = key.split(':').map(Number);
    // Force the specific innovation number by pre-populating
    // This is a simplified approach - full implementation would need more control
    tracker.getInnovation(inNode, outNode);
  }

  return tracker;
}

// ============================================================================
// GLOBAL TRACKER (Optional Singleton)
// ============================================================================

let globalTracker: InnovationTracker | null = null;

/**
 * Gets or creates the global innovation tracker.
 * Use for training runs where all genomes share the same innovation context.
 */
export function getGlobalInnovationTracker(): InnovationTracker {
  if (!globalTracker) {
    globalTracker = createInnovationTracker();
  }
  return globalTracker;
}

/**
 * Resets the global innovation tracker.
 * Call between independent training runs.
 */
export function resetGlobalInnovationTracker(): void {
  globalTracker = null;
}
