# SaltMarcher Architecture
## Overview
┌─────────────────────────────────────────────────────────────────┐
│                         ADAPTERS                                │
│      UI (Obsidian Views, DOM)     Storage (Cache + Repositories)│
└─────────────────────┬───────────────────────────┬───────────────┘
                      ↓                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTERS/                              │
│             State, Event Handling, Action Dispatch              │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                          SERVICES/                              │
│              Complex Business Workflow orchestrators            │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                           Utils/                                │
│              Reusable Operations & Calculations                 │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────┴───────────────────────────────────┐
│                            CORE                                 │
│                      shemas/, constants/                        │
└─────────────────────────────────────────────────────────────────┘

## Layers
| Layer | Verantwortung | Beispiele |
|-------|---------------|-----------|
| **Adapters** | Externe Schnittstellen | Vault, Storage (Cache + Repos), UI |
| **Presenters** | UI-Logik, State Management | CartographerPresenter, LibraryPresenter |
| **Use Cases** | Komplexe Business-Workflows | ApplyBrush, CalculateDerivedData, CreateMap |
| **services** | Wiederverwendbare Operationen | @Brush, @MapRenderer, @Ecology |
| **Core** | Pure Functions, Schemas, Types | @Geometry, @Weather, @Water, @Schemas |

**Dependency Rule:** Dependencies zeigen immer nach unten. Untere Layer kennen obere nicht.

## Core
Defining Base math and objects

### @Geometry
docs/core/geometry.md
All tile geometry math. Size, grid, coordinates radius, corners, edges, pathing etc.

#### /Hexa
Hexagonal coordinate system using axial coordinates (q, r). Provides functions for coordinate conversion (axial ↔ pixel ↔ cube), distance calculation, radius queries (all tiles within N steps), neighbor lookup (6 directions), line drawing between hexes, corner/edge positions for rendering, and ring/spiral iteration patterns. Flat-top orientation by default.

#### /Square
Square grid coordinate system using cartesian coordinates (x, y). Provides functions for coordinate conversion (grid ↔ pixel), distance calculation (Manhattan or Chebyshev), radius queries (square or diamond shaped), neighbor lookup (4 or 8 directions), line drawing (Bresenham), corner positions for rendering, and row/column iteration patterns.

#### Functions per Component:
| Funktion                       | Beschreibung                  |
|--------------------------------|-------------------------------|
| coordsInRadius(center, radius) | Alle Koordinaten im Radius    |
| distance(a, b)                 | Distanz zwischen zwei Punkten |
| neighbors(coord)               | Nachbar-Koordinaten           |
| toPixel(coord, size)           | Koordinate → Pixel-Position   |
| fromPixel(pixel, size)         | Pixel → nächste Koordinate    |
| corners(coord, size)           | Eckpunkte für Rendering       |
| toKey(coord) / fromKey(key)    | String-Serialisierung         |
| line(from, to)                 | Linie zwischen zwei Punkten   |

### eco-math
docs/core/eco-math.md
Zweck: Reine Mathematik für Ökosystem-Simulation. Keine Seiteneffekte, keine Repository-Aufrufe.

**FU-System (Food Units):** 1 FU = täglicher Bedarf einer Medium-Kreatur
- PlantFU (2kg), MeatFU (4kg), BloodFU (28kg), CarrionFU (4kg), DetritusFU (40kg)
- SoilFU (0.15kg), WaterFU (5kg), SunlightFU (15kWh), MagicFU (1 Thaum), EssenceFU (1 Essenz)

**Kreaturen-Skalierung:** SIZE_FU_FACTOR (Tiny 0.029 → Gargantuan 285.7), SIZE_DAILY_MORTALITY

**Requirements vs Needs:**
- Requirements (multiplikativ, alle erforderlich): Sunlight, Water, Magic
- Needs (additiv, austauschbar): Meat, PlantMatter, Carrion, Detritus, Soil, Essence

