// Ziel: Re-export Core Combat Modifiers aus Presets
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Dieses Modul re-exportiert alle Core Modifier aus presets/modifiers/.
// Die Definitionen liegen zentral in den Presets, um Wiederverwendung zu ermöglichen.

// Re-export alle Core Modifiers aus Presets
// NOTE: packTacticsModifier removed - now defined as passive action in presets/actions/
export {
  // Individual modifiers
  longRangeModifier,
  rangedInMeleeModifier,
  proneTargetCloseModifier,
  proneTargetFarModifier,
  restrainedModifier,
  halfCoverModifier,
  // Collection
  modifierPresets as CORE_MODIFIERS,
  modifierPresetsMap,
} from '../../../../presets/modifiers';
