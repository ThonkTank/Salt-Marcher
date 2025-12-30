// Einfacher State-Container ohne Framework-Dependencies
// Siehe: docs/orchestration/SessionState.md

import type { SessionState } from '#types/sessionState';
import type { EntityId } from '@core/types/entity';

// ============================================================================
// STATE
// ============================================================================

let state: SessionState = {
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
  encounter: { status: 'idle', current: null, generatedNPCs: [] },
  combat: { status: 'idle', participants: [], currentTurn: 0, round: 1 },
};

// ============================================================================
// PUBLIC API
// ============================================================================

export function getState(): SessionState {
  return state;
}

export function updateState(updater: (s: SessionState) => SessionState): void {
  state = updater(state);
}

export function resetState(initial: SessionState): void {
  state = initial;
}
