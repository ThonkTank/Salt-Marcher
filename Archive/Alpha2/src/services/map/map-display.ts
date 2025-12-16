/**
 * Map Display Service
 *
 * Orchestration layer: combines mappers, renderer, and hit-testing.
 * Uses hex-mapper (or future square-mapper) to convert schemas to primitives,
 * then passes them to the renderer.
 *
 * @module services/map/map-display
 */

import type { AxialCoord, CoordKey, TileData } from '../../schemas';
import type { CameraState, HexMapperOptions } from '../../utils';
import {
    mapHexTilesToBatch,
    renderToSvg,
    renderToContainer,
} from '../../utils';

// Re-export hit-testing and tile colors from utils for backward compatibility
export {
    hitTestHex,
    hitTestHexCorner,
    hitTestHexEdge,
    isPointInHex,
    type HitTestOptions,
} from '../../utils/hex/hit-testing';

export {
    getTileColor,
    type ColoringContext,
} from '../../utils/render/tile-colors';

// ============================================================================
// Types
// ============================================================================

export type HexHitResult = {
    coord: AxialCoord;
    cornerIndex?: number;
    edgeIndices?: [number, number];
};

export type HexMapRenderOptions = HexMapperOptions & {
    camera?: CameraState;
};

// ============================================================================
// Hex Map Rendering
// ============================================================================

/**
 * Render a hex map to an SVG element.
 */
export function renderHexMapToSvg(
    tiles: Map<CoordKey, TileData>,
    coords: AxialCoord[],
    options: HexMapRenderOptions
): SVGSVGElement {
    const { camera, ...mapperOptions } = options;
    const batch = mapHexTilesToBatch(tiles, coords, mapperOptions);
    return renderToSvg(batch, { camera });
}

/**
 * Render a hex map into a container element.
 * Clears existing content first.
 */
export function renderHexMap(
    container: HTMLElement,
    tiles: Map<CoordKey, TileData>,
    coords: AxialCoord[],
    options: HexMapRenderOptions
): void {
    const { camera, ...mapperOptions } = options;
    const batch = mapHexTilesToBatch(tiles, coords, mapperOptions);
    renderToContainer(container, batch, { camera });
}

