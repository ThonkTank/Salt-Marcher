/**
 * Temperature Brush Tool - Refactored with Single Slider UI
 *
 * Simplified temperature offset painting:
 * - Single slider: -30°C to +30°C (targetOffset)
 * - Softness: 0-100% (0 = off, 100 = max falloff)
 * - Erase button: Sets offset to 0 or removes climate data
 *
 * Uses BaseBrushTool for:
 * - Circle management
 * - Lifecycle handling
 * - Hex click handling
 * - Standard error handling
 */

import { buildForm } from "../../form-builder";
import { BaseBrushTool, type BrushState, type AxialCoord, type ToolPanelContext, type ToolPanelHandle } from "../base";
import { applyTemperatureBrush } from "./climate-brush-core";

/**
 * Temperature brush state
 * - targetOffset: temperature offset in °C (-30 to +30)
 * - softness: brush falloff (0-100%, 0 = off)
 * - brushRadius: brush radius (1-6)
 */
interface TemperatureBrushState {
	brushRadius: number;      // 1-6
	targetOffset: number;     // -30 to +30 (can be negative!)
	softness: number;         // 0-100 (0 = off, 100 = max falloff)
}

/**
 * Temperature Brush Tool
 *
 * Paints temperature offsets onto tiles using a single slider.
 * Positive values increase temperature, negative values decrease it.
 */
export class ClimateBrushTool extends BaseBrushTool<TemperatureBrushState> {
	// Temperature overlay layer ID
	private static readonly TEMPERATURE_LAYER_ID = "temperature-overlay";

	// UI control elements (for updates)
	private offsetSlider: HTMLInputElement | null = null;
	private offsetValueDisplay: HTMLElement | null = null;
	private softnessSlider: HTMLInputElement | null = null;
	private softnessValueDisplay: HTMLElement | null = null;

	// ============================================================
	// BaseBrushTool Implementation
	// ============================================================

	protected getDefaultState(): TemperatureBrushState {
		return {
			brushRadius: 2,
			targetOffset: 5,
			softness: 0,
		};
	}

	protected buildUI(): void {
		const form = buildForm(this.root, {
			sections: [
				// Header
				{ kind: "header", text: "Temperature Brush" },

				// Description
				{
					kind: "hint",
					text: "Paint temperature offsets to modify local climate. Positive values increase temperature, negative values decrease it.",
					cls: "sm-brush-description",
				},

				// Target Offset slider (-30 to +30)
				{
					kind: "section",
					label: "Temperatur-Offset",
					id: "offsetSection",
					cls: "sm-brush-offset-section",
					controls: [
						{
							kind: "radius-slider",
							id: "offset",
							value: this.state.targetOffset + 30, // Map -30..30 to 0..60 for slider
							min: 0,
							max: 60,
							showLabel: false, // Section already has label
							onChange: ({ value, element }) => {
								this.state.targetOffset = value - 30; // Map back to -30..30
								this.offsetSlider = element;
								this.updateOffsetDisplay();
							},
						},
					],
				},
				{
					kind: "hint",
					id: "offset-value",
					text: this.getOffsetDisplayText(),
					cls: "sm-brush-offset-value",
				},
				{
					kind: "hint",
					text: "❄️ -30°C              0°C              +30°C 🔥",
					cls: "sm-brush-offset-scale",
				},

				// Reset Button
				{
					kind: "button",
					id: "erase-button",
					label: "Offset entfernen",
					cls: "sm-brush-erase-button",
					onClick: () => {
						this.state.targetOffset = 0;
						this.updateOffsetSliderPosition();
						this.updateOffsetDisplay();
					},
				},

				// Softness slider (0-100%)
				{
					kind: "section",
					label: "Softness",
					id: "softnessSection",
					cls: "sm-brush-softness-section",
					controls: [
						{
							kind: "radius-slider",
							id: "softness",
							value: this.state.softness,
							min: 0,
							max: 100,
							showLabel: false, // Section already has "Softness" label
							onChange: ({ value, element }) => {
								this.state.softness = value;
								this.softnessSlider = element;
								this.updateSoftnessDisplay();
							},
						},
					],
				},
				{
					kind: "hint",
					id: "softness-value",
					text: this.getSoftnessDisplayText(),
					cls: "sm-brush-softness-value",
				},
				{
					kind: "hint",
					text: "0% = Harte Kante         100% = Weicher Verlauf",
					cls: "sm-brush-softness-scale",
				},

				// Brush radius
				{
					kind: "section",
					label: "Radius",
					cls: "sm-brush-radius-section",
					controls: [
						{
							kind: "radius-slider",
							id: "brushRadius",
							value: this.state.brushRadius,
							min: 1,
							max: 6,
							onChange: ({ value, element }) => {
								this.state.brushRadius = value;
								this.updateCircleRadius();
							},
						},
					],
				},
			],
		});

		// Store control references
		this.offsetSlider = form.getControl("offset") as HTMLInputElement;
		this.offsetValueDisplay = form.getControl("offset-value");
		this.softnessSlider = form.getControl("softness") as HTMLInputElement;
		this.softnessValueDisplay = form.getControl("softness-value");

		// Set initial states
		this.updateOffsetDisplay();
		this.updateSoftnessDisplay();
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

		// Calculate effective radius (like terrain brush)
		const effectiveRadius = this.state.brushRadius - 1;

		// Apply temperature brush with new interface
		await applyTemperatureBrush(
			this.ctx.app,
			file,
			coords[0], // Center coordinate
			{
				brushRadius: effectiveRadius,
				targetOffset: this.state.targetOffset,
				softness: this.state.softness,
			},
			handles,
			{
				tool: {
					getAbortSignal: () => this.ctx.getAbortSignal(),
					setStatus: (message) => this.ctx.setStatus(message),
				},
				toolName: "Temperature Brush",
			}
		);
	}

