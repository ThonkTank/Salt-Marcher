/**
 * Fixed Position Configuration for Terrain, Flora, and Moisture Symbols
 *
 * Defines fixed base positions for each terrain/flora/moisture type.
 * Positions are designed to work well in any combination:
 * - Terrain symbols positioned toward edges/corners
 * - Flora symbols positioned toward center/gaps
 * - Moisture symbols positioned in complementary locations
 * - Complementary placement prevents visual conflicts
 *
 * At render time, small random jitter (±5-10%) is applied for natural variation.
 */

import type { TerrainType, FloraType, MoistureLevel } from "@/features/maps/config/terrain";

/**
 * Relative position within a hex (normalized coordinates)
 * - x, y: Range from -1 to 1, where (0,0) is hex center
 * - size: Scale factor relative to default symbol size (0.8-1.2)
 * - rotation: Optional rotation in degrees (0-360)
 */
export interface RelativePosition {
	x: number;
	y: number;
	size: number;
	rotation?: number;
}

/**
 * Fixed position configuration for a symbol type
 */
export interface FixedPositionConfig {
	symbolId: string;
	positions: RelativePosition[];
}

/**
 * TERRAIN POSITION CONFIGURATIONS
 *
 * All terrain types use a consistent 3-symbol triangular layout:
 * - Bottom-left, bottom-right, top-center arrangement
 * - Centrally positioned between center and edges
 * - Leaves center space for flora symbols
 * - Jitter (±10%) applied at render time for natural variation
 *
 * Size scaling preserves terrain character:
 * - Mountains: 3 (larger, dramatic peaks)
 * - Hills: 3 (medium, gentle rolling)
 * - Plains: 3 (smaller, subtle waves)
 */
export const TERRAIN_POSITIONS: Record<TerrainType, FixedPositionConfig> = {
	mountains: {
		symbolId: "terrain-mountains",
		positions: [
			// Bottom-left - dramatic peak
			{ x: -0.4, y: 0.15, size: 1.2, rotation: -5 },
			// Bottom-right - dominant peak
			{ x: 0.4, y: 0.15, size: 1.1, rotation: 8 },
			// Top-center - background peak
			{ x: 0.0, y: -0.4, size: 1.0, rotation: -12 }
		]
	},

	hills: {
		symbolId: "terrain-hills",
		positions: [
			// Bottom-left - gentle hill
			{ x: -0.4, y: 0.15, size: 1.0, rotation: 0 },
			// Bottom-right - gentle hill
			{ x: 0.4, y: 0.15, size: 1.0, rotation: 5 },
			// Top-center - gentle hill
			{ x: 0.0, y: -0.4, size: 1.0, rotation: -8 }
		]
	},

	plains: {
		symbolId: "terrain-plains",
		positions: [
			// Bottom-left - subtle wave
			{ x: -0.4, y: 0.15, size: 0.9, rotation: 0 },
			// Bottom-right - subtle wave
			{ x: 0.4, y: 0.15, size: 0.9, rotation: 0 },
			// Top-center - subtle wave
			{ x: 0.0, y: -0.4, size: 0.9, rotation: 0 }
		]
	}
};

/**
 * FLORA POSITION CONFIGURATIONS
 *
 * Positioned toward center/gaps between terrain symbols.
 * Symbol counts reflect vegetation density:
 * - Dense: 7 (thick forest coverage, ~60% fill)
 * - Medium: 5 (balanced distribution)
 * - Field: 6 (grass tufts, scattered)
 * - Barren: 1 (minimal sparse rock)
 *
 * Positioning strategy:
 * - Flora uses gaps between terrain symbols (terrain at edges/corners)
 * - Slight overlaps with terrain allowed for natural look
 * - Denser types have more central clustering
 */
