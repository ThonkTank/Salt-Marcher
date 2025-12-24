/**
 * DetailView types.
 */

import type {
  EncounterInstance,
  CombatState,
  CombatEffect,
  EncounterLeadNpc,
  DetectionMethod,
} from '@core/schemas';

// Re-export for use in panel components
export type { DetectionMethod };
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
export type TabId = 'encounter' | 'combat' | 'party';

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
 * Detection info for UI display.
 * Simplified from EncounterPerception for the builder state.
 * @see Encounter-System.md#encounterperception
 */
export interface DetectionInfo {
  method: DetectionMethod;
  distance: number;
  partyAware: boolean;
  encounterAware: boolean;
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

  // Situation: Disposition toward party (-100 hostile to +100 friendly)
  disposition: number;

  // Detection info (how party and encounter detected each other)
  detection: DetectionInfo | null;

  // Lead NPC info (personality, quirk, goal for roleplay)
  leadNPC: EncounterLeadNpc | null;
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

  /** Encounter tab state */
  encounter: EncounterTabState;

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
      // Situation
      disposition: 0,
      // Detection
      detection: null,
      // Lead NPC
      leadNPC: null,
    },
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
