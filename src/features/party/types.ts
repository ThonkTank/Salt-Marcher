/**
 * Party Feature types and interfaces.
 */

import type { Result, AppError, PartyId, Option, CharacterId } from '@core/index';
import type { Party, HexCoordinate, TransportMode, Character } from '@core/schemas';

// ============================================================================
// Storage Ports
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

/**
 * Storage port interface for character persistence.
 * Implemented by VaultAdapter in Infrastructure layer.
 */
export interface CharacterStoragePort {
  /** Load a character by ID */
  load(id: CharacterId): Promise<Result<Character, AppError>>;

  /** Save a character */
  save(character: Character): Promise<Result<void, AppError>>;

  /** Load multiple characters by IDs */
  loadMany(ids: readonly CharacterId[]): Promise<Result<readonly Character[], AppError>>;

  /** List all character IDs */
  listIds(): Promise<Result<CharacterId[], AppError>>;

  /** Check if a character exists */
  exists(id: CharacterId): Promise<boolean>;
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

  // === Member Queries ===

  /**
   * Get all loaded party members (characters).
   * Returns None if no party is loaded.
   */
  getMembers(): Option<readonly Character[]>;

  /**
   * Get the average level of party members.
   * Returns 1 if no members loaded.
   * @see docs/features/Character-System.md
   */
  getPartyLevel(): number;

  /**
   * Get the party's travel speed (slowest member).
   * Returns 30 (default human speed) if no members loaded.
   * @see docs/features/Character-System.md
   */
  getPartySpeed(): number;

  /**
   * Get the party size (number of members).
   */
  getPartySize(): number;

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

  // === Member Operations ===

  /**
   * Add a character to the party.
   * Loads the character from storage and adds to members list.
   */
  addMember(characterId: CharacterId): Promise<Result<void, AppError>>;

  /**
   * Remove a character from the party.
   */
  removeMember(characterId: CharacterId): Result<void, AppError>;

  /**
   * Reload all party members from storage.
   * Useful after character data changes.
   */
  reloadMembers(): Promise<Result<void, AppError>>;

  // === Lifecycle ===

  /** Clean up subscriptions and resources */
  dispose(): void;
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

  /** Loaded character data for party members */
  loadedMembers: Character[];

  /** Flag indicating unsaved changes */
  isDirty: boolean;
}

/**
 * Create initial party state.
 */
export function createInitialPartyState(): PartyState {
  return {
    currentParty: null,
    loadedMembers: [],
    isDirty: false,
  };
}
