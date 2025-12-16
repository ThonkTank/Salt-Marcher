/**
 * Cartographer View
 *
 * Obsidian ItemView for hex map editing.
 * Handles all DOM manipulation and rendering.
 * Receives state from CartographerPresenter via render() callback.
 *
 * @module adapters/cartographer-view
 */

import type { WorkspaceLeaf } from 'obsidian';
import type { AxialCoord, CoordKey, TileData, MapListEntry } from '../../schemas';
import {
	CartographerPresenter,
	type CartographerState,
	type CartographerCallbacks,
	type ToolMode,
	TOOLS,
	TERRAIN_OPTIONS,
	FALLOFF_TYPES,
} from '../../orchestrators/cartographer';
import { formatTileForInspector } from '../../utils/inspector';
import { IncrementalRenderer } from '../../services/map';
import { hitTestHexFromEvent } from '../../utils/hex/hit-testing';
import { getTileColor } from '../../utils/render/tile-colors';
import { getBrushPreview } from '../../utils/brush/brush-geometry';
import { MapStore } from '../map';
import {
	BaseItemView,
	MapSelectModal,
	styleTopBar,
	PanState,
	createSelectControl,
	createSliderWithInput,
	createSimpleButtonToggle,
	createButtonToggle,
	createLabelValuePair,
	createFlexContainer,
	styleMapContainer,
	createSidePanel,
	createDivider,
	createEmptyHint,
	type SelectOption,
} from '../shared';
import { CreateMapModal, ConfirmDeleteModal } from '../shared/modals';
import {
	coordToKey,
	axialToPixel,
	calculateFalloff,
	hexPolygonPoints,
} from '../../utils';

// ============================================================================
// Constants
// ============================================================================

export const CARTOGRAPHER_VIEW_TYPE = 'salt-marcher-cartographer';

// ============================================================================
// CartographerView
// ============================================================================

export class CartographerView extends BaseItemView<CartographerState, CartographerCallbacks> {
	private store: MapStore | null = null;

	// DOM References
	private topBarEl: HTMLElement | null = null;
	private mapNameEl: HTMLElement | null = null;
	private mapContainer: HTMLElement | null = null;
	private toolPanelEl: HTMLElement | null = null;

	// Incremental renderer for map tiles
	private renderer: IncrementalRenderer | null = null;

	// Brush indicator polygons (reused to avoid DOM churn)
	private brushIndicatorPolygons: SVGPolygonElement[] = [];

	// Interaction state (View-only)
	private panState = new PanState();
	private isPainting = false;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	// ========================================================================
	// Obsidian ItemView Requirements
	// ========================================================================

	getViewType(): string {
		return CARTOGRAPHER_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Cartographer';
	}

	getIcon(): string {
		return 'map';
	}

	// ========================================================================
	// Public API (for plugin commands)
	// ========================================================================

	/**
	 * Trigger undo operation (called by plugin command).
	 */
	triggerUndo(): void {
		this.callbacks?.onUndo();
	}

	/**
	 * Trigger redo operation (called by plugin command).
	 */
	triggerRedo(): void {
		this.callbacks?.onRedo();
	}

	// ========================================================================
	// BaseItemView Implementation
	// ========================================================================

	protected getContainerClass(): string {
		return 'salt-marcher-cartographer';
	}

	protected createPresenter(): CartographerPresenter {
		this.store = new MapStore(this.app.vault, 'SaltMarcher/maps');
		return new CartographerPresenter();
	}

	protected createLayout(container: HTMLElement): void {
		// Top bar
		this.topBarEl = container.createDiv({ cls: 'cartographer-topbar' });
		styleTopBar(this.topBarEl);

		// Content area (flex row)
		const content = createFlexContainer(container, 'cartographer-content');

		// Map container (left, flex: 1)
		this.mapContainer = content.createDiv({ cls: 'cartographer-map-container' });
		styleMapContainer(this.mapContainer);

		// Tool panel (right, fixed width)
		this.toolPanelEl = createSidePanel(content, 'cartographer-tools', 200, 'right');
	}

	protected onPresenterReady(): void {
		this.setupEventListeners();
	}

