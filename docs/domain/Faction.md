# Faction

Fraktionen mit eingebetteter Kultur und Territory-System.

**Design-Philosophie:** Factions sind die zentrale Organisationseinheit fuer NPCs, Kreaturen und Territorien. Kultur ist direkt in Factions eingebettet - keine separate Culture-Entity. Sub-Fraktionen erben und ueberschreiben Kultur-Eigenschaften.

---

## Uebersicht

Das Faction-System verwaltet:

1. **Hierarchische Fraktionen** - Basis-Fraktionen (Bundled) mit beliebig tiefen Sub-Fraktionen (User)
2. **Eingebettete Kultur** - Naming, Personality, Values direkt in der Fraktion
3. **Territory via POIs** - Praesenz basiert auf kontrollierten POIs
4. **Mitglieder-Definition** - Welche Creatures gehoeren zur Fraktion

```
Humanoids (Bundled Basis-Fraktion)
└── Goblins (Bundled Spezies-Fraktion)
    └── Blutfang-Stamm (User-Fraktion)
        └── Blutfang Spaeher-Trupp (User Sub-Fraktion)
```

---

## Schema

### Faction

```typescript
interface Faction {
  id: EntityId<'faction'>;
  name: string;
  parentId?: EntityId<'faction'>;  // Sub-Faction von...

  // Kultur direkt eingebettet (nicht referenziert)
  culture: CultureData;

  // Mitglieder
  creatures: FactionCreatureGroup[];

  // Territory via POIs
  controlledPOIs: EntityId<'poi'>[];

  // Metadaten
  description?: string;
  gmNotes?: string;
}

interface FactionCreatureGroup {
  creatureId: EntityId<'creature'>;  // Creature-Template
  count: number;                      // Anzahl dieser Kreatur in der Fraktion
}
```

### CultureData

Kultur-Daten werden hierarchisch vererbt. Nur Overrides muessen definiert werden - der Rest wird vom Parent geerbt.

```typescript
interface CultureData {
  // === Namensgenerierung ===
  naming?: {
    patterns?: string[];          // z.B. ["{prefix}{root}", "{root} {title}"]
    prefixes?: string[];
    roots?: string[];
    suffixes?: string[];
    titles?: string[];            // "der Grausame", "Haendler", etc.
  };

  // === Persoenlichkeit ===
  personality?: {
    common?: WeightedTrait[];     // Haeufige Traits
    rare?: WeightedTrait[];       // Seltene Traits
    forbidden?: string[];         // Traits die NICHT vorkommen
  };

  // === Quirks ===
  quirks?: WeightedQuirk[];

  // === Werte & Verhalten ===
  values?: {
    priorities?: string[];        // ["Ehre", "Familie", "Gold", ...]
    taboos?: string[];            // Was ist verpoent
    greetings?: string[];         // Typische Begruessungen
  };

  // === Sprache (RP-Hinweise) ===
  speech?: {
    dialect?: string;             // "formell", "grob", "blumig"
    commonPhrases?: string[];     // Typische Redewendungen
    accent?: string;              // Beschreibung des Akzents
  };
}

interface WeightedTrait {
  trait: string;
  weight: number;                 // 0.0 - 1.0
}

interface WeightedQuirk {
  quirk: string;
  weight: number;
  description: string;            // GM-Beschreibung fuer RP
}
```

---

## Kultur-Vererbung

### Aufloesung

Kultur wird von der Wurzel zur Blatt-Fraktion aufgeloest. Jede Ebene kann Eigenschaften ueberschreiben oder ergaenzen.

