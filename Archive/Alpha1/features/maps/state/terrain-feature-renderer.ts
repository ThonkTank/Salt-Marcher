// src/features/maps/state/terrain-feature-renderer.ts

import type { TerrainFeature } from "./terrain-feature-types";

/**
 * Terrain Feature Renderer
 *
 * Provides rendering utilities for terrain features.
 * - Path format conversions
 * - Feature validation for rendering
 * - Coordinate transformations
 * - Format migration (hex to corner)
 */

/**
 * Convert hex-based feature to corner-based feature
 *
 * Strategy: Convert each hex edge midpoint to the nearest corner
 * This preserves the visual appearance while switching to corner format
 *
 * @param feature Feature with hex-based path
 * @returns Feature with corner-based path
 */
export function convertHexToCorner(feature: TerrainFeature): TerrainFeature {
    if (!feature.path.hexes || feature.path.hexes.length === 0) {
        return feature;
    }

    // For each hex edge, find the 2 corners that form that edge
    // Then average them to get the edge midpoint corner
    const corners: Array<{ r: number; c: number; corner: 0 | 1 | 2 | 3 | 4 | 5 }> = [];

    for (let i = 0; i < feature.path.hexes.length - 1; i++) {
        const hex1 = feature.path.hexes[i];
        const hex2 = feature.path.hexes[i + 1];

        // Determine direction from hex1 to hex2
        const dr = hex2.r - hex1.r;
        const dq = hex2.q - hex1.q;

        // Map direction to corners (based on odd-r neighbor directions)
        // This is a simplified heuristic - may need refinement
        const isOdd = hex1.r % 2 === 1;

        let cornerIndex: 0 | 1 | 2 | 3 | 4 | 5 = 0;

        // Direction mapping for even rows
        if (!isOdd) {
            if (dr === 0 && dq === 1) cornerIndex = 1;      // E  → corner 1
            else if (dr === -1 && dq === 0) cornerIndex = 0; // NE → corner 0
            else if (dr === -1 && dq === -1) cornerIndex = 5; // NW → corner 5
            else if (dr === 0 && dq === -1) cornerIndex = 4;  // W  → corner 4
            else if (dr === 1 && dq === -1) cornerIndex = 3;  // SW → corner 3
            else if (dr === 1 && dq === 0) cornerIndex = 2;   // SE → corner 2
        } else {
            // Direction mapping for odd rows
            if (dr === 0 && dq === 1) cornerIndex = 1;      // E  → corner 1
            else if (dr === -1 && dq === 1) cornerIndex = 0; // NE → corner 0
            else if (dr === -1 && dq === 0) cornerIndex = 5;  // NW → corner 5
            else if (dr === 0 && dq === -1) cornerIndex = 4;  // W  → corner 4
            else if (dr === 1 && dq === 0) cornerIndex = 3;   // SW → corner 3
            else if (dr === 1 && dq === 1) cornerIndex = 2;   // SE → corner 2
        }

        corners.push({
            q: hex1.q,
            r: hex1.r,
            corner: cornerIndex,
        });
    }

    // Add final corner from last hex
    if (feature.path.hexes.length > 0) {
        const lastHex = feature.path.hexes[feature.path.hexes.length - 1];
        corners.push({
            q: lastHex.q,
            r: lastHex.r,
            corner: 2,  // Default to corner 2 (arbitrary choice)
        });
    }

    return {
        ...feature,
        path: {
            corners,
            controlPoints: feature.path.controlPoints,
        },
    };
}

/**
 * Validate feature for rendering
 *
 * Checks that feature has valid path and style
 */
export function validateFeatureForRendering(feature: TerrainFeature): boolean {
    if (!feature || !feature.path) {
        return false;
    }

    // Must have either hexes or corners
    if (!feature.path.hexes && !feature.path.corners) {
        return false;
    }

    // Hexes must be non-empty
    if (feature.path.hexes && feature.path.hexes.length === 0) {
        return false;
    }

    // Corners must be non-empty
    if (feature.path.corners && feature.path.corners.length === 0) {
        return false;
    }

    // Must have valid style
    if (!feature.style || !feature.style.color || !feature.style.width) {
        return false;
    }

    return true;
}

/**
 * Get rendering hints for a feature
 */
export interface FeatureRenderingHints {
    isLegacy: boolean;  // Uses old hex format
    needsMigration: boolean;  // Should be migrated to corner format
    strokeDasharray: string | null;
    opacity: number;
}

export function getRenderingHints(feature: TerrainFeature): FeatureRenderingHints {
    const isLegacy = !!feature.path.hexes && !feature.path.corners;

    return {
        isLegacy,
        needsMigration: isLegacy,
        strokeDasharray: feature.style.dashArray || null,
        opacity: feature.style.opacity ?? 1.0,
    };
}
