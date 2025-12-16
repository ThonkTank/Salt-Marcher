# @Geometry - Tile Geometry

Physikalische Dimensionen für Hex-Tiles.

## Implementation

| Datei | Beschreibung |
|-------|--------------|
| `src/core/geometry/tile-constants.ts` | Konstanten |
| `src/core/geometry/index.ts` | Re-Exports |

## Tile-Dimensionen

| Konstante | Wert | Beschreibung |
|-----------|------|--------------|
| TILE_DIAMETER_MILES | 3 | Punkt-zu-Punkt (flat-top hex) |
| TILE_RADIUS_MILES | 1.5 | Umkreisradius |
| TILE_DIAMETER_M | 4828 | ~4.83 km |
| TILE_RADIUS_M | 2414 | ~2.41 km |
| TILE_AREA_M2 | 15,140,000 | Fläche in m² |
| TILE_AREA_HECTARES | 1514 | Fläche in Hektar |
| TILE_AREA_KM2 | 15.14 | Fläche in km² |

## Berechnung

Hex-Fläche (flat-top): `A = (3√3/2) × r²`

Mit r = 2414m:
- A = (3 × 1.732 / 2) × 2414²
- A = 2.598 × 5,827,396
- A ≈ 15,140,000 m²

## Geplante Erweiterungen

Laut `docs/ArchitectureGoals.md` soll @Geometry folgende Komponenten enthalten:

### /Hexa
Hexagonales Koordinatensystem mit axialen Koordinaten (q, r):
- coordsInRadius, distance, neighbors
- toPixel, fromPixel, corners
- toKey, fromKey, line

### /Square
Quadratisches Koordinatensystem (x, y):
- Gleiche Funktionen wie Hexa

## Siehe auch

- `docs/ArchitectureGoals.md` - @Geometry Service Spezifikation
- `docs/core/eco-mathNEW.md` - Verwendet Tile-Dimensionen für Sunlight/Magic Umrechnung
