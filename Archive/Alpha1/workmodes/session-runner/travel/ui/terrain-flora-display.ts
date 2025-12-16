/**
 * Shared utilities for displaying terrain and flora information
 * Eliminates duplication between current-hex-card and travel-controls
 */

import { TERRAIN_ICONS, FLORA_ICONS } from "@features/maps";
import type { TerrainType, FloraType } from "@domain";

/**
 * Get German display name for terrain type
 */
export function getTerrainDisplayName(terrain?: string): string {
	if (!terrain) return "—";
	switch (terrain) {
		case "plains":
			return "Ebene";
		case "hills":
			return "Hügel";
		case "mountains":
			return "Gebirge";
		default:
			return terrain;
	}
}

/**
 * Get terrain display with emoji (e.g., "🏔️ Gebirge")
 */
export function getTerrainWithEmoji(terrain?: string): string {
	if (!terrain) return "—";
	const terrainType = terrain as TerrainType;
	const terrainDef = TERRAIN_ICONS[terrainType];
	if (terrainDef) {
		return `${terrainDef.emoji} ${terrainDef.label}`;
	}
	return getTerrainDisplayName(terrain);
}

/**
 * Get German display name for flora type
 */
export function getFloraDisplayName(flora?: string): string {
	if (!flora) return "—";
	switch (flora) {
		case "barren":
			return "Kahl";
		case "field":
			return "Feld";
		case "medium":
			return "Mittel";
		case "dense":
			return "Dicht";
		default:
			return flora;
	}
}

/**
 * Get flora display with emoji (e.g., "🌳 Mittel")
 */
export function getFloraWithEmoji(flora?: string): string {
	if (!flora) return "—";
	const floraType = flora as FloraType;
	const floraDef = FLORA_ICONS[floraType];
	if (floraDef) {
		return `${floraDef.emoji} ${floraDef.label}`;
	}
	return getFloraDisplayName(flora);
}

/**
 * Format speed modifier as percentage (e.g., 0.5 → "×50%")
 */
export function formatModifier(mod?: number): string {
	if (mod === undefined) return "—";
	return `×${(mod * 100).toFixed(0)}%`;
}