**Kernbereiche:**
- Fitness: habitatFitness, dietFitness, rangeScore, combinedFitness
- Yield: calculatePopulationFU, calculateCarrionFU, calculateDetritusFU
- Accessibility: Hunting-Logik, Plant-Accessibility (Movement/Size), Konkurrenz-Aufteilung
- Distribution: Sunlight (Height Priority), Water (Effizienz), Magic (CR-proportional)
- Reproduction: Geburten, Mortalität, Populations-Änderungen

Solver-Algorithmus → siehe docs/services/ecosystem-solver.md

### @Weather
docs/core/weather.md
Zweck: Reine Mathematik für Wetter. Drei-Ebenen-System: Statisch → Phänomene → Aktuell.
Dependencies: Tile (baseClimate, timeOfDayMod, monthMod), ClimateZone, Almanac (date, timeOfDay)
Ebenen:
  - Ebene 1 (Statisch): Tile.baseClimate + timeOfDayMod[6] + monthMod[12] (persistiert)
  - Ebene 2 (Phänomene): WeatherPhenomenon[] (Fronten, Hochs, Tiefs, Stürme) auf Map-Level
  - Ebene 3 (Aktuell): getZoneWeather() = Klima + Daily-Volatility + Phänomen-Effekte
Persistenz: MapWeatherState auf Map-Level (phenomena[], lastSimulated)
Neue Konzepte: Volatility (klima-abhängige Schwankung), Zwei-Phasen-Simulation (Phänomene bewegen sich zwischen Zonen)
Output: ZoneWeather (temp, wind, cloud, precip, humidity, conditions[])

### @Water
docs/core/water.md
Zweck: Reine Mathematik für Wasserfluss, Akkumulation und Feuchtigkeit.
Dependencies: Tile (elevation, groundwater in m), Weather (precipitation), Nachbar-Tiles
Inputs: elevation (m), groundwater (m), precipitation (mm/Tag)
Outputs → Tile: moisture (0-100%), riverFlow (m³/s), flowDirection, waterDepth (m), isWaterBody (boolean)
Kernlogik: `isWaterBody = groundwater > elevation`, `waterDepth = max(0, groundwater - elevation)`
Funktionen: calculateFlowDirection, calculateFlowAccumulation, calculateMoisture, identifyRivers/Lakes

### @Encounter
docs/core/encounter-math.md
Zweck: D&D 5e Encounter Difficulty Berechnung.
XP-Schwellenwerte: Easy, Medium, Hard, Deadly pro Character Level (1-20)
Encounter Multipliers: Monsters/Player → Multiplikator (0.25→×1, 0.5→×1.5, 1-1.5→×2, etc.)
Verwendung: Encounter-Balancing im Session Runner

### @Schemas
Zod-Schemas für alle Entity-Typen. Runtime-Validation + Type-Inference. Werden von Storage zur Validation und von allen Layern für Type-Safety verwendet.

#### /Tile
Siehe docs/core/schemas/tile.md
Zweck: Hex-Kachel mit Rohdaten (User) + abgeleiteten Daten (Core).
Dependencies: @Weather, @Water, @Ecology (berechnen abgeleitete Felder)

**Base Data (User Input):**
| Feld | Einheit | Beschreibung |
|------|---------|--------------|
| elevation | m | Höhe (unbegrenzt, negativ = unter Meeresspiegel) |
| groundwater | m | Wasserspiegelhöhe (unbegrenzt, `> elevation` = unterwasser) |
| sunlight | kWh/Tag | Sonneneinstrahlung für gesamtes Tile (45M = Mitteleuropa) |
| ambientMagic | Thaum/Tag | Magische Hintergrundenergie für gesamtes Tile (analog zu sunlight) |

Abgeleitete Felder: Weather → Water (moisture, riverFlow, isWaterBody) → Ecology → Assignments → Content
Output: Tile-Daten für Cartographer, Session Runner, Encounters

