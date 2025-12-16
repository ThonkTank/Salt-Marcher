// src/features/maps/rendering/core/hex-geometry.ts
// Consolidated hex geometry utilities: corners, edges, and coordinate transformations
//
// Merged from:
// - hex-edges.ts - Edge calculations and direction utilities
// - hex-corners.ts - Corner-based coordinate system for terrain features

import { neighbors } from "@geometry";
import { pixelToAxial } from "@geometry";
import { axialToCanvasPixel } from "@geometry";
import type { AxialCoord } from "@geometry";

// Type alias for backward compatibility
type Coord = AxialCoord;

// ============================================================================
// Constants (from hex-edges.ts)
// ============================================================================

/**
 * Direction constants for odd-r neighbors (clockwise from East)
 * Indices: 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
 */
const ODDR_DIRS_EVEN = [
    { dr: 0, dc: +1 },  // 0: E
    { dr: -1, dc: 0 },  // 1: NE
    { dr: -1, dc: -1 }, // 2: NW
    { dr: 0, dc: -1 },  // 3: W
    { dr: +1, dc: -1 }, // 4: SW
    { dr: +1, dc: 0 },  // 5: SE
] as const;

const ODDR_DIRS_ODD = [
    { dr: 0, dc: +1 },  // 0: E
    { dr: -1, dc: +1 }, // 1: NE
    { dr: -1, dc: 0 },  // 2: NW
    { dr: 0, dc: -1 },  // 3: W
    { dr: +1, dc: 0 },  // 4: SW
    { dr: +1, dc: +1 }, // 5: SE
] as const;

// ============================================================================
// Hex Corners (from hex-edges.ts)
// ============================================================================

/**
 * Get the 6 corners of a pointy-top hex
 * Corners are numbered clockwise starting from top (12 o'clock position)
 *
 * Layout:
 *       0 (-90°)
 *      /    \
 *   5 /      \ 1
 *    |        |
 *   4 \      / 2
 *      \    /
 *       3 (90°)
 *
 * @param cx Center X coordinate (pixels)
 * @param cy Center Y coordinate (pixels)
 * @param radius Hex radius (pixels)
 * @returns Array of 6 corner points {x, y}
 */
export function getHexCorners(cx: number, cy: number, radius: number): Array<{ x: number; y: number }> {
    const corners: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 6; i++) {
        const angleDeg = 60 * i - 90; // Start at -90° (top)
        const angleRad = (angleDeg * Math.PI) / 180;
        corners.push({
            x: cx + radius * Math.cos(angleRad),
            y: cy + radius * Math.sin(angleRad),
        });
    }
    return corners;
}

// ============================================================================
// Direction & Edge Utilities (from hex-edges.ts)
// ============================================================================

/**
 * Get the direction index (0-5) from hex1 to hex2
 * Returns null if hex2 is not a direct neighbor of hex1
 *
 * Directions (clockwise from East):
 * 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
 *
 * @param hex1 Start hex coordinate (odd-r)
 * @param hex2 End hex coordinate (odd-r)
 * @returns Direction index (0-5) or null if not neighbors
 */
export function getDirection(hex1: Coord, hex2: Coord): number | null {
    // Axial neighbor differences (same as AXIAL_DIRECTIONS in hex-coords.ts)
    // Direction indices: 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE
    const AXIAL_DIRS = [
        { dq: 1, dr: 0 },   // 0: E
        { dq: 1, dr: -1 },  // 1: NE
        { dq: 0, dr: -1 },  // 2: NW
        { dq: -1, dr: 0 },  // 3: W
        { dq: -1, dr: 1 },  // 4: SW
        { dq: 0, dr: 1 },   // 5: SE
    ];

    const dq = hex2.q - hex1.q;
    const dr = hex2.r - hex1.r;

    for (let i = 0; i < 6; i++) {
        if (AXIAL_DIRS[i].dq === dq && AXIAL_DIRS[i].dr === dr) {
            return i;
        }
    }

    return null; // Not neighbors
}

