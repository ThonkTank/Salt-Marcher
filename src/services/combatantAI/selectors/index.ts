// Ziel: Unified exports für Selector-System
// Siehe: docs/services/combatantAI/combatantAI.md

export type { ActionSelector, SelectorConfig, SelectorStats } from './types';
export { greedySelector } from './greedySelector';
export { randomSelector } from './randomSelector';
export { factoredSelector } from './factoredSelector';
export { iterativeSelector } from './iterativeSelector';
export {
  registerSelector,
  getSelector,
  getDefaultSelector,
  getRegisteredSelectors,
} from './registry';
