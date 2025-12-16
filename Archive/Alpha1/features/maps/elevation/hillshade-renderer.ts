// src/features/maps/elevation/hillshade-renderer.ts
// SVG/Canvas rendering for hillshade overlay

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("hillshade-renderer");
import { calculateHillshade, type HillshadeConfig } from "@services/elevation";
import { getElevationStore } from "./index";
import type { Unsubscriber } from "@services/state";

/**
 * Hillshade style configuration
 */
export interface HillshadeStyle {
	/** Opacity (0.0-1.0) */
	opacity: number;
	/** Blend mode (multiply, overlay, soft-light) */
	blendMode: "multiply" | "overlay" | "soft-light" | "normal";
}

/**
 * Default hillshade style
 */
const DEFAULT_STYLE: HillshadeStyle = {
	opacity: 0.5,
	blendMode: "multiply", // Multiply darkens underlying colors
};

/**
 * Global hillshade renderer registry
 */
const hillshadeRenderers = new Map<string, HillshadeRenderer>();

/**
 * Get or create hillshade renderer for map file
 */
export function getHillshadeRenderer(app: App, mapFile: TFile, contentG: SVGGElement): HillshadeRenderer {
	const key = mapFile.path;

	if (hillshadeRenderers.has(key)) {
		return hillshadeRenderers.get(key)!;
	}

	const renderer = new HillshadeRenderer(app, mapFile, contentG);
	hillshadeRenderers.set(key, renderer);

	logger.debug(`Created renderer for ${mapFile.path}`);
	return renderer;
}

/**
 * Clear hillshade renderer from registry
 */
export function clearHillshadeRenderer(mapFile: TFile): void {
	const key = mapFile.path;
	const renderer = hillshadeRenderers.get(key);

	if (renderer) {
		renderer.destroy();
		hillshadeRenderers.delete(key);
		logger.debug(`Cleared renderer for ${mapFile.path}`);
	}
}

/**
 * Hide hillshade renderer without destroying it.
 *
 * Performance optimization: Keeps renderer instance and SVG elements in memory
 * but hidden. Use for map switching where you expect to return to this map.
 *
 * @param mapFile - Map file to hide renderer for
 * @returns true if renderer was hidden, false if no renderer exists
 */
export function hideHillshadeRenderer(mapFile: TFile): boolean {
	const key = mapFile.path;
	const renderer = hillshadeRenderers.get(key);

	if (renderer) {
		renderer.hide();
		logger.debug(`Hidden renderer for ${mapFile.path}`);
		return true;
	}
	return false;
}

/**
 * Show previously hidden hillshade renderer.
 *
 * @param mapFile - Map file to show renderer for
 * @returns true if renderer was shown, false if no renderer exists
 */
export function showHillshadeRenderer(mapFile: TFile): boolean {
	const key = mapFile.path;
	const renderer = hillshadeRenderers.get(key);

	if (renderer) {
		renderer.show();
		logger.debug(`Shown renderer for ${mapFile.path}`);
		return true;
	}
	return false;
}

/**
 * Clear all hillshade renderers
 */
export function clearAllHillshadeRenderers(): void {
	for (const renderer of hillshadeRenderers.values()) {
		renderer.destroy();
	}
	hillshadeRenderers.clear();
	logger.info("Cleared all hillshade renderers");
}

/**
 * Hillshade Renderer
 *
 * Renders hillshading as a grayscale overlay using Canvas + SVG foreignObject.
 *
 * **Why Canvas?**
 * - Hillshade is a raster effect (200×200 pixels)
 * - Canvas is more efficient than 40k SVG rectangles
 * - Native image manipulation APIs
 *
 * **Architecture:**
 * - Calculate hillshade intensity grid (Uint8ClampedArray)
 * - Render to Canvas as ImageData
 * - Embed Canvas in SVG via <foreignObject>
 * - Apply blend mode and opacity
 *
 * @example
 * ```typescript
 * const renderer = getHillshadeRenderer(app, mapFile, contentG);
 *
 * // Enable with default config
 * await renderer.enable({
 *   azimuth: 315,   // Northwest
 *   altitude: 45    // 45° above horizon
 * });
 *
 * // Update style
 * renderer.setStyle({
 *   opacity: 0.6,
 *   blendMode: "multiply"
 * });
 *
 * // Disable
 * renderer.disable();
 * ```
 */
export class HillshadeRenderer {
	private app: App;
	private mapFile: TFile;
	private contentG: SVGGElement;
	private hillshadeGroup: SVGGElement | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private config: HillshadeConfig | null = null;
	private style: HillshadeStyle = DEFAULT_STYLE;
	private unsubscribe: Unsubscriber | null = null;
	private enabled = false;

	constructor(app: App, mapFile: TFile, contentG: SVGGElement) {
		this.app = app;
		this.mapFile = mapFile;
		this.contentG = contentG;
	}

	/**
	 * Enable hillshade rendering with specified configuration
	 */
	async enable(config: Partial<HillshadeConfig> = {}): Promise<void> {
		if (this.enabled) {
			logger.warn("Already enabled, updating config");
		}

		this.config = {
			azimuth: 315,
			altitude: 45,
			zFactor: 1.0,
			...config,
		};

		this.enabled = true;

		// Create SVG group for hillshade
		if (!this.hillshadeGroup) {
			this.hillshadeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
			this.hillshadeGroup.setAttribute("class", "sm-hillshade-layer");
			// Insert at beginning (behind everything else)
			this.contentG.insertBefore(this.hillshadeGroup, this.contentG.firstChild);
		}

		// Subscribe to elevation store changes
		const elevStore = getElevationStore(this.app, this.mapFile);
		await elevStore.load();

		this.unsubscribe = elevStore.state.subscribe(() => {
			if (this.enabled) {
				this.regenerate();
			}
		});

		// Initial render
		await this.regenerate();

		logger.info("Enabled with config:", this.config);
	}

