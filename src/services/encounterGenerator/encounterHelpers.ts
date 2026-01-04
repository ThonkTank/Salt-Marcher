// Ziel: Helper-Funktionen für Encounter-Gruppen mit Slots-Struktur
// Siehe: docs/services/encounter/encounter.md

import type { EncounterGroup } from '@/types/encounterTypes';
import type { NPC } from '@/types/entities';

// ============================================================================
// CREATURE ACCESS HELPERS
// ============================================================================

/**
 * Findet einen NPC per id über alle Slots.
 * O(n) where n = total NPCs in group.
 */
export function getCreatureById(
  group: EncounterGroup,
  npcId: string
): NPC | undefined {
  for (const npcs of Object.values(group.slots)) {
    const found = npcs.find(npc => npc.id === npcId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Findet einen NPC in mehreren Gruppen per id.
 * Nützlich wenn die Gruppe nicht bekannt ist.
 */
export function getCreatureByIdFromGroups(
  groups: EncounterGroup[],
  npcId: string
): { creature: NPC; group: EncounterGroup } | undefined {
  for (const group of groups) {
    const creature = getCreatureById(group, npcId);
    if (creature) return { creature, group };
  }
  return undefined;
}

/**
 * Iteriert über alle NPCs einer Gruppe (Generator).
 * Vermeidet Array-Kopien bei großen Gruppen.
 */
export function* iterateCreatures(
  group: EncounterGroup
): Generator<NPC> {
  for (const npcs of Object.values(group.slots)) {
    yield* npcs;
  }
}

/**
 * Iteriert über alle NPCs mit Slot-Namen (Generator).
 */
export function* iterateCreaturesWithSlot(
  group: EncounterGroup
): Generator<{ creature: NPC; slotName: string }> {
  for (const [slotName, npcs] of Object.entries(group.slots)) {
    for (const npc of npcs) {
      yield { creature: npc, slotName };
    }
  }
}

/**
 * Zählt alle NPCs einer Gruppe.
 */
export function countCreatures(group: EncounterGroup): number {
  return Object.values(group.slots).reduce((sum, npcs) => sum + npcs.length, 0);
}

/**
 * Zählt alle NPCs über mehrere Gruppen.
 */
export function countCreaturesInGroups(groups: EncounterGroup[]): number {
  return groups.reduce((sum, group) => sum + countCreatures(group), 0);
}

/**
 * Sammelt alle NPCs einer Gruppe in ein Array.
 * Nutze iterateCreatures() wenn möglich, um Kopien zu vermeiden.
 */
export function getAllCreatures(group: EncounterGroup): NPC[] {
  return Object.values(group.slots).flat();
}

/**
 * Prüft ob eine NPC-ID in einer Gruppe existiert.
 */
export function hasCreature(group: EncounterGroup, npcId: string): boolean {
  return group.npcIds.includes(npcId);
}
