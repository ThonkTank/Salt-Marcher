/**
 * Geography Feature - Types
 * Inbound Port (GeographyFeaturePort) und Outbound Port (MapStoragePort)
 */

import type { EntityId } from '@core/types/common';
import type { HexCoordinate } from '@core/schemas/coordinates';
import type { HexMapData, HexTileData, MapData, MapMetadata } from '@core/schemas/map';
import type { TerrainConfig } from '@core/schemas/terrain';
import type { CoordKey } from '@core/schemas/hex-geometry';

// ═══════════════════════════════════════════════════════════════
// Result Types
// ═══════════════════════════════════════════════════════════════

/** Result von setActiveMap() */
export interface MapLoadResult {
  map: HexMapData;
  previousMapId: EntityId<'map'> | null;
}

// ═══════════════════════════════════════════════════════════════
// Inbound Port - GeographyFeaturePort
// ═══════════════════════════════════════════════════════════════

/**
 * Inbound Port für das Geography Feature
 * Wird von Application Layer und anderen Features aufgerufen
 */
export interface GeographyFeaturePort {
  // ─────────────────────────────────────────────────────────────
  // Map Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Set the active map
   * @returns Result with loaded map and previous map ID
   */
  setActiveMap(mapId: EntityId<'map'>): Promise<MapLoadResult>;

  /**
   * Get the currently active map
   * Returns null if no map is loaded
   */
  getActiveMap(): HexMapData | null;

  /**
   * Load a map by ID (cached)
   * Does not change active map
   */
  getMap(mapId: EntityId<'map'>): Promise<HexMapData | null>;

  /**
   * List all available maps
   */
  listMaps(): Promise<Array<{ id: EntityId<'map'>; name: string; type: string }>>;

  // ─────────────────────────────────────────────────────────────
  // Tile Queries (on active map)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get tile data at a coordinate
   * Returns null if no active map or coordinate out of bounds
   */
  getTileAt(coord: HexCoordinate): HexTileData | null;

  /**
   * Get terrain config at a coordinate
   * Resolves terrain ID to full config
   */
  getTerrainAt(coord: HexCoordinate): TerrainConfig | null;

  /**
   * Get all tiles within a radius
   * Returns Map for efficient lookup
   */
  getTilesInRadius(
    center: HexCoordinate,
    radius: number
  ): Map<CoordKey, HexTileData>;

  /**
   * Calculate distance between two coordinates
   */
  getDistance(from: HexCoordinate, to: HexCoordinate): number;

  /**
   * Get neighboring tiles
   */
  getNeighbors(
    coord: HexCoordinate
  ): Array<{ coord: HexCoordinate; tile: HexTileData | null }>;

  // ─────────────────────────────────────────────────────────────
  // Terrain Registry
  // ─────────────────────────────────────────────────────────────

  /**
   * Get terrain config by ID
   * Checks custom terrains first, then built-in
   */
  getTerrain(terrainId: string): TerrainConfig | null;

  /**
   * List all available terrains (built-in + custom)
   */
  listTerrains(): TerrainConfig[];

  // ─────────────────────────────────────────────────────────────
  // Map Mutations
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new hex map and save it
   * Does not set as active map
   */
  createMap(
    name: string,
    radius: number,
    options?: {
      defaultTerrain?: string;
      hexSize?: number;
    }
  ): Promise<HexMapData>;

  /**
   * Delete a map from storage
   */
  deleteMap(mapId: EntityId<'map'>): Promise<void>;

  /**
   * Update tiles on the active map
   */
  updateTiles(updates: Map<CoordKey, Partial<HexTileData>>): Promise<void>;

  /**
   * Update metadata of the active map
   */
  updateMapMetadata(updates: Partial<MapMetadata>): Promise<void>;

  /**
   * Save the active map to storage
   */
  saveActiveMap(): Promise<void>;

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize feature, load custom terrains
   */
  initialize(): Promise<void>;

  /**
   * Cleanup on plugin unload
   */
  dispose(): void;
}

// ═══════════════════════════════════════════════════════════════
// Outbound Port - MapStoragePort
// ═══════════════════════════════════════════════════════════════

/**
 * Outbound Port for map persistence
 * Implemented by infrastructure layer (Vault Adapter)
 */
export interface MapStoragePort {
  /**
   * List all maps in storage
   */
  listMaps(): Promise<Array<{ id: EntityId<'map'>; name: string; type: string }>>;

  /**
   * Load a map by ID
   * Returns null if not found
   */
  loadMap(id: EntityId<'map'>): Promise<MapData | null>;

  /**
   * Save a map to storage
   */
  saveMap(data: MapData): Promise<void>;

  /**
   * Delete a map from storage
   */
  deleteMap(id: EntityId<'map'>): Promise<void>;

  /**
   * Load custom terrain definitions
   */
  loadCustomTerrains(): Promise<TerrainConfig[]>;

  /**
   * Save custom terrain definitions
   */
  saveCustomTerrains(terrains: TerrainConfig[]): Promise<void>;
}
