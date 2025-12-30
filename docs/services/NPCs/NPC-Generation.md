# NPC-Generation

> **Verantwortlichkeit:** Automatische NPC-Generierung
> **Input:** `CreatureDefinition`, `Faction?`, optionale Parameter
> **Output:** `NPC` (nicht persistiert - Caller ist verantwortlich fuer Persistierung)
> **Schema:** [npc.md](../../entities/npc.md)
>
> **Referenzierte Schemas:**
> - [creature.md](../../entities/creature.md) - Input: CreatureDefinition
> - [faction.md](../../entities/faction.md) - Faction mit eingebetteter Culture
> - [culture-data.md](../../entities/culture-data.md) - Naming, Personality, Quirks, Goals
>
> **Verwandte Dokumente:**
> - [Culture-Resolution.md](Culture-Resolution.md) - Kultur-Aufloesung (Hierarchie, Kaskade)
> - [NPC-Matching.md](NPC-Matching.md) - Existierenden NPC finden
> - [NPC-Lifecycle.md](../../features/NPC-Lifecycle.md) - Persistierung, Status-Uebergaenge

Wie werden neue NPCs generiert?

**Design-Philosophie:** NPC-Generierung ist ein generischer Service. Verschiedene Systeme (Encounter, Quest, Shop, POI) koennen NPCs automatisch generieren ohne spezifische Abhaengigkeiten.

---

## Datenfluss

```
┌─────────────────────────────────────────────────────────────────────┐
│  DATENFLUSS: NPC-Generation                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Aufrufer (Encounter, Quest, Shop, POI)                             │
│  └── generateNPC(creature, faction?, options?)                      │
│      │                                                               │
│      ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ NPC-GENERATION                                                  │  │
│  │                                                                 │  │
│  │ 1. resolveCultureForNPC(creature, faction)                      │  │
│  │    └── → Culture-Resolution.md                                  │  │
│  │    │                                                            │  │
│  │ 2. generateNameFromCulture(culture)                             │  │
│  │    └── Pattern + Prefix/Root/Suffix                             │  │
│  │    │                                                            │  │
│  │ 3. rollPersonalityFromCulture(culture)                          │  │
│  │    └── Primary + Secondary Trait                                │  │
│  │    │                                                            │  │
│  │ 4. rollQuirkFromCulture(culture, creature)                      │  │
│  │    └── Gefiltert nach Creature-Tags                             │  │
│  │    │                                                            │  │
│  │ 5. selectPersonalGoal(creature, culture, personality)           │  │
│  │    └── Pool-Hierarchie + Personality-Gewichtung                 │  │
│  │    │                                                            │  │
│  │ 6. Return NPC (nicht persistieren)                               │  │
│  │    └── Caller verantwortlich fuer Persistierung                 │  │
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
  time?: GameDateTime;         // Fuer firstEncounter/lastEncounter
}

function generateNPC(
  creature: CreatureDefinition,
  faction: Faction | null,
  options?: GenerateNPCOptions
): NPC {
  // Kultur aufloesen (→ Culture-Resolution.md)
  const culture = resolveCultureForNPC(creature, faction);

  // Name generieren aus Kultur
  const name = generateNameFromCulture(culture);

  // Persoenlichkeit wuerfeln
  const personality = rollPersonalityFromCulture(culture);

  // Quirk (gefiltert nach Kreatur-Kompatibilitaet)
  const quirk = rollQuirkFromCulture(culture, creature);

  // Persoenliches Ziel mit Pool-Hierarchie + Persoenlichkeits-Gewichtung
  const personalGoal = selectPersonalGoal(creature, culture, personality);

  const now = options?.time ?? getCurrentGameTime();

  const npc: NPC = {
    id: createEntityId('npc'),
    name,
    creature: { type: creature.type, id: creature.id },
    factionId: faction?.id ?? null,
    personality,
    quirk,
    personalGoal,
    status: 'alive',
    firstEncounter: now,
    lastEncounter: now,
    encounterCount: 1,
    lastKnownPosition: options?.position
  };

  // NPC zurueckgeben (Caller persistiert bei Bedarf)
  return npc;
}
```

---

## Kultur-Aufloesung

Die Kultur eines NPCs wird aus Type-Preset, Species-Culture und Faction-Kette aufgeloest.

> **Vollstaendige Dokumentation:** [Culture-Resolution.md](Culture-Resolution.md)

---

## Name-Generierung

```typescript
function generateNameFromCulture(culture: ResolvedCulture): string {
  const naming = culture.naming;
  if (!naming || naming.patterns.length === 0) {
    return generateGenericName();
  }

  // Zufaelliges Pattern waehlen
  const pattern = randomSelect(naming.patterns);

  // Platzhalter ersetzen
  return pattern
    .replace('{prefix}', randomSelect(naming.prefixes ?? ['']))
    .replace('{root}', randomSelect(naming.roots ?? ['']))
    .replace('{suffix}', randomSelect(naming.suffixes ?? ['']))
    .replace('{title}', randomSelect(naming.titles ?? ['']));
}
```

**Beispiel-Patterns:**
- `{prefix}{root}` → "Griknak"
- `{root}{suffix}` → "Snaggle"
- `{root} {title}` → "Muk der Grausame"

