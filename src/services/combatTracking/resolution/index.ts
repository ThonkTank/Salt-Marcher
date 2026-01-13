// Ziel: Re-exports fuer Resolution Pipeline
// Siehe: docs/services/combatTracking/actionResolution.md

// Pipeline Step 1: Target Selection
export {
  findTargets,
  isValidTarget,
  isInRange,
  getValidCandidates,
  type TargetResult,
  type FindTargetsContext,
} from './findTargets';

// Pipeline Step 2: Modifier Gathering (Unified Architecture)
export {
  getModifiers,
  gatherModifiers, // Legacy alias
  resolveAdvantageState,
  createEmptyModifierSet,
  type ModifierSet,
  type AdvantageState,
  type GetModifiersContext,
  type GatherModifiersContext, // Legacy alias
} from './getModifiers';
