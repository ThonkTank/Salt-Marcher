# Encounter-Loot

> **Helper fuer:** Encounter-Service (Step 4.4)
> **Input:** `GroupWithNPCs[]`, `EncounterContext`
> **Output:** `GroupWithLoot[]` (Gruppen mit verteiltem Loot)
> **Aufgerufen von:** [Encounter.md](Encounter.md)
>
> **Delegation:**
> - [lootGenerator](../Loot.md) - Tatsaechliche Item-Generierung
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [Loot.md](../Loot.md) - Budget-System, DefaultLoot, Tag-Loot
> - [creature.md](../../entities/creature.md#defaultloot) - DefaultLoot-Schema

Interface zwischen encounterGenerator und lootGenerator. Berechnet Encounter-Budget, delegiert Generierung an lootGenerator, verteilt Items auf Kreaturen.

---

## Verantwortlichkeiten

| encounterLoot (Step 4.4) | lootGenerator |
|--------------------------|---------------|
| Budget pro NarrativeRole berechnen | Budget-State verwalten |
| Budget-Flags setzen (belastet/nicht) | DefaultLoot wuerfeln |
| Verteilungs-Gewichte berechnen | Tag-basiertes Loot generieren |
| Items auf Kreaturen verteilen | Soft-Cap anwenden |
| | Hoards generieren |

**Kernprinzip:** encounterLoot entscheidet WER Loot bekommt und WIEVIEL Budget. lootGenerator entscheidet WAS generiert wird.

---

## Step 4.4: Loot-Generierung

### Input

```typescript
function generateEncounterLoot(
  groups: GroupWithNPCs[],
  context: {
    terrain: { id: string };
    timeSegment: TimeSegment;
  }
): GroupWithLoot[]
```

### Output

```typescript
interface GroupWithLoot extends GroupWithNPCs {
  loot: {
    items: { id: string; quantity: number }[];
    totalValue: number;
    countsTowardsBudget: boolean;  // Bestimmt ob Party-Budget belastet wird
  };
}
```

---

## Budget-Berechnung nach NarrativeRole

Loot wird fuer das **gesamte Encounter** berechnet, dann auf Gruppen verteilt. Die NarrativeRole bestimmt, ob das Loot das Party-Budget belastet.

| NarrativeRole | Loot generiert? | Belastet Budget? | Begruendung |
|---------------|:---------------:|:----------------:|-------------|
| `threat` | Ja | Ja | Party bekommt Loot nach Kampfsieg |
| `ally` (kaempft mit) | Ja | Nein | NPCs behalten ihr Loot, Party bestiehlt sie nicht |
| `victim` (braucht Hilfe) | Ja | Ja | Opfer gibt Loot als Belohnung an Party |
| `neutral` | Ja | Nein | Keine Interaktion erwartet |

### Ally vs. Victim Unterscheidung

Die Unterscheidung basiert auf der **Gruppenkonstellation**:

| Konstellation | Gruppe | Rolle | Budget |
|---------------|--------|-------|:------:|
| Party + Woelfe vs. Banditen | Woelfe | ally | Nein |
| Party rettet Haendler vor Banditen | Haendler | victim | Ja |
| Party beobachtet Pilger | Pilger | neutral | Nein |

**Heuristik:** `victim`-Gruppen haben typischerweise ein `goal` wie "escape_danger", "seek_help", "surrender".

```typescript
function countsTowardsBudget(role: NarrativeRole, goal: string): boolean {
  if (role === 'threat') return true;
  if (role === 'victim') return true;  // Belohnung fuer Rettung
  // ally und neutral belasten Budget nicht
  return false;
}
```

---

## Verteilungs-Algorithmus

Loot wird auf einzelne Kreaturen verteilt, damit:
1. Kreaturen Items im Kampf verwenden koennen (Heiltrank, Waffe)
2. Balance-System pruefen kann, ob Gegner magische Items nutzen

### Schritt 1: DefaultLoot zur Quelle

DefaultLoot wird immer der Kreatur zugewiesen, die es generiert hat:

```typescript
// Wolf hat defaultLoot: [{ itemId: 'wolf-pelt', chance: 1.0 }]
// → wolf-pelt geht an diesen Wolf
```

### Schritt 2: Rest-Budget gewichtet verteilen

Das Rest-Budget (nach DefaultLoot) wird nach CR × RoleWeight verteilt:

```typescript
const ROLE_WEIGHTS: Record<DesignRole, number> = {
  leader: 3.0,      // 3x Anteil
  solo: 3.0,
  support: 2.0,
  controller: 2.0,
  brute: 1.5,
  artillery: 1.0,
  soldier: 1.0,
  skirmisher: 1.0,
  ambusher: 1.0,
  minion: 0.25,     // Kaum Loot
};

function calculateCreatureWeight(creature: CreatureInstance): number {
  const cr = getCreatureDefinition(creature.definitionId).cr;
  const roleWeight = ROLE_WEIGHTS[creature.role ?? 'soldier'];
  return cr * roleWeight;
}
```

**Beispiel:** 3 Banditen (CR 1/8) + 1 Bandit Captain (CR 2, leader)

| Kreatur | CR | Rolle | Gewicht | Anteil |
|---------|---:|-------|--------:|-------:|
| Bandit 1 | 0.125 | soldier | 0.125 | 2% |
| Bandit 2 | 0.125 | soldier | 0.125 | 2% |
| Bandit 3 | 0.125 | soldier | 0.125 | 2% |
| Captain | 2.0 | leader | 6.0 | 94% |
| **Summe** | | | 6.375 | 100% |

Der Captain bekommt 94% des Rest-Budgets (Gold, Ausruestung), die Banditen fast nichts.

---

## Workflow

```
1. Encounter-Budget berechnen
   encounterBudget = partyBudget.balance × (0.10 + random() × 0.40)

2. Pro Gruppe: Budget-Anteil bestimmen
   groupBudget = encounterBudget × (groupTotalCR / encounterTotalCR)
   countsTowardsBudget = f(narrativeRole, goal)

3. Pro Gruppe: lootGenerator aufrufen
   generatedLoot = lootGenerator.generate(groupBudget, context)

4. Pro Gruppe: Loot auf Kreaturen verteilen
   - DefaultLoot → zur generierenden Kreatur
   - Rest → nach CR × RoleWeight

5. Budget nur fuer belastende Gruppen abziehen
   if (countsTowardsBudget) {
     partyBudget.distributed += generatedLoot.totalValue;
   }
```

---

## Edge Cases

| Situation | Verhalten |
|-----------|-----------|
| Alle Gruppen sind ally/neutral | Kein Budget abgezogen, Loot trotzdem generiert |
| Victim ohne wertvolles Loot | Faction/Creature defaultLoot bestimmt Wert |
| Multi-Threat (beide threat) | Beide Gruppen belasten Budget |
| Kreatur ohne CR (0) | Minimum-Gewicht 0.1 verwenden |

---

## Beispiel: Multi-Group Encounter

**Szenario:** Banditen (threat) ueberfallen Haendler (victim)

```typescript
const groups = [
  {
    creatures: [captain, bandit1, bandit2],
    narrativeRole: 'threat',
    goal: 'rob_travelers'
  },
  {
    creatures: [merchant, guard],
    narrativeRole: 'victim',
    goal: 'escape_danger'
  }
];

// Budget-Berechnung:
// - Banditen: 60% (threat, höherer CR)
// - Händler: 40% (victim, niedriger CR)

// Budget-Belastung:
// - Banditen: Ja (threat)
// - Händler: Ja (victim → Belohnung)

// Ergebnis:
// - Party besiegt Banditen → bekommt Banditen-Loot
// - Party rettet Händler → bekommt Händler-Belohnung
// - Gesamtes Loot-Budget wird abgezogen
```

---

## Delegation an lootGenerator

encounterLoot ruft lootGenerator mit folgenden Parametern auf:

```typescript
// Pro Gruppe
const groupLoot = lootGenerator.generateGroupLoot({
  budget: groupBudget,
  creatures: group.creatures,
  factionId: group.factionId,
  terrain: context.terrain,
  timeSegment: context.timeSegment,
});
```

lootGenerator uebernimmt:
- DefaultLoot pro Creature wuerfeln (Chance-System)
- Tag-basiertes Loot fuer Rest-Budget
- Soft-Cap bei Budget-Schulden
- Hoard-Wahrscheinlichkeit (Boss, Lager)

Details: [Loot.md](../Loot.md#encounter-loot-generierung)

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
