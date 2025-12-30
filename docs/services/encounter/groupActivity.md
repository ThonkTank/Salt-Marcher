# Encounter-Activity

> **Helper fuer:** Encounter-Service (Step 4.1, 4.2, 4.3)
> **Input:** `EncounterGroup`, `EncounterContext`, `Faction?`, `NPC?`
> **Output:** `string` (Activity), `string` (Goal), `Disposition`
> **Aufgerufen von:** [Encounter.md](Encounter.md)
>
> **Referenzierte Schemas:**
> - [activity.md](../../entities/activity.md) - Activity-Entity
> - [faction.md](../../entities/faction.md) - Faction mit Culture und Reputations
> - [npc.md](../../entities/npc.md) - NPC mit Reputations
> - [creature.md](../../entities/creature.md) - CreatureDefinition mit baseDisposition
> - [types.md#ReputationEntry](../../architecture/types.md#reputationentry) - Reputation-Schema
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [encounterDistance.md](encounterDistance.md) - Perception-Berechnung (Step 4.5)
> - [Encounter.md#groupnpcs](Encounter.md#groupnpcs-step-43) - NPC-Instanziierung (Step 4.3)
> - [Encounter.md#grouploot](Encounter.md#grouploot-step-44) - Loot-Generierung (Step 4.4)

RP-Details fuer Encounters: Activities und Goals.

**Wichtig:** Activity und Goal werden VOR Balance berechnet. Activity-Werte (`awareness`, `detectability`) werden von [encounterDistance.md](encounterDistance.md) fuer die Perception-Berechnung verwendet.

---

## Step 4.1: Activity-Generierung

**Zweck:** Was macht die Gruppe gerade, wenn die Party sie antrifft?

**Input:** `EncounterGroup`, `EncounterContext`, `Faction?`

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
  group: EncounterGroup,
  context: EncounterContext,
  faction?: Faction
): Activity {
  const activityIds = new Set<string>();

  // 1. Generic (immer)
  GENERIC_ACTIVITY_IDS.forEach(id => activityIds.add(id));

  // 2. Creature-spezifisch
  const creatures = getAllCreatures(group);
  for (const creature of creatures) {
    const def = vault.getEntity<CreatureDefinition>('creature', creature.creatureId);
    if (def?.activities) {
      def.activities.forEach(id => activityIds.add(id));
    }
  }

  // 3. Faction-spezifisch (string[])
  if (faction?.culture?.activities) {
    faction.culture.activities.forEach(id => activityIds.add(id));
  }

  // 4. IDs zu Activities aufloesen
  const pool = [...activityIds]
    .map(id => ACTIVITY_DEFINITIONS[id])
    .filter((a): a is Activity => a !== undefined);

  // 5. Nach Kontext filtern (active/resting basierend auf creature.activeTime)
  const filtered = pool.filter(a => matchesContext(a.contextTags, context));

  // 6. Gleichverteilte Zufallsauswahl (keine Gewichtung)
  return randomSelect(filtered.length > 0 ? filtered : pool);
}
```

### Kontext-Filter

Activities werden nach Kontext gefiltert basierend auf `contextTags`:

| Tag | Filter | Beschreibung |
|-----|--------|--------------|
| `active` | timeSegment ∈ creature.activeTime | Nur wenn Kreatur zur aktuellen Tageszeit aktiv ist |
| `resting` | timeSegment ∉ creature.activeTime | Nur wenn Kreatur zur aktuellen Tageszeit ruht |
| `movement` | - | Bewegungs-Aktivitaeten (traveling, patrol) |
| `stealth` | - | Versteckte Aktivitaeten (ambush, hiding) |
| `aquatic` | Wasser-Terrain | Nur bei Wasser-Terrain (TODO) |

**Wichtig:** Activities mit BEIDEN Tags (`active` + `resting`) sind immer anwendbar (z.B. `feeding`, `wandering`).

### Activity-Beispiele

| Kreatur | Activities |
|---------|------------|
| Wolf | sleeping, hunting, playing, howling |
| Goblin | patrolling, raiding, resting, arguing |
| Bandit | ambushing, camping, scouting, drinking |
| Guard | patrolling, resting, training, gambling |
| Merchant | traveling, trading, resting, haggling |

---

## Step 4.2: Goal-Ableitung (Gruppen-Goal)

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

## Step 4.3: Disposition-Berechnung

**Zweck:** Wie steht die Gruppe zur Party?

**Input:** `EncounterGroup`, `NPC?`, `Faction?`

**Output:** `Disposition` ('hostile' | 'neutral' | 'friendly')

### Disposition-Formel

Die effektive Disposition wird aus Base-Disposition plus Reputation berechnet:

```
effectiveDisposition = clamp(baseDisposition + reputation, -100, +100)
```

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
  baseDisposition: number,
  reputation: number
): Disposition {
  const effective = Math.max(-100, Math.min(100, baseDisposition + reputation));

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

## Tasks

|  # | Status | Domain    | Layer     | Beschreibung                                                              |  Prio  | MVP? | Deps | Spec                                                                 | Imp.                                       |
|--:|:----:|:--------|:--------|:------------------------------------------------------------------------|:----:|:--:|:---|:-------------------------------------------------------------------|:-----------------------------------------|
|  1 |   ⬜    | encounter | services  | Context-Filter: weather Tags, aquatic/terrain Tags für Activity-Auswahl   | mittel | Nein | -    | encounter/groupActivity.md#kontext-filter                            | groupActivity.ts.selectActivity()          |
|  2 |   ⚠️   | encounter | services  | Goal-Ableitung mit Faction-Mappings                                       | mittel | Nein | b1   | encounter/groupActivity.md#Goal-Beispiele                            | groupActivity.ts.deriveGoal()              |
|  3 |   ✅    | encounter | services  | Activity-Pool über Culture-System auflösen (resolveCultureChain)          | mittel | Nein | -    | encounter/groupActivity.md#Activity-Pool-Hierarchie                  | groupActivity.ts.selectActivity()          |
| 23 |   ✅    | encounter | services  | active/resting Filter basierend auf creature.activeTime                   | mittel | Nein | -    | groupActivity.md#Kontext-Filter                                      | groupActivity.ts.selectActivity()          |
| 24 |   ✅    | encounter | services  | Activity-Pool-Hierarchie (Step 4.1) implementiert                         | mittel | Nein | -    | groupActivity.md#Activity-Definition                                 | groupActivity.ts.selectActivity()          |
| 25 |   ✅    | encounter | services  | CultureData.activities auf string[] umgestellt                            | mittel | Nein | -    | groupActivity.md#Activity-Definition                                 | groupActivity.ts.selectActivity()          |
| 60 |   ⬜    | encounter | services  | Disposition-Berechnung mit baseDisposition + Reputation implementieren    | mittel | Nein | #59  | services/encounter/groupActivity.md#Step-4.3:-Disposition-Berechnung | groupActivity.ts.assignActivity() [ändern] |
| 61 |   ⬜    | creature  | constants | DISPOSITION_THRESHOLDS und BASE_DISPOSITION_VALUES Konstanten hinzufuegen | mittel | Nein | -    | services/encounter/groupActivity.md#Disposition-Berechnung           | constants/creature.ts [ändern]             |
