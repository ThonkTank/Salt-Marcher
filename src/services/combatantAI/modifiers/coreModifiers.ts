// Ziel: Re-export Core Combat Modifiers aus Presets
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Dieses Modul re-exportiert AI-spezifische Modifier aus presets/modifiers/.
// Standard D&D 5e Modifier werden von gatherModifiers.ts gehandhabt (Single Source of Truth).

// Re-export AI-spezifische Modifiers aus Presets
export {
  // Individual modifiers
  halfCoverModifier,
  bloodiedFrenzyModifier,
  auraOfAuthorityModifier,
  // Collection
  modifierPresets as CORE_MODIFIERS,
  modifierPresetsMap,
} from '../../../../presets/modifiers';
