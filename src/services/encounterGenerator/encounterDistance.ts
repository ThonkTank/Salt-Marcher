// Perception + Distanz für Encounter berechnen
// Siehe: docs/services/encounter/encounterDistance.md

import type { GroupWithLoot } from './encounterLoot';
import { DEFAULT_PERCEPTION_DISTANCE } from '@/constants/encounterConfig';

/** Output von calculate - GroupWithLoot erweitert um Perception */
export interface GroupWithPerception extends GroupWithLoot {
  perception: { partyDetectsEncounter: number; encounterDetectsParty: number; isSurprise: boolean };
}

/**
 * Berechnet Wahrnehmungs-Distanzen für eine Encounter-Gruppe.
 */
export function calculate(
  group: GroupWithLoot,
  context: {
    terrain: { id: string };
    weather: { type: string; severity: number };
    timeSegment: string;
  }
): GroupWithPerception {
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
