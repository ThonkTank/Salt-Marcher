// src/features/maps/elevation/contour-renderer.ts
// SVG rendering for elevation contour lines

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("contour-renderer");
import { elevationToColor } from "../rendering/core/gradients";
import { generateContours, type ContourConfig, type ContourPath } from "@services/elevation";
import { getElevationStore } from "./index";
import type { Unsubscriber } from "@services/state";

/**
 * Contour style configuration
 */
export interface ContourStyle {
	/** Line color (CSS color or "elevation-gradient" for auto-color) */
	color: string | "elevation-gradient";
	/** Minor contour line width (pixels) */
	minorWidth: number;
	/** Major contour line width (pixels) */
	majorWidth: number;
	/** Line opacity (0.0-1.0) */
	opacity: number;
	/** Dash array for minor contours (e.g., "4 2" for dashed) */
	minorDashArray?: string;
	/** Dash array for major contours (empty for solid) */
	majorDashArray?: string;
}

/**
 * Default contour style
 */
const DEFAULT_STYLE: ContourStyle = {
	color: "elevation-gradient", // Auto-color based on elevation
	minorWidth: 1.5,
	majorWidth: 3,
	opacity: 0.6,
	minorDashArray: "4 2", // Dashed minor contours
	majorDashArray: "", // Solid major contours
};

/**
 * Global contour renderer registry
 *
 * One renderer per map file (keyed by file path).
 */
const contourRenderers = new Map<string, ContourRenderer>();

/**
 * Get or create contour renderer for map file
 *
 * **Singleton Pattern:** Returns the same renderer instance for the same map file.
 *
 * @param app - Obsidian App instance
 * @param mapFile - Map markdown file
 * @param contentG - SVG group for rendering contours
 * @returns Contour renderer for this map
 */
export function getContourRenderer(app: App, mapFile: TFile, contentG: SVGGElement): ContourRenderer {
	const key = mapFile.path;

	// Return existing renderer if already created
	if (contourRenderers.has(key)) {
		return contourRenderers.get(key)!;
	}

	// Create new renderer
	const renderer = new ContourRenderer(app, mapFile, contentG);
	contourRenderers.set(key, renderer);

	logger.debug(`Created renderer for ${mapFile.path}`);
	return renderer;
}

/**
 * Clear contour renderer from registry
 *
 * Used when map is closed or deleted.
 */
export function clearContourRenderer(mapFile: TFile): void {
	const key = mapFile.path;
	const renderer = contourRenderers.get(key);

	if (renderer) {
		renderer.destroy();
		contourRenderers.delete(key);
		logger.debug(`Cleared renderer for ${mapFile.path}`);
	}
}

/**
 * Hide contour renderer without destroying it.
 *
 * Performance optimization: Keeps renderer instance and SVG elements in memory
 * but hidden. Use for map switching where you expect to return to this map.
 *
 * @param mapFile - Map file to hide renderer for
 * @returns true if renderer was hidden, false if no renderer exists
 */
export function hideContourRenderer(mapFile: TFile): boolean {
	const key = mapFile.path;
	const renderer = contourRenderers.get(key);

	if (renderer) {
		renderer.hide();
		logger.debug(`Hidden renderer for ${mapFile.path}`);
		return true;
	}
	return false;
}

/**
 * Show previously hidden contour renderer.
 *
 * @param mapFile - Map file to show renderer for
 * @returns true if renderer was shown, false if no renderer exists
 */
export function showContourRenderer(mapFile: TFile): boolean {
	const key = mapFile.path;
	const renderer = contourRenderers.get(key);

	if (renderer) {
		renderer.show();
		logger.debug(`Shown renderer for ${mapFile.path}`);
		return true;
	}
	return false;
}

/**
 * Clear all contour renderers
 *
 * Used for cleanup on plugin unload.
 */
export function clearAllContourRenderers(): void {
	for (const renderer of contourRenderers.values()) {
		renderer.destroy();
	}
	contourRenderers.clear();
	logger.info("Cleared all contour renderers");
}

/**
 * Contour Renderer
 *
 * Renders smooth elevation contour lines as SVG paths.
 * Unlike per-hex overlay layers, this renders all contours as a single SVG group.
 *
 * **Features:**
 * - Reactive updates (regenerates on elevation store changes)
 * - Configurable styling (line width, color, dash patterns)
 * - Major/minor contour distinction
 * - Elevation-based color gradients
 *
 * @example
 * ```typescript
 * const renderer = getContourRenderer(app, mapFile, contentG);
 *
 * // Enable with default config
 * await renderer.enable({
 *   interval: 100,
 *   majorInterval: 500
 * });
 *
 * // Update style
 * renderer.setStyle({
 *   color: "#888",
 *   minorWidth: 1,
 *   majorWidth: 2,
 *   opacity: 0.8
 * });
 *
 * // Disable
 * renderer.disable();
 * ```
 */
