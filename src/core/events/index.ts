/**
 * Core events - Public API
 */

export {
  type DomainEvent,
  createEvent,
  newCorrelationId,
  EventTypes,
  type EventType,
  type EventPayloadMap,
  type TimeSegmentChangedPayload,
  type MapLoadedPayload,
  // Travel payloads
  type TravelPositionChangedPayload,
  // Combat payloads
  type CombatStartRequestedPayload,
  type CombatNextTurnRequestedPayload,
  type CombatEndRequestedPayload,
  type CombatApplyDamageRequestedPayload,
  type CombatApplyHealingRequestedPayload,
  type CombatAddConditionRequestedPayload,
  type CombatRemoveConditionRequestedPayload,
  type CombatUpdateInitiativeRequestedPayload,
  type CombatStateChangedPayload,
  type CombatParticipantHpChangedPayload,
  type CombatTurnChangedPayload,
  type CombatConditionChangedPayload,
  type CombatConditionAddedPayload,
  type CombatConditionRemovedPayload,
  type CombatStartedPayload,
  type CombatCompletedPayload,
  type CombatCharacterDownedPayload,
  type CombatConcentrationCheckRequiredPayload,
  type CombatConcentrationBrokenPayload,
  type CombatEffectAddedPayload,
  type CombatEffectRemovedPayload,
  // Time payloads
  type TimeAdvanceRequestedPayload,
  type TimeDayChangedPayload,
  // Loot payloads
  type LootGeneratedPayload,
  // Entity payloads
  type EntitySavedPayload,
  // Party payloads
  type PartyMembersChangedPayload,
} from './domain-events';

export {
  type EventBus,
  type EventHandler,
  type Unsubscribe,
  type PublishOptions,
  type SubscribeOptions,
  createEventBus,
} from './event-bus';

export { TimeoutError } from './timeout-error';
