// Ziel: Bootstrap für Modifier-Plugins
// Siehe: docs/services/combatantAI/actionScoring.md#situational-modifiers
//
// Importiert alle Modifier-Plugins, wodurch sie sich automatisch
// in der globalen ModifierRegistry registrieren.
//
// Neue Modifier hinzufügen:
// 1. Datei erstellen: modifiers/newModifier.ts
// 2. ModifierEvaluator implementieren mit modifierRegistry.register()
// 3. Import hier hinzufügen

// ============================================================================
// MODIFIER IMPORTS (Auto-Registration)
// ============================================================================

import './longRange';
import './rangedInMelee';
import './proneTarget';
import './restrained';
import './packTactics';
import './cover';
// import './higherGround';     // TODO: Phase 8
// import './flanking';         // TODO: Phase 8

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { longRangeModifier } from './longRange';
export { rangedInMeleeModifier } from './rangedInMelee';
export { proneTargetModifier } from './proneTarget';
export { restrainedModifier } from './restrained';
export { packTacticsModifier } from './packTactics';
export { coverModifier } from './cover';
