// Difficulty-Berechnung und Ziel-Difficulty
// Siehe: docs/services/encounter/Difficulty.md

import type { ThreatLevel } from '@/types/entities';
import type { Disposition, DifficultyLabel } from '@/constants';

/**
 * Würfelt eine Ziel-Difficulty basierend auf Terrain-ThreatLevel.
 *
 * Verwendet Mittelwert von min/max für die Difficulty-Verteilung.
 */
export function rollTargetDifficulty(
  threatLevel: ThreatLevel
): DifficultyLabel {
  // TODO: Implementierung
  // Gewichtete Normalverteilung basierend auf threatLevel-Mittelwert

  // Stub: Gibt moderate zurück
  void threatLevel;
  return 'moderate';
}

/**
 * Simuliert den Kampf und berechnet Difficulty-Metriken.
 */
export function simulate(
  groups: {
    creatures: { definitionId: string; currentHp: number; maxHp: number; npcId?: string }[];
    disposition: Disposition;
  }[],
  party: {
    level: number;
    size: number;
    members: { id: string; level: number; hp: number; ac: number }[];
  }
): {
  label: DifficultyLabel;
  winProbability: number;
  tpkRisk: number;
} {
  // TODO: Implementierung
  // PMF-basierte Kampfsimulation

  // Stub: Gibt Placeholder zurück
  void groups;
  void party;
  return {
    label: 'moderate',
    winProbability: 0.75,
    tpkRisk: 0.05,
  };
}
