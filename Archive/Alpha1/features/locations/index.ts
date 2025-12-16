/**
 * Locations Feature - Building production, faction integration, and influence systems
 */

// ============================================================================
// Building Production
// ============================================================================

export type {
    BuildingCategory,
    BuildingJobType,
    BuildingTemplate,
    BuildingProduction,
} from "./building-production";

export {
    BUILDING_TEMPLATES,
    canPerformJob,
    hasWorkerCapacity,
    calculateProductionRate,
    calculateMaintenanceCost,
    getBuildingBonuses,
    isBuildingLocation,
    getBuildingType,
    initializeBuildingProduction,
    degradeBuilding,
    calculateRepairCosts,
    repairBuilding,
} from "./building-production";

// ============================================================================
// Faction Integration
// ============================================================================

export type {
    LocationFactionLink,
} from "./location-faction-integration";

export {
    getFactionLocations,
    getNPCLocations,
    getMembersAtLocation,
    locationSupportsJob,
    locationHasCapacity,
    assignMemberToLocation,
    removeMemberFromLocation,
    calculateLocationProduction,
    applyBuildingBonuses,
    getFactionLocationSummary,
    validateLocationReferences,
} from "./location-faction-integration";

// ============================================================================
// Location Influence
// ============================================================================

export type {
    HexCoordinate,
    InfluenceArea,
    InfluenceConfig,
} from "./location-influence";

export {
    parseCoordinates,
    calculateInfluenceArea,
    getInfluenceStrengthAt,
    getInfluencedHexes,
    mergeInfluenceAreas,
    getInfluencingLocations,
} from "./location-influence";

// ============================================================================
// Production Visualization
// ============================================================================

export {
    createProgressBar,
    getConditionColor,
    getCapacityColor,
    createProductionRateVisualization,
    createWorkerEfficiencyVisualization,
    createResourceVisualization,
    createProductionDashboard,
} from "./production-visualization";
