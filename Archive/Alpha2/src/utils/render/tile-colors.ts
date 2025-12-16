/**
 * Tile Colors
 *
 * Pure functions for tile color calculation based on tile properties.
 *
 * @module utils/render/tile-colors
 */

import type { AxialCoord, TerrainType, TileData } from '../../schemas';
import { lerp, normalize } from '../common/math';

// ============================================================================
// Color Helpers
// ============================================================================

/** RGB color as tuple [r, g, b] */
type RGB = readonly [number, number, number];

/**
 * Interpolate between two RGB colors.
 * @param from - Starting RGB color
 * @param to - Ending RGB color
 * @param ratio - Interpolation ratio (0 = from, 1 = to)
 * @returns CSS rgb() string
 */
function interpolateRgb(from: RGB, to: RGB, ratio: number): string {
    const r = Math.round(lerp(from[0], to[0], ratio));
    const g = Math.round(lerp(from[1], to[1], ratio));
    const b = Math.round(lerp(from[2], to[2], ratio));
    return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================================
// Terrain Colors
// ============================================================================

const TERRAIN_COLORS: Record<TerrainType, string> = {
    arctic: '#E8F4F8',
    coast: '#87CEEB',
    desert: '#EDC9AF',
    forest: '#228B22',
    grassland: '#90EE90',
    plains: '#90EE90',
    hill: '#8B7355',
    hills: '#8B7355',
    mountain: '#808080',
    swamp: '#556B2F',
    underdark: '#2F1F3D',
    underwater: '#1E90FF',
    urban: '#A9A9A9',
};

/**
 * Get color for terrain type.
 */
export function terrainColor(terrain: TerrainType): string {
    return TERRAIN_COLORS[terrain] ?? '#888888';
}

// ============================================================================
// Elevation Colors
// ============================================================================

/** Elevation color palette */
const ELEVATION_COLORS = {
    deepWater: [44, 53, 99] as RGB,      // #2C3563
    shallowWater: [135, 206, 235] as RGB, // #87CEEB
    darkGreen: [34, 139, 34] as RGB,      // #228B22
    lightGreen: [144, 238, 144] as RGB,   // #90EE90
    ochre: [189, 183, 107] as RGB,        // #BDB76B
    brown: [130, 102, 68] as RGB,         // #826644
    grayBrown: [169, 169, 169] as RGB,    // #A9A9A9
    lightGray: [220, 220, 220] as RGB,    // #DCDCDC
    snow: [240, 248, 255] as RGB,         // #F0F8FF
};

/**
 * Get color for elevation value using standard hypsometric tints.
 * Based on cartographic conventions: green lowlands → brown hills → gray mountains → white peaks
 */
export function elevationColor(elevation: number): string {
    const C = ELEVATION_COLORS;

    // Underwater: Dark blue → Light blue (-1000 to 0)
    if (elevation < 0) {
        const depth = Math.min(Math.abs(elevation), 1000);
        const ratio = 1 - depth / 1000; // 0 at -1000, 1 at 0
        return interpolateRgb(C.deepWater, C.shallowWater, ratio);
    }
    // Lowland: Dark green → Light green (0-200)
    if (elevation < 200) {
        return interpolateRgb(C.darkGreen, C.lightGreen, elevation / 200);
    }
    // Low hills: Light green → Yellow/Ochre (200-500)
    if (elevation < 500) {
        return interpolateRgb(C.lightGreen, C.ochre, (elevation - 200) / 300);
    }
    // Hills: Yellow/Ochre → Brown (500-1000)
    if (elevation < 1000) {
        return interpolateRgb(C.ochre, C.brown, (elevation - 500) / 500);
    }
    // Low mountains: Brown → Gray-brown (1000-2000)
    if (elevation < 2000) {
        return interpolateRgb(C.brown, C.grayBrown, (elevation - 1000) / 1000);
    }
    // Mountains: Gray-brown → Light gray (2000-3000)
    if (elevation < 3000) {
        return interpolateRgb(C.grayBrown, C.lightGray, (elevation - 2000) / 1000);
    }
    // High mountains: Light gray → Snow white (3000-5000)
    if (elevation < 5000) {
        return interpolateRgb(C.lightGray, C.snow, (elevation - 3000) / 2000);
    }
    // Extreme altitude: Snow white (>5000)
    return '#F0F8FF';
}

// ============================================================================
// Climate Colors
// ============================================================================

/** Climate color palette */
const CLIMATE_COLORS = {
    coldBlue: [0, 100, 255] as RGB,       // Cold blue
    tempGreen: [100, 255, 100] as RGB,    // Temperate green
    hotRed: [255, 100, 0] as RGB,         // Hot red
    aridYellow: [200, 180, 50] as RGB,    // Arid yellow
    wetBlue: [0, 100, 255] as RGB,        // Wet blue
};

/** Climate scale bounds */
const CLIMATE_MIN = 1;
const CLIMATE_MAX = 12;

/**
 * Get color for temperature value.
 * 1=arctic (blue) → 6=temperate (green) → 12=scorching (red)
 */
export function temperatureColor(temperature: number): string {
    const ratio = normalize(temperature, CLIMATE_MIN, CLIMATE_MAX);
    const C = CLIMATE_COLORS;

    if (ratio < 0.5) {
        // Blue → Green
        return interpolateRgb(C.coldBlue, C.tempGreen, ratio * 2);
    }
    // Green → Red
    return interpolateRgb(C.tempGreen, C.hotRed, (ratio - 0.5) * 2);
}

/**
 * Get color for precipitation value.
 * 1=arid (yellow) → 12=monsoon (blue)
 */
export function precipitationColor(precipitation: number): string {
    const ratio = normalize(precipitation, CLIMATE_MIN, CLIMATE_MAX);
    return interpolateRgb(CLIMATE_COLORS.aridYellow, CLIMATE_COLORS.wetBlue, ratio);
}

// ============================================================================
// Context-Based Tile Coloring
// ============================================================================

export type ColoringContext = {
    activeTool: string;
    selectedCoord: AxialCoord | null;
};

/**
 * Get color for a tile based on active tool and selection state.
 */
export function getTileColor(
    tile: TileData,
    coord: AxialCoord,
    context: ColoringContext
): string {
    const { activeTool, selectedCoord } = context;

    // Highlight selected tile
    const isSelected = selectedCoord &&
        selectedCoord.q === coord.q &&
        selectedCoord.r === coord.r;

    if (isSelected) {
        return '#ffcc00';
    }

    // Color based on active tool
    switch (activeTool) {
        case 'terrain':
            return terrainColor(tile.terrain);
        case 'elevation':
            return elevationColor(tile.elevation ?? 0);
        case 'temperature':
            return temperatureColor(tile.climate.temperature);
        case 'precipitation':
            return precipitationColor(tile.climate.precipitation);
        default:
            return '#888888';
    }
}
