/**
 * Infrastructure Layer - Public API
 *
 * Adapters for external systems (Vault, Rendering, APIs).
 */

// ============================================================================
// Settings
// ============================================================================

export {
  loadSettings,
  createSettingsService,
  SaltMarcherSettingTab,
  type SettingsService,
} from './settings';

// ============================================================================
// Vault Adapters
// ============================================================================

export {
  // Shared utilities
  createVaultIO,
  type VaultIO,
  // Vault-backed adapters (production)
  createVaultMapAdapter,
  type VaultMapAdapterDeps,
  createVaultPartyAdapter,
  type VaultPartyAdapterDeps,
  createVaultTimeAdapter,
  type VaultTimeAdapterDeps,
  createVaultCalendarAdapter,
  type VaultCalendarAdapterDeps,
  // In-memory adapters (testing/development)
  createTerrainRegistry,
  createMapAdapter,
  TEST_MAP_ID,
  createPartyAdapter,
  DEFAULT_PARTY_ID,
} from './vault';
