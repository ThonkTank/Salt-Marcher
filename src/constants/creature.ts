// Kreatur-bezogene Konstanten
// Siehe: docs/entities/creature.md
//
// TASKS:
// |  # | Status | Domain   | Layer     | Beschreibung                                                              |  Prio  | MVP? | Deps | Spec                                                       | Imp.                           |
// |--:|:----:|:-------|:--------|:------------------------------------------------------------------------|:----:|:--:|:---|:---------------------------------------------------------|:-----------------------------|
// | 61 |   ⬜    | creature | constants | DISPOSITION_THRESHOLDS und BASE_DISPOSITION_VALUES Konstanten hinzufuegen | mittel | Nein | -    | services/encounter/groupActivity.md#Disposition-Berechnung | constants/creature.ts [ändern] |

// D&D 5e Kreatur-Größen
export const CREATURE_SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
export type CreatureSize = typeof CREATURE_SIZES[number];

// D&D 5e Kreatur-Design-Rollen (taktische Archetypen)
export const DESIGN_ROLES = [
  'ambusher', 'artillery', 'brute', 'controller', 'leader',
  'minion', 'skirmisher', 'soldier', 'solo', 'support',
] as const;
export type DesignRole = typeof DESIGN_ROLES[number];

// Kreatur-Einstellungen gegenüber der Party
export const DISPOSITIONS = ['hostile', 'neutral', 'friendly'] as const;
export type Disposition = typeof DISPOSITIONS[number];

// Lärmpegel für Kreatur-Erkennung
export const NOISE_LEVELS = ['silent', 'quiet', 'normal', 'loud', 'deafening'] as const;
export type NoiseLevel = typeof NOISE_LEVELS[number];

// Geruchsstärke für Kreatur-Erkennung
export const SCENT_STRENGTHS = ['none', 'faint', 'moderate', 'strong', 'overwhelming'] as const;
export type ScentStrength = typeof SCENT_STRENGTHS[number];

// Spezielle Tarn-/Versteck-Fähigkeiten
export const STEALTH_ABILITIES = [
  'burrowing', 'invisibility', 'ethereal', 'shapechange', 'mimicry', 'ambusher',
] as const;
export type StealthAbility = typeof STEALTH_ABILITIES[number];
