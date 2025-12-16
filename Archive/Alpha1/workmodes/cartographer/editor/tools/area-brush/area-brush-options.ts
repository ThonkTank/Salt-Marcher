/**
 * Area Brush Tool - Refactored with BaseDataBrushTool
 *
 * Region/Faction painting with automatic border visualization:
 * - Paint Mode: Assigns region or faction to hexes
 * - Erase Mode: Removes region or faction assignments
 * - Border Manager: Auto-renders area boundaries with labels
 * - Color Picker: Edit region/faction colors (auto-saves to entity file)
 * - Advanced Operations: Delete, Rename, Merge areas
 *
 * Migrated from 1,230 lines to ~500 lines using:
 * - BaseDataBrushTool (data loading, workspace subscriptions, circle management)
 * - Form Builder DSL (declarative UI)
 * - Standard error handling
 */

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-area-brush");
import { listTilesForMap } from "@features/maps/data/tile-repository";
import { ColorManager } from "@features/maps/config/color-manager";
import { DebouncedColorSetter } from "@features/maps/config/debounced-color-setter";
import { createBorderManager, type BorderManagerHandle, DebouncedBorderUpdater } from "@features/maps/rendering/core/borders";
import { enhanceSelectToSearch } from "@ui/components/search-dropdown";
import { LIBRARY_DATA_SOURCES } from "@services/orchestration";
import { buildForm } from "../../form-builder";
import { coordToKey } from "@geometry";
import { BaseDataBrushTool, type BrushState, type AxialCoord, type ToolPanelContext, type ToolPanelHandle } from "../base";
import { applyAreaBrush, type AreaType } from "./area-brush-core";
import type { Region } from "@features/maps/config/terrain";

/**
 * Area brush state (extends BrushState with area type and values)
 */
interface AreaBrushState extends BrushState {
	areaType: AreaType;
	regionValue: string;
	factionValue: string;
}

/**
 * Union type for regions and factions (both loaded by BaseDataBrushTool)
 */
type AreaEntity = Region | { name: string; type: "faction" };

/**
 * Area Brush Tool
 *
 * Paints region or faction assignments with automatic border visualization.
 * Uses BaseDataBrushTool for loading regions + factions from Library.
 */
export class AreaBrushTool extends BaseDataBrushTool<AreaEntity, AreaBrushState> {
	// UI control elements (for updates)
	private modeGroup: HTMLElement | null = null;
	private radiusSlider: HTMLInputElement | null = null;

	private regionSelect: HTMLSelectElement | null = null;
	private regionColorInput: HTMLInputElement | null = null;
	private regionContainer: HTMLElement | null = null;

	private factionSelect: HTMLSelectElement | null = null;
	private factionColorInput: HTMLInputElement | null = null;
	private factionContainer: HTMLElement | null = null;

	// Border manager for area visualization
	private borderManager: BorderManagerHandle | null = null;

	// Debounced border updater (prevents excessive recalculations during continuous painting)
	private borderUpdater = new DebouncedBorderUpdater();

	// Centralized color management
	private colorManager: ColorManager;
	private regionColorSetter: DebouncedColorSetter | null = null;
	private factionColorSetter: DebouncedColorSetter | null = null;

	// Manage button availability
	private manageCommandAvailable = false;

	// ============================================================
	// Constructor
	// ============================================================

	constructor(container: HTMLElement, ctx: ToolPanelContext) {
		super(container, ctx);
		this.colorManager = new ColorManager(ctx.app);
	}

	// ============================================================
	// BaseDataBrushTool Implementation
	// ============================================================

	protected getDefaultState(): AreaBrushState {
		return {
			brushRadius: 1,
			mode: "paint",
			areaType: "region",
			regionValue: "",
			factionValue: "",
		};
	}

	protected getDataSources() {
		return [
			LIBRARY_DATA_SOURCES.regions,
			LIBRARY_DATA_SOURCES.factions,
		];
	}

