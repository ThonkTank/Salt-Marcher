# Climate Service

**Zweck**: Bridge/Facade service that provides access to climate feature functionality while maintaining architectural layer boundaries. Enables features and workmodes to use climate calculations without creating direct cross-feature dependencies.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| index.ts | Barrel export re-exporting climate feature API |
| types.ts | Type re-exports from climate feature modules |
| climate-bridge.ts | Facade implementation wrapping @features/climate |

## Verbindungen

- **Verwendet von**:
  - `src/features/weather/weather-generator.ts` - Weather system climate integration
  - `src/features/maps/overlay/layers/temperature-overlay-layer.ts` - Temperature visualization
  - `src/features/maps/overlay/layers/rain-shadow-overlay-layer.ts` - Rain shadow visualization
  - `src/workmodes/cartographer/components/inspector-panel-data.ts` - Climate data inspection
- **Abhängig von**:
  - `@features/climate` (wrapped implementation)
    - `climate-engine.ts` - Core climate calculation engine
    - `amplitude-calculator.ts` - Diurnal temperature amplitude
    - `temperature-calculator.ts` - Base and phase-specific temperatures
    - `rain-shadow-calculator.ts` - Mountain precipitation blocking

## Public API

```typescript
// Import from: src/services/climate
import {
  // Climate Engine
  getClimateEngine,       // Get default ClimateEngine instance
  ClimateEngine,          // Main climate calculation engine
  resetClimateEngine,     // Reset engine state

  // Amplitude Calculator
  calculateDiurnalAmplitude,      // Calculate day/night temperature swing
  getAmplitudeBreakdown,          // Detailed amplitude component breakdown
  formatAmplitudeBreakdown,       // Human-readable amplitude format
  getAmplitudeDescription,        // Natural language amplitude description

  // Temperature Calculator
  SEASONAL_OFFSETS,               // Temperature offsets by season
  calculateBaseTemperature,       // Base temperature for location
  getBaseTemperatureBreakdown,    // Detailed temperature breakdown
  formatBaseTemperatureBreakdown, // Human-readable temperature format
  getSeasonLabel,                 // Season name from day of year
  getPhaseTemperature,            // Temperature at specific time phase
  getAllPhaseTemperatures,        // Temperatures for all day phases
  getDailyMinMax,                 // Daily temperature extremes
  getSeasonFromDay,               // Season enum from day of year
  getSeasonalSineOffset,          // Seasonal temperature variation

  // Rain Shadow Calculator
  MOUNTAIN_THRESHOLD,             // Elevation threshold for mountains
  MAX_SHADOW_RANGE,               // Maximum rain shadow distance
  MAX_SHADOW_MODIFIER,            // Maximum precipitation reduction
  calculateRainShadow,            // Calculate rain shadow for single hex
  calculateRainShadowMap,         // Calculate rain shadow for entire map
  clearRainShadowCache,           // Clear calculation cache
  getRainShadowCacheSize,         // Get cache size
  formatRainShadowResult,         // Format rain shadow data
  isLikelyInRainShadow,           // Check if hex is in rain shadow

  // Types
  type DiurnalPhase,              // Time of day phase
  type AmplitudeBreakdown,        // Amplitude calculation details
  type BaseTemperatureBreakdown,  // Temperature calculation details
  type ClimateCalculationResult,  // Complete climate calculation
  type ClimateInputTile,          // Tile data for climate calculations
  type Season,                    // Season enumeration
  type RainShadowResult,          // Rain shadow calculation result
  type ClimateEngineConfig,       // Engine configuration options

  // Utility functions
  getPhaseFromHour,               // Convert hour to phase
  getRepresentativeHour,          // Get representative hour for phase
  hasClimateData,                 // Check if tile has climate data
  getPhaseLabel,                  // Human-readable phase name
  getPhaseAbbrev,                 // Phase abbreviation
} from "@services/climate";
```

## Usage Example

```typescript
import { getClimateEngine, calculateRainShadowMap } from "@services/climate";
import type { ClimateInputTile } from "@services/climate";
import { oddr } from "@features/maps/coordinate-system";

// Get climate engine instance
const engine = getClimateEngine();

// Calculate temperature for a tile
const tile: ClimateInputTile = {
  coord: oddr(5, 10),
  terrain: "forest",
  flora: "oak",
  moisture: "normal",
  elevation: 150,
  latitude: 45.5,
  globalBaseTemp: 15,
};

const result = engine.calculate(tile, {
  dayOfYear: 180,
  hour: 14,
});

console.log(`Temperature: ${result.temperature}°C`);
console.log(`Amplitude: ${result.amplitude}°C`);

// Calculate rain shadow for entire map
const rainShadowMap = calculateRainShadowMap(
  tilesArray,
  { bearing: 270, speed: 15 }, // Wind from west
  500 // Max raycast distance
);

// Access rain shadow data
const shadowData = rainShadowMap.get("5,10");
if (shadowData) {
  console.log(`Precipitation modifier: ${shadowData.modifier}%`);
}
```

## Architecture Notes

**Why a Bridge Service?**

This service exists to enforce architectural layer boundaries:

1. **Prevents Cross-Feature Dependencies**: Features should not directly import from other features. This bridge allows features like `weather` and `maps/overlay` to access climate calculations without violating layer rules.

2. **Maintains Single Source of Truth**: The actual climate implementation remains in `@features/climate`. This service is a thin facade that re-exports the API.

3. **Enables Clean Refactoring**: If the climate feature's internal structure changes, only this bridge needs updating. Consumers remain unaffected.

4. **Follows Dependency Flow**: Services layer sits below features, so features → services → wrapped-feature is allowed, while features → features is forbidden.

**Design Pattern**: Facade/Bridge Pattern

The service provides no additional logic beyond re-exporting. All climate calculations, caching, and state management remain in the climate feature.

**When to Use This Service**:
- ✅ From other features (weather, maps)
- ✅ From workmodes (cartographer, session-runner)
- ❌ From within climate feature itself (use direct imports)

**Migration Note**: Before this service existed, consumers used `import type` for cross-feature access. This bridge allows full runtime access while maintaining architectural cleanliness.

## Related Documentation

- [src/features/climate/DIRECTORY.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/src/features/climate/DIRECTORY.md) - Wrapped implementation details
- [docs/core/climate-system.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/core/climate-system.md) - Climate system architecture
- [docs/STRUCTURE_STANDARDS.md](/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/docs/STRUCTURE_STANDARDS.md) - Layer architecture rules
