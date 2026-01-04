# Culture-Resolution

> **Verantwortlichkeit:** Culture-Auswahl und Attribut-Resolution fuer NPC-Generierung
> **Aufgerufen von:** [NPC-Generation.md](NPC-Generation.md)
> **Input:** `CreatureDefinition`, `Faction | null`, `Culture[]` (alle verfuegbaren)
> **Output:** `selectedCultureId`, `ResolvedAttributes`
>
> **Referenzierte Schemas:**
> - [culture.md](../../types/culture.md) - Culture-Entity mit usualSpecies, tolerance
> - [faction.md](../../types/faction.md) - usualCultures, cultureTolerance, acceptedSpecies, influence
> - [creature.md](../../types/creature.md) - species, appearance

---

## Uebersicht

Culture-Resolution besteht aus zwei Phasen:

1. **Culture-Selection:** Welche Kultur hat der NPC?
2. **Attribut-Resolution:** Welche Traits bekommt der NPC?

```
┌─────────────────────────────────────────────────────────────────────┐
│  CULTURE-RESOLUTION                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Creature + Faction + alle Cultures                                  │
│  │                                                                   │
│  ▼                                                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Phase 1: selectCulture()                                        │  │
│  │                                                                 │  │
│  │ 1. Faction.usualCultures → Pool (hohes Gewicht)                │  │
│  │ 2. Alle anderen Cultures → Pool (niedriges Gewicht)            │  │
│  │ 3. Species-Kompatibilitaet anwenden                             │  │
│  │ 4. Kultur-Fraktions-Kompatibilitaet anwenden                    │  │
│  │ 5. Ancestor-Boost anwenden (Parent-Kulturen)                    │  │
│  │ 6. Weighted Random Selection                                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│      │                                                               │
│      ▼ selectedCulture                                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Phase 2: resolveAttributes()                                    │  │
│  │                                                                 │  │
│  │ appearance  ← Creature.appearance                               │  │
│  │ styling     ← Culture.styling                                   │  │
│  │ personality ← Culture.personality                               │  │
│  │ values      ← Culture.values + Faction.influence.values         │  │
│  │ quirks      ← Culture.quirks                                    │  │
│  │ goals       ← Culture.goals + Faction.influence.goals           │  │
│  │ naming      ← Culture.naming                                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│      │                                                               │
│      ▼                                                               │
│  NPC mit cultureId + generierten Attributen                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Culture-Selection

### Algorithmus

```typescript
function selectCulture(
  creature: CreatureDefinition,
  faction: Faction | null,
  allCultures: Culture[]
): Culture {
  const pool: Array<{ culture: Culture; weight: number }> = [];

  for (const culture of allCultures) {
    let weight = calculateCultureWeight(culture, creature, faction);
    if (weight > 0) {
      pool.push({ culture, weight });
    }
  }

  return weightedRandomSelect(pool);
}
```

### Gewichtungsberechnung

```typescript
function calculateCultureWeight(
  culture: Culture,
  creature: CreatureDefinition,
  faction: Faction | null,
  allCultures: Culture[]
): number {
  const FACTION_BOOST = 900;
  const SPECIES_BOOST = 9;
  const PARENT_BOOST = 3;

  // Step 1: Faction-Boost
  const isUsualCulture = faction?.usualCultures?.includes(culture.id) ?? false;
  const factionTolerance = faction?.cultureTolerance ?? 0.3;

  let weight = isUsualCulture
    ? 100 + FACTION_BOOST * (1 - factionTolerance)
    : 1;

  // Step 2: Species-Boost
  const isCompatibleSpecies = culture.usualSpecies?.includes(creature.species ?? '') ?? true;
  const cultureTolerance = culture.tolerance ?? 0.3;

  if (isCompatibleSpecies) {
    weight *= 1 + SPECIES_BOOST * (1 - cultureTolerance);
  }
  // Inkompatible Species: weight bleibt (Basis-Gewicht)

  // Step 3: Kultur-Fraktions-Kompatibilitaet
  const acceptedSpecies = faction?.acceptedSpecies ?? [];
  const usualSpecies = culture.usualSpecies ?? [];

  const hasUnwantedSpecies = acceptedSpecies.some(
    species => !usualSpecies.includes(species)
  );

  if (hasUnwantedSpecies) {
    weight *= cultureTolerance;
    // Intollerante Kulturen (tolerance=0) → weight → 0
    // Tollerante Kulturen (tolerance=1) → weight bleibt
  }

  // Step 4: Ancestor-Boost
  // Parent-Kulturen von usualCultures erhalten abnehmenden Boost
  const ancestorBoost = calculateAncestorBoost(
    culture,
    faction?.usualCultures ?? [],
    allCultures,
    PARENT_BOOST
  );
  weight *= ancestorBoost;

  return weight;
}
```

### Gewichtungs-Tabellen

**Step 1: Faction-Boost (FACTION_BOOST = 900)**

| factionTolerance | usualCultures Gewicht | Andere Kulturen |
|------------------|----------------------|-----------------|
| 0% | 100 + 900 = 1000 | 1 |
| 30% (default) | 100 + 630 = 730 | 1 |
| 50% | 100 + 450 = 550 | 1 |
| 100% | 100 | 1 |

**Step 2: Species-Boost (SPECIES_BOOST = 9)**

| cultureTolerance | Kompatibel | Inkompatibel |
|------------------|------------|--------------|
| 0% | weight * 10 | weight * 1 |
| 30% (default) | weight * 7.3 | weight * 1 |
| 50% | weight * 5.5 | weight * 1 |
| 100% | weight * 1 | weight * 1 |

**Step 3: Kultur-Fraktions-Kompatibilitaet**

| culture.tolerance | Effekt wenn Fraktion "fremde" Species hat |
|-------------------|-------------------------------------------|
| 0% | weight *= 0 (Kultur tritt nicht bei) |
| 30% | weight *= 0.3 |
| 100% | weight *= 1 (kein Problem) |

**Step 4: Ancestor-Boost (PARENT_BOOST = 3)**

Parent-Kulturen von usualCultures erhalten einen abnehmenden Boost.

| Kultur ist... | Boost-Multiplikator | Beispiel |
|---------------|---------------------|----------|
| usualCulture selbst | Step 1 (factionWeight) | `imperial-military` |
| Direct Parent (depth=1) | weight × 3.0 | `imperial` |
| Grandparent (depth=2) | weight × 2.0 | `human-generic` |
| Great-Grandparent (depth=3) | weight × 1.5 | usw. |
| Kein Ancestor | weight × 1.0 | keine Beziehung |

**Formel:** `1 + (PARENT_BOOST - 1) / 2^(depth - 1)`

### Ancestor-Boost Algorithmus

```typescript
function calculateAncestorBoost(
  culture: Culture,
  usualCultures: string[],
  allCultures: Culture[],
  PARENT_BOOST: number
): number {
  // Fuer jede usualCulture pruefen ob culture ein Ancestor ist
  for (const usualCultureId of usualCultures) {
    const usualCulture = allCultures.find(c => c.id === usualCultureId);
    let current = usualCulture;
    let depth = 0;

    // Parent-Kette nach oben traversieren
    while (current?.parentId) {
      depth++;
      if (current.parentId === culture.id) {
        // culture ist Ancestor von usualCulture in Tiefe depth
        return 1 + (PARENT_BOOST - 1) / Math.pow(2, depth - 1);
        // depth=1 (direct parent): 1 + 2 = 3.0
        // depth=2 (grandparent):   1 + 1 = 2.0
        // depth=3:                 1 + 0.5 = 1.5
      }
      current = allCultures.find(c => c.id === current!.parentId);
    }
  }
  return 1; // Kein Ancestor einer usualCulture
}
```

---

## Beispiele

### Goblin in "Blutfang-Stamm" (factionTolerance: 10%)

```
Stamm:
├── usualCultures: ['goblin-tribal']
├── factionTolerance: 0.1 (10%)
├── acceptedSpecies: ['goblin', 'hobgoblin']

