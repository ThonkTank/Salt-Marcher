/**
 * Terrain Population Utility
 *
 * Populates default terrains with native creatures based on
 * creatures' terrainPreference from the creature index.
 *
 * @module utils/terrain/populate-terrains
 */

import type { TerrainData, ILibraryStore, IndexEntry } from '../../schemas';
import { DEFAULT_TERRAINS } from '../../constants/default-terrains';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of terrain population
 */
export type PopulationResult = {
	terrainsCreated: number;
	terrainsUpdated: number;
	creaturesAssigned: number;
};

// ============================================================================
// Functions
// ============================================================================

/**
 * Get creature IDs that prefer a specific terrain.
 */
function getCreaturesForTerrain(
	creatureIndex: IndexEntry[],
	terrainId: string
): string[] {
	return creatureIndex
		.filter((entry) =>
			entry.terrainPreference?.includes(terrainId)
		)
		.map((entry) => entry.id);
}

/**
 * Populate default terrains with native creatures.
 *
 * For each default terrain:
 * 1. Check if terrain already exists in vault
 * 2. If not, create it with nativeCreatures from creature index
 * 3. If exists, update nativeCreatures (merge with existing)
 *
 * @param libraryStore - Library store for terrain persistence
 * @returns Population statistics
 */
export async function populateDefaultTerrains(
	libraryStore: ILibraryStore
): Promise<PopulationResult> {
	const result: PopulationResult = {
		terrainsCreated: 0,
		terrainsUpdated: 0,
		creaturesAssigned: 0,
	};

	// Load creature index for terrain matching
	const creatureIndex = await libraryStore.list('creature');

	for (const defaultTerrain of DEFAULT_TERRAINS) {
		// Find creatures with matching terrainPreference
		const matchingCreatureIds = getCreaturesForTerrain(
			creatureIndex,
			defaultTerrain.id
		);

		result.creaturesAssigned += matchingCreatureIds.length;

		// Check if terrain already exists
		const existing = await libraryStore.load<TerrainData>(
			'terrain',
			defaultTerrain.id
		);

		if (existing) {
			// Merge native creatures (keep existing + add new)
			const existingIds = new Set(existing.data.nativeCreatures);
			const newIds = matchingCreatureIds.filter((id) => !existingIds.has(id));

			if (newIds.length > 0) {
				const updatedTerrain: TerrainData = {
					...existing.data,
					nativeCreatures: [...existing.data.nativeCreatures, ...newIds],
				};

				await libraryStore.save(
					'terrain',
					defaultTerrain.id,
					updatedTerrain,
					existing.body
				);
				result.terrainsUpdated++;
			}
		} else {
			// Create new terrain with native creatures
			const newTerrain: TerrainData = {
				...defaultTerrain,
				nativeCreatures: matchingCreatureIds,
			};

			await libraryStore.save(
				'terrain',
				defaultTerrain.id,
				newTerrain,
				''
			);
			result.terrainsCreated++;
		}
	}

	console.log(
		`[SaltMarcher] Terrain population: ${result.terrainsCreated} created, ` +
		`${result.terrainsUpdated} updated, ${result.creaturesAssigned} creatures assigned`
	);

	return result;
}
