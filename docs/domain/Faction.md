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

  // === Status (Dynamische Welt) ===
  status: FactionStatus;             // active | dormant | extinct

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

  // Party-Beziehung
  reputationWithParty: number;       // -100 (Erzfeind) bis +100 (Verbündeter), default 0

  // Metadaten
  description?: string;
  gmNotes?: string;
}

type FactionStatus =
  | 'active'    // Fraktion ist aktiv und kann in Encounters erscheinen
  | 'dormant'   // Fraktion ist inaktiv (z.B. vertrieben), kann reaktiviert werden
  | 'extinct';  // Fraktion ist ausgeloescht, erscheint nicht mehr

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

  // === Activities (Gruppen-basiert, → encounter/Flavour.md) ===
  activities?: FactionActivityRef[];  // Referenzen auf Activity-Entities mit Gewichtung

  // === Goals (NPC-spezifisch) ===
  goals?: WeightedGoal[];           // Pool fuer NPC-Goals

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
  compatibleTags?: string[];      // Kreatur-Tags fuer Kompatibilitaet (z.B. ['canSpeak', 'socialCreature'])
                                  // Wenn leer/undefined: fuer alle Kreaturen geeignet
}

interface FactionActivityRef {
  activityId: EntityId<'activity'>;  // Referenz auf Activity-Entity
  weight: number;                     // Fraktions-spezifische Gewichtung (1.0 = normal)
}
// Activity-Entity enthält: name, properties (awareness/mobility/focus), contextTags
// → Schema: EntityRegistry.md#activity-activity

