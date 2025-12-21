/**
 * Combat feature service.
 *
 * Orchestrates combat logic with EventBus integration.
 */

import { ok, err, type Result, type AppError, type EntityId } from '@core/types';
import {
  EventTypes,
  createEvent,
  newCorrelationId,
  type EventBus,
  type Unsubscribe,
  type CombatStartRequestedPayload,
  type CombatEndRequestedPayload,
  type CombatApplyDamageRequestedPayload,
  type CombatApplyHealingRequestedPayload,
  type CombatAddConditionRequestedPayload,
  type CombatRemoveConditionRequestedPayload,
  type CombatUpdateInitiativeRequestedPayload,
  type TimeAdvanceRequestedPayload,
} from '@core/events';
import type {
  PartyMemberAddedPayload,
  PartyMemberRemovedPayload,
} from '@core/events/domain-events';
import type {
  CombatState,
  CombatParticipant,
  Condition,
  ConditionType,
  CombatEffect,
} from '@core/schemas';
import { type Timestamp, now } from '@core/types';
import { type CombatStore, createCombatStore } from './combat-store';
import {
  type CombatFeaturePort,
  type CombatServiceDeps,
  type CombatResult,
  type ConcentrationCheckRequired,
} from './types';
import {
  calculateConcentrationDc,
  needsConcentrationCheck,
  calculateCombatDuration,
  calculateCombatXp,
  generateCombatId,
  getStartOfTurnEffects,
  getEndOfTurnEffects,
} from './combat-utils';

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Create combat service.
 */
