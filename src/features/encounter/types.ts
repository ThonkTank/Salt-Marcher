/**
 * Encounter Feature types and interfaces.
 *
 * Encounter Feature handles:
 * - Random encounter generation based on terrain, time, weather
 * - Encounter state machine (pending → active → resolved)
 * - NPC instantiation from faction cultures
 * - Variety validation to prevent monotony
 *
 * @see docs/features/Encounter-System.md
 */

import type { Result, AppError, Option } from '@core/index';
import type {
  HexCoordinate,
  TimeSegment,
  WeatherState,
  EncounterInstance,
  EncounterOutcome,
  EncounterType,
  CreatureDefinition,
  Faction,
  NPC,
  GameDateTime,
} from '@core/schemas';

// ============================================================================
// Encounter Feature Port
// ============================================================================

/**
 * Public interface for the Encounter Feature.
 */
export interface EncounterFeaturePort {
  // === Queries ===

  /**
   * Get current active/pending encounter.
   * Returns None if no encounter is active.
   */
  getCurrentEncounter(): Option<EncounterInstance>;

  /**
   * Get encounter history (resolved encounters).
   */
  getEncounterHistory(): readonly EncounterInstance[];

  /**
   * Get recent creature types (for variety validation).
   */
  getRecentCreatureTypes(): readonly string[];

  // === Commands ===

  /**
   * Generate a new random encounter based on context.
   * Implements the 5-step pipeline:
   * 1. Tile-Eligibility (terrain + time filter)
   * 2. Kreatur-Auswahl (weighted selection)
   * 3. Typ-Ableitung (disposition + faction + CR)
   * 4. Variety-Validation (monotony prevention)
   * 5. Encounter-Befüllung (NPC instantiation)
   */
  generateEncounter(context: GenerationContext): Result<EncounterInstance, AppError>;

  /**
   * Start a pending encounter (transition to active).
   */
  startEncounter(encounterId: string): Result<void, AppError>;

  /**
   * Dismiss a pending encounter without resolution.
   */
  dismissEncounter(encounterId: string, reason?: string): Result<void, AppError>;

  /**
   * Resolve an active encounter with outcome.
   */
  resolveEncounter(
    encounterId: string,
    outcome: EncounterOutcome
  ): Result<void, AppError>;

  // === Lifecycle ===

  /**
   * Clean up subscriptions and resources.
   */
  dispose(): void;
}

// ============================================================================
// Generation Context
// ============================================================================

/**
 * Context provided for encounter generation.
 * Similar to EncounterContext schema but using feature types.
 */
export interface GenerationContext {
  /** Current party position */
  position: HexCoordinate;

  /** Terrain ID at position */
  terrainId: string;

  /** Current time segment */
  timeSegment: TimeSegment;

  /** Current weather (optional, affects creature preferences) */
  weather?: WeatherState;

  /** Party level (optional, for type derivation) */
  partyLevel?: number;

  /** What triggered this generation */
  trigger: 'time-based' | 'manual' | 'location' | 'travel';
}

// ============================================================================
// Internal State
// ============================================================================

/**
 * Tracks daily XP budget usage for encounter balancing.
 * Resets on Long Rest or new game day.
 *
 * @see docs/features/Encounter-Balancing.md#daily-xp-budget
 */
export interface DailyXPTracker {
  /** Game day number (for reset detection) */
  dayNumber: number;

  /** Total daily XP budget based on party level */
  budgetTotal: number;

  /** XP already used today */
  budgetUsed: number;

  /** Number of combat encounters today */
  combatEncountersToday: number;
}

/**
 * Create initial daily XP tracker.
 */
export function createInitialDailyXPTracker(): DailyXPTracker {
  return {
    dayNumber: 0,
    budgetTotal: 0,
    budgetUsed: 0,
    combatEncountersToday: 0,
  };
}

/**
 * Internal state for the Encounter Feature.
 */
export interface InternalEncounterState {
  /** Current pending/active encounter */
  currentEncounter: EncounterInstance | null;

  /** History of resolved encounters */
  history: EncounterInstance[];

  /** Recent creature types for variety validation */
  recentCreatureTypes: string[];

  /** Map ID for context */
  activeMapId: string | null;

  /** Daily XP budget tracking for encounter balancing */
  dailyXP: DailyXPTracker;
}

/**
 * Create initial encounter state.
 */
export function createInitialEncounterState(): InternalEncounterState {
  return {
    currentEncounter: null,
    history: [],
    recentCreatureTypes: [],
    activeMapId: null,
    dailyXP: createInitialDailyXPTracker(),
  };
}

// ============================================================================
// Pipeline Types
// ============================================================================

/**
 * Result of creature selection step.
 */
export interface CreatureSelectionResult {
  /** Selected creature template */
  creature: CreatureDefinition;

  /** Faction for this creature */
  faction: Faction;

  /** Selection weight used */
  weight: number;
}

/**
 * CR comparison categories for encounter balancing.
 * Re-exported from encounter-utils for use in types.
 */
export type CRComparisonCategory = 'trivial' | 'manageable' | 'deadly' | 'impossible';

/**
 * Result of type derivation step.
 */
export interface TypeDerivationResult {
  /** Derived encounter type */
  type: EncounterType;

  /** Reason for derivation (for debugging/logging) */
  reason: string;

  /** CR comparison result used in type derivation */
  crComparison: CRComparisonCategory;
}

/**
 * Result of variety validation step.
 */
export interface VarietyValidationResult {
  /** Whether the selection is valid */
  valid: boolean;

  /** If invalid, why reroll is needed */
  rerollReason?: string;
}

/**
 * NPC selection or generation result.
 */
export interface NpcSelectionResult {
  /** The NPC (existing or newly created) */
  npc: NPC;

  /** Whether this is a new NPC */
  isNew: boolean;

  /** If existing, encounter count before this one */
  previousEncounterCount?: number;
}

// ============================================================================
// Weight Calculation Types
// ============================================================================

/**
 * Faction presence at a location for weighted selection.
 */
export interface FactionWeight {
  factionId: string;
  weight: number;
}

/**
 * Creature weight for selection.
 */
export interface CreatureWeight {
  creature: CreatureDefinition;
  factionId: string;
  baseWeight: number;
  terrainModifier: number;
  weatherModifier: number;
  finalWeight: number;
}

// ============================================================================
// Activity and Goal Generation
// ============================================================================

/**
 * Activity categories for encounter descriptions.
 */
export type ActivityCategory =
  | 'hunting'
  | 'patrolling'
  | 'resting'
  | 'traveling'
  | 'foraging'
  | 'ambushing'
  | 'trading'
  | 'fighting';

/**
 * Goal categories for NPC motivation.
 */
export type GoalCategory =
  | 'survival'
  | 'territory'
  | 'food'
  | 'treasure'
  | 'revenge'
  | 'duty'
  | 'curiosity'
  | 'trade';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum encounters to keep in history.
 */
export const MAX_HISTORY_SIZE = 50;

/**
 * Default description when none is generated.
 */
export const DEFAULT_ENCOUNTER_DESCRIPTION = 'You encounter something unexpected.';
