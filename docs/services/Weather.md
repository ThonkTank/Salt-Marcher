# Weather

> **Typ:** Stateless Service
> **Verantwortlichkeit:** Wetter-Generierung - Temperatur, Wind, Niederschlag, Nebel, Sichtweite
>
> **Referenzierte Schemas:**
> - [terrain-definition.md](../entities/terrain-definition.md) - Terrain-Klima-Einfluss
>
> **Wird aufgerufen von:** Map (speichert Weather), Travel (Speed-Modifier), Encounter (Visibility)

Stateless Service zur Wetter-Generierung. Nimmt Terrain, Zeit und Saison als Input, liefert Weather-Objekt zurueck. Kein eigener State - der Aufrufer (typischerweise Map) speichert das Ergebnis.

---

## Service-Interface

```typescript
interface WeatherService {
  generate(input: WeatherInput): Weather;
  transition(current: Weather, target: Weather, speed?: number): Weather;
  deriveFeatures(weather: Weather, time: TimeSegment): EntityId<'feature'>[];
}

interface WeatherInput {
  terrain: TerrainDefinition;
  season: Season;
  timeSegment: TimeSegment;
  elevation: number;
  seed?: number;
  // Optional: Fuer Area-Averaging
  neighborTerrains?: TerrainDefinition[];
}
```

**Verwendung:**
```typescript
// Map ruft Service auf und speichert Ergebnis
const weather = weatherService.generate({
  terrain: currentTile.terrain,
  season: calendar.currentSeason,
  timeSegment: time.segment,
  elevation: currentTile.elevation,
  seed: generateSeed(time, position)
});

map.currentWeather = weather;
```

---

## Weather-Schema

```typescript
interface Weather {
  // Kern-Parameter
  temperature: number;           // Aktuelle Temperatur in °C
  wind: number;                  // Wind in km/h
  windDirection: HexDirection;   // 6 Hex-kompatible Richtungen

  // Niederschlag
  precipChance: number;          // 0-100: Wahrscheinlichkeit
  precipIntensity: number;       // 0-100: Staerke
  precipitationType: PrecipitationType;

  // Nebel
  fogLevel: number;              // 0-1: Nebeldichte

  // Sichtweite (berechnet)
  visibilityModifier: number;    // 0.1-1.0

  // Astronomisch
  cloudCover: number;            // 0-1
}

type HexDirection = 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW';
type PrecipitationType = 'none' | 'drizzle' | 'rain' | 'heavy_rain' | 'snow' | 'blizzard' | 'hail';
```

---

## Parameter-Kategorien

### Temperatur

| Kategorie | Bereich (°C) | Mechanische Effekte |
|-----------|--------------|---------------------|
| `freezing` | < -10 | Erschoepfung ohne Winterkleidung, Wasserflaechen gefroren |
| `cold` | -10 bis 5 | Kaelte-Risiko ohne warme Kleidung |
| `cool` | 5 bis 15 | Keine |
| `mild` | 15 bis 25 | Keine |
| `warm` | 25 bis 35 | Erhoehter Wasserbedarf |
| `hot` | > 35 | Erschoepfung, doppelter Wasserbedarf |

### Wind

| Staerke | km/h | Effekte |
|--------|------|---------|
| `calm` | 0-10 | Keine |
| `light` | 10-30 | Keine |
| `moderate` | 30-50 | Fernkampf -2, Segeln +20% Speed |
| `strong` | 50-70 | Fernkampf Nachteil, Fliegen schwierig |
| `gale` | > 70 | Kein Fernkampf, kein Fliegen, Bewegung halbiert |

### Niederschlag

| Typ | Sichtweite | Weitere Effekte |
|-----|------------|-----------------|
| `none` | Normal | Keine |
| `drizzle` | Normal | Feucht |
| `rain` | 300m | Perception -2, Tracks schwerer zu finden |
| `heavy_rain` | 100m | Perception -5, schwieriges Terrain |
| `snow` | 200m | Kaelte, langsamere Bewegung |
| `blizzard` | 30m | Kaelte, stark reduzierte Bewegung |
| `hail` | 200m | Schaden bei Exposition |

### Nebel

| fogLevel | Bezeichnung | Sichtweite | Effekte |
|----------|-------------|------------|---------|
| 0.0-0.2 | Klar | Normal | Keine |
| 0.2-0.5 | Dunstig | 500m | Perception -1 |
| 0.5-0.7 | Neblig | 100m | Perception -3 |
| 0.7-0.9 | Dichter Nebel | 50m | Perception -5, leicht zu verlaufen |
| 0.9-1.0 | Undurchdringlich | 10m | Fast blind, hohes Verirrungsrisiko |

