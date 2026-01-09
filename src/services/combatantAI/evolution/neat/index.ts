// Ziel: Re-exports für NEAT Core Module
// Siehe: docs/services/combatantAI/combatantAI.md

// ============================================================================
// INNOVATION TRACKING
// ============================================================================

export {
  createInnovationTracker,
  serializeInnovationState,
  createInnovationTrackerFromState,
  getGlobalInnovationTracker,
  resetGlobalInnovationTracker,
} from './innovation';

// ============================================================================
// GENOME OPERATIONS
// ============================================================================

export {
  // Creation
  createMinimalGenome,
  cloneGenome,
  // Queries
  getNodesByType,
  getMaxNodeId,
  getMaxInnovation,
  hasConnection,
  getNodeById,
  getConnectionByInnovation,
  // Serialization
  serializeGenome,
  deserializeGenome,
  validateGenome,
} from './genome';

// ============================================================================
// NETWORK OPERATIONS
// ============================================================================

export {
  // Building
  buildNetwork,
  // Evaluation
  forward,
  // Utilities
  getNetworkComplexity,
  cloneNetwork,
  resetNetwork,
} from './network';
