/**
 * Base class for all brush tools in Cartographer
 *
 * Provides common brush behavior:
 * - Brush circle management (visual preview)
 * - Lifecycle management (activate/deactivate/destroy)
 * - Hex click handling with radius support
 * - Mode toggle (paint/erase via X key)
 * - Standard error handling
 *
 * Subclasses must implement:
 * - `getDefaultState()` - Initial brush state
 * - `buildUI()` - Create tool panel UI
 * - `applyBrushLogic()` - Apply brush to target hexes
 * - `onModeChanged()` - Update UI when mode toggles
 *
 * @example
 * ```typescript
 * export class MyBrushTool extends BaseBrushTool {
 *   protected getDefaultState() {
 *     return { radius: 1, mode: "paint", customField: "value" };
 *   }
 *
 *   protected buildUI() {
 *     const form = buildForm(this.root, { ... });
 *   }
 *
 *   protected async applyBrushLogic(coords: AxialCoord[]) {
 *     await applyMyBrush(this.ctx.app, this.ctx.getFile(), coords, this.state);
 *   }
 * }
 * ```
 */

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-base-brush");
import { coordsInRadius, coordToKey } from "@geometry";
import { attachBrushCircle, type BrushCircleController } from "../brush-circle";
import { StandardErrorHandler } from "./standard-error-handler";
import type { BrushState, AxialCoord, ToolPanelContext, ToolPanelHandle } from './calendar-types';

/**
 * Base class for brush tools
 *
 * Eliminates ~60% code duplication across brush tools by centralizing:
 * - Circle management
 * - Lifecycle hooks
 * - Hex click handling
 * - Error reporting
 */
export abstract class BaseBrushTool<TState extends BrushState = BrushState> {
	/** Visual brush circle (follows mouse) */
	protected circle: BrushCircleController | null = null;

	/** Tool state (radius, mode, + subclass fields) */
	protected state: TState;

	/** Error handler (user-friendly messages) */
	protected errorHandler: StandardErrorHandler;

	/** Tool panel root element */
	protected readonly root: HTMLElement;

	/** Tool panel context (app, file, handles, etc.) */
	protected readonly ctx: ToolPanelContext;

	/**
	 * Create brush tool instance
	 *
	 * @param root - DOM element for tool panel
	 * @param ctx - Tool panel context (app, file, handles)
	 */
	constructor(root: HTMLElement, ctx: ToolPanelContext) {
		this.root = root;
		this.ctx = ctx;
		this.errorHandler = new StandardErrorHandler(ctx);
		this.state = this.getDefaultState();

		// Build UI (deactivated by default)
		this.root.classList.add("sm-cartographer__tool-panel", "is-disabled");
		this.buildUI();
	}

	// ============================================================
	// Lifecycle Methods (shared across all brush tools)
	// ============================================================

	/**
	 * Activate tool (show panel, enable listeners, create brush circle)
	 */
	activate(): void {
		this.root.classList.remove("is-disabled");
		this.ensureCircle();
		logger.debug(`[${this.constructor.name}] Activated`);
	}

	/**
	 * Deactivate tool (hide panel, disable listeners, destroy brush circle)
	 */
	deactivate(): void {
		this.root.classList.add("is-disabled");
		this.destroyCircle();
		logger.debug(`[${this.constructor.name}] Deactivated`);
	}

	/**
	 * Destroy tool (cleanup resources, remove listeners)
	 */
	destroy(): void {
		this.destroyCircle();
		this.root.empty();
		logger.debug(`[${this.constructor.name}] Destroyed`);
	}

	/**
	 * Called when map is rendered or re-rendered
	 *
	 * Override to refresh data or update UI
	 */
	async onMapRendered(): Promise<void> {
		this.ensureCircle();
	}

	// ============================================================
	// Brush Circle Management (eliminates duplication)
	// ============================================================

	/**
	 * Create or recreate brush circle
	 *
	 * Called on activate and when map renders
	 */
	protected ensureCircle(): void {
		const handles = this.ctx.getHandles();
		const options = this.ctx.getOptions();

		if (!handles || !options) {
			// This is expected during tool activation before map renders - use trace level (optional)
			logger.trace?.(`[${this.constructor.name}] Deferring brush circle creation (waiting for map render)`);
			return;
		}

		// Destroy existing circle
		this.destroyCircle();

		// Create new circle
		this.circle = attachBrushCircle(
			{
				svg: handles.svg,
				contentG: handles.contentG,
				overlay: handles.overlay,
			},
			{
				initialRadius: this.state.brushRadius,
				hexRadiusPx: options.hexPixelSize ?? 42,
			}
		);

		this.circle.show();
		logger.debug(`[${this.constructor.name}] Circle created`, { brushRadius: this.state.brushRadius });
	}

