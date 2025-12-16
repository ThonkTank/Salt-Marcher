/**
 * Gradient Brush Tool Panel
 *
 * Provides UI for painting gradient-based values on map tiles with distance falloff.
 * Supports multiple layers (elevation, groundwater, fertility, temperatureOffset)
 * with configurable blend modes and falloff curves.
 *
 * Features:
 * - Layer selection dropdown
 * - Mode toggle (Add/Subtract)
 * - Delta slider (layer-specific min/max)
 * - Radius slider (1-10 hexes)
 * - Falloff slider (0-100% softness)
 * - Blend slider (0-100% mix with existing values)
 * - Visual preview with concentric rings showing falloff
 *
 * Tool Panel UI:
 * ```
 * +------------------------------------------+
 * |  Elevation Brush                         |
 * +==========================================+
 * |  Mode: [+ Add] [- Subtract]              |
 * |                                          |
 * |  Delta: [-500m ====o==== +500m]          |
 * |         Current: +150m                   |
 * |                                          |
 * |  Radius: [1 ===o======= 10]              |
 * |          3 hexes                         |
 * |                                          |
 * |  Falloff: [0% ===o====== 100%]           |
 * |           30% (smooth gradient)          |
 * |                                          |
 * |  Blend: [0% ========o=== 100%]           |
 * |         75%                              |
 * +------------------------------------------+
 * ```
 *
 * @example
 * ```typescript
 * const tool = new GradientBrushTool(container, ctx);
 * const handle = tool.getHandle();
 *
 * // Lifecycle
 * handle.activate();
 * await handle.handleHexClick(coord, event);
 * handle.deactivate();
 * handle.destroy();
 * ```
 */

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-gradient-brush");
import { coordsInRadius, coordToKey, pixelToAxial } from "@geometry";
import { BaseBrushTool } from "../base/base-brush-tool";
import { buildForm, type FormBuilderResult } from "../../form-builder";
import { attachGradientCircle, type GradientCircleController } from "./gradient-circle";
import { LAYER_CONFIG, type GradientLayer } from "./layer-config";
import { applyGradientBrush, createDragState, type GradientDragState, type GradientBrushState as CoreBrushState } from "./gradient-brush-core";
import type { BrushState, AxialCoord, ToolPanelContext, ToolPanelHandle } from '../base/base-tool-types';

/**
 * Gradient brush state
 */
interface GradientBrushState extends BrushState {
    /** Current layer being painted */
    layer: GradientLayer;

    /** Paint mode: add or subtract */
    mode: "add" | "subtract";

    /** Delta value (range depends on layer) */
    delta: number;

    /** Brush radius in hexes (1-10) */
    brushRadius: number;

    /** Falloff percentage (0-100) */
    falloff: number;

    /** Blend percentage with existing values (0-100) */
    blend: number;
}

/**
 * Drag state for continuous painting
 * Uses core GradientDragState for anti-accumulation tracking
 */
interface DragState {
    active: boolean;
    visited: Set<string>;  // Track visited hex keys
    coreState: GradientDragState;  // Anti-accumulation state from core
}

/**
 * Gradient Brush Tool
 *
 * Extends BaseBrushTool with gradient-specific features:
 * - Multi-layer support (elevation, groundwater, fertility, temperatureOffset)
 * - Distance-based falloff
 * - Blend modes
 * - Continuous drag painting
 */
export class GradientBrushTool extends BaseBrushTool<GradientBrushState> {
    /** Gradient circle preview (concentric rings) */
    private gradientCircle: GradientCircleController | null = null;

    /** Form controls */
    private form: FormBuilderResult | null = null;

    /** Drag state for continuous painting */
    private dragState: DragState = {
        active: false,
        visited: new Set(),
        coreState: createDragState()
    };

    /** Pointer event handlers (stored for cleanup) */
    private pointerHandlers = {
        down: (e: PointerEvent) => this.onPointerDown(e),
        move: (e: PointerEvent) => this.onPointerMove(e),
        up: (e: PointerEvent) => this.onPointerUp(e)
    };

