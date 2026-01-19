// Ziel: Re-exports fuer Resolution Pipeline
// Siehe: docs/services/combatTracking/actionResolution.md

// Pipeline Step 0: Spell Stats Resolution
export { resolveSpellWithCaster } from './resolveSpellStats';

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
  resolveAdvantageState,
  createEmptyModifierSet,
  type ModifierSet,
  type AdvantageState,
  type GetModifiersContext,
} from './getModifiers';

// Pipeline Step 3: Success Determination
export {
  determineSuccess,
  // Helpers also used by resolveEffects for secondary saves
  getSaveBonus,
  calculateSaveFailChance,
} from './determineSuccess';

// Pipeline Step 4: Effect Resolution (Single Source of Truth)
export {
  resolveEffects,
} from './resolveEffects';

// Re-export SuccessResult type from combat.ts (used by determineSuccess)
export type { SuccessResult } from '@/types/combat';

// Pipeline Orchestrator
export { resolveAction } from './resolveAction';
