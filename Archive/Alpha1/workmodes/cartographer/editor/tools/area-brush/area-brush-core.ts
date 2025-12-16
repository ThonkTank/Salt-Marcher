// src/workmodes/cartographer/editor/tools/area-brush/area-brush-core.ts
// Area Brush - Paint regions/factions with visual borders and labels
import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-area-brush");
import type { AxialCoord } from "@geometry";
import type { TileData } from "@domain";
import type { AreaType } from "@services/domain";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import { executeBrush, type BrushPayloadResult } from "../base/brush-executor";

export type AreaCoord = AxialCoord;

export type AreaBrushOptions = {
    /** Hex brush radius (0 = nur das Zentrum). */
    brushRadius: number;
    /** Betriebsmodus – "paint" legt Tiles an, "erase" löscht sie. */
    mode: "paint" | "erase";
    /** Area type to paint */
    areaType: AreaType;
    /** Area value (region name or faction name) */
    areaValue: string;
};

export type AreaBrushToolAdapter = {
    /** Liefert das aktuelle AbortSignal des Editor-Lifecycles. */
    getAbortSignal?: () => AbortSignal | null;
    /** Veröffentlicht Statusmeldungen im Panel. */
    setStatus?: (message: string) => void;
};

export type AreaBrushExecutionContext = {
    tool?: AreaBrushToolAdapter | null;
    toolName?: string | null;
};


/**
 * Build payload for a single area brush tile.
 * Handles paint and erase modes, preserving all non-area data.
 */
function buildAreaPayload(
    coord: AxialCoord,
    existingData: TileData | null,
    opts: AreaBrushOptions
): BrushPayloadResult | null {
    const { mode, areaType, areaValue } = opts;

    // Skip if no tile exists (Tile Brush creates tiles explicitly)
    if (!existingData) {
        logger.info(`[area-brush] Skipping ${coord.q},${coord.r} - no tile exists (use Tile Brush to create)`);
        return null;
    }

    // Build payload: Preserve all existing data
    const payload: TileData = {
        terrain: existingData.terrain,
        flora: existingData.flora,
        backgroundColor: existingData.backgroundColor,
        region: existingData.region,
        faction: existingData.faction,
        elevation: existingData.elevation,
        moisture: existingData.moisture,
        groundwater: existingData.groundwater,
        fertility: existingData.fertility,
        note: existingData.note,
        locationMarker: existingData.locationMarker,
    };

    if (mode === "erase") {
        // Erase only the selected area type
        if (areaType === 'region') {
            payload.region = undefined;
        } else if (areaType === 'faction') {
            payload.faction = undefined;
        }

        // Check if any data remains
        const hasRemainingData = !!(
            payload.terrain ||
            payload.flora ||
            payload.backgroundColor ||
            payload.region ||
            payload.faction ||
            payload.elevation !== undefined ||
            payload.moisture !== undefined ||
            payload.groundwater !== undefined ||
            payload.fertility !== undefined ||
            payload.note ||
            payload.locationMarker
        );

        if (!hasRemainingData) {
            // No data left, delete entire tile
            return { delete: { coord, previousData: existingData } };
        } else {
            // Some data remains, save updated tile
            return { save: { coord, data: payload, previousData: existingData } };
        }
    } else {
        // Paint mode: Update area assignment
        if (areaType === 'region') {
            payload.region = areaValue;
        } else if (areaType === 'faction') {
            payload.faction = areaValue;
            payload.manualFactionEdit = true;  // Mark as manual edit
        }

        return { save: { coord, data: payload, previousData: existingData } };
    }
}

/**
 * Applies area brush to map, painting or erasing region/faction assignments.
 * Uses executeBrush for batch operations and automatic rollback.
 */
export async function applyAreaBrush(
    app: App,
    mapFile: TFile,
    center: AreaCoord,
    opts: AreaBrushOptions,
    handles: RenderHandles,
    context?: AreaBrushExecutionContext
): Promise<void> {
    const mode = opts.mode ?? "paint";
    const brushRadius = Math.max(0, opts.brushRadius | 0);
    const areaType = opts.areaType;
    const areaValue = opts.areaValue;

    // Validate: In paint mode, areaValue must be set
    if (mode === "paint" && !areaValue) {
        logger.warn(`[area-brush] No ${areaType} selected - brush will have no effect`);
        return;
    }

    const tool = context?.tool ?? null;
    const toolName = context?.toolName ?? "area-brush";

    await executeBrush(
        {
            app,
            mapFile,
            center,
            brushRadius,
            toolName,
            abortSignal: tool?.getAbortSignal?.() ?? null,
            setStatus: tool?.setStatus,
        },
        {
            buildPayload: (coord, existingData, throwIfAborted) => {
                throwIfAborted();
                return buildAreaPayload(coord, existingData, opts);
            },
            // No visual updates needed - area changes don't affect immediate rendering
            // Overlays will update automatically when they re-render
        }
    );

    logger.info(`[area-brush] Area brush completed successfully`);
}
