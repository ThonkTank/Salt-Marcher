// Ziel: Activity + Goal für Encounter-Gruppen zuweisen
// Siehe: docs/services/encounter/groupActivity.md
//
// Pipeline:
//   Step 4.1: selectActivity() - Activity basierend auf Pool + Kontext wählen
//   Step 4.2: deriveGoal() - Goal aus Activity + NarrativeRole ableiten

import type { EncounterGroup } from '@/types/encounterTypes';
import type { Culture } from '#types/entities/culture';
import type { Species } from '#types/entities/species';
import type { Faction, CreatureDefinition, NPC } from '@/types/entities';
import type { WeightedItem } from '#types/common/counting';
import type { Disposition, NarrativeRole } from '@/constants';
import { type Activity, ACTIVITY_DEFINITIONS, GENERIC_ACTIVITY_IDS, CREATURE_WEIGHTS, DISPOSITION_THRESHOLDS } from '@/constants';
import { weightedRandomSelect, selectCulture, buildFactionChain } from '@/utils';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { getAllCreatures } from './encounterHelpers';

/**
 * Prüft ob eine Kreatur zur aktuellen Tageszeit aktiv ist.
 * Basiert auf creature.activeTime (Array von TimeSegments).
 */
function isCreatureActiveNow(creatureId: string, timeSegment: string): boolean {
  const def = vault.getEntity<CreatureDefinition>('creature', creatureId);
  // Default: aktiv wenn keine activeTime definiert
  if (!def?.activeTime) return true;
  return def.activeTime.includes(timeSegment as CreatureDefinition['activeTime'][number]);
}

/** Gewichtung für Activity-Quellen */
const ACTIVITY_WEIGHTS = {
  generic: 0.3,      // Generische Activities (niedrigste Priorität)
  culture: 0.5,      // Activities aus Kultur
  faction: 0.7,      // Activities aus Faction.influence
} as const;

/**
 * Wählt eine Activity basierend auf Culture + Faction.influence.
 *
 * Gewichtung:
 * 1. Quelle: Generic < Culture < Faction.influence
 * 2. Soft-Weighting für active/resting Tags (2.0x match, 0.5x mismatch)
 */
function selectActivity(
  group: EncounterGroup,
  context: { terrain: { id: string }; timeSegment: string },
  faction?: Faction,
  allCultures?: Culture[]
): Activity {
  const npcs = getAllCreatures(group);
  const seedNPC = npcs[0];

  // 1. Seed-Kreatur's Definition und Species holen
  const creatureDef = seedNPC
    ? vault.getEntity<CreatureDefinition>('creature', seedNPC.creature.id)
    : null;

  const species = creatureDef?.species
    ? vault.getEntity<Species>('species', creatureDef.species)
    : null;

  // 2. Alle Kulturen laden (falls nicht übergeben)
  const cultures = allCultures ?? vault.getAllEntities<Culture>('culture');

  // 3. Kultur auswählen
  const culture = selectCulture(creatureDef, species, faction ?? null, cultures);

  // 4. Faction-Kette für influence.activities
  const factionChain = faction ? buildFactionChain(faction) : [];
  const factionActivities = factionChain
    .flatMap(f => f.influence?.activities ?? []);

  // 5. Activities sammeln mit Quell-Gewicht
  const activityEntries: { id: string; weight: number }[] = [];

  // Generic Activities
  for (const id of GENERIC_ACTIVITY_IDS) {
    activityEntries.push({ id, weight: ACTIVITY_WEIGHTS.generic });
  }

  // Culture Activities
  for (const id of culture.activities ?? []) {
    activityEntries.push({ id, weight: ACTIVITY_WEIGHTS.culture });
  }

  // Faction.influence Activities
  for (const id of factionActivities) {
    activityEntries.push({ id, weight: ACTIVITY_WEIGHTS.faction });
  }

  // 6. Kreatur aktiv oder ruhend?
  const isActive = seedNPC
    ? isCreatureActiveNow(seedNPC.creature.id, context.timeSegment)
    : true;

  // 7. Gewichtete Items aufbauen
  const weighted: WeightedItem<Activity>[] = [];

  for (const entry of activityEntries) {
    const activity = ACTIVITY_DEFINITIONS[entry.id];
    if (!activity) continue;

    // Basis-Gewicht aus Quelle
    let weight = entry.weight;

    // Soft-Weighting für active/resting
    const hasActive = activity.contextTags.includes('active');
    const hasResting = activity.contextTags.includes('resting');

    // Activities mit beiden Tags: kein Modifikator
    if (hasActive && hasResting) {
      // weight bleibt unverändert
    } else if (isActive) {
      // Kreatur ist aktiv
      if (hasActive) {
        weight *= CREATURE_WEIGHTS.activeTimeMatch; // 2.0x
      } else if (hasResting) {
        weight *= CREATURE_WEIGHTS.activeTimeMismatch; // 0.5x
      }
    } else {
      // Kreatur ruht
      if (hasResting) {
        weight *= CREATURE_WEIGHTS.activeTimeMatch; // 2.0x
      } else if (hasActive) {
        weight *= CREATURE_WEIGHTS.activeTimeMismatch; // 0.5x
      }
    }

    weighted.push({ item: activity, randWeighting: weight });
  }

  // 8. Gewichtete Auswahl
  const selected = weightedRandomSelect(weighted);
  if (selected) return selected;

  // 9. Fallback auf 'wandering'
  return ACTIVITY_DEFINITIONS['wandering'] ?? {
    id: 'wandering',
    name: 'Umherziehen',
    awareness: 50,
    detectability: 50,
    contextTags: ['active', 'resting'],
  };
}

