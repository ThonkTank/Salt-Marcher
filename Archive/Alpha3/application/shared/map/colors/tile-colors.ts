/**
 * Tile Color Utilities
 *
 * Provides color calculation for hex tiles based on different visualization modes.
 * Used by Cartographer (editing) and SessionRunner (display).
 */

import type { HexTileData } from '@core/schemas/map';

// Minimal terrain info needed for color lookup
interface TerrainColorInfo {
  color: string;
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/**
 * Color visualization mode for hex tiles
 */
export type ColorMode =
  | 'terrain'
  | 'elevation'
  | 'temperature'
  | 'precipitation'
  | 'clouds'
  | 'wind';

// ═══════════════════════════════════════════════════════════════
// Color Gradients
// ═══════════════════════════════════════════════════════════════

/**
 * Hypsometric color gradient for elevation visualization
 * Based on traditional cartographic coloring (sea → lowland → highland → peak)
 */
const ELEVATION_COLORS = [
  { threshold: -1000, color: '#000080' }, // Deep ocean
  { threshold: -100, color: '#0000CD' }, // Ocean
  { threshold: 0, color: '#4169E1' }, // Shallow water
  { threshold: 50, color: '#228B22' }, // Lowland
  { threshold: 200, color: '#90EE90' }, // Plains
  { threshold: 500, color: '#DAA520' }, // Foothills
  { threshold: 1000, color: '#CD853F' }, // Hills
  { threshold: 2000, color: '#8B4513' }, // Mountains
  { threshold: 3000, color: '#A9A9A9' }, // High peaks
  { threshold: 4000, color: '#FFFFFF' }, // Snow caps
];

/**
 * Temperature gradient: cold (blue) → hot (red)
 */
const TEMPERATURE_COLORS = [
  '#1a237e', // 1: Very cold (deep blue)
  '#1565c0', // 2
  '#42a5f5', // 3
  '#80deea', // 4
  '#a5d6a7', // 5
  '#c5e1a5', // 6: Temperate (green-yellow)
  '#fff59d', // 7
  '#ffe082', // 8
  '#ffb74d', // 9
  '#ff8a65', // 10
  '#ef5350', // 11
  '#b71c1c', // 12: Very hot (deep red)
];

/**
 * Precipitation gradient: dry (brown) → wet (blue)
 */
const PRECIPITATION_COLORS = [
  '#8d6e63', // 1: Very dry (brown)
  '#a1887f', // 2
  '#bcaaa4', // 3
  '#d7ccc8', // 4
  '#cfd8dc', // 5
  '#b0bec5', // 6: Moderate (gray-blue)
  '#90a4ae', // 7
  '#78909c', // 8
  '#607d8b', // 9
  '#546e7a', // 10
  '#37474f', // 11
  '#263238', // 12: Very wet (dark blue-gray)
];

/**
 * Cloud cover gradient: clear (yellow) → overcast (gray)
 */
const CLOUDS_COLORS = [
  '#fff176', // 1: Clear (bright yellow)
  '#fff59d', // 2
  '#fffde7', // 3
  '#f5f5f5', // 4
  '#eeeeee', // 5
  '#e0e0e0', // 6: Partly cloudy
  '#bdbdbd', // 7
  '#9e9e9e', // 8
  '#757575', // 9
  '#616161', // 10
  '#424242', // 11
  '#212121', // 12: Overcast (dark gray)
];

/**
 * Wind gradient: calm (light) → stormy (dark teal)
 */
const WIND_COLORS = [
  '#e8f5e9', // 1: Calm (very light green)
  '#c8e6c9', // 2
  '#a5d6a7', // 3
  '#81c784', // 4
  '#66bb6a', // 5
  '#4caf50', // 6: Moderate
  '#43a047', // 7
  '#388e3c', // 8
  '#2e7d32', // 9
  '#1b5e20', // 10
  '#004d40', // 11
  '#00251a', // 12: Stormy (very dark teal)
];

// ═══════════════════════════════════════════════════════════════
// Color Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get tile color based on visualization mode
 *
 * @param tile - The hex tile data
 * @param mode - The color visualization mode
 * @param terrainRegistry - Map of terrain IDs to color info
 * @returns Hex color string (#RRGGBB)
 */
export function getTileColor(
  tile: HexTileData,
  mode: ColorMode,
  terrainRegistry: Record<string, TerrainColorInfo>
): string {
  switch (mode) {
    case 'terrain':
      return terrainRegistry[tile.terrain]?.color ?? '#808080';
    case 'elevation':
      return elevationToColor(tile.elevation);
    case 'temperature':
      return climateValueToColor(tile.climate.temperature, 'temperature');
    case 'precipitation':
      return climateValueToColor(tile.climate.precipitation, 'precipitation');
    case 'clouds':
      return climateValueToColor(tile.climate.clouds, 'clouds');
    case 'wind':
      return climateValueToColor(tile.climate.wind, 'wind');
    default:
      return '#808080';
  }
}

/**
 * Convert elevation to hypsometric color
 *
 * @param elevation - Elevation in meters (0 = sea level)
 * @returns Hex color string
 */
export function elevationToColor(elevation: number): string {
  // Find the appropriate color band
  for (let i = ELEVATION_COLORS.length - 1; i >= 0; i--) {
    if (elevation >= ELEVATION_COLORS[i].threshold) {
      // Interpolate to next band if not the last
      if (i < ELEVATION_COLORS.length - 1) {
        const current = ELEVATION_COLORS[i];
        const next = ELEVATION_COLORS[i + 1];
        const t =
          (elevation - current.threshold) /
          (next.threshold - current.threshold);
        return interpolateColor(current.color, next.color, Math.min(1, t));
      }
      return ELEVATION_COLORS[i].color;
    }
  }
  return ELEVATION_COLORS[0].color;
}

/**
 * Convert climate value (1-12) to color based on climate type
 *
 * @param value - Climate value (1-12)
 * @param type - Type of climate property
 * @returns Hex color string
 */
export function climateValueToColor(
  value: number,
  type: 'temperature' | 'precipitation' | 'clouds' | 'wind'
): string {
  // Clamp to valid range
  const index = Math.max(0, Math.min(11, Math.round(value) - 1));

  switch (type) {
    case 'temperature':
      return TEMPERATURE_COLORS[index];
    case 'precipitation':
      return PRECIPITATION_COLORS[index];
    case 'clouds':
      return CLOUDS_COLORS[index];
    case 'wind':
      return WIND_COLORS[index];
    default:
      return '#808080';
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Interpolate between two hex colors
 *
 * @param colorA - Start color (#RRGGBB)
 * @param colorB - End color (#RRGGBB)
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated hex color
 */
function interpolateColor(colorA: string, colorB: string, t: number): string {
  const parseHex = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });

  const a = parseHex(colorA);
  const b = parseHex(colorB);

  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bb = Math.round(a.b + (b.b - a.b) * t);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
}

/**
 * Get all color modes
 */
export function getColorModes(): ColorMode[] {
  return ['terrain', 'elevation', 'temperature', 'precipitation', 'clouds', 'wind'];
}

/**
 * Get display name for color mode
 */
export function getColorModeLabel(mode: ColorMode): string {
  const labels: Record<ColorMode, string> = {
    terrain: 'Terrain',
    elevation: 'Elevation',
    temperature: 'Temperature',
    precipitation: 'Precipitation',
    clouds: 'Cloud Cover',
    wind: 'Wind',
  };
  return labels[mode];
}
