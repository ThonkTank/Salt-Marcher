/**
 * Terrain Brush Tool - Refactored with BaseBrushTool
 *
 * Multi-layer terrain painting with:
 * - Terrain Type layer (icon-based)
 * - Flora layer (icon-based)
 * - Moisture layer (10-level categorical system)
 *
 * Migrated from 443 lines of manual DOM construction to ~250 lines using:
 * - BaseBrushTool (circle management, lifecycle, hex click handling)
 * - Form Builder DSL (declarative UI)
 * - Standard error handling
 */

import { TERRAIN_ICONS, FLORA_ICONS, MOISTURE_LABELS, getTerrainTypes, getFloraTypes, getMoistureLevels } from "@features/maps/config/terrain";
import { enhanceSelectToSearch } from "@ui/components/search-dropdown";
import { buildForm } from "../../form-builder";
import { BaseBrushTool, type BrushState, type AxialCoord, type ToolPanelContext, type ToolPanelHandle } from "../base";
import { applyBrush } from "./brush-core";
import type { TerrainType, FloraType, MoistureLevel } from "@domain";

/**
 * Terrain brush state (extends BrushState with layer configuration)
 */
interface TerrainBrushState extends BrushState {
	layers: {
		terrainType: { enabled: boolean; value: TerrainType | "" };
		flora: { enabled: boolean; value: FloraType | "" };
		moisture: { enabled: boolean; value: MoistureLevel | "" };
	};
}

/**
 * Terrain Brush Tool
 *
 * Paints terrain type, flora, and moisture levels on hexes.
 * Uses icon-based terrain system (Phase 3) and 10-level moisture system.
 */
export class TerrainBrushTool extends BaseBrushTool<TerrainBrushState> {
	// UI control elements (for updates)
	private modeGroup: HTMLElement | null = null;
	private radiusSlider: HTMLInputElement | null = null;

	private terrainTypeCheckbox: HTMLInputElement | null = null;
	private terrainTypeSelect: HTMLSelectElement | null = null;

	private floraCheckbox: HTMLInputElement | null = null;
	private floraSelect: HTMLSelectElement | null = null;

	private moistureCheckbox: HTMLInputElement | null = null;
	private moistureSelect: HTMLSelectElement | null = null;

	// ============================================================
	// BaseBrushTool Implementation
	// ============================================================

	protected getDefaultState(): TerrainBrushState {
		return {
			brushRadius: 1,
			mode: "paint",
			layers: {
				terrainType: { enabled: false, value: "" },
				flora: { enabled: false, value: "" },
				moisture: { enabled: false, value: "" },
			},
		};
	}

	protected buildUI(): void {
		const form = buildForm(this.root, {
			sections: [
				// Header
				{ kind: "header", text: "Terrain Brush" },

				// Global Settings
				{
					kind: "section",
					label: "Global Settings",
					cls: "sm-brush-global-settings",
					controls: [
						{
							kind: "brush-mode-toggle",
							id: "mode",
							value: this.state.mode,
							onChange: ({ value }) => {
								this.state.mode = value;
							},
						},
						{
							kind: "radius-slider",
							id: "brushRadius",
							value: this.state.brushRadius,
							min: 1,
							max: 6,
							onChange: ({ value, element }) => {
								this.state.brushRadius = value;
								this.radiusSlider = element;
								this.updateCircleRadius();
							},
						},
					],
				},

				// Terrain Type Layer
				{
					kind: "section",
					label: "Terrain Type",
					cls: "sm-brush-layer-section sm-brush-layer-section--terrain-type",
					controls: [
						{
							kind: "checkbox",
							id: "terrain-enabled",
							label: "Enable Layer",
							checked: this.state.layers.terrainType.enabled,
							onChange: ({ checked, element }) => {
								this.state.layers.terrainType.enabled = checked;
								this.terrainTypeCheckbox = element;
							},
						},
						{
							kind: "select",
							id: "terrain-type",
							options: this.getTerrainTypeOptions(),
							value: this.state.layers.terrainType.value,
							onChange: ({ value, element }) => {
								this.state.layers.terrainType.value = value as TerrainType | "";
								this.terrainTypeSelect = element;
							},
						},
					],
				},

				// Flora Layer
				{
					kind: "section",
					label: "Flora",
					cls: "sm-brush-layer-section sm-brush-layer-section--flora",
					controls: [
						{
							kind: "checkbox",
							id: "flora-enabled",
							label: "Enable Layer",
							checked: this.state.layers.flora.enabled,
							onChange: ({ checked, element }) => {
								this.state.layers.flora.enabled = checked;
								this.floraCheckbox = element;
							},
						},
						{
							kind: "select",
							id: "flora-type",
							options: this.getFloraTypeOptions(),
							value: this.state.layers.flora.value,
							onChange: ({ value, element }) => {
								this.state.layers.flora.value = value as FloraType | "";
								this.floraSelect = element;
							},
						},
					],
				},

				// Moisture Layer
				{
					kind: "section",
					label: "Feuchtigkeit",
					cls: "sm-brush-layer-section sm-brush-layer-section--moisture",
					controls: [
						{
							kind: "checkbox",
							id: "moisture-enabled",
							label: "Enable Layer",
							checked: this.state.layers.moisture.enabled,
							onChange: ({ checked, element }) => {
								this.state.layers.moisture.enabled = checked;
								this.moistureCheckbox = element;
							},
						},
						{
							kind: "select",
							id: "moisture-level",
							options: this.getMoistureLevelOptions(),
							value: this.state.layers.moisture.value,
							onChange: ({ value, element }) => {
								this.state.layers.moisture.value = value as MoistureLevel | "";
								this.moistureSelect = element;
							},
						},
					],
				},
			],
		});

		// Store control references
		this.modeGroup = form.getControl("mode");
		this.radiusSlider = form.getControl("brushRadius") as HTMLInputElement;

		this.terrainTypeCheckbox = form.getControl("terrain-enabled") as HTMLInputElement;
		this.terrainTypeSelect = form.getControl("terrain-type") as HTMLSelectElement;

		this.floraCheckbox = form.getControl("flora-enabled") as HTMLInputElement;
		this.floraSelect = form.getControl("flora-type") as HTMLSelectElement;

		this.moistureCheckbox = form.getControl("moisture-enabled") as HTMLInputElement;
		this.moistureSelect = form.getControl("moisture-level") as HTMLSelectElement;

		// Enhance select dropdowns with search
		if (this.terrainTypeSelect) {
			enhanceSelectToSearch(this.terrainTypeSelect, "Search terrain type…");
		}
		if (this.floraSelect) {
			enhanceSelectToSearch(this.floraSelect, "Search flora type…");
		}
		if (this.moistureSelect) {
			enhanceSelectToSearch(this.moistureSelect, "Search moisture level…");
		}
	}

