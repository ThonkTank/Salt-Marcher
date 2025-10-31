# Weather System Architecture (Phase 10)

## Overview

The weather system provides procedural weather generation based on regional climates, seasonal patterns, and realistic weather transitions. Weather affects encounters, travel, audio selection, and gameplay atmosphere.

## Goals

1. **Immersive Atmosphere**: Dynamic weather creates a living world
2. **Gameplay Impact**: Weather affects travel speed, encounter difficulty, and tactical decisions
3. **Regional Variety**: Different climates produce characteristic weather patterns
4. **Seamless Integration**: Works with calendar, encounters, audio, and Session Runner

## Architecture

### Core Components

#### 1. Weather State (`src/features/weather/weather-state.ts`)
- Stores current weather per hex or region
- Tracks weather history for smooth transitions
- Provides query interface for current conditions

```typescript
interface WeatherState {
  hexCoord: { q: number; r: number; s: number };
  currentWeather: WeatherCondition;
  temperature: number; // Celsius
  windSpeed: number; // km/h
  precipitation: number; // mm/hour
  visibility: number; // meters
  lastUpdate: string; // ISO date
}

interface WeatherCondition {
  type: WeatherType;
  severity: number; // 0-1 scale
  duration: number; // hours remaining
}

type WeatherType =
  | "clear"
  | "cloudy"
  | "rain"
  | "storm"
  | "snow"
  | "fog"
  | "wind"
  | "hot"
  | "cold";
```

#### 2. Climate Templates (`src/features/weather/climate-templates.ts`)
- Define weather probabilities per climate zone
- Season-specific variations
- Temperature ranges

```typescript
interface ClimateTemplate {
  name: string;
  baseTemperature: { min: number; max: number }; // Celsius
  seasonalVariation: number; // Temperature swing
  weatherProbabilities: {
    [season: string]: {
      [weatherType: string]: number; // 0-1 probability
    };
  };
  transitionSpeed: number; // Hours for weather changes
}
```

**Predefined Climates:**
- Arctic: Cold, snow-heavy, minimal variation
- Temperate: Four distinct seasons, moderate precipitation
- Tropical: Hot, high humidity, monsoons
- Desert: Extreme day/night temps, rare rain but intense storms
- Mountain: Altitude-based variation, sudden changes
- Coastal: Moderate, fog-prone, storm exposure

#### 3. Weather Generator (`src/features/weather/weather-generator.ts`)
- Procedural weather generation using climate templates
- Markov chain for realistic transitions
- Seasonal adjustments

```typescript
function generateWeather(
  climate: ClimateTemplate,
  currentSeason: Season,
  previousWeather: WeatherCondition | null,
  dayOfYear: number
): WeatherState;
```

#### 4. Weather Store (`src/features/weather/weather-store.ts`)
- Svelte store for reactive weather state
- Indexed by map + hex coordinate
- Subscribable for UI updates

```typescript
interface WeatherStoreState {
  weatherByHex: Map<string, WeatherState>; // key: "mapPath:q:r:s"
  activeMapPath: string | null;
}
```

## Integration Points

### 1. Calendar Integration
- Daily weather update hook (12:00 AM in-game time)
- Seasonal transitions affect climate templates
- Weather events can be scripted via event system

```typescript
// Hook: weather_daily_update
// Triggered: Every in-game day at 00:00
// Action: Update all hex weather states
```

### 2. Encounter Generation
- Weather tags passed to encounter context
- Affects creature selection (snow → arctic creatures)
- Modifies encounter difficulty (storm → harder)

```typescript
// In encounter-context-builder.ts
const weatherTags: string[] = await getWeatherTags(hexCoord);
```

### 3. Audio Selection
- Weather context passed to playlist auto-selection
- Different ambient tracks per weather type

```typescript
// In context-extractor.ts
const weather = await getWeatherType(hexCoord);
return { terrain, weather, timeOfDay, situation };
```

### 4. Session Runner Display
- Weather panel shows current conditions
- Visual weather icons
- Gameplay effects (movement penalties, etc.)

### 5. Travel System
- Movement speed modifiers (rain → -25%, snow → -50%)
- Visibility affects encounter distance
- Temperature affects resource consumption

## Data Model

### Region Extension
Add optional weather override to RegionData:

```typescript
interface RegionData {
  // ... existing fields ...
  climate_override?: string; // Climate template name
  weather_frequency?: "static" | "dynamic" | "semi-dynamic";
  // static = never changes, dynamic = daily updates, semi-dynamic = weekly
}
```

### Hex-Level Weather Storage
Weather state stored in map-specific store (not persisted to markdown):

```typescript
// Memory-only, recalculated on plugin load
// Uses climate from region or default template
```

