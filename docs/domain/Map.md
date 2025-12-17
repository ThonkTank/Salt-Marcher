# Map

> **Lies auch:** [Terrain](Terrain.md), [Map-Navigation](Map-Navigation.md), [Path](Path.md)
> **Wird benoetigt von:** Map-Feature, Cartographer

Single Source of Truth fuer Map-Entity-Definitionen und Map-Typen.

**Design-Philosophie:** Maps sind der Container fuer alle ortsgebundenen Daten. Die Entity-Definition ist typ-agnostisch - spezifisches Verhalten wird in den Feature-Docs beschrieben.

---

## Uebersicht

Eine Map ist der raeumliche Container fuer:
- **Tiles** (bei Hex/Grid-Maps) mit Terrain, Elevation, Content
- **POIs** mit Locations, EncounterZones
- **Overlays** fuer Wetter, Fraktionen, Klima

```
Map
├── id, name, type
├── Dimensionen (width, height, levels)
├── Tiles (typ-abhaengig)
│   ├── Overworld: HexCoordinate → OverworldTile
│   └── Dungeon: GridCoordinate → DungeonTile
├── Overlays (global)
│   ├── Weather
│   ├── Faction-Territory
│   └── Climate
└── Metadaten (description, gmNotes)
```

---

## Schema

### BaseMap

Alle Map-Typen teilen diese Basis-Struktur:

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

### Map-Typen

| Typ | Koordinaten | Content | Primaerer Use-Case |
|-----|-------------|---------|-------------------|
| `overworld` | Hex (axial) | Terrain, Locations, Encounters | Overland Travel |
| `town` | Strassen | Buildings, NPCs, Streets | Stadt-Exploration |
| `dungeon` | Grid (5ft) | Walls, Traps, Tokens | Dungeon Crawl |

→ Vollstaendige Typ-Schemas: [Map-Feature.md](../features/Map-Feature.md)

---

## Entity-Beziehungen

```
Map
 │
 ├──→ Terrain (N:1 - Tiles referenzieren Terrain-Entity)
 │
 ├──→ POI (1:N - Map enthaelt POIs)
 │     └──→ Location (1:1 - POI kann Location sein)
 │
 ├──→ Weather (1:1 - aktuelles Wetter)
 │
 └──→ Faction (N:M - Fraktions-Praesenz via POIs)
```

### Terrain-Referenz

Tiles referenzieren Terrain-Entities anstatt Terrain-Daten zu duplizieren:

```typescript
interface OverworldTile {
  coordinate: HexCoordinate;
  terrain: EntityId<'terrain'>;    // Referenz, nicht eingebettet
  elevation?: number;
  // ...
}
```

---

## Verwendung in anderen Features

### Travel-Feature

Travel operiert auf `overworld` Maps:
- Liest Terrain-Faktoren aus Tiles
- Berechnet Reise-Zeit basierend auf Distanz und Terrain
- Prueft EncounterZones fuer Random Encounters

→ Details: [Travel-System.md](../features/Travel-System.md)

### Weather-Feature

Weather operiert map-global:
- Overworld: Eigenes Wetter pro Map
- Town: Erbt Wetter von Parent-Tile
- Dungeon: Kein Wetter (Indoor)

→ Details: [Weather-System.md](../features/Weather-System.md)

### Encounter-Feature

Encounters werden tile-basiert generiert:
- EncounterZone definiert Creature-Pool und Chance
- Fraktions-Praesenz modifiziert Encounter-Typ

→ Details: [Encounter-System.md](../features/Encounter-System.md)

---

## Events

```typescript
// Map-Lifecycle
'map:load-requested': {
  mapId: EntityId<'map'>;
  correlationId: string;
}
'map:loaded': {
  map: BaseMap;
  correlationId: string;
}
'map:unloaded': {
  mapId: EntityId<'map'>;
  correlationId: string;
}

// Map-CRUD
'map:created': {
  map: BaseMap;
  correlationId: string;
}
'map:updated': {
  mapId: EntityId<'map'>;
  changes: Partial<BaseMap>;
  correlationId: string;
}
'map:deleted': {
  mapId: EntityId<'map'>;
  correlationId: string;
}
```

→ Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Queries

```typescript
// Map nach ID laden
function getMap(mapId: EntityId<'map'>): Result<BaseMap, AppError>;

// Maps nach Typ filtern
function getMapsByType(type: MapType): BaseMap[];

// Aktive Map (aktuell geladene)
function getActiveMap(): BaseMap | null;
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| BaseMap Schema | ✓ | | Kern-Entity |
| OverworldMap | ✓ | | Primaerer Map-Typ |
| Map-Loading/Unloading | ✓ | | Lifecycle |
| Multi-Map Navigation | ✓ | | Via POI-Links |
| TownMap | | mittel | Strassen-basiert |
| DungeonMap | | niedrig | Grid-basiert |

---

*Siehe auch: [Map-Feature.md](../features/Map-Feature.md) | [Map-Navigation.md](Map-Navigation.md) | [POI.md](POI.md) | [Travel-System.md](../features/Travel-System.md)*
