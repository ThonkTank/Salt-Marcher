# Weather-System

> **Lies auch:** [Time-System](Time-System.md), [Terrain](../domain/Terrain.md)
> **Wird benoetigt von:** Travel, Audio, Encounter

Detaillierte Spezifikation des Wettersystems.

---

## Parameter

### WeatherState

```typescript
interface WeatherState {
  // Kern-Parameter
  temperature: number;           // Aktuelle Temperatur in °C
  wind: number;                  // Wind in km/h
  windDirection: HexDirection;   // 6 Hex-kompatible Richtungen

  // Niederschlag (getrennte Wahrscheinlichkeit und Intensitaet)
  precipChance: number;          // 0-100: Wahrscheinlichkeit fuer Niederschlag
  precipIntensity: number;       // 0-100: Staerke (drizzle → heavy_rain)
  precipitationType: PrecipitationType; // Abgeleiteter Typ

  // Nebel (separater Layer, kann mit Niederschlag kombiniert werden)
  fogLevel: number;              // 0-1: Nebeldichte (0 = klar, 1 = dichter Nebel)

  // Sichtweite (berechnet aus Niederschlag + Nebel)
  visibilityModifier: number;    // 0.1-1.0 (fuer Encounter-System)

  // Astronomische Faktoren (fuer Nacht-Sichtweite)
  moonPhase: MoonPhase;          // Aus Kalender-System (custom Mondzyklen)
  cloudCover: number;            // 0-1 (0 = klar, 1 = komplett bewoelkt)
}

type HexDirection = 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW';

// MoonPhase wird vom Kalender-System definiert (unterstuetzt custom Mondzyklen)
type MoonPhase = string;  // z.B. 'new' | 'crescent' | 'half' | 'gibbous' | 'full'
```

**Niederschlag:** `precipChance` und `precipIntensity` sind getrennt - hohe Wahrscheinlichkeit bedeutet nicht automatisch starken Regen.

**Nebel:** `fogLevel` ist ein separater Layer. Nebel kann mit Regen/Schnee kombiniert werden ("misty rain", "foggy snow").

**Wind-Richtung:** 6 Richtungen passend zu Hex-Tile-Kanten. Ermoeglicht Terrain-Effekte wie "Berge blockieren Wind aus Richtung X".

**moonPhase und cloudCover** werden fuer den dynamischen Time-Visibility-Modifier verwendet:
- Vollmond bei klarem Himmel: Nacht-Sichtweite ~0.4 (statt 0.1)
- Neumond bei Bewoelkung: Nacht-Sichtweite ~0.1
- Mondphase kommt aus dem Kalender-System (unterstuetzt custom Mondzyklen und Celestial Events)