	protected updateDataDropdowns(items: AreaEntity[]): void {
		// Separate regions and factions
		const regions = items.filter(i => "terrain" in i) as Region[];
		// Factions have memberCount field (regions don't)
		const factions = items.filter(i => "memberCount" in i);

		logger.debug("updateDataDropdowns called", {
			itemCount: items.length,
			regionCount: regions.length,
			factionCount: factions.length,
			hasRegionSelect: !!this.regionSelect,
			hasFactionSelect: !!this.factionSelect,
		});

		// Update region dropdown
		if (this.regionSelect) {
			this.regionSelect.empty();
			this.regionSelect.createEl("option", { text: "(none)", value: "" });
			regions.forEach(r => {
				this.regionSelect!.createEl("option", {
					text: r.name || "(unnamed)",
					value: r.name ?? "",
				});
			});

			// Preserve selection if still available
			const hasSelection = Array.from(this.regionSelect.options).some(
				opt => opt.value === this.state.regionValue
			);
			if (!hasSelection) {
				this.state.regionValue = "";
			}
			this.regionSelect.value = this.state.regionValue;

			// Auto-select first region if none selected
			if (!this.state.regionValue && regions.length > 0) {
				const firstValue = regions[0].name ?? "";
				if (firstValue) {
					this.state.regionValue = firstValue;
					this.regionSelect.value = firstValue;
				}
			}
		}

		// Update faction dropdown
		if (this.factionSelect) {
			this.factionSelect.empty();
			this.factionSelect.createEl("option", { text: "(none)", value: "" });
			factions.forEach(f => {
				this.factionSelect!.createEl("option", {
					text: f.name || "(unnamed)",
					value: f.name ?? "",
				});
			});

			// Preserve selection if still available
			const hasSelection = Array.from(this.factionSelect.options).some(
				opt => opt.value === this.state.factionValue
			);
			if (!hasSelection) {
				this.state.factionValue = "";
			}
			this.factionSelect.value = this.state.factionValue;

			// Auto-select first faction if none selected
			if (!this.state.factionValue && factions.length > 0) {
				const firstValue = factions[0].name ?? "";
				if (firstValue) {
					this.state.factionValue = firstValue;
					this.factionSelect.value = firstValue;
				}
			}
		}
	}

	protected setupWorkspaceSubscriptions(): void {
		// Listen for region updates
		this.subscribeToWorkspace("salt:regions-updated", () => this.reloadData());

		// Listen for faction updates
		this.subscribeToWorkspace("salt:factions-updated", () => this.reloadData());
	}

