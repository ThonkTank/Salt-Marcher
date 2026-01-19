// Session-State Typen für CLI-Testbarkeit
// Extrahiert aus src/SessionRunner/sessionState.ts
// Siehe: docs/orchestration/SessionState.md

import type { HexCoordinate } from '#types/hexCoordinate';
import type { Weather } from '#types/weather';
import type { EmbeddedPreset } from '@/types/entities/encounterPreset';
import type { NPC } from '#types/entities/npc';
import type { GameDateTime } from '#types/time';

// Branded type for entity IDs
export type EntityId<T extends string> = string & { readonly __entityType: T };

// Transport mode for travel
export type TransportMode = 'foot' | 'horse' | 'wagon' | 'boat' | 'flying';

// ============================================================================
// STATE-TYPEN
// ============================================================================

export interface PartyState {
  position: HexCoordinate;
  mapId: EntityId<'map'>;
  members: EntityId<'character'>[];
  transport: TransportMode;
}

export interface TravelWorkflowState {
  status: 'idle' | 'traveling' | 'paused';
  route: HexCoordinate[] | null;
  progress: number | null;
}

export interface EncounterWorkflowState {
  status: 'idle' | 'preview' | 'accepted' | 'active' | 'resolving';
  current: EmbeddedPreset | null;
  generatedNPCs: NPC[];  // Neu generierte NPCs (noch nicht persistiert)
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
  time: GameDateTime;
  weather: Weather | null;
  travel: TravelWorkflowState;
  encounter: EncounterWorkflowState;
  combat: CombatWorkflowState;
}
