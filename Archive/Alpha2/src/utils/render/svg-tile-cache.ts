/**
 * SVG Tile Cache
 *
 * Maintains persistent SVG elements for incremental updates.
 * Applies CSS transforms for camera instead of rebuilding DOM.
 *
 * @module utils/render/svg-tile-cache
 */

import type { CoordKey } from '../../schemas';
import type { CameraState } from './camera';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class SvgTileCache {
	private svg: SVGSVGElement | null = null;
	private tileGroup: SVGGElement | null = null;
	private overlayGroup: SVGGElement | null = null;
	private tileElements: Map<CoordKey, SVGPolygonElement> = new Map();
	private container: HTMLElement | null = null;

	/**
	 * Initialize the cache with a container element.
	 * Creates the SVG structure once.
	 */
	initialize(container: HTMLElement): void {
		this.container = container;
		this.clear();

		// Create persistent SVG
		this.svg = document.createElementNS(SVG_NS, 'svg');
		this.svg.setAttribute('width', '100%');
		this.svg.setAttribute('height', '100%');
		this.svg.style.position = 'absolute';
		this.svg.style.top = '0';
		this.svg.style.left = '0';
		this.svg.style.overflow = 'visible';

		// Tile layer (transformed by camera)
		this.tileGroup = document.createElementNS(SVG_NS, 'g');
		this.tileGroup.setAttribute('class', 'tile-layer');

		// Overlay layer (also transformed - brush indicator in world space)
		this.overlayGroup = document.createElementNS(SVG_NS, 'g');
		this.overlayGroup.setAttribute('class', 'overlay-layer');

		this.svg.appendChild(this.tileGroup);
		this.svg.appendChild(this.overlayGroup);
		container.appendChild(this.svg);
	}

	/**
	 * Apply camera transform via CSS.
	 * This is O(1) - just sets a single attribute.
	 */
	applyCamera(camera: CameraState): void {
		const transform = `translate(${camera.panX}, ${camera.panY}) scale(${camera.zoom})`;
		if (this.tileGroup) {
			this.tileGroup.setAttribute('transform', transform);
		}
		if (this.overlayGroup) {
			this.overlayGroup.setAttribute('transform', transform);
		}
	}

	/**
	 * Set or update a single tile polygon.
	 */
	setTile(
		key: CoordKey,
		points: string,
		fill: string,
		stroke?: string,
		strokeWidth?: number
	): void {
		let polygon = this.tileElements.get(key);

		if (!polygon) {
			// Create new polygon
			polygon = document.createElementNS(SVG_NS, 'polygon');
			polygon.setAttribute('data-key', key);
			this.tileElements.set(key, polygon);
			this.tileGroup?.appendChild(polygon);
		}

		// Update attributes
		polygon.setAttribute('points', points);
		polygon.setAttribute('fill', fill);
		if (stroke) polygon.setAttribute('stroke', stroke);
		if (strokeWidth !== undefined) polygon.setAttribute('stroke-width', String(strokeWidth));
	}

	/**
	 * Update only the fill color of a tile.
	 */
	updateTileFill(key: CoordKey, fill: string): void {
		const polygon = this.tileElements.get(key);
		if (polygon) {
			polygon.setAttribute('fill', fill);
		}
	}

	/**
	 * Remove a tile from the cache.
	 */
	removeTile(key: CoordKey): void {
		const polygon = this.tileElements.get(key);
		if (polygon) {
			polygon.remove();
			this.tileElements.delete(key);
		}
	}

	/**
	 * Get the overlay group for adding overlays (brush indicator, etc.)
	 */
	getOverlayGroup(): SVGGElement | null {
		return this.overlayGroup;
	}

	/**
	 * Check if a tile exists in the cache.
	 */
	hasTile(key: CoordKey): boolean {
		return this.tileElements.has(key);
	}

	/**
	 * Get the container element.
	 */
	getContainer(): HTMLElement | null {
		return this.container;
	}

	/**
	 * Clear all cached elements.
	 */
	clear(): void {
		if (this.container) {
			this.container.innerHTML = '';
		}
		this.tileElements.clear();
		this.svg = null;
		this.tileGroup = null;
		this.overlayGroup = null;
	}

	/**
	 * Get all cached tile keys.
	 */
	getTileKeys(): IterableIterator<CoordKey> {
		return this.tileElements.keys();
	}

	/**
	 * Get tile count.
	 */
	get size(): number {
		return this.tileElements.size;
	}
}
