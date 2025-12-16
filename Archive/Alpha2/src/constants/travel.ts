/**
 * Travel Constants
 *
 * Terrain travel multipliers and base rates for D&D travel calculations.
 *
 * @module constants/travel
 */

// Re-export terrain travel multipliers from registry
export {
	TERRAIN_TRAVEL_MULTIPLIERS,
	getTerrainTravelMultiplier,
	getTerrainTravelSpeed,
	travelMultiplierToSpeed,
} from './terrain-registry';

// ============================================================================
// Travel Rate Constants (D&D 5e PHB)
// ============================================================================

/** Miles per hex (tile diameter) */
export const MILES_PER_HEX = 3;

/** Hours of travel per day (standard D&D assumes 8 hours of travel) */
export const TRAVEL_HOURS_PER_DAY = 8;

/**
 * Linear travel rate: hexes covered per day at normal pace.
 * D&D 5e: 24 miles/day ÷ 3 miles/hex = 8 hexes/day
 *
 * Use for: Route duration calculations, travel time estimates.
 */
export const TRAVEL_RATE_HEXES_PER_DAY = 8;

/**
 * @deprecated Use TRAVEL_RATE_HEXES_PER_DAY instead
 */
export const BASE_HEXES_PER_DAY = TRAVEL_RATE_HEXES_PER_DAY;

// ============================================================================
// Map Sizing Constants
// ============================================================================

/**
 * Conservative map radius per travel day.
 * Accounts for terrain, navigation, encounters, and non-linear paths.
 *
 * Use for: Map dimension calculations, "X days travel" sizing.
 *
 * Rationale: While linear travel covers 8 hexes/day, actual exploration
 * radius is smaller due to backtracking, terrain obstacles, and encounters.
 */
export const MAP_RADIUS_PER_TRAVEL_DAY = 3;

/**
 * @deprecated Use MAP_RADIUS_PER_TRAVEL_DAY instead
 * Kept for backward compatibility with hex-geometry imports.
 */
export const HEXES_PER_TRAVEL_DAY = MAP_RADIUS_PER_TRAVEL_DAY;
