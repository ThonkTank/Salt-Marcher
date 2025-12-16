Wetter-Simulation mit räumlicher und zeitlicher Kohärenz. Basiert auf Klimazonen.

#### Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│ EBENE 1: Statisches Klima (vorberechnet, persistiert)           │
│ - Tile.baseClimate (User-Input)                                 │
│ - Tile.timeOfDayMod[6], Tile.monthMod[12] (System-berechnet)    │
│ - ClimateZone.climate (aggregiert)                              │
└─────────────────────────────────┬───────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ EBENE 2: Dynamisches Wetter (simuliert, persistiert)            │
│ - WeatherPhenomenon[] (Fronten, Hochs, Tiefs, Stürme)           │
│ - Bewegen sich zwischen Zonen basierend auf Windrichtung        │
│ - Entstehen/Vergehen basierend auf Klima-Bedingungen            │
└─────────────────────────────────┬───────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│ EBENE 3: Aktuelles Wetter (berechnet zur Runtime)               │
│ - getZoneWeather(zone, time, date)                              │
│ - = Basis-Klima + Daily-Fluktuation + Phänomen-Effekte          │
└─────────────────────────────────────────────────────────────────┘
```

---

#### Datenstrukturen

```typescript
interface WeatherData {
  temperature: number;      // °C
  windSpeed: number;        // km/h
  windDirection: number;    // 0-359°
  cloudCover: number;       // 0-100%
  precipitation: number;    // mm/Tag
  humidity: number;         // 0-100%
}

interface WeatherPhenomenon {
  id: string;
  type: "rain_front" | "cold_front" | "high_pressure" | "low_pressure" | "storm";

  currentZones: string[];         // Betroffene Zonen
  heading: number;                // Bewegungsrichtung (°)
  speed: number;                  // Zonen pro Tag

  intensity: number;              // 0-1
  age: number;                    // Tage seit Entstehung
  maxAge: number;

  effects: {
    temperature?: number;         // additiv (±°C)
    precipitation?: number;       // multiplikativ (×)
    cloudCover?: number;          // additiv (±%)
    windSpeed?: number;           // multiplikativ (×)
    humidity?: number;            // additiv (±%)
  };
}

interface MapWeatherState {
  phenomena: WeatherPhenomenon[];   // Aktive Wetter-Phänomene
  lastSimulated: CalendarDate;       // Bis wann wurde simuliert?
}