→ Details: [Encounter-System.md](Encounter-System.md#dynamischer-time-modifier)

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
| `hail` | 200m | Schaden bei Exposition, gefaehrlich im Freien |

**Hinweis:** `fog` ist kein Niederschlagstyp mehr, sondern ein separater Layer (`fogLevel`). Siehe [Nebel](#nebel).

### precipitationType Ableitung

Der Niederschlagstyp wird aus `precipChance`, `precipIntensity` und `temperature` abgeleitet:

```typescript
function derivePrecipitationType(
  precipChance: number,
  precipIntensity: number,
  temperature: number,
  seed: number
): PrecipitationType {
  const roll = seededRandom(seed)() * 100;
  if (roll > precipChance) return 'none';

  const isSnow = temperature < 2;  // °C Grenzwert
  const isHailCondition = temperature >= 15 && precipIntensity > 70;

  // Hagel bei Gewitter-Bedingungen (warm + hohe Intensitaet)
  if (isHailCondition && seededRandom(seed + 1)() < 0.2) {
    return 'hail';
  }

  // Niederschlagstyp nach Intensitaet
  if (precipIntensity < 20) {
    return isSnow ? 'snow' : 'drizzle';
  } else if (precipIntensity < 60) {
    return isSnow ? 'snow' : 'rain';
  } else {
    return isSnow ? 'blizzard' : 'heavy_rain';
  }
}
```

**Hagel-Bedingungen:**
- Temperatur >= 15°C (warm/mild)
- Intensitaet > 70% (schwerer Niederschlag)
- 20% Chance dass es hagelt statt starker Regen

### Nebel

Nebel ist ein separater Layer und kann mit Niederschlag kombiniert werden.

| fogLevel | Bezeichnung | Sichtweite | Effekte |
|----------|-------------|------------|---------|
| 0.0-0.2 | Klar | Normal | Keine |
| 0.2-0.5 | Dunstig | 500m | Perception -1 |
| 0.5-0.7 | Neblig | 100m | Perception -3 |
| 0.7-0.9 | Dichter Nebel | 50m | Perception -5, leicht zu verlaufen |
| 0.9-1.0 | Undurchdringlich | 10m | Fast blind, hohes Verirrungsrisiko |

**Kombinationen:**
- Nebel + Regen = "Misty Rain" (beide Sichtweiten-Modifier stapeln)
- Nebel + Schnee = "Foggy Snow" (besonders gefaehrlich)

### fogChance → fogLevel Transformation

Die Terrain-Definition hat `fogChance` (0-100 Wahrscheinlichkeit), WeatherState hat `fogLevel` (0-1 Intensitaet).

```typescript
function generateFog(fogChance: number, seed: number): number {
  const roll = seededRandom(seed)() * 100;  // 0-100

  if (roll > fogChance) {
    return 0;  // Kein Nebel
  }

  // Nebel vorhanden - Intensitaet basierend auf "wie weit unter der Chance"
  const intensity = (fogChance - roll) / fogChance;
  return intensity;  // 0-1
}
```

**Beispiele:**
| fogChance | Roll | Ergebnis |
|-----------|------|----------|
| 60 | 80 | 0 (kein Nebel - Roll > Chance) |
| 60 | 30 | 0.5 (Nebel mit 50% Intensitaet) |
| 60 | 10 | 0.83 (Nebel mit 83% Intensitaet) |

**Interpretation:** Je "gluecklicher" der Wurf (weit unter fogChance), desto dichter der Nebel.

---

## Tile-basierte Wetter-Ranges

Jedes Terrain definiert charakteristische Wetter-Ranges als Kurve pro Parameter:

### Range-Schema

```typescript
interface TerrainWeatherRanges {
  temperature: WeatherRange;   // in °C
  wind: WeatherRange;          // in km/h
  precipChance: WeatherRange;  // 0-100 (Wahrscheinlichkeit fuer Niederschlag)
  precipIntensity: WeatherRange; // 0-100 (Staerke des Niederschlags)
  fogChance: WeatherRange;     // 0-100 (Wahrscheinlichkeit fuer Nebel)
}

interface WeatherRange {
  min: number;     // Minimum (z.B. extreme Kaelte)
  average: number; // Durchschnitt
  max: number;     // Maximum (z.B. Hitzewelle)
}
```

**Breaking Change:** `precipitation` wurde in `precipChance` und `precipIntensity` aufgeteilt. Bestehende Terrain-Definitionen muessen migriert werden.

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

**Interpretation:**
- **Precip-Chance:** Wie oft es regnet/schneit (Suempfe: oft, Wuesten: selten)
- **Precip-Intensitaet:** Wie stark es regnet wenn es regnet (unabhaengig von Chance)
- **Fog-Chance:** Wahrscheinlichkeit fuer Nebel (Suempfe und Waelder: haeufig)

### Generierungs-Mechanik

Bei der Wetter-Generierung wird auf der Kurve "gewürfelt":

```typescript
function generateWeatherFromRanges(ranges: WeatherRange, seed?: number): number {
  // Gaussian-ähnliche Verteilung: Average ist wahrscheinlicher
  const random = seededRandom(seed);
  const deviation = (random() - 0.5) * 2; // -1 bis +1

  if (deviation >= 0) {
    return lerp(ranges.average, ranges.max, deviation);
  } else {
    return lerp(ranges.average, ranges.min, -deviation);
  }
}
```

**Ergebnis:** Tiles haben charakteristisches Wetter - Berge sind kälter, Wüsten heißer, Sümpfe feuchter.

---

## Weather-Events

Bestimmte Kombinationen triggern spezielle Events:

| Event | Bedingungen | Effekte |
|-------|-------------|---------|
| `blizzard` | freezing + gale + snow | Reisen fast unmoeglich, Shelter noetig |
| `thunderstorm` | warm + strong + heavy_rain | Blitzschlag-Gefahr, Metall-Ausruestung riskant |
| `heatwave` | hot + calm + none | Doppelte Erschoepfungs-Checks |
| `dense_fog` | cool + calm + fog | Sichtweite 10m, leicht zu verlaufen |
| `dust_storm` | hot + gale + none | Sichtweite 20m, Schaden bei Exposition |

---

## Area-Averaging

Wetter wird nicht pro Tile berechnet (zu granular), sondern als Durchschnitt:

### Berechnungs-Reihenfolge

**Wichtig:** Tile-Modifiers werden **VOR** dem Area-Averaging angewendet. Das bedeutet:
- Ein kalter Sumpf beeinflusst auch die Nachbar-Tiles
- Terrain-Einflüsse propagieren in die Umgebung
- Realistisches Wetter-Verhalten

```
Terrain-Basis → + Tile-Modifiers → Area-Averaging → + Time-Segment → Finales Wetter
```

### Algorithmus

```typescript
function calculateWeather(centerTile: HexCoordinate, map: MapData): WeatherParams {
  const RADIUS = 5;
  const tiles = getTilesInRadius(centerTile, RADIUS);

  let weightedParams = { temp: 0, wind: 0, precip: 0, fog: 0 };
  let totalWeight = 0;

  for (const tile of tiles) {
    const distance = hexDistance(centerTile, tile);
    const weight = 1 / (distance + 1);  // Distanz-Gewichtung

    // 1. Basis aus Terrain-Template
    const baseParams = generateFromTerrainRanges(tile.terrain);

    // 2. Tile-Modifiers anwenden (VOR Averaging!)
    const tileParams = applyTileModifiers(baseParams, tile.climateModifiers);

    weightedParams.temp += tileParams.temp * weight;
    weightedParams.wind += tileParams.wind * weight;
    weightedParams.precip += tileParams.precip * weight;
    weightedParams.fog += tileParams.fog * weight;

    totalWeight += weight;
  }

  return {
    temp: weightedParams.temp / totalWeight,
    wind: weightedParams.wind / totalWeight,
    precip: weightedParams.precip / totalWeight,
    fog: weightedParams.fog / totalWeight
  };
}

function applyTileModifiers(
  base: WeatherParams,
  modifiers?: TileClimateModifiers
): WeatherParams {
  if (!modifiers) return base;

  return {
    temp: base.temp + (modifiers.temperatureModifier ?? 0),
    wind: applyWindExposure(base.wind, modifiers.windExposure),
    precip: base.precip + (modifiers.humidityModifier ?? 0),
    fog: base.fog + (modifiers.humidityModifier ?? 0) * 0.5  // Humidity beeinflusst Fog
  };
}
```

### Terrain-Einfluss (Nice-to-Have)

Terrains beeinflussen das Wetter benachbarter Tiles. Diese Werte werden bei "Calculate Derived" im Cartographer angewendet.

#### Quantitative Werte

```typescript
const TERRAIN_INFLUENCE = {
  water: {
    radius: 2,           // Tiles Reichweite
    tempModifier: -3,    // °C - mildert Extreme
    precipModifier: +10, // % erhoehte Niederschlags-Chance
  },
  mountains: {
    windShadowRadius: 3, // Tiles in Windrichtung
    windReduction: 0.5,  // 50% weniger Wind im Windschatten
    tempModifier: -2,    // °C pro Tile Naehe
  },
  forest: {
    radius: 1,           // Tiles
    windReduction: 0.7,  // 30% weniger Wind
    humidityModifier: +15, // % mehr Feuchtigkeit (fog + precip)
  },
  desert: {
    radius: 2,           // Tiles
    tempModifier: +5,    // °C waermer
    precipModifier: -20, // % weniger Niederschlag
  },
};
```

#### Effekt-Tabelle

| Terrain | Radius | Temp | Wind | Precip/Fog |
|---------|--------|------|------|------------|
| `water` | 2 | -3°C | - | +10% |
| `mountains` | 3 (Windschatten) | -2°C/Tile | ×0.5 | - |
| `forest` | 1 | - | ×0.7 | +15% |
| `desert` | 2 | +5°C | - | -20% |

#### Stapelung

Bei mehreren Terrain-Einfluessen: **Additiv mit Daempfung**

```typescript
function stackEffects(effects: number[]): number {
  if (effects.length === 0) return 0;
  if (effects.length === 1) return effects[0];

  // Sortiere nach Staerke (staerkster zuerst)
  const sorted = effects.sort((a, b) => Math.abs(b) - Math.abs(a));

  let total = sorted[0];  // Staerkster Effekt 100%
  for (let i = 1; i < sorted.length; i++) {
    total += sorted[i] * 0.7;  // Weitere Effekte 70%
  }
  return total;
}
```

**Beispiel:** Tile neben Wasser (-3°C) UND Wald (+0°C, aber +15% Humidity):
- Temperatur: -3°C (nur Wasser-Effekt)
- Humidity: +15% (nur Wald-Effekt)
- Keine Stapelung noetig da unterschiedliche Parameter

---

## Time-Segment-Berechnung

Wetter wird pro Time-Segment neu berechnet:

### Segments

| Segment | Stunden | Temperatur-Modifikator |
|---------|---------|------------------------|
| `dawn` | 5-8 | Kuehler (-5°C von Basis) |
| `morning` | 8-12 | Ansteigend |
| `midday` | 12-15 | Maximum (+5°C) |
| `afternoon` | 15-18 | Sinkend |
| `dusk` | 18-21 | Kuehler |
| `night` | 21-5 | Minimum (-10°C) |

### Uebergangs-Logik

Wetter aendert sich nicht abrupt zwischen Segments:

```typescript
function transitionWeather(current: WeatherState, target: WeatherParams): WeatherState {
  const TRANSITION_SPEED = 0.3;  // 30% pro Segment

  return {
    temperature: lerp(current.temperature, target.temperature, TRANSITION_SPEED),
    wind: lerp(current.wind, target.wind, TRANSITION_SPEED),
    precipitation: Math.random() < 0.3 ? target.precipitation : current.precipitation
  };
}
```

Niederschlag kann abrupt beginnen/enden (30% Chance pro Segment), aber Temperatur und Wind aendern sich graduell.

---

## Temperatur-Modifier

Die finale Temperatur wird durch mehrere Modifier beeinflusst:

```
Finale Temperatur = Terrain-Basis + Time-Segment + Saison-Modifier + Elevation-Modifier
```

### Saison-Modifier

Das Kalender-System liefert die aktuelle Saison. Weather wendet einen Temperatur-Offset an:

| Saison | Temperatur-Offset | Beispiel (Plains avg 15°C) |
|--------|-------------------|----------------------------|
| Fruehling | 0°C | 15°C |
| Sommer | +10°C | 25°C |
| Herbst | -5°C | 10°C |
| Winter | -15°C | 0°C |

**Hinweis:** Der Offset wird auf alle drei Range-Werte (min/avg/max) angewendet:
```
Winter-Plains: min=-20, avg=0, max=20 (statt -5/15/35)
```

**Kalender-Abhaengigkeit:** Kalender-System muss Saison-Information bereitstellen. Bei custom Kalendern sind auch andere Saison-Definitionen moeglich.

### Elevation-Modifier

Hoehe beeinflusst die Temperatur nach dem atmosphaerischen Gradienten:

```
Temperatur-Offset = -6.5°C × (Elevation / 1000m)
```

| Elevation | Temperatur-Offset | Beispiel (Plains 15°C auf Meereshoehe) |
|-----------|-------------------|----------------------------------------|
| 0m (Meereshoehe) | 0°C | 15°C |
| 500m | -3.25°C | 11.75°C |
| 1000m | -6.5°C | 8.5°C |
| 2000m | -13°C | 2°C |
| 3000m | -19.5°C | -4.5°C |

**Hinweis:** Elevation kommt aus den Tile-Daten. Der Modifier wird nach Terrain-Basis + Saison angewendet.

### Berechnungs-Reihenfolge

```typescript
function calculateTemperature(
  terrainRange: WeatherRange,
  timeSegment: TimeSegment,
  season: Season,
  elevation: number
): number {
  // 1. Basis aus Terrain-Range generieren
  const baseTemp = generateFromRange(terrainRange);

  // 2. Time-Segment-Modifier
  const timeModifier = SEGMENT_TEMPERATURE_MODIFIERS[timeSegment];

  // 3. Saison-Modifier
  const seasonModifier = SEASON_TEMPERATURE_MODIFIERS[season];

  // 4. Elevation-Modifier
  const elevationModifier = -6.5 * (elevation / 1000);

  return baseTemp + timeModifier + seasonModifier + elevationModifier;
}
```

---

## Event-Flow

```
time:segment-changed
    │
    ▼
Environment Feature
    │
    ├── calculateWeather(partyPosition, currentMap)
    │
    ├── transitionWeather(currentWeather, newParams)
    │
    ├── checkWeatherEvents(newWeather)
    │
    └── Publish Events:
        ├── environment:weather-changed
        └── environment:weather-event-triggered (falls Event)
```

---

## Consumer-Features

| Feature | Subscription | Reaktion |
|---------|--------------|----------|
| **Audio** | `environment:weather-changed` | Ambiance-Sounds anpassen (Regen, Wind) |
| **Travel** | `environment:weather-changed` | Speed-Faktor neu berechnen |
| **Encounter** | `environment:weather-changed` | Kreatur-Praeferenzen beruecksichtigen |
| **UI** | `environment:state-changed` | Weather-Widget aktualisieren |
| **Visibility** | `environment:weather-changed` | Sichtweiten-Overlay aktualisieren |

---

## Sichtweiten-Einfluss (Post-MVP)

Wetter beeinflusst die Overland-Sichtweite im Visibility-System.

### Visibility-Modifier

| Niederschlag | Modifier | Notiz |
|--------------|----------|-------|
| `none`, `drizzle` | 100% | Volle Sicht |
| `rain`, `snow` | 75% | Leicht eingeschraenkt |
| `heavy_rain` | 50% | Deutlich eingeschraenkt |
| `blizzard` | 25% | Stark eingeschraenkt |
| `fog` | 25% | Stark eingeschraenkt |
| `dense_fog` | 10% | Fast blind |

### Berechnung

Der Visibility-Modifier wird **multiplikativ** mit dem Tageszeit-Modifier kombiniert:

```
Effektive Sichtweite = Basis × Hoehen-Bonus × Weather-Modifier × Time-Modifier
```

**Beispiel:** Basis 2 Hex, leichter Regen (75%), Nacht (10%) → 0.15 Hex (nur aktuelles Tile)

### Weather-Event-Sichtweite

Weather-Events haben starken Einfluss auf Sichtweite:

| Event | Visibility-Modifier |
|-------|---------------------|
| `blizzard` | 10% |
| `thunderstorm` | 50% |
| `dense_fog` | 10% |
| `dust_storm` | 10% |

→ Visibility-System: [Map-Feature.md](Map-Feature.md#visibility-system)

---

## Weather-Persistierung

Generiertes Wetter wird an verschiedenen Orten persistiert, je nach Zweck.

### Ownership-Tabelle

| Aspekt | Owner | Persistierung |
|--------|-------|---------------|
| **Aktuelles Wetter** | Map (als Property) | map.json |
| **Wetter-Generierung** | Weather Feature | - (nur Logic) |
| **Wetter-Historie** | Almanac (EventJournal) | almanac.json |
| **Forecast** | Weather Feature (computed) | Nicht persistiert |

### Current Weather als Map Property

```typescript
// In MapState
interface MapState {
  id: EntityId<'map'>;
  // ... andere Felder
  currentWeather?: WeatherParams;    // Aktuelles Wetter dieser Map
  weatherUpdatedAt?: GameDateTime;
}
```

**Begruendung:** Wetter ist location-spezifisch. Jede Map hat ihr eigenes Wetter.

**Wichtig:** `currentWeather` ist **persistierter State**, kein Cache:
- Bei Session-Reload: Weather wird aus `map.json` wiederhergestellt (nicht neu berechnet)
- Neu-Berechnung erfolgt NUR bei `time:state-changed` Event
- Dies garantiert Session-Kontinuitaet: Wenn es beim Schliessen regnet, regnet es beim Oeffnen weiter

### GM Weather Override (Session-Overrides)

Der GM kann das generierte Wetter jederzeit manuell überschreiben.

**Wichtig:** Dies ist fuer **temporaere Session-Overrides** gedacht (z.B. "Dramatischer Sturm fuer diesen Encounter"), NICHT fuer permanente Klima-Anpassungen bei der Karten-Erstellung.

Fuer permanente Tile-spezifische Klima-Anpassungen → siehe [TileClimateModifiers](../domain/Terrain.md#tileclimatemodifiers) und Cartographer Climate-Brush.

**Override-Schema:**

```typescript
interface WeatherOverride {
  enabled: boolean;
  overriddenParams: Partial<WeatherParams>;  // Nur überschriebene Parameter
  appliedAt: GameDateTime;
  reason?: string;  // z.B. "Dramatischer Sturm für Encounter"
}

// In MapState erweitert:
interface MapState {
  id: EntityId<'map'>;
  currentWeather?: WeatherParams;
  weatherUpdatedAt?: GameDateTime;
  weatherOverride?: WeatherOverride;  // NEU
}
```

**Override-Verhalten:**

| Aktion | Verhalten |
|--------|-----------|
| GM setzt Override | `currentWeather` sofort aktualisiert, Override gespeichert |
| `time:segment-changed` | Neue Basis berechnet, Override erneut angewendet |
| GM cleared Override | Zurück zu generiertem Wetter |
| Map-Wechsel | Override bleibt auf Map gespeichert |

**Wichtig:** Override ist **partial** - GM kann z.B. nur Niederschlag überschreiben, Temperatur bleibt generiert.

**Persistierung:** Overrides werden in `map.json` als Teil von `MapState` gespeichert.

### Weather-Historie in Almanac

Signifikante Wetter-Aenderungen werden als EventJournal-Eintraege gespeichert:

```typescript
// EventJournal-Eintrag (Almanac)
interface WeatherJournalEntry {
  type: 'weather';
  timestamp: GameDateTime;
  mapId: EntityId<'map'>;
  event: 'storm-started' | 'storm-ended' | 'blizzard' | 'heatwave' | ...;
  description: string;  // "Sturm begann bei Phandalin"
}
```

**Zweck:** Recall bei Zeit-Ruecksprung (GM spielt vergangene Session nach).

### Persistierungs-Flow

```
time:state-changed
    │
    ├── Weather Feature:
    │   - Berechnet neues Wetter fuer aktive Map
    │   - Published: weather:changed { mapId, weather }
    │
    ├── Map Feature:
    │   - Speichert currentWeather in Map-State
    │
    └── Almanac Feature (optional):
        - Erstellt EventJournal-Eintrag fuer signifikante Wetter-Aenderungen
        - z.B. "Sturm begann", "Schneesturm endete"
```

### Zeit-Ruecksprung (Recall)

Wenn GM Zeit zurueckdreht fuer eine vergangene Session:

1. Almanac zeigt historisches Wetter aus EventJournal
2. Weather Feature kann vergangenes Wetter "recallen"
3. Map-Weather wird auf historischen Stand gesetzt

### Vorteile

- **Current Weather als Map Property:** Wetter ist location-spezifisch
- **Dediziertes Weather Feature:** Generation-Logic bleibt fokussiert
- **Historie in Almanac:** Passt zum "Journal"-Konzept
- **Kein eigener StoragePort:** Weather nutzt Map-Storage + Almanac-Storage

---

## Multi-Map Weather

Unterschiedliche Map-Typen haben unterschiedliches Wetter-Verhalten:

### Map-Typ-Regeln

| Map-Typ | Weather? | Quelle |
|---------|----------|--------|
| **Overworld** | Ja | Eigene Generierung |
| **Indoor** (Dungeon, Gebäude) | Nein | Kein Weather-System aktiv |
| **Stadt** | Ja | **Erbt vom Parent-Tile** (ueber MapLink) |
| **Andere World-Maps** | Ja | Eigene Generierung |

### Position ueber MapLink

Die Overworld-Position einer Sub-Map (Stadt, Dungeon) wird ueber den **MapLink** ermittelt:

```typescript
// MapLink verbindet Sub-Map-Ausgang mit Parent-Map-Tile
interface MapLink {
  sourceMapId: EntityId<'map'>;
  sourcePosition: HexCoordinate;  // Position des Ausgangs auf der Sub-Map
  targetMapId: EntityId<'map'>;   // Parent-Map
  targetPosition: HexCoordinate;  // Position auf der Parent-Map
}
```

**Vorteile:**
- Kein separates `parentMapId` in MapState noetig
- MapLink ist die einzige Quelle der Wahrheit fuer Map-Verbindungen
- GM kann ueberschreiben (Teleporter, langer Tunnel zu anderem Hex)

### Implementierung

```typescript
function getWeatherForMap(
  map: MapData,
  mapLinkRegistry: MapLinkRegistry
): WeatherState | null {
  switch (map.type) {
    case 'indoor':
      return null;  // Kein Wetter

    case 'town':
      // Finde Parent-Tile ueber MapLink
      const parentLink = mapLinkRegistry.findParentLink(map.id);
      if (!parentLink) return null;
      return getOverworldWeather(parentLink.targetMapId, parentLink.targetPosition);

    case 'overworld':
    default:
      return generateOrLoadWeather(map);
  }
}
```

### Background Weather Tick

**Wichtig:** Das Parent-Tile der aktuellen Sub-Map tickt **im Hintergrund weiter**.

```
Party betritt Stadt um 10:00 bei Regen
    │
    ├── Stadt-Map zeigt Wetter vom Parent-Tile (Regen)
    │
    ├── Im Hintergrund: Parent-Tile Weather tickt weiter
    │   ├── time:segment-changed → neues Wetter berechnen
    │   └── Parent-Tile Weather wird aktualisiert
    │
    ├── Stadt-Map zeigt immer aktuelles Parent-Wetter
    │
    └── Party verlaesst Stadt um 14:00
        └── Aktuelles Overworld-Weather ist bereits berechnet (evtl. Sonne)
```

**Dungeon-Sonderfall:**
```
Party betritt Dungeon um 10:00 bei Regen
    │
    ├── Dungeon hat KEIN Wetter (Indoor)
    │
    ├── Im Hintergrund: Parent-Tile Weather tickt weiter
    │   └── Wetter wird fuer Rueckkehr vorbereitet
    │
    └── Party verlaesst Dungeon um 14:00
        └── Aktuelles Overworld-Weather wird angezeigt
```

**Begründung:** Die Sub-Map bezieht sich auf das Parent-Tile - das Wetter muss dort aktuell sein.

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Basis-Parameter (Temp, Wind, Precipitation) | ✓ | | Core Weather |
| 6 Tages-Segmente | ✓ | | Zeit-Integration |
| Terrain-basierte Modifikatoren | ✓ | | Climate Zones |
| Weather-Events (Blizzard, Storm) | | mittel | Spezielle Ereignisse |
| Travel-Modifikatoren | ✓ | | Speed-Penalties |
| Audio-Integration | | mittel | Mood-Matching |
| Sub-Map Weather | ✓ | | Kein Weather in Dungeons |
| Background Weather Tick | ✓ | | Overworld laeuft weiter |
| **Visibility-Modifier** | | mittel | Sichtweiten-Reduktion |

---

*Siehe auch: [Time-System.md](Time-System.md) | [Travel-System.md](Travel-System.md) | [Audio-System.md](Audio-System.md)*

## Tasks

| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 101 | 🔶 | Weather | WeatherParams: Basis-Parameter-Interface (Temperatur, Wind, Niederschlag) | hoch | Ja | - | Weather-System.md#parameter | src/core/schemas/weather.ts:weatherParamsSchema, src/features/weather/types.ts:WeatherFeaturePort |
| 102 | ✅ | Weather | Temperatur-Kategorisierung (freezing, cold, cool, mild, warm, hot) mit mechanischen Effekten | hoch | Ja | #101 | Weather-System.md#temperatur | src/core/schemas/weather.ts:temperatureCategorySchema+TEMPERATURE_THRESHOLDS, src/features/weather/weather-utils.ts:classifyTemperature() |
| 103 | ✅ | Weather | Wind-Kategorisierung (calm, light, moderate, strong, gale) mit Effekten | hoch | Ja | #101 | Weather-System.md#wind | src/core/schemas/weather.ts:windCategorySchema+WIND_THRESHOLDS, src/features/weather/weather-utils.ts:classifyWind() |
| 104 | ⛔ | Weather | Niederschlag-Kategorisierung (none, drizzle, rain, heavy_rain, snow, blizzard, fog) | hoch | Ja | #101 | Weather-System.md#niederschlag | src/core/schemas/weather.ts:precipitationTypeSchema+PRECIPITATION_THRESHOLDS, src/features/weather/weather-utils.ts:classifyPrecipitation() |
| 105 | ⛔ | Weather | TerrainWeatherRanges: Terrain-basierte Wetter-Kurven (min/average/max) | hoch | Ja | #101, #1702 | Weather-System.md#range-schema, Terrain.md#schema | src/core/schemas/weather.ts:terrainWeatherRangesSchema+DEFAULT_WEATHER_RANGES, src/core/schemas/terrain.ts:TerrainDefinition.weatherRanges, presets/terrains/base-terrains.json |
| 106 | ⛔ | Weather | Weather-Generierung aus Ranges (Gaussian-ähnliche Verteilung) | hoch | Ja | #105 | Weather-System.md#generierungs-mechanik | src/features/weather/weather-utils.ts:generateWeatherFromRanges()+generateFromRange() |
| 107 | ✅ | Weather | Area-Averaging: Gewichteter Wetter-Durchschnitt über Hex-Nachbarn | hoch | Ja | #106, #802 | Weather-System.md#area-averaging | src/features/weather/weather-utils.ts:calculateAreaWeather(), src/features/weather/weather-service.ts:getTileWeatherRanges() |
| 108 | ✅ | Weather | Time-Segment-Modifikatoren (6 Segmente mit Temperatur-Offset) | hoch | Ja | #101, #906, #912 | Weather-System.md#time-segment-berechnung, Time-System.md#time-segment-berechnung | src/core/schemas/weather.ts:SEGMENT_TEMPERATURE_MODIFIERS, src/features/weather/weather-utils.ts:generateWeatherFromRanges() |
| 109 | ✅ | Weather | Übergangs-Logik: Gradueller Wetter-Wechsel (TRANSITION_SPEED=0.3) | hoch | Ja | #101, #108 | Weather-System.md#uebergangs-logik | src/features/weather/weather-utils.ts:transitionWeather(), src/features/weather/weather-service.ts:calculateNewWeather() |
| 110 | ✅ | Weather | Event-Flow: time:segment-changed → environment:weather-changed | hoch | Ja | #109, #910 | Weather-System.md#event-flow, Events-Catalog.md#environment | src/features/weather/weather-service.ts:setupEventHandlers()+publishWeatherChanged() |
| 111 | ✅ | Weather | Weather-Persistierung: currentWeather als Map Property | hoch | Ja | #101, #110, #800, #801 | Weather-System.md#current-weather-als-map-property, Map-Feature.md#overworldmap | src/core/schemas/map.ts:MapState.currentWeather, src/features/weather/weather-service.ts:initializeWeather() |
| 112 | ✅ | Weather | Multi-Map Weather: Indoor-Maps haben kein Wetter | hoch | Ja | #111, #806 | Weather-System.md#map-typ-regeln, Map-Feature.md#wetter-auf-sub-maps | src/features/weather/weather-service.ts:initializeWeather() (map.type check) |
| 113 | ⛔ | Weather | Multi-Map Weather: Stadt-Maps erben Wetter vom Overworld-Tile | hoch | Ja | #111, #112, #827 | Weather-System.md#map-typ-regeln, Map-Feature.md#wetter-auf-sub-maps | src/features/weather/weather-service.ts:getWeatherForMap() [neu] |
| 114 | ⬜ | Weather | Background Weather Tick: Overworld-Weather läuft im Hintergrund | hoch | Ja | #111, #910 | Weather-System.md#background-weather | src/features/weather/weather-service.ts:setupEventHandlers() [ändern] |
| 115 | ⛔ | Weather | Weather-Events: Blizzard, Thunderstorm, Heatwave, Dense Fog, Dust Storm | mittel | Nein | #102, #103, #104, #110 | Weather-System.md#weather-events | src/features/weather/weather-utils.ts:checkWeatherEvents() [neu], src/core/events/types.ts [ändern] |
| 116 | ⛔ | Weather | Audio-Integration: Ambiance-Sounds bei weather-changed anpassen | mittel | Nein | #110, #1107, #1115 | Weather-System.md#consumer-features, Audio-System.md#context-updates | src/features/audio/orchestrator.ts [neu] |
| 117a | ✅ | Weather | Travel-Integration: Speed-Faktor bei weather-changed neu berechnen | mittel | Nein | #3, #104, #110 | Weather-System.md#consumer-features, Travel-System.md#weather-faktoren | src/features/map/visibility.ts:getVisibilityModifier() [neu] |
| 117b | ⬜ | Weather | Visibility-Integration: Sichtweiten-Modifier aus Niederschlag + fogLevel | mittel | Nein | #117a | Weather-System.md#consumer-features, Travel-System.md#weather-faktoren | src/features/map/visibility.ts:getVisibilityModifier() [neu] |
| 118 | ⛔ | Weather | Terrain-Einfluss auf Nachbar-Tiles (mountains blockiert Wind, etc.) | niedrig | Nein | #107, #1700, #2953 | Weather-System.md#terrain-einfluss-nice-to-have, Terrain.md | src/features/weather/weather-utils.ts:calculateAreaWeather() [ändern] |
| 119 | ⬜ | Weather | GM Weather Override: Manuelles Überschreiben des generierten Wetters | mittel | Nein | #111 | Weather-System.md#gm-weather-override | src/core/schemas/map.ts:MapState.weatherOverride [neu], src/features/weather/weather-service.ts:setWeatherOverride() [neu] |
| 120 | ⛔ | Weather | Weather-Historie: Signifikante Änderungen in Almanac EventJournal speichern | niedrig | Nein | #111, #2208 | Weather-System.md#weather-historie-in-almanac | src/features/almanac/event-journal.ts [neu] |
| 121 | ⛔ | Weather | Zeit-Rücksprung (Recall): Historisches Wetter wiederherstellen | niedrig | Nein | #104, #120, #843, #847, #2208 | Weather-System.md#sichtweiten-einfluss-post-mvp, Map-Feature.md#umwelt-modifier | src/features/weather/weather-service.ts:recallWeather() [neu] |
| 1115 | ⛔ | Audio | audio:context-changed Event Handler | mittel | Nein | #110, #1102, #1108, #1113 | Weather-System.md, Events-Catalog.md#environment | [neu] src/features/audio/orchestrator.ts:handleAudioContextChanged(), [ändern] src/features/audio/orchestrator.ts:setupEventHandlers() |
| 2953 | ⛔ | Weather | windDirection: 6 Hex-kompatible Richtungen (N, NE, SE, S, SW, NW) für Wind | hoch | Ja | #101 | Weather-System.md#weatherstate | - |
| 2954 | ⛔ | Weather | Saison-Modifier: Temperatur-Offset basierend auf Kalender-Saison (Winter -15°C, Sommer +10°C) | hoch | Ja | #101, #905, #2964 | Weather-System.md#saison-modifier | - |
| 2955 | ⛔ | Weather | Elevation-Modifier: Temperatur sinkt ~6.5°C pro 1000m Höhe (atmosphärischer Gradient) | hoch | Ja | #101, #802 | Weather-System.md#elevation-modifier | - |
| 2956 | ⛔ | Weather | moonPhase: Mondphase aus Kalender-System ableiten (custom Mondzyklen unterstützen) | hoch | Ja | #2965 | Weather-System.md#weatherstate | - |
| 2957 | ⛔ | Weather | cloudCover: Wolkenbedeckung aus precipChance ableiten (0-1) | hoch | Ja | #104 | Weather-System.md#weatherstate | - |
| 2958 | ⛔ | Weather | fogLevel: Nebel als separater Layer (0-1), kombinierbar mit Niederschlag | hoch | Ja | #105 | Weather-System.md#nebel | - |
| 2959 | ⛔ | Weather | visibilityModifier: Sichtweiten-Faktor (0.1-1.0) aus precipIntensity + fogLevel berechnen | hoch | Ja | #104, #2958 | Weather-System.md#weatherstate | - |
| 2979 | ⛔ | Weather | WeatherParams: precipChance + precipIntensity statt einzelnem precipitation Parameter | hoch | Ja | #101 | Weather-System.md#precipitationtype-ableitung | - |
| 2980 | ⛔ | Weather | WeatherState: fogLevel als separater Parameter (0-1) hinzufügen | hoch | Ja | #101 | Weather-System.md#fogchance--foglevel-transformation | - |
| 2981 | ⛔ | Weather | PrecipitationType: fog entfernen, hail hinzufügen, Formel anpassen | hoch | Ja | #104 | Weather-System.md#niederschlag | - |
| 2984 | ⛔ | Weather | generateFog(): fogChance → fogLevel Transformation implementieren | hoch | Ja | #2980 | Weather-System.md#fogchance--foglevel-transformation | - |
| 2985 | ⛔ | Weather | derivePrecipitationType(): precipChance + precipIntensity + temp → Typ | hoch | Ja | #2979, #2981 | Weather-System.md#precipitationtype-ableitung | - |
| 2986 | ⛔ | Weather | Area-Averaging: Tile-Modifiers VOR Averaging anwenden | hoch | Ja | #2983, #107 | Weather-System.md#berechnungs-reihenfolge | - |
| 2987 | ⛔ | Weather | TERRAIN_INFLUENCE Konstanten (water, mountains, forest, desert) | mittel | Nein | #2986 | Weather-System.md#terrain-einfluss-nice-to-have | - |
| 2988 | ⛔ | Weather | Terrain-Einfluss-Berechnung mit Stapelung (70% Dämpfung) | mittel | Nein | #2987 | Weather-System.md#stapelung | - |
