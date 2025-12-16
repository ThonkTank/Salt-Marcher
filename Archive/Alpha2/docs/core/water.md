Pure math for water flow, accumulation, and moisture. Requires neighbor data for flow calculations.

#### Inputs
| Feld | Typ | Einheit | Quelle |
|------|-----|---------|--------|
| elevation | number | m | Tile.elevation (unbegrenzt, kann negativ sein) |
| groundwater | number | m | Tile.groundwater (Wasserspiegelhöhe, unbegrenzt) |
| precipitation | number | mm/Tag | Tile.baseWeather.precipitation |

#### Outputs (→ Tile)
| Feld | Typ | Einheit | Beschreibung |
|------|-----|---------|--------------|
| moisture | number | % (0-100) | Bodenfeuchtigkeit (abgeleitet) |
| riverFlow | number | m³/s | Wassermenge im Fluss (0 = kein Fluss) |
| flowDirection | number | -1 bis 5 | Hex-Richtung (-1 = Senke) |
| waterDepth | number | m | Wassertiefe (berechnet: max(0, groundwater - elevation)) |
| isWaterBody | boolean | - | True wenn groundwater > elevation |

#### isWaterBody Logik (NEU)

Die Bestimmung ob ein Tile unter Wasser liegt basiert auf dem Vergleich von Wasserspiegelhöhe und Geländehöhe:

```typescript
isWaterBody = tile.groundwater > tile.elevation
waterDepth = Math.max(0, tile.groundwater - tile.elevation)
```

**Beispiele:**
| groundwater | elevation | isWaterBody | waterDepth | Beschreibung |
|-------------|-----------|-------------|------------|--------------|
| -50m | 50m | false | 0m | Wüste (Wasserspiegel tief unter Oberfläche) |
| 10m | 50m | false | 0m | Trockenes Land (40m über Wasserspiegel) |
| 50m | 50m | false | 0m | Sumpf/Feuchtgebiet (auf Wasserniveau) |
| 60m | 50m | true | 10m | See/Meer (10m unter Wasser) |
| 0m | -100m | true | 100m | Tiefseegraben (100m unter Wasser) |

#### Berechnungslogik

**Flow Direction (D6 für Hex):**
```
elevations = neighbors.map(n => n.elevation)
minElevation = min(elevations)
flowDirection = tile.elevation <= minElevation ? -1 : elevations.indexOf(minElevation)
```

**Flow Accumulation (Global):**
```
sortedTiles = tiles.sortBy(t => -t.elevation)  // Höchste zuerst
for (tile of sortedTiles):
  inflow = sum(upstream tiles flowing here)
  localWater = precipitation * TILE_AREA / 1000
  tile.riverFlow = inflow + localWater
```

**River Threshold:** `isRiver = riverFlow >= 100 m³/s`

**Moisture:**
```typescript
// Moisture ist ein abgeleiteter Wert (0-100%), berechnet aus mehreren Faktoren
// groundwater ist jetzt in Metern (nicht %), daher neue Formel:

// Groundwater-Beitrag: Je näher Wasserspiegel an Oberfläche, desto feuchter
// Differenz = elevation - groundwater (positive Werte = Wasserspiegel unter Boden)
const groundwaterContribution = Math.max(0, 50 - (tile.elevation - tile.groundwater) / 2);
// 0m Differenz = 50%, 100m Differenz = 0%

// Wenn unter Wasser: automatisch 100%
if (tile.groundwater > tile.elevation) {
  moisture = 100;
} else {
  moisture = clamp(
    groundwaterContribution +
    precipitation / 10 +
    (isRiver ? 20 : 0) +
    (hasWaterNeighbor ? 10 : 0),
    0, 100
  );
}
```

**Lake Formation:**
- Senken (flowDirection = -1) akkumulieren Wasser bis Überlauf
- Für statische Gewässer: `groundwater > elevation` bestimmt Wassertiefe direkt
- Dynamische Seen: Inflow akkumuliert und erhöht effektiv den lokalen Wasserspiegel

#### Functions
| Funktion | Beschreibung |
|----------|--------------|
| calculateFlowDirection(tile, neighbors) | D6 Flow Direction |
| calculateFlowAccumulation(tiles) | Global Flow für alle Tiles |
| calculateMoisture(tile, hasRiver, hasWaterNeighbor) | Bodenfeuchtigkeit |
| calculateLakeDepth(tile, inflow) | Wassertiefe für Senken |
| identifyRivers(tiles, threshold) | Tiles mit River markieren |
| identifyLakes(tiles) | Senken mit Wasser |
| traceRiver(source, tiles) | Flussverlauf |
| identifyWatersheds(tiles) | Einzugsgebiete |
