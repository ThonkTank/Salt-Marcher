/**
 * Encounter Feature - Types
 * Inbound Port (EncounterFeaturePort), State, and Event Payloads
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import type { PartyConfig } from '@core/schemas/party';
import type { Result, AppError } from '@core/types/result';
import type { EntityId, Timestamp, Difficulty } from '@core/types/common';

// ═══════════════════════════════════════════════════════════════
// Encounter Creature Types
// ═══════════════════════════════════════════════════════════════

/**
 * A group of creatures in an encounter
 */
export interface EncounterCreatureGroup {
  /** Reference to creature entity */
  creatureId: EntityId<'entity'>;

  /** Creature display name */
  creatureName: string;

  /** Challenge Rating (e.g., "1/4", "2") */
  cr: string;

  /** Number of this creature in the encounter */
  count: number;

  /** XP value per creature */
  xpEach: number;
}

// ═══════════════════════════════════════════════════════════════
// Generated Encounter
// ═══════════════════════════════════════════════════════════════

/**
 * A fully generated encounter
 */
export interface GeneratedEncounter {
  /** Unique encounter ID */
  id: EntityId<'encounter'>;

  /** Creature groups in this encounter */
  groups: EncounterCreatureGroup[];

  /** Total raw XP value */
  totalXp: number;

  /** Adjusted XP (with multiplier applied) */
  adjustedXp: number;

  /** Multiplier applied based on creature count */
  multiplier: number;

  /** Calculated difficulty */
  difficulty: Difficulty;

  /** Total number of creatures */
  creatureCount: number;

  /** Terrain where encounter was generated */
  terrain: string;

  /** When the encounter was generated */
  generatedAt: Timestamp;
}

// ═══════════════════════════════════════════════════════════════
// Encounter State
// ═══════════════════════════════════════════════════════════════

/**
 * Status of encounter system
 */
export type EncounterStatus = 'idle' | 'active';

/**
 * Complete encounter state (observable from UI)
 */
export interface EncounterState {
  /** Current status */
  status: EncounterStatus;

  /** Active encounter (null if none) */
  activeEncounter: GeneratedEncounter | null;

  /** Hours elapsed during current travel */
  travelHoursElapsed: number;

  /** Last hour when encounter check was performed */
  lastCheckHour: number;
}

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

/**
 * Configuration for encounter generation
 */
export interface EncounterConfig {
  /** Probability of encounter per hour (0-1), default 0.125 (12.5%) */
  encounterProbability: number;

  /** Target difficulty for generated encounters */
  targetDifficulty: Difficulty;

  /** Minimum CR relative to average party level */
  crRangeMin: number;

  /** Maximum CR relative to average party level */
  crRangeMax: number;

  /** Maximum creatures in an encounter */
  maxCreatureCount: number;

  /** Whether to automatically trigger checks during travel */
  autoTrigger: boolean;
}

/**
 * Default encounter configuration
 */
export const DEFAULT_ENCOUNTER_CONFIG: EncounterConfig = {
  encounterProbability: 0.125, // 12.5% = ~1 per 8 hours
  targetDifficulty: 'medium',
  crRangeMin: -2, // party level - 2
  crRangeMax: 3, // party level + 3
  maxCreatureCount: 10,
  autoTrigger: true,
};

// ═══════════════════════════════════════════════════════════════
// Event Payloads
// ═══════════════════════════════════════════════════════════════

/**
 * Payload for encounter:check-triggered event
 */
export interface EncounterCheckTriggeredPayload {
  hour: number;
  terrain: string;
  position: HexCoordinate;
}

/**
 * Payload for encounter:generated event
 */
export interface EncounterGeneratedPayload {
  encounter: GeneratedEncounter;
  hour: number;
  position: HexCoordinate;
}

/**
 * Payload for encounter:skipped event
 */
export interface EncounterSkippedPayload {
  hour: number;
  terrain: string;
  reason: 'roll_failed' | 'no_creatures' | 'disabled';
}

/**
 * Payload for encounter:resolved event
 */
export interface EncounterResolvedPayload {
  encounterId: EntityId<'encounter'>;
  outcome: 'victory' | 'flee' | 'negotiated';
}

// ═══════════════════════════════════════════════════════════════
// State Listener
// ═══════════════════════════════════════════════════════════════

/**
 * Listener for encounter state changes
 */
export type EncounterStateListener = (state: EncounterState) => void;

// ═══════════════════════════════════════════════════════════════
// Inbound Port - EncounterFeaturePort
// ═══════════════════════════════════════════════════════════════

/**
 * Encounter Feature Port - Public Interface
 *
 * Coordinates automatic encounter generation during travel.
 * Listens to travel events and triggers encounter checks each hour.
 */
export interface EncounterFeaturePort {
  // ─────────────────────────────────────────────────────────────
  // State Access
  // ─────────────────────────────────────────────────────────────

  /**
   * Get current encounter state
   */
  getState(): Readonly<EncounterState>;

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: EncounterStateListener): () => void;

  // ─────────────────────────────────────────────────────────────
  // Manual Controls
  // ─────────────────────────────────────────────────────────────

  /**
   * Manually trigger an encounter check at current position.
   * Useful for GM override or testing.
   *
   * @returns Result with error if an encounter is already active
   */
  triggerCheck(): Result<void, AppError>;

  /**
   * Manually generate an encounter for specific terrain.
   * Bypasses probability roll.
   *
   * @returns Result with generated encounter or error if generation failed
   */
  generateEncounter(terrain: string): Result<GeneratedEncounter, AppError>;

  /**
   * Resolve the active encounter.
   * Clears state and emits encounter:resolved event.
   *
   * @param outcome - How the encounter was resolved
   * @returns Result with error if no active encounter exists
   */
  resolveEncounter(outcome: 'victory' | 'flee' | 'negotiated'): Result<void, AppError>;

  /**
   * Dismiss active encounter without resolution.
   * Use when encounter should be cancelled without tracking outcome.
   */
  dismissEncounter(): void;

  // ─────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────

  /**
   * Update encounter configuration
   */
  updateConfig(config: Partial<EncounterConfig>): void;

  /**
   * Update party configuration.
   * Affects difficulty calculations for future encounters.
   */
  updateParty(party: PartyConfig): void;

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize the orchestrator.
   * Sets up event subscriptions.
   */
  initialize(): Promise<void>;

  /**
   * Dispose of the orchestrator.
   * Cleans up event subscriptions.
   */
  dispose(): void;
}
