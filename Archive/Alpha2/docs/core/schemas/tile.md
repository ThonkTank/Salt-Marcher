#### /Tile
  Hex-Kachel mit Rohdaten (User) + abgeleiteten Daten (System).

  ```typescript
  interface Tile {
    coord: TileCoord;

    // ═══════════════════════════════════════════════════════════
    // BASE DATA (User Input)
    // ═══════════════════════════════════════════════════════════

    elevation: number;              // m (unbegrenzt, negativ = unter Meeresspiegel)
    groundwater: number;            // m (Wasserspiegelhöhe, unbegrenzt)

    // Klima-Grundwerte (Jahresdurchschnitt, Tagesmitte)
    baseClimate: {
      temperature: number;          // °C
      sunlight: number;             // kWh/Tag für gesamtes Tile
      humidity: number;             // % (0-100)
      windSpeed: number;            // km/h
      cloudCover: number;           // % (0-100)
      precipitation: number;        // mm/Tag
      windDirection: number;        // ° (0-360, 0=Nord, 90=Ost)
      ambientMagic: number;         // Thaum/Tag für gesamtes Tile
    };

    // ═══════════════════════════════════════════════════════════
    // DERIVED DATA (System-berechnet)
    // ═══════════════════════════════════════════════════════════

    // Tageszeit-Modifikatoren (berechnet aus Base + Latitude + Elevation)
    // Index: [dawn, morning, midday, afternoon, dusk, night]
    timeOfDayMod: {
      temperature: [number, number, number, number, number, number];  // additiv (±°C)
      sunlight: [number, number, number, number, number, number];     // multiplikativ (×)
      humidity: [number, number, number, number, number, number];     // multiplikativ (×)
      windSpeed: [number, number, number, number, number, number];    // multiplikativ (×)
      cloudCover: [number, number, number, number, number, number];   // multiplikativ (×)
      precipitation: [number, number, number, number, number, number]; // multiplikativ (×)
      windDirection: [number, number, number, number, number, number];  // additiv (±°)
    };

    // Monats-Modifikatoren (berechnet aus Base + Latitude + Elevation)
    // Index: [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
    monthMod: {
      temperature: [number, number, number, number, number, number, number, number, number, number, number,
  number];  // additiv (±°C)
      sunlight: [number, number, number, number, number, number, number, number, number, number, number,
  number];     // multiplikativ (×)
      humidity: [number, number, number, number, number, number, number, number, number, number, number,
  number];     // multiplikativ (×)
      windSpeed: [number, number, number, number, number, number, number, number, number, number, number,
  number];    // multiplikativ (×)
      cloudCover: [number, number, number, number, number, number, number, number, number, number, number,
  number];   // multiplikativ (×)
      precipitation: [number, number, number, number, number, number, number, number, number, number, number,
  number]; // multiplikativ (×)
  windDirection: [number, number, number, number, number, number, number, number, number, number, number,
  number];  // additiv (±°)
    };

    // Water (berechnet aus elevation, groundwater, precipitation, Nachbarn)
    water: {
      moisture: number;             // % (0-100) Bodenfeuchtigkeit
      riverFlow: number;            // m³/s (0 = kein Fluss)
      flowDirection: number;        // -1 bis 5 (Hex-Richtung, -1 = Senke)
      waterDepth: number;           // m (berechnet: max(0, groundwater - elevation))
      isWaterBody: boolean;         // true wenn groundwater > elevation
      isSaltwater: boolean;       // true für Meere, Salzseen

    };

    // Klimazone (Referenz)
    climateZoneId: string;          // ID der zugehörigen ClimateZone

    // Ecology (berechnet vom Equilibrium-Solver)
    ecology: {
      // Flow-Felder (FU/Tag)
      soil: number;               // Bodennährstoff-Flow
      plantmatter: number;        // Verfügbare Pflanzennahrung für Herbivoren
      detritus: number;           // Tote organische Materie für Decomposer
      carrion: number;            // Kadaver für Scavenger
      meat: number;               // Fleisch für Karnivoren
      blood: number;              // Blut für Parasiten
      essence: number;            // Lebensessenz für Essenz-Vampire
      magic: number;              // Magische Energie (aus ambientMagic)

      // Habitat
      habitat: {
        capacity: number;         // Max Population-Slots
        usedCapacity: number;     // Aktuell belegte Slots
      };
    };


    // ═══════════════════════════════════════════════════════════
    // CONTENT (nach Ecology-Solver)
    // ═══════════════════════════════════════════════════════════

    terrainType?: TerrainType;      // Wald, Wüste, etc. (nach Ecology)
    locations?: LocationRef[];      // Städte, Dungeons, POIs
    // Populationen sind auf Map-Level gespeichert (MapPopulations)

  // ═══════════════════════════════════════════════════════════
  // ASSIGNMENTS & META
  // ═══════════════════════════════════════════════════════════

  region?: string;              // Region-Zugehörigkeit
  faction?: string;             // Fraktion-Kontrolle

  note?: string;                // Freitext-Notiz
  locationMarker?: string;      // Marker-Referenz

  derivations: {
    weather: "auto" | "manual";
    water: "auto" | "manual";
    ecology: "auto" | "manual";
  };

  // ═══════════════════════════════════════════════════════════
  // RUNTIME (nicht persistiert, gecached)
  // ═══════════════════════════════════════════════════════════

  // seasonalWeather?: WeatherData;    // Tier 2
  // currentWeather?: WeatherData;     // Tier 3
  // conditions?: WeatherCondition[];
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER TYPES
  // ═══════════════════════════════════════════════════════════

  type TimeOfDay = "dawn" | "morning" | "midday" | "afternoon" | "dusk" | "night";
  type TimeOfDayIndex = 0 | 1 | 2 | 3 | 4 | 5;

  type Month = "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec";
  type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

  // ═══════════════════════════════════════════════════════════
  // LOOKUP FUNCTIONS
  // ═══════════════════════════════════════════════════════════

  type ClimateField = "temperature" | "sunlight" | "humidity" | "windSpeed" | "windDirection" | "cloudCover" | "precipitation";


  /**
   * Berechnet den Klima-Wert für eine bestimmte Tageszeit und Monat
   */
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
        // Additiv: base + timeMod + monthMod
        return base + timeMod + monthMod;
      } else {
        // Multiplikativ: base × timeMod × monthMod
        return base * timeMod * monthMod;
      }

  }

  /**
   * Berechnet moisture für eine bestimmte Tageszeit und Monat
   * (basiert auf precipitation-Änderung)
   */
  function getMoisture(
    tile: Tile,
    time: TimeOfDayIndex,
    month: MonthIndex
  ): number {
    const baseMoisture = tile.water.moisture;
    const precipFactor = tile.timeOfDayMod.precipitation[time] * tile.monthMod.precipitation[month];

    // Moisture skaliert mit Precipitation, aber gedämpft
    return Math.min(100, baseMoisture * (0.7 + 0.3 * precipFactor));
  }

  ---
  Beispiel-Werte

  // Tile in gemäßigtem Klima (Mitteleuropa, ~50° Latitude)
  const exampleTile: Tile = {
    coord: { q: 0, r: 0 },

    // Base Data
    elevation: 200,
    groundwater: 180,
    baseClimate: {
      temperature: 10,        // °C Jahresdurchschnitt
      sunlight: 45_000_000,   // kWh/Tag
      humidity: 70,           // %
      windSpeed: 15,          // km/h
      cloudCover: 50,         // %
      precipitation: 2.5,     // mm/Tag (~900mm/Jahr)
      ambientMagic: 0,
      windDirection: 270,     // ° (Westwind)
    },

    // Tageszeit-Modifikatoren
    timeOfDayMod: {
      //              dawn  morn  mid   aftn  dusk  night
      temperature: [  -3,   -1,   +5,   +3,   -1,   -5   ],  // ±°C
      sunlight:    [ 0.3,  0.8,  1.2,  1.0,  0.4,  0.0  ],  // ×
      humidity:    [ 1.2,  1.1,  0.8,  0.9,  1.1,  1.3  ],  // ×
      windSpeed:   [ 0.7,  0.9,  1.2,  1.3,  1.0,  0.6  ],  // ×
      cloudCover:  [ 0.9,  0.8,  1.0,  1.2,  1.1,  0.9  ],  // ×
      precipitation:[ 0.8, 0.7,  0.9,  1.4,  1.2,  0.8  ],  // ×
      windDirection:[ +10,  +5,    0,   -5,  -10,  +15  ],  // ±°
    },

    // Monats-Modifikatoren
    monthMod: {
      //              jan   feb   mar   apr   may   jun   jul   aug   sep   oct   nov   dec
      temperature: [ -10,  -8,   -3,   +2,   +7,  +10,  +12,  +11,   +6,   +1,   -4,   -8  ],  // ±°C
      sunlight:    [ 0.4,  0.5,  0.7,  0.9,  1.1,  1.3,  1.3,  1.2,  0.9,  0.7,  0.5,  0.4 ],  // ×
      humidity:    [ 1.1,  1.0,  0.9,  0.9,  0.9,  0.8,  0.8,  0.9,  1.0,  1.1,  1.1,  1.1 ],  // ×
      windSpeed:   [ 1.2,  1.1,  1.1,  1.0,  0.9,  0.8,  0.8,  0.8,  0.9,  1.0,  1.1,  1.2 ],  // ×
      cloudCover:  [ 1.2,  1.1,  1.0,  0.9,  0.8,  0.7,  0.7,  0.8,  0.9,  1.0,  1.1,  1.2 ],  // ×
      precipitation:[ 0.9, 0.8,  0.9,  1.0,  1.1,  1.2,  1.1,  1.0,  0.9,  1.0,  1.0,  1.0 ],  // ×
      windDirection:[ +20, +15,  +10,   +5,    0,   -5,  -10,  -10,   -5,    0,  +10,  +15 ],  // ±°
    },

    // Water (berechnet)
    water: {
      moisture: 65,
      riverFlow: 0,
      flowDirection: 3,
      waterDepth: 0,
      isWaterBody: false,
      isSaltwater: false
    },

    climateZoneId: "zone-temperate-1",
    // Ecology (vom Solver berechnet, hier Beispielwerte)
      ecology: {
        soil: 100,
        plantmatter: 5000,
        detritus: 200,
        carrion: 50,
        meat: 800,
        blood: 100,
        essence: 50,
        magic: 0,
        habitat: {
          capacity: 1000,
          usedCapacity: 450,
        },
      },

      // Assignments & Meta
      region: "Mittelland",
      faction: undefined,
      note: undefined,
      locationMarker: undefined,
      derivations: {
        weather: "auto",
        water: "auto",
        ecology: "auto",
      },

  };

  // Lookup: Juli, Mittag
  getClimateValue(exampleTile, "temperature", 2, 6);
  // = 10 + 5 + 12 = 27°C

  // Lookup: Januar, Nacht
  getClimateValue(exampleTile, "temperature", 5, 0);
  // = 10 + (-5) + (-10) = -5°C

  // Lookup: Juli, Mittag Sunlight
  getClimateValue(exampleTile, "sunlight", 2, 6);
  // = 45M × 1.2 × 1.3 = 70.2M kWh/Tag

  // Lookup: Dezember, Nacht Sunlight
  getClimateValue(exampleTile, "sunlight", 5, 11);
  // = 45M × 0.0 × 0.4 = 0 kWh/Tag

  ---
  Berechnungsreihenfolge

  1. User Input
     → elevation, groundwater, baseClimate

  2. Modifikator-Berechnung (calculateDerivedData)
     → timeOfDayMod, monthMod (aus Base + Latitude + Elevation + Nachbarn)

  3. Water-Berechnung
     → moisture, riverFlow, flowDirection, waterDepth, isWaterBody

  4. Klimazonen-Generierung
     → climateZoneId

  5. Ecology-Solver
     → terrainType (basierend auf dominanten Populationen)