	/**
	 * Destroy brush circle
	 *
	 * Called on deactivate and before recreating circle
	 */
	protected destroyCircle(): void {
		if (this.circle) {
			this.circle.destroy();
			this.circle = null;
			logger.debug(`[${this.constructor.name}] Circle destroyed`);
		}
	}

	/**
	 * Update brush circle radius
	 *
	 * Call this when state.brushRadius changes
	 */
	protected updateCircleRadius(): void {
		if (this.circle) {
			this.circle.updateRadius(this.state.brushRadius);
			logger.debug(`[${this.constructor.name}] Circle radius updated`, { brushRadius: this.state.brushRadius });
		}
	}

	// ============================================================
	// Hex Click Handling (template method pattern)
	// ============================================================

	/**
	 * Handle hex click event
	 *
	 * Template method pattern:
	 * 1. Calculate affected hexes (coordsInRadius)
	 * 2. Ensure polygons exist for all targets
	 * 3. Capture before state for undo
	 * 4. Delegate to subclass's applyBrushLogic
	 * 5. Capture after state and push to undo stack
	 * 6. Handle errors with user feedback
	 *
	 * @param coord - Clicked hex coordinate
	 * @param event - Original pointer event
	 * @returns true if click was consumed
	 */
	async handleHexClick(coord: AxialCoord, event: PointerEvent): Promise<boolean> {
		try {
			// Step 1: Calculate affected hexes
			const targets = coordsInRadius(coord, this.state.brushRadius);
			logger.debug(`[${this.constructor.name}] Hex click`, {
				coord,
				brushRadius: this.state.brushRadius,
				targets: targets.length,
				mode: this.state.mode,
			});

			// Step 2: Ensure polygons exist (for tile creation)
			const handles = this.ctx.getHandles();
			if (handles) {
				handles.ensurePolys(targets);
			}

			// Step 3: Capture before state for undo
			const before = await this.captureTileState(targets);

			// Step 4: Apply brush logic (subclass implements)
			await this.applyBrushLogic(targets, event);

			// Step 5: Capture after state and push to undo stack
			const after = await this.captureTileState(targets);
			this.pushUndoEntry(targets, before, after);

			return true; // Click consumed
		} catch (err) {
			// Step 6: Handle errors with user feedback
			this.errorHandler.handle(err, {
				operation: "apply brush",
				tool: this.constructor.name,
				coord,
				details: {
					mode: this.state.mode,
					brushRadius: this.state.brushRadius,
				},
			});

			return false; // Click failed
		}
	}

	// ============================================================
	// Undo/Redo Support (template methods)
	// ============================================================

	/**
	 * Capture tile state for undo/redo
	 *
	 * Loads current tile data for all coordinates in the brush area.
	 *
	 * @param coords - Coordinates to capture
	 * @returns Array of tile data (null if tile doesn't exist)
	 */
	protected async captureTileState(coords: AxialCoord[]): Promise<Array<any | null>> {
		const file = this.ctx.getFile();
		if (!file) {
			return coords.map(() => null);
		}

		// Import getMapSession dynamically to avoid circular dependencies
		const { getMapSession } = await import("@features/maps/session");
		const { tileCache } = getMapSession(this.ctx.app, file);

		// Ensure cache is loaded
		await tileCache.load();

		// Get tiles, preserving coordinate order
		return coords.map((coord) => {
			const key = coordToKey(coord);
			return tileCache.get(key) ?? null;
		});
	}

	/**
	 * Push undo entry to undo manager
	 *
	 * Creates undo stack entry with before/after snapshots and pushes to stack.
	 * Safely handles cases where no map is loaded (undo manager not available).
	 *
	 * @param coords - Affected coordinates
	 * @param before - Tile states before operation
	 * @param after - Tile states after operation
	 */
	protected pushUndoEntry(
		coords: AxialCoord[],
		before: Array<any | null>,
		after: Array<any | null>
	): void {
		const state = this.state;
		const changedCount = coords.filter((_, i) => {
			const beforeData = before[i];
			const afterData = after[i];

			// Check if data actually changed
			return JSON.stringify(beforeData) !== JSON.stringify(afterData);
		}).length;

		if (changedCount === 0) {
			logger.debug(`[${this.constructor.name}] No changes to undo`);
			return;
		}

		// Safe accessor - skip undo if no map loaded
		const undoManager = this.ctx.getUndoManager();
		if (!undoManager) {
			logger.warn(`[${this.constructor.name}] UndoManager not available - skipping undo entry`);
			return;
		}

		undoManager.push({
			timestamp: Date.now(),
			operation: state.mode,
			tool: this.constructor.name,
			tiles: coords.map((coord, i) => ({
				coord,
				before: before[i],
				after: after[i],
			})),
			summary: this.generateUndoSummary(changedCount, state.mode),
		});

		logger.debug(`[${this.constructor.name}] Pushed undo entry`, {
			changedCount,
			mode: state.mode,
		});
	}

