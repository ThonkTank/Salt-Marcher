/**
 * Cartographer Presenter
 *
 * Manages state and event handling for map editing.
 * UI rendering is delegated to CartographerView (Adapters layer).
 *
 * @module presenters/cartographer
 */

import type { AxialCoord, CoordKey, TileData, MapData, MapMetadata, TerrainType } from '../schemas';
import type { CameraState, BrushConfig, BrushField, FalloffType } from '../utils';
import { applyBrush, applyTerrainBrush, UndoService } from '../services/map';
import { CameraService } from '../services/camera';
import { TERRAIN_TYPES } from '../constants/terrain';
import {
	DEFAULT_CAMERA_STATE,
	serializeMap,
	deserializeMap,
	generateDemoMap,
	coordToKey,
} from '../utils';
import { createNewMap } from '../services/map/map-logic';
import { BasePresenter } from './base-presenter';

// ============================================================================
// Types
// ============================================================================

/**
 * Tool mode - determines click behavior.
 * - brush: Paint tiles with active brush tool
 * - inspector: Select tiles to view data
 */
export type ToolMode = 'brush' | 'inspector';

/**
 * Render hint - tells View what changed and how to update efficiently.
 */
export type RenderHint =
	| { type: 'full' }
	| { type: 'camera' }
	| { type: 'tiles'; changedTiles: CoordKey[] }
	| { type: 'colors' }
	| { type: 'brush' }
	| { type: 'toolpanel' };

export type CartographerCallbacks = {
	onCreateMap: (name: string, radius: number) => void;
	onBrushStart: () => void;
	onBrushApply: (coord: AxialCoord) => void;
	onBrushEnd: () => void;
	onBrushHover: (coord: AxialCoord | null) => void;
	onPan: (deltaX: number, deltaY: number) => void;
	onZoom: (delta: number, mouseX: number, mouseY: number) => void;
	onToolChange: (tool: string) => void;
	onBrushConfigChange: <K extends keyof BrushConfig>(field: K, value: BrushConfig[K]) => void;
	onTerrainChange: (terrain: TerrainType) => void;
	onFinishEditing: () => void;
	onToolModeChange: (mode: ToolMode) => void;
	onTileSelect: (coord: AxialCoord | null) => void;
	onUndo: () => void;
	onRedo: () => void;
};

export type CartographerState = {
	mapId: string | null;
	mapName: string;
	isDirty: boolean;
	tiles: Map<CoordKey, TileData>;
	coords: AxialCoord[];
	selectedCoord: AxialCoord | null;
	activeTool: string;
	toolMode: ToolMode;
	brushConfig: BrushConfig;
	selectedTerrain: TerrainType;
	hexSize: number;
	padding: number;
	center: AxialCoord;
	camera: CameraState;
	brushHoverCoord: AxialCoord | null;
	renderHint: RenderHint;
};

export type RenderCallback = (state: CartographerState) => void;

// Re-export types from utils/brush for backward compatibility
export type { BrushConfig, FalloffType } from '../utils/brush';
export type { BrushMode } from '../utils/brush';

// ============================================================================
// Constants (exported for View to use)
// ============================================================================

export const TOOLS = [
	{ value: 'terrain', label: 'Terrain', isCategorical: true },
	{ value: 'elevation', label: 'Elevation', min: -10000, max: 10000, default: 0 },
	{ value: 'temperature', label: 'Temperature', min: 1, max: 12, default: 6 },
	{ value: 'precipitation', label: 'Precipitation', min: 1, max: 12, default: 6 },
	{ value: 'clouds', label: 'Clouds', min: 1, max: 12, default: 6 },
	{ value: 'wind', label: 'Wind', min: 1, max: 12, default: 6 },
];

export const TERRAIN_OPTIONS = TERRAIN_TYPES.map((t) => ({
	value: t,
	label: t.charAt(0).toUpperCase() + t.slice(1),
}));

export const FALLOFF_TYPES: { value: FalloffType; label: string }[] = [
	{ value: 'none', label: 'None' },
	{ value: 'linear', label: 'Linear' },
	{ value: 'smooth', label: 'Smooth' },
	{ value: 'gaussian', label: 'Gaussian' },
];

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_BRUSH_CONFIG: BrushConfig = {
	radius: 1,
	strength: 100,
	falloff: 'none',
	mode: 'set',
	value: 0,
};