	protected buildUI(): void {
		const form = buildForm(this.root, {
			sections: [
				// Header
				{ kind: "header", text: "Area Brush" },

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

				// Area Type Section with Radio Group
				{
					kind: "section",
					label: "Area Type",
					cls: "sm-brush-area-type-section",
					controls: [
						{
							kind: "hint",
							text: "Select whether to paint regions or factions",
							cls: "sm-hint-small",
						},
						{
							kind: "radio-group",
							id: "areaType",
							options: [
								{ value: "region", label: "Region" },
								{ value: "faction", label: "Faction" },
							],
							value: this.state.areaType,
							onChange: ({ value }) => {
								this.state.areaType = value as AreaType;
								this.updateAreaTypeVisibility();
							},
						},
					],
				},
			],
		});

		// Store control references
		this.modeGroup = form.getControl("mode");
		this.radiusSlider = form.getControl("brushRadius") as HTMLInputElement;

		// Region Section (manual construction for complex layout)
		this.regionContainer = this.root.createDiv({ cls: "sm-brush-layer-section sm-brush-layer-section--region" });
		this.regionContainer.createEl("h4", { text: "Region Selection", cls: "sm-brush-section-title" });

		const regionBody = this.regionContainer.createDiv({ cls: "sm-form-section-body" });

		const regionSelectRow = regionBody.createDiv({ cls: "sm-form-row" });
		regionSelectRow.createSpan({ text: "Region:", cls: "sm-form-label" });
		this.regionSelect = regionSelectRow.createEl("select", { cls: "sm-form-select" });
		this.regionSelect.createEl("option", { text: "(none)", value: "" });
		logger.debug("Region select created", { hasParent: !!this.regionSelect.parentElement });
		enhanceSelectToSearch(this.regionSelect, "Search region…");

		this.regionSelect.addEventListener("change", async () => {
			this.state.regionValue = this.regionSelect!.value;
			await this.loadRegionColor();
		});

		const regionColorRow = regionBody.createDiv({ cls: "sm-form-row" });
		regionColorRow.createSpan({ text: "Color:", cls: "sm-form-label" });
		this.regionColorInput = regionColorRow.createEl("input", {
			type: "color",
			cls: "sm-color-picker",
		});
		this.regionColorInput.value = "#2196f3"; // Default region color

		// Create debounced color setter (300ms debounce)
		this.regionColorSetter = new DebouncedColorSetter(this.colorManager, 300);
		this.regionColorInput.addEventListener("input", () => {
			if (this.state.regionValue && this.regionColorInput && this.regionColorSetter) {
				this.regionColorSetter.setColor("region", this.state.regionValue, this.regionColorInput.value);
			}
			// Debounce border update (color picker has 300ms vault write debounce)
			this.borderUpdater.schedule(() => this.updateBorders(), 300);
		});

		// Faction Section (manual construction for complex layout)
		this.factionContainer = this.root.createDiv({ cls: "sm-brush-layer-section sm-brush-layer-section--faction" });
		this.factionContainer.createEl("h4", { text: "Faction Selection", cls: "sm-brush-section-title" });

		const factionBody = this.factionContainer.createDiv({ cls: "sm-form-section-body" });

		const factionSelectRow = factionBody.createDiv({ cls: "sm-form-row" });
		factionSelectRow.createSpan({ text: "Faction:", cls: "sm-form-label" });
		this.factionSelect = factionSelectRow.createEl("select", { cls: "sm-form-select" });
		this.factionSelect.createEl("option", { text: "(none)", value: "" });
		logger.debug("Faction select created", { hasParent: !!this.factionSelect.parentElement });
		enhanceSelectToSearch(this.factionSelect, "Search faction…");

		this.factionSelect.addEventListener("change", async () => {
			this.state.factionValue = this.factionSelect!.value;
			await this.loadFactionColor();
		});

		const factionColorRow = factionBody.createDiv({ cls: "sm-form-row" });
		factionColorRow.createSpan({ text: "Color:", cls: "sm-form-label" });
		this.factionColorInput = factionColorRow.createEl("input", {
			type: "color",
			cls: "sm-color-picker",
		});
		this.factionColorInput.value = "#f44336"; // Default faction color

		// Create debounced color setter (300ms debounce)
		this.factionColorSetter = new DebouncedColorSetter(this.colorManager, 300);
		this.factionColorInput.addEventListener("input", () => {
			if (this.state.factionValue && this.factionColorInput && this.factionColorSetter) {
				this.factionColorSetter.setColor("faction", this.state.factionValue, this.factionColorInput.value);
			}
			// Debounce border update (color picker has 300ms vault write debounce)
			this.borderUpdater.schedule(() => this.updateBorders(), 300);
		});

		// Initial visibility
		this.updateAreaTypeVisibility();

		// Check manage command availability
		this.manageCommandAvailable = !!((this.ctx.app as any).commands?.commands?.["salt-marcher:open-library"]);

		logger.debug("buildUI completed", {
			hasRegionSelect: !!this.regionSelect,
			hasFactionSelect: !!this.factionSelect,
			hasRegionContainer: !!this.regionContainer,
			hasFactionContainer: !!this.factionContainer,
		});
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

		// Get current area value based on area type
		const currentAreaValue = this.state.areaType === "region"
			? this.state.regionValue
			: this.state.factionValue;

		// Calculate effective radius (display brushRadius - 1)
		const effectiveRadius = Math.max(0, this.state.brushRadius - 1);

		// Apply area brush to center coordinate
		await applyAreaBrush(
			this.ctx.app,
			file,
			coords[0], // Center coordinate
			{
				brushRadius: effectiveRadius,
				mode: this.state.mode,
				areaType: this.state.areaType,
				areaValue: currentAreaValue,
			},
			handles,
			{
				tool: {
					getAbortSignal: () => this.ctx.getAbortSignal(),
					setStatus: (message) => this.ctx.setStatus(message),
				},
				toolName: "Area Brush",
			}
		);

		// Debounce border update (wait for painting to pause)
		this.borderUpdater.schedule(() => this.updateBorders(), 300);
	}

