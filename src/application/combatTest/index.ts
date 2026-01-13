// Ziel: Re-exports fuer Combat Test Application
// Siehe: docs/architecture/Orchestration.md

export {
  combatTestStore,
  initCombatTestControl,
  openScenario,
  resetCombatTest,
  acceptSuggestedAction,
  skipTurn,
  type CombatTestUIState,
} from './combatTestControl';
