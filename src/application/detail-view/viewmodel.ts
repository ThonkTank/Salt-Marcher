/**
 * DetailView ViewModel.
 *
 * Coordinates between DetailView UI and Features.
 * Manages tab state and handles events for auto-open behavior.
 */

import type { EventBus, Unsubscribe } from '@core/index';
import { isSome, EventTypes, createEvent, newCorrelationId, now } from '@core/index';
import type { EntityId } from '@core/types';
import type { CombatCompletedPayload, EntitySavedPayload } from '@core/events';
import type { CombatFeaturePort } from '@/features/combat';
import type { PartyFeaturePort } from '@/features/party';
import type {
  DetailViewState,
  DetailViewRenderHint,
  DetailViewRenderCallback,
  TabId,
  ResolutionState,
  CharacterDisplay,
  PartyTabState,
} from './types';
import { createInitialDetailViewState } from './types';
import type { Character } from '@core/schemas';
import type { EncumbranceLevel } from '@/features/inventory';
import { calculateEncumbrance, calculateEffectiveSpeed } from '@/features/inventory/inventory-utils';
import type { Item } from '@core/schemas';
import type { EntityRegistryPort } from '@core/types/entity-registry.port';

// ============================================================================
// ViewModel Dependencies
// ============================================================================

export interface DetailViewModelDeps {
  eventBus: EventBus;
  combatFeature?: CombatFeaturePort;
  partyFeature?: PartyFeaturePort;
  entityRegistry?: EntityRegistryPort;
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

  // Party Commands (#3216)
  /** Toggle expanded state for a party member */
  togglePartyMemberExpanded(characterId: string): void;

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
  const { eventBus, combatFeature, partyFeature, entityRegistry } = deps;

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

  // =========================================================================
  // Party State Helpers (#3217)
  // =========================================================================

  /**
   * Item lookup helper for encumbrance calculation.
   * Returns undefined if entityRegistry is not available or item not found.
   */
  const itemLookup = (id: EntityId<'item'>): Item | undefined => {
    if (!entityRegistry) return undefined;
    return entityRegistry.get('item', id) as Item | undefined;
  };

  /**
   * Map a Character to CharacterDisplay format for the Party Tab.
   * @see DetailView.md#party-tab
   */
  function mapCharacterToDisplay(
    character: Character,
    expanded: boolean = false
  ): CharacterDisplay {
    // Calculate encumbrance from inventory if entityRegistry available
    const encumbranceLevel: EncumbranceLevel = entityRegistry
      ? calculateEncumbrance(character, itemLookup).level
      : 'light';

    return {
      id: character.id,
      name: character.name,
      level: character.level,
      class: character.class,
      currentHp: character.currentHp,
      maxHp: character.maxHp,
      ac: character.ac,
      passivePerception: 10 + Math.floor((character.wisdom - 10) / 2),
      speed: character.speed,
      encumbrance: encumbranceLevel,
      expanded,
    };
  }

  /**
   * Calculate aggregate party stats from member displays.
   * @see DetailView.md#party-tab
   */
  function calculatePartyStats(members: CharacterDisplay[]): PartyTabState['partyStats'] {
    if (members.length === 0) {
      return {
        memberCount: 0,
        averageLevel: 0,
        travelSpeed: 0,
        encumbranceStatus: 'light',
      };
    }

    const avgLevel = Math.round(
      members.reduce((sum, m) => sum + m.level, 0) / members.length
    );

    // Calculate effective speed per member (with encumbrance reduction), then take minimum
    const minSpeed = Math.min(
      ...members.map((m) => calculateEffectiveSpeed(m.speed, m.encumbrance))
    );

    // Worst encumbrance level determines party encumbrance
    const encumbrancePriority: Record<EncumbranceLevel, number> = {
      light: 0,
      encumbered: 1,
      heavily: 2,
      over_capacity: 3,
    };
    const worstEncumbrance = members.reduce(
      (worst, m) =>
        encumbrancePriority[m.encumbrance] > encumbrancePriority[worst]
          ? m.encumbrance
          : worst,
      'light' as EncumbranceLevel
    );

    return {
      memberCount: members.length,
      averageLevel: avgLevel,
      travelSpeed: minSpeed,
      encumbranceStatus: worstEncumbrance,
    };
  }

  /**
   * Update party state from PartyFeature.
   * Preserves expanded UI state for existing members.
   * @see DetailView.md#party-tab
   */
  function updatePartyState(): void {
    if (!partyFeature) {
      // No party feature - keep default empty state
      return;
    }

    const membersOpt = partyFeature.getMembers();
    if (!isSome(membersOpt)) {
      // No party loaded - reset to empty
      state = {
        ...state,
        party: {
          members: [],
          partyStats: calculatePartyStats([]),
        },
      };
      notify(['full']);
      return;
    }

    // Preserve expanded state for existing members
    const existingExpanded = new Map(
      state.party.members.map((m) => [m.id, m.expanded])
    );

    const members = membersOpt.value.map((character) =>
      mapCharacterToDisplay(
        character,
        existingExpanded.get(character.id) ?? false
      )
    );

    state = {
      ...state,
      party: {
        members,
        partyStats: calculatePartyStats(members),
      },
    };
    notify(['full']);
  }

  function syncFromFeatures(): void {
    // Combat
    const combatState = combatFeature?.isActive() ? combatFeature.getState() : null;

    // Party (#3217)
    let partyState = state.party;
    if (partyFeature) {
      const membersOpt = partyFeature.getMembers();
      if (isSome(membersOpt)) {
        const members = membersOpt.value.map((c) =>
          mapCharacterToDisplay(c, false)
        );
        partyState = {
          members,
          partyStats: calculatePartyStats(members),
        };
      }
    }

    state = {
      ...state,
      combat: {
        combatState,
        pendingEffects: [],
        resolution: null,
      },
      party: partyState,
    };
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  function setupEventHandlers(): void {
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

    // =========================================================================
    // Party Events (#3217)
    // =========================================================================

    // Party state changed - update party display
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.PARTY_STATE_CHANGED,
        () => updatePartyState()
      )
    );

    // Party member added
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.PARTY_MEMBER_ADDED,
        () => updatePartyState()
      )
    );

    // Party member removed
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.PARTY_MEMBER_REMOVED,
        () => updatePartyState()
      )
    );

    // Party loaded
    eventSubscriptions.push(
      eventBus.subscribe(
        EventTypes.PARTY_LOADED,
        () => updatePartyState()
      )
    );

    // Entity saved (for character HP/stat updates)
    eventSubscriptions.push(
      eventBus.subscribe<EntitySavedPayload>(
        EventTypes.ENTITY_SAVED,
        (event) => {
          // Only update if a character was saved
          if (event.payload.type === 'character') {
            updatePartyState();
          }
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

    // =========================================================================
    // Party Commands (#3216)
    // =========================================================================

    togglePartyMemberExpanded(characterId: string): void {
      const updatedMembers = state.party.members.map((member) =>
        member.id === characterId
          ? { ...member, expanded: !member.expanded }
          : member
      );

      state = {
        ...state,
        party: {
          ...state.party,
          members: updatedMembers,
        },
      };
      notify(['full']);
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
