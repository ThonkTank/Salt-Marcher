// Ziel: Activity + Goal für Encounter-Gruppen zuweisen
// Siehe: docs/services/encounter/groupActivity.md
//
// Pipeline:
//   Step 4.1: selectActivity() - Activity basierend auf Pool + Kontext wählen
//   Step 4.2: deriveGoal() - Goal aus Activity + NarrativeRole ableiten
//
// TASKS:
// |  # | Status | Domain    | Layer    | Beschreibung                                                           |  Prio  | MVP? | Deps | Spec                                                                 | Imp.                                       |
// |--:|:----:|:--------|:-------|:---------------------------------------------------------------------|:----:|:--:|:---|:-------------------------------------------------------------------|:-----------------------------------------|
// |  1 |   ⬜    | encounter | services | Context-Filter: weather/aquatic/terrain Tags                           | mittel | Nein | -    | groupActivity.md#kontext-filter                                      | selectActivity()                           |
// |  2 |   ⚠️   | encounter | services | Goal-Ableitung mit Faction-Mappings                                    | mittel | Nein | b1   | groupActivity.md#Goal-Beispiele                                      | deriveGoal()                               |
// |  3 |   ✅    | encounter | services | Activity-Pool über Culture-System auflösen                             | mittel | Nein | -    | groupActivity.md#Activity-Pool-Hierarchie                            | selectActivity()                           |
// | 23 |   ✅    | encounter | services | active/resting Filter basierend auf creature.activeTime                | mittel | Nein | -    | groupActivity.md#Kontext-Filter                                      | selectActivity()                           |
// | 24 |   ✅    | encounter | services | Activity-Pool-Hierarchie (Step 4.1) implementiert                      | mittel | Nein | -    | groupActivity.md#Activity-Definition                                 | selectActivity()                           |
// | 25 |   ✅    | encounter | services | CultureData.activities auf string[] umgestellt                         | mittel | Nein | -    | groupActivity.md#Activity-Definition                                 | selectActivity()                           |
// | 60 |   ⬜    | encounter | services | Disposition-Berechnung mit baseDisposition + Reputation implementieren | mittel | Nein | #59  | services/encounter/groupActivity.md#Step-4.3:-Disposition-Berechnung | groupActivity.ts.assignActivity() [ändern] |
//
// BUGS:
// | b1 | ⬜ | disposition Feld nicht dokumentiert (hostile|neutral|friendly) | hoch | #2 |

import type { PopulatedGroup, EncounterCreature, GroupStatus } from './groupPopulation';
import type { Faction, CreatureDefinition } from '@/types/entities';
import type { WeightedItem } from '#types/common/counting';
import { type Activity, ACTIVITY_DEFINITIONS, GENERIC_ACTIVITY_IDS } from '@/constants';
import { weightedRandomSelect, resolveCultureChain, getCultureField } from '@/utils';
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
 * Wählt eine Activity basierend auf Culture-Chain und Kontext-Filter.
 *
 * Pool-Hierarchie (via Culture-Chain mit 60%-Kaskade):
 * 1. GENERIC_ACTIVITIES - Basis-Pool für alle Kreaturen
 * 2. Type/Species Culture - über resolveCultureChain()
 * 3. Faction Culture - über resolveCultureChain()
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
  const creatures = getAllCreatures(group);
  const seedCreature = creatures[0];

  // 1. Seed-Kreatur's Definition holen
  const creatureDef = seedCreature
    ? vault.getEntity<CreatureDefinition>('creature', seedCreature.creatureId)
    : null;

  // 2. Culture-Chain aufbauen (Type/Species → Faction)
  const layers = resolveCultureChain(creatureDef, faction ?? null);

  // 3. Activities aus Culture-Chain holen (mit 60%-Kaskade)
  const cultureActivities = getCultureField(layers, 'activities') ?? [];

  // 4. Pool zusammenstellen: Generic + Culture
  const activityIds = new Set<string>([
    ...GENERIC_ACTIVITY_IDS,
    ...cultureActivities,
  ]);

  // 5. IDs zu Activities auflösen
  const pool: Activity[] = [...activityIds]
    .map((id) => ACTIVITY_DEFINITIONS[id])
    .filter((a): a is Activity => a !== undefined);

  // 6. Nach Kontext filtern (basierend auf Seed-Kreatur's activeTime)
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

    // #1: aquatic nur bei Wasser-Terrain (siehe TASKS)
    return true;
  });

  // 7. Fallback wenn alles gefiltert
  const finalPool = filtered.length > 0 ? filtered : pool;

  // 8. Gewichtete Auswahl (gleiche Gewichte)
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
    disposition:
      group.narrativeRole === 'threat' ? 'hostile' : group.narrativeRole === 'ally' ? 'friendly' : 'neutral',
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
