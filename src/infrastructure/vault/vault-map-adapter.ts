/**
 * Vault-backed Map Storage Adapter.
 *
 * Implements MapStoragePort with Obsidian Vault persistence.
 * Maps are stored as JSON files in the configured maps directory.
 */

import type { Result, AppError, MapId } from '@core/index';
import { ok, err, createError, toEntityId } from '@core/index';
import type { OverworldMap } from '@core/schemas';
import { overworldMapSchema } from '@core/schemas';
import type { MapStoragePort } from '@/features/map';
import type { VaultIO } from './shared';

// ============================================================================
// Dependencies
// ============================================================================

/**
 * Dependencies for creating a vault map adapter.
 */
export interface VaultMapAdapterDeps {
  /** Vault I/O instance */
  vaultIO: VaultIO;

  /**
   * Function to get the current maps path.
   * Using a function allows for dynamic path resolution
   * when settings change.
   */
  getMapsPath: () => string;
}

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Create a vault-backed MapStoragePort.
 *
 * @param deps - Adapter dependencies
 * @returns MapStoragePort implementation
 */
export function createVaultMapAdapter(deps: VaultMapAdapterDeps): MapStoragePort {
  const { vaultIO, getMapsPath } = deps;

  /**
   * Get file path for a map ID.
   */
  function getFilePath(id: MapId): string {
    return `${getMapsPath()}/${String(id)}.json`;
  }

  return {
    async load(id: MapId): Promise<Result<OverworldMap, AppError>> {
      const path = getFilePath(id);
      const result = await vaultIO.readJson(path, overworldMapSchema);

      // Transform FILE_NOT_FOUND to MAP_NOT_FOUND (domain-level error)
      if (!result.ok && result.error.code === 'FILE_NOT_FOUND') {
        return err(createError('MAP_NOT_FOUND', `Map not found: ${id}`));
      }

      return result;
    },

    async save(map: OverworldMap): Promise<Result<void, AppError>> {
      const path = getFilePath(map.id);
      return vaultIO.writeJson(path, map);
    },

    async listIds(): Promise<Result<MapId[], AppError>> {
      const result = await vaultIO.listJsonFiles(getMapsPath());

      if (!result.ok) {
        return result;
      }

      return ok(result.value.map((name) => toEntityId<'map'>(name)));
    },

    async exists(id: MapId): Promise<boolean> {
      return vaultIO.exists(getFilePath(id));
    },
  };
}
