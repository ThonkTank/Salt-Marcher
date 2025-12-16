/**
 * Party Vault Adapter.
 *
 * For Travel-Minimal, this is a simple in-memory adapter.
 * Real Obsidian vault integration will be added later.
 */

import type { Result, AppError, PartyId } from '@core/index';
import { ok, err, createError, toEntityId, now } from '@core/index';
import type { Party } from '@core/schemas';
import type { PartyStoragePort } from '@/features/party';
import { TEST_MAP_ID } from './map-adapter';

// ============================================================================
// Default Party Data
// ============================================================================

/**
 * Create a default party for testing.
 */
function createDefaultParty(): Party {
  return {
    id: toEntityId<'party'>('default-party'),
    name: 'The Adventurers',
    currentMapId: TEST_MAP_ID,
    position: { q: 5, r: 5 }, // Start at map center
    activeTransport: 'foot',
    availableTransports: ['foot'],
    members: [],
    createdAt: now(),
    updatedAt: now(),
  };
}

// ============================================================================
// Party Adapter
// ============================================================================

/**
 * Create an in-memory party adapter for Travel-Minimal.
 */
export function createPartyAdapter(): PartyStoragePort {
  // In-memory storage
  const parties = new Map<string, Party>();

  // Pre-populate with default party
  const defaultParty = createDefaultParty();
  parties.set(String(defaultParty.id), defaultParty);

  return {
    async load(id: PartyId): Promise<Result<Party, AppError>> {
      const party = parties.get(String(id));

      if (!party) {
        return err(
          createError('PARTY_NOT_FOUND', `Party not found: ${id}`)
        );
      }

      return ok(party);
    },

    async save(party: Party): Promise<Result<void, AppError>> {
      // Update timestamp
      const updated: Party = {
        ...party,
        updatedAt: now(),
      };

      parties.set(String(party.id), updated);
      return ok(undefined);
    },

    async listIds(): Promise<Result<PartyId[], AppError>> {
      const ids = Array.from(parties.keys()).map((id) =>
        toEntityId<'party'>(id)
      );
      return ok(ids);
    },

    async exists(id: PartyId): Promise<boolean> {
      return parties.has(String(id));
    },
  };
}

/**
 * Get the default party ID for bootstrapping.
 */
export const DEFAULT_PARTY_ID = toEntityId<'party'>('default-party');