---

## Generierungs-Algorithmus

### Terrain-basierte Ranges

Jedes Terrain definiert Wetter-Ranges:

```typescript
interface TerrainWeatherRanges {
  temperature: WeatherRange;     // in °C
  wind: WeatherRange;            // in km/h
  precipChance: WeatherRange;    // 0-100
  precipIntensity: WeatherRange; // 0-100
  fogChance: WeatherRange;       // 0-100
}

interface WeatherRange {
  min: number;
  average: number;
  max: number;
}
```

### Terrain-Beispiele

| Terrain | Temperatur (°C) | Wind (km/h) | Precip-Chance (%) | Precip-Intensitaet (%) | Fog-Chance (%) |
|---------|-----------------|-------------|-------------------|------------------------|----------------|
| `plains` | -5 / 15 / 35 | 5 / 20 / 60 | 10 / 30 / 70 | 10 / 30 / 60 | 5 / 15 / 40 |
| `mountains` | -20 / 0 / 20 | 20 / 50 / 100 | 20 / 50 / 80 | 20 / 50 / 80 | 10 / 30 / 60 |
| `desert` | 0 / 35 / 50 | 5 / 15 / 80 | 0 / 5 / 20 | 5 / 20 / 50 | 0 / 5 / 20 |
| `swamp` | 5 / 20 / 35 | 0 / 10 / 30 | 40 / 60 / 90 | 20 / 40 / 70 | 30 / 50 / 80 |
| `forest` | 0 / 15 / 30 | 0 / 10 / 30 | 20 / 40 / 70 | 15 / 35 / 60 | 20 / 40 / 70 |
| `water` | 5 / 18 / 30 | 10 / 30 / 80 | 20 / 40 / 70 | 20 / 40 / 70 | 15 / 30 / 50 |

**Leseweise:** min / average / max

### Range-Sampling

```typescript
function sampleFromRange(range: WeatherRange, seed: number): number {
  const random = seededRandom(seed);
  const deviation = (random() - 0.5) * 2; // -1 bis +1

  if (deviation >= 0) {
    return lerp(range.average, range.max, deviation);
  } else {
    return lerp(range.average, range.min, -deviation);
  }
}
```

---

## Modifier-Stacking

### Berechnungs-Reihenfolge

```
Terrain-Basis → + Saison-Modifier → + Time-Segment → + Elevation → Finale Werte
```

### Saison-Modifier

| Saison | Temperatur-Offset |
|--------|-------------------|
| Fruehling | 0°C |
| Sommer | +10°C |
| Herbst | -5°C |
| Winter | -15°C |

### Time-Segment-Modifier

| Segment | Stunden | Temperatur-Modifikator |
|---------|---------|------------------------|
| `dawn` | 5-8 | -5°C |
| `morning` | 8-12 | 0°C |
| `midday` | 12-15 | +5°C |
| `afternoon` | 15-18 | 0°C |
| `dusk` | 18-21 | -5°C |
| `night` | 21-5 | -10°C |

### Elevation-Modifier

```
Temperatur-Offset = -6.5°C × (Elevation / 1000m)
```

| Elevation | Temperatur-Offset |
|-----------|-------------------|
| 0m | 0°C |
| 500m | -3.25°C |
| 1000m | -6.5°C |
| 2000m | -13°C |

---

## Abgeleitete Werte

### precipitationType

```typescript
function derivePrecipitationType(
  precipChance: number,
  precipIntensity: number,
  temperature: number,
  seed: number
): PrecipitationType {
  const roll = seededRandom(seed)() * 100;
  if (roll > precipChance) return 'none';

  const isSnow = temperature < 2;
  const isHailCondition = temperature >= 15 && precipIntensity > 70;

  if (isHailCondition && seededRandom(seed + 1)() < 0.2) {
    return 'hail';
  }

  if (precipIntensity < 20) {
    return isSnow ? 'snow' : 'drizzle';
  } else if (precipIntensity < 60) {
    return isSnow ? 'snow' : 'rain';
  } else {
    return isSnow ? 'blizzard' : 'heavy_rain';
  }
}
```

### fogLevel

```typescript
function generateFogLevel(fogChance: number, seed: number): number {
  const roll = seededRandom(seed)() * 100;
  if (roll > fogChance) return 0;

  const intensity = (fogChance - roll) / fogChance;
  return intensity;
}
```

