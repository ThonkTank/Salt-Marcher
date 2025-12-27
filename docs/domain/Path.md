# Path

> **Lies auch:** [Map](Map.md), [Terrain](Terrain.md), [Travel-System](../features/Travel-System.md)
> **Wird benoetigt von:** Map-Feature, Travel, Encounter, Cartographer

Single Source of Truth fuer lineare Kartenelemente: Strassen, Fluesse, Schluchten, Klippen.

**Design-Philosophie:** Pfade sind lineare Features die Hex-Zentren verbinden und die Bewegung modifizieren. Sie sind Multiplikatoren auf den Terrain-Wert, nicht Ersatzwerte. Das System ist flexibel genug fuer verschiedene Transport-Modi und Barrieren.

**Status:** Post-MVP Feature

---

## Uebersicht

Pfade erfuellen mehrere Zwecke:

1. **Travel-Modifikation** - Strassen beschleunigen, Fluesse erfordern Boote
2. **Encounter-Modifikation** - Strassen haben Banditen, Fluesse haben Wasserkreaturen
3. **Barrieren** - Klippen blockieren Bewegung, Fluesse ohne Boot unpassierbar
4. **Visuelle Darstellung** - Linien auf der Map zwischen Hex-Zentren

```
PathDefinition
+-- pathType (road, river, ravine, cliff, trail)
+-- waypoints[] (Sequenz von HexCoordinates)
+-- movement (Multiplikatoren, Barrieren)
+-- encounterModifier (Creature-Pool, Chance)
+-- environmentModifier (Licht, Wetter) [Post-MVP]
+-- displayStyle (Farbe, Breite, Muster)
```

---

## Schema

### PathDefinition

```typescript
interface PathDefinition {
  id: EntityId<'path'>;
  mapId: EntityId<'map'>;           // Auf welcher Map?

  // Typ und Eigenschaften
  pathType: PathType;
  name?: string;                     // "Alte Handelsstrasse", "Silberfluss"

  // Geometrie: Sequenz von Hex-Koordinaten
  waypoints: HexCoordinate[];        // Mindestens 2 Punkte

  // Bewegungs-Mechanik (Multiplikatoren auf Terrain-Wert)
  movement: PathMovement;

  // Optional: Direktionalitaet (Post-MVP)
  directional?: PathDirectionality;

  // Encounter-Modifikation
  encounterModifier?: PathEncounterModifier;

  // Umgebungs-Modifikation (Post-MVP)
  environmentModifier?: PathEnvironmentModifier;

  // Visuelle Darstellung
  displayStyle: PathDisplayStyle;

  // Metadaten
  description?: string;
  gmNotes?: string;
}

type PathType =
  | 'road'      // Strassen (beschleunigen)
  | 'river'     // Fluesse (Wasser-Kreaturen, ggf. Stroemung)
  | 'ravine'    // Schluchten (dunkler, windgeschuetzt)
  | 'cliff'     // Klippen (Barriere oder Umweg)
  | 'trail';    // Pfade (leichte Beschleunigung)
```

### PathMovement

```typescript
interface PathMovement {
  // Default-Multiplikator (wenn kein Transport-spezifischer Wert)
  defaultModifier: number;           // 1.3 = 30% schneller, 0.8 = 20% langsamer

  // Transport-spezifische Multiplikatoren (optional)
  // Ueberschreiben defaultModifier fuer bestimmte Transport-Modi
  transportModifiers?: Partial<Record<TransportMode, number>>;
  // Beispiel: { boat: 1.5, foot: 0.5 }

  // Barrieren-Verhalten
  blocksMovement?: boolean;          // true = komplett unpassierbar (Klippe)
  requiresTransport?: TransportMode[];  // ['boat'] = nur mit Boot passierbar
}
```

### PathDirectionality (Post-MVP)

```typescript
interface PathDirectionality {
  enabled: boolean;
  forwardSpeedModifier: number;      // Flussabwaerts: 1.5
  backwardSpeedModifier: number;     // Flussaufwaerts: 0.7
}
```

### PathEncounterModifier

```typescript
interface PathEncounterModifier {
  creaturePool?: EntityId<'creature'>[];  // Zusaetzliche Kreaturen
  chanceModifier?: number;                 // Multiplikator fuer Encounter-Chance
}
```

### PathEnvironmentModifier (Post-MVP)

```typescript
interface PathEnvironmentModifier {
  lightingOverride?: 'bright' | 'dim' | 'dark';  // Schlucht = dim
  weatherModifier?: Partial<ClimateProfile>;      // Schlucht = windgeschuetzt
}
```

### PathDisplayStyle

```typescript
interface PathDisplayStyle {
  color: string;                     // Linienfarbe (Hex)
  width: number;                     // Linienbreite (Pixel)
  pattern: 'solid' | 'dashed' | 'dotted';
  icon?: string;                     // Optional: Icon am Start/Ende
}
```

---

## Default-Presets

Mitgelieferte Pfad-Presets:

