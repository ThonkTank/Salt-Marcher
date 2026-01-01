// Zentrales Register für NPC-Attribute
// Siehe: docs/services/npcs/NPC-Generation.md
//
// Das Register definiert ALLE verfügbaren Attribute für die 5 NPC-Felder:
// - personality: Persönlichkeitseigenschaften
// - values: Was dem NPC wichtig ist
// - quirks: Eigenheiten und Verhaltensweisen
// - appearance: Äußere Merkmale
// - goals: Aktuelle Ziele
//
// Das Register dient als Base-Layer in der Culture-Hierarchie:
// Register → Species/Type → Faction-Kette
//
// Jedes Layer kann:
// - add[]: Attribute mit vollem Layer-Gewicht hinzufügen
// - unwanted[]: Bisherigen akkumulierten Wert vierteln

export { personalityPresets, type PersonalityAttribute } from './personality';
export { valuePresets, type ValueAttribute } from './values';
export { quirkPresets, type QuirkAttribute } from './quirks';
export { appearancePresets, type AppearanceAttribute } from './appearance';
export { goalPresets, type GoalAttribute } from './goals';

// Re-export als gebündeltes Registry
import { personalityPresets } from './personality';
import { valuePresets } from './values';
import { quirkPresets } from './quirks';
import { appearancePresets } from './appearance';
import { goalPresets } from './goals';

/**
 * Zentrales Register aller NPC-Attribute.
 * Wird als Base-Layer in resolveCultureChain() verwendet.
 */
export const npcAttributeRegistry = {
  personality: personalityPresets,
  values: valuePresets,
  quirks: quirkPresets,
  appearance: appearancePresets,
  goals: goalPresets,
} as const;

/**
 * Alle IDs für ein Attribut-Feld.
 * Hilfreich für die Generierung des Register-Layers.
 */
export function getAllIds(field: keyof typeof npcAttributeRegistry): string[] {
  return npcAttributeRegistry[field].map(attr => attr.id);
}

export default npcAttributeRegistry;