export class ContourRenderer {
	private app: App;
	private mapFile: TFile;
	private contentG: SVGGElement;
	private contourGroup: SVGGElement | null = null;
	private config: ContourConfig | null = null;
	private style: ContourStyle = DEFAULT_STYLE;
	private unsubscribe: Unsubscriber | null = null;
	private enabled = false;

	constructor(app: App, mapFile: TFile, contentG: SVGGElement) {
		this.app = app;
		this.mapFile = mapFile;
		this.contentG = contentG;
	}

	/**
	 * Enable contour rendering with specified configuration
	 */
	async enable(config: Partial<ContourConfig> = {}): Promise<void> {
		if (this.enabled) {
			logger.warn("Already enabled, updating config");
		}

		this.config = {
			interval: 100,
			majorInterval: 500,
			smoothing: 1,
			...config,
		};

		this.enabled = true;

		// Create SVG group for contours
		if (!this.contourGroup) {
			this.contourGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
			this.contourGroup.setAttribute("class", "sm-contour-layer");
			this.contentG.appendChild(this.contourGroup);
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
	 * Disable contour rendering
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
		if (this.contourGroup) {
			this.contourGroup.remove();
			this.contourGroup = null;
		}

		logger.info("Disabled");
	}

	/**
	 * Hide renderer without destroying it.
	 *
	 * Performance optimization: Keeps SVG elements in memory but hidden.
	 * Use for map switching where you expect to return to this map.
	 */
	hide(): void {
		if (this.contourGroup) {
			this.contourGroup.style.display = "none";
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
		if (this.contourGroup) {
			this.contourGroup.style.display = "";
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
		return this.contourGroup !== null && !this.enabled;
	}

	/**
	 * Update contour style
	 */
	setStyle(style: Partial<ContourStyle>): void {
		this.style = { ...this.style, ...style };

		if (this.enabled) {
			this.regenerate();
		}

		logger.debug("Style updated:", this.style);
	}

	/**
	 * Update contour configuration
	 */
	async setConfig(config: Partial<ContourConfig>): Promise<void> {
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
	 * Regenerate all contours
	 */
	private async regenerate(): Promise<void> {
		if (!this.contourGroup || !this.config) return;

		// Clear existing contours
		while (this.contourGroup.firstChild) {
			this.contourGroup.removeChild(this.contourGroup.firstChild);
		}

		// Get elevation grid from store
		const elevStore = getElevationStore(this.app, this.mapFile);
		const grid = elevStore.getCachedGrid();

		if (!grid) {
			logger.warn("No elevation grid available");
			return;
		}

		// Generate contours using Marching Squares
		const contours = generateContours(grid, 200, 200, this.config);

		logger.info(`Rendering ${contours.length} contour paths`);

		// Render each contour as SVG path
		for (const contour of contours) {
			const pathElement = this.createContourPath(contour);
			this.contourGroup.appendChild(pathElement);
		}
	}

	/**
	 * Create SVG path element for a contour
	 */
	private createContourPath(contour: ContourPath): SVGPathElement {
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

		// Build SVG path data
		const pathData = this.buildPathData(contour);
		path.setAttribute("d", pathData);

		// Determine if this is a major contour
		const isMajor =
			this.config && contour.elevation % this.config.majorInterval === 0;

		// Apply style
		const color =
			this.style.color === "elevation-gradient"
				? elevationToColor(contour.elevation)
				: this.style.color;

		path.setAttribute("stroke", color);
		path.setAttribute(
			"stroke-width",
			String(isMajor ? this.style.majorWidth : this.style.minorWidth)
		);
		path.setAttribute("stroke-opacity", String(this.style.opacity));
		path.setAttribute("fill", "none");

		// Dash pattern
		const dashArray = isMajor
			? this.style.majorDashArray
			: this.style.minorDashArray;
		if (dashArray) {
			path.setAttribute("stroke-dasharray", dashArray);
		}

		// Metadata
		path.setAttribute("data-elevation", String(contour.elevation));
		path.setAttribute("data-major", String(isMajor));

		// Tooltip
		const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
		title.textContent = `${contour.elevation}m contour`;
		path.appendChild(title);

		return path;
	}

	/**
	 * Build SVG path data string from contour points
	 */
	private buildPathData(contour: ContourPath): string {
		if (contour.points.length === 0) return "";

		const parts: string[] = [];

		// Move to first point
		const first = contour.points[0];
		parts.push(`M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`);

		// Line to subsequent points
		for (let i = 1; i < contour.points.length; i++) {
			const point = contour.points[i];
			parts.push(`L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
		}

		// Close path if it's a closed contour
		if (contour.closed) {
			parts.push("Z");
		}

		return parts.join(" ");
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
	getConfig(): ContourConfig | null {
		return this.config ? { ...this.config } : null;
	}

	/**
	 * Get current style
	 */
	getStyle(): ContourStyle {
		return { ...this.style };
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		this.disable();
	}
}
