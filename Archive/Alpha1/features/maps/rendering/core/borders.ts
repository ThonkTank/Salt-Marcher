// src/features/maps/rendering/core/borders.ts
// Consolidated border rendering system: detection, rendering, fills, and management
//
// Merged from:
// - border-detection.ts - Border detection and area analysis
// - border-renderer.ts - SVG rendering for borders and labels
// - area-fill-renderer.ts - SVG rendering for area fills
// - border-manager.ts - Border and label rendering management
// - debounced-border-updater.ts - Debounced border updates

import { configurableLogger } from "@services/logging/configurable-logger";
import { coordToKey } from "@geometry";
import { neighbors } from "@geometry";
import { axialToCanvasPixel } from "@geometry";
import type { AxialCoord } from "@geometry";
import type { TileData } from "../../data/tile-repository";
import type { AreaType } from "@services/domain";
import { PerformanceTimer } from "@services/performance";

const logger = configurableLogger.forModule("border-manager");

// ============================================================================
// Types
// ============================================================================

/**
 * Point in screen coordinates
 */
export type Point = { x: number; y: number };

/**
 * SVG path segment for border rendering
 */
export type BorderEdge = {
    from: Point;
    to: Point;
};

/**
 * Border path for a single area
 */
export type BorderPath = {
    areaValue: string;
    edges: BorderEdge[];
    color?: string; // Hex color from entity (#RRGGBB), fallback to #000000
};

/**
 * Area metadata including centroid for label placement
 */
export type AreaInfo = {
    areaValue: string;
    coords: AxialCoord[];
    centroid: Point;
};

/**
 * Color lookup function - returns hex color for area value
 * Supports both sync and async lookups
 */
export type ColorLookup = (areaValue: string) => string | undefined | Promise<string | undefined>;

/**
 * Border manager configuration
 */
export type BorderManagerConfig = {
    svg: SVGSVGElement;
    contentG: SVGGElement;
    hexRadiusPx: number;
    areaType: AreaType;
    base: AxialCoord;
    padding: number;
};

/**
 * Border manager handle for controlling border rendering
 */
export type BorderManagerHandle = {
    update(tiles: Map<string, TileData>, colorLookup?: ColorLookup): Promise<void>;
    clear(): void;
    destroy(): void;
    setAreaType(areaType: AreaType): void;
    setBordersVisible(visible: boolean): void;
    setLabelsVisible(visible: boolean): void;
    setFillsVisible(visible: boolean): void;
};

// ============================================================================
// Border Detection
// ============================================================================

/**
 * Find all contiguous areas for a given area type (region or faction)
 * Returns array of area infos, each containing coordinates and centroid
 */
export function findContiguousAreas(
    tiles: Map<string, TileData>,
    areaType: AreaType,
    hexRadiusPx: number,
    base: AxialCoord,
    padding: number
): AreaInfo[] {
    const visited = new Set<string>();
    const areas: AreaInfo[] = [];

    for (const [key, tile] of tiles) {
        const areaValue = areaType === 'region' ? tile.region : tile.faction;

        // Skip if no area value or already visited
        if (!areaValue || visited.has(key)) continue;

        // Parse coordinate from key
        const [qStr, rStr] = key.split(',');
        const startCoord: AxialCoord = { q: parseInt(qStr), r: parseInt(rStr) };

        // Flood fill to find all connected tiles with same area value
        const areaCoords: AxialCoord[] = [];
        const queue: AxialCoord[] = [startCoord];
        const seen = new Set<string>([key]);

        while (queue.length > 0) {
            const current = queue.shift()!;
            const currentKey = coordToKey(current);

            if (visited.has(currentKey)) continue;
            visited.add(currentKey);

            const currentTile = tiles.get(currentKey);
            const currentValue = areaType === 'region' ? currentTile?.region : currentTile?.faction;

            if (currentValue !== areaValue) continue;

            areaCoords.push(current);

            // Check all neighbors
            for (const neighbor of neighbors(current)) {
                const neighborKey = coordToKey(neighbor);
                if (seen.has(neighborKey)) continue;
                seen.add(neighborKey);

                const neighborTile = tiles.get(neighborKey);
                const neighborValue = areaType === 'region' ? neighborTile?.region : neighborTile?.faction;

                if (neighborValue === areaValue) {
                    queue.push(neighbor);
                }
            }
        }

        // Calculate centroid
        const centroid = calculateCentroid(areaCoords, hexRadiusPx, base, padding);

        areas.push({
            areaValue,
            coords: areaCoords,
            centroid,
        });
    }

    return areas;
}

