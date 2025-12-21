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

## Tasks

| # | Beschreibung | Prio | MVP? | Deps | Referenzen |
|--:|--------------|:----:|:----:|------|------------|
| 822 | getMap(mapId): Result<BaseMap, AppError> | hoch | Ja | #800 | Map.md#queries, Map-Feature.md#events, EntityRegistry.md#port-interface |
| 823 | getMapsByType(type): BaseMap[] | hoch | Ja | #800 | Map.md#queries, Map-Feature.md#map-schemas |
| 824 | getActiveMap(): BaseMap \| null | hoch | Ja | #800, #813 | Map.md#queries, Map-Feature.md#memory-management |
| 801 | OverworldMap Schema (dimensions, tiles, factionOverlay) | hoch | Ja | #800 | Map.md#schema, Map-Feature.md#overworldmap, Travel-System.md#scope-hex-overland |
| 803 | HexCoordinate Type (q, r für axial) | hoch | Ja | #802 | Map.md#schema, Map-Feature.md#overworldmap, Travel-System.md |
| 813 | map:load-requested Event Handler | hoch | Ja | #800 | Map.md#events, Map-Feature.md#events, Events-Catalog.md |
| 821 | map:updated Event Handler | hoch | Ja | #800, #813, #820 | Map.md#events, Map-Feature.md#events, Events-Catalog.md |
| 826 | map:tile-updated Event publizieren | hoch | Ja | #800, #802, #821, #900 | Map.md#events, Map-Feature.md#events, Events-Catalog.md |
| 807 | GridCoordinate Type (x, y, z für 3D Grid) | hoch | Ja | #806 | Map.md#schema, Map-Feature.md#dungeonmap, Dungeon-System.md |
| 830 | TownMap Schema (streets, intersections, buildings, npcs) | mittel | Nein | #800 | Map.md#schema, Map-Feature.md#townmap |
| 833 | Building Schema (id, name, position, type, linkedMapId, npcs) | mittel | Nein | #830 | Map.md#schema, Map-Feature.md#townmap |
| 837 | town:navigate-requested Event Handler | mittel | Nein | #820, #830, #836 | Map.md#events, Map-Feature.md#town-strassen-navigation |
| 840 | TilePathInfo Schema (pathId, connections mit from/to) | mittel | Nein | #802, #1800 | Map.md#schema, Map-Feature.md#overworldtile, Path.md |
| 844 | Sichtweiten-Berechnung: Basis-Sichtweite 1 Hex bei flachem Terrain | mittel | Nein | #801, #802, #843 | Map.md, Map-Feature.md#sichtweiten-berechnung |
| 848 | Time-Visibility-Modifier: Tageszeit reduziert Sicht | mittel | Nein | #843, #900 | Map.md, Map-Feature.md#umwelt-modifier, Time-System.md#sichtweiten-einfluss-post-mvp |
| 850 | Creature-Sichtweite für Encounter-Trigger | mittel | Nein | #200, #843, #1202 | Map.md, Map-Feature.md#creature-sichtweite, Creature.md#sinne-post-mvp |
| 852 | POI glowsAtNight Mechanik: Ignoriert Nacht-Modifier | mittel | Nein | #843, #851, #1515 | Map.md, Map-Feature.md#poi-fernsicht, POI.md#nachtleuchtende-pois-glowsatnight-post-mvp |
| 854 | Visibility Cache: partyPosition, timeSegment, weatherModifier, visibleTiles, timestamp | mittel | Nein | #843 | Map.md, Map-Feature.md#performance-optimierung |
