/**
 * D&D 5e Game Constants
 *
 * XP thresholds, CR-to-XP mapping, and encounter multipliers.
 * Used by Encounter system and future Combat domain.
 *
 * Sources:
 * - XP Thresholds: Dungeon Master's Guide p.82
 * - CR to XP: Monster Manual p.9
 * - Encounter Multipliers: Dungeon Master's Guide p.82
 */

// ═══════════════════════════════════════════════════════════════
// XP Thresholds by Character Level (DMG p.82)
// ═══════════════════════════════════════════════════════════════

/**
 * XP thresholds for encounter difficulty by character level.
 * Index 0 = level 1, Index 19 = level 20
 */
export const XP_THRESHOLDS_BY_LEVEL = {
  easy: [
    25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400,
    1600, 2000, 2100, 2400, 2800,
  ],
  medium: [
    50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500,
    2800, 3200, 3900, 4200, 4900, 5700,
  ],
  hard: [
    75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800,
    4300, 4800, 5900, 6300, 7300, 8500,
  ],
  deadly: [
    100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100,
    5700, 6400, 7200, 8800, 9500, 10900, 12700,
  ],
} as const;

// ═══════════════════════════════════════════════════════════════
// CR to XP Mapping (Monster Manual p.9)
// ═══════════════════════════════════════════════════════════════

/**
 * Maps Challenge Rating (as string) to XP value.
 * Fractional CRs: "0", "1/8", "1/4", "1/2"
 * Integer CRs: "1" through "30"
 */
export const CR_TO_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

// ═══════════════════════════════════════════════════════════════
// Encounter Multipliers (DMG p.82)
// ═══════════════════════════════════════════════════════════════

/**
 * Encounter difficulty multipliers based on number of creatures.
 * Format: [maxCreatureCount, multiplier]
 * Applied to total XP to get adjusted XP for difficulty calculation.
 */
export const ENCOUNTER_MULTIPLIERS: readonly [number, number][] = [
  [1, 1.0],
  [2, 1.5],
  [6, 2.0],
  [10, 2.5],
  [14, 3.0],
  [Infinity, 4.0],
];