export const FLORA_POSITIONS: Record<FloraType, FixedPositionConfig> = {
	dense: {
		symbolId: "flora-dense",
		positions: [
			// Inner ring (3 trees) - between center and terrain symbols, radius ~0.3
			{ x: 0.0, y: -0.28, size: 1.1, rotation: 12 },
			{ x: -0.24, y: 0.14, size: 1.15, rotation: -18 },
			{ x: 0.26, y: 0.12, size: 1.2, rotation: 25 },
			// Mid ring (4 trees) - around terrain symbols, radius ~0.5, good coverage
			{ x: -0.48, y: -0.15, size: 0.95, rotation: -8 },
			{ x: 0.45, y: -0.2, size: 1.0, rotation: 15 },
			{ x: -0.42, y: 0.32, size: 0.9, rotation: -22 },
			{ x: 0.5, y: 0.28, size: 1.05, rotation: 8 },
			// Outer ring (3 trees) - near hex edges, radius ~0.7, fills remaining gaps
			{ x: 0.0, y: 0.68, size: 0.85, rotation: -12 },
			{ x: -0.6, y: -0.35, size: 0.8, rotation: 28 },
			{ x: 0.58, y: -0.4, size: 0.88, rotation: -15 }
		]
	},

	medium: {
		symbolId: "flora-medium",
		positions: [
			// Center tree
			{ x: 0.0, y: 0.05, size: 1.1, rotation: 0 },
			// Diagonal spread
			{ x: -0.25, y: -0.2, size: 1.0, rotation: -12 },
			{ x: 0.28, y: -0.15, size: 1.05, rotation: 8 },
			{ x: -0.2, y: 0.3, size: 0.95, rotation: -5 },
			{ x: 0.3, y: 0.25, size: 1.0, rotation: 12 }
		]
	},

	field: {
		symbolId: "flora-field",
		positions: [
			// Center cluster (2 tufts)
			{ x: 0.0, y: 0.0, size: 0.95, rotation: 0 },
			{ x: 0.15, y: 0.08, size: 0.88, rotation: 0 },
			// Outer scattered (4 tufts) - fills more of hex
			{ x: -0.35, y: -0.2, size: 0.85, rotation: 0 },
			{ x: 0.38, y: 0.15, size: 0.9, rotation: 0 },
			{ x: -0.2, y: 0.35, size: 0.92, rotation: 0 },
			{ x: 0.25, y: -0.32, size: 0.87, rotation: 0 }
		]
	},

	barren: {
		symbolId: "flora-barren",
		positions: [
			// Single central rock for minimal sparse appearance
			{ x: 0.0, y: 0.05, size: 1.0, rotation: -20 }
		]
	}
};

/**
 * Get fixed position configuration for a terrain type
 */
export function getTerrainPositionConfig(terrain: TerrainType): FixedPositionConfig {
	return TERRAIN_POSITIONS[terrain];
}

/**
 * Get fixed position configuration for a flora type
 */
export function getFloraPositionConfig(flora: FloraType): FixedPositionConfig {
	return FLORA_POSITIONS[flora];
}

/**
 * MOISTURE POSITION CONFIGURATIONS
 *
 * Symbol-based moisture visualization replacing noise-based overlay.
 * Positioned to complement terrain/flora icons without overlap.
 *
 * Design progression (desert → sea):
 * - Desert/Dry: 1-2 small symbols (minimal water presence)
 * - Lush/Marshy/Swampy: 2-3 medium symbols (increasing water)
 * - Ponds/Lakes: 3 larger symbols (significant water bodies)
 * - Large Lake/Sea: 3-4 large symbols (dominant water)
 * - Flood Plains: Special arrangement (seasonal flooding pattern)
 *
 * Positioning strategy:
 * - Use gaps between terrain/flora symbols
 * - Positioned toward hex edges/corners (complementary to center-heavy flora)
 * - Size increases with moisture level (0.6 → 1.2)
 */
