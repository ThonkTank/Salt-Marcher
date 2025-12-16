// src/workmodes/cartographer/services/map-initializer.ts
// Map system initialization extracted from controller
//
// Responsibilities:
// - Apply climate settings from map options
// - Sync faction territories to overlay store
// - Load terrain features from disk
//
// All operations are non-fatal (failures logged as warnings, not errors)

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-map-initializer");
import { syncFactionTerritoriesForMap } from "@features/factions/faction-integration";
import { getTerrainFeatureStore } from "@features/maps";
import type { HexOptions } from "@features/maps/config/options";

/**
 * Result of system initialization
 */
export type MapInitializerResult = {
    /** Warning messages from non-fatal errors */
    warnings: string[];
};

/**
 * Initialize map-related systems after successful map load
 *
 * This function performs several initialization tasks that depend on a
 * successfully loaded map:
 * 1. Apply climate settings to global climate engine
 * 2. Sync faction territories to overlay store
 * 3. Load terrain features from disk
 *
 * All operations are non-fatal - failures are logged as warnings and returned
 * for display, but do not prevent the map from loading.
 *
 * @param app - Obsidian app instance
 * @param file - Map file being loaded
 * @param options - Parsed hex options from file
 * @returns Result with any warning messages
 */
export async function initializeMapSystems(
    app: App,
    file: TFile,
    options: HexOptions
): Promise<MapInitializerResult> {
    const warnings: string[] = [];

    // Apply climate settings from map options
    try {
        applyClimateSettings(options);
        logger.info("Applied climate settings from map", {
            baseTemperature: options.climate.globalBaseTemperature,
            windDirection: options.climate.globalWindDirection,
        });
    } catch (error) {
        const msg = `Failed to apply climate settings: ${error.message}`;
        logger.warn("" + msg, { mapPath: file.path, error });
        warnings.push(msg);
    }

    // Sync faction territories to overlay store
    try {
        await syncFactionTerritoriesForMap(app, file);
        logger.info("Synced faction territories for map", {
            mapPath: file.path,
        });
    } catch (error) {
        const msg = `Failed to sync faction territories: ${error.message}`;
        logger.warn("" + msg, {
            mapPath: file.path,
            error: error.message,
        });
        warnings.push(msg);
        // Non-fatal - continue loading map
    }

    // Load terrain features from disk
    try {
        const terrainFeatureStore = getTerrainFeatureStore(app, file);
        await terrainFeatureStore.load();
        logger.info("Loaded terrain features for map", {
            mapPath: file.path,
            featureCount: terrainFeatureStore.list().length,
        });
    } catch (error) {
        const msg = `Failed to load terrain features: ${error.message}`;
        logger.warn("" + msg, {
            mapPath: file.path,
            error: error.message,
        });
        warnings.push(msg);
        // Non-fatal - continue loading map
    }

    return { warnings };
}

/**
 * Apply climate settings from map options to the global climate engine.
 * This ensures all climate calculations use the correct base temperature and wind direction.
 */
function applyClimateSettings(options: HexOptions): void {
    const { getClimateEngine } = require("@services/climate");
    const engine = getClimateEngine();

    engine.updateConfig({
        globalBaseTemperature: options.climate.globalBaseTemperature,
        globalWindDirection: options.climate.globalWindDirection,
    });
}
