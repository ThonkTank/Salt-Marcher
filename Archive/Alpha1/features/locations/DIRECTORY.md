# Locations Feature

## Purpose

Building production systems, faction integration, and hex-based influence calculations for settlements and other locations.

## Architecture Layer

**Features** - Shared systems layer (mid-level)

## Public API

### Building Production

```typescript
import type {
  BuildingCategory,
  BuildingJobType,
  BuildingTemplate,
  BuildingProduction,
} from "src/features/locations";

import {
  BUILDING_TEMPLATES,
  calculateProductionRate,
  calculateMaintenanceCost,
  initializeBuildingProduction,
  degradeBuilding,
  repairBuilding,
} from "src/features/locations";
```

### Faction Integration

```typescript
import type { LocationFactionLink } from "src/features/locations";

import {
  getFactionLocations,
  getMembersAtLocation,
  assignMemberToLocation,
  calculateLocationProduction,
  getFactionLocationSummary,
} from "src/features/locations";
```

### Location Influence

```typescript
import type { HexCoordinate, InfluenceArea, InfluenceConfig } from "src/features/locations";

import {
  calculateInfluenceArea,
  getInfluenceStrengthAt,
  getInfluencedHexes,
  mergeInfluenceAreas,
} from "src/features/locations";
```

### Production Visualization

```typescript
import {
  createProgressBar,
  createProductionDashboard,
  createResourceVisualization,
} from "src/features/locations";
```

## Dependencies

- **Factions Feature** - Faction data for member assignments
- **Maps Feature** - Hex coordinates for influence calculations

## Usage Example

```typescript
import { calculateInfluenceArea, getInfluenceStrengthAt } from "src/features/locations";

// Calculate influence from a city
const cityInfluence = calculateInfluenceArea({
  center: { x: 10, y: 15 },
  baseStrength: 100,
  decayRate: 0.1,
});

// Check influence at a hex
const strength = getInfluenceStrengthAt(cityInfluence, { x: 12, y: 16 });
```

## Internal Structure

- `building-production.ts` - Building templates and production calculations
- `location-faction-integration.ts` - Faction-location relationships
- `location-influence.ts` - Hex-based influence propagation
- `production-visualization.ts` - UI helpers for production displays
