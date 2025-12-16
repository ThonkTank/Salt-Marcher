// src/workmodes/cartographer/services/map-loader.ts
// Pure map loading logic extracted from controller
//
// Responsibilities:
// - Load hex options from file
// - Create map layer (rendering)
// - Handle abort signals
// - Return structured results for controller to apply

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-map-loader");
import type { HexOptions } from "@features/maps/config/options";
import type { MapLayer } from "../../session-runner/travel/ui/map-layer";
import type { CartographerViewHandle } from "../cartographer-types";

/**
 * Result of map loading operation
 */
export type MapLoadResult = {
    /** Map rendering layer (null if loading failed) */
    layer: MapLayer | null;

    /** Parsed hex options (null if parsing failed) */
    options: HexOptions | null;

    /** Error message for overlay (null if successful) */
    overlayMessage: string | null;

    /** Cleanup function to call on abort/error */
    cleanup: () => void;
};

/**
 * Dependencies for map loading (injected by controller)
 */
export type MapLoaderDeps = {
    loadHexOptions(app: App, file: TFile): Promise<HexOptions | null>;
    createMapLayer(app: App, host: HTMLElement, file: TFile, opts: HexOptions): Promise<MapLayer>;
};

/**
 * Load map data and create rendering layer
 *
 * This is a pure function that handles all map loading logic without mutating
 * controller state. The controller is responsible for applying the results.
 *
 * @param app - Obsidian app instance
 * @param file - Map file to load (null = no file selected)
 * @param view - View handle for map host
 * @param deps - Injected dependencies
 * @param signal - Abort signal for cancellation
 * @returns Structured result with layer, options, and cleanup function
 */
export async function loadMap(
    app: App,
    file: TFile | null,
    view: CartographerViewHandle,
    deps: MapLoaderDeps,
    signal: AbortSignal
): Promise<MapLoadResult> {
    // No file selected
    if (!file) {
        return {
            layer: null,
            options: null,
            overlayMessage: "Keine Karte ausgewählt.",
            cleanup: () => {},
        };
    }

    // Load hex options from file
    let options: HexOptions | null = null;
    try {
        options = await deps.loadHexOptions(app, file);
    } catch (error) {
        logger.error("failed to parse map options", error);
    }

    // Check abort after async operation
    if (signal.aborted) {
        return {
            layer: null,
            options: null,
            overlayMessage: null,
            cleanup: () => {},
        };
    }

    // No hex options found
    if (!options) {
        return {
            layer: null,
            options: null,
            overlayMessage: "Kein hex3x3-Block in dieser Datei.",
            cleanup: () => {},
        };
    }

    // Create map layer (rendering)
    let layer: MapLayer | null = null;
    try {
        layer = await deps.createMapLayer(app, view.mapHost, file, options);
    } catch (error) {
        logger.error("failed to render map", error);
        layer = null;
    }

    // Check abort after async operation
    if (signal.aborted) {
        // Cleanup layer if created
        if (layer) {
            layer.destroy();
        }
        return {
            layer: null,
            options: null,
            overlayMessage: null,
            cleanup: () => {},
        };
    }

    // Layer creation failed
    if (!layer) {
        return {
            layer: null,
            options: null,
            overlayMessage: "Karte konnte nicht geladen werden.",
            cleanup: () => {},
        };
    }

    // Success - return layer with cleanup function
    return {
        layer,
        options,
        overlayMessage: null,
        cleanup: () => {
            if (layer) {
                try {
                    layer.destroy();
                } catch (error) {
                    logger.error("failed to destroy map layer during cleanup", error);
                }
            }
        },
    };
}
