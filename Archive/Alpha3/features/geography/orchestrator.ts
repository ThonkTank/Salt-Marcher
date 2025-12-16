/**
 * Geography Feature - Orchestrator
 * Core logic for map and terrain management
 */

import type { EntityId } from '@core/types/common';
import { now } from '@core/types/common';
import type { HexCoordinate } from '@core/schemas/coordinates';
import { hexDistance } from '@core/schemas/coordinates';
import type { HexMapData, HexTileData, MapMetadata } from '@core/schemas/map';
import { createHexMap } from '@core/schemas/map';
import type { TerrainConfig } from '@core/schemas/terrain';
import {
  TERRAIN_REGISTRY,
  getAllBuiltinTerrains,
  resolveTerrainId,
} from '@core/schemas/terrain';
import {
  type CoordKey,
  coordToKey,
  hexNeighbors,
  hexesInRadius,
} from '@core/schemas/hex-geometry';
import type { GeographyFeaturePort, MapStoragePort, MapLoadResult } from './types';

// ═══════════════════════════════════════════════════════════════
// GeographyOrchestrator Implementation
// ═══════════════════════════════════════════════════════════════

class GeographyOrchestrator implements GeographyFeaturePort {
  private activeMap: HexMapData | null = null;
  private customTerrains: Map<string, TerrainConfig> = new Map();
  private readonly storage: MapStoragePort;
  private initialized = false;

  constructor(storage: MapStoragePort) {
    this.storage = storage;
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const customTerrains = await this.storage.loadCustomTerrains();
      for (const terrain of customTerrains) {
        this.customTerrains.set(terrain.id, terrain);
      }
    } catch (err) {
      console.warn('[GeographyOrchestrator] Failed to load custom terrains:', err);
    }

    this.initialized = true;
  }

  dispose(): void {
    this.activeMap = null;
    this.customTerrains.clear();
    this.initialized = false;
  }

  // ─────────────────────────────────────────────────────────────
  // Map Management
  // ─────────────────────────────────────────────────────────────

  async setActiveMap(mapId: EntityId<'map'>): Promise<MapLoadResult> {
    const map = await this.storage.loadMap(mapId);

    if (!map) {
      throw new Error(`Map not found: ${mapId}`);
    }

    if (map.type !== 'hex') {
      throw new Error(`Unsupported map type: ${map.type}. Only 'hex' maps are supported.`);
    }

    const previousMapId = this.activeMap?.metadata.id ?? null;
    this.activeMap = map;

    return {
      map,
      previousMapId,
    };
  }

  getActiveMap(): HexMapData | null {
    return this.activeMap;
  }

  async getMap(mapId: EntityId<'map'>): Promise<HexMapData | null> {
    const map = await this.storage.loadMap(mapId);

    if (!map || map.type !== 'hex') {
      return null;
    }

    return map;
  }

  async listMaps(): Promise<Array<{ id: EntityId<'map'>; name: string; type: string }>> {
    return this.storage.listMaps();
  }

  // ─────────────────────────────────────────────────────────────
  // Tile Queries
  // ─────────────────────────────────────────────────────────────

  getTileAt(coord: HexCoordinate): HexTileData | null {
    if (!this.activeMap) return null;

    const key = coordToKey(coord);
    return this.activeMap.tiles[key] ?? null;
  }

  getTerrainAt(coord: HexCoordinate): TerrainConfig | null {
    const tile = this.getTileAt(coord);
    if (!tile) return null;

    return this.getTerrain(tile.terrain);
  }

  getTilesInRadius(
    center: HexCoordinate,
    radius: number
  ): Map<CoordKey, HexTileData> {
    const result = new Map<CoordKey, HexTileData>();

    if (!this.activeMap) return result;

    for (const coord of hexesInRadius(center, radius)) {
      const key = coordToKey(coord);
      const tile = this.activeMap.tiles[key];
      if (tile) {
        result.set(key, tile);
      }
    }

    return result;
  }

  getDistance(from: HexCoordinate, to: HexCoordinate): number {
    return hexDistance(from, to);
  }

  getNeighbors(
    coord: HexCoordinate
  ): Array<{ coord: HexCoordinate; tile: HexTileData | null }> {
    return hexNeighbors(coord).map((neighborCoord) => ({
      coord: neighborCoord,
      tile: this.getTileAt(neighborCoord),
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Terrain Registry
  // ─────────────────────────────────────────────────────────────

  getTerrain(terrainId: string): TerrainConfig | null {
    const resolvedId = resolveTerrainId(terrainId);

    const custom = this.customTerrains.get(resolvedId);
    if (custom) return custom;

    return TERRAIN_REGISTRY[resolvedId] ?? null;
  }

  listTerrains(): TerrainConfig[] {
    const terrains = new Map<string, TerrainConfig>();

    for (const terrain of getAllBuiltinTerrains()) {
      terrains.set(terrain.id, terrain);
    }

    for (const [id, terrain] of this.customTerrains) {
      terrains.set(id, terrain);
    }

    return Array.from(terrains.values());
  }

  // ─────────────────────────────────────────────────────────────
  // Map Mutations
  // ─────────────────────────────────────────────────────────────

  async createMap(
    name: string,
    radius: number,
    options?: {
      defaultTerrain?: string;
      hexSize?: number;
    }
  ): Promise<HexMapData> {
    const map = createHexMap(name, radius, options);

    await this.storage.saveMap(map);

    return map;
  }

  async deleteMap(mapId: EntityId<'map'>): Promise<void> {
    if (this.activeMap?.metadata.id === mapId) {
      this.activeMap = null;
    }

    await this.storage.deleteMap(mapId);
  }

  async updateTiles(updates: Map<CoordKey, Partial<HexTileData>>): Promise<void> {
    if (!this.activeMap) {
      throw new Error('No active map to update');
    }

    for (const [key, data] of updates) {
      const existing = this.activeMap.tiles[key];

      if (existing) {
        this.activeMap.tiles[key] = { ...existing, ...data };
      }
    }

    this.activeMap.metadata.modifiedAt = now();
  }

  async updateMapMetadata(updates: Partial<MapMetadata>): Promise<void> {
    if (!this.activeMap) {
      throw new Error('No active map to update');
    }

    const { id: _id, type: _type, ...safeUpdates } = updates;

    Object.assign(this.activeMap.metadata, safeUpdates);
    this.activeMap.metadata.modifiedAt = now();
  }

  async saveActiveMap(): Promise<void> {
    if (!this.activeMap) {
      throw new Error('No active map to save');
    }

    await this.storage.saveMap(this.activeMap);
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a GeographyOrchestrator with injected storage
 *
 * @param storage - MapStoragePort implementation
 * @returns GeographyFeaturePort (call initialize()!)
 */
export function createGeographyOrchestrator(
  storage: MapStoragePort
): GeographyFeaturePort {
  return new GeographyOrchestrator(storage);
}
