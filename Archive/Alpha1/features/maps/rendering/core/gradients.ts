// src/features/maps/rendering/core/gradients.ts
// Color mapping system for elevation and moisture gradients
//
// Moved from: rendering/gradients/color-mapping.ts
// Converts numeric values to discrete hex colors for tile overlays.
// Each tile displays ONE solid color based on its value.

/**
 * Color stop for gradient interpolation
 */
export type ColorStop = {
    value: number;
    color: string; // Hex color (e.g., "#1a237e")
};

/**
 * Elevation gradient configuration
 * Maps elevation (meters) to colors
 *
 * Range: -100m (deep underwater) to +5000m (mountain peaks)
 *
 * Color scheme:
 * - Deep blue: Deep underwater (-100m)
 * - Light blue: Sea level (0m)
 * - Green/Yellow: Low elevation (0-1000m)
 * - Orange: Mid elevation (1000-2500m)
 * - Red: High elevation (2500m+)
 */
export const ELEVATION_GRADIENT: ColorStop[] = [
    { value: -100, color: "#1a237e" },  // Deep ocean blue (underwater)
    { value: -50, color: "#1565c0" },   // Ocean blue (shallow water)
    { value: 0, color: "#64b5f6" },     // Sea level light blue
    { value: 500, color: "#81c784" },   // Low plains green
    { value: 1000, color: "#ffeb3b" },  // Low hills yellow
    { value: 2000, color: "#ff9800" },  // Mid elevation orange
    { value: 3500, color: "#ef5350" },  // High elevation red-orange
    { value: 5000, color: "#c62828" },  // Peak red
];

/**
 * Moisture gradient configuration
 * Maps saturation (0.0-1.0) to colors
 *
 * Range: 0.0 (completely dry) to 1.0 (fully saturated)
 *
 * Color scheme:
 * - Very light blue: Dry (0.0)
 * - Light blue: Low moisture (0.2)
 * - Medium blue: Moderate moisture (0.5)
 * - Dark blue: High moisture (0.8)
 * - Deep blue: Saturated (1.0)
 */
export const MOISTURE_GRADIENT: ColorStop[] = [
    { value: 0.0, color: "#e3f2fd" },   // Very dry light blue
    { value: 0.2, color: "#90caf9" },   // Dry light blue
    { value: 0.5, color: "#42a5f5" },   // Medium blue
    { value: 0.8, color: "#1976d2" },   // Moist dark blue
    { value: 1.0, color: "#0d47a1" },   // Saturated deep blue
];

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    };
}

/**
 * Convert RGB components to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
        const clamped = Math.max(0, Math.min(255, Math.round(n)));
        return clamped.toString(16).padStart(2, "0");
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Linearly interpolate between two numbers
 */
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Interpolate color between two RGB colors
 */
function lerpColor(color1: string, color2: string, t: number): string {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    const r = lerp(rgb1.r, rgb2.r, t);
    const g = lerp(rgb1.g, rgb2.g, t);
    const b = lerp(rgb1.b, rgb2.b, t);

    return rgbToHex(r, g, b);
}

/**
 * Interpolate color from a gradient defined by color stops
 *
 * @param value - Input value
 * @param stops - Array of color stops (must be sorted by value)
 * @returns Hex color string
 */
function interpolateColor(value: number, stops: ColorStop[]): string {
    if (stops.length === 0) {
        return "#808080"; // Default gray
    }

    if (stops.length === 1) {
        return stops[0].color;
    }

    // Clamp to first/last stop if out of range
    if (value <= stops[0].value) {
        return stops[0].color;
    }
    if (value >= stops[stops.length - 1].value) {
        return stops[stops.length - 1].color;
    }

    // Find the two stops to interpolate between
    for (let i = 0; i < stops.length - 1; i++) {
        const stop1 = stops[i];
        const stop2 = stops[i + 1];

        if (value >= stop1.value && value <= stop2.value) {
            // Calculate interpolation factor (0.0 to 1.0)
            const range = stop2.value - stop1.value;
            const t = range === 0 ? 0 : (value - stop1.value) / range;

            return lerpColor(stop1.color, stop2.color, t);
        }
    }

    // Fallback (should never reach here)
    return stops[stops.length - 1].color;
}

