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
  factionOverlay?: FactionOverlay;   // Vorberechnete Territory-Grenzen
}

// Vorberechnete Territory-Grenzen fuer Rendering
interface FactionOverlay {
  territories: Array<{
    factionId: EntityId<'faction'>;
    boundary: HexCoordinate[];       // Polygon der Aussengrenze
  }>;
}

interface OverworldTile {
  coordinate: HexCoordinate;
  terrain: EntityId<'terrain'>;          // Referenz auf Terrain-Entity
  elevation?: number;

  // Content
  pois: EntityId<'poi'>[];              // POIs auf diesem Tile
  encounterZone?: EncounterZone;        // Encounter-Konfiguration
  factionPresence: FactionPresence[];   // Fraktions-Praesenz (fuer Encounter-Auswahl)

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

## Visibility System (Post-MVP)

Overland-Sichtweiten-Visualisierung fuer Hex-Maps. Ermoeglicht dem GM zu sehen, welche Tiles die Party sehen kann.

### Konzept

- **Overlay:** Halbtransparentes graues Overlay ueber nicht-sichtbare Tiles (merkbar aber nicht blockierend)
- **Basis-Sichtweite:** 1 Hex bei flachem Terrain (3 Meilen = Erdkruemmungs-Limit)
- **Hoehenbonus:** Wurzel-Formel - hoehere Standpunkte erhoehen Sichtweite
- **Blockierung:** Lineare Interpolation - Sichtlinie durch Zwischentiles geprueft
- **Umwelt-Modifier:** Wetter und Tageszeit reduzieren Sicht (multiplikativ)

### Sichtweiten-Berechnung

```
Effektive Sichtweite = Basis × Hoehen-Bonus × Wetter-Modifier × Tageszeit-Modifier
Hoehen-Bonus: +floor(sqrt(elevation / referenzhoehe)) Hexes
```

| Party-Elevation | Bonus | Gesamt-Sicht |
|-----------------|-------|--------------|
| 0 (Ebene) | 0 | 1 Hex |
| 1 (Huegel) | 1 | 2 Hexes |
| 4 (Berg) | 2 | 3 Hexes |
| 9 (Hoher Berg) | 3 | 4 Hexes |

### Sicht-Blockierung (Line-of-Sight)

Fuer jedes Ziel-Hex wird eine Sichtlinie gezogen:
1. Berechne alle Hexes auf der Linie (via Hex-Linienalgorithmus)
2. Fuer jedes Zwischen-Hex: Interpoliere erwartete Hoehe auf der Sichtlinie
3. Wenn Zwischen-Hex-Elevation > interpolierte Hoehe → Sicht blockiert

```
Party (Elev 2) -------- Berg (Elev 5) -------- Ziel (Elev 1)
                 ↑ Sichtlinie schneidet Berg → blockiert
```

### Umwelt-Modifier

**Wetter:** → Details: [Weather-System.md](Weather-System.md#sichtweiten-einfluss)

| Wetter-Zustand | Modifier |
|----------------|----------|
| Klar/Bewoelkt | 100% |
| Leichter Regen/Schnee | 75% |
| Starker Regen/Schnee | 50% |
| Nebel | 25% |
| Dichter Nebel/Blizzard | 10% |

**Tageszeit:** → Details: [Time-System.md](Time-System.md#sichtweiten-einfluss)

| Segment | Modifier |
|---------|----------|
| Dawn/Dusk | 50% |
| Morning/Midday/Afternoon | 100% |
| Night | 10% |

### Party-Faehigkeiten (Sinne)

Beste Sicht in der Party gilt. Verschiedene Sinne stacken nicht.

| Sinn | Effekt |
|------|--------|
| **Darkvision** | Nacht-Modifier = 100% (statt 10%) |
| **Blindsight** | Ignoriert alle Modifier bis Range |
| **Tremorsense** | Erkennt Bewegung in Range, unabhaengig von Sicht |
| **True Sight** | Ignoriert magische Dunkelheit |

→ Character-Sinne: [Character-System.md](Character-System.md#sinne)
→ Creature-Sinne: [Creature.md](../domain/Creature.md#sinne)

### Creature-Sichtweite

Kreaturen haben eigene Sichtweite fuer:
- Encounter-Trigger (Party wird entdeckt)
- NPC-Patrouillen
- Stealth-Mechaniken

→ Details: [Creature.md](../domain/Creature.md#sinne)

### POI-Fernsicht

POIs mit `height`-Feld koennen ueber ihr Tile hinaus sichtbar sein (z.B. Tuerme, Leuchtfeuer).

**Berechnung:** POI sichtbar wenn:
- POI-Tile ist sichtbar, ODER
- POI-height > Blockierungs-Elevation zwischen Party und POI, ODER
- POI.glowsAtNight && Nacht-Segment (ignoriert Nacht-Modifier)

**Nachtleuchtende POIs:** POIs mit `glowsAtNight: true` ignorieren den Nacht-Modifier (10%), aber nicht den Weather-Modifier. Typische Beispiele: Staedte, Leuchttuerme, kampierende Heere.

→ Details: [POI.md](../domain/POI.md#height-feld)

### Performance-Optimierung

Sichtberechnung ist rechenintensiv. Optimierungen:

1. **Lazy Calculation:** Nur berechnen wenn Overlay aktiv
2. **Caching:** Sichtfeld cachen, invalidieren bei Party-Bewegung, Segment-Wechsel, Wetter-Aenderung
3. **Inkrementelle Updates:** Bei Bewegung nur Rand-Tiles neu berechnen
4. **Range-Limit:** Performance-Cap fuer maximale Berechnungsdistanz

```typescript
interface VisibilityCache {
  partyPosition: HexCoordinate;
  timeSegment: TimeSegment;
  weatherModifier: number;
  visibleTiles: Set<HexCoordinate>;
  timestamp: number;
}
```

### Overlay-Visualisierung

| Element | Darstellung |
|---------|-------------|
| Nicht-sichtbare Tiles | Halbtransparentes graues Overlay |
| Sichtbare Tiles | Kein Overlay (normal sichtbar) |
| Sichtbare POIs | Hervorgehoben (Glow-Effekt oder Umrandung) |
| Nachtleuchtende POIs | Bei Nacht mit Lichtschein-Effekt |

**Design-Prinzip:** Sichtbare POIs werden hervorgehoben, statt nicht-sichtbare extra abzudunkeln (die liegen bereits unter dem grauen Overlay).

### UI

Toggle-Button im Map-Panel (SessionRunner):
- Icon: Auge/Fernglas
- Tooltip: "Sichtweite anzeigen"
- State: Session-only (nicht persistiert)

→ Details: [SessionRunner.md](../application/SessionRunner.md#visibility-toggle)

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
| **Visibility System** | | mittel | Sichtweiten-Overlay |
| Visibility Berechnung | | mittel | Wurzel-Formel + Line-of-Sight |
| Weather-Visibility-Modifier | | mittel | Wetter reduziert Sicht |
| Time-Visibility-Modifier | | mittel | Tageszeit reduziert Sicht |
| POI-Fernsicht | | mittel | Height-Feld fuer POIs |
| POI glowsAtNight | | mittel | Nachtleuchtende POIs |
| POI-Hervorhebung | | mittel | Sichtbare POIs hervorheben |
| Visibility-Toggle UI | | mittel | Button im Map-Panel |

---

*Siehe auch: [Map.md](../domain/Map.md) | [Path.md](../domain/Path.md) | [Travel-System.md](Travel-System.md) | [Dungeon-System.md](Dungeon-System.md) | [POI.md](../domain/POI.md) | [Map-Navigation.md](../domain/Map-Navigation.md)*
