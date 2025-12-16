/**
 * Terrain Schema
 *
 * Custom terrain type definitions with native creatures.
 *
 * @module SaltMarcherCore/schemas/terrain
 */

// ============================================================================
// TERRAIN DATA
// ============================================================================

/**
 * Custom terrain type definition
 */
export type TerrainData = {
	/** Unique identifier (slug format, e.g., "dark-forest") */
	id: string;
	/** Display name */
	name: string;
	/** Optional description */
	description?: string;
	/** Hex color for map rendering (e.g., "#2d5a27") */
	color: string;
	/** IDs of creatures that naturally occur in this terrain */
	nativeCreatures: string[];
	/** Optional travel speed modifier (1.0 = normal) */
	travelSpeed?: number;
	/** Optional tags for filtering */
	tags?: string[];
};

/**
 * Terrain list entry for selection dialogs
 */
export type TerrainListEntry = Pick<TerrainData, 'id' | 'name' | 'color'>;
