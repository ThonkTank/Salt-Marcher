/**
 * Vault-backed Party Storage Adapter.
 *
 * Implements PartyStoragePort with Obsidian Vault persistence.
 * Parties are stored as JSON files in the configured parties directory.
 */

import type { Result, AppError, PartyId } from '@core/index';
import { ok, err, createError, toEntityId, now } from '@core/index';
import type { Party } from '@core/schemas';
import { partySchema } from '@core/schemas';
import type { PartyStoragePort } from '@/features/party';
import type { VaultIO } from './shared';

// ============================================================================
// Dependencies
// ============================================================================

/**
 * Dependencies for creating a vault party adapter.
 */
export interface VaultPartyAdapterDeps {
  /** Vault I/O instance */
  vaultIO: VaultIO;

  /**
   * Function to get the current parties path.
   * Using a function allows for dynamic path resolution
   * when settings change.
   */
  getPartiesPath: () => string;
}

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Create a vault-backed PartyStoragePort.
 *
 * @param deps - Adapter dependencies
 * @returns PartyStoragePort implementation
 */
export function createVaultPartyAdapter(
  deps: VaultPartyAdapterDeps
): PartyStoragePort {
  const { vaultIO, getPartiesPath } = deps;

  /**
   * Get file path for a party ID.
   */
  function getFilePath(id: PartyId): string {
    return `${getPartiesPath()}/${String(id)}.json`;
  }

  return {
    async load(id: PartyId): Promise<Result<Party, AppError>> {
      const path = getFilePath(id);
      const result = await vaultIO.readJson(path, partySchema);

      // Transform FILE_NOT_FOUND to PARTY_NOT_FOUND (domain-level error)
      if (!result.ok && result.error.code === 'FILE_NOT_FOUND') {
        return err(createError('PARTY_NOT_FOUND', `Party not found: ${id}`));
      }

      return result;
    },

    async save(party: Party): Promise<Result<void, AppError>> {
      const path = getFilePath(party.id);

      // Update timestamp before saving
      const updated: Party = {
        ...party,
        updatedAt: now(),
      };

      return vaultIO.writeJson(path, updated);
    },

    async listIds(): Promise<Result<PartyId[], AppError>> {
      const result = await vaultIO.listJsonFiles(getPartiesPath());

      if (!result.ok) {
        return result;
      }

      return ok(result.value.map((name) => toEntityId<'party'>(name)));
    },

    async exists(id: PartyId): Promise<boolean> {
      return vaultIO.exists(getFilePath(id));
    },
  };
}