	protected onModeChanged(): void {
		// Mode is handled by Form Builder toggle buttons
		// No additional UI update needed
	}

	// ============================================================
	// Lifecycle Overrides (Border Manager)
	// ============================================================

	activate(): void {
		super.activate();

		// Create border manager
		const handles = this.ctx.getHandles();
		const options = this.ctx.getOptions();
		if (handles && options) {
			this.ensureBorderManager(handles, options);
			void this.updateBorders();
		}
	}

	deactivate(): void {
		super.deactivate();

		// Destroy border manager
		this.borderManager?.destroy();
		this.borderManager = null;
	}

	async onMapRendered(): Promise<void> {
		await super.onMapRendered();

		// Recreate border manager
		const handles = this.ctx.getHandles();
		const options = this.ctx.getOptions();
		if (handles && options) {
			this.ensureBorderManager(handles, options);
			await this.updateBorders();
		}
	}

	destroy(): void {
		// Destroy border manager before parent cleanup
		this.borderManager?.destroy();
		this.borderManager = null;

		// Destroy border updater (cancel pending updates)
		this.borderUpdater.destroy();

		// Flush debounced color setters (cancel pending writes)
		this.regionColorSetter?.flush();
		this.factionColorSetter?.flush();

		super.destroy();
	}

	// ============================================================
	// Helper Methods
	// ============================================================

	/**
	 * Update area type visibility (show/hide region/faction sections)
	 */
	private updateAreaTypeVisibility(): void {
		if (this.regionContainer) {
			this.regionContainer.style.display = this.state.areaType === "region" ? "block" : "none";
		}
		if (this.factionContainer) {
			this.factionContainer.style.display = this.state.areaType === "faction" ? "block" : "none";
		}
	}

	/**
	 * Load region color from Library (using ColorManager)
	 */
	private async loadRegionColor(): Promise<void> {
		if (this.state.regionValue && this.regionColorInput) {
			const color = await this.colorManager.getEntityColor("region", this.state.regionValue);
			this.regionColorInput.value = color;
		}
	}

	/**
	 * Load faction color from Library (using ColorManager)
	 */
	private async loadFactionColor(): Promise<void> {
		if (this.state.factionValue && this.factionColorInput) {
			const color = await this.colorManager.getEntityColor("faction", this.state.factionValue);
			this.factionColorInput.value = color;
		}
	}

	/**
	 * Create or recreate border manager
	 */
	private ensureBorderManager(handles: any, options: any): void {
		this.borderManager?.destroy();
		this.borderManager = createBorderManager({
			svg: handles.svg,
			contentG: handles.contentG,
			hexRadiusPx: options.hexPixelSize ?? 42,
			areaType: this.state.areaType,
			base: handles.base,
			padding: handles.padding,
		});
	}

	/**
	 * Update border visualization (using ColorManager)
	 */
	private async updateBorders(): Promise<void> {
		const file = this.ctx.getFile();
		if (!file || !this.borderManager) return;

		try {
			const tiles = await listTilesForMap(this.ctx.app, file);
			const tileMap = new Map(
				tiles.map(t => [coordToKey(t.coord), t.data])
			);

			// Color lookup function using ColorManager
			const getColor = async (areaName: string): Promise<string | undefined> => {
				return await this.colorManager.getEntityColor(this.state.areaType, areaName);
			};

			await this.borderManager.update(tileMap, getColor);
		} catch (err) {
			logger.error("Failed to update borders", err);
		}
	}
}

/**
 * Factory function for tool registry
 *
 * Creates AreaBrushTool instance and returns ToolPanelHandle interface
 */
export function mountAreaBrushPanel(container: HTMLElement, ctx: ToolPanelContext): ToolPanelHandle {
	const tool = new AreaBrushTool(container, ctx);
	return tool.getHandle();
}

// Legacy exports for backwards compatibility
export type AreaBrushPanelContext = ToolPanelContext;
export type AreaBrushPanelControls = ToolPanelHandle;