    /**
     * Get default brush state
     */
    protected getDefaultState(): GradientBrushState {
        return {
            layer: "elevation",
            mode: "add",
            delta: LAYER_CONFIG.elevation.defaultDelta,
            brushRadius: 3,
            falloff: 50,
            blend: 100
        };
    }

    /**
     * Build tool panel UI
     */
    protected buildUI(): void {
        this.form = buildForm(this.root, {
            sections: [
                {
                    kind: "header",
                    text: "Base Layer"
                },

                // Layer selector
                {
                    kind: "select",
                    id: "layer",
                    label: "Layer",
                    value: this.state.layer,
                    options: [
                        { value: "elevation", label: "Elevation" },
                        { value: "groundwater", label: "Groundwater" },
                        { value: "fertility", label: "Fertility" },
                        { value: "temperatureOffset", label: "Temperature Offset" }
                    ],
                    onChange: ({ value }) => {
                        this.state.layer = value as GradientLayer;
                        this.updateDeltaSlider();
                        logger.debug("Layer changed", { layer: value });
                    }
                },

                // Mode toggle
                {
                    kind: "button-group",
                    cls: "sm-gradient-mode-toggle",
                    buttons: [
                        {
                            id: "mode-add",
                            label: "+ Add",
                            cls: "sm-gradient-mode-btn is-active",
                            onClick: () => {
                                this.state.mode = "add";
                                this.onModeChanged();
                                logger.debug("Mode: add");
                            }
                        },
                        {
                            id: "mode-subtract",
                            label: "- Subtract",
                            cls: "sm-gradient-mode-btn",
                            onClick: () => {
                                this.state.mode = "subtract";
                                this.onModeChanged();
                                logger.debug("Mode: subtract");
                            }
                        }
                    ]
                },

                // Delta slider
                {
                    kind: "radius-slider",
                    id: "delta",
                    showLabel: false,
                    value: this.state.delta,
                    min: LAYER_CONFIG[this.state.layer].min,
                    max: LAYER_CONFIG[this.state.layer].max,
                    onChange: ({ value }) => {
                        this.state.delta = value;
                        this.updateDeltaLabel();
                        logger.debug("Delta changed", { delta: value });
                    }
                },
                {
                    kind: "hint",
                    id: "delta-label",
                    text: this.formatDeltaLabel(),
                    cls: "sm-gradient-label"
                },

                // Radius slider
                {
                    kind: "radius-slider",
                    id: "brushRadius",
                    value: this.state.brushRadius,
                    min: 1,
                    max: 10,
                    onChange: ({ value }) => {
                        this.state.brushRadius = value;
                        this.updateCircleRadius();
                        this.updateRadiusLabel();
                        logger.debug("Radius changed", { brushRadius: value });
                    }
                },
                {
                    kind: "hint",
                    id: "brushRadius-label",
                    text: `${this.state.brushRadius} hexes`,
                    cls: "sm-gradient-label"
                },

                // Falloff slider
                {
                    kind: "radius-slider",
                    id: "falloff",
                    showLabel: false,
                    value: this.state.falloff,
                    min: 0,
                    max: 100,
                    onChange: ({ value }) => {
                        this.state.falloff = value;
                        this.updateFalloffLabel();
                        logger.debug("Falloff changed", { falloff: value });
                    }
                },
                {
                    kind: "hint",
                    id: "falloff-label",
                    text: this.formatFalloffLabel(),
                    cls: "sm-gradient-label"
                },

                // Blend slider
                {
                    kind: "radius-slider",
                    id: "blend",
                    showLabel: false,
                    value: this.state.blend,
                    min: 0,
                    max: 100,
                    onChange: ({ value }) => {
                        this.state.blend = value;
                        this.updateBlendLabel();
                        logger.debug("Blend changed", { blend: value });
                    }
                },
                {
                    kind: "hint",
                    id: "blend-label",
                    text: `Blend: ${this.state.blend}%`,
                    cls: "sm-gradient-label"
                },

                // Guided setup: Next button (only visible for new maps)
                {
                    kind: "button",
                    id: "next-step",
                    label: "Weiter →",
                    cls: "sm-button sm-button--primary sm-button--full-width",
                    hidden: !this.ctx.isGuidedSetup?.(),
                    onClick: () => this.ctx.switchTool?.("derived-layers")
                }
            ]
        });

        // Add section labels before sliders
        this.addSectionLabel("Delta:", this.form.getControl("delta"));
        this.addSectionLabel("Radius:", this.form.getControl("brushRadius"));
        this.addSectionLabel("Falloff:", this.form.getControl("falloff"));
        this.addSectionLabel("Blend:", this.form.getControl("blend"));
    }

