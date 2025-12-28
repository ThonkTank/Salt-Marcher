# Encounter-Flavour

> **Verantwortlichkeit:** Step 4 der 7-Step-Pipeline - RP-Details, NPCs, Loot, Perception
> **Input:** `EncounterDraft` aus [Population](Population.md)
> **Output:** `FlavouredEncounter` an [Difficulty](Difficulty.md)
>
> **Referenzierte Schemas:**
> - [npc.md](../../data/npc.md) - NPC-Entity
> - [faction.md](../../data/faction.md) - Faction mit Culture
> - [creature.md](../../data/creature.md) - Kreatur mit defaultLoot
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [NPC-Generation.md](../NPCs/NPC-Generation.md) - NPC-Generierung
> - [NPC-Matching.md](../NPCs/NPC-Matching.md) - Existierende NPCs finden
> - [Loot.md](../Loot.md) - Loot-System

RP-Details fuer Encounters: Activities, Goals und NPC-Instanziierung.

**Wichtig:** Flavour kommt VOR Balance. Activity und Perception werden hier berechnet und von Balance als XP-Modifikatoren verwendet.

---

## Workflow-Uebersicht

```
Input: EncounterDraft aus Population.md
       |
       v
+----------------------------------------------------------------------+
| 4.1 ACTIVITY-GENERIERUNG                                              |
| Pro Gruppe: Pool zusammenstellen -> Kontext-Filter -> Auswahl        |
+----------------------------------------------------------------------+
       |
       v
+----------------------------------------------------------------------+
| 4.2 GOAL-ABLEITUNG                                                    |
| Activity + NarrativeRole -> passendes Goal                           |
+----------------------------------------------------------------------+
       |
       v
+----------------------------------------------------------------------+
| 4.3 NPC-INSTANZIIERUNG                                                |
| Lead-NPC (1 pro Gruppe) + Highlight-NPCs (max 3 global)              |
+----------------------------------------------------------------------+
       |
       v
+----------------------------------------------------------------------+
| 4.4 LOOT-GENERIERUNG                                                  |
| Pro Gruppe: Creature.defaultLoot wuerfeln + Items zuweisen           |
+----------------------------------------------------------------------+
       |
       v
+----------------------------------------------------------------------+
| 4.5 PERCEPTION-BERECHNUNG                                             |
| initialDistance = Activity x Terrain x Weather x Gruppen-/Kreatur-Size|
+----------------------------------------------------------------------+
       |
       v
Output: FlavouredEncounter (an Difficulty.md)
```

---

## Step 4.1: Activity-Generierung

**Zweck:** Was macht die Gruppe gerade, wenn die Party sie antrifft?

**Input:** `EncounterGroup`, `EncounterContext`, `Faction?`

**Output:** `string` (Activity-Name)

### Activity-Definition (in Library)

Activities werden in der **Library** als eigenstaendige Entities definiert (Entity-Typ: `activity`). Jede Activity hat zwei Properties:

```typescript
interface Activity {
  id: EntityId<'activity'>;
  name: string;                    // "sleeping", "patrolling", "ambushing"
  awareness: number;               // 0-100, hoch = wachsam, schwer zu ueberraschen
  detectability: number;           // 0-100, hoch = leicht aufzuspueren
  contextTags: string[];           // Fuer Kontext-Filterung (rest, combat, stealth, etc.)
  description?: string;
}
```

**Verwendung:**
- `awareness` → Ueberraschungs-Modifikator (hoch = schwer zu ueberraschen)
- `detectability` → InitialDistance-Modifikator (hoch = Party entdeckt frueher)

