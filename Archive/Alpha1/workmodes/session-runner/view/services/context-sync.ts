// src/workmodes/session-runner/view/services/context-sync.ts
// Manages hex context synchronization: tile loading, weather generation, and UI updates.

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { axialToCube, type AxialCoord } from "@geometry";

const logger = configurableLogger.forModule("session-context-sync");
import { getWeatherOverlayStore, type WeatherOverlayEntry } from "@features/maps";
import type { WeatherState } from "@features/weather/weather-types";
import type { TileData } from "@domain";

/**
 * Hex context data aggregated from tile and weather sources.
 */
export interface HexContext {
    coord: AxialCoord;
    tileData: TileData | null;
    weather: WeatherState | null;
    speedCalculation: SpeedCalculation | null;
}

/**
 * Speed calculation breakdown for display.
 */
export interface SpeedCalculation {
    terrain?: string;
    terrainMod: number;
    flora?: string;
    floraMod: number;
    combined: number;
    hoursPerHex: number;
}

/**
 * Callbacks for context sync events.
 */
export interface ContextSyncCallbacks {
    /** Called when tile data is loaded */
    onTileLoaded?: (coord: AxialCoord, tileData: TileData | null) => void;
    /** Called when weather is loaded or generated */
    onWeatherLoaded?: (coord: AxialCoord, weather: WeatherState | null) => void;
    /** Called when weather generation starts (for placeholder UI) */
    onWeatherGenerating?: (coord: AxialCoord) => void;
    /** Called when speed calculation is ready */
    onSpeedCalculated?: (coord: AxialCoord, calculation: SpeedCalculation | null) => void;
    /** Called when context sync fails */
    onError?: (coord: AxialCoord, error: Error) => void;
}

/**
 * Options for creating a ContextSyncService.
 */
export interface ContextSyncOptions {
    app: App;
    callbacks?: ContextSyncCallbacks;
}

/**
 * Handle for the ContextSyncService.
 */
export interface ContextSyncHandle {
    /**
     * Sync context for a hex coordinate.
     * Loads tile data and weather, generating weather on-demand if needed.
     * @param mapFile The current map file
     * @param coord The hex coordinate to sync (Axial format: {q, r})
     * @param tokenSpeed Current travel speed (for hours per hex calculation)
     */
    syncHex(
        mapFile: TFile,
        coord: AxialCoord,
        tokenSpeed?: number
    ): Promise<HexContext>;

    /**
     * Clear context (e.g., when no hex is selected).
     */
    clearContext(): void;

    /**
     * Dispose the service.
     */
    dispose(): void;
}

/**
 * Convert WeatherOverlayEntry to WeatherState.
 * Fills in missing fields with reasonable defaults based on weather type and severity.
 */
function convertToWeatherState(
    entry: WeatherOverlayEntry,
    coord: AxialCoord
): WeatherState {
    // coord is already in axial format {q, r}
    const cube = axialToCube(coord);

    // Calculate wind speed based on weather type and severity
    let windSpeed = 5; // Default light breeze
    if (entry.weatherType === "wind" || entry.weatherType === "storm") {
        windSpeed = 20 + entry.severity * 60; // 20-80 km/h
    } else if (entry.weatherType === "clear") {
        windSpeed = 0 + entry.severity * 10; // 0-10 km/h
    }

    // Calculate precipitation based on weather type
    let precipitation = 0;
    if (entry.weatherType === "rain") {
        precipitation = entry.severity * 10; // 0-10 mm/h
    } else if (entry.weatherType === "storm") {
        precipitation = 5 + entry.severity * 20; // 5-25 mm/h
    } else if (entry.weatherType === "snow") {
        precipitation = entry.severity * 5; // 0-5 mm/h (water equivalent)
    }

    // Calculate visibility based on weather type
    let visibility = 10000; // Default 10km
    if (entry.weatherType === "fog") {
        visibility = 1000 - entry.severity * 900; // 100m-1km
    } else if (entry.weatherType === "storm" || entry.weatherType === "snow") {
        visibility = 5000 - entry.severity * 4000; // 1-5km
    } else if (entry.weatherType === "rain") {
        visibility = 8000 - entry.severity * 3000; // 5-8km
    }

    return {
        hexCoord: { q: cube.q, r: cube.r, s: cube.s },
        currentWeather: {
            type: entry.weatherType,
            severity: entry.severity,
            duration: 24, // Default 24 hours
        },
        temperature: entry.temperature,
        windSpeed,
        precipitation,
        visibility,
        lastUpdate: entry.lastUpdate,
    };
}

/**
 * Create a ContextSyncService for managing hex context synchronization.
 */