| PathType | movement | encounterModifier | displayStyle |
|----------|----------|-------------------|--------------|
| `road` | defaultModifier: 1.3 | chanceModifier: 1.2, creatures: [bandit] | brown, solid, 3px |
| `trail` | defaultModifier: 1.1 | - | tan, dashed, 2px |
| `river` | defaultModifier: 0.5, transportModifiers: { boat: 1.5 }, requiresTransport: ['boat'] | creatures: [water-elemental] | blue, solid, 4px |
| `ravine` | defaultModifier: 0.8 | lighting: 'dim' | gray, solid, 5px |
| `cliff` | blocksMovement: true | - | dark-gray, solid, 6px |

### Anpassbare Varianten

```typescript
// Seichte Furt (passierbar ohne Boot)
const shallowFord: PathDefinition = {
  pathType: 'river',
  movement: {
    defaultModifier: 0.6,
    // Kein requiresTransport
  }
};

// Klippe mit Abstiegspunkt
const cliffWithDescent: PathDefinition = {
  pathType: 'cliff',
  movement: {
    blocksMovement: false,
    defaultModifier: 0.3
  }
};

// Hauptstrasse (schneller als normale Strasse)
const mainRoad: PathDefinition = {
  pathType: 'road',
  movement: {
    defaultModifier: 1.5
  }
};

// Fluss mit Stroemung (Post-MVP)
const riverWithCurrent: PathDefinition = {
  pathType: 'river',
  directional: {
    enabled: true,
    forwardSpeedModifier: 1.8,  // Flussabwaerts
    backwardSpeedModifier: 0.4   // Flussaufwaerts
  }
};
```

---

## Bidirektionale Tile-Synchronisation

### Beziehung

```
PathDefinition.waypoints[] <-> OverworldTile.paths[]
```

### Auto-Sync Mechanismus

Bei Aenderungen an `PathDefinition.waypoints`:

```typescript
function onPathWaypointsChanged(
  pathId: EntityId<'path'>,
  oldWaypoints: HexCoordinate[],
  newWaypoints: HexCoordinate[]
) {
  // Entfernte Tiles: path aus tile.paths loeschen
  const removed = oldWaypoints.filter(w => !newWaypoints.includes(w));
  for (const coord of removed) {
    const tile = getTile(coord);
    tile.paths = tile.paths.filter(p => p.pathId !== pathId);
  }

  // Neue Tiles: path zu tile.paths hinzufuegen
  const added = newWaypoints.filter(w => !oldWaypoints.includes(w));
  for (let i = 0; i < newWaypoints.length; i++) {
    const coord = newWaypoints[i];
    if (added.includes(coord)) {
      const tile = getTile(coord);
      tile.paths.push({
        pathId,
        connections: {
          from: i > 0 ? newWaypoints[i - 1] : null,
          to: i < newWaypoints.length - 1 ? newWaypoints[i + 1] : null
        }
      });
    }
  }
}
```

### TilePathInfo

```typescript
interface TilePathInfo {
  pathId: EntityId<'path'>;
  connections: {
    from: HexCoordinate | null;      // Vorheriges Tile im Pfad
    to: HexCoordinate | null;        // Naechstes Tile im Pfad
  };
}
```

---

## Verwendung in anderen Features

### Travel-System

Travel nutzt Pfade fuer Speed-Modifikation:

```typescript
function calculatePathModifier(
  fromTile: OverworldTile,
  toTile: OverworldTile,
  transport: TransportMode
): number {
  // Suche Pfad der beide Tiles verbindet
  const pathInfo = fromTile.paths.find(p =>
    p.connections.to?.equals(toTile.coordinate)
  );

  if (!pathInfo) return 1.0;  // Kein Pfad

  const path = getPath(pathInfo.pathId);

  // Barrieren pruefen
  if (path.movement.blocksMovement) {
    throw new TravelError('PATH_BLOCKED');
  }
  if (path.movement.requiresTransport &&
      !path.movement.requiresTransport.includes(transport)) {
    throw new TravelError('TRANSPORT_REQUIRED', {
      required: path.movement.requiresTransport
    });
  }

  // Multiplikator bestimmen
  if (path.movement.transportModifiers?.[transport]) {
    return path.movement.transportModifiers[transport];
  }
  return path.movement.defaultModifier;
}
```

**Speed-Formel:**

```
Effektive Speed = Basis-Speed x Terrain-Faktor x Pfad-Multiplikator
```

> Details: [Travel-System.md](../features/Travel-System.md)

### Encounter-System

Encounter nutzt Pfade fuer Creature-Pool-Erweiterung:

```typescript
function getEligibleCreatures(tile: OverworldTile): CreatureDefinition[] {
  const terrain = getTerrain(tile.terrain);
  let creatures = [...terrain.nativeCreatures];

  // Pfad-Kreaturen hinzufuegen
  for (const pathInfo of tile.paths) {
    const path = getPath(pathInfo.pathId);
    if (path.encounterModifier?.creaturePool) {
      creatures.push(...path.encounterModifier.creaturePool);
    }
  }

  return creatures.map(id => getCreature(id));
}
```