	protected cleanupDomRefs(): void {
		this.renderer?.destroy();
		this.renderer = null;
		this.store = null;
		this.topBarEl = null;
		this.mapNameEl = null;
		this.mapContainer = null;
		this.toolPanelEl = null;
		this.brushIndicatorPolygons = [];
	}

	// ========================================================================
	// Rendering (State -> DOM)
	// ========================================================================

	protected render(state: CartographerState): void {
		// Initialize renderer on first render
		if (!this.renderer && this.mapContainer) {
			this.renderer = new IncrementalRenderer();
			this.renderer.initialize(this.mapContainer);
		}

		// Handle render based on hint type
		switch (state.renderHint.type) {
			case 'full':
				this.renderTopBar(state);
				this.renderMapFull(state);
				this.renderToolPanel(state);
				this.renderBrushIndicator(state);
				break;

			case 'camera':
				this.renderer?.updateCamera(state.camera);
				this.renderBrushIndicator(state);
				break;

			case 'tiles':
				if (state.renderHint.changedTiles) {
					this.renderer?.updateTiles(state.tiles, state.renderHint.changedTiles);
				}
				break;

			case 'colors': {
				const colorContext = {
					activeTool: state.activeTool,
					selectedCoord: state.selectedCoord,
				};
				this.renderer?.updateConfig({
					colorFn: (tile: TileData, coord: AxialCoord) => getTileColor(tile, coord, colorContext),
				});
				this.renderer?.updateAllColors(state.tiles, state.coords);
				this.renderToolPanel(state);
				break;
			}

			case 'brush':
				this.renderBrushIndicator(state);
				break;

			case 'toolpanel':
				this.renderTopBar(state);
				this.renderToolPanel(state);
				break;
		}
	}

	private renderTopBar(state: CartographerState): void {
		if (!this.topBarEl) return;
		this.topBarEl.empty();

		// Map name (left)
		this.mapNameEl = this.topBarEl.createSpan({ cls: 'cartographer-map-name' });
		this.mapNameEl.style.fontWeight = '600';
		const dirtyMarker = state.isDirty ? ' \u2022' : '';
		this.mapNameEl.textContent = state.mapName + dirtyMarker;

		// Actions (right)
		const actions = this.topBarEl.createDiv({ cls: 'cartographer-actions' });
		actions.style.display = 'flex';
		actions.style.gap = '8px';

		const openBtn = actions.createEl('button', { text: 'Open' });
		openBtn.addEventListener('click', () => this.handleOpenClick());

		const newBtn = actions.createEl('button', { text: 'New' });
		newBtn.addEventListener('click', () => this.handleNewClick());

		const saveBtn = actions.createEl('button', { text: 'Save' });
		saveBtn.addEventListener('click', () => this.handleSaveClick());

		const deleteBtn = actions.createEl('button', { text: 'Delete' });
		deleteBtn.addEventListener('click', () => this.handleDeleteClick());
	}

	private renderMapFull(state: CartographerState): void {
		if (!this.renderer || state.coords.length === 0) return;

		const colorContext = {
			activeTool: state.activeTool,
			selectedCoord: state.selectedCoord,
		};

		// Set config and do full render
		this.renderer.setConfig({
			hexSize: state.hexSize,
			padding: state.padding,
			center: state.center,
			colorFn: (tile: TileData, coord: AxialCoord) => getTileColor(tile, coord, colorContext),
			strokeColor: '#333',
			strokeWidth: 1,
		});

		this.renderer.fullRender(state.tiles, state.coords, state.camera);
	}

	private renderToolPanel(state: CartographerState): void {
		if (!this.toolPanelEl || !this.callbacks) return;
		this.toolPanelEl.empty();

		const panel = this.toolPanelEl;
		panel.style.padding = '12px';
		panel.style.display = 'flex';
		panel.style.flexDirection = 'column';
		panel.style.gap = '12px';

		// Tool Mode Toggle (Brush / Inspector) - always visible
		this.createToolModeButtons(panel, state);

		// Divider
		createDivider(panel);

		// Mode-specific content
		if (state.toolMode === 'brush') {
			this.renderBrushPanel(panel, state);
		} else {
			this.renderInspectorPanel(panel, state);
		}
	}

