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

> Details: [Encounter-System.md](../features/Encounter-System.md)

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

*Siehe auch: [Map.md](Map.md) | [Terrain.md](Terrain.md) | [Travel-System.md](../features/Travel-System.md) | [Encounter-System.md](../features/Encounter-System.md) | [Cartographer.md](../application/Cartographer.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 1800 | ⬜ | Path | core | PathDefinition Schema (id, mapId, pathType, name, waypoints, movement, encounterModifier, displayStyle) | hoch | Nein | - | Path.md#schema, Map.md#entity-beziehungen | src/core/schemas/path.ts:pathDefinitionSchema [neu], src/core/schemas/path.ts:PathDefinition [neu] |
| 1801 | ⛔ | Path | core | PathType Enum (road, river, ravine, cliff, trail) | hoch | Nein | #1800 | Path.md#schema | src/core/schemas/path.ts:pathTypeSchema [neu], src/core/schemas/path.ts:PathType [neu] |
| 1802 | ⛔ | Path | core | PathMovement Schema (defaultModifier, transportModifiers, blocksMovement, requiresTransport) | hoch | Nein | #1800 | Path.md#pathmovement, Travel-System.md#pfad-modifikation-post-mvp | src/core/schemas/path.ts:pathMovementSchema [neu], src/core/schemas/path.ts:PathMovement [neu] |
| 1803 | ⛔ | Path | core | PathEncounterModifier Schema (creaturePool, chanceModifier) | hoch | Nein | #1200, #1800 | Path.md#pathencountermodifier, Encounter-System.md#pfad-basierte-creature-pools-post-mvp, Creature.md#schema | src/core/schemas/path.ts:pathEncounterModifierSchema [neu], src/core/schemas/path.ts:PathEncounterModifier [neu] |
| 1804 | ⛔ | Path | core | PathDisplayStyle Schema (color, width, pattern, icon) | hoch | Nein | #1800 | Path.md#pathdisplaystyle | src/core/schemas/path.ts:pathDisplayStyleSchema [neu], src/core/schemas/path.ts:PathDisplayStyle [neu] |
| 1805 | ⛔ | Path | core | TilePathInfo Schema (pathId, connections) | hoch | Nein | #801, #1800 | Path.md#tilepathinfo, Map.md#schema, Map-Feature.md#overworldtile | src/core/schemas/path.ts:tilePathInfoSchema [neu], src/core/schemas/path.ts:TilePathInfo [neu] |
| 1806 | ⛔ | Path | core | PathDirectionality Schema (enabled, forwardSpeedModifier, backwardSpeedModifier) Post-MVP | niedrig | Nein | #1800 | Path.md#pathdirectionality-post-mvp | src/core/schemas/path.ts:pathDirectionalitySchema [neu], src/core/schemas/path.ts:PathDirectionality [neu] |
| 1807 | ⛔ | Path | core | PathEnvironmentModifier Schema (lightingOverride, weatherModifier) Post-MVP | niedrig | Nein | #110, #1800 | Path.md#pathenvironmentmodifier-post-mvp, Weather-System.md#weather-state | src/core/schemas/path.ts:pathEnvironmentModifierSchema [neu], src/core/schemas/path.ts:PathEnvironmentModifier [neu] |
| 1808 | ⛔ | Path | infrastructure | Default-Presets für 5 PathTypes (road, trail, river, ravine, cliff) | hoch | Nein | #1800, #1801, #1802, #1803, #1804 | Path.md#default-presets | presets/paths/base-paths.json [neu] |
| 1809 | ⛔ | Path | features | Bidirektionale Tile-Synchronisation: onPathWaypointsChanged Handler implementieren (aktualisiert OverworldTile.paths[] bei Waypoint-Änderungen) | hoch | Nein | #801, #1800, #1805, #1810, #1820 | Path.md#bidirektionale-tile-synchronisation, Map-Feature.md#overworldtile | src/features/path/path-tile-sync.ts:onPathWaypointsChanged() [neu], src/features/path/path-tile-sync.ts:syncTilePaths() [neu] |
| 1810 | ⛔ | Path | core | OverworldTile.paths[] Integration (TilePathInfo Array im Tile Schema) | hoch | Nein | #801, #1805 | Path.md#beziehung, Map.md#schema, Map-Feature.md#overworldtile | src/core/schemas/map.ts:overworldTileSchema [ändern - paths Feld hinzufügen] |
| 1811 | ⛔ | Path | features | calculatePathModifier Funktion für Travel-System | hoch | Nein | #3, #5, #1802, #1810, #1817, #1820 | Path.md#travel-system, Travel-System.md#pfad-modifikation-post-mvp, Travel-System.md#speed-berechnung | src/features/travel/path-utils.ts:calculatePathModifier() [neu] |
| 1812 | ⛔ | Path | core | PATH_BLOCKED und TRANSPORT_REQUIRED Error-Codes für Pfad-Barrieren definieren | hoch | Nein | #1811 | Path.md#travel-system, Travel-System.md#pfad-modifikation-post-mvp, Error-Handling.md | src/core/types/common.ts:createError() [bereits vorhanden], Error-Codes als Konstanten dokumentieren |
| 1813 | ⛔ | Path | features | Travel Speed-Formel mit Pfad-Multiplikator erweitern | hoch | Nein | #3, #5, #1811 | Path.md#travel-system, Travel-System.md#speed-berechnung, Travel-System.md#pfad-modifikation-post-mvp | src/features/travel/travel-service.ts:calculateSegmentTime() [ändern - Path-Multiplikator integrieren] |
| 1814 | ⛔ | Path | features | getEligibleCreatures mit Path-Creature-Pool Integration | hoch | Nein | #200, #1803, #1810, #1817, #1820 | Path.md#encounter-system, Encounter-System.md#pfad-basierte-creature-pools-post-mvp, Encounter-System.md#tile-eligibility, Terrain.md#verwendung-in-anderen-features | src/features/encounter/encounter-utils.ts:filterEligibleCreatures() [ändern - Path-Creatures hinzufügen] |
| 1815 | ⛔ | Path | core | Path CRUD Events (create/update/delete-requested + created/updated/deleted) | hoch | Nein | #1800 | Path.md#events, Events-Catalog.md#path-post-mvp | src/core/events/domain-events.ts:EventTypes [ändern - PATH_* Events hinzufügen], src/core/events/domain-events.ts:PathEventPayloads [neu] |
| 1816 | ⛔ | Path | core | path:state-changed Event für Map-Sync | hoch | Nein | #1815 | Path.md#events, Events-Catalog.md#path-post-mvp, Map-Feature.md#events | src/core/events/domain-events.ts:EventTypes.PATH_STATE_CHANGED [neu], src/core/events/domain-events.ts:PathStateChangedPayload [neu] |
| 1817 | ⛔ | Path | features | getPathsOnMap Query-Funktion implementieren (findet alle Pfade auf einer Map via EntityRegistry) | hoch | Nein | #1800, #1820, #1821, #2804 | Path.md#queries, EntityRegistry.md#querying | src/features/path/path-queries.ts:getPathsOnMap() [neu] |
| 1818 | ⛔ | Path | features | getPathsAtTile Query-Funktion implementieren (findet alle Pfade die durch ein Tile verlaufen) | hoch | Nein | #1800, #1810, #1820, #1821, #2804 | Path.md#queries, EntityRegistry.md#querying | src/features/path/path-queries.ts:getPathsAtTile() [neu] |
| 1819 | ⛔ | Path | features | getPathBetween Query-Funktion (findet Pfad zwischen zwei Tiles) | hoch | Nein | #1818, #1820, #1821 | Path.md#queries | src/features/path/path-queries.ts:getPathBetween() [neu] |
| 1820 | ⛔ | Path | features | Path Feature/Orchestrator mit CRUD-Logik | hoch | Nein | #1800, #1815, #1821 | Path.md, Features.md#feature-communication, EventBus.md | src/features/path/orchestrator.ts:createPathOrchestrator() [neu], src/features/path/path-service.ts [neu], src/features/path/path-store.ts [neu], src/features/path/types.ts:PathFeaturePort [neu], src/features/path/index.ts [neu - exports] |
| 1821 | ⛔ | Path | core | Path EntityRegistry Integration: 'path' als Entity-Typ | hoch | Nein | #1800, #2800, #2801 | Path.md, EntityRegistry.md#entity-type-mapping, EntityRegistry.md#neue-entity-typen-mvp | src/core/schemas/common.ts:entityTypeSchema [ändern - 'path' hinzufügen], src/core/types/common.ts:EntityType [ändern - 'path' hinzufügen], src/core/types/common.ts:PathId [neu] |
| 1822 | ⛔ | Path | application | Cartographer Path-Tool: UI zum Zeichnen von Pfaden auf Map (Waypoint-Editing, Path-Type-Auswahl) | mittel | Nein | #1800, #1820, #1821, #2509 | Path.md, Cartographer.md#path-tool-overland-post-mvp, Cartographer.md#state-management | src/application/cartographer/tools/PathTool.svelte [neu] |
| 1823 | ⛔ | Path | application | Cartographer: Path-Properties Panel für Pfad-Bearbeitung (Movement-Modifiers, Encounter-Pools, Display-Style) | mittel | Nein | #1820, #1821, #1822 | Path.md, Cartographer.md#path-tool-overland-post-mvp | src/application/cartographer/panels/PathPropertiesPanel.svelte [neu] |
| 3169 | ⬜ | Path | infrastructure | Path Preset-Loader: Base-Paths in EntityRegistry laden beim Plugin-Start | hoch | Nein | #1808, #1821 | Path.md#default-presets | src/infrastructure/vault/path-loader.ts:loadBundledPaths() [neu], presets/paths/base-paths.json [wird geladen] |
| 3170 | ⬜ | Path | features | Path Storage Port: PathStoragePort Interface mit load/save/delete/query Methoden (Persistent Category) | hoch | Nein | #1800, #1820 | Path.md, EntityRegistry.md#port-interface, Infrastructure.md#storage-ports | src/features/path/storage-port.ts:PathStoragePort [neu], src/features/path/types.ts:PathFeaturePort [ändern - Storage-Methoden] |
| 3171 | ⬜ | Path | infrastructure | Path Vault Adapter: PathVaultAdapter implementieren (JSON-Serialisierung, Datei-basierte Persistenz) | hoch | Nein | #3170 | Path.md, Infrastructure.md#vault-adapters | src/infrastructure/vault/path-adapter.ts:PathVaultAdapter [neu], src/infrastructure/vault/path-adapter.ts:serializePath/deserializePath [neu] |
