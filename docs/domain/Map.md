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

→ Details: [encounter/Encounter.md](../features/encounter/Encounter.md)

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