#### /Creature
docs/core/schemas/creature.md
Zweck: Creature-Definition mit Ecology-Erweiterung für Habitat-Matching und Population-Simulation.
Dependencies: Tile (für Habitat-Matching), @eco-math (für Population-Berechnung)

**Kernfelder:**
- `bodyResources`: Was die Kreatur als Nahrungsquelle liefert (meat, blood, essence, plantMatter mit value/maxValue/regenRate)
- `requirements`: Multiplikative Grundbedürfnisse (water, photosynthesis, magic) - alle müssen erfüllt sein
- `diet`: Additive Nahrungsquellen (herbivore, carnivore, soil, etc.) - austauschbar
- `habitatPreferences`: 4-Wert Ranges [tolMin, optMin, optMax, tolMax] für Temperatur, Moisture, etc.
- `creatureType`: D&D-Typ (beast, humanoid, undead, etc.)
- `isSentient`: Beeinflusst Essenz (×10 wenn true)
- `isStationary`: Für Pflanzen (Movement-Felder haben andere Semantik)

Output: Creature-Daten für Encounter-Generierung, Population-Distribution, Habitat-Fitness

#### /Player 🚧

#### /Item 🚧

#### /Map
Abstract class for all maps to import, can be used for Hex or Square tile maps. Supports colour (with opacity), gradients, labels and symbols per tile, as well as paths and locations/creatures contained in tiles.

#### /MapTypes
docs/core/schemas/map-types.md
Hex-Karten-Datentypen für Koordinaten (TileCoord mit axial q, r) und räumliche Berechnungen.

#### /CalendarTypes
docs/core/schemas/calendar-types.md
Kalender-Datentypen (CalendarDate) für das Almanac-System. Verwendet von Weather, Ecology, Session Runner.

#### /GameMechanics
docs/core/schemas/game-mechanics.md
D&D-Spielmechanik-Typen (CreatureSize, Movement) die von Creatures, NPCs und @eco-math geteilt werden.

#### /Population
Siehe docs/core/schemas/population.md
Zweck: Zählbare Creature-Gruppe auf Map-Level (z.B. "12 Wölfe leben hier").
Dependencies: Creature (via creatureId), Tile (homeTile, territory), Almanac (für Juvenile-Maturation)
Felder: adults, juveniles[], homeTile, territory[], foodSources[]
Berechnet: totalCount, fitness, dietFitness, equilibriumSize, breedingFemales
Neues Interface: PopulationFoodSource (targetId, dietSource, effectiveScore, availableFU, usedFU)
Output: Population-Daten für Encounter-Generierung, Ecology-Simulation, Territory-Berechnung

#### /Faction 🚧

#### /climate zone
docs/core/schemas/climate-zone.md
Zusammenhängende Tiles mit ähnlichem Klima. Aggregiert Klima-Werte (ZoneClimate) für Solver-Performance.
Felder: id, tiles[], climate (aggregiert), isWaterZone, waterAvailable, soilNutrients

#### /MapWeatherState
Persistiert dynamisches Wetter auf Map-Level.
Felder: phenomena[] (aktive WeatherPhenomenon[]), lastSimulated (CalendarDate)
Gespeichert in: MapData.weatherState
Verwendet von: @Weather für Zwei-Phasen-Simulation

## services
Abstract services combining math and data from core classes to create, modify or display stored Objects.

### @Climate
docs/core/climate-math.md
Zweck: Reine Mathematik für Klimazonen-Berechnung. Gruppiert zusammenhängende Tiles mit ähnlichem Klima.
Dependencies: Tile (alle Base + Weather + Water Daten), @Geometry (Nachbar-Lookup)
Inputs: Alle Tiles mit berechneten Weather/Water-Werten
Outputs: ClimateZone[] mit aggregierten Klima-Werten pro Zone
Kernlogik: Z-Score Differenz mit MIN_STD_DEV Floor, Flood-Fill für Zusammenhang
Funktionen: isSameZone, generateClimateZones, floodFillZone, calculateZoneClimate
| Funktion | Beschreibung |
| isSameZone(tileA, tileB, neighbors) | Z-Score Vergleich aller Klima-Werte |
| generateClimateZones(tiles) | Alle Zonen für Map generieren |
| floodFillZone(seed, tiles, assigned) | Einzelne Zone via Flood-Fill |
| calculateZoneClimate(zoneTiles) | Aggregierte Werte für Zone |
| integrateSmallWaterBodies(zones) | <5 Wasser-Tiles in Landzonen |
Und in der Berechnungsreihenfolge (bei CalculateDerivedData oder Tile-Abschnitt):
Abgeleitete Felder: Weather → Water → Climate → Ecology → Assignments → Content