/**
 * Calculate geometric center (centroid) of hex coordinates
 * Returns point in screen coordinates
 */
export function calculateCentroid(coords: AxialCoord[], hexRadiusPx: number, base: AxialCoord, padding: number): Point {
    if (coords.length === 0) {
        return { x: 0, y: 0 };
    }

    // Convert hex coords to pixel coords and average
    let sumX = 0;
    let sumY = 0;

    for (const coord of coords) {
        const point = axialToCanvasPixel(coord, hexRadiusPx, base, padding);
        sumX += point.x;
        sumY += point.y;
    }

    return {
        x: sumX / coords.length,
        y: sumY / coords.length,
    };
}

/**
 * Trace borders between different areas
 * Returns array of border paths, one per unique area value
 */
export function traceBorders(
    tiles: Map<string, TileData>,
    areaType: AreaType,
    hexRadiusPx: number,
    base: AxialCoord,
    padding: number
): BorderPath[] {
    const bordersByArea = new Map<string, BorderEdge[]>();

    for (const [key, tile] of tiles) {
        const areaValue = areaType === 'region' ? tile.region : tile.faction;
        if (!areaValue) continue;

        const [qStr, rStr] = key.split(',');
        const coord: AxialCoord = { q: parseInt(qStr), r: parseInt(rStr) };

        // Check each neighbor
        const neighborCoords = neighbors(coord);
        for (let i = 0; i < neighborCoords.length; i++) {
            const neighbor = neighborCoords[i];
            const neighborKey = coordToKey(neighbor);
            const neighborTile = tiles.get(neighborKey);
            const neighborValue = areaType === 'region' ? neighborTile?.region : neighborTile?.faction;

            // Border exists if neighbor has different value (or no value)
            if (neighborValue !== areaValue) {
                // Calculate edge between this hex and neighbor
                const edge = calculateHexEdge(coord, i, hexRadiusPx, base, padding);

                if (!bordersByArea.has(areaValue)) {
                    bordersByArea.set(areaValue, []);
                }
                bordersByArea.get(areaValue)!.push(edge);
            }
        }
    }

    // Convert to BorderPath array
    const borderPaths: BorderPath[] = [];
    for (const [areaValue, edges] of bordersByArea) {
        borderPaths.push({ areaValue, edges });
    }

    return borderPaths;
}

/**
 * Calculate the edge between a hex and its neighbor
 * edgeIndex: 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE (axial neighbor order)
 */
function calculateHexEdge(coord: AxialCoord, edgeIndex: number, hexRadiusPx: number, base: AxialCoord, padding: number): BorderEdge {
    const center = axialToCanvasPixel(coord, hexRadiusPx, base, padding);

    // Hex corners (pointy-top orientation)
    // Corner 0 is at top, going clockwise
    const corners: Point[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2; // Start at top
        corners.push({
            x: center.x + hexRadiusPx * Math.cos(angle),
            y: center.y + hexRadiusPx * Math.sin(angle),
        });
    }

    // Edge connects two corners
    // Axial neighbor order is uniform: 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
    // Map edge index to corner indices (pointy-top hex, corner 0 at top)
    const edgeToCorners = [
        [1, 2], // E (right edge, corners 1-2)
        [0, 1], // NE (top-right edge, corners 0-1)
        [5, 0], // NW (top-left edge, corners 5-0)
        [4, 5], // W (left edge, corners 4-5)
        [3, 4], // SW (bottom-left edge, corners 3-4)
        [2, 3], // SE (bottom-right edge, corners 2-3)
    ];

    const [cornerA, cornerB] = edgeToCorners[edgeIndex];

    return {
        from: corners[cornerA],
        to: corners[cornerB],
    };
}

/**
 * Optimize border paths by merging collinear edges
 * (Future optimization - for now just return as-is)
 */
export function optimizeBorderPaths(borderPaths: BorderPath[]): BorderPath[] {
    // TODO: Merge collinear edges to reduce path complexity
    return borderPaths;
}

