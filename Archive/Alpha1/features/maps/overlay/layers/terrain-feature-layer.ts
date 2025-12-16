// src/features/maps/overlay/layers/terrain-feature-layer.ts
// Terrain features overlay layer for hex map rendering
//
// Renders multi-hex features like rivers, cliffs, roads, borders, and elevation lines.
// Features are drawn as SVG paths spanning multiple hexes.

import type { App, TFile } from "obsidian";
import { axialToCanvasPixel } from "@geometry";
import { cornerToPixel, getEdgeMidpoint } from "../../rendering/core/rendering-hex-geometry";
import {
    getTerrainFeatureStore,
    type TerrainFeatureState,
    type TerrainFeature,
    type TerrainFeatureType,
} from "../../state/terrain-feature-store";
import type { HexCoord } from "../../rendering/rendering-types";
import type { SimpleOverlayLayer, OverlayRenderData } from "../types";
import { LAYER_PRIORITY } from "../layer-registry";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Feature type to priority mapping
 * Higher priority = rendered on top
 */
const FEATURE_PRIORITIES: Record<TerrainFeatureType, number> = {
    "elevation-line": LAYER_PRIORITY.ELEVATION_LINE,  // Background contours
    "river": LAYER_PRIORITY.RIVER,                    // Water features
    "road": LAYER_PRIORITY.ROAD,                      // Travel routes
    "cliff": LAYER_PRIORITY.CLIFF,                    // Impassable terrain
    "border": LAYER_PRIORITY.INFLUENCE,               // Political boundaries (highest)
};

/**
 * Create terrain feature overlay layer
 *
 * Renders terrain features as SVG paths connecting multiple hexes.
 * Unlike hex-based overlays, this layer creates path elements that span the map.
 *
 * Priority: 6-10 (depends on feature type)
 * - elevation-line: 6 (background)
 * - river: 7
 * - road: 8
 * - cliff: 9
 * - border: 10 (foreground)
 *
 * @example
 * ```typescript
 * const featureLayer = createTerrainFeatureLayer(app, mapFile, radius, base, padding);
 * overlayManager.register(featureLayer);
 * ```
 */
