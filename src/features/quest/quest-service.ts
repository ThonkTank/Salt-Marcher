/**
 * Quest Feature service.
 *
 * Implements the quest state machine and 40/60 XP split.
 *
 * @see docs/features/Quest-System.md
 */

import type { EventBus, Timestamp } from '@core/index';
import { ok, err, some, none } from '@core/index';
import type { Result, AppError, Option, EntityId } from '@core/index';
import {
  EventTypes,
  type DomainEvent,
  type EncounterResolvedPayload,
  type TimeStateChangedPayload,
  type QuestDiscoverRequestedPayload,
  type QuestActivateRequestedPayload,
  type QuestCompleteObjectiveRequestedPayload,
  type QuestAssignEncounterRequestedPayload,
  type QuestFailRequestedPayload,
} from '@core/events/domain-events';
import type {
  QuestDefinition,
  QuestFailReason,
  GameDateTime,
  Duration,
} from '@core/schemas';

import type {
  QuestFeaturePort,
  QuestProgress,
  ObjectiveProgress,
  QuestCompletionResult,
  OpenEncounterSlot,
  SerializableQuestState,
} from './types';
import type { QuestStore } from './quest-store';
import { createQuestStore } from './quest-store';
import { calculateQuestPoolXP, calculateQuestCompletionXP } from './quest-xp';

// ============================================================================
// Service Dependencies
// ============================================================================

export interface QuestServiceDeps {
  /** EventBus for pub/sub */
  eventBus: EventBus;

  /** Quest definitions (from presets or EntityRegistry) */
  questDefinitions: readonly QuestDefinition[];

  /** Function to get current game time */
  getCurrentTime: () => GameDateTime;

  /** Function to add duration to time (for deadline calculation) */
  addDurationToTime: (time: GameDateTime, duration: Duration) => GameDateTime;

  /** Function to compare times (returns true if a > b) */
  isAfter: (a: GameDateTime, b: GameDateTime) => boolean;
}

// ============================================================================
// Quest Service Factory
// ============================================================================

/**
 * Create the Quest Feature service.
 */
