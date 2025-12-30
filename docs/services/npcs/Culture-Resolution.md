# Culture-Resolution

> **Verantwortlichkeit:** Kultur-Aufloesung fuer NPC-Generierung
> **Aufgerufen von:** [NPC-Generation.md](NPC-Generation.md)
> **Input:** `CreatureDefinition`, `Faction | null`
> **Output:** `ResolvedCulture` (gemergte Pools fuer Name, Personality, Quirks, Goals)
>
> **Referenzierte Schemas:**
> - [culture-data.md](../../entities/culture-data.md) - Pool-Struktur (naming, personalities, quirks, goals)
> - [faction.md](../../entities/faction.md) - Faction mit eingebetteter Culture
> - [creature.md](../../entities/creature.md) - Species-Feld fuer Kultur-Lookup

Wie wird die Kultur eines NPCs aus mehreren Quellen aufgeloest?

---

## Datenfluss

```
┌─────────────────────────────────────────────────────────────────────┐
│  KULTUR-AUFLOESUNG                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CreatureDefinition + Faction                                        │
│  │                                                                   │
│  ▼                                                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ resolveCultureChain(creature, faction)                          │  │
│  │                                                                 │  │
│  │ 1. Basis-Kultur bestimmen                                       │  │
│  │    ├── creature.species gesetzt?                                │  │
│  │    │   └── Ja: Species-Culture laden (ersetzt Type)             │  │
│  │    └── Nein: Type-Preset laden (Humanoid, Beast, etc.)         │  │
│  │                                                                 │  │
│  │ 2. Faction-Kette traversieren                                   │  │
│  │    └── [Root-Faction, ..., Leaf-Faction]                        │  │
│  │                                                                 │  │
│  │ 3. CultureLayer[] zurueckgeben                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│      │                                                               │
│      ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ selectFromCultureLayers(layers, field)                          │  │
│  │                                                                 │  │
│  │ 60%-Kaskade von Leaf nach Root                                  │  │
│  │ └── Leaf: 60%, Parent: 24%, Grandparent: 9.6%, ...             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│      │                                                               │
│      ▼                                                               │
│  ResolvedCulture (an NPC-Generation)                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Kultur-Hierarchie

Die Kultur eines NPCs wird aus mehreren Ebenen zusammengestellt:

```
ROOT: Type-Preset (Humanoid, Beast, Monstrosity, etc.)
  │   └── Bundled mit Plugin, immer vorhanden
  │
  └── ERSETZT durch Species-Culture falls creature.species gesetzt
        │   └── z.B. species: "goblin" → Goblin-Kultur statt Humanoid
        │
        └── Faction-Kette (beliebig viele Ebenen)
              └── Ergaenzt mit 60%-Kaskade
```

**Wichtig:**
- Type-Preset wird durch Species-Culture **ersetzt** (nicht ergaenzt)
- Faction-Ebenen **ergaenzen** die Basis mit gewichteter Wahrscheinlichkeit

### Quellen

| Schema | Ort | Zweck |
|--------|-----|-------|
| `CultureData` | [culture-data.md](../../entities/culture-data.md) | Pool-Struktur (naming, personalities, quirks, goals) |
| Type-Presets | `presets/cultures/types/` | Basis-Kultur pro Creature-Type (Humanoid, Beast, etc.) |
| Species-Cultures | `presets/cultures/species/` | Optionale Spezies-Kultur (Goblin, Wolf, etc.) |
| `Faction.culture` | [faction.md#culture](../../entities/faction.md) | Fraktions-spezifische Kultur-Erweiterung |

---

## Wahrscheinlichkeits-Kaskade

Jede Ebene erhaelt 60% der verbleibenden Wahrscheinlichkeit. Root bekommt den Rest.

| Ebenen | Verteilung (Root → ... → Leaf) |
|:------:|--------------------------------|
| 1 | 100% |
| 2 | 40% → 60% |
| 3 | 16% → 24% → 60% |
| 4 | 6.4% → 9.6% → 24% → 60% |
| n | Leaf immer 60%, Rest kaskadiert |

**Beispiel:** Blutfang-Spaeher (3 Faction-Ebenen ueber Goblin-Species)
- Blutfang-Spaeher: 60%
- Blutfang-Stamm: 24%
- Ork-Allianz: 9.6%
- Goblin-Species: 6.4%

---

## Forbidden-Listen

- Verbote werden ueber alle Ebenen **akkumuliert**
- **Ausnahme:** Explizite Inklusion auf tieferer Ebene ueberschreibt Verbot
- Beispiel: Goblins verbieten "kindhearted", aber Goldzahn-Stamm hat explizit trait "kindhearted" → erlaubt fuer Goldzahn

---

## Implementierung

### resolveCultureChain()

```typescript
interface CultureLayer {
  source: 'type' | 'species' | 'faction';
  culture: CultureData;
  factionId?: EntityId<'faction'>;
}

