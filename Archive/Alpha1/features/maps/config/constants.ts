// src/features/maps/config/constants.ts
// Central constants for map configuration

/**
 * Map configuration constants
 *
 * Centralizes all magic numbers related to map creation and rendering.
 * Use these instead of hardcoded values throughout the codebase.
 */
export const MAP_CONSTANTS = {
	/**
	 * Number of hex steps per travel day
	 * Used to convert user-friendly "days to cross" into tile radius
	 */
	HEXES_PER_TRAVEL_DAY: 3,

	/**
	 * Default hex pixel size (radius from center to corner)
	 * Standard size that provides good readability
	 */
	DEFAULT_HEX_PIXEL_SIZE: 42,

	/**
	 * Minimum hex pixel size
	 * Below this, hexes become too small to read
	 */
	MIN_HEX_PIXEL_SIZE: 12,

	/**
	 * Maximum hex pixel size
	 * Above this, hexes become impractically large
	 */
	MAX_HEX_PIXEL_SIZE: 200,

	/**
	 * Maximum tile radius (hex steps from center)
	 * Limits map size to ~7651 tiles for performance
	 */
	MAX_TILE_RADIUS: 50,

	/**
	 * Default padding around map canvas in pixels
	 */
	DEFAULT_CANVAS_PADDING: 50,
} as const;

/**
 * Type for MAP_CONSTANTS keys
 */
export type MapConstantKey = keyof typeof MAP_CONSTANTS;

/**
 * Regular expressions for hex block identification
 */

/** Matches the entire hex block (with backticks) - supports both hex3x3 and hexmap for backward compatibility */
export const HEX_BLOCK_REGEX = /```[\t ]*(hex3x3|hexmap)\b[\s\S]*?```/i;

/** Matches hex block and captures the content inside (without backticks) - supports both hex3x3 and hexmap for backward compatibility */
export const HEX_BLOCK_CONTENT_REGEX = /```[\t ]*(hex3x3|hexmap)\b\s*\n([\s\S]*?)\n```/i;

/**
 * Block identifiers
 */

/** Identifier for NEW maps (use modern name) */
export const HEXMAP_BLOCK_IDENTIFIER = 'hexmap';

/** Legacy identifier (still supported for reading) @deprecated use HEXMAP_BLOCK_IDENTIFIER */
export const HEX3X3_BLOCK_IDENTIFIER = 'hex3x3';
