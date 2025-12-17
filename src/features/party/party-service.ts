/**
 * Party Feature service.
 *
 * Provides party operations: loading, position updates, transport management.
 * Publishes party:position-changed, party:state-changed, party:transport-changed events.
 * Implements PartyFeaturePort interface.
 */

import type {
  Result,
  AppError,
  PartyId,
  CharacterId,
  Option,
  EventBus,
  Unsubscribe,
} from '@core/index';
import {
  ok,
  err,
  some,
  none,
  createError,
  createEvent,
  newCorrelationId,
  now,
  EventTypes,
} from '@core/index';
import type { Party, HexCoordinate, TransportMode, Character } from '@core/schemas';
import { calculatePartyLevel, calculatePartySpeed } from '@core/schemas';
import type { PartyFeaturePort, PartyStoragePort, CharacterStoragePort } from './types';
import type { PartyStore } from './party-store';
import type {
  PartyStateChangedPayload,
  PartyPositionChangedPayload,
  PartyTransportChangedPayload,
  PartyLoadedPayload,
  PartyLoadRequestedPayload,
} from '@core/events/domain-events';

// ============================================================================
// Party Service
// ============================================================================

export interface PartyServiceDeps {
  store: PartyStore;
  storage: PartyStoragePort;
  characterStorage?: CharacterStoragePort; // Optional - for member management
  eventBus?: EventBus; // Optional during migration
}

/**
 * Create the party service (implements PartyFeaturePort).
 */
