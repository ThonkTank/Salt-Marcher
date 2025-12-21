# Encounter-System

> **Lies auch:** [Encounter-Balancing](Encounter-Balancing.md), [NPC-System](../domain/NPC-System.md), [Creature](../domain/Creature.md)
> **Wird benoetigt von:** Travel, Quest, Combat

Unified Entry-Point fuer Encounter-Generierung, Typen und Ablauf.

**Design-Philosophie:** Die Spielwelt existiert unabhaengig von der Party. Kreaturen werden basierend auf Tile-Eligibility ausgewaehlt, der Encounter-Typ ergibt sich aus der Beziehung zur Party. CR-Balancing gilt nur fuer Combat.

---

## Encounter-Typen

| Typ | Beschreibung | CR-relevant? | Beispiel |
|-----|--------------|--------------|----------|
| `combat` | Kampfbegegnung mit Kreaturen | **Ja** | Goblin-Hinterhalt |
| `social` | Interaktion mit NPCs | Nein | Reisender Haendler |
| `passing` | Etwas passiert in der Naehe | Nein | Drache fliegt am Horizont |
| `trace` | Hinweise auf vergangene Ereignisse | Nein | Verlassenes Lager |
| `environmental` | Umwelt-Herausforderung (post-MVP) | Nein | Steinschlag |
| `location` | Entdeckung eines Ortes (post-MVP) | Nein | Hoehleneingang |

---

## 5-Step Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Tile-Eligibility (Filter)                                   │
│     Terrain + Tageszeit → Welche Kreaturen KOENNEN erscheinen?  │
├─────────────────────────────────────────────────────────────────┤
│  2. Kreatur-Auswahl (Gewichtung)                                │
│     Fraktion + Raritaet + Wetter → Gewichtete Zufallsauswahl    │
│     KEIN CR-Filter - die Welt ist Party-Level-agnostisch        │
├─────────────────────────────────────────────────────────────────┤
│  3. Typ-Ableitung (Deterministisch)                             │
│     Disposition + Faction-Relation + CR-Balancing → Typ         │
├─────────────────────────────────────────────────────────────────┤
│  4. Variety-Validation (Separater Schritt)                      │
│     Bei Monotonie: dynamische Typ-Anpassung                     │
├─────────────────────────────────────────────────────────────────┤
│  5. Encounter-Befuellung                                        │
│     Typ-spezifische Details, Anzahlen, NPC-Instanziierung       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tile-Eligibility

### Filter (Hard Requirements)

Kreaturen werden **ausgeschlossen** wenn:

| Filter | Pruefung |
|--------|----------|
| **Terrain** | `Kreatur.terrainAffinities` enthaelt aktuelles Terrain? |
| **Tageszeit** | `Kreatur.activeTime` enthaelt aktuelle Tageszeit? |

Ein Fisch kann nicht im Berg erscheinen. Ein nachtaktiver Vampir erscheint nicht mittags.

### Gewichtung (Soft Factors)

Verbleibende Kreaturen erhalten Gewichtungen:

| Faktor | Gewichtung |
|--------|------------|
| **Fraktionspraesenz** | Fraktion kontrolliert Tile? → ×2.0 bis ×5.0 |
| **Raritaet** | common: ×1.0, uncommon: ×0.3, rare: ×0.05 |
| **Wetter** | `Kreatur.preferredWeather` matched? → ×1.5 |

Kreaturen mit Gesamt-Gewicht unter der Minimum-Schwelle werden ausgeschlossen.

### Pfad-basierte Creature-Pools (Post-MVP)

Pfade (Strassen, Fluesse, etc.) koennen zusaetzliche Kreaturen zum Eligibility-Pool hinzufuegen:

```typescript
function getEligibleCreatures(tile: OverworldTile): WeightedCreature[] {
  // 1. Terrain-basierte Kreaturen
  const terrain = getTerrain(tile.terrain);
  let creatures = terrain.nativeCreatures.map(toWeighted);

  // 2. Pfad-basierte Kreaturen (Post-MVP)
  for (const pathInfo of tile.paths) {
    const path = getPath(pathInfo.pathId);
    if (path.encounterModifier?.creaturePool) {
      const pathCreatures = path.encounterModifier.creaturePool.map(toWeighted);
      creatures.push(...pathCreatures);
    }
  }

  // 3. Filter + Gewichtung wie gehabt
  return applyFiltersAndWeights(creatures);
}
```

