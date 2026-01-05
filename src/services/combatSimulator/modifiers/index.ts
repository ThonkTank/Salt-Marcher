// Ziel: Bootstrap für Modifier-Plugins
// Siehe: docs/services/combatSimulator/combatantAI.md
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
// import './proneTarget';      // TODO: Phase 2
// import './packTactics';      // TODO: Phase 3
// import './restrained';       // TODO: Phase 3
// import './cover';            // TODO: Phase 4
// import './higherGround';     // TODO: Phase 4
// import './flanking';         // TODO: Phase 4

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { longRangeModifier } from './longRange';
