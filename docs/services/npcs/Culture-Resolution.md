# Culture-Resolution

> **Verantwortlichkeit:** Kultur-Aufloesung fuer NPC-Generierung
> **Aufgerufen von:** [NPC-Generation.md](NPC-Generation.md)
> **Input:** `CreatureDefinition`, `Faction | null`
> **Output:** `CultureLayer[]` (fuer accumulateWithUnwanted und mergeWeightedPool)
>
> **Referenzierte Schemas:**
> - [culture-data.md](../../types/culture-data.md) - LayerTraitConfig (add[] + unwanted[])
> - [faction.md](../../types/faction.md) - Faction mit eingebetteter Culture
> - [creature.md](../../types/creature.md) - Species-Feld fuer Kultur-Lookup

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
│  │ 1. Register als Base-Layer (alle Traits verfuegbar)            │  │
│  │                                                                 │  │
│  │ 2. Species-Culture laden (falls creature.species gesetzt)      │  │
│  │    └── ODER: Type-Preset laden (Humanoid, Beast, etc.)         │  │
│  │                                                                 │  │
│  │ 3. Faction-Kette traversieren                                   │  │
│  │    └── [Root-Faction, ..., Leaf-Faction]                        │  │
│  │                                                                 │  │
│  │ 4. CultureLayer[] zurueckgeben                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│      │                                                               │
│      ├──────────────────────────────────────────────────────────────┤
│      │                                                               │
│      ▼ (fuer Naming)                   ▼ (fuer Attribute)           │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐  │
│  │ mergeWeightedPool()         │   │ accumulateWithUnwanted()    │  │
│  │                             │   │                             │  │
│  │ 60%-Kaskade:                │   │ 60%-Kaskade + unwanted:     │  │
│  │ Leaf=100, Parent=60, ...    │   │ - add: +LayerWeight         │  │
│  │ Duplikate summiert          │   │ - unwanted: akkumuliert/4   │  │
│  └─────────────────────────────┘   └─────────────────────────────┘  │
│      │                                │                             │
│      ▼                                ▼                             │
│  Gewichteter Pool (Naming)        Map<TraitId, Weight>              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Kultur-Hierarchie

Die Kultur eines NPCs wird aus mehreren Ebenen zusammengestellt:

```
Register (Base) → Species (oder Type) → Faction-Kette
```

| Layer | Quelle | Beschreibung |
|-------|--------|--------------|
| Register | `presets/npcAttributes/` | Alle Traits initial verfuegbar |
| Species | `presets/cultures/species/` | Spezies-spezifisch (ersetzt Type) |
| Type | `presets/cultures/types/` | Fallback wenn keine Species |
| Faction | `faction.culture` | Fraktions-spezifische Gewichtung |

**Wichtig:**
- Register macht alle Traits initial verfuegbar (unterster Base-Layer)
- Species-Culture **ersetzt** Type-Preset (nicht ergaenzt)
- Faction-Ebenen **ergaenzen** die Basis mit gewichteter Wahrscheinlichkeit

### Quellen

