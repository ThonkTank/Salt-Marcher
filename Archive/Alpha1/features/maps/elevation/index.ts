// src/features/maps/elevation/index.ts
// Central exports for elevation system
//
// Re-exports from @services/elevation for backwards compatibility
// Local renderers (contour-renderer, hillshade-renderer) remain in features/maps/elevation

// Re-export from @services/elevation (algorithms)
export {
	ElevationField,
	type ControlPoint,
	type ElevationFieldConfig,
	generateContours,
	type ContourConfig,
	type ContourPath,
	calculateHillshade,
	calculateSlopeGrid,
	calculateAspectGrid,
	type HillshadeConfig,
	calculateSunPosition,
	calculateMoonPosition,
	getMoonIllumination,
	getHillshadeConfig,
} from "@services/elevation";

// Export from local data layer (elevation-repository)
export {
	loadElevationJSON,
	saveElevationJSON,
	deleteElevationJSON,
	hasElevationJSON,
	getElevationJSONPath,
	createEmptyElevationJSON,
	parseElevationJSON,
	serializeElevationJSON,
	validateControlPoint,
	type ElevationJSON,
} from "../data/elevation-repository";

// Export from local state layer (elevation-store)
export {
	getElevationStore,
	clearElevationStore,
	clearAllElevationStores,
	type ElevationStore,
	type ElevationStoreState,
} from "../state/elevation-store";

// Export local renderers (stay in features/maps/elevation)
export {
	ContourRenderer,
	getContourRenderer,
	clearContourRenderer,
	clearAllContourRenderers,
	type ContourStyle,
} from "./contour-renderer";

export {
	HillshadeRenderer,
	getHillshadeRenderer,
	clearHillshadeRenderer,
	clearAllHillshadeRenderers,
	type HillshadeStyle,
} from "./hillshade-renderer";
