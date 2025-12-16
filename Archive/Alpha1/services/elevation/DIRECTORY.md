# Elevation Service

**Zweck**: Terrain elevation algorithms for hex-based maps - field generation, contours, hillshade, flow analysis, river networks, and watersheds.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| index.ts | Barrel exports for all elevation algorithms |
| types.ts | Shared type definitions (ControlPoint, ContourPath, FlowDirectionMap, etc.) |
| elevation-field.ts | ElevationField class - interpolates elevation from sparse control points |
| contours.ts | Marching Squares contour line generation |
| hillshade.ts | Hillshade calculation with slope/aspect grids |
| flow-analysis.ts | Flow direction + accumulation (merged from flow-direction + flow-accumulation) |
| river-extractor.ts | River network extraction from flow accumulation data |
| watershed.ts | Watershed delineation from pour points |
| sun-position.ts | Solar/lunar position calculation for lighting |

## Verbindungen

- **Verwendet von**: `@features/maps/elevation/` (contour-renderer, hillshade-renderer), `@features/maps/state/elevation-store`
- **Abhängig von**: `@geometry` (AxialCoord, coordToKey, neighbors), `@app/configurable-logger`

## Public API

```typescript
import {
    // Elevation Field
    ElevationField,
    type ControlPoint,
    type ElevationFieldConfig,

    // Contours
    generateContours,
    type ContourPath,
    type ContourConfig,

    // Hillshade
    calculateHillshade,
    calculateSlopeGrid,
    calculateAspectGrid,
    type HillshadeConfig,

    // Flow Analysis
    calculateFlowDirections,
    calculateFlowAccumulation,
    traceFlowPath,
    type FlowDirectionMap,
    type FlowAccumulationMap,

    // Rivers
    extractRiverNetwork,
    type RiverNetwork,
    type RiverSegment,

    // Watersheds
    calculateWatersheds,
    type WatershedMap
} from "@services/elevation";
```

## Verwendungsbeispiel

```typescript
import { ElevationField, generateContours, calculateHillshade } from "@services/elevation";

// Create elevation field from control points
const field = new ElevationField(controlPoints, { interpolationMethod: "idw" });
const elevation = field.getElevation({ q: 5, r: 3 });

// Generate contour lines
const contours = generateContours(elevationGrid, { interval: 100, minElevation: 0, maxElevation: 1000 });

// Calculate hillshade
const shading = calculateHillshade(elevationGrid, { sunAzimuth: 315, sunAltitude: 45 });
```

## Migration Notes

Extracted from `src/features/maps/elevation/` in Wave 4 (2025-12-01):
- Algorithm files moved to services layer
- Renderers remain in features/maps/elevation/ (have Maps-specific dependencies)
- `flow-direction.ts` + `flow-accumulation.ts` merged into `flow-analysis.ts`