| Schema | Ort | Zweck |
|--------|-----|-------|
| `LayerTraitConfig` | `src/types/common/layerTraitConfig.ts` | `{ add?: string[], unwanted?: string[] }` |
| Register | `presets/npcAttributes/` | Zentrale Attribut-Definitionen |
| Type-Presets | `presets/cultures/types/` | Basis-Kultur pro Creature-Type |
| Species-Cultures | `presets/cultures/species/` | Optionale Spezies-Kultur |
| `Faction.culture` | [faction.md#culture](../../types/faction.md) | Fraktions-Kultur-Erweiterung |

---

## Gewichtungs-Mechanik

### 60%-Kaskade

Leaf bekommt Gewicht 100, jede hoehere Ebene 60% der vorherigen.

| Ebenen | Gewichte (Root → ... → Leaf) |
|:------:|------------------------------|
| 1 | 100 |
| 2 | 60 → 100 |
| 3 | 36 → 60 → 100 |
| 4 | 21.6 → 36 → 60 → 100 |

### LayerTraitConfig

Jeder Culture-Layer verwendet `LayerTraitConfig`:

```typescript
interface LayerTraitConfig {
  add?: string[];      // Trait-IDs die Gewicht erhalten
  unwanted?: string[]; // Trait-IDs die bisherigen Wert vierteln
}
```

### accumulateWithUnwanted()

**Algorithmus pro Layer (in Reihenfolge):**

1. **unwanted verarbeiten:** Viertelt den bisherigen akkumulierten Wert
2. **add verarbeiten:** Addiert das Layer-Gewicht zum akkumulierten Wert

**Beispiel:** Trait "gutherzig" ueber 4 Layer

| Layer | Aktion | Berechnung | Akkumuliert |
|-------|--------|------------|-------------|
| Register (21.6) | add | 0 + 21.6 | 21.6 |
| Goblin (36) | - | - | 21.6 |
| Rotfang (60) | unwanted | 21.6 / 4 | 5.4 |
| Silberblatt (100) | add | 5.4 + 100 | 105.4 |

**Ergebnis:** "gutherzig" hat Gewicht 105.4

**Wichtig:**
- unwanted viertelt nur den **bisherigen** akkumulierten Wert
- Spaetere add-Eintraege sind davon nicht betroffen
- Wenn ein Trait weder in add noch unwanted ist, bleibt sein akkumulierter Wert unveraendert

---

## Implementierung

### resolveCultureChain()

```typescript
type CultureSource = 'register' | 'type' | 'species' | 'faction';

interface CultureLayer {
  source: CultureSource;
  culture: CultureData;
  factionId?: string;
}

function resolveCultureChain(
  creature: CreatureDefinition,
  faction: Faction | null
): CultureLayer[] {
  const layers: CultureLayer[] = [];

  // 1. Register als Base-Layer (alle Traits verfuegbar)
  layers.push({ source: 'register', culture: buildRegisterCulture() });

  // 2. Species-Culture oder Type-Preset
  if (creature.species) {
    const speciesCulture = getSpeciesCulture(creature.species);
    if (speciesCulture) {
      layers.push({ source: 'species', culture: speciesCulture });
    } else {
      layers.push({ source: 'type', culture: getTypeCulture(creature.tags[0]) });
    }
  } else {
    layers.push({ source: 'type', culture: getTypeCulture(creature.tags[0]) });
  }

  // 3. Faction-Kette (von Root nach Leaf)
  if (faction) {
    const factionChain = buildFactionChain(faction);
    for (const f of factionChain) {
      layers.push({ source: 'faction', culture: f.culture, factionId: f.id });
    }
  }

  return layers;
}
```

### buildRegisterCulture()

```typescript
function buildRegisterCulture(): CultureData {
  return {
    personality: { add: getAllIds('personality') },
    values: { add: getAllIds('values') },
    quirks: { add: getAllIds('quirks') },
    appearance: { add: getAllIds('appearance') },
    goals: { add: getAllIds('goals') },
  };
}
```

### accumulateWithUnwanted()

```typescript
function accumulateWithUnwanted(
  layers: CultureLayer[],
  extractor: (culture: CultureData) => LayerTraitConfig | undefined
): Map<string, number> {
  const weights = calculateLayerWeights(layers.length);
  const accumulated = new Map<string, number>();

  for (let i = 0; i < layers.length; i++) {
    const config = extractor(layers[i].culture);
    if (!config) continue;

    const layerWeight = weights[i];

    // 1. Zuerst unwanted (viertelt bisherigen Wert)
    for (const id of config.unwanted ?? []) {
      const current = accumulated.get(id) ?? 0;
      accumulated.set(id, current / 4);
    }

    // 2. Dann add (fuegt Layer-Gewicht hinzu)
    for (const id of config.add ?? []) {
      const current = accumulated.get(id) ?? 0;
      accumulated.set(id, current + layerWeight);
    }
  }

  return accumulated;
}
```

### mergeWeightedPool()

Fuer Naming-Pools (ohne unwanted-Mechanik).

```typescript
function mergeWeightedPool<T>(
  layers: CultureLayer[],
  extractor: (culture: CultureData) => T[] | undefined
): Array<{ item: T; randWeighting: number }> {
  const weights = calculateLayerWeights(layers.length);
  const merged = new Map<string, { item: T; randWeighting: number }>();

  for (let i = 0; i < layers.length; i++) {
    const items = extractor(layers[i].culture);
    if (!items) continue;

    for (const item of items) {
      const key = typeof item === 'string' ? item : JSON.stringify(item);
      const existing = merged.get(key);
      if (existing) {
        existing.randWeighting += weights[i];  // Duplikat summieren
      } else {
        merged.set(key, { item, randWeighting: weights[i] });
      }
    }
  }

  return Array.from(merged.values());
}
```

### buildFactionChain()

```typescript
function buildFactionChain(faction: Faction): Faction[] {
  const chain: Faction[] = [];
  let current: Faction | null = faction;

  // Zur Root traversieren
  while (current) {
    chain.unshift(current);
    current = current.parentId
      ? vault.getEntity('faction', current.parentId)
      : null;
  }

  return chain; // [root, ..., leaf]
}
```

---

## Culture-Preset Format

### LayerTraitConfig

```typescript
// presets/cultures/species/index.ts
export const speciesPresets: Record<string, CultureData> = {
  goblin: {
    naming: { /* ... */ },
    personality: {
      add: ['cunning', 'cowardly', 'greedy', 'cruel', 'nervous'],
      unwanted: ['heroic', 'honorable', 'generous', 'patient'],
    },
    values: {
      add: ['survival', 'wealth'],
      unwanted: ['honor', 'justice', 'mercy'],
    },
    quirks: {
      add: ['nervous_laugh', 'hoards_shiny', 'bites_nails'],
    },
    appearance: {
      add: ['sharp_teeth', 'missing_teeth', 'yellow_eyes'],
    },
    goals: {
      add: ['loot', 'survive', 'please_boss', 'avoid_work'],
    },
    // ...
  },
};
```

---

## Siehe auch

- [NPC-Generation.md](NPC-Generation.md) - Verwendet Culture-Resolution fuer NPC-Generierung
- [culture-data.md](../../types/culture-data.md) - Schema-Definition der Culture-Pools
- [faction.md](../../types/faction.md) - Faction mit eingebetteter Culture

---

## Tasks

|  # | Status | Domain | Layer    | Beschreibung                                                  |  Prio  | MVP? | Deps | Spec                                      | Imp.                                                  |
|--:|:----:|:-----|:-------|:------------------------------------------------------------|:----:|:--:|:---|:----------------------------------------|:----------------------------------------------------|
| 54 |   ✅    | NPCs   | services | Culture-Resolution: Faction-Ketten-Traversierung via parentId | mittel | Nein | -    | Culture-Resolution.md#buildFactionChain() | npcGenerator.ts.resolveCultureChain() [ändern]        |
| 58 |   ✅    | NPCs   | services | Species-Cultures in Culture-Resolution implementiert          | mittel | Nein | -    | Culture-Resolution.md#Kultur-Hierarchie   | npcGenerator.ts.resolveCultureChain() [fertig]        |
| 67 |   ✅    | NPCs   | services | Culture-Resolution: Soft-Weighting fuer Traits implementiert  | mittel | Nein | -    | Culture-Resolution.md#Trait-System        | npcGenerator.ts.rollPersonalityFromCulture() [fertig] |