	/**
	 * Generate human-readable summary for undo operation
	 *
	 * Override in subclasses for tool-specific summaries.
	 *
	 * @param count - Number of changed tiles
	 * @param mode - Operation mode ("paint" or "erase")
	 * @returns Summary string for UI display
	 */
	protected generateUndoSummary(count: number, mode: string): string {
		const action = mode === "paint" ? "Painted" : "Erased";
		const plural = count === 1 ? "hex" : "hexes";
		return `${action} ${count} ${plural}`;
	}

	// ============================================================
	// Mode Toggle (X key shortcut support)
	// ============================================================

	/**
	 * Toggle between paint and erase modes
	 *
	 * Called by X key shortcut handler
	 */
	toggleMode(): void {
		this.state.mode = this.state.mode === "paint" ? "erase" : "paint";
		this.onModeChanged();
		logger.debug(`[${this.constructor.name}] Mode toggled`, { mode: this.state.mode });
	}

	// ============================================================
	// Abstract Methods (subclasses must implement)
	// ============================================================

	/**
	 * Get default brush state
	 *
	 * Called during construction. Return initial state with
	 * brushRadius, mode, and any subclass-specific fields.
	 *
	 * @example
	 * ```typescript
	 * protected getDefaultState() {
	 *   return {
	 *     brushRadius: 1,
	 *     mode: "paint",
	 *     terrainType: "plains",
	 *     flora: "medium"
	 *   };
	 * }
	 * ```
	 */
	protected abstract getDefaultState(): TState;

	/**
	 * Build tool panel UI
	 *
	 * Called during construction. Create UI controls using Form Builder DSL
	 * or manual DOM construction. Store control references for updates.
	 *
	 * @example
	 * ```typescript
	 * protected buildUI() {
	 *   const form = buildForm(this.root, {
	 *     sections: [
	 *       { kind: "header", text: "My Brush" },
	 *       { kind: "radius-slider", id: "brushRadius", onChange: ... }
	 *     ]
	 *   });
	 * }
	 * ```
	 */
	protected abstract buildUI(): void;

	/**
	 * Apply brush logic to target hexes
	 *
	 * Called by handleHexClick after calculating affected hexes.
	 * Implement tool-specific painting/erasing logic here.
	 *
	 * @param coords - Target hex coordinates (within radius)
	 * @param event - Original pointer event
	 *
	 * @example
	 * ```typescript
	 * protected async applyBrushLogic(coords: AxialCoord[]) {
	 *   const file = this.ctx.getFile();
	 *   if (!file) throw new Error("No map file");
	 *
	 *   await applyMyBrush(this.ctx.app, file, coords, this.state);
	 * }
	 * ```
	 */
	protected abstract applyBrushLogic(coords: AxialCoord[], event: PointerEvent): Promise<void>;

	/**
	 * Update UI when mode changes
	 *
	 * Called after mode toggle (X key). Update UI controls to reflect
	 * new mode (e.g., update mode dropdown, change button text).
	 *
	 * @example
	 * ```typescript
	 * protected onModeChanged() {
	 *   const modeSelect = this.root.querySelector<HTMLSelectElement>(".mode-select");
	 *   if (modeSelect) {
	 *     modeSelect.value = this.state.mode;
	 *   }
	 * }
	 * ```
	 */
	protected abstract onModeChanged(): void;

	// ============================================================
	// ToolPanelHandle Interface Adapter
	// ============================================================

	/**
	 * Convert tool instance to ToolPanelHandle interface
	 *
	 * Call this in factory function to return standard interface
	 *
	 * @example
	 * ```typescript
	 * export function mountMyBrushPanel(container, ctx) {
	 *   const tool = new MyBrushTool(container, ctx);
	 *   return tool.getHandle();
	 * }
	 * ```
	 */
	getHandle(): ToolPanelHandle {
		return {
			activate: () => this.activate(),
			deactivate: () => this.deactivate(),
			destroy: () => this.destroy(),
			handleHexClick: (coord, event) => this.handleHexClick(coord, event),
			toggleMode: () => this.toggleMode(),
			onMapRendered: () => this.onMapRendered(),
		};
	}
}
