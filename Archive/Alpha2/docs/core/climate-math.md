# Klimazonen

  Zusammenhängende Tiles mit ähnlichem Klima werden zu Zonen zusammengefasst.
  Performance-Optimierung: Solver läuft pro Zone statt pro Tile.

  Klima-relevante Werte

  Base Data:
  - elevation (m)
  - sunlight (kWh/Tag)
  - ambientMagic (Thaum/Tag)

  Berechnet (Weather):
  - temperature (°C)
  - precipitation (mm/Tag)
  - humidity (%)
  - windSpeed (km/h)
  - cloudCover (%)

  Berechnet (Water):
  - moisture (0-100%)
  - isWaterBody (boolean)

  Regeln

  Zusammenhang:
  - Zonen müssen komplett zusammenhängend sein (Flood-Fill Algorithmus)
  - Zwei ähnliche aber getrennte Gebiete = zwei separate Zonen

  Wasserkörper:
  - Kleine Seen/Oasen (<5 zusammenhängende Wasser-Tiles): In umliegende Landzone integriert
  - Größere Gewässer (5+ Tiles): Eigene Zonen (nicht mit Land zusammenfassen)

  Berechnung:
  - Einmalig nach "Fertig"-Button
  - Reihenfolge: Base Data → Weather → Water → Klimazonen → Ecology

  Toleranz-Berechnung (Z-Score)

  const MIN_STD_DEV = {
    elevation: 50,           // m
    sunlight: 5_000_000,     // kWh/Tag
    ambientMagic: 5_000_000, // Thaum/Tag
    temperature: 2,          // °C
    precipitation: 10,       // mm/Tag
    humidity: 5,             // %
    windSpeed: 5,            // km/h
    cloudCover: 5,           // %
    moisture: 5,             // %
    windDirection: 15,       // ° (Windrichtung schwankt natürlich stark)
  };

  const Z_SCORE_TOLERANCE = 1.0;
  const WATER_BODY_MIN_SIZE = 5;
  const CLIMATE_KEYS = [
      'elevation', 'sunlight', 'ambientMagic',
      'temperature', 'precipitation', 'humidity',
      'windSpeed', 'windDirection', 'cloudCover', 'moisture'
    ];

  function isSameZone(tileA, tileB, allNeighbors): boolean {
    if (tileA.isWaterBody !== tileB.isWaterBody) return false;

    for (const key of CLIMATE_KEYS) {
      const a = tileA[key];
      const b = tileB[key];

      const neighborValues = allNeighbors.map(n => n[key]);
      const localMean = mean(neighborValues);
      const localStdDev = Math.max(standardDeviation(neighborValues), MIN_STD_DEV[key]);

      const zScoreA = (a - localMean) / localStdDev;
      const zScoreB = (b - localMean) / localStdDev;
      const zDiff = Math.abs(zScoreA - zScoreB);

      if (zDiff > Z_SCORE_TOLERANCE) return false;
    }

    return true;
  }

  ClimateZone Schema

  interface ClimateZone {
    id: string;
    tiles: TileCoord[];
    isWaterZone: boolean;

    // Aggregierte Klima-Werte (Durchschnitt aller Tiles)
    climate: {
      elevation: number;
      sunlight: number;
      ambientMagic: number;
      temperature: number;
      precipitation: number;
      humidity: number;
      windSpeed: number;
      cloudCover: number;
      moisture: number;
      windDirection: number;
    };
  }

  interface MapClimateZones {
    zones: ClimateZone[];
    lastCalculated: CalendarDate;
  }

  Zonen-Generierung

  function generateClimateZones(tiles: Map<string, Tile>): ClimateZone[] {
    const zones: ClimateZone[] = [];
    const assigned = new Set<string>();

    // 1. Wasserkörper identifizieren
    const waterBodies = identifyWaterBodies(tiles);

    // 2. Flood-Fill für alle unzugewiesenen Tiles
    for (const [coord, tile] of tiles) {
      if (assigned.has(coord)) continue;
      const zone = floodFillZone(coord, tile, tiles, assigned);
      zones.push(zone);
    }

    // 3. Kleine Wasserkörper (<5 Tiles) in Landzonen integrieren
    integrateSmallWaterBodies(zones, waterBodies, WATER_BODY_MIN_SIZE);

    return zones;
  }
  /**
     * Flood-Fill von Seed-Tile ausgehend
     */
    function floodFillZone(
      seedCoord: string,
      seedTile: Tile,
      tiles: Map<string, Tile>,
      assigned: Set<string>
    ): ClimateZone {
      const zoneTiles: string[] = [];
      const queue: string[] = [seedCoord];

      while (queue.length > 0) {
        const coord = queue.shift()!;
        if (assigned.has(coord)) continue;

        const tile = tiles.get(coord)!;
        const neighbors = getNeighbors(coord, tiles);

        // Prüfe ob Tile zur Zone passt (gegen Seed oder bereits zugewiesene)
        if (zoneTiles.length > 0) {
          const refTile = tiles.get(zoneTiles[0])!;
          const allNeighbors = [...neighbors, refTile];

          if (!isSameZone(tile, refTile, allNeighbors)) {
            continue;
          }
        }

        // Tile zur Zone hinzufügen
        zoneTiles.push(coord);
        assigned.add(coord);

        // Nachbarn zur Queue
        for (const neighbor of neighbors) {
          if (!assigned.has(neighbor.coord)) {
            queue.push(neighbor.coord);
          }
        }
      }

      return {
        id: generateZoneId(),
        tiles: zoneTiles,
        isWaterZone: seedTile.isWaterBody,
        climate: calculateZoneClimate(zoneTiles, tiles),
      };
    }

    /**
     * Aggregiert Klima-Werte für eine Zone (Durchschnitt aller Tiles)
     */
    function calculateZoneClimate(tileCoords: string[], tiles: Map<string, Tile>): ZoneClimate {
      const zoneTiles = tileCoords.map(c => tiles.get(c)!);

      return {
        elevation: mean(zoneTiles.map(t => t.elevation)),
        sunlight: mean(zoneTiles.map(t => t.baseClimate.sunlight)),
        ambientMagic: mean(zoneTiles.map(t => t.baseClimate.ambientMagic)),
        temperature: mean(zoneTiles.map(t => t.baseClimate.temperature)),
        precipitation: mean(zoneTiles.map(t => t.baseClimate.precipitation)),
        humidity: mean(zoneTiles.map(t => t.baseClimate.humidity)),
        windSpeed: mean(zoneTiles.map(t => t.baseClimate.windSpeed)),
        windDirection: mean(zoneTiles.map(t => t.baseClimate.windDirection)),
        cloudCover: mean(zoneTiles.map(t => t.baseClimate.cloudCover)),
        moisture: mean(zoneTiles.map(t => t.water.moisture)),
      };
    }


  ---
  Berechnungsreihenfolge

  User Input (Base Data)
      ↓
  Weather-Berechnung (inkl. Tageszeit/Monats-Modifikatoren)
      ↓
  Water-Berechnung (moisture, riverFlow, isWaterBody)
      ↓
  Klimazonen-Generierung
      ↓