### visibilityModifier

```typescript
function calculateVisibility(
  precipitationType: PrecipitationType,
  fogLevel: number
): number {
  const precipVisibility: Record<PrecipitationType, number> = {
    'none': 1.0, 'drizzle': 1.0,
    'rain': 0.75, 'snow': 0.75,
    'heavy_rain': 0.5, 'blizzard': 0.25, 'hail': 0.75
  };

  const fogVisibility = 1.0 - (fogLevel * 0.9);

  return Math.min(precipVisibility[precipitationType], fogVisibility);
}
```

---

## Transitions

Fuer sanfte Wetter-Uebergaenge (optional):

```typescript
function transitionWeather(
  current: Weather,
  target: Weather,
  speed: number = 0.3
): Weather {
  return {
    temperature: lerp(current.temperature, target.temperature, speed),
    wind: lerp(current.wind, target.wind, speed),
    windDirection: target.windDirection,
    precipChance: target.precipChance,
    precipIntensity: target.precipIntensity,
    precipitationType: target.precipitationType,
    fogLevel: lerp(current.fogLevel, target.fogLevel, speed),
    visibilityModifier: target.visibilityModifier,
    cloudCover: lerp(current.cloudCover, target.cloudCover, speed)
  };
}
```

---

## Weather-Events

Bestimmte Kombinationen ergeben spezielle Events:

| Event | Bedingungen | Effekte |
|-------|-------------|---------|
| `blizzard` | freezing + gale + snow | Reisen fast unmoeglich |
| `thunderstorm` | warm + strong + heavy_rain | Blitzschlag-Gefahr |
| `heatwave` | hot + calm + none | Doppelte Erschoepfungs-Checks |
| `dense_fog` | cool + calm + fogLevel > 0.7 | Sichtweite 10m |
| `dust_storm` | hot + gale + none (desert) | Sichtweite 20m, Schaden |

```typescript
function detectWeatherEvent(weather: Weather, terrain: TerrainType): WeatherEvent | null {
  if (weather.temperature < -10 && weather.wind > 70 && weather.precipitationType === 'blizzard') {
    return 'blizzard';
  }
  if (weather.temperature > 25 && weather.wind > 50 && weather.precipitationType === 'heavy_rain') {
    return 'thunderstorm';
  }
  // ... weitere Events
  return null;
}
```

---

## Feature-Mapping

Der Service kann aktive Features fuer Encounter-Balance ableiten:

```typescript
function deriveWeatherFeatures(
  weather: Weather,
  timeSegment: TimeSegment,
  moonPhase?: string,
): EntityId<'feature'>[] {
  const features: EntityId<'feature'>[] = [];

  // Licht-Features
  const brightness = calculateBrightness(timeSegment, weather.cloudCover, moonPhase);
  if (brightness < 0.1) features.push('darkness');
  else if (brightness < 0.5) features.push('dim-light');

  // Sicht-Features
  if (weather.fogLevel > 0.5 || weather.precipIntensity > 60) {
    features.push('reduced-visibility');
  }

  // Wind-Features
  if (weather.wind > 50) features.push('high-wind');

  return features;
}
```

---

## Area-Averaging (Optional)

Fuer realistischeres Wetter ueber mehrere Tiles:

```typescript
function generateWithAveraging(
  centerTerrain: TerrainDefinition,
  neighborTerrains: TerrainDefinition[],
  input: Omit<WeatherInput, 'terrain'>
): Weather {
  const RADIUS_WEIGHT = 0.7; // Nachbarn haben 70% Gewicht

  const centerWeather = generate({ ...input, terrain: centerTerrain });

  if (neighborTerrains.length === 0) return centerWeather;

  const neighborAvg = averageWeather(
    neighborTerrains.map(t => generate({ ...input, terrain: t }))
  );

  return blendWeather(centerWeather, neighborAvg, RADIUS_WEIGHT);
}
```

---

## Prioritaet

| Komponente | MVP | Post-MVP |
|------------|:---:|:--------:|
| Basis-Parameter (Temp, Wind, Precipitation) | ✓ | |
| Terrain-basierte Ranges | ✓ | |
| Saison/Time/Elevation Modifier | ✓ | |
| Niederschlagstyp-Ableitung | ✓ | |
| Nebel-Generierung | ✓ | |
| Weather-Events | | mittel |
| Area-Averaging | | niedrig |
| Feature-Mapping | | mittel |

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
