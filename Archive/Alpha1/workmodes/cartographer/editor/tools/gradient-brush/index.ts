/**
 * Gradient Brush - Base Layer Value Painting with Falloff
 *
 * Provides core algorithms for painting elevation, groundwater, fertility, and
 * temperature offset values with distance-based falloff and anti-accumulation.
 *
 * @example
 * ```typescript
 * import {
 *     createDragState,
 *     applyGradientBrush,
 *     type GradientBrushState,
 *     LAYER_CONFIG
 * } from "@workmodes/cartographer/editor/tools/gradient-brush";
 *
 * // Create brush state
 * const brushState: GradientBrushState = {
 *     layer: "elevation",
 *     mode: "add",
 *     delta: LAYER_CONFIG.elevation.defaultDelta, // 100m
 *     radius: 3,
 *     falloff: 80,
 *     blend: 100,
 *     curve: "smooth"
 * };
 *
 * // Create drag tracking
 * const dragState = createDragState();
 *
 * // Apply brush
 * applyGradientBrush(
 *     { q: 5, r: 10 },
 *     brushState,
 *     dragState,
 *     (coord) => getTile(coord)?.elevation ?? 0,
 *     (coord, value) => updateTileElevation(coord, value),
 *     (center, radius) => getHexesInRadius(center, radius)
 * );
 * ```
 */

// Core types and functions
export {
    createDragState,
    applyGradientBrush,
    calculateGradientDelta,
    type GradientBrushState,
    type GradientDragState
} from "./gradient-brush-core";

// Falloff algorithms
export {
    calculateFalloff,
    type FalloffCurve
} from "./falloff-curves";

// Layer configuration
export {
    LAYER_CONFIG,
    type GradientLayer,
    type LayerConfig
} from "./layer-config";

// Tool Registration
import { TOOL_REGISTRY } from "../../tool-registry";
import { mountGradientBrushPanel } from "./gradient-brush-tool";

TOOL_REGISTRY.register({
    id: "gradient-brush",
    label: "Base Layers",
    icon: "🏔️",
    tooltip: "Paint elevation, groundwater, fertility, temperature (Shortcut: B)",
    factory: (root, ctx) => mountGradientBrushPanel(root, ctx),
});
