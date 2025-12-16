/**
 * Party Feature store.
 *
 * Manages the current party state including position and transport.
 */

import type { Party, HexCoordinate, TransportMode } from '@core/schemas';
import type { PartyState } from './types';
import { createInitialPartyState } from './types';

// ============================================================================
// Party Store
// ============================================================================

/**
 * Create a party store for managing party state.
 */
export function createPartyStore() {
  let state: PartyState = createInitialPartyState();

  return {
    /**
     * Get current state (read-only).
     */
    getState(): Readonly<PartyState> {
      return state;
    },

    /**
     * Set the current party.
     */
    setCurrentParty(party: Party | null): void {
      state = {
        currentParty: party,
        isDirty: false,
      };
    },

    /**
     * Update the party position.
     */
    setPosition(coord: HexCoordinate): void {
      if (!state.currentParty) return;

      state = {
        ...state,
        currentParty: {
          ...state.currentParty,
          position: coord,
        },
        isDirty: true,
      };
    },

    /**
     * Update the active transport mode.
     */
    setActiveTransport(mode: TransportMode): void {
      if (!state.currentParty) return;

      state = {
        ...state,
        currentParty: {
          ...state.currentParty,
          activeTransport: mode,
        },
        isDirty: true,
      };
    },

    /**
     * Mark state as saved (not dirty).
     */
    markSaved(): void {
      state = {
        ...state,
        isDirty: false,
      };
    },

    /**
     * Clear the store.
     */
    clear(): void {
      state = createInitialPartyState();
    },
  };
}

export type PartyStore = ReturnType<typeof createPartyStore>;