	protected onModeChanged(): void {
		// Update UI when mode changes
		this.updateOffsetDisplay();
		this.updateSoftnessDisplay();
	}

	/**
	 * Override activate to auto-show temperature layer
	 */
	activate(): void {
		super.activate();
		this.showTemperatureLayer();
	}

	// ============================================================
	// Helper Methods
	// ============================================================

	/**
	 * Auto-show temperature overlay layer for visual feedback
	 */
	private showTemperatureLayer(): void {
		try {
			const layerPanel = this.ctx.getLayerPanel();
			if (layerPanel) {
				layerPanel.setLayerConfigById(
					ClimateBrushTool.TEMPERATURE_LAYER_ID,
					{ visible: true }
				);
			}
		} catch (error) {
			// Silently fail if layer panel not available
			// Tool should still work without auto-toggle
		}
	}

	/**
	 * Get display text for current offset value
	 * Uses emojis for clear visual feedback
	 */
	private getOffsetDisplayText(): string {
		const offset = this.state.targetOffset;
		if (offset === 0) {
			return "⚪ Neutral (0°C)";
		}
		if (offset > 0) {
			return `🔥 Wärmer: +${offset}°C`;
		}
		return `❄️ Kälter: ${offset}°C`;
	}

	/**
	 * Get display text for current softness value
	 */
	private getSoftnessDisplayText(): string {
		const softness = this.state.softness;
		if (softness === 0) {
			return "Softness: 0% (Aus)";
		}
		return `Softness: ${softness}%`;
	}

	/**
	 * Update offset display text
	 */
	private updateOffsetDisplay(): void {
		if (this.offsetValueDisplay) {
			this.offsetValueDisplay.textContent = this.getOffsetDisplayText();
		}
	}

	/**
	 * Update softness display text
	 */
	private updateSoftnessDisplay(): void {
		if (this.softnessValueDisplay) {
			this.softnessValueDisplay.textContent = this.getSoftnessDisplayText();
		}
	}

	/**
	 * Update offset slider position (when programmatically changing targetOffset)
	 */
	private updateOffsetSliderPosition(): void {
		if (this.offsetSlider) {
			// Map -30..30 to 0..60 for slider
			this.offsetSlider.value = String(this.state.targetOffset + 30);
		}
	}
}

/**
 * Mount climate brush panel (factory function for tool registry)
 */
export function mountClimateBrushPanel(root: HTMLElement, ctx: ToolPanelContext): ToolPanelHandle {
	return new ClimateBrushTool(root, ctx);
}
