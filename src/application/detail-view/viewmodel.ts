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
} from './types';
import { createInitialDetailViewState } from './types';

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
        currentEncounter,
      },
      combat: {
        combatState,
      },
    };
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  function setupEventHandlers(): void {
    // Encounter generated - auto-open encounter tab
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.ENCOUNTER_GENERATED,
        () => {
          syncFromFeatures();
          // Auto-open encounter tab (unless combat is active)
          if (state.activeTab !== 'combat' || !state.combat.combatState) {
            state = { ...state, activeTab: 'encounter' };
          }
          notify(['full']);
        }
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
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.COMBAT_STARTED,
        () => {
          syncFromFeatures();
          state = { ...state, activeTab: 'combat' };
          notify(['full']);
        }
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
