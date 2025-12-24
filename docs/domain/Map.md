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
- Danger-Zone bestimmt CR-Budget fuer automatische Generierung

→ Details: [Encounter-System.md](../features/Encounter-System.md)

---

## Danger-Zones und CR-Budget

Tiles koennen eine Gefahrenstufe haben, die das CR-Budget fuer automatisch generierte Encounters bestimmt.

### Danger-Zone Typen

| Zone | CR-Budget | Beschreibung | Typische Verwendung |
|------|-----------|--------------|---------------------|
| `safe` | 5 | Sichere Gebiete | Staedte, Lager, Schutzgebiete |
| `normal` | 15 | Standard-Wildnis | Waelder, Huegel, Strassen |
| `dangerous` | 30 | Gefaehrliche Gebiete | Monster-Territorien, Grenzlaender |
| `deadly` | 50 | Toedliche Gebiete | Drachen-Lande, verfluchte Zonen |

### Schema-Erweiterung auf OverworldTile

```typescript
interface OverworldTile {
  coordinate: HexCoordinate;
  terrain: EntityId<'terrain'>;
  elevation?: number;

  // === Danger-Zone (NEU) ===
  dangerZone?: DangerZone;        // default: 'normal'
  crBudget?: number;              // Manueller Override (optional)
  crSpent?: number;               // Summe aller factionPresence[].strength (CR-Werte)

  // ... weitere Felder
  factionPresence?: FactionPresence[];
}

type DangerZone = 'safe' | 'normal' | 'dangerous' | 'deadly';
```

### CR-Budget Berechnung

Das CR-Budget eines Tiles bestimmt die maximale Staerke automatisch generierter Encounters.

**Berechnung:**
1. Basis-Budget aus `dangerZone` (siehe Tabelle oben)
2. Override durch `crBudget` (falls gesetzt)
3. Verbrauch durch Fraktionen: `crSpent = Σ(factionPresence[].strength)`

