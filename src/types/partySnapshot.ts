// Party-Snapshot für Encounter-Generierung
// Siehe: docs/services/encounter/Encounter.md#input-schema

import type { HexCoordinate } from '#types/hexCoordinate';

export interface DifficultyThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

export interface PartySnapshot {
  level: number;
  size: number;
  members: PartyMember[];
  position: HexCoordinate;
  thresholds: DifficultyThresholds;
}

export interface PartyMember {
  id: string;
  level: number;
  hp: number;
  maxHp: number;
  ac: number;
}
