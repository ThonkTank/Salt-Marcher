// Ziel: Loot-Konstanten für Budget und Wealth-System
// Siehe: docs/services/Loot.md

// ============================================================================
// #69: GOLD_PER_XP_BY_LEVEL (DMG-Tabelle Level 1-20)
// ============================================================================

/**
 * Gold pro XP basierend auf Party-Level.
 * Berechnet aus DMG Gold-by-Level (Gold-Differenz / XP-Differenz pro Level).
 */
export const GOLD_PER_XP_BY_LEVEL = {
  1: 0.33, // 100g / 300 XP
  2: 0.17, // 100g / 600 XP
  3: 0.11, // 200g / 1,800 XP
  4: 0.08, // 300g / 3,800 XP
  5: 0.31, // 2,300g / 7,500 XP
  6: 0.27, // 2,400g / 9,000 XP
  7: 0.29, // 3,200g / 11,000 XP
  8: 0.24, // 3,400g / 14,000 XP
  9: 0.31, // 5,000g / 16,000 XP
  10: 0.19, // 4,000g / 21,000 XP
  11: 0.6, // 9,000g / 15,000 XP
  12: 0.45, // 9,000g / 20,000 XP
  13: 0.9, // 18,000g / 20,000 XP
  14: 0.72, // 18,000g / 25,000 XP
  15: 0.93, // 28,000g / 30,000 XP
  16: 0.9, // 27,000g / 30,000 XP
  17: 2.1, // 84,000g / 40,000 XP
  18: 4.23, // 169,000g / 40,000 XP
  19: 3.38, // 169,000g / 50,000 XP
  20: 3.38, // Kein weiterer Level-Up
} as const;

export type GoldPerXPByLevel = typeof GOLD_PER_XP_BY_LEVEL;

// ============================================================================
// #72: WEALTH_MULTIPLIERS (destitute bis hoard)
// ============================================================================

/**
 * Wealth-Multiplikatoren für Loot-Wert-Berechnung.
 * Creatures können Wealth-Tags haben, die den Loot-Multiplikator beeinflussen.
 */
export const WEALTH_MULTIPLIERS = {
  destitute: 0.25, // Bettler, Verhungernde
  poor: 0.5, // Goblins, wilde Tiere
  average: 1.0, // Standard (default)
  wealthy: 1.5, // Händler, Adelige
  rich: 2.0, // Kaufleute, Gildenmeister
  hoard: 3.0, // Drachen, Schatzhüter
} as const;

export type WealthMultipliers = typeof WEALTH_MULTIPLIERS;
export type WealthTag = keyof typeof WEALTH_MULTIPLIERS;

/** Array der Wealth-Tiers für Zod-Enum-Validierung */
export const WEALTH_TIERS = ['destitute', 'poor', 'average', 'wealthy', 'rich', 'hoard'] as const;

// ============================================================================
// LOOT_MULTIPLIER (Basis-Multiplikator)
// ============================================================================

/**
 * Basis-Multiplikator für Loot-Wert-Berechnung.
 * Goldwert pro XP vor Wealth-Anpassung.
 */
export const LOOT_MULTIPLIER = 0.5;

// ============================================================================
// CR_TO_LEVEL_MAP (CR → Equivalent Character Level)
// ============================================================================

/**
 * Mapping von Creature CR zu äquivalentem Character Level.
 * Verwendet für party-unabhängige Loot-Berechnung (Ally/Victim).
 *
 * Logik: Niedriger CR = Level 1, dann 1:1 Mapping.
 * Über Level 20 hinaus wird auf 20 gedeckelt.
 */
export const CR_TO_LEVEL_MAP: Record<number, number> = {
  0: 1,
  0.125: 1,
  0.25: 1,
  0.5: 1,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 14,
  15: 15,
  16: 16,
  17: 17,
  18: 18,
  19: 19,
  20: 20,
  21: 20,
  22: 20,
  23: 20,
  24: 20,
  25: 20,
  26: 20,
  27: 20,
  28: 20,
  29: 20,
  30: 20,
};

