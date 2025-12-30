// Session Control - Svelte-spezifische UI-Schicht
// Verbindet Infrastructure-State mit Svelte Store
// Siehe: docs/orchestration/SessionState.md

import { writable, type Writable } from 'svelte/store';
import type { SessionState } from '#types/sessionState';
import { getState } from '@/infrastructure/state/sessionState';
import { setVault } from '@/infrastructure/vault/vaultInstance';
import type { VaultAdapter } from '@/infrastructure/vault/VaultAdapter';

// ============================================================================
// SVELTE STORE
// ============================================================================

/**
 * Reaktiver Session-State als Svelte Store.
 * Wird nach Workflow-Aufrufen mit dem Infrastructure-State synchronisiert.
 */
export const sessionStore: Writable<SessionState> = writable(getState());

// ============================================================================
// INIT
// ============================================================================

/**
 * Initialisiert Session Control mit VaultAdapter.
 * Aufgerufen beim Plugin-Start.
 */
export function initSessionControl(vaultAdapter: VaultAdapter): void {
  setVault(vaultAdapter);
  syncStore();
}

// ============================================================================
// STORE SYNC
// ============================================================================

/**
 * Synchronisiert den Svelte Store mit dem Infrastructure-State.
 * Aufrufen nach jedem Workflow-Aufruf.
 */
export function syncStore(): void {
  sessionStore.set(getState());
}
