/**
 * Inspector Utilities
 *
 * Pure functions for formatting tile data for display.
 *
 * @module utils/inspector
 */

import type { TileData, AxialCoord, TerrainType } from '../schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * Formatted tile data for inspector display.
 * All values pre-formatted as display strings.
 */
export type InspectorDisplayData = {
	coord: { q: number; r: number };
	terrain: TerrainType;
	elevation: string;
	temperature: string;
	precipitation: string;
	clouds: string;
	wind: string;
	region: string;
	faction: string;
	note: string;
	creatureCount: number;
};

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format elevation value for display.
 */
export function formatElevation(elevation: number | undefined): string {
	if (elevation === undefined) return 'N/A';
	return `${elevation}m`;
}

/**
 * Format climate value (1-12 scale) for display.
 */
export function formatClimateValue(value: number): string {
	return `${value}/12`;
}

/**
 * Format tile data for inspector panel display.
 */
export function formatTileForInspector(
	tile: TileData,
	coord: AxialCoord
): InspectorDisplayData {
	return {
		coord: { q: coord.q, r: coord.r },
		terrain: tile.terrain,
		elevation: formatElevation(tile.elevation),
		temperature: formatClimateValue(tile.climate.temperature),
		precipitation: formatClimateValue(tile.climate.precipitation),
		clouds: formatClimateValue(tile.climate.clouds),
		wind: formatClimateValue(tile.climate.wind),
		region: tile.region ?? 'None',
		faction: tile.faction ?? 'None',
		note: tile.note ?? 'None',
		creatureCount: tile.creatures?.length ?? 0,
	};
}
