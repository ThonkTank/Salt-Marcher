/**
 * DetailView ViewModel.
 *
 * Coordinates between DetailView UI and Features.
 * Manages tab state and handles events for auto-open behavior.
 */

import type { EventBus, Unsubscribe } from '@core/index';
import { isSome, EventTypes, createEvent, newCorrelationId, now } from '@core/index';
import type { CombatCompletedPayload } from '@core/events';
import type { EncounterFeaturePort } from '@/features/encounter';
import { groupCreaturesByDefinitionId } from '@/features/encounter';
import type { CombatFeaturePort } from '@/features/combat';
import type {
  DetailViewState,
  DetailViewRenderHint,
  DetailViewRenderCallback,
  TabId,
  BuilderCreature,
  EncounterDifficulty,
  ResolutionState,
} from './types';
import { createInitialDetailViewState } from './types';
import type { EncounterInstance, CreatureDefinition } from '@core/schemas';

// ============================================================================
// ViewModel Dependencies
// ============================================================================

export interface DetailViewModelDeps {
  eventBus: EventBus;
  encounterFeature?: EncounterFeaturePort;
  combatFeature?: CombatFeaturePort;
  /** Creature definitions for CR/XP lookup in encounter builder */
  creatures?: readonly CreatureDefinition[];
  // Note: LootFeaturePort will be added when loot generation is implemented (#2431 follow-up)
}

// ============================================================================
// ViewModel Interface
// ============================================================================

export interface DetailViewModel {
  // State
  getState(): Readonly<DetailViewState>;

  // Subscriptions
  subscribe(callback: DetailViewRenderCallback): () => void;

  // Tab Control
  setActiveTab(tabId: TabId | null): void;
  getActiveTab(): TabId | null;

  // Builder Commands (#2409)
  setBuilderName(name: string): void;
  setBuilderActivity(activity: string): void;
  setBuilderGoal(goal: string): void;
  addCreatureToBuilder(creature: BuilderCreature): void;
  removeCreatureFromBuilder(index: number): void;
  updateCreatureCount(index: number, count: number): void;
  clearBuilder(): void;

  // Resolution Commands (#2431)
  /** Set GM XP modifier percent (-50 to +100) */
  setGmModifierPercent(percent: number): void;
  /** Select quest for 60% XP assignment (null = no quest) */
  selectQuestForXP(questId: string | null): void;
  /** Advance to next resolution phase */
  advanceResolutionPhase(): void;
  /** Skip current resolution phase */
  skipResolutionPhase(): void;
  /** Distribute loot to characters */
  distributeLoot(distribution: Map<string, unknown[]>): void;
  /** Complete resolution and publish events */
  completeResolution(): void;

  // Cleanup
  dispose(): void;
}

// ============================================================================
// ViewModel Implementation
// ============================================================================

/**
 * Create the DetailView ViewModel.
 */
