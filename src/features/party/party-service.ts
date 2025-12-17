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
import type { Party, HexCoordinate, TransportMode } from '@core/schemas';
import type { PartyFeaturePort, PartyStoragePort } from './types';
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
  eventBus?: EventBus; // Optional during migration
}

/**
 * Create the party service (implements PartyFeaturePort).
 */
export function createPartyService(deps: PartyServiceDeps): PartyFeaturePort {
  const { store, storage, eventBus } = deps;

  // Track subscriptions for cleanup
  const subscriptions: Unsubscribe[] = [];

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
    // Party Operations
    // =========================================================================

    async loadParty(id: PartyId): Promise<Result<Party, AppError>> {
      const result = await storage.load(id);

      if (!result.ok) {
        return result;
      }

      store.setCurrentParty(result.value);

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
