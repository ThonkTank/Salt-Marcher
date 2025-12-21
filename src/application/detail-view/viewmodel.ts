/**
 * DetailView ViewModel.
 *
 * Coordinates between DetailView UI and Features.
 * Manages tab state and handles events for auto-open behavior.
 */

import type { EventBus, Unsubscribe } from '@core/index';
import { isSome, EventTypes } from '@core/index';
import type { EncounterFeaturePort } from '@/features/encounter';
import type { CombatFeaturePort } from '@/features/combat';
import type {
  DetailViewState,
  DetailViewRenderHint,
  DetailViewRenderCallback,
  TabId,
  BuilderCreature,
  EncounterDifficulty,
} from './types';
import { createInitialDetailViewState } from './types';
import type { EncounterInstance } from '@core/schemas';

// ============================================================================
// ViewModel Dependencies
// ============================================================================

export interface DetailViewModelDeps {
  eventBus: EventBus;
  encounterFeature?: EncounterFeaturePort;
  combatFeature?: CombatFeaturePort;
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
  const { eventBus, encounterFeature, combatFeature } = deps;

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
   */
  function loadEncounterIntoBuilder(encounter: EncounterInstance): void {
    // Convert creatures from encounter to builder format
    const builderCreatures: BuilderCreature[] = encounter.creatures.map(creature => ({
      type: 'creature' as const,
      entityId: creature.definitionId,
      name: creature.definitionId.split(':')[1] ?? creature.definitionId,
      cr: 0, // TODO: Get from creature definition when available
      xp: 0, // TODO: Calculate from CR
      count: 1,
    }));

    // Calculate XP (placeholder - will be replaced by #2414)
    const totalXP = encounter.xpAwarded ?? 0;

    state = {
      ...state,
      encounter: {
        ...state.encounter,
        currentEncounter: encounter,
        builderName: `${capitalizeFirst(encounter.type)} Encounter`,
        builderActivity: '',
        builderGoal: '',
        builderCreatures,
        totalXP,
        difficulty: calculateDifficulty(totalXP),
        dailyBudgetUsed: 0, // TODO: Get from party feature
        dailyBudgetTotal: 0, // TODO: Get from party feature
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

    // Combat completed - stay on combat tab (show summary)
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.COMBAT_COMPLETED,
        () => {
          syncFromFeatures();
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
