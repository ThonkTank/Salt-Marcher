# Terrain

> **Lies auch:** [Map](Map.md)
> **Wird benoetigt von:** Map-Feature, Weather, Travel

Single Source of Truth fuer Terrain-Definitionen und Custom Terrains.

**Design-Philosophie:** Terrains sind konfigurierbar, nicht hardcoded. User koennen eigene Terrains erstellen. Default-Terrains werden als Presets mitgeliefert.

---

## Uebersicht

TerrainDefinition beschreibt alle Eigenschaften eines Terrains:

```
TerrainDefinition
├── Bewegungs-Mechaniken (movementCost, Transport-Einschraenkungen)
├── Encounter-Modifikatoren
├── Wetter-Ranges (weatherRanges - Template fuer diesen Terrain-Typ)
├── Native Creatures (bidirektional sync)
└── Visuelle Darstellung (displayColor, icon)

OverworldTile (Instanz)
├── terrain: EntityId<'terrain'>
├── elevation?: number
└── climateModifiers?: TileClimateModifiers  ← Tile-spezifische Anpassungen
```

---

## Schema

### TerrainDefinition

```typescript
interface TerrainDefinition {
  id: EntityId<'terrain'>;
  name: string;                           // "Fungal Wastes"

  // Bewegungs-Mechaniken
  movementCost: number;                   // 1.0 = normal, 2.0 = difficult terrain

  // Transport-Einschraenkungen (Travel-System)
  requiresBoat?: boolean;                 // z.B. water
  blocksMounted?: boolean;                // z.B. forest, mountains
  blocksCarriage?: boolean;               // z.B. mountains, swamp

  // Encounter-System
  encounterModifier: number;              // Multiplikator fuer Encounter-Chance
  nativeCreatures: EntityId<'creature'>[]; // Kreaturen die hier heimisch sind

  // Encounter-Sichtweite (Basis-Wert in feet, wird mit Weather-Modifier multipliziert)
  encounterVisibility: number;            // z.B. 300ft plains, 60ft forest

  // Wetter-Ranges (fuer Wetter-Generierung)
  weatherRanges: TerrainWeatherRanges;

  // Visuelle Darstellung
  displayColor: string;                   // Hex-Farbe fuer Map-Rendering
  icon?: string;                          // Optional: Icon-Referenz

  // Metadaten
  description?: string;
}

interface TerrainWeatherRanges {
  temperature: WeatherRange;              // in Grad Celsius
  wind: WeatherRange;                     // in km/h
  precipChance: WeatherRange;             // 0-100 (Wahrscheinlichkeit fuer Niederschlag)
  precipIntensity: WeatherRange;          // 0-100 (Staerke des Niederschlags)
  fogChance: WeatherRange;                // 0-100 (Wahrscheinlichkeit fuer Nebel)
}

interface WeatherRange {
  min: number;                            // Minimum (z.B. extreme Kaelte)
  average: number;                        // Durchschnitt
  max: number;                            // Maximum (z.B. Hitzewelle)
}

// **Breaking Change:** `precipitation` wurde in `precipChance` und `precipIntensity` aufgeteilt.
// `fogChance` ist neu - Nebel ist jetzt ein separater Layer.
```

---

## TileClimateModifiers

**Scope-Klaerung:** Klima-Anpassungen erfolgen auf **Tile-Level**, nicht auf TerrainDefinition-Level.

```
TerrainDefinition.weatherRanges  = "Waelder sind generell so" (Template)
OverworldTile.climateModifiers   = "Dieses spezifische Tile ist anders" (Instanz)
```

### Schema

```typescript
interface TileClimateModifiers {
  temperatureModifier?: number;     // Offset in °C (z.B. -5 fuer kalten Sumpf)
  humidityModifier?: number;        // Offset in % - beeinflusst fogChance + precipChance
  windExposure?: 'sheltered' | 'normal' | 'exposed';
}
```

**Alle Felder optional:** Nur ueberschriebene Werte werden gespeichert. Nicht-ueberschriebene Werte kommen aus dem Terrain-Template.

