/**
 * Brush Types
 *
 * Shared types for brush operations.
 *
 * @module utils/brush/types
 */

import type { AxialCoord, CoordKey, TileData } from '../../schemas';

/**
 * Falloff curve type for brush intensity.
 * - none: Constant 1 everywhere
 * - linear: Linear decrease from center to edge
 * - smooth: Smooth-step interpolation
 * - gaussian: Gaussian falloff curve
 */
export type FalloffType = 'none' | 'linear' | 'smooth' | 'gaussian';

/**
 * Brush application mode.
 * - set: Interpolates towards target value
 * - sculpt: Adds/subtracts target value
 * - smooth: Blends towards neighbor average
 * - noise: Adds random variation
 */
export type BrushMode = 'set' | 'sculpt' | 'smooth' | 'noise';

/**
 * Brush configuration.
 */
export type BrushConfig = {
    /** Brush radius in hexes (1-10) */
    radius: number;
    /** Brush strength (0-100%) */
    strength: number;
    /** Falloff curve type */
    falloff: FalloffType;
    /** Application mode */
    mode: BrushMode;
    /** Target value to apply */
    value: number;
};

/**
 * Editable tile fields (dot-notation for nested).
 */
export type BrushField =
    | 'terrain'
    | 'elevation'
    | 'climate.temperature'
    | 'climate.precipitation'
    | 'climate.clouds'
    | 'climate.wind';

/**
 * Result of brush application.
 * Contains oldTiles for future undo support.
 */
export type BrushResult = {
    /** Coordinates that were modified */
    affectedCoords: AxialCoord[];
    /** Modified tiles (new values) */
    modifiedTiles: Map<CoordKey, TileData>;
    /** Original tiles before modification (for undo) */
    oldTiles: Map<CoordKey, TileData>;
};