export function createPartyService(deps: PartyServiceDeps): PartyFeaturePort {
  const { store, storage, characterStorage, eventBus } = deps;

  // Track subscriptions for cleanup
  const subscriptions: Unsubscribe[] = [];

  // ===========================================================================
  // Member Loading Helper
  // ===========================================================================

  /**
   * Load all characters for the current party's member IDs.
   * Updates store.loadedMembers with the loaded characters.
   */
  async function loadMembersFromStorage(): Promise<Result<readonly Character[], AppError>> {
    const party = store.getState().currentParty;
    if (!party || party.members.length === 0) {
      store.setLoadedMembers([]);
      return ok([]);
    }

    if (!characterStorage) {
      // No character storage - return empty array
      store.setLoadedMembers([]);
      return ok([]);
    }

    const result = await characterStorage.loadMany(party.members as CharacterId[]);
    if (!result.ok) {
      return result;
    }

    store.setLoadedMembers([...result.value]);
    return ok(result.value);
  }

  // ===========================================================================
  // Event Publishing Helpers
  // ===========================================================================

  function publishPositionChanged(
    previousPosition: HexCoordinate,
    newPosition: HexCoordinate,
    source: 'travel' | 'teleport' | 'manual' = 'manual',
    correlationId?: string
  ): void {
    if (!eventBus) return;

    const payload: PartyPositionChangedPayload = {
      previousPosition,
      newPosition,
      source,
    };

    eventBus.publish(
      createEvent(EventTypes.PARTY_POSITION_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'party-feature',
      })
    );
  }

  function publishStateChanged(correlationId?: string): void {
    if (!eventBus) return;

    const state = store.getState();
    const payload: PartyStateChangedPayload = {
      state,
    };

    eventBus.publish(
      createEvent(EventTypes.PARTY_STATE_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'party-feature',
      })
    );
  }

  function publishTransportChanged(
    previousTransport: TransportMode,
    newTransport: TransportMode,
    correlationId?: string
  ): void {
    if (!eventBus) return;

    const payload: PartyTransportChangedPayload = {
      previousTransport,
      newTransport,
    };

    eventBus.publish(
      createEvent(EventTypes.PARTY_TRANSPORT_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'party-feature',
      })
    );
  }

  function publishLoaded(party: Party, correlationId?: string): void {
    if (!eventBus) return;

    const state = store.getState();
    const payload: PartyLoadedPayload = {
      partyId: party.id,
      state,
    };

    eventBus.publish(
      createEvent(EventTypes.PARTY_LOADED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'party-feature',
      })
    );
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  function setupEventHandlers(): void {
    if (!eventBus) return;

    // Handle party:load-requested
    subscriptions.push(
      eventBus.subscribe<PartyLoadRequestedPayload>(
        EventTypes.PARTY_LOAD_REQUESTED,
        async (event) => {
          const { partyId } = event.payload;
          const correlationId = event.correlationId;

          const result = await storage.load(partyId as PartyId);

          if (result.ok) {
            store.setCurrentParty(result.value);
            publishLoaded(result.value, correlationId);
            publishStateChanged(correlationId);
          }
          // Note: Error handling via party:load-failed would go here
        }
      )
    );
  }

  // Set up event handlers immediately if eventBus is provided
  setupEventHandlers();

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
    // Member Queries
    // =========================================================================

    getMembers(): Option<readonly Character[]> {
      const party = store.getState().currentParty;
      if (!party) return none();
      return some(store.getState().loadedMembers);
    },

    getPartyLevel(): number {
      const members = store.getState().loadedMembers;
      return calculatePartyLevel(members);
    },

    getPartySpeed(): number {
      const members = store.getState().loadedMembers;
      return calculatePartySpeed(members);
    },

    getPartySize(): number {
      return store.getState().loadedMembers.length;
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

      // Load party members (async, non-blocking)
      await loadMembersFromStorage();

      // Publish events
      publishLoaded(result.value);
      publishStateChanged();

      return ok(result.value);
    },

    setPosition(coord: HexCoordinate): void {
      const previousPosition = store.getState().currentParty?.position;
      store.setPosition(coord);

      // Publish position changed event
      if (previousPosition) {
        publishPositionChanged(previousPosition, coord);
      }
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

      const previousTransport = party.activeTransport;
      store.setActiveTransport(mode);

      // Publish transport changed event
      publishTransportChanged(previousTransport, mode);

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
      publishStateChanged();
    },

    // =========================================================================
    // Member Operations
    // =========================================================================

    async addMember(characterId: CharacterId): Promise<Result<void, AppError>> {
      const party = store.getState().currentParty;

      if (!party) {
        return err(createError('NO_PARTY', 'No party loaded'));
      }

      if (!characterStorage) {
        return err(createError('NO_CHARACTER_STORAGE', 'Character storage not available'));
      }

      // Check if already a member
      if (party.members.includes(characterId)) {
        return err(createError('ALREADY_MEMBER', `Character ${characterId} is already a party member`));
      }

      // Load the character to verify it exists
      const charResult = await characterStorage.load(characterId);
      if (!charResult.ok) {
        return err(createError('CHARACTER_NOT_FOUND', `Character ${characterId} not found`));
      }

      // Add to party members list
      store.addMember(characterId);

      // Add to loaded members
      const members = [...store.getState().loadedMembers, charResult.value];
      store.setLoadedMembers(members);

      publishStateChanged();
      return ok(undefined);
    },

    removeMember(characterId: CharacterId): Result<void, AppError> {
      const party = store.getState().currentParty;

      if (!party) {
        return err(createError('NO_PARTY', 'No party loaded'));
      }

      // Check if is a member
      if (!party.members.includes(characterId)) {
        return err(createError('NOT_MEMBER', `Character ${characterId} is not a party member`));
      }

      // Remove from party members list
      store.removeMember(characterId);

      // Remove from loaded members
      const members = store.getState().loadedMembers.filter((c) => c.id !== characterId);
      store.setLoadedMembers(members);

      publishStateChanged();
      return ok(undefined);
    },

    async reloadMembers(): Promise<Result<void, AppError>> {
      const result = await loadMembersFromStorage();
      if (!result.ok) {
        return err(result.error);
      }
      publishStateChanged();
      return ok(undefined);
    },

    // =========================================================================
    // Lifecycle
    // =========================================================================

    dispose(): void {
      // Clean up all EventBus subscriptions
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
    },
  };
}
