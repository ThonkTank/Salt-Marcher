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
├── Bewegungs-Mechaniken (movementCost)
├── Encounter-Modifikatoren
├── Klima-Einfluss (climateProfile)
├── Native Creatures (bidirektional sync)
└── Visuelle Darstellung (color, icon)
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

  // Encounter-System
  encounterModifier: number;              // Multiplikator fuer Encounter-Chance
  nativeCreatures: EntityId<'creature'>[]; // Kreaturen die hier heimisch sind

  // Klima-Einfluss
  climateProfile: ClimateProfile;

  // Wetter-Ranges (fuer Wetter-Generierung)
  weatherRanges: TerrainWeatherRanges;

  // Visuelle Darstellung
  displayColor: string;                   // Hex-Farbe fuer Map-Rendering
  icon?: string;                          // Optional: Icon-Referenz

  // Metadaten
  description?: string;
}

interface ClimateProfile {
  temperatureModifier: number;            // Offset in Grad Celsius
  humidityModifier: number;               // Offset in Prozent
  windExposure: 'sheltered' | 'normal' | 'exposed';
}

interface TerrainWeatherRanges {
  temperature: WeatherRange;              // in Grad Celsius
  wind: WeatherRange;                     // in km/h
  precipitation: WeatherRange;            // 0-100 (Wahrscheinlichkeit)
}

interface WeatherRange {
  min: number;                            // Minimum (z.B. extreme Kaelte)
  average: number;                        // Durchschnitt
  max: number;                            // Maximum (z.B. Hitzewelle)
}
```

---

## Default-Terrains

Mitgelieferte Terrain-Presets:

| Terrain | movementCost | encounterModifier | Temperatur | Wind | Niederschlag |
|---------|--------------|-------------------|------------|------|--------------|
| `road` | 1.0 | 0.5 | -5/15/35 | 5/20/60 | 10/30/70 |
| `plains` | 0.9 | 1.0 | -5/15/35 | 5/20/60 | 10/30/70 |
| `forest` | 0.6 | 1.2 | 0/15/30 | 0/10/30 | 20/40/70 |
| `hills` | 0.7 | 1.0 | -10/10/30 | 10/30/50 | 15/35/65 |
| `mountains` | 0.4 | 0.8 | -20/0/20 | 20/50/100 | 20/50/80 |
| `swamp` | 0.5 | 1.5 | 5/20/35 | 0/10/30 | 40/60/90 |
| `desert` | 0.7 | 0.7 | 0/35/50 | 5/15/80 | 0/5/20 |
| `water` | 1.0* | 0.5 | 5/18/30 | 10/30/80 | 20/40/70 |

*Water erfordert Boot - siehe Transport-Modi in [Travel-System.md](../features/Travel-System.md)

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
  "nativeCreatures": ["pixie", "dryad", "blink-dog"],
  "climateProfile": {
    "temperatureModifier": -5,
    "humidityModifier": 20,
    "windExposure": "sheltered"
  },
  "weatherRanges": {
    "temperature": { "min": 5, "average": 18, "max": 28 },
    "wind": { "min": 0, "average": 5, "max": 15 },
    "precipitation": { "min": 30, "average": 50, "max": 80 }
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
    precipitation: generateFromRange(terrain.weatherRanges.precipitation)
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

→ Details: [Encounter-System.md](../features/Encounter-System.md)

---

## Storage

```
Vault/SaltMarcher/data/
└── terrain/
    ├── _bundled/               # Mitgelieferte Default-Terrains
    │   ├── road.json
    │   ├── plains.json
    │   ├── forest.json
    │   ├── hills.json
    │   ├── mountains.json
    │   ├── swamp.json
    │   ├── desert.json
    │   └── water.json
    └── user/                   # User-erstellte Custom-Terrains
        └── fey-forest.json
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| TerrainDefinition Schema | ✓ | | Kern-Entity |
| movementCost | ✓ | | Travel-Integration |
| encounterModifier | ✓ | | Encounter-Integration |
| nativeCreatures | ✓ | | Encounter-Matching |
| Auto-Sync mit Creatures | ✓ | | Bidirektionale Konsistenz |
| climateProfile | ✓ | | Weather-Einfluss |
| weatherRanges | ✓ | | Weather-Generierung |
| Custom Terrains | ✓ | | User-erstellte Terrains |
| Default-Terrain Presets | ✓ | | Mitgelieferte Basis-Terrains |
| Terrain-Icons | | niedrig | Visuelle Verbesserung |

---

*Siehe auch: [Creature.md](Creature.md) | [Travel-System.md](../features/Travel-System.md) | [Weather-System.md](../features/Weather-System.md) | [EntityRegistry.md](../architecture/EntityRegistry.md)*
