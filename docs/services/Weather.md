# Weather

> **Typ:** Stateless Service
> **Verantwortlichkeit:** Faktorbasierte Wetter-Generierung mit Event-Matching
>
> **Referenzierte Schemas:**
> - [terrain-definition.md](../types/terrain-definition.md) - Terrain-Klima-Ranges
> - [weather.ts](../../src/types/weather.ts) - Weather-Typen
>
> **Wird aufgerufen von:** sessionState (speichert Weather), Travel (Speed-Modifier), Encounter (Visibility)

Stateless Service zur Wetter-Generierung. Generiert Weather aus 5 Grundfaktoren (temperature, humidity, wind, pressure, cloudCover) basierend auf Terrain-Ranges. Weather-Events matchen gegen diese Faktoren mit Preconditions.

---

## Architektur-Uebersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Weather-Generierung                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Terrain-Ranges ──┐                                                 │
│  Season          ─┼─► generateFactors() ──► WeatherFactors         │
│  TimeSegment     ─┘           │                   │                 │
│  Elevation                    │                   ▼                 │
│                               │        matchWeatherEvent()          │
│                               │                   │                 │
│                               │                   ▼                 │
│                               └──────────► Weather                  │
│                                           ├─ factors                │
│                                           ├─ event                  │
│                                           ├─ visibilityModifier     │
│                                           └─ travelSpeedModifier    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Service-Interface

```typescript
export function generateWeather(input: {
  terrain: TerrainDefinition;
  season: Season;
  timeSegment: TimeSegment;
  elevation?: number;
  seed?: number;
}): Weather;
```

**Verwendung:**
```typescript
import { generateWeather } from '@/services/weatherGenerator/weatherGenerator';

const weather = generateWeather({
  terrain: tile.terrain,
  season: 'summer',
  timeSegment: 'midday',
  elevation: 500,
});

// weather.visibilityModifier → 0.75 (bei Regen)
// weather.event.id → 'rain'
// weather.factors.temperature → 28.5
```

---

## Weather-Schema

### WeatherFactors

Generierte Basis-Werte aus Terrain-Ranges:

```typescript
interface WeatherFactors {
  temperature: number;    // °C (-40 bis +50)
  humidity: number;       // % (0-100)
  wind: number;           // km/h (0-120)
  pressure: number;       // -1 bis +1 (Tief- bis Hochdruck)
  cloudCover: number;     // 0-1
}
```

### WeatherEvent

Vault-persistierte Event-Entity mit Preconditions:

```typescript
interface WeatherEvent {
  id: string;
  name: string;

  // Preconditions (alle optional, nur gesetzte werden geprueft)
  preconditions: {
    temperature?: { min?: number; max?: number };
    humidity?: { min?: number; max?: number };
    wind?: { min?: number; max?: number };
    pressure?: { min?: number; max?: number };
    cloudCover?: { min?: number; max?: number };
    terrains?: string[];  // Nur in diesen Terrains
  };

  // Gameplay-Effekte
  effects: {
    visibilityModifier: number;         // 0.1-1.0
    travelSpeedModifier?: number;       // 0.1-1.0, default 1.0
    perceptionModifier?: number;        // z.B. -2, -5
    rangedAttackModifier?: number;      // z.B. -2, -4
    exhaustionRisk?: boolean;
  };

  description: string;
  tags: string[];                       // z.B. ['precipitation', 'dangerous']
  priority: number;                     // Hoeher = bevorzugt bei Mehrfach-Match
}
```

### Weather (Finales Objekt)

```typescript
interface Weather {
  factors: WeatherFactors;
  event: WeatherEvent;
  // Convenience-Felder (aus event.effects)
  visibilityModifier: number;
  travelSpeedModifier: number;
}
```

---

## Generierungs-Algorithmus

### 1. Faktoren aus Terrain-Ranges

Jedes Terrain definiert Weather-Ranges:

```typescript
interface TerrainWeatherRanges {
  temperature: WeatherRange;   // °C
  humidity: WeatherRange;      // % (0-100)
  wind: WeatherRange;          // km/h
  pressure: WeatherRange;      // -1 bis +1
  cloudCover: WeatherRange;    // 0-1
}

interface WeatherRange {
  min: number;
  average: number;
  max: number;
}
```

### 2. Range-Sampling

