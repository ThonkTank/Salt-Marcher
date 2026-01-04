// Konstanten für Culture-Resolution
// Siehe: docs/services/npcs/Culture-Resolution.md

/**
 * Boost für usualCultures bei NPC-Generierung.
 * usualCulture weight = 100 + FACTION_CULTURE_BOOST * (1 - factionTolerance)
 */
export const FACTION_CULTURE_BOOST = 900;

/**
 * Boost für Species-Kompatibilität.
 * Kompatibel: weight *= 1 + SPECIES_COMPATIBILITY_BOOST * (1 - cultureTolerance)
 */
export const SPECIES_COMPATIBILITY_BOOST = 9;

/**
 * Boost für Parent-Kulturen von usualCultures.
 * Formel: 1 + (PARENT_CULTURE_BOOST - 1) / 2^(depth - 1)
 * depth=1: 3.0, depth=2: 2.0, depth=3: 1.5
 */
export const PARENT_CULTURE_BOOST = 3;

/**
 * Default-Toleranz wenn nicht gesetzt (30%).
 */
export const DEFAULT_TOLERANCE = 0.3;
