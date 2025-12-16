/**
 * Core gradient brush logic
 *
 * Implements relative value painting with distance-based falloff and anti-accumulation.
 */

import type { AxialCoord } from "@geometry";
import { axialDistance } from "@geometry";
import { calculateFalloff, type FalloffCurve } from "./falloff-curves";
import type { GradientLayer } from "./layer-config";

/**
 * Gradient brush state
 *
 * Defines all parameters for how the brush affects tiles.
 */
export interface GradientBrushState {
    /** Which layer to paint */
    layer: GradientLayer;

    /** Add or subtract from current values */
    mode: "add" | "subtract";

    /** Base delta value (before falloff/blend) */
    delta: number;

    /** Brush radius in hexes */
    brushRadius: number;

    /** Falloff softness 0-100 (0 = no falloff, 100 = full falloff) */
    falloff: number;

    /** Blend strength 0-100 (opacity of the brush effect) */
    blend: number;

    /** Falloff curve algorithm */
    curve: FalloffCurve;
}

/**
 * Drag state for anti-accumulation
 *
 * Tracks which hexes were touched and their original values during a brush stroke.
 */
export interface GradientDragState {
    /** Coordinates touched during this stroke (as "q,r" strings) */
    strokeCoords: Set<string>;

    /** Original values before stroke started (coord -> value) */
    beforeValues: Map<string, number>;
}

/**
 * Creates a new drag state for a brush stroke
 *
 * @returns Empty drag state ready for tracking
 */
export function createDragState(): GradientDragState {
    return {
        strokeCoords: new Set<string>(),
        beforeValues: new Map<string, number>()
    };
}

/**
 * Calculates new value after applying gradient delta
 *
 * Uses relative mode with falloff and blend to prevent accumulation during drag.
 *
 * @param oldValue - Original value before stroke started
 * @param baseDelta - Base delta (before falloff/blend)
 * @param distance - Distance from brush center in hexes
 * @param radius - Brush radius in hexes
 * @param falloffPercent - Falloff strength 0-100
 * @param blendPercent - Blend strength 0-100
 * @param curve - Falloff curve type
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns New value clamped to [min, max]
 *
 * @example
 * ```typescript
 * // Full strength at center with 50% blend
 * const result = calculateGradientDelta(
 *     100,    // old value
 *     50,     // base delta
 *     0,      // at center
 *     5,      // radius
 *     100,    // full falloff
 *     50,     // 50% blend
 *     "smooth",
 *     0, 200
 * );
 * // result = 125 (100 + 50 * 1.0 * 0.5)
 * ```
 */
export function calculateGradientDelta(
    oldValue: number,
    baseDelta: number,
    distance: number,
    radius: number,
    falloffPercent: number,
    blendPercent: number,
    curve: FalloffCurve,
    min: number,
    max: number
): number {
    // Calculate falloff multiplier (0-1)
    let falloffMultiplier = 1.0;

    if (falloffPercent > 0) {
        // Get base falloff from curve
        const curveFalloff = calculateFalloff(distance, radius, curve);

        // Apply falloff percentage
        // At 0%: no falloff (multiplier = 1.0)
        // At 100%: full falloff (multiplier = curveFalloff)
        const falloffStrength = falloffPercent / 100;
        falloffMultiplier = 1.0 - falloffStrength * (1.0 - curveFalloff);
    }

    // Apply blend strength (opacity)
    const blendMultiplier = blendPercent / 100;

    // Calculate final delta
    const finalDelta = baseDelta * falloffMultiplier * blendMultiplier;

    // Apply delta to old value
    const newValue = oldValue + finalDelta;

    // Clamp to bounds
    return Math.max(min, Math.min(max, newValue));
}

/**
 * Applies gradient brush to hexes within radius
 *
 * Uses anti-accumulation by always calculating from original values stored at stroke start.
 * This prevents runaway changes when dragging over the same hex multiple times.
 *
 * @param center - Brush center coordinate
 * @param state - Brush configuration
 * @param dragState - Drag tracking state (modified in place)
 * @param getTileValue - Function to get current tile value
 * @param setTileValue - Function to set new tile value
 * @param coordsInRadius - Function to get all coords within radius
 *
 * @example
 * ```typescript
 * const dragState = createDragState();
 * const brushState: GradientBrushState = {
 *     layer: "elevation",
 *     mode: "add",
 *     delta: 100,
 *     brushRadius: 3,
 *     falloff: 80,
 *     blend: 100,
 *     curve: "smooth"
 * };
 *
 * applyGradientBrush(
 *     { q: 5, r: 10 },
 *     brushState,
 *     dragState,
 *     (coord) => getTile(coord)?.elevation ?? 0,
 *     (coord, value) => updateTile(coord, { elevation: value }),
 *     (center, radius) => getHexesInRadius(center, radius)
 * );
 * ```
 */
export function applyGradientBrush(
    center: AxialCoord,
    state: GradientBrushState,
    dragState: GradientDragState,
    getTileValue: (coord: AxialCoord) => number | undefined,
    setTileValue: (coord: AxialCoord, value: number) => void,
    coordsInRadius: (center: AxialCoord, brushRadius: number) => AxialCoord[]
): void {
    // Get all coordinates within brush radius
    const affectedCoords = coordsInRadius(center, state.brushRadius);

    // Calculate effective delta based on mode
    const effectiveDelta = state.mode === "subtract" ? -state.delta : state.delta;

    // Process each coordinate
    for (const coord of affectedCoords) {
        // Create coordinate key for tracking
        const coordKey = `${coord.q},${coord.r}`;

        // Get current value
        const currentValue = getTileValue(coord) ?? 0;

        // Store original value if first time touching this hex in this stroke
        if (!dragState.strokeCoords.has(coordKey)) {
            dragState.strokeCoords.add(coordKey);
            dragState.beforeValues.set(coordKey, currentValue);
        }

        // Get original value (anti-accumulation: always calculate from original)
        const originalValue = dragState.beforeValues.get(coordKey) ?? currentValue;

        // Calculate distance from center
        const distance = axialDistance(center, coord);

        // Calculate new value with falloff and blend
        const newValue = calculateGradientDelta(
            originalValue,
            effectiveDelta,
            distance,
            state.brushRadius,
            state.falloff,
            state.blend,
            state.curve,
            // Note: bounds will be provided by caller via layer config
            // For now, use very wide bounds (caller should clamp properly)
            -Infinity,
            Infinity
        );

        // Only update if value actually changed
        if (newValue !== currentValue) {
            setTileValue(coord, newValue);
        }
    }
}