	protected async applyBrushLogic(coords: AxialCoord[]): Promise<void> {
		const file = this.ctx.getFile();
		const handles = this.ctx.getHandles();

		if (!file) {
			throw new Error("No map file selected");
		}

		if (!handles) {
			throw new Error("Map not rendered");
		}

		// Build layers array from state
		const layers = [
			{
				id: "terrainType" as const,
				enabled: this.state.layers.terrainType.enabled,
				value: this.state.layers.terrainType.value,
			},
			{
				id: "flora" as const,
				enabled: this.state.layers.flora.enabled,
				value: this.state.layers.flora.value,
			},
			{
				id: "moisture" as const,
				enabled: this.state.layers.moisture.enabled,
				value: this.state.layers.moisture.value,
			},
		];

		// Apply brush to first coord (center) - applyBrush handles radius internally
		await applyBrush(
			this.ctx.app,
			file,
			coords[0], // Center coordinate
			{
				brushRadius: this.state.brushRadius - 1, // effectiveRadius
				mode: this.state.mode,
				layers,
			},
			handles,
			{
				tool: {
					getAbortSignal: () => this.ctx.getAbortSignal(),
					setStatus: (message) => this.ctx.setStatus(message),
				},
				toolName: "Terrain Brush",
			}
		);
	}

	protected onModeChanged(): void {
		// Mode is handled by Form Builder toggle buttons
		// No additional UI update needed
	}

	// ============================================================
	// Helper Methods
	// ============================================================

	/**
	 * Get terrain type options for dropdown
	 */
	private getTerrainTypeOptions(): Array<{ value: string; label: string }> {
		const options: Array<{ value: string; label: string }> = [{ value: "", label: "(none)" }];

		for (const terrainType of getTerrainTypes()) {
			const icon = TERRAIN_ICONS[terrainType];
			options.push({
				value: terrainType,
				label: `${icon.emoji} ${icon.label}`,
			});
		}

		return options;
	}

	/**
	 * Get flora type options for dropdown
	 */
	private getFloraTypeOptions(): Array<{ value: string; label: string }> {
		const options: Array<{ value: string; label: string }> = [{ value: "", label: "(none)" }];

		for (const floraType of getFloraTypes()) {
			const icon = FLORA_ICONS[floraType];
			options.push({
				value: floraType,
				label: `${icon.emoji} ${icon.label}`,
			});
		}

		return options;
	}

	/**
	 * Get moisture level options for dropdown
	 */
	private getMoistureLevelOptions(): Array<{ value: string; label: string }> {
		const options: Array<{ value: string; label: string }> = [{ value: "", label: "(none)" }];

		for (const moistureLevel of getMoistureLevels()) {
			options.push({
				value: moistureLevel,
				label: MOISTURE_LABELS[moistureLevel],
			});
		}

		return options;
	}
}

/**
 * Factory function for tool registry
 *
 * Creates TerrainBrushTool instance and returns ToolPanelHandle interface
 */
export function mountBrushPanel(container: HTMLElement, ctx: ToolPanelContext): ToolPanelHandle {
	const tool = new TerrainBrushTool(container, ctx);
	return tool.getHandle();
}

// Legacy exports for backwards compatibility
export type BrushPanelContext = ToolPanelContext;
export type BrushPanelControls = ToolPanelHandle;
