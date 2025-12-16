// src/services/hex-rendering/index.ts
// Hex rendering service for SVG-based map visualization
//
// Provides low-level rendering utilities for hex-based maps:
// - Geometric calculations (corners, edges, shapes)
// - Camera controls (pan, zoom)
// - Coordinate-to-pixel conversions
//
// This service handles the rendering layer independently of business logic,
// making it reusable across different map types and workmodes.

// ============================================================================
// Hex Geometry
// ============================================================================

export type { CornerCoord } from "./service-hex-geometry";
export {
    // Edge utilities
    getHexCorners,
    getDirection,
    getEdgeMidpoint,
    // Corner utilities
    cornerToPixel,
    pixelToCorner,
    adjacentCorners,
    cornersEqual,
    normalizeCorner,
    findPathBetweenCorners,
    distanceToLineSegment,
    getAllCornersForHexes,
    getAllCornersInRange,
    findNearestCorner,
    findEdgeNearPoint,
} from "./service-hex-geometry";

// ============================================================================
// Camera Controls
// ============================================================================

export type { CameraOptions, HexCameraController } from "./camera";
export { createCameraController, attachCameraControls } from "./camera";
