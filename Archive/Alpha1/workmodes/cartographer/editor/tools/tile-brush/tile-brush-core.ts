// src/workmodes/cartographer/editor/tools/tile-brush/tile-brush-core.ts
// Core logic for Tile Brush - creates/deletes tiles with default values

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-tile-brush");
import type { AxialCoord } from "@geometry";
import { coordToKey } from "@geometry";
import type { TileData } from "@domain";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import { executeBrush, type BrushPayloadResult } from "../base/brush-executor";

export type TileBrushCoord = AxialCoord;

export type TileBrushOptions = {
    /** Hex brush radius (0 = only center) */
    brushRadius: number;
    /** Operating mode - "paint" creates tiles, "erase" deletes them */
    mode?: "paint" | "erase";
};

export type TileBrushToolAdapter = {
    /** Returns current AbortSignal from editor lifecycle */
    getAbortSignal?: () => AbortSignal | null;
    /** Publishes status messages to panel */
    setStatus?: (message: string) => void;
};

export type TileBrushExecutionContext = {
    tool?: TileBrushToolAdapter | null;
    toolName?: string | null;
};

/**
 * Default tile data for new tiles.
 * Phase 1: Icon-Based Terrain System - plains + barren + elevation 0
 */
const DEFAULT_TILE_DATA: TileData = {
    terrain: "plains",
    flora: "barren",
    elevation: 0,
};

/**
 * Build payload for a single tile brush operation.
 * Paint mode: Create tiles with defaults. Erase mode: Delete tiles.
 */
function buildTilePayload(
    coord: AxialCoord,
    existingData: TileData | null,
    mode: "paint" | "erase"
): BrushPayloadResult | null {
    if (mode === "paint") {
        // Paint mode: Create tile with defaults
        if (existingData) {
            // Tile already exists - skip
            logger.info(`[tile-brush] Skipping ${coordToKey(coord)} - tile already exists`);
            return null;
        }
        return { save: { coord, data: DEFAULT_TILE_DATA, previousData: null } };
    } else {
        // Erase mode: Delete tile
        if (!existingData) {
            // No tile exists - skip
            logger.info(`[tile-brush] Skipping ${coordToKey(coord)} - no tile to delete`);
            return null;
        }
        return { delete: { coord, previousData: existingData } };
    }
}

/**
 * Applies tile brush operation (create or delete tiles).
 * Uses executeBrush for batch operations and automatic rollback.
 *
 * Paint Mode:
 * - Creates new tiles with default values (plains, barren, elevation=0)
 * - Skips hexes that already have tiles (no modification)
 *
 * Erase Mode:
 * - Deletes existing tiles completely
 * - Skips hexes that have no tiles
 *
 * @param app Obsidian App
 * @param mapFile Current map file
 * @param center Center coordinate
 * @param handles Render handles for visual updates
 * @param options Brush options (radius, mode)
 * @param context Optional execution context (abort signal, status updates)
 */
export async function applyTileBrush(
    app: App,
    mapFile: TFile,
    center: TileBrushCoord,
    handles: RenderHandles,
    options: TileBrushOptions,
    context?: TileBrushExecutionContext
): Promise<void> {
    const toolName = context?.toolName ?? "tile-brush";
    const mode = options.mode ?? "paint";
    const brushRadius = Math.max(0, options.brushRadius);

    logger.info(`[${toolName}] Applying tile brush at (${center.q},${center.r}) with brushRadius ${brushRadius}, mode: ${mode}`);

    const tool = context?.tool ?? null;

    const result = await executeBrush(
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
                return buildTilePayload(coord, existingData, mode);
            },
            onSaved: (saved) => {
                // Update rendering for created tiles (paint mode)
                requestAnimationFrame(() => {
                    for (const { coord, data } of saved) {
                        handles.setTerrainIcon(coord, data.terrain as string);
                        handles.setFloraIcon(coord, data.flora as string);
                        handles.setBackgroundColor(coord, undefined);
                    }
                });
            },
            onDeleted: (deleted) => {
                // Clear rendering for deleted tiles (erase mode)
                for (const { coord } of deleted) {
                    const key = coordToKey(coord);
                    handles.setTerrainIcon(coord, "");
                    handles.setFloraIcon(coord, "");
                    handles.setBackgroundColor(coord, undefined);

                    // BUGFIX: Clear overlay visual artifacts (elevation, moisture fills)
                    // When tiles are deleted, overlay layers (elevation, moisture) don't auto-clear
                    // their SVG polygon fill/stroke styles. This causes visual persistence bug.
                    // Quick fix: Manually reset polygon to transparent state after deletion.
                    // TODO: Proper fix in overlay-manager.ts clearRender() - see Phase 2
                    const poly = handles.polyByCoord.get(key);
                    if (poly) {
                        poly.style.fill = "transparent";
                        poly.style.fillOpacity = "0";
                        poly.style.stroke = poly.dataset.defaultStroke ?? "var(--text-muted)";
                        poly.style.strokeWidth = poly.dataset.defaultStrokeWidth ?? "2";
                        poly.style.strokeOpacity = "1";
                        poly.style.mixBlendMode = "";

                        // Clear overlay metadata
                        poly.dataset.overlayChannels = "{}";
                        poly.dataset.overlayColor = "";
                        poly.dataset.markerColor = "";
                    }
                }
            },
            restoreSaveVisual: (coord, previousData) => {
                // Rollback created tile: clear visuals
                handles.setTerrainIcon(coord, "");
                handles.setFloraIcon(coord, "");
                handles.setBackgroundColor(coord, undefined);
            },
            restoreDeleteVisual: (coord, previousData) => {
                // Rollback deleted tile: restore visuals
                if (previousData) {
                    handles.setTerrainIcon(coord, previousData.terrain as string);
                    handles.setFloraIcon(coord, previousData.flora as string);
                    handles.setBackgroundColor(coord, previousData.backgroundColor);
                }
            },
        }
    );

    // Update status with result
    if (tool?.setStatus) {
        if (mode === "paint") {
            tool.setStatus(result.saved === 0 ? "No tiles to create" : `Created ${result.saved} tile${result.saved === 1 ? "" : "s"}`);
        } else {
            tool.setStatus(result.deleted === 0 ? "No tiles to delete" : `Deleted ${result.deleted} tile${result.deleted === 1 ? "" : "s"}`);
        }
    }

    logger.info(`[${toolName}] Tile brush completed: ${result.saved} saved, ${result.deleted} deleted`);
}