// ============================================================================
// Border Rendering
// ============================================================================

/**
 * Render border paths as SVG path elements
 * Returns SVG group element containing all border paths
 */
export function renderBorderPaths(
    container: SVGGElement,
    borderPaths: BorderPath[],
    options: {
        strokeWidth?: number;
        strokeColor?: string;
        opacity?: number;
    } = {}
): void {
    const {
        strokeWidth = 3,
        strokeColor = "#000000",
        opacity = 0.8,
    } = options;

    // Clear existing borders
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    for (const borderPath of borderPaths) {
        const { areaValue, edges, color } = borderPath;

        // Create SVG path element
        const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");

        // Build path data from edges
        const pathData = edgesToPathData(edges);
        pathElement.setAttribute("d", pathData);

        // Use entity color if available, otherwise fallback to default strokeColor
        const finalStrokeColor = color || strokeColor;

        // Style
        pathElement.setAttribute("fill", "none");
        pathElement.setAttribute("stroke", finalStrokeColor);
        pathElement.setAttribute("stroke-width", String(strokeWidth));
        pathElement.setAttribute("stroke-opacity", String(opacity));
        pathElement.setAttribute("stroke-linecap", "round");
        pathElement.setAttribute("stroke-linejoin", "round");

        // Data attributes for debugging
        pathElement.dataset.areaValue = areaValue;
        pathElement.dataset.edgeCount = String(edges.length);

        // CSS class for styling
        pathElement.classList.add("sm-area-border");

        container.appendChild(pathElement);
    }
}

/**
 * Convert array of border edges to SVG path data string
 */
function edgesToPathData(edges: BorderEdge[]): string {
    if (edges.length === 0) return "";

    const pathSegments: string[] = [];

    for (const edge of edges) {
        pathSegments.push(`M ${edge.from.x} ${edge.from.y}`);
        pathSegments.push(`L ${edge.to.x} ${edge.to.y}`);
    }

    return pathSegments.join(" ");
}

/**
 * Render area labels as SVG text elements
 * Returns SVG group element containing all labels
 */
export function renderAreaLabels(
    container: SVGGElement,
    areas: AreaInfo[],
    options: {
        fontSize?: number;
        fontFamily?: string;
        fillColor?: string;
        strokeColor?: string;
        strokeWidth?: number;
        minAreaSize?: number; // Hide labels for areas smaller than this
    } = {}
): void {
    const {
        fontSize = 14,
        fontFamily = "var(--font-interface)",
        fillColor = "#ffffff",
        strokeColor = "#000000",
        strokeWidth = 3,
        minAreaSize = 5,
    } = options;

    // Clear existing labels
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    for (const area of areas) {
        const { areaValue, coords, centroid } = area;

        // Skip small areas (label would be cramped)
        if (coords.length < minAreaSize) {
            continue;
        }

        // Create text element
        const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");

        textElement.setAttribute("x", String(centroid.x));
        textElement.setAttribute("y", String(centroid.y));
        textElement.setAttribute("text-anchor", "middle");
        textElement.setAttribute("dominant-baseline", "middle");
        textElement.setAttribute("font-size", `${fontSize}px`);
        textElement.setAttribute("font-family", fontFamily);
        textElement.setAttribute("font-weight", "bold");
        textElement.setAttribute("fill", fillColor);
        textElement.setAttribute("stroke", strokeColor);
        textElement.setAttribute("stroke-width", String(strokeWidth));
        textElement.setAttribute("stroke-linejoin", "round");
        textElement.setAttribute("paint-order", "stroke");
        textElement.setAttribute("pointer-events", "none"); // Don't block map interactions

        textElement.textContent = areaValue;

        // Data attributes
        textElement.dataset.areaValue = areaValue;
        textElement.dataset.hexCount = String(coords.length);

        // CSS class for styling
        textElement.classList.add("sm-area-label");

        container.appendChild(textElement);
    }
}

/**
 * Clear all borders from container
 */
