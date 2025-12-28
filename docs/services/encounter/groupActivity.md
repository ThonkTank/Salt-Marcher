# Encounter-Activity

> **Helper fuer:** Encounter-Service (Step 4.1, 4.2)
> **Input:** `EncounterGroup`, `EncounterContext`, `Faction?`
> **Output:** `string` (Activity), `string` (Goal)
> **Aufgerufen von:** [Encounter.md](Encounter.md)
>
> **Referenzierte Schemas:**
> - [activity.md](../../entities/activity.md) - Activity-Entity
> - [faction.md](../../entities/faction.md) - Faction mit Culture
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

### Activity-Pool-Hierarchie

Activities werden aus drei Quellen zusammengestellt:

| Ebene | Beispiel-Activities | Quelle |
|-------|---------------------|--------|
| **Generisch** | resting, traveling, foraging | Basis-Pool (alle Kreaturen) |
| **Creature-Typ** | hunting (Wolf), building (Beaver) | `Creature.activities` |
| **Fraktion** | raiding, sacrificing, war_chanting | `Faction.culture.activities` |

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

-> Vollstaendige Liste: [presets/activities/base-activities.json](../../../presets/activities/base-activities.json)

```typescript
function selectActivity(
  group: EncounterGroup,
  context: EncounterContext,
  faction?: ResolvedFaction
): string {
  // 1. Pool zusammenstellen (Hierarchie)
  const pool: WeightedActivity[] = [
    ...GENERIC_ACTIVITIES,
    ...getCreatureTypeActivities(group.creatures),
    ...(faction?.culture.activities ?? [])
  ];

  // 2. Nach Kontext filtern
  const filtered = pool.filter(a =>
    matchesContext(a.contextTags, context)
  );

  // 3. Gewichtete Auswahl
  return weightedRandom(filtered);
}
```

### Kontext-Filter

Activities werden nach Kontext gefiltert:

| Kontext | Filter | Beispiel |
|---------|--------|----------|
| `timeOfDay` | nocturnal activities nur nachts | sleeping (Tag), hunting (Nacht) |
| `terrain` | aquatic activities nur bei Wasser | fishing, swimming |
| `weather` | shelter-seeking bei Sturm | hiding, camping |
| `narrativeRole` | Role-spezifische Activities | fleeing (victim), ambushing (threat) |

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

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
