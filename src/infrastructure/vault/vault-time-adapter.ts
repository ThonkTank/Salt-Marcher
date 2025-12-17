/**
 * Vault-backed Time Storage Adapter.
 *
 * Implements TimeStoragePort with Obsidian Vault persistence.
 * Time state is stored as a single JSON file in the time directory.
 */

import type { Result, AppError } from '@core/index';
import { ok, err, createError } from '@core/index';
import type { TimeState } from '@core/schemas';
import { timeStateSchema } from '@core/schemas';
import type { TimeStoragePort } from '@/features/time';
import type { VaultIO } from './shared';

// ============================================================================
// Constants
// ============================================================================

/** Time state filename */
const TIME_STATE_FILE = 'state.json';

// ============================================================================
// Dependencies
// ============================================================================

/**
 * Dependencies for creating a vault time adapter.
 */
export interface VaultTimeAdapterDeps {
  /** Vault I/O instance */
  vaultIO: VaultIO;

  /**
   * Function to get the current time path.
   * Using a function allows for dynamic path resolution
   * when settings change.
   */
  getTimePath: () => string;
}

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Create a vault-backed TimeStoragePort.
 *
 * @param deps - Adapter dependencies
 * @returns TimeStoragePort implementation
 */
export function createVaultTimeAdapter(
  deps: VaultTimeAdapterDeps
): TimeStoragePort {
  const { vaultIO, getTimePath } = deps;

  /**
   * Get file path for time state.
   */
  function getFilePath(): string {
    return `${getTimePath()}/${TIME_STATE_FILE}`;
  }

  return {
    async load(): Promise<Result<TimeState, AppError>> {
      const path = getFilePath();
      const result = await vaultIO.readJson(path, timeStateSchema);

      // Transform FILE_NOT_FOUND to TIME_NOT_FOUND (domain-level error)
      if (!result.ok && result.error.code === 'FILE_NOT_FOUND') {
        return err(createError('TIME_NOT_FOUND', 'Time state not found'));
      }

      return result;
    },

    async save(state: TimeState): Promise<Result<void, AppError>> {
      const path = getFilePath();
      return vaultIO.writeJson(path, state);
    },

    async exists(): Promise<boolean> {
      return vaultIO.exists(getFilePath());
    },
  };
}