export function createCombatService(deps: CombatServiceDeps): CombatFeaturePort {
  const { eventBus, partyFeature } = deps;
  const store: CombatStore = createCombatStore();
  const subscriptions: Unsubscribe[] = [];

  // ---------------------------------------------------------------------------
  // Event Publishing Helpers
  // ---------------------------------------------------------------------------

  function publishStateChanged(): void {
    if (!eventBus) return;

    eventBus.publish(
      createEvent(EventTypes.COMBAT_STATE_CHANGED, { state: store.getState() }, eventOptions())
    );
  }

  function publishHpChanged(
    participantId: string,
    previousHp: number,
    currentHp: number,
    change: number
  ): void {
    if (!eventBus) return;

    eventBus.publish(
      createEvent(
        EventTypes.COMBAT_PARTICIPANT_HP_CHANGED,
        { participantId, previousHp, currentHp, change },
        eventOptions()
      )
    );
  }

  function publishTurnChanged(participantId: string, roundNumber: number): void {
    if (!eventBus) return;

    eventBus.publish(
      createEvent(EventTypes.COMBAT_TURN_CHANGED, { participantId, roundNumber }, eventOptions())
    );
  }

  function publishConditionAdded(participantId: string, condition: Condition): void {
    if (!eventBus) return;

    eventBus.publish(
      createEvent(EventTypes.COMBAT_CONDITION_ADDED, { participantId, condition }, eventOptions())
    );
  }

  function publishConditionRemoved(participantId: string, conditionType: ConditionType): void {
    if (!eventBus) return;

    eventBus.publish(
      createEvent(
        EventTypes.COMBAT_CONDITION_REMOVED,
        { participantId, conditionType },
        eventOptions()
      )
    );
  }

  function publishCharacterDowned(participantId: string): void {
    if (!eventBus) return;

    eventBus.publish(
      createEvent(EventTypes.COMBAT_CHARACTER_DOWNED, { participantId }, eventOptions())
    );
  }

  function publishConcentrationCheckRequired(check: ConcentrationCheckRequired): void {
    if (!eventBus) return;

    eventBus.publish(
      createEvent(
        EventTypes.COMBAT_CONCENTRATION_CHECK_REQUIRED,
        { participantId: check.participantId, spell: check.spell, dc: check.dc },
        eventOptions()
      )
    );
  }

  function publishConcentrationBroken(participantId: string, spell: string): void {
    if (!eventBus) return;

    eventBus.publish(
      createEvent(
        EventTypes.COMBAT_CONCENTRATION_BROKEN,
        { participantId, spell },
        eventOptions()
      )
    );
  }

  function publishCombatStarted(combatId: string, initiativeOrder: CombatParticipant[]): void {
    if (!eventBus) return;

    // Sticky: Late-joining Views receive this to know combat is active
    eventBus.publish(
      createEvent(EventTypes.COMBAT_STARTED, { combatId, initiativeOrder }, eventOptions()),
      { sticky: true }
    );
  }

  function publishCombatCompleted(result: CombatResult): void {
    if (!eventBus) return;

    // Clear sticky since combat is no longer active
    eventBus.clearSticky(EventTypes.COMBAT_STARTED);

    eventBus.publish(
      createEvent(
        EventTypes.COMBAT_COMPLETED,
        {
          combatId: result.combatId,
          duration: result.durationRounds,
          xpAwarded: result.xpAwarded,
        },
        eventOptions()
      )
    );
  }

  function publishTimeAdvance(duration: { hours: number; minutes: number }): void {
    if (!eventBus) return;

    const payload: TimeAdvanceRequestedPayload = {
      duration,
      reason: 'activity',
    };

    eventBus.publish(createEvent(EventTypes.TIME_ADVANCE_REQUESTED, payload, eventOptions()));
  }

  function eventOptions(): { correlationId: string; timestamp: Timestamp; source: string } {
    return {
      correlationId: newCorrelationId(),
      timestamp: now(),
      source: 'combat-service',
    };
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  function setupEventHandlers(): void {
    if (!eventBus) return;

    // Handle combat start request
    subscriptions.push(
      eventBus.subscribe<CombatStartRequestedPayload>(
        EventTypes.COMBAT_START_REQUESTED,
        (event) => {
          const { participants, fromEncounter } = event.payload;
          const result = startCombat(participants, fromEncounter);

          if (!result.ok) {
            console.error('[combat-service] Failed to start combat:', result.error);
            // TODO (Post-MVP): Publish combat:start-failed event
          }
        }
      )
    );

    // Handle combat end request
    subscriptions.push(
      eventBus.subscribe<CombatEndRequestedPayload>(EventTypes.COMBAT_END_REQUESTED, () => {
        endCombat();
      })
    );

    // Handle next turn request
    subscriptions.push(
      eventBus.subscribe(EventTypes.COMBAT_NEXT_TURN_REQUESTED, () => {
        nextTurn();
      })
    );

    // Handle damage request
    subscriptions.push(
      eventBus.subscribe<CombatApplyDamageRequestedPayload>(
        EventTypes.COMBAT_APPLY_DAMAGE_REQUESTED,
        (event) => {
          applyDamage(event.payload.participantId, event.payload.amount);
        }
      )
    );

    // Handle healing request
    subscriptions.push(
      eventBus.subscribe<CombatApplyHealingRequestedPayload>(
        EventTypes.COMBAT_APPLY_HEALING_REQUESTED,
        (event) => {
          applyHealing(event.payload.participantId, event.payload.amount);
        }
      )
    );

    // Handle add condition request
    subscriptions.push(
      eventBus.subscribe<CombatAddConditionRequestedPayload>(
        EventTypes.COMBAT_ADD_CONDITION_REQUESTED,
        (event) => {
          addCondition(event.payload.participantId, event.payload.condition);
        }
      )
    );

    // Handle remove condition request
    subscriptions.push(
      eventBus.subscribe<CombatRemoveConditionRequestedPayload>(
        EventTypes.COMBAT_REMOVE_CONDITION_REQUESTED,
        (event) => {
          removeCondition(event.payload.participantId, event.payload.conditionType);
        }
      )
    );

    // Handle update initiative request
    subscriptions.push(
      eventBus.subscribe<CombatUpdateInitiativeRequestedPayload>(
        EventTypes.COMBAT_UPDATE_INITIATIVE_REQUESTED,
        (event) => {
          updateInitiative(event.payload.participantId, event.payload.initiative);
        }
      )
    );

    // Handle party member added - add to combat if active
    subscriptions.push(
      eventBus.subscribe<PartyMemberAddedPayload>(EventTypes.PARTY_MEMBER_ADDED, (event) => {
        const state = store.getState();
        if (state.status !== 'active') return;
        if (!partyFeature) return;

        // Get character data from party
        const membersOpt = partyFeature.getMembers();
        if (!('some' in membersOpt)) return;

        const character = membersOpt.value.find((c) => c.id === event.payload.characterId);
        if (!character) return;

        // Check if already a participant
        if (state.participants.some((p) => p.entityId === event.payload.characterId)) return;

        // Create participant from character
        const participant: CombatParticipant = {
          id: `char-${event.payload.characterId}`,
          type: 'character',
          entityId: event.payload.characterId,
          name: character.name,
          initiative: 0, // GM sets initiative manually
          maxHp: character.maxHp,
          currentHp: character.currentHp,
          conditions: [],
          effects: [],
        };

        store.addParticipant(participant);
        publishStateChanged();
      })
    );

    // Handle party member removed - remove from combat if active
    subscriptions.push(
      eventBus.subscribe<PartyMemberRemovedPayload>(EventTypes.PARTY_MEMBER_REMOVED, (event) => {
        const state = store.getState();
        if (state.status !== 'active') return;

        // Find participant by entityId
        const participant = state.participants.find((p) => p.entityId === event.payload.characterId);
        if (!participant) return;

        store.removeParticipant(participant.id);
        publishStateChanged();
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  function startCombat(
    participants: CombatParticipant[],
    encounterId?: EntityId<'encounter'>
  ): Result<void, AppError> {
    const state = store.getState();

    if (state.status === 'active') {
      return err({
        code: 'COMBAT_ALREADY_ACTIVE',
        message: 'Combat is already in progress',
      });
    }

    if (participants.length === 0) {
      return err({
        code: 'INVALID_PARTICIPANTS',
        message: 'Cannot start combat with no participants',
      });
    }

    const combatId = generateCombatId();
    store.startCombat(combatId, participants, encounterId);

    const newState = store.getState();
    publishCombatStarted(combatId, newState.participants);
    publishStateChanged();

    // Publish turn started for first participant
    const firstParticipant = newState.participants[0];
    if (firstParticipant) {
      publishTurnChanged(firstParticipant.id, newState.roundNumber);
    }

    return ok(undefined);
  }

  function endCombat(): Result<CombatResult, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat to end',
      });
    }

    // Calculate XP - GM adjusts in Resolution-UI if needed
    const xpAwarded = calculateCombatXp(state.participants);

    // Calculate result
    const result: CombatResult = {
      combatId: state.combatId!,
      durationRounds: state.roundNumber,
      xpAwarded,
      encounterId: state.encounterId,
    };

    // Advance game time
    const duration = calculateCombatDuration(state.roundNumber);
    publishTimeAdvance(duration);

    // Clean up
    store.endCombat();

    publishCombatCompleted(result);
    publishStateChanged();

    return ok(result);
  }

  function nextTurn(): Result<void, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat',
      });
    }

    // Process end-of-turn for current participant
    const currentParticipantId = state.initiativeOrder[state.currentTurnIndex];
    if (currentParticipantId) {
      // Decrement effect and condition durations
      const expiredEffects = store.decrementEffectDurations(currentParticipantId);
      const expiredConditions = store.decrementConditionDurations(currentParticipantId);

      // Notify about expired conditions
      for (const condition of expiredConditions) {
        publishConditionRemoved(currentParticipantId, condition.type);
      }
    }

    // Advance turn
    const { newRound } = store.advanceTurn();
    const newState = store.getState();

    // Get new current participant
    const newParticipantId = newState.initiativeOrder[newState.currentTurnIndex];
    if (newParticipantId) {
      publishTurnChanged(newParticipantId, newState.roundNumber);
    }

    publishStateChanged();

    return ok(undefined);
  }

  function applyDamage(participantId: string, amount: number): Result<void, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat',
      });
    }

    const participant = store.getParticipant(participantId);
    if (!participant) {
      return err({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Participant ${participantId} not found`,
      });
    }

    const previousHp = participant.currentHp;
    const newHp = Math.max(0, previousHp - amount);

    store.updateParticipantHp(participantId, newHp);
    publishHpChanged(participantId, previousHp, newHp, -amount);

    // Check for concentration break
    if (needsConcentrationCheck(participant)) {
      const dc = calculateConcentrationDc(amount);
      publishConcentrationCheckRequired({
        participantId,
        spell: participant.concentratingOn!,
        dc,
      });
    }

    // Check for downed character
    if (newHp === 0 && participant.type === 'character') {
      publishCharacterDowned(participantId);
    }

    publishStateChanged();

    return ok(undefined);
  }

  function applyHealing(participantId: string, amount: number): Result<void, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat',
      });
    }

    const participant = store.getParticipant(participantId);
    if (!participant) {
      return err({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Participant ${participantId} not found`,
      });
    }

    const previousHp = participant.currentHp;
    const newHp = Math.min(participant.maxHp, previousHp + amount);

    store.updateParticipantHp(participantId, newHp);
    publishHpChanged(participantId, previousHp, newHp, amount);
    publishStateChanged();

    return ok(undefined);
  }

  function addCondition(participantId: string, condition: Condition): Result<void, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat',
      });
    }

    const participant = store.getParticipant(participantId);
    if (!participant) {
      return err({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Participant ${participantId} not found`,
      });
    }

    store.addCondition(participantId, condition);
    publishConditionAdded(participantId, condition);
    publishStateChanged();

    return ok(undefined);
  }

  function removeCondition(
    participantId: string,
    conditionType: ConditionType
  ): Result<void, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat',
      });
    }

    const participant = store.getParticipant(participantId);
    if (!participant) {
      return err({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Participant ${participantId} not found`,
      });
    }

    store.removeCondition(participantId, conditionType);
    publishConditionRemoved(participantId, conditionType);
    publishStateChanged();

    return ok(undefined);
  }

  function addEffect(participantId: string, effect: CombatEffect): Result<void, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat',
      });
    }

    const participant = store.getParticipant(participantId);
    if (!participant) {
      return err({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Participant ${participantId} not found`,
      });
    }

    store.addEffect(participantId, effect);

    if (eventBus) {
      eventBus.publish(
        createEvent(EventTypes.COMBAT_EFFECT_ADDED, { participantId, effect }, eventOptions())
      );
    }

    publishStateChanged();

    return ok(undefined);
  }

  function removeEffect(participantId: string, effectId: string): Result<void, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat',
      });
    }

    const participant = store.getParticipant(participantId);
    if (!participant) {
      return err({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Participant ${participantId} not found`,
      });
    }

    store.removeEffect(participantId, effectId);

    if (eventBus) {
      eventBus.publish(
        createEvent(EventTypes.COMBAT_EFFECT_REMOVED, { participantId, effectId }, eventOptions())
      );
    }

    publishStateChanged();

    return ok(undefined);
  }

  function updateInitiative(participantId: string, initiative: number): Result<void, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat',
      });
    }

    const participant = store.getParticipant(participantId);
    if (!participant) {
      return err({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Participant ${participantId} not found`,
      });
    }

    store.updateInitiative(participantId, initiative);
    publishStateChanged();

    return ok(undefined);
  }

  function breakConcentration(participantId: string): Result<void, AppError> {
    const state = store.getState();

    if (state.status !== 'active') {
      return err({
        code: 'COMBAT_NOT_ACTIVE',
        message: 'No active combat',
      });
    }

    const participant = store.getParticipant(participantId);
    if (!participant) {
      return err({
        code: 'PARTICIPANT_NOT_FOUND',
        message: `Participant ${participantId} not found`,
      });
    }

    if (!participant.concentratingOn) {
      return ok(undefined); // Nothing to break
    }

    const spell = participant.concentratingOn;
    store.setConcentration(participantId, undefined);
    publishConcentrationBroken(participantId, spell);
    publishStateChanged();

    return ok(undefined);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  function getState(): Readonly<CombatState> {
    return store.getState();
  }

  function isActive(): boolean {
    return store.getState().status === 'active';
  }

  function getCurrentTurnParticipant(): CombatParticipant | null {
    const state = store.getState();
    if (state.status !== 'active') return null;

    const participantId = state.initiativeOrder[state.currentTurnIndex];
    return participantId ? store.getParticipant(participantId) : null;
  }

  function getParticipant(participantId: string): CombatParticipant | null {
    return store.getParticipant(participantId);
  }

  function getEffectsForTurn(
    participantId: string,
    trigger: 'start-of-turn' | 'end-of-turn'
  ): readonly CombatEffect[] {
    const participant = store.getParticipant(participantId);
    if (!participant) return [];

    return trigger === 'start-of-turn'
      ? getStartOfTurnEffects(participant)
      : getEndOfTurnEffects(participant);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  function dispose(): void {
    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }
    subscriptions.length = 0;
  }

  // Initialize
  setupEventHandlers();

  // ---------------------------------------------------------------------------
  // Return Public Interface
  // ---------------------------------------------------------------------------

  return {
    // Queries
    getState,
    isActive,
    getCurrentTurnParticipant,
    getParticipant,
    getEffectsForTurn,

    // Commands
    startCombat,
    endCombat,
    nextTurn,
    applyDamage,
    applyHealing,
    addCondition,
    removeCondition,
    addEffect,
    removeEffect,
    updateInitiative,
    breakConcentration,

    // Lifecycle
    dispose,
  };
}
