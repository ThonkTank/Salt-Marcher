/**
 * Vault Adapters - Public API
 *
 * Infrastructure layer adapters for storage.
 */

// ============================================================================
// Shared Utilities
// ============================================================================

export { createVaultIO, type VaultIO } from './shared';

// ============================================================================
// Vault-backed Adapters (Production)
// ============================================================================

export {
  createVaultMapAdapter,
  type VaultMapAdapterDeps,
} from './vault-map-adapter';

export {
  createVaultPartyAdapter,
  type VaultPartyAdapterDeps,
} from './vault-party-adapter';

// ============================================================================
// In-Memory Adapters (Testing/Development)
// ============================================================================

// Terrain (always in-memory, preset data)
export { createTerrainRegistry } from './terrain-registry';

// In-memory adapters for testing
export { createMapAdapter, TEST_MAP_ID } from './map-adapter';
export { createPartyAdapter, DEFAULT_PARTY_ID } from './party-adapter';