export function createQuestService(deps: QuestServiceDeps): QuestFeaturePort {
  const { eventBus, questDefinitions, getCurrentTime, addDurationToTime, isAfter } = deps;

  const store = createQuestStore();
  const subscriptions: Array<() => void> = [];

  // Helper to find quest definition
  function findQuestDefinition(questId: string): QuestDefinition | undefined {
    return questDefinitions.find((q) => q.id === questId);
  }

  // Helper to create correlation ID
  function newCorrelationId(): string {
    return crypto.randomUUID();
  }

  // Helper to get timestamp
  function now(): Timestamp {
    return Date.now() as Timestamp;
  }

  // Helper to publish events
  function publish<T>(type: string, payload: T, correlationId?: string): void {
    eventBus.publish({
      type,
      payload,
      correlationId: correlationId ?? newCorrelationId(),
      timestamp: now(),
      source: 'quest-service',
    });
  }

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  function setupEventHandlers(): void {
    // Handle encounter resolved - check for open quest slots
    subscriptions.push(
      eventBus.subscribe<EncounterResolvedPayload>(
        EventTypes.ENCOUNTER_RESOLVED,
        (event) => {
          handleEncounterResolved(event);
        }
      )
    );

    // Handle time state changed - check deadlines
    subscriptions.push(
      eventBus.subscribe<TimeStateChangedPayload>(
        EventTypes.TIME_STATE_CHANGED,
        (event) => {
          checkDeadlines(event.payload.currentTime);
        }
      )
    );

    // Handle quest commands
    subscriptions.push(
      eventBus.subscribe<QuestDiscoverRequestedPayload>(
        EventTypes.QUEST_DISCOVER_REQUESTED,
        (event) => {
          discoverQuest(event.payload.questId as EntityId<'quest'>);
        }
      )
    );

    subscriptions.push(
      eventBus.subscribe<QuestActivateRequestedPayload>(
        EventTypes.QUEST_ACTIVATE_REQUESTED,
        (event) => {
          activateQuest(event.payload.questId as EntityId<'quest'>);
        }
      )
    );

    subscriptions.push(
      eventBus.subscribe<QuestCompleteObjectiveRequestedPayload>(
        EventTypes.QUEST_COMPLETE_OBJECTIVE_REQUESTED,
        (event) => {
          completeObjective(
            event.payload.questId as EntityId<'quest'>,
            event.payload.objectiveId
          );
        }
      )
    );

    subscriptions.push(
      eventBus.subscribe<QuestAssignEncounterRequestedPayload>(
        EventTypes.QUEST_ASSIGN_ENCOUNTER_REQUESTED,
        (event) => {
          assignEncounter(
            event.payload.questId as EntityId<'quest'>,
            event.payload.slotId,
            event.payload.encounterId,
            event.payload.encounterXP
          );
        }
      )
    );

    subscriptions.push(
      eventBus.subscribe<QuestFailRequestedPayload>(
        EventTypes.QUEST_FAIL_REQUESTED,
        (event) => {
          failQuest(
            event.payload.questId as EntityId<'quest'>,
            event.payload.reason as QuestFailReason
          );
        }
      )
    );
  }

  function handleEncounterResolved(event: DomainEvent<EncounterResolvedPayload>): void {
    const openSlots = getOpenEncounterSlots();

    if (openSlots.length > 0) {
      // Notify UI that slot assignment is available
      publish(EventTypes.QUEST_SLOT_ASSIGNMENT_AVAILABLE, {
        encounterId: event.payload.encounterId,
        encounterXP: event.payload.xpAwarded,
        openSlots: openSlots,
      }, event.correlationId);
    }
    // If no open slots, the 60% XP is forfeited (random encounter)
  }

  function checkDeadlines(currentTime: GameDateTime): void {
    for (const progress of store.getActiveQuests()) {
      if (!progress.deadlineAt) continue;

      if (isAfter(currentTime, progress.deadlineAt)) {
        // Deadline exceeded - fail the quest
        failQuestInternal(progress.questId, 'deadline');
      }
    }
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  function createInitialProgress(
    questId: EntityId<'quest'>,
    definition: QuestDefinition
  ): QuestProgress {
    const currentTime = getCurrentTime();

    // Calculate deadline if defined
    let deadlineAt: GameDateTime | undefined;
    if (definition.deadline) {
      deadlineAt = addDurationToTime(currentTime, definition.deadline);
    }

    // Initialize objective progress
    const objectiveProgress = new Map<string, ObjectiveProgress>();
    for (const objective of definition.objectives) {
      const targetCount = objective.target?.count ?? objective.target?.quantity ?? 1;
      objectiveProgress.set(objective.id, {
        objectiveId: objective.id,
        currentCount: 0,
        targetCount,
        completed: false,
      });
    }

    return {
      questId,
      status: 'active',
      startedAt: currentTime,
      deadlineAt,
      objectiveProgress,
      encounterSlotsFilled: new Map(),
      accumulatedXP: 0,
      placedRewards: new Map(),
    };
  }

  function publishStateChanged(): void {
    publish(EventTypes.QUEST_STATE_CHANGED, {
      state: store.serialize(),
    });
  }

  function failQuestInternal(questId: EntityId<'quest'>, reason: QuestFailReason): void {
    store.updateStatus(questId, 'failed');
    store.failQuest(questId);

    publish(EventTypes.QUEST_FAILED, {
      questId,
      reason,
    });

    publishStateChanged();
  }

  function checkAllObjectivesCompleted(progress: QuestProgress, definition: QuestDefinition): boolean {
    for (const objective of definition.objectives) {
      if (!objective.required) continue;

      const objProgress = progress.objectiveProgress.get(objective.id);
      if (!objProgress?.completed) {
        return false;
      }
    }
    return true;
  }

  // ==========================================================================
  // Public API Implementation
  // ==========================================================================

  function getQuestProgress(questId: EntityId<'quest'>): Option<QuestProgress> {
    const progress = store.getQuestProgress(questId);
    return progress ? some(progress) : none();
  }

  function getActiveQuests(): readonly QuestProgress[] {
    return store.getActiveQuests().filter((p) => p.status === 'active');
  }

  function getDiscoveredQuests(): readonly EntityId<'quest'>[] {
    return Array.from(store.getState().discoveredQuests) as EntityId<'quest'>[];
  }

  function getQuestsWithOpenSlots(): readonly QuestProgress[] {
    return store.getActiveQuests().filter((progress) => {
      const definition = findQuestDefinition(progress.questId);
      if (!definition) return false;
      return store.hasOpenEncounterSlots(progress.questId, definition);
    });
  }

  function getOpenEncounterSlots(): readonly OpenEncounterSlot[] {
    const result: OpenEncounterSlot[] = [];

    for (const progress of store.getActiveQuests()) {
      if (progress.status !== 'active') continue;

      const definition = findQuestDefinition(progress.questId);
      if (!definition) continue;

      for (const slot of definition.encounters) {
        if (!progress.encounterSlotsFilled.has(slot.id)) {
          result.push({
            questId: progress.questId,
            questName: definition.name,
            slotId: slot.id,
            slotDescription: slot.description,
            slotType: slot.type,
          });
        }
      }
    }

    return result;
  }

  function getAccumulatedXP(questId: EntityId<'quest'>): number {
    const progress = store.getQuestProgress(questId);
    return progress?.accumulatedXP ?? 0;
  }

  function getQuestDefinition(questId: EntityId<'quest'>): Option<QuestDefinition> {
    const definition = findQuestDefinition(questId);
    return definition ? some(definition) : none();
  }

  function discoverQuest(questId: EntityId<'quest'>): Result<void, AppError> {
    const definition = findQuestDefinition(questId);
    if (!definition) {
      return err({
        code: 'QUEST_NOT_FOUND',
        message: `Quest ${questId} not found`,
      });
    }

    // Check if already discovered or active
    if (store.isDiscovered(questId)) {
      return err({
        code: 'QUEST_ALREADY_DISCOVERED',
        message: `Quest ${questId} is already discovered`,
      });
    }

    if (store.getQuestProgress(questId)) {
      return err({
        code: 'QUEST_ALREADY_ACTIVE',
        message: `Quest ${questId} is already active`,
      });
    }

    store.setDiscovered(questId);

    publish(EventTypes.QUEST_DISCOVERED, {
      questId,
      quest: definition,
    });

    publishStateChanged();
    return ok(undefined);
  }

  function activateQuest(questId: EntityId<'quest'>): Result<void, AppError> {
    const definition = findQuestDefinition(questId);
    if (!definition) {
      return err({
        code: 'QUEST_NOT_FOUND',
        message: `Quest ${questId} not found`,
      });
    }

    // Must be discovered first (or allow direct activation)
    if (!store.isDiscovered(questId)) {
      // Auto-discover if not discovered
      store.setDiscovered(questId);
    }

    // Check if already active
    if (store.getQuestProgress(questId)) {
      return err({
        code: 'QUEST_ALREADY_ACTIVE',
        message: `Quest ${questId} is already active`,
      });
    }

    // Check if already completed/failed
    if (store.isCompleted(questId)) {
      return err({
        code: 'QUEST_ALREADY_COMPLETED',
        message: `Quest ${questId} is already completed`,
      });
    }

    if (store.isFailed(questId)) {
      return err({
        code: 'QUEST_ALREADY_FAILED',
        message: `Quest ${questId} has already failed`,
      });
    }

    // Create initial progress and activate
    const progress = createInitialProgress(questId, definition);
    store.removeDiscovered(questId);
    store.activateQuest(questId, progress);

    publish(EventTypes.QUEST_ACTIVATED, { questId });
    publishStateChanged();

    return ok(undefined);
  }

  function completeObjective(
    questId: EntityId<'quest'>,
    objectiveId: string
  ): Result<void, AppError> {
    const progress = store.getQuestProgress(questId);
    if (!progress) {
      return err({
        code: 'QUEST_NOT_ACTIVE',
        message: `Quest ${questId} is not active`,
      });
    }

    if (progress.status !== 'active') {
      return err({
        code: 'QUEST_NOT_ACTIVE',
        message: `Quest ${questId} is not in active state`,
      });
    }

    const definition = findQuestDefinition(questId);
    if (!definition) {
      return err({
        code: 'QUEST_NOT_FOUND',
        message: `Quest ${questId} definition not found`,
      });
    }

    const objective = definition.objectives.find((o) => o.id === objectiveId);
    if (!objective) {
      return err({
        code: 'OBJECTIVE_NOT_FOUND',
        message: `Objective ${objectiveId} not found in quest ${questId}`,
      });
    }

    const objProgress = progress.objectiveProgress.get(objectiveId);
    if (!objProgress) {
      return err({
        code: 'OBJECTIVE_NOT_TRACKED',
        message: `Objective ${objectiveId} is not being tracked`,
      });
    }

    if (objProgress.completed) {
      return ok(undefined); // Already completed, no-op
    }

    // Update progress
    const newObjProgress: ObjectiveProgress = {
      ...objProgress,
      currentCount: objProgress.targetCount, // Mark as fully completed
      completed: true,
    };

    store.updateObjectiveProgress(questId, objectiveId, newObjProgress);

    // Count remaining required objectives
    const remainingObjectives = definition.objectives.filter((o) => {
      if (!o.required) return false;
      const p = progress.objectiveProgress.get(o.id);
      return !p?.completed && o.id !== objectiveId;
    }).length;

    publish(EventTypes.QUEST_OBJECTIVE_COMPLETED, {
      questId,
      objectiveId,
      remainingObjectives,
    });

    publishStateChanged();
    return ok(undefined);
  }

  function assignEncounter(
    questId: EntityId<'quest'>,
    slotId: string,
    encounterId: string,
    encounterXP: number
  ): Result<void, AppError> {
    const progress = store.getQuestProgress(questId);
    if (!progress) {
      return err({
        code: 'QUEST_NOT_ACTIVE',
        message: `Quest ${questId} is not active`,
      });
    }

    if (progress.status !== 'active') {
      return err({
        code: 'QUEST_NOT_ACTIVE',
        message: `Quest ${questId} is not in active state`,
      });
    }

    const definition = findQuestDefinition(questId);
    if (!definition) {
      return err({
        code: 'QUEST_NOT_FOUND',
        message: `Quest ${questId} definition not found`,
      });
    }

    const slot = definition.encounters.find((s) => s.id === slotId);
    if (!slot) {
      return err({
        code: 'SLOT_NOT_FOUND',
        message: `Encounter slot ${slotId} not found in quest ${questId}`,
      });
    }

    if (progress.encounterSlotsFilled.has(slotId)) {
      return err({
        code: 'SLOT_ALREADY_FILLED',
        message: `Encounter slot ${slotId} is already filled`,
      });
    }

    // Fill the slot
    store.fillEncounterSlot(questId, slotId, encounterId);

    // Calculate and accumulate 60% XP
    const xpToAccumulate = calculateQuestPoolXP(encounterXP);
    store.addAccumulatedXP(questId, xpToAccumulate);

    publish(EventTypes.QUEST_XP_ACCUMULATED, {
      questId,
      amount: xpToAccumulate,
    });

    publish(EventTypes.QUEST_ENCOUNTER_ASSIGNED, {
      questId,
      slotId,
      encounterId,
      xpAccumulated: xpToAccumulate,
    });

    publishStateChanged();
    return ok(undefined);
  }

  function completeQuest(questId: EntityId<'quest'>): Result<QuestCompletionResult, AppError> {
    const progress = store.getQuestProgress(questId);
    if (!progress) {
      return err({
        code: 'QUEST_NOT_ACTIVE',
        message: `Quest ${questId} is not active`,
      });
    }

    if (progress.status !== 'active') {
      return err({
        code: 'QUEST_NOT_ACTIVE',
        message: `Quest ${questId} is not in active state`,
      });
    }

    const definition = findQuestDefinition(questId);
    if (!definition) {
      return err({
        code: 'QUEST_NOT_FOUND',
        message: `Quest ${questId} definition not found`,
      });
    }

    // Check if all required objectives are completed
    if (!checkAllObjectivesCompleted(progress, definition)) {
      return err({
        code: 'OBJECTIVES_NOT_COMPLETE',
        message: `Not all required objectives are completed for quest ${questId}`,
      });
    }

    // Calculate total XP
    const xpAwarded = calculateQuestCompletionXP(progress.accumulatedXP);

    // Update status and move to completed
    store.updateStatus(questId, 'completed');
    store.completeQuest(questId);

    // Publish events
    publish(EventTypes.QUEST_COMPLETED, {
      questId,
      rewards: definition.rewards,
      xpAwarded,
    });

    // Trigger party XP gain
    publish(EventTypes.PARTY_XP_GAINED, {
      amount: xpAwarded,
      source: `quest:${questId}`,
    });

    publishStateChanged();

    return ok({
      questId,
      xpAwarded,
      rewards: definition.rewards,
    });
  }

  function failQuest(
    questId: EntityId<'quest'>,
    reason: QuestFailReason
  ): Result<void, AppError> {
    const progress = store.getQuestProgress(questId);
    if (!progress) {
      return err({
        code: 'QUEST_NOT_ACTIVE',
        message: `Quest ${questId} is not active`,
      });
    }

    if (progress.status !== 'active') {
      return err({
        code: 'QUEST_NOT_ACTIVE',
        message: `Quest ${questId} is not in active state`,
      });
    }

    failQuestInternal(questId, reason);
    return ok(undefined);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  async function initialize(): Promise<void> {
    setupEventHandlers();
  }

  function getResumableState(): SerializableQuestState {
    return store.serialize();
  }

  function restoreState(state: SerializableQuestState): void {
    store.restore(state);
  }

  function dispose(): void {
    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }
    subscriptions.length = 0;
  }

  // ==========================================================================
  // Return Public Interface
  // ==========================================================================

  return {
    // Queries
    getQuestProgress,
    getActiveQuests,
    getDiscoveredQuests,
    getQuestsWithOpenSlots,
    getOpenEncounterSlots,
    getAccumulatedXP,
    getQuestDefinition,

    // Commands
    discoverQuest,
    activateQuest,
    completeObjective,
    assignEncounter,
    completeQuest,
    failQuest,

    // Lifecycle
    initialize,
    getResumableState,
    restoreState,
    dispose,
  };
}
