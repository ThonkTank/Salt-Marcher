/**
 * Tile Schema
 *
 * Hex tile with terrain and climate data.
 *
 * @module schemas/map/tile
 */

import { TERRAIN_TYPES } from '../../constants/terrain';
import type { StatblockData } from '../character/creature';
import type { WeatherValues } from '../weather';

/**
 * Standard D&D terrain type
 */
export type TerrainType = typeof TERRAIN_TYPES[number];

/**
 * Climate data for a tile (all values 1-12).
 * @alias WeatherValues - Same structure, semantic alias for static tile climate.
 */
export type ClimateData = WeatherValues;

/**
 * Hex tile data
 */
export type TileData = {
    /** Terrain type */
    terrain: TerrainType;
    /** Climate conditions */
    climate: ClimateData;
    /** Elevation in meters */
    elevation?: number;
    /** Region name */
    region?: string;
    /** Faction ownership */
    faction?: string;
    /** Notes */
    note?: string;
    /** Creatures that can be encountered on this tile */
    creatures?: StatblockData[];
};
