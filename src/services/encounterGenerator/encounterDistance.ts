// Perception + Distanz für Encounter berechnen
// Siehe: docs/services/encounter/encounterDistance.md

import type { EncounterGroup } from '@/types/encounterTypes';
import { DEFAULT_PERCEPTION_DISTANCE } from '@/constants/encounterConfig';

/**
 * Berechnet Wahrnehmungs-Distanzen für eine Encounter-Gruppe.
 */
export function calculate(
  group: EncounterGroup,
  context: {
    terrain: { id: string };
    weather: { type: string; severity: number };
    timeSegment: string;
  }
): EncounterGroup {
  // TODO: Implementierung
  // 1. Basis-Distanz aus Terrain
  // 2. Modifikatoren für Wetter, Tageszeit, Activity
  // 3. Surprise-Check

  // Stub: Gibt Standard-Distanzen zurück
  void context;
  return {
    ...group,
    perception: {
      partyDetectsEncounter: DEFAULT_PERCEPTION_DISTANCE,
      encounterDetectsParty: DEFAULT_PERCEPTION_DISTANCE,
      isSurprise: false,
    },
  };
}