```typescript
function sampleFromRange(range: WeatherRange, seed?: number): number {
  const random = seed !== undefined ? seededRandom(seed) : Math.random();
  const deviation = (random - 0.5) * 2; // -1 bis +1

  if (deviation >= 0) {
    return lerp(range.average, range.max, deviation);
  } else {
    return lerp(range.average, range.min, -deviation);
  }
}
```

### 3. Modifier anwenden

```typescript
// Season-Offset
temperature += SEASON_TEMPERATURE_OFFSET[season];

// Time-Segment-Offset
temperature += TIME_TEMPERATURE_OFFSET[timeSegment];

// Elevation-Offset (-6.5°C pro 1000m)
temperature += (elevation / 1000) * ELEVATION_TEMPERATURE_FACTOR;
```

### 4. Event-Matching

```typescript
function matchWeatherEvent(factors: WeatherFactors, terrainId: string): WeatherEvent {
  const allEvents = vault.getAllEntities<WeatherEvent>('weatherEvent');

  const matches = allEvents
    .filter(e => checkPreconditions(e.preconditions, factors, terrainId))
    .sort((a, b) => b.priority - a.priority);

  return matches[0] ?? getDefaultEvent();
}
```

---

## Terrain-Beispiele

| Terrain | Temperature (°C) | Humidity (%) | Wind (km/h) | Pressure | CloudCover |
|---------|------------------|--------------|-------------|----------|------------|
| grassland | -5 / 15 / 35 | 20 / 45 / 75 | 5 / 20 / 60 | -0.3 / 0.1 / 0.5 | 0.05 / 0.35 / 0.7 |
| forest | 0 / 15 / 30 | 40 / 60 / 85 | 0 / 10 / 30 | -0.3 / 0.1 / 0.5 | 0.2 / 0.5 / 0.8 |
| mountain | -20 / 0 / 20 | 30 / 55 / 85 | 20 / 50 / 100 | -0.5 / -0.2 / 0.3 | 0.1 / 0.45 / 0.8 |
| desert | 0 / 35 / 50 | 5 / 15 / 30 | 5 / 15 / 80 | -0.2 / 0.2 / 0.6 | 0 / 0.15 / 0.4 |
| swamp | 5 / 20 / 35 | 60 / 80 / 98 | 0 / 10 / 30 | -0.3 / 0 / 0.4 | 0.3 / 0.6 / 0.9 |
| arctic | -40 / -15 / 5 | 40 / 60 / 80 | 10 / 40 / 100 | -0.4 / -0.1 / 0.4 | 0.1 / 0.4 / 0.75 |

**Leseweise:** min / average / max

---

## Modifier-Konstanten

### Season-Modifier

```typescript
const SEASON_TEMPERATURE_OFFSET: Record<Season, number> = {
  spring: 0,
  summer: 10,
  autumn: -5,
  winter: -15,
};
```

### Time-Segment-Modifier

```typescript
const TIME_TEMPERATURE_OFFSET: Record<TimeSegment, number> = {
  dawn: -5,
  morning: 0,
  midday: 5,
  afternoon: 0,
  dusk: -5,
  night: -10,
};
```

### Elevation-Modifier

```typescript
const ELEVATION_TEMPERATURE_FACTOR = -6.5; // °C pro 1000m
```

---

## Weather-Events

Events werden nach Prioritaet gematcht. Hoehere Prioritaet gewinnt bei Mehrfach-Match.

### Fallback-Events (Priority: -1 bis 0)

| Event | Preconditions | Visibility | Speed |
|-------|---------------|------------|-------|
| `cloudy` | (immer) | 0.9 | 1.0 |
| `clear` | humidity < 40, cloudCover < 0.3 | 1.0 | 1.0 |
| `overcast` | cloudCover > 0.7 | 0.85 | 1.0 |
| `partly_cloudy` | cloudCover 0.3-0.7 | 0.95 | 1.0 |

### Niederschlag (Priority: 1-4)