### windExposure Effekte

`windExposure` beeinflusst **drei Systeme**:

| windExposure | Wind | Audio-Reichweite | Scent-Reichweite |
|--------------|------|------------------|------------------|
| `sheltered` | -30% | x1.5 | x1.5 |
| `normal` | ±0% | x1.0 | x1.0 |
| `exposed` | +30% | x0.5 | x0.5 |

**Logik:**
- **Geschuetzte Bereiche** (Wald, Schlucht, Hoehle): weniger Wind, Schall/Geruch halten sich
- **Exponierte Bereiche** (Berggipfel, offene Ebene): mehr Wind, Schall/Geruch verstreuen schnell

### Verwendung in OverworldTile

```typescript
interface OverworldTile {
  coordinate: HexCoordinate;
  terrain: EntityId<'terrain'>;
  elevation?: number;
  climateModifiers?: TileClimateModifiers;  // Optional - nur wenn vom GM ueberschrieben
}
```

→ Details zur Verwendung: [Map-Feature.md](../features/Map-Feature.md#overworldtile)

### Anwendungs-Reihenfolge

Tile-Modifiers werden **VOR** dem Area-Averaging angewendet:

```
Terrain-Basis → + Tile-Modifiers → Area-Averaging → + Time-Segment → Finales Wetter
```

Das bedeutet: Ein kalter Sumpf (Tile mit temperatureModifier: -5) beeinflusst auch das Wetter benachbarter Tiles.

→ Details: [Weather-System.md](../features/Weather-System.md#berechnungs-reihenfolge)

### Erstellung im Cartographer

Tile-Modifiers werden mit dem **Climate-Brush** im Cartographer erstellt:

1. Climate-Brush auswaehlen (🌡️)
2. Layer waehlen: Temp / Precip / Wind / Fog
3. Override-Wert einstellen
4. Tiles bemalen

→ Details: [Cartographer.md](../application/Cartographer.md#climate-brush)

---

## Default-Terrains

Mitgelieferte Terrain-Presets:

| Terrain | movementCost | encounterMod | Transport | encounterVisibility |
|---------|--------------|--------------|-----------|---------------------|
| `road` | 1.0 | 0.5 | - | 300ft |
| `plains` | 0.9 | 1.0 | - | 300ft |
| `forest` | 0.6 | 1.2 | blocksMounted | 60ft |
| `hills` | 0.7 | 1.0 | - | 150ft |
| `mountains` | 0.4 | 0.8 | blocksMounted, blocksCarriage | 500ft |
| `swamp` | 0.5 | 1.5 | blocksMounted, blocksCarriage | 90ft |
| `desert` | 0.7 | 0.7 | - | 500ft |
| `water` | 1.0 | 0.5 | requiresBoat | 300ft |

**Hinweis:** `encounterVisibility` ist der Basis-Wert bei klarem Wetter. Dieser wird mit `weather.visibilityModifier` (0.1-1.0) multipliziert. Siehe [Weather-System.md](../features/Weather-System.md).

**Wetter-Ranges (Temperatur/Wind/Niederschlag/Nebel):**

| Terrain | Temperatur | Wind | Precip-Chance | Precip-Intensitaet | Fog-Chance |
|---------|------------|------|---------------|--------------------| -----------|
| `road` | -5/15/35 | 5/20/60 | 10/30/70 | 10/30/60 | 5/15/40 |
| `plains` | -5/15/35 | 5/20/60 | 10/30/70 | 10/30/60 | 5/15/40 |
| `forest` | 0/15/30 | 0/10/30 | 20/40/70 | 15/35/60 | 20/40/70 |
| `hills` | -10/10/30 | 10/30/50 | 15/35/65 | 15/35/60 | 10/25/50 |
| `mountains` | -20/0/20 | 20/50/100 | 20/50/80 | 20/50/80 | 10/30/60 |
| `swamp` | 5/20/35 | 0/10/30 | 40/60/90 | 20/40/70 | 30/50/80 |
| `desert` | 0/35/50 | 5/15/80 | 0/5/20 | 5/20/50 | 0/5/20 |
| `water` | 5/18/30 | 10/30/80 | 20/40/70 | 20/40/70 | 15/30/50 |

**Leseweise:** min / average / max

**Interpretation:**
- **Precip-Chance:** Wie oft es regnet/schneit
- **Precip-Intensitaet:** Wie stark es regnet (unabhaengig von Chance)
- **Fog-Chance:** Wahrscheinlichkeit fuer Nebel (kombinierbar mit Niederschlag)

→ Details zu Transport-Modi: [Travel-System.md](../features/Travel-System.md)

---

## Creature-Terrain Auto-Sync

### Bidirektionale Beziehung

Kreaturen und Terrains haben eine bidirektionale Beziehung:

```
creature.terrainAffinities[] ←→ terrain.nativeCreatures[]
```

### Warum beide Seiten?

| Feld | Nutzer | Zweck |
|------|--------|-------|
| `creature.terrainAffinities` | GM | "Wo lebt diese Kreatur?" - intuitive Zuordnung |
| `terrain.nativeCreatures` | System | Schnelles Lookup bei Encounter-Generierung |

### Auto-Sync Mechanismus

Das System synchronisiert automatisch bei Aenderungen:

```typescript
// Bei creature.terrainAffinities Aenderung:
function onCreatureTerrainChanged(
  creatureId: EntityId<'creature'>,
  oldAffinities: EntityId<'terrain'>[],
  newAffinities: EntityId<'terrain'>[]
) {
  // Entfernte Terrains: creature aus terrain.nativeCreatures loeschen
  const removed = oldAffinities.filter(t => !newAffinities.includes(t));
  for (const terrainId of removed) {
    terrain.nativeCreatures = terrain.nativeCreatures.filter(c => c !== creatureId);
  }

  // Neue Terrains: creature zu terrain.nativeCreatures hinzufuegen
  const added = newAffinities.filter(t => !oldAffinities.includes(t));
  for (const terrainId of added) {
    terrain.nativeCreatures.push(creatureId);
  }
}

// Bei terrain.nativeCreatures Aenderung: Analog umgekehrt
```

### Vorteile

- **GM-Workflow:** Nur eine Stelle editieren
- **Keine Inkonsistenzen:** System garantiert Synchronitaet
- **Performance:** Encounter-System hat direkten Zugriff auf Creature-Liste

---

## Custom Terrains (MVP)

User koennen eigene Terrains erstellen:

### Beispiel: Magischer Wald

```json
{
  "id": "user-fey-forest",
  "name": "Feenwald",
  "movementCost": 0.7,
  "encounterModifier": 1.5,
  "encounterVisibility": 45,
  "nativeCreatures": ["pixie", "dryad", "blink-dog"],
  "weatherRanges": {
    "temperature": { "min": 5, "average": 18, "max": 28 },
    "wind": { "min": 0, "average": 5, "max": 15 },
    "precipChance": { "min": 30, "average": 50, "max": 80 },
    "precipIntensity": { "min": 20, "average": 40, "max": 60 },
    "fogChance": { "min": 25, "average": 45, "max": 75 }
  },
  "displayColor": "#7B68EE",
  "icon": "sparkles",
  "description": "Ein von Feenmagie durchdrungener Wald mit ungewoehnlichem Wetter."
}
```

### Verwendung auf Map

Tiles referenzieren TerrainDefinition via ID:

```typescript
interface OverworldTile {
  coordinate: HexCoordinate;
  terrain: EntityId<'terrain'>;    // z.B. "user-fey-forest"
  elevation?: number;
  // ...
}
```

---

## Verwendung in anderen Features

### Travel-System

Travel liest `terrain.movementCost` fuer Speed-Berechnung:

```typescript
function calculateEffectiveSpeed(baseSpeed: number, terrain: TerrainDefinition): number {
  return baseSpeed * terrain.movementCost;
}
```

→ Details: [Travel-System.md](../features/Travel-System.md)

### Weather-System

Weather nutzt `terrain.weatherRanges` fuer Generierung:

```typescript
function generateTileWeather(terrain: TerrainDefinition): WeatherParams {
  return {
    temperature: generateFromRange(terrain.weatherRanges.temperature),
    wind: generateFromRange(terrain.weatherRanges.wind),
    precipChance: generateFromRange(terrain.weatherRanges.precipChance),
    precipIntensity: generateFromRange(terrain.weatherRanges.precipIntensity),
    fogChance: generateFromRange(terrain.weatherRanges.fogChance)
  };
}
```

→ Details: [Weather-System.md](../features/Weather-System.md)

### Encounter-System

Encounter nutzt `terrain.nativeCreatures` fuer schnelles Filtering:

```typescript
function getEligibleCreatures(terrainId: EntityId<'terrain'>): CreatureDefinition[] {
  const terrain = entityRegistry.get('terrain', terrainId);
  return terrain.nativeCreatures.map(id => entityRegistry.get('creature', id));
}
```

### Sichtweite bei Encounter-Generierung

Die `encounterVisibility` bestimmt die Basis-Distanz bei Encounter-Entdeckung. Der Wert wird mit Weather- und Time-Modifiern multipliziert:

```typescript
function calculateInitialDistance(
  terrain: TerrainDefinition,
  weather: WeatherState,
  timeSegment: TimeSegment,
  encounterType: EncounterType
): number {
  // Basis: Terrain-Sichtweite (z.B. 300ft plains, 60ft forest)
  const terrainBase = terrain.encounterVisibility;

  // Weather-Modifier (0.1-1.0, aus Weather-System)
  const weatherModifier = weather.visibilityModifier;

  // Tageszeit-Modifier (optional, aus Time-System)
  const timeModifier = getTimeVisibilityModifier(timeSegment);

  // Effektive Sichtweite
  const effectiveRange = terrainBase * weatherModifier * timeModifier;

  // Typ-basierte Modifikation
  switch (encounterType) {
    case 'combat':
      // Combat beginnt oft naeher (Ambush, Patrouille)
      return Math.floor(effectiveRange * randomBetween(0.3, 0.8));
    case 'social':
      // Social meist auf "Gespraechsdistanz"
      return Math.floor(effectiveRange * randomBetween(0.5, 1.0));
    case 'passing':
      // Passing meist weiter weg
      return Math.floor(effectiveRange * randomBetween(0.7, 1.0));
    case 'trace':
      // Trace = Party stolpert drueber
      return randomBetween(10, 30);
    default:
      return effectiveRange;
  }
}
```

**Konsolidierung:** Dieses System nutzt den prozentualen `visibilityModifier` aus dem Weather-System (Map-Feature.md Referenz), statt eines binaeren `clear`/`obscured` Checks.

→ Details: [Encounter-System.md](../features/Encounter-System.md) | [Weather-System.md](../features/Weather-System.md)

---

## Storage

### Phase 1: Plugin-Bundled Presets (MVP)

Basis-Terrains werden im Plugin gebundelt und zur Build-Zeit importiert:

```
presets/
└── terrains/
    └── base-terrains.json      # 8 Basis-Terrains (road, plains, etc.)
```

**Implementation:** `src/infrastructure/vault/terrain-registry.ts` laedt JSON via esbuild Import.

### Phase 2: User Custom Terrains (Post-MVP)

User-erstellte Terrains werden im Vault gespeichert:

```
Vault/SaltMarcher/data/
└── terrain/
    └── fey-forest.json         # User-erstellte Custom-Terrains
```

Bundled Presets und User Terrains werden zur Laufzeit gemerged.
User-Terrains koennen Bundled-Terrains ueberschreiben (gleiche ID).

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| TerrainDefinition Schema | ✓ | | Kern-Entity |
| movementCost | ✓ | | Travel-Integration |
| encounterModifier | ✓ | | Encounter-Integration |
| nativeCreatures | ✓ | | Encounter-Matching |
| Auto-Sync mit Creatures | ✓ | | Bidirektionale Konsistenz |
| weatherRanges | ✓ | | Weather-Generierung |
| TileClimateModifiers | ✓ | | Tile-Level Klima-Anpassungen |
| Custom Terrains | ✓ | | User-erstellte Terrains |
| Default-Terrain Presets | ✓ | | Mitgelieferte Basis-Terrains |
| Terrain-Icons | | niedrig | Visuelle Verbesserung |

---

*Siehe auch: [Creature.md](Creature.md) | [Travel-System.md](../features/Travel-System.md) | [Weather-System.md](../features/Weather-System.md) | [EntityRegistry.md](../architecture/EntityRegistry.md)*

## Tasks

| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1700 | ⬜ | Terrain | TerrainDefinition Schema (id, name, movementCost, encounterModifier, nativeCreatures, weatherRanges, displayColor, icon, description, Transport-Einschraenkungen) - climateProfile in #1701 | hoch | Ja | - | Terrain.md#schema, EntityRegistry.md#entity-types | src/core/schemas/terrain.ts:terrainDefinitionSchema (Zeile 21-106), presets/terrains/base-terrains.json, src/infrastructure/vault/terrain-registry.ts:DEFAULT_TERRAINS |
| 2952 | ⛔ | Terrain | encounterVisibility statt visibilityRange (Konsolidierung mit Map-Feature) | hoch | Ja | #1700 | Terrain.md#encounter-visibility | - |
| 1717 | ⬜ | - | calculateInitialDistance(): Terrain-basierte Sichtweite mit Weather-Modifier | hoch | Ja | #2952, #1700 | Terrain.md#sichtweite-bei-encounter-generierung, Encounter-System.md#perception | - |
| 1701 | ⛔ | Terrain | ClimateProfile Schema (temperatureModifier, humidityModifier, windExposure) | hoch | Ja | #1700 | Terrain.md#schema, Weather-System.md#tile-basierte-wetter-ranges | src/core/schemas/terrain.ts:climateProfileSchema [neu], src/core/schemas/terrain.ts:terrainDefinitionSchema [ändern - climateProfile Feld hinzufügen] |
| 1702 | ⛔ | Terrain | TerrainWeatherRanges und WeatherRange Schema (temperature, wind, precipitation mit min/average/max) | hoch | Ja | #1700 | Terrain.md#schema, Weather-System.md#tile-basierte-wetter-ranges | src/core/schemas/weather.ts:terrainWeatherRangesSchema (Zeile 22-47), src/core/schemas/weather.ts:weatherRangeSchema |
| 1703 | ⛔ | Terrain | Default-Terrain Presets (road, plains, forest, hills, mountains, swamp, desert, water) | hoch | Ja | #1700, #1702 | Terrain.md#default-terrains | presets/terrains/base-terrains.json, src/infrastructure/vault/terrain-registry.ts:DEFAULT_TERRAINS (Zeile 21-84) |
| 1704 | ⛔ | Terrain | Creature-Terrain Auto-Sync: onCreatureTerrainChanged Handler | hoch | Ja | #1700, #1202 | Terrain.md#auto-sync-mechanismus, Creature.md#auto-sync-verhalten | src/features/terrain/auto-sync.ts:onCreatureTerrainChanged() [neu], src/core/events/terrain.ts [neu - terrain:creature-sync-needed Event] |
| 1705 | ⛔ | Terrain | Creature-Terrain Auto-Sync: onTerrainNativeCreaturesChanged Handler | hoch | Ja | #1700, #1202 | Terrain.md#auto-sync-mechanismus, Creature.md#auto-sync-verhalten | src/features/terrain/auto-sync.ts:onTerrainNativeCreaturesChanged() [neu], src/core/events/terrain.ts [neu - terrain:native-creatures-changed Event] |
| 1706 | ⛔ | Terrain | Bidirektionale Konsistenz: creature.terrainAffinities ↔ terrain.nativeCreatures | hoch | Ja | #1202, #1212, #1213, #1700, #1701, #1704, #1705 | Terrain.md#bidirektionale-beziehung, Creature.md#bidirektionale-beziehung | src/core/schemas/terrain.ts:terrainDefinitionSchema [ändern - nativeCreatures Feld hinzufügen], src/features/terrain/auto-sync.ts:syncCreatureToTerrain() [neu], src/features/terrain/auto-sync.ts:syncTerrainToCreature() [neu] |
| 1707 | ⛔ | Terrain | Custom Terrains: User-erstellte Terrain-Definitionen unterstützen | hoch | Ja | #1700, #1711 | Terrain.md#custom-terrains-mvp, Terrain.md#verwendung-auf-map | src/infrastructure/vault/terrain-registry.ts:createTerrainRegistry() (Zeile 94-120) [ändern - User-Storage implementieren], src/features/terrain/orchestrator.ts:createTerrain() [neu], src/features/terrain/orchestrator.ts:updateTerrain() [neu] |
| 1708 | ✅ | Terrain | EntityRegistry Integration: 'terrain' als Entity-Typ | hoch | Ja | - | Terrain.md#schema, EntityRegistry.md#entity-types | src/core/types/common.ts:EntityType (Zeile 23), src/core/types/common.ts:TerrainId (Zeile 110) |
| 1709 | ⬜ | Terrain | Terrain CRUD Events (terrain:created, terrain:updated, terrain:deleted) | hoch | Ja | #1708 | Terrain.md, Events-Catalog.md | src/core/events/terrain.ts [neu - EventCatalog Definitionen], docs/architecture/Events-Catalog.md [ändern - terrain:* Events hinzufügen] |
| 1710 | ✅ | Terrain | Terrain Storage: Bundled Presets vs User Custom Terrains | hoch | Ja | #1700, #1703 | Terrain.md#storage, Infrastructure.md | src/infrastructure/vault/terrain-registry.ts:loadBundledTerrains(), presets/terrains/base-terrains.json (Phase 1: Plugin-bundled, Phase 2: User-Storage ist Post-MVP #1707) |
| 1711 | ⛔ | Terrain | Terrain Feature/Orchestrator mit CRUD-Logik | hoch | Ja | #1700, #1709, #1710 | Terrain.md, Features.md | src/features/terrain/orchestrator.ts:createTerrainOrchestrator() [neu], src/features/terrain/types.ts:TerrainFeaturePort [neu], src/features/terrain/terrain-service.ts [neu], src/features/terrain/terrain-store.ts [neu], src/features/terrain/index.ts [neu - exports] |
| 1712 | ✅ | Terrain | movementCost Integration in Travel-System | hoch | Ja | #1700 | Terrain.md#travel-system, Travel-System.md#speed-berechnung | src/features/travel/travel-service.ts:getMovementCost() (Zeile 613, 615, 756, 760), src/features/map/map-service.ts:getTerrainMovementCost() (Zeile 225-234) |
| 1713 | ✅ | Terrain | weatherRanges Integration in Weather-System | hoch | Ja | #1701, #1702 | Terrain.md#weather-system, Weather-System.md#tile-basierte-wetter-ranges | src/features/weather/weather-service.ts:getTileWeatherRanges() (Zeile 77-82), src/features/weather/weather-utils.ts:generateFromRange() (Zeile 182, 220) |
| 1714 | ⛔ | Terrain | nativeCreatures Integration in Encounter-System | hoch | Ja | #1706 | Terrain.md#encounter-system, Encounter-System.md#tile-eligibility | src/features/encounter/encounter-utils.ts:filterEligibleCreatures() (Zeile 52-54) [ändern - terrain.nativeCreatures nutzen statt nur creature.terrainAffinities], src/features/encounter/encounter-utils.ts:getEligibleCreaturesFromTerrain() [neu] |
| 1715 | ⛔ | Terrain | Terrain Icons für visuelle Darstellung | niedrig | Nein | #1700 | Terrain.md#prioritaet | src/core/schemas/terrain.ts:terrainDefinitionSchema [ändern - icon Feld bereits vorhanden, nur UI fehlt] (Post-MVP) |
| 2982 | ⛔ | Terrain | TileClimateModifiers Schema (temperatureModifier, humidityModifier, windExposure) | hoch | Ja | #2979, #2980 | Terrain.md#tileclimatemodifiers | - |
