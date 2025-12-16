/**
 * Derived Layers Panel
 *
 * Phase 2 of the guided map setup workflow. Allows users to calculate
 * moisture, flora, and terrain from base layers (elevation, groundwater, etc.).
 *
 * Features:
 * - "Calculate All" button to derive all properties at once
 * - Per-layer status (auto-calculated vs. manual edits)
 * - "Recalc" buttons to recalculate individual layers
 * - "Manual Override Brush" to switch to manual editing mode
 * - "Continue →" button for guided flow (first-time setup only)
 *
 * Integration:
 * - Moisture + Flora: Uses climate/derivation-engine
 * - Terrain: Uses climate/terrain-derivation
 * - Reads tiles from TileStore via context
 * - Updates via undo manager for reversibility
 *
 * @module workmodes/cartographer/editor/tools/derived-layers
 */

import { Notice } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-derived-layers");
import { buildForm, type FormBuilderResult } from "../../form-builder";
import { deriveForMap, deriveTerrainForMap } from "@features/climate";
import { getMapSession } from "@features/maps/session";
import { coordToKey } from "@geometry";
import type { TileData } from "@services/domain/tile-types";
import type { AxialCoord } from "@geometry";
import type { ToolPanelContext, ToolPanelHandle } from '../base/base-tool-types';

// ============================================================================
// Types
// ============================================================================

/**
 * Status breakdown for each derived layer.
 * Tracks how many hexes are auto-calculated vs. manually edited.
 */
interface DerivedLayerStatus {
	moisture: { autoCount: number; manualCount: number };
	flora: { autoCount: number; manualCount: number };
	terrain: { autoCount: number; manualCount: number };
}

// ============================================================================
// Status Calculation
// ============================================================================

/**
 * Calculate status for all derived layers.
 *
 * Counts hexes with:
 * - Auto-derived properties (derivations.X.source === 'auto')
 * - Manual overrides (derivations.X.source === 'manual')
 *
 * @param tiles - Map of tile data keyed by coordinate string
 * @returns Status breakdown for each layer
 */
function calculateStatus(tiles: Map<string, TileData>): DerivedLayerStatus {
	const status: DerivedLayerStatus = {
		moisture: { autoCount: 0, manualCount: 0 },
		flora: { autoCount: 0, manualCount: 0 },
		terrain: { autoCount: 0, manualCount: 0 },
	};

	for (const tile of tiles.values()) {
		// Moisture
		if (tile.moisture) {
			const source = tile.derivations?.moisture?.source;
			if (source === "auto") {
				status.moisture.autoCount++;
			} else if (source === "manual") {
				status.moisture.manualCount++;
			}
		}

		// Flora
		if (tile.flora) {
			const source = tile.derivations?.flora?.source;
			if (source === "auto") {
				status.flora.autoCount++;
			} else if (source === "manual") {
				status.flora.manualCount++;
			}
		}

		// Terrain
		if (tile.terrain) {
			const source = tile.derivations?.terrain?.source;
			if (source === "auto") {
				status.terrain.autoCount++;
			} else if (source === "manual") {
				status.terrain.manualCount++;
			}
		}
	}

	return status;
}

// ============================================================================
// Panel Class
// ============================================================================

/**
 * Derived Layers Panel
 *
 * Manages calculation and display of derived map properties.
 * Integrates with climate/derivation-engine for moisture + flora,
 * and climate/terrain-derivation for terrain type.
 */
class DerivedLayersPanel {
	private root: HTMLElement;
	private ctx: ToolPanelContext;
	private form: FormBuilderResult | null = null;
	private status: DerivedLayerStatus = {
		moisture: { autoCount: 0, manualCount: 0 },
		flora: { autoCount: 0, manualCount: 0 },
		terrain: { autoCount: 0, manualCount: 0 },
	};

	// Status display elements
	private moistureStatus: HTMLElement | null = null;
	private floraStatus: HTMLElement | null = null;
	private terrainStatus: HTMLElement | null = null;

	constructor(root: HTMLElement, ctx: ToolPanelContext) {
		this.root = root;
		this.ctx = ctx;
		this.buildUI();
		this.updateStatusDisplay();
	}

	// ========================================================================
	// UI Construction
	// ========================================================================

