/**
 * Character Service for Party Feature.
 *
 * Handles character-specific operations like HP updates.
 * Responds to character:hp-changed events and updates party member state.
 *
 * @see docs/features/Character-System.md#hp-tracking
 */

import type { Result, AppError, CharacterId, EventBus, Unsubscribe } from '@core/index';
import { ok, err, createError, EventTypes, createEvent, newCorrelationId, now } from '@core/index';
import type { Character } from '@core/schemas';
import type {
  CharacterHpChangedPayload,
  CharacterLevelChangedPayload,
  EntitySavedPayload,
} from '@core/events/domain-events';
import type { PartyStore } from './party-store';
import type { CharacterStoragePort } from './types';

// ============================================================================
// Character Service Types
// ============================================================================

export interface CharacterServiceDeps {
  store: PartyStore;
  characterStorage?: CharacterStoragePort;
  eventBus?: EventBus;
}

export interface CharacterService {
  /**
   * Update a character's current HP.
   * Persists to storage and updates the party store's loadedMembers.
   *
   * @param characterId - The character to update
   * @param currentHp - The new HP value
   * @returns Result indicating success or failure
   */
  updateCharacterHp(characterId: CharacterId, currentHp: number): Promise<Result<void, AppError>>;

  /**
   * Sync tracked levels with current loadedMembers.
   * Call this after party members are loaded to enable level change detection.
   */
  syncTrackedLevels(): void;

  /**
   * Set up event handlers for character-related events.
   * Call this after creating the service to enable event-driven updates.
   *
   * @param onStateChanged - Callback to notify when state changes (for publishing party:state-changed)
   */
  setupEventHandlers(onStateChanged: (correlationId?: string) => void): void;

  /**
   * Clean up subscriptions and resources.
   */
  dispose(): void;
}

// ============================================================================
// Character Service Implementation
// ============================================================================

/**
 * Create the character service for HP and character state management.
 */
export function createCharacterService(deps: CharacterServiceDeps): CharacterService {
  const { store, characterStorage, eventBus } = deps;

  // Track subscriptions for cleanup
  const subscriptions: Unsubscribe[] = [];

  // Track character levels to detect changes on entity:saved
  const trackedLevels = new Map<string, number>();

  /**
   * Sync tracked levels with current loadedMembers.
   * Called after party members are loaded to enable level change detection.
   */
  function syncTrackedLevels(): void {
    const members = store.getState().loadedMembers;
    trackedLevels.clear();
    for (const member of members) {
      trackedLevels.set(member.id, member.level);
    }
  }

  /**
   * Publish CHARACTER_LEVEL_CHANGED event when a character's level changes.
   */
  function publishLevelChanged(
    characterId: CharacterId,
    previousLevel: number,
    newLevel: number,
    correlationId?: string
  ): void {
    if (!eventBus) return;

    const payload: CharacterLevelChangedPayload = {
      characterId,
      previousLevel,
      newLevel,
    };

    eventBus.publish(
      createEvent(EventTypes.CHARACTER_LEVEL_CHANGED, payload, {
        correlationId: correlationId ?? newCorrelationId(),
        timestamp: now(),
        source: 'character-service',
      })
    );
  }

  /**
   * Update a character's current HP in storage and store.
   */
  async function updateCharacterHp(
    characterId: CharacterId,
    currentHp: number
  ): Promise<Result<void, AppError>> {
    const state = store.getState();
    const members = state.loadedMembers;

    // Find the character in loaded members
    const memberIndex = members.findIndex((m) => m.id === characterId);

    if (memberIndex === -1) {
      return err(
        createError('CHARACTER_NOT_IN_PARTY', `Character ${characterId} is not a party member`)
      );
    }

    const character = members[memberIndex];

    // Create updated character with new HP
    const updatedCharacter: Character = {
      ...character,
      currentHp: Math.max(0, Math.min(currentHp, character.maxHp)), // Clamp to [0, maxHp]
    };

    // 1. Pessimistic Save-First: persist before updating state
    if (characterStorage) {
      const saveResult = await characterStorage.save(updatedCharacter);
      if (!saveResult.ok) {
        return saveResult;
      }
    }

    // 2. Update state after successful save
    const updatedMembers = [...members];
    updatedMembers[memberIndex] = updatedCharacter;
    store.setLoadedMembers(updatedMembers);

    return ok(undefined);
  }

  /**
   * Set up event handlers for character-related events.
   */
  function setupEventHandlers(onStateChanged: (correlationId?: string) => void): void {
    if (!eventBus) return;

    // Handle character:hp-changed events
    subscriptions.push(
      eventBus.subscribe<CharacterHpChangedPayload>(
        EventTypes.CHARACTER_HP_CHANGED,
        async (event) => {
          const { characterId, currentHp } = event.payload;
          const correlationId = event.correlationId;

          const result = await updateCharacterHp(characterId as CharacterId, currentHp);

          if (result.ok) {
            // Notify caller to publish state-changed event
            onStateChanged(correlationId);
          } else {
            // Log error but don't crash - other handlers should continue
            console.warn(
              `[character-service] Failed to update HP for ${characterId}:`,
              result.error.message
            );
          }
        }
      )
    );

    // Handle entity:saved for character level changes
    // Detects when a character's level changes and publishes CHARACTER_LEVEL_CHANGED
    subscriptions.push(
      eventBus.subscribe<EntitySavedPayload>(
        EventTypes.ENTITY_SAVED,
        async (event) => {
          // Only handle character saves
          if (event.payload.type !== 'character') return;

          const characterId = event.payload.id as CharacterId;
          const previousLevel = trackedLevels.get(characterId);

          // Character not tracked = not in party, skip
          if (previousLevel === undefined) return;

          // Get fresh character data from storage to compare levels
          if (!characterStorage) return;
          const result = await characterStorage.load(characterId);
          if (!result.ok) return;

          const newLevel = result.value.level;
          if (newLevel !== previousLevel) {
            publishLevelChanged(characterId, previousLevel, newLevel, event.correlationId);
            trackedLevels.set(characterId, newLevel);
          }
        }
      )
    );
  }

  /**
   * Clean up subscriptions and tracked state.
   */
  function dispose(): void {
    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }
    subscriptions.length = 0;
    trackedLevels.clear();
  }

  return {
    updateCharacterHp,
    syncTrackedLevels,
    setupEventHandlers,
    dispose,
  };
}
