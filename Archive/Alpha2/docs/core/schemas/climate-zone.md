# ClimateZone Schema

Zusammenhängende Tiles mit ähnlichem Klima. Gespeichert auf Map-Level.

## Implementation

| Datei | Beschreibung |
|-------|--------------|
| `src/core/schemas/climate-zone.ts` | Type definitions |
| `src/core/eco-math/eco-constants.ts` | `CLIMATE_ZONE_CONSTANTS` |
| `src/services/climate/zone-utils.ts` | Factory functions |

## Interfaces

### ZoneClimate

Aggregierte Klima-Werte (Durchschnitt aller Tiles in der Zone).

```typescript
interface ZoneClimate {
  elevation: number;      // m
  sunlight: number;       // kWh/Tag pro Tile
  ambientMagic: number;   // Thaum/Tag pro Tile
  temperature: number;    // °C
  precipitation: number;  // mm/Tag
  humidity: number;       // % (0-100)
  windSpeed: number;      // km/h
  windDirection: number;  // ° (0-360, 0=Nord, 90=Ost)
  cloudCover: number;     // % (0-100)
  moisture: number;       // % (0-100, aus Wasserberechnung)
}
```

### ClimateZone

```typescript
interface ClimateZone {
  id: string;                 // Unique ID
  tiles: TileCoord[];         // Alle Tiles in dieser Zone
  climate: ZoneClimate;       // Aggregierte Klima-Werte

  // Zone-Eigenschaften
  isWaterZone: boolean;       // Wasserkörper-Zone (See, Meer)?
  waterAvailable: boolean;    // Zugängliches Wasser (Flüsse, Teiche)?

  // Berechnete Werte (Solver)
  soilNutrients?: number;     // FU für Boden-basierte Ernährung
}
```

### MapClimateZones

```typescript
interface MapClimateZones {
  zones: ClimateZone[];
  lastCalculated: CalendarDate;  // Wann zuletzt berechnet
}
```

### ZoneResources

Ressourcen für den Ecosystem-Solver. Wird während Solver-Iterationen aktualisiert.

```typescript
interface ZoneResources {
  // Basis-Ressourcen (aus Zone-Eigenschaften)
  sunlight: number;       // kWh/Tag verfügbar
  water: number;          // Wasserverfügbarkeit (0-100)
  soil: number;           // Boden-FU verfügbar
  ambientMagic: number;   // Thaum/Tag verfügbar

  // Abgeleitete Ressourcen (aus Populationen)
  plantMatter: number;    // PlantFU von Pflanzenpopulationen
  meat: number;           // MeatFU (nicht-regenerierend = Jagd)
  blood: number;          // BloodFU (regenerierend)
  essence: number;        // EssenceFU (regenerierend)
  carrion: number;        // CarrionFU (aus Todesfällen)
  detritus: number;       // DetritusFU (aus Abfall + Todesfällen)
}
```

## Konstanten

```typescript
const CLIMATE_ZONE_CONSTANTS = {
  // Z-Score Toleranz für Zone-Zugehörigkeit
  Z_SCORE_TOLERANCE: 1.0,

  // Minimale Standardabweichungen (Sicherheitsnetz)
  MIN_STD_DEV: {
    elevation: 50,           // m
    sunlight: 5_000_000,     // kWh/Tag
    ambientMagic: 5_000_000, // Thaum/Tag
    temperature: 2,          // °C
    precipitation: 10,       // mm/Tag
    humidity: 5,             // %
    windSpeed: 5,            // km/h
    windDirection: 15,       // ° (Windrichtung variiert stark)
    cloudCover: 5,           // %
    moisture: 5,             // %
  },

  // Wasserkörper-Schwelle
  WATER_BODY_MIN_SIZE: 5,    // Tiles
};
```

## Factory Functions

Siehe `src/services/climate/zone-utils.ts`:

- `createClimateZone(id, climate, tiles?, isWaterZone?, waterAvailable?)` - Erstellt neue Zone
- `createZoneResources(zone)` - Erstellt initiale Ressourcen für Solver

## Beziehungen

```
Map 1:1 MapClimateZones
ClimateZone 1:N Tile
ClimateZone 1:N Population (via Territory-Overlap)
```

## Siehe auch

- `docs/core/climate-math.md` - Algorithmen zur Zonengenerierung
- `docs/core/eco-mathNEW.md` - Ecosystem-Solver Berechnungen
