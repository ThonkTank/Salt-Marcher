// src/workmodes/cartographer/editor/tools/terrain-brush/brush-core.ts
// Kapselt Distanz- und Schreibhelfer des Terrain-Brush für Wiederverwendung im Editor.
import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-terrain-brush");
import { type AxialCoord } from "@geometry";
import {
    getRandomTerrainVariant,
    getRandomFloraVariant
} from "@features/maps/rendering/icons/icon-registry";
import { getTerrainPositionConfig, getFloraPositionConfig } from "@features/maps/rendering/icons/symbol-position-config";
import { reportEditorToolIssue } from "../../editor-telemetry";
import type { TileData, TerrainType, FloraType, MoistureLevel } from "@domain";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import { executeBrush, type BrushPayloadResult } from "../base/brush-executor";
import { isAbortError } from "../base/brush-execution";

export type BrushCoord = AxialCoord;

/**
 * Configuration for a single data layer in the terrain-layer system.
 * Phase 3: Icon-Based Terrain System - supports terrainType, flora, and moisture layers.
 * Note: Region/Faction layers moved to Area Brush tool.
 * Note: backgroundColor removed - background color now auto-determined by terrain/flora.
 */
export type LayerConfig = {
    /** Layer identifier */
    id: 'terrainType' | 'flora' | 'moisture';
    /** Whether this layer is enabled for editing */
    enabled: boolean;
    /** Value to paint (type depends on layer) */
    value: TerrainType | FloraType | MoistureLevel | undefined;
};

export type BrushOptions = {
    /** Hex brush radius (0 = nur das Zentrum). */
    brushRadius: number;
    /** Betriebsmodus – "paint" legt Tiles an, "erase" löscht sie. */
    mode?: "paint" | "erase";
    /** Terrain-layer configuration (icon-based terrain system). */
    layers?: LayerConfig[];
};

export type BrushToolAdapter = {
    /** Liefert das aktuelle AbortSignal des Editor-Lifecycles. */
    getAbortSignal?: () => AbortSignal | null;
    /** Veröffentlicht Statusmeldungen im Panel. */
    setStatus?: (message: string) => void;
};

export type BrushExecutionContext = {
    tool?: BrushToolAdapter | null;
    toolName?: string | null;
};

/**
 * Build terrain payload for a single tile.
 * Applies terrain brush logic (layer handling, terrain/flora variants, moisture).
 */
