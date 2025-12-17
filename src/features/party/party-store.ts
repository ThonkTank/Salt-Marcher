/**
 * Party Feature store.
 *
 * Manages the current party state including position, transport, and members.
 */

import type { CharacterId } from '@core/index';
import type { Party, HexCoordinate, TransportMode, Character } from '@core/schemas';
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
        loadedMembers: [],
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

    // =========================================================================
    // Member Management
    // =========================================================================

    /**
     * Set loaded member characters.
     */
    setLoadedMembers(members: Character[]): void {
      state = {
        ...state,
        loadedMembers: members,
      };
    },

    /**
     * Add a member to the party (updates party.members array).
     */
    addMember(characterId: CharacterId): void {
      if (!state.currentParty) return;

      state = {
        ...state,
        currentParty: {
          ...state.currentParty,
          members: [...state.currentParty.members, characterId],
        },
        isDirty: true,
      };
    },

    /**
     * Remove a member from the party (updates party.members array).
     */
    removeMember(characterId: CharacterId): void {
      if (!state.currentParty) return;

      state = {
        ...state,
        currentParty: {
          ...state.currentParty,
          members: state.currentParty.members.filter((id) => id !== characterId),
        },
        isDirty: true,
      };
    },
  };
}

export type PartyStore = ReturnType<typeof createPartyStore>;