	private createToolModeButtons(container: HTMLElement, state: CartographerState): void {
		const options: SelectOption<ToolMode>[] = [
			{ value: 'brush', label: 'Brush' },
			{ value: 'inspector', label: 'Inspector' },
		];
		createSimpleButtonToggle(container, options, state.toolMode, (value) => {
			this.callbacks?.onToolModeChange(value);
		});
	}


	private renderBrushPanel(container: HTMLElement, state: CartographerState): void {
		// Tool Selection
		this.createToolSelect(container, state);

		const isTerrain = state.activeTool === 'terrain';

		if (isTerrain) {
			// Terrain: Show terrain type dropdown
			this.createTerrainSelect(container, state);
		} else {
			// Numeric tools: Show mode toggle and value slider
			this.createBrushModeToggle(container, state);
			// Smooth mode doesn't need a value slider (uses neighbor average)
			if (state.brushConfig.mode !== 'smooth') {
				this.createValueInput(container, state);
			}
		}

		// Radius Slider (always shown)
		createSliderWithInput(container, 'Radius', { min: 1, max: 10, step: 1, value: state.brushConfig.radius }, (v) => {
			this.callbacks?.onBrushConfigChange('radius', v);
		});

		if (!isTerrain) {
			// Strength and Falloff only for numeric tools
			createSliderWithInput(container, 'Strength', { min: 0, max: 100, step: 1, value: state.brushConfig.strength }, (v) => {
				this.callbacks?.onBrushConfigChange('strength', v);
			});
			this.createFalloffSelect(container, state);
		}

		// Divider
		createDivider(container);

		// Finish Button
		const finishBtn = container.createEl('button', {
			text: 'Finish Editing',
			cls: 'mod-cta',
		});
		finishBtn.style.width = '100%';
		finishBtn.addEventListener('click', () => this.callbacks?.onFinishEditing());
	}

	private renderInspectorPanel(container: HTMLElement, state: CartographerState): void {
		if (!state.selectedCoord) {
			createEmptyHint(container, 'Click a tile to inspect', 'inspector-hint');
			return;
		}

		const key = coordToKey(state.selectedCoord);
		const tile = state.tiles.get(key);

		if (!tile) {
			createEmptyHint(container, 'Tile not found', 'inspector-hint');
			return;
		}

		const data = formatTileForInspector(tile, state.selectedCoord);

		// Coordinates
		createLabelValuePair(container, 'Coordinates', `(${data.coord.q}, ${data.coord.r})`);
		createLabelValuePair(container, 'Terrain', data.terrain);
		createLabelValuePair(container, 'Elevation', data.elevation);

		createDivider(container);

		// Climate
		createLabelValuePair(container, 'Temperature', data.temperature);
		createLabelValuePair(container, 'Precipitation', data.precipitation);
		createLabelValuePair(container, 'Clouds', data.clouds);
		createLabelValuePair(container, 'Wind', data.wind);

		createDivider(container);

		// Metadata
		createLabelValuePair(container, 'Region', data.region);
		createLabelValuePair(container, 'Faction', data.faction);
		createLabelValuePair(container, 'Note', data.note);
		createLabelValuePair(container, 'Creatures', String(data.creatureCount));
	}

	private renderBrushIndicator(state: CartographerState): void {
		const overlayGroup = this.renderer?.getOverlayGroup();

		// Clear existing indicator polygons
		for (const p of this.brushIndicatorPolygons) {
			p.remove();
		}
		this.brushIndicatorPolygons = [];

		// Don't render if not in brush mode or no hover coord
		if (!overlayGroup || state.toolMode !== 'brush' || !state.brushHoverCoord) {
			return;
		}

		// Get brush preview coords
		const preview = getBrushPreview(state.brushHoverCoord, state.brushConfig.radius);

		// Render indicator hexes in world space (camera transform applied by parent group)
		for (const coord of preview.coords) {
			const key = coordToKey(coord);

			// Skip if tile doesn't exist
			if (!state.tiles.has(key)) continue;

			const distance = preview.distances.get(key) ?? 0;
			const falloff = calculateFalloff(
				distance,
				state.brushConfig.radius,
				state.brushConfig.falloff
			);

			// Calculate world-space position (same as tile rendering)
			const pixel = axialToPixel(
				{ q: coord.q - state.center.q, r: coord.r - state.center.r },
				state.hexSize
			);
			const worldX = pixel.x + state.padding;
			const worldY = pixel.y + state.padding + state.hexSize;

			// Generate polygon points in world space
			const points = hexPolygonPoints(worldX, worldY, state.hexSize);

			// Create hex polygon
			const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
			polygon.setAttribute('points', points);
			polygon.setAttribute('fill', `rgba(255, 255, 255, ${0.3 * falloff})`);
			polygon.setAttribute('stroke', 'rgba(255, 255, 255, 0.6)');
			polygon.setAttribute('stroke-width', '1');
			polygon.style.pointerEvents = 'none';

			overlayGroup.appendChild(polygon);
			this.brushIndicatorPolygons.push(polygon);
		}
	}

