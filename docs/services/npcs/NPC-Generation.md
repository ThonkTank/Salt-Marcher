# NPC-Generation

> **Verantwortlichkeit:** Automatische NPC-Generierung
> **Input:** `CreatureDefinition`, `Faction?`, optionale Parameter
> **Output:** `NPC` (nicht persistiert - Caller ist verantwortlich fuer Persistierung)
> **Schema:** [npc.md](../../types/npc.md)
>
> **Referenzierte Schemas:**
> - [creature.md](../../types/creature.md) - Input: CreatureDefinition
> - [faction.md](../../types/faction.md) - Faction mit usualCultures, influence
> - [culture.md](../../types/culture.md) - Culture-Entity (Naming, Styling, Attribute-Pools)
>
> **Verwandte Dokumente:**
> - [Culture-Resolution.md](Culture-Resolution.md) - Kultur-Aufloesung (Hierarchie, Kaskade, unwanted-Mechanik)
> - [NPC-Matching.md](NPC-Matching.md) - Existierenden NPC finden
> - [NPC-Lifecycle.md](../../features/NPC-Lifecycle.md) - Persistierung, Status-Uebergaenge

Wie werden neue NPCs generiert?

**Design-Philosophie:** NPC-Generierung ist ein generischer Service. Verschiedene Systeme (Encounter, Quest, Shop, POI) koennen NPCs automatisch generieren ohne spezifische Abhaengigkeiten.

---

## NPC-Felder (6 unabhaengige Attribute)

| Feld | Typ | Beschreibung | Beispiele |
|------|-----|--------------|-----------|
| `name` | string | Generiert aus Naming-Patterns | Griknak, Maria der Wanderer |
| `personality` | string | EIN Persoenlichkeits-Trait | mutig, feige, listig, gierig |
| `value` | string | EIN Wert/Prioritaet | Freundschaft, Geld, Macht, Ehrlichkeit |
| `quirk` | string? | EINE Eigenheit (optional) | Tippt nervoes mit dem Fuss |
| `appearance` | string? | EIN Aussehen-Merkmal (optional) | Rote Haare, spitze Zaehne |
| `goal` | string | EIN Ziel | Rache, Ueberleben, Guten Handel abschliessen |

**Alle Felder sind voneinander unabhaengig.** Keine Verknuepfungen zwischen personality und goal.

---

## Datenfluss

```
┌─────────────────────────────────────────────────────────────────────┐
│  DATENFLUSS: NPC-Generation                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Aufrufer (Encounter, Quest, Shop, POI)                             │
│  └── generateNPC(creature, faction?, options)                       │
│      │                                                               │
│      ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ NPC-GENERATION                                                  │  │
│  │                                                                 │  │
│  │ 1. resolveCultureChain(creature, faction)                      │  │
│  │    └── Register → Species/Type → Factions                      │  │
│  │    │                                                            │  │
│  │ 2. generateNameFromCulture(layers)                              │  │
│  │    └── Pattern + Prefix/Root/Suffix (60%-Kaskade)              │  │
│  │    │                                                            │  │
│  │ 3. rollAttribute(layers, extractor, presets)                    │  │
│  │    └── 5x fuer: personality, value, quirk, appearance, goal    │  │
│  │    └── accumulateWithUnwanted() + Tag-Filter                   │  │
│  │    │                                                            │  │
│  │ 4. Return NPC (nicht persistieren)                              │  │
│  │    └── Caller verantwortlich fuer Persistierung                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│      │                                                               │
│      ▼                                                               │
│  Return: NPC                                                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API

### generateNPC()

```typescript
interface GenerateNPCOptions {
  position?: HexCoordinate;    // Fuer lastKnownPosition
  time: GameDateTime;          // Required - Caller muss Zeit uebergeben
}