	private buildUI(): void {
		this.form = buildForm(this.root, {
			sections: [
				// Header
				{ kind: "header", text: "Derived Layers" },

				// Hint
				{
					kind: "hint",
					text: "Calculate moisture, flora, and terrain from base layers (elevation, groundwater, etc.)",
					cls: "sm-hint",
				},

				// Calculate All button
				{
					kind: "button",
					label: "⚡ Calculate All",
					cls: "sm-button sm-button--primary sm-button--full-width",
					onClick: () => this.calculateAll(),
				},

				// Moisture Section
				{
					kind: "section",
					label: "Moisture",
					controls: [
						{
							kind: "hint",
							id: "moisture-status",
							text: "",
							cls: "sm-layer-status",
						},
						{
							kind: "button-group",
							buttons: [
								{
									label: "Recalc",
									cls: "sm-button sm-button--secondary",
									onClick: () => this.recalcLayer("moisture"),
								},
								{
									label: "Manual Override Brush",
									cls: "sm-button sm-button--secondary",
									onClick: () => this.switchToManualBrush("moisture"),
								},
							],
						},
					],
				},

				// Flora Section
				{
					kind: "section",
					label: "Flora",
					controls: [
						{
							kind: "hint",
							id: "flora-status",
							text: "",
							cls: "sm-layer-status",
						},
						{
							kind: "button-group",
							buttons: [
								{
									label: "Recalc",
									cls: "sm-button sm-button--secondary",
									onClick: () => this.recalcLayer("flora"),
								},
								{
									label: "Manual Override Brush",
									cls: "sm-button sm-button--secondary",
									onClick: () => this.switchToManualBrush("flora"),
								},
							],
						},
					],
				},

				// Terrain Section
				{
					kind: "section",
					label: "Terrain",
					controls: [
						{
							kind: "hint",
							id: "terrain-status",
							text: "",
							cls: "sm-layer-status",
						},
						{
							kind: "button-group",
							buttons: [
								{
									label: "Recalc",
									cls: "sm-button sm-button--secondary",
									onClick: () => this.recalcLayer("terrain"),
								},
								{
									label: "Manual Override Brush",
									cls: "sm-button sm-button--secondary",
									onClick: () => this.switchToManualBrush("terrain"),
								},
							],
						},
					],
				},

				// Continue button (for guided flow)
				{
					kind: "button",
					label: "Finish Setup →",
					cls: "sm-button sm-button--primary sm-button--full-width",
					onClick: () => this.finishSetup(),
				},
			],
		});

		// Store status element references
		this.moistureStatus = this.form.getControl("moisture-status");
		this.floraStatus = this.form.getControl("flora-status");
		this.terrainStatus = this.form.getControl("terrain-status");
	}

	// ========================================================================
	// Status Display
	// ========================================================================

	/**
	 * Update status indicators for all layers.
	 * Reads current tile data and displays counts.
	 */
	private updateStatusDisplay(): void {
		const file = this.ctx.getFile();
		if (!file) {
			logger.warn("DerivedLayersPanel", "Cannot update status: no file loaded");
			return;
		}

		// Get tile cache and current state
		const { tileCache } = getMapSession(this.ctx.app, file);
		const state = tileCache.getState();

		// Guard: tiles may be undefined if store not yet initialized
		if (!state?.tiles) {
			logger.debug("updateStatusDisplay", "Tiles not yet available, skipping status update");
			return;
		}

		// Extract TileData from TileRecord entries for status calculation
		const tileDataMap = new Map<string, TileData>();
		for (const [key, record] of state.tiles) {
			tileDataMap.set(key, record.data as TileData);
		}
		this.status = calculateStatus(tileDataMap);

		// Update moisture status
		if (this.moistureStatus) {
			const { autoCount, manualCount } = this.status.moisture;
			const indicator = autoCount > 0 && manualCount === 0 ? "●" : "○";
			const text =
				manualCount > 0
					? `Status: ${indicator} ${manualCount} hexes manually edited`
					: `Status: ${indicator} Auto-calculated`;
			this.moistureStatus.textContent = text;
		}

		// Update flora status
		if (this.floraStatus) {
			const { autoCount, manualCount } = this.status.flora;
			const indicator = autoCount > 0 && manualCount === 0 ? "●" : "○";
			const text =
				manualCount > 0
					? `Status: ${indicator} ${manualCount} hexes manually edited`
					: `Status: ${indicator} Auto-calculated`;
			this.floraStatus.textContent = text;
		}

		// Update terrain status
		if (this.terrainStatus) {
			const { autoCount, manualCount } = this.status.terrain;
			const indicator = autoCount > 0 && manualCount === 0 ? "●" : "○";
			const text =
				manualCount > 0
					? `Status: ${indicator} ${manualCount} hexes manually edited`
					: `Status: ${indicator} Auto-calculated`;
			this.terrainStatus.textContent = text;
		}
	}

