// src/workmodes/cartographer/editor/tools/feature-brush/feature-brush-core.ts
// Core logic for drawing terrain features as paths across multiple corners

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-feature-brush");
import { PerformanceTimer } from "@services/performance";
import { adjacentCorners } from "@features/maps/rendering/core/rendering-hex-geometry";
import {
    getTerrainFeatureStore,
    generateFeatureId,
    type TerrainFeature,
    type TerrainFeatureType,
    type TerrainFeatureStyle,
    DEFAULT_FEATURE_STYLES,
} from "@features/maps";
import type { CornerCoord } from "@features/maps/rendering/core/rendering-hex-geometry";
import type { AxialCoord } from "@features/maps/rendering/rendering-types";

export type FeatureBrushState = {
    /** Current feature type being drawn */
    featureType: TerrainFeatureType;
    /** Path coordinates being drawn (corner-based) */
    path: CornerCoord[];
    /** Custom style overrides */
    style: Partial<TerrainFeatureStyle>;
    /** Optional feature name */
    name?: string;
    /** Optional feature description */
    description?: string;
    /** Whether we're currently drawing a path */
    isDrawing: boolean;
};

export type FeatureBrushMode = "draw" | "erase" | "edit";

export type FeatureBrushOptions = {
    mode: FeatureBrushMode;
    state: FeatureBrushState;
};

/**
 * Start drawing a new feature path
 */
export function startPath(state: FeatureBrushState, startCorner: CornerCoord): void {
    state.path = [startCorner];
    state.isDrawing = true;
    logger.info(`[feature-brush] Started drawing ${state.featureType} at ${startCorner.q},${startCorner.r} corner ${startCorner.corner}`);
}

/**
 * Add a corner coordinate to the current path
 * Returns false if the coordinate is already in the path (to prevent loops)
 */
export function addToPath(state: FeatureBrushState, corner: CornerCoord): boolean {
    // Check if corner already exists in path
    const exists = state.path.some(p =>
        p.q === corner.q && p.r === corner.r && p.corner === corner.corner
    );
    if (exists) {
        logger.warn(`[feature-brush] Corner ${corner.q},${corner.r}:${corner.corner} already in path, ignoring`);
        return false;
    }

    state.path.push(corner);
    logger.info(`[feature-brush] Added ${corner.q},${corner.r}:${corner.corner} to path (length: ${state.path.length})`);
    return true;
}

/**
 * Remove the last corner from the path (undo)
 */
export function removeLastFromPath(state: FeatureBrushState): CornerCoord | null {
    if (state.path.length === 0) return null;

    const removed = state.path.pop() || null;
    if (removed) {
        logger.info(`[feature-brush] Removed ${removed.q},${removed.r}:${removed.corner} from path (length: ${state.path.length})`);
    }

    return removed;
}

/**
 * Clear the current path
 */
export function clearPath(state: FeatureBrushState): void {
    state.path = [];
    state.isDrawing = false;
    logger.info(`[feature-brush] Cleared path`);
}

/**
 * Finish the current path and save it as a feature
 */
export async function finishPath(
    app: App,
    mapFile: TFile,
    state: FeatureBrushState
): Promise<TerrainFeature | null> {
    const timer = new PerformanceTimer("feature-brush-save");

    if (state.path.length < 1) {
        logger.warn(`[feature-brush] Cannot finish path with less than 1 corner`);
        timer.abort();
        return null;
    }

    const store = getTerrainFeatureStore(app, mapFile);

    // Merge custom style with defaults
    const defaultStyle = DEFAULT_FEATURE_STYLES[state.featureType];
    const finalStyle: TerrainFeatureStyle = {
        ...defaultStyle,
        ...state.style,
    };

    const feature: TerrainFeature = {
        id: generateFeatureId(state.featureType),
        type: state.featureType,
        path: {
            corners: [...state.path],
        },
        style: finalStyle,
        metadata: {
            name: state.name,
            description: state.description,
        },
    };

    try {
        store.add(feature);
        await store.save();
        logger.info(`[feature-brush] Saved ${state.featureType} feature with ${state.path.length} corners: ${feature.id}`);

        // Clear path after saving
        clearPath(state);

        timer.end();
        return feature;
    } catch (error) {
        timer.abort();
        logger.error(`[feature-brush] Failed to save feature`, error);
        throw error;
    }
}

/**
 * Erase a feature at the given coordinate
 */
export async function eraseFeatureAt(
    app: App,
    mapFile: TFile,
    coord: AxialCoord
): Promise<boolean> {
    const store = getTerrainFeatureStore(app, mapFile);
    const features = store.list();

    // Find features that contain this coordinate (corner-based format)
    const matchingFeatures = features.filter(f =>
        f.path.corners?.some(c => c.q === coord.q && c.r === coord.r)
    );

    if (matchingFeatures.length === 0) {
        logger.info(`[feature-brush] No features found at ${coord.q},${coord.r}`);
        return false;
    }

    // Erase all matching features (in case of overlapping features)
    for (const feature of matchingFeatures) {
        store.remove(feature.id);
        logger.info(`[feature-brush] Erased ${feature.type} feature: ${feature.id}`);
    }

    await store.save();
    return true;
}

/**
 * Get feature at coordinate (for editing or inspection)
 */
export function getFeatureAt(
    app: App,
    mapFile: TFile,
    coord: AxialCoord
): TerrainFeature | null {
    const store = getTerrainFeatureStore(app, mapFile);
    const features = store.list();

    // Find first feature that contains this coordinate (corner-based format)
    const feature = features.find(f =>
        f.path.corners?.some(c => c.q === coord.q && c.r === coord.r)
    );

    return feature || null;
}

/**
 * Create initial brush state
 */
export function createInitialState(): FeatureBrushState {
    return {
        featureType: "river",
        path: [],
        style: {},
        isDrawing: false,
    };
}

/**
 * Check if a corner is adjacent to the last corner in the path
 * (helps prevent accidental gaps in the path)
 */
export function isAdjacentToLast(state: FeatureBrushState, corner: CornerCoord): boolean {
    if (state.path.length === 0) return true;

    const last = state.path[state.path.length - 1];

    // Get all adjacent corners to the last corner
    const adjacent = adjacentCorners(last);

    // Check if the new corner is in the adjacent list
    return adjacent.some(adj =>
        adj.q === corner.q && adj.r === corner.r && adj.corner === corner.corner
    );
}
