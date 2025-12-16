/**
 * Map Schema
 *
 * Map metadata and tile collection.
 *
 * @module schemas/map/map
 */

import type { CoordKey } from '../geometry/hex-geometry';
import type { TileData } from './tile';

/**
 * Map metadata
 */
export type MapMetadata = {
    /** Unique map identifier */
    id: string;
    /** Display name */
    name: string;
    /** Creation timestamp (ms since epoch) */
    createdAt: number;
    /** Last modification timestamp (ms since epoch) */
    modifiedAt: number;
    /** Hex size in pixels */
    hexSize: number;
    /** Map center coordinate */
    center: { q: number; r: number };
};

/**
 * Complete map data (serializable)
 */
export type MapData = {
    metadata: MapMetadata;
    /** Tiles indexed by coordinate key (Record for JSON serialization) */
    tiles: Record<string, TileData>;
};

/**
 * Map list entry for selection dialogs
 */
export type MapListEntry = Pick<MapMetadata, 'id' | 'name' | 'modifiedAt'>;
