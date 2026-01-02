// Kreatur-bezogene Konstanten
// Siehe: docs/entities/creature.md

// D&D 5e Kreatur-Größen
export const CREATURE_SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
export type CreatureSize = typeof CREATURE_SIZES[number];

// Tragkapazität nach Creature-Size (in lb)
// Basiert auf D&D 5e: Carrying Capacity = STR × 15 lb
// Vereinfachung mit durchschnittlichen STR-Werten pro Size
export const CARRY_CAPACITY_BY_SIZE: Record<CreatureSize, number> = {
  tiny: 30,        // ~STR 4 × 15 / 2 (halved for tiny)
  small: 120,      // ~STR 8 × 15
  medium: 150,     // ~STR 10 × 15
  large: 420,      // ~STR 14 × 15 × 2 (doubled for large)
  huge: 1200,      // ~STR 20 × 15 × 4
  gargantuan: 3120, // ~STR 26 × 15 × 8
} as const;

// D&D 5e Kreatur-Design-Rollen (taktische Archetypen)
export const DESIGN_ROLES = [
  'ambusher', 'artillery', 'brute', 'controller', 'leader',
  'minion', 'skirmisher', 'soldier', 'solo', 'support',
] as const;
export type DesignRole = typeof DESIGN_ROLES[number];

// 5-Stufen Disposition-System
// Siehe: docs/services/encounter/groupActivity.md#Disposition-Berechnung
//
// | Stufe       | Bereich     | Mechanik                                           |
// |-------------|:-----------:|----------------------------------------------------|
// | hostile     | < -60       | Greift an. Keine sozialen Checks möglich.          |
// | unfriendly  | -60 bis -20 | Soziale Checks mit Nachteil. Minimale Kooperation. |
// | indifferent | -20 bis +20 | Standard-Interaktion. Normale Checks.              |
// | friendly    | +20 bis +60 | Soziale Checks mit Vorteil. Hilfsbereit.           |
// | allied      | > +60       | Kämpft mit Party. Teilt Geheimnisse.               |
export const DISPOSITIONS = ['hostile', 'unfriendly', 'indifferent', 'friendly', 'allied'] as const;
export type Disposition = typeof DISPOSITIONS[number];

// Disposition-Thresholds für Label-Mapping (obere Grenze exklusiv)
// effectiveDisposition = clamp(baseDisposition + reputation, -100, +100)
export const DISPOSITION_THRESHOLDS = {
  hostile: -60,      // < -60 = hostile
  unfriendly: -20,   // -60 bis -20 = unfriendly
  indifferent: 20,   // -20 bis +20 = indifferent
  friendly: 60,      // +20 bis +60 = friendly
  // > +60 = allied
} as const;

// Mapping Disposition → Default baseDisposition
export const BASE_DISPOSITION_VALUES: Record<Disposition, number> = {
  hostile: -80,
  unfriendly: -40,
  indifferent: 0,
  friendly: 40,
  allied: 80,
} as const;

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

// D&D 5e CR to XP Tabelle (CR 0 bis 30)
// Siehe: DMG S. 275
export const CR_TO_XP: Record<number, number> = {
  0: 10,
  0.125: 25,  // CR 1/8
  0.25: 50,   // CR 1/4
  0.5: 100,   // CR 1/2
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
} as const;