```typescript
function resolveFactionCulture(faction: Faction): ResolvedCulture {
  const chain: Faction[] = [];
  let current: Faction | null = faction;

  // Kette aufbauen: Blatt -> Wurzel
  while (current) {
    chain.push(current);
    current = current.parentId
      ? entityRegistry.get('faction', current.parentId)
      : null;
  }

  // Von Wurzel nach Blatt mergen
  return chain.reverse().reduce(
    (base, f) => mergeCultureData(base, f.culture),
    {} as ResolvedCulture
  );
}

function mergeCultureData(base: ResolvedCulture, override: CultureData): ResolvedCulture {
  return {
    naming: {
      patterns: override.naming?.patterns ?? base.naming?.patterns,
      prefixes: [...(base.naming?.prefixes ?? []), ...(override.naming?.prefixes ?? [])],
      roots: [...(base.naming?.roots ?? []), ...(override.naming?.roots ?? [])],
      suffixes: [...(base.naming?.suffixes ?? []), ...(override.naming?.suffixes ?? [])],
      titles: [...(base.naming?.titles ?? []), ...(override.naming?.titles ?? [])]
    },
    personality: {
      common: mergeWeightedTraits(base.personality?.common, override.personality?.common),
      rare: mergeWeightedTraits(base.personality?.rare, override.personality?.rare),
      forbidden: [...(base.personality?.forbidden ?? []), ...(override.personality?.forbidden ?? [])]
    },
    quirks: mergeWeightedQuirks(base.quirks, override.quirks),
    values: {
      priorities: override.values?.priorities ?? base.values?.priorities,
      taboos: [...(base.values?.taboos ?? []), ...(override.values?.taboos ?? [])],
      greetings: override.values?.greetings ?? base.values?.greetings
    },
    speech: override.speech ?? base.speech
  };
}
```

### Merge-Regeln

| Eigenschaft | Merge-Verhalten |
|-------------|-----------------|
| `naming.patterns` | Override ersetzt komplett |
| `naming.prefixes/roots/...` | Append (addiert zur Parent-Liste) |
| `personality.common/rare` | Merge mit Gewichtungs-Update |
| `personality.forbidden` | Append (akkumuliert) |
| `values.priorities` | Override ersetzt komplett |
| `values.taboos` | Append (akkumuliert) |
| `speech` | Override ersetzt komplett |

---

## Territory-System

### POI-basierte Praesenz

Fraktionen kontrollieren Territorium nicht direkt ueber Tiles, sondern ueber **POIs**. Die Praesenz auf umliegenden Tiles wird projiziert.

```
Faction A kontrolliert:
├── POI: "Blutfang-Hoehle" auf Tile (5, 3)
└── POI: "Wachturm Nord" auf Tile (8, 7)

Praesenz wird projiziert basierend auf:
├── Kombinierte Staerke (Summe aller Kreaturen)
└── Distanz zum naechsten POI
```

### Praesenz-Berechnung

```typescript
interface FactionPresence {
  factionId: EntityId<'faction'>;
  strength: number;               // 0.0 - 1.0
}

function calculatePresenceAtTile(
  tile: HexCoordinate,
  factions: Faction[],
  pois: POI[]
): FactionPresence[] {
  const presences: FactionPresence[] = [];

  for (const faction of factions) {
    // POIs dieser Fraktion finden
    const factionPOIs = pois.filter(
      poi => faction.controlledPOIs.includes(poi.id)
    );

    if (factionPOIs.length === 0) continue;

    // Distanz zum naechsten POI
    const minDistance = Math.min(
      ...factionPOIs.map(poi => hexDistance(tile, poi.position))
    );

    // Staerke berechnen (Summe aller Creature-Counts)
    const totalStrength = faction.creatures.reduce(
      (sum, group) => sum + group.count,
      0
    );

    // Praesenz = Staerke / Distanz (mit Falloff)
    const maxRange = Math.sqrt(totalStrength) * 2;  // Reichweite basiert auf Staerke
    if (minDistance <= maxRange) {
      const presence = (totalStrength / (minDistance + 1)) / totalStrength;
      presences.push({
        factionId: faction.id,
        strength: Math.min(1.0, presence)
      });
    }
  }

  return presences;
}
```

