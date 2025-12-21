# POI (Point of Interest)

> **Lies auch:** [Map-Navigation](Map-Navigation.md), [Map](Map.md)
> **Wird benoetigt von:** Travel, Quest

Unified System fuer allen Tile-Content: Eingaenge, Fallen, Schaetze, Landmarken und Objekte.

**Design-Philosophie:** POIs sind das einheitliche System fuer alles, was auf einem Map-Tile platziert werden kann. Jeder POI-Typ hat type-spezifische Eigenschaften. NPCs sind KEINE POIs - sie werden separat verwaltet.

---

## Uebersicht

POIs erfuellen mehrere Zwecke:

1. **Map-Navigation** - `entrance` POIs ermoeglichen Betreten einer Sub-Map
2. **Dungeon-Content** - Fallen, Schaetze, interaktive Objekte
3. **Faction-Territory** - Fraktionen kontrollieren POIs als Basis fuer Praesenz
4. **Content-Marker** - Landmarken zeigen interessante Orte auf der Map
5. **Tile Content Panel** - POIs erscheinen im Tile Content Panel

```
Map (Overworld)
+-- POI: "Blutfang-Hoehle" (type: entrance)
|   +-- linkedMapId -> Map (Dungeon)
+-- POI: "Handelsdorf" (type: entrance)
|   +-- linkedMapId -> Map (Stadt)
+-- POI: "Alter Schrein" (type: landmark)
    +-- kein linkedMapId (nicht betretbar)

Map (Dungeon)
+-- POI: "Ausgang" (type: entrance)
|   +-- linkedMapId -> Map (Overworld)
+-- POI: "Giftfalle" (type: trap)
+-- POI: "Schatztruhe" (type: treasure)
```

---

## Schema

### BasePOI

Gemeinsame Eigenschaften aller POI-Typen:

```typescript
interface BasePOI {
  id: EntityId<'poi'>;
  mapId: EntityId<'map'>;         // Auf welcher Map liegt dieser POI?
  position: Coordinate;            // Hex- oder Grid-Koordinate

  // Darstellung
  name?: string;                   // Anzeigename (optional bei manchen Typen)
  icon?: string;                   // Icon fuer Map-Darstellung
  visible: boolean;                // Fuer Spieler sichtbar? (false = GM-only)

  // Fernsicht (Post-MVP)
  height?: number;                 // Hoehe fuer Visibility-Berechnung
  glowsAtNight?: boolean;          // Leuchtet bei Nacht (Staedte, Leuchtfeuer)
}

type Coordinate = HexCoordinate | GridCoordinate;
```

### POI Union Type

```typescript
type POI =
  | EntrancePOI
  | TrapPOI
  | TreasurePOI
  | LandmarkPOI
  | ObjectPOI;

type POIType = 'entrance' | 'trap' | 'treasure' | 'landmark' | 'object';
```

---

## POI-Typen

### EntrancePOI

Verbindung zu einer anderen Map (Dungeon-Eingang, Portal, Ausgang).

```typescript
interface EntrancePOI extends BasePOI {
  type: 'entrance';
  linkedMapId: EntityId<'map'>;    // Ziel-Map
  spawnPosition: Coordinate;        // Wo spawnt Party auf Ziel-Map?
  description?: string;             // Optionale Beschreibung
}
```

**Wichtig:** Bidirektionale Links erfordern zwei separate POIs - einen auf jeder Map. Der GM legt beide explizit an.

**Beispiele:**
- Dungeon-Eingang auf Overworld -> Dungeon-Map
- Ausgang im Dungeon -> Overworld
- Feenportal -> Feywild
- Tuer in Stadt -> Gebaeude-Innenraum

### TrapPOI

Falle auf einem Dungeon-Tile.

```typescript
interface TrapPOI extends BasePOI {
  type: 'trap';
  dc: number;                       // Schwierigkeit zum Entschaerfen/Entdecken
  damage: string;                   // z.B. "2d6 piercing"
  triggered: boolean;               // Wurde die Falle ausgeloest?
  detected: boolean;                // Hat die Party sie entdeckt?
  effect?: string;                  // Zusaetzlicher Effekt (z.B. "poisoned")
}
```