/**
 * Convert elevation (meters) to hex color
 *
 * @param elevation - Height in meters above sea level (-100 to +5000)
 * @returns Hex color string (e.g., "#64b5f6")
 */
export function elevationToColor(elevation: number): string {
    return interpolateColor(elevation, ELEVATION_GRADIENT);
}

/**
 * Convert moisture saturation to hex color
 *
 * @param saturation - Soil moisture (0.0 = dry, 1.0 = saturated)
 * @returns Hex color string (e.g., "#42a5f5")
 */
export function moistureToColor(saturation: number): string {
    return interpolateColor(saturation, MOISTURE_GRADIENT);
}

/**
 * Get elevation color with custom opacity
 *
 * @param elevation - Height in meters
 * @param opacity - Opacity (0.0 to 1.0)
 * @returns Color object for overlay rendering
 */
export function getElevationColorWithOpacity(elevation: number, opacity: number = 0.7): { color: string; opacity: number } {
    return {
        color: elevationToColor(elevation),
        opacity: Math.max(0, Math.min(1, opacity)),
    };
}

/**
 * Get moisture color with custom opacity
 *
 * @param saturation - Soil moisture (0.0-1.0)
 * @param opacity - Opacity (0.0 to 1.0)
 * @returns Color object for overlay rendering
 */
export function getMoistureColorWithOpacity(saturation: number, opacity: number = 0.6): { color: string; opacity: number } {
    return {
        color: moistureToColor(saturation),
        opacity: Math.max(0, Math.min(1, opacity)),
    };
}

// ============================================================================
// Unified Gradient Interpolation Functions
// ============================================================================
// These functions provide generic color interpolation for overlay layers.
// They unify the pattern used across elevation, fertility, groundwater, and
// climate overlays, reducing code duplication and enabling consistent behavior.

/**
 * RGB color stop for gradient interpolation
 *
 * Defines a color at a specific position in a gradient using raw RGB values.
 * Used for gradients that need direct RGB control (e.g., elevation, fertility).
 */
export interface RgbStop {
    /** Position in gradient (0.0 to 1.0, normalized) */
    position: number;
    /** Red component (0-255) */
    r: number;
    /** Green component (0-255) */
    g: number;
    /** Blue component (0-255) */
    b: number;
}

/**
 * Hex color stop for gradient interpolation
 *
 * Defines a color at a specific position using hex color strings.
 * Used for gradients defined with CSS colors (e.g., existing elevation gradient).
 */
export interface HexStop {
    /** Position in gradient (0.0 to 1.0, normalized) */
    position: number;
    /** Hex color in "#rrggbb" format */
    color: string;
}

/**
 * Interpolate RGB gradient at given normalized value
 *
 * Performs linear interpolation between gradient stops to produce a smooth
 * color transition. Values are clamped to the gradient's range.
 *
 * @param value - Normalized value (0.0 to 1.0) within the gradient
 * @param stops - Array of RGB stops sorted by position (ascending)
 * @returns CSS rgb() color string (e.g., "rgb(128, 64, 255)")
 *
 * @example
 * ```typescript
 * const gradient: RgbStop[] = [
 *   { position: 0.0, r: 0, g: 0, b: 255 },     // Blue at start
 *   { position: 1.0, r: 255, g: 0, b: 0 },     // Red at end
 * ];
 * const color = interpolateRgbGradient(0.5, gradient);
 * // Returns "rgb(128, 0, 128)" - purple (50% between blue and red)
 * ```
 */
