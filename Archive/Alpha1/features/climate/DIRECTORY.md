# Climate Feature

**Purpose**: Terrain-derived climate calculations including temperature, moisture, flora, terrain derivation, and rain shadow effects.

## Contents

| Element | Type | Description |
|---------|------|-------------|
| `types.ts` | Types | Diurnal phases, amplitude modifiers, temperature constants |
| `amplitude-calculator.ts` | Calculator | Diurnal temperature amplitude from terrain properties |
| `temperature-calculator.ts` | Calculator | Base temperature with seasonal and elevation adjustments |
| `rain-shadow-calculator.ts` | Calculator | Rain shadow effects from mountain/wind interaction |
| `climate-engine.ts` | Service | Main climate engine combining temperature calculations |
| `derivation-engine.ts` | Calculator | Moisture and flora derivation from base layers |
| `terrain-derivation.ts` | Calculator | Terrain type from relative elevation to neighbors |
| `index.ts` | Barrel | Public API exports |

## Connections

**Used by:**
- `src/workmodes/cartographer/` - Climate overlays and derivation panels
- `src/workmodes/session-runner/` - Weather and travel calculations
- `src/features/weather/` - Weather generation input

**Depends on:**
- `@services/domain/terrain-types` - TerrainType, FloraType, MoistureLevel
- `@services/domain/tile-types` - TileData, DerivationSource
- `@services/geometry` - Hex neighbor calculations

## Public API

### Derivation Engine

```typescript
import {
    deriveMoisture,
    deriveFlora,
    deriveForTile,
    deriveForMap
} from "@features/climate";

// Moisture derivation from groundwater, precipitation, elevation
const moisture = deriveMoisture(
    groundwater: number,     // 0-100
    precipitation: number,   // 0-100
    elevation: number        // meters
): MoistureLevel;

// Flora derivation from moisture, temperature, fertility
const flora = deriveFlora(
    moisture: MoistureLevel,
    temperature: number,     // °C
    fertility: number        // 0-100
): FloraType;

// Single tile derivation
const result = deriveForTile(tile, getPrecipitation, getTemperature);

// Batch derivation for entire map
const results = deriveForMap(tiles, getPrecipitation, getTemperature);
```

### Terrain Derivation

```typescript
import type { AxialCoord } from "@geometry";
import {
    deriveTerrain,
    deriveTerrainForTile,
    deriveTerrainForMap,
    analyzeTerrainDerivation
} from "@features/climate";

// Terrain from elevation relative to neighbors
// All coordinates use AxialCoord format { q, r }
const terrain = deriveTerrain(
    coord: AxialCoord,
    getElevation: (c: AxialCoord) => number | undefined
): TerrainType;

// Single tile with full context
const result = deriveTerrainForTile(coord, tiles);

// Batch terrain derivation
const results = deriveTerrainForMap(tiles);

// Detailed analysis for debugging/tooltips
const analysis = analyzeTerrainDerivation(coord, getElevation);
```

### Temperature System

```typescript
import {
    getClimateEngine,
    calculateBaseTemperature,
    getPhaseTemperature,
    getAllPhaseTemperatures
} from "@features/climate";

// Get/create singleton engine
const engine = getClimateEngine(config?);

// Calculate temperature for tile at specific hour
const result = engine.calculateTemperature(tile, hour, season);

// Manual calculation
const baseTemp = calculateBaseTemperature(tile, season, globalBase);
const phaseTemp = getPhaseTemperature(baseTemp, amplitude, phase);
const allPhases = getAllPhaseTemperatures(baseTemp, amplitude);
```

### Rain Shadow System

```typescript
import type { AxialCoord } from "@geometry";
import {
    calculateRainShadow,
    calculateRainShadowMap,
    isLikelyInRainShadow
} from "@features/climate";

// Single hex rain shadow calculation
// coord is AxialCoord format { q, r }
const result = calculateRainShadow(coord, windDirection, getElevation);

// Batch calculation for multiple hexes
const shadowMap = calculateRainShadowMap(tiles, windDirection);

// Quick approximation
const likely = isLikelyInRainShadow(coord, windDirection, getElevation);
```

## Usage Example

```typescript
import type { AxialCoord } from "@geometry";
import {
    deriveMoisture,
    deriveFlora,
    deriveTerrain,
    deriveForMap,
    deriveTerrainForMap,
    getClimateEngine
} from "@features/climate";

// Coordinates use AxialCoord format
const coord: AxialCoord = { q: 10, r: 5 };

// Derivation workflow
const moisture = deriveMoisture(60, 55, 200); // => "lush"
const flora = deriveFlora(moisture, 18, 70);   // => "dense"
const terrain = deriveTerrain(coord, getElevFn); // => "hills"

// Batch derivation for map
const moistureResults = deriveForMap(tiles, getPrecip, getTemp);
const terrainResults = deriveTerrainForMap(tiles);

// Temperature calculations
const engine = getClimateEngine({ globalBaseTemp: 15 });
const temp = engine.calculateTemperature(tile, 14, "summer");
console.log(temp.phaseTemp); // 25°C at midday in summer
```