**Hinweis:** `FactionPresence.strength` ist bereits die effektive CR-Summe der Fraktion auf diesem Tile (mit Distanz-Modifier). Siehe [Faction.md#praesenz-datenstruktur](Faction.md#praesenz-datenstruktur).

```typescript
function getAvailableCRBudget(tile: OverworldTile): number {
  const baseBudget = tile.crBudget ?? DANGER_ZONE_BUDGET[tile.dangerZone ?? 'normal'];
  const spent = tile.crSpent ?? 0;
  return Math.max(0, baseBudget - spent);
}

const DANGER_ZONE_BUDGET: Record<DangerZone, number> = {
  safe: 5,
  normal: 15,
  dangerous: 30,
  deadly: 50
};
```

### Verwendung bei Encounter-Generierung

Das CR-Budget gilt **nur fuer automatisch generierte Encounters**:

| Encounter-Typ | CR-Budget respektiert? |
|---------------|------------------------|
| Random Encounter (Travel) | Ja |
| Fraktions-Encounter | Ja |
| Manuell platziert (Cartographer) | Nein |
| Quest-Encounter | Nein |

**Begründung:** GM behaelt volle kreative Kontrolle. Das Budget verhindert nur "zufaellige Ueberbewoelkerung" - z.B. dass zufaellig ein Drache, Aboleth UND Terrasque in benachbarten Hexes erscheinen.

### Cartographer-Integration

Im Cartographer kann die Danger-Zone per Brush-Tool auf Tiles gemalt werden:

```
┌──────────────────────────────────────┐
│  Danger-Zone Brush                   │
│  ────────────────────────────────────│
│  [🟢 Safe]  [🟡 Normal]              │
│  [🟠 Dangerous]  [🔴 Deadly]         │
│                                      │
│  Brush-Size: [1 ▼]                   │
└──────────────────────────────────────┘
```

→ Details: [Cartographer.md](../application/Cartographer.md#danger-zone-brush)

### Tile-Inspector

Der Inspector zeigt das CR-Budget:

```
┌──────────────────────────────────────┐
│  Encounter Budget                    │
│  ────────────────────────────────────│
│  Danger Zone: [Normal ▼]             │
│  CR Budget: 15                       │
│  CR Spent: 3.5 (by factions)         │
│  CR Available: 11.5                  │
└──────────────────────────────────────┘
```

→ Details: [Cartographer.md](../application/Cartographer.md#inspector-panel)

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
| DangerZone Typ auf OverworldTile | ✓ | | Tier-System (safe/normal/dangerous/deadly) |
| CR-Budget Felder (crBudget, crSpent) | ✓ | | Encounter-Generierung |
| Danger-Zone Brush im Cartographer | ✓ | | Tool zum Malen |
| TownMap | | mittel | Strassen-basiert |
| DungeonMap | | niedrig | Grid-basiert |

---

*Siehe auch: [Map-Feature.md](../features/Map-Feature.md) | [Map-Navigation.md](Map-Navigation.md) | [POI.md](POI.md) | [Travel-System.md](../features/Travel-System.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 822 | ✅ | Map | infrastructure | getMap(mapId): Result<BaseMap, AppError> | hoch | Ja | #800 | Map.md#queries, Map-Feature.md#events, EntityRegistry.md#port-interface | src/infrastructure/vault/map-adapter.ts:load() |
| 823 | ✅ | Map | infrastructure | getMapsByType(type): BaseMap[] | hoch | Ja | #800 | Map.md#queries, Map-Feature.md#map-schemas | src/infrastructure/vault/map-adapter.ts:listIds() |
| 824 | 📋 | Map | features | getCurrentMap(): Option<BaseMap> Query-Funktion im MapService implementieren | hoch | Ja | #800, #813 | Map.md#queries, Map-Feature.md#state-management | src/features/map/map-service.ts:getCurrentMap() |
| 801 | ✅ | Map | core | OverworldMap Schema (dimensions, tiles, overlays) | hoch | Ja | #800 | Map.md#schema, Map-Feature.md#overworldmap, Travel-System.md#scope-hex-overland | src/core/schemas/map.ts:overworldMapSchema |
| 803 | ✅ | Map | core | EncounterZone Schema (encounterChance, creaturePool, factionId) | hoch | Ja | #802 | Map.md#schema, Map-Feature.md#overworldmap, Encounter-System.md#encounterzone | src/core/schemas/map.ts:encounterZoneSchema |
| 813 | ✅ | Map | features | map:load-requested Event Handler | hoch | Ja | #800 | Map.md#events, Map-Feature.md#events, Events-Catalog.md | src/features/map/map-service.ts:setupEventHandlers(), src/core/events/domain-events.ts:MAP_LOAD_REQUESTED |
| 821 | ⬜ | Map | features | map:navigated Event nach Navigation publizieren (Domain Event) | hoch | Ja | #800, #813, #820 | Map.md#events, Map-Feature.md#events, Events-Catalog.md#map-events | src/features/map/map-service.ts:publishNavigated() [neu], src/core/events/domain-events.ts:MAP_NAVIGATED |
| 826 | ✅ | Map | features | Zeit auf Sub-Maps: TimeService global unabhängig von aktueller Map-ID | hoch | Ja | #800, #802, #821, #900 | Map.md#verwendung-in-anderen-features, Time-System.md#global-time, Map-Feature.md | time-feature (globales Time-System) |
| 807 | ✅ | Map | core | GridCoordinate Schema (x, y, z für Multi-Level) | hoch | Ja | - | Map.md#schema, Map-Feature.md#dungeonmap, Dungeon-System.md#grid-coordinate | src/core/schemas/map.ts:gridCoordSchema [neu] |
| 830 | ⬜ | Map | core | TownMap Schema (streets, intersections, buildings, npcs) in Core ergänzen | mittel | Nein | #800 | Map.md#schema, Map-Feature.md#townmap | src/core/schemas/map.ts:townMapSchema [neu] |
| 833 | ⛔ | Map | core | Building Schema (id, name, position, type, linkedMapId, npcs) in Core ergänzen | mittel | Nein | #830 | Map.md#schema, Map-Feature.md#townmap | src/core/schemas/map.ts:buildingSchema [neu] |
| 837 | ⛔ | Map | features | town:navigate-requested Event Handler für Strassen-Navigation implementieren | mittel | Nein | #820, #830 | Map.md#events, Map-Feature.md#town-strassen-navigation | src/features/town/town-service.ts:setupEventHandlers() [neu], src/core/events/domain-events.ts:TOWN_NAVIGATE_REQUESTED |
| 844 | ⛔ | Map | features | Basis-Sichtweite: 1 Hex bei flachem Terrain (VisibilityService) | mittel | Nein | #801, #802, #843 | Map.md, Map-Feature.md#sichtweiten-berechnung, Travel-System.md | src/features/map/visibility-service.ts:calculateVisibility() [neu] |
| 848 | ⛔ | Map | features | Time-Visibility-Modifier: Tageszeit reduziert Sichtweite (VisibilityService) | mittel | Nein | #843, #900 | Map.md, Map-Feature.md#umwelt-modifier, Time-System.md#sichtweiten-einfluss | src/features/map/visibility-service.ts:getTimeModifier() [neu] |
| 850 | ⛔ | Map | features | Creature-Sichtweite für Encounter-Trigger-Check implementieren | mittel | Nein | #200, #843, #1202 | Map.md, Map-Feature.md#creature-sichtweite, Creature.md#sinne, Encounter-System.md | src/features/encounter/encounter-service.ts:checkCreatureVisibility() [neu] |
| 852 | ⛔ | Map | features | POI glowsAtNight: Nachtleuchtende POIs in Sichtweite berücksichtigen | mittel | Nein | #843, #851, #1515 | Map.md, Map-Feature.md#poi-fernsicht, POI.md#glowsatnight | src/features/map/visibility-service.ts:checkNightGlow() [neu] |
| 854 | ⛔ | Map | features | VisibilityCache für Performance-Optimierung (Sichtweiten-Berechnungen cachen) | mittel | Nein | #843 | Map.md, Map-Feature.md#performance-optimierung | src/features/map/visibility-cache.ts [neu] |
| 3010 | ⬜ | Map | core | DangerZone Typ auf OverworldTile ergänzen (safe/normal/dangerous/deadly) | hoch | Ja | #802 | Map.md#danger-zones-und-cr-budget | - |
| 3011 | ⛔ | Map | core | CR-Budget Felder (crBudget, crSpent) auf OverworldTile ergänzen | hoch | Ja | #802, #3010 | Map.md#cr-budget-berechnung | - |
| 3024 | ⛔ | Map | features | getAvailableCRBudget(): Budget minus crSpent berechnen | mittel | Ja | #3011 | Map.md#cr-budget-berechnung | - |
