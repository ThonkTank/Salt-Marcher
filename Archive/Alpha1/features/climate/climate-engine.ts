// src/features/climate/climate-engine.ts
// Main facade for terrain-derived climate calculations
//
// ClimateEngine provides a unified interface for all climate calculations,
// combining amplitude, temperature, and phase calculations with caching.

import type {
    DiurnalPhase,
    ClimateCalculationResult,
    ClimateInputTile,
    AmplitudeBreakdown,
    BaseTemperatureBreakdown,
} from "./climate-types";
import {
    getPhaseFromHour,
    PHASES_IN_ORDER,
    DEFAULT_GLOBAL_BASE_TEMP,
} from "./climate-types";
import {
    calculateDiurnalAmplitude,
    getAmplitudeBreakdown,
    formatAmplitudeBreakdown,
} from "./amplitude-calculator";
import {
    calculateBaseTemperature,
    getBaseTemperatureBreakdown,
    formatBaseTemperatureBreakdown,
    getPhaseTemperature,
    getAllPhaseTemperatures,
    getSeasonFromDay,
    getSeasonLabel,
    type Season,
} from "./temperature-calculator";

// ============================================================================
// Climate Engine Configuration
// ============================================================================

/**
 * Configuration options for the ClimateEngine.
 */
export interface ClimateEngineConfig {
    /** Global base temperature for the map (default: 15°C) */
    globalBaseTemperature: number;
    /** Global wind direction for rain shadow (0-360°, default: 270° = West) */
    globalWindDirection: number;
    /** Whether to use sine-based seasonal smoothing (default: false) */
    useSmoothSeasons: boolean;
}

const DEFAULT_CONFIG: ClimateEngineConfig = {
    globalBaseTemperature: DEFAULT_GLOBAL_BASE_TEMP,
    globalWindDirection: 270, // Westerly winds (common for temperate zones)
    useSmoothSeasons: false,
};

// ============================================================================
// Climate Engine Class
// ============================================================================

/**
 * Main entry point for climate calculations.
 *
 * ClimateEngine provides:
 * 1. Unified interface for all climate queries
 * 2. Caching for expensive calculations
 * 3. Configuration management (global base temp, wind direction)
 * 4. UI-friendly breakdown information
 *
 * @example
 * const engine = new ClimateEngine();
 *
 * // Get climate for a tile at 2pm on day 180
 * const result = engine.getClimateAt(tile, 14, 180);
 * console.log(result.temperature); // => 28.5
 * console.log(result.phase);       // => "midday"
 *
 * // Get all daily temperatures
 * const daily = engine.getDailyTemperatures(tile, 180);
 * // => { dawn: 12, morning: 18, midday: 26, afternoon: 28, evening: 22, night: 14 }
 */
export class ClimateEngine {
    private config: ClimateEngineConfig;

    // Simple LRU-ish cache for amplitude calculations
    // Key: JSON.stringify of relevant tile properties
    private amplitudeCache: Map<string, AmplitudeBreakdown> = new Map();
    private readonly MAX_CACHE_SIZE = 500;