interface WeightedGoal {
  goal: string;                   // z.B. "loot", "protect_territory", "find_food"
  weight: number;
  description?: string;           // GM-Beschreibung
  personalityBonus?: {            // Gewichtungs-Bonus bei passender Persoenlichkeit
    trait: string;                // z.B. "greedy"
    multiplier: number;           // z.B. 2.0 (verdoppelt Gewichtung)
  }[];
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
  strength: number;               // CR-Summe der Fraktion auf diesem Tile
}
```

**Wichtig:** `strength` ist die **effektive CR-Summe** der Fraktion auf diesem Tile, nicht ein normalisierter Wert. Beispiel: Eine Fraktion mit 15 Goblins (CR 1/4) und 2 Goblin-Bossen (CR 1) hat eine Basis-CR von `15×0.25 + 2×1 = 5.75`. Auf einem entfernten Tile sinkt dieser Wert durch den Distanz-Modifier.

### Praesenz-Vorberechnung (Cartographer)

FactionPresence wird im **Cartographer vorberechnet** und auf Tiles gespeichert:

1. GM platziert Faction-kontrollierte POIs auf der Map
2. Cartographer berechnet Praesenz-Radius basierend auf Faction-Staerke
3. Ergebnis wird auf `OverworldTile.factionPresence[]` gespeichert

**Berechnungslogik (CR-Verteilung):**

Die Gesamt-CR einer Fraktion wird auf alle Tiles im Territorium **verteilt** (nicht kopiert). Tiles naeher am POI bekommen einen groesseren Anteil.

```typescript
// Wird im Cartographer ausgefuehrt, nicht zur Runtime
function distributePresenceToTiles(
  faction: Faction,
  factionPOIs: POI[],
  allTiles: OverworldTile[],
  creatureRegistry: Map<EntityId<'creature'>, CreatureDefinition>
): void {
  if (factionPOIs.length === 0) return;

  // 1. CR-Summe berechnen: Σ(creature.cr × count)
  const crTotal = faction.creatures.reduce((sum, group) => {
    const creature = creatureRegistry.get(group.creatureId);
    return sum + ((creature?.cr ?? 0) * group.count);
  }, 0);

  // 2. Maximale Reichweite berechnen
  const maxRange = Math.sqrt(crTotal) * 2;

  // 3. Alle Tiles im Territorium finden und Gewichte berechnen
  const tilesWithWeights: Array<{ tile: OverworldTile; weight: number }> = [];

  for (const tile of allTiles) {
    const minDistance = Math.min(
      ...factionPOIs.map(poi => hexDistance(tile.coordinate, poi.position))
    );

    if (minDistance <= maxRange) {
      // Gewicht: Je naeher am POI, desto hoeher (1/(d+1))
      const weight = 1 / (minDistance + 1);
      tilesWithWeights.push({ tile, weight });
    }
  }

  // 4. Gewichte normalisieren (Summe = 1)
  const totalWeight = tilesWithWeights.reduce((sum, tw) => sum + tw.weight, 0);

  // 5. CR verteilen - jedes Tile bekommt seinen Anteil
  for (const { tile, weight } of tilesWithWeights) {
    const normalizedWeight = weight / totalWeight;
    const presence = tile.factionPresence?.find(p => p.factionId === faction.id);
    if (presence) {
      presence.strength = crTotal * normalizedWeight;
    }
  }
}
```

**Wichtig:** Die Summe aller `factionPresence[].strength` ueber alle Tiles entspricht exakt der Gesamt-CR der Fraktion. Dies ist ein Budget-System, kein Kopier-System.

**Beispiel (Blutfang-Goblins, 5.75 CR gesamt, 7 Tiles im Territorium):**

| Tile | Distanz | Gewicht | Normalisiert | CR-Anteil |
|------|---------|---------|--------------|-----------|
| POI | 0 | 1.00 | 0.35 | 2.01 |
| A | 1 | 0.50 | 0.175 | 1.01 |
| B | 1 | 0.50 | 0.175 | 1.01 |
| C | 2 | 0.33 | 0.115 | 0.66 |
| D | 2 | 0.33 | 0.115 | 0.66 |
| E | 3 | 0.25 | 0.035 | 0.20 |
| F | 3 | 0.25 | 0.035 | 0.20 |
| **Summe** | | **2.86** | **1.00** | **5.75** |

Die Tabelle zeigt: POI-Tile bekommt den groessten Anteil (2.01 CR), entfernte Tiles bekommen weniger. Die Summe aller CR-Anteile ergibt exakt die Gesamt-CR (5.75)

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

→ Details zur Budget-Berechnung: [encounter/Balance.md](../features/encounter/Balance.md)(../features/encounter/Balance.md#avoidability-system)

---

## Faction-Status

Das `status`-Feld trackt den Lebenszyklus einer Fraktion in der dynamischen Spielwelt.

### Status-Werte

| Status | Bedeutung | Encounter-Generierung | Kann reaktiviert werden? |
|--------|-----------|----------------------|--------------------------|
| `active` | Fraktion ist aktiv | Ja, normal | - |
| `dormant` | Fraktion ist inaktiv/vertrieben | Nein | Ja, durch GM |
| `extinct` | Fraktion ist ausgeloescht | Nein | Ja, durch GM (Wiederbelebung) |

### Status-Uebergaenge

```
                    ┌─────────────────────────────────┐
                    │                                 │
                    ▼                                 │
              ┌──────────┐                            │
              │  active  │ ◄──── (initial/default)   │
              └────┬─────┘                            │
                   │                                  │
        ┌──────────┼──────────┐                       │
        │          │          │                       │
        ▼          │          ▼                       │
┌──────────┐       │    ┌──────────┐                  │
│ dormant  │───────┴───►│ extinct  │                  │
└────┬─────┘            └────┬─────┘                  │
     │                       │                        │
     │     (GM reaktiviert)  │                        │
     └───────────────────────┴────────────────────────┘
```

### Automatische Status-Aenderungen

| Trigger | Aktion |
|---------|--------|
| Alle `creature.count` = 0 nach Attrition | Status → `extinct` |
| GM setzt manuell | Beliebiger Status-Wechsel |
| GM fuegt neue Creatures hinzu bei `extinct` | Status → `active` (empfohlen) |

**Hinweis:** Der Status `extinct` ist keine Loeschung. Die Fraktion bleibt im System erhalten - mit History, Reputation, und POI-Referenzen. Der GM kann sie jederzeit reaktivieren (z.B. "Die Blutfang-Goblins sind zurueckgekehrt!").

### Encounter-Filter

Bei der Encounter-Generierung werden nur `active` Fraktionen beruecksichtigt:

```typescript
function getActiveFactionsAtTile(tile: OverworldTile): FactionPresence[] {
  return tile.factionPresence?.filter(presence => {
    const faction = entityRegistry.get('faction', presence.factionId);
    return faction?.status === 'active';
  }) ?? [];
}
```

---

## Attrition-Mechanik

Nach Combat-Encounters werden getoetete Kreaturen automatisch von der Fraktions-Staerke abgezogen. Dies ermoeglicht emergentes Gameplay: "Die Goblin-Bedrohung wurde eingedaemmt."

### Ablauf

```
Combat endet
    │
    ├── Fuer jede getoetete Kreatur:
    │   │
    │   └── Wenn Kreatur zu einer Fraktion gehoert:
    │       │
    │       └── faction.creatures[creatureId].count -= 1
    │
    ├── Praesenz neu berechnen (Staerke hat sich geaendert)
    │
    └── Falls alle Counts = 0:
        └── faction.status = 'extinct'