### TreasurePOI

Schatz oder Container mit Items.

```typescript
interface TreasurePOI extends BasePOI {
  type: 'treasure';
  items: EntityId<'item'>[];        // Enthaltene Items
  locked?: boolean;                 // Verschlossen?
  lockDC?: number;                  // DC zum Aufbrechen/Knacken
  looted: boolean;                  // Bereits gepluendert?
  trapId?: EntityId<'poi'>;         // Optionale verknuepfte Falle
}
```

### LandmarkPOI

Nicht-interaktiver Marker fuer interessante Orte.

```typescript
interface LandmarkPOI extends BasePOI {
  type: 'landmark';
  description?: string;             // Beschreibung fuer Spieler
  gmNotes?: string;                 // Private GM-Notizen
}
```

**Beispiele:**
- Alter Schrein
- Verwitterter Meilenstein
- Ruine ohne Innenraum
- Wasserfall

### ObjectPOI

Interaktives Objekt auf der Map.

```typescript
interface ObjectPOI extends BasePOI {
  type: 'object';
  interactable: boolean;            // Kann interagiert werden?
  description?: string;             // Was ist das Objekt?
}
```

**Beispiele:**
- Hebel
- Statue
- Altar
- Brunnen

---

## Map-Navigation

### Betreten einer Sub-Map

```
Party auf Overworld-Map, Tile (5, 3)
    |
    +-- Tile Content Panel zeigt:
    |   +-- POI: "Blutfang-Hoehle" [Betreten]
    |
    +-- GM klickt [Betreten]
    |
    +-- map:navigate-requested {
    |     targetMapId: "dungeon-bloodfang",
    |     sourcePOIId: "bloodfang-entrance"
    |   }
    |
    +-- Map-Feature laedt "dungeon-bloodfang"
    |
    +-- Party spawnt auf spawnPosition
    |
    +-- Journal-Entry wird erstellt
```

### Bidirektionale Links

Fuer eine vollstaendige Verbindung zwischen Maps muessen **zwei POIs** erstellt werden:

```typescript
// POI auf Overworld: Eingang zum Dungeon
const dungeonEntrance: EntrancePOI = {
  id: 'bloodfang-entrance',
  type: 'entrance',
  name: 'Blutfang-Hoehle',
  mapId: 'overworld',
  position: { q: 5, r: 3 },
  linkedMapId: 'dungeon-bloodfang',
  spawnPosition: { q: 0, r: 0 },
  visible: true
};

// POI im Dungeon: Ausgang zur Overworld
const dungeonExit: EntrancePOI = {
  id: 'bloodfang-exit',
  type: 'entrance',
  name: 'Ausgang zur Oberflaeche',
  mapId: 'dungeon-bloodfang',
  position: { q: 0, r: 0 },
  linkedMapId: 'overworld',
  spawnPosition: { q: 5, r: 3 },
  visible: true
};
```

**GM-Workflow:**
1. GM erstellt Dungeon-Map
2. GM platziert Exit-POI im Dungeon (type: entrance)
3. GM geht zur Overworld
4. GM platziert Eingangs-POI auf Overworld (type: entrance)
5. Beide POIs verweisen aufeinander

---

## Tile Content Panel

Das Tile Content Panel im SessionRunner zeigt alle POIs des aktuellen Party-Tiles:

| POI-Typ | Anzeige |
|---------|---------|
| `entrance` | Name + [Betreten]-Button |
| `landmark` | Name + Beschreibung |
| `trap` (detected) | Warnung + DC |
| `trap` (hidden) | Nicht angezeigt |
| `treasure` | Container + [Oeffnen]-Button |
| `object` | Name + [Interagieren]-Button |

```
+---------------------------------------------------+
|  Tile Content: Hoehleneingang (5, 3)              |
+---------------------------------------------------+
|  Eingaenge:                                       |
|  +-- Blutfang-Hoehle [Betreten]                   |
+---------------------------------------------------+
|  Landmarken:                                      |
|  +-- Alter Wegstein                               |
|       "Ein verwitterter Meilenstein"              |
+---------------------------------------------------+
```