	/**
	 * Disable hillshade rendering
	 */
	disable(): void {
		if (!this.enabled) return;

		this.enabled = false;

		// Unsubscribe from elevation store
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		// Remove SVG group
		if (this.hillshadeGroup) {
			this.hillshadeGroup.remove();
			this.hillshadeGroup = null;
		}

		// Cleanup canvas
		this.canvas = null;

		logger.info("Disabled");
	}

	/**
	 * Hide renderer without destroying it.
	 *
	 * Performance optimization: Keeps SVG elements in memory but hidden.
	 * Use for map switching where you expect to return to this map.
	 */
	hide(): void {
		if (this.hillshadeGroup) {
			this.hillshadeGroup.style.display = "none";
		}
		this.enabled = false;

		// Unsubscribe to avoid unnecessary updates while hidden
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	/**
	 * Show previously hidden renderer.
	 *
	 * If the renderer was hidden, this makes it visible again.
	 * If regeneration is needed (e.g., elevation data changed while hidden),
	 * call enable() with config instead.
	 */
	show(): void {
		if (this.hillshadeGroup) {
			this.hillshadeGroup.style.display = "";
			this.enabled = true;

			// Re-subscribe to elevation store changes
			if (!this.unsubscribe && this.config) {
				const elevStore = getElevationStore(this.app, this.mapFile);
				this.unsubscribe = elevStore.state.subscribe(() => {
					if (this.enabled) {
						this.regenerate();
					}
				});
			}
		}
	}

	/**
	 * Check if renderer is currently hidden (has SVG group but not enabled)
	 */
	isHidden(): boolean {
		return this.hillshadeGroup !== null && !this.enabled;
	}

	/**
	 * Update hillshade style
	 */
	setStyle(style: Partial<HillshadeStyle>): void {
		this.style = { ...this.style, ...style };

		if (this.enabled) {
			this.updateCanvasStyle();
		}

		logger.debug("Style updated:", this.style);
	}

	/**
	 * Update hillshade configuration
	 */
	async setConfig(config: Partial<HillshadeConfig>): Promise<void> {
		if (!this.config) {
			logger.warn("Cannot update config - not enabled");
			return;
		}

		this.config = { ...this.config, ...config };

		if (this.enabled) {
			await this.regenerate();
		}

		logger.debug("Config updated:", this.config);
	}

	/**
	 * Regenerate hillshade overlay
	 */
	private async regenerate(): Promise<void> {
		if (!this.hillshadeGroup || !this.config) return;

		// Get elevation grid from store
		const elevStore = getElevationStore(this.app, this.mapFile);
		const grid = elevStore.getCachedGrid();

		if (!grid) {
			logger.warn("No elevation grid available");
			return;
		}

		// Calculate hillshade
		const hillshade = calculateHillshade(grid, 200, 200, this.config);

		// Render to canvas
		this.renderToCanvas(hillshade, 200, 200);
	}

	/**
	 * Render hillshade data to canvas and embed in SVG
	 */
	private renderToCanvas(hillshade: Uint8ClampedArray, width: number, height: number): void {
		if (!this.hillshadeGroup) return;

		// Create or reuse canvas
		if (!this.canvas) {
			this.canvas = document.createElement("canvas");
			this.canvas.width = width;
			this.canvas.height = height;
		}

		// Get canvas context
		const ctx = this.canvas.getContext("2d");
		if (!ctx) {
			logger.error("Failed to get canvas context");
			return;
		}

		// Create ImageData from hillshade intensity values
		const imageData = ctx.createImageData(width, height);
		const data = imageData.data;

		// Convert grayscale intensity to RGBA
		for (let i = 0; i < hillshade.length; i++) {
			const intensity = hillshade[i];
			const offset = i * 4;

			data[offset] = intensity; // R
			data[offset + 1] = intensity; // G
			data[offset + 2] = intensity; // B
			data[offset + 3] = 255; // A (full opacity, use SVG opacity instead)
		}

		// Put image data on canvas
		ctx.putImageData(imageData, 0, 0);

		// Convert canvas to data URL
		const dataURL = this.canvas.toDataURL("image/png");

		// Clear existing content
		while (this.hillshadeGroup.firstChild) {
			this.hillshadeGroup.removeChild(this.hillshadeGroup.firstChild);
		}

		// Create SVG image element
		const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
		image.setAttribute("href", dataURL);
		image.setAttribute("x", "0");
		image.setAttribute("y", "0");
		image.setAttribute("width", String(width));
		image.setAttribute("height", String(height));
		image.setAttribute("preserveAspectRatio", "none");

		// Apply style
		this.updateImageStyle(image);

		this.hillshadeGroup.appendChild(image);

		logger.debug(`Rendered hillshade (${width}×${height})`);
	}

	/**
	 * Update canvas/image style attributes
	 */
	private updateCanvasStyle(): void {
		if (!this.hillshadeGroup) return;

		const image = this.hillshadeGroup.querySelector("image");
		if (image) {
			this.updateImageStyle(image);
		}
	}

	/**
	 * Update SVG image element style
	 */
	private updateImageStyle(image: SVGImageElement): void {
		image.setAttribute("opacity", String(this.style.opacity));
		image.style.mixBlendMode = this.style.blendMode;
	}

	/**
	 * Check if renderer is currently enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Get current configuration
	 */
	getConfig(): HillshadeConfig | null {
		return this.config ? { ...this.config } : null;
	}

	/**
	 * Get current style
	 */
	getStyle(): HillshadeStyle {
		return { ...this.style };
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		this.disable();
	}
}