Kultur: goblin-tribal
├── usualSpecies: ['goblin', 'hobgoblin', 'bugbear']
├── tolerance: 0.2 (20%)

Berechnung:
├── Step 1: usualCulture → weight = 100 + 900 * 0.9 = 910
├── Step 2: Goblin IN usualSpecies → weight *= 1 + 9 * 0.8 = 8.2
│           → weight = 910 * 8.2 = 7462
├── Step 3: acceptedSpecies ⊆ usualSpecies → kein Malus
└── Endgewicht: 7462

Andere Kulturen:
├── Basis: 1
├── Species-Boost variiert
└── Typisch: 1-10

→ goblin-tribal: ~99.9%
```

### Mensch in "Diverse Abenteurergilde" (factionTolerance: 100%)

```
Gilde:
├── usualCultures: ['guild-adventurer']
├── factionTolerance: 1.0 (100%)
├── acceptedSpecies: ['human', 'elf', 'dwarf', 'orc', 'halfling']

Kultur A: guild-adventurer
├── usualSpecies: ['human', 'elf', 'dwarf', 'halfling']
├── tolerance: 0.8

Kultur B: imperial-noble
├── usualSpecies: ['human']
├── tolerance: 0.3

Berechnung A:
├── Step 1: usualCulture → weight = 100 + 900 * 0 = 100
├── Step 2: Human IN usualSpecies → weight *= 1 + 9 * 0.2 = 2.8
│           → weight = 100 * 2.8 = 280
├── Step 3: Orc NOT IN usualSpecies, aber tolerance=0.8
│           → weight *= 0.8 = 224
└── Endgewicht: 224

Berechnung B:
├── Step 1: nicht usualCulture → weight = 1
├── Step 2: Human IN usualSpecies → weight *= 1 + 9 * 0.7 = 7.3
│           → weight = 1 * 7.3 = 7.3
├── Step 3: Orc NOT IN usualSpecies, tolerance=0.3
│           → weight *= 0.3 = 2.19
└── Endgewicht: 2.19