function generateNPC(
  creature: CreatureDefinition,
  faction: Faction | null,
  options: GenerateNPCOptions
): NPC {
  // 1. Culture-Chain aufbauen (Register → Species/Type → Factions)
  const layers = resolveCultureChain(creature, faction);

  // 2. Name generieren
  const name = generateNameFromCulture(layers);

  // 3. Alle Attribute unabhaengig wuerfeln
  const personality = rollAttribute(layers, c => c.personality, personalityPresets);
  const value = rollAttribute(layers, c => c.values, valuePresets);
  const quirk = rollAttributeDescription(layers, c => c.quirks, quirkPresets, creature);
  const appearance = rollAttributeDescription(layers, c => c.appearance, appearancePresets, creature);
  const goal = rollAttributeDescription(layers, c => c.goals, goalPresets);

  const npc: NPC = {
    id: generateNPCId(),
    name,
    creature: { type: creature.tags[0], id: creature.id },
    factionId: faction?.id,
    personality: personality ?? 'neutral',
    value: value ?? 'survival',
    quirk,
    appearance,
    goal: goal ?? 'Ueberleben',
    status: 'alive',
    firstEncounter: options.time,
    lastEncounter: options.time,
    encounterCount: 1,
    lastKnownPosition: options.position,
    reputations: []
  };

  return npc;
}
```

---

## Kultur-Aufloesung

Die Kultur eines NPCs wird aus Register, Type/Species-Preset und Faction-Kette aufgeloest.

> **Vollstaendige Dokumentation:** [Culture-Resolution.md](Culture-Resolution.md)

**Hierarchie:**
```
Register (Base) → Species (oder Type als Fallback) → Faction-Kette
```

---

## Name-Generierung

Namen werden aus Naming-Pools der Culture-Layers generiert. Alle Pools werden mit 60%-Kaskade gemerged.

```typescript
function generateNameFromCulture(layers: CultureLayer[]): string {
  // Merge all naming components across layers
  const patterns = mergeWeightedPool(layers, c => c.naming?.patterns);
  const prefixes = mergeWeightedPool(layers, c => c.naming?.prefixes);
  const roots = mergeWeightedPool(layers, c => c.naming?.roots);
  const suffixes = mergeWeightedPool(layers, c => c.naming?.suffixes);
  const titles = mergeWeightedPool(layers, c => c.naming?.titles);

  // Select pattern from merged pool
  const pattern = weightedRandomSelect(patterns) ?? '{root}';

  // Fill placeholders from merged pools
  return pattern
    .replace('{prefix}', weightedRandomSelect(prefixes) ?? '')
    .replace('{root}', weightedRandomSelect(roots) ?? 'Unknown')
    .replace('{suffix}', weightedRandomSelect(suffixes) ?? '')
    .replace('{title}', weightedRandomSelect(titles) ?? '');
}
```

**Beispiel-Patterns:**
- `{prefix}{root}` → "Griknak"
- `{root}{suffix}` → "Snaggle"
- `{root} {title}` → "Muk der Grausame"

---

## Attribut-Wuerfeln

### rollAttribute()

Generische Funktion fuer alle 5 Attribute (personality, value, quirk, appearance, goal).

```typescript
function rollAttribute(
  layers: CultureLayer[],
  extractor: (culture: CultureData) => LayerTraitConfig | undefined,
  presets: AttributePreset[],
  creature?: CreatureDefinition
): string | undefined {
  // Gewichte ueber alle Layers akkumulieren (mit unwanted-Mechanik)
  const weights = accumulateWithUnwanted(layers, extractor);

  // Pool bauen aus Presets die Gewicht > 0 haben
  const creatureTags = creature?.tags ?? [];
  const pool = presets
    .filter(preset => {
      // Tag-Filter: Keine compatibleTags = kompatibel mit allen
      if (!preset.compatibleTags?.length) return true;
      return preset.compatibleTags.some(tag => creatureTags.includes(tag));
    })
    .map(preset => ({
      item: preset.id,
      randWeighting: weights.get(preset.id) ?? 0,
    }))
    .filter(entry => entry.randWeighting > 0);

  return weightedRandomSelect(pool) ?? undefined;
}
```

### Gewichtungs-Mechanik

> **Vollstaendige Dokumentation:** [Culture-Resolution.md](Culture-Resolution.md#Gewichtungs-Mechanik)

**60%-Kaskade:**
```
4 Layer: Register=21.6, Type/Species=36, Parent-Faction=60, Leaf-Faction=100
```

**unwanted viertelt bisherigen akkumulierten Wert:**
```
Trait "gutherzig":
- Register: +21.6     → akkumuliert: 21.6
- Goblin:   (nicht)   → akkumuliert: 21.6
- Rotfang:  unwanted  → 21.6 / 4 = 5.4
- Silberbl: +100      → 5.4 + 100 = 105.4
```

---

## Zentrales Register

Alle verfuegbaren Attribute werden zentral in `presets/npcAttributes/` definiert:

| Datei | Inhalt |
|-------|--------|
| `personality.ts` | ~30 Persoenlichkeits-Traits |
| `values.ts` | ~15 Werte/Prioritaeten |
| `quirks.ts` | ~25 Eigenheiten (mit compatibleTags) |
| `appearance.ts` | ~30 Aussehen-Merkmale (mit compatibleTags) |
| `goals.ts` | ~20 Ziele |

Das Register dient als **unterster Base-Layer** in der Culture-Resolution. Alle Traits sind initial verfuegbar und werden durch hoehere Layer gewichtet.

---

## Tag-Filterung

Quirks und Appearance koennen `compatibleTags` haben:

```typescript
{
  id: 'wagging_tail',
  name: 'Wedelt mit dem Schwanz',
  compatibleTags: ['beast', 'monstrosity']  // Nur fuer Tiere
}
```

- `compatibleTags: []` oder undefined → Fuer alle Kreaturen geeignet
- `compatibleTags: ['humanoid']` → Nur fuer Humanoide
- `compatibleTags: ['beast', 'monstrosity']` → Nur fuer Tiere/Monster

---

## Consumer-Beispiele

### Encounter-System

```typescript
// In encounterNPCs.ts
const npc = generateNPC(leadCreature, group.faction, {
  position: context.position,
  time: context.currentTime
});
```

### Quest-System

```typescript
// Quest-Geber NPC
const questGiver = generateNPC(merchantCreature, merchantGuild, {
  position: questLocation,
  time: currentTime
});
```

### Shop-System

```typescript
// Haendler-NPC
const shopkeeper = generateNPC(humanCreature, merchantFaction, {
  time: currentTime
});
```

---

## Siehe auch

- [NPC-Matching.md](NPC-Matching.md) - Existierenden NPC finden
- [Culture-Resolution.md](Culture-Resolution.md) - Kultur-Hierarchie und Aufloesung
- [NPC-Lifecycle.md](../../features/NPC-Lifecycle.md) - Persistierung und Status-Uebergaenge
- [npc.md](../../types/npc.md) - NPC-Schema

---

## Tasks

|  # | Status | Domain | Layer    | Beschreibung                                               |  Prio  | MVP? | Deps | Spec                                           | Imp.                                            |
|--:|:---------------------------------------------:|:-----|:-------|:---------------------------------------------------------|:----:|:--:|:---|:---------------------------------------------|:----------------------------------------------|
| 48 | generateNPC: Delegation an npcGenerator-Service | mittel | Nein     | -                                                          | mittel | Nein | -    | NPC-Generation.md#API                          | -                                               |
| 55 |                        ✅                        | NPCs   | services | Quirk-Filterung: compatibleTags aus Creature pruefen       | mittel | Nein | -    | NPC-Generation.md#Quirk-Generierung            | npcGenerator.ts.rollQuirkFromCulture() [ändern] |
| 56 |                        ✅                        | NPCs   | services | PersonalityBonus: Multiplikatoren auf Goals anwenden       | mittel | Nein | -    | NPC-Generation.md#PersonalGoal-Pool-Hierarchie | npcGenerator.ts.selectPersonalGoal() [ändern]   |
| 57 |                        ✅                        | NPCs   | services | getDefaultTime: Zeit aus sessionState statt Hardcoded-Wert | mittel | Nein | -    | NPC-Generation.md#API                          | npcGenerator.ts.getDefaultTime() [ändern]       |