const DEFAULT_HEX_SIZE = 42;
const DEFAULT_PADDING = 20;

// ============================================================================
// CartographerPresenter
// ============================================================================

export class CartographerPresenter extends BasePresenter<CartographerState, CartographerCallbacks> {
	private state: CartographerState;
	private metadata: MapMetadata | null = null;
	private cameraService: CameraService;
	private undoService: UndoService;
	/** Accumulates changes during a brush stroke (mousedown → mouseup) */
	private pendingUndo: {
		oldTiles: Map<CoordKey, TileData>;
		newTiles: Map<CoordKey, TileData>;
		affectedCoords: AxialCoord[];
	} | null = null;

	constructor() {
		super();
		this.state = this.createInitialState();
		this.cameraService = new CameraService();
		this.undoService = new UndoService();
		this.cameraService.subscribe((camera) => {
			this.state.camera = camera;
			this.state.renderHint = { type: 'camera' };
			this.updateView();
		});
	}

	// ========================================================================
	// View Connection (analog to LibraryPresenter)
	// ========================================================================

	/**
	 * Get callbacks for View events
	 */
	getCallbacks(): CartographerCallbacks {
		return {
			onCreateMap: (name, radius) => this.handleCreateMap(name, radius),
			onBrushStart: () => this.handleBrushStart(),
			onBrushApply: (coord) => this.handleBrushApply(coord),
			onBrushEnd: () => this.handleBrushEnd(),
			onBrushHover: (coord) => this.handleBrushHover(coord),
			onPan: (dx, dy) => this.handlePan(dx, dy),
			onZoom: (delta, x, y) => this.handleZoom(delta, x, y),
			onToolChange: (tool) => this.handleToolChange(tool),
			onBrushConfigChange: (field, value) => this.handleBrushConfigChange(field, value),
			onTerrainChange: (terrain) => this.handleTerrainChange(terrain),
			onFinishEditing: () => this.handleFinishEditing(),
			onToolModeChange: (mode) => this.handleToolModeChange(mode),
			onTileSelect: (coord) => this.handleTileSelect(coord),
			onUndo: () => this.handleUndo(),
			onRedo: () => this.handleRedo(),
		};
	}

	/**
	 * Initialize presenter (load initial data)
	 */
	async initialize(): Promise<void> {
		this.loadDemoMap();
	}

	/**
	 * Get current state (readonly)
	 */
	getState(): Readonly<CartographerState> {
		return this.state;
	}

	/**
	 * Cleanup when view is closed
	 */
	destroy(): void {
		super.destroy();
		this.cameraService.destroy();
		this.undoService.clear();
	}

	// ========================================================================
	// Event Handlers (Orchestration - NO business logic here)
	// ========================================================================

	/**
	 * Start brush stroke - begin accumulating changes for undo.
	 * Called on mousedown.
	 */
	private handleBrushStart(): void {
		this.pendingUndo = {
			oldTiles: new Map(),
			newTiles: new Map(),
			affectedCoords: [],
		};
	}

	/**
	 * End brush stroke - finalize and push accumulated changes to undo stack.
	 * Called on mouseup or mouseleave.
	 */
	private handleBrushEnd(): void {
		if (this.pendingUndo && this.pendingUndo.affectedCoords.length > 0) {
			this.undoService.push({
				affectedCoords: this.pendingUndo.affectedCoords,
				oldTiles: this.pendingUndo.oldTiles,
				newTiles: this.pendingUndo.newTiles,
			});
		}
		this.pendingUndo = null;
	}

