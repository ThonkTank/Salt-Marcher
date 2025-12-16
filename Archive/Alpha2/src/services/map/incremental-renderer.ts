/**
 * Incremental Map Renderer
 *
 * Renders hex maps incrementally, updating only changed tiles.
 * Uses SvgTileCache for persistent DOM elements.
 *
 * @module services/map/incremental-renderer
 */

import type { AxialCoord, CoordKey, TileData } from '../../schemas';
import type { CameraState } from '../../utils/render';
import { SvgTileCache } from '../../utils/render';
import { axialToCanvasPixel, hexPolygonPoints } from '../../utils/hex';
import { coordToKey } from '../../utils/hex';

export type IncrementalRenderConfig = {
	hexSize: number;
	padding: number;
	center: AxialCoord;
	colorFn: (tile: TileData, coord: AxialCoord) => string;
	strokeColor?: string;
	strokeWidth?: number;
};

export class IncrementalRenderer {
	private cache: SvgTileCache;
	private config: IncrementalRenderConfig | null = null;
	private container: HTMLElement | null = null;

	constructor() {
		this.cache = new SvgTileCache();
	}

	/**
	 * Initialize renderer with container.
	 * Call once when view opens.
	 */
	initialize(container: HTMLElement): void {
		this.container = container;
		this.cache.initialize(container);
	}

	/**
	 * Set render config (hex size, color function, etc.)
	 */
	setConfig(config: IncrementalRenderConfig): void {
		this.config = config;
	}

	/**
	 * Full render - builds all tiles from scratch.
	 * Call when map data changes completely (load, new map).
	 */
	fullRender(tiles: Map<CoordKey, TileData>, coords: AxialCoord[], camera: CameraState): void {
		if (!this.config || !this.container) return;

		// Clear and reinitialize
		this.cache.initialize(this.container);

		const { hexSize, padding, center, colorFn, strokeColor, strokeWidth } = this.config;

		for (const coord of coords) {
			const key = coordToKey(coord);
			const tile = tiles.get(key);
			if (!tile) continue;

			const pixel = axialToCanvasPixel(coord, hexSize, center, padding);
			const points = hexPolygonPoints(pixel.x, pixel.y, hexSize);
			const fill = colorFn(tile, coord);

			this.cache.setTile(key, points, fill, strokeColor, strokeWidth);
		}

		this.cache.applyCamera(camera);
	}

	/**
	 * Update camera transform only.
	 * Call when pan/zoom changes but tiles don't.
	 */
	updateCamera(camera: CameraState): void {
		this.cache.applyCamera(camera);
	}

	/**
	 * Update specific tiles.
	 * Call when brush modifies tiles.
	 */
	updateTiles(tiles: Map<CoordKey, TileData>, changedKeys: CoordKey[]): void {
		if (!this.config) return;

		const { colorFn } = this.config;

		for (const key of changedKeys) {
			const tile = tiles.get(key);
			if (tile) {
				// Parse coord from key for colorFn
				const [q, r] = key.split(',').map(Number);
				const coord = { q, r };
				const fill = colorFn(tile, coord);
				this.cache.updateTileFill(key, fill);
			}
		}
	}

	/**
	 * Update all tile colors (e.g., when tool changes and coloring logic changes).
	 */
	updateAllColors(tiles: Map<CoordKey, TileData>, coords: AxialCoord[]): void {
		if (!this.config) return;

		const { colorFn } = this.config;

		for (const coord of coords) {
			const key = coordToKey(coord);
			const tile = tiles.get(key);
			if (tile) {
				const fill = colorFn(tile, coord);
				this.cache.updateTileFill(key, fill);
			}
		}
	}

	/**
	 * Update config (e.g., colorFn changed).
	 */
	updateConfig(config: Partial<IncrementalRenderConfig>): void {
		if (this.config) {
			this.config = { ...this.config, ...config };
		}
	}

	/**
	 * Get overlay group for brush indicator.
	 */
	getOverlayGroup(): SVGGElement | null {
		return this.cache.getOverlayGroup();
	}

	/**
	 * Get the cache (for advanced operations).
	 */
	getCache(): SvgTileCache {
		return this.cache;
	}

	/**
	 * Cleanup.
	 */
	destroy(): void {
		this.cache.clear();
		this.config = null;
		this.container = null;
	}
}
