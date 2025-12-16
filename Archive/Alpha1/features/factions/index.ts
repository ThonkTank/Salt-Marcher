// src/features/factions/index.ts
// Main feature export - Public API
//
// Simplified exports after radical cleanup.
// Only functions actually used by external consumers are exported.

// ============================================================================
// Domain Types
// ============================================================================

export type {
    SimulationTick,
    FactionSimulationResult,
    SimulationEvent,
} from "./simulation-types";

// ============================================================================
// Integration Layer (External API)
// ============================================================================

// Map & Calendar Integration - These are the ONLY externally used functions
export {
    syncFactionTerritoriesToAllMaps,
    syncFactionTerritoriesForMap,
    getFactionMembersAtHex,
    getAllFactionCamps,
    runDailyFactionSimulation,
} from "./faction-integration";

// Territory Claims
export {
    calculateFactionTerritoryClaims,
    calculateSingleFactionClaims,
    getClaimsForHex,
    resolveConflict,
} from "./faction-territory";