export const MOISTURE_POSITIONS: Record<MoistureLevel, FixedPositionConfig> = {
	desert: {
		symbolId: "moisture-desert",
		positions: [
			// Single small symbol - minimal moisture indicator
			{ x: 0.5, y: -0.3, size: 0.6, rotation: 0 }
		]
	},

	dry: {
		symbolId: "moisture-dry",
		positions: [
			// Two small symbols - low moisture
			{ x: -0.45, y: -0.25, size: 0.65, rotation: 0 },
			{ x: 0.48, y: 0.2, size: 0.6, rotation: 0 }
		]
	},

	lush: {
		symbolId: "moisture-lush",
		positions: [
			// Two medium symbols - well-watered
			{ x: -0.4, y: 0.3, size: 0.75, rotation: 0 },
			{ x: 0.45, y: -0.15, size: 0.7, rotation: 0 }
		]
	},

	marshy: {
		symbolId: "moisture-marshy",
		positions: [
			// Three medium symbols - waterlogged
			{ x: -0.35, y: -0.3, size: 0.8, rotation: 0 },
			{ x: 0.4, y: -0.2, size: 0.75, rotation: 0 },
			{ x: 0.0, y: 0.4, size: 0.8, rotation: 0 }
		]
	},

	swampy: {
		symbolId: "moisture-swampy",
		positions: [
			// Three larger symbols - standing water patches
			{ x: -0.4, y: 0.15, size: 0.9, rotation: 0 },
			{ x: 0.35, y: 0.25, size: 0.85, rotation: 0 },
			{ x: 0.0, y: -0.35, size: 0.9, rotation: 0 }
		]
	},

	ponds: {
		symbolId: "moisture-ponds",
		positions: [
			// Three large symbols - scattered ponds
			{ x: -0.3, y: -0.25, size: 1.0, rotation: 0 },
			{ x: 0.35, y: -0.15, size: 0.95, rotation: 0 },
			{ x: 0.0, y: 0.35, size: 1.0, rotation: 0 }
		]
	},

	lakes: {
		symbolId: "moisture-lakes",
		positions: [
			// Three large symbols - medium water bodies
			{ x: -0.25, y: 0.2, size: 1.05, rotation: 0 },
			{ x: 0.3, y: 0.15, size: 1.0, rotation: 0 },
			{ x: 0.0, y: -0.3, size: 1.05, rotation: 0 }
		]
	},

	large_lake: {
		symbolId: "moisture-large-lake",
		positions: [
			// Four large symbols - continuous lake coverage
			{ x: -0.35, y: -0.2, size: 1.1, rotation: 0 },
			{ x: 0.35, y: -0.15, size: 1.1, rotation: 0 },
			{ x: -0.2, y: 0.3, size: 1.05, rotation: 0 },
			{ x: 0.25, y: 0.25, size: 1.05, rotation: 0 }
		]
	},

	sea: {
		symbolId: "moisture-sea",
		positions: [
			// Four large symbols - ocean/sea coverage
			{ x: -0.3, y: -0.25, size: 1.15, rotation: 0 },
			{ x: 0.32, y: -0.2, size: 1.15, rotation: 0 },
			{ x: -0.25, y: 0.3, size: 1.1, rotation: 0 },
			{ x: 0.28, y: 0.25, size: 1.1, rotation: 0 }
		]
	},

	flood_plains: {
		symbolId: "moisture-flood-plains",
		positions: [
			// Three symbols with special pattern - seasonal flooding
			{ x: -0.4, y: 0.0, size: 1.0, rotation: 0 },
			{ x: 0.0, y: -0.35, size: 1.05, rotation: 0 },
			{ x: 0.4, y: 0.15, size: 0.95, rotation: 0 }
		]
	}
};

/**
 * Get fixed position configuration for a moisture level
 */
export function getMoisturePositionConfig(moisture: MoistureLevel): FixedPositionConfig {
	return MOISTURE_POSITIONS[moisture];
}
