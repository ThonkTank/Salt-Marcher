/**
 * Infrastructure - Geography Vault Adapter
 * Implements MapStoragePort for Obsidian Vault
 */

import type { Vault, TFile } from 'obsidian';
import { z } from 'zod';
import type { EntityId } from '@core/types/common';
import { MapDataSchema, type MapData } from '@core/schemas/map';
import { TerrainConfigSchema, type TerrainConfig } from '@core/schemas/terrain';
import { ensureDirectoryExists, isFolder, isFile } from './shared';

// ═══════════════════════════════════════════════════════════════
// Types (re-exported from features for convenience)
// ═══════════════════════════════════════════════════════════════

/**
 * Outbound Port for map persistence
 * Implemented by this adapter
 */
export interface MapStoragePort {
  listMaps(): Promise<Array<{ id: EntityId<'map'>; name: string; type: string }>>;
  loadMap(id: EntityId<'map'>): Promise<MapData | null>;
  saveMap(data: MapData): Promise<void>;
  deleteMap(id: EntityId<'map'>): Promise<void>;
  loadCustomTerrains(): Promise<TerrainConfig[]>;
  saveCustomTerrains(terrains: TerrainConfig[]): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// Zod Schemas for Storage
// ═══════════════════════════════════════════════════════════════

const CustomTerrainsFileSchema = z.object({
  version: z.number().int().default(1),
  terrains: z.array(TerrainConfigSchema),
});

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

/**
 * Create a MapStoragePort implementation using Obsidian Vault
 */
export function createVaultGeographyAdapter(
  vault: Vault,
  basePath = 'SaltMarcher'
): MapStoragePort {
  // ─────────────────────────────────────────────────────────────
  // Map Operations
  // ─────────────────────────────────────────────────────────────

  async function listMaps(): Promise<
    Array<{ id: EntityId<'map'>; name: string; type: string }>
  > {
    const mapsPath = `${basePath}/maps`;
    const maps: Array<{ id: EntityId<'map'>; name: string; type: string }> = [];

    try {
      const folder = vault.getAbstractFileByPath(mapsPath);
      if (!folder || !isFolder(folder)) {
        return maps;
      }

      const children = (
        folder as unknown as { children: { path: string; name: string }[] }
      ).children;

      for (const child of children) {
        if (!child.path.endsWith('.json')) continue;

        try {
          const mapData = await loadMap(
            child.name.replace('.json', '') as EntityId<'map'>
          );

          if (mapData) {
            maps.push({
              id: mapData.metadata.id,
              name: mapData.metadata.name,
              type: mapData.type,
            });
          }
        } catch {
          console.warn(
            `[GeographyAdapter] Skipping invalid map file: ${child.path}`
          );
        }
      }
    } catch {
      // Folder doesn't exist yet
    }

    return maps;
  }

  async function loadMap(id: EntityId<'map'>): Promise<MapData | null> {
    const path = `${basePath}/maps/${id}.json`;

    try {
      const file = vault.getAbstractFileByPath(path);
      if (!file || !isFile(file)) {
        return null;
      }

      const content = await vault.read(file as TFile);
      const parsed = JSON.parse(content);
      const validated = MapDataSchema.parse(parsed);

      return validated;
    } catch (err) {
      console.warn(`[GeographyAdapter] Failed to load map ${id}:`, err);
      return null;
    }
  }

  async function saveMap(data: MapData): Promise<void> {
    const path = `${basePath}/maps/${data.metadata.id}.json`;
    const content = JSON.stringify(data, null, 2);

    await ensureDirectoryExists(vault, `${basePath}/maps`);

    const file = vault.getAbstractFileByPath(path);
    if (file && isFile(file)) {
      await vault.modify(file as TFile, content);
    } else {
      await vault.create(path, content);
    }
  }

  async function deleteMap(id: EntityId<'map'>): Promise<void> {
    const path = `${basePath}/maps/${id}.json`;

    try {
      const file = vault.getAbstractFileByPath(path);
      if (file && isFile(file)) {
        await vault.delete(file as TFile);
      }
    } catch (err) {
      console.warn(`[GeographyAdapter] Failed to delete map ${id}:`, err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Terrain Operations
  // ─────────────────────────────────────────────────────────────

  async function loadCustomTerrains(): Promise<TerrainConfig[]> {
    const path = `${basePath}/terrains/custom.json`;

    try {
      const file = vault.getAbstractFileByPath(path);
      if (!file || !isFile(file)) {
        return [];
      }

      const content = await vault.read(file as TFile);
      const parsed = JSON.parse(content);
      const validated = CustomTerrainsFileSchema.parse(parsed);

      return validated.terrains;
    } catch {
      return [];
    }
  }

  async function saveCustomTerrains(terrains: TerrainConfig[]): Promise<void> {
    const path = `${basePath}/terrains/custom.json`;
    const data = {
      version: 1,
      terrains,
    };
    const content = JSON.stringify(data, null, 2);

    await ensureDirectoryExists(vault, `${basePath}/terrains`);

    const file = vault.getAbstractFileByPath(path);
    if (file && isFile(file)) {
      await vault.modify(file as TFile, content);
    } else {
      await vault.create(path, content);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Return Port Implementation
  // ─────────────────────────────────────────────────────────────

  return {
    listMaps,
    loadMap,
    saveMap,
    deleteMap,
    loadCustomTerrains,
    saveCustomTerrains,
  };
}
