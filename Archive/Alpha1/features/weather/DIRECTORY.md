# Weather Feature

## Purpose

Procedural weather generation, forecasting, and climate template application. Generates weather conditions based on season, terrain, and climate zone.

## Architecture Layer

**Features** - Shared systems layer (mid-level)

## Public API

### Types

```typescript
import type { AxialCoord } from "@geometry";
import type {
  WeatherType,          // "clear" | "cloudy" | "rain" | "storm" | "snow" | etc.
  Season,               // "spring" | "summer" | "autumn" | "winter"
  WeatherCondition,
  WeatherState,         // Uses AxialCoord for hexCoord
  ClimateTemplate,
  WeatherGenerationOptions,
  WeatherZone,
} from "src/features/weather";
```

### Weather Generation

```typescript
import {
  generateWeather,
  getSeasonForDay,
  advanceWeather,
} from "src/features/weather";

import {
  generateForecast,
  type ForecastOptions,
} from "src/features/weather";
```

### Climate Templates

```typescript
import {
  ARCTIC_CLIMATE,
  TEMPERATE_CLIMATE,
  TROPICAL_CLIMATE,
  DESERT_CLIMATE,
  MOUNTAIN_CLIMATE,
  COASTAL_CLIMATE,
  CLIMATE_TEMPLATES,
} from "src/features/weather";
```

### Climate Modifiers

```typescript
import {
  applyClimateModifiers,
  getWindSpeedModifier,
  getVisibilityModifier,
  getMoisturePrecipitationBoost,
} from "src/features/weather";
```

### Weather Store (Reactive State)

```typescript
import {
  getWeatherStore,
  type WeatherHistoryEntry,
  type WeatherForecast,
} from "src/features/weather";
```

### Utilities

```typescript
import { getWeatherIcon } from "src/features/weather";
import { mapWeatherToTags } from "src/features/weather";
```

## Dependencies

- **Climate Feature** - Temperature calculations
- **Services** - Reactive state stores

## Usage Example

```typescript
import type { AxialCoord } from "@geometry";
import { generateWeather, generateForecast, TEMPERATE_CLIMATE } from "src/features/weather";

// Coordinates in AxialCoord format
const hexCoord: AxialCoord = { q: 10, r: 5 };

// Generate current weather
const weather = generateWeather({
  dayOfYear: 180,
  climate: TEMPERATE_CLIMATE,
  previousWeather: null,
  hexCoord,  // AxialCoord format
});

console.log(weather.hexCoord); // { q: 10, r: 5 }
console.log(weather.type); // "clear"
console.log(weather.temperature); // 22

// Generate 7-day forecast
const forecast = generateForecast({
  startDay: 180,
  days: 7,
  climate: TEMPERATE_CLIMATE,
  hexCoord,  // AxialCoord format
});
```

## Internal Structure

- `types.ts` - Weather type definitions
- `weather-generator.ts` - Core weather generation logic
- `weather-forecaster.ts` - Multi-day forecast generation
- `climate-templates.ts` - Predefined climate configurations
- `climate-modifiers.ts` - Climate-based weather adjustments
- `weather-store.ts` - Reactive weather state management
- `weather-icons.ts` - Weather type to icon mapping
- `weather-tag-mapper.ts` - Weather to encounter tag conversion