/**
 * Get the midpoint of the shared edge between two adjacent hexes
 *
 * This calculates the TRUE edge midpoint by:
 * 1. Finding which direction hex2 is from hex1
 * 2. Getting the 2 corners that form that edge
 * 3. Returning the average of those 2 corners
 *
 * For pointy-top hexes, edge corners are:
 * - Direction 0 (E):  corners 1,2
 * - Direction 1 (NE): corners 0,1
 * - Direction 2 (NW): corners 5,0
 * - Direction 3 (W):  corners 4,5
 * - Direction 4 (SW): corners 3,4
 * - Direction 5 (SE): corners 2,3
 *
 * @param hex1 First hex coordinate (odd-r)
 * @param hex2 Second hex coordinate (odd-r) - must be adjacent neighbor
 * @param cx1 Center X of hex1 (pixels)
 * @param cy1 Center Y of hex1 (pixels)
 * @param radius Hex radius (pixels)
 * @returns Edge midpoint {x, y} or null if hexes not adjacent
 */
export function getEdgeMidpoint(
    hex1: Coord,
    hex2: Coord,
    cx1: number,
    cy1: number,
    radius: number
): { x: number; y: number } | null {
    const direction = getDirection(hex1, hex2);
    if (direction === null) return null;

    // Get corners of hex1
    const corners = getHexCorners(cx1, cy1, radius);

    // Map direction to edge corners
    // The pattern: Direction i connects corners ((1-i+6)%6, (2-i+6)%6)
    // This accounts for corners being numbered clockwise from top,
    // while directions represent outward edges
    const corner1Index = (6 + 1 - direction) % 6;
    const corner2Index = (6 + 2 - direction) % 6;

    const corner1 = corners[corner1Index];
    const corner2 = corners[corner2Index];

    // Midpoint of edge = average of 2 corners
    return {
        x: (corner1.x + corner2.x) / 2,
        y: (corner1.y + corner2.y) / 2,
    };
}

// ============================================================================
// Corner Coordinate System (from hex-corners.ts)
// ============================================================================

/**
 * Corner coordinate - identifies a specific corner of a hex
 *
 * Corners are numbered 0-5 clockwise starting from top (pointy-top hexes):
 *       0 (-90°)
 *      /    \
 *   5 /      \ 1
 *    |        |
 *   4 \      / 2
 *      \    /
 *       3 (90°)
 */
export interface CornerCoord {
    q: number;  // Hex q coordinate (axial)
    r: number;  // Hex r coordinate (axial)
    corner: 0 | 1 | 2 | 3 | 4 | 5;  // Which corner (0=top, clockwise)
}

/**
 * Convert corner coordinate to pixel position in SVG canvas space
 *
 * @param corner Corner coordinate
 * @param radius Hex radius (pixels)
 * @param base Origin hex coordinate (for coordinate transformation)
 * @param padding SVG canvas padding (pixels)
 * @returns Pixel position {x, y} in SVG canvas space
 */
export function cornerToPixel(
    corner: CornerCoord,
    radius: number,
    base: Coord,
    padding: number
): { x: number; y: number } {
    // Use axial coordinate system to get hex center in canvas space
    const center = axialToCanvasPixel(
        { q: corner.q, r: corner.r },
        radius,
        base,
        padding
    );

    // Get corners relative to center
    const corners = getHexCorners(center.x, center.y, radius);
    return corners[corner.corner];
}

/**
 * Find the nearest corner to a pixel position in SVG canvas space
 *
 * @param x Pixel X coordinate in SVG canvas space
 * @param y Pixel Y coordinate in SVG canvas space
 * @param radius Hex radius
 * @param base Origin hex coordinate (for coordinate transformation)
 * @param padding SVG canvas padding (pixels)
 * @param threshold Maximum distance to consider (pixels)
 * @returns Corner coordinate or null if no corner within threshold
 */