function resolveCultureChain(
  creature: CreatureDefinition,
  faction: Faction | null
): CultureLayer[] {
  const layers: CultureLayer[] = [];

  // 1. Basis: Type-Preset oder Species-Culture (ersetzt Type)
  if (creature.species) {
    const speciesCulture = getSpeciesCulture(creature.species);
    if (speciesCulture) {
      layers.push({ source: 'species', culture: speciesCulture });
    } else {
      layers.push({ source: 'type', culture: getTypeCulture(creature.type) });
    }
  } else {
    layers.push({ source: 'type', culture: getTypeCulture(creature.type) });
  }

  // 2. Faction-Kette (von Root nach Leaf)
  if (faction) {
    const factionChain = buildFactionChain(faction); // [root, ..., leaf]
    for (const f of factionChain) {
      layers.push({ source: 'faction', culture: f.culture, factionId: f.id });
    }
  }

  return layers;
}
```

### selectFromCultureLayers()

```typescript
function selectFromCultureLayers<T>(
  layers: CultureLayer[],
  field: keyof CultureData
): T {
  // 60%-Kaskade von Leaf nach Root
  let remaining = 1.0;
  const probabilities: number[] = [];

  for (let i = layers.length - 1; i > 0; i--) {
    probabilities.unshift(remaining * 0.6);
    remaining *= 0.4;
  }
  probabilities.unshift(remaining); // Root bekommt Rest

  // Gewichtete Auswahl der Ebene
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < layers.length; i++) {
    cumulative += probabilities[i];
    if (roll < cumulative && layers[i].culture[field]) {
      return selectFromPool(layers[i].culture[field]);
    }
  }

  // Fallback: Erste Ebene mit Daten
  for (const layer of layers) {
    if (layer.culture[field]) {
      return selectFromPool(layer.culture[field]);
    }
  }

  throw new Error(`No ${field} found in culture chain`);
}
```

### buildFactionChain()

```typescript
function buildFactionChain(faction: Faction): Faction[] {
  const chain: Faction[] = [];
  let current: Faction | null = faction;

  // Zuerst zur Root traversieren
  while (current) {
    chain.unshift(current);
    current = current.parentId
      ? entityRegistry.get('faction', current.parentId)
      : null;
  }

  return chain; // [root, ..., leaf]
}
```

---

## Siehe auch

- [NPC-Generation.md](NPC-Generation.md) - Verwendet Culture-Resolution fuer NPC-Generierung
- [culture-data.md](../../entities/culture-data.md) - Schema-Definition der Culture-Pools
- [faction.md](../../entities/faction.md) - Faction mit eingebetteter Culture

---

## Tasks

|  # | Status | Domain | Layer    | Beschreibung                                                  |  Prio  | MVP? | Deps | Spec                                      | Imp.                                                  |
|--:|:----:|:-----|:-------|:------------------------------------------------------------|:----:|:--:|:---|:----------------------------------------|:----------------------------------------------------|
| 53 |   🔶   | NPCs   | services | Culture-Resolution: Forbidden-Listen implementieren           | mittel | Nein | -    | Culture-Resolution.md#Forbidden-Listen    | npcGenerator.ts.rollPersonalityFromCulture() [ändern] |
| 54 |   🔶   | NPCs   | services | Culture-Resolution: Faction-Ketten-Traversierung via parentId | mittel | Nein | -    | Culture-Resolution.md#buildFactionChain() | npcGenerator.ts.resolveCultureChain() [ändern]        |
| 58 |   ✅    | NPCs   | services | Species-Cultures in Culture-Resolution implementiert          | mittel | Nein | -    | Culture-Resolution.md#Kultur-Hierarchie   | npcGenerator.ts.resolveCultureChain() [fertig]        |
