/**
 * DetailView types.
 */

import type { EncounterInstance, CombatState, CombatEffect } from '@core/schemas';

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
 * Difficulty rating for encounters.
 */
export type EncounterDifficulty = 'easy' | 'medium' | 'hard' | 'deadly';

/**
 * Creature/NPC in the encounter builder.
 */
export interface BuilderCreature {
  type: 'creature' | 'npc';
  entityId: string;
  name: string;
  cr: number;
  xp: number;
  count: number;
}

/**
 * Encounter tab state.
 * Includes both the current encounter and the builder state.
 * @see DetailView.md#encounter-tab
 */
export interface EncounterTabState {
  // Current encounter (from encounter:generated or loaded)
  currentEncounter: EncounterInstance | null;

  // Builder state
  builderName: string;
  builderActivity: string;
  builderGoal: string;
  builderCreatures: BuilderCreature[];

  // Calculated values (live, updated when builder changes)
  totalXP: number;
  difficulty: EncounterDifficulty;
  dailyBudgetUsed: number;
  dailyBudgetTotal: number;

  // Search state (placeholders for #2410/#2411)
  savedEncounterQuery: string;
  creatureQuery: string;

  // Source encounter ID (for update vs create logic)
  sourceEncounterId: string | null;
}

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
      // Builder state
      builderName: '',
      builderActivity: '',
      builderGoal: '',
      builderCreatures: [],
      // Calculated values
      totalXP: 0,
      difficulty: 'easy',
      dailyBudgetUsed: 0,
      dailyBudgetTotal: 0,
      // Search state
      savedEncounterQuery: '',
      creatureQuery: '',
      // Source
      sourceEncounterId: null,
    },
    combat: {
      combatState: null,
      pendingEffects: [],
      resolution: null,
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
