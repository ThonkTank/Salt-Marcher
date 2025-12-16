/**
 * Party Feature service.
 *
 * Provides party operations: loading, position updates, transport management.
 * Implements PartyFeaturePort interface.
 */

import type { Result, AppError, PartyId, Option } from '@core/index';
import { ok, err, some, none, createError } from '@core/index';
import type { Party, HexCoordinate, TransportMode } from '@core/schemas';
import type { PartyFeaturePort, PartyStoragePort } from './types';
import type { PartyStore } from './party-store';

// ============================================================================
// Party Service
// ============================================================================

export interface PartyServiceDeps {
  store: PartyStore;
  storage: PartyStoragePort;
}

/**
 * Create the party service (implements PartyFeaturePort).
 */
export function createPartyService(deps: PartyServiceDeps): PartyFeaturePort {
  const { store, storage } = deps;

  return {
    // =========================================================================
    // State Queries
    // =========================================================================

    getCurrentParty(): Option<Party> {
      const party = store.getState().currentParty;
      return party ? some(party) : none();
    },

    getPosition(): Option<HexCoordinate> {
      const party = store.getState().currentParty;
      return party ? some(party.position) : none();
    },

    getActiveTransport(): TransportMode {
      const party = store.getState().currentParty;
      return party?.activeTransport ?? 'foot';
    },

    getAvailableTransports(): readonly TransportMode[] {
      const party = store.getState().currentParty;
      return party?.availableTransports ?? ['foot'];
    },

    // =========================================================================
    // Party Operations
    // =========================================================================

    async loadParty(id: PartyId): Promise<Result<Party, AppError>> {
      const result = await storage.load(id);

      if (!result.ok) {
        return result;
      }

      store.setCurrentParty(result.value);
      return ok(result.value);
    },

    setPosition(coord: HexCoordinate): void {
      store.setPosition(coord);
    },

    setActiveTransport(mode: TransportMode): Result<void, AppError> {
      const party = store.getState().currentParty;

      if (!party) {
        return err(createError('NO_PARTY', 'No party loaded'));
      }

      // Validate transport mode is available
      if (!party.availableTransports.includes(mode)) {
        return err(
          createError(
            'TRANSPORT_NOT_AVAILABLE',
            `Transport mode "${mode}" is not available to this party`
          )
        );
      }

      store.setActiveTransport(mode);
      return ok(undefined);
    },

    async saveParty(): Promise<Result<void, AppError>> {
      const party = store.getState().currentParty;

      if (!party) {
        return err(createError('NO_PARTY', 'No party loaded'));
      }

      const result = await storage.save(party);

      if (result.ok) {
        store.markSaved();
      }

      return result;
    },

    unloadParty(): void {
      store.clear();
    },
  };
}
