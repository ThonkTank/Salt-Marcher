/**
 * Public type definitions for Locations feature
 *
 * Consolidates all public types from the locations feature into a single export.
 * This file serves as the type interface for external consumers.
 */

// ============================================================================
// Building Production Types
// ============================================================================

export type {
	BuildingCategory,
	BuildingJobType,
	BuildingTemplate,
	BuildingProduction,
} from "./building-production";

// ============================================================================
// Faction Integration Types
// ============================================================================

export type {
	LocationFactionLink,
} from "./location-faction-integration";

// ============================================================================
// Influence System Types
// ============================================================================

export type {
	HexCoordinate,
	InfluenceArea,
	InfluenceConfig,
} from "./location-influence";