```

### Integration im Encounter-Service

Der Hook-Punkt fuer Attrition ist nach der Combat-Resolution:

```typescript
// In encounter-service.ts nach Combat-Outcome
function applyAttrition(
  outcome: CombatOutcome,
  factionId?: EntityId<'faction'>
): void {
  if (!factionId) return;

  const faction = entityRegistry.get('faction', factionId);
  if (!faction) return;

  // Getoetete Kreaturen zaehlen
  const casualties = outcome.defeatedCreatures ?? [];

  for (const casualty of casualties) {
    const group = faction.creatures.find(g => g.creatureId === casualty.creatureId);
    if (group) {
      group.count = Math.max(0, group.count - casualty.count);
    }
  }

  // Status pruefen
  const totalRemaining = faction.creatures.reduce((sum, g) => sum + g.count, 0);
  if (totalRemaining === 0) {
    faction.status = 'extinct';
    eventBus.emit('faction:status-changed', {
      factionId: faction.id,
      previousStatus: 'active',
      newStatus: 'extinct',
      correlationId: generateCorrelationId()
    });
  }

  // Fraktion speichern
  entityRegistry.update('faction', faction);

  // Praesenz-Neuberechnung triggern
  eventBus.emit('faction:attrition-applied', {
    factionId: faction.id,
    casualties,
    remainingStrength: totalRemaining,
    correlationId: generateCorrelationId()
  });
}
```

### Praesenz-Neuberechnung

Nach Attrition muss die Praesenz auf betroffenen Tiles neu berechnet werden:

```typescript
// Listener im Cartographer/Map-Feature
eventBus.on('faction:attrition-applied', (payload) => {
  const faction = entityRegistry.get('faction', payload.factionId);
  if (!faction) return;

  // Alle Tiles mit dieser Fraktion finden
  const affectedTiles = findTilesWithFactionPresence(faction.id);

  // Praesenz neu berechnen
  for (const tile of affectedTiles) {
    recalculatePresenceForTile(tile, faction);
  }
});
```

### UI-Feedback

Nach Attrition zeigt die DetailView ein Feedback-Banner:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚔️ Combat abgeschlossen                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📉 Blutfang-Stamm geschwaeacht                            │
│     Goblin Warriors: 20 → 15 (-5)                          │
│     Goblin Shaman: 3 → 2 (-1)                              │
│                                                             │
│  💀 Falls extinct:                                          │
│     "Der Blutfang-Stamm wurde ausgeloescht!"               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

→ Details: [DetailView.md](../application/DetailView.md#post-combat-resolution)

### Encounter ohne Fraktions-Zuordnung

Nicht alle Encounter-Kreaturen gehoeren zu einer Fraktion:

| Kreatur-Typ | Fraktions-Zuordnung | Attrition |
|-------------|---------------------|-----------|
| Fraktion-NPC | `creature.factionId` gesetzt | Ja |
| Zufalls-Monster | Keine `factionId` | Nein |
| Wild-Tiere | Keine `factionId` | Nein |
| Promovierte Creature | Nach Promotion: `factionId` gesetzt | Ja |

**Konsequenz:** Nur Begegnungen mit Fraktions-Kreaturen beeinflussen die Welt langfristig. Ein zufaellig generiertes Wolfsrudel reduziert keine Fraktions-Staerke.

---

## Entity Promotion

Nach einem Encounter mit nicht-fraktions-gebundenen Kreaturen bietet das System die Moeglichkeit, diese als persistente Entities zu speichern.

### Trigger

Entity Promotion wird angeboten wenn:

1. Encounter enthaelt Kreaturen **ohne** `factionId`
2. Combat wurde abgeschlossen (nicht geflohen)

**Nicht** angeboten wenn:
- Alle Kreaturen bereits einer Fraktion angehoeren
- Encounter wurde durch Flucht beendet

### Promotion-Dialog

```
┌─────────────────────────────────────────────────────────────┐
│  🐉 Kreatur persistieren?                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "Ancient Red Dragon" als persistenten NPC anlegen?         │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Name: [Scaldrath der Rote____________]                  ││
│  │                                                         ││
│  │ ☑ Hort-POI erstellen                                   ││
│  │   Vorgeschlagener Ort: Berggipfel bei (12, 8)          ││
│  │   [📍 Ort anpassen...]                                 ││
│  │                                                         ││
│  │ ☑ Neue Fraktion erstellen                              ││
│  │   Name: [Scaldrath's Brut_____________]                ││
│  │   Parent: [Dragons (Basis) ▼]                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Ueberspringen]                      [Persistieren]        │
└─────────────────────────────────────────────────────────────┘
```

### Ergebnis der Promotion

Bei Bestaetigung werden erstellt:

1. **NPC-Entity** mit den Encounter-Daten als Basis
2. **POI** fuer den Hort/Aufenthaltsort (falls aktiviert)
3. **LootContainer** am POI (falls Kreatur eine `defaultLootTable` hat)
4. **Fraktion** (falls aktiviert, mit der Kreatur als einzigem Member)

```typescript
interface PromotionResult {
  npc: NPC;
  poi?: POI;
  lootContainer?: LootContainer;
  faction?: Faction;
}

