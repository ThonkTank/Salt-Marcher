// Ziel: Activity + Goal für Encounter-Gruppen zuweisen
// Siehe: docs/services/encounter/groupActivity.md
//
// Pipeline:
//   Step 4.1: selectActivity() - Activity basierend auf Pool + Kontext wählen
//   Step 4.2: deriveGoal() - Goal aus Activity + NarrativeRole ableiten
//
// DISKREPANZEN:
// ================================================
//
// [HACK: groupActivity.md] disposition Feld nicht dokumentiert
//   → Code gibt 'hostile' | 'neutral' | 'friendly' zurück, Docs erwähnen dies nicht
//
// [TODO: groupActivity.md#kontext-filter] Context-Filter
//   → weather Tags, aquatic/terrain Tags
//
// [TODO: groupActivity.md#step-42] Goal-Ableitung
//   → deriveGoal() mit DEFAULT_GOALS_BY_ROLE + Faction-Mappings
//
// [TODO: Culture-Chain] Activity-Pool über Culture-System auflösen
//   → resolveCultureChain(creatureDef, faction) statt creature.activities
//   → Activities aus Vault laden statt ACTIVITY_DEFINITIONS
//   → Siehe: docs/services/NPCs/Culture-Resolution.md
//
// RESOLVED:
// - [2025-12-30] Activity-Pool-Hierarchie (Step 4.1) implementiert
// - [2025-12-30] active/resting Filter basierend auf creature.activeTime
// - [2025-12-30] CultureData.activities auf string[] umgestellt

import type { PopulatedGroup, EncounterCreature, GroupStatus } from './groupPopulation';
import type { Faction, CreatureDefinition } from '@/types/entities';
import type { WeightedItem } from '#types/common/counting';
import { type Activity, ACTIVITY_DEFINITIONS, GENERIC_ACTIVITY_IDS } from '@/constants';
import { weightedRandomSelect } from '@/utils';
import { vault } from '@/infrastructure/vault/vaultInstance';

/** Output von assignActivity - PopulatedGroup mit Activity/Goal */
export interface GroupWithActivity {
  groupId: string;
  templateRef?: string;
  factionId: string | null;
  slots: { [slotName: string]: EncounterCreature[] };
  narrativeRole: 'threat' | 'victim' | 'neutral' | 'ally';
  status: GroupStatus;
  activity: string;
  goal: string;
  disposition: 'hostile' | 'neutral' | 'friendly';
}

/**
 * Sammelt alle EncounterCreatures aus den Slots einer Gruppe.
 */
function getAllCreatures(group: PopulatedGroup): EncounterCreature[] {
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
 * Wählt eine Activity basierend auf Pool-Hierarchie und Kontext-Filter.
 *
 * Pool-Hierarchie (Step 4.1):
 * 1. GENERIC_ACTIVITIES - Basis-Pool für alle Kreaturen
 * 2. Creature.activities - Kreatur-Typ spezifische Activities
 * 3. Faction.culture.activities - Fraktions-spezifische Activities
 *
 * Kontext-Filter:
 * - Kreatur aktiv (timeSegment ∈ activeTime): nur 'active' Activities
 * - Kreatur ruht (timeSegment ∉ activeTime): nur 'resting' Activities
 * - Activities mit beiden Tags sind immer möglich
 */
function selectActivity(
  group: PopulatedGroup,
  context: { terrain: { id: string }; timeSegment: string },
  faction?: Faction
): Activity {
  // 1. Pool zusammenstellen (Hierarchie)
  const activityIds = new Set<string>();

  // Generic (immer)
  GENERIC_ACTIVITY_IDS.forEach((id) => activityIds.add(id));

  // Creature-spezifisch (aus group.creatures)
  const creatures = getAllCreatures(group);
  for (const creature of creatures) {
    const def = vault.getEntity<CreatureDefinition>('creature', creature.creatureId);
    if (def?.activities) {
      def.activities.forEach((id) => activityIds.add(id));
    }
  }

  // Faction-spezifisch (activities ist jetzt string[])
  if (faction?.culture?.activities) {
    faction.culture.activities.forEach((id) => activityIds.add(id));
  }

  // 2. IDs zu Activities auflösen
  const pool: Activity[] = [...activityIds]
    .map((id) => ACTIVITY_DEFINITIONS[id])
    .filter((a): a is Activity => a !== undefined);

  // 3. Nach Kontext filtern (basierend auf Seed-Kreatur's activeTime)
  const seedCreature = creatures[0];
  const isActive = seedCreature ? isCreatureActiveNow(seedCreature.creatureId, context.timeSegment) : true;

  const filtered = pool.filter((a) => {
    const hasActive = a.contextTags.includes('active');
    const hasResting = a.contextTags.includes('resting');

    // Activities mit beiden Tags sind immer möglich
    if (hasActive && hasResting) return true;

    // Kreatur aktiv: nur 'active' Activities
    if (isActive && !hasActive) return false;

    // Kreatur ruht: nur 'resting' Activities
    if (!isActive && !hasResting) return false;

    // TODO: aquatic nur bei Wasser-Terrain
    return true;
  });

  // 4. Fallback wenn alles gefiltert
  const finalPool = filtered.length > 0 ? filtered : pool;

  // 5. Gewichtete Auswahl (gleiche Gewichte)
  const weighted: WeightedItem<Activity>[] = finalPool.map((a) => ({ item: a, weight: 1 }));
  const selected = weightedRandomSelect(weighted);

  // Fallback auf 'wandering' wenn Pool leer
  if (selected) return selected;

  // Hartcodierter Fallback falls ACTIVITY_DEFINITIONS fehlschlägt
  return ACTIVITY_DEFINITIONS['wandering'] ?? {
    id: 'wandering',
    name: 'Umherziehen',
    awareness: 50,
    detectability: 50,
    contextTags: ['active', 'resting', 'movement'],
  };
}

/**
 * Weist einer Gruppe eine Activity und ein Goal zu.
 */
export function assignActivity(
  group: PopulatedGroup,
  context: {
    terrain: { id: string };
    timeSegment: string;
  },
  faction?: Faction
): GroupWithActivity {
  const activity = selectActivity(group, context, faction);

  return {
    ...group,
    activity: activity.id,
    goal: deriveGoal(activity, group.narrativeRole),
    disposition: group.narrativeRole === 'threat' ? 'hostile' : 'neutral',
  };
}

/**
 * Leitet ein Goal aus Activity und NarrativeRole ab.
 * TODO: [groupActivity.md#step-42] Vollständige Implementierung mit Faction-Mappings
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