	// ========================================================================
	// Event Handling (DOM -> Callbacks)
	// ========================================================================

	private setupEventListeners(): void {
		if (!this.mapContainer) return;

		// Mouse down - start painting/selecting or panning
		this.mapContainer.addEventListener('mousedown', (e) => {
			if (e.button === 0) {
				// Left click
				const coord = this.getHexAtMouse(e);
				if (this.lastState?.toolMode === 'inspector') {
					// Inspector mode: select tile
					this.callbacks?.onTileSelect(coord);
				} else {
					// Brush mode: start painting
					this.isPainting = true;
					this.callbacks?.onBrushStart();
					if (coord) this.callbacks?.onBrushApply(coord);
				}
			} else if (e.button === 1) {
				// Middle click - start panning
				e.preventDefault();
				this.panState.startPan(e.clientX, e.clientY);
			}
		});

		// Mouse move - continue painting, panning, or update hover
		this.mapContainer.addEventListener('mousemove', (e) => {
			const coord = this.getHexAtMouse(e);

			// Only update brush hover in brush mode
			if (this.lastState?.toolMode === 'brush') {
				this.callbacks?.onBrushHover(coord);

				// Drag-painting
				if (this.isPainting && coord) {
					this.callbacks?.onBrushApply(coord);
				}
			}

			// Panning (works in both modes)
			const delta = this.panState.updatePan(e.clientX, e.clientY);
			if (delta) {
				this.callbacks?.onPan(delta.deltaX, delta.deltaY);
			}
		});

		// Mouse up - stop painting or panning
		this.mapContainer.addEventListener('mouseup', (e) => {
			if (e.button === 0) {
				if (this.isPainting) {
					this.callbacks?.onBrushEnd();
				}
				this.isPainting = false;
			} else if (e.button === 1) {
				this.panState.endPan();
			}
		});

		// Mouse leave - stop everything
		this.mapContainer.addEventListener('mouseleave', () => {
			if (this.isPainting) {
				this.callbacks?.onBrushEnd();
			}
			this.isPainting = false;
			this.panState.endPan();
			if (this.lastState?.toolMode === 'brush') {
				this.callbacks?.onBrushHover(null);
			}
		});

		// Prevent context menu on middle click
		this.mapContainer.addEventListener('auxclick', (e) => {
			if (e.button === 1) e.preventDefault();
		});

		// Wheel - zoom
		this.mapContainer.addEventListener(
			'wheel',
			(e) => {
				e.preventDefault();
				if (!this.mapContainer) return;

				const rect = this.mapContainer.getBoundingClientRect();
				const mouseX = e.clientX - rect.left;
				const mouseY = e.clientY - rect.top;
				const delta = e.deltaY < 0 ? 1 : -1;

				this.callbacks?.onZoom(delta, mouseX, mouseY);
			},
			{ passive: false }
		);
	}

	private getHexAtMouse(e: MouseEvent): AxialCoord | null {
		if (!this.mapContainer || !this.lastState) return null;

		return hitTestHexFromEvent(e, this.mapContainer, {
			center: this.lastState.center,
			hexSize: this.lastState.hexSize,
			padding: this.lastState.padding,
			camera: this.lastState.camera,
		}, this.lastState.tiles);
	}

	// ========================================================================
	// Button Handlers (View coordinates Store + Presenter)
	// ========================================================================

