# Map-Feature

> **Lies auch:** [Map](../domain/Map.md), [Terrain](../domain/Terrain.md), [Map-Navigation](../domain/Map-Navigation.md)
> **Wird benoetigt von:** Travel, Weather, Cartographer, Dungeon

Single Source of Truth fuer Map-Typen, Map-Content und Multi-Map-Verhalten.

**Design-Philosophie:** Maps sind der Container fuer alle ortsgebundenen Daten. Jeder Map-Typ hat seinen eigenen Content-Typ - kein Unified Schema, da Verhalten fundamental unterschiedlich ist.

---

## Uebersicht

SaltMarcher unterstuetzt drei Map-Typen mit unterschiedlichem Zweck:

| Map-Typ | Koordinaten | Content-Typ | Movement | Zeit-Einheit |
|---------|-------------|-------------|----------|--------------|
| **Overworld** | Hex (axial) | Locations, EncounterZones | Travel-Feature | Stunden |
| **Town** | Strassen | Buildings, Streets, NPCs | Strassen-Navigation | Minuten |
| **Dungeon** | Grid (5-foot) | Traps, Tokens, Treasure | Grid-Movement | Runden (6s) |

```
Map (abstrakt)
├── OverworldMap (Hex)
│   └── Tiles mit Terrain, Locations, EncounterZones
├── TownMap (Strassen)
│   └── Buildings, Streets, NPCs (keine Tiles)
└── DungeonMap (Grid)
    └── Tiles mit Walls, Floors, Traps, Tokens
```

---

## Map-Schemas

### Basis-Map

```typescript
interface BaseMap {
  id: EntityId<'map'>;
  name: string;
  type: MapType;

  // Navigation
  defaultSpawnPoint?: Coordinate;    // Wo Party spawnt wenn kein Link-Tile

  // Metadaten
  description?: string;
  gmNotes?: string;
}

type MapType = 'overworld' | 'town' | 'dungeon';
```

### OverworldMap

Hex-basierte Weltkarte fuer Overland-Travel.

```typescript
interface OverworldMap extends BaseMap {
  type: 'overworld';

  // Grid-Dimensionen
  dimensions: { width: number; height: number };

  // Hex-Tiles
  tiles: Map<HexCoordinate, OverworldTile>;

  // Globale Overlays
  weatherOverlay?: WeatherOverlay;
  factionOverlay?: FactionOverlay;
}

interface OverworldTile {
  coordinate: HexCoordinate;
  terrain: EntityId<'terrain'>;          // Referenz auf Terrain-Entity
  elevation?: number;

  // Content
  pois: EntityId<'poi'>[];              // POIs auf diesem Tile
  encounterZone?: EncounterZone;        // Encounter-Konfiguration

  // Lineare Features (Post-MVP)
  paths: TilePathInfo[];                 // Pfade die durch dieses Tile verlaufen
                                         // Bidirektional synchronisiert mit PathDefinition.waypoints

  // Metadaten
  notes?: string;
}

// Post-MVP: Pfad-Informationen pro Tile
interface TilePathInfo {
  pathId: EntityId<'path'>;
  connections: {
    from: HexCoordinate | null;          // Vorheriges Tile im Pfad (null wenn Start)
    to: HexCoordinate | null;            // Naechstes Tile im Pfad (null wenn Ende)
  };
}

interface EncounterZone {
  encounterChance: number;              // 0.0 - 1.0
  creaturePool: EntityId<'creature'>[];
  factionId?: EntityId<'faction'>;
}
```

### TownMap

Strassen-basierte Stadtkarte ohne Tiles.

```typescript
interface TownMap extends BaseMap {
  type: 'town';

  // Strassen-Netzwerk (keine Grid-Tiles)
  streets: Street[];
  intersections: Intersection[];

  // Content
  buildings: Building[];
  npcs: EntityId<'npc'>[];
}

interface Street {
  id: string;
  name?: string;
  path: Point[];                        // Linien-Koordinaten
  width: number;
}

interface Intersection {
  id: string;
  position: Point;
  connectedStreets: string[];
}

interface Building {
  id: string;
  name: string;
  position: Point;
  type: BuildingType;
  linkedMapId?: EntityId<'map'>;        // Innenraum als Sub-Map
  npcs: EntityId<'npc'>[];
}

type BuildingType =
  | 'tavern' | 'shop' | 'temple' | 'guild'
  | 'residence' | 'castle' | 'warehouse' | 'other';
```

### DungeonMap

Grid-basierte Dungeon-Karte mit 5-foot Tiles.