function promoteCreature(
  creature: EncounterCreature,
  options: PromotionOptions
): PromotionResult {
  // NPC erstellen
  const npc: NPC = {
    id: generateId('npc'),
    name: options.name,
    creatureId: creature.creatureId,
    factionId: options.createFaction ? generateId('faction') : undefined,
    // ... weitere Felder aus creature uebernehmen
  };

  // POI erstellen (falls aktiviert)
  let poi: POI | undefined;
  if (options.createPOI) {
    poi = {
      id: generateId('poi'),
      name: `Hort von ${options.name}`,
      position: options.poiPosition,
      type: 'lair',
      // ...
    };
  }

  // LootContainer erstellen (falls Kreatur LootTable hat)
  let lootContainer: LootContainer | undefined;
  if (poi && creature.defaultLootTable) {
    lootContainer = instantiateLootTable(
      creature.defaultLootTable,
      poi.id,
      `Hort von ${options.name}`
    );
  }

  // Fraktion erstellen (falls aktiviert)
  let faction: Faction | undefined;
  if (options.createFaction) {
    faction = {
      id: npc.factionId!,
      name: options.factionName,
      parentId: options.factionParent,
      status: 'active',
      creatures: [{ creatureId: creature.creatureId, count: 1 }],
      controlledPOIs: poi ? [poi.id] : [],
      // ...
    };
  }

  return { npc, poi, lootContainer, faction };
}
```

### POI-Vorschlag

Das System schlaegt einen Ort fuer den Hort basierend auf:

1. **Encounter-Position** - In der Naehe des Kampfortes
2. **Terrain-Praeferenz** - Basierend auf Kreatur-Tags (z.B. Dragon → Berge)
3. **Freie Tiles** - Nicht bereits von anderen POIs belegt

```typescript
function suggestHoardLocation(
  encounterPosition: HexCoordinate,
  creature: EncounterCreature
): HexCoordinate {
  // Nahe Tiles finden
  const nearbyTiles = getTilesInRadius(encounterPosition, 3);

  // Nach Terrain-Praeferenz sortieren
  const preferred = nearbyTiles.filter(tile =>
    creature.preferredTerrain?.includes(tile.terrainId) ?? true
  );

  // Erstes freies Tile waehlen
  return preferred.find(tile => !hasPOI(tile)) ?? encounterPosition;
}
```

→ Details: [encounter/Encounter.md](../features/encounter/Encounter.md#entity-promotion)

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

Jeder NPC bekommt einen Quirk - gefiltert nach Kreatur-Kompatibilitaet.

```typescript
function rollQuirk(
  culture: ResolvedCulture,
  creature: CreatureDefinition,
  usedQuirks: Set<string>
): string {
  const quirks = culture.quirks ?? [];

  // 1. Nach Kreatur-Kompatibilitaet filtern
  const compatible = quirks.filter(q => {
    if (!q.compatibleTags || q.compatibleTags.length === 0) return true;
    return q.compatibleTags.some(tag => creature.tags?.includes(tag));
  });

  // 2. Bereits verwendete Quirks ausschliessen (Einzigartigkeit)
  const available = compatible.filter(q => !usedQuirks.has(q.quirk));

  // 3. Fallback: Wenn alle Quirks verwendet, erlaube Wiederholung
  const pool = available.length > 0 ? available : compatible;

  if (pool.length === 0) {
    return 'unremarkable';  // Fallback wenn kein Quirk definiert
  }

  const selected = weightedRandomSelect(pool);
  usedQuirks.add(selected.quirk);
  return selected.quirk;
}
```

**Quirk-Kompatibilitaet:**

| Quirk-Typ | compatibleTags | Beispiel |
|-----------|----------------|----------|
| Sprachbasiert | `['canSpeak']` | "Redet schnell", "Stottert" |
| Sozial | `['socialCreature']` | "Vermeidet Blickkontakt" |
| Physisch | `[]` (alle) | "Hinkt", "Narbe im Gesicht" |
| Verhaltensbasiert | `[]` (alle) | "Nervoes", "Aggressiv" |

**Einzigartigkeit:** Bereits verwendete Quirks werden getrackt und bevorzugt nicht wiederverwendet. Bei erschoepftem Pool werden Wiederholungen erlaubt.

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

// Dynamische Welt Events
'faction:attrition-applied': {
  factionId: EntityId<'faction'>;
  casualties: Array<{ creatureId: EntityId<'creature'>; count: number }>;
  remainingStrength: number;
  correlationId: string;
}
'faction:status-changed': {
  factionId: EntityId<'faction'>;
  previousStatus: FactionStatus;
  newStatus: FactionStatus;
  correlationId: string;
}
```