**Beispiele:**
- Strasse: +Banditen, +Haendler → mehr Social-Encounters
- Fluss: +Wasserkreaturen, +Flussnymphen
- Schlucht: +Hoehlenkreaturen

> Details: [Path.md](../domain/Path.md)

### Kein CR-Filter

**Wichtig:** CR beeinflusst die Kreatur-Auswahl NICHT. Die Welt existiert unabhaengig von der Party. Ein Drache in der Gegend kann erscheinen - das CR bestimmt nur den Encounter-Typ (passing statt combat wenn nicht gewinnbar).

---

## Kreatur-Auswahl

Reine Zufallsauswahl basierend auf Tile-Wahrscheinlichkeiten:

```typescript
function selectEncounterCreature(tileCreatures: WeightedCreature[]): Creature {
  // Gewichtete Zufallsauswahl basierend auf Tile-Eligibility
  // CR spielt hier KEINE Rolle
  return weightedRandomSelect(tileCreatures).creature;
}
```

---

## Typ-Ableitung

Der Encounter-Typ wird **deterministisch** aus drei Faktoren abgeleitet:

| Faktor | Beschreibung | Einfluss |
|--------|--------------|----------|
| **Kreatur-Disposition** | `hostile`, `neutral`, `friendly` am Statblock | Basis-Gewichtung |
| **Faction-Relation** | Beziehung der Kreatur-Fraktion zur Party | Modifikator |
| **CR-Balancing** | Kann die Party diesen Kampf gewinnen? | Sicherheitsventil |

### Wahrscheinlichkeits-Matrix

| Disposition | Faction | Winnable | → combat | → social | → passing | → trace |
|-------------|---------|----------|----------|----------|-----------|---------|
| hostile | hostile | ja | 80% | 5% | 10% | 5% |
| hostile | hostile | nein | 5% | 5% | 70% | 20% |
| hostile | neutral | ja | 60% | 10% | 20% | 10% |
| neutral | any | - | 10% | 50% | 25% | 15% |
| friendly | friendly | - | 0% | 70% | 20% | 10% |

