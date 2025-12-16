/**
 * Map Canvas Types
 *
 * Shared types for BaseHexCanvas and its subclasses.
 */

import type { ColorMode } from '../colors';

// ═══════════════════════════════════════════════════════════════
// Terrain Registry
// ═══════════════════════════════════════════════════════════════

/**
 * Minimal terrain info needed for rendering.
 * Any terrain object with these properties can be used.
 */
export interface TerrainColorInfo {
  id: string;
  name: string;
  color: string;
}

/**
 * Terrain registry mapping terrain IDs to terrain info.
 * Supports both minimal TerrainColorInfo and full TerrainConfig objects.
 */
export type TerrainRegistry = Record<string, TerrainColorInfo>;

// ═══════════════════════════════════════════════════════════════
// Canvas Configuration
// ═══════════════════════════════════════════════════════════════

/**
 * Configuration options for hex canvas
 */
export interface HexCanvasConfig {
  /** Hex size (center to corner) in pixels */
  hexSize?: number;

  /** Initial color mode for rendering */
  colorMode?: ColorMode;

  /** Default stroke color for hex borders */
  strokeColor?: string;

  /** Default stroke width for hex borders */
  strokeWidth?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_HEX_CANVAS_CONFIG: Required<HexCanvasConfig> = {
  hexSize: 42,
  colorMode: 'terrain',
  strokeColor: '#333333',
  strokeWidth: 1,
};

// ═══════════════════════════════════════════════════════════════
// Style Constants
// ═══════════════════════════════════════════════════════════════

/**
 * Common style constants for hex rendering
 */
export const HEX_STYLES = {
  /** Default stroke color */
  DEFAULT_STROKE: '#333333',

  /** Default stroke width */
  DEFAULT_STROKE_WIDTH: 1,

  /** Hover overlay fill */
  HOVER_FILL: 'rgba(255, 255, 255, 0.15)',

  /** Hover stroke color */
  HOVER_STROKE: '#ffffff',

  /** Hover stroke width */
  HOVER_STROKE_WIDTH: 1,
} as const;