export function clearBorders(container: SVGGElement): void {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

/**
 * Clear all labels from container
 */
export function clearLabels(container: SVGGElement): void {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

// ============================================================================
// Area Fill Rendering
// ============================================================================

/**
 * Render transparent fills for region/faction areas
 * Creates filled hex polygons for each area with 20% opacity
 */
export async function renderAreaFills(
    container: SVGGElement,
    areas: AreaInfo[],
    colorLookup: ColorLookup,
    hexRadiusPx: number,
    base: { q: number; r: number },
    padding: number,
    options: {
        opacity?: number;
        minAreaSize?: number;
    } = {}
): Promise<void> {
    const {
        opacity = 0.2,
        minAreaSize = 1,
    } = options;

    // Clear existing fills
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    for (const area of areas) {
        const { areaValue, coords } = area;

        // Skip small areas if configured
        if (coords.length < minAreaSize) {
            continue;
        }

        // Look up color for this area
        const color = await colorLookup(areaValue);
        if (!color) {
            // No color defined - skip fill (only borders/labels will show)
            continue;
        }

        // Render each hex in the area as a filled polygon
        for (const coord of coords) {
            const polygon = createHexPolygon(coord, hexRadiusPx, base, padding, color, opacity);
            polygon.dataset.areaValue = areaValue;
            polygon.classList.add("sm-area-fill");
            container.appendChild(polygon);
        }
    }
}

/**
 * Create SVG polygon element for a single hex with fill color
 */
function createHexPolygon(
    coord: { q: number; r: number },
    hexRadiusPx: number,
    base: { q: number; r: number },
    padding: number,
    fillColor: string,
    opacity: number
): SVGPolygonElement {
    // Calculate hex center in pixel coordinates
    const center = axialToCanvasPixel(coord, hexRadiusPx, base, padding);

    // Calculate hex corners (pointy-top orientation)
    const corners: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2; // Start at top
        corners.push({
            x: center.x + hexRadiusPx * Math.cos(angle),
            y: center.y + hexRadiusPx * Math.sin(angle),
        });
    }

    // Create polygon element
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");

    // Build points string
    const points = corners.map(p => `${p.x},${p.y}`).join(" ");
    polygon.setAttribute("points", points);

    // Style
    polygon.setAttribute("fill", fillColor);
    polygon.setAttribute("fill-opacity", String(opacity));
    polygon.setAttribute("stroke", "none");
    polygon.setAttribute("pointer-events", "none"); // Don't block map interactions

    return polygon;
}

/**
 * Clear all fills from container
 */
export function clearAreaFills(container: SVGGElement): void {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

// ============================================================================
// Border Manager
// ============================================================================

/**
 * Creates a border manager for rendering region/faction borders and labels
 */
export function createBorderManager(config: BorderManagerConfig): BorderManagerHandle {
    const { svg, contentG, hexRadiusPx, base, padding } = config;
    let areaType = config.areaType;
    let bordersVisible = true;
    let labelsVisible = true;
    let fillsVisible = true;

    // Create SVG layers for fills, borders, and labels (z-index order: fill < border < label)
    const fillLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    fillLayer.setAttribute("class", "sm-fill-layer");
    fillLayer.setAttribute("pointer-events", "none"); // Don't block map interactions

    const borderLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    borderLayer.setAttribute("class", "sm-border-layer");
    borderLayer.setAttribute("pointer-events", "none"); // Don't block map interactions

    const labelLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    labelLayer.setAttribute("class", "sm-label-layer");
    labelLayer.setAttribute("pointer-events", "none");

    // Insert layers inside contentG (camera-transformed group) so they move with the map
    // Layer order: fill (bottom) → border (middle) → label (top)
    contentG.appendChild(fillLayer);
    contentG.appendChild(borderLayer);
    contentG.appendChild(labelLayer);

    async function update(tiles: Map<string, TileData>, colorLookup?: ColorLookup): Promise<void> {
        const timer = new PerformanceTimer("border-detection");

        // Clear existing renders
        clearAreaFills(fillLayer);
        clearBorders(borderLayer);
        clearLabels(labelLayer);

        if (!bordersVisible && !labelsVisible && !fillsVisible) {
            timer.abort();
            return;
        }

        // Find contiguous areas
        const areas = findContiguousAreas(tiles, areaType, hexRadiusPx, base, padding);

        // Render fills (bottom layer)
        if (fillsVisible && colorLookup && areas.length > 0) {
            await renderAreaFills(fillLayer, areas, colorLookup, hexRadiusPx, base, padding, {
                opacity: 0.2,
                minAreaSize: 1,
            });
        }

        // Render labels
        if (labelsVisible && areas.length > 0) {
            renderAreaLabels(labelLayer, areas, {
                fontSize: 14,
                fillColor: "#ffffff",
                strokeColor: "#000000",
                strokeWidth: 3,
                minAreaSize: 5,
            });
        }

        // Render borders
        if (bordersVisible) {
            const borderPaths = traceBorders(tiles, areaType, hexRadiusPx, base, padding);

            // Enrich borderPaths with colors from colorLookup
            if (colorLookup) {
                for (const borderPath of borderPaths) {
                    const entityColor = await colorLookup(borderPath.areaValue);
                    if (entityColor) {
                        borderPath.color = entityColor;
                    }
                }
            }

            if (borderPaths.length > 0) {
                renderBorderPaths(borderLayer, borderPaths, {
                    strokeWidth: 3,
                    strokeColor: "#000000", // Fallback if no entity color
                    opacity: 0.8,
                });
            }
        }

        const duration = timer.end();
        logger.debug(`Border update took ${duration.toFixed(1)}ms (${tiles.size} tiles, ${areas.length} areas)`);
    }

    function clear(): void {
        clearAreaFills(fillLayer);
        clearBorders(borderLayer);
        clearLabels(labelLayer);
    }

    function destroy(): void {
        clear();
        fillLayer.remove();
        borderLayer.remove();
        labelLayer.remove();
    }

    function setAreaType(newAreaType: AreaType): void {
        areaType = newAreaType;
    }

    function setBordersVisible(visible: boolean): void {
        bordersVisible = visible;
        borderLayer.style.display = visible ? "" : "none";
    }

    function setLabelsVisible(visible: boolean): void {
        labelsVisible = visible;
        labelLayer.style.display = visible ? "" : "none";
    }

    function setFillsVisible(visible: boolean): void {
        fillsVisible = visible;
        fillLayer.style.display = visible ? "" : "none";
    }

    return {
        update,
        clear,
        destroy,
        setAreaType,
        setBordersVisible,
        setLabelsVisible,
        setFillsVisible,
    };
}

// ============================================================================
// Debounced Border Updater
// ============================================================================

/**
 * Debounced Border Updater
 *
 * Debounces border update operations to avoid excessive recalculations
 * during continuous painting (click and drag).
 *
 * Use this when:
 * - Painting region/faction areas continuously
 * - Changing border colors (debounce vault writes)
 * - Any operation that triggers border re-rendering
 *
 * Performance Impact:
 * - Before: Border update after each hex click (~50ms × 10 clicks = 500ms)
 * - After: Single border update after painting stops (50ms total)
 * - 10x faster for continuous painting
 */
export class DebouncedBorderUpdater {
    private timer: NodeJS.Timeout | null = null;
    private abortController: AbortController | null = null;

    /**
     * Schedule a border update with debouncing.
     *
     * Cancels any pending update and aborts any ongoing update before
     * scheduling the new update.
     *
     * @param updateFn - Async function that performs the border update
     * @param delay - Debounce delay in milliseconds (default: 300ms)
     */
    schedule(updateFn: () => Promise<void>, delay = 300): void {
        // Cancel pending update
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        // Abort ongoing update
        if (this.abortController) {
            this.abortController.abort();
        }

        // Create new abort controller for this update
        const controller = new AbortController();
        this.abortController = controller;

        logger.debug("Scheduled border update", { delay });

        // Schedule new update
        this.timer = setTimeout(async () => {
            this.timer = null;

            if (!controller.signal.aborted) {
                logger.debug("Executing border update");
                try {
                    await updateFn();
                    logger.debug("Border update completed");
                } catch (err) {
                    if (!controller.signal.aborted) {
                        logger.error("Update failed", err);
                    } else {
                        logger.debug("Update aborted during execution");
                    }
                }
            } else {
                logger.debug("Update canceled (aborted before execution)");
            }
        }, delay);
    }

    /**
     * Cancel all pending/ongoing updates.
     *
     * Clears the debounce timer and aborts any ongoing update operation.
     * Safe to call multiple times.
     */
    destroy(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
            logger.debug("Canceled pending update");
        }

        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            logger.debug("Aborted ongoing update");
        }
    }
}
