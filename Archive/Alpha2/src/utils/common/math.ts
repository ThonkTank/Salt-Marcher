/**
 * Common math utilities used across the codebase
 */

export type Point = { x: number; y: number };

// ============================================================================
// Clamp Utilities
// ============================================================================

/**
 * Clamp a value between min and max (inclusive)
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Factory for creating clamping functions with rounding.
 * Reduces repetition for domain-specific clamp functions.
 *
 * @example
 * const clampLevel = createClampRound(1, 20);
 * clampLevel(15.7); // 16
 * clampLevel(25);   // 20
 */
export function createClampRound(min: number, max: number): (value: number) => number {
    return (value: number) => clamp(Math.round(value), min, max);
}

/** Clamp D&D character level (1-20) */
export const clampLevel = createClampRound(1, 20);

/** Clamp climate scale value (1-12) */
export const clampClimate = createClampRound(1, 12);

/** Clamp hour value (0-23) */
export const clampHour = createClampRound(0, 23);

/**
 * Calculate Euclidean distance between two points
 */
export function euclideanDistance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two points are approximately equal within tolerance
 */
export function pointsApproximatelyEqual(
    p1: Point,
    p2: Point,
    tolerance: number = 0.001
): boolean {
    return euclideanDistance(p1, p2) < tolerance;
}

/**
 * Generate random variation within symmetric range [-range, +range]
 */
export function randomVariation(range: number): number {
    return Math.floor(Math.random() * (range * 2 + 1)) - range;
}

/**
 * Linear interpolation between two values
 */
export function lerp(from: number, to: number, ratio: number): number {
    return from + (to - from) * ratio;
}

/**
 * Normalize a value to 0-1 range
 */
export function normalize(value: number, min: number, max: number): number {
    return (value - min) / (max - min);
}

/**
 * Squared Euclidean distance (faster when only comparing distances)
 */
export function distanceSquared(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
}