    /**
     * Add section label before a control
     */
    private addSectionLabel(text: string, control: HTMLElement | null): void {
        if (!control || !control.parentElement) return;

        const label = document.createElement("div");
        label.className = "sm-form-label";
        label.textContent = text;

        control.parentElement.insertBefore(label, control.parentElement.firstChild);
    }

    /**
     * Update delta slider range when layer changes
     */
    private updateDeltaSlider(): void {
        if (!this.form) return;

        const config = LAYER_CONFIG[this.state.layer];
        const slider = this.form.getControl("delta") as HTMLInputElement | null;

        if (slider) {
            slider.min = String(config.min);
            slider.max = String(config.max);
            slider.value = String(config.defaultDelta);
            this.state.delta = config.defaultDelta;
        }

        this.updateDeltaLabel();
    }

    /**
     * Format delta label with unit
     */
    private formatDeltaLabel(): string {
        const config = LAYER_CONFIG[this.state.layer];
        const sign = this.state.delta >= 0 ? "+" : "";
        return `Current: ${sign}${this.state.delta}${config.unit}`;
    }

    /**
     * Format falloff label
     */
    private formatFalloffLabel(): string {
        return `Falloff: ${this.state.falloff}% (${this.state.falloff < 30 ? "sharp" : this.state.falloff > 70 ? "very smooth" : "smooth"})`;
    }

    /**
     * Update delta label text
     */
    private updateDeltaLabel(): void {
        if (!this.form) return;
        const label = this.form.getControl("delta-label");
        if (label) {
            label.textContent = this.formatDeltaLabel();
        }
    }

    /**
     * Update radius label text
     */
    private updateRadiusLabel(): void {
        if (!this.form) return;
        const label = this.form.getControl("brushRadius-label");
        if (label) {
            const plural = this.state.brushRadius === 1 ? "hex" : "hexes";
            label.textContent = `${this.state.brushRadius} ${plural}`;
        }
    }

    /**
     * Update falloff label text
     */
    private updateFalloffLabel(): void {
        if (!this.form) return;
        const label = this.form.getControl("falloff-label");
        if (label) {
            label.textContent = this.formatFalloffLabel();
        }
    }

    /**
     * Update blend label text
     */
    private updateBlendLabel(): void {
        if (!this.form) return;
        const label = this.form.getControl("blend-label");
        if (label) {
            label.textContent = `Blend: ${this.state.blend}%`;
        }
    }

    /**
     * Update UI when mode changes
     */
    protected onModeChanged(): void {
        const addBtn = this.form?.getControl("mode-add");
        const subtractBtn = this.form?.getControl("mode-subtract");

        if (addBtn && subtractBtn) {
            if (this.state.mode === "add") {
                addBtn.classList.add("is-active");
                subtractBtn.classList.remove("is-active");
            } else {
                addBtn.classList.remove("is-active");
                subtractBtn.classList.add("is-active");
            }
        }

        // Update gradient circle color
        if (this.gradientCircle) {
            this.gradientCircle.updateMode(this.state.mode);
        }
    }

    /**
     * Create or recreate gradient circle
     */
    protected ensureCircle(): void {
        const handles = this.ctx.getHandles();
        const options = this.ctx.getOptions();

        if (!handles || !options) {
            logger.trace?.("[GradientBrushTool] Deferring gradient circle creation");
            return;
        }

        // Destroy existing circle
        this.destroyCircle();

        // Create new gradient circle
        this.gradientCircle = attachGradientCircle(
            {
                svg: handles.svg,
                contentG: handles.contentG
            },
            {
                initialRadius: this.state.brushRadius,
                hexRadiusPx: options.hexPixelSize ?? 42
            }
        );

        this.gradientCircle.updateMode(this.state.mode);
        this.gradientCircle.show();

        logger.debug("Gradient circle created");
    }