export function pixelToCorner(
    x: number,
    y: number,
    radius: number,
    base: Coord,
    padding: number,
    threshold: number = 10
): CornerCoord | null {
    // Transform pixel from SVG canvas space to world space
    const worldX = x - padding;
    const worldY = y - padding;

    // Find the hex at this position (in world space)
    const hexCoord = pixelToAxial(worldX, worldY, radius);

    // Adjust for base offset
    const adjustedCoord = {
        q: hexCoord.q + base.q,
        r: hexCoord.r + base.r,
    };

    // Get all neighboring hexes (including center)
    const hexesToCheck = [adjustedCoord, ...neighbors(adjustedCoord)];

    let nearestCorner: CornerCoord | null = null;
    let nearestDistance = threshold;

    // Check all corners of all nearby hexes
    for (const hex of hexesToCheck) {
        for (let cornerIndex = 0; cornerIndex < 6; cornerIndex++) {
            const corner: CornerCoord = {
                q: hex.q,
                r: hex.r,
                corner: cornerIndex as 0 | 1 | 2 | 3 | 4 | 5,
            };

            const cornerPos = cornerToPixel(corner, radius, base, padding);
            const distance = Math.sqrt(
                Math.pow(cornerPos.x - x, 2) + Math.pow(cornerPos.y - y, 2)
            );

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestCorner = corner;
            }
        }
    }

    return nearestCorner;
}

/**
 * Get all corners adjacent to a given corner
 *
 * A corner is shared by 3 hexes, and connects to 3 other corners:
 * - 2 corners on the same hex (neighbors in corner array)
 * - 1 corner on adjacent hex
 *
 * @param corner Corner coordinate
 * @returns Array of 3 adjacent corner coordinates
 */
export function adjacentCorners(corner: CornerCoord): CornerCoord[] {
    const adjacent: CornerCoord[] = [];

    // Add adjacent corners on the same hex
    const prevCorner = (corner.corner + 5) % 6;  // Previous corner (counterclockwise)
    const nextCorner = (corner.corner + 1) % 6;  // Next corner (clockwise)

    adjacent.push({
        q: corner.q,
        r: corner.r,
        corner: prevCorner as 0 | 1 | 2 | 3 | 4 | 5,
    });

    adjacent.push({
        q: corner.q,
        r: corner.r,
        corner: nextCorner as 0 | 1 | 2 | 3 | 4 | 5,
    });

    // Find the corner on the adjacent hex
    // This is the same physical point, but referenced from a different hex
    const oppositeHexCorner = findOppositeHexCorner(corner);
    if (oppositeHexCorner) {
        adjacent.push(oppositeHexCorner);
    }

    return adjacent;
}

/**
 * Find the same corner point but referenced from an adjacent hex
 *
 * Each corner is shared by 3 hexes. This finds one of the other 2 hexes
 * that share this corner.
 *
 * @param corner Corner coordinate
 * @returns Corner coordinate from adjacent hex, or null if not found
 */
function findOppositeHexCorner(corner: CornerCoord): CornerCoord | null {
    // Corner adjacency mapping (which hex neighbor + which corner on that hex)
    // For pointy-top hexes, corners are shared as follows:
    //
    // Corner 0 (top):      shared with NW neighbor (corner 3) and NE neighbor (corner 4)
    // Corner 1 (top-right): shared with E neighbor (corner 5) and NE neighbor (corner 3)
    // Corner 2 (bottom-right): shared with E neighbor (corner 4) and SE neighbor (corner 0)
    // Corner 3 (bottom):   shared with SW neighbor (corner 1) and SE neighbor (corner 5)
    // Corner 4 (bottom-left): shared with W neighbor (corner 2) and SW neighbor (corner 0)
    // Corner 5 (top-left): shared with W neighbor (corner 1) and NW neighbor (corner 2)

    const neighborCoords = neighbors({ q: corner.q, r: corner.r });

    // Mapping: [corner index] -> [[neighbor index, corner on that neighbor], ...]
    const cornerToNeighbors: Array<Array<[number, number]>> = [
        [[1, 3], [2, 4]],  // Corner 0: NE neighbor corner 3, NW neighbor corner 4
        [[0, 5], [1, 3]],  // Corner 1: E neighbor corner 5, NE neighbor corner 3
        [[0, 4], [5, 0]],  // Corner 2: E neighbor corner 4, SE neighbor corner 0
        [[4, 1], [5, 5]],  // Corner 3: SW neighbor corner 1, SE neighbor corner 5
        [[3, 2], [4, 0]],  // Corner 4: W neighbor corner 2, SW neighbor corner 0
        [[2, 2], [3, 1]],  // Corner 5: NW neighbor corner 2, W neighbor corner 1
    ];

    const mapping = cornerToNeighbors[corner.corner];
    if (!mapping || mapping.length === 0) return null;

    // Return the first adjacent hex corner (there are 2, we just pick one)
    const [neighborIndex, neighborCorner] = mapping[0];
    const neighborHex = neighborCoords[neighborIndex];

    return {
        q: neighborHex.q,
        r: neighborHex.r,
        corner: neighborCorner as 0 | 1 | 2 | 3 | 4 | 5,
    };
}

