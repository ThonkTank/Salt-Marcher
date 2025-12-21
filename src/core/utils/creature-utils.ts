/**
 * Creature Utility Functions
 *
 * Pure functions for creature-related calculations:
 * - CR parsing and validation
 * - XP calculation
 * - Encounter multipliers
 *
 * @see docs/architecture/Core.md#entity-spezifische-utils
 */

// ============================================================================
// CR to XP Conversion Table (D&D 5e)
// ============================================================================

/**
 * D&D 5e Challenge Rating to XP mapping.
 * Source: Player's Handbook / Dungeon Master's Guide
 */
export const CR_XP_TABLE: Readonly<Record<number, number>> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
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

/**
 * Valid fractional CR values.
 */
export const FRACTIONAL_CR_VALUES = ['1/8', '1/4', '1/2'] as const;

// ============================================================================
// CR Parsing
// ============================================================================

/**
 * Parse a CR string into a numeric value.
 *
 * @param crString - CR as string (e.g., "1/4", "5", "0.5")
 * @returns Numeric CR value
 *
 * @example
 * parseCR("1/4")  // 0.25
 * parseCR("1/8")  // 0.125
 * parseCR("5")    // 5
 * parseCR("0.5")  // 0.5
 */
export function parseCR(crString: string): number {
  // Handle fractional CRs
  if (crString === '1/8') return 0.125;
  if (crString === '1/4') return 0.25;
  if (crString === '1/2') return 0.5;

  // Handle slash notation for other fractions
  if (crString.includes('/')) {
    const [num, denom] = crString.split('/').map(Number);
    if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
      return num / denom;
    }
    return 0;
  }

  // Parse as number
  const parsed = parseFloat(crString);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================================================
// CR Validation
// ============================================================================

/**
 * Validate that a CR range is valid.
 *
 * @param min - Minimum CR
 * @param max - Maximum CR
 * @returns true if the range is valid
 *
 * @example
 * isValidCRRange(0, 5)    // true
 * isValidCRRange(5, 3)    // false (min > max)
 * isValidCRRange(-1, 5)   // false (negative CR)
 * isValidCRRange(0, 35)   // false (CR > 30)
 */
export function isValidCRRange(min: number, max: number): boolean {
  // Both must be non-negative
  if (min < 0 || max < 0) return false;

  // Min must not exceed max
  if (min > max) return false;

  // Max CR is 30 in D&D 5e
  if (max > 30) return false;

  return true;
}

// ============================================================================
// XP Calculation
// ============================================================================

/**
 * Calculate XP reward for defeating a creature by CR.
 *
 * @param cr - Challenge Rating (numeric)
 * @returns XP value
 *
 * @example
 * calculateXP(0.25)  // 50
 * calculateXP(1)     // 200
 * calculateXP(5)     // 1800
 */
export function calculateXP(cr: number): number {
  // Direct lookup for known CRs
  if (cr in CR_XP_TABLE) {
    return CR_XP_TABLE[cr];
  }

  // Interpolate for CRs beyond the table (CR > 30)
  if (cr > 30) {
    return Math.floor(155000 + (cr - 30) * 20000);
  }

  // Fallback for unknown CRs
  return 10;
}

/**
 * Alias for calculateXP to maintain backwards compatibility.
 * @deprecated Use calculateXP instead
 */
export const calculateCreatureXP = calculateXP;

// ============================================================================
// Encounter Multipliers
// ============================================================================

/**
 * D&D 5e encounter multiplier based on number of monsters.
 * Used to calculate effective XP for encounter difficulty.
 *
 * | Monsters | Multiplier |
 * |----------|------------|
 * | 1        | 1.0        |
 * | 2        | 1.5        |
 * | 3-6      | 2.0        |
 * | 7-10     | 2.5        |
 * | 11-14    | 3.0        |
 * | 15+      | 4.0        |
 *
 * @param monsterCount - Number of monsters in encounter
 * @returns Multiplier for effective XP
 */
export function getEncounterMultiplier(monsterCount: number): number {
  if (monsterCount <= 0) return 0;
  if (monsterCount === 1) return 1.0;
  if (monsterCount === 2) return 1.5;
  if (monsterCount <= 6) return 2.0;
  if (monsterCount <= 10) return 2.5;
  if (monsterCount <= 14) return 3.0;
  return 4.0;
}

/**
 * Alias for getEncounterMultiplier to maintain backwards compatibility.
 * @deprecated Use getEncounterMultiplier instead
 */
export const getGroupMultiplier = getEncounterMultiplier;

// ============================================================================
// XP Budget Helpers
// ============================================================================

/**
 * Calculate effective XP for an encounter.
 * Applies the group multiplier to the base XP total.
 *
 * @param creatures - Array of creatures with their XP values
 * @returns Effective XP including group multiplier
 */
export function calculateEffectiveXP(
  creatures: readonly { xp: number }[]
): number {
  if (creatures.length === 0) return 0;
  const baseXP = creatures.reduce((sum, c) => sum + c.xp, 0);
  return Math.floor(baseXP * getEncounterMultiplier(creatures.length));
}
