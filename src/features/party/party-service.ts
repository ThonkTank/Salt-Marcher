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
import type { Party, HexCoordinate, TransportMode, Character, Item } from '@core/schemas';
import { calculatePartyLevel, calculatePartySpeed } from '@core/schemas';
import type { EntityId } from '@core/index';
import type { PartyFeaturePort, PartyStoragePort, CharacterStoragePort } from './types';
import type { PartyStore } from './party-store';
import { createCharacterService } from './character-service';
import type {
  PartyStateChangedPayload,
  PartyPositionChangedPayload,
  PartyTransportChangedPayload,
  PartyLoadedPayload,
  PartyLoadRequestedPayload,
  PartyMemberAddedPayload,
  PartyMemberRemovedPayload,
  PartyMembersChangedPayload,
  EntitySavedPayload,
} from '@core/events/domain-events';
import { calculateEffectiveSpeed, calculateEncumbrance } from '@/features/inventory';

// ============================================================================
// Party Service
// ============================================================================

/**
 * Item lookup function type.
 * Used for encumbrance calculation.
 */
export type ItemLookupFn = (id: EntityId<'item'>) => Item | undefined;

export interface PartyServiceDeps {
  store: PartyStore;
  storage: PartyStoragePort;
  characterStorage?: CharacterStoragePort; // Optional - for member management
  eventBus?: EventBus; // Optional during migration
  itemLookup?: ItemLookupFn; // Optional - for encumbrance calculation
}

/**
 * Create the party service (implements PartyFeaturePort).
 */
