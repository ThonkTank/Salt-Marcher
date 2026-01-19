# Encounter-Activity

> **Helper fuer:** Encounter-Service (Step 5.2)
> **Input:** `GroupWithNPCs`, `EncounterContext`, `Faction?`
> **Output:** `GroupWithActivity` (Activity, Goal, Disposition)
> **Aufgerufen von:** [Encounter.md](Encounter.md)
>
> **Referenzierte Schemas:**
> - [activity.md](../../types/activity.md) - Activity-Entity
> - [faction.md](../../types/faction.md) - Faction mit Culture und Reputations
> - [npc.md](../../types/npc.md) - NPC mit Reputations
> - [creature.md](../../types/creature.md) - CreatureDefinition mit baseDisposition
> - [types.md#ReputationEntry](../../architecture/types.md#reputationentry) - Reputation-Schema
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [Encounter.md#encounternpcs-step-51](Encounter.md#encounternpcs-step-51) - NPC-Instanziierung (Step 5.1, VOR groupActivity!)
> - [encounterDistance.md](encounterDistance.md) - Perception-Berechnung (Step 5.4)
> - [Encounter.md#encounterloot-step-53](Encounter.md#encounterloot-step-53) - Loot-Generierung (Step 5.3)

RP-Details fuer Encounters: Activities und Goals.

**Wichtig:** Activity und Goal werden VOR Balance berechnet. Activity-Werte (`awareness`, `detectability`) werden von [encounterDistance.md](encounterDistance.md) fuer die Perception-Berechnung verwendet.

---

## Step 5.2a: Activity-Generierung

**Zweck:** Was macht die Gruppe gerade, wenn die Party sie antrifft?

**Input:** `GroupWithNPCs`, `EncounterContext`, `Faction?`

**Output:** `string` (Activity-Name)

### Activity-Definition

Activities werden in der **Library** als eigenstaendige Entities definiert.

-> **Schema:** [activity.md](../../entities/activity.md)

**Verwendung:**
- `awareness` -> Ueberraschungs-Modifikator (hoch = schwer zu ueberraschen)
- `detectability` -> InitialDistance-Modifikator (hoch = Party entdeckt frueher)

**Beispiele:**

| Activity | Awareness | Detectability | Beschreibung |
|----------|:---------:|:-------------:|--------------|
| sleeping | 10 | 20 | Tief schlafend, leise |
| resting | 40 | 40 | Entspannt, normal |
| patrolling | 80 | 60 | Wachsam, sichtbar |
| hunting | 90 | 30 | Wachsam, leise |
| ambushing | 95 | 10 | Max wachsam, versteckt |
| hiding | 90 | 5 | Wachsam, extrem versteckt |
| raiding | 60 | 90 | Chaos, sehr laut |
| war_chanting | 45 | 100 | Ritual, extrem laut |

### Activity gilt pro Gruppe

Jede Gruppe im Encounter hat eine **separate** Activity. Bei Multi-Group-Encounters kann das so aussehen:

| Gruppe | NarrativeRole | Activity |
|--------|---------------|----------|
| Banditen | threat | ambushing |
| Haendler | victim | fleeing |

### Activity-Pool-Hierarchie (Culture-Chain)

Activities werden ueber das Culture-System aufgeloest:

| Ebene | Beispiel-Activities | Quelle |
|-------|---------------------|--------|
| **GENERIC_ACTIVITY_IDS** | sleeping, resting, traveling, wandering | Basis-Pool (alle Kreaturen) |
| **Type Culture** | patrol, guard, resting | Fallback basierend auf creature.tags[0] |
| **Species Culture** | ambush, scavenge, camp | ERSETZT Type wenn creature.species gesetzt |
| **Faction Culture** | camp, patrol, raid | Ergaenzt mit 60%-Kaskade |

-> Siehe: [Culture-Resolution.md](../NPCs/Culture-Resolution.md)

### Generische Activities (GENERIC_ACTIVITIES)

Diese Activities stehen allen Kreaturen zur Verfuegung:

| Activity | Awareness | Detectability | Beschreibung |
|----------|:---------:|:-------------:|--------------|
| `sleeping` | 10 | 20 | Tief schlafend, leise |
| `resting` | 40 | 40 | Entspannt, normal |
| `feeding` | 30 | 50 | Beim Essen, abgelenkt |
| `traveling` | 55 | 55 | Unterwegs, normal |
| `wandering` | 50 | 50 | Ziellos, durchschnittlich |

Creature- und Faction-Activities ergaenzen diesen Pool.

-> Vollstaendige Liste: [presets/activities/index.ts](../../../presets/activities/index.ts)

```typescript
function selectActivity(
  group: GroupWithNPCs,
  context: EncounterContext,
  faction?: Faction
): Activity {
  // 1. Culture-Chain aufbauen (Type/Species → Faction)
  const layers = resolveCultureChain(creatureDef, faction);

  // 2. Activities aus ALLEN Layern sammeln mit Layer-Index
  const activityEntries: { id: string; layerIndex: number }[] = [];

  // Generic immer mit Layer 0 (niedrigste Prioritaet)
  GENERIC_ACTIVITY_IDS.forEach(id => activityEntries.push({ id, layerIndex: 0 }));

  // Culture-Layers hinzufuegen (hoehere Prioritaet)
  for (let i = 0; i < layers.length; i++) {
    layers[i].culture.activities?.forEach(id =>
      activityEntries.push({ id, layerIndex: i + 1 })
    );
  }

  // 3. Basis-Gewichte per 60%-Kaskade berechnen
  const layerWeights = calculateLayerWeights(layers.length + 1);

  // 4. Gewichtete Items aufbauen
  const weighted: WeightedItem<Activity>[] = [];
  for (const entry of activityEntries) {
    let weight = layerWeights[entry.layerIndex];

    // Soft-Weighting fuer active/resting (siehe Kontext-Modifikatoren)
    weight *= getContextModifier(activity, isCreatureActive);

    weighted.push({ item: activity, weight });
  }

  // 5. Gewichtete Auswahl
  return weightedRandomSelect(weighted);
}
```

### Kontext-Modifikatoren (Soft-Weighting)

Activities werden per Soft-Weighting bevorzugt/benachteiligt basierend auf `contextTags`:

| Situation | Modifikator |
|-----------|:-----------:|
| Activity `active` + Kreatur aktiv | 2.0x |
| Activity `resting` + Kreatur ruht | 2.0x |
| Activity `active` + Kreatur ruht | 0.5x |
| Activity `resting` + Kreatur aktiv | 0.5x |
| Activity hat beide Tags | Kein Modifikator |

**Wichtig:** Activities werden NIE gefiltert, nur gewichtet. Auch eine `sleeping` Activity kann bei einer aktiven Kreatur gewaehlt werden - nur mit 0.5x Wahrscheinlichkeit.

### Activity-Beispiele

| Kreatur | Activities |
|---------|------------|
| Wolf | sleeping, hunting, playing, howling |
| Goblin | patrolling, raiding, resting, arguing |
| Bandit | ambushing, camping, scouting, drinking |
| Guard | patrolling, resting, training, gambling |
| Merchant | traveling, trading, resting, haggling |

---

## Step 5.2b: Goal-Ableitung (Gruppen-Goal)

**Zweck:** Was will die Gruppe als Ganzes erreichen?

> **Abgrenzung:** Dieses `goal` beschreibt das **Gruppen-Ziel** (z.B. "rob_travelers").
> Das `personalGoal` einzelner NPCs (z.B. "impress_boss") wird in
> [NPC-Generation.md#personalgoal-pool-hierarchie](../NPCs/NPC-Generation.md#personalgoal-pool-hierarchie) definiert.
> Beide Konzepte sind **unabhaengig** voneinander.

**Input:** `string` (Activity), `NarrativeRole`

**Output:** `string` (Goal)

### Goal aus Activity + Role

Goals werden aus der Kombination von Activity und NarrativeRole abgeleitet:

```typescript
function deriveGoal(
  activity: string,
  narrativeRole: NarrativeRole,
  faction?: ResolvedFaction
): string {
  // 1. Faction-spezifisches Goal-Mapping pruefen
  if (faction?.culture.activityGoals?.[activity]) {
    return faction.culture.activityGoals[activity];
  }

  // 2. Role-basiertes Default-Goal
  return DEFAULT_GOALS_BY_ROLE[narrativeRole] ?? 'survive';
}

const DEFAULT_GOALS_BY_ROLE: Record<NarrativeRole, string> = {
  threat: 'dominate',
  victim: 'survive',
  neutral: 'continue_task',
  ally: 'assist'
};
```

### Goal-Beispiele

| Activity | NarrativeRole | Goal |
|----------|---------------|------|
| ambushing | threat | rob_travelers |
| fleeing | victim | escape_danger |
| patrolling | neutral | maintain_order |
| hunting | threat | find_food |
| trading | neutral | make_profit |

### Faction-spezifische Goals

Fraktionen koennen Activity-Goal-Mappings definieren:

```typescript
// Blutfang-Fraktion
{
  culture: {
    activityGoals: {
      raiding: 'please_the_boss',
      patrolling: 'find_victims',
      resting: 'recover_for_next_raid'
    }
  }
}
```

---

## Step 5.2: Disposition-Berechnung

**Zweck:** Wie steht die Gruppe zur Party?

**Input:** `GroupWithNPCs`, `Faction?`

**Output:** `Disposition` ('hostile' | 'unfriendly' | 'indifferent' | 'friendly' | 'allied')

**Hinweis:** Da encounterNPCs jetzt VOR groupActivity laeuft (Step 5.1), ist `group.creatures[0]?.npcId` verfuegbar und NPC-Reputation fliesst korrekt in die Disposition-Berechnung ein.

### Disposition-Formel

Die effektive Disposition wird aus drei Faktoren berechnet:

```
effectiveDisposition = clamp(baseDisposition + factionDisposition + reputation, -100, +100)
```

| Komponente | Quelle | Range | Beschreibung |
|------------|--------|:-----:|--------------|
| `baseDisposition` | `CreatureDefinition.baseDisposition` | -100 bis +100 | Grundeinstellung der Kreatur |
| `factionDisposition` | `Faction.defaultDisposition` | -100 bis +100 | Fraktions-Default (0 wenn keine Faction) |
| `reputation` | NPC oder Faction Reputation | -100 bis +100 | Party-Beziehung |

**Label-Thresholds:**

| Bereich | Label |
|---------|-------|
| < -33 | `hostile` |
| -33 bis +33 | `neutral` |
| > +33 | `friendly` |

### Reputation-Lookup-Prioritaet

1. **NPC.reputations** (Party-Eintrag) - falls NPC zugewiesen und Eintrag vorhanden
2. **Faction.reputations** (Party-Eintrag) - falls Gruppe zu Faction gehoert
3. **Default: 0** - keine Reputation bekannt

```typescript
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

  // 3. Default: 0
  return 0;
}

function calculateDisposition(
  creature: CreatureDefinition,
  faction: Faction | undefined,
  reputation: number
): Disposition {
  const baseDisposition = creature.baseDisposition ?? 0;
  const factionDisposition = faction?.defaultDisposition ?? 0;

  const effective = Math.max(-100, Math.min(100,
    baseDisposition + factionDisposition + reputation
  ));

  if (effective < -33) return 'hostile';
  if (effective > 33) return 'friendly';
  return 'neutral';
}
```

### Disposition-Beispiele

| Kreatur | baseDisposition | Reputation | Effektiv | Label |
|---------|:---------------:|:----------:|:--------:|-------|
| Goblin | -75 | 0 | -75 | hostile |
| Goblin | -75 | +50 (Handel) | -25 | neutral |
| Wolf | -25 | 0 | -25 | neutral |
| Haendler | +25 | +30 (Stammkunde) | +55 | friendly |
| Bandit | -75 | -20 (Ueberfall) | -95 | hostile |

### narrativeRole hat keinen Einfluss

**Wichtig:** `narrativeRole` beeinflusst die Disposition NICHT mehr.

- `narrativeRole` beschreibt die narrative Funktion im Encounter (threat, victim, neutral, ally)
- `disposition` beschreibt die tatsaechliche Einstellung zur Party

Ein `ally` mit niedriger Reputation kann trotzdem `neutral` sein.
Ein `threat` mit hoher Reputation kann `friendly` sein (z.B. Wachen die Party kennen).

---

## Step 4.1.1: Gruppen-Relationen berechnen {#calculatealliances}

**Zweck:** Bestimmt welche Gruppen im Encounter verbuendet sind.

**Input:** `EncounterGroup[]` (nach assignActivity)

**Output:** `Record<string, string[]>` (groupId → verbuendete groupIds)

### Relation-Berechnung

Die Funktion `calculateGroupRelations()` kombiniert explizite Regeln mit numerischer Disposition-Berechnung:

**Explizite Regeln (Prioritaet):**

| # | Bedingung | Effekt |
|:-:|-----------|--------|
| 1 | `disposition === 'allied'` | Gruppe verbuendet mit Party |
| 2 | Gleiche `factionId` | Gruppen untereinander verbuendet |

**Numerische Berechnung (fuer alle anderen Gruppen-Paare):**

```
relationValue = (dispA + dispB) / 2 + factionModifier
```

| relationValue | Klassifizierung | Effekt |
|:-------------:|:---------------:|--------|
| < -30 | `hostile` | Nicht verbuendet |
| -30 bis +30 | `neutral` | Nicht verbuendet |
| > +30 | `allied` | Verbuendet |

Dabei ist:
- `dispA`, `dispB`: `baseDisposition` der Seed-Kreatur jeder Gruppe
- `factionModifier`: Faction-zu-Faction Reputation (falls beide Gruppen Factions haben)

### Interne Helper-Funktionen

```typescript
// Holt baseDisposition der Seed-Kreatur
function getGroupDisposition(group: EncounterGroup): number

// Holt Faction-zu-Faction Reputation
function getFactionRelation(factionAId: string, factionBId: string): number

// Berechnet numerischen Relation-Wert
function calculateRelationValue(groupA: EncounterGroup, groupB: EncounterGroup): number

// Klassifiziert Wert zu Label
function classifyRelation(value: number): 'hostile' | 'neutral' | 'allied'
```

### Beispiele

| Gruppe A | Gruppe B | Berechnung | Ergebnis |
|----------|----------|------------|:--------:|
| Wachen (allied) | Party | disposition = allied | Verbuendet |
| Banditen | Schmuggler | Gleiche Faction | Verbuendet |
| Banditen (-70) | Orks (-60) | (-70 + -60)/2 = -65 | hostile |
| Banditen (-70) | Haendler (+30) | (-70 + 30)/2 = -20 | neutral |
| Wachen (+40) | Haendler (+30) | (40 + 30)/2 + 50 = +85 | allied |
| Wolf (-20) | Hirsch (-10) | (-20 + -10)/2 = -15 | neutral |

### Verwendung in Pipeline

Gruppen-Relationen werden in [encounterGenerator.ts](../../../src/services/encounterGenerator/encounterGenerator.ts) nach `assignActivity()` berechnet:

```typescript
// Step 4.1: Activity zuweisen
const groupsWithActivity = populatedGroups.map(g => assignActivity(g, context));

// Step 4.1.1: Gruppen-Relationen berechnen
const alliances = calculateGroupRelations(groupsWithActivity);

const encounterInstance: EncounterInstance = {
  groups: currentGroups,
  alliances,  // Wird von difficulty.ts fuer Simulation konsumiert
  // ...
};
```

---

## Multi-Group Flavour

Bei Encounters mit mehreren Gruppen wird Activity **pro Gruppe** generiert.

### Activity-Interaktion

Activities der Gruppen sollten narrativ zusammenpassen:

| Gruppe 1 Activity | Gruppe 2 Role | Passende Gruppe 2 Activity |
|-------------------|---------------|----------------------------|
| ambushing | victim | cowering, fleeing |
| raiding | victim | defending, surrendering |
| hunting | neutral | observing, hiding |
| patrolling | ally | patrolling, resting |

---

## buildActivityPool() Export

Fuer den Balancing-Service wird `buildActivityPool()` exportiert:

```typescript
export function buildActivityPool(
  group: EncounterGroup,
  context: { terrain: { id: string }; timeSegment: string },
  faction?: Faction
): Activity[]
```

Sammelt alle verfuegbaren Activities aus der Culture-Chain **ohne Zufallsauswahl**:

1. **Generic Activities:** `GENERIC_ACTIVITY_IDS`
2. **Culture Activities:** Via `selectCulture()` basierend auf Creature/Species
3. **Faction Activities:** Via `buildFactionChain()` aus `faction.influence.activities`

Im Gegensatz zu `selectActivity()` wird KEINE gewichtete Zufallsauswahl durchgefuehrt - alle Activities werden zurueckgegeben.

**Verwendet von:** [balancing.md](balancing.md#activity-optionen)

---

## Tasks

|  # | Status | Domain    | Layer     | Beschreibung                                                              |  Prio  | MVP? | Deps | Spec                                                                 | Imp.                                       |
|--:|:----:|:--------|:--------|:------------------------------------------------------------------------|:----:|:--:|:---|:-------------------------------------------------------------------|:-----------------------------------------|
|  1 |   ⬜    | encounter | services  | Context-Filter: weather Tags, aquatic/terrain Tags für Activity-Auswahl   | mittel | Nein | -    | encounter/groupActivity.md#kontext-filter                            | groupActivity.ts.selectActivity()          |
|  2 |   ⚠️   | encounter | services  | Goal-Ableitung mit Faction-Mappings                                       | mittel | Nein | b1   | encounter/groupActivity.md#Goal-Beispiele                            | groupActivity.ts.deriveGoal()              |
|  3 |   ✅    | encounter | services  | Activity-Pool über Culture-System auflösen (resolveCultureChain)          | mittel | Nein | -    | encounter/groupActivity.md#Activity-Pool-Hierarchie                  | groupActivity.ts.selectActivity()          |
| 23 |   ✅    | encounter | services  | active/resting Filter basierend auf creature.activeTime                   | mittel | Nein | -    | groupActivity.md#Kontext-Filter                                      | groupActivity.ts.selectActivity()          |
| 24 |   ✅    | encounter | services  | Activity-Pool-Hierarchie (Step 4.1) implementiert                         | mittel | Nein | -    | groupActivity.md#Activity-Definition                                 | groupActivity.ts.selectActivity()          |
| 25 |   ✅    | encounter | services  | CultureData.activities auf string[] umgestellt                            | mittel | Nein | -    | groupActivity.md#Activity-Definition                                 | groupActivity.ts.selectActivity()          |
| 60 |   ✅    | encounter | services  | Disposition-Berechnung mit baseDisposition + Reputation implementieren    | mittel | Nein | #59  | services/encounter/groupActivity.md#Step-4.3:-Disposition-Berechnung | groupActivity.ts.assignActivity() [ändern] |
| 61 |   ✅    | creature  | constants | DISPOSITION_THRESHOLDS und BASE_DISPOSITION_VALUES Konstanten hinzufuegen | mittel | Nein | -    | services/encounter/groupActivity.md#Disposition-Berechnung           | constants/creature.ts [ändern]             |