---

## Map-Darstellung

POIs werden auf der Map als Icons dargestellt:

```typescript
const poiIcons: Record<POIType, string> = {
  entrance: 'door',
  trap: 'warning',      // Nur wenn detected
  treasure: 'chest',
  landmark: 'marker',
  object: 'cube'
};
```

### Sichtbarkeit

| POI-Typ | `visible: true` | `visible: false` |
|---------|-----------------|------------------|
| `entrance` | Immer sichtbar | GM-only |
| `landmark` | Auf Map gezeigt | GM-only |
| `trap` | Nur wenn `detected` | GM-only |
| `treasure` | Auf Map gezeigt | GM-only |
| `object` | Auf Map gezeigt | GM-only |

### Height-Feld (Post-MVP)

Optionales Feld fuer POI-Hoehe. Ermoeglicht Sichtbarkeit ueber Tile-Grenze hinaus im Visibility-System.

**Berechnung:** POI ist sichtbar wenn:
- POI-Tile ist in Party-Sichtweite, ODER
- POI-height > Blockierungs-Elevation zwischen Party und POI

| POI-Typ | Typische Height | Beispiel |
|---------|-----------------|----------|
| Wachturm | 3-5 | Grenzposten |
| Leuchtturm | 5-8 | Hafenfeuer |
| Berggipfel | 6-10 | Markanter Gipfel |
| Ruine | 2-3 | Zerfallene Festung |
| Rauchsaeule | 4-6 | Lagerfeuer, Vulkan |

**Implementierungs-Hinweis:** Height wird nur fuer Overworld-Map-POIs verwendet.