/**
 * Check if two corners are equal (same physical point)
 *
 * Note: The same corner point can be represented by different CornerCoord
 * (different hex, different corner index). This function checks physical equality.
 *
 * @param c1 First corner
 * @param c2 Second corner
 * @param radius Hex radius
 * @param base Origin hex coordinate (for coordinate transformation)
 * @param padding SVG canvas padding (pixels)
 * @returns True if corners represent the same physical point
 */
export function cornersEqual(
    c1: CornerCoord,
    c2: CornerCoord,
    radius: number,
    base: Coord,
    padding: number
): boolean {
    const pos1 = cornerToPixel(c1, radius, base, padding);
    const pos2 = cornerToPixel(c2, radius, base, padding);

    const distance = Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
    );

    // Corners are equal if within 1 pixel distance
    return distance < 1;
}

/**
 * Normalize a corner coordinate to canonical form
 *
 * Since the same corner can be represented by different CornerCoord,
 * this returns a canonical representation (lowest r, then lowest c, then lowest corner)
 *
 * @param corner Corner coordinate
 * @param radius Hex radius
 * @param base Origin hex coordinate (for coordinate transformation)
 * @param padding SVG canvas padding (pixels)
 * @returns Canonical corner coordinate
 */
export function normalizeCorner(
    corner: CornerCoord,
    radius: number,
    base: Coord,
    padding: number
): CornerCoord {
    // Get all representations of this corner
    const adjacent = adjacentCorners(corner);
    const allRepresentations = [corner, ...adjacent].filter(c =>
        cornersEqual(c, corner, radius, base, padding)
    );

    // Sort by r, then q, then corner
    allRepresentations.sort((a, b) => {
        if (a.r !== b.r) return a.r - b.r;
        if (a.q !== b.q) return a.q - b.q;
        return a.corner - b.corner;
    });

    return allRepresentations[0];
}

// ============================================================================
// Pathfinding (from hex-corners.ts)
// ============================================================================

/**
 * Find path between two corners using A* algorithm
 *
 * Returns array of corners from start to end (inclusive).
 * Returns null if no path found or start/end are same.
 *
 * @param start Starting corner
 * @param end Ending corner
 * @param maxDepth Maximum search depth (prevents infinite loops)
 * @param radius Hex radius (pixels)
 * @param base Origin hex coordinate (for coordinate transformation)
 * @param padding SVG canvas padding (pixels)
 * @param existingPath Optional array of corners to avoid (prevents shortcuts and duplicates)
 * @returns Path as array of corners, or null if no path
 */
export function findPathBetweenCorners(
    start: CornerCoord,
    end: CornerCoord,
    maxDepth: number,
    radius: number,
    base: Coord,
    padding: number,
    existingPath?: CornerCoord[]
): CornerCoord[] | null {
    // Helper: corner to string key
    const cornerKey = (c: CornerCoord) => `${c.q},${c.r}:${c.corner}`;

    // Create avoidance set from existing path (if provided)
    const avoidSet = new Set<string>();
    if (existingPath) {
        for (const corner of existingPath) {
            avoidSet.add(cornerKey(corner));
        }
    }

    // Check if already adjacent
    if (cornersEqual(start, end, radius, base, padding)) return [start];
    const adjacent = adjacentCorners(start);
    if (adjacent.some(c => cornersEqual(c, end, radius, base, padding))) {
        return [start, end];
    }

    // A* pathfinding
    const openSet = new Set<string>([cornerKey(start)]);
    const cameFrom = new Map<string, CornerCoord>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    gScore.set(cornerKey(start), 0);
    fScore.set(cornerKey(start), heuristic(start, end));

    let iterations = 0;
    while (openSet.size > 0 && iterations < maxDepth) {
        iterations++;

        // Find node in openSet with lowest fScore
        let current: CornerCoord | null = null;
        let currentKey: string | null = null;
        let lowestF = Infinity;

        for (const key of openSet) {
            const f = fScore.get(key) ?? Infinity;
            if (f < lowestF) {
                lowestF = f;
                currentKey = key;
                // Parse key back to corner
                const [coords, corner] = key.split(':');
                const [q, r] = coords.split(',').map(Number);
                current = { q, r, corner: parseInt(corner) as 0 | 1 | 2 | 3 | 4 | 5 };
            }
        }

        if (!current || !currentKey) break;

        // Check if we reached the goal
        if (cornersEqual(current, end, radius, base, padding)) {
            // Reconstruct path
            return reconstructPath(cameFrom, current, cornerKey);
        }

        openSet.delete(currentKey);

        // Check all neighbors
        const neighborCorners = adjacentCorners(current);
        for (const neighbor of neighborCorners) {
            const neighborKey = cornerKey(neighbor);

            // Skip corners in the avoidance set (unless it's the end goal)
            if (avoidSet.has(neighborKey) && !cornersEqual(neighbor, end, radius, base, padding)) {
                continue;
            }

            const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;

            if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeG);
                fScore.set(neighborKey, tentativeG + heuristic(neighbor, end));
                openSet.add(neighborKey);
            }
        }
    }

    return null; // No path found
}

