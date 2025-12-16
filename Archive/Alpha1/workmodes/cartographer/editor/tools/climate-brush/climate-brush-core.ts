// src/workmodes/cartographer/editor/tools/climate-brush/climate-brush-core.ts
// Temperature Brush Tool - Apply temperature offsets with softness/falloff
//
// Simplified climate editing that only modifies temperature offsets:
// - Paint + mode: Apply positive temperature offset
// - Paint - mode: Apply negative temperature offset
// - Erase mode: Remove temperature offset (return to auto-climate)
//
// Softness/falloff allows gradual strength reduction from center to edge

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-climate-brush");
import { type AxialCoord, axialDistance } from "@geometry";
import type { TileData } from "@domain";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import { executeBrush, type BrushPayloadResult } from "../base/brush-executor";

export type BrushCoord = AxialCoord;

/**
 * Temperature brush options
 */
export type TemperatureBrushOptions = {
    /** Hex brush radius (0 = center only) */
    brushRadius: number;
    /** Target temperature offset (-30 to +30, 0 = erase) */
    targetOffset: number;
    /** Softness/falloff percentage (0-100, 0 = hard edge) */
    softness: number;
};

export type TemperatureBrushAdapter = {
    getAbortSignal?: () => AbortSignal | null;
    setStatus?: (message: string) => void;
};

export type TemperatureBrushContext = {
    tool?: TemperatureBrushAdapter | null;
    toolName?: string | null;
};


/**
 * Calculate falloff multiplier based on distance from center
 * @param distance Hex distance from brush center
 * @param maxRadius Brush radius
 * @param softness Softness percentage (0-100)
 * @returns Multiplier between 0 and 1
 *
 * Examples:
 * - softness=0: All tiles get 1.0 (hard edge)
 * - softness=50, radius=3:
 *   - distance 0-1: 1.0 (hard core)
 *   - distance 2: 0.5 (linear falloff)
 *   - distance 3: 0.0 (edge)
 * - softness=100: Linear from 1.0 at center to 0.0 at edge
 */
function calculateFalloff(
    distance: number,
    maxRadius: number,
    softness: number
): number {
    if (softness === 0) return 1.0; // No falloff = full strength everywhere
    if (maxRadius === 0) return 1.0; // Single tile brush = always full strength

    // Softness defines what percentage of radius has falloff
    // softness=50 means outer 50% of radius has falloff
    const softZoneStart = 1 - (softness / 100);
    const normalizedDist = distance / maxRadius;

    if (normalizedDist <= softZoneStart) {
        return 1.0; // In hard core = full strength
    }

    // Linear interpolation in soft zone
    const softProgress = (normalizedDist - softZoneStart) / (1 - softZoneStart);
    return Math.max(0, 1 - softProgress);
}

/**
 * Build climate payload for a single tile
 * Calculates falloff and applies temperature offset based on distance from center
 */
function buildClimatePayload(
    coord: AxialCoord,
    center: AxialCoord,
    existingData: TileData | null,
    targetOffset: number,
    softness: number,
    brushRadius: number
): BrushPayloadResult | null {
    const oldClimate = existingData?.climate ? { ...existingData.climate } : undefined;

    // Calculate distance and falloff
    const distance = axialDistance(center, coord);
    const falloff = calculateFalloff(distance, brushRadius, softness);
    const effectiveOffset = Math.round(targetOffset * falloff);

    // Calculate new climate based on effective offset
    const isEraseMode = targetOffset === 0;
    let newClimate: NonNullable<TileData["climate"]> | undefined;

    if (isEraseMode || effectiveOffset === 0) {
        // Erase mode or zero effective offset - remove climate data
        newClimate = undefined;
    } else {
        // Apply effective temperature offset
        newClimate = {
            temperatureOffset: effectiveOffset,
        };
    }

    // Skip if no change needed (optimization)
    const hasClimateChange =
        (newClimate?.temperatureOffset !== oldClimate?.temperatureOffset) ||
        (newClimate === undefined && oldClimate !== undefined) ||
        (newClimate !== undefined && oldClimate === undefined);

    if (!hasClimateChange) {
        return null; // No change needed for this tile
    }

    // Build updated tile data
    const updatedData: TileData = {
        ...existingData,
        climate: newClimate,
    };

    return {
        save: {
            coord,
            data: updatedData,
            previousData: existingData,
        },
    };
}

/**
 * Apply temperature brush to map with rollback on error
 * Uses batch operations for 10-50x performance improvement
 * Supports softness/falloff for gradual strength reduction
 */
export async function applyTemperatureBrush(
    app: App,
    mapFile: TFile,
    center: BrushCoord,
    opts: TemperatureBrushOptions,
    handles: RenderHandles,
    context?: TemperatureBrushContext
): Promise<void> {
    const { brushRadius, targetOffset, softness } = opts;
    const brushRadiusValue = Math.max(0, brushRadius | 0);
    const softnessValue = Math.max(0, Math.min(100, softness));

    const tool = context?.tool ?? null;
    const toolName = context?.toolName ?? "temperature-brush";
    const abortSignal = tool?.getAbortSignal?.() ?? null;

    const result = await executeBrush(
        {
            app,
            mapFile,
            center,
            brushRadius: brushRadiusValue,
            toolName,
            abortSignal,
            setStatus: (message) => tool?.setStatus?.(message),
        },
        {
            buildPayload: (coord, existingData, throwIfAborted) => {
                throwIfAborted();
                return buildClimatePayload(
                    coord,
                    center,
                    existingData,
                    targetOffset,
                    softnessValue,
                    brushRadiusValue
                );
            },
        }
    );

    // Log final statistics
    const isEraseMode = targetOffset === 0;
    logger.info("Applied temperature brush", {
        targetOffset,
        softness: softnessValue,
        brushRadius: brushRadiusValue,
        tilesAffected: result.saved,
        skipped: result.skipped,
        isEraseMode,
    });
}