export function createPartyService(deps: PartyServiceDeps): PartyFeaturePort {
  const { store, storage, characterStorage, eventBus, itemLookup } = deps;

  // Track subscriptions for cleanup
  const subscriptions: Unsubscribe[] = [];

  // Create character service for HP tracking
  const characterService = createCharacterService({
    store,
    characterStorage,
    eventBus,
  });

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
      characterService.syncTrackedLevels();
      publishMembersChanged([]);
      return ok([]);
    }

    if (!characterStorage) {
      // No character storage - return empty array
      store.setLoadedMembers([]);
      characterService.syncTrackedLevels();
      publishMembersChanged(party.members as string[]);
      return ok([]);
    }

    const result = await characterStorage.loadMany(party.members as CharacterId[]);
    if (!result.ok) {
      return result;
    }

    store.setLoadedMembers([...result.value]);

    // Sync character levels for level change detection
    characterService.syncTrackedLevels();

    // Publish members changed event
    publishMembersChanged(party.members as string[]);

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

  function publishMemberAdded(characterId: CharacterId, correlationId?: string): void {
    if (!eventBus) return;

    const payload: PartyMemberAddedPayload = {
      characterId,
    };

    eventBus.publish(
      createEvent(EventTypes.PARTY_MEMBER_ADDED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'party-feature',
      })
    );
  }

  function publishMemberRemoved(characterId: CharacterId, correlationId?: string): void {
    if (!eventBus) return;

    const payload: PartyMemberRemovedPayload = {
      characterId,
    };

    eventBus.publish(
      createEvent(EventTypes.PARTY_MEMBER_REMOVED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'party-feature',
      })
    );
  }

  function publishMembersChanged(memberIds: string[], correlationId?: string): void {
    if (!eventBus) return;

    const payload: PartyMembersChangedPayload = {
      memberIds,
    };

    eventBus.publish(
      createEvent(EventTypes.PARTY_MEMBERS_CHANGED, payload, {
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

    // Handle entity:saved for characters in party
    // When a character is saved (e.g., via Library CRUD), reload party members
    // to ensure Travel and Encounter features use fresh data.
    subscriptions.push(
      eventBus.subscribe<EntitySavedPayload>(
        EventTypes.ENTITY_SAVED,
        async (event) => {
          // Only handle character saves
          if (event.payload.type !== 'character') return;

          const characterId = event.payload.id as CharacterId;
          const party = store.getState().currentParty;

          // Only reload if character is in the current party
          if (!party || !party.members.includes(characterId)) return;

          // Reload all members to get fresh data
          await loadMembersFromStorage();
          publishStateChanged(event.correlationId);
        }
      )
    );

    // Set up character service event handlers (character:hp-changed)
    characterService.setupEventHandlers(publishStateChanged);
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

    getEffectivePartySpeed(): number {
      const members = store.getState().loadedMembers;

      // If no members, return default speed
      if (members.length === 0) {
        return 30; // Default human speed
      }

      // If no item lookup function, fall back to base speed
      if (!itemLookup) {
        return calculatePartySpeed(members);
      }

      // Calculate effective speed for each member (base speed - encumbrance reduction)
      const effectiveSpeeds = members.map((character) => {
        const encumbrance = calculateEncumbrance(character, itemLookup);
        return calculateEffectiveSpeed(character.speed, encumbrance.level);
      });

      // Return slowest member's effective speed
      return Math.min(...effectiveSpeeds);
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

    async setPosition(coord: HexCoordinate): Promise<Result<void, AppError>> {
      const party = store.getState().currentParty;

      if (!party) {
        return err(createError('NO_PARTY', 'No party loaded'));
      }

      const previousPosition = party.position;
      const updatedParty = { ...party, position: coord };

      // 1. Pessimistic Save-First: persist before updating state
      const saveResult = await storage.save(updatedParty);
      if (!saveResult.ok) {
        return saveResult; // State remains unchanged on error
      }

      // 2. Update state after successful save
      store.setPosition(coord);
      store.markSaved();

      // 3. Publish events
      publishPositionChanged(previousPosition, coord);

      return ok(undefined);
    },

    async setActiveTransport(mode: TransportMode): Promise<Result<void, AppError>> {
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
      const updatedParty = { ...party, activeTransport: mode };

      // 1. Pessimistic Save-First: persist before updating state
      const saveResult = await storage.save(updatedParty);
      if (!saveResult.ok) {
        return saveResult; // State remains unchanged on error
      }

      // 2. Update state after successful save
      store.setActiveTransport(mode);
      store.markSaved();

      // 3. Publish events
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

      // Prepare updated party
      const updatedParty = {
        ...party,
        members: [...party.members, characterId],
      };

      // 1. Pessimistic Save-First: persist before updating state
      const saveResult = await storage.save(updatedParty);
      if (!saveResult.ok) {
        return saveResult; // State remains unchanged on error
      }

      // 2. Update state after successful save
      store.addMember(characterId);
      const members = [...store.getState().loadedMembers, charResult.value];
      store.setLoadedMembers(members);
      store.markSaved();

      // 3. Publish events
      publishStateChanged();
      publishMemberAdded(characterId);
      return ok(undefined);
    },

    async removeMember(characterId: CharacterId): Promise<Result<void, AppError>> {
      const party = store.getState().currentParty;

      if (!party) {
        return err(createError('NO_PARTY', 'No party loaded'));
      }

      // Check if is a member
      if (!party.members.includes(characterId)) {
        return err(createError('NOT_MEMBER', `Character ${characterId} is not a party member`));
      }

      // Prepare updated party
      const updatedParty = {
        ...party,
        members: party.members.filter((id) => id !== characterId),
      };

      // 1. Pessimistic Save-First: persist before updating state
      const saveResult = await storage.save(updatedParty);
      if (!saveResult.ok) {
        return saveResult; // State remains unchanged on error
      }

      // 2. Update state after successful save
      store.removeMember(characterId);
      const members = store.getState().loadedMembers.filter((c) => c.id !== characterId);
      store.setLoadedMembers(members);
      store.markSaved();

      // 3. Publish events
      publishStateChanged();
      publishMemberRemoved(characterId);
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
      // Clean up character service
      characterService.dispose();

      // Clean up all EventBus subscriptions
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
    },
  };
}