// Auf Map-Level gespeichert:
interface MapData {
  climateZones: MapClimateZones;
  populations: MapPopulations;
  weatherState: MapWeatherState;
}
```

---

#### Ebene 1: Statisches Klima

Siehe `tile.md` und `climate-math.md`.

**Inputs (aus Tile):**
- `baseClimate`: User-Input (Jahresdurchschnitt, Tagesmitte)
- `timeOfDayMod[6]`: System-berechnet (dawn, morning, midday, afternoon, dusk, night)
- `monthMod[12]`: System-berechnet (jan - dec)

**Berechnung:**
```typescript
function getClimateValue(
  tile: Tile,
  field: ClimateField,
  time: TimeOfDayIndex,
  month: MonthIndex
): number {
  const base = tile.baseClimate[field];
  const timeMod = tile.timeOfDayMod[field][time];
  const monthMod = tile.monthMod[field][month];

  if (field === "temperature" || field === "windDirection") {
    return base + timeMod + monthMod;  // Additiv
  } else {
    return base * timeMod * monthMod;  // Multiplikativ
  }
}
```

---

#### Ebene 2: Wetter-Phänomene

Großräumige Wettersysteme, die sich zwischen Klimazonen bewegen.

**Phänomen-Typen:**

| Phänomen | Initial | Maximal | Charakteristik |
|----------|---------|---------|----------------|
| high_pressure | 3-5 Zonen | 10-20 Zonen | Riesig, stabil, langsam |
| low_pressure | 2-4 Zonen | 8-15 Zonen | Groß, aber kleiner als Hochs |
| rain_front | 1-2 Zonen | 5-10 Zonen | Lang aber schmal (Linie) |
| cold_front | 1-2 Zonen | 4-8 Zonen | Schnell, scharf begrenzt |
| storm | 1 Zone | 2-3 Zonen | Klein, lokal, kurzlebig |

```typescript
const PHENOMENON_SIZE = {
  high_pressure: { initial: [3, 5], max: 20, shape: 'blob' },
  low_pressure:  { initial: [2, 4], max: 15, shape: 'blob' },
  rain_front:    { initial: [1, 2], max: 10, shape: 'line' },
  cold_front:    { initial: [1, 2], max: 8,  shape: 'line' },
  storm:         { initial: [1, 1], max: 3,  shape: 'blob' },
};
```

**Spawn-Wahrscheinlichkeit (basierend auf Zone-Klima):**

| Phänomen | Hohe Wahrscheinlichkeit bei |
|----------|----------------------------|
| high_pressure | Trocken, wenig Wolken, wenig Niederschlag |
| low_pressure | Feucht, warm, viele Wolken |
| rain_front | Hohe Feuchtigkeit, Küstennähe |
| cold_front | Große Temperatur-Differenz zu Nachbarn |
| storm | Temperatur >25°C + Humidity >70% |

```typescript
function generatePhenomenonForZone(zone: ClimateZone): WeatherPhenomenon {
  const { climate } = zone;

  const weights = {
    high_pressure: calculateHighPressureChance(climate),
    low_pressure: calculateLowPressureChance(climate),
    rain_front: calculateRainFrontChance(climate),
    cold_front: calculateColdFrontChance(climate),
    storm: calculateStormChance(climate),
  };

  const type = weightedRandom(weights);

  return {
    id: generateId(),
    type,
    currentZones: [zone.id],
    heading: climate.windDirection,  // Vorherrschende Windrichtung
    speed: getPhenomenonSpeed(type),
    intensity: getInitialIntensity(type, climate),
    age: 0,
    maxAge: getPhenomenonLifespan(type),
    effects: getPhenomenonEffects(type),
  };
}
```

**Phänomen-Nachfolge (immer aktives Wetter):**

Es gibt immer Wetter - "kein Phänomen" existiert nicht. Wenn eine Zone leer wird:

```
Zone wird "leer"?
    ↓
1. Prüfe Nachbar-Zonen: Kommt ein Phänomen herein?
    → Windrichtung des Phänomens zeigt grob zu uns (<45° Differenz)?
    → JA: Phänomen erweitert sich in diese Zone
    → NEIN: ↓
