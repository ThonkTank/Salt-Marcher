// Ziel: Public API für Evolution/NEAT Module
// Siehe: docs/services/combatantAI/combatantAI.md

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Genome Types
  ActivationFunction,
  NodeType,
  NodeGene,
  ConnectionGene,
  NEATGenome,
  // Network Types
  NetworkNode,
  NetworkConnection,
  FeedForwardNetwork,
  // Innovation Types
  InnovationTracker,
  // Serialization Types
  SerializedGenome,
  SerializedInnovationState,
} from './types';

// ============================================================================
// NEAT CORE
// ============================================================================

export {
  // Innovation Tracking
  createInnovationTracker,
  serializeInnovationState,
  createInnovationTrackerFromState,
  getGlobalInnovationTracker,
  resetGlobalInnovationTracker,
  // Genome Operations
  createMinimalGenome,
  cloneGenome,
  getNodesByType,
  getMaxNodeId,
  getMaxInnovation,
  hasConnection,
  getNodeById,
  getConnectionByInnovation,
  serializeGenome,
  deserializeGenome,
  validateGenome,
  // Network Operations
  buildNetwork,
  forward,
  getNetworkComplexity,
  cloneNetwork,
  resetNetwork,
} from './neat';

// ============================================================================
// FEATURE EXTRACTION
// ============================================================================

export {
  FEATURE_DIMENSIONS,
  extractStateFeatures,
  extractActionFeatures,
  combineFeatures,
} from './featureExtraction';