    constructor(config: Partial<ClimateEngineConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    /**
     * Get current configuration.
     */
    getConfig(): Readonly<ClimateEngineConfig> {
        return { ...this.config };
    }

    /**
     * Update configuration. Clears cache if relevant settings change.
     */
    updateConfig(updates: Partial<ClimateEngineConfig>): void {
        const oldBaseTemp = this.config.globalBaseTemperature;
        this.config = { ...this.config, ...updates };

        // Clear cache if base temp changed (affects all calculations)
        if (updates.globalBaseTemperature !== undefined &&
            updates.globalBaseTemperature !== oldBaseTemp) {
            this.clearCache();
        }
    }

    /**
     * Set global base temperature.
     */
    setGlobalBaseTemp(temp: number): void {
        this.updateConfig({ globalBaseTemperature: temp });
    }

    /**
     * Set global wind direction.
     */
    setWindDirection(direction: number): void {
        this.updateConfig({ globalWindDirection: direction });
    }

    // ========================================================================
    // Main API
    // ========================================================================

    /**
     * Get complete climate data for a tile at a specific time.
     *
     * @param tile Tile with terrain, moisture, flora, elevation, climate
     * @param hourOfDay Hour in 24-hour format (0-23)
     * @param dayOfYear Day of year (1-365)
     * @returns Complete climate calculation result
     */
    getClimateAt(
        tile: ClimateInputTile | undefined,
        hourOfDay: number,
        dayOfYear: number
    ): ClimateCalculationResult {
        const phase = getPhaseFromHour(hourOfDay);
        const season = getSeasonFromDay(dayOfYear);

        // Get amplitude (possibly cached)
        const amplitudeBreakdown = this.getAmplitudeBreakdownCached(tile);
        const amplitude = amplitudeBreakdown.total;

        // Get base temperature
        const baseBreakdown = getBaseTemperatureBreakdown(
            tile,
            season,
            this.config.globalBaseTemperature
        );
        const baseTemperature = baseBreakdown.total;

        // Calculate all phase temperatures
        const phaseTemperatures = getAllPhaseTemperatures(baseTemperature, amplitude);

        // Get specific temperature for requested hour
        const temperature = getPhaseTemperature(baseTemperature, amplitude, phase);

        return {
            temperature,
            phase,
            baseTemperature,
            amplitude,
            phaseTemperatures,
            amplitudeBreakdown,
            baseBreakdown,
        };
    }

    /**
     * Get temperature at a specific hour and day.
     * Simplified version of getClimateAt for quick queries.
     */
    getTemperatureAt(
        tile: ClimateInputTile | undefined,
        hourOfDay: number,
        dayOfYear: number
    ): number {
        const phase = getPhaseFromHour(hourOfDay);
        const season = getSeasonFromDay(dayOfYear);

        const amplitude = calculateDiurnalAmplitude(tile);
        const baseTemp = calculateBaseTemperature(
            tile,
            season,
            this.config.globalBaseTemperature
        );

        return getPhaseTemperature(baseTemp, amplitude, phase);
    }

    /**
     * Get all 6 phase temperatures for a day.
     * Useful for displaying daily temperature curve in inspector.
     */
    getDailyTemperatures(
        tile: ClimateInputTile | undefined,
        dayOfYear: number
    ): Record<DiurnalPhase, number> {
        const season = getSeasonFromDay(dayOfYear);
        const amplitude = calculateDiurnalAmplitude(tile);
        const baseTemp = calculateBaseTemperature(
            tile,
            season,
            this.config.globalBaseTemperature
        );

        return getAllPhaseTemperatures(baseTemp, amplitude);
    }

    /**
     * Get just the amplitude for a tile (cached).
     */
    getAmplitude(tile: ClimateInputTile | undefined): number {
        return this.getAmplitudeBreakdownCached(tile).total;
    }

    /**
     * Get amplitude breakdown for UI display.
     */
    getAmplitudeBreakdown(tile: ClimateInputTile | undefined): AmplitudeBreakdown {
        return this.getAmplitudeBreakdownCached(tile);
    }

    /**
     * Get base temperature breakdown for UI display.
     */
    getBaseTemperatureBreakdown(
        tile: ClimateInputTile | undefined,
        dayOfYear: number
    ): BaseTemperatureBreakdown {
        const season = getSeasonFromDay(dayOfYear);
        return getBaseTemperatureBreakdown(
            tile,
            season,
            this.config.globalBaseTemperature
        );
    }

    // ========================================================================
    // UI Helper Methods
    // ========================================================================

    /**
     * Format complete climate breakdown for inspector display.
     * Returns human-readable strings showing all factors.
     */
    formatClimateBreakdown(
        tile: ClimateInputTile | undefined,
        dayOfYear: number
    ): {
        amplitudeLines: string[];
        temperatureLines: string[];
        season: string;
        amplitude: number;
        baseTemp: number;
    } {
        const season = getSeasonFromDay(dayOfYear);
        const amplitudeBreakdown = this.getAmplitudeBreakdownCached(tile);
        const tempBreakdown = getBaseTemperatureBreakdown(
            tile,
            season,
            this.config.globalBaseTemperature
        );

        return {
            amplitudeLines: formatAmplitudeBreakdown(amplitudeBreakdown, tile),
            temperatureLines: formatBaseTemperatureBreakdown(tempBreakdown, tile, season),
            season: getSeasonLabel(season),
            amplitude: amplitudeBreakdown.total,
            baseTemp: tempBreakdown.total,
        };
    }

    /**
     * Get phase temperatures as an array for graph rendering.
     * Returns [dawn, morning, midday, afternoon, evening, night].
     */
    getPhaseTemperatureArray(
        tile: ClimateInputTile | undefined,
        dayOfYear: number
    ): number[] {
        const temps = this.getDailyTemperatures(tile, dayOfYear);
        return PHASES_IN_ORDER.map(phase => temps[phase]);
    }

    /**
     * Get min/max temperatures for the day.
     */
    getDailyMinMax(
        tile: ClimateInputTile | undefined,
        dayOfYear: number
    ): { min: number; max: number } {
        const temps = this.getDailyTemperatures(tile, dayOfYear);
        const values = Object.values(temps);
        return {
            min: Math.min(...values),
            max: Math.max(...values),
        };
    }

    // ========================================================================
    // Cache Management
    // ========================================================================

    /**
     * Get amplitude breakdown with caching.
     * Amplitude depends only on terrain properties, not time.
     */
    private getAmplitudeBreakdownCached(
        tile: ClimateInputTile | undefined
    ): AmplitudeBreakdown {
        const key = this.getAmplitudeCacheKey(tile);

        let breakdown = this.amplitudeCache.get(key);
        if (!breakdown) {
            breakdown = getAmplitudeBreakdown(tile);

            // Simple cache eviction: clear half when full
            if (this.amplitudeCache.size >= this.MAX_CACHE_SIZE) {
                const keysToDelete = Array.from(this.amplitudeCache.keys())
                    .slice(0, this.MAX_CACHE_SIZE / 2);
                keysToDelete.forEach(k => this.amplitudeCache.delete(k));
            }

            this.amplitudeCache.set(key, breakdown);
        }

        return breakdown;
    }

    /**
     * Generate cache key from tile properties relevant to amplitude.
     */
    private getAmplitudeCacheKey(tile: ClimateInputTile | undefined): string {
        if (!tile) return "empty";
        return `${tile.terrain ?? ""}_${tile.moisture ?? ""}_${tile.flora ?? ""}_${tile.elevation ?? 0}`;
    }

    /**
     * Clear all caches.
     */
    clearCache(): void {
        this.amplitudeCache.clear();
    }

    /**
     * Get cache statistics (for debugging).
     */
    getCacheStats(): { amplitudeCacheSize: number } {
        return {
            amplitudeCacheSize: this.amplitudeCache.size,
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default global climate engine instance.
 * Use this for most cases, or create a new instance for different configurations.
 */
let defaultEngine: ClimateEngine | null = null;

/**
 * Get the default ClimateEngine instance.
 * Creates one on first call with default configuration.
 */
export function getClimateEngine(): ClimateEngine {
    if (!defaultEngine) {
        defaultEngine = new ClimateEngine();
    }
    return defaultEngine;
}

/**
 * Reset the default engine (for testing).
 */
export function resetClimateEngine(): void {
    defaultEngine = null;
}

// ============================================================================
// Convenience Exports
// ============================================================================

// Re-export commonly used functions for direct access
export {
    calculateDiurnalAmplitude,
    calculateBaseTemperature,
    getPhaseTemperature,
    getAllPhaseTemperatures,
    getPhaseFromHour,
    getSeasonFromDay,
    type Season,
};
