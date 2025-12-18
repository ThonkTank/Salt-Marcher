/**
 * Combat feature types.
 *
 * @see docs/features/Combat-System.md
 */

import type { Result, AppError, EntityId } from '@core/types';
import type {
  CombatState,
  CombatParticipant,
  Condition,
  ConditionType,
  CombatEffect,
} from '@core/schemas';

// ============================================================================
// Feature Port (Public Interface)
// ============================================================================

/**
 * Combat feature public interface.
 * Used by SessionRunner and other features.
 */
export interface CombatFeaturePort {
  // === Queries ===

  /**
   * Get current combat state (readonly).
   */
  getState(): Readonly<CombatState>;

  /**
   * Check if combat is currently active.
   */
  isActive(): boolean;

  /**
   * Get current turn participant.
   */
  getCurrentTurnParticipant(): CombatParticipant | null;

  /**
   * Get participant by ID.
   */
  getParticipant(participantId: string): CombatParticipant | null;

  /**
   * Get effects that trigger for a participant at start/end of turn.
   */
  getEffectsForTurn(
    participantId: string,
    trigger: 'start-of-turn' | 'end-of-turn'
  ): readonly CombatEffect[];

  // === Commands ===

  /**
   * Start combat with participants.
   * @param participants Initial combat participants
   * @param encounterId Optional encounter ID (for integration)
   */
  startCombat(
    participants: CombatParticipant[],
    encounterId?: EntityId<'encounter'>
  ): Result<void, AppError>;

  /**
   * End combat. GM handles resolution details in Resolution-UI.
   */
  endCombat(): Result<CombatResult, AppError>;

  /**
   * Advance to next turn.
   */
  nextTurn(): Result<void, AppError>;

  /**
   * Apply damage to participant.
   */
  applyDamage(participantId: string, amount: number): Result<void, AppError>;

  /**
   * Apply healing to participant.
   */
  applyHealing(participantId: string, amount: number): Result<void, AppError>;

  /**
   * Add condition to participant.
   */
  addCondition(participantId: string, condition: Condition): Result<void, AppError>;

  /**
   * Remove condition from participant.
   */
  removeCondition(participantId: string, conditionType: ConditionType): Result<void, AppError>;

  /**
   * Add effect to participant.
   */
  addEffect(participantId: string, effect: CombatEffect): Result<void, AppError>;

  /**
   * Remove effect from participant.
   */
  removeEffect(participantId: string, effectId: string): Result<void, AppError>;

  /**
   * Update participant initiative.
   */
  updateInitiative(participantId: string, initiative: number): Result<void, AppError>;

  /**
   * Break concentration for a participant.
   */
  breakConcentration(participantId: string): Result<void, AppError>;

  // === Lifecycle ===

  /**
   * Clean up resources.
   */
  dispose(): void;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal combat state (includes additional tracking).
 */
export interface InternalCombatState extends CombatState {
  /** Combat session ID */
  combatId: string | null;
}

/**
 * Result of ending combat.
 */
export interface CombatResult {
  /** Combat session ID */
  combatId: string;
  /** Duration in rounds */
  durationRounds: number;
  /** Total XP to award (calculated from defeated creatures) */
  xpAwarded: number;
  /** Associated encounter ID (if any) */
  encounterId?: EntityId<'encounter'>;
}

/**
 * Concentration check result.
 */
export interface ConcentrationCheckRequired {
  participantId: string;
  spell: string;
  dc: number;
}

// ============================================================================
// Service Dependencies
// ============================================================================

/**
 * Dependencies for combat service.
 */
export interface CombatServiceDeps {
  /** EventBus for cross-feature communication */
  eventBus?: import('@core/events').EventBus;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create initial internal combat state.
 */
export function createInitialInternalCombatState(): InternalCombatState {
  return {
    status: 'idle',
    combatId: null,
    participants: [],
    initiativeOrder: [],
    currentTurnIndex: 0,
    roundNumber: 1,
  };
}
