// src/features/maps/state/terrain-feature-types.ts

import type { WritableStore } from "@services/state";

/**
 * Terrain Feature Types
 *
 * Defines all type definitions and interfaces for terrain features.
 * - Feature types and paths
 * - Styling configuration
 * - Store state interfaces
 * - Default styles
 * - Utility type guards
 */

/**
 * Terrain feature types
 */
export type TerrainFeatureType = "river" | "cliff" | "road" | "border" | "elevation-line";

/**
 * Path as series of hex OR corner coordinates with optional Bezier control points
 *
 * Supports two formats for backwards compatibility:
 * - hexes: Old format - path through hex centers, rendered along hex edges
 * - corners: New format - path through hex corners for precise control
 */
export interface TerrainFeaturePath {
    hexes?: Array<{ r: number; c: number }>;  // Old format (deprecated, for backwards compat)
    corners?: Array<{ r: number; c: number; corner: 0 | 1 | 2 | 3 | 4 | 5 }>;  // New format
    controlPoints?: Array<{ x: number; y: number }>;
}

/**
 * Style configuration for rendering features
 */
export interface TerrainFeatureStyle {
    color: string;
    width: number;
    dashArray?: string;
    opacity?: number;
}

/**
 * Terrain feature definition
 */
export interface TerrainFeature {
    id: string;
    type: TerrainFeatureType;
    path: TerrainFeaturePath;
    style: TerrainFeatureStyle;
    metadata?: {
        name?: string;
        description?: string;
        [key: string]: any;
    };
}

/**
 * Terrain feature store state
 */
export interface TerrainFeatureState {
    mapPath: string;
    loaded: boolean;
    features: Map<string, TerrainFeature>;
    version: number;
}

/**
 * Terrain feature store interface
 */
export interface TerrainFeatureStore {
    readonly state: WritableStore<TerrainFeatureState>;
    add(feature: TerrainFeature): void;
    update(id: string, updates: Partial<Omit<TerrainFeature, "id">>): boolean;
    remove(id: string): boolean;
    get(id: string): TerrainFeature | null;
    list(): TerrainFeature[];
    listByType(type: TerrainFeatureType): TerrainFeature[];
    clear(): void;
    load(): Promise<void>;
    save(): Promise<void>;
}

/**
 * Default style configurations for each feature type
 */
export const DEFAULT_FEATURE_STYLES: Record<TerrainFeatureType, TerrainFeatureStyle> = {
    river: {
        color: "#4A90E2",
        width: 3,
        opacity: 0.8,
    },
    cliff: {
        color: "#8B7355",
        width: 2,
        dashArray: "5,2",
        opacity: 0.9,
    },
    road: {
        color: "#D4A574",
        width: 2,
        dashArray: "8,4",
        opacity: 0.7,
    },
    border: {
        color: "#FF6B6B",
        width: 2,
        dashArray: "10,5",
        opacity: 0.6,
    },
    "elevation-line": {
        color: "#999999",
        width: 1,
        opacity: 0.4,
    },
};

/**
 * Generate a unique ID for a terrain feature
 */
export function generateFeatureId(type: TerrainFeatureType): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a feature uses hex-based path (old format)
 */
export function isHexBased(feature: TerrainFeature): boolean {
    return !!feature.path.hexes && !feature.path.corners;
}

/**
 * Check if a feature uses corner-based path (new format)
 */
export function isCornerBased(feature: TerrainFeature): boolean {
    return !!feature.path.corners;
}

/**
 * Get the path coordinates from a feature (regardless of format)
 *
 * @returns Array of coordinates (either hexes or corners)
 */
export function getPathCoordinates(feature: TerrainFeature): Array<any> {
    if (feature.path.corners) {
        return feature.path.corners;
    }
    return feature.path.hexes || [];
}
