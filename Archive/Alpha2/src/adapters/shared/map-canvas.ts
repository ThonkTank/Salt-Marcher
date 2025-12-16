/**
 * Map Canvas
 *
 * Shared adapter component for hex map rendering with camera controls.
 * Handles DOM events for pan/zoom and delegates to callbacks.
 *
 * @module adapters/shared/map-canvas
 */

import type { AxialCoord, CoordKey, TileData } from '../../schemas';
import type { CameraState } from '../../utils/render';
import { renderHexMap } from '../../services/map';
import { hitTestHexFromEvent } from '../../utils/hex/hit-testing';
import { PanState } from './pan-state';

// ============================================================================
// Types
// ============================================================================

export type MapCanvasCallbacks = {
	onPan: (deltaX: number, deltaY: number) => void;
	onZoom: (delta: number, centerX: number, centerY: number) => void;
	onHexClick?: (coord: AxialCoord, button: number) => void;
	onHexHover?: (coord: AxialCoord | null) => void;
};

export type MapCanvasConfig = {
	hexSize: number;
	padding: number;
	center: AxialCoord;
	colorFn?: (tile: TileData, coord: AxialCoord) => string;
	strokeColor?: string;
	strokeWidth?: number;
};

// ============================================================================
// MapCanvas
// ============================================================================

export class MapCanvas {
	private container: HTMLElement;
	private callbacks: MapCanvasCallbacks;
	private config: MapCanvasConfig;
	private tiles: Map<CoordKey, TileData>;
	private coords: AxialCoord[];
	private camera: CameraState;

	// Pan state
	private panState = new PanState();

	// Bound handlers for cleanup
	private boundHandlers: {
		mousedown: (e: MouseEvent) => void;
		mousemove: (e: MouseEvent) => void;
		mouseup: (e: MouseEvent) => void;
		mouseleave: () => void;
		wheel: (e: WheelEvent) => void;
		click: (e: MouseEvent) => void;
		contextmenu: (e: MouseEvent) => void;
	};

	constructor(
		container: HTMLElement,
		tiles: Map<CoordKey, TileData>,
		coords: AxialCoord[],
		camera: CameraState,
		config: MapCanvasConfig,
		callbacks: MapCanvasCallbacks
	) {
		this.container = container;
		this.tiles = tiles;
		this.coords = coords;
		this.camera = camera;
		this.config = config;
		this.callbacks = callbacks;

		this.boundHandlers = {
			mousedown: this.handleMouseDown.bind(this),
			mousemove: this.handleMouseMove.bind(this),
			mouseup: this.handleMouseUp.bind(this),
			mouseleave: this.handleMouseLeave.bind(this),
			wheel: this.handleWheel.bind(this),
			click: this.handleClick.bind(this),
			contextmenu: this.handleContextMenu.bind(this),
		};

		this.setupEventListeners();
		this.render();
	}

	// ========================================================================
	// Public API
	// ========================================================================

	updateTiles(tiles: Map<CoordKey, TileData>, coords: AxialCoord[]): void {
		this.tiles = tiles;
		this.coords = coords;
		this.render();
	}

	updateCamera(camera: CameraState): void {
		this.camera = camera;
		this.render();
	}

	updateConfig(config: Partial<MapCanvasConfig>): void {
		this.config = { ...this.config, ...config };
		this.render();
	}

	resize(): void {
		this.render();
	}

	destroy(): void {
		this.container.removeEventListener('mousedown', this.boundHandlers.mousedown);
		this.container.removeEventListener('mousemove', this.boundHandlers.mousemove);
		this.container.removeEventListener('mouseup', this.boundHandlers.mouseup);
		this.container.removeEventListener('mouseleave', this.boundHandlers.mouseleave);
		this.container.removeEventListener('wheel', this.boundHandlers.wheel);
		this.container.removeEventListener('click', this.boundHandlers.click);
		this.container.removeEventListener('contextmenu', this.boundHandlers.contextmenu);
	}

	// ========================================================================
	// Event Handling
	// ========================================================================

	private setupEventListeners(): void {
		this.container.addEventListener('mousedown', this.boundHandlers.mousedown);
		this.container.addEventListener('mousemove', this.boundHandlers.mousemove);
		this.container.addEventListener('mouseup', this.boundHandlers.mouseup);
		this.container.addEventListener('mouseleave', this.boundHandlers.mouseleave);
		this.container.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
		this.container.addEventListener('click', this.boundHandlers.click);
		this.container.addEventListener('contextmenu', this.boundHandlers.contextmenu);
	}

	private handleMouseDown(e: MouseEvent): void {
		// Middle-mouse button for panning
		if (e.button === 1) {
			e.preventDefault();
			this.panState.startPan(e.clientX, e.clientY);
		}
	}

	private handleMouseMove(e: MouseEvent): void {
		const delta = this.panState.updatePan(e.clientX, e.clientY);
		if (delta) {
			this.callbacks.onPan(delta.deltaX, delta.deltaY);
		} else {
			const coord = this.getHexAtMouse(e);
			this.callbacks.onHexHover?.(coord);
		}
	}

	private handleMouseUp(e: MouseEvent): void {
		if (e.button === 1) {
			this.panState.endPan();
		}
	}

	private handleMouseLeave(): void {
		this.panState.endPan();
		this.callbacks.onHexHover?.(null);
	}

	private handleWheel(e: WheelEvent): void {
		e.preventDefault();
		const rect = this.container.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		const delta = e.deltaY < 0 ? 1 : -1;
		this.callbacks.onZoom(delta, mouseX, mouseY);
	}

	private handleClick(e: MouseEvent): void {
		if (e.button === 0) {
			const coord = this.getHexAtMouse(e);
			if (coord) {
				this.callbacks.onHexClick?.(coord, 0);
			}
		}
	}

	private handleContextMenu(e: MouseEvent): void {
		e.preventDefault();
		const coord = this.getHexAtMouse(e);
		if (coord) {
			this.callbacks.onHexClick?.(coord, 2);
		}
	}

	// ========================================================================
	// Hit Testing & Rendering
	// ========================================================================

	private getHexAtMouse(e: MouseEvent): AxialCoord | null {
		return hitTestHexFromEvent(e, this.container, {
			center: this.config.center,
			hexSize: this.config.hexSize,
			padding: this.config.padding,
			camera: this.camera,
		}, this.tiles);
	}

	private render(): void {
		renderHexMap(this.container, this.tiles, this.coords, {
			center: this.config.center,
			hexSize: this.config.hexSize,
			padding: this.config.padding,
			camera: this.camera,
			colorFn: this.config.colorFn ?? (() => '#888888'),
			strokeColor: this.config.strokeColor ?? '#333',
			strokeWidth: this.config.strokeWidth ?? 1,
		});
	}
}
