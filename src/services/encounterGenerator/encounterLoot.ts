// Ziel: Loot fuer Encounter generieren und auf Kreaturen verteilen
// Siehe: docs/services/encounter/encounterLoot.md
//
// Verantwortlichkeiten:
// - Budget nach NarrativeRole berechnen (ally/neutral belasten Budget nicht)
// - Verteilung nach CR × RoleWeight
// - Delegation an lootGenerator fuer Item-Generierung
//
// DISKREPANZEN (als [HACK] oder [TODO] markiert):
// ================================================
//
// [TODO: encounterLoot.md#step-44] Implementierung fehlt komplett
//   → generateEncounterLoot ist Stub, gibt leeres Loot zurueck
//
// [TODO: Loot.md] lootGenerator existiert noch nicht
//   → Muss Budget-System, DefaultLoot, Tag-Loot implementieren
//
// [HACK: encounterLoot.md#input] Funktion nimmt einzelne Gruppe
//   → Doku beschreibt GroupWithNPCs[], Code nimmt GroupWithNPCs

import type { GroupWithNPCs } from './encounterNPCs';

/** Output von generateEncounterLoot - GroupWithNPCs erweitert um Loot */
export interface GroupWithLoot extends GroupWithNPCs {
  loot: {
    items: { id: string; quantity: number }[];
    totalValue: number;
    countsTowardsBudget: boolean;
  };
}

/**
 * Generiert Loot fuer eine Encounter-Gruppe.
 *
 * Budget-Belastung nach NarrativeRole:
 * - threat: Ja (Party bekommt Loot nach Kampf)
 * - victim: Ja (Belohnung fuer Rettung)
 * - ally: Nein (NPCs behalten ihr Loot)
 * - neutral: Nein (keine Interaktion erwartet)
 */
export function generateEncounterLoot(
  group: GroupWithNPCs,
  context: {
    terrain: { id: string };
  }
): GroupWithLoot {
  // TODO: Implementierung
  // 1. countsTowardsBudget basierend auf narrativeRole bestimmen
  // 2. Budget berechnen (Anteil am Encounter-Budget)
  // 3. lootGenerator.generate() aufrufen
  // 4. Loot auf Kreaturen verteilen (CR × RoleWeight)

  const countsTowardsBudget =
    group.narrativeRole === 'threat' || group.narrativeRole === 'victim';

  // Stub: Gibt leeres Loot zurueck
  void context;
  return {
    ...group,
    loot: { items: [], totalValue: 0, countsTowardsBudget },
  };
}