---

## Party-Reputation

Das `reputationWithParty` Feld trackt die Beziehung zwischen der Party und einer Fraktion. Der GM entscheidet bei Encounter-Abschluss, ob und wie sich die Reputation aendert.

### Wertebereich

| Wert | Bedeutung | Beispiel |
|-----:|-----------|----------|
| -100 | Erzfeind | Party hat Fraktionsanfuehrer getoetet |
| -50 | Feindlich | Party hat wiederholt Fraktionsmitglieder angegriffen |
| -20 | Misstrauisch | Party hat Handelsabkommen gebrochen |
| 0 | Neutral | Kein Kontakt / Standard |
| +20 | Freundlich | Party hat bei Aufgabe geholfen |
| +50 | Verbuendet | Party hat Fraktion vor Bedrohung gerettet |
| +100 | Vertrauenswuerdig | Langjaerige Zusammenarbeit, viele Gefallen |

### Workflow bei Encounter-Abschluss

```
encounter:resolve-requested
    │
    ├── Encounter abschliessen (XP, Loot, etc.)
    │
    └── Falls Encounter NPCs mit factionId enthielt:
        │
        └── GM-Dialog: "Reputation mit [Fraktion] aendern?"
            ├── [-20] [-10] [0] [+10] [+20] [Anderer Wert]
            └── Optional: Notiz (z.B. "Haendler beschuetzt")
```

**Kein automatisches System** - der GM entscheidet was passiert. Das System bietet nur die Struktur zum Tracken.

### UI-Konzept (Encounter-Resolution-Dialog)

```
┌─────────────────────────────────────────────────────────────┐
│  Encounter abschliessen                                     │
├─────────────────────────────────────────────────────────────┤
│  Ausgang: [Sieg ▼]                                          │
│                                                             │
│  Reputation-Aenderungen:                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Handelsgilde (aktuell: +10)                            ││
│  │  Aenderung: [-20] [-10] [±0] [+10] [+20]  [__]          ││
│  │  Notiz: [Haendler vor Banditen gerettet_______]         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Abbrechen]                            [Abschliessen]      │
└─────────────────────────────────────────────────────────────┘
```