→ guild-adventurer: ~99%, imperial-noble: ~1%
```

### Xenophobe Kultur bei diverser Fraktion

```
Fraktion:
├── acceptedSpecies: ['human', 'orc', 'elf']

Kultur: elven-isolationist
├── usualSpecies: ['elf']
├── tolerance: 0.0 (0%)

Berechnung:
├── Step 3: 'human', 'orc' NOT IN usualSpecies
│           → weight *= 0.0 = 0
└── Endgewicht: 0

→ Xenophobe Elfen-Kultur tritt dieser Fraktion NICHT bei
```

### Ancestor-Boost bei Imperiale Legion

```
Kultur-Hierarchie:
  human-generic (id: 'human-generic')
    └── imperial (id: 'imperial', parentId: 'human-generic')
          └── imperial-military (id: 'imperial-military', parentId: 'imperial')

Fraktion: Imperiale Legion
├── usualCultures: ['imperial-military']
├── factionTolerance: 0.3

Berechnung fuer 'imperial' (Parent von usualCulture):
├── Step 1: NICHT usualCulture → weight = 1
├── Step 2: Species-Boost (angenommen kompatibel) → weight = 7.3
├── Step 3: Keine fremden Species → weight = 7.3
├── Step 4: Parent von 'imperial-military' (depth=1)
│           → weight *= 1 + (3-1) / 2^0 = 3.0
│           → weight = 7.3 * 3.0 = 21.9
└── Endgewicht: 21.9

Berechnung fuer 'human-generic' (Grandparent):
├── Step 1: NICHT usualCulture → weight = 1
├── Step 2: Species-Boost → weight = 7.3
├── Step 3: Keine fremden Species → weight = 7.3
├── Step 4: Grandparent von 'imperial-military' (depth=2)
│           → weight *= 1 + (3-1) / 2^1 = 2.0
│           → weight = 7.3 * 2.0 = 14.6
└── Endgewicht: 14.6

Berechnung fuer 'elven-forest' (kein Ancestor):
├── Step 1-3: ... → weight = X
├── Step 4: Kein Ancestor → weight *= 1
└── Kein Boost

→ imperial-military: 730+, imperial: ~22, human-generic: ~15, andere: ~7
```

---

## Phase 2: Attribut-Resolution

Nach Culture-Selection werden die NPC-Attribute aufgeloest.

### Quellen pro Attribut

| Attribut | Primaer-Quelle | Sekundaer-Quelle |
|----------|---------------|------------------|
| appearance | Creature.appearance | - |
| styling | Culture.styling | - |
| personality | Culture.personality | - |
| values | Culture.values | Faction.influence.values |
| quirks | Culture.quirks | - |
| goals | Culture.goals | Faction.influence.goals |
| name | Culture.naming | - |

### Algorithmus

```typescript
function resolveAttributes(
  creature: CreatureDefinition,
  culture: Culture,
  faction: Faction | null
): ResolvedAttributes {
  return {
    appearance: rollFromPool(creature.appearance),
    styling: rollFromPool(culture.styling),
    personality: rollFromPool(culture.personality),
    values: rollFromPool(
      mergeLayerConfigs(culture.values, faction?.influence?.values)
    ),
    quirks: rollFromPool(culture.quirks),
    goals: rollFromPool(
      mergeLayerConfigs(culture.goals, faction?.influence?.goals)
    ),
    name: generateNameFromConfig(culture.naming),
  };
}
```

### Merge-Logik fuer influence

Faction.influence erweitert den Pool, ersetzt ihn nicht:

```typescript
function mergeLayerConfigs(
  base: LayerTraitConfig | undefined,
  extension: LayerTraitConfig | undefined
): LayerTraitConfig {
  return {
    add: [...(base?.add ?? []), ...(extension?.add ?? [])],
    unwanted: [...(base?.unwanted ?? []), ...(extension?.unwanted ?? [])],
  };
}
```

---

## Konstanten

```typescript
// src/constants/culture.ts

/** Boost fuer usualCultures bei NPC-Generierung */
export const FACTION_CULTURE_BOOST = 900;

/** Boost fuer Species-Kompatibilitaet */
export const SPECIES_COMPATIBILITY_BOOST = 9;

/** Boost fuer Parent-Kulturen von usualCultures */
export const PARENT_CULTURE_BOOST = 3;

/** Default-Toleranz wenn nicht gesetzt */
export const DEFAULT_TOLERANCE = 0.3;
```

---

## Siehe auch

- [culture.md](../../types/culture.md) - Culture-Entity Schema mit parentId
- [creature.md](../../types/creature.md) - Creature mit appearance
- [faction.md](../../types/faction.md) - Faction mit usualCultures, influence
- [NPC-Generation.md](NPC-Generation.md) - Verwendet Culture-Resolution
