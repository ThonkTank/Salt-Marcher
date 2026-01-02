// Ziel: Activity + Goal für Encounter-Gruppen zuweisen
// Siehe: docs/services/encounter/groupActivity.md
//
// Pipeline:
//   Step 4.1: selectActivity() - Activity basierend auf Pool + Kontext wählen
//   Step 4.2: deriveGoal() - Goal aus Activity + NarrativeRole ableiten

import type { EncounterGroup } from '@/types/encounterTypes';
import type { Faction, CreatureDefinition, NPC } from '@/types/entities';
import type { WeightedItem } from '#types/common/counting';
import type { Disposition, NarrativeRole } from '@/constants';
import { type Activity, ACTIVITY_DEFINITIONS, GENERIC_ACTIVITY_IDS, CREATURE_WEIGHTS, DISPOSITION_THRESHOLDS, LAYER_CASCADE_RATIO } from '@/constants';
import { weightedRandomSelect, resolveCultureChain } from '@/utils';
import { vault } from '@/infrastructure/vault/vaultInstance';


/**
 * Sammelt alle NPCs aus den Slots einer Gruppe.
 */
function getAllCreaturesFromSlots(group: EncounterGroup): NPC[] {
  return Object.values(group.slots).flat();
}

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

/**
 * Berechnet Layer-Gewichte per 60%-Kaskade.
 * Leaf bekommt 60%, Rest kaskadiert.
 *
 * @param layerCount - Anzahl der Layers (inkl. Generic als Layer 0)
 * @returns Array mit Gewichten [layer0, layer1, ..., layerN]
 */
function calculateLayerWeights(layerCount: number): number[] {
  if (layerCount <= 0) return [];
  if (layerCount === 1) return [1.0];

  const weights: number[] = [];
  let remaining = 1.0;

  // Von Leaf nach Root: Leaf bekommt LAYER_CASCADE_RATIO (60%), Rest kaskadiert
  for (let i = layerCount - 1; i > 0; i--) {
    weights.unshift(remaining * LAYER_CASCADE_RATIO);
    remaining *= (1 - LAYER_CASCADE_RATIO);
  }
  weights.unshift(remaining); // Root bekommt Rest

  return weights;
}

/**
 * Wählt eine Activity basierend auf Culture-Chain und Soft-Weighting.
 *
 * Gewichtung:
 * 1. Basis-Gewicht per 60%-Kaskade (Layer-Herkunft)
 * 2. Soft-Weighting für active/resting Tags (2.0x match, 0.5x mismatch)
 */
function selectActivity(
  group: EncounterGroup,
  context: { terrain: { id: string }; timeSegment: string },
  faction?: Faction
): Activity {
  const npcs = getAllCreaturesFromSlots(group);
  const seedNPC = npcs[0];

  // 1. Seed-Kreatur's Definition holen
  const creatureDef = seedNPC
    ? vault.getEntity<CreatureDefinition>('creature', seedNPC.creature.id)
    : null;

  // 2. Culture-Chain aufbauen (Type/Species → Faction)
  const layers = resolveCultureChain(creatureDef, faction ?? null);

  // 3. Activities aus ALLEN Layern sammeln mit Layer-Index
  // Layer 0 = Generic (niedrigste Priorität)
  // Layer 1+ = Culture-Layers (höhere Priorität)
  const activityEntries: { id: string; layerIndex: number }[] = [];

  // Generic immer mit Layer 0
  for (const id of GENERIC_ACTIVITY_IDS) {
    activityEntries.push({ id, layerIndex: 0 });
  }

  // Culture-Layers hinzufügen
  for (let i = 0; i < layers.length; i++) {
    const layerActivities = layers[i].culture.activities ?? [];
    for (const id of layerActivities) {
      activityEntries.push({ id, layerIndex: i + 1 });
    }
  }

  // 4. Basis-Gewichte per 60%-Kaskade berechnen
  const totalLayers = layers.length + 1; // +1 für Generic
  const layerWeights = calculateLayerWeights(totalLayers);

  // 5. Kreatur aktiv oder ruhend?
  const isActive = seedNPC
    ? isCreatureActiveNow(seedNPC.creature.id, context.timeSegment)
    : true;

  // 6. Gewichtete Items aufbauen
  const weighted: WeightedItem<Activity>[] = [];

  for (const entry of activityEntries) {
    const activity = ACTIVITY_DEFINITIONS[entry.id];
    if (!activity) continue;

    // Basis-Gewicht aus Layer
    let weight = layerWeights[entry.layerIndex];

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

  // 7. Gewichtete Auswahl
  const selected = weightedRandomSelect(weighted);
  if (selected) return selected;

  // 8. Fallback auf 'wandering'
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
 * @param npcId - Optional: NPC-ID für individuelle Reputation
 * @param factionId - Optional: Faction-ID für Fraktions-Reputation
 * @returns Reputation-Wert (-100 bis +100), default 0
 */
function getGroupReputation(npcId?: string, factionId?: string): number {
  // 1. NPC-Reputation hat Vorrang
  if (npcId) {
    const npc = vault.getEntity<NPC>('npc', npcId);
    const partyRep = npc?.reputations?.find(
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
  const npcs = getAllCreaturesFromSlots(group);
  const seedNPC = npcs[0];

  // baseDisposition aus Creature-Definition holen
  const creatureDef = seedNPC
    ? vault.getEntity<CreatureDefinition>('creature', seedNPC.creature.id)
    : null;
  const baseDisposition = creatureDef?.baseDisposition ?? 0;

  // NPC-ID direkt aus dem NPC (NPCs sind jetzt direkt in Slots)
  const seedNpcId = seedNPC?.id;

  // Reputation nachschlagen: NPC-Reputation hat Vorrang vor Faction-Reputation
  const reputation = getGroupReputation(seedNpcId, group.factionId ?? undefined);

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