| Event | Preconditions | Visibility | Speed | Tags |
|-------|---------------|------------|-------|------|
| `drizzle` | humidity 55-75, temp > 3°C | 0.9 | 0.95 | precipitation, light, rain |
| `rain` | humidity > 65, temp > 3°C, pressure < 0.2 | 0.75 | 0.9 | precipitation, rain |
| `heavy_rain` | humidity > 80, temp > 5°C, pressure < -0.1 | 0.5 | 0.7 | precipitation, heavy, rain |
| `light_snow` | humidity 50-75, temp < 2°C | 0.85 | 0.9 | precipitation, light, snow, cold |
| `snow` | humidity > 55, temp < 0°C | 0.7 | 0.8 | precipitation, snow, cold |
| `blizzard` | humidity > 65, temp < -5°C, wind > 50 | 0.2 | 0.3 | precipitation, snow, cold, dangerous, storm |

### Nebel (Priority: 1-3)

| Event | Preconditions | Visibility | Tags |
|-------|---------------|------------|------|
| `mist` | humidity 70-85, wind < 20 | 0.7 | fog, light |
| `fog` | humidity > 85, wind < 15 | 0.4 | fog |
| `dense_fog` | humidity > 95, wind < 10 | 0.15 | fog, dangerous |

### Stuerme (Priority: 3-5)

| Event | Preconditions | Visibility | Speed | Tags |
|-------|---------------|------------|-------|------|
| `thunderstorm` | humidity > 75, temp > 15°C, pressure < -0.25, wind > 30 | 0.5 | 0.6 | storm, dangerous, precipitation |
| `windstorm` | wind > 70 | 0.8 | 0.5 | storm, wind |
| `sandstorm` | humidity < 25, wind > 45, terrains: [desert] | 0.15 | 0.4 | storm, dangerous, terrain-specific |

### Temperatur-Extreme (Priority: 3)

| Event | Preconditions | Visibility | Speed | Tags |
|-------|---------------|------------|-------|------|
| `heatwave` | temp > 38°C, humidity < 35, wind < 20 | 0.95 | 0.8 | temperature, dangerous, hot |
| `cold_snap` | temp < -20°C, wind > 20 | 0.9 | 0.7 | temperature, dangerous, cold |

---

## Creature Weather-Preferences

Kreaturen referenzieren Event-Tags (nicht Event-IDs):

```typescript
creature.preferences.weather = {
  prefers: ['precipitation', 'fog'],     // Mag Regen und Nebel
  avoids: ['hot', 'dangerous', 'storm'], // Meidet Hitze und Gefahr
};
```

**Matching in groupSeed.ts:**
```typescript
if (weather?.event && creature.preferences?.weather) {
  const { prefers, avoids } = creature.preferences.weather;
  const eventTags = weather.event.tags;

  if (prefers?.some(tag => eventTags.includes(tag))) {
    weight *= CREATURE_WEIGHTS.weatherPrefers;  // +30%
  }
  else if (avoids?.some(tag => eventTags.includes(tag))) {
    weight *= CREATURE_WEIGHTS.weatherAvoids;   // -50%
  }
}
```

---

## Integration

### Encounter-Pipeline

Weather wird in der Encounter-Pipeline verwendet:

1. **encounterGenerator.ts** - Nimmt Weather als Context-Parameter
2. **groupSeed.ts** - Creature-Auswahl basierend auf Weather-Tags
3. **encounterDistance.ts** - Sichtweite basierend auf visibilityModifier

### Encounter-Persistierung

```typescript
// In EncounterInstance.context
weather: {
  eventId: string;           // z.B. 'rain'
  visibilityModifier: number; // z.B. 0.75
}
```

---

## CLI-Testing

```bash
# Weather generieren
npm run cli -- services/weatherGenerator/weatherGenerator generateWeather \
  '{"terrain":{"id":"forest","weatherRanges":{...}},"season":"summer","timeSegment":"midday"}'

# Mit Elevation
npm run cli -- services/weatherGenerator/weatherGenerator generateWeather \
  '{"terrain":{"id":"mountain","weatherRanges":{...}},"season":"winter","timeSegment":"night","elevation":2000}'
```

---

## Prioritaet

| Komponente | MVP | Post-MVP |
|------------|:---:|:--------:|
| WeatherFactors-Generierung | ✓ | |
| Terrain-basierte Ranges | ✓ | |
| Season/Time/Elevation Modifier | ✓ | |
| Event-Matching mit Preconditions | ✓ | |
| Creature Weather-Preferences | ✓ | |
| Area-Averaging (Nachbar-Tiles) | | niedrig |
| Weather-Transitions (Interpolation) | | niedrig |