	private async handleOpenClick(): Promise<void> {
		if (!this.store || !this.presenter) return;

		const maps = await this.store.list();
		if (maps.length === 0) return;

		const selected = await this.showOpenDialog(maps);
		if (selected) {
			const data = await this.store.load(selected.id);
			if (data) (this.presenter as CartographerPresenter).loadMapData(data);
		}
	}

	private async handleNewClick(): Promise<void> {
		const config = await this.showCreateDialog();
		if (config) {
			this.callbacks?.onCreateMap(config.name, config.radius);
		}
	}

	private async handleSaveClick(): Promise<void> {
		if (!this.presenter || !this.store) return;

		const data = (this.presenter as CartographerPresenter).serializeMap();
		if (data) {
			await this.store.save(data);
			(this.presenter as CartographerPresenter).markClean();
		}
	}

	private async handleDeleteClick(): Promise<void> {
		if (!this.presenter || !this.store || !this.lastState?.mapId) return;

		const confirmed = await this.showDeleteConfirmation(this.lastState.mapName);
		if (confirmed) {
			await this.store.delete(this.lastState.mapId);
			(this.presenter as CartographerPresenter).clearMap();
		}
	}

	// ========================================================================
	// Dialogs (Obsidian Modals - View responsibility)
	// ========================================================================

	private showOpenDialog(maps: MapListEntry[]): Promise<MapListEntry | null> {
		return new Promise((resolve) => {
			const modal = new MapSelectModal(this.app, maps, (selected) => {
				resolve(selected);
			});
			modal.open();
		});
	}

	private showCreateDialog(): Promise<{ name: string; radius: number } | null> {
		return new Promise((resolve) => {
			const modal = new CreateMapModal(this.app, (config) => {
				resolve(config);
			});
			modal.open();
		});
	}

	private showDeleteConfirmation(mapName: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmDeleteModal(this.app, mapName, (confirmed) => {
				resolve(confirmed);
			});
			modal.open();
		});
	}

	// ========================================================================
	// UI Helpers
	// ========================================================================

	private createToolSelect(container: HTMLElement, state: CartographerState): void {
		createSelectControl(container, 'Tool', TOOLS, state.activeTool, (value) => {
			this.callbacks?.onToolChange(value);
		});
	}

	private createTerrainSelect(container: HTMLElement, state: CartographerState): void {
		createSelectControl(container, 'Terrain Type', TERRAIN_OPTIONS, state.selectedTerrain, (value) => {
			this.callbacks?.onTerrainChange(value);
		});
	}

	private createBrushModeToggle(container: HTMLElement, state: CartographerState): void {
		const options: SelectOption<string>[] = [
			{ value: 'set', label: 'Set' },
			{ value: 'sculpt', label: 'Sculpt' },
			{ value: 'smooth', label: 'Smooth' },
			{ value: 'noise', label: 'Noise' },
		];
		createButtonToggle(container, 'Mode', options, state.brushConfig.mode, (value) => {
			this.callbacks?.onBrushConfigChange('mode', value as 'set' | 'sculpt' | 'smooth' | 'noise');
		});
	}

	private createValueInput(container: HTMLElement, state: CartographerState): void {
		const toolDef = TOOLS.find((t) => t.value === state.activeTool) ?? TOOLS[1];
		const step = this.getStepForTool(state.activeTool);

		// Sculpt mode uses limited range for finer control
		const isSculpt = state.brushConfig.mode === 'sculpt';
		const min = isSculpt ? -500 : (toolDef.min ?? 0);
		const max = isSculpt ? 500 : (toolDef.max ?? 100);

		createSliderWithInput(container, 'Value', { min, max, step, value: state.brushConfig.value }, (v) => {
			this.callbacks?.onBrushConfigChange('value', v);
		});
	}

	private createFalloffSelect(container: HTMLElement, state: CartographerState): void {
		createSelectControl(container, 'Falloff', FALLOFF_TYPES, state.brushConfig.falloff, (value) => {
			this.callbacks?.onBrushConfigChange('falloff', value);
		});
	}

	/**
	 * Get step size for a given tool type.
	 */
	private getStepForTool(tool: string): number {
		switch (tool) {
			case 'elevation':
				return 1;
			default:
				return 1;
		}
	}
}