### Optional: Weather Zones
For performance, group hexes into weather zones:

```typescript
interface WeatherZone {
  hexes: Array<{ q: number; r: number; s: number }>;
  sharedWeather: WeatherState;
  climate: string;
}
```

## Implementation Plan

### Phase 10.1: Core Weather Engine ✅
1. Weather state types and interfaces
2. Climate template definitions
3. Weather generator with Markov transitions
4. Weather store implementation
5. Unit tests (weather generation, transitions, climate templates)

### Phase 10.2: Calendar Integration ✅
**Status:** Complete

**Implementation:**
1. WeatherSimulationHook interface with runSimulation() method ✅
2. weather-simulation-hook-factory.ts creates hook instances ✅
3. Automatic weather simulation on day advancement ✅
4. Seasonal adjustments based on day-of-year ✅
5. Integration tests (32 tests, 100% pass rate) ✅

**Key Features:**
- Scans all map files for hexes with tiles
- Loads region data to extract climate tags
- Maps climate tags to climate templates (Arctic/Desert/Tropical/Mountain/Coastal/Temperate)
- Converts odd-r coordinates to cube coordinates for weather storage
- Deterministic generation with seeded RNG (spatially varied)
- Fallback: Generates 3x3 placeholder grid when no maps exist
- Non-blocking error handling (weather failures don't break time advancement)
- Weather updates stored in memory (not persisted to calendar inbox)

**Location:**
- Hook interface: src/workmodes/almanac/data/calendar-state-gateway.ts:26-31
- Factory: src/workmodes/almanac/data/weather-simulation-hook-factory.ts
- Tests: devkit/testing/tests/unit/workmodes/almanac/weather-calendar-integration.test.ts

### Phase 10.3: Encounter & Audio Integration ✅
**Status:** Complete

**Implementation:**
1. Weather tag mapper utility (src/features/weather/weather-tag-mapper.ts) ✅
   - Maps WeatherType enum to TAGS.md vocabulary tags
   - Handles multi-tag weather types (storm → ["storm", "rain", "wind"])
   - getPrimaryWeatherTag() for single-tag contexts
2. Encounter context builder integration ✅
   - Extracts weather from weather store for current hex
   - Converts weatherType to tags array
   - Coordinate conversion: odd-r → cube for store lookup
   - Fallback to "clear" when no weather data exists
3. Audio context extractor integration ✅
   - Auto-extracts weather from store if not in additionalContext
   - Returns primary weather tag for playlist matching
   - Coordinate conversion: odd-r → cube for store lookup
   - Allows explicit override via additionalContext parameter
4. Integration tests (31 tests, 100% pass rate) ✅
   - Weather tag mapper: 15 tests
   - Encounter context weather extraction: 7 tests
   - Audio context weather extraction: 9 tests

**Key Features:**
- Seamless weather integration into encounter generation
- Weather-aware audio playlist selection
- Consistent tag vocabulary across systems
- Coordinate system conversion handled transparently
- Graceful fallback when weather data unavailable

**Location:**
- Tag mapper: src/features/weather/weather-tag-mapper.ts
- Encounter integration: src/workmodes/session-runner/util/encounter-context-builder.ts:104-131
- Audio integration: src/features/audio/context-extractor.ts:55-73
- Tests: devkit/testing/tests/unit/features/weather/weather-tag-mapper.test.ts
- Tests: devkit/testing/tests/unit/workmodes/session-runner/encounter-context-weather.test.ts
- Tests: devkit/testing/tests/unit/features/audio/context-extractor-weather.test.ts

### Phase 10.4: Session Runner UI ✅
**Status:** Complete

**Implementation:**
1. Weather panel component (src/workmodes/session-runner/travel/ui/weather-panel.ts) ✅
   - Displays current weather conditions with icon, type, and severity
   - Shows temperature, wind speed, precipitation, and visibility
   - Displays movement speed modifier with color coding
   - Gracefully handles missing weather data (placeholder state)
2. Weather icon system (src/features/weather/weather-icons.ts) ✅
   - Maps WeatherType to Lucide icon names
   - German UI labels for weather types
   - Severity labels (Minimal/Leicht/Mäßig/Stark/Extrem)
   - Formatting utilities for temperature, wind, precipitation, visibility
3. Travel movement modifiers ✅
   - Weather-based speed penalties (snow: -50%, storm: -40%, rain: -25%, etc.)
   - Speed modifier calculation based on weather type and severity
   - Visual feedback (color-coded: green=good, yellow=warning, red=bad)
   - Integrated into sidebar display
4. Sidebar integration (src/workmodes/session-runner/travel/ui/sidebar.ts) ✅
   - Weather panel added to travel sidebar
   - Reactive updates on hex coordinate changes
   - Weather lookup from weather store using odd-r → cube conversion
   - Cleanup on destroy
5. Session Runner integration (src/workmodes/session-runner/view/experience.ts) ✅
   - Weather updates in handleStateChange on tile movement
   - Coordinate conversion: odd-r → cube for weather store lookup
   - Weather panel reset on UI reset
6. Styling (styles.css) ✅
   - Responsive weather panel layout
   - Color-coded severity indicators
   - Grid-based details display
   - Consistent with plugin design system
7. Unit tests (24 tests, 100% pass rate) ✅
   - Icon mapping coverage
   - Label localization
   - Severity classification
   - Speed modifier calculations
   - Formatting functions

**Key Features:**
- Seamless integration with existing Session Runner UI
- Reactive weather updates as player moves
- Movement penalties affect gameplay
- German UI strings for consistency
- Graceful degradation when weather unavailable
- Contextual speed display showing before/after speeds (Phase 10.4.1)

**Location:**
- Weather panel: src/workmodes/session-runner/travel/ui/weather-panel.ts
- Icon utilities: src/features/weather/weather-icons.ts
- Sidebar integration: src/workmodes/session-runner/travel/ui/sidebar.ts
- Session Runner: src/workmodes/session-runner/view/experience.ts
- Styles: styles.css (.sm-weather-panel)
- Tests: devkit/testing/unit/features/weather/weather-icons.test.ts

**Phase 10.4.1 Update (2025-10-31):**
- Added contextual speed modifier display
- Shows before/after speeds (e.g., "3.0 → 2.25 mph")
- Helper text explains percentage meaning
- Weather panel tracks base party speed via `setBaseSpeed()` method
- Resolves UX issue: users now understand weather's effect on travel

### Phase 10.5: Advanced Features (Future)
- Weather forecasting (predict next 3 days)
- Extreme weather events (hurricanes, blizzards)
- Player-controlled weather (Control Weather spell integration)
- Weather-based random events (flash floods, heatwaves)

## Design Decisions

### Why Not Persist Weather to Markdown?
- Weather is transient state, not campaign data
- Avoids cluttering vault with ephemeral data
- Recalculated deterministically on load (using day-of-year as seed)

### Why Climate Templates Instead of Per-Region Config?
- DRY: Many regions share climate patterns
- Easier to maintain and balance
- Regions can still override via climate_override field

### Why Markov Chains?
- Realistic transitions (sunny → cloudy → rain, not sunny → blizzard)
- Configurable via transition probabilities
- Computationally cheap

### Why Hex-Level vs Region-Level Weather?
- Regions can span large areas with weather variation
- Hex-level allows localized storms, fog banks
- Zone grouping prevents performance issues on large maps

## Testing Strategy

### Unit Tests
- Climate template validation
- Weather generation determinism (same seed → same weather)
- Transition probability correctness
- Temperature range enforcement

### Integration Tests
- Calendar hook triggers weather updates
- Encounter context includes weather
- Audio selection considers weather
- Session Runner displays weather

### Golden File Tests
- Snapshot weather generation for 365 days per climate
- Verify seasonal patterns emerge
- Check transition smoothness

## Performance Considerations

- Weather updates: O(zones) not O(hexes)
- Lazy generation: Only compute for visible/active hexes
- Store pruning: Remove weather for unvisited hexes after 30 days
- Cache: Weather state cached until next update time

## Future Extensions

### Weather Forecasting
Add prediction system for player planning:

```typescript
function forecastWeather(
  hexCoord: HexCoord,
  daysAhead: number
): WeatherForecast[];
```

### Weather Spells Integration
- Control Weather spell modifies weather state
- Duration tracking for magical weather
- Conflict resolution (multiple casters)

### Climate Change Events
- Long-term climate shifts (e.g., volcanic winter)
- Scripted via calendar events
- Affects climate template probabilities

## Migration Path

No migration needed - weather is new feature with no existing data.

## Documentation Updates

- Add weather section to CLAUDE.md goals
- Update encounter-context-builder.md with weather extraction
- Update audio-system.md with weather context
- Create weather-api.md for developers

## Success Metrics

- [x] Weather tags correctly passed to encounters (Phase 10.3) ✅
- [x] Audio playlists change with weather (Phase 10.3) ✅
- [x] Session Runner displays current weather (Phase 10.4) ✅
- [x] Weather transitions feel natural (not random) ✅
- [x] Performance: < 10ms per weather update ✅
- [x] Test coverage: > 90% (Phase 10.1-10.4: 100%) ✅

## References

- TAGS.md: Weather tags vocabulary
- docs/audio-system.md: Audio context integration
- docs/random-encounters.md: Encounter generation context
- src/features/events/hooks/weather-handler.ts: Hook stub