	// ========================================================================
	// Derivation Logic
	// ========================================================================

	/**
	 * Calculate all derived layers (moisture, flora, terrain).
	 *
	 * Workflow:
	 * 1. Get tiles from tile store
	 * 2. Get precipitation from rain shadow calculator
	 * 3. Get temperature from climate engine
	 * 4. Call deriveForMap() for moisture + flora
	 * 5. Call deriveTerrainForMap() for terrain
	 * 6. Update tile store with results
	 * 7. Refresh UI status
	 */
	private async calculateAll(): Promise<void> {
		const file = this.ctx.getFile();
		if (!file) {
			new Notice("Cannot calculate: no map file loaded");
			return;
		}

		this.ctx.setStatus("Calculating all derived layers...", "loading");

		try {
			// Get tile cache and current state
			const { tileCache } = getMapSession(this.ctx.app, file);
			const state = tileCache.getState();
			const tileRecords = state.tiles;

			// Extract TileData from TileRecord for derivation functions
			const tileDataMap = new Map<string, TileData>();
			for (const [key, record] of tileRecords) {
				tileDataMap.set(key, record.data as TileData);
			}

			// TODO: Get precipitation from rain shadow calculator
			// For now, use dummy function
			const getPrecipitation = (_coord: AxialCoord): number => 50;

			// TODO: Get temperature from climate engine
			// For now, use dummy function
			const getTemperature = (_coord: AxialCoord): number => 15;

			// Derive moisture + flora
			const moistureFloraResults = deriveForMap(tileDataMap, getPrecipitation, getTemperature);

			// Derive terrain
			const terrainResults = deriveTerrainForMap(tileDataMap);

			// Apply results to tile data
			// TODO: Batch update via undo manager for reversibility
			for (const result of moistureFloraResults) {
				const key = coordToKey(result.coord);
				const tile = tileDataMap.get(key);
				if (!tile) continue;

				if (result.moisture) {
					tile.moisture = result.moisture.value;
					if (!tile.derivations) tile.derivations = {};
					tile.derivations.moisture = { source: "auto" };
				}

				if (result.flora) {
					tile.flora = result.flora.value;
					if (!tile.derivations) tile.derivations = {};
					tile.derivations.flora = { source: "auto" };
				}
			}

			for (const result of terrainResults) {
				if (!result.terrain) continue;

				const key = coordToKey(result.coord);
				const tile = tileDataMap.get(key);
				if (!tile) continue;

				tile.terrain = result.terrain.value;
				if (!tile.derivations) tile.derivations = {};
				tile.derivations.terrain = { source: "auto" };
			}

			// Refresh UI
			this.updateStatusDisplay();

			this.ctx.setStatus("All layers calculated", "info");
			new Notice("Derived layers calculated successfully");

			logger.info("DerivedLayersPanel", "Calculated all derived layers", {
				moistureFlora: moistureFloraResults.length,
				terrain: terrainResults.filter((r) => r.terrain).length,
			});
		} catch (error) {
			logger.error("DerivedLayersPanel", "Failed to calculate all layers", { error });
			this.ctx.setStatus("Failed to calculate layers", "error");
			new Notice("Failed to calculate derived layers");
		}
	}