// ============================================================================
// DISPOSITION CALCULATION (Step 4.3)
// ============================================================================

/**
 * Findet Party-Reputation aus NPC oder Faction.
 * Priorität: NPC.reputations → Faction.reputations → 0
 *
 * @param npc - Optional: NPC-Objekt für individuelle Reputation
 * @param factionId - Optional: Faction-ID für Fraktions-Reputation
 * @returns Reputation-Wert (-100 bis +100), default 0
 */
function getGroupReputation(npc?: NPC, factionId?: string): number {
  // 1. NPC-Reputation hat Vorrang (direkt aus NPC-Objekt, kein Vault-Lookup)
  if (npc) {
    const partyRep = npc.reputations?.find(
      r => r.entityType === 'party' && r.entityId === 'party'
    );
    if (partyRep && partyRep.value !== 0) return partyRep.value;
  }

  // 2. Faction-Reputation als Fallback
  if (factionId) {
    const faction = vault.getEntity<Faction>('faction', factionId);
    const partyRep = faction?.reputations?.find(
      r => r.entityType === 'party' && r.entityId === 'party'
    );
    if (partyRep) return partyRep.value;
  }

  // 3. Default: keine Reputation bekannt
  return 0;
}

/**
 * Berechnet effektive Disposition aus baseDisposition + Reputation.
 *
 * effectiveDisposition = clamp(baseDisposition + reputation, -100, +100)
 *
 * @param baseDisposition - Basis-Disposition der Kreatur (-100 bis +100)
 * @param reputation - Reputation-Modifikator (-100 bis +100)
 * @returns Disposition-Label
 */
function calculateDisposition(baseDisposition: number, reputation: number): Disposition {
  const effective = Math.max(-100, Math.min(100, baseDisposition + reputation));

  if (effective < DISPOSITION_THRESHOLDS.hostile) return 'hostile';
  if (effective < DISPOSITION_THRESHOLDS.unfriendly) return 'unfriendly';
  if (effective < DISPOSITION_THRESHOLDS.indifferent) return 'indifferent';
  if (effective < DISPOSITION_THRESHOLDS.friendly) return 'friendly';
  return 'allied';
}

/**
 * Weist einer Gruppe eine Activity und ein Goal zu.
 * Nutzt NPC-Reputation falls ein NPC zugewiesen wurde.
 */
export function assignActivity(
  group: EncounterGroup,
  context: {
    terrain: { id: string };
    timeSegment: string;
  },
  faction?: Faction
): EncounterGroup {
  const activity = selectActivity(group, context, faction);

  // Disposition berechnen (Step 5.2)
  const npcs = getAllCreatures(group);
  const seedNPC = npcs[0];

  // baseDisposition aus Creature-Definition holen
  const creatureDef = seedNPC
    ? vault.getEntity<CreatureDefinition>('creature', seedNPC.creature.id)
    : null;
  const baseDisposition = creatureDef?.baseDisposition ?? 0;

  // Reputation nachschlagen: NPC-Reputation hat Vorrang vor Faction-Reputation
  // NPC wird direkt übergeben (kein Vault-Lookup nötig)
  const reputation = getGroupReputation(seedNPC, group.factionId ?? undefined);

  // Effektive Disposition berechnen
  const disposition = calculateDisposition(baseDisposition, reputation);

  return {
    ...group,
    activity: activity.id,
    goal: deriveGoal(activity, group.narrativeRole),
    disposition,
  };
}

/**
 * Leitet ein Goal aus Activity und NarrativeRole ab.
 * #2: Vollständige Implementierung mit Faction-Mappings (siehe TASKS)
 */
