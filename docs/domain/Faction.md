# Faction

> **Lies auch:** [NPC-System](NPC-System.md), [POI](POI.md)
> **Wird benoetigt von:** Encounter

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

  // Encounter-Templates (optional)
  encounterTemplates?: FactionEncounterTemplate[];

  // Visualisierung
  displayColor: string;              // Hex-Farbe fuer Territory-Overlay, z.B. "#4169E1"

  // Metadaten
  description?: string;
  gmNotes?: string;
}

interface FactionCreatureGroup {
  creatureId: EntityId<'creature'>;  // Creature-Template
  count: number;                      // Anzahl dieser Kreatur in der Fraktion
}

interface FactionEncounterTemplate {
  id: string;
  name: string;                      // "Spaeher-Trupp", "Armee-Division"
  description?: string;

  // Zusammensetzung
  composition: TemplateCreatureSlot[];

  // Wann wird dieses Template verwendet?
  triggers?: {
    minXPBudget?: number;            // Mindest-Budget fuer dieses Template
    maxXPBudget?: number;            // Max-Budget
    terrainTypes?: EntityId<'terrain'>[];
    encounterTypes?: EncounterType[];
  };

  // Relative Wahrscheinlichkeit
  weight: number;                    // 1.0 = normal, 0.1 = selten
}