export function createTerrainFeatureLayer(
    app: App,
    mapFile: TFile,
    radius: number,
    base: HexCoord,
    padding: number,
    featureType: TerrainFeatureType
): SimpleOverlayLayer {
    const store = getTerrainFeatureStore(app, mapFile);

    // Helper to get pixel center from axial coordinate
    const centerOf = (coord: HexCoord): { cx: number; cy: number } => {
        const { x, y } = axialToCanvasPixel(coord, radius, base, padding);
        return { cx: x, cy: y };
    };

    /**
     * Create SVG path element for a feature
     */
    const createFeaturePath = (feature: TerrainFeature): SVGPathElement => {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("class", `sm-terrain-feature sm-terrain-${feature.type}`);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", feature.style.color);
        path.setAttribute("stroke-width", String(feature.style.width));
        path.setAttribute("pointer-events", "visibleStroke");

        if (feature.style.dashArray) {
            path.setAttribute("stroke-dasharray", feature.style.dashArray);
        }

        if (feature.style.opacity !== undefined) {
            path.setAttribute("opacity", String(feature.style.opacity));
        }

        // Build path data from hex coordinates
        const pathData = buildPathData(feature);
        path.setAttribute("d", pathData);

        // Store feature ID for updates
        path.dataset.featureId = feature.id;

        return path;
    };

    /**
     * Build SVG path data string from feature path
     *
     * Supports two formats:
     * - Corner-based (new): Direct lines between corner coordinates
     * - Hex-based (old): Lines along hex edge midpoints between hex pairs
     */
    const buildPathData = (feature: TerrainFeature): string => {
        // Corner-based format (new)
        if (feature.path.corners && feature.path.corners.length > 0) {
            const points = feature.path.corners.map(corner => cornerToPixel(corner, radius, base, padding));

            if (points.length === 0) return "";
            if (points.length === 1) {
                // Single point - draw a small circle
                return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
            }

            // Build path connecting corner points
            let pathData = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                pathData += ` L ${points[i].x} ${points[i].y}`;
            }

            return pathData;
        }

        // Hex-based format (old - backwards compatibility)
        if (!feature.path.hexes || feature.path.hexes.length === 0) return "";

        // For a single hex, draw nothing (need at least 2 hexes for an edge)
        if (feature.path.hexes.length === 1) return "";

        // Calculate edge midpoints between consecutive hex pairs
        const edgeMidpoints: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < feature.path.hexes.length - 1; i++) {
            const hex1 = feature.path.hexes[i];
            const hex2 = feature.path.hexes[i + 1];
            const center1 = centerOf(hex1);

            const edgeMidpoint = getEdgeMidpoint(hex1, hex2, center1.cx, center1.cy, radius);

            // If hexes are not adjacent, fall back to simple midpoint between centers
            if (edgeMidpoint === null) {
                const center2 = centerOf(hex2);
                edgeMidpoints.push({
                    x: (center1.cx + center2.cx) / 2,
                    y: (center1.cy + center2.cy) / 2
                });
            } else {
                edgeMidpoints.push(edgeMidpoint);
            }
        }

        // Build path connecting edge midpoints
        let pathData = `M ${edgeMidpoints[0].x} ${edgeMidpoints[0].y}`;

        for (let i = 1; i < edgeMidpoints.length; i++) {
            pathData += ` L ${edgeMidpoints[i].x} ${edgeMidpoints[i].y}`;
        }

        // If controlPoints are provided, use quadratic/cubic Bezier curves
        if (feature.path.controlPoints && feature.path.controlPoints.length > 0) {
            // TODO: Implement Bezier curve generation for smoother curves
            // For now, fallback to simple lines
        }

        return pathData;
    };

    /**
     * Update existing feature path element
     */
    const updateFeaturePath = (element: SVGElement, _coord: HexCoord) => {
        const featureId = element.dataset.featureId;
        if (!featureId) return;

        const feature = store.get(featureId);
        if (!feature) return;

        // Update style attributes
        element.setAttribute("stroke", feature.style.color);
        element.setAttribute("stroke-width", String(feature.style.width));

        if (feature.style.dashArray) {
            element.setAttribute("stroke-dasharray", feature.style.dashArray);
        } else {
            element.removeAttribute("stroke-dasharray");
        }

        if (feature.style.opacity !== undefined) {
            element.setAttribute("opacity", String(feature.style.opacity));
        } else {
            element.removeAttribute("opacity");
        }

        // Rebuild path data (in case hexes changed)
        const pathData = buildPathData(feature);
        element.setAttribute("d", pathData);
    };

    // We only render features of the specified type
    // This allows multiple terrain-feature-layers with different priorities
    const featuresOfType = () => store.listByType(featureType);

    return {
        id: `terrain-features-${featureType}`,
        name: `Terrain Features: ${featureType}`,
        priority: FEATURE_PRIORITIES[featureType],

        subscribe(callback: () => void): () => void {
            return store.state.subscribe(callback);
        },

        getRenderData(coord: HexCoord): OverlayRenderData | null {
            // Check if any feature of our type includes this coordinate
            const features = featuresOfType();
            const relevantFeature = features.find(f => {
                // Check hex-based features
                if (f.path.hexes) {
                    return f.path.hexes.some(h => h.q === coord.q && h.r === coord.r);
                }
                // Check corner-based features (check if any corner belongs to this hex)
                if (f.path.corners) {
                    return f.path.corners.some(c => c.q === coord.q && c.r === coord.r);
                }
                return false;
            });

            if (!relevantFeature) return null;

            // For terrain features, we render the entire path, not per-hex
            // So we only return render data for the first coordinate in the path
            let firstCoord: { q: number; r: number } | null = null;
            if (relevantFeature.path.corners && relevantFeature.path.corners.length > 0) {
                firstCoord = relevantFeature.path.corners[0];
            } else if (relevantFeature.path.hexes && relevantFeature.path.hexes.length > 0) {
                firstCoord = relevantFeature.path.hexes[0];
            }

            if (!firstCoord || firstCoord.q !== coord.q || firstCoord.r !== coord.r) {
                return null; // Not the first coordinate, skip
            }

            return {
                type: "svg",
                createElement: () => createFeaturePath(relevantFeature),
                updateElement: updateFeaturePath,
                metadata: {
                    label: relevantFeature.metadata?.name || relevantFeature.type,
                    tooltip: relevantFeature.metadata?.description || `${relevantFeature.type} feature`,
                    featureId: relevantFeature.id,
                    featureType: relevantFeature.type,
                },
            };
        },

        getCoordinates(): readonly HexCoord[] {
            // Return all coordinates that have features
            const features = featuresOfType();
            const coords: HexCoord[] = [];

            for (const feature of features) {
                // Return the first coordinate (hex or corner)
                if (feature.path.corners && feature.path.corners.length > 0) {
                    coords.push({ q: feature.path.corners[0].q, r: feature.path.corners[0].r });
                } else if (feature.path.hexes && feature.path.hexes.length > 0) {
                    coords.push(feature.path.hexes[0]);
                }
            }

            return coords;
        },

        destroy(): void {
            // No cleanup needed - OverlayManager handles DOM cleanup
        },
    };
}

/**
 * Create all terrain feature layers (one per feature type)
 *
 * This creates 5 separate layers with different priorities:
 * - elevation-line (priority 6)
 * - river (priority 7)
 * - road (priority 8)
 * - cliff (priority 9)
 * - border (priority 10)
 *
 * @example
 * ```typescript
 * const layers = createAllTerrainFeatureLayers(app, mapFile, radius, base, padding);
 * layers.forEach(layer => overlayManager.register(layer));
 * ```
 */
export function createAllTerrainFeatureLayers(
    app: App,
    mapFile: TFile,
    radius: number,
    base: HexCoord,
    padding: number
): SimpleOverlayLayer[] {
    const featureTypes: TerrainFeatureType[] = [
        "elevation-line",
        "river",
        "road",
        "cliff",
        "border",
    ];

    return featureTypes.map(type =>
        createTerrainFeatureLayer(app, mapFile, radius, base, padding, type)
    );
}