    /**
     * Destroy gradient circle
     */
    protected destroyCircle(): void {
        if (this.gradientCircle) {
            this.gradientCircle.destroy();
            this.gradientCircle = null;
            logger.debug("Gradient circle destroyed");
        }
    }

    /**
     * Update gradient circle radius
     */
    protected updateCircleRadius(): void {
        if (this.gradientCircle) {
            this.gradientCircle.updateRadius(this.state.brushRadius);
            logger.debug("Gradient circle radius updated");
        }
    }

    /**
     * Activate tool
     */
    activate(): void {
        super.activate();
        this.attachPointerListeners();
    }

    /**
     * Deactivate tool
     */
    deactivate(): void {
        super.deactivate();
        this.detachPointerListeners();
        this.endDrag();
    }

    /**
     * Attach pointer event listeners for drag painting
     */
    private attachPointerListeners(): void {
        const handles = this.ctx.getHandles();
        if (!handles) return;

        handles.overlay.addEventListener("pointerdown", this.pointerHandlers.down);
        handles.overlay.addEventListener("pointermove", this.pointerHandlers.move);
        handles.overlay.addEventListener("pointerup", this.pointerHandlers.up);
    }

    /**
     * Detach pointer event listeners
     */
    private detachPointerListeners(): void {
        const handles = this.ctx.getHandles();
        if (!handles) return;

        handles.overlay.removeEventListener("pointerdown", this.pointerHandlers.down);
        handles.overlay.removeEventListener("pointermove", this.pointerHandlers.move);
        handles.overlay.removeEventListener("pointerup", this.pointerHandlers.up);
    }

    /**
     * Handle pointer down (start drag)
     */
    private onPointerDown(e: PointerEvent): void {
        this.dragState.active = true;
        this.dragState.visited.clear();
        this.dragState.coreState = createDragState();  // Reset anti-accumulation state

        logger.debug("Drag started");
    }

    /**
     * Handle pointer move (paint during drag)
     */
    private async onPointerMove(e: PointerEvent): Promise<void> {
        if (!this.dragState.active) return;

        // Convert to hex coordinate
        const handles = this.ctx.getHandles();
        if (!handles) return;

        const coord = this.eventToAxialCoord(e);
        if (!coord) return;

        const key = coordToKey(coord);

        // Skip if already visited
        if (this.dragState.visited.has(key)) return;

        this.dragState.visited.add(key);

        // Apply brush
        await this.applyBrushLogic([coord], e);
    }

    /**
     * Handle pointer up (end drag, commit undo)
     */
    private async onPointerUp(e: PointerEvent): Promise<void> {
        if (!this.dragState.active) return;

        this.endDrag();

        // Create undo entry for all visited hexes
        if (this.dragState.visited.size > 0) {
            logger.debug("Drag ended", {
                hexesPainted: this.dragState.visited.size
            });

            // TODO: Capture before/after state and push to undo stack
            // This will be implemented when gradient-brush-core.ts is added
        }
    }

    /**
     * End drag operation
     */
    private endDrag(): void {
        this.dragState.active = false;
        this.dragState.visited.clear();
        this.dragState.coreState = createDragState();  // Reset anti-accumulation state
    }

    /**
     * Convert pointer event to hex coordinate
     */
    private eventToAxialCoord(e: PointerEvent): AxialCoord | null {
        const pt = this.ctx.toContentPoint(e);
        if (!pt) return null;

        const options = this.ctx.getOptions();
        if (!options) return null;

        const hexSize = options.hexPixelSize ?? 42;

        // Convert content-space pixel position to axial coordinate
        return pixelToAxial(pt.x, pt.y, hexSize);
    }

