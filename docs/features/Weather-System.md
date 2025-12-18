# Weather-System

> **Lies auch:** [Time-System](Time-System.md), [Terrain](../domain/Terrain.md)
> **Wird benoetigt von:** Travel, Audio, Encounter

Detaillierte Spezifikation des Wettersystems.

---

## Parameter

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
| `fog` | 50m | Nur Sichtweite |

---

## Tile-basierte Wetter-Ranges

Jedes Terrain definiert charakteristische Wetter-Ranges als Kurve pro Parameter:

### Range-Schema

```typescript
interface TerrainWeatherRanges {
  temperature: WeatherRange;  // in °C
  wind: WeatherRange;         // in km/h
  precipitation: WeatherRange; // 0-100 (Wahrscheinlichkeit)
}

interface WeatherRange {
  min: number;     // Minimum (z.B. extreme Kaelte)
  average: number; // Durchschnitt
  max: number;     // Maximum (z.B. Hitzewelle)
}
```

### Terrain-Beispiele

| Terrain | Temperatur (°C) | Wind (km/h) | Niederschlag (%) |
|---------|-----------------|-------------|------------------|
| `plains` | -5 / 15 / 35 | 5 / 20 / 60 | 10 / 30 / 70 |
| `mountains` | -20 / 0 / 20 | 20 / 50 / 100 | 20 / 50 / 80 |
| `desert` | 0 / 35 / 50 | 5 / 15 / 80 | 0 / 5 / 20 |
| `swamp` | 5 / 20 / 35 | 0 / 10 / 30 | 40 / 60 / 90 |
| `forest` | 0 / 15 / 30 | 0 / 10 / 30 | 20 / 40 / 70 |
| `water` | 5 / 18 / 30 | 10 / 30 / 80 | 20 / 40 / 70 |

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

### Algorithmus

```typescript
function calculateWeather(centerTile: HexCoordinate, map: MapData): WeatherParams {
  const RADIUS = 5;
  const tiles = getTilesInRadius(centerTile, RADIUS);

  let weightedParams = { temp: 0, wind: 0, precip: 0 };
  let totalWeight = 0;

  for (const tile of tiles) {
    const distance = hexDistance(centerTile, tile);
    const weight = 1 / (distance + 1);  // Distanz-Gewichtung

    const tileParams = getBaseTileWeather(tile, map);
    weightedParams.temp += tileParams.temp * weight;
    weightedParams.wind += tileParams.wind * weight;
    weightedParams.precip += tileParams.precip * weight;

    totalWeight += weight;
  }

  return {
    temp: weightedParams.temp / totalWeight,
    wind: weightedParams.wind / totalWeight,
    precip: weightedParams.precip / totalWeight
  };
}
```

### Terrain-Einfluss (Nice-to-Have)

| Terrain | Effekt |
|---------|--------|
| `mountains` | Blockiert Wind aus dieser Richtung, kaeltere Basis-Temperatur |
| `water` | Mildert Temperatur-Extreme, erhoeht Niederschlags-Chance |
| `desert` | Erhoeht Temperatur, reduziert Niederschlag |
| `forest` | Reduziert Wind, erhoeht Feuchtigkeit |

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

### GM Weather Override

Der GM kann das generierte Wetter jederzeit manuell überschreiben.

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
| **Stadt** | Ja | **Erbt vom Overworld-Tile** auf dem sie liegt |
| **Andere World-Maps** | Ja | Eigene Generierung |

### Implementierung

```typescript
function getWeatherForMap(map: MapData, overworldPosition: HexCoordinate | null): WeatherState | null {
  switch (map.type) {
    case 'indoor':
      return null;  // Kein Wetter

    case 'town':
      // Erbt von Overworld-Tile
      if (!overworldPosition) return null;
      return getOverworldWeather(overworldPosition);

    case 'overworld':
    default:
      return generateOrLoadWeather(map);
  }
}
```

### Background Weather

**Wichtig:** Overworld-Weather läuft **im Hintergrund weiter**, auch wenn eine Sub-Map aktiv ist.

```
Party betritt Dungeon um 10:00 bei Regen
    │
    ├── Dungeon-Map hat kein Weather
    │
    ├── Im Hintergrund: Overworld-Weather tickt weiter
    │   └── time:segment-changed Events weiterhin verarbeitet
    │
    └── Party verlässt Dungeon um 14:00
        └── Aktuelles Overworld-Weather wird angezeigt (evtl. Sonne)
```

**Begründung:** Spieler sollen nicht erwarten, dass das Wetter "eingefroren" ist während sie im Dungeon sind.

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
