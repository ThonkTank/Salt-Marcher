// Ziel: Unified exports fuer Layer-System
// Siehe: docs/services/combatantAI/buildBaseActionLayer.md, buildThreatMap.md

// ============================================================================
// INITIALIZATION (Combat-Start)
// ============================================================================

export {
  initializeLayers,
  augmentWithLayers,
  buildActionLayerData,
  buildEffectLayers,
} from './initialization';

// ============================================================================
// BASE RESOLUTION (Cache)
// ============================================================================

export {
  resolveBaseAgainstTarget,
  getBaseResolution,
  precomputeBaseResolutions,
} from './baseResolution';

// ============================================================================
// EFFECT APPLICATION (Dynamic)
// ============================================================================

export {
  applyEffectsToBase,
  getFullResolution,
  collectActiveEffects,
  isEffectActiveAt,
} from './effectApplication';

// ============================================================================
// THREAT MAP (Queries)
// ============================================================================

export {
  buildThreatMap,
  getThreatAt,
  getSupportAt,
  getDominantThreat,
  getAvailableActionsAt,
} from './threatMap';

// ============================================================================
// OPPORTUNITY MAP & PROJECTION (neu: OpportunityMap + Distance Decay)
// ============================================================================

export {
  getOpportunityAt,
  buildOpportunityMap,
  projectMapWithDecay,
  projectThreatMapWithDecay,
} from './threatMap';

// ============================================================================
// ESCAPE DANGER
// ============================================================================

export {
  buildEscapeDangerMap,
  calculateDangerScoresBatch,
} from './escapeDanger';

// ============================================================================
// REACTION LAYERS
// ============================================================================

export {
  findReactionLayers,
  wouldTriggerReaction,
  calculateExpectedReactionCost,
} from './reactionLayers';

// ============================================================================
// POSITION UPDATES
// ============================================================================

export {
  updateLayersForMovement,
  invalidateTargetCache,
} from './positionUpdates';

// ============================================================================
// DEBUG
// ============================================================================

export {
  visualizeActionRange,
  explainTargetResolution,
} from './debug';

// ============================================================================
// TYPE RE-EXPORTS (from @/types/combat)
// ============================================================================

export type {
  CellRangeData,
  BaseResolvedData,
  FinalResolvedData,
  ActionLayerData,
  ActionWithLayer,
  EffectCondition,
  EffectLayerData,
  LayerFilter,
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  CombatStateWithLayers,
  ThreatMapEntry,
  ReactionContext,
  ReactionResult,
} from '@/types/combat';

export { hasLayerData, combatantHasLayers } from '@/types/combat';
