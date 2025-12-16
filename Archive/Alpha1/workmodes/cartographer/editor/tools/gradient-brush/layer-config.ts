/**
 * Layer configuration for gradient brush
 *
 * Defines min/max bounds, defaults, and tile key mappings for each paintable layer.
 */

/**
 * Available gradient layers
 * - elevation: Height above sea level
 * - groundwater: Subsurface water saturation
 * - fertility: Soil fertility
 * - temperatureOffset: Local temperature modifier
 */
export type GradientLayer =
    | "elevation"
    | "groundwater"
    | "fertility"
    | "temperatureOffset";

/**
 * Layer configuration metadata
 */
export interface LayerConfig {
    /** Minimum allowed value */
    min: number;
    /** Maximum allowed value */
    max: number;
    /** Default delta when brush is initialized */
    defaultDelta: number;
    /** Display unit */
    unit: string;
    /** Path to value in tile object (supports dot notation for nested) */
    tileKey: string;
}

/**
 * Configuration for all gradient layers
 *
 * Defines bounds and defaults for each paintable base layer value.
 *
 * @example
 * ```typescript
 * const elevConfig = LAYER_CONFIG.elevation;
 * console.log(elevConfig.min);  // -100
 * console.log(elevConfig.max);  // 5000
 * console.log(elevConfig.unit); // "m"
 * ```
 */
export const LAYER_CONFIG: Record<GradientLayer, LayerConfig> = {
    /**
     * Elevation in meters
     * Range: -100m (below sea level) to 5000m (mountain peaks)
     */
    elevation: {
        min: -100,
        max: 5000,
        defaultDelta: 100,
        unit: "m",
        tileKey: "elevation"
    },

    /**
     * Groundwater saturation percentage
     * Range: 0% (arid) to 100% (saturated)
     */
    groundwater: {
        min: 0,
        max: 100,
        defaultDelta: 10,
        unit: "%",
        tileKey: "groundwater"
    },

    /**
     * Soil fertility percentage
     * Range: 0% (barren) to 100% (highly fertile)
     */
    fertility: {
        min: 0,
        max: 100,
        defaultDelta: 10,
        unit: "%",
        tileKey: "fertility"
    },

    /**
     * Local temperature offset in Celsius
     * Range: -30°C to +30°C (relative to base climate)
     */
    temperatureOffset: {
        min: -30,
        max: 30,
        defaultDelta: 5,
        unit: "°C",
        tileKey: "climate.temperatureOffset"
    }
};
