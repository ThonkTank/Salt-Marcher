# Geography & Maps

Spezialisierte Domain für Karten, Koordinaten und räumliche Operationen.

**Pfad:** `src/domains/geography/`

---

## MapPort Interface

Alle Map-Operationen über ein gemeinsames Interface:

```typescript
interface MapPort {
  // Basis-Operationen
  getMapById(id: MapId): Result<BaseMap, AppError>;
  getTileAt(mapId: MapId, coord: Coordinate): Result<Tile, AppError>;
  getNeighbors(mapId: MapId, coord: Coordinate): Coordinate[];

  // Pathfinding
  findPath(mapId: MapId, from: Coordinate, to: Coordinate): Result<Path, AppError>;
  getTraversalCost(mapId: MapId, from: Coordinate, to: Coordinate): number;

  // Map-Links
  getLinksAt(mapId: MapId, coord: Coordinate): MapLink[];
}
```

---

## Coordinate Union-Type

Drei Koordinaten-Typen für verschiedene Map-Arten:

```typescript
type Coordinate =
  | { type: 'hex'; q: number; r: number }      // Axial Hex
  | { type: 'grid'; x: number; y: number }     // Square Grid
  | { type: 'point'; x: number; y: number };   // Freeform Point
```

### Verwendung

```typescript
// Hex (Overland Maps)
const hexCoord: Coordinate = { type: 'hex', q: 5, r: -3 };

// Grid (Dungeon/Battle Maps)
const gridCoord: Coordinate = { type: 'grid', x: 10, y: 15 };

// Point (Town Maps, POIs)
const pointCoord: Coordinate = { type: 'point', x: 234.5, y: 567.8 };
```

### Helper

```typescript
function coordToKey(coord: Coordinate): string {
  switch (coord.type) {
    case 'hex': return `hex:${coord.q},${coord.r}`;
    case 'grid': return `grid:${coord.x},${coord.y}`;
    case 'point': return `point:${coord.x},${coord.y}`;
  }
}
```

---

## Strategy Pattern

MapService wählt intern die richtige Strategy basierend auf Koordinaten-Typ:

```typescript
class MapService implements MapPort {
  private strategies: Map<CoordinateType, MapStrategy>;

  constructor() {
    this.strategies = new Map([
      ['hex', new HexMapStrategy()],
      ['grid', new GridMapStrategy()],
      ['point', new PointMapStrategy()],
    ]);
  }

  getTileAt(mapId: MapId, coord: Coordinate): Result<Tile, AppError> {
    const map = this.maps.get(mapId);
    const strategy = this.strategies.get(coord.type);
    return strategy.getTileAt(map, coord);
  }

  getNeighbors(mapId: MapId, coord: Coordinate): Coordinate[] {
    const strategy = this.strategies.get(coord.type);
    return strategy.getNeighbors(coord);
  }
}
```

### Strategy Interface

```typescript
interface MapStrategy {
  getTileAt(map: BaseMap, coord: Coordinate): Result<Tile, AppError>;
  getNeighbors(coord: Coordinate): Coordinate[];
  findPath(map: BaseMap, from: Coordinate, to: Coordinate): Result<Path, AppError>;
  getTraversalCost(map: BaseMap, from: Coordinate, to: Coordinate): number;
}
```

---

## MapLinks (Hierarchische Navigation)

Verbindungen zwischen Maps verschiedener Ebenen:

```typescript
interface MapLink {
  id: EntityId<'maplink'>;
  sourceMap: MapId;
  sourceCoordinate: Coordinate;
  targetMap: MapId;
  targetCoordinate?: Coordinate;  // Entry-Point in Ziel-Map
  label?: string;                 // z.B. "Enter Neverwinter"
  bidirectional: boolean;         // Automatisch Rückweg?
}
```

### Beispiel: Overland → Town

```typescript
const linkToNeverwinter: MapLink = {
  id: createEntityId('maplink'),
  sourceMap: 'world-map' as MapId,
  sourceCoordinate: { type: 'hex', q: 5, r: 3 },
  targetMap: 'neverwinter' as MapId,
  targetCoordinate: { type: 'point', x: 100, y: 200 },
  label: 'Enter Neverwinter',
  bidirectional: true
};
```

### Hierarchie-Ebenen

```
Overland (Hex) ──[MapLink]──→ Town (Point) ──[MapLink]──→ Building (Grid)
     ↑                            ↑                            ↑
  Hex Coords                 Point Coords                 Grid Coords
  Terrain-based              POI-based                   Tile-based
```

---

## Consumer-Regeln

Consumer (Travel, Encounter, etc.) kennen **NUR**:
- MapPort Interface
- Coordinate Union-Type
- MapLink für Navigation

Consumer kennen **NICHT**:
- Welcher Map-Typ aktiv ist
- Interne Strategy-Implementation
- Map-spezifische Details

### Beispiel: TravelOrchestrator

```typescript
class TravelOrchestrator {
  constructor(private mapPort: MapPort) {}

  planRoute(from: Coordinate, to: Coordinate): Result<Route, AppError> {
    // Consumer nutzt nur das Interface
    // Weiß nicht ob Hex, Grid oder Point
    return this.mapPort.findPath(this.activeMapId, from, to);
  }

  moveToNextWaypoint(): void {
    const neighbors = this.mapPort.getNeighbors(this.activeMapId, this.position);
    // ...
  }

  checkForLinks(): MapLink[] {
    return this.mapPort.getLinksAt(this.activeMapId, this.position);
  }
}
```

---

## Hex-Koordinaten Details

### Axial Coordinates (q, r)

```
     +r
      ↖
       \
        \_____ +q
       /
      /
     ↙
    -s (implicit: s = -q - r)
```

### Nachbarn

```typescript
const HEX_DIRECTIONS = [
  { q: +1, r:  0 },  // E
  { q: +1, r: -1 },  // NE
  { q:  0, r: -1 },  // NW
  { q: -1, r:  0 },  // W
  { q: -1, r: +1 },  // SW
  { q:  0, r: +1 },  // SE
];

function getHexNeighbors(coord: HexCoordinate): HexCoordinate[] {
  return HEX_DIRECTIONS.map(dir => ({
    type: 'hex',
    q: coord.q + dir.q,
    r: coord.r + dir.r
  }));
}
```

### Distanz

```typescript
function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}
```

---

*Zurück zur [Übersicht](DevGuide.md) | Siehe auch: [Domain.md](Domain.md)*
