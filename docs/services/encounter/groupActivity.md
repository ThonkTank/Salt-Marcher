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