### @MapRenderer
Uses @Geometry to visually display a Map Objects with Tile Objects in a 2D space. Supports abstract layer toggle system (consisting only of display logic so changes in map or tile API don't disrupt function) to change displayed data types (TerrainMap being the standard map view with coloured tiles and symbols for towns, trees, hills etc., then different data layers to display temperature (colour based on temperature (blue-white-red) with label for Celsius), elevation (standard elevation map colours based on tile value), Wasserspiegel (different shades of blue), fertility (different shades of green)

### @Brush        
Generischer Brush-Service für Batch-Editing welches von verschiedenen Features verwendet werden kann
Inputs (Aus Feature):
• Geometrie-Typ (von @Geometry/Hexa oder @Geometry/Square)
• Config (radius, strength, falloff, mode)
• Daten-Feld (welches Tile-Feld editiert wird)
• Wert oder Operation (+10, -5, set 500)
Outputs:
• Betroffene Koordinaten (via @Geometry)
• Modifizierte Werte (via interne Mathe)
• Render-Daten für Brush-Indicator
Nutzt:
• @Geometry für Koordinaten-Berechnung
• Storage.TileRepository für Lesen/Schreiben

### EncounterGenerator
docs/services/encounters.md
Zweck: Encounter-Kandidaten aus Population-Daten generieren.
Dependencies: Map.populations, Creature (activity, courage, tags), Almanac (timeOfDay)
Inputs: TileCoord, timeOfDay ("day" | "night")
Logik: Territory-Filter → Activity-Filter → Encounterable-Filter → Courage-Sortierung
Output: Population[] (sortiert nach Wahrscheinlichkeit des Erscheinens)

### Ecology
docs/services/ecosystem-solver.md
Zweck: Findet stabiles Ökosystem-Equilibrium für eine Klimazone. Pure Logik ohne Repository-Zugriff.

**Ablauf pro Iteration (1 Jahr):**
1. Passendste noch nicht vorhandene Creature ansiedeln (combinedFitness = habitat×0.7 + diet×0.3)
2. Alle Populationen voranschreiten lassen (FU-Flows, Populations-Änderungen)

**Abbruch:** Equilibrium erreicht (input ≈ output, 2.5% Toleranz) ODER Änderungsrate unter Schwelle

**Kernfunktionen:**
| Funktion | Beschreibung |
|----------|--------------|
| solveEcosystem(zone, creaturePool) | Haupt-Algorithmus, gibt Population[] zurück |
| findBestCandidate(zone, pool, settled, populations) | Beste Creature für Ansiedlung |
| isEquilibrium(zone, populations) | Prüft ob input ≈ output |
| calculatePopulationChange(pop, ...) | Geburten - Tode - Konsum - Unterversorgung |

Dependencies: Core/@eco-math (Fitness, FU-Berechnungen)

## Use Cases

### ApplyBrush
Wendet Brush auf Tiles an. Input: mapId, coord, field, brushConfig. Nutzt @Brush für Berechnung, Storage.TileRepository für Persistenz. Output: BrushRenderData.

### CalculateDerivedData
Berechnet abgeleitete Tile-Daten (Weather, Water, Ecology) für gesamte Map. Wird nach Base-Data-Editing ausgeführt ("Fertig"-Button). Setzt derivations.source = "auto".

### CreateMap
Erstellt neue Map mit Grid und Default-Tiles. Input: name, size, gridType. Nutzt @Geometry für Grid-Generierung.

### EcologyOrchestrator
<!-- TODO: Implementierung ausstehend -->
Orchestriert Ecology-Berechnungen mit Repository-Zugriff.
- Lädt Tiles, Creatures, Populations aus Repositories
- Ruft @Ecology Service für Berechnungen auf
- Speichert Ergebnisse zurück in Repositories

Input: mapId, currentDate (optional)
Output: void (Populations werden persistiert)

Funktionen:
| Funktion | Beschreibung |
|----------|--------------|
| distributeAllPopulations(mapId) | Initiale Verteilung nach Map-Berechnung |
| simulateDay(mapId, date) | Tägliche Simulation für alle Populations |

## Presenters

### CartographerPresenter
Verwaltet UI-State für Map-Editing. Hält activeTool, brushConfig, selectedCoord. Dispatched User-Events an UseCases (ApplyBrush, CalculateDerivedData). Empfängt Render-Daten für UI-Updates.
| State | Typ |
|-------|-----|
| activeTool | string |
| brushConfig | { radius, strength, falloff, mode, value } |
| selectedCoord | Coord \| null |
| mapId | string |

## Adapters

### Vault
Einziger direkter Zugriff auf Obsidian Vault API.

| Funktion | Beschreibung |
|----------|--------------|
| read(path) | Datei aus Vault lesen |
| write(path, content) | Datei in Vault schreiben |
| delete(path) | Datei löschen |
| exists(path) | Prüfen ob Datei existiert |
| watch(callback) | File-Watcher für Änderungen |

### Storage
Cache + Domain-Repositories. Nutzt Vault-Adapter, validiert mit Core/@Schemas.

#### Cache
| Funktion | Beschreibung |
|----------|--------------|
| get<T>(key) | Aus Cache lesen |
| set<T>(key, data) | In Cache schreiben |
| invalidate(key) | Cache-Eintrag invalidieren |
| clear() | Gesamten Cache leeren |

#### TileRepository
| Funktion | Beschreibung |
|----------|--------------|
| load(mapId, coord) | Einzelnes Tile laden |
| loadMany(mapId, coords) | Mehrere Tiles laden |
| save(mapId, coord, data) | Einzelnes Tile speichern |
| saveMany(mapId, changes) | Mehrere Tiles speichern |

#### MapRepository
| Funktion | Beschreibung |
|----------|--------------|
| load(mapId) | Map laden |
| save(map) | Map speichern |
| create(config) | Neue Map erstellen |
| list() | Alle Maps auflisten |

#### CreatureRepository
| Funktion | Beschreibung |
|----------|--------------|
| load(id) | Creature laden |
| save(creature) | Creature speichern |
| search(query) | Creatures suchen |
| list() | Alle Creatures auflisten |

### UI/Cartographer
Obsidian View mit Two-Panel Layout: MapView (links) + ToolPanel (rechts).

#### Components
| Component | Verantwortung |
|-----------|---------------|
| MapView | Canvas, rendert Map + empfängt Mouse-Events |
| BrushIndicator | Visualisiert Brush-Position und Radius |
| ToolDropdown | Auswahl: Elevation, Groundwater, Sunlight |
| ModeToggle | Set / Sculpt (+/-) Umschaltung |
| ValueSlider | Wert-Eingabe (Range abhängig von Tool) |
| RadiusSlider | Brush-Radius 1-10 |
| StrengthSlider | Brush-Stärke 0-100% |
| FalloffDropdown | None, Linear, Smooth, Gaussian |
| FinishButton | Triggert CalculateDerivedData |

#### Event → Presenter Mapping
| UI Event | Presenter Method |
|----------|------------------|
| MapView.click | handleMapClick(coord) |
| MapView.drag | handleMapDrag(coord) |
| ToolDropdown.change | setActiveTool(tool) |
| Slider.change | updateBrushConfig(field, value) |
| FinishButton.click | finishEditing() |
