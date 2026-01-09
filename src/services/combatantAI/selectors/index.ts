// Ziel: Unified exports für Selector-System
// Siehe: docs/services/combatantAI/combatantAI.md

export type { ActionSelector, SelectorConfig, SelectorStats } from './types';

// Core Selectors
export { greedySelector } from './greedySelector';
export { randomSelector } from './randomSelector';
export { factoredSelector } from './factoredSelector';
export { iterativeSelector } from './iterativeSelector';

// Advanced Selectors
export { bestFirstSelector } from './bestFirstSelector';
export { killerSelector } from './killerSelector';
export { lmrSelector } from './lmrSelector';
export { ucbSelector } from './ucbSelector';
export { starSelector } from './starSelector';
export { minimaxSelector } from './minimaxSelector';

// Evolved Selector (NEAT Network)
export { createEvolvedSelector } from './evolvedSelector';

// Registry
export {
  registerSelector,
  getSelector,
  getDefaultSelector,
  getRegisteredSelectors,
} from './registry';