	/**
	 * Apply brush at coordinate.
	 * Business logic lies in services/map/brush.ts
	 */
	private handleBrushApply(coord: AxialCoord): void {
		let result;

		if (this.state.activeTool === 'terrain') {
			// Terrain uses categorical brush (no interpolation)
			result = applyTerrainBrush(
				this.state.tiles,
				coord,
				this.state.brushConfig.radius,
				this.state.selectedTerrain
			);
		} else {
			// Numeric tools use standard brush
			const field = this.toolToField(this.state.activeTool);
			result = applyBrush(this.state.tiles, coord, this.state.brushConfig, field);
		}

		// Only proceed if tiles were actually modified
		if (result.affectedCoords.length === 0) return;

		// Accumulate for undo (stroke grouping)
		if (this.pendingUndo) {
			// Accumulate: only store first old value, always update new value
			for (const [key, tile] of result.oldTiles) {
				if (!this.pendingUndo.oldTiles.has(key)) {
					this.pendingUndo.oldTiles.set(key, tile);
					this.pendingUndo.affectedCoords.push(
						{ q: parseInt(key.split(',')[0]), r: parseInt(key.split(',')[1]) }
					);
				}
			}
			for (const [key, tile] of result.modifiedTiles) {
				this.pendingUndo.newTiles.set(key, tile);
			}
		}

		// Apply service result to state
		for (const [key, tile] of result.modifiedTiles) {
			this.state.tiles.set(key, tile);
		}

		// Update state flags and notify view
		this.state.isDirty = true;
		const changedTiles = result.affectedCoords.map(coordToKey);
		this.state.renderHint = { type: 'tiles', changedTiles };
		this.updateView();
	}

	/**
	 * Undo last brush operation.
	 */
	private handleUndo(): void {
		const entry = this.undoService.undo();
		if (entry) {
			this.applyUndoEntry(entry.oldTiles, entry.affectedCoords);
		}
	}

	/**
	 * Redo last undone operation.
	 */
	private handleRedo(): void {
		const entry = this.undoService.redo();
		if (entry) {
			this.applyUndoEntry(entry.newTiles, entry.affectedCoords);
		}
	}

	/**
	 * Apply tiles from undo/redo entry and update view.
	 */
	private applyUndoEntry(tiles: Map<CoordKey, TileData>, affectedCoords: AxialCoord[]): void {
		for (const [key, tile] of tiles) {
			this.state.tiles.set(key, tile);
		}
		this.state.isDirty = true;
		this.state.renderHint = { type: 'tiles', changedTiles: affectedCoords.map(coordToKey) };
		this.updateView();
	}

	/**
	 * Update brush hover coordinate
	 */
	private handleBrushHover(coord: AxialCoord | null): void {
		if (
			coord?.q !== this.state.brushHoverCoord?.q ||
			coord?.r !== this.state.brushHoverCoord?.r
		) {
			this.state.brushHoverCoord = coord;
			this.state.renderHint = { type: 'brush' };
			this.updateView();
		}
	}

	/**
	 * Handle camera pan - dispatch to CameraService
	 */
	private handlePan(deltaX: number, deltaY: number): void {
		this.cameraService.pan(deltaX, deltaY);
	}

	/**
	 * Handle camera zoom - dispatch to CameraService
	 */
	private handleZoom(delta: number, mouseX: number, mouseY: number): void {
		this.cameraService.zoom(delta, mouseX, mouseY);
	}

	/**
	 * Handle tool change
	 */
	private handleToolChange(tool: string): void {
		this.state.activeTool = tool;
		// Update value to tool's default (only for numeric tools)
		const toolDef = TOOLS.find((t) => t.value === tool);
		if (toolDef && toolDef.default !== undefined) {
			this.state.brushConfig.value = toolDef.default;
		}
		// Tool change affects tile colors (visualization changes)
		this.state.renderHint = { type: 'colors' };
		this.updateView();
	}

	/**
	 * Handle brush config change
	 */
	private handleBrushConfigChange<K extends keyof BrushConfig>(
		field: K,
		value: BrushConfig[K]
	): void {
		this.state.brushConfig[field] = value;
		// Slider fields use brush hint to avoid destroying slider mid-drag
		if (field === 'radius' || field === 'strength' || field === 'falloff' || field === 'value') {
			this.state.renderHint = { type: 'brush' };
		} else {
			this.state.renderHint = { type: 'toolpanel' };
		}
		this.updateView();
	}

	/**
	 * Handle terrain type change
	 */
	private handleTerrainChange(terrain: TerrainType): void {
		this.state.selectedTerrain = terrain;
		this.state.renderHint = { type: 'toolpanel' };
		this.updateView();
	}