→ Integration: [DetailView.md](../application/DetailView.md#post-combat-resolution)

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
| FactionStatus (active/dormant/extinct) | ✓ | | Dynamische Welt |
| Attrition-Mechanik | ✓ | | Creature-Counts nach Combat reduzieren |
| Entity Promotion Dialog | | mittel | Nicht-Fraktion → persistente NPC |
| Auto-POI bei Promotion | | mittel | Hort-Erstellung |
| Dynamische Faction-Interaktionen | | niedrig | Automatisierte Konflikte |
| Diplomatie-System | | niedrig | Allianzen, Feindschaften |

---

*Siehe auch: [NPC.md](NPC.md) | [POI.md](POI.md) | [encounter/Encounter.md](../features/encounter/Encounter.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 1400 | 🔶 | Faction | features | Faction-Schema (id, name, parentId, culture, creatures, controlledPOIs, displayColor) | hoch | Ja | - | Faction.md#schema | src/core/schemas/faction.ts:160-188 |
| 1417 | 🔶 | Faction | features | Faction EntityRegistry Integration: 'faction' als Entity-Typ | hoch | Ja | #1400 | [Faction.md#schema](#schema), [Faction.md#encounter-templates](#encounter-templates) | src/core/schemas/common.ts:46 (EntityType enum enthält 'faction') |
| 1401 | 🔶 | Faction | features | CultureData-Schema (naming, personality, quirks, values, speech) | hoch | Ja | #1400 | Faction.md#culturedata | src/core/schemas/faction.ts:116-133 |
| 1402 | 🔶 | Faction | features | FactionCreatureGroup-Schema (creatureId, count) | hoch | Ja | #1200, #1400 | [Faction.md#schema](#schema), [Creature.md#schema](Creature.md#schema) | src/core/schemas/faction.ts:142-150 |
| 1403 | 🔶 | Faction | features | FactionPresence-Schema (factionId, strength) für Tile-Speicherung | hoch | Ja | #802, #1400 | [Faction.md#praesenz-datenstruktur](#praesenz-datenstruktur), [Map-Feature.md#overworldmap](../features/Map-Feature.md#overworldmap) | src/core/schemas/faction.ts:227-232 |
| 1404 | ✅ | Faction | features | WeightedTrait und WeightedQuirk Schemas | mittel | Ja | #1401 | Faction.md#culturedata | src/core/schemas/faction.ts:20-36 |
| 1405 | 🔶 | Faction | features | resolveFactionCulture(): Hierarchie von Wurzel zu Blatt auflösen | hoch | Ja | #1400, #1401 | [Faction.md#kultur-vererbung](#kultur-vererbung), [NPC-System.md#npc-generierung](NPC-System.md#npc-generierung) | src/features/encounter/npc-generator.ts:37-63 |
| 1406 | ✅ | Faction | features | mergeCultureData(): Kultur-Eigenschaften mergen mit Vererbungsregeln | hoch | Ja | #1405 | [Faction.md#merge-regeln](#merge-regeln), [Faction.md#kultur-vererbung](#kultur-vererbung) | src/features/encounter/npc-generator.ts:69-100 (mergeCulture) |
| 1407 | ✅ | Faction | features | mergeWeightedTraits(): Helper für Trait-Merging mit Gewichtung | mittel | Ja | #1406 | Faction.md#merge-regeln | Integriert in mergeCulture (src/features/encounter/npc-generator.ts:69-100) |
| 1408 | ✅ | Faction | features | mergeWeightedQuirks(): Helper für Quirk-Merging | mittel | Ja | #1406 | Faction.md#merge-regeln | Integriert in mergeCulture (src/features/encounter/npc-generator.ts:69-100) |
| 1409 | ⛔ | Faction | features | distributePresenceToTiles(): CR-Verteilungslogik mit Gewichtung (1/(d+1)) im Cartographer | hoch | Ja | #802, #1403, #1500, #3194 | Faction.md#praesenz-vorberechnung-cartographer, POI.md#basepoi, Map-Feature.md#overworldmap | [neu] src/features/faction/faction-presence.ts:calculatePresenceForTile() |
| 1410 | ⛔ | Faction | features | getFactionsAtTile(): Vorberechnete Präsenz vom Tile lesen mit active-Filter | hoch | Ja | #801, #802, #1409 | Faction.md#encounter-integration, Map-Feature.md#overworldmap | [neu] src/features/faction/faction-presence.ts:getFactionsAtTile() |
| 1411 | ⛔ | Faction | features | selectEncounterFaction(): Gewichtete Zufallsauswahl basierend auf FactionPresence.strength | hoch | Ja | #202, #1410, #3195 | Faction.md#encounter-integration, encounter/Encounter.md#tile-eligibility | [neu] src/features/faction/faction-presence.ts:selectEncounterFaction() |
| 1412 | 🔶 | Faction | features | Bundled Basis-Fraktionen: Humanoids, Goblins, Orcs, Undead, etc. | hoch | Ja | #1400, #1401 | Faction.md#bundled-basis-fraktionen | presets/factions/base-factions.json |
| 1413 | 🔶 | Faction | features | Faction Events: create/update/delete-requested und Lifecycle-Events | mittel | Ja | #1400 | Faction.md#events | src/core/events/domain-events.ts:FactionPayloads, FactionState |
| 1414 | ⬜ | Faction | features | Faction Territory Events Implementation: poi-claimed, poi-lost EventBus-Handler + Event-Emission bei POI-Zuweisung | niedrig | Nein | #1413, #1500 | Faction.md#events, POI.md#basepoi | docs/architecture/Events-Catalog.md:756-764 (Events definiert, Implementierung fehlt) |
| 1415 | ⛔ | Faction | application | Faction Library-View: CRUD-UI mit Kultur-Editor, Creature-Verwaltung, POI-Zuweisung | mittel | Ja | #1400, #1416, #2800 | Faction.md#schema, Library.md#tab-navigation | [neu] src/application/library/faction-view.svelte |
| 1416 | ⛔ | Faction | features | FactionOrchestrator: CRUD-Logik + Event-Handling (create/update/delete-requested) | mittel | Ja | #1400, #1413 | Faction.md#schema, Faction.md#events, Architecture/Infrastructure.md#storage-port-pattern | [neu] src/features/faction/orchestrator.ts, [neu] src/features/faction/index.ts:createFactionOrchestrator() |
| 2998 | 🔶 | Faction | features | reputationWithParty: number (-100 bis +100) Feld | niedrig | Nein | #1400 | Faction.md#party-reputation | src/core/schemas/faction.ts:184 (reputationWithParty field im Schema) |
| 2999 | ⬜ | DetailView | application | Encounter-Resolution-Dialog: Reputation-Änderung UI mit Preset-Buttons [-20..-10..+20] | niedrig | Nein | #2998 | Faction.md#party-reputation, Faction.md#ui-konzept, DetailView.md#post-combat-resolution | - |
| 3017 | ⛔ | Encounter | features | suggestHoardLocation(): POI-Vorschlag basierend auf Terrain-Präferenz + Proximity | niedrig | Nein | #3015, #1500, #3201 | Faction.md#poi-vorschlag, encounter/Encounter.md#entity-promotion | - |
| 3018 | ⛔ | Faction | features | applyAttrition(): Creature-Counts nach Combat reduzieren + faction:attrition-applied Event | hoch | Ja | #1400, #1402, #3205 | Faction.md#attrition-mechanik, Faction.md#integration-im-encounter-service | - |
| 3019 | ⛔ | Faction | features | recalculatePresenceForTile(): Neuberechnung nach faction:attrition-applied Event | mittel | Ja | #3018, #1409, #3200 | Faction.md#praesenz-neuberechnung | - |
| 3020 | ⛔ | Faction | features | Auto-Status extinct: Wenn alle creature.count = 0 nach Attrition → status = extinct + faction:status-changed Event | mittel | Ja | #3018 | Faction.md#automatische-status-aenderungen | - |
| 3114 | ⛔ | Faction | features | selectMatchingTemplate(): Budget + Context → Template-Auswahl mit Gewichtung | hoch | Nein | #3184, #3195 | Faction.md#encounter-templates, Faction.md#template-auswahl | - |
| 3119 | ⛔ | Faction | features | generateName(): Name-Generierung aus CultureData mit Pattern-Replacement | mittel | Nein | #1405, #3196 | Faction.md#name-generieren, Faction.md#generierungsfunktionen | - |
| 3121 | ⛔ | Faction | features | rollPersonality(): Personality-Trait-Auswahl mit forbidden-Filter + gewichtete Zufallswahl | mittel | Nein | #1405, #3195 | Faction.md#persoenlichkeit-wuerfeln | - |
| 3123 | ⛔ | Faction | features | rollQuirk(): Quirk-Auswahl mit Kreatur-Kompatibilität + Einzigartigkeit-Tracking | mittel | Nein | #1405, #3195 | Faction.md#quirk-wuerfeln, Faction.md#generierungsfunktionen | - |
| 3124 | ⬜ | Faction | features | getActiveFactionsAtTile(): Tile-Präsenz mit active-Status-Filter für Encounter-Generierung | hoch | Nein | #1410 | Faction.md#encounter-filter | - |
| 3125 | ⬜ | Faction | features | promoteCreature(): Entity Promotion (Creature → NPC + POI + LootContainer + Faction) | mittel | Nein | #3203, #3204, #3017 | Faction.md#ergebnis-der-promotion, Faction.md#entity-promotion, encounter/Encounter.md#entity-promotion | - |
| 3126 | ⬜ | Faction | application | Entity Promotion Dialog UI: Name-Input, POI-Toggle, Faction-Toggle mit Parent-Auswahl | niedrig | Nein | #3017 | Faction.md#promotion-dialog, Faction.md#entity-promotion | - |
| 3127 | ⛔ | Faction | application | Post-Attrition UI Banner: Faction-Schwächung mit Creature-Count-Diffs + Extinct-Meldung | niedrig | Nein | #3018 | Faction.md#ui-feedback, Faction.md#attrition-mechanik | - |
| 3128 | 🟢 | Faction | core | WeightedActivity + WeightedGoal Schemas für Kultur-Daten | niedrig | Nein | #1401 | Faction.md#culturedata | - |
| 3131 | ⛔ | Faction | features | instantiateLootTable(): LootContainer-Erstellung bei Entity Promotion mit defaultLootTable | niedrig | Nein | #1708 | Faction.md#ergebnis-der-promotion, Loot-Feature.md | - |
| 3184 | ⛔ | Faction | features | FactionEncounterTemplate Schema (id, name, composition, triggers, weight) eingebettet in Faction | hoch | -d | #1400, #3215 | Faction.md#schema, Faction.md#encounter-templates | - |
| 3193 | ⬜ | Faction | features | ResolvedCulture Type: Aufgelöste Kultur-Daten nach Vererbung (alle Felder non-optional) | niedrig | -d | - | Faction.md#kultur-vererbung | - |
| 3194 | 🟢 | Faction | features | hexDistance(): Helper-Funktion für Hex-Distanz-Berechnung zwischen Koordinaten | mittel | -d | #802 | Faction.md#praesenz-vorberechnung-cartographer, Map-Feature.md#hex-coordinates | - |
| 3195 | 🟢 | Faction | features | weightedRandomSelect(): Generische gewichtete Zufallsauswahl-Utility (value, weight) | hoch | --spec | - | - | - |
| 3196 | 🟢 | Faction | features | randomSelect(): Einfache Zufallsauswahl aus Array (gleichverteilte Wahrscheinlichkeit) | mittel | --spec | - | - | - |
| 3200 | ⛔ | Faction | features | findTilesWithFactionPresence(): Alle Tiles mit gegebener Faction-Präsenz finden | mittel | -d | #1409 | Faction.md#praesenz-neuberechnung | - |
| 3201 | ⛔ | Faction | features | getTilesInRadius(): Alle Tiles in gegebener Distanz von Koordinate finden | niedrig | -d | #802, #3194 | Faction.md#poi-vorschlag | - |
| 3202 | ⬜ | Faction | features | hasPOI(): Prüfung ob Tile bereits einen POI hat | niedrig | Nein | #802, #1500 | Faction.md#poi-vorschlag | - |
| 3203 | ⬜ | Faction | features | PromotionResult Interface (npc, poi?, lootContainer?, faction?) für Entity-Promotion-Return | niedrig | Nein | #3017 | Faction.md#ergebnis-der-promotion | - |
| 3204 | ⬜ | Faction | features | PromotionOptions Interface (name, createPOI, createFaction, poiPosition, factionName, factionParent) | niedrig | Nein | #3017 | Faction.md#ergebnis-der-promotion | - |
| 3205 | ⬜ | Faction | features | CombatOutcome Interface (defeatedCreatures: Array<{creatureId, count}>) für Attrition-Integration | mittel | -d | - | Faction.md#integration-im-encounter-service, Combat-System.md | - |
| 3208 | 🟢 | Faction | core | FactionStatus-Enum (active, dormant, extinct) mit Status-Transitions | hoch | -d | - | Faction.md#faction-status | - |
| 3215 | ⛔ | Faction | core | TemplateCreatureSlot Schema mit creatureId, count (number oder range), role (leader, elite, regular, support) | mittel | -d | #1400 | Faction.md#schema | - |