/**
 * Heuristic for A* - Manhattan distance between corners
 */
function heuristic(a: CornerCoord, b: CornerCoord): number {
    return Math.abs(a.r - b.r) + Math.abs(a.q - b.q);
}

/**
 * Reconstruct path from A* came-from map
 */
function reconstructPath(
    cameFrom: Map<string, CornerCoord>,
    current: CornerCoord,
    cornerKey: (c: CornerCoord) => string
): CornerCoord[] {
    const path: CornerCoord[] = [current];
    let key = cornerKey(current);

    while (cameFrom.has(key)) {
        current = cameFrom.get(key)!;
        path.unshift(current);
        key = cornerKey(current);
    }

    return path;
}

// ============================================================================
// Geometry Utilities (from hex-corners.ts)
// ============================================================================

/**
 * Calculate the shortest distance from a point to a line segment
 *
 * @param px Point X coordinate
 * @param py Point Y coordinate
 * @param x1 Line segment start X
 * @param y1 Line segment start Y
 * @param x2 Line segment end X
 * @param y2 Line segment end Y
 * @returns Minimum distance from point to line segment
 */
export function distanceToLineSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
): number {
    // Vector from segment start to point
    const dx = px - x1;
    const dy = py - y1;

    // Vector from segment start to end
    const segmentDx = x2 - x1;
    const segmentDy = y2 - y1;

    // Compute squared length of segment
    const segmentLengthSquared = segmentDx * segmentDx + segmentDy * segmentDy;

    // Handle degenerate case (segment is a point)
    if (segmentLengthSquared === 0) {
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Compute projection parameter t (position along segment, 0 to 1)
    let t = (dx * segmentDx + dy * segmentDy) / segmentLengthSquared;

    // Clamp t to [0, 1] to stay within segment
    t = Math.max(0, Math.min(1, t));

    // Compute closest point on segment
    const closestX = x1 + t * segmentDx;
    const closestY = y1 + t * segmentDy;

    // Return distance from point to closest point on segment
    const distX = px - closestX;
    const distY = py - closestY;
    return Math.sqrt(distX * distX + distY * distY);
}

// ============================================================================
// Bulk Corner Operations (from hex-corners.ts)
// ============================================================================

/**
 * Get all corners for a given set of hex coordinates
 *
 * Returns all 6 corners for each hex in the provided array.
 * Use this with coordsInRadius() or getHexCoordsFromTiles() for proper hexagonal shapes.
 *
 * @param coords Array of hex coordinates (should be hexagonal, not rectangular)
 * @returns Array of all corners for the given hexes
 *
 * @example
 * ```typescript
 * import { coordsInRadius } from "@geometry";
 * const hexes = coordsInRadius({ q: 0, r: 0 }, 5);
 * const corners = getAllCornersForHexes(hexes);
 * // Returns 6 corners for each hex in the hexagonal region
 * ```
 */
export function getAllCornersForHexes(coords: readonly AxialCoord[]): CornerCoord[] {
    const corners: CornerCoord[] = [];

    for (const { q, r } of coords) {
        for (let corner = 0; corner < 6; corner++) {
            corners.push({
                q,
                r,
                corner: corner as 0 | 1 | 2 | 3 | 4 | 5,
            });
        }
    }

    return corners;
}

/**
 * @deprecated Use getAllCornersForHexes() with coordsInRadius() instead.
 * This function generates a RECTANGULAR grid of corners which is incorrect for hex maps.
 *
 * Get all corners within a hex coordinate range (LEGACY - rectangular)
 *
 * @param minR Minimum row (inclusive)
 * @param maxR Maximum row (inclusive)
 * @param minQ Minimum q coordinate (inclusive)
 * @param maxQ Maximum q coordinate (inclusive)
 * @returns Array of all corners in the rectangular range
 */
export function getAllCornersInRange(
    minR: number,
    maxR: number,
    minQ: number,
    maxQ: number
): CornerCoord[] {
    const corners: CornerCoord[] = [];

    for (let r = minR; r <= maxR; r++) {
        for (let q = minQ; q <= maxQ; q++) {
            for (let corner = 0; corner < 6; corner++) {
                corners.push({
                    q,
                    r,
                    corner: corner as 0 | 1 | 2 | 3 | 4 | 5,
                });
            }
        }
    }

    return corners;
}

/**
 * Find the nearest corner to a pixel position from a list of candidates
 *
 * This is different from pixelToCorner() which only checks nearby hexes.
 * This function can check ALL corners in the viewport for global corner detection.
 *
 * @param mouseX Mouse X coordinate in SVG canvas space
 * @param mouseY Mouse Y coordinate in SVG canvas space
 * @param candidates Array of corner coordinates to check
 * @param radius Hex radius
 * @param base Origin hex coordinate
 * @param padding SVG canvas padding
 * @param threshold Maximum distance to consider (pixels)
 * @returns Nearest corner or null if none within threshold
 */
export function findNearestCorner(
    mouseX: number,
    mouseY: number,
    candidates: CornerCoord[],
    radius: number,
    base: Coord,
    padding: number,
    threshold: number = 30
): CornerCoord | null {
    let nearestCorner: CornerCoord | null = null;
    let nearestDistance = threshold;

    for (const corner of candidates) {
        const cornerPos = cornerToPixel(corner, radius, base, padding);
        const distance = Math.sqrt(
            Math.pow(cornerPos.x - mouseX, 2) + Math.pow(cornerPos.y - mouseY, 2)
        );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestCorner = corner;
        }
    }

    return nearestCorner;
}