export function interpolateRgbGradient(value: number, stops: RgbStop[]): string {
    // Handle edge cases
    if (stops.length === 0) {
        return "rgb(128, 128, 128)"; // Default gray
    }
    if (stops.length === 1) {
        const stop = stops[0];
        return `rgb(${stop.r}, ${stop.g}, ${stop.b})`;
    }

    // Clamp to [0, 1] range
    const clamped = Math.max(0, Math.min(1, value));

    // Clamp to first/last stop if outside range
    if (clamped <= stops[0].position) {
        const stop = stops[0];
        return `rgb(${stop.r}, ${stop.g}, ${stop.b})`;
    }
    if (clamped >= stops[stops.length - 1].position) {
        const stop = stops[stops.length - 1];
        return `rgb(${stop.r}, ${stop.g}, ${stop.b})`;
    }

    // Find surrounding stops for interpolation
    let lowerStop = stops[0];
    let upperStop = stops[stops.length - 1];

    for (let i = 0; i < stops.length - 1; i++) {
        const current = stops[i];
        const next = stops[i + 1];

        if (clamped >= current.position && clamped <= next.position) {
            lowerStop = current;
            upperStop = next;
            break;
        }
    }

    // Calculate interpolation factor (0.0 to 1.0 within segment)
    const range = upperStop.position - lowerStop.position;
    const t = range > 0 ? (clamped - lowerStop.position) / range : 0;

    // Linear interpolation of RGB components
    const r = Math.round(lowerStop.r + (upperStop.r - lowerStop.r) * t);
    const g = Math.round(lowerStop.g + (upperStop.g - lowerStop.g) * t);
    const b = Math.round(lowerStop.b + (upperStop.b - lowerStop.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Interpolate hex gradient at given normalized value
 *
 * Like interpolateRgbGradient, but accepts hex color stops and converts
 * internally to RGB for interpolation. Useful for gradients defined with
 * hex colors (e.g., existing ColorStop patterns).
 *
 * @param value - Normalized value (0.0 to 1.0) within the gradient
 * @param stops - Array of hex stops sorted by position (ascending)
 * @returns CSS hex color string (e.g., "#8040ff")
 *
 * @example
 * ```typescript
 * const gradient: HexStop[] = [
 *   { position: 0.0, color: "#0000ff" },  // Blue
 *   { position: 1.0, color: "#ff0000" },  // Red
 * ];
 * const color = interpolateHexGradient(0.5, gradient);
 * // Returns hex purple (50% between blue and red)
 * ```
 */
export function interpolateHexGradient(value: number, stops: HexStop[]): string {
    // Convert hex stops to RGB stops
    const rgbStops: RgbStop[] = stops.map((stop) => {
        const rgb = hexToRgb(stop.color);
        return {
            position: stop.position,
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
        };
    });

    // Use RGB interpolation
    const rgbColor = interpolateRgbGradient(value, rgbStops);

    // Convert rgb(r, g, b) back to hex
    const match = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return "#808080"; // Fallback gray

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);

    return rgbToHex(r, g, b);
}

/**
 * Convert value with range to normalized gradient color
 *
 * Convenience function that combines normalization and gradient interpolation.
 * Typical pattern: raw value (e.g., elevation in meters) → normalized 0-1 → color.
 *
 * @param value - Raw value to map to color
 * @param min - Minimum value in range
 * @param max - Maximum value in range
 * @param stops - Hex gradient stops (positions are 0-1)
 * @returns CSS hex color string
 *
 * @example
 * ```typescript
 * // Map elevation (-100m to 5000m) to blue-white-red gradient
 * const gradient: HexStop[] = [
 *   { position: 0.0, color: "#0000ff" },  // Blue (deep underwater)
 *   { position: 0.5, color: "#ffffff" },  // White (sea level)
 *   { position: 1.0, color: "#ff0000" },  // Red (mountain peaks)
 * ];
 * const color = valueToGradientColor(2500, -100, 5000, gradient);
 * // Returns color for 2500m elevation (roughly mid-point, whitish)
 * ```
 */
export function valueToGradientColor(
    value: number,
    min: number,
    max: number,
    stops: HexStop[]
): string {
    // Normalize value to 0-1 range
    const normalized = (value - min) / (max - min);

    // Interpolate gradient
    return interpolateHexGradient(normalized, stops);
}