### Encounter-Integration

Bei Encounter-Generierung wird die Fraktions-Praesenz beruecksichtigt:

```typescript
function selectEncounterFaction(
  tile: HexCoordinate,
  context: EncounterContext
): EntityId<'faction'> | null {
  const presences = calculatePresenceAtTile(tile, allFactions, allPOIs);

  if (presences.length === 0) return null;

  // Gewichtete Zufallsauswahl basierend auf Praesenz-Staerke
  return weightedRandomSelect(
    presences.map(p => ({ value: p.factionId, weight: p.strength }))
  );
}
```

---

## NPC-Integration

NPCs haben genau eine Fraktion. Ihre moeglichen Aufenthaltsorte werden durch das Territory der Fraktion bestimmt (oder durch einen expliziten POI).

```typescript
interface NPC {
  // ...
  factionId: EntityId<'faction'>;     // Required
  currentPOI?: EntityId<'poi'>;       // Optional: Expliziter Aufenthaltsort
  // ...
}

// Bei NPC-Generierung
function generateNPCForEncounter(
  faction: Faction,
  context: EncounterContext
): NPC {
  const culture = resolveFactionCulture(faction);

  return {
    id: createEntityId('npc'),
    name: generateName(culture),
    factionId: faction.id,
    personality: rollPersonality(culture),
    quirk: rollQuirk(culture),
    // ...
  };
}
```

---

## Bundled Basis-Fraktionen

SaltMarcher liefert vordefinierte Basis-Fraktionen aus. Diese dienen als Wurzeln fuer User-erstellte Sub-Fraktionen.

### Beispiel: Humanoids -> Goblins

```typescript
const FACTION_HUMANOIDS: Faction = {
  id: 'base-humanoids',
  name: 'Humanoids',
  culture: {
    naming: {
      patterns: ['{root}']
    },
    personality: {
      common: [
        { trait: 'social', weight: 0.7 }
      ]
    }
  },
  creatures: [],
  controlledPOIs: []
};

const FACTION_GOBLINS: Faction = {
  id: 'base-goblins',
  name: 'Goblins',
  parentId: 'base-humanoids',
  culture: {
    naming: {
      patterns: ['{prefix}{root}', '{root}{suffix}'],
      prefixes: ['Grik', 'Snag', 'Muk', 'Zit'],
      roots: ['nak', 'gob', 'rik', 'snik'],
      suffixes: ['le', 'ik', 'az', 'uz']
    },
    personality: {
      common: [
        { trait: 'cunning', weight: 0.7 },
        { trait: 'cowardly', weight: 0.6 },
        { trait: 'greedy', weight: 0.8 }
      ],
      rare: [
        { trait: 'brave', weight: 0.1 }
      ]
    },
    quirks: [
      { quirk: 'nervous_laugh', weight: 0.3, description: 'Kichert nervoes' },
      { quirk: 'hoards_shiny', weight: 0.4, description: 'Sammelt Glaenzendes' }
    ],
    values: {
      priorities: ['survival', 'loot', 'pleasing_boss'],
      taboos: ['direct_confrontation', 'sharing_treasure']
    },
    speech: {
      dialect: 'broken',
      commonPhrases: ['Nicht toeten!', 'Hab Schatz!', 'Boss sagt...'],
      accent: 'hoch, schnell, nervoes'
    }
  },
  creatures: [],
  controlledPOIs: []
};
```

### User-Fraktion: Blutfang-Stamm