→ Visibility-System: [Map-Feature.md](../features/Map-Feature.md#visibility-system)

### Nachtleuchtende POIs (`glowsAtNight`) (Post-MVP)

POIs mit `glowsAtNight: true` sind bei Nacht auch ausserhalb der normalen Sichtweite sichtbar:

| POI-Typ | Typisches glowsAtNight | Grund |
|---------|------------------------|-------|
| Stadt/Dorf | true | Fackeln, Laternen |
| Leuchtturm | true | Leuchtfeuer |
| Kampierendes Heer | true | Lagerfeuer |
| Taverne (isoliert) | true | Fensterbeleuchtung |
| Vulkan | true | Gluehendes Magma |
| Dungeon-Eingang | false | Meist unbeleuchtet |
| Ruine | false | Verlassen |

**Mechanik:**
- Bei Nacht: `glowsAtNight` POIs ignorieren den Nacht-Modifier (10%)
- Weather-Modifier gilt weiterhin (Nebel verdeckt auch Lichter)
- Height-Berechnung gilt weiterhin (Licht hinter Berg nicht sichtbar)

→ Visibility-System: [Map-Feature.md](../features/Map-Feature.md#visibility-system)

---

## Faction-Territory

Fraktionen kontrollieren POIs (`controlledPOIs`). Dies bestimmt ihr Territory.

```typescript
const bloodfangFaction: Faction = {
  // ...
  controlledPOIs: ['bloodfang-entrance', 'ruined-watchtower']
};
```

> Fraktions-Praesenz wird aus kontrollierten POIs und deren Position berechnet.
> Siehe: [Faction.md](Faction.md)

---

## Events

```typescript
// POI-Requests
'poi:create-requested': {
  poi: POI;
}
'poi:update-requested': {
  poiId: EntityId<'poi'>;
  changes: Partial<POI>;
}
'poi:delete-requested': {
  poiId: EntityId<'poi'>;
}

// POI-Changes
'poi:created': {
  poi: POI;
}
'poi:updated': {
  poiId: EntityId<'poi'>;
  poi: POI;
}
'poi:deleted': {
  poiId: EntityId<'poi'>;
}

// POI-Interaktionen (Dungeon)
'poi:trap-triggered': {
  poiId: EntityId<'poi'>;
  triggeredBy: EntityId<'character'>;
}
'poi:trap-detected': {
  poiId: EntityId<'poi'>;
  detectedBy: EntityId<'character'>;
}
'poi:treasure-looted': {
  poiId: EntityId<'poi'>;
  items: EntityId<'item'>[];
}
```

---

## Queries

```typescript
// Alle POIs auf einer Map
function getPOIsOnMap(mapId: EntityId<'map'>): POI[] {
  return entityRegistry.query('poi', poi => poi.mapId === mapId);
}

// POIs auf einem bestimmten Tile
function getPOIsAtTile(
  mapId: EntityId<'map'>,
  position: Coordinate
): POI[] {
  return entityRegistry.query('poi', poi =>
    poi.mapId === mapId &&
    poi.position.q === position.q &&
    poi.position.r === position.r
  );
}

// Alle Eingaenge auf einer Map
function getEntrancesOnMap(mapId: EntityId<'map'>): EntrancePOI[] {
  return entityRegistry.query('poi', poi =>
    poi.mapId === mapId && poi.type === 'entrance'
  ) as EntrancePOI[];
}

// Alle nicht-entdeckten Fallen
function getHiddenTraps(mapId: EntityId<'map'>): TrapPOI[] {
  return entityRegistry.query('poi', poi =>
    poi.mapId === mapId &&
    poi.type === 'trap' &&
    !poi.detected
  ) as TrapPOI[];
}
```

---

## Beispiele

### Dungeon-Eingang auf Overworld

```typescript
const bloodfangEntrance: EntrancePOI = {
  id: 'bloodfang-entrance',
  type: 'entrance',
  name: 'Blutfang-Hoehle',
  mapId: 'overworld',
  position: { q: 5, r: 3 },
  linkedMapId: 'dungeon-bloodfang',
  spawnPosition: { q: 0, r: 0 },
  icon: 'cave-entrance',
  visible: true
};
```

### Landmark ohne Sub-Map

```typescript
const ancientShrine: LandmarkPOI = {
  id: 'ancient-shrine',
  type: 'landmark',
  name: 'Alter Schrein',
  mapId: 'overworld',
  position: { q: 8, r: 2 },
  description: 'Verwitterter Schrein einer vergessenen Gottheit',
  gmNotes: 'Kann heiliges Wasser spenden, 1x pro Tag',
  icon: 'shrine',
  visible: true
};
```

### Falle im Dungeon

```typescript
const poisonTrap: TrapPOI = {
  id: 'poison-needle-trap',
  type: 'trap',
  name: 'Giftnadelfalle',
  mapId: 'dungeon-bloodfang',
  position: { x: 3, y: 2, z: 0 },
  dc: 14,
  damage: '1d4 piercing + 2d6 poison',
  effect: 'poisoned for 1 hour on failed DC 12 CON save',
  triggered: false,
  detected: false,
  visible: false  // GM-only bis detected
};
```

### Schatztruhe

```typescript
const treasureChest: TreasurePOI = {
  id: 'boss-room-chest',
  type: 'treasure',
  name: 'Verzierte Truhe',
  mapId: 'dungeon-bloodfang',
  position: { x: 10, y: 5, z: 0 },
  items: ['gold-coins-500', 'potion-healing', 'ring-protection'],
  locked: true,
  lockDC: 15,
  looted: false,
  visible: true
};
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| POI-Schema (Basis) | ✓ | | Kern-Entity |
| EntrancePOI | ✓ | | Map-Navigation |
| LandmarkPOI | ✓ | | Einfache Marker |
| Map-Navigation via EntrancePOI | ✓ | | |
| Tile Content Panel Integration | ✓ | | |
| Map-Icon-Rendering | ✓ | | Einfache Icons |
| TrapPOI | | mittel | Dungeon-System |
| TreasurePOI | | mittel | Dungeon-System |
| ObjectPOI | | niedrig | Interaktive Objekte |
| Custom POI-Icons | | niedrig | User-definierte Icons |
| **Height-Feld** | | mittel | Fernsicht im Visibility-System |
| **glowsAtNight-Feld** | | mittel | Nachtleuchtende POIs |

---

*Siehe auch: [Map-Navigation.md](Map-Navigation.md) | [Faction.md](Faction.md) | [Map-Feature.md](../features/Map-Feature.md)*

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 1500 | BasePOI Interface mit gemeinsamen Eigenschaften (id, mapId, position, name, icon, visible) | hoch | Ja | - | POI.md#basepoi, EntityRegistry.md#entity-type-mapping |
| 1501 | EntrancePOI Schema (linkedMapId, spawnPosition, description) | hoch | Ja | #1500 | POI.md#entrancepoi, Map-Navigation.md#bidirektionale-links |
| 1502 | LandmarkPOI Schema (description, gmNotes) | hoch | Ja | #1500 | POI.md#landmarkpoi |
| 1503 | POI Union Type (entrance \| trap \| treasure \| landmark \| object) | hoch | Ja | #1500, #1501, #1502, #1504, #1505, #1506 | POI.md#poi-union-type, EntityRegistry.md#entity-type-mapping |
| 1504 | TrapPOI Schema (dc, damage, triggered, detected, effect) | mittel | Nein | #1500 | POI.md#trappoi, Map-Feature.md#dungeontile |
| 1505 | TreasurePOI Schema (items, locked, lockDC, looted, trapId) | mittel | Nein | #1500, #1504, #2600 | POI.md#treasurepoi, Item.md#schema |
| 1506 | ObjectPOI Schema (interactable, description) | niedrig | Nein | #1500 | POI.md#objectpoi |
| 1507 | POI CRUD Events (create/update/delete-requested + created/updated/deleted) | hoch | Ja | #1503, #1516 | POI.md#events, Events-Catalog.md#poi, EventBus.md |
| 1508 | POI Interaction Events (trap-triggered, trap-detected, treasure-looted) | mittel | Nein | #1504, #1505, #1507, #1516 | POI.md#events, Events-Catalog.md#poi, Dungeon-System.md |
| 1509 | POI Query Functions (getPOIsOnMap, getPOIsAtTile, getEntrancesOnMap, getHiddenTraps) | hoch | Ja | #1503, #1516 | POI.md#queries, EntityRegistry.md#port-interface |
| 1510 | POI Feature/Orchestrator mit CRUD-Logik | hoch | Ja | #1503, #1507, #1509, #1516 | POI.md, Features.md#feature-struktur, EntityRegistry.md#port-interface |
| 1511 | Map-Navigation via EntrancePOI (map:navigate-requested Event) | hoch | Ja | #1501, #1507, #820, #1900 | POI.md#map-navigation, Map-Navigation.md#navigation-events, Map-Feature.md#events |
| 1512 | Tile Content Panel Integration: POIs des aktuellen Party-Tiles anzeigen | hoch | Ja | #1509, #1510, #1511, #2300 | POI.md#tile-content-panel, SessionRunner.md#tile-content-panel, Map-Navigation.md#travel-state-bei-map-wechsel |
| 1513 | POI Icon Rendering auf Map (Icon-Mapping nach POI-Typ) | hoch | Ja | #1503, #1509, #802, #804 | POI.md#map-darstellung, Map-Feature.md#overworld-rendering |
| 1514 | Height-Feld für POI-Fernsicht (Sichtbarkeit über Tile-Grenze) | mittel | Nein | #1500, #851, #843 | POI.md#height-feld-post-mvp, Map-Feature.md#poi-fernsicht, Map-Feature.md#visibility-system-post-mvp |
| 1515 | glowsAtNight-Feld für nachtleuchtende POIs | mittel | Nein | #1500, #852, #843 | POI.md#nachtleuchtende-pois-glowsatnight-post-mvp, Map-Feature.md#poi-fernsicht, Map-Feature.md#visibility-system-post-mvp |
| 1516 | POI in EntityRegistry registrieren (EntityType 'poi') | hoch | Ja | #1503 | POI.md#schema, EntityRegistry.md#port-interface, EntityRegistry.md#entity-type-mapping |