```typescript
interface DungeonMap extends BaseMap {
  type: 'dungeon';

  // 3D Grid-Dimensionen (Multi-Level)
  dimensions: { width: number; height: number; levels: number };

  // Grid-Tiles
  tiles: Map<GridCoordinate, DungeonTile>;

  // Raeume
  rooms: DungeonRoom[];

  // Party-Position im Dungeon
  partyPosition?: GridCoordinate;
}

interface GridCoordinate {
  x: number;
  y: number;
  z: number;                           // Level/Hoehe
}

interface DungeonTile {
  coordinate: GridCoordinate;
  type: 'floor' | 'wall' | 'door' | 'secret-door' | 'stairs';

  roomId?: string;

  // Content
  traps: Trap[];
  creatures: Token[];                   // Monster/NPC-Tokens
  treasure: Item[];

  // Simulation
  lighting: 'bright' | 'dim' | 'dark';
  explored: boolean;                    // Fog of War
}

interface DungeonRoom {
  id: string;
  name: string;
  tiles: GridCoordinate[];

  description: string;                  // Read-aloud Text
  gmNotes?: string;
}

interface Trap {
  id: string;
  dc: number;
  damage: string;
  triggered: boolean;
  visible: boolean;                     // Versteckt vs sichtbar
}

interface Token {
  id: string;
  creatureId: EntityId<'creature'>;
  position: GridCoordinate;
  currentHp: number;
}
```

---

## Multi-Map-Verhalten

### Memory-Management

**Entscheidung:** Single Map Active - nur die aktuelle Map ist im Speicher geladen.

| Aspekt | Verhalten |
|--------|-----------|
| Aktive Map | Vollstaendig geladen |
| Vorherige Maps | Nicht im Speicher (bei Rueckkehr neu laden) |
| Multi-Map-Loading | Post-MVP - erst nach Party-Split Feature |

**Begruendung:**
- Obsidian-Plugins sollten sparsam mit Speicher umgehen
- Map-Loading ist I/O-bound (JSON), nicht rechenintensiv
- Multi-Map-Loading ist nur relevant wenn mehrere Party-Gruppen auf verschiedenen Maps aktiv sind

### Zeit auf Sub-Maps

Zeit laeuft global - unabhaengig von der aktuellen Map:

| Situation | Zeit-Verhalten |
|-----------|----------------|
| Overworld Travel | Zeit wird durch Travel-Feature vorgerueckt |
| Town-Aktivitaet | GM rueckt Zeit manuell vor (Minuten) |
| Dungeon Exploration | Automatisch basierend auf Bewegung + Aktionen |

```typescript
// Zeit ist global - Map-Wechsel hat keinen Einfluss
interface TimeState {
  currentTimestamp: Timestamp;
  calendar: CalendarDefinition;
}

// Event funktioniert auf allen Map-Typen
'time:advance-requested': {
  duration: Duration;
  reason: 'travel' | 'activity' | 'dungeon' | 'rest' | 'manual';
}
```

### Wetter auf Sub-Maps

| Map-Typ | Wetter-Verhalten |
|---------|------------------|
| Overworld | Wetter pro Tile, beeinflusst Travel |
| Town | Erbt Wetter von Parent-Map-Tile |
| Dungeon | Indoor - kein Wetter (Ausnahmen: offene Bereiche) |

```typescript
function getWeatherForMap(map: BaseMap): Weather | null {
  if (map.type === 'dungeon') return null;

  if (map.type === 'town') {
    const parentTile = getParentMapTile(map);
    return parentTile?.weather ?? null;
  }

  // Overworld: eigenes Wetter-System
  return weatherStore.getCurrentWeather(map.id);
}
```

### State-Persistenz bei Map-Wechsel

Beim Wechsel zwischen Maps:

| State | Persistenz |
|-------|------------|
| Party-Position | Nur auf aktueller Map (keine Multi-Map-Position) |
| Zeit | Global, bleibt erhalten |
| Wetter | Pro Map gespeichert |
| Dungeon Fog of War | Persistiert im DungeonMap-State |
| NPC-Status | Global (EntityRegistry) |

---

## Movement-Systeme

Jeder Map-Typ hat ein eigenes Movement-System:

### Overworld: Travel-Feature

→ Details: [Travel-System.md](Travel-System.md)

```
Route planen → Travel starten → Animation → Encounter-Checks → Ankunft
```

### Town: Strassen-Navigation

```typescript
// Strassen-basierte Navigation
'town:navigate-requested': {
  from: Point;
  to: Point;
  via?: Point[];                        // Optionale Wegpunkte
}

// Berechnet Route entlang Strassen
'town:route-calculated': {
  path: Point[];
  duration: Duration;                   // Basierend auf Strassen-Distanz
}
```

### Dungeon: Grid-Movement

→ Details: [Dungeon-System.md](Dungeon-System.md)

```typescript
// 5-foot Grid Movement
'dungeon:move-requested': {
  to: GridCoordinate;
  mode: 'walk' | 'dash' | 'stealth';
}

// Zeit automatisch berechnet
// 1 Tile = 5 feet, Speed 30 ft = 6 Tiles/Runde (6 Sekunden)
```

---

## Map-Hierarchie und Links

Maps koennen hierarchisch verlinkt sein:

```
Overworld-Map "Westeros"
├── Tile (5,3) → Location "Winterfell"
│   └── linkedMapId → TownMap "Winterfell-Stadt"
│       ├── Building "Die Grosse Halle"
│       │   └── linkedMapId → DungeonMap "Hallen-Innenraum"
│       └── Building "Die Krypta"
│           └── linkedMapId → DungeonMap "Stark-Krypta"
└── Tile (12,8) → Location "Die Hoehle"
    └── linkedMapId → DungeonMap "Goblinhohle"
```

→ Navigation zwischen Maps: [Map-Navigation.md](../domain/Map-Navigation.md)
→ POI-Konzept: [POI.md](../domain/POI.md)

---

## Rendering

### Technologie

**Entscheidung:** Canvas 2D API

| Aspekt | Entscheidung | Begründung |
|--------|--------------|------------|
| **Rendering API** | Canvas 2D | Guter Kompromiss aus Einfachheit und Performance, keine Dependencies |
| **Hex-Geometrie** | Aus Alpha3 portiert | Mathematisch korrekte, getestete Implementation |

> Details zur Rendering-Architektur: [Application.md](../architecture/Application.md#rendering-sharedrendering)

### Overworld Rendering

- Hex-Grid mit Terrain-Farben
- Elevation-Overlays (Hillshade, Contours)
- Location-Icons auf Tiles
- Weather-Overlays
- Party-Token

### Town Rendering

- Strassen als Linien/Pfade
- Building-Polygone mit Icons
- NPC-Marker
- Party-Token auf Strassen

### Dungeon Rendering

- Grid aus 5-foot Squares
- Wand/Boden/Tuer-Tiles
- Fog of War (unexplored = dunkel)
- Lighting-Overlays (dim/dark zones)
- Creature-Tokens
- Trap-Marker (fuer GM)

---

## Events

```typescript
// Map-Lifecycle
'map:load-requested': {
  mapId: EntityId<'map'>;
}
'map:loaded': {
  map: BaseMap;
}
'map:unloaded': {
  mapId: EntityId<'map'>;
}

// Map-CRUD
'map:created': {
  map: BaseMap;
}
'map:updated': {
  mapId: EntityId<'map'>;
  changes: Partial<BaseMap>;
}
'map:deleted': {
  mapId: EntityId<'map'>;
}

// Tile-Events (Overworld + Dungeon)
'map:tile-updated': {
  mapId: EntityId<'map'>;
  coordinate: HexCoordinate | GridCoordinate;
  tile: OverworldTile | DungeonTile;
}

// Navigation
'map:navigate-requested': {
  targetMapId: EntityId<'map'>;
  sourcePOIId?: EntityId<'poi'>;
}
'map:navigated': {
  previousMapId: EntityId<'map'>;
  newMapId: EntityId<'map'>;
  spawnPosition: Coordinate;
}
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Integration mit anderen Features

### Map + Travel

Travel-Feature operiert nur auf Overworld-Maps:
- Liest Terrain-Faktoren aus OverworldTile
- Generiert Encounters basierend auf EncounterZone
- Published `time:advance-requested` fuer Reise-Zeit

### Map + Encounter

- Overworld: EncounterZone definiert Encounter-Wahrscheinlichkeit
- Dungeon: Creature-Tokens starten Encounters bei Kontakt/Klick

### Map + Time

- Alle Map-Typen nutzen globales Zeit-System
- Dungeon: Automatische Zeit-Berechnung bei Bewegung
- Town: Manuelle Zeit-Vorrückung bei Aktivitaeten

### Map + Weather

- Overworld: Vollstaendiges Wetter-System mit Overlays
- Town: Erbt Wetter von Parent-Tile
- Dungeon: Kein Wetter (Indoor)

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| OverworldMap Schema | ✓ | | Hex-Grid + Terrain |
| Overworld Rendering | ✓ | | Bereits implementiert |
| Location-Integration | ✓ | | POIs auf Tiles |
| Map-Navigation (via Locations) | ✓ | | Sub-Map betreten |
| DungeonMap Schema | ✓ | | Grid + Rooms |
| Dungeon Rendering | ✓ | | Fog of War, Lighting, Traps |
| TownMap Schema | | mittel | Strassen-Netzwerk |
| Town Rendering | | mittel | Strassen + Buildings |
| Multi-Level Dungeons (3D) | | niedrig | Z-Koordinate |
| **Lineare Features (Pfade)** | | ✓ | Strassen, Fluesse, Schluchten, Klippen |
| Path Rendering | | ✓ | Linien zwischen Hex-Zentren |
| Path-Travel-Integration | | ✓ | Direktionsabhaengiger Speed |

---

*Siehe auch: [Map.md](../domain/Map.md) | [Path.md](../domain/Path.md) | [Travel-System.md](Travel-System.md) | [Dungeon-System.md](Dungeon-System.md) | [POI.md](../domain/POI.md) | [Map-Navigation.md](../domain/Map-Navigation.md)*