```typescript
const FACTION_BLOODFANG: Faction = {
  id: 'user-bloodfang',
  name: 'Blutfang-Stamm',
  parentId: 'base-goblins',
  culture: {
    naming: {
      // Erbt von Goblins, fuegt nur Titel hinzu
      titles: ['Blutfang', 'Schaedelsammler', 'Knochenbrecher']
    },
    personality: {
      common: [
        { trait: 'aggressive', weight: 0.9 },
        { trait: 'fanatical', weight: 0.6 }
      ],
      forbidden: ['cowardly']  // Blutfangs sind NICHT feige
    },
    quirks: [
      { quirk: 'war_paint', weight: 0.8, description: 'Traegt rote Kriegsbemalung' },
      { quirk: 'trophy_collector', weight: 0.5, description: 'Sammelt Feind-Knochen' }
    ],
    values: {
      priorities: ['blood_god', 'conquest', 'strength'],
      taboos: ['retreat', 'mercy']
    }
  },
  creatures: [
    { creatureId: 'goblin-warrior', count: 20 },
    { creatureId: 'goblin-shaman', count: 3 },
    { creatureId: 'hobgoblin-captain', count: 1 }
  ],
  controlledPOIs: ['bloodfang-cave', 'ruined-watchtower']
};
```

---

## Generierungsfunktionen

### Name generieren

```typescript
function generateName(culture: ResolvedCulture): string {
  const pattern = randomSelect(culture.naming.patterns) ?? '{root}';

  return pattern
    .replace('{prefix}', randomSelect(culture.naming.prefixes) ?? '')
    .replace('{root}', randomSelect(culture.naming.roots) ?? 'Unknown')
    .replace('{suffix}', randomSelect(culture.naming.suffixes) ?? '')
    .replace('{title}', randomSelect(culture.naming.titles) ?? '')
    .trim();
}
```

### Persoenlichkeit wuerfeln

```typescript
function rollPersonality(culture: ResolvedCulture): PersonalityTraits {
  // Forbidden-Traits filtern
  const allowed = (culture.personality.common ?? []).filter(
    t => !culture.personality.forbidden?.includes(t.trait)
  );

  const pool = [...allowed, ...(culture.personality.rare ?? [])];

  return {
    primary: weightedRandomSelect(allowed)?.trait ?? 'neutral',
    secondary: weightedRandomSelect(pool)?.trait ?? 'cautious'
  };
}
```

### Quirk wuerfeln

```typescript
function rollQuirk(culture: ResolvedCulture): string | undefined {
  if (Math.random() > 0.3) return undefined;  // 30% Chance
  return weightedRandomSelect(culture.quirks ?? [])?.quirk;
}
```

---

## Events

```typescript
// Faction-Requests
'faction:create-requested': {
  faction: Faction;
}
'faction:update-requested': {
  factionId: EntityId<'faction'>;
  changes: Partial<Faction>;
}
'faction:delete-requested': {
  factionId: EntityId<'faction'>;
}

// Faction-Changes
'faction:created': {
  faction: Faction;
}
'faction:updated': {
  factionId: EntityId<'faction'>;
  faction: Faction;
}
'faction:deleted': {
  factionId: EntityId<'faction'>;
}

// Territory-Events
'faction:poi-claimed': {
  factionId: EntityId<'faction'>;
  poiId: EntityId<'poi'>;
}
'faction:poi-lost': {
  factionId: EntityId<'faction'>;
  poiId: EntityId<'poi'>;
}
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Faction-Schema | ✓ | | Kern-Entity |
| CultureData eingebettet | ✓ | | Ersetzt separate Culture-Entity |
| Hierarchische Vererbung | ✓ | | Beliebige Tiefe |
| Bundled Basis-Fraktionen | ✓ | | Humanoids, Goblins, etc. |
| POI-basiertes Territory | ✓ | | Einfaches Praesenz-System |
| NPC-Integration | ✓ | | NPCs haben genau eine Faction |
| Dynamische Faction-Interaktionen | | niedrig | Automatisierte Konflikte |
| Diplomatie-System | | niedrig | Allianzen, Feindschaften |

---

*Siehe auch: [NPC.md](NPC.md) | [POI.md](POI.md) | [Encounter-Feature.md](../features/Encounter-Feature.md)*
