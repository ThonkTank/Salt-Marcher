// Ziel: Speichert alle Session-Zeit-State-Variablen.
// Keine Logik - nur State-Definitionen und reaktiver Store.
// Siehe: docs/orchestration/SessionState.md

// ============================================================================
// IMPORTS
// ============================================================================

import { writable, type Writable } from 'svelte/store';

// Typen
import type { EntityId } from '@core/types/entity';
import type { HexCoordinate } from '@core/types/coordinates';
import type { TimeSegment } from '@constants/TimeSegments';
import type { Weather } from '@services/weather/types/Weather';
import type { TransportMode } from '@constants/TransportModes';
import type { EncounterInstance } from '@entities/encounter-instance';

// Vault-Adapter
import type { VaultAdapter } from '@infrastructure/vault/VaultAdapter';

// ============================================================================
// STATE-TYPEN
// ============================================================================

export interface PartyState {
  position: HexCoordinate;
  mapId: EntityId<'map'>;
  members: EntityId<'character'>[];
  transport: TransportMode;
}

export interface TimeState {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  daySegment: TimeSegment;
}

export interface TravelWorkflowState {
  status: 'idle' | 'traveling' | 'paused';
  route: HexCoordinate[] | null;
  progress: number | null;
}

export interface EncounterWorkflowState {
  status: 'idle' | 'preview' | 'active' | 'resolving';
  current: EncounterInstance | null;
  trigger?: 'travel' | 'rest' | 'manual' | 'location';
}

export interface CombatWorkflowState {
  status: 'idle' | 'active';
  participants: unknown[];
  currentTurn: number;
  round: number;
}

export interface SessionState {
  activeMapId: EntityId<'map'> | null;
  party: PartyState;
  time: TimeState;
  weather: Weather | null;
  travel: TravelWorkflowState;
  encounter: EncounterWorkflowState;
  combat: CombatWorkflowState;
}

// ============================================================================
// STATE-VARIABLEN
// ============================================================================

/**
 * Reaktiver Session-State als Svelte Store.
 */
export const sessionState: Writable<SessionState> = writable({
  activeMapId: null,
  party: {
    position: { q: 0, r: 0 },
    mapId: '' as EntityId<'map'>,
    members: [],
    transport: 'foot',
  },
  time: {
    year: 1,
    month: 1,
    day: 1,
    hour: 8,
    minute: 0,
    daySegment: 'morning',
  },
  weather: null,
  travel: { status: 'idle', route: null, progress: null },
  encounter: { status: 'idle', current: null },
  combat: { status: 'idle', participants: [], currentTurn: 0, round: 1 },
});

/**
 * Vault-Adapter für Datenzugriff.
 */
export let vault: VaultAdapter;

// ============================================================================
// INIT & ZUGRIFF
// ============================================================================

export function initSessionControl(vaultAdapter: VaultAdapter): void {
  vault = vaultAdapter;
}

export function getState(): SessionState {
  let current: SessionState;
  sessionState.subscribe(s => current = s)();
  return current!;
}

export function updateState(updater: (s: SessionState) => SessionState): void {
  sessionState.update(updater);
}
