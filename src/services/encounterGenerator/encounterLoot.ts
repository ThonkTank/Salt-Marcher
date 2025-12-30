// Ziel: Loot fuer Encounter generieren und auf Kreaturen verteilen
// Siehe: docs/services/encounter/encounterLoot.md
//
// TASKS:
// | # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
// |--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
// | 14 | ⬜ | Encounter | services | generateEncounterLoot implementieren (Budget-Berechnung, lootGenerator-Delegation) | mittel | Ja | #10 | encounterLoot.md#Step 4.4: Loot-Generierung | - |
// | 15 | ⬜ | Encounter | services | encounterLoot Input-Signatur: GroupWithNPCs[] statt GroupWithNPCs | niedrig | Nein | - | encounterLoot.md#Input | - |
//
// Verantwortlichkeiten:
// - Budget nach NarrativeRole berechnen (ally/neutral belasten Budget nicht)
// - Verteilung nach CR × RoleWeight
// - Delegation an lootGenerator fuer Item-Generierung

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
  // Stub: siehe #14 fuer vollstaendige Implementierung
  const countsTowardsBudget =
    group.narrativeRole === 'threat' || group.narrativeRole === 'victim';

  // Stub: Gibt leeres Loot zurueck
  void context;
  return {
    ...group,
    loot: { items: [], totalValue: 0, countsTowardsBudget },
  };
}