/**
 * Find which edge (if any) is near a given point
 *
 * An edge is defined by two adjacent corners. This function checks the 3 edges
 * emanating from the last corner in a path and returns the next corner that
 * defines the edge closest to the mouse position.
 *
 * @param mouseX Mouse X coordinate in SVG canvas space
 * @param mouseY Mouse Y coordinate in SVG canvas space
 * @param lastCorner Last corner in current path
 * @param radius Hex radius
 * @param base Origin hex coordinate
 * @param padding SVG canvas padding
 * @param threshold Maximum distance to consider (pixels, default 15)
 * @returns Next corner that defines the hovered edge, or null if no edge within threshold
 */
export function findEdgeNearPoint(
    mouseX: number,
    mouseY: number,
    lastCorner: CornerCoord,
    radius: number,
    base: Coord,
    padding: number,
    threshold: number = 15
): CornerCoord | null {
    // Get all adjacent corners (3 possible next positions)
    const adjacent = adjacentCorners(lastCorner);

    // Get pixel position of last corner
    const lastPixel = cornerToPixel(lastCorner, radius, base, padding);

    let nearestCorner: CornerCoord | null = null;
    let nearestDistance = threshold;

    // Check each edge (last corner → adjacent corner)
    for (const nextCorner of adjacent) {
        const nextPixel = cornerToPixel(nextCorner, radius, base, padding);

        // Calculate distance from mouse to this edge
        const distance = distanceToLineSegment(
            mouseX,
            mouseY,
            lastPixel.x,
            lastPixel.y,
            nextPixel.x,
            nextPixel.y
        );

        // Track nearest edge
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestCorner = nextCorner;
        }
    }

    return nearestCorner;
}