interface TemplateCreatureSlot {
  creatureId: EntityId<'creature'>;
  count: number | { min: number; max: number };
  role: 'leader' | 'elite' | 'regular' | 'support';
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

### Praesenz-Datenstruktur

```typescript
interface FactionPresence {
  factionId: EntityId<'faction'>;
  strength: number;               // 0.0 - 1.0
}
```

### Praesenz-Vorberechnung (Cartographer)

FactionPresence wird im **Cartographer vorberechnet** und auf Tiles gespeichert:

1. GM platziert Faction-kontrollierte POIs auf der Map
2. Cartographer berechnet Praesenz-Radius basierend auf Faction-Staerke
3. Ergebnis wird auf `OverworldTile.factionPresence[]` gespeichert

**Berechnungslogik:**

```typescript
// Wird im Cartographer ausgefuehrt, nicht zur Runtime
function calculatePresenceForTile(
  tile: HexCoordinate,
  faction: Faction,
  factionPOIs: POI[]
): number {
  if (factionPOIs.length === 0) return 0;

  // Distanz zum naechsten POI
  const minDistance = Math.min(
    ...factionPOIs.map(poi => hexDistance(tile, poi.position))
  );

  // Staerke berechnen (Summe aller Creature-Counts)
  const totalStrength = faction.creatures.reduce(
    (sum, group) => sum + group.count,
    0
  );

  // Reichweite basiert auf Staerke
  const maxRange = Math.sqrt(totalStrength) * 2;
  if (minDistance > maxRange) return 0;

  // Praesenz mit Distanz-Falloff
  return Math.min(1.0, (totalStrength / (minDistance + 1)) / totalStrength);
}
```

> **Verweis:** Siehe [Map-Feature.md](../features/Map-Feature.md) fuer OverworldTile-Schema

### Encounter-Integration

Bei Encounter-Generierung wird die vorberechnete Praesenz vom Tile gelesen:

```typescript
// Praesenz ist bereits auf dem Tile gespeichert
function getFactionsAtTile(tile: OverworldTile): FactionPresence[] {
  return tile.factionPresence ?? [];
}

function selectEncounterFaction(
  tile: OverworldTile
): EntityId<'faction'> | null {
  const presences = getFactionsAtTile(tile);

  if (presences.length === 0) return null;

  // Gewichtete Zufallsauswahl basierend auf Praesenz-Staerke
  return weightedRandomSelect(
    presences.map(p => ({ value: p.factionId, weight: p.strength }))
  );
}
```

---

## Encounter-Templates

Fraktionen koennen vordefinierte Encounter-Zusammensetzungen definieren. Diese Templates werden bei Encounter-Generierung verwendet, wenn das Budget zum Template passt.

### Template-Auswahl

```typescript
function selectMatchingTemplate(
  templates: FactionEncounterTemplate[],
  budget: number,
  context: EncounterContext
): FactionEncounterTemplate | undefined {
  const matching = templates.filter(t => {
    // Budget-Range pruefen
    if (t.triggers?.minXPBudget && budget < t.triggers.minXPBudget) return false;
    if (t.triggers?.maxXPBudget && budget > t.triggers.maxXPBudget) return false;

    // Terrain pruefen
    if (t.triggers?.terrainTypes && !t.triggers.terrainTypes.includes(context.terrain.id)) {
      return false;
    }

    // Encounter-Typ pruefen
    if (t.triggers?.encounterTypes && !t.triggers.encounterTypes.includes(context.encounterType)) {
      return false;
    }

    return true;
  });

  if (matching.length === 0) return undefined;

  // Gewichtete Zufallsauswahl
  return weightedRandomSelect(matching.map(t => ({ value: t, weight: t.weight })));
}
```

### Beispiel: Koenigliche Armee

```typescript
const ROYAL_ARMY: Faction = {
  id: 'royal-army',
  name: 'Koenigliche Armee',
  // ... culture, creatures, etc. ...
  encounterTemplates: [
    {
      id: 'scout-patrol',
      name: 'Spaeher-Patrouille',
      composition: [
        { creatureId: 'scout', count: 2, role: 'regular' },
      ],
      triggers: { maxXPBudget: 200 },
      weight: 1.0,
    },
    {
      id: 'standard-patrol',
      name: 'Standard-Patrouille',
      composition: [
        { creatureId: 'guard', count: { min: 4, max: 6 }, role: 'regular' },
        { creatureId: 'veteran', count: 1, role: 'leader' },
      ],
      triggers: { minXPBudget: 200, maxXPBudget: 1000 },
      weight: 1.0,
    },
    {
      id: 'reinforced-patrol',
      name: 'Verstaerkte Patrouille',
      composition: [
        { creatureId: 'guard', count: 10, role: 'regular' },
        { creatureId: 'knight', count: 1, role: 'leader' },
        { creatureId: 'war-horse', count: 1, role: 'support' },
      ],
      triggers: { minXPBudget: 1000, maxXPBudget: 3000 },
      weight: 0.5,  // Seltener als Standard
    },
    {
      id: 'army-division',
      name: 'Armee-Division',
      composition: [
        { creatureId: 'guard', count: { min: 30, max: 50 }, role: 'regular' },
        { creatureId: 'veteran', count: { min: 5, max: 10 }, role: 'elite' },
        { creatureId: 'knight', count: { min: 2, max: 4 }, role: 'leader' },
        { creatureId: 'priest', count: 1, role: 'support' },
      ],
      triggers: { minXPBudget: 5000 },
      weight: 0.01,  // Sehr selten - Armeen sind ungewoehnlich
    },
  ],
};
```

### Budget und Template-Wahrscheinlichkeit

Templates werden mit exponentiell fallender Wahrscheinlichkeit ausgewaehlt:

| Budget-Multiplikator | Wahrscheinlichkeit |
|---------------------|-------------------|
| 1× (Basis) | 50% |
| 2× | 25% |
| 4× | 12.5% |
| 8× | 6.25% |
| usw. | ... |

**Wichtig:** Das Template-Budget muss nicht ausgeschoepft werden. Ein Social-Encounter kann ein "Armee-Division" Template verwenden, aber es werden nur die Leader-NPCs fuer das Gespraech relevant sein - die Armee ist im Hintergrund.

→ Details zur Budget-Berechnung: [Encounter-Balancing.md](../features/Encounter-Balancing.md#avoidability-system)

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

*Siehe auch: [NPC.md](NPC.md) | [POI.md](POI.md) | [Encounter-System.md](../features/Encounter-System.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 1400 | Faction-Schema (id, name, parentId, culture, creatures, controlledPOIs, encounterTemplates, displayColor) | hoch | Ja | - | [Faction.md#schema](#schema) |
| 1417 | FactionEncounterTemplate Schema (id, name, composition, triggers, weight) | hoch | Ja | #1400 | [Faction.md#schema](#schema), [Faction.md#encounter-templates](#encounter-templates) |
| 1418 | TemplateCreatureSlot Schema (creatureId, count, role) | hoch | Ja | #1417 | [Faction.md#schema](#schema) |
| 1419 | selectMatchingTemplate(): Budget + Context → Template-Auswahl | hoch | Ja | #1417, #1418 | [Faction.md#template-auswahl](#template-auswahl), [Encounter-Balancing.md#budget-auswahl](../features/Encounter-Balancing.md#budget-auswahl-mit-exponentieller-wahrscheinlichkeit) |
| 1401 | CultureData-Schema (naming, personality, quirks, values, speech) | hoch | Ja | #1400 | [Faction.md#culturedata](#culturedata) |
| 1402 | FactionCreatureGroup-Schema (creatureId, count) | hoch | Ja | #1400, #1200 | [Faction.md#schema](#schema), [Creature.md#schema](Creature.md#schema) |
| 1403 | FactionPresence-Schema (factionId, strength) für Tile-Speicherung | hoch | Ja | #1400, #802 | [Faction.md#praesenz-datenstruktur](#praesenz-datenstruktur), [Map-Feature.md#overworldmap](../features/Map-Feature.md#overworldmap) |
| 1404 | WeightedTrait und WeightedQuirk Schemas | mittel | Ja | #1401 | [Faction.md#culturedata](#culturedata) |
| 1405 | resolveFactionCulture(): Hierarchie von Wurzel zu Blatt auflösen | hoch | Ja | #1400, #1401 | [Faction.md#kultur-vererbung](#kultur-vererbung), [NPC-System.md#npc-generierung](NPC-System.md#npc-generierung) |
| 1406 | mergeCultureData(): Kultur-Eigenschaften mergen mit Vererbungsregeln | hoch | Ja | #1405 | [Faction.md#merge-regeln](#merge-regeln), [Faction.md#kultur-vererbung](#kultur-vererbung) |
| 1407 | mergeWeightedTraits(): Helper für Trait-Merging mit Gewichtung | mittel | Ja | #1406 | [Faction.md#merge-regeln](#merge-regeln) |
| 1408 | mergeWeightedQuirks(): Helper für Quirk-Merging | mittel | Ja | #1406 | [Faction.md#merge-regeln](#merge-regeln) |
| 1409 | calculatePresenceForTile(): Präsenz-Vorberechnung im Cartographer | hoch | Ja | #1403, #1500, #802 | [Faction.md#praesenz-vorberechnung-cartographer](#praesenz-vorberechnung-cartographer), [POI.md#basepoi](POI.md#basepoi), [Map-Feature.md#overworldtile](../features/Map-Feature.md#overworldmap) |
| 1410 | getFactionsAtTile(): Vorberechnete Präsenz vom Tile lesen | hoch | Ja | #801, #802, #1409 | [Faction.md#encounter-integration](#encounter-integration), [Map-Feature.md#overworldtile](../features/Map-Feature.md#overworldmap) |
| 1411 | selectEncounterFaction(): Gewichtete Faction-Auswahl basierend auf Präsenz | hoch | Ja | #1410, #202 | [Faction.md#encounter-integration](#encounter-integration), [Encounter-System.md#tile-eligibility](../features/Encounter-System.md#tile-eligibility) |
| 1412 | Bundled Basis-Fraktionen: Humanoids, Goblins, Orcs, Undead, etc. | hoch | Ja | #1400, #1401 | [Faction.md#bundled-basis-fraktionen](#bundled-basis-fraktionen) |
| 1413 | Faction Events: create/update/delete-requested und Lifecycle-Events | mittel | Ja | #1400 | [Faction.md#events](#events) |
| 1414 | Faction Territory Events: poi-claimed, poi-lost | niedrig | Nein | #1413, #1500 | [Faction.md#events](#events), [POI.md#basepoi](POI.md#basepoi) |
| 1415 | Faction Library-View: CRUD-Interface für Faction-Bearbeitung | mittel | Ja | #1400, #1416, #2800 | [Faction.md#schema](#schema), [Library.md#tab-navigation](../application/Library.md#tab-navigation) |
| 1416 | Faction-Feature: FactionOrchestrator mit CRUD-Logik | mittel | Ja | #1400, #1413 | [Faction.md#schema](#schema), [Faction.md#events](#events) |