export function createContextSyncService(
    options: ContextSyncOptions
): ContextSyncHandle {
    const { app, callbacks } = options;

    // Track current sync to avoid race conditions
    let currentSyncCoord: AxialCoord | null = null;
    let disposed = false;

    /**
     * Load tile data for a coordinate.
     */
    async function loadTileData(
        mapFile: TFile,
        coord: AxialCoord
    ): Promise<TileData | null> {
        try {
            const { loadTile } = await import("@features/maps");
            return await loadTile(app, mapFile, coord);
        } catch (error) {
            logger.error("Failed to load tile data", { coord, error });
            return null;
        }
    }

    /**
     * Load or generate weather for a coordinate.
     */
    async function loadWeather(
        mapFile: TFile,
        coord: AxialCoord
    ): Promise<WeatherState | null> {
        try {
            const weatherOverlayStore = getWeatherOverlayStore(app, mapFile);
            let weatherEntry = weatherOverlayStore.get(coord);

            if (!weatherEntry) {
                // Generate weather on-demand
                logger.debug("Generating weather on-demand", { coord });
                callbacks?.onWeatherGenerating?.(coord);

                await weatherOverlayStore.generateWeatherForHex(coord);
                weatherEntry = weatherOverlayStore.get(coord);

                if (!weatherEntry) {
                    logger.warn("Weather generation failed", { coord });
                    return null;
                }
            }

            return convertToWeatherState(weatherEntry, coord);
        } catch (error) {
            logger.error("Failed to load/generate weather", { coord, error });
            return null;
        }
    }

    /**
     * Calculate speed modifiers for terrain/flora.
     */
    async function calculateSpeed(
        tileData: TileData | null,
        tokenSpeed: number
    ): Promise<SpeedCalculation | null> {
        if (!tileData) {
            return null;
        }

        try {
            const {
                getMovementSpeed,
                TERRAIN_SPEED_MODIFIERS,
                FLORA_SPEED_MODIFIERS,
            } = await import("@features/maps");

            const terrainMod = tileData.terrain
                ? TERRAIN_SPEED_MODIFIERS[tileData.terrain as keyof typeof TERRAIN_SPEED_MODIFIERS] ?? 1.0
                : 1.0;
            const floraMod = tileData.flora
                ? FLORA_SPEED_MODIFIERS[tileData.flora as keyof typeof FLORA_SPEED_MODIFIERS] ?? 1.0
                : 1.0;
            const combined = getMovementSpeed(
                tileData.terrain as any,
                tileData.flora as any,
                tileData.moisture as any
            );
            const hoursPerHex = 3 / (tokenSpeed * combined); // 3 miles per hex

            return {
                terrain: tileData.terrain,
                terrainMod,
                flora: tileData.flora,
                floraMod,
                combined,
                hoursPerHex,
            };
        } catch (error) {
            logger.error("Failed to calculate speed", { error });
            return null;
        }
    }

    /**
     * Sync all context for a hex.
     */
    async function syncHex(
        mapFile: TFile,
        coord: AxialCoord,
        tokenSpeed = 1
    ): Promise<HexContext> {
        if (disposed) {
            return { coord, tileData: null, weather: null, speedCalculation: null };
        }

        currentSyncCoord = coord;

        try {
            // Load tile and weather in parallel
            const [tileData, weather] = await Promise.all([
                loadTileData(mapFile, coord),
                loadWeather(mapFile, coord),
            ]);

            // Check if this sync is still current (avoid race conditions)
            if (disposed || !currentSyncCoord || currentSyncCoord.q !== coord.q || currentSyncCoord.r !== coord.r) {
                return { coord, tileData: null, weather: null, speedCalculation: null };
            }

            // Notify tile loaded
            callbacks?.onTileLoaded?.(coord, tileData);

            // Notify weather loaded
            callbacks?.onWeatherLoaded?.(coord, weather);

            // Calculate speed
            const speedCalculation = await calculateSpeed(tileData, tokenSpeed);
            if (!disposed && currentSyncCoord && currentSyncCoord.q === coord.q && currentSyncCoord.r === coord.r) {
                callbacks?.onSpeedCalculated?.(coord, speedCalculation);
            }

            logger.debug("Hex synced", {
                coord,
                hasTile: !!tileData,
                hasWeather: !!weather,
            });

            return { coord, tileData, weather, speedCalculation };
        } catch (error) {
            logger.error("Sync failed", { coord, error });
            callbacks?.onError?.(coord, error as Error);
            return { coord, tileData: null, weather: null, speedCalculation: null };
        }
    }

    function clearContext(): void {
        currentSyncCoord = null;
        callbacks?.onTileLoaded?.({ q: -1, r: -1 }, null);
        callbacks?.onWeatherLoaded?.({ q: -1, r: -1 }, null);
        callbacks?.onSpeedCalculated?.({ q: -1, r: -1 }, null);
    }

    function dispose(): void {
        disposed = true;
        currentSyncCoord = null;
        logger.debug("Disposed");
    }

    return {
        syncHex,
        clearContext,
        dispose,
    };
}