2. Spawne neues Phänomen basierend auf Zone-Klima
```

```typescript
function findIncomingPhenomenon(zone, allZones, phenomena): WeatherPhenomenon | null {
  const neighbors = getNeighborZones(zone, allZones);

  for (const neighbor of neighbors) {
    for (const p of phenomena) {
      if (!p.currentZones.includes(neighbor.id)) continue;

      const directionToUs = angleTo(neighbor.center, zone.center);
      const headingDiff = angleDifference(p.heading, directionToUs);

      if (headingDiff < 45) return p;  // Zieht zu uns
    }
  }
  return null;
}
```

---

#### Wind-System

**Zwei Arten von Wind:**

1. **Vorherrschender Wind (statisch)**
   - `Tile.baseClimate.windDirection` = langfristiger Durchschnitt
   - Bestimmt durch Geographie (Passatwinde, Westwindzone, lokale Effekte)
   - TimeOfDay und Month Modifikatoren für tägliche/saisonale Schwankung

2. **Aktueller Wind (dynamisch)**
   - Wird von Phänomenen beeinflusst:
     - Tiefdruck: Wind dreht Richtung Zentrum
     - Hochdruck: Wind dreht vom Zentrum weg
     - Fronten: Wind dreht in Bewegungsrichtung

```typescript
function getCurrentWind(zone, time, date, phenomena): { speed: number, direction: number } {
  let direction = getClimateValue(zone, "windDirection", time, date.month);
  let speed = getClimateValue(zone, "windSpeed", time, date.month);

  for (const p of affectingPhenomena) {
    if (p.type === "low_pressure") {
      direction = blendAngles(direction, angleTo(zone, p.center), p.intensity * 0.5);
      speed *= (1 + p.intensity * 0.3);
    } else if (p.type === "high_pressure") {
      direction = blendAngles(direction, angleTo(p.center, zone), p.intensity * 0.3);
      speed *= (1 - p.intensity * 0.2);
    }
    // ... weitere Phänomen-Typen
  }
  return { speed, direction };
}
```

---

#### Tägliche Fluktuation (klima-abhängig)

Schwankungsbreite wird aus Zone-Eigenschaften berechnet - nicht magischer Zufall:

| Wert | Hohe Volatilität | Niedrige Volatilität |
|------|------------------|---------------------|
| temperature | Trocken, kontinental, Höhe | Küste, feucht, bewölkt |
| cloudCover | Kontinental, Gebirge, gemäßigt | Wüste (klar), Tropen (bewölkt) |
| precipitation | Feucht, Küste, Gebirge | Wüste |
| windSpeed | Küste, Höhe, Flachland | Wald, Täler |
| windDirection | Küste (Land-See), Gebirge | Flaches offenes Land |
| humidity | Küste, Gebirge | Wüste, Regenwald (Extreme stabil) |

```typescript
function getZoneVolatility(zone: ClimateZone): WeatherVolatility {
  const { climate } = zone;
  const continentality = calculateContinentality(zone);  // 0 = Küste, 1 = Inland
  const isCoastal = continentality < 0.3;
  const isHighland = climate.elevation > 1500;

  return {
    temperature: {
      range: 3,
      multiplier: isCoastal ? 0.3 : (1 + continentality * 0.5) * (climate.humidity < 30 ? 1.3 : 1.0)
    },
    cloudCover: {
      range: 20,
      multiplier: (climate.cloudCover > 80 || climate.cloudCover < 20) ? 0.3 : (1 + continentality * 0.4)
    },
    precipitation: {
      range: 0.5,
      multiplier: climate.precipitation < 1 ? 0.5 : isCoastal ? 1.3 : isHighland ? 1.4 : 1.0
    },
    windSpeed: {
      range: 0.3,
      multiplier: isCoastal ? 1.4 : isHighland ? 1.5 : climate.elevation < 200 ? 1.2 : 0.7
    },
    windDirection: {
      range: 30,
      multiplier: isCoastal ? 1.5 : isHighland ? 1.3 : 0.6
    },
    humidity: {
      range: 10,
      multiplier: (climate.humidity > 85 || climate.humidity < 20) ? 0.3 : isCoastal ? 1.4 : 1.0
    },
  };
}

function getDailyModifier(zone: ClimateZone, date: CalendarDate): WeatherModifiers {
  const seed = hash(zone.id + dateToString(date));
  const vol = getZoneVolatility(zone);

  return {
    temperature: seededRandom(seed, 'temp', -1, +1) * vol.temperature.range * vol.temperature.multiplier,
    cloudCover: seededRandom(seed, 'cloud', -1, +1) * vol.cloudCover.range * vol.cloudCover.multiplier,
    precipitation: 1 + seededRandom(seed, 'precip', -1, +1) * vol.precipitation.range * vol.precipitation.multiplier,
    windSpeed: 1 + seededRandom(seed, 'wind', -1, +1) * vol.windSpeed.range * vol.windSpeed.multiplier,
    windDirection: seededRandom(seed, 'dir', -1, +1) * vol.windDirection.range * vol.windDirection.multiplier,
    humidity: seededRandom(seed, 'humid', -1, +1) * vol.humidity.range * vol.humidity.multiplier,
  };
}
```

**Ergebnis-Beispiele:**

| Zone | Temp-Schwankung | Wind-Schwankung | Grund |
|------|-----------------|-----------------|-------|
| Küste | ±0.9°C | ±13% | Meer dämpft Temp, aber Land-See-Wind |
| Gemäßigt feucht | ±2°C | ±9% | Moderate Dämpfung |
| Wüste | ±4.5°C | ±12% | Keine Dämpfung, offen |
| Hochgebirge | ±5°C | ±14% | Höhe + turbulent |

---

#### Variation auf mehreren Zeitskalen

| Zeitskala | Quelle | Beispiel |
|-----------|--------|----------|
| Stunden | timeOfDayMod[6] | Morgens kühler, mittags wärmer |
| Tage | dailyModifier (Seed) | Heute 22°C, morgen 24°C |
| Tage-Wochen | WeatherPhenomenon | Regenfront, dann Hochdruck |
| Monate | monthMod[12] | Sommer wärmer als Winter |

---

#### Ebene 3: Aktuelles Wetter

**Finale Wetter-Berechnung (alle Ebenen kombiniert):**

```typescript
function getWeather(zone: ClimateZone, time: TimeOfDayIndex, date: CalendarDate, phenomena: WeatherPhenomenon[]): WeatherData {
  // 1. Statisches Klima (Base + TimeOfDay + Month)
  const base = {
    temperature: getClimateValue(zone.representativeTile, "temperature", time, date.month),
    windSpeed: getClimateValue(zone.representativeTile, "windSpeed", time, date.month),
    windDirection: getClimateValue(zone.representativeTile, "windDirection", time, date.month),
    cloudCover: getClimateValue(zone.representativeTile, "cloudCover", time, date.month),
    precipitation: getClimateValue(zone.representativeTile, "precipitation", time, date.month),
    humidity: getClimateValue(zone.representativeTile, "humidity", time, date.month),
  };

  // 2. Tägliche Fluktuation (deterministisch aus Seed)
  const daily = getDailyModifier(zone, date);

  // 3. Phänomen-Effekte (dynamisch simuliert)
  const phenomenonMod = getPhenomenonEffects(zone, phenomena);

  // Kombinieren
  return applyModifiers(base, daily, phenomenonMod);
}
```

**Weather Conditions (aus finalem Wetter abgeleitet):**
- cloudCover > 80% + precip > 10mm → "Rain"
- windSpeed > 60km/h + precip > 20mm → "Storm"
- temp < 0°C + precip > 5mm → "Snow"
- humidity > 90% + large temp gradient → "Fog"

---

#### Simulation

**Zwei-Phasen-Simulation (löst Henne-Ei-Problem):**

```
Phase 1: Berechne aktuelles Wetter
         - Basis-Klima + TimeOfDay + Month + Daily
         - + Phänomen-Effekte (inkl. Wind-Modifikation)