→ CR-Vergleich Details: [Encounter-Balancing.md](Encounter-Balancing.md#cr-vergleich)

---

## Variety-Validation

Nach der Typ-Ableitung erfolgt Variety-Validation als separater Schritt. Das System verhindert Monotonie durch dynamische Typ-Anpassung wenn ein Typ ueberrepraesentiert ist.

### Tracking

```typescript
interface EncounterHistory {
  recentEncounters: RecentEncounter[];  // Letzte 3-5 Encounters
  typeDistribution: Map<EncounterType, number>;
}
```

### Algorithmus

Das Variety-System ist ein **Filter**, keine hardcodierte Mapping-Tabelle:

1. Pruefe ob Typ ueberrepraesentiert ist (2+ in letzten 3)
2. Falls ja: Welche Typen sind mit dieser Kreatur/Situation moeglich?
3. Filtere ueberrepraesentierte Typen raus
4. Waehle passendsten aus den erlaubten

### Beispiele

| Initial | History | Anpassung | Narrativ |
|---------|---------|-----------|----------|
| Combat | Combat×3 | → Social | Goblins wollen verhandeln |
| Trace | Trace×2 | → Combat | Altes Lager voller hungriger Woelfe |
| Social | Social×2 | → Passing | NPC hat keine Zeit, eilt weiter |

---

## CreatureSlot-Varianten

EncounterDefinitions verwenden flexible CreatureSlots fuer unterschiedliche Spezifizitaets-Level:

### ConcreteCreatureSlot (Spezifisch)

```typescript
interface ConcreteCreatureSlot {
  slotType: 'concrete';
  creatureId: EntityId<'creature'>;   // Spezifische Kreatur
  npcId?: EntityId<'npc'>;            // Optional: Existierender NPC
  count: number;
  isLeader?: boolean;
}
```

**Beispiel:** "Griknak der Banditenboss" - für Story-Encounters.

### TypedCreatureSlot (Semi-spezifisch)

```typescript
interface TypedCreatureSlot {
  slotType: 'typed';
  creatureId: EntityId<'creature'>;   // Kreatur-Typ (z.B. "goblin")
  count: number | { min: number; max: number };
  isLeader?: boolean;
}
```

**Beispiel:** "1 Hobgoblin + 3-5 Goblins" - wiederverwendbar.

### BudgetCreatureSlot (Generisch)

```typescript
interface BudgetCreatureSlot {
  slotType: 'budget';
  xpBudget: number;
  constraints?: {
    factionId?: EntityId<'faction'>;
    creatureTypes?: string[];
    crRange?: { min?: number; max?: number };
    tags?: string[];
  };
  minCount?: number;
  maxCount?: number;
}
```

**Beispiel:** "500 XP von Blutfang-Fraktion" - maximal flexibel.

---

## Typ-spezifisches Verhalten

### Combat

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja |
| triggersEvents | `combat:start-requested` |
| resolution | State Machine (Combat-Feature) |

### Social

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja (NPCs) |
| resolution | Manual (GM entscheidet) |

### Passing

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja |
| resolution | Immediate (nur Beschreibung) |

**Beispiele:** Drache am Horizont, Jaegergruppe in der Ferne

### Trace

| Aspekt | Verhalten |
|--------|-----------|
| requiresCreatures | Ja |
| resolution | Manual (Investigation) |

**Beispiele:** Verlassenes Lager, Kampfspuren, Fussspuren

### Environmental / Location (post-MVP)

Ohne Kreaturen - Umwelt-Herausforderungen und POI-Discovery.

---

## Schemas

### EncounterDefinition

```typescript
interface EncounterDefinition {
  id: EntityId<'encounter'>;
  name: string;
  description: string;
  type: EncounterType;

  creatureSlots: CreatureSlot[];

  activity?: string;
  goal?: string;

  triggers?: {
    terrain?: EntityId<'terrain'>[];
    timeOfDay?: TimeSegment[];
    weather?: WeatherType[];
    partyLevelRange?: { min?: number; max?: number };
  };

  xpReward?: number;
  loot?: LootTableRef | LootEntry[];

  isUnique?: boolean;
  requiresQuestAssignment?: boolean;
}
```

### EncounterInstance

```typescript
interface EncounterInstance {
  definitionId: EntityId<'encounter'>;
  type: EncounterType;

  creatures: EncounterCreature[];   // Creatures mit zugewiesenen Items
  leadNPC: NPC;

  activity: string;
  goal: string;

  status: 'pending' | 'active' | 'resolved';
  outcome?: EncounterOutcome;

  // Loot wird bei Generierung erstellt, nicht bei Combat-Ende
  loot: GeneratedLoot;

  // Optional: Encounter hat Hoard (Boss, Lager, etc.)
  hoard?: Hoard;
}

interface EncounterCreature {
  creatureId: EntityId<'creature'>;
  npcId?: EntityId<'npc'>;         // Falls persistierter NPC
  count: number;
  loot: Item[];                    // Zugewiesene Items die Creature nutzen kann
}

interface GeneratedLoot {
  items: SelectedItem[];           // Enthält auch Currency-Items (Gold)
  totalValue: number;
}

interface Hoard {
  id: string;
  source: { type: 'encounter'; encounterId: string };
  items: GeneratedLoot;
  budgetValue: number;
  status: 'hidden' | 'discovered' | 'looted';
}
```

**Loot bei Generierung:**
- Loot wird bei `encounter:generated` erstellt, nicht bei Combat-Ende
- **defaultLoot** der Creatures wird gewuerfelt (Chance-System)
- **Soft-Cap** greift bei hohen Budget-Schulden
- Creatures erhalten Items aus dem Loot-Pool zugewiesen
- Diese Items sind im Combat-Tracker sichtbar (Gegner können sie nutzen)
- Bei Post-Combat Resolution wird Loot verteilt, nicht generiert
- Optional: **Hoard** bei Boss/Lager Encounters (akkumuliertes Budget)

→ Loot-Generierung Details: [Loot-Feature.md](Loot-Feature.md)
→ NPC-Schema: [NPC-System.md](../domain/NPC-System.md)
→ Creature-Schemas: [Creature.md](../domain/Creature.md)

---

## State-Machine

```
pending → active → resolved
            ↓
        (combat) → Combat-Feature uebernimmt
```

| Trigger | Von | Nach |
|---------|-----|------|
| Encounter generiert | - | `pending` |
| GM zeigt Encounter an | `pending` | `active` |
| `combat`: Combat gestartet | `active` | (Combat-Feature) |
| GM markiert als beendet | `active` | `resolved` |

---

## Aktivierungs-Flow

### Einheitlicher Einstiegspunkt

`encounter:generate-requested` ist der **einzige Einstiegspunkt** in die Generierungs-Pipeline.

```
encounter:generate-requested { position, trigger }
    ↓
Encounter-Service baut Context (Tile, Time, Weather, PartyLevel)
    ↓
5-Step-Pipeline
    ↓
encounter:generated { encounter }
```

### Context-Erstellung

**Der Encounter-Service baut den Context selbst.** Caller liefern nur Minimal-Infos:

| Caller liefert | Encounter-Service holt |
|----------------|------------------------|
| `position` | `tile` (inkl. terrain, factionPresence) ← Map-Feature |
| `trigger` | `timeSegment` ← Time-Feature |
| | `weather` ← Weather-Feature |
| | `partyLevel` ← Party-Feature |

---

## Events

```typescript
// Requests
'encounter:generate-requested': { position: HexCoordinate; trigger: TriggerType }
'encounter:start-requested': { encounterId: string }
'encounter:dismiss-requested': { encounterId: string; reason?: string }
'encounter:resolve-requested': { encounterId: string; outcome: EncounterOutcome }

// Lifecycle
'encounter:generated': { encounter: EncounterInstance }
'encounter:started': { encounterId: string; type: EncounterType }
'encounter:dismissed': { encounterId: string }
'encounter:resolved': { encounterId: string; outcome: EncounterOutcome; xpAwarded: number }

// State-Sync
'encounter:state-changed': { currentEncounter: EncounterInstance | null }
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Integration

### Travel

Travel-Feature macht Encounter-Checks waehrend Reisen (12.5%/h × population).

```
travel:position-changed → Encounter-Service → encounter:generate-requested
```

→ Details: [Travel-System.md](Travel-System.md)

### Combat

Bei `combat`-Typ wird Combat-Feature aktiviert:

```
encounter:started (type: combat) → combat:start-requested
```

→ Details: [Combat-System.md](Combat-System.md)

### NPC-Instanziierung

NPCs werden **bei Encounter-Instanziierung** erstellt, nicht bei Definition:

1. Suche passenden existierenden NPC (gleiche Kreatur, Fraktion, alive)
2. Falls keiner: Generiere neuen NPC mit Kultur aus Faction
3. Lead-NPC wird immer persistiert

→ Details: [NPC-System.md](../domain/NPC-System.md)

### XP-System

40/60 XP Split bei Quest-Encounters:

| XP-Anteil | Wann | Empfaenger |
|-----------|------|------------|
| **40%** | Sofort bei Encounter-Ende | Party direkt |
| **60%** | Bei Quest-Abschluss | Quest-Reward-Pool |

→ XP-Budget Details: [Encounter-Balancing.md](Encounter-Balancing.md#xp-budget)

---

## Prioritaet

| Komponente | MVP | Post-MVP |
|------------|:---:|:--------:|
| Tile-Eligibility (Filter + Gewichtung) | ✓ | |
| Typ-Ableitung | ✓ | |
| Variety-Validation | ✓ | |
| Combat/Social/Passing/Trace | ✓ | |
| NPC-Instanziierung + Persistierung | ✓ | |
| 40/60 XP Split | ✓ | |
| Environmental/Location | | ✓ |
| **Pfad-basierte Creature-Pools** | | ✓ |
| Multi-Gruppen-Encounters | | niedrig |

---

*Siehe auch: [Encounter-Balancing.md](Encounter-Balancing.md) | [NPC-System.md](../domain/NPC-System.md) | [Path.md](../domain/Path.md) | [Combat-System.md](Combat-System.md) | [Quest-System.md](Quest-System.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 200 | Terrain-Filter: Kreatur.terrainAffinities vs aktuelles Terrain | hoch | Ja | #801, #1202 | Encounter-System.md#tile-eligibility, Creature.md#terrain-affinitaet-und-auto-sync, Map-Feature.md#overworld-tiles |
| 202 | Fraktionspräsenz-Gewichtung: Fraktion kontrolliert Tile → ×2.0-5.0 | hoch | Ja | #200, #201, #1410, #1411 | Encounter-System.md#tile-eligibility, Faction.md#encounter-integration |
| 204 | Wetter-Gewichtung: Kreatur.preferredWeather matched → ×1.5 | hoch | Ja | #110, #200, #201, #1207 | Encounter-System.md#tile-eligibility, Weather-System.md#weather-state, Creature.md#creaturepreferences |
| 206 | Gewichtete Zufallsauswahl aus eligible Creatures | hoch | Ja | #200, #202, #204 | Encounter-System.md#kreatur-auswahl |
| 207 | Typ-Ableitung: Disposition + Faction-Relation + CR-Balancing → Encounter-Typ | hoch | Ja | #206, #235, #1400 | Encounter-System.md#typ-ableitung, Encounter-Balancing.md#cr-vergleich, Faction.md#schema |
| 209 | EncounterHistory-Tracking (letzte 3-5 Encounters, typeDistribution) | hoch | Ja | - | Encounter-System.md#variety-validation |
| 211 | CreatureSlot-Union: ConcreteCreatureSlot, TypedCreatureSlot, BudgetCreatureSlot | hoch | Ja | #1200, #1300 | Encounter-System.md#creatureslot-varianten, Creature.md#schema, NPC-System.md#npc-schema |
| 213 | EncounterInstance-Schema mit creatures, leadNPC, status, outcome, loot, hoard | hoch | Ja | #211, #212, #714, #730 | Encounter-System.md#schemas, Loot-Feature.md#loot-generierung-bei-encounter |
| 215 | encounter:generate-requested Handler (einheitlicher Einstiegspunkt) | hoch | Ja | #200-#207, #209, #801, #910, #110 | Encounter-System.md#aktivierungs-flow, Travel-System.md#encounter-checks-waehrend-reisen |
| 217 | encounter:start-requested Handler | hoch | Ja | #213, #214 | Encounter-System.md#events |
| 219 | encounter:resolve-requested Handler | hoch | Ja | #213, #214 | Encounter-System.md#events |
| 221 | encounter:started Event publizieren | hoch | Ja | #217 | Encounter-System.md#events, Combat-System.md#event-flow |
| 223 | encounter:resolved Event publizieren mit xpAwarded | hoch | Ja | #219, #233 | Encounter-System.md#events, Combat-System.md#post-combat-resolution |
| 225 | Combat-Typ: combat:start-requested triggern | hoch | Ja | #221, #300, #321 | Encounter-System.md#integration, Combat-System.md#combat-flow |
| 227 | Passing-Typ: Sofortige Beschreibung anzeigen | hoch | Ja | #221, #249 | Encounter-System.md#typ-spezifisches-verhalten, Encounter-Balancing.md#passing |
| 229 | Environmental-Typ: Umwelt-Herausforderungen | mittel | Nein | #213, #214 | Encounter-System.md#encounter-typen |
| 231 | NPC-Instanziierung: Bei Encounter suchen/erstellen mit Faction-Kultur | hoch | Ja | #220, #1307, #1314, #1318, #1405, #2001, #2101 | Encounter-System.md#integration, NPC-System.md#lead-npc-auswahl, Faction.md#kultur-vererbung |
| 233 | 40/60 XP Split: 40% sofort bei Encounter-Ende | hoch | Ja | #223, #408, #410, #2401 | Encounter-System.md#integration, Quest-System.md#xp-verteilung, Combat-System.md#xp-berechnung |
