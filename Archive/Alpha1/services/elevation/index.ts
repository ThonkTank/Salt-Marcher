// src/services/elevation/index.ts
// Central elevation service for terrain elevation algorithms
//
// Provides comprehensive elevation analysis tools for hex-based maps:
// - Elevation field generation from sparse control points
// - Contour line generation (Marching Squares)
// - Hillshade calculation for lighting effects
// - Flow direction and accumulation analysis
// - River network extraction
// - Watershed delineation
// - Solar/lunar position calculation

// ============================================================================
// Types
// ============================================================================

export type {
	// Elevation Field
	ControlPoint,
	ElevationFieldConfig,
	// Contours
	ContourPath,
	ContourConfig,
	// Hillshade
	HillshadeConfig,
	// Flow Analysis
	FlowDirectionMap,
	FlowDirectionConfig,
	FlowAccumulationMap,
	FlowAccumulationConfig,
	// River Extraction
	RiverSegment,
	RiverNetwork,
	RiverExtractionConfig,
	// Watersheds
	WatershedMap,
	WatershedConfig
} from "./elevation-types";

// ============================================================================
// Elevation Field
// ============================================================================

export { ElevationField } from "./elevation-field";

// ============================================================================
// Contour Generation
// ============================================================================

export { generateContours } from "./contours";

// ============================================================================
// Hillshade Calculation
// ============================================================================

export {
	calculateHillshade,
	calculateSlopeGrid,
	calculateAspectGrid
} from "./hillshade";

// ============================================================================
// Flow Analysis
// ============================================================================

export {
	// Flow Direction
	calculateFlowDirections,
	getDownstreamNeighbor,
	traceFlowPath,
	getFlowDirectionStats,
	// Flow Accumulation
	calculateFlowAccumulation,
	getFlowAccumulationStats,
	getHexesAboveThreshold,
	calculateRiverWidth
} from "./flow-analysis";

// ============================================================================
// River Extraction
// ============================================================================

export {
	extractRiverNetwork,
	getRiverNetworkStats
} from "./river-extractor";

// ============================================================================
// Watersheds
// ============================================================================

export {
	calculateWatersheds,
	getWatershedStats,
	getHexesInWatershed
} from "./watershed";

// ============================================================================
// Solar/Lunar Position
// ============================================================================

export {
	calculateSunPosition,
	calculateMoonPosition,
	getMoonIllumination,
	getHillshadeConfig
} from "./sun-position";