Phase 2: Bewege Phänomene
         - Nutze den gerade berechneten Wind
         - Phänomen bewegt sich mit aktuellem Wind der Zone
         - Physikalisch korrekt: Tief erzeugt Wind der es vorantreibt
```

**Simulation pro Tag:**
1. Bestehende Phänomene bewegen (Richtung = Windrichtung der Zone)
2. Intensität reduzieren, Terrain-Effekte anwenden
3. Abgelaufene Phänomene entfernen
4. Leere Zonen auffüllen (Nachbar-Phänomen oder neu spawnen)

---

#### Persistenz

| Ereignis | Aktion |
|----------|--------|
| Zeit vergeht (Almanac) | Simulation vorrechnen → speichern |
| Session beenden | Automatisch mit Map gespeichert |
| Map wechseln | Alte Map speichern |

**Zeitsprung-Handling:**

```typescript
function ensureWeatherUpToDate(map: Map, currentDate: CalendarDate): void {
  const daysDiff = daysBetween(map.weatherState.lastSimulated, currentDate);

  if (daysDiff <= 7) {
    // Normale Simulation: Tag für Tag
    for (let d = 0; d < daysDiff; d++) {
      simulateWeatherDay(map, addDays(lastSim, d + 1));
    }
  } else {
    // Vereinfachte Simulation für große Zeitsprünge:
    // - Alte Phänomene entfernen (wären sowieso abgelaufen)
    // - Neue Phänomene basierend auf Klima-Wahrscheinlichkeiten spawnen
    // - Keine Schritt-für-Schritt Bewegung
    fastForwardWeather(map, daysDiff);
  }

  map.weatherState.lastSimulated = currentDate;
}
```

---

#### Functions

| Funktion | Beschreibung |
|----------|--------------|
| getClimateValue(tile, field, time, month) | Statisches Klima aus Tile |
| getZoneVolatility(zone) | Klima-abhängige Schwankungsbreite |
| getDailyModifier(zone, date) | Tägliche Fluktuation (deterministisch) |
| getCurrentWind(zone, time, date, phenomena) | Aktueller Wind mit Phänomen-Einfluss |
| getWeather(zone, time, date, phenomena) | Komplettes Wetter für Zone |
| generatePhenomenonForZone(zone) | Neues Phänomen spawnen |
| findIncomingPhenomenon(zone, allZones, phenomena) | Prüft ob Nachbar-Phänomen reinzieht |
| simulateWeatherDay(map, date) | Tägliche Simulation |
| ensureWeatherUpToDate(map, currentDate) | Catch-up bei Zeitsprung |
| deriveConditions(weather) | Weather → Conditions |
