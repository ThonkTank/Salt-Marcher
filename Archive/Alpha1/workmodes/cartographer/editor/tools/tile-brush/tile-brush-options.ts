/**
 * Tile Brush Tool - Refactored with BaseBrushTool
 *
 * Simple tile creation/deletion with default values:
 * - Paint Mode: Creates new tiles (plains + barren + elevation 0)
 * - Erase Mode: Deletes tiles completely
 *
 * Migrated from 301 lines of manual code to ~150 lines using:
 * - BaseBrushTool (circle management, lifecycle, hex click handling)
 * - Form Builder DSL (declarative UI)
 * - Standard error handling
 */

import { buildForm } from "../../form-builder";
import { BaseBrushTool, type BrushState, type AxialCoord, type ToolPanelContext, type ToolPanelHandle } from "../base";
import { applyTileBrush } from "./tile-brush-core";

/**
 * Tile brush state (only radius + mode, no layers)
 */
interface TileBrushState extends BrushState {
	// No additional fields needed - just radius and mode from BrushState
}

/**
 * Tile Brush Tool
 *
 * Creates or deletes tiles with default values.
 * Simplest brush tool - good reference implementation.
 */
export class TileBrushTool extends BaseBrushTool<TileBrushState> {
	// UI control elements (for updates)
	private modeGroup: HTMLElement | null = null;
	private radiusSlider: HTMLInputElement | null = null;

	// ============================================================
	// BaseBrushTool Implementation
	// ============================================================

	protected getDefaultState(): TileBrushState {
		return {
			brushRadius: 1,
			mode: "paint",
		};
	}

	protected buildUI(): void {
		const form = buildForm(this.root, {
			sections: [
				// Header
				{ kind: "header", text: "Tile Brush" },

				// Description
				{
					kind: "hint",
					text: "Create or delete tiles with default values (plains + barren + elevation 0).",
					cls: "sm-brush-description",
				},

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
							max: 5,
							onChange: ({ value, element }) => {
								this.state.brushRadius = value;
								this.radiusSlider = element;
								this.updateCircleRadius();
							},
						},
					],
				},

				// Help Text
				{
					kind: "hint",
					text: "Paint Mode: Creates new tiles (skips existing). Erase Mode: Deletes tiles completely.",
					cls: "sm-brush-help-text",
				},
				{
					kind: "hint",
					text: "Press X to toggle between Paint and Erase modes.",
					cls: "sm-brush-help-text",
				},
			],
		});

		// Store control references
		this.modeGroup = form.getControl("mode");
		this.radiusSlider = form.getControl("brushRadius") as HTMLInputElement;
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

		// Calculate effective radius (display brushRadius - 1)
		const effectiveRadius = Math.max(0, this.state.brushRadius - 1);

		// Apply tile brush to center coordinate
		await applyTileBrush(
			this.ctx.app,
			file,
			coords[0], // Center coordinate
			handles,
			{
				brushRadius: effectiveRadius,
				mode: this.state.mode,
			},
			{
				tool: {
					getAbortSignal: () => this.ctx.getAbortSignal(),
					setStatus: (message) => this.ctx.setStatus(message),
				},
				toolName: "Tile Brush",
			}
		);
	}

	protected onModeChanged(): void {
		// Mode is handled by Form Builder toggle buttons
		// No additional UI update needed
	}
}

/**
 * Factory function for tool registry
 *
 * Creates TileBrushTool instance and returns ToolPanelHandle interface
 */
export function mountTileBrushPanel(container: HTMLElement, ctx: ToolPanelContext): ToolPanelHandle {
	const tool = new TileBrushTool(container, ctx);
	return tool.getHandle();
}

// Legacy exports for backwards compatibility
export type TileBrushPanelContext = ToolPanelContext;
export type TileBrushPanelControls = ToolPanelHandle;
