/**
 * DetailView types.
 */

import type {
  CombatState,
  CombatEffect,
} from '@core/schemas';
import type { EntityId } from '@core/types';
import type { EncumbranceLevel } from '@/features/inventory';

// ============================================================================
// View Types
// ============================================================================

/** View type identifier for Obsidian */
export const VIEW_TYPE_DETAIL_VIEW = 'salt-marcher-detail-view';

// ============================================================================
// Tab Types
// ============================================================================

/** Available tabs in DetailView */
export type TabId = 'combat' | 'party';

// ============================================================================
// Tab State Types
// ============================================================================

/**
 * Combat tab state.
 */
export interface CombatTabState {
  combatState: CombatState | null;
  /** Pending effects to be resolved at start/end of turn */
  pendingEffects: CombatEffect[];
  /** Post-combat resolution state (XP, Quest, Loot) */
  resolution: ResolutionState | null;
}

/**
 * Character display info for Party Tab.
 * Simplified view of character data for the member list.
 * @see DetailView.md#party-tab
 */
export interface CharacterDisplay {
  id: EntityId<'character'>;
  name: string;
  level: number;
  class: string;
  currentHp: number;
  maxHp: number;
  ac: number;
  passivePerception: number;
  speed: number;
  encumbrance: EncumbranceLevel;
  /** UI state: whether the member row is expanded */
  expanded: boolean;
}

/**
 * Party tab state.
 * @see DetailView.md#party-tab
 */
export interface PartyTabState {
  /** Party members for display */
  members: CharacterDisplay[];
  /** Aggregate party stats */
  partyStats: {
    memberCount: number;
    averageLevel: number;
    travelSpeed: number;
    encumbranceStatus: EncumbranceLevel;
  };
}

/**
 * Post-combat resolution state.
 * Tracks XP distribution, quest assignment, and loot.
 * @see DetailView.md#post-combat-resolution
 */
export interface ResolutionState {
  /** Current resolution phase */
  phase: 'xp' | 'quest' | 'loot' | 'done';
  /** Base XP from defeated creatures */
  baseXP: number;
  /** GM adjustment percentage (-50 to +100) */
  gmModifierPercent: number;
  /** Adjusted XP after GM modifier */
  adjustedXP: number;
  /** Selected quest for XP assignment (null = no quest) */
  selectedQuestId: string | null;
  /** Loot distribution by character ID */
  lootDistribution: Map<string, unknown[]>;
}

// ============================================================================
// DetailView State
// ============================================================================

/**
 * State for the DetailView.
 */
export interface DetailViewState {
  /** Currently active tab (null = idle/empty state) */
  activeTab: TabId | null;

  /** Combat tab state */
  combat: CombatTabState;

  /** Party tab state */
  party: PartyTabState;
}

/**
 * Create initial DetailView state.
 */
export function createInitialDetailViewState(): DetailViewState {
  return {
    activeTab: null,
    combat: {
      combatState: null,
      pendingEffects: [],
      resolution: null,
    },
    party: {
      members: [],
      partyStats: {
        memberCount: 0,
        averageLevel: 0,
        travelSpeed: 0,
        encumbranceStatus: 'light',
      },
    },
  };
}

// ============================================================================
// Render Hints
// ============================================================================

/**
 * Hints for optimized rendering.
 */
export type DetailViewRenderHint =
  | 'full'    // Full re-render
  | 'tabs'    // Tab navigation changed
  | 'combat'; // Combat state changed

// ============================================================================
// Callbacks
// ============================================================================

/** Callback for render updates */
export type DetailViewRenderCallback = (
  state: DetailViewState,
  hints: DetailViewRenderHint[]
) => void;
