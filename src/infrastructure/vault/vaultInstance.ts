// Vault-Instance für globalen Zugriff
// Separiert von SessionRunner um Svelte-Dependencies zu vermeiden
// Siehe: docs/architecture/Infrastructure.md

import type { VaultAdapter } from './VaultAdapter';

/**
 * Globale Vault-Instanz.
 * Wird bei App-Start via setVault() initialisiert.
 */
export let vault: VaultAdapter;

/**
 * Setzt die globale Vault-Instanz.
 * Aufgerufen von:
 * - SessionRunner: initSessionControl() mit ObsidianVaultAdapter
 * - CLI: mit PresetVaultAdapter
 */
export function setVault(adapter: VaultAdapter): void {
  vault = adapter;
}
