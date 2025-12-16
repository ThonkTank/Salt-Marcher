/**
 * Default Terrain Definitions
 *
 * Derived from terrain-registry for backward compatibility.
 * nativeCreatures will be populated from creature index on startup.
 *
 * @module constants/default-terrains
 */

import type { TerrainData } from '../schemas';
import {
	TERRAIN_REGISTRY,
	TERRAIN_ALIASES,
	travelMultiplierToSpeed,
	type TerrainRegistryEntry,
} from './terrain-registry';

/**
 * Convert registry entry to TerrainData format.
 */
function toTerrainData(entry: TerrainRegistryEntry): TerrainData {
	return {
		id: entry.id,
		name: entry.name,
		description: entry.description,
		color: entry.color,
		nativeCreatures: [], // Populated dynamically from creature index
		travelSpeed: travelMultiplierToSpeed(entry.travelMultiplier),
	};
}

/**
 * Default terrain definitions.
 * nativeCreatures is empty - populated dynamically from creature index.
 */
export const DEFAULT_TERRAINS: TerrainData[] = [
	// Canonical terrains from registry
	...Object.values(TERRAIN_REGISTRY).map(toTerrainData),
	// Alias terrains for backward compatibility
	...Object.entries(TERRAIN_ALIASES).map(([alias, canonical]) => ({
		...toTerrainData(TERRAIN_REGISTRY[canonical]),
		id: alias,
		name: alias.charAt(0).toUpperCase() + alias.slice(1),
	})),
];

/**
 * Get default terrain by ID
 */
export function getDefaultTerrain(id: string): TerrainData | undefined {
	return DEFAULT_TERRAINS.find((t) => t.id === id);
}
