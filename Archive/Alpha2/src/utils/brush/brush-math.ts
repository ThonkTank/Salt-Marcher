/**
 * Brush Math Utilities
 *
 * Pure functions for brush value calculations.
 *
 * @module utils/brush/brush-math
 */

import type { FalloffType, BrushMode } from './types';
import { lerp } from '../common/math';

/**
 * Calculate falloff factor (0-1) based on distance from center.
 * Returns 1 at center, decreasing towards edge.
 *
 * @param distance - Distance from brush center
 * @param maxDistance - Maximum distance (brush radius)
 * @param falloffType - Type of falloff curve
 * @returns Falloff factor between 0 and 1
 */
export function calculateFalloff(
    distance: number,
    maxDistance: number,
    falloffType: FalloffType
): number {
    // At center, always full strength
    if (maxDistance === 0 || distance === 0) return 1;

    // Normalize distance to 0-1 range
    const t = Math.min(1, distance / maxDistance);

    switch (falloffType) {
        case 'none':
            // Constant strength everywhere
            return 1;

        case 'linear':
            // Linear decrease: 1 at center, 0 at edge
            return 1 - t;

        case 'smooth': {
            // Smoothstep: 3t² - 2t³ applied to inverted distance
            const s = 1 - t;
            return s * s * (3 - 2 * s);
        }

        case 'gaussian': {
            // Gaussian falloff: e^(-d²/(2σ²))
            // σ = maxDistance / 2 gives nice falloff with ~13.5% at edge
            const sigma = maxDistance / 2;
            return Math.exp(-(distance * distance) / (2 * sigma * sigma));
        }
    }
}

/**
 * Apply brush value to current tile value.
 *
 * @param currentValue - Current field value
 * @param targetValue - Value to apply (or add in sculpt mode, or noise amplitude)
 * @param strength - Brush strength (0-100)
 * @param falloff - Falloff factor at this point (0-1)
 * @param mode - Brush mode: 'set' interpolates, 'sculpt' adds, 'noise' randomizes
 * @returns New value for the field
 */
export function applyBrushValue(
    currentValue: number,
    targetValue: number,
    strength: number,
    falloff: number,
    mode: BrushMode
): number {
    // Calculate effective strength (0-1)
    const effectiveStrength = (strength / 100) * falloff;

    switch (mode) {
        case 'set':
            // Interpolate towards target value
            return lerp(currentValue, targetValue, effectiveStrength);

        case 'sculpt':
            // Add/subtract with dampening for finer control
            // current + target * strength * 0.1
            return currentValue + targetValue * effectiveStrength * 0.1;

        case 'noise':
            // Add random noise with dampening for subtle variation
            const noise = (Math.random() * 2 - 1) * targetValue * effectiveStrength * 0.1;
            return currentValue + noise;

        case 'smooth':
            // Smooth mode is handled separately with neighbor averages
            // This case should not be reached in normal flow
            return currentValue;
    }
}

/**
 * Apply smooth brush - blend towards neighbor average.
 *
 * @param currentValue - Current field value
 * @param neighborAverage - Average value of neighboring tiles
 * @param strength - Brush strength (0-100)
 * @param falloff - Falloff factor at this point (0-1)
 * @returns Smoothed value
 */
export function applySmoothValue(
    currentValue: number,
    neighborAverage: number,
    strength: number,
    falloff: number
): number {
    const effectiveStrength = (strength / 100) * falloff;
    // Interpolate towards neighbor average
    return lerp(currentValue, neighborAverage, effectiveStrength);
}