---

## Personality-Generierung

```typescript
interface PersonalityTraits {
  primary: string;
  secondary: string;
}

function rollPersonalityFromCulture(culture: ResolvedCulture): PersonalityTraits {
  const personality = culture.personality;
  if (!personality) {
    return { primary: 'neutral', secondary: 'reserved' };
  }

  // Gewichtete Auswahl aus common + rare Pools
  const allTraits = [
    ...personality.common,
    ...personality.rare
  ];

  // Primary und Secondary separat wuerfeln (keine Duplikate)
  const primary = weightedRandomSelect(allTraits).trait;
  const remaining = allTraits.filter(t => t.trait !== primary);
  const secondary = remaining.length > 0
    ? weightedRandomSelect(remaining).trait
    : 'neutral';

  return { primary, secondary };
}
```

---

## Quirk-Generierung

Jeder NPC kann einen Quirk aus dem Kultur-Pool erhalten:

```typescript
function rollQuirkFromCulture(
  culture: ResolvedCulture,
  creature: CreatureDefinition
): string | undefined {
  const quirks = culture.quirks ?? [];
  if (quirks.length === 0) return undefined;

  // Nach Kreatur-Kompatibilitaet filtern
  const compatible = quirks.filter(q =>
    q.compatibleTags.length === 0 ||
    q.compatibleTags.some(tag => creature.tags.includes(tag))
  );

  if (compatible.length === 0) return undefined;

  return weightedRandomSelect(compatible).quirk;
}
```

**Kompatibilitaets-Filter:**
- `compatibleTags: []` → Fuer alle Kreaturen geeignet
- `compatibleTags: ['humanoid']` → Nur fuer Humanoide
- `compatibleTags: ['beast', 'monstrosity']` → Nur fuer Tiere/Monster

---

## PersonalGoal-Pool-Hierarchie

Das persoenliche Ziel eines NPCs wird aus mehreren Quellen zusammengestellt:

```
Generischer Pool (alle Kreaturen)
    ↓ erweitert durch
Creature-Typ Pool (z.B. Wolf: find_food, protect_pack)
    ↓ erweitert durch
Fraktion Pool (z.B. Blutfang: please_blood_god, conquer)
    ↓ gewichtet durch
Persoenlichkeit (greedy → loot×2, cowardly → survive×2)
```

```typescript
function selectPersonalGoal(
  creature: CreatureDefinition,
  culture: ResolvedCulture,
  personality: PersonalityTraits
): string {
  // 1. Pools zusammenstellen
  const genericPool = GENERIC_GOALS;                    // System-Default
  const creaturePool = creature.goals ?? [];            // Creature-spezifisch
  const culturePool = culture.goals ?? [];              // Kultur-spezifisch

  const combinedPool = [...genericPool, ...creaturePool, ...culturePool];

  // 2. Persoenlichkeits-Gewichtung anwenden
  const weighted = combinedPool.map(g => {
    let weight = g.weight;

    // Bonus fuer passende Persoenlichkeit
    if (g.personalityBonus) {
      for (const bonus of g.personalityBonus) {
        if (personality.primary === bonus.trait || personality.secondary === bonus.trait) {
          weight *= bonus.multiplier;
        }
      }
    }

    return { ...g, weight };
  });

  return weightedRandomSelect(weighted).goal;
}

const GENERIC_GOALS: WeightedGoal[] = [
  { goal: 'survive', weight: 1.0, description: 'Am Leben bleiben' },
  { goal: 'profit', weight: 0.8, description: 'Profit machen' },
  { goal: 'power', weight: 0.6, description: 'Macht erlangen' },
  { goal: 'freedom', weight: 0.5, description: 'Freiheit bewahren' },
  { goal: 'revenge', weight: 0.3, description: 'Rache nehmen' }
];
```

**Beispiel:** Ein Goblin mit `personality: { primary: 'greedy', secondary: 'cowardly' }`:
- "loot" Goal hat `personalityBonus: [{ trait: 'greedy', multiplier: 2.0 }]` → Gewichtung verdoppelt
- "survive" Goal hat `personalityBonus: [{ trait: 'cowardly', multiplier: 1.5 }]` → 50% Bonus
- "help_others" Goal hat keine Bonus → normale Gewichtung (sehr unwahrscheinlich)

---

## Consumer-Beispiele

### Encounter-System

```typescript
// In Encounter.md Step 4.3 (groupNPCs)
const npc = generateNPC(leadCreature, group.faction, {
  position: context.position,
  time: context.currentTime
});
```

### Quest-System

```typescript
// Quest-Geber NPC
const questGiver = generateNPC(merchantCreature, merchantGuild, {
  position: questLocation
});
```

### Shop-System

```typescript
// Haendler-NPC
const shopkeeper = createNPC(humanCreature, merchantFaction);
```

---

## Siehe auch

- [NPC-Matching.md](NPC-Matching.md) - Existierenden NPC finden
- [Culture-Resolution.md](Culture-Resolution.md) - Kultur-Hierarchie und Aufloesung
- [NPC-Lifecycle.md](../../features/NPC-Lifecycle.md) - Persistierung und Status-Uebergaenge
- [npc.md](../../entities/npc.md) - NPC-Schema

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
