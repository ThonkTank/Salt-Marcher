/**
 * Terrain Registry
 *
 * Single source of truth for all terrain-related data.
 * Consolidates terrain types, colors, travel multipliers, and creature types.
 *
 * @module constants/terrain-registry
 */

/**
 * Complete terrain definition with all properties.
 */
export interface TerrainRegistryEntry {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly color: string;
	/** Travel time multiplier: 1 = normal, 2 = double time, 0.5 = half time */
	readonly travelMultiplier: number;
	/** Creature types commonly found in this terrain */
	readonly creatureTypes: readonly string[];
}

/**
 * Master terrain registry - single source of truth.
 * All derived constants (TERRAIN_TYPES, TERRAIN_TRAVEL_MULTIPLIERS, etc.)
 * are computed from this registry.
 */
export const TERRAIN_REGISTRY: Record<string, TerrainRegistryEntry> = {
	arctic: {
		id: 'arctic',
		name: 'Arctic',
		description: 'Frozen tundra and ice sheets',
		color: '#E8F4F8',
		travelMultiplier: 2,
		creatureTypes: ['beast', 'elemental', 'monstrosity'],
	},
	coast: {
		id: 'coast',
		name: 'Coast',
		description: 'Beaches and coastal areas',
		color: '#87CEEB',
		travelMultiplier: 1,
		creatureTypes: ['beast', 'monstrosity', 'elemental'],
	},
	desert: {
		id: 'desert',
		name: 'Desert',
		description: 'Arid wastelands and sand dunes',
		color: '#EDC9AF',
		travelMultiplier: 1.5,
		creatureTypes: ['beast', 'monstrosity', 'elemental'],
	},
	forest: {
		id: 'forest',
		name: 'Forest',
		description: 'Dense woodlands and jungles',
		color: '#228B22',
		travelMultiplier: 2,
		creatureTypes: ['beast', 'fey', 'plant', 'monstrosity'],
	},
	grassland: {
		id: 'grassland',
		name: 'Grassland',
		description: 'Open plains and prairies',
		color: '#90EE90',
		travelMultiplier: 1,
		creatureTypes: ['beast', 'humanoid', 'monstrosity'],
	},
	hill: {
		id: 'hill',
		name: 'Hill',
		description: 'Rolling hills and highlands',
		color: '#8B7355',
		travelMultiplier: 1.5,
		creatureTypes: ['beast', 'giant', 'humanoid'],
	},
	mountain: {
		id: 'mountain',
		name: 'Mountain',
		description: 'Peaks and mountain ranges',
		color: '#808080',
		travelMultiplier: 4,
		creatureTypes: ['dragon', 'giant', 'elemental', 'beast'],
	},
	swamp: {
		id: 'swamp',
		name: 'Swamp',
		description: 'Marshes and wetlands',
		color: '#556B2F',
		travelMultiplier: 3,
		creatureTypes: ['undead', 'aberration', 'ooze', 'beast'],
	},
	underdark: {
		id: 'underdark',
		name: 'Underdark',
		description: 'Underground caverns and tunnels',
		color: '#2F1F3D',
		travelMultiplier: 2,
		creatureTypes: ['aberration', 'ooze', 'undead', 'monstrosity'],
	},
	underwater: {
		id: 'underwater',
		name: 'Underwater',
		description: 'Submerged areas and ocean depths',
		color: '#1E90FF',
		travelMultiplier: 4,
		creatureTypes: ['beast', 'aberration', 'elemental'],
	},
	urban: {
		id: 'urban',
		name: 'Urban',
		description: 'Cities and settlements',
		color: '#A9A9A9',
		travelMultiplier: 0.5,
		creatureTypes: ['humanoid', 'construct', 'undead'],
	},
} as const;

/**
 * Terrain ID aliases for backward compatibility.
 * Maps alternative names to canonical terrain IDs.
 */
export const TERRAIN_ALIASES: Record<string, string> = {
	plains: 'grassland',
	hills: 'hill',
	coastal: 'coast',
};

// ============================================================================
// Derived Constants (for backward compatibility)
// ============================================================================

/**
 * List of all terrain type IDs (canonical names only).
 */
export const TERRAIN_TYPES = Object.keys(TERRAIN_REGISTRY) as (keyof typeof TERRAIN_REGISTRY)[];

/**
 * List of all terrain type IDs including aliases.
 */
export const TERRAIN_TYPES_WITH_ALIASES = [
	...TERRAIN_TYPES,
	...Object.keys(TERRAIN_ALIASES),
] as const;

/**
 * Terrain travel time multipliers.
 * @deprecated Use getTerrainEntry(id).travelMultiplier instead
 */
export const TERRAIN_TRAVEL_MULTIPLIERS: Record<string, number> = Object.fromEntries([
	...Object.entries(TERRAIN_REGISTRY).map(([key, entry]) => [key, entry.travelMultiplier]),
	// Include aliases pointing to their canonical terrain's multiplier
	...Object.entries(TERRAIN_ALIASES).map(([alias, canonical]) => [
		alias,
		TERRAIN_REGISTRY[canonical].travelMultiplier,
	]),
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a terrain ID, resolving aliases to canonical names.
 */
export function normalizeTerrainId(id: string): string {
	return TERRAIN_ALIASES[id] ?? id;
}

/**
 * Get terrain entry by ID, resolving aliases.
 * Returns undefined for unknown terrain IDs.
 */
export function getTerrainEntry(id: string): TerrainRegistryEntry | undefined {
	const normalizedId = normalizeTerrainId(id);
	return TERRAIN_REGISTRY[normalizedId];
}

/**
 * Get creature types for a terrain, with fallback for unknown terrains.
 */
export function getTerrainCreatureTypes(terrainId: string): readonly string[] {
	return getTerrainEntry(terrainId)?.creatureTypes ?? ['beast', 'humanoid'];
}

/**
 * Get travel multiplier for a terrain, with fallback for unknown terrains.
 */
export function getTerrainTravelMultiplier(terrainId: string): number {
	return getTerrainEntry(terrainId)?.travelMultiplier ?? 1;
}

/**
 * Convert travel multiplier to speed (0-1 scale).
 * Speed 1 = normal, 0.5 = half speed, 0.25 = quarter speed.
 */
export function travelMultiplierToSpeed(multiplier: number): number {
	return 1 / multiplier;
}

/**
 * Get travel speed for a terrain (0-1 scale).
 */
export function getTerrainTravelSpeed(terrainId: string): number {
	return travelMultiplierToSpeed(getTerrainTravelMultiplier(terrainId));
}
