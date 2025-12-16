// src/features/maps/overlay/index.ts
// Generic overlay system exports
//
// Central export point for overlay manager and layer factories.
// Import from here to use the overlay system.

export type {
    SimpleOverlayLayer,
    AnyOverlayLayer,
    OverlayManager,
    OverlayManagerConfig,
    OverlayRenderData,
    OverlayRenderFill,
    OverlayRenderSVG,
} from "./overlay-types";

// Layer utilities (consolidated from layer-utils, layer-helpers, overlay-coords)
export {
    // Constants
    SVG_NS,
    // Coordinate normalization
    normalizeCoord,
    // Opacity utilities
    clampOpacity,
    deviationOpacity,
    severityOpacity,
    // String/color normalization
    normalizeColor,
    normalizeString,
    // Viewport bounds
    calculateBounds,
    coordInBounds,
    type ViewportBounds,
    // Coordinate generation
    getHexCoordsFromTiles,
    getHexCoordsWithFallback,
} from "./layer-utils";

export { createOverlayManager } from "./overlay-manager";

// Gradient overlay factory and implementations
export {
    createGradientOverlayLayer,
    createElevationOverlayLayer,
    createFertilityOverlayLayer,
    createGroundwaterOverlayLayer,
    type GradientLayerConfig,
} from "./layers/gradient-overlay-layer";

// Territory layers (faction + location influence)
export { createFactionOverlayLayer, createLocationInfluenceLayer } from "./layers/territory-layers";

// Marker layers (location markers + building indicators)
export { createLocationMarkerLayer, createBuildingIndicatorLayer, getBuildingConditionClass } from "./layers/marker-layers";
export type { BuildingConditionClass } from "./layers/marker-layers";
export { createWeatherOverlayLayer, getWeatherEmoji, getWeatherDescription } from "./layers/weather-overlay-layer";
export { createTerrainFeatureLayer, createAllTerrainFeatureLayers } from "./layers/terrain-feature-layer";
// NOTE: Moisture visualization migrated from overlay system to icon system (see scene/scene.ts)
export { createClimateOverlayLayer } from "./layers/climate-overlay-layer";
export type { ClimateChannel } from "./layers/climate-overlay-layer";
export { createRainShadowOverlayLayer } from "./layers/rain-shadow-overlay-layer";
export type { RainShadowOverlayState } from "./layers/rain-shadow-overlay-layer";
