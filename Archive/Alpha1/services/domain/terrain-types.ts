/**
 * Terrain Domain Types
 *
 * Shared terrain type definitions used across features and workmodes.
 * These are pure type definitions without implementation logic.
 *
 * @module services/domain/terrain-types
 */

/**
 * Terrain type - Physical ground type
 */
export type TerrainType = "plains" | "hills" | "mountains";

/**
 * Flora type - Vegetation coverage
 */
export type FloraType = "dense" | "medium" | "field" | "barren";

/**
 * Moisture Level System
 *
 * 10 discrete moisture categories from arid to aquatic.
 * Each level has distinct visual representation and creature associations.
 */
export type MoistureLevel =
    | "desert"       // 0.00-0.10: Extremely arid (Sahara, Death Valley)
    | "dry"          // 0.10-0.20: Low moisture (steppe, savanna)
    | "lush"         // 0.20-0.40: Fertile, well-watered (grasslands, farmland)
    | "marshy"       // 0.40-0.60: Waterlogged soil (wetlands, bogs)
    | "swampy"       // 0.60-0.70: Standing water patches (bayou, swamp)
    | "ponds"        // 0.70-0.75: Small water bodies scattered
    | "lakes"        // 0.75-0.80: Medium water bodies
    | "large_lake"   // 0.80-0.85: Large continuous lake
    | "sea"          // 0.85-0.95: Saltwater/ocean
    | "flood_plains";// 0.95-1.00: Seasonal flooding (river deltas)

/**
 * Icon definition for terrain/flora rendering
 */
export interface IconDefinition {
    emoji: string;      // Unicode emoji placeholder (for development)
    svg: string;        // SVG symbol ID (for production rendering)
    label: string;      // Human-readable label (German UI)
}