function deriveGoal(activity: Activity, narrativeRole: string): string {
  // Basis-Goal-Mapping nach NarrativeRole
  const defaultGoals: Record<string, string> = {
    threat: 'territory bewachen',
    victim: 'fliehen',
    neutral: 'eigene Ziele verfolgen',
    ally: 'helfen',
  };

  return defaultGoals[narrativeRole] ?? 'unbekannt';
}

// ============================================================================
// GROUP RELATIONS CALCULATION (Step 4.3)
// ============================================================================

/** Thresholds für Gruppen-Relationen (intern) */
const RELATION_THRESHOLDS = {
  hostile: -30,  // < -30 = hostile
  allied: 30,    // > +30 = allied
  // -30 bis +30 = neutral
} as const;

/**
 * Holt die Basis-Disposition einer Gruppe aus der Seed-Kreatur.
 * Fallback-Kette: Creature.baseDisposition → 0
 */
function getGroupDisposition(group: EncounterGroup): number {
  const npcs = getAllCreatures(group);
  const seedNPC = npcs[0];

  if (!seedNPC) return 0;

  const creatureDef = vault.getEntity<CreatureDefinition>('creature', seedNPC.creature.id);
  return creatureDef?.baseDisposition ?? 0;
}

/**
 * Holt die Reputation zwischen zwei Factions.
 * Sucht in factionA.reputations nach einem Eintrag für factionB.
 *
 * @returns Reputation-Wert (-100 bis +100), default 0
 */
function getFactionRelation(factionAId: string, factionBId: string): number {
  try {
    const factionA = vault.getEntity<Faction>('faction', factionAId);
    const rep = factionA?.reputations?.find(
      r => r.entityType === 'faction' && r.entityId === factionBId
    );
    return rep?.value ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Berechnet den numerischen Relation-Wert zwischen zwei Gruppen.
 *
 * Formel: (dispA + dispB) / 2 + factionModifier
 *
 * @returns Wert von -100 bis +100
 */
function calculateRelationValue(groupA: EncounterGroup, groupB: EncounterGroup): number {
  const dispA = getGroupDisposition(groupA);
  const dispB = getGroupDisposition(groupB);

  // Faction-zu-Faction Modifier (wenn beide Factions haben)
  let factionMod = 0;
  if (groupA.factionId && groupB.factionId) {
    factionMod = getFactionRelation(groupA.factionId, groupB.factionId);
  }

  const value = (dispA + dispB) / 2 + factionMod;
  return Math.max(-100, Math.min(100, value));
}

/**
 * Klassifiziert einen numerischen Relation-Wert zu einem Label.
 */
function classifyRelation(value: number): 'hostile' | 'neutral' | 'allied' {
  if (value < RELATION_THRESHOLDS.hostile) return 'hostile';
  if (value > RELATION_THRESHOLDS.allied) return 'allied';
  return 'neutral';
}

/**
 * Berechnet Gruppen-Relationen (Allianzen) aus EncounterGroups.
 *
 * Kombiniert explizite Regeln mit numerischer Disposition-Berechnung:
 *
 * **Explizite Regeln (Priorität):**
 * 1. Gruppe mit disposition === 'allied' → verbündet mit Party
 * 2. Gruppen mit gleicher factionId → untereinander verbündet
 *
 * **Numerische Berechnung (für Gruppen ohne explizite Regel):**
 * 3. relationValue = (dispA + dispB) / 2 + factionModifier
 *    - < -30 = hostile (nicht verbündet)
 *    - -30 bis +30 = neutral (nicht verbündet)
 *    - > +30 = allied (verbündet)
 *
 * @returns Record<groupId, verbündete groupIds[]>
 */
export function calculateGroupRelations(groups: EncounterGroup[]): Record<string, string[]> {
  const alliances: Record<string, string[]> = { party: [] };

  for (const group of groups) {
    alliances[group.groupId] = [];

    // 1. Allied-Disposition → mit Party verbündet
    if (group.disposition === 'allied') {
      alliances.party.push(group.groupId);
      alliances[group.groupId].push('party');
    }

    // 2. Gruppen-zu-Gruppen Relationen
    for (const other of groups) {
      if (group.groupId === other.groupId) continue;

      // 2a. Gleiche Faction → immer verbündet
      if (group.factionId && group.factionId === other.factionId) {
        if (!alliances[group.groupId].includes(other.groupId)) {
          alliances[group.groupId].push(other.groupId);
        }
        continue;
      }

      // 2b. Numerische Relation berechnen
      const relationValue = calculateRelationValue(group, other);
      const relation = classifyRelation(relationValue);

      if (relation === 'allied') {
        if (!alliances[group.groupId].includes(other.groupId)) {
          alliances[group.groupId].push(other.groupId);
        }
      }
      // hostile und neutral: nicht verbündet (nichts hinzufügen)
    }
  }

  return alliances;
}