function buildTerrainPayload(
    coord: AxialCoord,
    existingData: TileData | null,
    mode: "paint" | "erase",
    enabledLayers: LayerConfig[]
): BrushPayloadResult | null {
    // Skip if no tile exists (Tile Brush creates tiles explicitly)
    if (!existingData) {
        return null;
    }

    // Build payload: Start with previous data (preserve disabled layers)
    // Phase 3: Icon-based terrain system (terrain, flora, backgroundColor)
    // Note: Region/Faction moved to Area Brush tool, preserved here
    // DEFENSIVE: Normalize empty strings to undefined (prevents validation errors)
    const payload: TileData = {
        terrain: existingData?.terrain || undefined,
        flora: existingData?.flora || undefined,
        backgroundColor: existingData?.backgroundColor || undefined,
        region: existingData?.region || undefined,      // Preserved (managed by Area Brush)
        faction: existingData?.faction || undefined,    // Preserved (managed by Area Brush)
        elevation: existingData?.elevation,
        moisture: existingData?.moisture,
        note: existingData?.note || undefined,
        locationMarker: existingData?.locationMarker || undefined,
        terrainVariants: existingData?.terrainVariants,  // Preserve variants
        floraVariants: existingData?.floraVariants,      // Preserve variants
    };

    if (mode === "erase") {
        // Erase only enabled layers, preserve disabled ones (Phase 3: Icon-based terrain + moisture)
        // Note: Region/Faction managed by Area Brush, not erased here
        for (const layer of enabledLayers) {
            if (layer.id === 'terrainType') {
                payload.terrain = undefined;
                payload.terrainVariants = undefined; // Clear variants when erasing terrain
            } else if (layer.id === 'flora') {
                payload.flora = undefined;
                payload.floraVariants = undefined; // Clear variants when erasing flora
            } else if (layer.id === 'moisture') {
                payload.moisture = undefined; // Clear moisture level
            }
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
        // Paint mode: Update only enabled layers (Phase 3: Icon-based terrain + moisture)
        // Note: Region/Faction managed by Area Brush, not painted here
        let hasChanges = false;

        for (const layer of enabledLayers) {
            if (layer.id === 'terrainType' && typeof layer.value === 'string') {
                const newTerrain = layer.value as TerrainType;

                // Skip if empty value (enabled but no selection)
                if (!newTerrain) continue;

                payload.terrain = newTerrain;
                hasChanges = true;

                // Generate random variants when terrain changes
                if (newTerrain !== existingData?.terrain) {
                    const positionConfig = getTerrainPositionConfig(newTerrain);
                    if (positionConfig) {
                        payload.terrainVariants = Array(positionConfig.positions.length)
                            .fill(0)
                            .map(() => getRandomTerrainVariant(newTerrain));
                    }
                } else {
                    // Preserve existing variants when repainting same terrain
                    payload.terrainVariants = existingData?.terrainVariants;
                }
            } else if (layer.id === 'flora' && typeof layer.value === 'string') {
                const newFlora = layer.value as FloraType;

                // Skip if empty value (enabled but no selection)
                if (!newFlora) continue;

                payload.flora = newFlora;
                hasChanges = true;

                // Generate random variants when flora changes
                if (newFlora !== existingData?.flora) {
                    const positionConfig = getFloraPositionConfig(newFlora);
                    if (positionConfig) {
                        payload.floraVariants = Array(positionConfig.positions.length)
                            .fill(0)
                            .map(() => getRandomFloraVariant(newFlora));
                    }
                } else {
                    // Preserve existing variants when repainting same flora
                    payload.floraVariants = existingData?.floraVariants;
                }
            } else if (layer.id === 'moisture' && typeof layer.value === 'string') {
                // Skip if empty value (enabled but no selection)
                if (!layer.value) continue;

                // Set moisture level (no variants needed, overlay handles visualization)
                payload.moisture = layer.value as MoistureLevel;
                hasChanges = true;
            }
        }

        // Only save if changes were made (skip if all layers had empty values)
        if (hasChanges) {
            return { save: { coord, data: payload, previousData: existingData } };
        }

        return null;
    }
}

/**
 * Wendet den Brush auf die Karte an und rollt Änderungen bei Fehlern zurück.
 * Verarbeitet Tiles in Chunks, um UI-Blocking zu vermeiden.
 *
 * Phase 3: Icon-Based Terrain System - supports terrainType, flora, backgroundColor layers.
 * Supports terrain-layer editing: Only enabled layers are updated, disabled layers preserve existing values.
 */
export async function applyBrush(
    app: App,
    mapFile: TFile,
    center: BrushCoord,
    opts: BrushOptions,
    handles: RenderHandles,
    context?: BrushExecutionContext
): Promise<void> {
    const mode = opts.mode ?? "paint";
    const brushRadius = Math.max(0, opts.brushRadius | 0);
    const layers = opts.layers ?? [];

    // Validate: At least one enabled layer required
    const enabledLayers = layers.filter(l => l.enabled);
    if (enabledLayers.length === 0) {
        logger.warn("No enabled layers - brush will have no effect");
        return;
    }

    const tool = context?.tool ?? null;
    const toolName = context?.toolName ?? "terrain-brush";
    const abortSignal = tool?.getAbortSignal?.() ?? null;

    // Execute brush using unified executor
    try {
        await executeBrush(
            {
                app,
                mapFile,
                center,
                brushRadius,
                toolName,
                abortSignal,
                setStatus: tool?.setStatus,
            },
            {
                buildPayload: (coord, existingData, throwIfAborted) => {
                    return buildTerrainPayload(coord, existingData, mode, enabledLayers);
                },
                onSaved: (saved) => {
                    // Update rendering for saved tiles
                    for (const { coord, data } of saved) {
                        handles.setTerrainIcon(coord, data.terrain);
                        handles.setFloraIcon(coord, data.flora);
                        handles.setBackgroundColor(coord, data.backgroundColor);
                        handles.setMoisture?.(coord, data.moisture);
                    }
                },
                onDeleted: (deleted) => {
                    // Clear rendering for deleted tiles
                    for (const { coord } of deleted) {
                        handles.setTerrainIcon(coord, undefined);
                        handles.setFloraIcon(coord, undefined);
                        handles.setBackgroundColor(coord, undefined);
                        handles.setMoisture?.(coord, undefined);
                    }
                },
                restoreSaveVisual: (coord, previousData) => {
                    // Restore visuals when rolling back saves
                    handles.setTerrainIcon(coord, previousData?.terrain);
                    handles.setFloraIcon(coord, previousData?.flora);
                    handles.setBackgroundColor(coord, previousData?.backgroundColor);
                    handles.setMoisture?.(coord, previousData?.moisture);
                },
                restoreDeleteVisual: (coord, previousData) => {
                    // Restore visuals when rolling back deletes
                    handles.setTerrainIcon(coord, previousData?.terrain);
                    handles.setFloraIcon(coord, previousData?.flora);
                    handles.setBackgroundColor(coord, previousData?.backgroundColor);
                    handles.setMoisture?.(coord, previousData?.moisture);
                },
            }
        );
    } catch (error) {
        // Add telemetry reporting for non-abort errors (maintains test compatibility)
        const aborted = isAbortError(error);
        if (!aborted) {
            const message = reportEditorToolIssue({
                stage: "operation",
                toolId: toolName,
                error,
            });
            if (typeof error === "object" && error) {
                (error as Record<string, unknown>).__smToolMessage = message;
            }
            try {
                tool?.setStatus?.(message);
            } catch (statusErr) {
                logger.error("failed to publish tool status", statusErr);
            }
        }
        throw error;
    }
}