→ Schema: [EntityRegistry.md](../../architecture/EntityRegistry.md#activity-activity)
→ Presets: [presets/activities/base-activities.json](../../../presets/activities/base-activities.json)

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

→ Vollstaendige Liste: [presets/activities/base-activities.json](../../../presets/activities/base-activities.json)

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

## Step 4.3: NPC-Instanziierung

**Zweck:** Benannte NPCs fuer das Encounter erstellen.

**Input:** `EncounterGroup`, `EncounterContext`

**Output:** `EncounterLeadNpc` + `HighlightNPC[]`

### Workflow

```
Pro Gruppe:
    │
    ├─► 1. Lead-Kreatur bestimmen
    │   └── selectLeadCreature(group.slots)
    │   └── CR × 10 + designRole-Gewicht → hoechster Score
    │
    ├─► 2. Existierenden NPC suchen
    │   └── → NPC-Matching.md
    │   └── findMatchingNPC(creatureId, factionId, position)
    │
    ├─► 3a. Match gefunden?
    │   └── NPC wiederverwenden, Tracking aktualisieren
    │   └── Return { npcId, isNew: false }
    │
    └─► 3b. Kein Match?
        └── → NPC-Generation.md
        └── generateNPC(creature, faction, options)
        └── Return { npcId, isNew: true }

Global:
    └── Max 3 Highlight-NPCs ueber alle Gruppen
```

### Lead-Kreatur bestimmen

Die Lead-Kreatur wird durch **CR + designRole Gewichtung** bestimmt:

```typescript
function selectLeadCreature(group: EncounterGroup): EncounterCreature {
  // Alle Kreaturen aus allen Slots sammeln
  const allCreatures = Object.values(group.slots).flat();

  return allCreatures.reduce((best, current) => {
    const bestScore = getLeadScore(best);
    const currentScore = getLeadScore(current);
    return currentScore > bestScore ? current : best;
  });
}

function getLeadScore(creature: EncounterCreature): number {
  const def = entityRegistry.get('creature', creature.creatureId);
  const roleWeight = ROLE_WEIGHTS[def.designRole] ?? 0;
  return def.cr * 10 + roleWeight;
}

const ROLE_WEIGHTS: Record<DesignRole, number> = {
  leader: 50, solo: 40, support: 30, controller: 25,
  artillery: 20, soldier: 15, brute: 15, skirmisher: 10,
  ambusher: 10, minion: 0
};
```

**Wichtig:** Die Seed-Kreatur aus Population ist **nicht** automatisch der Lead-NPC.
Der Lead-NPC wird durch Gewichtung bestimmt.

### NPC-Matching und -Erstellung

```typescript
function resolveLeadNPC(
  group: EncounterGroup,
  context: EncounterContext
): EncounterLeadNpc {
  const leadCreature = selectLeadCreature(group);
  const creatureDef = entityRegistry.get('creature', leadCreature.creatureId);

  // Existierenden NPC suchen (→ NPC-Matching.md)
  const existing = findMatchingNPC(
    leadCreature.creatureId,
    group.factionId,
    context.position
  );

  if (existing.isSome()) {
    // NPC wiederverwenden
    const npc = existing.value;
    npc.lastEncounter = context.currentTime;
    npc.encounterCount++;
    npc.lastKnownPosition = context.position;
    entityRegistry.save('npc', npc);
    return { npcId: npc.id, isNew: false };
  }

  // Neuen NPC generieren (→ NPC-Generation.md)
  const faction = group.factionId
    ? entityRegistry.get('faction', group.factionId)
    : null;

  const npc = generateNPC(creatureDef, faction, {
    position: context.position,
    time: context.currentTime
  });

  return { npcId: npc.id, isNew: true };
}
```

> **NPC-Matching:** [NPC-Matching.md](../NPCs/NPC-Matching.md)
> **NPC-Generierung:** [NPC-Generation.md](../NPCs/NPC-Generation.md)

### NPC-Detail-Stufen

| Stufe | Details | Persistierung | Pro Encounter |
|-------|---------|---------------|---------------|
| **Lead-NPC** | Name, 2 Traits, Quirk, Goal | Ja (Vault) | 1 pro Gruppe |
| **Highlight-NPC** | Name, 1 Trait | Nein (Session) | Max 3 global |
| **Anonym** | Kreatur-Typ + Anzahl | Nein | Rest |

### Output-Schema

```typescript
interface EncounterLeadNpc {
  npcId: EntityId<'npc'>;  // Referenz auf persistierten NPC
  isNew: boolean;          // true = neu generiert, false = existierend
}
```

---

## Multi-Group Flavour

Bei Encounters mit mehreren Gruppen wird Flavour **pro Gruppe** generiert:

### Beispiel: Bandit-Ueberfall

```
Gruppe 1: Banditen (5) - threat
├── Lead: Rotbart (paranoid, gierig) - "Boss beeindrucken"
├── Highlight: Narbengesicht (aggressiv)
├── Anonym: Bandit x3
├── Activity: ambushing
└── Goal: rob_travelers

Gruppe 2: Gefangene Kaufleute (2) - victim
├── Lead: Meister Goldwein (aengstlich, hoffnungsvoll) - "Ueberleben"
├── Anonym: Kaufmann x1
├── Activity: cowering
└── Goal: survive

Total: 2 Leads + 1 Highlight = 3 benannte NPCs
```

### Activity-Interaktion

Activities der Gruppen sollten narrativ zusammenpassen:

| Gruppe 1 Activity | Gruppe 2 Role | Passende Gruppe 2 Activity |
|-------------------|---------------|----------------------------|
| ambushing | victim | cowering, fleeing |
| raiding | victim | defending, surrendering |
| hunting | neutral | observing, hiding |
| patrolling | ally | patrolling, resting |

---

## Step 4.4: Loot-Generierung

**Zweck:** Loot fuer das Encounter generieren, bevor Balance die XP-Modifier berechnet.

**Input:** `FlavouredGroup[]`, `EncounterContext`

**Output:** `GeneratedLoot` pro Gruppe

### Warum bei Generierung?

Loot wird bei Encounter-Generierung erstellt (nicht bei Combat-Ende):
1. **Combat-Nutzung:** Gegner koennen Items im Kampf verwenden (Heiltranke, Waffen)
2. **Balance-Modifier:** Loot-Info fuer XP-Modifier in [Difficulty.md](Difficulty.md#loot-xp-modifier)
3. **Preview:** GM sieht potentielles Loot im Encounter-Preview
4. **Budget:** Teure Ausruestung belastet Budget sofort

### Loot-Generierung pro Gruppe

```typescript
function generateGroupLoot(
  group: FlavouredGroup,
  context: EncounterContext
): GeneratedLoot {
  const items: SelectedItem[] = [];

  for (const creature of group.creatures) {
    const creatureDef = entityRegistry.get('creature', creature.creatureId);

    // defaultLoot wuerfeln (Chance-System)
    if (creatureDef.defaultLoot) {
      for (const lootEntry of creatureDef.defaultLoot) {
        if (Math.random() < lootEntry.chance) {
          const item = rollLootEntry(lootEntry);
          items.push(item);

          // Item einer Kreatur zuweisen (fuer Balance-Modifier)
          creature.loot = creature.loot ?? [];
          creature.loot.push(item.itemId);
        }
      }
    }
  }

  return {
    items,
    totalValue: items.reduce((sum, i) => sum + i.value, 0)
  };
}
```

### Orchestrierung: DefaultLoot + Tag-basiertes Loot

Bei der Encounter-Loot-Generierung werden beide Systeme kombiniert:

```
┌─────────────────────────────────────────────────────────────────┐
│  LOOT-GENERIERUNG (Step 4.4)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Encounter-Budget berechnen                                  │
│     encounterBudget = budget.balance × (0.10 + random() × 0.40) │
│                                                                 │
│  2. DefaultLoot pro Creature generieren                         │
│     ├── Fuer jede Creature: defaultLoot-Eintraege durchlaufen  │
│     ├── Chance-Roll: Math.random() < entry.chance               │
│     ├── Soft-Cap pruefen: Bei Schulden teures Item weglassen   │
│     ├── Item der Creature.loot zuweisen                         │
│     └── defaultLootValue akkumulieren                          │
│                                                                 │
│  3. Rest-Budget fuer Tag-Loot berechnen                         │
│     restBudget = encounterBudget - defaultLootValue             │
│     (kann 0 oder negativ sein → kein Tag-Loot)                 │
│                                                                 │
│  4. Tag-basiertes Loot fuer Rest-Budget generieren              │
│     ├── Nur wenn restBudget > 0                                 │
│     ├── lootTags aus Seed-Creature oder Faction                │
│     └── generateLoot(restBudget, lootTags, availableItems)     │
│                                                                 │
│  5. Ergebnisse kombinieren                                      │
│     GeneratedLoot = defaultLoot.items + tagLoot.items          │
│     totalValue = defaultLootValue + tagLootValue               │
│                                                                 │
│  6. Budget belasten                                             │
│     budget.distributed += totalValue                            │
│     budget.balance -= totalValue                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Reihenfolge und Prioritaet

| Schritt | System | Prioritaet | Budget-Verhalten |
|---------|--------|-----------|------------------|

**Begruendung:**
- DefaultLoot ist **thematisch essentiell** (Wolf hat Pelz, Ritter hat Schwert)
- Tag-Loot ist **Budget-Auffueller** (generische Items passend zu Creature-Tags)

### Code: generateEncounterLoot()

```typescript
function generateEncounterLoot(
  encounter: FlavouredEncounter,
  budget: LootBudgetState,
  availableItems: Item[]
): GeneratedLoot {
  // 1. Encounter-Budget berechnen (10-50% vom Balance)
  const encounterPercent = 0.10 + Math.random() * 0.40;
  const encounterBudget = Math.max(0, budget.balance * encounterPercent);

  const allItems: SelectedItem[] = [];
  let totalValue = 0;

  // 2. DefaultLoot pro Gruppe/Creature
  for (const group of encounter.groups) {
    for (const creature of group.creatures) {
      const creatureDef = getCreatureDefinition(creature.creatureId);
      const defaultLoot = processDefaultLoot(creatureDef, budget);

      // Items der Creature zuweisen (fuer Combat-Nutzung)
      creature.loot = defaultLoot.items.map(item => item.id);

      allItems.push(...defaultLoot.items.map(item => ({ item, quantity: 1 })));
      totalValue += defaultLoot.totalValue;
    }
  }

  // 3. Rest-Budget berechnen
  const restBudget = encounterBudget - totalValue;

  // 4. Tag-basiertes Loot fuer Rest-Budget
  if (restBudget > 0) {
    const seedCreature = getCreatureDefinition(encounter.seedCreature.id);
    const lootTags = seedCreature.lootTags ?? ['currency'];

    const tagLoot = generateLoot(
      { totalXP: encounter.totalXP },  // Fuer Wealth-Multiplikator
      lootTags,
      availableItems.filter(item => item.value <= restBudget)
    );

    allItems.push(...tagLoot.items);
    totalValue += tagLoot.totalValue;
  }

  // 5. Budget belasten
  budget.distributed += totalValue;
  budget.balance -= totalValue;

  return { items: allItems, totalValue };
}
```

→ **DefaultLoot-Logik:** [Loot.md#creature-default-loot](../Loot.md#creature-default-loot)
→ **Tag-Matching-Algorithmus:** [Loot.md#generierung](../Loot.md#generierung)

### Edge Cases

| Situation | Verhalten |
|-----------|-----------|
| **DefaultLoot > encounterBudget** | Schulden entstehen, kein Tag-Loot |
| **DefaultLoot = encounterBudget** | Kein Tag-Loot (restBudget = 0) |
| **Keine lootTags** | Fallback auf `['currency']` → nur Gold |
| **Keine passenden Items** | Gold als Auffueller (Task #720) |
| **balance < 0 (Schulden)** | encounterBudget = 0 → nur DefaultLoot mit Soft-Cap |

### Loot-Zuweisung an Kreaturen

Items werden **spezifischen Kreaturen zugewiesen** (nicht global), damit Balance pruefen kann ob Gegner magische Items verwenden koennen:

| Kreatur-Eigenschaft | Item-Typ | Verwendbar? |
|---------------------|----------|-------------|
| Humanoid mit Haenden | Waffe, Zauberstab | Ja |
| Beast ohne Haende | Waffe | Nein |
| Caster mit Spellcasting | Zauberstab, Schriftrolle | Ja |
| Creature ohne Spellcasting | Schriftrolle | Nein |

### Hoard-Wahrscheinlichkeit

Bestimmte Encounter-Typen koennen Hoards enthalten:

| Encounter-Typ | Hoard-Wahrscheinlichkeit |
|---------------|:------------------------:|
| Boss-Combat | 70% |
| Lager/Camp | 40% |
| Normale Patrouille | 10% |
| Passing/Trace | 0% |

Hoards werden bei Generierung erstellt, aber erst nach Combat-Sieg zugaenglich.

### Multi-Gruppen-Loot

Bei Multi-Gruppen-Encounters wird Loot **pro Gruppe separat** generiert:

```typescript
function generateMultiGroupLoot(encounter: MultiGroupEncounter): void {
  for (const group of encounter.groups) {
    group.lootPool = generateLootForGroup(
      group.creatures,
      group.budgetShare * encounter.totalLootBudget
    );
  }
}
```

**Typischer Loot pro Gruppe:**

| Gruppe | Typischer Loot |
|--------|----------------|
| Banditen | Waffen, Gold, gestohlene Waren |
| Haendler | Handelswaren, Muenzen, Vertraege |
| Woelfe | Pelze, Knochen (Crafting) |
| Soldaten | Militaerausruestung, Befehle |

**GM-Kontrolle:** Der GM entscheidet, welchen Loot die Party erhaelt (abhaengig vom Encounter-Ausgang):
- Party besiegt Banditen -> Banditen-Loot
- Party rettet Haendler -> Haendler schenken Waren
- Party ignoriert Konflikt -> Kein Loot

### Quest-Encounter Budget

Wenn ein Encounter Teil einer Quest mit definiertem Reward ist, wird Encounter-Loot reduziert:

| Encounter-Typ | Budget-Anteil |
|---------------|---------------|
| Random (ohne Quest) | 10-50% (Durchschnitt 20%) |
| Quest-Encounter (mit Reward) | Reduziert um Quest-Anteil |
| Quest-Encounter (ohne Reward) | 10-50% (Durchschnitt 20%) |

### Schema-Erweiterung

```typescript
interface EncounterCreature {
  creatureId: EntityId<'creature'>;
  npcId?: EntityId<'npc'>;
  count: number;
  role?: 'leader' | 'guard' | 'scout' | 'civilian';
  loot?: EntityId<'item'>[];  // Zugewiesene Items (fuer Balance-Modifier + Combat-Nutzung)
}
```

-> Budget-System, Tags, GM-Interface: [Loot.md](../Loot.md)

---

## Step 4.5: Perception-Berechnung

**Zweck:** In welcher Entfernung nimmt die Party das Encounter wahr?

**Input:** `FlavouredGroup[]`, `EncounterContext`, `PartyState`

**Output:** `EncounterPerception` (inkl. `initialDistance`)

Die `initialDistance` bestimmt, in welcher Entfernung die Party die Encounter-Gruppe wahrnimmt. Die Berechnung basiert auf **Umgebungsfaktoren** (Terrain, Weather, Activity, Gruppen-/Kreatur-Groesse).

**Hinweis:** Sweet-Spot und Pain-Point (optimale Kampfdistanzen) werden in [Difficulty.md#sweet-spot-pain-point](Difficulty.md#sweet-spot-pain-point) berechnet und fuer Positioning verwendet.

### Faktoren-Uebersicht

| Faktor | Einfluss | Beispiel |
|--------|----------|----------|
| **Activity** | Lautstaerke/Auffaelligkeit | sleeping=nah, patrolling=weit |
| **Terrain** | Sichtweite als Obergrenze | Wald=kurz, Ebene=weit |
| **Weather** | Reduktion bei schlechter Sicht | Nebel, Regen reduzieren |
| **Gruppen-Groesse** | Grosse Gruppen sind weiter sichtbar | 100+ Kreaturen = x10 |
| **Kreatur-Groesse** | Riesige Kreaturen sind weiter sichtbar | Gargantuan = x3 |

### Bidirektionale Wahrnehmung berechnen

Die Wahrnehmungs-Berechnung verwendet zwei getrennte Wuerfe, die bestimmen bei **welcher Distanz** sich die beiden Seiten gegenseitig bemerken:

1. **Perception-Check** (Encounter → Party): Bestimmt `encounterAwareDistance`
2. **Stealth-Check** (Encounter versteckt sich): Bestimmt `partyAwareDistance`

**Wer zuerst?** Hoehere Distanz = fruehere Wahrnehmung.

#### maxDistance berechnen

Zuerst wird die maximale Sichtdistanz aus Umgebungsfaktoren berechnet:

```typescript
function calculateDistanceModifier(
  group: FlavouredGroup,
  context: EncounterContext
): DistanceModifier {
  // === Terrain-Visibility (Basis) ===
  // Ebene: 8000ft, Wald: 150ft, Berg: 10000ft
  const terrainVisibility = context.tile.terrain.encounterVisibility ?? 120;

  // === Weather-Modifier ===
  // Klar: 1.0, Leichter Regen: 0.85, Starker Regen: 0.6, Nebel: 0.4, Blizzard: 0.2
  const weatherMod = getWeatherVisibilityModifier(context.weather);

  // === Gruppen-Groessen-Modifier ===
  // 1-5: x1.0, 6-20: x2.0, 21-100: x5.0, 100+: x10.0
  const groupMod = getGroupSizeModifier(getTotalCreatureCount(group));

  // === Kreatur-Groessen-Modifier ===
  // Tiny-Medium: x1.0, Large: x1.5, Huge: x2.0, Gargantuan: x3.0
  const sizeMod = getCreatureSizeModifier(getLargestCreatureSize(group));

  // === Sichtbare Signaturen ===
  // Staubwolke: +50%, Rauchsaeule: +100%, Banner: +25%
  const signatureMod = calculateSignatureBonus(group, context);

  // === Maximale Sichtdistanz ===
  // Alle Modifier multipliziert, Weather reduziert, Rest erhoeht
  const maxDistance = terrainVisibility * weatherMod * groupMod * sizeMod * signatureMod;

  return { weatherMod, maxDistance, groupMod, sizeMod, signatureMod };
}

interface DistanceModifier {
  weatherMod: number;
  maxDistance: number;
  groupMod: number;
  sizeMod: number;
  signatureMod: number;
}
```

#### Perception-Distanzen berechnen

```typescript
function calculatePerceptionDistances(
  group: FlavouredGroup,
  context: EncounterContext,
  partyState: PartyState,
  activity: Activity
): PerceptionResult {
  // 1. Maximale Sichtdistanz berechnen
  const distanceModifier = calculateDistanceModifier(group, context);

  // 2. Perception-Check fuer encounterAwareDistance
  //    Encounter versucht, Party wahrzunehmen
  const bestPPBonus = Math.max(...group.creatures.map(c => c.passivePerception - 10));
  const perceptionRoll = d20() + bestPPBonus;

  // Activity-Modifier: awareness 0-100 = % des Endergebnisses
  const effectivePerception = perceptionRoll * (activity.awareness / 100);
  const perceptionExcess = effectivePerception - partyState.passiveStealth;

  // 3. Stealth-Check fuer partyAwareDistance
  //    Encounter versucht, sich zu verstecken
  const bestStealthBonus = Math.max(...group.creatures.map(c => c.stealthBonus ?? 0));
  const stealthRoll = d20() + bestStealthBonus;

  // Activity-Modifier: detectability invertiert = % des Endergebnisses
  const effectiveStealth = stealthRoll * ((100 - activity.detectability) / 100);
  const stealthExcess = effectiveStealth - partyState.bestPassivePerception;

  // 4. Ueberschuss als Prozent der maxDistance
  const SCALING_FACTOR = 10;  // 10 Punkte Ueberschuss = 100% maxDistance

  const encounterAwareDistance = perceptionExcess > 0
    ? distanceModifier.maxDistance * Math.min(perceptionExcess / SCALING_FACTOR, 1)
    : 0;

  const partyAwareDistance = stealthExcess > 0
    ? distanceModifier.maxDistance * Math.max(1 - (stealthExcess / SCALING_FACTOR), 0.05)
    : distanceModifier.maxDistance;  // Stealth gescheitert → volle Distanz

  return {
    encounterAwareDistance: roundTo5ft(encounterAwareDistance),
    partyAwareDistance: roundTo5ft(partyAwareDistance),
    encounterAware: encounterAwareDistance > 0,
    partyAware: true  // Party sieht immer (bei irgendeiner Distanz)
  };
}

function roundTo5ft(distance: number): number {
  return Math.round(distance / 5) * 5;
}
```

#### Formel-Zusammenfassung

| Property | Formel | Effekt auf Distanz |
|----------|:------:|-------------------|
| `awareness` | result × (awareness/100) | Hoeher → Encounter sieht Party frueher (groessere Distanz) |
| `detectability` | result × ((100-detect)/100) | Hoeher → Party sieht Encounter frueher (groessere Distanz) |

**Scaling:** 10 Punkte Ueberschuss entspricht 100% der maxDistance.

### Berechnungs-Beispiele (Bidirektionale Wahrnehmung)

#### Wald-Ambush (visibility 150ft, klar)

**Setup:**
- Terrain: Wald (visibility 150ft), Weather: Klar (1.0)
- Encounter: 5 Goblins (groupMod 1.0), Medium (sizeMod 1.0), keine Signatur
- **maxDistance** = 150 × 1.0 × 1.0 × 1.0 = **150ft**

**Ambush (awareness=95, detectability=10):**
- Party PS: 12, Party PP: 14
- Encounter: PP 12 (+2), Stealth +4
- **Perception**: (d20+2) × 0.95 = 15 × 0.95 = 14.25. Excess: 2.25 → 22.5ft
- **Stealth**: (d20+4) × 0.9 = 18 × 0.9 = 16.2. Excess: 2.2 → 150 - 33ft = 117ft
- **Ergebnis**: `encounterAwareDistance: 25ft`, `partyAwareDistance: 115ft`
- **Interpretation**: Party sieht nichts bis 115ft, Encounter wartet bis 25ft → **Ambush!**

#### Ebene-Raid mit Rauchsaeule (visibility 8000ft, klar)

**Setup:**
- Terrain: Ebene (visibility 8000ft), Weather: Klar (1.0)
- Encounter: 50 Orcs (groupMod 5.0), Medium, Rauchsaeule (+100%)
- **maxDistance** = 8000 × 1.0 × 5.0 × 1.0 × 2.0 = **80,000ft (~15 Meilen)**

**Raiding (awareness=60, detectability=90):**
- Encounter: PP 10 (+0), Stealth +2
- **Perception**: (d20+0) × 0.6 = 12 × 0.6 = 7.2. Excess: -4.8 → **0ft**
- **Stealth**: (d20+2) × 0.1 = 15 × 0.1 = 1.5. Excess: -12.5 → **maxDistance**
- **Ergebnis**: `encounterAwareDistance: 0ft`, `partyAwareDistance: 80,000ft`
- **Interpretation**: Party sieht Rauch von 15 Meilen, Orcs bemerken nichts

#### Nebel-Encounter (visibility 150ft, Nebel 0.4)

**Setup:**
- Terrain: Wald (visibility 150ft), Weather: Nebel (0.4)
- Encounter: 3 Woelfe (groupMod 1.0), Medium, keine Signatur
- **maxDistance** = 150 × 0.4 × 1.0 × 1.0 = **60ft**

**Hunting (awareness=90, detectability=30):**
- Encounter: PP 13 (+3), Stealth +4
- **Perception**: (d20+3) × 0.9 = 17 × 0.9 = 15.3. Excess: 3.3 → 33ft
- **Stealth**: (d20+4) × 0.7 = 18 × 0.7 = 12.6. Excess: -1.4 → **maxDistance**
- **Ergebnis**: `encounterAwareDistance: 35ft`, `partyAwareDistance: 60ft`
- **Interpretation**: Party sieht Woelfe bei 60ft, Woelfe bemerken Party bei 35ft → **Beide aware, Party zuerst**

### Activity-Effekte auf Wahrnehmung

| Activity | Awareness | Detectability | encounterAwareDistance | partyAwareDistance |
|----------|:---------:|:-------------:|:----------------------:|:------------------:|
| sleeping | 10 | 20 | Sehr kurz (10% Perception) | Kurz (80% Stealth) |
| ambushing | 95 | 10 | Sehr lang (95% Perception) | Sehr kurz (90% Stealth) |
| patrolling | 80 | 60 | Lang (80% Perception) | Moderat (40% Stealth) |
| raiding | 60 | 90 | Moderat (60% Perception) | Sehr lang (10% Stealth) |
| war_chanting | 45 | 100 | Kurz (45% Perception) | Maximum (0% Stealth) |

### Terrain-Visibility

Terrain-Sichtweite wird aus `terrain.encounterVisibility` gelesen.

→ **Source of Truth:** [terrain-definition.md#default-presets](../../data/terrain-definition.md#default-presets)

| Terrain | Visibility | Begruendung |
|---------|:----------:|-------------|
| Ebene | 8000 ft (~1.5 mi) | Freie Sicht bis zum Horizont |
| Wald | 150 ft | Dichtes Blattwerk und Staemme |
| Berg | 10000 ft (~2 mi) | Erhoeht, weite Sicht |

### Gruppen-Groessen-Modifier

| Anzahl | Modifier | Beispiel |
|:------:|:--------:|----------|
| 1-5 | x1.0 | Kleine Patrouille |
| 6-20 | x2.0 | Groessere Gruppe |
| 21-100 | x5.0 | Trupp, Karawane |
| 100+ | x10.0 | Armee, grosse Horde |

### Kreatur-Groessen-Modifier

| Size | Modifier |
|------|:--------:|
| Tiny-Medium | x1.0 |
| Large | x1.5 |
| Huge | x2.0 |
| Gargantuan | x3.0 |

### Sichtbare Signaturen

| Signatur | Bonus | Ausloeser |
|----------|:-----:|-----------|
| Staubwolke | +50% | Grosse Gruppen auf trockenem Terrain |
| Rauchsaeule | +100% | Lager mit Feuer |
| Banner/Flaggen | +25% | Militaerische Gruppen |

### Weather-Modifier

| Wetter | Modifier |
|--------|:--------:|
| Klar | 1.0 |
| Leichter Regen | 0.85 |
| Starker Regen | 0.6 |
| Nebel | 0.4 |
| Blizzard | 0.2 |

### EncounterPerception Schema

```typescript
interface EncounterPerception {
  detectionMethod: 'visual' | 'auditory' | 'olfactory' | 'tremorsense' | 'magical';

  // Bidirektionale Wahrnehmungs-Distanzen
  encounterAwareDistance: number;       // Distanz, bei der Encounter die Party sieht (0 = nie)
  partyAwareDistance: number;           // Distanz, bei der Party das Encounter sieht
  initialDistance: number;              // = max(encounterAwareDistance, partyAwareDistance)

  // Abgeleitete Flags (fuer Kompatibilitaet)
  partyAware: boolean;                  // = partyAwareDistance > 0 (immer true)
  encounterAware: boolean;              // = encounterAwareDistance > 0

  creaturePassivePerceptions: number[];

  // Wuerfel-Ergebnisse (fuer Debug/Transparenz)
  rolls?: {
    perceptionRoll: number;             // d20 + PP-Bonus
    stealthRoll: number;                // d20 + Stealth-Bonus
    effectivePerception: number;        // perceptionRoll × (awareness/100)
    effectiveStealth: number;           // stealthRoll × ((100-detectability)/100)
  };

  modifiers?: {
    noiseBonus?: number;
    scentBonus?: number;
    stealthPenalty?: number;
  };
}
```

**Ergebnis:** Die berechnete Perception wird im FlavouredEncounter gespeichert und von Difficulty fuer den Distance-Modifier verwendet.

**Interpretation:** Wer die hoehere Distanz hat, nimmt den anderen zuerst wahr. Bei `encounterAwareDistance > partyAwareDistance` wird die Party ueberrascht.

### Perception-Aggregation (Multi-Group) {#perception-aggregation}

Bei Multi-Group-Encounters wird die **maximale Distanz** aller Gruppen verwendet:

```typescript
function aggregateEncounterDistance(groups: FlavouredGroup[]): number {
  // Lauteste/auffaelligste Gruppe bestimmt die Encounter-Distanz
  return Math.max(...groups.map(g => g.perception.initialDistance));
}
```

**Beispiel:** Banditen (laut, 200ft) + Gefangene (leise, 50ft) → Encounter startet bei 200ft, alle Gruppen werden sichtbar.

Das aggregierte Ergebnis wird im `FlavouredEncounter.encounterDistance` Feld gespeichert.

---

## Output: FlavouredEncounter

Das Ergebnis des Flavour-Workflows:

```typescript
interface FlavouredEncounter extends EncounterDraft {
  // Pro Gruppe
  groups: FlavouredGroup[];

  // Global
  totalHighlightNPCs: number;  // Max 3
  encounterDistance: number;   // Aggregiert aus max(groups.perception.initialDistance)
}

interface FlavouredGroup extends EncounterGroup {
  // Flavour-Felder
  activity: string;
  goal: string;
  leadNpc: EncounterLeadNpc;
  highlightNpcs?: HighlightNPC[];
  loot: GeneratedLoot;           // In Step 4.4 generiert
  perception: EncounterPerception;  // In Step 4.5 berechnet
}

interface EncounterLeadNpc {
  npcId: EntityId<'npc'>;
  isNew: boolean;  // True = neu generiert, False = existierend
}
```

**Naechster Schritt:** Difficulty.md empfaengt das FlavouredEncounter und:
1. Berechnet Disposition (aus Faction/Creature-Range)
2. Wuerfelt Ziel-Difficulty (mit Terrain-Threat-Modifier)
3. Berechnet effektive XP mittels Modifikatoren (Distance, Activity, Disposition, Environment)
4. Passt Encounter an Ziel-Difficulty an

-> Weiter: [Difficulty.md](Difficulty.md)

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
