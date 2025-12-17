/**
 * DetailView types.
 */

import type { EncounterInstance, CombatState } from '@core/schemas';

// ============================================================================
// View Types
// ============================================================================

/** View type identifier for Obsidian */
export const VIEW_TYPE_DETAIL_VIEW = 'salt-marcher-detail-view';

// ============================================================================
// Tab Types
// ============================================================================

/** Available tabs in DetailView (MVP: encounter + combat) */
export type TabId = 'encounter' | 'combat';

// ============================================================================
// Tab State Types
// ============================================================================

/**
 * Encounter tab state.
 */
export interface EncounterTabState {
  currentEncounter: EncounterInstance | null;
}

/**
 * Combat tab state.
 */
export interface CombatTabState {
  combatState: CombatState | null;
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

  /** Encounter tab state */
  encounter: EncounterTabState;

  /** Combat tab state */
  combat: CombatTabState;
}

/**
 * Create initial DetailView state.
 */
export function createInitialDetailViewState(): DetailViewState {
  return {
    activeTab: null,
    encounter: {
      currentEncounter: null,
    },
    combat: {
      combatState: null,
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
  | 'full'      // Full re-render
  | 'tabs'      // Tab navigation changed
  | 'encounter' // Encounter state changed
  | 'combat';   // Combat state changed

// ============================================================================
// Callbacks
// ============================================================================

/** Callback for render updates */
export type DetailViewRenderCallback = (
  state: DetailViewState,
  hints: DetailViewRenderHint[]
) => void;