	/**
	 * Handle finish editing button
	 */
	private handleFinishEditing(): void {
		this.state.selectedCoord = null;
		this.state.renderHint = { type: 'toolpanel' };
		this.updateView();
	}

	/**
	 * Handle tool mode change (brush/inspector)
	 */
	private handleToolModeChange(mode: ToolMode): void {
		this.state.toolMode = mode;
		if (mode === 'inspector') {
			this.state.brushHoverCoord = null;
		}
		this.state.renderHint = { type: 'toolpanel' };
		this.updateView();
	}

	/**
	 * Handle tile selection (inspector mode)
	 */
	private handleTileSelect(coord: AxialCoord | null): void {
		this.state.selectedCoord = coord;
		this.state.renderHint = { type: 'toolpanel' };
		this.updateView();
	}

	/**
	 * Handle create map request
	 */
	private handleCreateMap(name: string, radius: number): void {
		// Call service
		const data = createNewMap(name, radius);
		this.loadMapData(data);
	}

	// ========================================================================
	// Map Loading / Saving (Public API for View)
	// ========================================================================

	/**
	 * Load map data from MapData object.
	 */
	loadMapData(data: MapData): void {
		const { metadata, tiles, coords } = deserializeMap(data);
		this.state.hexSize = metadata.hexSize;
		this.loadMapState(metadata.id, metadata.name, metadata, tiles, coords, metadata.center, true);
	}

	/**
	 * Load a demo map (for initial display).
	 */
	loadDemoMap(): void {
		const center: AxialCoord = { q: 0, r: 0 };
		const { tiles, coords } = generateDemoMap(center, 5);
		this.loadMapState(null, 'Demo Map', null, tiles, coords, center, false);
	}

	/**
	 * Common map state initialization.
	 */
	private loadMapState(
		mapId: string | null,
		mapName: string,
		metadata: MapMetadata | null,
		tiles: Map<CoordKey, TileData>,
		coords: AxialCoord[],
		center: AxialCoord,
		resetCamera: boolean
	): void {
		this.metadata = metadata;
		this.state.mapId = mapId;
		this.state.mapName = mapName;
		this.state.tiles = tiles;
		this.state.coords = coords;
		this.state.center = center;
		this.state.selectedCoord = null;
		this.state.isDirty = false;
		this.state.renderHint = { type: 'full' };

		if (resetCamera) {
			this.cameraService.reset();
		}

		this.updateView();
	}

	/**
	 * Serialize current map for saving.
	 */
	serializeMap(): MapData | null {
		if (!this.metadata) return null;
		return serializeMap(this.metadata, this.state.tiles);
	}

	/**
	 * Mark map as clean (saved).
	 */
	markClean(): void {
		if (this.state.isDirty) {
			this.state.isDirty = false;
			this.state.renderHint = { type: 'toolpanel' };
			this.updateView();
		}
	}

	/**
	 * Clear map (load demo).
	 */
	clearMap(): void {
		this.loadDemoMap();
	}

	/**
	 * Reset camera to default position and zoom.
	 */
	resetCameraView(): void {
		this.cameraService.reset();
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private createInitialState(): CartographerState {
		return {
			mapId: null,
			mapName: 'Untitled',
			isDirty: false,
			tiles: new Map(),
			coords: [],
			selectedCoord: null,
			activeTool: 'terrain',
			toolMode: 'brush',
			brushConfig: { ...DEFAULT_BRUSH_CONFIG },
			selectedTerrain: 'grassland',
			hexSize: DEFAULT_HEX_SIZE,
			padding: DEFAULT_PADDING,
			center: { q: 0, r: 0 },
			camera: { ...DEFAULT_CAMERA_STATE },
			brushHoverCoord: null,
			renderHint: { type: 'full' },
		};
	}

	/**
	 * Convert tool name to BrushField.
	 */
	private toolToField(tool: string): BrushField {
		switch (tool) {
			case 'elevation':
				return 'elevation';
			case 'temperature':
				return 'climate.temperature';
			case 'precipitation':
				return 'climate.precipitation';
			case 'clouds':
				return 'climate.clouds';
			case 'wind':
				return 'climate.wind';
			default:
				return 'elevation';
		}
	}

	protected updateView(): void {
		super.updateView(this.state);
	}
}