    /**
     * Apply brush logic to target hexes
     *
     * Uses gradient-brush-core.applyGradientBrush() for anti-accumulation
     * and distance-based falloff.
     */
    protected async applyBrushLogic(coords: AxialCoord[], event: PointerEvent): Promise<void> {
        const file = this.ctx.getFile();
        if (!file) {
            throw new Error("No map file selected");
        }

        const center = coords[0];

        logger.debug("Apply gradient brush", {
            center,
            layer: this.state.layer,
            mode: this.state.mode,
            delta: this.state.delta,
            brushRadius: this.state.brushRadius,
            falloff: this.state.falloff,
            blend: this.state.blend
        });

        // Import tile repository for reading/writing tile values
        const { loadTile, saveTile, listTilesForMap } = await import("@features/maps/data/tile-repository");

        // Pre-load all tiles in brush area for synchronous access
        const allTiles = await listTilesForMap(this.ctx.app, file);
        const tileMap = new Map(allTiles.map(t => [coordToKey(t.coord), t.data]));

        // Track tiles to update
        const tilesToUpdate: Array<{ coord: AxialCoord; data: any }> = [];

        // Prepare core brush state
        const coreBrushState: CoreBrushState = {
            layer: this.state.layer,
            mode: this.state.mode,
            delta: this.state.delta,
            brushRadius: this.state.brushRadius,
            falloff: this.state.falloff,
            blend: this.state.blend,
            curve: "smooth"  // Default curve
        };

        // Apply gradient brush using core logic
        applyGradientBrush(
            center,
            coreBrushState,
            this.dragState.coreState,
            // getTileValue: Read current value from tile
            (coord) => {
                const key = coordToKey(coord);
                const tile = tileMap.get(key);
                if (!tile) return undefined;

                switch (this.state.layer) {
                    case "elevation": return tile.elevation;
                    case "groundwater": return tile.groundwater;
                    case "fertility": return tile.fertility;
                    case "temperatureOffset": return tile.temperatureOffset;
                    default: return undefined;
                }
            },
            // setTileValue: Queue tile update
            (coord, value) => {
                const layerConfig = LAYER_CONFIG[this.state.layer];
                const clampedValue = Math.max(layerConfig.min, Math.min(layerConfig.max, value));

                const key = coordToKey(coord);
                const existingTile = tileMap.get(key) || {};

                // Create updated tile data
                const updatedTile = { ...existingTile };
                (updatedTile as any)[this.state.layer] = clampedValue;

                // Update local cache and queue for save
                tileMap.set(key, updatedTile);
                tilesToUpdate.push({ coord, data: updatedTile });

                logger.trace?.("[GradientBrushTool] Tile updated", {
                    coord,
                    layer: this.state.layer,
                    value: clampedValue
                });
            },
            // coordsInRadius: Get all coords within brush radius
            (center, radius) => coordsInRadius(center, radius)
        );

        // Persist all updated tiles
        for (const { coord, data } of tilesToUpdate) {
            await saveTile(this.ctx.app, file, coord, data);
        }

        logger.debug("Gradient brush applied", {
            tilesUpdated: tilesToUpdate.length
        });
    }

    /**
     * Generate undo summary
     */
    protected generateUndoSummary(count: number, mode: string): string {
        const action = mode === "add" ? "Added" : "Subtracted";
        const layer = this.state.layer;
        const plural = count === 1 ? "hex" : "hexes";
        return `${action} ${layer} gradient to ${count} ${plural}`;
    }

    /**
     * Get tool panel handle
     */
    getHandle(): ToolPanelHandle {
        return {
            activate: () => this.activate(),
            deactivate: () => this.deactivate(),
            destroy: () => this.destroy(),
            handleHexClick: (coord, event) => this.handleHexClick(coord, event),
            toggleMode: () => this.toggleMode(),
            onMapRendered: () => this.onMapRendered()
        };
    }
}

/**
 * Factory function for tool panel mounting
 *
 * @param container - DOM container for tool panel
 * @param ctx - Tool panel context
 * @returns Tool panel handle
 */
export function mountGradientBrushPanel(
    container: HTMLElement,
    ctx: ToolPanelContext
): ToolPanelHandle {
    const tool = new GradientBrushTool(container, ctx);
    return tool.getHandle();
}
