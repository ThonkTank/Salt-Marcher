// Difficulty-Berechnung und Ziel-Difficulty
// Siehe: docs/services/encounter/Difficulty.md

import type { EncounterGroup } from '@/types/encounterTypes';
import type { ThreatLevel } from '@/types/entities';
import type { DifficultyLabel } from '@/constants';

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
  groups: EncounterGroup[],
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
  // Kreaturen via Object.values(group.slots).flat() iterieren

  // Stub: Gibt Placeholder zurück
  void groups;
  void party;
  return {
    label: 'moderate',
    winProbability: 0.75,
    tpkRisk: 0.05,
  };
}