> Details: [encounter/Encounter.md](../features/encounter/Encounter.md)

---

## Events

```typescript
// Path-CRUD
'path:create-requested': {
  path: PathDefinition;
  correlationId: string;
}
'path:created': {
  path: PathDefinition;
  correlationId: string;
}

'path:update-requested': {
  pathId: EntityId<'path'>;
  changes: Partial<PathDefinition>;
  correlationId: string;
}
'path:updated': {
  pathId: EntityId<'path'>;
  path: PathDefinition;
  correlationId: string;
}

'path:delete-requested': {
  pathId: EntityId<'path'>;
  correlationId: string;
}
'path:deleted': {
  pathId: EntityId<'path'>;
  correlationId: string;
}

// State-Sync
'path:state-changed': {
  mapId: EntityId<'map'>;
  paths: PathDefinition[];
  correlationId: string;
}
```

> Vollstaendige Event-Definitionen: [Events-Catalog.md](../architecture/Events-Catalog.md)

---

## Queries

```typescript
// Alle Pfade auf einer Map
function getPathsOnMap(mapId: EntityId<'map'>): PathDefinition[] {
  return entityRegistry.query('path', p => p.mapId === mapId);
}

// Pfade die durch ein Tile verlaufen
function getPathsAtTile(
  mapId: EntityId<'map'>,
  coord: HexCoordinate
): PathDefinition[] {
  const tile = getTile(mapId, coord);
  return tile.paths.map(p => getPath(p.pathId));
}

// Pfad zwischen zwei Tiles
function getPathBetween(
  mapId: EntityId<'map'>,
  from: HexCoordinate,
  to: HexCoordinate
): PathDefinition | null {
  const fromTile = getTile(mapId, from);
  const pathInfo = fromTile.paths.find(p =>
    p.connections.to?.equals(to)
  );
  return pathInfo ? getPath(pathInfo.pathId) : null;
}
```

---

## Beispiele

### Alte Handelsstrasse

```typescript
const tradeRoad: PathDefinition = {
  id: 'trade-road-001',
  mapId: 'overworld',
  pathType: 'road',
  name: 'Alte Handelsstrasse',
  waypoints: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: 0 },
    { q: 3, r: -1 },
    { q: 4, r: -1 }
  ],
  movement: {
    defaultModifier: 1.3
  },
  encounterModifier: {
    creaturePool: ['bandit', 'merchant-caravan'],
    chanceModifier: 1.2
  },
  displayStyle: {
    color: '#8B4513',
    width: 3,
    pattern: 'solid'
  },
  description: 'Eine gut erhaltene Handelsroute zwischen den Staedten.'
};
```

### Silberfluss

```typescript
const silverRiver: PathDefinition = {
  id: 'silver-river',
  mapId: 'overworld',
  pathType: 'river',
  name: 'Silberfluss',
  waypoints: [
    { q: 5, r: 2 },
    { q: 5, r: 3 },
    { q: 6, r: 3 },
    { q: 6, r: 4 },
    { q: 7, r: 4 }
  ],
  movement: {
    defaultModifier: 0.5,
    transportModifiers: { boat: 1.5 },
    requiresTransport: ['boat']
  },
  encounterModifier: {
    creaturePool: ['water-elemental', 'crocodile', 'river-troll']
  },
  displayStyle: {
    color: '#4169E1',
    width: 4,
    pattern: 'solid'
  },
  description: 'Ein breiter Fluss der durch das Tal fliesst.'
};
```

### Schattenschlucht

```typescript
const shadowRavine: PathDefinition = {
  id: 'shadow-ravine',
  mapId: 'overworld',
  pathType: 'ravine',
  name: 'Schattenschlucht',
  waypoints: [
    { q: 10, r: 5 },
    { q: 11, r: 5 },
    { q: 12, r: 4 }
  ],
  movement: {
    defaultModifier: 0.8
  },
  environmentModifier: {
    lightingOverride: 'dim'
  },
  displayStyle: {
    color: '#696969',
    width: 5,
    pattern: 'solid'
  },
  gmNotes: 'Versteck der Schattendiebe'
};
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| PathDefinition Schema | | ✓ | Post-MVP Feature |
| PathType (5 Typen) | | ✓ | |
| movement.defaultModifier | | ✓ | |
| movement.transportModifiers | | ✓ | |
| movement.blocksMovement | | ✓ | |
| movement.requiresTransport | | ✓ | |
| encounterModifier | | ✓ | |
| Bidirektionale Tile-Sync | | ✓ | |
| Travel-Integration | | ✓ | |
| Cartographer Path-Tool | | ✓ | |
| directional (Stroemung) | | mittel | |
| environmentModifier | | mittel | |
| Sub-Segmente | | niedrig | |
| Explizite Kreuzungen | | niedrig | |

---

*Siehe auch: [Map.md](Map.md) | [Terrain.md](Terrain.md) | [Travel-System.md](../features/Travel-System.md) | [encounter/Encounter.md](../features/encounter/Encounter.md) | [Cartographer.md](../application/Cartographer.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