	/**
	 * Recalculate a single layer.
	 * Preserves manual edits (only recalculates auto-derived hexes).
	 *
	 * @param layer - Layer to recalculate
	 */
	private async recalcLayer(layer: "moisture" | "flora" | "terrain"): Promise<void> {
		const file = this.ctx.getFile();
		if (!file) {
			new Notice("Cannot recalculate: no map file loaded");
			return;
		}

		this.ctx.setStatus(`Recalculating ${layer}...`, "loading");

		try {
			// Get tile cache and current state
			const { tileCache } = getMapSession(this.ctx.app, file);
			const state = tileCache.getState();
			const tileRecords = state.tiles;

			// Extract TileData from TileRecord for derivation functions
			const tileDataMap = new Map<string, TileData>();
			for (const [key, record] of tileRecords) {
				tileDataMap.set(key, record.data as TileData);
			}

			// TODO: Get precipitation from rain shadow calculator
			const getPrecipitation = (_coord: AxialCoord): number => 50;

			// TODO: Get temperature from climate engine
			const getTemperature = (_coord: AxialCoord): number => 15;

			if (layer === "moisture" || layer === "flora") {
				const results = deriveForMap(tileDataMap, getPrecipitation, getTemperature);

				for (const result of results) {
					const key = coordToKey(result.coord);
					const tile = tileDataMap.get(key);
					if (!tile) continue;

					if (layer === "moisture" && result.moisture) {
						tile.moisture = result.moisture.value;
						if (!tile.derivations) tile.derivations = {};
						tile.derivations.moisture = { source: "auto" };
					}

					if (layer === "flora" && result.flora) {
						tile.flora = result.flora.value;
						if (!tile.derivations) tile.derivations = {};
						tile.derivations.flora = { source: "auto" };
					}
				}
			} else if (layer === "terrain") {
				const results = deriveTerrainForMap(tileDataMap);

				for (const result of results) {
					if (!result.terrain) continue;

					const key = coordToKey(result.coord);
					const tile = tileDataMap.get(key);
					if (!tile) continue;

					tile.terrain = result.terrain.value;
					if (!tile.derivations) tile.derivations = {};
					tile.derivations.terrain = { source: "auto" };
				}
			}

			// Refresh UI
			this.updateStatusDisplay();

			this.ctx.setStatus(`${layer} recalculated`, "info");
			new Notice(`${layer} recalculated successfully`);

			logger.info("DerivedLayersPanel", `Recalculated ${layer}`);
		} catch (error) {
			logger.error("DerivedLayersPanel", `Failed to recalculate ${layer}`, { error });
			this.ctx.setStatus(`Failed to recalculate ${layer}`, "error");
			new Notice(`Failed to recalculate ${layer}`);
		}
	}

	/**
	 * Switch to manual brush mode for a specific layer.
	 *
	 * TODO: Implement manual override brushes.
	 * For now, logs a message and notifies user.
	 *
	 * @param layer - Layer to manually edit
	 */
	private switchToManualBrush(layer: string): void {
		logger.info("DerivedLayersPanel", `TODO: Switch to manual ${layer} brush`);
		new Notice(`Manual ${layer} brush not yet implemented`);

		// Future: Switch to terrain-brush tool with specific layer enabled
		// this.ctx.switchTool?.("terrain-brush");
	}

	/**
	 * Finish guided setup flow.
	 *
	 * Marks Phase 2 (Derived Layers) as complete and proceeds to next phase.
	 * Currently just shows a notice; future implementation will:
	 * - Save completion flag to map metadata or local storage
	 * - Switch to next tool/phase
	 * - Hide this button on subsequent visits
	 */
	private finishSetup(): void {
		// Clear guided setup flag (hides "Weiter →" button in Base Layer tool)
		this.ctx.clearGuidedSetup?.();

		logger.info("DerivedLayersPanel", "User finished guided setup");
		new Notice("Setup complete! You can now start editing your map.");

		// TODO: Switch to next recommended tool (e.g., inspector or session runner)
	}

	// ========================================================================
	// Lifecycle
	// ========================================================================

	/**
	 * Activate panel (called when tool becomes active).
	 * Updates status display to reflect current map state.
	 */
	activate(): void {
		this.root.style.display = "";
		this.updateStatusDisplay();
		logger.debug("DerivedLayersPanel", "Activated");
	}

	/**
	 * Deactivate panel (called when tool becomes inactive).
	 * Hides panel but preserves state.
	 */
	deactivate(): void {
		this.root.style.display = "none";
		logger.debug("DerivedLayersPanel", "Deactivated");
	}

	/**
	 * Destroy panel (called on plugin unload).
	 * Cleanup resources.
	 */
	destroy(): void {
		this.form = null;
		this.moistureStatus = null;
		this.floraStatus = null;
		this.terrainStatus = null;
		logger.debug("DerivedLayersPanel", "Destroyed");
	}

	/**
	 * Get lifecycle handle for tool registry.
	 */
	getHandle(): ToolPanelHandle {
		return {
			activate: () => this.activate(),
			deactivate: () => this.deactivate(),
			destroy: () => this.destroy(),
			onMapRendered: () => this.updateStatusDisplay(),
		};
	}
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Factory function for tool registry.
 * Creates DerivedLayersPanel instance and returns lifecycle handle.
 *
 * @param container - Parent container element
 * @param ctx - Tool panel context
 * @returns Tool panel lifecycle handle
 */
export function mountDerivedLayersPanel(
	container: HTMLElement,
	ctx: ToolPanelContext
): ToolPanelHandle {
	const panel = new DerivedLayersPanel(container, ctx);
	return panel.getHandle();
}