export function createDetailViewModel(
  deps: DetailViewModelDeps
): DetailViewModel {
  const { eventBus, encounterFeature, combatFeature, creatures = [] } = deps;

  // Internal state
  let state: DetailViewState = createInitialDetailViewState();
  const subscribers: Set<DetailViewRenderCallback> = new Set();

  // Track EventBus subscriptions for cleanup
  const eventSubscriptions: Unsubscribe[] = [];

  // =========================================================================
  // Helpers
  // =========================================================================

  function notify(hints: DetailViewRenderHint[]): void {
    for (const callback of subscribers) {
      callback(state, hints);
    }
  }

  function updateState(
    partial: Partial<DetailViewState>,
    hints: DetailViewRenderHint[]
  ): void {
    state = { ...state, ...partial };
    notify(hints);
  }

  /**
   * Get next resolution phase.
   * @see DetailView.md#post-combat-resolution
   */
  function getNextPhase(
    current: ResolutionState['phase']
  ): ResolutionState['phase'] {
    switch (current) {
      case 'xp':
        return 'quest';
      case 'quest':
        return 'loot';
      case 'loot':
        return 'done';
      case 'done':
        return 'done';
    }
  }

  function syncFromFeatures(): void {
    // Encounter
    const encounter = encounterFeature?.getCurrentEncounter();
    const currentEncounter = encounter && isSome(encounter) ? encounter.value : null;

    // Combat
    const combatState = combatFeature?.isActive() ? combatFeature.getState() : null;

    state = {
      ...state,
      encounter: {
        ...state.encounter, // Preserve builder state
        currentEncounter,
      },
      combat: {
        combatState,
        pendingEffects: [],
        resolution: null,
      },
    };
  }

  /**
   * Load an encounter instance into the builder.
   * Called when encounter:generated fires or when loading a saved encounter.
   *
   * Groups creatures by type using groupCreaturesByDefinitionId to fix b5:
   * "Mehrere Kreaturen gleicher Art werden einzeln aufgelistet statt gruppiert"
   */
  function loadEncounterIntoBuilder(encounter: EncounterInstance): void {
    // Group creatures by definition ID (fixes bug b5: creature grouping)
    const grouped = groupCreaturesByDefinitionId(encounter.creatures, creatures);

    // Convert grouped creatures to builder format
    const builderCreatures: BuilderCreature[] = grouped.map(group => ({
      type: 'creature' as const,
      entityId: group.definitionId,
      name: group.name,
      cr: group.cr,
      xp: group.xpEach,
      count: group.count,
    }));

    // Calculate total XP from grouped creatures (with proper CR-based XP)
    const totalXP = grouped.reduce((sum, g) => sum + g.totalXp, 0);

    // Get budget info from encounter if available
    const dailyBudgetUsed = encounter.effectiveXP ?? totalXP;
    const dailyBudgetTotal = encounter.xpBudget ?? 0;

    state = {
      ...state,
      encounter: {
        ...state.encounter,
        currentEncounter: encounter,
        builderName: encounter.description
          ? `${capitalizeFirst(encounter.type)} Encounter`
          : `${capitalizeFirst(encounter.type)} Encounter`,
        builderActivity: encounter.activity ?? '',
        builderGoal: encounter.goal ?? '',
        builderCreatures,
        totalXP,
        difficulty: calculateDifficulty(totalXP),
        dailyBudgetUsed,
        dailyBudgetTotal,
        savedEncounterQuery: '',
        creatureQuery: '',
        sourceEncounterId: null, // New encounter, not from saved
      },
    };
  }

  /**
   * Calculate difficulty from XP (placeholder implementation).
   * Will be replaced by #2414 with proper Encounter-Balancing integration.
   */
  function calculateDifficulty(xp: number): EncounterDifficulty {
    // Placeholder thresholds for a 4-player party at level 5
    if (xp <= 250) return 'easy';
    if (xp <= 500) return 'medium';
    if (xp <= 750) return 'hard';
    return 'deadly';
  }

  /**
   * Capitalize first letter.
   */
  function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Update builder state and recalculate values.
   */
  function updateBuilderState(
    partial: Partial<DetailViewState['encounter']>
  ): void {
    const newEncounter = { ...state.encounter, ...partial };

    // Recalculate totalXP from creatures
    const totalXP = newEncounter.builderCreatures.reduce(
      (sum, c) => sum + c.xp * c.count,
      0
    );

    state = {
      ...state,
      encounter: {
        ...newEncounter,
        totalXP,
        difficulty: calculateDifficulty(totalXP),
      },
    };

    notify(['encounter']);
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  function setupEventHandlers(): void {
    // Encounter generated - auto-open encounter tab and load into builder
    // replay: true ensures late-joining Views receive the sticky event
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.ENCOUNTER_GENERATED,
        () => {
          // Get the encounter and load into builder
          const encounter = encounterFeature?.getCurrentEncounter();
          if (encounter && isSome(encounter)) {
            loadEncounterIntoBuilder(encounter.value);
          } else {
            syncFromFeatures();
          }

          // Auto-open encounter tab (unless combat is active)
          if (state.activeTab !== 'combat' || !state.combat.combatState) {
            state = { ...state, activeTab: 'encounter' };
          }
          notify(['full']);
        },
        { replay: true }
      )
    );

    // Encounter state changed - update encounter display
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.ENCOUNTER_STATE_CHANGED,
        () => {
          syncFromFeatures();
          notify(['encounter']);
        }
      )
    );

    // Combat started - auto-open combat tab (highest priority)
    // replay: true ensures late-joining Views receive the sticky event
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.COMBAT_STARTED,
        () => {
          syncFromFeatures();
          state = { ...state, activeTab: 'combat' };
          notify(['full']);
        },
        { replay: true }
      )
    );

    // Combat state changed - update combat display
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.COMBAT_STATE_CHANGED,
        () => {
          syncFromFeatures();
          notify(['combat']);
        }
      )
    );

    // Combat completed - initialize resolution state (#2431)
    eventSubscriptions.push(
      eventBus.subscribe<CombatCompletedPayload>(
        EventTypes.COMBAT_COMPLETED,
        (event) => {
          // Get XP from event payload
          const baseXP = event.payload.xpAwarded;

          // Initialize resolution state
          state = {
            ...state,
            activeTab: 'combat',
            combat: {
              combatState: null, // Combat is ended
              pendingEffects: [],
              resolution: {
                phase: 'xp',
                baseXP,
                gmModifierPercent: 0,
                adjustedXP: baseXP,
                selectedQuestId: null,
                lootDistribution: new Map(),
              },
            },
          };
          notify(['combat', 'full']);
        }
      )
    );
  }

  // Set up event handlers
  setupEventHandlers();

  // Initial sync
  syncFromFeatures();

  // =========================================================================
  // Public API
  // =========================================================================

  return {
    getState(): Readonly<DetailViewState> {
      return state;
    },

    subscribe(callback: DetailViewRenderCallback): () => void {
      subscribers.add(callback);
      // Immediately call with current state
      callback(state, ['full']);
      return () => subscribers.delete(callback);
    },

    setActiveTab(tabId: TabId | null): void {
      if (tabId === state.activeTab) return;
      updateState({ activeTab: tabId }, ['tabs']);
    },

    getActiveTab(): TabId | null {
      return state.activeTab;
    },

    // =========================================================================
    // Builder Commands (#2409)
    // =========================================================================

    setBuilderName(name: string): void {
      updateBuilderState({ builderName: name });
    },

    setBuilderActivity(activity: string): void {
      updateBuilderState({ builderActivity: activity });
    },

    setBuilderGoal(goal: string): void {
      updateBuilderState({ builderGoal: goal });
    },

    addCreatureToBuilder(creature: BuilderCreature): void {
      const newCreatures = [...state.encounter.builderCreatures, creature];
      updateBuilderState({ builderCreatures: newCreatures });
    },

    removeCreatureFromBuilder(index: number): void {
      const newCreatures = state.encounter.builderCreatures.filter(
        (_, i) => i !== index
      );
      updateBuilderState({ builderCreatures: newCreatures });
    },

    updateCreatureCount(index: number, count: number): void {
      const newCreatures = state.encounter.builderCreatures.map((c, i) =>
        i === index ? { ...c, count: Math.max(1, count) } : c
      );
      updateBuilderState({ builderCreatures: newCreatures });
    },

    clearBuilder(): void {
      updateBuilderState({
        builderName: '',
        builderActivity: '',
        builderGoal: '',
        builderCreatures: [],
        sourceEncounterId: null,
      });
    },

    // =========================================================================
    // Resolution Commands (#2431)
    // =========================================================================

    setGmModifierPercent(percent: number): void {
      if (!state.combat.resolution) return;

      const clampedPercent = Math.max(-50, Math.min(100, percent));
      const adjustedXP = Math.floor(
        state.combat.resolution.baseXP * (1 + clampedPercent / 100)
      );

      state = {
        ...state,
        combat: {
          ...state.combat,
          resolution: {
            ...state.combat.resolution,
            gmModifierPercent: clampedPercent,
            adjustedXP,
          },
        },
      };
      notify(['combat']);
    },

    selectQuestForXP(questId: string | null): void {
      if (!state.combat.resolution) return;

      state = {
        ...state,
        combat: {
          ...state.combat,
          resolution: {
            ...state.combat.resolution,
            selectedQuestId: questId,
          },
        },
      };
      notify(['combat']);
    },

    advanceResolutionPhase(): void {
      if (!state.combat.resolution) return;

      const currentPhase = state.combat.resolution.phase;
      const nextPhase = getNextPhase(currentPhase);

      // Before phase change: publish events for completed phase
      if (currentPhase === 'quest' && state.combat.resolution.selectedQuestId) {
        const questPoolXP = Math.floor(state.combat.resolution.adjustedXP * 0.6);
        eventBus.publish(
          createEvent(
            EventTypes.QUEST_XP_ACCUMULATED,
            {
              questId: state.combat.resolution.selectedQuestId,
              amount: questPoolXP,
            },
            {
              correlationId: newCorrelationId(),
              timestamp: now(),
              source: 'detail-view-viewmodel',
            }
          )
        );
      }

      state = {
        ...state,
        combat: {
          ...state.combat,
          resolution: {
            ...state.combat.resolution,
            phase: nextPhase,
          },
        },
      };
      notify(['combat']);
    },

    skipResolutionPhase(): void {
      if (!state.combat.resolution) return;

      // Skip advances to next phase without triggering phase-specific events
      const currentPhase = state.combat.resolution.phase;
      const nextPhase = getNextPhase(currentPhase);

      state = {
        ...state,
        combat: {
          ...state.combat,
          resolution: {
            ...state.combat.resolution,
            phase: nextPhase,
          },
        },
      };
      notify(['combat']);
    },

    distributeLoot(distribution: Map<string, unknown[]>): void {
      if (!state.combat.resolution) return;

      state = {
        ...state,
        combat: {
          ...state.combat,
          resolution: {
            ...state.combat.resolution,
            lootDistribution: distribution,
          },
        },
      };
      notify(['combat']);
    },

    completeResolution(): void {
      if (!state.combat.resolution) return;

      // Publish encounter:resolved event
      eventBus.publish(
        createEvent(
          EventTypes.ENCOUNTER_RESOLVED,
          {
            xpAwarded: state.combat.resolution.adjustedXP,
            questId: state.combat.resolution.selectedQuestId,
          },
          {
            correlationId: newCorrelationId(),
            timestamp: now(),
            source: 'detail-view-viewmodel',
          }
        )
      );

      // Publish loot:distributed event if items were distributed
      if (state.combat.resolution.lootDistribution.size > 0) {
        eventBus.publish(
          createEvent(
            EventTypes.LOOT_DISTRIBUTED,
            {
              distribution: Object.fromEntries(state.combat.resolution.lootDistribution),
            },
            {
              correlationId: newCorrelationId(),
              timestamp: now(),
              source: 'detail-view-viewmodel',
            }
          )
        );
      }

      // Reset resolution state
      state = {
        ...state,
        combat: {
          ...state.combat,
          resolution: null,
        },
      };
      notify(['combat', 'full']);
    },

    dispose(): void {
      // Clean up EventBus subscriptions
      for (const unsubscribe of eventSubscriptions) {
        unsubscribe();
      }
      eventSubscriptions.length = 0;

      // Clean up render subscribers
      subscribers.clear();
    },
  };
}
