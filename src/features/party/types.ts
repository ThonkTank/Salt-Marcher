/**
 * Party Feature types and interfaces.
 */

import type { Result, AppError, PartyId, Option } from '@core/index';
import type { Party, HexCoordinate, TransportMode } from '@core/schemas';

// ============================================================================
// Storage Port
// ============================================================================

/**
 * Storage port interface for party persistence.
 * Implemented by VaultAdapter in Infrastructure layer.
 */
export interface PartyStoragePort {
  /** Load a party by ID */
  load(id: PartyId): Promise<Result<Party, AppError>>;

  /** Save a party */
  save(party: Party): Promise<Result<void, AppError>>;

  /** List all party IDs */
  listIds(): Promise<Result<PartyId[], AppError>>;

  /** Check if a party exists */
  exists(id: PartyId): Promise<boolean>;
}

// ============================================================================
// Party Feature Port
// ============================================================================

/**
 * Public interface for the Party Feature.
 * Used by ViewModels and other Features (e.g., Travel).
 */
export interface PartyFeaturePort {
  // === State Queries ===

  /** Get the current party */
  getCurrentParty(): Option<Party>;

  /** Get the party's current position */
  getPosition(): Option<HexCoordinate>;

  /** Get the active transport mode */
  getActiveTransport(): TransportMode;

  /** Get available transport modes */
  getAvailableTransports(): readonly TransportMode[];

  // === Party Operations ===

  /** Load a party by ID */
  loadParty(id: PartyId): Promise<Result<Party, AppError>>;

  /** Move party to a new position */
  setPosition(coord: HexCoordinate): void;

  /** Set the active transport mode */
  setActiveTransport(mode: TransportMode): Result<void, AppError>;

  /** Save current party state to storage */
  saveParty(): Promise<Result<void, AppError>>;

  /** Unload the current party */
  unloadParty(): void;
}

// ============================================================================
// Party State
// ============================================================================

/**
 * Internal state for the Party Feature.
 */
export interface PartyState {
  /** Currently loaded party */
  currentParty: Party | null;

  /** Flag indicating unsaved changes */
  isDirty: boolean;
}

/**
 * Create initial party state.
 */
export function createInitialPartyState(): PartyState {
  return {
    currentParty: null,
    isDirty: false,
  };
}
